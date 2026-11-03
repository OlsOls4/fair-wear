// Offline checks for the handover's decision rule. No model calls.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultDecision, type Decision, type DecisionFinding } from "../lib/decisions";

const cases: [string, DecisionFinding, Decision][] = [
  ["mould cleaning", { verdict: "cleaning", confidence: 0.99, description: "Black mould on sealant." }, "Dispute"],
  ["case-insensitive mould", { verdict: "cleaning", confidence: 1, description: "MOULD along the bath." }, "Dispute"],
  ["US spelling", { verdict: "cleaning", confidence: 1, description: "Black mold." }, "Dispute"],
  ["ordinary cleaning", { verdict: "cleaning", confidence: 0.95, description: "Grease on the oven." }, "Agree"],
  ["low-confidence cleaning", { verdict: "cleaning", confidence: 0.2, description: "Grease on the oven." }, "Agree"],
  ["moulding is not mould", { verdict: "cleaning", confidence: 0.95, description: "Dust on decorative moulding." }, "Agree"],
  ["fair wear", { verdict: "fair_wear", confidence: 1, description: "Light scuffs." }, "Dispute"],
  ["low-confidence fair wear", { verdict: "fair_wear", confidence: 0.2, description: "Light scuffs." }, "Dispute"],
  ["damage below threshold", { verdict: "damage", confidence: 0.899999, description: "Stain." }, "Dispute"],
  ["damage at threshold", { verdict: "damage", confidence: 0.9, description: "Stain." }, "Agree"],
  ["damage above threshold", { verdict: "damage", confidence: 1, description: "Stain." }, "Agree"],
  ["no change", { verdict: "no_change", confidence: 1, description: "Unchanged." }, "Not claimed"],
  ["no change without confidence", { verdict: "no_change", confidence: null, description: "Unchanged." }, "Not claimed"],
  ["damage without confidence", { verdict: "damage", confidence: null, description: "Stain." }, "Dispute"],
  ["NaN confidence", { verdict: "damage", confidence: NaN, description: "Stain." }, "Dispute"],
  ["infinite confidence", { verdict: "damage", confidence: Infinity, description: "Stain." }, "Dispute"],
  ["out-of-range confidence", { verdict: "damage", confidence: 90, description: "Stain." }, "Dispute"],
  ["negative confidence", { verdict: "damage", confidence: -1, description: "Stain." }, "Dispute"],
  ["unrecognized verdict requires review", { verdict: "unknown", confidence: 1, description: "Check evidence." }, "Dispute"],
];
for (const [name, finding, expected] of cases) {
  assert.equal(defaultDecision(Object.freeze(finding)), expected, name);
  console.log(`ok ${name}`);
}

const demo = JSON.parse(readFileSync("public/demo/flat-results.json", "utf8"));
const counts: Record<Decision, number> = { Agree: 0, Dispute: 0, "Not claimed": 0 };
for (const finding of demo.findings) counts[defaultDecision(finding)]++;
assert.deepEqual(counts, { Agree: 2, Dispute: 5, "Not claimed": 13 });
console.log("ok existing demo defaults", counts);
