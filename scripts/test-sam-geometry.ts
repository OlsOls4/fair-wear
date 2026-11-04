// Handwritten protocol fixtures, not captured model traces or accuracy evidence.
import assert from "node:assert/strict";
import { parseSamText, parseSamLines } from "../lib/pipeline/sam-geometry";
import { SamResponseError } from "../lib/pipeline/sam-response";
import { independentCropBoxes } from "./crop-plan";
import { createAnalyzeHandler } from "../lib/pipeline/analyze";
globalThis.fetch = async () => { throw new Error("No network in geometry tests"); };
const box = "<|box;x1=10;y1=20;x2=14;y2=24;w=100;h=80;c=0.75|>";
const mask = "<|mask;x=0;y=0;data=5,5,!!!!!(QO(0lu8?|>";
const line = `<7f>10${box}${mask}`;
let checks = 0;
function check(label: string, fn: () => void) { fn(); checks++; console.log(`ok ${label}`); }
check("empty output has no detections, including CRLF whitespace", () => {
  for (const value of ["", "\n", "\r\n\t\r\n"]) assert.deepEqual(parseSamText(value), { records: [], warnings: [] });
});
check("inclusive source bounds become finite half-open local crop bounds", () => {
  const [r] = parseSamLines(line);
  assert.deepEqual(r.box, [10, 20, 15, 25]); assert.equal(r.id, "10"); assert.equal(r.frame, 7);
  assert.equal(r.conf, .75); assert.equal(r.mask, mask.slice(7, -2));
  assert.deepEqual(independentCropBoxes([...r.box, r.w, r.h], [...r.box, r.w, r.h]).before, r.box);
  const edge = parseSamLines(line.replace(box, "<|box;x1=99;y1=79;x2=99;y2=79;w=100;h=80|>"))[0];
  assert.deepEqual(edge.box, [99, 79, 100, 80]);
});
check("sparse, large and leading-zero object IDs never lose precision", () => {
  for (const id of ["0", "0007", "9007199254740993", "9007199254740992"]) assert.equal(parseSamLines(line.replace(">10<", `>${id}<`))[0].id, id);
  const all = parseSamLines(`${line},9007199254740993${box}${mask}`);
  assert.deepEqual(all.map(r => r.id), ["10", "9007199254740993"]);
});
check("documented optional commas, reversed tokens, reordered fields and extensions", () => {
  const value = `<7f;future=1>,10<|extra;future=hello=there|>${mask}<|box; h = 80 ; w=100; y2=24; x2=14; y1=20; x1=10;future=a=b; |>`;
  const result = parseSamText(value);
  assert.deepEqual(result.records[0].box, [10, 20, 15, 25]);
  assert.deepEqual(result.warnings.map(w => w.code), ["ignored_field", "ignored_token"]);
  assert.equal(parseSamLines(`${line}2${box}${mask}`).length, 2);
});
check("frame IDs may skip or run backward; image mode rejects nonzero frame", () => {
  assert.deepEqual(parseSamLines(`${line}\n${line.replace("<7f>", "<2f>")}\n`).map(r => r.frame), [7, 2]);
  assert.throws(() => parseSamText(line, "image"), SamResponseError);
  assert.equal(parseSamText(line.replace("<7f>", "<0f>"), "image").records.length, 1);
});
check("confidence follows protocol: optional, finite, decimal/exponent, invalid ignored", () => {
  for (const raw of ["0", "1", ".25", "7.5e-1", "1e-05", "-0"]) {
    const parsed = parseSamText(line.replace("c=0.75", `c=${raw}`));
    assert.equal(parsed.records[0].conf, Number(raw) === 0 ? 0 : Number(raw)); assert.deepEqual(parsed.warnings, []);
  }
  for (const field of ["c=NaN", "c=Infinity", "c=-1", "c=1.1", "c=", "c", "c=0.5;c=0.5", "c=0x1", "c=1e999", "c=+0.5"]) {
    const parsed = parseSamText(line.replace("c=0.75", field));
    assert.equal(parsed.records[0].conf, undefined); assert.deepEqual(parsed.warnings.map(w => w.code), ["ignored_confidence"]);
  }
  const missing = parseSamText(line.replace(";c=0.75", ""));
  assert.equal(missing.records[0].conf, undefined); assert.deepEqual(missing.warnings, []);
  assert.equal(parseSamLines(line.replace("mask;x=0", "mask;c=0.1;x=0"))[0].conf, .75);
});
check("bad geometry never produces NaN, infinity, invalid crop, or partial records", () => {
  const invalid = [
    line.replace("x1=10", "x1=NaN"), line.replace("x1=10", "x1="), line.replace("x1=10", "other=10"),
    line.replace("x1=10", "x1=-1"), line.replace("x1=10", "x1=10.5"), line.replace("x1=10", "x1=0x10"),
    line.replace("x1=10", "x1=15"), line.replace("y1=20", "y1=25"),
    line.replace("x2=14", "x2=100"), line.replace("y2=24", "y2=80"),
    line.replace("w=100", "w=0"), line.replace("h=80", "h=-1"), line.replace("w=100", "w=9007199254740992"),
    line.replace("<7f>", "<9007199254740992f>"), line.replace("x1=10", "x1=10;x1=10"),
    line.replace(box, box + box), line.replace(mask, mask + mask),
  ];
  for (const value of invalid) for (const prefix of ["", line + "\n", line + ","]) assert.throws(() => parseSamLines(prefix + value), SamResponseError);
});
check("unparsed nonempty syntax, bare headers and truncated records fail closed", () => {
  for (const value of ["garbage", "<0f>", "<0f>,", line + ",", line + "junk", line + "\nunknown", line.replace(mask, ""), line.replace(box, ""), line.slice(0, -1), line.replace("<7f>", "<-7f>"), line.replace("<7f>", "<7.1f>")]) assert.throws(() => parseSamLines(value), SamResponseError);
});
check("mask envelope checked without pretending to decode payload pixels", () => {
  for (const value of [line.replace("mask;x=0", "mask;x=1"), line.replace("data=5,5,", "data=0,5,"), line.replace("data=5,5,", "data=9007199254740991,2,"), line.replace("data=5,5,!", "data=5,5,?"), line.replace(mask, "<|mask;x=0;y=0;data=5,5,!|>")]) assert.throws(() => parseSamLines(value), SamResponseError);
  assert.equal(parseSamLines(line.replace("data=5,5,!", "data=5,5,~"))[0].mask.includes("~"), true);
  // Deliberate documented limit: alphabet-only validation is not payload decoding.
  assert.equal(parseSamLines(line.replace(mask, "<|mask;x=0;y=0;data=5,5,!a|>")).length, 1);
});
async function main() {
  let judged = 0, packed = 0;
  const handler = createAnalyzeHandler({ mock: false,
    extractItems: async () => { parseSamLines(line + "\n<0f>"); return []; },
    judge: async () => { judged++; throw new Error("must not judge"); },
    buildPack: async () => { packed++; throw new Error("must not pack"); },
  });
  const response = await handler(new Request("http://localhost", { method: "POST", body: JSON.stringify({ property: "fixture", context: "tenancy", tenancyYears: 2, rooms: [{ room: "bedroom", moveInUrl: "fixture-a", moveOutUrl: "fixture-b", moveInDate: "2022-01-01", moveOutDate: "2024-01-01", provenance: "user_supplied_records", sameRoomConfirmed: true, sameItemsConfirmed: true }] }) }));
  assert.equal(response.status, 502); const result = await response.json(); assert.equal(result.error, "segmentation_unavailable"); assert.equal("pack" in result, false);
  assert.equal(judged, 0); assert.equal(packed, 0);
  console.log(`Passed ${checks} geometry groups plus downstream failure containment; no model calls.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
