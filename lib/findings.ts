import type { DecisionFinding } from "./decisions";

export interface F extends DecisionFinding {
  id: string;
  room: string;
  item: string;
  tenancyYears: number;
  usefulLifeYears?: number;
  apportionmentPct?: number;
  guidanceNote?: string;
  simulated?: boolean;
  before?: string;
  after?: string;
  evaluationNote?: string;
}
