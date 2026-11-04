// Pure validation + DOM lifecycle checks. Native route navigation requires browser QA.
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRequire } from "node:module";
import { JSDOM, VirtualConsole } from "jsdom";
import { applySampleCaseTransfer, prepareSampleCaseTransfer, takeSampleCaseTransfer, SAMPLE_CASE_TRANSFER_KEY as KEY } from "../lib/sample-case-transfer";
import { buildCaseHtml, caseReply, emptyCaseItem, sampleCaseItems } from "../lib/case-builder";
import { saveSampleResponses, SAMPLE_REVIEW_STORAGE_KEY, SAMPLE_REVIEW_REVISION } from "../lib/sample-review-session";
import { demoData, demoFindings } from "../lib/demo";
import Board from "../components/Board";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module: { exports: unknown }) => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_target, name) => String(name) }) }; };
const carpet = "bedroom-carpet-0-0", oven = "kitchen-oven-0-0", bath = "bathroom-bath-0-0", other = "living-room-carpet-0-1";
const token = "01234567-89ab-4cde-8f01-23456789abcd", secondToken = "12345678-9abc-4def-8012-3456789abcde";
const samples = sampleCaseItems(demoFindings);
let checks = 0;
function ok(name: string, check: () => void) { check(); checks++; console.log(`ok ${name}`); }
async function main() {
  let attemptedNavigations = 0;
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => { if (error.message.startsWith("Not implemented: navigation")) attemptedNavigations++; else throw error; });
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "https://fair-wear.test/demo", virtualConsole });
  const storage = dom.window.sessionStorage;
  const originalModel = JSON.stringify(samples.map((item) => item.model));
  const destination = prepareSampleCaseTransfer(storage, { [carpet]: "Agree", [oven]: "Not claimed", [bath]: "Dispute", [other]: "Agree", private: "Agree" }, token);
  ok("one-use snapshot includes only the three public references and valid choices", () => {
    const saved = JSON.parse(storage.getItem(KEY)!);
    assert.deepEqual(Object.keys(saved).sort(), ["responses", "revision", "token", "version"]);
    assert.deepEqual(saved.responses, { [carpet]: "Agree", [oven]: "Not claimed", [bath]: "Dispute" });
    assert.equal(new URL(destination, dom.window.location.href).searchParams.get("transfer"), token);
    assert.doesNotMatch(storage.getItem(KEY)!, /private|data:|blob:|\.jpg|note|description/);
  });
  const transfer = takeSampleCaseTransfer(storage, token)!;
  const imported = applySampleCaseTransfer(samples, transfer);
  ok("all three mappings preserve original model results, claims and empty assumptions", () => {
    assert.deepEqual(imported.map((item) => item.response), ["discuss", "omit", "question"]);
    assert.equal(JSON.stringify(imported.map((item) => item.model)), originalModel);
    assert.deepEqual(imported.map((item) => item.claimPounds), ["480", "80", "350"]);
    assert.ok(imported.every((item) => !item.note && !item.usefulLife && !item.ageAtMoveIn));
    assert.equal(storage.getItem(KEY), null); assert.equal(takeSampleCaseTransfer(storage, token), null);
    assert.deepEqual(samples.map((item) => item.response), ["question", "question", "question"]);
  });
  const embedded = imported.map((item) => ({ ...item, before: { src: "data:image/png;base64,AAAA", origin: "sample" as const }, after: { src: "data:image/png;base64,AAAA", origin: "sample" as const } }));
  const html = buildCaseHtml({ mode: "sample", title: "Sample", items: embedded });
  const draft = caseReply({ mode: "sample", title: "Sample", items: imported });
  ok("portable bundle separates current human response, imported starting choice and model output", () => {
    assert.match(html, /Starting choice from sample review/); assert.match(html, /selected sample review response: Agree/);
    assert.match(html, /Original verdict: damage/); assert.match(html, /not the reviewer&#39;s conclusion|not the reviewer's conclusion/);
    assert.doesNotMatch(html, /Clean oven/); assert.doesNotMatch(draft, /Clean oven/); assert.match(draft, /willing to discuss/);
    assert.match(draft, /No amount is agreed/);
  });
  prepareSampleCaseTransfer(storage, { [other]: "Agree" }, token);
  ok("untouched defaults and unrelated findings never become chosen responses", () => {
    assert.deepEqual(takeSampleCaseTransfer(storage, token), {});
    assert.deepEqual(applySampleCaseTransfer(samples, {}), samples);
    const privateItem = { ...emptyCaseItem(carpet), note: "PRIVATE NOTE" };
    assert.deepEqual(applySampleCaseTransfer([privateItem], transfer), [privateItem]);
  });
  const payload = (responses: unknown, extra: Record<string, unknown> = {}) => JSON.stringify({ version: 1, revision: SAMPLE_REVIEW_REVISION, token, responses, ...extra });
  const invalid = ["{", "null", "[]", "5", " ".repeat(8193), payload([], {}), payload({ [carpet]: "Accept charge" }), payload({ [carpet]: "Agree" }, { token: secondToken }), payload({}, { version: 2 }), payload({}, { revision: "stale" })];
  for (const raw of invalid) {
    storage.setItem(KEY, raw);
    ok(`invalid or stale payload is rejected and consumed (${checks})`, () => { assert.equal(takeSampleCaseTransfer(storage, token), null); assert.equal(storage.getItem(KEY), null); });
  }
  storage.setItem(KEY, payload(JSON.parse(`{"${carpet}":"Agree","private":"Agree","__proto__":{"polluted":true}}`), { note: "PRIVATE NOTE", photos: "data:image/jpeg;base64,AAAA" }));
  ok("tampered extra fields, unknown IDs and prototype injection never propagate", () => {
    assert.deepEqual(takeSampleCaseTransfer(storage, token), { [carpet]: "Agree" });
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
  });
  prepareSampleCaseTransfer(storage, { [carpet]: "Agree" }, token);
  prepareSampleCaseTransfer(storage, { [carpet]: "Not claimed" }, secondToken);
  ok("a stale navigation cannot consume a newer snapshot as its own", () => assert.equal(takeSampleCaseTransfer(storage, token), null));
  ok("inherited decisions and invalid choice values are not selected overrides", () => {
    prepareSampleCaseTransfer(storage, Object.create({ [carpet]: "Agree" }), token);
    assert.deepEqual(takeSampleCaseTransfer(storage, token), {});
  });
  const denied = { getItem() { return payload({ [carpet]: "Agree" }); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } };
  ok("failed write or consumption fails closed rather than claiming a completed transfer", () => {
    assert.throws(() => prepareSampleCaseTransfer(denied, transfer, token), /denied/);
    assert.throws(() => takeSampleCaseTransfer(denied, token), /denied/);
  });
  storage.clear();
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, React, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  let confirms = true; dom.window.confirm = () => confirms;
  // @ts-expect-error React DOM runtime has no optional declaration package here.
  const { createRoot } = await import("react-dom/client");
  const { default: CaseBuilder } = await import("../components/CaseBuilder");
  const host = document.getElementById("root")!;
  let root = createRoot(host);
  const button = (name: string) => { const result = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes(name)); assert.ok(result, `button ${name}`); return result; };
  const response = () => host.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.value;
  const text = () => host.textContent!;
  async function click(name: string) { await act(async () => button(name).click()); }
  async function mount(element: React.ReactNode) { await act(async () => root.unmount()); root = createRoot(host); await act(async () => root.render(element)); }
  async function choose(id: string, value: string) { await act(async () => { const el = host.querySelector<HTMLSelectElement>(`[data-finding-id="${id}"] select`)!; el.value = value; el.dispatchEvent(new dom.window.Event("change", { bubbles: true })); }); }
  async function editNote(value: string) { await act(async () => { const el = host.querySelector("textarea")!; Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value")!.set!.call(el, value); el.dispatchEvent(new dom.window.Event("input", { bubbles: true })); }); }
  async function setResponse(value: string) { await act(async () => host.querySelector<HTMLInputElement>(`input[type=radio][value=${value}]`)!.click()); }
  const board = <Board rememberSampleResponses property={demoData.property} findings={demoFindings} />;
  await mount(board);
  await click("Inspect a change");
  ok("first guided stop is the bedroom carpet supported by the case handoff", () => {
    assert.equal(document.activeElement?.getAttribute("data-finding-id"), carpet);
    assert.ok(samples.some((item) => item.model?.id === carpet));
    assert.match(text(), /Start with the bedroom carpet/);
  });
  await choose(carpet, "Agree"); await choose(oven, "Not claimed"); await choose(other, "Dispute");
  await click("Cleaning ("); await click("Continue to case builder");
  let prepared = JSON.parse(storage.getItem(KEY)!);
  await click("Continue to case builder");
  ok("explicit Continue snapshots selected hidden rows once and discloses the limited mapping", () => {
    assert.deepEqual(prepared.responses, { [carpet]: "Agree", [oven]: "Not claimed" });
    assert.equal(JSON.parse(storage.getItem(KEY)!).token, prepared.token); assert.equal(attemptedNavigations, 1);
    assert.match(text(), /Only responses you changed/); assert.match(text(), /Untouched claims start as Question/);
  });
  await click("Cancel handoff");
  ok("cancelled pending navigation clears its snapshot and re-enables Continue", () => { assert.equal(storage.getItem(KEY), null); assert.equal(button("Continue to case builder").disabled, false); assert.match(text(), /Prepared handoff cleared/); });
  await click("Continue to case builder");
  Object.defineProperty(dom.window, "sessionStorage", { configurable: true, value: { getItem: storage.getItem.bind(storage), setItem: storage.setItem.bind(storage), removeItem() { throw new Error("denied"); } } });
  await click("Cancel handoff");
  ok("failed cancellation warns its snapshot may still import and permits retry", () => { assert.ok(storage.getItem(KEY)); assert.match(text(), /may still be imported if navigation continues/); assert.equal(button("Continue to case builder").disabled, false); });
  Object.defineProperty(dom.window, "sessionStorage", { configurable: true, value: storage });
  await click("Continue to case builder");
  await click("All ("); await choose(carpet, "Dispute");
  ok("editing after aborted navigation clears its snapshot and guard", () => { assert.equal(storage.getItem(KEY), null); assert.equal(button("Continue to case builder").disabled, false); });
  await choose(carpet, "Agree"); await click("Continue to case builder");
  prepared = JSON.parse(storage.getItem(KEY)!);
  dom.window.history.replaceState(null, "", `/case-builder?from=sample-review&transfer=${prepared.token}`);
  const boardStore = storage.getItem(SAMPLE_REVIEW_STORAGE_KEY);
  await mount(<React.StrictMode><CaseBuilder sampleItems={samples} /></React.StrictMode>);
  ok("explicit token navigation imports once even in StrictMode, clears URL and store, and keeps saved Board choices", () => {
    assert.match(text(), /2 selected sample responses carried over/); assert.equal(response(), "discuss");
    assert.equal(storage.getItem(KEY), null); assert.equal(dom.window.location.search, "");
    assert.equal(storage.getItem(SAMPLE_REVIEW_STORAGE_KEY), boardStore); assert.match(text(), /selected sample review response: Agree/);
  });
  await click("oven"); ok("Not claimed stays omitted", () => assert.equal(response(), "omit"));
  await click("bath"); ok("untouched sample starts Question with no invented reviewed provenance", () => { assert.equal(response(), "question"); assert.equal(host.querySelector('[data-testid="imported-review-response"]'), null); });
  await click("carpet"); await setResponse("question"); await editNote("MY CURRENT NOTE");
  saveSampleResponses(storage, { [carpet]: "Not claimed" });
  await act(async () => dom.window.dispatchEvent(new dom.window.PageTransitionEvent("pageshow", { persisted: true })));
  ok("BFCache restoration does not re-import newer review state over current case edits", () => { assert.equal(response(), "question"); assert.equal(host.querySelector("textarea")!.value, "MY CURRENT NOTE"); });
  confirms = false; await click("Reset example case");
  ok("cancelled reset preserves current notes, response and imported provenance", () => { assert.equal(host.querySelector("textarea")!.value, "MY CURRENT NOTE"); assert.ok(host.querySelector('[data-testid="sample-review-handoff"]')); });
  confirms = true; await click("Reset example case");
  ok("confirmed reset clears this case but not the review board", () => { assert.equal(host.querySelector("textarea")!.value, ""); assert.equal(response(), "question"); assert.equal(host.querySelector('[data-testid="sample-review-handoff"]'), null); assert.match(storage.getItem(SAMPLE_REVIEW_STORAGE_KEY)!, /Not claimed/); });
  const freshUrl = prepareSampleCaseTransfer(storage, { [carpet]: "Agree" }, token);
  dom.window.history.replaceState(null, "", freshUrl); await mount(<CaseBuilder sampleItems={samples} />);
  await click("Start a private case"); await editNote("PRIVATE CASE NOTE");
  prepareSampleCaseTransfer(storage, { [carpet]: "Not claimed" }, secondToken);
  await act(async () => dom.window.dispatchEvent(new dom.window.PageTransitionEvent("pageshow", { persisted: true })));
  ok("personal mode drops every sample annotation and ignores pending handoffs", () => { assert.doesNotMatch(text(), /Recorded AI suggestion|selected sample review response|selected sample responses carried/); assert.equal(host.querySelector("textarea")!.value, "PRIVATE CASE NOTE"); assert.equal(host.querySelectorAll("img").length, 0); assert.doesNotMatch(storage.getItem(KEY)!, /PRIVATE CASE NOTE/); });
  await click("Return to example");
  ok("returning to sample starts fresh, never silently reimports", () => { assert.equal(response(), "question"); assert.equal(host.querySelector("textarea")!.value, ""); assert.ok(storage.getItem(KEY)); });
  await mount(<CaseBuilder sampleItems={samples} />);
  ok("ordinary navigation and reload do not read a pending handoff", () => { assert.equal(response(), "question"); assert.ok(storage.getItem(KEY)); assert.equal(host.querySelector('[data-testid="sample-review-handoff"]'), null); });
  dom.window.history.replaceState(null, "", freshUrl); await mount(<CaseBuilder sampleItems={samples} />);
  ok("replayed token cannot import a different pending handoff", () => { assert.equal(response(), "question"); assert.match(text(), /No responses were imported/); assert.equal(storage.getItem(KEY), null); });
  dom.window.history.replaceState(null, "", "/demo"); await mount(board);
  prepareSampleCaseTransfer(storage, { [carpet]: "Agree" }, token); await choose(carpet, "Dispute");
  ok("changing a Board response clears an abandoned pending handoff", () => assert.equal(storage.getItem(KEY), null));
  prepareSampleCaseTransfer(storage, { [carpet]: "Agree" }, token); await click("Reset suggested responses");
  ok("resetting the Board clears abandoned handoff and saved overrides", () => { assert.equal(storage.getItem(KEY), null); assert.equal(storage.getItem(SAMPLE_REVIEW_STORAGE_KEY), null); });
  await choose(carpet, "Agree"); await click("Continue to case builder"); await click("Reset suggested responses");
  ok("reset after aborted navigation clears its snapshot and guard", () => { assert.equal(storage.getItem(KEY), null); assert.equal(button("Continue to case builder").disabled, false); });
  await click("Continue to case builder");
  await act(async () => dom.window.dispatchEvent(new dom.window.PageTransitionEvent("pageshow", { persisted: true })));
  ok("returning to the Board from BFCache re-enables Continue", () => assert.equal(button("Continue to case builder").disabled, false));
  const empty = JSON.parse(storage.getItem(KEY)!);
  dom.window.history.replaceState(null, "", `/case-builder?from=sample-review&transfer=${empty.token}`); await mount(<CaseBuilder sampleItems={samples} />);
  ok("empty explicit handoff honestly reports no selected matches without importing suggestions", () => { assert.match(text(), /No selected responses matched/); assert.equal(response(), "question"); });
  Object.defineProperty(dom.window, "sessionStorage", { configurable: true, get() { throw new Error("denied"); } });
  dom.window.history.replaceState(null, "", "/demo"); await mount(board); await choose(carpet, "Not claimed");
  const beforeDenied = attemptedNavigations; await click("Continue to case builder");
  ok("unavailable storage keeps user on the Board and allows retry without losing current choices", () => { assert.match(text(), /could not be carried over/); assert.equal(attemptedNavigations, beforeDenied); assert.equal(button("Continue to case builder").disabled, false); assert.equal(host.querySelector<HTMLSelectElement>(`[data-finding-id="${carpet}"] select`)!.value, "Not claimed"); });
  dom.window.history.replaceState(null, "", freshUrl); await mount(<CaseBuilder sampleItems={samples} />);
  ok("destination storage failure leaves a usable unmodified case and visible explanation", () => { assert.match(text(), /No sample responses were imported/); assert.equal(response(), "question"); });
  await act(async () => root.unmount()); dom.window.close();
  console.log(`Passed ${checks} sample-case handoff checks. Native navigation still needs browser QA.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
