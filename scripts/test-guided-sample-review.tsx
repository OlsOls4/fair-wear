import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
// @ts-expect-error Runtime installed without optional declarations.
import { createRoot } from "react-dom/client";
import Demo from "../app/demo/page";
import { SAMPLE_CASE_EXAMPLES } from "../lib/case-builder";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/demo" });
  Object.assign(globalThis, { React, window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  let scrolled: HTMLElement | null = null;
  dom.window.HTMLElement.prototype.scrollIntoView = function () { scrolled = this; };
  const root = createRoot(document.getElementById("root")!);
  await act(async () => root.render(<Demo />));
  const card = (id: string) => document.querySelector<HTMLElement>(`[data-finding-id="${id}"]`)!;
  const progress = () => document.querySelector('[data-testid="sample-choice-progress"]')!.textContent;
  const buttons = () => [...document.querySelectorAll<HTMLButtonElement>(".sample-review-stop")];
  const click = async (button: HTMLButtonElement) => { await act(async () => button.click()); };
  const all = () => [...document.querySelectorAll("button")].find(b => b.textContent === "All (20)")!;
  assert.equal(document.querySelectorAll("[data-finding-id]").length, 20);
  assert.equal(all().getAttribute("aria-pressed"), "true");
  assert.equal(buttons().length, 3, "The existing shortcut strip is replaced, not duplicated");
  assert.ok(buttons()[0].compareDocumentPosition(document.getElementById("sample-evaluation")!) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(document.querySelectorAll("#sample-evaluation").length, 1);
  assert.equal(document.querySelectorAll("#sample-evaluation .evaluation-metrics > div").length, 5);
  assert.equal(document.getElementById("sample-evaluation")!.closest("[hidden], details"), null);
  assert.match(progress()!, /^0 of 3/);
  assert.ok(buttons().every(b => b.textContent!.includes("Not selected")));
  for (const [index, example] of SAMPLE_CASE_EXAMPLES.entries()) {
    await click([...document.querySelectorAll("button")].find(b => b.textContent === "No change (13)")!);
    assert.equal(card(example.id), null);
    await click(buttons()[index]);
    assert.equal(document.activeElement, card(example.id));
    assert.equal(scrolled, card(example.id));
    assert.equal(document.querySelectorAll("[data-finding-id]").length, 20);
    assert.match(progress()!, /^0 of 3/, "Navigation must not count as a choice");
    await click(buttons()[index]);
    assert.equal(document.activeElement, card(example.id), "Repeated jumps focus again");
  }
  await click(buttons()[0]);
  const carpet = card(SAMPLE_CASE_EXAMPLES[0].id);
  await click(carpet.querySelector<HTMLButtonElement>('button[aria-label^="Confirm Dispute:"]')!);
  assert.match(progress()!, /^1 of 3/);
  assert.match(buttons()[0].textContent!, /Response selected/);
  const saved = window.sessionStorage.getItem("fair-wear:sample-review:v1");
  assert.ok(saved);
  await click(carpet.querySelector<HTMLButtonElement>(".card-case-handoff > button")!);
  assert.equal(document.activeElement, card(SAMPLE_CASE_EXAMPLES[1].id));
  await click(card(SAMPLE_CASE_EXAMPLES[1].id).querySelector<HTMLButtonElement>(".card-case-handoff > button")!);
  assert.equal(document.activeElement, card(SAMPLE_CASE_EXAMPLES[2].id));
  assert.match(progress()!, /^1 of 3/, "Next never confirms the skipped oven suggestion");
  assert.equal(window.sessionStorage.getItem("fair-wear:sample-review:v1"), saved);
  assert.equal(card(SAMPLE_CASE_EXAMPLES[2].id).querySelector<HTMLButtonElement>(".card-case-handoff button[aria-describedby]")!.disabled, false, "The last claim can carry earlier choices without selecting skipped claims");
  await click(buttons()[0]);
  await click(carpet.querySelector<HTMLButtonElement>('button[aria-label^="Undo confirmation:"]')!);
  assert.match(progress()!, /^0 of 3/);
  assert.match(buttons()[0].textContent!, /Not selected/);
  assert.equal(card(SAMPLE_CASE_EXAMPLES[2].id).querySelector<HTMLButtonElement>(".card-case-handoff button[aria-describedby]")!.disabled, true, "No choices is distinct from skipped claims");
  window.history.replaceState({}, "", "/demo#finding=kitchen-oven-0-0");
  await act(async () => window.dispatchEvent(new dom.window.HashChangeEvent("hashchange")));
  assert.equal(document.activeElement, card(SAMPLE_CASE_EXAMPLES[1].id), "Existing evidence deep links remain functional");
  assert.match(progress()!, /^0 of 3/);
  await act(async () => root.unmount());
  dom.window.close();
  console.log("PASS guided sample: three existing claims, expanded evaluation, unchanged all-findings default, repeat/focus/next/deep-link navigation, confirm/undo separation");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
