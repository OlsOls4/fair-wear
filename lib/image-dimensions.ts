export const MAX_IMAGE_PIXELS = 24_000_000;
export const MAX_IMAGE_SIDE = 12_000;
const decodeError = () => new Error("This photo has an unsupported or damaged image header. Choose another JPEG, PNG or non-animated WebP file.");
/** Read dimensions before asking a browser decoder to allocate the image. No image data leaves the tab. */
export function imageDimensions(bytes: Uint8Array, mime: string): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  const result = (width: number, height: number) => {
    if (!width || !height || width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE || width * height > MAX_IMAGE_PIXELS) throw new Error("Use a photo up to 24 megapixels, with neither side over 12,000 pixels. Resize a copy first; keep the original separately.");
    return { width, height };
  };
  if (mime === "image/png") {
    if (bytes.length < 33 || bytes[0] !== 137 || ascii(1, 3) !== "PNG" || bytes[4] !== 13 || bytes[5] !== 10 || bytes[6] !== 26 || bytes[7] !== 10 || ascii(12, 4) !== "IHDR" || view.getUint32(8) !== 13) throw decodeError();
    const dimensions = result(view.getUint32(16), view.getUint32(20));
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset), type = ascii(offset + 4, 4);
      if (type === "acTL") throw new Error("Choose a still photo. Animated images are not supported.");
      if (length > bytes.length - offset - 12) throw decodeError();
      offset += 12 + length;
    }
    return dimensions;
  }
  if (mime === "image/jpeg") {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw decodeError();
    for (let offset = 2; offset + 3 < bytes.length;) {
      if (bytes[offset] !== 0xff) throw decodeError();
      while (offset < bytes.length && bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd8) continue;
      if (offset + 2 > bytes.length) throw decodeError();
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) throw decodeError();
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 8) throw decodeError();
        return result(view.getUint16(offset + 5), view.getUint16(offset + 3));
      }
      offset += length;
    }
    throw decodeError();
  }
  if (mime === "image/webp") {
    if (bytes.length < 30 || ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WEBP") throw decodeError();
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const type = ascii(offset, 4), length = view.getUint32(offset + 4, true), start = offset + 8;
      if (length > bytes.length - start) throw decodeError();
      if (type === "VP8X" && length >= 10) {
        if (bytes[start] & 0x02) throw new Error("Choose a still photo. Animated images are not supported.");
        return result(1 + bytes[start + 4] + (bytes[start + 5] << 8) + (bytes[start + 6] << 16), 1 + bytes[start + 7] + (bytes[start + 8] << 8) + (bytes[start + 9] << 16));
      }
      if (type === "VP8L" && length >= 5 && bytes[start] === 0x2f) return result(1 + bytes[start + 1] + ((bytes[start + 2] & 0x3f) << 8), 1 + (bytes[start + 2] >> 6) + (bytes[start + 3] << 2) + ((bytes[start + 4] & 0x0f) << 10));
      if (type === "VP8 " && length >= 10 && bytes[start + 3] === 0x9d && bytes[start + 4] === 0x01 && bytes[start + 5] === 0x2a) return result(view.getUint16(start + 6, true) & 0x3fff, view.getUint16(start + 8, true) & 0x3fff);
      offset = start + length + (length % 2);
    }
  }
  throw decodeError();
}
