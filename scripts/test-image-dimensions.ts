import assert from "node:assert/strict";
import fs from "node:fs";
import { imageDimensions } from "../lib/image-dimensions";

let count = 0;
function test(name: string, fn: () => void) { fn(); count++; console.log(`ok ${name}`); }
function png(width: number, height: number) { const bytes = new Uint8Array(33); const view = new DataView(bytes.buffer); bytes.set([137,80,78,71,13,10,26,10]); view.setUint32(8,13); bytes.set([73,72,68,82],12); view.setUint32(16,width); view.setUint32(20,height); return bytes; }
function jpeg(width: number, height: number) { const bytes = new Uint8Array([0xff,0xd8,0xff,0xc0,0,8,8,0,0,0,0,1]); const view = new DataView(bytes.buffer); view.setUint16(7,height); view.setUint16(9,width); return bytes; }
function webp(type: "VP8X" | "VP8L" | "VP8 ", width: number, height: number) { const bytes = new Uint8Array(30); const view = new DataView(bytes.buffer); for (const [offset, text] of [[0,"RIFF"],[8,"WEBP"],[12,type]] as const) bytes.set(Buffer.from(text),offset); view.setUint32(4,22,true); view.setUint32(16,10,true); if(type==="VP8X") { const w=width-1,h=height-1; bytes[24]=w&255;bytes[25]=(w>>8)&255;bytes[26]=(w>>16)&255;bytes[27]=h&255;bytes[28]=(h>>8)&255;bytes[29]=(h>>16)&255; } else if(type==="VP8L") { const w=width-1,h=height-1;bytes[20]=0x2f;bytes[21]=w&255;bytes[22]=((w>>8)&63)|((h&3)<<6);bytes[23]=(h>>2)&255;bytes[24]=(h>>10)&15; } else {bytes.set([0x9d,1,0x2a],23);view.setUint16(26,width,true);view.setUint16(28,height,true);} return bytes; }
test("PNG, JPEG and three WebP header variants report dimensions", () => {
  assert.deepEqual(imageDimensions(png(4000,3000),"image/png"),{width:4000,height:3000});
  assert.deepEqual(imageDimensions(jpeg(4000,3000),"image/jpeg"),{width:4000,height:3000});
  for(const type of ["VP8X","VP8L","VP8 "] as const) assert.deepEqual(imageDimensions(webp(type,4000,3000),"image/webp"),{width:4000,height:3000});
});
test("oversized and zero-dimension images fail before decoding", () => {
  for(const [w,h] of [[0,10],[10,0],[12001,1],[6000,4001],[100000,100000]]) assert.throws(()=>imageDimensions(png(w,h),"image/png"),/24 megapixels/);
  assert.deepEqual(imageDimensions(png(6000,4000),"image/png"),{width:6000,height:4000});
  assert.throws(()=>imageDimensions(jpeg(6000,4001),"image/jpeg"),/24 megapixels/);
  assert.throws(()=>imageDimensions(webp("VP8X",6000,4001),"image/webp"),/24 megapixels/);
});
test("animated images are refused", () => {
  const animated = webp("VP8X",100,100); animated[20] = 2; assert.throws(()=>imageDimensions(animated,"image/webp"),/Animated/);
  const apng = new Uint8Array(53); apng.set(png(100,100)); const view = new DataView(apng.buffer); view.setUint32(33,8); apng.set(Buffer.from("acTL"),37); assert.throws(()=>imageDimensions(apng,"image/png"),/Animated/);
});
test("truncated and mislabeled data fails closed", () => {
  for(const type of ["image/png","image/jpeg","image/webp"]) for(const len of [0,1,5,20]) assert.throws(()=>imageDimensions(new Uint8Array(len),type));
  assert.throws(()=>imageDimensions(png(20,20),"image/jpeg"));
  const malformed=png(20,20);new DataView(malformed.buffer).setUint32(8,0xffffffff);assert.throws(()=>imageDimensions(malformed,"image/png"));
});
test("all existing generated JPEG scenes and crops can be read", () => {
  for(const dir of ["public/demo/flat","public/demo/flat/crops"]) for(const file of fs.readdirSync(dir).filter(file=>file.endsWith(".jpg"))) { const dimensions=imageDimensions(new Uint8Array(fs.readFileSync(`${dir}/${file}`)),"image/jpeg"); assert.ok(dimensions.width>0&&dimensions.height>0); }
});
console.log(`${count} image-header test groups passed.`);
