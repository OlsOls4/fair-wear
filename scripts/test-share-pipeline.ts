// Offline regression: defaults must remain unknown through the judge entry point.
import assert from "node:assert/strict";
import type { MatchedPair } from "../lib/pipeline/types";

async function main() {
  process.env.MOCK = "1";
  process.env.FAIRWEAR_ALLOW_PAID = "0";
  globalThis.fetch = async () => { throw new Error("Network calls are forbidden in this test"); };
  const { judge } = await import("../lib/pipeline/index");
  const { prepareReplyFindings } = await import("./make-reply");
  const legacy = { room: "bedroom", item: "carpet", verdict: "damage" as const, description: "Mark", tenancyYears: 2, usefulLifeYears: 7, apportionmentPct: 71 };
  const prepared = prepareReplyFindings([legacy]);
  assert.equal(prepared[0].shareCalculation.status, "needs_inputs");
  assert.equal(prepared[0].shareCalculation.percentage, undefined);
  assert.equal("tenantSharePct" in prepared[0], false);
  assert.equal("apportionmentPct" in prepared[0], false);
  const withBasis = prepareReplyFindings([{ ...legacy, ageYears: 0, calculationBasis: { usefulLifeYears: 7, qualityBasis: "Explicit assumption" } }]);
  assert.equal(withBasis[0].shareCalculation.percentage, 71);
  assert.equal(withBasis[0].shareCalculation.status, "illustrative");
  const pair: MatchedPair = {
    room: "bedroom", label: "carpet", similarity: 0,
    before: { id: "before", visit: "move_in", room: "bedroom", label: "carpet", bestFrame: { visit: "move_in", room: "bedroom", t: 0, url: "offline-fixture" } },
  };
  const unknown = await judge(pair, 2);
  assert.equal(unknown.verdict, "unresolved");
  assert.equal(unknown.ageYears, undefined);
  assert.equal(unknown.usefulLifeYears, undefined);
  assert.equal(unknown.apportionmentPct, undefined);
  assert.equal(unknown.shareCalculation?.status, "not_applicable");
  assert.deepEqual(unknown.shareCalculation?.missingInputs, []);
  const basis = { usefulLifeYears: 7, qualityBasis: "Explicit illustrative carpet assumption" };
  const supplied = await judge(pair, 2, 0, basis);
  assert.equal(supplied.apportionmentPct, undefined);
  assert.equal(supplied.shareCalculation?.status, "not_applicable");
  assert.deepEqual(supplied.calculationBasis, basis);
  assert.equal(supplied.ageYears, 0);
  console.log("Passed offline judge assumption propagation checks; no network calls.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
