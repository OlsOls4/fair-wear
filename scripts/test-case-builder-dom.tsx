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
  const caseImages = require("../lib/case-images");
  const caseImagesModule = require.cache[require.resolve("../lib/case-images")]!;
  caseImagesModule.exports = { ...caseImages, localCaseImage: async (file: File) => ({ src: `data:image/jpeg;base64,${file.name === "before.jpg" ? "QUFB" : "QkJC"}`, origin: "local", sha256: file.name }) };
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
  ok("non-blocking guidance has a named heading and safe explicit external links",()=>{
    const panel=document.querySelector('[aria-labelledby="renter-guidance-heading"]')!;
    assert.ok(panel);assert.equal(panel.querySelector('h2')!.id,"renter-guidance-heading");
    assert.match(panel.textContent!,/does not raise a dispute or extend a deadline/);
    assert.equal(panel.querySelectorAll('input,button,select').length,0);
    const links=Array.from(panel.querySelectorAll('a'));assert.equal(links.length,6);
    const wales=links.find(link=>link.textContent?.startsWith("Wales:"));assert.equal(wales?.href,"https://www.gov.wales/deposits-guidance-tenants");
    assert.ok(links.some(link=>link.textContent?.startsWith("England:")));assert.doesNotMatch(panel.textContent!,/England and Wales:/);
    for(const link of links){assert.equal(link.target,"_blank");assert.equal(link.rel,"noopener noreferrer");assert.match(link.textContent!,/opens in a new tab/);assert.ok(link.href.startsWith("https://"));}
  });
  ok("export action exposes the process warning before any download",()=>{
    const exportButton=button("Export current evidence bundle");
    assert.equal(exportButton.getAttribute("aria-describedby"),"export-process-warning");
    const warning=document.getElementById("export-process-warning")!;
    assert.match(warning.textContent!,/Check your scheme's process and deadlines promptly/);
    assert.match(warning.textContent!,/does not raise a dispute or extend a deadline/);
    assert.equal(warning.parentElement,exportButton.parentElement);
    assert.equal(warning.nextElementSibling,exportButton);
    assert.ok(document.querySelector('[aria-labelledby="renter-guidance-heading"]'));
  });
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
  async function choosePhoto(label: string, name: string) {
    const el = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    Object.defineProperty(el, "files", { configurable: true, value: [new dom.window.File(["mock pixels"], name, { type: "image/jpeg" })] });
    await act(async () => el.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
  }
  async function removePhoto(label: string) {
    const el = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    assert.ok(el); await act(async () => el.click());
  }
  await input('[aria-label="Item"]', "Private carpet");
  await input('[aria-label="Proposed amount in pounds"]', "72");
  await input('textarea', "Keep my note");
  await toggleTracker(); await selectStatus("Move-in records", "provided");
  await choosePhoto("Move-in photo", "before.jpg"); await choosePhoto("Move-out photo", "after.jpg");
  ok("personal local images expose separately labelled removal controls", () => {
    assert.ok(document.querySelector('[aria-label="Remove Move-in photo"]'));
    assert.ok(document.querySelector('[aria-label="Remove Move-out photo"]'));
    assert.equal(document.querySelectorAll("img").length, 2);
  });
  await removePhoto("Remove Move-in photo");
  ok("removal clears only selected image and returns focus to its chooser", () => {
    assert.equal(document.querySelectorAll("img").length, 1);
    assert.match(document.querySelector("img")!.src, /QkJC$/);
    assert.equal(document.querySelector('[aria-label="Remove Move-in photo"]'), null);
    assert.equal(document.activeElement?.getAttribute("aria-label"), "Move-in photo");
    assert.match(text(), /Move-in photo removed/);
    assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Item"]')!.value, "Private carpet");
    assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Proposed amount in pounds"]')!.value, "72");
    assert.equal(document.querySelector<HTMLTextAreaElement>('textarea')!.value, "Keep my note");
    assert.equal(document.querySelector<HTMLSelectElement>('[aria-label="Move-in records status"]')!.value, "provided");
  });
  await click("Export current evidence bundle");
  const onePhotoHtml = await blob!.text();
  ok("export excludes removed image and fingerprint but retains other photo", () => {
    assert.doesNotMatch(onePhotoHtml, /QUFB|before\.jpg/);
    assert.match(onePhotoHtml, /QkJC/); assert.match(onePhotoHtml, /Move-in photo not provided/);
  });
  await choosePhoto("Move-in photo", "before.jpg");
  ok("removed photo can be selected again", () => assert.equal(document.querySelectorAll("img").length, 2));
  await removePhoto("Remove Move-in photo"); await removePhoto("Remove Move-out photo");
  await click("Preview response draft");
  ok("removing both photos updates draft provenance", () => assert.match(document.querySelector("#case-current-reply")!.textContent!, /No photos are included/));
  await click("Hide response draft");
  await click("Return to example");
  ok("sample images cannot be removed", () => assert.equal(document.querySelector('button[aria-label^="Remove "]'), null));
  await click("Start a private case");
  downloads = 0;
  async function selectPhotoContext(value:string){const el=document.querySelector<HTMLSelectElement>('[aria-label="Photo labels for this case"]')!;await act(async()=>{el.value=value;el.dispatchEvent(new dom.window.Event("change",{bubbles:true}));});}
  ok("private case defaults to tenancy photo labels",()=>assert.ok(document.querySelector('[aria-label="Move-in photo"]')));
  await selectPhotoContext("other");
  await choosePhoto("Before photo", "before.jpg");
  ok("removal label follows other photo context", () => assert.ok(document.querySelector('[aria-label="Remove Before photo"]')));
  await removePhoto("Remove Before photo");
  ok("other-context removal uses current labels in announcement and focus", () => {
    assert.match(text(), /Before photo removed/);
    assert.equal(document.activeElement?.getAttribute("aria-label"), "Before photo");
  });
  ok("other comparison updates both upload labels with unverified timing",()=>{assert.ok(document.querySelector('[aria-label="Before photo"]'));assert.ok(document.querySelector('[aria-label="After photo"]'));assert.equal(document.querySelector('[aria-label="Move-in photo"]'),null);assert.match(text(),/timing is unverified/);});
  confirm=false;await click("Return to example");
  ok("cancelled mode change preserves photo context",()=>assert.equal(document.querySelector<HTMLSelectElement>('[aria-label="Photo labels for this case"]')!.value,"other"));
  confirm=true;
  await selectPhotoContext("tenancy");await selectPhotoContext("other");
  await click("+ Add a deduction");
  ok("adding private claim creates independent blank claim",()=>{assert.ok(document.querySelector('[aria-label="Before photo"]'));assert.equal(document.querySelectorAll('button[aria-pressed]').length,2);assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Item"]')!.value,"");});
  await response("omit");await click("01");await response("omit");
  ok("all omitted blocks export",()=>assert.ok(button("Export current evidence bundle").disabled));
  await response("question");await toggleTracker();await selectStatus("Move-in records","provided");await selectStatus("Itemised cost evidence","requested");
  await input('[aria-label="Proposed amount in pounds"]',"35");
  await input('textarea',"Reviewer comparison note");
  await selectPhotoContext("tenancy");await selectPhotoContext("other");
  ok("case-wide relabeling preserves review response, evidence status, amount and note",()=>{
    assert.equal(document.querySelector<HTMLInputElement>('input[type=radio]:checked')!.value,"question");
    assert.equal(document.querySelector<HTMLSelectElement>('[aria-label="Move-in records status"]')!.value,"provided");
    assert.equal(document.querySelector<HTMLSelectElement>('[aria-label="Itemised cost evidence status"]')!.value,"requested");
    assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Proposed amount in pounds"]')!.value,"35");
    assert.equal(document.querySelector<HTMLTextAreaElement>('textarea')!.value,"Reviewer comparison note");
  });
  await click("Export current evidence bundle");
  ok("private export prepares a download with no image fetch",()=>{assert.equal(downloads,1);assert.equal(filename,"fair-wear-my-evidence.html");assert.match(text(),/Nothing was sent/);});
  assert.ok(blob);const html=await blob.text();
  ok("export has one included item and accurate manual-only provenance",()=>{assert.match(html,/1 included item\(s\).*1 omitted item\(s\)/);assert.match(html,/No photos are included and no AI analysis was performed/);assert.doesNotMatch(html,/Original verdict/);});
  ok("download contains current reviewer statuses without storing them",()=>{assert.match(html,/Reviewer evidence checklist/);assert.match(html,/Move-in records: <b>Provided/);assert.match(html,/Itemised cost evidence: <b>Requested/);assert.equal(dom.window.localStorage.length,0);assert.equal(dom.window.sessionStorage.length,0);});
  ok("other comparison persists into downloaded draft and missing-view captions",()=>{assert.match(html,/Before photo not provided/);assert.match(html,/After photo not provided/);assert.match(html,/Before\/After \(other comparison\)/);assert.match(html,/timing is unverified/);});
  await click("Return to example");
  ok("sample hides photo context control and retains original labels",()=>{assert.equal(document.querySelector('[aria-label="Photo labels for this case"]'),null);assert.match(document.querySelector("img")!.alt,/Move-in evidence/);});
  await click("Start a private case");
  ok("new private case resets context and does not restore prior fields",()=>{assert.equal(document.querySelector<HTMLSelectElement>('[aria-label="Photo labels for this case"]')!.value,"tenancy");assert.ok(document.querySelector('[aria-label="Move-in photo"]'));assert.equal(dom.window.sessionStorage.length,0);});
  await act(async()=>root.unmount());
  caseImagesModule.exports = caseImages;
  globalThis.setTimeout = realTimeout;
  console.log(`Passed ${checks} case-builder DOM checks. Native APIs are mocked.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
