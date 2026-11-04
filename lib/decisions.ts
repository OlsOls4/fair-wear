// Per-finding default action for the tenant's reply. Tenant-safe: anything that is not a clear,
// confidently-judged tenant cost defaults to Dispute rather than being conceded.
import type { Verdict } from "./pipeline/types";
import { isMouldLike } from "./pipeline/guidance";

export type Decision = "agree" | "dispute" | "not_claimed";
export interface DecisionInput { verdict: Verdict | string; item: string; description: string; confidence: number }
export interface DefaultDecision { decision: Decision; reason: string }

/** Confidence at or above which a damage call is accepted by default. */
export const DAMAGE_AGREE_CONFIDENCE = 0.9;

export function defaultDecision({ verdict, item, description, confidence }: DecisionInput): DefaultDecision {
  const c = confidence > 1 ? confidence / 100 : confidence;
  switch (verdict) {
    case "no_change":
    case "added":
      return { decision: "not_claimed", reason: "No change found at move-out." };
    case "fair_wear":
      return { decision: "dispute", reason: "Fair wear and tear is not chargeable to the tenant." };
    case "cleaning":
      if (isMouldLike(`${item} ${description}`))
        return { decision: "dispute", reason: "Mould is often caused by damp or ventilation, not the tenant; never accepted by default." };
      return { decision: "agree", reason: "Cleaning back to the move-in standard is usually a fair charge." };
    case "damage":
    case "missing":
      if (c >= DAMAGE_AGREE_CONFIDENCE)
        return { decision: "agree", reason: `Clear damage (${Math.round(c * 100)}% confidence); a pro-rata share may be fair.` };
      return { decision: "dispute", reason: `Borderline call (${Math.round(c * 100)}% confidence); dispute and review the evidence.` };
    default:
      return { decision: "dispute", reason: "Unrecognised verdict; dispute by default." };
  }
}
