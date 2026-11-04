/** DOM tests: not visual/browser verification. Native download and fetch are mocked. */
import assert from "node:assert/strict";
import fs from "node:fs";
import React, { act } from "react";
import { JSDOM } from "jsdom";
// @ts-expect-error runtime present, optional react-dom declaration package not installed
import { createRoot } from "react-dom/client";
import EvidenceLab from "../components/inspection/EvidenceLab";

async function main() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, React, IS_REACT_ACT_ENVIRONMENT: true });
  let downloaded: Blob | undefined;
  let filename = "";
  URL.createObjectURL = (blob) => { downloaded = blob as Blob; return "blob:inspection-test"; };
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function () { filename = this.download; };
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (url) => new Response(fs.readFileSync(`public${String(url)}`));
  const root = createRoot(document.getElementById("root")!);
  const host = document.getElementById("root")!;
  let count = 0;
  function test(name: string, fn: () => void) { fn(); console.log(`ok ${++count} ${name}`); }
  async function click(text: string) { const button = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text)); assert.ok(button, text); await act(async () => button.click()); }
  function detail() { return host.querySelector('[data-testid="inspection-case"]')!; }
  await act(async () => root.render(<EvidenceLab />));
  test("starts on recorded carpet mismatch with test-intent caveat", () => { assert.match(detail().textContent!, /Planted test intentfair wear/); assert.match(detail().textContent!, /82% self-reported confidence/); assert.match(detail().textContent!, /not independent pixel-level ground truth/); });
  test("board link carries only the selected public observation, not a review choice", () => {
    assert.equal(detail().querySelector('a[href^="/demo#finding="]')?.getAttribute("href"), "/demo#finding=bedroom-carpet-0-0");
    assert.match(detail().textContent!, /inspection note is not transferred/);
  });
  test("all image links are real local source paths, with generated-image alt text", () => { for (const img of host.querySelectorAll("img")) { assert.ok(fs.existsSync(`public${img.getAttribute("src")}`)); assert.match(img.alt, /Generated test imagery/); } });
  const select = detail().querySelector("select")!;
  await act(async () => { select.value = "challenge"; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  let focusedCaseText = "";
  document.getElementById("inspect-case-title")!.addEventListener("focus", (event) => { focusedCaseText = (event.target as HTMLElement).textContent!; });
  await click("Evidence gap");
  test("spotlight focus announces the newly rendered case", () => assert.equal(focusedCaseText, "sealant"));
  test("missing output never invents a model prediction or missing item", () => { assert.match(detail().textContent!, /No crop pair exists/); assert.match(detail().textContent!, /A missing observation is not a missing item/); assert.match(detail().textContent!, /No Muse Spark judgment was saved/); assert.equal(detail().querySelector("select")!.value, "unreviewed"); });
  test("evidence gap does not invent a board finding", () => {
    assert.equal(detail().querySelector('a[href^="/demo#finding="]'), null);
    assert.ok(detail().querySelector('a[href="/demo"]'));
    assert.match(detail().textContent!, /no matching board card/);
  });
  const gapReview = detail().querySelector("select")!;
  await act(async () => { gapReview.value = "hold"; gapReview.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  await click("Decoy called damage");
  test("review survives switching cases independently", () => assert.equal(detail().querySelector("select")!.value, "challenge"));
  await click("≥ 90%");
  test("threshold withholds original while preserving its recorded words and human review", () => { assert.match(detail().textContent!, /All observations withheld/); assert.match(detail().textContent!, /82% self-reported confidence/); assert.equal(detail().querySelector("select")!.value, "challenge"); assert.match(host.querySelector('[data-testid="inspection-threshold-results"]')!.textContent!, /13\/20observations retained/); assert.match(host.textContent!, /2\/8exact labels retained/); });
  await click("All saved results");
  await click("wall3 observations");
  test("multiple crop observations can be inspected without collapsing disagreement", () => { assert.match(detail().textContent!, /Other crops disagree/); assert.match(detail().textContent!, /70% self-reported confidence/); });
  const previousCropHref = detail().querySelector('a[href^="/demo#finding="]')!.getAttribute("href");
  await click("Crop 1");
  test("multi-crop link changes to exactly the selected observation", () => {
    const href = detail().querySelector('a[href^="/demo#finding="]')!.getAttribute("href");
    assert.notEqual(href, previousCropHref);
    assert.match(href!, /wall/);
  });
  test("switching crops exposes the exact recorded negative result", () => assert.match(detail().textContent!, /95% self-reported confidence/));
  await click("Download inspection report");
  const report = JSON.parse(await downloaded!.text());
  test("export includes all cases, source hashes and separate human choices, not legacy liability percentages", () => {
    assert.equal(filename, "fair-wear-inspection.json"); assert.equal(report.cases.length, 13); assert.equal(report.sources.length, 51); assert.equal(report.cases.find((r: any) => r.caseId === "bedroom/carpet").humanReview, "challenge"); assert.equal(report.cases.find((r: any) => r.caseId === "bedroom/carpet").humanReviewOrigin, "user_selected"); assert.equal(report.cases.find((r: any) => r.caseId === "bathroom/bath").humanReviewOrigin, "unreviewed"); assert.equal(report.cases.find((r: any) => r.caseId === "bathroom/bath").humanReview, null); assert.equal(report.cases.find((r: any) => r.caseId === "bathroom/bath").humanReviewed, false); assert.equal(report.cases.find((r: any) => r.caseId === "bathroom/sealant").humanReview, "hold"); assert.equal(report.cases.find((r: any) => r.caseId === "bathroom/sealant").humanReviewed, true); assert.equal(report.integrityCheck.state, "idle"); assert.ok(!JSON.stringify(report).includes("apportionmentPct"));
  });
  await click("Verify all 51 source files");
  await act(async () => { for (let i = 0; i < 100 && host.querySelector('[data-testid="inspection-integrity"]')!.textContent!.startsWith("Checking"); i++) await new Promise((resolve) => setTimeout(resolve, 10)); });
  test("verification checks all source bytes before claiming success", () => assert.match(host.querySelector('[data-testid="inspection-integrity"]')!.textContent!, /All 51 source files match/));
  globalThis.fetch = async (url) => { const bytes = fs.readFileSync(`public${String(url)}`); if (String(url).includes("flat-results")) bytes[0] ^= 1; return new Response(bytes); };
  await click("Verify all 51 source files");
  await act(async () => { for (let i = 0; i < 100 && host.querySelector('[data-testid="inspection-integrity"]')!.textContent!.startsWith("Checking"); i++) await new Promise((resolve) => setTimeout(resolve, 10)); });
  test("corrupt source cannot be reported as verified", () => assert.match(host.querySelector('[data-testid="inspection-integrity"]')!.textContent!, /1 source files failed verification/));
  globalThis.fetch = nativeFetch;
  await act(async () => root.unmount());
  console.log(`${count} evidence-lab DOM checks passed. Native downloads and source requests were mocked.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
