// Offline regressions: absent observations must not become evidence of absence.
import assert from "node:assert/strict";
import { judgePair, JudgeValidationError } from "../lib/pipeline/judgement";
import { changeStatus, matchItems } from "../lib/pipeline/matching";
import { JUDGE_SCHEMA, validateJudge } from "../lib/pipeline/schema";
import { calculateShare, apportion } from "../lib/pipeline/guidance";
import { defaultDecision, defaultDecisionReason } from "../lib/decisions";
import { replyDraft } from "../lib/reply";
import { analyzeEvidence, explainCase } from "../lib/evidence/analysis";
import type { F } from "../lib/findings";
import type { Item, MatchedPair } from "../lib/pipeline/types";

async function main() {
  process.env.MOCK = "1";
  process.env.FAIRWEAR_ALLOW_PAID = "0";
  globalThis.fetch = async () => { throw new Error("Network calls are forbidden in this test"); };
  let checks = 0;
  const passed = (name: string) => { checks++; console.log(`ok ${name}`); };
  const item = (visit: Item["visit"], label = "sofa", room = "living-room"): Item => ({
    id: `${visit}-${room}-${label}`, visit, room, label,
    bestFrame: { visit, room, t: 0, url: `offline-${visit}` },
  });
  const before = item("move_in"), after = item("move_out");
  const matched: MatchedPair = { room: "living-room", label: "sofa", before, after, similarity: 1 };
  const unmatched = [...matchItems([before], []).pairs, ...matchItems([], [after]).pairs];
  assert.equal(unmatched.length, 2);
  assert.deepEqual(unmatched.map(changeStatus), ["unresolved", "unresolved"]);
  assert.equal(changeStatus({ room: "living-room", label: "sofa", similarity: 0 }), "unresolved");
  const wrongRoom = matchItems([before], [item("move_out", "sofa", "bedroom")]).pairs;
  assert.equal(wrongRoom.length, 2);
  assert.ok(wrongRoom.every((pair) => changeStatus(pair) === "unresolved"));
  passed("unmatched and cross-room detections remain unresolved, not added or removed");

  let requests = 0;
  const forbidden = async () => { requests++; throw new Error("An evidence gap must not reach the model"); };
  const basis = { usefulLifeYears: 8, qualityBasis: "Explicit illustration assumption" };
  for (const pair of [...unmatched, { room: "living-room", label: "sofa", similarity: 0 },
    { ...matched, before: { ...before, bestFrame: { ...before.bestFrame, url: " " } } },
    { ...matched, after: { ...after, bestFrame: { ...after.bestFrame, url: "" } } },
  ]) {
    const result = await judgePair(pair, { tenancyYears: 2, ageAtMoveInYears: 0, basis, simulated: false }, forbidden);
    assert.equal(result.verdict, "unresolved");
    assert.equal(result.confidence, null);
    assert.equal(result.judgementSource, "evidence_gap");
    assert.equal(result.simulated, false);
    assert.equal(result.apportionmentPct, undefined);
    assert.equal(result.shareCalculation?.status, "not_applicable");
    assert.equal(defaultDecision(result), "Dispute");
    assert.match(defaultDecisionReason(result), /insufficient.*human review/i);
  }
  assert.equal(requests, 0);
  passed("even non-mock evidence gaps skip model transport, invent no confidence and receive no cost share");

  const unresolved = { verdict: "unresolved", confidence: 0.2, description: "The sofa is obscured; a comparable move-out view is needed.", moved: false, evidence: "Only part of the sofa is visible." };
  assert.ok(JUDGE_SCHEMA.properties.verdict.enum.includes("unresolved"));
  assert.equal(validateJudge(unresolved).ok, true);
  assert.equal(validateJudge({ ...unresolved, confidence: null }).ok, false);
  assert.equal(validateJudge({ ...unresolved, confidence: "0.2" }).ok, false);
  const result = await judgePair(matched, { tenancyYears: 2 }, async () => { requests++; return unresolved; });
  assert.equal(result.verdict, "unresolved");
  assert.equal(result.confidence, 0.2);
  assert.equal(result.judgementSource, "model");
  assert.equal(result.description, unresolved.description);
  assert.equal(requests, 1);
  assert.equal(result.apportionmentPct, undefined);
  passed("a valid model abstention survives schema validation and is not converted into no_change or missing");

  const unchanged = await judgePair(matched, { tenancyYears: 2 }, async () => ({ ...unresolved, verdict: "no_change", description: "Comparable views show the same condition.", confidence: 0.8 }));
  assert.equal(unchanged.verdict, "no_change");
  const damage = await judgePair(matched, { tenancyYears: 2, ageAtMoveInYears: 0, basis }, async () => ({ ...unresolved, verdict: "damage", confidence: 0.9, description: "A tear is visible." }));
  assert.equal(damage.apportionmentPct, 75);
  assert.equal(damage.shareCalculation?.status, "illustrative");
  await assert.rejects(judgePair(matched, { tenancyYears: 2 }), JudgeValidationError);
  assert.equal(calculateShare("unresolved", 2, 0, basis).percentage, undefined);
  assert.equal(apportion("unresolved", "sofa", 2, 0, basis), undefined);
  passed("real comparison outcomes still work, and absent models still fail closed for paired observations");

  const uiFinding: F = { id: "test-unresolved", room: "living-room", item: "sofa", verdict: "unresolved", confidence: null, description: "No matched move-out observation was supplied.", tenancyYears: 2, ageYears: 0, calculationBasis: basis, apportionmentPct: 75 };
  const draft = replyDraft("Test property", [uiFinding]);
  assert.match(draft, /Review pending/);
  assert.match(draft, /observations do not establish a change/);
  assert.match(draft, /comparable dated move-in and move-out evidence/);
  assert.doesNotMatch(draft, /Agree in principle|75%|the item is missing\.|the item was added\./);
  assert.doesNotMatch(replyDraft("Test property", [uiFinding], { "test-unresolved": "Not claimed" }), /\[test-unresolved\]/);
  const { prepareReplyFindings } = await import("./make-reply");
  const prepared = prepareReplyFindings([uiFinding as F & { verdict: "unresolved" }]);
  assert.equal(prepared[0].verdict, "unresolved");
  assert.equal(prepared[0].shareCalculation.status, "not_applicable");
  assert.equal(prepared[0].shareCalculation.percentage, undefined);
  passed("review defaults and both reply paths request evidence without liability or stale percentages");

  for (const expected of [null, "damage"]) {
    for (const confidence of [null, 0, 0.95]) {
      for (const threshold of [0, 0.9, 1]) {
        const stats = analyzeEvidence([{ id: "test", room: "living-room", item: "sofa", expected, moveIn: "offline-before", moveOut: "offline-after", observations: [{ ...uiFinding, confidence }] }], threshold);
        assert.equal(stats.detected, 0);
        assert.equal(stats.falseAlarms, 0);
        assert.equal(stats.rows[0].outcome, "unresolved");
        assert.match(explainCase(stats.rows[0]), /not evidence of a missing, added or unchanged item/);
      }
    }
  }
  passed("evidence scoring never counts unresolved as detected change, no_change or false alarm at any threshold");

  const { judge, buildPack } = await import("../lib/pipeline/index");
  const publicResult = await judge(unmatched[0], 2, 0, basis);
  assert.equal(publicResult.verdict, "unresolved");
  const pack = await buildPack("Test property", [publicResult]);
  assert.equal(pack.findings[0].cardUrl, undefined);
  assert.equal(pack.findings[0].confidence, null);
  passed("pipeline entry point keeps evidence gaps explicit and does not fabricate an image card for them");
  console.log(`Passed ${checks} unresolved-evidence checks; no network access or model calls.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
