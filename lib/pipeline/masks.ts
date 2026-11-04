// Decode SAM 3.1 mask tokens ("x=0;y=0;c=..;data=H,W,!payload") into binary rasters with Meta's @meta-sam/parser.
// Sandbox/scripts only. The raster covers the record's box, starting at (x1, y1).
import fs from "node:fs";
import { decodeMaskToRaster } from "@meta-sam/parser";

export function parseMaskToken(mask: string) {
  const data = mask.split("data=")[1];
  if (!data) return undefined;
  const [h, w, ...rest] = data.split(",");
  const payload = rest.join(",");
  return { encoding: (payload[0] === "!" ? "one_bit" : "lossless") as "one_bit" | "lossless", width: +w, height: +h, payload };
}

export function decodeMask(mask: string): { w: number; h: number; raster: Uint8Array } | undefined {
  const m = parseMaskToken(mask);
  if (!m) return undefined;
  return { w: m.width, h: m.height, raster: decodeMaskToRaster(m) };
}

/** Write a decoded mask as a binary PGM (0/255) so Python/PIL can draw outlines without extra deps. */
export function writePgm(file: string, d: { w: number; h: number; raster: Uint8Array }) {
  const px = Buffer.alloc(d.w * d.h);
  for (let i = 0; i < px.length; i++) px[i] = d.raster[i] ? 255 : 0;
  fs.writeFileSync(file, Buffer.concat([Buffer.from(`P5\n${d.w} ${d.h}\n255\n`), px]));
}
