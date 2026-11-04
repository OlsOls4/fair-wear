"use client";
import { useEffect, useRef, useState } from "react";
import { analyzeEvidence, explainCase, outcomeLabels, pretty, type Observation } from "@/lib/evidence/analysis";
import { baselineEvidence, evidenceCases, evidenceManifest } from "@/lib/evidence/demo";
import { validateSource, verifySourceBytes } from "@/lib/evidence/integrity";
import { evidenceFindingHref } from "@/lib/evidence-navigation";
import { confidenceLabel } from "@/lib/findings";

type Review = "hold" | "challenge" | "supported";
const reviewLabels: Record<Review, string> = { hold: "Hold for more evidence", challenge: "Challenge this classification", supported: "Observed change is supported" };
const spotlights = [
  ["bedroom/carpet", "Decoy called damage", "Test intent → model label"],
  ["bathroom/bath", "Wrong label", "Damage → cleaning"],
  ["bathroom/sealant", "Evidence gap", "No saved observation"],
  ["living-room/curtain", "Missed change", "Fair wear → no change"],
] as const;
const serializedObservation = (o: Observation) => ({ id: o.id, verdict: o.verdict, confidence: o.confidence, description: o.description, before: o.before, after: o.after });

function Pair({ before, after, label }: { before?: string; after?: string; label: string }) {
  return <div className="inspect-image-pair">{[[before, "Move-in"], [after, "Move-out"]].map(([url, visit]) => <figure key={visit}>
    {url ? <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${label} ${visit?.toLowerCase()} image at original size`}><img src={url} alt={`${label}, ${visit?.toLowerCase()}. Generated test imagery.`} /></a> : <div className="inspect-missing">No saved image</div>}
    <figcaption>{visit} <span>· generated image</span></figcaption>
  </figure>)}</div>;
}

export default function EvidenceLab() {
  const [selected, setSelected] = useState("bedroom/carpet");
  const [selectionAnnouncement, setSelectionAnnouncement] = useState("");
  const [cropId, setCropId] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [integrity, setIntegrity] = useState<{ state: "idle" | "running" | "done" | "error"; checked: number; failures: string[]; message?: string }>({ state: "idle", checked: 0, failures: [] });
  const [exportStatus, setExportStatus] = useState("");
  const controller = useRef<AbortController | null>(null);
  const focusSelectedCase = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { setExportStatus(""); }, [threshold, reviews, integrity]);
  function revealSelectedCase() {
    const heading = document.getElementById("inspect-case-title");
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ behavior: "instant", block: "start" });
  }
  useEffect(() => { if (focusSelectedCase.current) { focusSelectedCase.current = false; revealSelectedCase(); } }, [selected]);
  const analysis = analyzeEvidence(evidenceCases, threshold / 100);
  const row = analysis.rows.find((r) => r.id === selected)!;
  const original = baselineEvidence.rows.find((r) => r.id === selected)!;
  const crop = row.observations.find((o) => o.id === cropId) ?? row.observations.find((o) => o.verdict !== "no_change") ?? row.observations[0];
  const review = reviews[selected] ?? "unreviewed";
  const chooseCase = (id: string, focus = false) => { focusSelectedCase.current = focus && id !== selected; setSelected(id); setSelectionAnnouncement(`Selected ${pretty(id.replace("/", " · "))}. Evidence details updated.`); setCropId(null); setExportStatus(""); if (focus && id === selected) revealSelectedCase(); };
  const flaggedOriginal = baselineEvidence.rows.reduce((n, r) => n + r.flagged.length, 0);
  const flaggedNow = analysis.rows.reduce((n, r) => n + r.flagged.length, 0);

  async function verify() {
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort;
    setIntegrity({ state: "running", checked: 0, failures: [] });
    let checked = 0;
    const failures: string[] = [];
    try {
      if (!globalThis.crypto?.subtle) throw new Error("This browser cannot verify SHA-256 here. Use the offline verification command below.");
      for (let i = 0; i < evidenceManifest.sources.length; i += 4) {
        await Promise.all(evidenceManifest.sources.slice(i, i + 4).map(async (source) => {
          try {
            validateSource(source);
            const response = await fetch(source.url, { cache: "no-store", signal: abort.signal });
            if (!response.ok || !await verifySourceBytes(source, await response.arrayBuffer())) failures.push(source.url);
          } catch (error) { if (abort.signal.aborted) throw error; failures.push(source.url); }
          checked++;
        }));
        if (abort.signal.aborted) return;
        setIntegrity({ state: "running", checked, failures: [...failures] });
      }
      setIntegrity({ state: "done", checked, failures: [...failures] });
    } catch (error) {
      if (!abort.signal.aborted) setIntegrity({ state: "error", checked, failures, message: error instanceof Error ? error.message : "Verification could not finish." });
    } finally { controller.current = null; }
  }

  function exportReport() {
    try {
      const report = {
        format: "fair-wear-inspection/v1", snapshotId: evidenceManifest.snapshotId,
        warning: "Generated test images and recorded model outputs, not tenant evidence or a liability decision. Local human review choices do not change the original model output or findings-board draft.",
        threshold: analysis.threshold,
        sourceAvailability: evidenceManifest.availability, modelRoles: evidenceManifest.sourceModels, derivation: evidenceManifest.derivation,
        thresholdMeaning: "Include recorded observations whose self-reported confidence is at least this value. Not a calibrated probability or model rerun.",
        metrics: { planted: analysis.planted, detected: analysis.detected, exactVerdict: analysis.exactVerdict, damagePlanted: analysis.damagePlanted, damageFound: analysis.damageFound, decoys: analysis.decoys, decoysWronglyDamage: analysis.decoysWronglyDamage, falseAlarms: analysis.falseAlarms, unplantedItemsChecked: analysis.unplantedItemsChecked, retainedObservations: analysis.retainedCount, totalObservations: analysis.observationCount },
        cases: analysis.rows.map((r) => ({ caseId: r.id, expectedTestLabel: r.expected, outcome: r.outcome, explanation: explainCase(r), humanReview: reviews[r.id] ?? null, humanReviewed: Object.hasOwn(reviews, r.id), defaultDisposition: "hold", humanReviewOrigin: Object.hasOwn(reviews, r.id) ? "user_selected" : "unreviewed", humanReviewLabel: reviews[r.id] ? reviewLabels[reviews[r.id]] : "Not reviewed; held for more evidence", inputImages: [r.moveIn, r.moveOut], retainedObservationIds: r.retained.map((o) => o.id), recordedObservations: r.observations.map(serializedObservation) })),
        integrityCheck: { state: integrity.state, checked: integrity.checked, failures: integrity.failures, scope: evidenceManifest.scope },
        sources: evidenceManifest.sources,
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2) + "\n"], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "fair-wear-inspection.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportStatus("Inspection report prepared. It includes all cases, your local review choices and the source fingerprints.");
    } catch { setExportStatus("The report could not be prepared in this browser. The source manifest is linked below."); }
  }

  return <div className="evidence-lab">
    <header className="inspect-hero">
      <div className="inspect-eyebrow">EVIDENCE LAB <span>OFFLINE RUN · NO NEW MODEL CALLS</span></div>
      <h1>Don’t trust the label.<br /><span>Inspect the evidence.</span></h1>
      <p className="inspect-lead">Follow a real saved model result from generated room images to matched crops, then challenge the model’s interpretation.</p>
      <div className="inspect-models" aria-label="Model roles"><span><b>Muse Image</b> generated scenes</span><i aria-hidden="true">→</i><span><b>SAM 3.1</b> prepared crops</span><i aria-hidden="true">→</i><span><b>Muse Spark</b> judged changes</span><i aria-hidden="true">→</i><span><b>You</b> review the evidence</span></div>
      <p className="inspect-disclosure">These are generated test scenes, not a real tenancy. The browser replays saved results, not model execution. Raw segmentation masks, boxes and API responses were not saved.</p>
    </header>

    <section className="inspect-scoreboard" aria-label="Recorded sample results">
      <p className="inspect-score-label">ORIGINAL RECORDED RUN · ALL OBSERVATIONS INCLUDED</p>
      <div><strong>{baselineEvidence.observationCount}</strong><span>saved crop-pair observations</span></div>
      <div><strong>{baselineEvidence.detected}/{baselineEvidence.planted}</strong><span>planted changes detected</span></div>
      <div><strong>{baselineEvidence.exactVerdict}/{baselineEvidence.planted}</strong><span>exact planted labels found</span></div>
      <div><strong>{baselineEvidence.decoysWronglyDamage}/{baselineEvidence.decoys}</strong><span>fair-wear decoys called damage</span></div>
    </section>

    <section className="inspect-spots" aria-labelledby="inspect-spots-heading">
      <h2 id="inspect-spots-heading">Start with the mismatches.</h2>
      <div className="inspect-spot-grid">{spotlights.map(([id, title, detail]) => <button key={id} type="button" aria-pressed={selected === id} onClick={() => chooseCase(id, true)}><span>{title}</span><b>{pretty(id.replace("/", " · "))}</b><small>{detail}</small></button>)}</div>
    </section>

    <div className="inspect-workspace">
      <aside className="inspect-inventory" aria-label="Choose an evidence case">
        <h2>All evidence</h2><p>Eight planted tests, plus unchanged-item checks.</p>
        <p className="inspect-selection-status" role="status" aria-atomic="true">{selectionAnnouncement}</p>
        {[...new Set(evidenceCases.map((r) => r.room))].map((room) => <div key={room}><h3>{pretty(room)}</h3>{analysis.rows.filter((r) => r.room === room).map((item) => <button type="button" key={item.id} aria-pressed={item.id === selected} onClick={() => chooseCase(item.id, !!window.matchMedia?.("(max-width: 800px)").matches)}><span>{pretty(item.item)}</span><small>{item.observations.length} {item.observations.length === 1 ? "observation" : "observations"}</small><i className={`inspect-dot inspect-dot-${item.outcome}`} aria-label={outcomeLabels[item.outcome]} /></button>)}</div>)}
      </aside>
      <section className="inspect-detail" aria-label="Selected evidence case" data-testid="inspection-case">
        <div className="inspect-case-heading"><div><p className="inspect-eyebrow">{pretty(row.room)}</p><h2 id="inspect-case-title" tabIndex={-1}>{pretty(row.item)}</h2></div><span className={`inspect-outcome inspect-outcome-${row.outcome}`}>{outcomeLabels[row.outcome]}</span></div>
        <div className="inspect-truth"><span>Planted test intent</span><b>{row.expected ? pretty(row.expected) : "No planted change"}</b><span>Original model signals</span><b>{original.distinctVerdicts.length ? original.distinctVerdicts.map(pretty).join(" + ") : "No saved observation"}</b></div>
        <p className="inspect-case-explanation">{explainCase(row)}</p>
        <p className="inspect-small">Test intent was specified before image generation. It is not independent pixel-level ground truth.</p>

        <details className="inspect-room-inputs" key={`room-${row.room}`}><summary><span className="inspect-step">1</span> Inspect full room inputs <small>Muse Image · both visits</small></summary><Pair before={row.moveIn} after={row.moveOut} label={`${pretty(row.room)} full room`} /><p className="inspect-small">Original generated room images. No inferred boxes or synthetic masks are drawn over them. Open any image to inspect its original dimensions.</p></details>
        <section className="inspect-stage" aria-labelledby="inspect-crops-heading">
          <h3 id="inspect-crops-heading"><span className="inspect-step">2</span> Follow the saved crop pair</h3>
          {crop ? <>
            {row.observations.length > 1 && <div className="inspect-crop-tabs" role="group" aria-label="Choose saved crop observation">{row.observations.map((o, index) => <button type="button" key={o.id} aria-pressed={crop.id === o.id} onClick={() => setCropId(o.id)}>Crop {index + 1}<span>{pretty(o.verdict)}</span></button>)}</div>}
            <Pair before={crop.before} after={crop.after} label={`${pretty(row.room)} ${pretty(row.item)} saved crop`} />
            <p className="inspect-small">The runner matched items by room, label and position, then cropped both fixed-view inputs to the union of the two boxes. These saved crops are available; the underlying SAM boxes and masks are not.</p>
          </> : <div className="inspect-gap"><b>No crop pair exists in the saved run.</b><p>A missing observation is not a missing item. Inspect the full room inputs above and request more evidence before making a claim.</p></div>}
        </section>
        <section className="inspect-stage" aria-labelledby="inspect-claim-heading">
          <h3 id="inspect-claim-heading"><span className="inspect-step">3</span> Read the exact recorded claim</h3>
          {crop ? <div className="inspect-model-claim"><div><b>{pretty(crop.verdict)}</b><span>{confidenceLabel(crop.confidence)} self-reported confidence</span></div><p>“{crop.description}”</p><p className="inspect-small">Record: {crop.id}</p>{!row.retained.some((o) => o.id === crop.id) && <p className="inspect-withheld">Withheld by the current threshold. The original record above is unchanged.</p>}</div> : <p>No Muse Spark judgment was saved for this item. No substitute judgment is generated here.</p>}
          <p className="inspect-small">Confidence is not calibrated accuracy, proof of a cause, or tenant liability.</p>
        </section>
        <section className="inspect-stage inspect-human" aria-labelledby="inspect-human-heading">
          <h3 id="inspect-human-heading"><span className="inspect-step">4</span> Make the human review explicit</h3>
          <label htmlFor="inspection-review">Your review of this evidence</label><select id="inspection-review" value={review} onChange={(event) => { const next = { ...reviews }; if (event.target.value === "unreviewed") delete next[selected]; else next[selected] = event.target.value as Review; setReviews(next); }}><option value="unreviewed">Not reviewed · hold for more evidence</option>{Object.entries(reviewLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
          <p className="inspect-small">Unreviewed items default to Hold. This is a local inspection note, saved only in your downloaded report. It does not change the model record, the findings-board draft, or any amount. It resets on reload.</p>
          {crop ? <>
            <p><a href={evidenceFindingHref(crop.id)} aria-describedby="inspect-board-navigation">Open this crop’s finding on the board →</a></p>
            <p id="inspect-board-navigation" className="inspect-small">Opens finding {crop.id}. Only this public sample reference is carried in the link. Your inspection note is not transferred; choose your response separately on the board. Existing board responses are preserved.</p>
          </> : <>
            <p className="inspect-small">There is no saved finding for this evidence gap, so no matching board card can be opened.</p>
            <p><a href="/demo">Open all findings on the board →</a></p>
          </>}
        </section>
      </section>
    </div>

    <section className="inspect-lab-panel" aria-labelledby="inspect-threshold-heading">
      <div><p className="inspect-eyebrow">COUNTERFACTUAL · DETERMINISTIC, NOT ANOTHER MODEL RUN</p><h2 id="inspect-threshold-heading">Does more confidence mean better evidence?</h2><p>Raise the threshold and see which saved signals disappear. The fixture has only eight planted changes, so this is a sensitivity check, not a recommended operating threshold.</p></div>
      <div className="inspect-threshold-control"><label htmlFor="inspection-threshold">Keep observations with self-reported confidence ≥ <b>{threshold}%</b></label><input id="inspection-threshold" type="range" min="0" max="100" step="1" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} aria-describedby="inspect-threshold-note" /><div className="inspect-presets">{[0, 80, 90, 95].map((value) => <button key={value} type="button" aria-pressed={value === threshold} onClick={() => setThreshold(value)}>{value === 0 ? "All saved results" : `≥ ${value}%`}</button>)}</div></div>
      <div className="inspect-threshold-results" data-testid="inspection-threshold-results" aria-live="polite"><div><b>{analysis.retainedCount}/{analysis.observationCount}</b><span>observations retained</span></div><div><b>{analysis.detected}/{analysis.planted}</b><span>planted changes flagged</span></div><div><b>{analysis.exactVerdict}/{analysis.planted}</b><span>exact labels retained</span></div><div><b>{analysis.decoysWronglyDamage}/{analysis.decoys}</b><span>fair-wear decoys called damage</span></div><div><b>{analysis.falseAlarms}/{analysis.unplantedItemsChecked}</b><span>unplanted observations flagged</span></div></div>
      <p id="inspect-threshold-note" className="inspect-small">At this threshold, {analysis.observationCount - analysis.retainedCount} observations are withheld and {flaggedNow} of the original {flaggedOriginal} change flags remain. Withholding a signal does not fix the evidence or turn it into “no change”. No review selections or findings-board decisions are changed.</p>
      <details><summary>How the numbers are recomputed</summary><p>Observations are grouped by room and normalized item label. A planted item is detected if any retained observation flags a change, and exact if any has its expected label. Multiple crops may disagree. The nine unplanted checks and false alarms are counted per crop observation, not per item. Every retained observation must have finite confidence between 0 and 1.</p></details>
    </section>

    <section className="inspect-provenance" aria-labelledby="inspect-provenance-heading">
      <div><p className="inspect-eyebrow">REPRODUCIBLE SOURCE SNAPSHOT</p><h2 id="inspect-provenance-heading">Check the bytes. Keep the limitations.</h2><p>A SHA-256 manifest fingerprints all 51 input and result files used here. Verification downloads them from this site and checks their bytes in your browser. It does not attest that a model ran, that its output is correct, or that generated scenes reflect real homes.</p></div>
      <div className="inspect-provenance-actions"><button type="button" className="btn" onClick={verify} disabled={integrity.state === "running"}>{integrity.state === "running" ? `Checking ${integrity.checked}/51…` : "Verify all 51 source files"}</button><button type="button" className="chip" onClick={exportReport}>Download inspection report (.json)</button><a className="chip" href="/evidence/manifest.json" target="_blank" rel="noreferrer">View source manifest</a></div>
      <p role="status" data-testid="inspection-integrity">{integrity.state === "idle" ? "Source bytes have not been verified in this browser yet." : integrity.state === "running" ? `Checking source files: ${integrity.checked}/51.` : integrity.state === "error" ? integrity.message : integrity.failures.length ? `${integrity.failures.length} source files failed verification. Do not treat this as a verified snapshot.` : `All ${integrity.checked} source files match the published SHA-256 fingerprints.`}</p>
      {!!integrity.failures.length && <ul>{integrity.failures.map((failure) => <li key={failure}>{failure}</li>)}</ul>}
      {exportStatus && <p role="status">{exportStatus}</p>}
      <details><summary>Reproduce locally and inspect the missing records</summary><p>Run <code>npm run evidence:check</code> to recompute source fingerprints and compare fixture metrics without any model calls. Run <code>npm run test:evidence</code> for offline analysis and integrity tests.</p><p>Available: 8 generated room inputs, 40 saved crop images, parsed judgment results, planted test intent, published evaluation.</p><p>Unavailable: raw SAM responses, segmentation masks and boxes, raw Muse Spark API envelopes, per-call timing and an independently verified model execution attestation. This inspector does not reconstruct them.</p><p className="inspect-fingerprint">Snapshot: {evidenceManifest.snapshotId}</p></details>
      <p className="inspect-small">Original artifacts are untouched. The report records your local review separately from the historical model output. This prototype does not determine liability or process personal uploads.</p>
    </section>
  </div>;
}
