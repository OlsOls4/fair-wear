import { RENTER_GUIDANCE } from "./renter-guidance";
import { confidenceLabel, type F } from "./findings";
import { evidenceRequests, evidenceRows, EVIDENCE_DISCLAIMER, EVIDENCE_STATUS_LABELS, type EvidenceChecklist } from "./case-evidence-gaps";
import { DECISION_LABELS, type Decision } from "./decisions";

export type CaseMode = "sample" | "personal";
export type CaseResponse = "question" | "discuss" | "omit";
export type CostType = "unknown" | "replacement" | "repair" | "cleaning";
export type CaseImage = { src: string; origin: "sample" | "local"; sha256?: string };
export type CaseItem = {
  id: string; room: string; item: string; claimPounds: string; claimDescription: string;
  response: CaseResponse; note: string; costType: CostType;
  evidenceChecklist?: EvidenceChecklist;
  supportingRecords?: string;
  before?: CaseImage; after?: CaseImage;
  sampleReview?: Decision;
  model?: Pick<F, "id" | "verdict" | "confidence" | "description" | "evaluationNote">;
  replacementCost: string; ageAtMoveIn: string; tenancyYears: string; usefulLife: string; qualityBasis: string;
};
export type PhotoContext = "tenancy" | "other";
export type CaseDocument = { mode: CaseMode; title: string; items: CaseItem[]; photoContext?: PhotoContext };

/** Labels describe the reviewer's intended comparison, never verified dates or model findings. */
export function casePhotoLabels(document: Pick<CaseDocument, "mode" | "photoContext">) {
  return document.mode === "personal" && document.photoContext === "other"
    ? { before: "Before", after: "After" }
    : { before: "Move-in", after: "Move-out" };
}
export function casePhotoContextNote(document: Pick<CaseDocument, "mode" | "photoContext">): string {
  return document.photoContext === "other"
    ? "Photo context: Before/After (other comparison). Labels and order are reviewer-selected; timing is unverified. The comparison is not identified as tenancy move-in/out records."
    : "Photo context: Move-in/Move-out (tenancy comparison). Labels and order are reviewer-selected; timing is unverified.";
}

export const RESPONSE_LABELS: Record<CaseResponse, string> = {
  question: "Question this deduction", discuss: "Discuss after evidence", omit: "Leave out of response",
};

export const SAMPLE_RESPONSE_MAP: Record<Decision, CaseResponse> = {
  Dispute: "question", Agree: "discuss", "Not claimed": "omit",
};
export function sampleReviewDescription(decision: Decision): string {
  return `Your selected sample review response: ${DECISION_LABELS[decision]}. Carried into this case as “${RESPONSE_LABELS[SAMPLE_RESPONSE_MAP[decision]]}”. Your current response can differ; no charge is accepted.`;
}

/** Parse GBP exactly into pennies. Blank, negative, scientific notation, and subpenny amounts are unknown. */
export function moneyPence(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const pennies = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(pennies) && pennies <= 100_000_000 ? pennies : null;
}
export function pounds(pennies: number): string { return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pennies / 100); }
export function caseTotals(items: CaseItem[]) {
  const included = items.filter((item) => item.response !== "omit");
  return {
    question: included.filter((item) => item.response === "question").reduce((sum, item) => sum + (moneyPence(item.claimPounds) ?? 0), 0),
    discuss: included.filter((item) => item.response === "discuss").reduce((sum, item) => sum + (moneyPence(item.claimPounds) ?? 0), 0),
    unknown: included.filter((item) => moneyPence(item.claimPounds) === null).length,
    omitted: items.length - included.length,
    included: included.length,
  };
}
function years(value: string): number | null {
  if (!/^\d{1,4}(?:\.\d{1,4})?$/.test(value.trim())) return null;
  const n = Number(value); return Number.isFinite(n) && n >= 0 && n <= 1_000 ? n : null;
}
export function replacementIllustration(item: CaseItem): { status: "not_applicable" | "needs_inputs"; missing: string[] } | { status: "illustrative"; missing: []; remainingPence: number; ratio: number; costPence: number; age: number; tenancy: number; life: number } {
  if (item.costType !== "replacement") return { status: "not_applicable", missing: [] };
  const cost = moneyPence(item.replacementCost), age = years(item.ageAtMoveIn), tenancy = years(item.tenancyYears), life = years(item.usefulLife);
  const missing = [cost === null ? "replacement cost" : "", age === null ? "age at move-in" : "", tenancy === null ? "tenancy length" : "", life === null || life === 0 ? "positive expected useful life" : "", !item.qualityBasis.trim() ? "quality/condition basis" : ""].filter(Boolean);
  if (missing.length) return { status: "needs_inputs", missing };
  // Exact decimal year units prevent binary floating-point errors at half-penny boundaries.
  const units = (value: string) => { const [whole, fraction = ""] = value.trim().split("."); return BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, "0")); };
  const lifeUnits = units(item.usefulLife), unused = lifeUnits - units(item.ageAtMoveIn) - units(item.tenancyYears);
  const remaining = unused > 0n ? unused : 0n;
  const ratio = Number(remaining) / Number(lifeUnits);
  const remainingPence = Number((2n * BigInt(cost!) * remaining + lifeUnits) / (2n * lifeUnits));
  return { status: "illustrative", missing: [], remainingPence, ratio, costPence: cost!, age: age!, tenancy: tenancy!, life: life! };
}
export function emptyCaseItem(id: string): CaseItem {
  return { id, room: "", item: "", claimPounds: "", claimDescription: "", response: "question", note: "", costType: "unknown", replacementCost: "", ageAtMoveIn: "", tenancyYears: "", usefulLife: "", qualityBasis: "" };
}
export const SAMPLE_CASE_EXAMPLES = [
  { id: "bedroom-carpet-0-0", claimPounds: "480", claimDescription: "Replace bedroom carpet", costType: "replacement" as const },
  { id: "kitchen-oven-0-0", claimPounds: "80", claimDescription: "Clean oven", costType: "cleaning" as const },
  { id: "bathroom-bath-0-0", claimPounds: "350", claimDescription: "Replace bath", costType: "replacement" as const },
] as const;
export function sampleCaseItems(findings: F[]): CaseItem[] {
  return SAMPLE_CASE_EXAMPLES.map((example, i) => {
    // IDs come from the published fixture. Refuse to fabricate a missing model finding.
    const finding = findings.find((f) => f.id === example.id);
    if (!finding) throw new Error(`Recorded sample finding missing: ${example.id}`);
    return { ...emptyCaseItem(`sample-${i + 1}`), ...example, room: finding.room, item: finding.item,
      before: finding.before ? { src: finding.before, origin: "sample" as const } : undefined,
      after: finding.after ? { src: finding.after, origin: "sample" as const } : undefined,
      model: { id: finding.id, verdict: finding.verdict, confidence: finding.confidence, description: finding.description, evaluationNote: finding.evaluationNote },
    };
  });
}
export function caseReply(document: CaseDocument): string {
  const included = document.items.filter((item) => item.response !== "omit");
  const hasChecklist = included.some((item) => item.evidenceChecklist);
  const hasPhotos = included.some((item) => item.before || item.after);
  return ["DRAFT FOR REVIEW — NOT SENT", document.mode === "sample" ? "DEMONSTRATION ONLY. The property photos are generated; deduction descriptions and amounts are fictional examples." : hasPhotos ? "Prepared from reviewer-supplied information and selected photos. No AI analysis was performed. Photos are not attached to this text draft." : "Prepared from reviewer-supplied information. No photos are included and no AI analysis was performed.", ...(document.mode === "personal" ? [casePhotoContextNote(document)] : []), "", `Re: ${document.title || "Proposed deposit deductions"}`, "", hasChecklist ? "Please review the item-specific requests below. Evidence tracking reflects my review, not independent verification. No amount is agreed in this draft." : "Please provide an itemised deduction list and the relevant inventory, dated comparison evidence and invoices or quotes. No amount is agreed in this draft.", "", ...included.flatMap((item, index) => [
    `${index + 1}. ${item.room || "Room not supplied"} / ${item.item || "Item not supplied"} [${item.id}]`,
    `Proposed deduction: ${moneyPence(item.claimPounds) === null ? "amount not supplied or invalid" : pounds(moneyPence(item.claimPounds)!)}. ${item.claimDescription}`,
    item.response === "question" ? "I question this proposed deduction. Please explain the evidence of the change, its cause and why responsibility is attributed to me." : "I am willing to discuss this proposed deduction after reviewing supporting evidence. I have not accepted responsibility or agreed an amount.",
    ...(item.note.trim() ? [`My review note: ${item.note.trim()}`] : []),
    ...(item.evidenceChecklist ? evidenceRequests(item) : hasChecklist ? ["Please provide the relevant inventory, dated comparison evidence and itemised invoices or quotes for this deduction."] : []),
    ...(!item.evidenceChecklist && item.costType === "replacement" ? ["Please provide the item's age and starting condition, the basis of its expected useful life, and why repair or cleaning would not be appropriate."] : []),
    "",
  ]), !included.length ? "No items are included in this response." : "Please review these points. I will consider costs and responsibility separately.", "", "This is a draft prepared for the reviewer, not legal advice or a decision about liability."].join("\n");
}

const escapeHtml = (value: string | number) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
const safeImage = (src: string) => /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src);

/** A portable, script-free document. All imagery must be embedded: external URLs are rejected. */
export function buildCaseHtml(document: CaseDocument): string {
  const labels = casePhotoLabels(document);
  const totals = caseTotals(document.items), included = document.items.filter((item) => item.response !== "omit");
  const hasPhotos = included.some((item) => item.before || item.after);
  function figure(image: CaseImage | undefined, visit: string, label: string): string {
    if (!image) return `<figure><div class="missing">${escapeHtml(visit)} photo not provided</div><figcaption>${escapeHtml(visit)}</figcaption></figure>`;
    if (!safeImage(image.src)) throw new Error("Export requires embedded JPEG, PNG or WebP images. No external image references are allowed.");
    return `<figure><img alt="${escapeHtml(`${visit}: ${label}`)}" src="${image.src}"><figcaption>${escapeHtml(visit)} · ${image.origin === "sample" ? "generated sample image" : "reviewer-selected photo; resized locally"}</figcaption>${image.sha256 ? `<small>SHA-256 of original selected file: ${escapeHtml(image.sha256)}. Hash identifies the file; it does not verify date, authorship or authenticity.</small>` : ""}</figure>`;
  }
  const cards = included.map((item, index) => {
    const calculation = replacementIllustration(item);
    return `<article><div class="eyebrow">Evidence ${index + 1} · ${escapeHtml(item.id)}</div><h2>${escapeHtml(item.room || "Room not supplied")} / ${escapeHtml(item.item || "Item not supplied")}</h2><p><b>${escapeHtml(RESPONSE_LABELS[item.response])}</b> · Proposed amount: ${moneyPence(item.claimPounds) === null ? "unknown" : pounds(moneyPence(item.claimPounds)!)}</p><p>${escapeHtml(item.claimDescription)}</p><div class="pair">${figure(item.before, labels.before, item.item)}${figure(item.after, labels.after, item.item)}</div>${item.sampleReview ? `<aside><h3>Starting choice from sample review</h3><p>${escapeHtml(sampleReviewDescription(item.sampleReview))}</p></aside>` : ""}<h3>Reviewer's note</h3><p>${escapeHtml(item.note || "No additional review note supplied.")}</p>${item.evidenceChecklist ? `<aside><h3>Reviewer evidence checklist</h3><p>${escapeHtml(EVIDENCE_DISCLAIMER)}</p><ul>${evidenceRows(item).map(({ label, status }) => `<li>${escapeHtml(label)}: <b>${escapeHtml(EVIDENCE_STATUS_LABELS[status])}</b></li>`).join("")}</ul></aside>` : ""}${item.supportingRecords?.trim() ? `<aside><h3>Supporting record references</h3><p>Reviewer-entered descriptions and dates, not independently verified. Referenced original files are not attached. Keep and supply originals separately if needed.</p><p>${escapeHtml(item.supportingRecords.trim())}</p></aside>` : ""}${item.model ? `<aside><h3>Preserved model suggestion, not the reviewer's conclusion</h3><p>SAM 3.1 and Muse Spark ran offline on Muse Image-generated scenes. Reference: ${escapeHtml(item.model.id)}.</p><p>Original verdict: ${escapeHtml(item.model.verdict.replaceAll("_", " "))}. Model-reported confidence: ${confidenceLabel(item.model.confidence)} (uncalibrated).</p><p>${escapeHtml(item.model.description)}</p>${item.model.evaluationNote ? `<p><b>Known evaluation limitation:</b> ${escapeHtml(item.model.evaluationNote)}</p>` : ""}</aside>` : ""}${calculation.status === "illustrative" ? `<aside><h3>Optional remaining-value illustration</h3><p>${pounds(calculation.costPence)} × max(0, 1 − (${calculation.age} + ${calculation.tenancy}) ÷ ${calculation.life}) = <b>${pounds(calculation.remainingPence)}</b>.</p><p>Inputs supplied by reviewer: item age at move-in ${calculation.age} years; tenancy ${calculation.tenancy} years; expected useful life ${calculation.life} years. Quality/condition basis: ${escapeHtml(item.qualityBasis)}.</p><p>Unverified assumptions, not a suggested settlement or tenant liability. This illustration does not alter the claimed amount or response totals.</p></aside>` : calculation.status === "needs_inputs" ? `<p>Replacement illustration withheld. Missing or invalid: ${escapeHtml(calculation.missing.join(", "))}.</p>` : ""}</article>`;
  }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(document.title || "Fair Wear evidence bundle")}</title><style>body{font:15px/1.55 system-ui,sans-serif;color:#172f2d;background:#f6f5f0;margin:0}main{max-width:980px;padding:48px 24px;margin:auto}h1{font-size:36px;line-height:1.1}h2{font-size:23px}h3{font-size:15px}p{white-space:pre-wrap;overflow-wrap:anywhere}.eyebrow{text-transform:uppercase;letter-spacing:.1em;font-size:11px;font-weight:700;color:#526d68}.notice,aside{background:#edf2eb;padding:16px;border-radius:12px}article{margin-top:30px;background:white;padding:24px;border:1px solid #d5dfd7;border-radius:16px;break-inside:avoid}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0;min-width:0}img{width:100%;max-height:460px;object-fit:contain;background:#eeeee9}figcaption,small{font-size:11px;color:#536761}small{display:block;overflow-wrap:anywhere}.missing{background:#f0efeb;padding:60px 15px;text-align:center}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}.reply{margin-top:40px;border-top:2px solid #214e46;padding-top:20px}@media(max-width:640px){.pair{grid-template-columns:1fr}main{padding:24px 14px}article{padding:16px}}@media print{body{background:white}main{max-width:none;padding:0}.print-note{display:none}article{break-inside:auto;border-radius:0}h2,h3{break-after:avoid}.pair{break-inside:avoid}img{max-height:300px}.reply{break-before:page}}</style></head><body><main><div class="eyebrow">Fair Wear · reviewer-prepared evidence</div><h1>${escapeHtml(document.title || "Proposed deposit deductions")}</h1><div class="notice"><b>DRAFT FOR REVIEW — NOT SENT</b><p>${document.mode === "sample" ? "DEMONSTRATION ONLY. Imagery was generated with Muse Image. Model suggestions are preserved real SAM 3.1 and Muse Spark results from an offline run. Deduction descriptions and amounts are fictional examples, not a real landlord demand." : hasPhotos ? "Prepared locally from reviewer-supplied information and selected photos. These files were not uploaded or analysed by AI. Image content, dates, cause and responsibility have not been independently verified." : "Prepared locally from reviewer-supplied information. No photos are included and no AI analysis was performed. Dates, cause and responsibility have not been independently verified."}</p>${document.mode === "personal" ? `<p>${escapeHtml(casePhotoContextNote(document))}</p>` : ""}<p>${totals.included} included item(s) · ${totals.omitted} omitted item(s). Amounts questioned: <b>${pounds(totals.question)}</b>. Amounts for discussion: <b>${pounds(totals.discuss)}</b>. ${totals.unknown} included amount(s) unknown or invalid. These are sums of proposed deductions, not savings, accepted charges or an assessment of liability.</p></div><p class="print-note">${hasPhotos ? "This file contains its selected images and needs no website connection." : "No photos are included in this file. It needs no website connection."} Open your browser's Print command and choose Save as PDF if needed. Review it before sharing; photos and notes can contain personal information.</p>${cards}<section class="reply"><h2>Your current response draft</h2><pre>${escapeHtml(caseReply(document))}</pre></section><section aria-label="General preparation guidance"><h2>${escapeHtml(RENTER_GUIDANCE.heading)}</h2><p>${escapeHtml(RENTER_GUIDANCE.scope)}</p><ol>${RENTER_GUIDANCE.steps.map(step => `<li>${escapeHtml(step)}</li>`).join("")}</ol><h3>Official guidance and evidence sources</h3><ul>${RENTER_GUIDANCE.links.map(({ label, href }) => `<li><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} (opens in a new tab)</a></li>`).join("")}</ul><p>General preparation guidance, not advice about your individual case. Links require an internet connection.</p></section><footer><p>Fair Wear is a prototype. This bundle does not establish authenticity, causation or liability and is not legal advice.</p></footer></main></body></html>`;
}
