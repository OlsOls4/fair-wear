import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { buildCaseHtml, caseReply, emptyCaseItem, caseTotals, type CaseDocument, type CaseItem } from "../lib/case-builder";
import { evidenceRows, evidenceRequests, EVIDENCE_STATUS_LABELS, type EvidenceStatus } from "../lib/case-evidence-gaps";

const base = { ...emptyCaseItem("claim-one"), item: "Carpet", costType: "replacement" as const, claimPounds: "500" };
const doc = (item: CaseItem = base): CaseDocument => ({ title: "Test", mode: "personal", items: [item] });
assert.equal(base.evidenceChecklist, undefined);
assert.match(caseReply(doc()), /Please provide an itemised deduction list/);
assert.match(caseReply(doc()), /Please provide the item's age/);
assert.doesNotMatch(buildCaseHtml(doc()), /Reviewer evidence checklist/);
assert.equal(evidenceRequests(base).length, 0);
let cases = 0;
for (const status of Object.keys(EVIDENCE_STATUS_LABELS) as EvidenceStatus[]) {
  const item = { ...base, evidenceChecklist: { moveIn: status, moveOut: status, cost: status, ageCondition: status } };
  const requests = evidenceRequests(item);
  assert.equal(requests.length, status === "provided" || status === "not_applicable" ? 0 : 4);
  const reply = caseReply(doc(item));
  assert.doesNotMatch(reply, /Please provide an itemised deduction list|Please provide the item's age and starting condition/);
  if (status === "unknown") assert.match(reply, /Please confirm availability of.*and share any records not already supplied/);
  if (status === "unavailable") assert.match(reply, /Please explain any limitation and identify alternative/);
  if (status === "requested") assert.match(reply, /remains requested/);
  const html = new JSDOM(buildCaseHtml(doc(item))).window.document;
  assert.equal(html.querySelectorAll("article li").length, 4);
  assert.ok([...html.querySelectorAll("article li b")].every(el => el.textContent === EVIDENCE_STATUS_LABELS[status]));
  assert.match(html.body.textContent!, /Unknown means not reviewed, not absent/);
  assert.match(html.body.textContent!, /Provided does not authenticate/);
  assert.deepEqual(caseTotals([item]), caseTotals([base]));
  cases++;
}
const tracked = { ...base, evidenceChecklist: { moveIn: "provided" as const, moveOut: "requested" as const, cost: "not_applicable" as const } };
assert.deepEqual(evidenceRows(tracked).map(row => row.status), ["provided", "requested", "not_applicable", "unknown"]);
assert.equal(evidenceRequests(tracked).length, 2);
for (const costType of ["cleaning", "repair", "unknown"] as const) {
  const item = { ...tracked, costType };
  assert.equal(evidenceRows(item).length, 3);
  assert.equal(evidenceRequests(item).length, 1);
  assert.doesNotMatch(buildCaseHtml(doc(item)), /Age and condition basis|expected useful-life basis/);
}
const omitted = { ...tracked, id: "OMITTED-SENTINEL", response: "omit" as const };
assert.equal(evidenceRequests(omitted).length, 0);
assert.doesNotMatch(buildCaseHtml(doc(omitted)), /OMITTED-SENTINEL|Reviewer evidence checklist|remains requested/);
assert.doesNotMatch(caseReply(doc(omitted)), /item-specific requests|remains requested/);
const mixed = { ...doc(tracked), items: [tracked, { ...base, id: "legacy" }] };
assert.match(caseReply(mixed), /relevant inventory, dated comparison evidence and itemised invoices/);
assert.equal((caseReply(mixed).match(/Please provide the item's age and starting condition/g) || []).length, 1);
const invalid = { ...tracked, evidenceChecklist: { moveIn: "<script>" as EvidenceStatus, cost: "constructor" as EvidenceStatus } };
assert.equal(evidenceRows(invalid)[0].status, "unknown");
assert.equal(evidenceRows(invalid)[2].status, "unknown");
assert.equal(new JSDOM(buildCaseHtml(doc(invalid))).window.document.querySelectorAll("script").length, 0);
console.log(`Evidence tracker checks passed: ${cases} status variants, legacy/mixed drafts, cost applicability, unknown defaults, omission, escaping and unchanged totals. No model calls.`);
