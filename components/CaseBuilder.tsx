"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildCaseHtml, caseReply, caseTotals, emptyCaseItem, moneyPence, pounds, replacementIllustration, RESPONSE_LABELS, type CaseDocument, type CaseItem, type CaseMode, type CaseResponse, type CostType } from "@/lib/case-builder";
import { embedCaseImages, localCaseImage } from "@/lib/case-images";
import styles from "./CaseBuilder.module.css";
import { confidenceLabel } from "@/lib/findings";

function Arrow({ down = false }: { down?: boolean }) { return <span aria-hidden="true">{down ? "↓" : "↗"}</span>; }
export default function CaseBuilder({ sampleItems }: { sampleItems: CaseItem[] }) {
  const [mode, setMode] = useState<CaseMode>("sample");
  const [title, setTitle] = useState("Demo flat: proposed deposit deductions");
  const [items, setItems] = useState<CaseItem[]>(sampleItems);
  const [selectedId, setSelectedId] = useState(sampleItems[0].id);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const nextId = useRef(1);
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const document: CaseDocument = useMemo(() => ({ mode, title, items }), [mode, title, items]);
  const totals = caseTotals(items), illustration = replacementIllustration(selected);
  const draft = caseReply(document);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function patch(id: string, values: Partial<CaseItem>) {
    setItems((items) => items.map((item) => item.id === id ? { ...item, ...values } : item)); setDirty(true); setStatus("");
  }
  function changeMode(next: CaseMode) {
    if (next === mode) return;
    if (dirty && !window.confirm("Start a different case? Changes on this page will be cleared. Export your current case first if you want to keep it.")) return;
    const nextItems = next === "sample" ? sampleItems : [emptyCaseItem(`claim-${nextId.current++}`)];
    setItems(nextItems); setSelectedId(nextItems[0].id); setMode(next); setTitle(next === "sample" ? "Demo flat: proposed deposit deductions" : "My proposed deposit deductions"); setDirty(false); setStatus(""); setShowReply(false);
  }
  function addItem() {
    if (items.length >= 12) return;
    const next = emptyCaseItem(`claim-${nextId.current++}`);
    setItems((items) => [...items, next]); setSelectedId(next.id); setDirty(true); setStatus("");
  }
  async function choosePhoto(event: React.ChangeEvent<HTMLInputElement>, visit: "before" | "after") {
    const file = event.target.files?.[0], id = selected.id; event.target.value = "";
    if (!file) return;
    setBusy(true); setStatus("Preparing a display copy locally. Nothing is uploading.");
    try { const image = await localCaseImage(file); patch(id, { [visit]: image }); setStatus("Photo ready. It stays in this browser tab until you export or leave."); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Could not prepare this photo."); }
    finally { setBusy(false); }
  }
  async function exportBundle() {
    setBusy(true); setStatus("Preparing your current response and evidence images…");
    try {
      const embedded = await embedCaseImages(document);
      const html = buildCaseHtml(embedded);
      const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      const link = window.document.createElement("a"); link.href = url; link.download = mode === "sample" ? "fair-wear-demo-evidence.html" : "fair-wear-my-evidence.html";
      window.document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setStatus("Evidence bundle prepared for download. Open the HTML file, review it, then use Print → Save as PDF if needed. Nothing was sent.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "The bundle could not be prepared. Your work is still on this page."); }
    finally { setBusy(false); }
  }
  const amountInvalid = selected.claimPounds.trim() !== "" && moneyPence(selected.claimPounds) === null;
  return <main id="main-content" className={styles.page}>
    <header className={styles.hero}><div><p className={styles.kicker}>YOUR EVIDENCE. YOUR RESPONSE.</p><h1>A deduction is a claim.<br /><em>Build your response.</em></h1><p className={styles.lede}>Connect each proposed charge to the evidence, record what you question, and take away a bundle that reflects your choices.</p></div><div className={styles.privacy}><span className={styles.privacyIcon} aria-hidden="true">⌂</span><b>Private by design</b><p>Your photos and notes stay in this browser tab. No uploads, no model calls, no account.</p><span>Export before leaving: nothing is saved automatically.</span></div></header>
    <section className={styles.modeBar} aria-label="Choose sample or private case"><div><b>{mode === "sample" ? "A fictional demand. Real recorded model outputs." : "Your case, kept in this tab."}</b><p>{mode === "sample" ? "Try three example deductions. The photos are generated; the £910 demand is invented for this demonstration." : "Add your own claim details and photos. This is a manual evidence organiser; it does not analyse or classify your files."}</p></div><button className={styles.secondary} disabled={busy} onClick={() => changeMode(mode === "sample" ? "personal" : "sample")}>{mode === "sample" ? "Start a private case" : "Return to example"} <Arrow /></button></section>
    <div className={styles.workspace}>
      <aside className={styles.sidebar} aria-label="Your deduction list"><div className={styles.sectionLabel}><span>01 / DEDUCTIONS</span><b>{items.length}</b></div><div className={styles.claims}>
        {items.map((item, index) => <button key={item.id} disabled={busy} className={`${styles.claim} ${selected.id === item.id ? styles.claimSelected : ""}`} aria-pressed={selected.id === item.id} onClick={() => { setSelectedId(item.id); setStatus(""); }}><span className={styles.claimNumber}>{String(index + 1).padStart(2, "0")}</span><span><b>{item.item || "New deduction"}</b><small>{item.room || "Add a room"}</small><span className={styles.claimState}>{RESPONSE_LABELS[item.response]}</span></span><strong>{moneyPence(item.claimPounds) === null ? "£—" : pounds(moneyPence(item.claimPounds)!)}</strong></button>)}
      </div>{mode === "personal" && <button className={styles.addButton} disabled={busy || items.length >= 12} onClick={addItem}>+ Add a deduction {items.length >= 12 ? "(12-item limit)" : ""}</button>}
      <div className={styles.summary} data-testid="case-summary"><span className={styles.sectionLabel}>YOUR RESPONSE TOTALS</span><p><span>Questioned</span><strong>{pounds(totals.question)}</strong></p><p><span>For discussion</span><strong>{pounds(totals.discuss)}</strong></p><small>{totals.unknown ? `${totals.unknown} included amount(s) unknown or invalid. ` : ""}{totals.omitted ? `${totals.omitted} item(s) left out. ` : ""}Sums of proposed deductions, not savings, accepted charges or liability.</small></div>
      </aside>
      <section className={styles.editor} aria-label="Review selected deduction">
        <div className={styles.sectionLabel}><span>02 / EVIDENCE & RESPONSE</span><span>{mode === "sample" ? "GENERATED SAMPLE IMAGERY" : "MANUAL REVIEW"}</span></div>
        <div className={styles.itemHeading}><h2>{selected.item || "Add a proposed deduction"}</h2><span>{selected.room.replaceAll("-", " ")}</span></div>
        <fieldset disabled={busy} className={styles.fields}><legend className={styles.srOnly}>Claim details</legend>
          <div className={styles.fieldRow}><label>Room<input aria-label="Room" value={selected.room} maxLength={100} onChange={(e) => patch(selected.id, { room: e.target.value })} placeholder="e.g. Bedroom" /></label><label>Item<input aria-label="Item" value={selected.item} maxLength={100} onChange={(e) => patch(selected.id, { item: e.target.value })} placeholder="e.g. Carpet" /></label><label>Proposed amount (£)<input aria-label="Proposed amount in pounds" inputMode="decimal" value={selected.claimPounds} aria-invalid={amountInvalid} aria-describedby={amountInvalid ? "amount-error" : undefined} maxLength={15} onChange={(e) => patch(selected.id, { claimPounds: e.target.value })} placeholder="Unknown" /></label></div>
          {amountInvalid && <p id="amount-error" className={styles.error}>Enter a non-negative amount with at most two decimal places, up to £1,000,000. This amount is excluded from totals until valid.</p>}
          <label>What is being claimed?<input value={selected.claimDescription} maxLength={500} onChange={(e) => patch(selected.id, { claimDescription: e.target.value })} placeholder="Use the wording from the deduction list" /></label>
        </fieldset>
        <div className={styles.photos}>{(["before", "after"] as const).map((visit) => <figure key={visit}><div className={styles.photoLabel}><b>{visit === "before" ? "Move-in" : "Move-out"}</b><span>{selected[visit]?.origin === "sample" ? "Generated scene" : selected[visit] ? "Local photo" : "Not provided"}</span></div>{selected[visit] ? <img src={selected[visit]!.src} alt={`${visit === "before" ? "Move-in" : "Move-out"} evidence for ${selected.room} ${selected.item}`} /> : <div className={styles.emptyPhoto}><span aria-hidden="true">+</span><b>Add the comparison photo</b><small>JPEG, PNG or WebP · up to 8 MB</small></div>}{mode === "personal" && <label className={styles.fileLabel}>{selected[visit] ? "Replace photo" : "Choose photo"}<input type="file" aria-label={`${visit === "before" ? "Move-in" : "Move-out"} photo`} accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => choosePhoto(e, visit)} /></label>}</figure>)}</div>
        {selected.model && <details className={styles.modelNote} open={!!selected.model.evaluationNote}><summary>Recorded AI suggestion: {selected.model.verdict.replaceAll("_", " ")} <span>{`${confidenceLabel(selected.model.confidence)} model confidence`}</span></summary><p>{selected.model.description}</p>{selected.model.evaluationNote && <p className={styles.knownError}><b>The evaluation disagrees.</b> {selected.model.evaluationNote}</p>}<small>Muse Image made these test scenes. SAM 3.1 selected the object crops; Muse Spark assessed them in a previous offline run. Confidence is uncalibrated. This original suggestion stays unchanged when you edit your response.</small></details>}
        <fieldset disabled={busy} className={styles.response}><legend>Your response</legend><div className={styles.responseOptions}>{(["question", "discuss", "omit"] as CaseResponse[]).map((value) => <label className={selected.response === value ? styles.optionSelected : ""} key={value}><input type="radio" name={`response-${selected.id}`} value={value} checked={selected.response === value} onChange={() => patch(selected.id, { response: value })} /><span>{RESPONSE_LABELS[value]}</span></label>)}</div><p>These are draft positions. No option accepts a charge. “Leave out” excludes this item and its photos from the exported response.</p><label className={styles.noteLabel}>What should your response say?<textarea value={selected.note} maxLength={5000} rows={3} onChange={(e) => patch(selected.id, { note: e.target.value })} placeholder={mode === "sample" ? "For example: the planted test change was ordinary carpet wear. Please explain why replacement is proposed." : "Add what you observed, any context, and what evidence you want to see."} /></label></fieldset>
        <details className={styles.assumptions}><summary>Explore cost assumptions <span>Optional, never inferred by AI</span></summary><fieldset disabled={busy} className={styles.fields}><legend className={styles.srOnly}>Cost assumptions</legend><label>Type of proposed cost<select value={selected.costType} aria-label="Type of proposed cost" onChange={(e) => patch(selected.id, { costType: e.target.value as CostType })}><option value="unknown">Not specified</option><option value="replacement">Replacement</option><option value="repair">Repair</option><option value="cleaning">Cleaning</option></select></label>{selected.costType === "replacement" ? <><p>Try a simple remaining-value calculation with your own assumptions. No age, lifespan or quality is filled in from an item label.</p><div className={styles.fieldRow}><label>Replacement cost (£)<input aria-label="Replacement cost in pounds" inputMode="decimal" value={selected.replacementCost} maxLength={15} onChange={(e) => patch(selected.id, { replacementCost: e.target.value })} placeholder="Unknown" /></label><label>Age at move-in (years)<input aria-label="Age at move-in in years" inputMode="decimal" value={selected.ageAtMoveIn} maxLength={8} onChange={(e) => patch(selected.id, { ageAtMoveIn: e.target.value })} placeholder="Unknown" /></label></div><div className={styles.fieldRow}><label>Tenancy length (years)<input aria-label="Tenancy length in years" inputMode="decimal" value={selected.tenancyYears} maxLength={8} onChange={(e) => patch(selected.id, { tenancyYears: e.target.value })} placeholder="Unknown" /></label><label>Expected useful life (years)<input aria-label="Expected useful life in years" inputMode="decimal" value={selected.usefulLife} maxLength={8} onChange={(e) => patch(selected.id, { usefulLife: e.target.value })} placeholder="Unknown" /></label></div><label>Quality and starting-condition basis<input value={selected.qualityBasis} aria-label="Quality and starting-condition basis" maxLength={500} onChange={(e) => patch(selected.id, { qualityBasis: e.target.value })} placeholder="e.g. invoice, inventory or an explicitly unverified assumption" /></label><div className={styles.calculation} role="status" data-testid="replacement-illustration">{illustration.status === "illustrative" ? <><span>Remaining-value illustration</span><strong>{pounds(illustration.remainingPence)}</strong><p>{pounds(illustration.costPence)} × max(0, 1 − ({illustration.age} + {illustration.tenancy}) ÷ {illustration.life})</p><small>Unverified assumptions, not a suggested settlement or tenant liability. This does not change your claimed amount, response or totals.</small></> : <p>No estimate yet. {illustration.status === "needs_inputs" ? `Supply: ${illustration.missing.join(", ")}.` : ""}</p>}</div></> : <p>No replacement-life calculation applies to this selection. Evidence of cost, cause and responsibility still needs review.</p>}</fieldset></details>
      </section>
    </div>
    <section className={styles.export} aria-label="Prepare current evidence bundle"><div><p className={styles.kicker}>03 / TAKE YOUR REVIEW WITH YOU</p><h2>Your choices, carried through.</h2><p>The bundle contains your current response, claim amounts and side-by-side photos. Original model suggestions remain separately labelled.</p><label>Bundle title<input value={title} maxLength={200} disabled={busy} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} /></label></div><div className={styles.exportActions}><button className={styles.primary} onClick={exportBundle} disabled={busy || !totals.included}>{busy ? "Preparing…" : "Export current evidence bundle"} <Arrow down /></button><button className={styles.secondary} aria-expanded={showReply} aria-controls="case-current-reply" onClick={() => setShowReply(!showReply)}>{showReply ? "Hide" : "Preview"} response draft</button><small>A self-contained HTML file. Open it and use Print → Save as PDF. Nothing is sent. Check photos and notes for personal information before sharing.</small>{!totals.included && <small>Add at least one included item to export.</small>}</div></section>
    <p role="status" className={styles.status}>{status}</p>
    {showReply && <section id="case-current-reply" className={styles.draft}><h2>Current draft, not sent</h2><pre>{draft}</pre></section>}
    <footer className={styles.footer}><p>Fair Wear is a prototype for organising evidence. Photos alone do not establish age, cause or responsibility. This is not legal advice.</p><p>{mode === "sample" ? "Generated test images · Real recorded model outputs · Fictional proposed amounts" : "No uploads · No AI analysis of personal files · Keep your originals separately"}</p></footer>
  </main>;
}
