// DOM interaction tests, not browser tests. Native clipboard/download/dialog APIs are mocked.
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
// @ts-expect-error React DOM runtime is installed; its optional declaration package is not required here.
import { createRoot } from "react-dom/client";
import Board from "../components/Board";
import Sample from "../app/upload/page";
import Home from "../app/page";
import { demoData, demoFindings } from "../lib/demo";

async function main() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, React, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  let lastScrollTarget: HTMLElement | null = null;
  dom.window.HTMLElement.prototype.scrollIntoView = function () { lastScrollTarget = this; };
  let copied = "";
  let downloaded: Blob | undefined;
  let downloadName = "";
  Object.defineProperty(dom.window.navigator, "clipboard", { value: { writeText: async (value: string) => { copied = value; } } });
  URL.createObjectURL = (blob: Blob) => { downloaded = blob; return "blob:mock-current-draft"; };
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function () { downloadName = this.download; };
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new dom.window.Event("close")); };
  const host = document.getElementById("root")!;
  const root = createRoot(host);
  let checks = 0;
  function ok(name: string, test: () => void) { test(); checks++; console.log(`ok ${name}`); }
  function button(text: string): HTMLButtonElement {
    const found = Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.trim() === text);
    assert.ok(found, `Button not found: ${text}`); return found;
  }
  async function click(text: string) { await act(async () => button(text).click()); }
  function card(id: string) { const found = host.querySelector(`[data-finding-id="${id}"]`); assert.ok(found, `Card not found: ${id}`); return found; }
  async function choose(id: string, value: string) {
    const select = card(id).querySelector("select")!;
    await act(async () => { select.value = value; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  }
  function draft() { const el = host.querySelector('[data-testid="current-draft"]'); assert.ok(el); return el.textContent!; }
  function summary() { return host.querySelector('[data-testid="decision-summary"]')!.textContent!; }
  const cleaning = demoFindings.find((f) => f.verdict === "cleaning" && !/mou?ld/i.test(f.description))!;
  const noChange = demoFindings.find((f) => f.verdict === "no_change")!;
  await act(async () => root.render(<Home />));
  ok("homepage separates generated inputs from real offline model results", () => {
    assert.equal(demoData.source, "pipeline-run");
    assert.match(host.textContent!, /Generated test images · Real model results/);
    assert.match(host.textContent!, /Muse Image created the test scenes; SAM 3\.1 and Muse Spark analysed them beforehand/);
    assert.match(host.textContent!, /No live model calls/);
    assert.doesNotMatch(host.textContent!, /Simulated, precomputed prototype/);
  });
  ok("homepage primary action goes directly to the sample, with explanation secondary", () => {
    const primary = host.querySelector("a.btn")!;
    assert.equal(primary.getAttribute("href"), "/demo");
    assert.equal(primary.textContent, "Try the sample review");
    assert.equal(Array.from(host.querySelectorAll("a")).find((link) => link.textContent === "How it works")!.getAttribute("href"), "/upload");
  });
  await act(async () => root.render(<Board property={demoData.property} findings={demoFindings} reply="ARCHIVE SENTINEL" pdf="/original.pdf" />));
  ok("exact default counts", () => assert.equal(summary(), "Agree: 2Dispute: 5Not claimed: 13"));
  ok("responses have item-specific labels and linked explanations", () => {
    for (const select of host.querySelectorAll("select")) {
      const labelled = select.getAttribute("aria-labelledby")!.split(" ").map((id) => document.getElementById(id));
      const described = select.getAttribute("aria-describedby")!.split(" ").map((id) => document.getElementById(id));
      assert.ok(labelled.length >= 3 && labelled.every(Boolean));
      assert.ok(described.length >= 2 && described.every(Boolean));
      assert.ok(described.some((element) => element!.textContent!.includes("Finding reference:")));
    }
    assert.ok(host.querySelector('[role="group"][aria-label="Filter model verdicts"]'));
  });
  ok("cached percentages are withheld when item assumptions are missing", () => {
    const calculation = card("bedroom-carpet-0-0").querySelector('[data-testid="replacement-calculation"]')!;
    assert.match(calculation.textContent!, /No percentage estimated/);
    assert.doesNotMatch(calculation.textContent!, /71%/);
  });
  ok("cleaning is not labelled as useful-life apportionment", () => {
    assert.ok(!card(cleaning.id).textContent!.includes("Illustrative useful-life share"));
    assert.ok(card(cleaning.id).textContent!.includes("does not depreciate cleaning costs"));
  });
  ok("review shortcuts are labelled and draft control references one initially hidden region", () => {
    assert.ok(host.querySelector('[role="group"][aria-label="Try this review"]'));
    const opener = button("Open current draft");
    const region = document.getElementById(opener.getAttribute("aria-controls")!);
    assert.ok(region?.hidden);
    assert.equal(opener.getAttribute("aria-expanded"), "false");
  });
  for (const [label, id] of [["Inspect a change", "living-room-carpet-0-1"], ["Inspect a model error", "bedroom-carpet-0-0"]]) {
    await click("No change (13)");
    assert.equal(host.querySelector(`[data-finding-id="${id}"]`), null);
    await click(label);
    ok(`${label} reveals and focuses a filtered-out finding without changing choices`, () => {
      assert.equal(host.querySelectorAll("article").length, 20);
      assert.equal(document.activeElement, card(id));
      assert.equal(lastScrollTarget, card(id));
      assert.equal(summary(), "Agree: 2Dispute: 5Not claimed: 13");
      assert.equal(button("All (20)").getAttribute("aria-pressed"), "true");
      assert.equal(host.querySelector('[data-testid="filter-summary"]')!.textContent, "Showing 20 of 20 findings.");
    });
    button(label).focus();
    await click(label);
    ok(`${label} works on repeated activation`, () => assert.equal(document.activeElement, card(id)));
  }
  ok("known error remains visible in the navigated finding", () => assert.match(card("bedroom-carpet-0-0").textContent!, /planted test expected fair wear/));
  await click("Open current draft");
  ok("open draft expands and focuses its heading", () => {
    assert.equal(document.activeElement?.textContent, "Current response draft");
    assert.equal(lastScrollTarget, document.activeElement);
    assert.equal(button("Open current draft").getAttribute("aria-expanded"), "true");
  });
  button("Open current draft").focus();
  await click("Open current draft");
  ok("reopening an already visible draft still focuses its heading", () => assert.equal(document.activeElement?.textContent, "Current response draft"));
  await choose(cleaning.id, "Dispute");
  await click("Inspect a change");
  await click("Inspect a model error");
  await click("Open current draft");
  ok("selection changes visible draft", () => assert.match(draft(), new RegExp(`\\[${cleaning.id}\\]: Dispute\\.`)));
  await click("Damage (4)");
  ok("filtered-out selection still in current draft", () => {
    assert.equal(host.querySelector(`[data-finding-id="${cleaning.id}"]`), null);
    assert.ok(draft().includes(`[${cleaning.id}]: Dispute.`));
  });
  await click("All (20)");
  ok("filter preserves override", () => assert.equal(card(cleaning.id).querySelector("select")!.value, "Dispute"));
  await choose(cleaning.id, "Not claimed");
  ok("Not claimed removes item", () => assert.ok(!draft().includes(`[${cleaning.id}]`)));
  await choose(noChange.id, "Agree");
  ok("no-change Agree override is included", () => assert.ok(draft().includes(`[${noChange.id}]: Agree in principle`)));
  ok("no-change explanation remains a suggestion after override", () => {
    assert.ok(card(noChange.id).textContent!.includes("Not claimed is the suggested response"));
    assert.ok(!card(noChange.id).textContent!.includes("this item is not included in the draft"));
  });
  await click("Close current draft");
  ok("closing draft returns focus to the opener and updates its expanded state", () => {
    assert.equal(document.activeElement, button("Open current draft"));
    assert.equal(button("Open current draft").getAttribute("aria-expanded"), "false");
    assert.equal(host.querySelector('[data-testid="current-draft"]'), null);
  });
  await click("Open current draft");
  ok("draft show/hide preserves choices", () => { assert.ok(draft().includes(`[${noChange.id}]: Agree in principle`)); assert.ok(!draft().includes(`[${cleaning.id}]`)); });
  await click("Copy current draft");
  ok("copy uses only current draft", () => { assert.equal(copied, draft()); assert.ok(!copied.includes("ARCHIVE SENTINEL")); });
  dom.window.navigator.clipboard.writeText = async () => { throw new Error("Test: clipboard unavailable"); };
  await click("Copy current draft");
  ok("clipboard failure provides a manual fallback", () => assert.match(host.querySelector('[role="status"]')!.textContent!, /copy it manually/));
  await click("Download current draft (.txt)");
  const downloadText = await downloaded!.text();
  ok("download uses current draft text", () => { assert.equal(downloadText, draft()); assert.equal(downloadName, "fair-wear-review-draft.txt"); });
  ok("archive has distinct warning and original link", () => {
    const archive = host.querySelector('[aria-label="Original precomputed demo artifacts"]')!;
    assert.match(archive.textContent!, /do not include your selected responses/);
    assert.match(archive.textContent!, /ARCHIVE SENTINEL/);
    assert.equal(archive.querySelector("a")!.getAttribute("href"), "/original.pdf");
    assert.match(archive.querySelector("a")!.textContent!, /original precomputed PDF \(unchanged\)/);
  });
  await click("Reset suggested responses");
  ok("reset restores counts and default draft", () => { assert.equal(summary(), "Agree: 2Dispute: 5Not claimed: 13"); assert.ok(!draft().includes(`[${noChange.id}]`)); assert.ok(draft().includes(`[${cleaning.id}]: Agree in principle`)); });
  await click("No change (13)");
  await click("Inspect a model error");
  ok("review shortcut still works after reset", () => assert.equal(document.activeElement, card("bedroom-carpet-0-0")));
  const evidenceCard = card("bedroom-carpet-0-0");
  const enlarge = evidenceCard.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
  await act(async () => enlarge.click());
  const dialog = evidenceCard.querySelector("dialog")!;
  ok("evidence opens the selected image using mocked dialog API", () => {
    assert.equal(dialog.open, true);
    assert.equal(dialog.querySelector("img")!.getAttribute("src"), "/demo/flat/crops/bedroom-move_in-carpet-0.jpg");
    assert.match(dialog.textContent!, /Simulated input imagery/);
    const original = dialog.querySelector("a")!;
    assert.equal(original.getAttribute("target"), "_blank");
    assert.equal(original.getAttribute("rel"), "noopener noreferrer");
    assert.equal(original.getAttribute("href"), "/demo/flat/crops/bedroom-move_in-carpet-0.jpg");
  });
  const evidenceButton = (label: string) => Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === label)!;
  await act(async () => evidenceButton("Move-out").click());
  ok("evidence switches to the matching after image", () => assert.equal(dialog.querySelector("img")!.getAttribute("src"), "/demo/flat/crops/bedroom-move_out-carpet-0.jpg"));
  await act(async () => evidenceButton("Close").click());
  ok("app restores focus to the evidence opener", () => assert.equal(document.activeElement, enlarge));
  await act(async () => enlarge.click());
  ok("evidence closes and reopens using mocked dialog API", () => { assert.equal(dialog.open, true); assert.equal(dialog.querySelector("img")!.getAttribute("src"), "/demo/flat/crops/bedroom-move_in-carpet-0.jpg"); });
  await act(async () => evidenceButton("Close").click());
  await click("Inspect a change");
  ok("review shortcut still works after closing evidence", () => assert.equal(document.activeElement, card("living-room-carpet-0-1")));
  await act(async () => root.render(<Sample />));
  ok("sample and evaluation describe real results on generated imagery", () => {
    assert.match(host.querySelector(".banner")!.textContent!, /Generated test images · Real model results/);
    assert.match(host.querySelector(".banner")!.textContent!, /No live model calls/);
    const evaluation = host.querySelector('[aria-label="Published evaluation on generated imagery"]')!;
    assert.match(evaluation.textContent!, /Real pipeline evaluation: 4 generated rooms, 8 planted changes/);
    assert.match(evaluation.textContent!, /not accuracy estimates for real homes/);
    assert.match(host.querySelector("article .room")!.textContent!, /simulated imagery/);
  });
  ok("sample starts hidden and does not request personal files", () => { assert.equal((host.querySelector("#sample-results") as HTMLElement).hidden, true); assert.equal(host.querySelector('input[type="file"]'), null); });
  await click("Show sample findings");
  await choose(cleaning.id, "Dispute");
  await click("Hide sample findings");
  await click("Show sample findings");
  ok("sample hide/show preserves choices", () => { assert.equal((host.querySelector("#sample-results") as HTMLElement).hidden, false); assert.equal(card(cleaning.id).querySelector("select")!.value, "Dispute"); });
  const supplied = { ...demoFindings[0], id: "bathroom-shower screen-0", ageYears: 0, calculationBasis: { usefulLifeYears: 7, qualityBasis: "Supplied illustration, not verified" }, apportionmentPct: 999 };
  await act(async () => root.render(<Board property="Illustration" findings={[supplied]} />));
  ok("generic boards do not show unavailable sample stops", () => {
    assert.equal(Array.from(host.querySelectorAll("button")).filter((element) => /Inspect a/.test(element.textContent!)).length, 0);
  });
  ok("finding references containing spaces do not break DOM associations", () => {
    assert.ok(Array.from(host.querySelectorAll("[id]")).every((element) => !/\s/.test(element.id)));
    for (const attribute of ["aria-labelledby", "aria-describedby"]) {
      for (const element of host.querySelectorAll(`[${attribute}]`)) {
        assert.ok(element.getAttribute(attribute)!.split(" ").every((id) => document.getElementById(id)));
      }
    }
    assert.match(host.textContent!, /Finding reference: bathroom-shower screen-0/);
  });
  ok("complete inputs show recalculated illustration rather than cached percentage", () => {
    const text = host.querySelector('[data-testid="replacement-calculation"]')!.textContent!;
    assert.match(text, /Remaining-life illustration: 71%/);
    assert.doesNotMatch(text, /999%/);
    assert.match(text, /not verified facts or tenant liability/);
  });
  await act(async () => root.unmount());
  dom.window.close();
  console.log(`Passed ${checks} DOM checks. Native API mocks do not establish browser behavior.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
