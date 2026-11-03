import type { DecisionFinding } from "./decisions";
import type { CalculationBasis } from "./pipeline/types";

export interface F extends DecisionFinding {
  id: string;
  room: string;
  item: string;
  tenancyYears: number;
  usefulLifeYears?: number;
  ageYears?: number;
  calculationBasis?: CalculationBasis;
  apportionmentPct?: number;
  guidanceNote?: string;
  simulated?: boolean;
  before?: string;
  after?: string;
  evaluationNote?: string;
  provenance?: "precomputed_generated_sample";
}

/** Avoid rounding an under-threshold score up to the 90% decision boundary. */
export function confidenceLabel(confidence: number | null): string {
  if (confidence === null || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) return "unavailable";
  const rounded = Number((confidence * 100).toFixed(2));
  if (confidence < 0.9 && rounded >= 90) return "under 90%";
  if (confidence < 1 && rounded >= 100) return "over 99.99%";
  if (confidence > 0 && rounded === 0) return "under 0.01%";
  return `${rounded}%`;
}
