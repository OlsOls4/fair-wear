// UK deposit adjudication guidance, encoded as data + deterministic maths.
// Useful-life figures are the indicative ones adjudicators commonly apply when apportioning the cost of
// replacing an item (betterment). They are NOT legal advice; check the current TDS / DPS / mydeposits guidance.
// The LLM never does the arithmetic: Muse Spark classifies the change, this module apportions it.
import type { Verdict } from "./types";

export interface Guide { usefulLifeYears: number; note: string }
const TABLE: Record<string, Guide> = {
  carpet: { usefulLifeYears: 7, note: "Carpet is expected to flatten and fade in high-traffic areas." },
  floor: { usefulLifeYears: 10, note: "Hard flooring: light scuffing is wear; deep gouges are damage." },
  wall: { usefulLifeYears: 4, note: "Paint lasts about 4 years; small nail holes and light marks are wear." },
  "skirting board": { usefulLifeYears: 10, note: "Light scuffs are wear; broken or gouged sections are damage." },
  door: { usefulLifeYears: 15, note: "Minor handle wear is expected; holes and splits are damage." },
  window: { usefulLifeYears: 20, note: "Condensation marks are not tenant damage; cracks usually are." },
  curtains: { usefulLifeYears: 5, note: "Fading is wear; stains and tears are damage or cleaning." },
  worktop: { usefulLifeYears: 15, note: "Light knife marks are wear; burns and deep cuts are damage." },
  hob: { usefulLifeYears: 10, note: "Grease is a cleaning matter; cracked glass is damage." },
  oven: { usefulLifeYears: 10, note: "Grease is a cleaning matter." },
  fridge: { usefulLifeYears: 8, note: "Defrost and clean at end of tenancy." },
  sink: { usefulLifeYears: 15, note: "Limescale is cleaning; chips are damage." },
  bath: { usefulLifeYears: 20, note: "Surface wear is expected; chips are damage." },
  "shower screen": { usefulLifeYears: 10, note: "Limescale is cleaning; cracks are damage." },
  toilet: { usefulLifeYears: 15, note: "Cleaning matter unless cracked." },
  mattress: { usefulLifeYears: 7, note: "Light sagging is wear; stains and burns are damage." },
  sofa: { usefulLifeYears: 8, note: "Seat compression is wear; rips and stains are damage." },
  table: { usefulLifeYears: 10, note: "Light surface marks are wear." },
  wardrobe: { usefulLifeYears: 15, note: "Light scuffs are wear; broken doors are damage." },
};
export const SCHEME_REFS = ["TDS: Fair wear and tear guide", "DPS: Deposit deductions guidance", "mydeposits: Betterment and apportionment"];

export function guidanceFor(label: string) {
  const g = TABLE[label.toLowerCase()];
  return { usefulLifeYears: g?.usefulLifeYears, note: g?.note ?? "", refs: SCHEME_REFS };
}
export const KNOWN_LABELS = Object.keys(TABLE);

/**
 * Share of the cost a tenant could fairly bear, 0-100.
 * - fair_wear / no_change: 0 (the landlord can't deduct for ordinary wear).
 * - cleaning: 100 (a cleaning cost isn't depreciated).
 * - damage / missing: the item's remaining useful life. A 4-year wall painted at move-in, damaged after 2 years -> 50%.
 *   `ageAtMoveInYears` is how old the item already was at move-in (0 = new), so older items give the tenant less to pay.
 * - added: 0 (nothing to apportion).
 * Returns undefined when the item's useful life is unknown, so the pack says "needs a quote" rather than guessing.
 */
export function apportion(verdict: Verdict, label: string, tenancyYears: number, ageAtMoveInYears = 0): number | undefined {
  if (verdict === "no_change" || verdict === "fair_wear" || verdict === "added") return 0;
  if (verdict === "cleaning") return 100;
  const life = guidanceFor(label).usefulLifeYears;
  if (!life) return undefined;
  const age = Math.max(0, ageAtMoveInYears) + Math.max(0, tenancyYears);
  return Math.round(Math.max(0, Math.min(1, 1 - age / life)) * 100);
}
