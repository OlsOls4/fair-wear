"use client";
import ArrowIcon from "@/components/ArrowIcon";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildCaseHtml, casePhotoLabels, casePhotoContextNote, caseReply, caseTotals, emptyCaseItem, moneyPence, pounds, replacementIllustration, RESPONSE_LABELS, sampleReviewDescription, type CaseDocument, type CaseItem, type CaseMode, type CaseResponse, type CostType, type PhotoContext } from "@/lib/case-builder";
import { applySampleCaseTransfer, SAMPLE_CASE_TRANSFER_SOURCE, takeSampleCaseTransfer } from "@/lib/sample-case-transfer";
import { embedCaseImages, localCaseImage } from "@/lib/case-images";
import { evidenceRows, evidenceRequests, EVIDENCE_DISCLAIMER, EVIDENCE_STATUS_LABELS, type EvidenceStatus } from "@/lib/case-evidence-gaps";
import { prepareBackupImages } from "@/lib/case-backup-images";
import { MAX_BACKUP_BYTES, parseCaseBackup, serializeCaseBackup } from "@/lib/case-backup";
import styles from "./CaseBuilder.module.css";
import { confidenceLabel } from "@/lib/findings";

function Arrow({ down = false }: { down?: boolean }) { return <ArrowIcon direction={down ? "down" : "diagonal"} />; }
export default function CaseBuilder({ sampleItems }: { sampleItems: CaseItem[] }) {
  const [mode, setMode] = useState<CaseMode>("sample");
  const [photoContext, setPhotoContext] = useState<PhotoContext>("tenancy");
  const [title, setTitle] = useState("Demo flat: proposed deposit deductions");
  const [items, setItems] = useState<CaseItem[]>(sampleItems);
  const [selectedId, setSelectedId] = useState(sampleItems[0].id);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [handoffError, setHandoffError] = useState("");
  const [transferredCount, setTransferredCount] = useState<number | null>(null);
  const transferChecked = useRef(false);
  const nextId = useRef(1);
  const editorRef = useRef<HTMLElement>(null);
  const editorHeadingRef = useRef<HTMLHeadingElement>(null);
  const [editorNavigation, setEditorNavigation] = useState(0);
  const removedItemFocus = useRef(false);
  // Explicit list navigation or removal moves focus, never initial load or field edits.
  useEffect(() => {
    if (!editorNavigation) return;
    const afterRemoval = removedItemFocus.current;
    removedItemFocus.current = false;
    if (!afterRemoval && !window.matchMedia?.("(max-width: 740px)").matches) return;
    editorHeadingRef.current?.focus({ preventScroll: true });
    editorRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [editorNavigation]);
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const document: CaseDocument = useMemo(() => ({ mode, title, items, photoContext }), [mode, title, items, photoContext]);
  const totals = caseTotals(items), illustration = replacementIllustration(selected);
  const draft = caseReply(document);
  const photoLabels = casePhotoLabels(document);
  useEffect(() => {
    if (transferChecked.current) return;
    transferChecked.current = true;
    const url = new URL(window.location.href);
    // Ordinary visits and private cases never read or write review-choice storage.
    if (url.searchParams.get("from") !== SAMPLE_CASE_TRANSFER_SOURCE) return;
    const token = url.searchParams.get("transfer");
    url.searchParams.delete("from"); url.searchParams.delete("transfer");
    try {
      window.history.replaceState(window.history.state, "", url);
      const transfer = takeSampleCaseTransfer(window.sessionStorage, token);
      if (!transfer) {
        setHandoffError("The sample handoff is missing, already used or incompatible. No responses were imported. Return to the sample review and choose Continue to case builder again.");
        return;
      }
      const next = applySampleCaseTransfer(sampleItems, transfer);
      const count = next.filter((item) => item.sampleReview).length;
      setItems(next); setTransferredCount(count); setDirty(count > 0);
    } catch {
      setHandoffError("The browser could not load this sample handoff. No sample responses were imported. Your review choices remain on the review page if it is still open.");
    }
  }, [sampleItems]);
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
    setItems(nextItems); setSelectedId(nextItems[0].id); setMode(next); setPhotoContext("tenancy"); setTitle(next === "sample" ? "Demo flat: proposed deposit deductions" : "My proposed deposit deductions"); setDirty(false); setStatus(""); setShowReply(false); setTransferredCount(null); setHandoffError("");
  }
  function resetTransferredCase() {
    if (dirty && !window.confirm("Reset this sample case? Its responses, notes and edited amounts will be cleared. Your saved choices on the sample review will not change.")) return;
    setItems(sampleItems); setSelectedId(sampleItems[0].id); setTitle("Demo flat: proposed deposit deductions"); setDirty(false); setShowReply(false); setTransferredCount(null); setHandoffError(""); setStatus("Sample case reset. Your saved review-board choices are unchanged.");
  }
  function selectItem(id: string) {
    setSelectedId(id); setStatus("");
    setEditorNavigation((request) => request + 1);
  }
  function addItem() {
    if (items.length >= 12) return;
    let id: string;
    do { id = `claim-${nextId.current++}`; } while (items.some((item) => item.id === id));
    const next = emptyCaseItem(id);
    setItems((items) => [...items, next]); selectItem(next.id); setDirty(true);
  }
  function removeSelectedItem() {
    if (mode !== "personal" || busy) return;
    const label = selected.item.trim() || "this deduction";
    if (!window.confirm(`Remove ${label} from this case? Its notes, photos and evidence choices will be cleared from this page. Existing downloads will not change. To keep it for later, cancel and choose “Leave out of response” instead.`)) return;
    const index = items.findIndex((item) => item.id === selected.id);
    const remaining = items.filter((item) => item.id !== selected.id);
    const next = remaining.length ? remaining : [emptyCaseItem(`claim-${nextId.current++}`)];
    setItems(next);
    removedItemFocus.current = true;
    selectItem(next[Math.min(index, next.length - 1)].id);
    setDirty(true);
    setStatus(remaining.length ? "Deduction removed. Your other deductions are unchanged. Existing downloads have not changed." : "Deduction removed. A new blank deduction is ready. Existing downloads have not changed.");
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
  function saveBackup() {
    setBusy(true);
    try {
      const source = serializeCaseBackup(document);
      const url = URL.createObjectURL(new Blob([source], { type: "application/json" }));
      const link = window.document.createElement("a"); link.href = url; link.download = "fair-wear-private-case.fairwear.json";
      window.document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setStatus("Editable backup prepared for download. Check that your browser saved it before leaving. It includes all items, even those left out of your response, and is not encrypted. Keep it private. Nothing was uploaded or sent.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not prepare the backup. Your case is still here."); }
    finally { setBusy(false); }
  }
  async function reopenBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) { setStatus("Choose a Fair Wear JSON backup up to 32 MB. Your current case has not changed."); return; }
    setBusy(true); setStatus("Checking the backup locally. Nothing is uploading.");
    try {
      const validated = parseCaseBackup(await file.text());
      const restored = await prepareBackupImages(validated);
      if (dirty && !window.confirm(mode === "personal"
        ? "Replace the case on this page with this backup? Save an editable backup of your current work first if you want to keep it."
        : "Replace this sample case with the private backup? Export the current evidence bundle first if you want a read-only copy. Edited sample cases cannot be saved as editable backups.")) {
        setStatus("Reopening cancelled. Your current case has not changed."); return;
      }
      setMode("personal"); setTitle(restored.title); setPhotoContext(restored.photoContext!); setItems(restored.items); setSelectedId(restored.items[0].id);
      setDirty(true); setShowReply(false); setTransferredCount(null); setHandoffError("");
      setStatus("Private case reopened locally. Review its contents: a backup can be edited and does not verify photos, dates, notes or responsibility. Save a new backup after further changes. Nothing was uploaded or analysed.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not read this backup. Your current case has not changed."); }
    finally { setBusy(false); }
  }
  const amountInvalid = selected.claimPounds.trim() !== "" && moneyPence(selected.claimPounds) === null;
  return <main id="main-content" className={styles.page}>
    <header className={styles.hero}><div><p className={styles.kicker}>YOUR EVIDENCE. YOUR RESPONSE.</p><h1>A deduction is a claim.<br /><em>Build your response.</em></h1><p className={styles.lede}>Connect each proposed charge to the evidence, record what you question, and take away a bundle that reflects your choices.</p></div><div className={styles.privacy}><span className={styles.privacyIcon} aria-hidden="true">⌂</span><b>Private by design</b><p>Your photos and notes stay in this browser tab. No uploads, no model calls, no account.</p><span>Save a backup or export before leaving. Nothing is saved automatically.</span></div></header>
    <section className={styles.modeBar} aria-label="Choose sample or private case"><div><b>{mode === "sample" ? "A fictional demand. Real recorded model outputs." : "Your case, kept in this tab."}</b><p>{mode === "sample" ? "Try three example deductions. The photos are generated; the £910 demand is invented for this demonstration." : "Add your own claim details and photos. This is a manual evidence organiser; it does not analyse or classify your files."}</p></div><button className={styles.secondary} disabled={busy} onClick={() => changeMode(mode === "sample" ? "personal" : "sample")}>{mode === "sample" ? "Start a private case" : "Return to example"} <Arrow /></button></section>
    {mode === "personal" && <fieldset disabled={busy} className={styles.fields}><legend>Photo context for this case (optional)</legend><label>Photo labels<select aria-label="Photo labels for this case" aria-describedby="photo-context-help" value={photoContext} onChange={(event) => { setPhotoContext(event.target.value as PhotoContext); setDirty(true); setStatus(""); }}><option value="tenancy">Move-in/Move-out (tenancy comparison)</option><option value="other">Before/After (other comparison)</option></select></label><p id="photo-context-help">{casePhotoContextNote(document)} This applies to every photo pair in this case. It only changes photo labels, not evidence checklist statuses, cost assumptions or responses. Keep originals and explain the comparison in your review notes.</p></fieldset>}
    {handoffError && <p role="status" className={styles.status}>{handoffError}</p>}
    {mode === "sample" && transferredCount !== null && <section className={styles.modeBar} aria-label="Sample review handoff" data-testid="sample-review-handoff"><div><b>{transferredCount ? `${transferredCount} selected sample response${transferredCount === 1 ? "" : "s"} carried over.` : "No selected responses matched these three claims."}</b><p>Only bedroom carpet, kitchen oven and bathroom bath are included. Dispute → Question this deduction; Discuss after evidence → Discuss after evidence; Not claimed → Leave out of response. Untouched items start as Question this deduction. These are your starting responses, separate from the original model suggestions. Later edits stay only on this page and do not update the review board.</p><p>Export before leaving or reloading. This one-time handoff does not save the case, photos or notes.</p></div><button className={styles.secondary} disabled={busy} onClick={resetTransferredCase}>Reset example case</button></section>}
    <div className={styles.workspace}>
      <aside className={styles.sidebar} aria-label="Your deduction list"><div className={styles.sectionLabel}><span>01 / DEDUCTIONS</span><b>{items.length}</b></div><div className={styles.claims}>
        {items.map((item, index) => <button key={item.id} disabled={busy} className={`${styles.claim} ${selected.id === item.id ? styles.claimSelected : ""}`} aria-pressed={selected.id === item.id} onClick={() => selectItem(item.id)}><span className={styles.claimNumber}>{String(index + 1).padStart(2, "0")}</span><span><b>{item.item || "New deduction"}</b><small>{item.room || "Add a room"}</small><span className={styles.claimState}>{RESPONSE_LABELS[item.response]}</span></span><strong>{moneyPence(item.claimPounds) === null ? "£—" : pounds(moneyPence(item.claimPounds)!)}</strong></button>)}
      </div>{mode === "personal" && <button className={styles.addButton} disabled={busy || items.length >= 12} onClick={addItem}>+ Add a deduction {items.length >= 12 ? "(12-item limit)" : ""}</button>}
      <div className={styles.summary} data-testid="case-summary"><span className={styles.sectionLabel}>YOUR RESPONSE TOTALS</span><p><span>Questioned</span><strong>{pounds(totals.question)}</strong></p><p><span>For discussion</span><strong>{pounds(totals.discuss)}</strong></p><small>{totals.unknown ? `${totals.unknown} included amount(s) unknown or invalid. ` : ""}{totals.omitted ? `${totals.omitted} item(s) left out. ` : ""}Sums of proposed deductions, not savings, accepted charges or liability.</small></div>
      </aside>
      <section ref={editorRef} className={styles.editor} aria-label="Review selected deduction">
        <div className={styles.sectionLabel}><span>02 / EVIDENCE & RESPONSE</span><span>{mode === "sample" ? "GENERATED SAMPLE IMAGERY" : "MANUAL REVIEW"}</span></div>
        <div className={styles.itemHeading}><h2 ref={editorHeadingRef} tabIndex={-1}>{selected.item || "Add a proposed deduction"}</h2><span>{selected.room.replaceAll("-", " ")}</span></div>
        <fieldset disabled={busy} className={styles.fields}><legend className={styles.srOnly}>Claim details</legend>
          <div className={styles.fieldRow}><label>Room<input aria-label="Room" value={selected.room} maxLength={100} onChange={(e) => patch(selected.id, { room: e.target.value })} placeholder="e.g. Bedroom" /></label><label>Item<input aria-label="Item" value={selected.item} maxLength={100} onChange={(e) => patch(selected.id, { item: e.target.value })} placeholder="e.g. Carpet" /></label><label>Proposed amount (£)<input aria-label="Proposed amount in pounds" inputMode="decimal" value={selected.claimPounds} aria-invalid={amountInvalid} aria-describedby={amountInvalid ? "amount-error" : undefined} maxLength={15} onChange={(e) => patch(selected.id, { claimPounds: e.target.value })} placeholder="Unknown" /></label></div>
          {amountInvalid && <p id="amount-error" className={styles.error}>Enter a non-negative amount with at most two decimal places, up to £1,000,000. This amount is excluded from totals until valid.</p>}
          <label>What is being claimed?<input value={selected.claimDescription} maxLength={500} onChange={(e) => patch(selected.id, { claimDescription: e.target.value })} placeholder="Use the wording from the deduction list" /></label>
        </fieldset>
        <div className={styles.photos}>{(["before", "after"] as const).map((visit) => <figure key={visit}><div className={styles.photoLabel}><b>{photoLabels[visit]}</b><span>{selected[visit]?.origin === "sample" ? "Generated scene" : selected[visit] ? "Local photo" : "Not provided"}</span></div>{selected[visit] ? <img src={selected[visit]!.src} alt={`${photoLabels[visit]} evidence for ${selected.room} ${selected.item}`} /> : <div className={styles.emptyPhoto}><span aria-hidden="true">+</span><b>Add the comparison photo</b><small>JPEG, PNG or WebP · up to 8 MB</small></div>}{mode === "personal" && <label className={styles.fileLabel}>{selected[visit] ? "Replace photo" : "Choose photo"}<input type="file" aria-label={`${photoLabels[visit]} photo`} accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => choosePhoto(e, visit)} /></label>}{mode === "personal" && selected[visit]?.origin === "local" && <button type="button" className={styles.secondary} disabled={busy} aria-label={`Remove ${photoLabels[visit]} photo`} onClick={(event) => { event.currentTarget.parentElement?.querySelector<HTMLInputElement>('input[type="file"]')?.focus(); patch(selected.id, { [visit]: undefined }); setStatus(`${photoLabels[visit]} photo removed from this deduction. It will not appear in future exports. Your other case details are unchanged.`); }}>Remove photo</button>}</figure>)}</div>
        {selected.model && <details className={styles.modelNote} open={!!selected.model.evaluationNote}><summary>Recorded AI suggestion: {selected.model.verdict.replaceAll("_", " ")} <span>{`${confidenceLabel(selected.model.confidence)} model confidence`}</span></summary><p>{selected.model.description}</p>{selected.model.evaluationNote && <p className={styles.knownError}><b>The evaluation disagrees.</b> {selected.model.evaluationNote}</p>}<small>Muse Image made these test scenes. SAM 3.1 selected the object crops; Muse Spark assessed them in a previous offline run. Confidence is uncalibrated. This original suggestion stays unchanged when you edit your response.</small></details>}
        {selected.sampleReview && <p className={styles.importedResponse} data-testid="imported-review-response">{sampleReviewDescription(selected.sampleReview)}</p>}
        <fieldset disabled={busy} className={styles.response}><legend>Your response</legend><div className={styles.responseOptions}>{(["question", "discuss", "omit"] as CaseResponse[]).map((value) => <label className={selected.response === value ? styles.optionSelected : ""} key={value}><input type="radio" name={`response-${selected.id}`} value={value} checked={selected.response === value} onChange={() => patch(selected.id, { response: value })} /><span>{RESPONSE_LABELS[value]}</span></label>)}</div><p>These are draft positions. No option accepts a charge. “Leave out” excludes this item and its photos from the exported response.</p><label className={styles.noteLabel}>What should your response say?<textarea value={selected.note} maxLength={5000} rows={3} onChange={(e) => patch(selected.id, { note: e.target.value })} placeholder={mode === "sample" ? "For example: the planted test change was ordinary carpet wear. Please explain why replacement is proposed." : "Add what you observed, any context, and what evidence you want to see."} /></label></fieldset>
        <section className={styles.evidenceTracker} aria-label="Evidence gap tracker">
          <label className={styles.trackerToggle}><input type="checkbox" disabled={busy} checked={!!selected.evidenceChecklist} onChange={(event) => patch(selected.id, { evidenceChecklist: event.target.checked ? {} : undefined })} />Track evidence for this deduction <span>Optional</span></label>
          <p id="evidence-tracker-help">{EVIDENCE_DISCLAIMER} Turning this off clears its tracking choices and restores the standard requests.</p>
          {selected.evidenceChecklist && <fieldset disabled={busy} className={styles.fields} aria-describedby="evidence-tracker-help"><legend className={styles.srOnly}>Evidence status for {selected.item || "this deduction"}</legend>
            <div className={styles.evidenceGrid}>{evidenceRows(selected).map(({ key, label, status }) => <label key={key}>{label}<select aria-label={`${label} status`} value={status} onChange={(event) => patch(selected.id, { evidenceChecklist: { ...selected.evidenceChecklist, [key]: event.target.value as EvidenceStatus } })}>{Object.entries(EVIDENCE_STATUS_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}</div>
            <p>Age and condition basis is shown for replacement costs only. Adding photos or cost assumptions never marks records as provided.</p>
            <div className={styles.evidenceRequests} aria-live="polite"><b>Requests for this deduction</b>{selected.response === "omit" ? <p>This deduction and its checklist are excluded from the draft and bundle.</p> : evidenceRequests(selected).length ? <ul>{evidenceRequests(selected).map((request) => <li key={request}>{request}</li>)}</ul> : <p>No outstanding evidence requests from this checklist. This does not mean the evidence is sufficient or the charge is accepted.</p>}</div>
          </fieldset>}
        </section>
        <details className={styles.assumptions}><summary>Explore cost assumptions <span>Optional, never inferred by AI</span></summary><fieldset disabled={busy} className={styles.fields}><legend className={styles.srOnly}>Cost assumptions</legend><label>Type of proposed cost<select value={selected.costType} aria-label="Type of proposed cost" onChange={(e) => patch(selected.id, { costType: e.target.value as CostType })}><option value="unknown">Not specified</option><option value="replacement">Replacement</option><option value="repair">Repair</option><option value="cleaning">Cleaning</option></select></label>{selected.costType === "replacement" ? <><p>Try a simple remaining-value calculation with your own assumptions. No age, lifespan or quality is filled in from an item label.</p><div className={styles.fieldRow}><label>Replacement cost (£)<input aria-label="Replacement cost in pounds" inputMode="decimal" value={selected.replacementCost} maxLength={15} onChange={(e) => patch(selected.id, { replacementCost: e.target.value })} placeholder="Unknown" /></label><label>Age at move-in (years)<input aria-label="Age at move-in in years" inputMode="decimal" value={selected.ageAtMoveIn} maxLength={8} onChange={(e) => patch(selected.id, { ageAtMoveIn: e.target.value })} placeholder="Unknown" /></label></div><div className={styles.fieldRow}><label>Tenancy length (years)<input aria-label="Tenancy length in years" inputMode="decimal" value={selected.tenancyYears} maxLength={8} onChange={(e) => patch(selected.id, { tenancyYears: e.target.value })} placeholder="Unknown" /></label><label>Expected useful life (years)<input aria-label="Expected useful life in years" inputMode="decimal" value={selected.usefulLife} maxLength={8} onChange={(e) => patch(selected.id, { usefulLife: e.target.value })} placeholder="Unknown" /></label></div><label>Quality and starting-condition basis<input value={selected.qualityBasis} aria-label="Quality and starting-condition basis" maxLength={500} onChange={(e) => patch(selected.id, { qualityBasis: e.target.value })} placeholder="e.g. invoice, inventory or an explicitly unverified assumption" /></label><div className={styles.calculation} role="status" data-testid="replacement-illustration">{illustration.status === "illustrative" ? <><span>Remaining-value illustration</span><strong>{pounds(illustration.remainingPence)}</strong><p>{pounds(illustration.costPence)} × max(0, 1 − ({illustration.age} + {illustration.tenancy}) ÷ {illustration.life})</p><small>Unverified assumptions, not a suggested settlement or tenant liability. This does not change your claimed amount, response or totals.</small></> : <p>No estimate yet. {illustration.status === "needs_inputs" ? `Supply: ${illustration.missing.join(", ")}.` : ""}</p>}</div></> : <p>No replacement-life calculation applies to this selection. Evidence of cost, cause and responsibility still needs review.</p>}</fieldset></details>
        {mode === "personal" && <div className={styles.removeDeduction}><button type="button" className={styles.secondary} disabled={busy} onClick={removeSelectedItem}>Remove this deduction</button><p>Clears this deduction’s notes, photos and evidence choices from the case. To keep them but exclude the deduction from exports, choose “Leave out of response” above.</p></div>}
      </section>
    </div>
    <section className={styles.export} aria-label="Prepare current evidence bundle"><div><p className={styles.kicker}>03 / TAKE YOUR REVIEW WITH YOU</p><h2>Your choices, carried through.</h2><p>The bundle contains your current response, claim amounts and side-by-side photos. Original model suggestions remain separately labelled.</p><label>Bundle title<input value={title} maxLength={200} disabled={busy} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} /></label></div><div className={styles.exportActions}><button className={styles.primary} onClick={exportBundle} disabled={busy || !totals.included}>{busy ? "Preparing…" : "Export current evidence bundle"} <Arrow down /></button><button className={styles.secondary} aria-expanded={showReply} aria-controls="case-current-reply" onClick={() => setShowReply(!showReply)}>{showReply ? "Hide" : "Preview"} response draft</button><small>A self-contained HTML file. Open it and use Print → Save as PDF. Nothing is sent. Check photos and notes for personal information before sharing.</small>{!totals.included && <small>Add at least one included item to export.</small>}</div></section>
    <section className={styles.backup} aria-labelledby="case-backup-title">
      <div><h2 id="case-backup-title">Pick up where you left off</h2><p>Save a private case as an editable JSON backup, then reopen it here on a later visit. No account or upload needed. The evidence HTML above is read-only and cannot be reopened for editing.</p><p><strong>Keep this file private.</strong> It is not encrypted and includes all deductions, notes and display photos, including items left out of your response. It is not an evidence pack to share. Keep original photos separately.</p></div>
      <div className={styles.backupActions}>{mode === "personal" ? <button className={styles.secondary} disabled={busy} onClick={saveBackup}>Save editable backup <Arrow down /></button> : <p>Saving is available after you start a private case.</p>}<label className={styles.fileLabel}>Reopen private case<input type="file" aria-label="Reopen private case backup" accept=".json,application/json" disabled={busy} onChange={reopenBackup} /></label><small>Fair Wear JSON backups only · up to 32 MB. Opening replaces the case on this page after confirmation if you have edits. No automatic saving.</small></div>
    </section>
    <p role="status" className={styles.status}>{status}</p>
    {showReply && <section id="case-current-reply" className={styles.draft}><h2>Current draft, not sent</h2><pre>{draft}</pre></section>}
    <footer className={styles.footer}><p>Fair Wear is a prototype for organising evidence. Photos alone do not establish age, cause or responsibility. This is not legal advice.</p><p>{mode === "sample" ? "Generated test images · Real recorded model outputs · Fictional proposed amounts" : "No uploads · No AI analysis of personal files · Keep your originals separately"}</p></footer>
  </main>;
}
