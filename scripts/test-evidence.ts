import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { analyzeEvidence, buildEvidenceCases, caseId, explainCase, type EvidenceCase } from "../lib/evidence/analysis";
import { baselineEvidence, evidenceCases, evidenceManifest } from "../lib/evidence/demo";
import { validateSource, verifySourceBytes } from "../lib/evidence/integrity";
import { compareDamagePolicy } from "../lib/evidence/policy-baseline";
import published from "../public/demo/flat-eval.json";
let count = 0;
function test(label: string, fn: () => void) { fn(); console.log(`ok ${++count} ${label}`); }
const main = async () => {
  test("baseline metrics reproduce original evaluation", () => {
    for (const key of ["planted", "detected", "exactVerdict", "damagePlanted", "damageFound", "decoys", "decoysWronglyDamage", "unplantedItemsChecked", "falseAlarms"] as const) assert.equal(baselineEvidence[key], published[key], key);
    assert.equal(baselineEvidence.observationCount, 20); assert.equal(evidenceCases.length, 13);
  });
  test("fixed damage policy preserves evidence and exposes both benefits and costs", () => {
    const original = JSON.stringify(evidenceCases);
    const { recorded, alwaysDamage } = compareDamagePolicy(evidenceCases);
    assert.deepEqual(recorded, {
      observations: 20, retainedObservations: 20, plantedGroups: 8, detectedGroups: 6,
      exactLabelGroups: 4, damageGroups: 4, damageFound: 3, fairWearGroups: 2,
      fairWearCalledDamage: 1, unplantedGroups: 5, unplantedObservations: 9,
      unplantedChangeFlags: 1, unplantedDamageFlags: 0, missingRecordGroups: 1,
    });
    assert.deepEqual(alwaysDamage, { ...recorded, detectedGroups: 7, damageFound: 4,
      fairWearCalledDamage: 2, unplantedChangeFlags: 9, unplantedDamageFlags: 9 });
    assert.equal(JSON.stringify(evidenceCases), original);
  });
  test("fixed policy does not invent missing observations or eligible confidence", () => {
    const missing = evidenceCases.filter(row => row.id === "bathroom/sealant");
    const result = compareDamagePolicy(missing);
    assert.equal(result.alwaysDamage.observations, 0);
    assert.equal(result.alwaysDamage.missingRecordGroups, 1);
    assert.equal(result.alwaysDamage.detectedGroups, 0);
    const invalid = [{ ...evidenceCases[1], observations: [{ ...evidenceCases[1].observations[0], confidence: null }] }];
    assert.equal(compareDamagePolicy(invalid).alwaysDamage.retainedObservations, 0);
    assert.equal(compareDamagePolicy([]).alwaysDamage.observations, 0);
  });
  test("visible observation scope matches saved crops and includes the empty planted group", () => {
    const planted = evidenceCases.filter(row => row.expected !== null);
    const unplanted = evidenceCases.filter(row => row.expected === null);
    assert.equal(evidenceCases.filter(row => row.observations.length).length, 12);
    assert.equal(planted.length, 8);
    assert.equal(planted.filter(row => row.observations.length).length, 7);
    assert.equal(planted.reduce((n, row) => n + row.observations.length, 0), 11);
    assert.deepEqual(planted.filter(row => !row.observations.length).map(row => row.id), ["bathroom/sealant"]);
    assert.equal(unplanted.length, 5);
    assert.equal(unplanted.reduce((n, row) => n + row.observations.length, 0), 9);
  });
  test("all eight planted rows reproduce detection and exactness", () => {
    for (const expected of published.rows) { const row = baselineEvidence.rows.find((r) => r.id === caseId(expected.room, expected.item))!; assert.equal(row.exact, expected.exact); assert.equal(!!row.flagged.length, expected.detected); }
  });
  test("missing output is not a missing item or a confident negative", () => {
    const row = baselineEvidence.rows.find((r) => r.id === "bathroom/sealant")!;
    assert.equal(row.outcome, "no_record"); assert.equal(row.observations.length, 0); assert.match(explainCase(row), /cannot be independently reconstructed/);
  });
  test("mixed crop results are preserved rather than collapsed", () => {
    const row = baselineEvidence.rows.find((r) => r.id === "bedroom/wall")!;
    assert.equal(row.observations.length, 3); assert.deepEqual(row.distinctVerdicts, ["no_change", "damage"]); assert.match(explainCase(row), /Other crops disagree/);
  });
  test("ninety percent removes a decoy flag but also correct labels", () => {
    const r = analyzeEvidence(evidenceCases, .9);
    assert.equal(r.retainedCount, 13); assert.equal(r.detected, 3); assert.equal(r.exactVerdict, 2); assert.equal(r.decoysWronglyDamage, 0); assert.equal(r.falseAlarms, 0);
    assert.equal(r.rows.find((x) => x.id === "bedroom/carpet")!.outcome, "withheld");
    assert.equal(r.rows.find((x) => x.id === "bedroom/wall")!.outcome, "no_change");
  });
  test("all observations can be withheld without changing source counts", () => {
    const r = analyzeEvidence(evidenceCases, 1); assert.equal(r.retainedCount, 0); assert.equal(r.exactVerdict, 0); assert.equal(r.planted, 8); assert.equal(r.unplantedItemsChecked, 9); assert.equal(r.missingRecords, 1);
  });
  test("inclusive confidence boundary is exact", () => {
    const r = analyzeEvidence(evidenceCases, .9); assert.ok(r.rows.find((x) => x.id === "bathroom/bath")!.retained.length);
    assert.equal(analyzeEvidence(evidenceCases, .9000001).rows.find((x) => x.id === "bathroom/bath")!.retained.length, 0);
  });
  test("increasing thresholds cannot invent retained evidence", () => {
    let prev = analyzeEvidence(evidenceCases, 0);
    for (let i = 1; i <= 100; i++) { const next = analyzeEvidence(evidenceCases, i / 100); assert.ok(next.retainedCount <= prev.retainedCount); assert.ok(next.exactVerdict <= prev.exactVerdict); assert.ok(next.detected <= prev.detected); prev = next; }
  });
  test("analysis never mutates the source", () => {
    const before = JSON.stringify(evidenceCases); analyzeEvidence(evidenceCases, .93); assert.equal(JSON.stringify(evidenceCases), before);
  });
  test("invalid thresholds fail closed", () => {
    for (const threshold of [-1, 1.1, NaN, Infinity]) assert.throws(() => analyzeEvidence(evidenceCases, threshold));
  });
  test("invalid confidence is never retained even at zero", () => {
    for (const confidence of [NaN, Infinity, -.1, 1.1]) {
      const cases: EvidenceCase[] = [{ ...evidenceCases[1], observations: [{ ...evidenceCases[1].observations[0], confidence }] }];
      assert.equal(analyzeEvidence(cases).retainedCount, 0); assert.equal(analyzeEvidence(cases).rows[0].outcome, "withheld");
    }
  });
  test("duplicate records and duplicate expected labels reject ambiguous inputs", () => {
    const room = { room: "x", moveIn: "/a", moveOut: "/b", planted: [{ item: "curtain", verdict: "fair_wear" }, { item: "curtains", verdict: "fair_wear" }] };
    assert.throws(() => buildEvidenceCases([], [room]), /Duplicate planted/);
    const o = { ...evidenceCases[0].observations[0], room: "x" };
    assert.throws(() => buildEvidenceCases([o, o], [{ ...room, planted: [] }]), /Duplicate observation/);
    assert.throws(() => buildEvidenceCases([o], []), /No input room/);
  });
  test("manifest explicitly records missing traces and non-attestation", () => {
    assert.equal(evidenceManifest.availability.samMasks, false); assert.equal(evidenceManifest.availability.originalSamBoxes, false); assert.equal(evidenceManifest.availability.rawJudgeApiEnvelopes, false); assert.match(evidenceManifest.scope, /Not an external attestation/);
  });
  test("manifest has 51 unique sources and a content-derived identity", () => {
    assert.equal(evidenceManifest.sources.length, 51); assert.equal(new Set(evidenceManifest.sources.map((x) => x.url)).size, 51);
    assert.equal(createHash("sha256").update(JSON.stringify(evidenceManifest.sources)).digest("hex"), evidenceManifest.snapshotId);
  });
  test("unsafe manifest targets and malformed fingerprints reject", () => {
    for (const url of ["https://example.com/a", "/demo/../secret", "//example.com", "/other/file", "/demo/a?b=1"]) assert.throws(() => validateSource({ ...evidenceManifest.sources[0], url }));
    assert.throws(() => validateSource({ ...evidenceManifest.sources[0], sha256: "wrong" }));
    assert.throws(() => validateSource({ ...evidenceManifest.sources[0], bytes: -1 }));
  });
  for (const source of evidenceManifest.sources) {
    const bytes = fs.readFileSync(`public${source.url}`);
    const buffer = Uint8Array.from(bytes).buffer;
    assert.equal(await verifySourceBytes(source, buffer), true, source.url);
  }
  console.log(`ok ${++count} all 51 source bytes pass the same browser verification function`);
  const source = evidenceManifest.sources[0];
  const modified = Uint8Array.from(fs.readFileSync(`public${source.url}`)); modified[0] ^= 1;
  assert.equal(await verifySourceBytes(source, modified.buffer), false);
  assert.equal(await verifySourceBytes(source, modified.buffer.slice(1)), false);
  console.log(`ok ${++count} modified bytes and truncated files fail verification`);
  assert.equal(fs.readFileSync("eval/flat/planted.json", "utf8"), fs.readFileSync("public/evidence/planted.json", "utf8"));
  console.log(`ok ${++count} published test intent is a byte-identical source copy`);
  console.log(`${count} evidence analysis and integrity checks passed. No model calls.`);
};
main().catch((error) => { console.error(error); process.exitCode = 1; });
