// Regression uses actual anchor.click(): repeating a fragment emits no hashchange.
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
// @ts-expect-error Runtime installed; optional declarations not required.
import { createRoot } from "react-dom/client";
import Demo from "../app/demo/page";
async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/demo#finding=bedroom-carpet-0-0" });
  Object.assign(globalThis, { React, window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  let scrolled: HTMLElement | null = null;
  dom.window.HTMLElement.prototype.scrollIntoView = function () { scrolled = this; };
  const root = createRoot(document.getElementById("root")!);
  await act(async () => root.render(<Demo />));
  const card = () => document.querySelector('[data-finding-id="bedroom-carpet-0-0"]');
  const clean = () => [...document.querySelectorAll("button")].find(b => b.textContent!.startsWith("Cleaning ("))!;
  const link = [...document.querySelectorAll("a")].find(a => a.textContent === "Review the bedroom carpet")!;
  let hashchanges = 0; window.addEventListener("hashchange", () => hashchanges++);
  // Integrated regression: navigation must neither confirm nor revoke a response.
  const progress = () => document.querySelector('[data-testid="sample-choice-progress"]')!.textContent;
  assert.match(progress()!, /^0 of 3/);
  const confirmation = () => card()!.querySelector<HTMLButtonElement>('button[aria-label^="Confirm Dispute:"]')!;
  await act(async () => confirmation().click());
  assert.match(progress()!, /^1 of 3/);
  const before = document.querySelector('[data-testid="decision-summary"]')!.textContent;
  for (let attempt = 0; attempt < 2; attempt++) {
    await act(async () => clean().click());
    assert.equal(card(), null);
    await act(async () => { link.click(); await new Promise(resolve => setTimeout(resolve, 40)); });
    assert.ok(card()); assert.equal(document.activeElement, card()); assert.equal(scrolled, card());
    assert.equal(hashchanges, 0);
    assert.match(progress()!, /^1 of 3/);
    assert.ok(card()!.querySelector('button[aria-label^="Undo confirmation:"]'));
    assert.equal(document.querySelector('[data-testid="decision-summary"]')!.textContent, before);
  }
  await act(async () => card()!.querySelector<HTMLButtonElement>('button[aria-label^="Undo confirmation:"]')!.click());
  assert.match(progress()!, /^0 of 3/);
  for (const attributes of [{ target: "_blank" }, { download: "example" }, { href: "https://other.test/demo#finding=bedroom-carpet-0-0" }, { href: "/other#finding=bedroom-carpet-0-0" }]) {
    await act(async () => clean().click());
    const other = document.createElement("a");
    other.href = link.href;
    for (const [key,value] of Object.entries(attributes)) other.setAttribute(key,value);
    document.body.append(other);
    // Prevent default after the board listener, avoiding jsdom's unsupported full navigation.
    const suppress = (e: Event) => e.preventDefault();
    window.addEventListener("click", suppress, { once: true });
    await act(async () => other.click());
    assert.equal(card(), null); other.remove();
  }
  for (const modifier of ["ctrlKey", "metaKey", "shiftKey", "altKey"]) {
    await act(async () => clean().click());
    window.addEventListener("click", e => e.preventDefault(), { once: true });
    await act(async () => link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, [modifier]: true })));
    assert.equal(card(), null, "Modified clicks retain browser navigation semantics");
  }
  window.history.replaceState({}, "", "/demo#finding=not-allowlisted");
  link.href = window.location.href;
  await act(async () => link.click());
  assert.equal(card(), null, "Unknown finding IDs cannot reveal or focus a finding");
  await act(async () => root.unmount()); dom.window.close();
  console.log("PASS actual repeated anchor clicks reveal/focus without hashchange or choice changes; foreign, new-tab, download and unknown targets ignored");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
