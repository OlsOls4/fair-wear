// No-network regression tests for the model-output boundary and public demo API.
import assert from "node:assert/strict";
import { JudgeValidationError, requestValidatedJudgement } from "../lib/pipeline/judgement";
import { validateJudge } from "../lib/pipeline/schema";
import type { MatchedPair } from "../lib/pipeline/types";

async function main() {
  process.env.MOCK = "1";
  process.env.FAIRWEAR_ALLOW_PAID = "0";
  globalThis.fetch = async () => { throw new Error("Network calls are forbidden in this test"); };
  const good = { verdict: "damage", confidence: 0.9, description: "Visible gouge.", moved: false, evidence: "Mark visible in the after crop." };
  let checks = 0;
  const passed = (label: string) => { checks++; console.log(`ok ${label}`); };

  for (const patch of [
    { confidence: "0.99" }, { confidence: 99 }, { confidence: 1.1 },
    { moved: "false" }, { moved: undefined }, { evidence: {} }, { evidence: undefined },
    { description: "x".repeat(301) }, { evidence: "x".repeat(201) },
    { description: " " }, { unexpected: "field" },
  ]) assert.equal(validateJudge({ ...good, ...patch }).ok, false);
  assert.equal(validateJudge([]).ok, false);
  assert.equal(validateJudge({ ...good, description: "x".repeat(300), evidence: "x".repeat(200) }).ok, true);
  passed("validator rejects schema violations instead of coercing or silently truncating");

  let calls = 0;
  const first = await requestValidatedJudgement(async (previousError) => {
    calls++;
    assert.equal(previousError, undefined);
    return good;
  });
  assert.equal(calls, 1);
  assert.deepEqual(first, good);
  passed("valid first response is returned unchanged with no retry");

  calls = 0;
  const recovered = await requestValidatedJudgement(async (previousError) => {
    calls++;
    if (calls === 1) return { ...good, confidence: 99 };
    assert.match(previousError!, /confidence/);
    return good;
  });
  assert.equal(calls, 2);
  assert.deepEqual(recovered, good);
  passed("one schema-validation retry can recover a valid judgement");

  for (const invalid of [{}, { ...good, confidence: 99 }, { ...good, confidence: "99garbage" }]) {
    calls = 0;
    await assert.rejects(requestValidatedJudgement(async () => { calls++; return invalid; }), JudgeValidationError);
    assert.equal(calls, 2);
  }
  passed("repeated invalid responses stop after two attempts without a fallback verdict");

  calls = 0;
  await assert.rejects(requestValidatedJudgement(async () => {
    calls++;
    throw new SyntaxError("malformed response");
  }), (error: unknown) => error instanceof JudgeValidationError && error.code === "JUDGE_VALIDATION_FAILED");
  assert.equal(calls, 2);
  calls = 0;
  assert.deepEqual(await requestValidatedJudgement(async (previousError) => {
    if (++calls === 1) throw new SyntaxError("malformed response");
    assert.equal(previousError, "response was not valid JSON");
    return good;
  }), good);
  assert.equal(calls, 2);
  passed("malformed JSON follows the same bounded retry and recovery rules");

  for (const failure of [new Error("Network unavailable"), new Error("Budget exceeded"), new TypeError("Unexpected transport failure")]) {
    calls = 0;
    await assert.rejects(requestValidatedJudgement(async () => { calls++; throw failure; }), (error: unknown) => error === failure);
    assert.equal(calls, 1);
  }
  passed("network, budget and non-JSON failures propagate immediately");

  const { judge } = await import("../lib/pipeline/index");
  const pair: MatchedPair = {
    room: "bedroom", label: "carpet", similarity: 1,
    before: { id: "before", visit: "move_in", room: "bedroom", label: "carpet", bestFrame: { visit: "move_in", room: "bedroom", t: 0, url: "offline-before" } },
    after: { id: "after", visit: "move_out", room: "bedroom", label: "carpet", bestFrame: { visit: "move_out", room: "bedroom", t: 0, url: "offline-after" } },
  };
  await assert.rejects(judge(pair, 2), JudgeValidationError);
  const fixture = await judge({ ...pair, after: undefined }, 2);
  assert.equal(fixture.simulated, true);
  assert.equal(fixture.confidence, null);
  assert.equal(fixture.verdict, "unresolved");
  assert.match(fixture.description, /No matched move-out observation/);
  assert.equal(fixture.judgementSource, "evidence_gap");
  passed("MOCK matched pairs fail closed and one-sided observations remain unresolved");

  const { POST } = await import("../app/api/analyze/route");
  for (const body of ["{}", "null", "invalid JSON", JSON.stringify({ rooms: [{ room: "bedroom", moveInUrl: "offline-before", moveOutUrl: "offline-after" }] })]) {
    const response = await POST(new Request("http://localhost/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body }));
    assert.equal(response.status, 503);
    const result = await response.json();
    assert.equal(result.error, "analysis_unavailable");
    assert.equal(result.mock, true);
    assert.equal("pack" in result, false);
    assert.equal("findings" in result, false);
    assert.match(result.message, /No evidence pack was generated/);
  }
  passed("public demo API refuses all analysis requests with no findings or pack");
  console.log(`Passed ${checks} judge-failure checks; no model calls or network access.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
