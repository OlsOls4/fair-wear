import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCaseBackup, serializeCaseBackup, BACKUP_FORMAT, MAX_BACKUP_BYTES } from "../lib/case-backup";
import { buildCaseHtml, caseReply, emptyCaseItem, type CaseDocument } from "../lib/case-builder";

const fixture: CaseDocument = { mode: "personal", title: "My case <script>alert(1)</script>", photoContext: "other", items: [{ ...emptyCaseItem("claim-1"), item: "Carpet", claimPounds: "62.50", note: "A note", response: "discuss", evidenceChecklist: { moveIn: "provided", moveOut: "requested" } }, { ...emptyCaseItem("claim-2"), response: "omit", note: "Keep privately" }] };
const photo = readFileSync("public/demo/flat/crops/bedroom-move_in-carpet-0.jpg");
fixture.items[0].before = { src: `data:image/jpeg;base64,${photo.toString("base64")}`, origin: "local", sha256: "a".repeat(64) };
let count = 0;
function check(name: string, fn: () => void) { fn(); count++; console.log(`ok ${name}`); }
function alter(change: (value: any) => void) { const value = JSON.parse(serializeCaseBackup(fixture)); change(value); return JSON.stringify(value); }
check("roundtrip preserves private notes, omissions, images, context and statuses", () => assert.deepEqual(parseCaseBackup(serializeCaseBackup(fixture)), fixture));
check("imported data stays escaped in evidence export", () => { const restored = parseCaseBackup(serializeCaseBackup(fixture)); assert.ok(buildCaseHtml(restored).includes("&lt;script&gt;")); assert.ok(caseReply(restored).includes("A note")); assert.ok(!buildCaseHtml(restored).includes("Keep privately")); });
const mutations: [string, (value: any) => void][] = [
  ["unknown version", v => v.version = 2], ["unknown format", v => v.format = "other"], ["sample mode", v => v.case.mode = "sample"],
  ["forged model output", v => v.case.items[0].model = { verdict: "damage" }], ["sample provenance", v => v.case.items[0].sampleReview = "Agree"],
  ["external image", v => v.case.items[0].before.src = "https://attacker.invalid/photo"], ["SVG image", v => v.case.items[0].before.src = "data:image/svg+xml;base64,PHN2Zz4="],
  ["wrong magic", v => v.case.items[0].before.src = "data:image/jpeg;base64,PHN2Zz4="], ["truncated image", v => v.case.items[0].before.src = v.case.items[0].before.src.slice(0, -4)],
  ["sample image origin", v => v.case.items[0].before.origin = "sample"], ["invalid hash", v => v.case.items[0].before.sha256 = "trusted"],
  ["duplicate ids", v => v.case.items[1].id = v.case.items[0].id], ["empty items", v => v.case.items = []], ["too many items", v => v.case.items = Array(13).fill(v.case.items[0])],
  ["bad response", v => v.case.items[0].response = "accept"], ["bad cost type", v => v.case.items[0].costType = "settlement"], ["bad status", v => v.case.items[0].evidenceChecklist.moveIn = "verified"],
  ["unknown evidence field", v => v.case.items[0].evidenceChecklist.authentication = "verified"], ["long note", v => v.case.items[0].note = "x".repeat(5001)],
  ["prototype field", v => v.case.items[0] = JSON.parse('{"__proto__":{"polluted":true}}')], ["null item", v => v.case.items[0] = null], ["missing title", v => delete v.case.title], ["invalid context", v => v.case.photoContext = "verified"],
];
for (const [name, change] of mutations) check(`reject ${name}`, () => assert.throws(() => parseCaseBackup(alter(change))));
check("reject HTML and malformed JSON", () => { assert.throws(() => parseCaseBackup("<!doctype html>")); assert.throws(() => parseCaseBackup("{")); });
check("reject oversized source before parse", () => assert.throws(() => parseCaseBackup(" ".repeat(MAX_BACKUP_BYTES + 1)), /32 MB/));
check("oversized save gives actionable remedy and no false success", () => { const tooLarge = structuredClone(fixture); tooLarge.items[0].before!.src = "x".repeat(5 * 1024 * 1024 + 1); assert.throws(() => serializeCaseBackup(tooLarge), /No backup was saved.*remove some display photos/); });
check("cannot save sample case", () => assert.throws(() => serializeCaseBackup({ ...fixture, mode: "sample" }), /private cases only/));
check("unknown financial input remains unknown, not coerced", () => { const restored = parseCaseBackup(alter(v => v.case.items[0].claimPounds = "bad")); assert.equal(restored.items[0].claimPounds, "bad"); });
check("plain minimal fixture is supported", () => assert.equal(parseCaseBackup(JSON.stringify({format:BACKUP_FORMAT, version:1, case:{mode:"personal", title:"", photoContext:"tenancy", items:[emptyCaseItem("a")]}})).items.length, 1));
console.log(`${count} case backup checks passed`);
