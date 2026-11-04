/** User-review defaults, not an assessment of legal liability. */
export type Decision = "Agree" | "Dispute" | "Not claimed";

export interface DecisionFinding {
  verdict: string;
  confidence: number | null;
  description: string;
}

export const DECISIONS: Decision[] = ["Agree", "Dispute", "Not claimed"];

export function defaultDecisionReason(finding: DecisionFinding): string {
  if (finding.verdict === "unresolved") return "The evidence is insufficient to establish a change. Dispute is suggested pending comparable records and human review.";
  if (finding.verdict === "no_change") return "No change was reported, so Not claimed is the suggested response.";
  if (finding.verdict === "fair_wear") return "The model reported fair wear, so the suggested response is Dispute.";
  if (finding.verdict === "cleaning") return /\bmou?ld\b/i.test(finding.description)
    ? "Mould needs review of cause and responsibility before accepting a cleaning charge."
    : "Ordinary cleaning is suggested as Agree, subject to your review of responsibility and cost.";
  if (finding.verdict === "damage") return defaultDecision(finding) === "Agree"
    ? "Damage confidence is at least 90%. Agree is only a suggested response, not proof of responsibility."
    : "Damage confidence is below 90% or unavailable, so the suggested response is Dispute.";
  return "This verdict has no specified default rule, so Dispute is suggested for review.";
}

/**
 * Confidence is on the pipeline's normalized 0..1 scale.
 * Missing/unknown verdicts and invalid damage confidence require review.
 */
export function defaultDecision(finding: DecisionFinding): Decision {
  switch (finding.verdict) {
    case "no_change":
      return "Not claimed";
    case "fair_wear":
      return "Dispute";
    case "cleaning":
      return /\bmo(?:u)?ld\b/i.test(finding.description) ? "Dispute" : "Agree";
    case "damage":
      return finding.confidence !== null && Number.isFinite(finding.confidence)
        && finding.confidence >= 0.9 && finding.confidence <= 1 ? "Agree" : "Dispute";
    default:
      return "Dispute";
  }
}
