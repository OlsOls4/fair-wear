// DOM behavior tests. Native file decoding, confirmation and download are mocked; not visual/browser QA.
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
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:"http://localhost"});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,React,IS_REACT_ACT_ENVIRONMENT:true});
  Object.defineProperty(globalThis,"navigator",{configurable:true,value:dom.window.navigator});
  // @ts-expect-error React DOM runtime is installed; its optional declaration package is not needed here.
  const { createRoot } = await import("react-dom/client");
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((callback: () => void, delay?: number) => { const timer = realTimeout(callback, delay === 30_000 ? 0 : delay); return timer; }) as typeof setTimeout;
  let downloads=0, filename="", blob:Blob|undefined, confirm=true;
  URL.createObjectURL=(value:Blob)=>{blob=value;return "blob:unit-export";};URL.revokeObjectURL=()=>{};
  dom.window.HTMLAnchorElement.prototype.click=function(){downloads++;filename=this.download;};
  dom.window.confirm=()=>confirm;
  const root=createRoot(document.getElementById("root")!);let checks=0;
  function ok(name:string,fn:()=>void){fn();checks++;console.log(`ok ${name}`);}
  function button(label:string){const found=Array.from(document.querySelectorAll("button")).find(b=>b.textContent?.includes(label));assert.ok(found,`button ${label}`);return found;}
  async function click(label:string){await act(async()=>button(label).click());}
  async function input(selector:string,value:string){const el=document.querySelector<HTMLInputElement|HTMLTextAreaElement>(selector)!;assert.ok(el,selector);await act(async()=>{const prototype=el.tagName==="TEXTAREA"?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,"value")!.set!.call(el,value);el.dispatchEvent(new dom.window.Event("input",{bubbles:true}));el.dispatchEvent(new dom.window.Event("change",{bubbles:true}));});}
  async function response(value:string){const radio=document.querySelector<HTMLInputElement>(`input[type=radio][value=${value}]`)!;await act(async()=>radio.click());}
  function text(){return document.body.textContent!;}
  await act(async()=>root.render(<CaseBuilder sampleItems={sampleCaseItems(demoFindings)}/>));
  ok("initial sample discloses fictional demand and original model disagreement",()=>{assert.match(text(),/£910 demand is invented/);assert.match(text(),/82% model confidence/);assert.match(text(),/The evaluation disagrees/);});
  async function toggleTracker(){await act(async()=>document.querySelector<HTMLInputElement>('.trackerToggle input')!.click());}
  async function selectStatus(label:string,value:string){const el=document.querySelector<HTMLSelectElement>(`select[aria-label="${label} status"]`)!;assert.ok(el);await act(async()=>{el.value=value;el.dispatchEvent(new dom.window.Event("change",{bubbles:true}));});}
  await toggleTracker();
  ok("tracker starts explicitly unknown despite sample photos",()=>{assert.equal(document.querySelector<HTMLSelectElement>('[aria-label="Move-in records status"]')!.value,"unknown");assert.equal(document.querySelectorAll('.evidenceGrid select').length,4);});
  await selectStatus("Move-in records","provided");await selectStatus("Move-out records","requested");await selectStatus("Itemised cost evidence","not_applicable");await selectStatus("Age and condition basis","unavailable");
  ok("specific requests omit provided and not applicable evidence",()=>{const requests=document.querySelector('.evidenceRequests')!.textContent!;assert.doesNotMatch(requests,/move-in inventory|itemised cost breakdown/);assert.match(requests,/remains requested/);assert.match(requests,/alternative supporting records/);});
  await click("oven");
  ok("checklist is independent per claim",()=>assert.equal(document.querySelector<HTMLInputElement>('.trackerToggle input')!.checked,false));
  await click("carpet");
  ok("tracking choices survive navigation",()=>assert.equal(document.querySelector<HTMLSelectElement>('[aria-label="Move-in records status"]')!.value,"provided"));
  await toggleTracker();await toggleTracker();
  ok("turning tracker off then on clears its old selections",()=>assert.equal(document.querySelector<HTMLSelectElement>('[aria-label="Move-in records status"]')!.value,"unknown"));
  await toggleTracker();
  await input("textarea", "CORRECTED REVIEW NOTE");
  await input('[aria-label="Replacement cost in pounds"]', "600");
  await input('[aria-label="Age at move-in in years"]', "3");
  await input('[aria-label="Tenancy length in years"]', "2");
  await input('[aria-label="Expected useful life in years"]', "8");
  await input('[aria-label="Quality and starting-condition basis"]', "Illustrative assumptions only");
  ok("editable inputs drive exact current illustration",()=>assert.match(document.querySelector('[data-testid="replacement-illustration"]')!.textContent!,/£225.00/));
  await input('[aria-label="Age at move-in in years"]', "5");
  ok("assumption change updates illustration without changing claimed amount",()=>{assert.match(document.querySelector('[data-testid="replacement-illustration"]')!.textContent!,/£75.00/);assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Proposed amount in pounds"]')!.value,"480");});
  await response("discuss");
  ok("selected response changes claim and sidebar totals",()=>{assert.ok(document.querySelector<HTMLInputElement>('input[value=discuss]')!.checked);assert.match(document.querySelector('[data-testid="case-summary"]')!.textContent!,/Questioned£430.00For discussion£480.00/);});
  await click("oven");await response("omit");await click("carpet");
  ok("responses survive claim navigation and omission updates totals",()=>{assert.ok(document.querySelector<HTMLInputElement>('input[value=discuss]')!.checked);assert.match(document.querySelector('[data-testid="case-summary"]')!.textContent!,/Questioned£350.00For discussion£480.00/);});
  await click("Preview response draft");
  ok("current draft reflects human choices and omits excluded claim",()=>{const draft=document.querySelector("#case-current-reply")!.textContent!;assert.match(draft,/willing to discuss/);assert.match(draft,/CORRECTED REVIEW NOTE/);assert.doesNotMatch(draft,/Clean oven/);assert.match(draft,/No amount is agreed/);});
  const realFetch = globalThis.fetch; globalThis.fetch = async () => { throw new Error("SAMPLE LOAD FAILURE"); };
  await click("Export current evidence bundle");
  ok("failed sample download retains the case and re-enables export",()=>{assert.match(text(),/SAMPLE LOAD FAILURE/);assert.equal(downloads,0);assert.equal(button("Export current evidence bundle").disabled,false);});
  globalThis.fetch = realFetch;
  confirm=false;await click("Start a private case");
  ok("cancelling destructive mode change preserves draft state",()=>assert.ok(text().includes("The evaluation disagrees")));
  confirm=true;await click("Start a private case");
  ok("confirmed private mode starts empty and drops sample model output",()=>{assert.match(text(),/manual evidence organiser/);assert.doesNotMatch(text(),/Recorded AI suggestion/);assert.equal(document.querySelectorAll("img").length,0);assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Room"]')!.value,"");});
  await click("+ Add a deduction");
  ok("adding private claim creates independent blank claim",()=>{assert.equal(document.querySelectorAll('button[aria-pressed]').length,2);assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Item"]')!.value,"");});
  await response("omit");await click("01");await response("omit");
  ok("all omitted blocks export",()=>assert.ok(button("Export current evidence bundle").disabled));
  await response("question");await toggleTracker();await selectStatus("Move-in records","provided");await selectStatus("Itemised cost evidence","requested");
  await click("Export current evidence bundle");
  ok("private export prepares a download with no image fetch",()=>{assert.equal(downloads,1);assert.equal(filename,"fair-wear-my-evidence.html");assert.match(text(),/Nothing was sent/);});
  assert.ok(blob);const html=await blob.text();
  ok("export has one included item and accurate manual-only provenance",()=>{assert.match(html,/1 included item\(s\).*1 omitted item\(s\)/);assert.match(html,/were not uploaded or analysed by AI/);assert.doesNotMatch(html,/Original verdict/);});
  ok("download contains current reviewer statuses without storing them",()=>{assert.match(html,/Reviewer evidence checklist/);assert.match(html,/Move-in records: <b>Provided/);assert.match(html,/Itemised cost evidence: <b>Requested/);assert.equal(dom.window.localStorage.length,0);assert.equal(dom.window.sessionStorage.length,0);});
  await act(async()=>root.unmount());
  globalThis.setTimeout = realTimeout;
  console.log(`Passed ${checks} case-builder DOM checks. Native APIs are mocked.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
