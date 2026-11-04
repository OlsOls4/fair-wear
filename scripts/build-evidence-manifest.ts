/** Build/check a deterministic byte-integrity manifest without any model calls. */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { buildEvidenceCases, analyzeEvidence } from "../lib/evidence/analysis";

const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const check = process.argv.includes("--check");
const raw = fs.readFileSync("public/demo/flat-results.json");
const truth = fs.readFileSync("eval/flat/planted.json");
const findings = JSON.parse(raw.toString()).findings;
const rooms = JSON.parse(truth.toString());
const allUrls: string[] = ["/demo/flat-results.json", "/demo/flat-eval.json", "/evidence/planted.json", ...rooms.flatMap((r: any) => [r.moveIn, r.moveOut]), ...findings.flatMap((o: any) => [o.before, o.after])];
const sources = [...new Set(allUrls)].sort().map((url) => {
  if (typeof url !== "string" || !/^\/(demo|evidence)\/[a-zA-Z0-9_./-]+$/.test(url) || url.split("/").includes("..")) throw new Error(`Unsafe source URL: ${url}`);
  const bytes = url === "/evidence/planted.json" ? truth : fs.readFileSync(path.join("public", url));
  return { url, bytes: bytes.length, sha256: hash(bytes) };
});
const result = analyzeEvidence(buildEvidenceCases(findings, rooms));
const published = JSON.parse(fs.readFileSync("public/demo/flat-eval.json", "utf8"));
for (const key of ["planted", "detected", "exactVerdict", "damagePlanted", "damageFound", "decoys", "decoysWronglyDamage", "unplantedItemsChecked", "falseAlarms"] as const) {
  if (result[key] !== published[key]) throw new Error(`Published evaluation mismatch: ${key}`);
}
const manifest = {
  format: "fair-wear-evidence-manifest/v1",
  snapshotId: hash(JSON.stringify(sources)),
  scope: "Byte integrity of the generated input images, saved crop pairs, recorded findings, published evaluation and planted test design. Not an external attestation of model execution or correctness.",
  sourceType: "generated-images-real-recorded-model-results",
  availability: { generatedRoomImages: true, savedCropPairs: true, parsedJudgeResults: true, plantedTestDesign: true, rawSamResponses: false, samMasks: false, originalSamBoxes: false, rawJudgeApiEnvelopes: false },
  sourceModels: [
    { name: "Muse Image", role: "Generated simulated room images; test intent is not a pixel-level ground truth annotation." },
    { name: "SAM 3.1", role: "The recorded pipeline used segmentation to prepare matched crops; raw masks and boxes were not persisted." },
    { name: "Muse Spark", role: "Recorded change descriptions, labels and self-reported confidence for saved crop pairs." },
  ],
  derivation: "Group by room and normalized item label using lib/pipeline/matching.ts. A planted item is detected if any retained crop flags a change; exact if any has the expected label. Count false alarms per unplanted crop observation. Thresholds filter self-reported confidence, not pixels or model outputs.",
  sources,
};
const outputs: [string, string | Buffer][] = [["public/evidence/planted.json", truth], ["public/evidence/manifest.json", JSON.stringify(manifest, null, 2) + "\n"]];
for (const [file, bytes] of outputs) {
  if (check) {
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(Buffer.from(bytes))) throw new Error(`Stale evidence file: ${file}. Run npm run evidence:build.`);
  } else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); }
}
console.log(`${check ? "Verified" : "Built"} ${sources.length} source fingerprints; fixture metrics match; snapshot ${manifest.snapshotId}`);
