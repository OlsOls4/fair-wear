import type { CaseDocument, CaseImage } from "./case-builder";

/** Call only after parseCaseBackup. Decode serially to cap concurrent pixel allocations.
 * Re-encode pixels so imported JPEG metadata is not carried into the restored case.
 * The stored original-file hash is unverified metadata, not a hash of this display copy.
 */
export async function prepareBackupImages(document: CaseDocument): Promise<CaseDocument> {
  async function prepare(photo: CaseImage | undefined): Promise<CaseImage | undefined> {
    if (!photo) return undefined;
    return new Promise((resolve, reject) => {
      const image = new Image();
      const timeout = setTimeout(() => failed(), 15_000);
      function cleanup() { clearTimeout(timeout); image.onload = null; image.onerror = null; }
      function failed() { cleanup(); image.src = ""; reject(new Error("A backup photo could not be decoded safely. Your current case has not changed.")); }
      image.onerror = failed;
      image.onload = () => {
        try {
          const { naturalWidth: width, naturalHeight: height } = image;
          if (!width || !height || width > 1600 || height > 1600) { failed(); return; }
          const canvas = window.document.createElement("canvas"); canvas.width = width; canvas.height = height;
          const context = canvas.getContext("2d"); if (!context) { failed(); return; }
          context.fillStyle = "#fff"; context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0);
          const src = canvas.toDataURL("image/jpeg", 0.9);
          if (!src.startsWith("data:image/jpeg;base64,")) { failed(); return; }
          cleanup(); resolve({ src, origin: "local", ...(photo.sha256 ? { sha256: photo.sha256 } : {}) });
        } catch { failed(); }
      };
      image.src = photo.src;
    });
  }
  const items = [];
  for (const item of document.items) {
    const before = await prepare(item.before), after = await prepare(item.after);
    items.push({ ...item, ...(before ? { before } : {}), ...(after ? { after } : {}) });
  }
  return { ...document, items };
}
