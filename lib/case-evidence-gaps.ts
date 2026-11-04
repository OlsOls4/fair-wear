import type { CaseItem } from "./case-builder";

export const EVIDENCE_STATUS_LABELS = {
  unknown: "Unknown / not reviewed", provided: "Provided", requested: "Requested",
  unavailable: "Not available", not_applicable: "Not applicable",
} as const;
export type EvidenceStatus = keyof typeof EVIDENCE_STATUS_LABELS;
export type EvidenceKey = "moveIn" | "moveOut" | "cost" | "ageCondition";
export type EvidenceChecklist = Partial<Record<EvidenceKey, EvidenceStatus>>;
export const EVIDENCE_ITEMS: { key: EvidenceKey; label: string; request: string }[] = [
  { key: "moveIn", label: "Move-in records", request: "the dated move-in inventory and condition records" },
  { key: "moveOut", label: "Move-out records", request: "the dated move-out inspection and comparison records" },
  { key: "cost", label: "Itemised cost evidence", request: "an itemised cost breakdown with invoices or quotes supporting this deduction" },
  { key: "ageCondition", label: "Age and condition basis", request: "the item's age, starting condition and expected useful-life basis, and why repair or cleaning would not be appropriate" },
];
export const EVIDENCE_DISCLAIMER = "These are the reviewer's own tracking choices, not verified findings. Unknown means not reviewed, not absent. Provided does not authenticate a record, attach it to this bundle or establish liability. Nothing is sent.";
export function evidenceRows(item: CaseItem) {
  return EVIDENCE_ITEMS.filter(({ key }) => key !== "ageCondition" || item.costType === "replacement").map((entry) => {
    const candidate = item.evidenceChecklist?.[entry.key];
    const status: EvidenceStatus = candidate && Object.hasOwn(EVIDENCE_STATUS_LABELS, candidate) ? candidate : "unknown";
    return { ...entry, status };
  });
}
/** Unknown stays a conditional availability enquiry, never a claim that evidence is absent. */
export function evidenceRequests(item: CaseItem): string[] {
  if (!item.evidenceChecklist || item.response === "omit") return [];
  return evidenceRows(item).flatMap(({ status, request }) => {
    if (status === "provided" || status === "not_applicable") return [];
    if (status === "unknown") return [`Please confirm availability of ${request} and share any records not already supplied.`];
    if (status === "unavailable") return [`I have marked ${request} as not available in my review. Please explain any limitation and identify alternative supporting records, if available.`];
    return [`Please provide ${request}, which remains requested in my review.`];
  });
}
