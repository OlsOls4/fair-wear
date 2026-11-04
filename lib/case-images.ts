import type { CaseDocument, CaseImage } from "./case-builder";
import { imageDimensions, MAX_IMAGE_PIXELS, MAX_IMAGE_SIDE } from "./image-dimensions";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read this image. Choose another JPEG, PNG or WebP file."));
    reader.readAsDataURL(blob);
  });
}
/** Local pixels only: no upload, no EXIF copying, no external inference. */
export async function localCaseImage(file: File): Promise<CaseImage> {
  if (!MIME_TYPES.has(file.type)) throw new Error("Choose a JPEG, PNG or WebP photo. HEIC and SVG are not supported.");
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error("Each photo must be between 1 byte and 8 MB.");
  const buffer = await file.arrayBuffer();
  imageDimensions(new Uint8Array(buffer), file.type);
  const hash = globalThis.crypto?.subtle ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))).map((byte) => byte.toString(16).padStart(2, "0")).join("") : undefined;
  const original = await blobDataUrl(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("This file could not be decoded as an image.")); image.src = original;
  });
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS || image.naturalWidth > MAX_IMAGE_SIDE || image.naturalHeight > MAX_IMAGE_SIDE) throw new Error("This image is too large to prepare safely. Use a smaller copy.");
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d"); if (!context) throw new Error("Your browser could not prepare the image. Try another browser.");
  context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { src: canvas.toDataURL("image/jpeg", 0.9), origin: "local", sha256: hash };
}

/** Only static sample assets can use fetch. Personal photo data never enters a network request. */
export async function embedCaseImages(document: CaseDocument): Promise<CaseDocument> {
  async function embed(image: CaseImage | undefined): Promise<CaseImage | undefined> {
    if (!image) return undefined;
    if (image.origin === "local") {
      if (!image.src.startsWith("data:image/")) throw new Error("A local image could not be embedded. Please select it again.");
      return image;
    }
    if (!/^\/demo\/flat\/crops\/[a-zA-Z0-9_-]+\.(?:jpg|png|webp)$/.test(image.src)) throw new Error("Unexpected sample image source. Export stopped.");
    const response = await fetch(image.src, { credentials: "omit", cache: "force-cache" });
    if (!response.ok) throw new Error("A sample photo could not be loaded. Check your connection and try exporting again.");
    const blob = await response.blob();
    if (!MIME_TYPES.has(blob.type) || blob.size > MAX_IMAGE_BYTES) throw new Error("A sample photo was not a supported image. Export stopped.");
    return { ...image, src: await blobDataUrl(blob) };
  }
  // Omitted images are never read, fetched or included in the exported file.
  return { ...document, items: await Promise.all(document.items.map(async (item) => item.response === "omit" ? { ...item, before: undefined, after: undefined } : { ...item, before: await embed(item.before), after: await embed(item.after) })) };
}
