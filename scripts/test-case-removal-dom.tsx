// Focus/scroll intent is mocked in jsdom; rendered geometry needs browser QA.
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
import { sampleCaseItems } from "../lib/case-builder";
import { demoFindings } from "../lib/demo";
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module: { exports: unknown }) => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_target, name) => String(name) }) }; };
async function main() {
  const { default: CaseBuilder } = await import("../components/CaseBuilder");
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost/case" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, React, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  let narrow = true;
  dom.window.matchMedia = ((query: string) => { assert.equal(query, "(max-width: 740px)"); return { matches: narrow }; }) as typeof window.matchMedia;
  const scrolls: { target: HTMLElement; options: ScrollIntoViewOptions; heading: string | null }[] = [];
  dom.window.HTMLElement.prototype.scrollIntoView = function (options) {
    scrolls.push({ target: this, options: options as ScrollIntoViewOptions, heading: document.activeElement?.textContent ?? null });
  };
  // @ts-expect-error React DOM runtime is installed; optional declarations are not needed.
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  const samples = sampleCaseItems(demoFindings);
  const heading = () => document.querySelector<HTMLHeadingElement>(".itemHeading h2")!;
  const claims = () => [...document.querySelectorAll<HTMLButtonElement>(".claim")];
  const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.includes(label))!;
  async function click(el: HTMLButtonElement) { el.focus(); await act(async () => el.click()); }
  function checkNavigation(expected: string) {
    assert.equal(document.activeElement, heading());
    assert.equal(heading().textContent, expected);
    assert.equal(heading().tabIndex, -1);
    assert.equal(scrolls.at(-1)?.target, document.querySelector(".editor"));
    assert.deepEqual(scrolls.at(-1)?.options, { behavior: "instant", block: "start" });
    assert.equal(scrolls.at(-1)?.heading, expected, "focus observes the committed selection");
  }
  async function input(selector: string, value: string) {
    const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    const proto = el.tagName === "TEXTAREA" ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
      el.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      el.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
  }
  await act(async () => root.render(<CaseBuilder sampleItems={samples} />));
  assert.equal(button("Remove this deduction"), undefined, "sample findings cannot be removed");
  await click(button("Start a private case"));
  await input('[aria-label="Item"]', "Keep carpet");
  await input('[aria-label="Proposed amount in pounds"]', "45");
  await input('textarea', "Keep this note");
  await click(button("+ Add a deduction"));
  await input('[aria-label="Item"]', "Accidental oven");
  await input('[aria-label="Proposed amount in pounds"]', "25");
  await input('textarea', "Remove this note");
  await click(button("Preview response draft"));
  let confirmation = "";
  dom.window.confirm = (message) => { confirmation = message || ""; return false; };
  const removeButton = button("Remove this deduction");
  await click(removeButton);
  assert.equal(claims().length, 2);
  assert.equal(heading().textContent, "Accidental oven");
  assert.equal(document.activeElement, removeButton, "cancel keeps focus on the removal control");
  assert.match(confirmation, /Accidental oven/);
  assert.match(confirmation, /notes, photos and evidence choices/);
  assert.match(confirmation, /Existing downloads will not change/);
  dom.window.confirm = () => true;
  await click(removeButton);
  checkNavigation("Keep carpet");
  assert.equal(claims().length, 1);
  assert.equal(document.querySelector<HTMLTextAreaElement>('textarea')!.value, "Keep this note");
  assert.match(document.querySelector('[data-testid="case-summary"]')!.textContent!, /£45.00/);
  assert.doesNotMatch(document.querySelector('#case-current-reply')!.textContent!, /Accidental oven|Remove this note|£25/);
  // Removing the last claim preserves a usable editor, with no stale values.
  narrow = false;
  await click(button("Remove this deduction"));
  checkNavigation("Add a proposed deduction");
  assert.equal(claims().length, 1);
  assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Item"]')!.value, "");
  assert.equal(document.querySelector<HTMLTextAreaElement>('textarea')!.value, "");
  assert.match(document.body.textContent!, /A new blank deduction is ready/);
  assert.doesNotMatch(document.querySelector('#case-current-reply')!.textContent!, /Keep carpet|Keep this note/);
  // Removing one at capacity recovers a slot and keeps adjacent selection valid.
  for (let i = 1; i < 12; i++) await click(button("+ Add a deduction"));
  assert.equal(claims().length, 12);
  assert.equal(button("+ Add a deduction").disabled, true);
  await click(claims()[4]);
  await input('[aria-label="Item"]', "Remove middle");
  await click(button("Remove this deduction"));
  assert.equal(claims().length, 11);
  assert.equal(button("+ Add a deduction").disabled, false);
  assert.equal(claims()[4].getAttribute("aria-pressed"), "true");
  await click(button("+ Add a deduction"));
  assert.equal(claims().length, 12);
  assert.equal(new Set([...document.querySelectorAll<HTMLInputElement>('input[type=radio]')].map((radio) => radio.name)).size, 1);
  assert.equal(dom.window.localStorage.length, 0);
  assert.equal(dom.window.sessionStorage.length, 0);
  await act(async () => root.unmount());
  dom.window.close();
  console.log("PASS case removal: sample protection, cancel, isolated deletion, draft/totals, last-claim reset, focus on desktop/mobile, capacity recovery and no storage");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
