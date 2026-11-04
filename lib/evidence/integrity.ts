export interface SourceFingerprint { url: string; bytes: number; sha256: string }
export function validateSource(source: SourceFingerprint): void {
  if (!/^\/(demo|evidence)\/[a-zA-Z0-9_./-]+$/.test(source.url) || source.url.split("/").includes("..") || !Number.isSafeInteger(source.bytes) || source.bytes < 0 || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error("Invalid source fingerprint");
}
export async function verifySourceBytes(source: SourceFingerprint, bytes: ArrayBuffer): Promise<boolean> {
  validateSource(source);
  if (bytes.byteLength !== source.bytes) return false;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("") === source.sha256;
}
