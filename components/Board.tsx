"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DECISIONS, DECISION_LABELS, defaultDecision, defaultDecisionReason, type Decision } from "@/lib/decisions";
import { replyDraft } from "@/lib/reply";
import { confidenceLabel, type F } from "@/lib/findings";
import { calculateShare } from "@/lib/pipeline/guidance";
import { readSampleResponses, saveSampleResponses } from "@/lib/sample-review-session";
import { prepareSampleCaseTransfer, SAMPLE_CASE_TRANSFER_KEY } from "@/lib/sample-case-transfer";
import { SAMPLE_CASE_EXAMPLES } from "@/lib/case-builder";
import { evidenceFindingFromHash } from "@/lib/evidence-navigation";
import EvidencePair from "./EvidencePair";

export type { F } from "@/lib/findings";
export { replyDraft } from "@/lib/reply";
const LABEL: Record<string, string> = { damage: "Damage", fair_wear: "Fair wear & tear", cleaning: "Cleaning", no_change: "No change", missing: "Missing", added: "Added", unresolved: "Unresolved" };
const transferableIds = new Set<string>(SAMPLE_CASE_EXAMPLES.map((item) => item.id));
const ORDER = ["damage", "missing", "cleaning", "fair_wear", "added", "unresolved", "no_change"];

export default function Board({ property, findings, banner, reply, pdf, rememberSampleResponses = false, allowEvidenceNavigation = false }: { property: string; findings: F[]; banner?: string; reply?: string; pdf?: string; rememberSampleResponses?: boolean; allowEvidenceNavigation?: boolean }) {
  const boardId = useId();
  const [filter, setFilter] = useState("all");
  const [showReply, setShowReply] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [sampleStorage, setSampleStorage] = useState<"loading" | "ready" | "unavailable">(rememberSampleResponses ? "loading" : "unavailable");
  const [resetStorageFailed, setResetStorageFailed] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [transferError, setTransferError] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [handoffCleanupFailed, setHandoffCleanupFailed] = useState(false);
  const transferInFlight = useRef(false);
  const [navigationTarget, setNavigationTarget] = useState<{ findingId?: string } | null>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<string | null>(null);
  const [evidenceLinkError, setEvidenceLinkError] = useState("");
  const findingRefs = useRef(new Map<string, HTMLElement>());
  const draftHeadingRef = useRef<HTMLHeadingElement>(null);
  const draftOpenerRef = useRef<HTMLButtonElement | null>(null);
  const draftId = `${boardId}-current-reply`;
  useEffect(() => {
    if (!rememberSampleResponses) return;
    function restoreResponses() {
      try {
        setDecisions(readSampleResponses(window.sessionStorage));
        setSampleStorage("ready");
        setResetStorageFailed(false);
        setCopyStatus("");
      } catch {
        setSampleStorage("unavailable");
      }
    }
    restoreResponses();
    // A Back/Forward-cache restore does not remount React. Another sample page
    // may have changed or reset this tab's choices while this document slept.
    function onPageShow(event: PageTransitionEvent) { if (event.persisted) { transferInFlight.current = false; setTransferring(false); setTransferError(""); restoreResponses(); } }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [rememberSampleResponses]);
  useEffect(() => {
    if (!allowEvidenceNavigation) return;
    function followEvidenceLink() {
      const hash = window.location.hash;
      const id = evidenceFindingFromHash(hash, findings.map((finding) => finding.id));
      setEvidenceTarget(id);
      setEvidenceLinkError(hash.startsWith("#finding=") && !id
        ? "This sample finding link is invalid or no longer available. All findings remain available below; your responses have not changed." : "");
      if (id) { setFilter("all"); setNavigationTarget({ findingId: id }); }
    }
    // Re-activating the current fragment does not emit hashchange. Treat a
    // normal same-document anchor activation as a fresh reveal/focus request.
    function repeatEvidenceLink(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof window.Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof window.HTMLAnchorElement) || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      let destination: URL;
      try { destination = new URL(anchor.href, window.location.href); } catch { return; }
      if (destination.origin !== window.location.origin || destination.pathname !== window.location.pathname || destination.search !== window.location.search || destination.hash !== window.location.hash) return;
      if (!evidenceFindingFromHash(destination.hash, findings.map((finding) => finding.id))) return;
      followEvidenceLink();
    }
    followEvidenceLink();
    window.addEventListener("hashchange", followEvidenceLink);
    document.addEventListener("click", repeatEvidenceLink);
    return () => {
      window.removeEventListener("hashchange", followEvidenceLink);
      document.removeEventListener("click", repeatEvidenceLink);
    };
  }, [allowEvidenceNavigation, findings]);
  const reviewStops = [
    { id: "bedroom-carpet-0-0", label: "Inspect a change" },
    { id: "bathroom-bath-0-0", label: "Inspect a label mismatch" },
  ].filter((stop) => findings.some((finding) => finding.id === stop.id));
  // Wait for React to reveal the destination before moving keyboard focus.
  // A fresh target object also makes repeated navigation to the same stop work.
  useEffect(() => {
    if (!navigationTarget) return;
    const destination = navigationTarget.findingId
      ? findingRefs.current.get(navigationTarget.findingId)
      : draftHeadingRef.current;
    if (destination) {
      destination.focus({ preventScroll: true });
      destination.scrollIntoView({ block: "start", behavior: "instant" });
    }
    setNavigationTarget(null);
  }, [navigationTarget]);
  function inspectFinding(id: string) {
    setFilter("all");
    setNavigationTarget({ findingId: id });
  }
  function openDraft(opener: HTMLButtonElement) {
    draftOpenerRef.current = opener;
    setShowReply(true);
    setNavigationTarget({});
  }
  function closeDraft() {
    setShowReply(false);
    draftOpenerRef.current?.focus({ preventScroll: true });
    draftOpenerRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }
  const counts = useMemo(() => { const c: Record<string, number> = {}; findings.forEach((f) => (c[f.verdict] = (c[f.verdict] ?? 0) + 1)); return c; }, [findings]);
  const decisionCounts: Record<Decision, number> = { Agree: 0, Dispute: 0, "Not claimed": 0 };
  findings.forEach((f) => decisionCounts[decisions[f.id] ?? defaultDecision(f)]++);
  const shown = findings.filter((f) => filter === "all" || f.verdict === filter).sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict));
  const draft = useMemo(() => replyDraft(property, findings, decisions), [property, findings, decisions]);
  function discardPreparedHandoff() {
    // A failed review save must not skip invalidating an older navigation snapshot.
    try {
      window.sessionStorage.removeItem(SAMPLE_CASE_TRANSFER_KEY);
      setHandoffCleanupFailed(false);
    } catch {
      setHandoffCleanupFailed(true);
    }
  }
  function choose(id: string, decision: Decision | undefined) {
    transferInFlight.current = false; setTransferring(false);
    const next = { ...decisions };
    if (decision === undefined) delete next[id];
    else next[id] = decision;
    setDecisions(next);
    setCopyStatus("");
    setTransferError("");
    if (rememberSampleResponses) {
      try { saveSampleResponses(window.sessionStorage, next); setSampleStorage("ready"); setResetStorageFailed(false); }
      catch { setSampleStorage("unavailable"); }
      discardPreparedHandoff();
    }
  }
  function resetResponses() {
    transferInFlight.current = false; setTransferring(false);
    setDecisions({});
    setCopyStatus("");
    setTransferError("");
    if (rememberSampleResponses) {
      try { saveSampleResponses(window.sessionStorage, {}); setSampleStorage("ready"); setResetStorageFailed(false); }
      catch { setSampleStorage("unavailable"); setResetStorageFailed(true); }
      discardPreparedHandoff();
    }
  }
  function continueToCase() {
    if (transferInFlight.current) return;
    transferInFlight.current = true; setTransferring(true);
    try {
      // Snapshot current in-memory choices, including edits after a storage failure.
      const destination = prepareSampleCaseTransfer(window.sessionStorage, decisions, window.crypto.randomUUID());
      setHandoffCleanupFailed(false); setTransferError("");
      window.location.assign(destination);
    } catch {
      transferInFlight.current = false; setTransferring(false);
      setTransferError("Your choices could not be carried over in this browser. Stay here to keep reviewing, or open the case builder separately with its starting example responses.");
    }
  }
  function cancelHandoff() {
    transferInFlight.current = false; setTransferring(false);
    try {
      window.sessionStorage.removeItem(SAMPLE_CASE_TRANSFER_KEY);
      setHandoffCleanupFailed(false);
      setTransferError("Prepared handoff cleared. You can continue again. If navigation already started, the case will open without imported choices.");
    } catch {
      setHandoffCleanupFailed(true);
      setTransferError("The prepared handoff could not be cleared. It may still be imported if navigation continues. Your review choices are unchanged.");
    }
  }
  async function copyDraft() {
    try { await navigator.clipboard.writeText(draft); setCopyStatus("Draft copied. Review and edit it before sharing."); }
    catch { setCopyStatus("Copy was unavailable. Select the draft text below and copy it manually."); }
  }
  function downloadDraft() {
    const url = URL.createObjectURL(new Blob([draft], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "fair-wear-review-draft.txt";
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div>
      {banner && <div className="banner">{banner}</div>}
      {evidenceLinkError && <p role="status">{evidenceLinkError}</p>}
      <h2 style={{ margin: "8px 0" }}>{property}</h2>
      <section className="card review-intro" aria-label="Review your suggested responses">
        <b>Review your suggested responses</b>
        <div className="review-shortcuts" role="group" aria-label="Try this review">
          <span className="meta">Try this review</span>
          <div className="row">
            {reviewStops.map((stop) => <button className="chip" key={stop.id} onClick={() => inspectFinding(stop.id)}>{stop.label}</button>)}
            <button className="btn" aria-expanded={showReply} aria-controls={draftId} onClick={(event) => openDraft(event.currentTarget)}>Open current draft</button>
          </div>
        </div>
        {rememberSampleResponses && <p className="meta">Start with the bedroom carpet: a planted fair-wear change the model called damage. Change or confirm its response, then Continue to case builder to carry that choice into the matching fictional claim. The second stop shows the bath mislabelled as cleaning.</p>}
        <p>The model verdict is evidence to review, not a finding of liability. Change each suggested response below. Discuss after evidence does not accept responsibility or a charge. Untouched suggestions appear as review pending in the draft. Not claimed leaves the item out of your draft.</p>
        <p className="meta">Nothing is sent. The draft updates from all your choices, including items hidden by a filter.</p>
        <p className="meta" data-testid="review-storage-notice" aria-live="polite">
          {rememberSampleResponses ? sampleStorage === "loading"
            ? "Checking this tab for saved sample responses."
            : sampleStorage === "ready"
              ? "Sample responses stay in this browser tab across navigation and reload. Reset suggested responses clears them. Only sample finding references and choices are saved, never photos or personal case details. Browser session restore may keep them after closing a tab."
              : resetStorageFailed
                ? "Responses reset on this page, but saved choices could not be cleared. They may reappear when you return. Download the current draft before leaving."
                : "Tab storage is unavailable. Your latest choices are kept only on this page and may be lost when you leave or reload. Download the current draft before leaving."
            : "Your selections are kept only on this page. Download your current draft before leaving or reloading."}
        </p>
        <p className="meta" role="status" data-testid="review-choice-count">{Object.keys(decisions).length} of {findings.length} responses explicitly selected. Counts below include untouched suggestions.</p>
        <div className="row" aria-live="polite" data-testid="decision-summary">
          {DECISIONS.map((decision) => <span key={decision}>{DECISION_LABELS[decision]}: <b>{decisionCounts[decision]}</b></span>)}
        </div>
        <button className="chip" disabled={sampleStorage === "loading" || (!Object.keys(decisions).length && !resetStorageFailed)} onClick={resetResponses}>Reset suggested responses</button>
        {rememberSampleResponses && <section className="sample-case-handoff" aria-label="Carry sample choices into a case">
          <h3>Turn your review into an evidence bundle</h3>
          <p>Continue with three fictional claims: bedroom carpet, kitchen oven and bathroom bath. Only responses you changed or explicitly confirmed for these three items carry over. Other findings stay on this board; untouched suggestions are not treated as your choices.</p>
          <p className="meta">Dispute becomes Question this deduction. Discuss after evidence stays Discuss after evidence. Not claimed becomes Leave out of response. Untouched claims start as Question this deduction. No charge is accepted. This starts a fresh sample case, not a private case. A one-time handoff saves only sample references and choices in this tab until the case opens; no photos or notes are copied.</p>
          <p className="meta" role="status" data-testid="sample-choice-progress">{Object.keys(decisions).filter((id) => transferableIds.has(id)).length} of 3 sample responses ready to carry over. Confirm an unchanged suggestion on its card, or change its response.</p>
          <button className="btn" disabled={sampleStorage === "loading" || transferring} onClick={continueToCase}>Continue to case builder</button>
          {(transferring || handoffCleanupFailed) && <button className="chip" onClick={cancelHandoff}>Cancel handoff</button>}
          {handoffCleanupFailed && <p role="alert">The earlier handoff could not be cleared. Earlier choices may still be imported if navigation continues. Use Cancel handoff to retry clearing it.</p>}
          <p role="status">{transferError}</p>
        </section>}
      </section>
      <div className="row" role="group" aria-label="Filter model verdicts">
        <button className={`chip ${filter === "all" ? "on" : ""}`} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All ({findings.length})</button>
        {ORDER.filter((v) => counts[v]).map((v) => <button key={v} className={`chip ${filter === v ? "on" : ""}`} aria-pressed={filter === v} onClick={() => setFilter(v)}>{LABEL[v]} ({counts[v]})</button>)}
      </div>
      <p className="meta" aria-live="polite" data-testid="filter-summary">Showing {shown.length} of {findings.length} findings{filter === "all" ? "." : `: ${LABEL[filter]}.`}</p>
      <div className="grid">
        {shown.map((f) => {
          const suggested = defaultDecision(f);
          const selected = decisions[f.id] ?? suggested;
          // Keep DOM IDREFs whitespace-free even when model item labels contain spaces.
          const inputId = `${boardId}-finding-${findings.indexOf(f)}`;
          const calculation = f.verdict === "damage" || f.verdict === "missing"
            ? calculateShare(f.verdict, f.tenancyYears, f.ageYears, f.calculationBasis) : null;
          return (
            <article className="card review-target" key={f.id} data-finding-id={f.id} tabIndex={-1} aria-labelledby={`${inputId}-item ${inputId}-room`} aria-describedby={evidenceTarget === f.id ? `${inputId}-evidence-navigation` : undefined} ref={(element) => { if (element) findingRefs.current.set(f.id, element); else findingRefs.current.delete(f.id); }}>
              {evidenceTarget === f.id && <p className="meta" id={`${inputId}-evidence-navigation`}>Opened from a public sample finding link. Inspection notes are not imported. Your existing response is unchanged; review and choose it separately below.</p>}
              <span className={`badge v-${f.verdict}`}>{f.verdict === "unresolved" ? "Review" : "Model"}: {LABEL[f.verdict] ?? f.verdict}</span>
              <h3 id={`${inputId}-item`} style={{ marginTop: 8 }}>{f.item}</h3>
              <div className="room" id={`${inputId}-room`}>{f.room}{f.simulated ? " · simulated imagery" : ""}</div>
              <div className="meta" id={`${inputId}-reference`}>Finding reference: {f.id}</div>
              {f.evaluationNote && <div className="evaluation-note"><b>Known demo limitation:</b> {f.evaluationNote}</div>}
              <EvidencePair before={f.before} after={f.after} label={`${f.room} ${f.item}`} simulated={f.simulated} />
              <div>{f.description}</div>
              {calculation && <div className="meta" data-testid="replacement-calculation">
                {calculation.status === "illustrative" && <><b>Remaining-life illustration: {calculation.percentage}%.</b> Supplied assumptions: {f.ageYears} years old at move-in, {f.tenancyYears} tenancy years, {f.calculationBasis?.usefulLifeYears}-year expected life. Quality/condition basis: {f.calculationBasis?.qualityBasis}. </>}
                {calculation.note}
              </div>}
              {f.verdict === "cleaning" && <div className="meta">The prototype does not depreciate cleaning costs by item lifespan. Responsibility and any reasonable cleaning charge still need supporting evidence.</div>}
              {f.verdict === "unresolved" && <div className="meta">Insufficient evidence is not proof of a missing, added, damaged or unchanged item. Request comparable records and human review before drawing a conclusion.</div>}
              {f.verdict === "fair_wear" && <div className="meta">The model suggests ordinary wear over {f.tenancyYears} years. Review the evidence before responding.</div>}
              {f.guidanceNote && <div className="meta">Background example, not item-specific evidence: {f.guidanceNote}</div>}
              <div className="meta">Model-reported confidence {confidenceLabel(f.confidence)}. This score is uncalibrated, not a probability of correctness or responsibility.</div>
              <div className="decision-control">
                <label id={`${inputId}-label`} htmlFor={`${inputId}-response`}>Your response</label>
                <select id={`${inputId}-response`} aria-labelledby={`${inputId}-label ${inputId}-room ${inputId}-item`} aria-describedby={`${inputId}-reason ${inputId}-reference ${inputId}-confirmation`} disabled={rememberSampleResponses && sampleStorage === "loading"} value={selected} onChange={(e) => choose(f.id, e.target.value as Decision)}>
                  {DECISIONS.map((decision) => <option key={decision} value={decision}>{DECISION_LABELS[decision]}</option>)}
                </select>
                <div>
                  {selected === suggested && <button type="button" className="chip"
                    disabled={rememberSampleResponses && sampleStorage === "loading"}
                    aria-describedby={`${inputId}-confirmation ${inputId}-reference`}
                    aria-label={`${Object.hasOwn(decisions, f.id) ? "Undo confirmation" : `Confirm ${DECISION_LABELS[selected]}`}: ${f.room} ${f.item}, ${DECISION_LABELS[selected]}`}
                    onClick={() => choose(f.id, Object.hasOwn(decisions, f.id) ? undefined : selected)}>
                    {Object.hasOwn(decisions, f.id) ? "Undo confirmation" : `Confirm ${DECISION_LABELS[selected]}`}
                  </button>}
                  <p className="meta" id={`${inputId}-confirmation`} role="status">{Object.hasOwn(decisions, f.id)
                    ? `Explicit response: ${DECISION_LABELS[selected]} (${selected === suggested ? "confirmed suggestion" : "changed response"}).${rememberSampleResponses && transferableIds.has(f.id) ? " Ready to carry over." : ""}`
                    : "Suggested only, not your decision. Confirm or change this response to use it in your draft."}</p>
                </div>
                <div className="meta" id={`${inputId}-reason`}>{selected !== suggested ? `You changed the suggested response (${DECISION_LABELS[suggested]}). ` : ""}{defaultDecisionReason(f)}</div>
              </div>
            </article>
          );
        })}
      </div>
      <section id={draftId} className="current-draft" aria-labelledby={`${draftId}-heading`} hidden={!showReply}>
        <h2 id={`${draftId}-heading`} className="review-target" ref={draftHeadingRef} tabIndex={-1}>Current response draft</h2>
        <p className="meta">Generated locally from explicit responses and neutral evidence requests for untouched suggestions. Review every line before sharing. No deduction amount is accepted and no message is sent.</p>
        <div className="row"><button className="chip" onClick={copyDraft}>Copy current draft</button><button className="chip" onClick={downloadDraft}>Download current draft (.txt)</button><button className="chip" onClick={closeDraft}>Close current draft</button></div>
        <div role="status">{copyStatus}</div>
        {showReply && <pre className="reply" data-testid="current-draft">{draft}</pre>}
      </section>
      {(reply || pdf) && <section className="archived-artifacts" aria-label="Original precomputed demo artifacts">
        <h3>Original precomputed demo artifacts (30 Oct)</h3>
        <p>These unchanged artifacts do not include your selected responses. They contain the original model's wording and may accept charges you dispute. Use the current draft above for your review.</p>
        {pdf && <a className="chip" href={pdf} download>Download original precomputed PDF (unchanged)</a>}
        {reply && <details><summary>View original Muse Spark reply (unchanged)</summary><pre className="reply">{reply}</pre></details>}
      </section>}
    </div>
  );
}
