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
  await act(async () => root.render(<CaseBuilder sampleItems={samples} />));
  assert.equal(scrolls.length, 0, "initial mobile mount must not scroll");
  assert.equal(document.activeElement, document.body, "initial mount must not steal focus");
  await click(claims()[1]); checkNavigation(samples[1].item);
  await click(claims()[1]); checkNavigation(samples[1].item);
  assert.equal(scrolls.length, 2, "reselecting the current claim still reveals it");
  await click(claims()[2]); checkNavigation(samples[2].item);
  const beforeEdit = scrolls.length;
  await act(async () => document.querySelector<HTMLInputElement>('input[type=radio][value=discuss]')!.click());
  assert.equal(scrolls.length, beforeEdit, "editing never triggers navigation");
  narrow = false;
  const desktopClaim = claims()[0]; await click(desktopClaim);
  assert.equal(document.activeElement, desktopClaim, "desktop keeps focus on the list button");
  assert.equal(scrolls.length, beforeEdit, "desktop does not scroll");
  narrow = true;
  dom.window.confirm = () => false;
  const modeButton = button("Start a private case"); await click(modeButton);
  assert.equal(document.activeElement, modeButton);
  assert.equal(scrolls.length, beforeEdit, "cancelled mode switch does not navigate");
  dom.window.confirm = () => true;
  await click(modeButton);
  assert.equal(scrolls.length, beforeEdit, "mode switches do not unexpectedly navigate");
  await click(button("+ Add a deduction")); checkNavigation("Add a proposed deduction");
  assert.equal(claims().length, 2);
  await click(claims()[0]); checkNavigation("Add a proposed deduction");
  assert.equal(claims()[0].getAttribute("aria-pressed"), "true");
  await act(async () => root.unmount());
  dom.window.close();
  console.log("PASS case navigation: initial load, selection, repeated selection, committed heading focus, edits, desktop, cancelled mode change, private add and selection");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
