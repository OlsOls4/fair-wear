// Background examples and deterministic illustration only, not a liability assessment.
// These example lifespans are not scheme-prescribed values or evidence of an item's quality.
import type { Verdict, CalculationBasis, ShareCalculation } from "./types";

export interface Guide { usefulLifeYears: number; note: string }
const TABLE: Record<string, Guide> = {
  carpet: { usefulLifeYears: 7, note: "Flattening and fading can reflect ordinary use; assess stains and tears in context." },
  floor: { usefulLifeYears: 10, note: "Compare light scuffs and deep gouges with the starting condition and evidence of cause." },
  wall: { usefulLifeYears: 4, note: "Paint marks can reflect ordinary use; compare the starting condition and context." },
  "skirting board": { usefulLifeYears: 10, note: "Scuffs, broken sections and gouges need comparison with the starting condition." },
  door: { usefulLifeYears: 15, note: "Compare handle wear, holes and splits with the starting condition and evidence of cause." },
  window: { usefulLifeYears: 20, note: "Condensation marks and cracks need context about cause and starting condition." },
  curtains: { usefulLifeYears: 5, note: "Fading can reflect use; stains and tears need evidence of cause and whether cleaning would help." },
  worktop: { usefulLifeYears: 15, note: "Surface marks, burns and cuts need comparison with the starting condition and cause." },
  hob: { usefulLifeYears: 10, note: "Grease may be removable; cracked glass needs evidence of cause and starting condition." },
  oven: { usefulLifeYears: 10, note: "Visible grease may call for cleaning; compare the starting condition." },
  fridge: { usefulLifeYears: 8, note: "Compare cleanliness and condition with the move-in record." },
  sink: { usefulLifeYears: 15, note: "Limescale may be removable; chips need comparison with the starting condition." },
  bath: { usefulLifeYears: 20, note: "Surface wear and chips need comparison with the starting condition and cause." },
  "shower screen": { usefulLifeYears: 10, note: "Limescale may be removable; cracks need evidence of cause and starting condition." },
  toilet: { usefulLifeYears: 15, note: "Compare cleanliness and cracks with the starting condition; do not infer cause from images alone." },
  mattress: { usefulLifeYears: 7, note: "Sagging can reflect use; stains and burns need comparison with the starting condition." },
  sofa: { usefulLifeYears: 8, note: "Compression can reflect use; rips and stains need comparison with the starting condition." },
  table: { usefulLifeYears: 10, note: "Light surface marks can reflect use; compare the starting condition." },
  wardrobe: { usefulLifeYears: 15, note: "Compare scuffs and broken parts with the starting condition and evidence of cause." },
};
export const SCHEME_REFS = ["TDS: Fair wear and tear guide", "DPS: Deposit deductions guidance", "mydeposits: Betterment and apportionment"];

export function guidanceFor(label: string) {
  const key = label.trim().toLowerCase();
  const g = Object.hasOwn(TABLE, key) ? TABLE[key] : undefined;
  return {
    // Retained for existing sample-generation callers. Never use as an item-specific input.
    usefulLifeYears: g?.usefulLifeYears,
    lifespanBasis: "background_example" as const,
    note: `${g?.note ?? "Assess the observed change in context."} Background example only: actual lifespan depends on quality, condition and use. Images alone do not establish age, cause or responsibility.`,
    refs: SCHEME_REFS,
  };
}
export const KNOWN_LABELS = Object.keys(TABLE);


const nonNegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Remaining-life illustration, never an agreed deduction or an assessment of liability.
 * Explicit inputs must describe this item, not be silently inferred from its label.
 * Quality basis records the supplied quality/condition assumption; it does not verify it.
 */
export function calculateShare(verdict: Verdict, tenancyYears: number, ageAtMoveInYears?: number, basis?: CalculationBasis): ShareCalculation {
  if (verdict !== "damage" && verdict !== "missing") {
    return { status: "not_applicable", missingInputs: [], note: "No replacement-life calculation applies. Classification alone does not establish a charge." };
  }
  const missingInputs: ShareCalculation["missingInputs"] = [];
  if (!nonNegative(ageAtMoveInYears)) missingInputs.push("age_at_move_in");
  if (!nonNegative(tenancyYears)) missingInputs.push("tenancy_length");
  if (!nonNegative(basis?.usefulLifeYears) || basis!.usefulLifeYears <= 0) missingInputs.push("useful_life");
  if (typeof basis?.qualityBasis !== "string" || !basis.qualityBasis.trim()) missingInputs.push("quality_basis");
  if (missingInputs.length) return {
    status: "needs_inputs", missingInputs,
    note: "No percentage estimated. Supply item age at move-in, tenancy length, expected useful life and the quality/condition basis. Costs, cause and responsibility still need separate evidence.",
  };
  // Inputs have been validated above. Addition overflow is harmless: it means no remaining life.
  const age = ageAtMoveInYears! + tenancyYears;
  const percentage = Math.round(Math.max(0, Math.min(1, 1 - age / basis!.usefulLifeYears)) * 100);
  return {
    status: "illustrative", percentage, missingInputs: [],
    note: "Remaining-life illustration using supplied age, lifespan and quality/condition assumptions, not verified facts or tenant liability. Repair options, costs, cause and responsibility need separate evidence.",
  };
}

/** Legacy numeric wrapper. Label never supplies age, quality or lifespan.
 * Cleaning has no replacement-life percentage. Zero for unchanged/wear/added is
 * retained for callers, but is not a legal determination about any proposed claim.
 */
export function apportion(verdict: Verdict, _label: string, tenancyYears: number, ageAtMoveInYears?: number, basis?: CalculationBasis): number | undefined {
  if (verdict === "no_change" || verdict === "fair_wear" || verdict === "added") return 0;
  return calculateShare(verdict, tenancyYears, ageAtMoveInYears, basis).percentage;
}
