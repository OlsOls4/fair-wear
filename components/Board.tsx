"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DECISIONS, defaultDecision, defaultDecisionReason, type Decision } from "@/lib/decisions";
import { replyDraft } from "@/lib/reply";
import { confidenceLabel, type F } from "@/lib/findings";
import { calculateShare } from "@/lib/pipeline/guidance";
import { readSampleResponses, saveSampleResponses } from "@/lib/sample-review-session";
import EvidencePair from "./EvidencePair";

export type { F } from "@/lib/findings";
export { replyDraft } from "@/lib/reply";
const LABEL: Record<string, string> = { damage: "Damage", fair_wear: "Fair wear & tear", cleaning: "Cleaning", no_change: "No change", missing: "Missing", added: "Added", unresolved: "Unresolved" };
const ORDER = ["damage", "missing", "cleaning", "fair_wear", "added", "unresolved", "no_change"];

export default function Board({ property, findings, banner, reply, pdf, rememberSampleResponses = false }: { property: string; findings: F[]; banner?: string; reply?: string; pdf?: string; rememberSampleResponses?: boolean }) {
  const boardId = useId();
  const [filter, setFilter] = useState("all");
  const [showReply, setShowReply] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [sampleStorage, setSampleStorage] = useState<"loading" | "ready" | "unavailable">(rememberSampleResponses ? "loading" : "unavailable");
  const [resetStorageFailed, setResetStorageFailed] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [navigationTarget, setNavigationTarget] = useState<{ findingId?: string } | null>(null);
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
    function onPageShow(event: PageTransitionEvent) { if (event.persisted) restoreResponses(); }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [rememberSampleResponses]);
  const reviewStops = [
    { id: "living-room-carpet-0-1", label: "Inspect a change" },
    { id: "bedroom-carpet-0-0", label: "Inspect a model error" },
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
  function choose(id: string, decision: Decision) {
    const next = { ...decisions, [id]: decision };
    setDecisions(next);
    if (rememberSampleResponses) {
      try { saveSampleResponses(window.sessionStorage, next); setSampleStorage("ready"); setResetStorageFailed(false); }
      catch { setSampleStorage("unavailable"); }
    }
    setCopyStatus("");
  }
  function resetResponses() {
    setDecisions({});
    setCopyStatus("");
    if (rememberSampleResponses) {
      try { saveSampleResponses(window.sessionStorage, {}); setSampleStorage("ready"); setResetStorageFailed(false); }
      catch { setSampleStorage("unavailable"); setResetStorageFailed(true); }
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
        <p>The model verdict is evidence to review, not a finding of liability. Change each suggested response below. Agree means provisional agreement, subject to evidence and cost review. Not claimed leaves the item out of your draft.</p>
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
        <div className="row" aria-live="polite" data-testid="decision-summary">
          {DECISIONS.map((decision) => <span key={decision}>{decision}: <b>{decisionCounts[decision]}</b></span>)}
        </div>
        <button className="chip" disabled={sampleStorage === "loading" || (!Object.keys(decisions).length && !resetStorageFailed)} onClick={resetResponses}>Reset suggested responses</button>
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
            <article className="card review-target" key={f.id} data-finding-id={f.id} tabIndex={-1} aria-labelledby={`${inputId}-item ${inputId}-room`} ref={(element) => { if (element) findingRefs.current.set(f.id, element); else findingRefs.current.delete(f.id); }}>
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
                <select id={`${inputId}-response`} aria-labelledby={`${inputId}-label ${inputId}-room ${inputId}-item`} aria-describedby={`${inputId}-reason ${inputId}-reference`} disabled={rememberSampleResponses && sampleStorage === "loading"} value={selected} onChange={(e) => choose(f.id, e.target.value as Decision)}>
                  {DECISIONS.map((decision) => <option key={decision}>{decision}</option>)}
                </select>
                <div className="meta" id={`${inputId}-reason`}>{selected !== suggested ? `You changed the suggested response (${suggested}). ` : ""}{defaultDecisionReason(f)}</div>
              </div>
            </article>
          );
        })}
      </div>
      <section id={draftId} className="current-draft" aria-labelledby={`${draftId}-heading`} hidden={!showReply}>
        <h2 id={`${draftId}-heading`} className="review-target" ref={draftHeadingRef} tabIndex={-1}>Current response draft</h2>
        <p className="meta">Generated locally from your selected responses. Review every line before sharing. No deduction amount is accepted and no message is sent.</p>
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
