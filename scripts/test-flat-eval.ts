// No model calls. The pure scorer and CLI must distinguish abstention from change/no-change.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { scoreFlat } from "./eval-flat";

const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const savedPaths = ["public/demo/flat-results.json", "public/demo/flat-eval.json", "eval/flat/planted.json", "eval/flat/results.json"];
const savedBytes = savedPaths.map((file) => fs.readFileSync(file));
const truth = [{ room: "test-room", planted: [{ item: "sofa", verdict: "damage" }] }];
const gap = { id: "gap", room: "test-room", item: "sofa", verdict: "unresolved" };
const unplantedGap = { ...gap, id: "unplanted-gap", item: "door" };
const real = { ...gap, id: "real", verdict: "damage" };
const unchanged = { ...gap, id: "unchanged", verdict: "no_change" };

const abstained = scoreFlat([gap, unplantedGap], truth);
assert.equal(abstained.detected, 0);
assert.equal(abstained.falseAlarms, 0);
assert.equal(abstained.exactVerdict, 0);
assert.equal(abstained.rows[0].got, "unresolved");
assert.equal(scoreFlat([gap, unchanged], truth).rows[0].got, "unresolved");
assert.equal(scoreFlat([unchanged], truth).rows[0].got, "no_change");
assert.equal(scoreFlat([], truth).rows[0].got, "not_segmented");
for (const observations of [[gap, real], [real, gap]]) {
  const score = scoreFlat(observations, truth);
  assert.equal(score.detected, 1);
  assert.equal(score.exactVerdict, 1);
  assert.equal(score.rows[0].got, "damage");
}
const falseAlarm = scoreFlat([unplantedGap, { ...real, item: "door" }], truth);
assert.equal(falseAlarm.falseAlarms, 1);
assert.deepEqual(falseAlarm.falseAlarmItems, ["test-room/door: damage"]);
const wrong = scoreFlat([gap, { ...real, verdict: "cleaning" }], truth);
assert.equal(wrong.detected, 1);
assert.equal(wrong.exactVerdict, 0);
assert.equal(wrong.rows[0].got, "cleaning");
console.log("ok flat scorer excludes abstentions, preserves unresolved and keeps real mixed signals");

const original = scoreFlat(read(savedPaths[0]).findings, read(savedPaths[2]));
assert.deepEqual(original, read(savedPaths[1]));
assert.deepEqual(original, read(savedPaths[3]));
console.log("ok original flat evaluation reproduces exactly without rewriting recorded outputs");

// Run the real CLI only in a disposable working directory, never over the saved demo.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fair-wear-unresolved-eval-"));
try {
  fs.mkdirSync(path.join(directory, "eval/flat"), { recursive: true });
  fs.mkdirSync(path.join(directory, "public/demo"), { recursive: true });
  fs.writeFileSync(path.join(directory, "eval/flat/planted.json"), JSON.stringify(truth));
  fs.writeFileSync(path.join(directory, "public/demo/flat-results.json"), JSON.stringify({ findings: [gap, unplantedGap] }));
  const output = execFileSync(process.execPath, ["--import", pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href, path.resolve("scripts/eval-flat.ts")], {
    cwd: directory, encoding: "utf8", env: { ...process.env, MOCK: "1", FAIRWEAR_ALLOW_PAID: "0" },
  });
  assert.deepEqual(JSON.parse(output), abstained);
  assert.deepEqual(read(path.join(directory, "eval/flat/results.json")), abstained);
  assert.deepEqual(read(path.join(directory, "public/demo/flat-eval.json")), abstained);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
savedPaths.forEach((file, index) => assert.deepEqual(fs.readFileSync(file), savedBytes[index]));
console.log("ok real scoring CLI handles unresolved results and leaves all saved source bytes untouched");
