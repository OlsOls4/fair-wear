export type Visit = "move_in" | "move_out";
export type Verdict = "no_change" | "fair_wear" | "damage" | "cleaning" | "missing" | "added";

export interface Frame { visit: Visit; room: string; t: number; url: string }
export interface Item {
  id: string; visit: Visit; room: string; label: string;      // e.g. "carpet", "kitchen worktop"
  maskRle?: string; bestFrame: Frame; embedding?: number[];
  box?: [number, number, number, number];                     // normalised 0..1 in bestFrame
  moved?: boolean;                                            // set by Muse Spark pair check
}
export interface MatchedPair { room: string; label: string; before?: Item; after?: Item; similarity: number }
export interface Finding {
  pair: MatchedPair; verdict: Verdict; confidence: number;
  description: string;                 // what changed, in plain English
  usefulLifeYears?: number; ageYears?: number; tenancyYears?: number;
  apportionmentPct?: number;           // share a tenant could fairly bear, 0-100
  guidanceRefs: string[];              // e.g. "TDS: fair wear and tear guide"
  cardUrl?: string;                    // Muse Image comparison card
}
export interface EvidencePack { property: string; generatedAt: string; findings: Finding[]; replyDraft: string }
