export type Visit = "move_in" | "move_out";
export type Verdict = "no_change" | "fair_wear" | "damage" | "cleaning" | "missing" | "added" | "unresolved";

export interface Frame { visit: Visit; room: string; t: number; url: string }
export interface Item {
  id: string; visit: Visit; room: string; label: string;      // e.g. "carpet", "kitchen worktop"
  maskRle?: string; bestFrame: Frame; embedding?: number[];
  box?: [number, number, number, number];                     // normalised 0..1 in bestFrame
  moved?: boolean;                                            // set by Muse Spark pair check
}
export interface MatchedPair { room: string; label: string; before?: Item; after?: Item; similarity: number }
/** An item with plausible candidates but no mutually unique correspondence. Never a verdict. */
export interface UnresolvedCorrespondence {
  status: "needs_review";
  side: "before" | "after";
  item: Item;
  reason: "tied_best" | "not_mutually_unique";
  candidates: { item: Item; similarity: number }[];
}
export interface MatchingCoverage {
  beforeItems: number; afterItems: number;
  matchedPairs: number; beforeOnly: number; afterOnly: number;
  unresolvedBefore: number; unresolvedAfter: number;
  resolvedItems: number; totalItems: number;
}
export interface MatchingResult {
  pairs: MatchedPair[];
  unresolved: UnresolvedCorrespondence[];
  coverage: MatchingCoverage;
  minScore: number;
  tieTolerance: number;
}
export interface CalculationBasis {
  usefulLifeYears: number;            // explicitly supplied, never inferred from item label
  qualityBasis: string;               // supplied quality/condition assumption, not verification
}
export interface ShareCalculation {
  status: "not_applicable" | "needs_inputs" | "illustrative";
  percentage?: number;
  missingInputs: ("age_at_move_in" | "tenancy_length" | "useful_life" | "quality_basis")[];
  note: string;
}
export interface Finding {
  pair: MatchedPair; verdict: Verdict; confidence: number | null; // null when no model judgement was made
  judgementSource?: "model" | "evidence_gap"; // absent on preserved legacy findings
  description: string;                 // what changed, in plain English
  usefulLifeYears?: number; ageYears?: number; tenancyYears?: number;
  apportionmentPct?: number;           // legacy field: illustrative remaining-life share, never liability
  calculationBasis?: CalculationBasis;
  shareCalculation?: ShareCalculation; // optional for backward compatibility with cached findings
  guidanceRefs: string[];              // e.g. "TDS: fair wear and tear guide"
  simulated?: boolean;                 // true when produced in MOCK mode or from planted/generated demo data
  cardUrl?: string;                    // Muse Image comparison card
}
export interface EvidencePack { property: string; generatedAt: string; findings: Finding[]; replyDraft: string; correspondence?: (MatchingResult & { room: string })[] }
