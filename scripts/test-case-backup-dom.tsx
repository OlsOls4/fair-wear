// DOM tests mock browser file selection/download; they do not establish native picker or visual behavior.
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { sampleCaseItems, emptyCaseItem, type CaseDocument } from "../lib/case-builder";
import { demoFindings } from "../lib/demo";
import { serializeCaseBackup, parseCaseBackup, MAX_BACKUP_BYTES } from "../lib/case-backup";
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module: { exports: unknown }) => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_target, name) => String(name) }) }; };
async function main() {
  const { default: CaseBuilder } = await import("../components/CaseBuilder");
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: "http://localhost/case-builder" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, React, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(globalThis,"navigator",{ configurable:true, value:dom.window.navigator });
  // @ts-expect-error The React DOM runtime is installed; optional declarations are not required.
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  let blob: Blob | undefined, downloads = 0, confirmation = true, confirms = 0, network = 0, confirmationText = "";
  const realFetch = globalThis.fetch, realTimeout = globalThis.setTimeout;
  globalThis.fetch = async () => { network++; throw new Error("Network forbidden"); };
  globalThis.setTimeout = ((fn: () => void, ms?: number) => realTimeout(fn, ms === 30_000 ? 0 : ms)) as typeof setTimeout;
  URL.createObjectURL = (value: Blob) => { blob = value; return "blob:local"; }; URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function () { downloads++; assert.equal(this.download,"fair-wear-private-case.fairwear.json"); };
  dom.window.confirm = (message) => { confirmationText = String(message); confirms++; return confirmation; };
  function button(label: string) { const found = [...document.querySelectorAll("button")].find(el => el.textContent?.includes(label)); assert.ok(found,label); return found; }
  async function click(label: string) { await act(async () => button(label).click()); }
  function field() { return document.querySelector<HTMLInputElement>('[aria-label="Item"]')!; }
  function chooser() { return document.querySelector<HTMLInputElement>('[aria-label="Reopen private case backup"]')!; }
  async function load(source: string | null, size?: number, reader?: () => Promise<string>) {
    Object.defineProperty(chooser(), "files", { configurable: true, value: source === null ? [] : [{ size: size ?? source.length, text: reader ?? (async () => source) }] });
    await act(async () => chooser().dispatchEvent(new dom.window.Event("change", { bubbles: true })));
  }
  let checks=0; function check(name:string, fn:()=>void) { fn(); checks++; console.log(`ok ${name}`); }
  const fixture: CaseDocument = { mode: "personal", title: "Restored review", photoContext: "other", items: [{...emptyCaseItem("claim-1"), item:"Recovered carpet", claimPounds:"80", note:"Kept note", evidenceChecklist:{cost:"requested"}}, {...emptyCaseItem("claim-2"), item:"Omitted chair", response:"omit"}] };
  const source = serializeCaseBackup(fixture);
  await act(async () => root.render(<CaseBuilder sampleItems={sampleCaseItems(demoFindings)} />));
  check("backup is distinct from read-only evidence and saving unavailable for sample", () => { assert.match(document.body.textContent!,/not encrypted/); assert.match(document.body.textContent!,/HTML above is read-only/); assert.ok(![...document.querySelectorAll("button")].some(el => el.textContent?.includes("Save editable backup"))); });
  await load(source);
  check("reopen clean sample loads private case without confirmation or model output", () => { assert.equal(confirms,0); assert.equal(field().value,"Recovered carpet"); assert.doesNotMatch(document.body.textContent!,/Recorded AI suggestion/); assert.equal(document.querySelector<HTMLSelectElement>('[aria-label="Photo labels for this case"]')!.value,"other"); });
  await click("Save editable backup");
  check("save produces reimportable full private backup", () => { assert.equal(downloads,1); assert.ok(blob); });
  assert.deepEqual(parseCaseBackup(await blob!.text()), fixture);
  await click("Add a deduction");
  check("adding after restore cannot collide with existing ids", () => assert.equal(document.querySelector<HTMLInputElement>('input[type="radio"]')!.name,"response-claim-3"));
  confirmation=false; await load(source);
  check("cancelled replacement retains current case", () => { assert.match(confirmationText, /Save an editable backup/); assert.equal(field().value,""); assert.match(document.body.textContent!,/Reopening cancelled/); });
  confirmation=true; await load("<html>not JSON</html>");
  check("invalid file never replaces case or asks for confirmation", () => { assert.equal(confirms,1); assert.equal(field().value,""); assert.match(document.body.textContent!,/not a supported/); });
  let read=false; await load(source, MAX_BACKUP_BYTES+1, async()=>{read=true;return source;});
  check("oversized file rejected before reading", () => { assert.equal(read,false); assert.match(document.body.textContent!,/up to 32 MB/); });
  await load(source, source.length, async()=>{throw new Error("File no longer readable");});
  check("file read failure preserves case and unlocks controls", () => { assert.equal(field().value,""); assert.equal(chooser().disabled,false); assert.match(document.body.textContent!,/File no longer readable/); });
  await load(null);
  check("cancelled native picker leaves state unchanged", () => assert.equal(field().value,""));
  await load(source); await load(source);
  check("same backup can be reopened repeatedly", () => { assert.equal(field().value,"Recovered carpet"); assert.equal(confirms,3); });
  const malformed = JSON.parse(source); malformed.case.items[0].before = { origin:"local", src:"data:image/jpeg;base64,/9j/wAAICAABAAEA/9k=" };
  class BrokenImage { onload: (()=>void) | null = null; onerror: (()=>void) | null = null; set src(value:string) { if (value) queueMicrotask(()=>this.onerror?.()); } }
  Object.assign(globalThis,{ Image: BrokenImage });
  await load(JSON.stringify(malformed));
  check("undecodable JPEG preserves existing case and does not confirm replacement", () => { assert.equal(field().value,"Recovered carpet"); assert.match(document.body.textContent!,/could not be decoded safely/); assert.equal(confirms,3); assert.equal(chooser().disabled,false); });
  let resolveRead!: (value:string)=>void;
  const pending = new Promise<string>(resolve=>{resolveRead=resolve;});
  await load(source,source.length,()=>pending);
  check("editing and import controls disabled while reading",()=>{ assert.equal(chooser().disabled,true); assert.equal(field().disabled,false); assert.equal(field().closest("fieldset")!.disabled,true); assert.equal(button("Add a deduction").disabled,true); assert.equal(button("Save editable backup").disabled,true); });
  await act(async()=>resolveRead(source));
  check("pending read completes and unlocks safely",()=>{assert.equal(chooser().disabled,false);assert.equal(field().value,"Recovered carpet");});
  const validPhoto = `data:image/jpeg;base64,${readFileSync("public/demo/flat/crops/bedroom-move_in-carpet-0.jpg").toString("base64")}`;
  class DecodedImage { naturalWidth=20; naturalHeight=10; onload:(()=>void)|null=null; onerror:(()=>void)|null=null; set src(value:string) { if(value) queueMicrotask(()=>this.onload?.()); } }
  Object.assign(globalThis,{Image:DecodedImage});
  dom.window.HTMLCanvasElement.prototype.getContext = (()=>({fillRect(){},drawImage(){},fillStyle:""})) as any;
  dom.window.HTMLCanvasElement.prototype.toDataURL = ()=>validPhoto;
  const withPhoto=JSON.parse(source);withPhoto.case.items[1].before={origin:"local",src:validPhoto,sha256:"a".repeat(64)};
  await load(JSON.stringify(withPhoto));await click("Save editable backup");
  check("omitted photo decoded and re-encoded before restoring",()=>assert.equal(downloads,2));
  assert.equal(parseCaseBackup(await blob!.text()).items[1].before!.sha256,"a".repeat(64));
  check("save and reopen use no network or persistent storage", () => { assert.equal(network,0); assert.equal(dom.window.localStorage.length,0); assert.equal(dom.window.sessionStorage.length,0); });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  confirmation = false; await click("Remove this deduction"); await click("Save editable backup");
  const afterCancelledRemoval = parseCaseBackup(await blob!.text());
  check("cancelled removal after restore preserves both backed-up deductions", () => { assert.equal(afterCancelledRemoval.items.length, 2); assert.equal(afterCancelledRemoval.items[0].note, "Kept note"); });
  confirmation = true; await click("Remove this deduction"); await click("Save editable backup");
  const afterRemoval = parseCaseBackup(await blob!.text());
  check("removing restored deduction excludes its note and preserves other item's photo in next backup", () => {
    assert.equal(afterRemoval.items.length, 1); assert.equal(afterRemoval.items[0].item, "Omitted chair");
    assert.equal(afterRemoval.items[0].before?.sha256, "a".repeat(64));
    assert.equal(afterRemoval.items.some(item => item.note === "Kept note"), false);
  });
  await click("Remove this deduction"); await click("Save editable backup");
  const blankAfterRemoval = parseCaseBackup(await blob!.text());
  check("removing last restored item creates a valid blank backup", () => {
    assert.equal(blankAfterRemoval.items.length, 1); assert.equal(blankAfterRemoval.items[0].item, "");
    assert.equal(blankAfterRemoval.items[0].before, undefined);
  });
  await click("Return to example");
  await act(async () => document.querySelector<HTMLInputElement>('input[type=radio][value=discuss]')!.click());
  confirmation = false; await load(source);
  check("dirty sample replacement explains read-only export instead of promising editable backup", () => {
    assert.match(confirmationText, /read-only copy/); assert.match(confirmationText, /cannot be saved as editable backups/);
    assert.doesNotMatch(confirmationText, /Save an editable backup of your current work/);
    assert.match(document.body.textContent!, /Recorded AI suggestion/);
  });
  await act(async()=>root.unmount()); dom.window.close(); globalThis.fetch=realFetch; globalThis.setTimeout=realTimeout;
  console.log(`${checks} private backup DOM checks passed`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
