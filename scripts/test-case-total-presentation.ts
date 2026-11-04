import assert from "node:assert/strict";
import { buildCaseHtml, caseReply, caseTotalPresentation, caseTotals, emptyCaseItem, type CaseItem, type CaseResponse } from "../lib/case-builder";
const item = (id: string, amount: string, response: CaseResponse = "question"): CaseItem => ({ ...emptyCaseItem(id), room: "Room", item: id, claimPounds: amount, response });
const cases: { name: string; items: CaseItem[]; question: string; discuss: string; unknown: number }[] = [
  { name: "all known", items: [item("one", "25"), item("two", "5.50", "discuss")], question: "£25.00", discuss: "£5.50", unknown: 0 },
  { name: "unknown only", items: [item("unknown", "")], question: "Not yet known", discuss: "£0.00", unknown: 1 },
  { name: "both categories unknown", items: [item("unknown", ""), item("invalid", "bad", "discuss")], question: "Not yet known", discuss: "Not yet known", unknown: 2 },
  { name: "mixed known and unknown", items: [item("known", "25"), item("unknown", ""), item("discussion", "12", "discuss")], question: "£25.00", discuss: "£12.00", unknown: 1 },
  { name: "explicit zero", items: [item("zero", "0"), item("zero discuss", "0.00", "discuss")], question: "£0.00", discuss: "£0.00", unknown: 0 },
  { name: "zero alongside unknown", items: [item("zero", "0"), item("unknown", "")], question: "£0.00", discuss: "£0.00", unknown: 1 },
  { name: "omitted unknown", items: [item("known", "10"), item("omitted", "", "omit")], question: "£10.00", discuss: "£0.00", unknown: 0 },
  { name: "all omitted", items: [item("omitted", "", "omit")], question: "£0.00", discuss: "£0.00", unknown: 0 },
];
for (const test of cases) {
  const original = JSON.stringify(test.items);
  const before = caseTotals(test.items);
  const summary = caseTotalPresentation(test.items);
  assert.deepEqual(summary.question, { label: "Known questioned total", value: test.question }, test.name);
  assert.deepEqual(summary.discuss, { label: "Known discussion total", value: test.discuss }, test.name);
  assert.equal(before.unknown, test.unknown, test.name);
  assert.equal(Boolean(summary.incomplete), test.unknown > 0, test.name);
  const doc = { mode: "personal" as const, title: "Test", items: test.items };
  const html = buildCaseHtml(doc), draft = caseReply(doc);
  assert.ok(html.includes(`Known questioned total: <b>${test.question}</b>`), test.name);
  assert.ok(html.includes(`Known discussion total: <b>${test.discuss}</b>`), test.name);
  assert.equal(html.includes('class="incomplete-total"'), test.unknown > 0, test.name);
  assert.equal(draft.includes("Total incomplete:"), test.unknown > 0, test.name);
  if (test.unknown) {
    assert.match(summary.incomplete, /unknown amounts are not treated as £0/);
    assert.match(draft, /amount not supplied or invalid/);
  }
  assert.deepEqual(caseTotals(test.items), before, "presentation does not change arithmetic");
  assert.equal(JSON.stringify(test.items), original, "presentation never changes inputs");
  console.log(`PASS amount presentation: ${test.name}`);
}
