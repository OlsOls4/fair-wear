// DOM lifecycle tests. Actual route navigation and reload also require browser QA.
import assert from "node:assert/strict";
import React, { act } from "react";
// @ts-expect-error React DOM runtime is installed without its optional declarations.
import { renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";
// @ts-expect-error React DOM runtime is installed without its optional declarations.
import { createRoot } from "react-dom/client";
import Board from "../components/Board";
import Demo from "../app/demo/page";
import Workflow from "../app/upload/page";
import { demoData, demoFindings } from "../lib/demo";
import { readSampleResponses, saveSampleResponses, SAMPLE_REVIEW_STORAGE_KEY as KEY, SAMPLE_REVIEW_REVISION as REVISION } from "../lib/sample-review-session";

async function main() {
  let checks = 0;
  function ok(name: string, check: () => void) { check(); checks++; console.log(`ok ${name}`); }
  const id = "bedroom-carpet-0-0";
  const oven = "kitchen-oven-0-0";
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "https://fair-wear.test/demo" });
  const storage = dom.window.sessionStorage;
  const payload = (responses: unknown, revision = REVISION) => JSON.stringify({ version: 1, revision, responses });
  Object.assign(globalThis, { React });
  ok("server rendering does not access browser storage", () => assert.match(renderToString(<Demo />), /Checking this tab/));
  ok("blank session restores no overrides", () => assert.deepEqual(readSampleResponses(storage), {}));
  saveSampleResponses(storage, { [id]: "Not claimed", [oven]: "Dispute", "private-case-id": "Agree" });
  ok("store contains only public sample IDs and choices, not images or case details", () => {
    const saved = JSON.parse(storage.getItem(KEY)!);
    assert.deepEqual(Object.keys(saved).sort(), ["responses", "revision", "version"]);
    assert.deepEqual(saved.responses, { [id]: "Not claimed", [oven]: "Dispute" });
    assert.doesNotMatch(storage.getItem(KEY)!, /private|data:|blob:|\.jpg|description/);
  });
  for (const raw of ["{", "null", "[]", "5", payload({ [id]: "Agree" }, "old-sample"), JSON.stringify({ version: 2, revision: REVISION, responses: { [id]: "Agree" } }), " ".repeat(8193)]) {
    storage.setItem(KEY, raw);
    ok(`invalid or stale store is ignored (${checks})`, () => assert.deepEqual(readSampleResponses(storage), {}));
  }
  storage.setItem(KEY, `{"version":1,"revision":"${REVISION}","responses":{"${id}":"<img src=x onerror=alert(1)>","${oven}":"Dispute","__proto__":{"polluted":true},"private-case-id":"Agree"}}`);
  ok("invalid choices, unknown references and prototype injection are dropped", () => {
    assert.deepEqual(readSampleResponses(storage), { [oven]: "Dispute" });
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
  });
  storage.clear();
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, React, IS_REACT_ACT_ENVIRONMENT: true });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const host = document.getElementById("root")!;
  let root = createRoot(host);
  const select = (findingId: string) => host.querySelector<HTMLSelectElement>(`[data-finding-id="${findingId}"] select`)!;
  const button = (name: string) => Array.from(host.querySelectorAll("button")).find((entry) => entry.textContent === name)!;
  const notice = () => host.querySelector('[data-testid="review-storage-notice"]')!.textContent!;
  async function mount(element: React.ReactNode) {
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(element));
  }
  async function choose(findingId: string, value: string) {
    await act(async () => { const input = select(findingId); input.value = value; input.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  }
  await mount(<Demo />);
  ok("sample disclosures explain navigation/reload, reset and browser restore", () => {
    assert.match(notice(), /across navigation and reload/);
    assert.match(notice(), /never photos or personal case details/);
    assert.match(notice(), /Browser session restore may keep them/);
    assert.equal(storage.getItem(KEY), null, "reading an empty sample must not write a store");
  });
  await choose(id, "Not claimed");
  await choose(oven, "Dispute");
  await mount(<Workflow />);
  await act(async () => button("Show sample findings").click());
  ok("About this comparison route restores both current choices", () => {
    assert.equal(select(id).value, "Not claimed"); assert.equal(select(oven).value, "Dispute");
  });
  await choose(oven, "Not claimed");
  await mount(<Demo />);
  await act(async () => button("Open current draft").click());
  ok("returning to findings uses edits from either sample route in the draft", () => {
    assert.equal(select(id).value, "Not claimed"); assert.equal(select(oven).value, "Not claimed");
    assert.doesNotMatch(host.querySelector('[data-testid="current-draft"]')!.textContent!, /\[bedroom-carpet-0-0\]|\[kitchen-oven-0-0\]/);
  });
  await mount(<Demo />);
  ok("a reload-style fresh mount restores choices", () => assert.equal(select(id).value, "Not claimed"));
  saveSampleResponses(storage, { [id]: "Agree", [oven]: "Dispute" });
  await act(async () => dom.window.dispatchEvent(new dom.window.PageTransitionEvent("pageshow", { persisted: true })));
  ok("Back/Forward-cache restoration refreshes choices changed on the other route", () => {
    assert.equal(select(id).value, "Agree"); assert.equal(select(oven).value, "Dispute");
  });
  saveSampleResponses(storage, {});
  await act(async () => dom.window.dispatchEvent(new dom.window.PageTransitionEvent("pageshow", { persisted: true })));
  ok("Back/Forward-cache restoration respects a reset on another route", () => {
    assert.equal(select(id).value, "Dispute"); assert.equal(select(oven).value, "Agree");
  });
  await choose(id, "Not claimed");
  await act(async () => button("Reset suggested responses").click());
  ok("reset removes saved state and restores default choices", () => {
    assert.equal(storage.getItem(KEY), null); assert.equal(select(id).value, "Dispute"); assert.equal(select(oven).value, "Agree");
  });
  await mount(<Workflow />);
  ok("reset remains effective on the other sample route", () => assert.equal(select(id).value, "Dispute"));
  saveSampleResponses(storage, { [id]: "Not claimed" });
  const savedSample = storage.getItem(KEY);
  await mount(<Board property={demoData.property} findings={demoFindings} />);
  ok("ordinary boards never read the sample store without explicit opt-in", () => {
    assert.equal(select(id).value, "Dispute"); assert.match(notice(), /only on this page/);
  });
  await choose(id, "Agree");
  await act(async () => button("Reset suggested responses").click());
  ok("ordinary board choices and reset never overwrite the sample store", () => assert.equal(storage.getItem(KEY), savedSample));
  Object.defineProperty(dom.window, "sessionStorage", { configurable: true, get() { throw new Error("Storage denied"); } });
  await mount(<Demo />);
  await choose(id, "Not claimed");
  ok("denied storage still permits in-page review with an honest warning", () => {
    assert.equal(select(id).value, "Not claimed"); assert.match(notice(), /Tab storage is unavailable/);
    assert.match(notice(), /may be lost when you leave or reload/);
  });
  await act(async () => button("Reset suggested responses").click());
  ok("failed clearing warns saved choices may reappear and permits retry", () => {
    assert.equal(select(id).value, "Dispute"); assert.match(notice(), /saved choices could not be cleared/);
    assert.equal(button("Reset suggested responses").disabled, false);
  });
  Object.defineProperty(dom.window, "sessionStorage", { configurable: true, value: storage });
  await act(async () => button("Reset suggested responses").click());
  ok("reset retry clears old storage after access returns", () => {
    assert.equal(storage.getItem(KEY), null); assert.match(notice(), /across navigation and reload/);
  });
  const quotaStore = { getItem: storage.getItem.bind(storage), removeItem: storage.removeItem.bind(storage), setItem() { throw new Error("Quota exceeded"); } };
  Object.defineProperty(dom.window, "sessionStorage", { configurable: true, value: quotaStore });
  await mount(<Demo />);
  await choose(id, "Not claimed");
  ok("write failure after successful read preserves current edits and updates notice", () => {
    assert.equal(select(id).value, "Not claimed"); assert.match(notice(), /Tab storage is unavailable/);
  });
  await act(async () => root.unmount());
  dom.window.close();
  console.log(`Passed ${checks} sample-session checks. DOM remounts are not browser navigation tests.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
