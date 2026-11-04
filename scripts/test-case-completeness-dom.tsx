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
  let downloads = 0, blob: Blob | undefined;
  URL.createObjectURL = (value: Blob) => { blob = value; return "blob:case-test"; };
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function () { downloads++; };
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((callback: () => void, delay?: number) => realTimeout(callback, delay === 30_000 ? 0 : delay)) as typeof setTimeout;
  dom.window.confirm = () => true;
  await act(async () => root.render(<CaseBuilder sampleItems={samples} />));
  assert.equal(document.querySelector('.exportReview'), null, "no premature warning on load");
  await click(button("Start a private case"));
  await input('textarea', "Preserve this review note");
  await click(button("Export current evidence bundle"));
  assert.equal(downloads, 0, "blank labels prompt before download");
  assert.equal(document.activeElement, document.querySelector('.exportReview'));
  assert.match(document.querySelector('.exportReview')!.textContent!, /unknown amount is allowed/);
  assert.match(document.querySelector('.exportReview')!.textContent!, /not a check of your evidence or entitlement/);
  assert.ok(button("Add room for deduction 1"));
  assert.ok(button("Add item for deduction 1"));
  await click(button("Export current evidence bundle"));
  assert.equal(document.querySelectorAll('.exportReview').length, 1, "repeat requests reuse one warning");
  await click(button("Cancel export"));
  assert.equal(downloads, 0);
  assert.equal(document.querySelector('.exportReview'), null);
  assert.equal(document.activeElement, button("Export current evidence bundle"));
  assert.equal(document.querySelector<HTMLTextAreaElement>('textarea')!.value, "Preserve this review note");
  await click(button("Export current evidence bundle"));
  await click(button("Add room for deduction 1"));
  assert.equal(document.activeElement?.getAttribute('aria-label'), 'Room');
  await input('[aria-label="Room"]', '   ');
  assert.ok(button("Add room for deduction 1"), "whitespace stays blank");
  await input('[aria-label="Room"]', 'Bedroom');
  await click(button("Add item for deduction 1"));
  assert.equal(document.activeElement?.getAttribute('aria-label'), 'Item');
  await input('[aria-label="Item"]', 'Carpet');
  assert.equal(document.querySelector('.exportReview'), null);
  await click(button("Export current evidence bundle"));
  assert.equal(downloads, 1, "complete labels and unknown amount export directly");
  assert.match(await blob!.text(), /Preserve this review note/);
  assert.match(await blob!.text(), /unknown/i);
  // New missing claim can be corrected from a different selected claim, on desktop too.
  await click(button("+ Add a deduction"));
  await input('[aria-label="Item"]', 'Oven');
  await input('textarea', 'Second note');
  await click(claims()[0]);
  narrow = false;
  await click(button("Export current evidence bundle"));
  await click(button("Add room for deduction 2"));
  assert.equal(document.activeElement?.getAttribute('aria-label'), 'Room');
  assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Item"]')!.value, 'Oven');
  await click(button("Export anyway"));
  assert.equal(downloads, 2);
  assert.equal(document.activeElement, button("Export current evidence bundle"));
  assert.match(await blob!.text(), /Second note/);
  assert.match(await blob!.text(), /Preserve this review note/);
  assert.equal(claims().length, 2);
  await click(button("Export current evidence bundle"));
  assert.ok(document.querySelector('.exportReview'), "export anyway is one-time, not saved permission");
  await click(button("Cancel export"));
  await act(async () => document.querySelector<HTMLInputElement>('input[type=radio][value=omit]')!.click());
  await click(button("Export current evidence bundle"));
  assert.equal(downloads, 3, "omitted blank labels do not prompt");
  assert.doesNotMatch(await blob!.text(), /Second note/);
  assert.equal(dom.window.localStorage.length, 0);
  assert.equal(dom.window.sessionStorage.length, 0);
  globalThis.setTimeout = realTimeout;
  await act(async () => root.unmount());
  dom.window.close();
  console.log("PASS completeness: blank/whitespace labels, repeat/cancel, field focus desktop/mobile, valid labels with unknown amount, one-time export anyway, omitted items, notes preserved and no storage");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
