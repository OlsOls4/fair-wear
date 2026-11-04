import assert from "node:assert/strict";
import { matchItems, changeStatus } from "../lib/pipeline/matching";
import { JudgeValidationError } from "../lib/pipeline/judgement";
import { createAnalyzeHandler } from "../lib/pipeline/analyze";
import { planDemoCorrespondence } from "./demo-correspondence";
import type { Item, MatchingResult, MatchedPair } from "../lib/pipeline/types";

process.env.MOCK = "1";
process.env.FAIRWEAR_ALLOW_PAID = "0";
globalThis.fetch = async () => { throw new Error("Network forbidden"); };
const item = (id: string, visit: Item["visit"], extra: Partial<Item> = {}): Item => ({
  id, visit, label: "chair", room: "bedroom", bestFrame: { visit, room: "bedroom", t: 0, url: "offline" }, ...extra,
});
const b = (id: string, extra?: Partial<Item>) => item(id, "move_in", extra);
const a = (id: string, extra?: Partial<Item>) => item(id, "move_out", extra);
const box = (x: number): Item["box"] => [x, 0, x, 0];
const canonical = (r: MatchingResult) => ({
  pairs: r.pairs.map(p => `${p.before?.id ?? "-"}/${p.after?.id ?? "-"}`).sort(),
  unresolved: r.unresolved.map(u => `${u.side}:${u.item.id}:${u.reason}:${u.candidates.map(c => `${c.item.id}:${c.similarity}`).sort().join(",")}`).sort(),
  coverage: r.coverage,
});
const permutations = <T>(xs: T[]): T[][] => xs.length ? xs.flatMap((x, i) => permutations(xs.filter((_, j) => j !== i)).map(t => [x, ...t])) : [[]];
function check(before: Item[], after: Item[], matched: number, unresolved: number) {
  const expected = matchItems(before, after);
  assert.equal(expected.coverage.matchedPairs, matched);
  assert.equal(expected.unresolved.length, unresolved);
  assert.equal(expected.coverage.resolvedItems + expected.unresolved.length, before.length + after.length);
  assert.equal(expected.coverage.matchedPairs + expected.coverage.beforeOnly + expected.coverage.unresolvedBefore, before.length);
  assert.equal(expected.coverage.matchedPairs + expected.coverage.afterOnly + expected.coverage.unresolvedAfter, after.length);
  for (const bs of permutations(before)) for (const as of permutations(after)) assert.deepEqual(canonical(matchItems(bs, as)), canonical(expected));
  return expected;
}
async function main() {
  check([], [], 0, 0);
  check([b("b")], [a("a")], 1, 0);
  const tiedBefore = [b("b1"), b("b2")], tiedAfter = [a("a1"), a("a2")];
  check(tiedBefore, tiedAfter, 0, 4);
  check(tiedBefore, [a("a1")], 0, 3);
  check([b("b1")], tiedAfter, 0, 3);
  // Track IDs are visit-local: even equal IDs cannot break a tie.
  check([b("same"), b("other")], [a("same")], 0, 3);
  check([b("b", { box: box(0) })], [a("a1", { box: box(0) }), a("a2", { box: box(0.1) })], 0, 3);
  // Inclusive tolerance boundary (.25 * .2 = .05).
  check([b("b", { box: box(0) })], [a("a1", { box: box(0) }), a("a2", { box: box(.2) })], 0, 3);
  check([b("b1", { box: box(0) }), b("b2", { box: box(.9) })], [a("a1", { box: box(0) }), a("a2", { box: box(.9) })], 2, 0);
  const contention = check([b("b1", { embedding: [1, 0] }), b("b2", { embedding: [.8, .6] })], [a("a1", { embedding: [1, 0] }), a("a2", { embedding: [0, 1] })], 1, 2);
  assert.deepEqual(contention.pairs.map(p => [p.before?.id, p.after?.id]), [["b1", "a1"]]);
  check([b("b1", { box: box(0) }), b("b2", { box: box(.9) })], [a("a1", { box: box(0) })], 1, 1);
  check([b("b1", { box: box(0) })], [a("a1", { box: box(0) }), a("a2", { box: box(.9) })], 1, 1);
  const rooms = check([b("b")], [a("a", { room: "kitchen" })], 0, 0);
  assert.deepEqual(rooms.pairs.map(changeStatus), ["unresolved", "unresolved"]);
  check([b("b", { label: "carpet" })], [a("a", { label: "rug" })], 1, 0);
  check([b("b", { label: "carpet" })], [a("a", { label: "sink" })], 0, 0);
  assert.throws(() => matchItems([], [], 0));
  assert.throws(() => matchItems([], [], .5, NaN));

  const before = [...tiedBefore, b("oven-before", { label: "oven" }), b("removed", { label: "sink" })];
  const after = [...tiedAfter, a("oven-after", { label: "oven" }), a("added", { label: "bath" })];
  const calls: MatchedPair[] = [];
  const handler = createAnalyzeHandler({ mock: false,
    extractItems: async (_, visit) => visit === "move_in" ? before : after,
    judge: async pair => { calls.push(pair); return { pair, verdict: "no_change", confidence: 0, description: "offline", guidanceRefs: [] }; },
    buildPack: async (property, findings) => ({ property, findings, generatedAt: "offline", replyDraft: "Draft" }),
  });
  const response = await handler(new Request("http://localhost/api/analyze", { method: "POST", body: JSON.stringify({ rooms: [{ room: "bedroom", moveInUrl: "in", moveOutUrl: "out" }] }) }));
  const data = await response.json();
  assert.equal(calls.length, 3); // one supported match, two genuine one-sided observations
  assert(calls.every(p => p.label !== "chair"));
  assert.equal(data.pack.correspondence[0].unresolved.length, 4);
  assert.match(data.pack.replyDraft, /Correspondence needs review/);
  const allAmbiguous = createAnalyzeHandler({ mock: false,
    extractItems: async (_, visit) => visit === "move_in" ? tiedBefore : tiedAfter,
    judge: async () => { throw new Error("Ambiguous candidates must not invoke judge"); },
    buildPack: async () => { throw new Error("All-ambiguous input must not request a model-generated pack"); },
  });
  assert.equal((await allAmbiguous(new Request("http://localhost", { method: "POST", body: JSON.stringify({ rooms: [{ room: "bedroom" }] }) }))).status, 200);
  const failing = createAnalyzeHandler({ mock: false,
    extractItems: async (_, visit) => [item(visit, visit)],
    judge: async () => { throw new JudgeValidationError("offline invalid response"); },
    buildPack: async () => { throw new Error("Failed judgement must not build a pack"); },
  });
  const failure = await failing(new Request("http://localhost", { method: "POST", body: JSON.stringify({ rooms: [{ room: "bedroom" }] }) }));
  assert.equal(failure.status, 502);
  assert.equal("pack" in await failure.json(), false);
  const { pairs, report } = planDemoCorrespondence("bedroom", before, after);
  assert.equal(pairs.length, 1);
  assert.equal(report.judgedPairs, 1);
  assert.equal(report.skippedOneSided.length, 2);
  assert.equal(report.unresolved.length, 4);
  assert.equal(report.coverage.totalItems, 8);
  assert.equal(2 * report.judgedPairs + report.skippedOneSided.length + report.unresolved.length, report.coverage.totalItems);
  console.log("Passed correspondence permutation/tolerance/coverage and analysis no-judge regressions; no model calls.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
