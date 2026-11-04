/** Deterministic analysis of persisted observations. No model inference or API imports. */
import { normLabel } from "../pipeline/matching";

export interface Observation {
  id: string; room: string; item: string; verdict: string; confidence: number;
  description: string; before?: string; after?: string;
}
export interface PlantedRoom {
  room: string; moveIn: string; moveOut: string;
  planted: { item: string; verdict: string }[];
}
export type Outcome = "exact" | "wrong_verdict" | "no_change" | "no_record" | "withheld" | "false_alarm" | "unchanged";
export interface EvidenceCase {
  id: string; room: string; item: string; expected: string | null;
  moveIn: string; moveOut: string; observations: Observation[];
}
export interface CaseResult extends EvidenceCase {
  retained: Observation[]; flagged: Observation[]; exact: boolean;
  outcome: Outcome; distinctVerdicts: string[];
}
export const pretty = (value: string) => value.replaceAll("_", " ").replaceAll("-", " ");
export const caseId = (room: string, item: string) => `${room}/${normLabel(item)}`;

export function buildEvidenceCases(observations: Observation[], rooms: PlantedRoom[]): EvidenceCase[] {
  const cases = new Map<string, EvidenceCase>();
  for (const room of rooms) {
    for (const expected of room.planted) {
      const id = caseId(room.room, expected.item);
      if (cases.has(id)) throw new Error(`Duplicate planted item: ${id}`);
      cases.set(id, { id, room: room.room, item: expected.item, expected: expected.verdict, moveIn: room.moveIn, moveOut: room.moveOut, observations: [] });
    }
  }
  const ids = new Set<string>();
  for (const observation of observations) {
    if (ids.has(observation.id)) throw new Error(`Duplicate observation: ${observation.id}`);
    ids.add(observation.id);
    const room = rooms.find((r) => r.room === observation.room);
    if (!room) throw new Error(`No input room for ${observation.id}`);
    const id = caseId(observation.room, observation.item);
    if (!cases.has(id)) cases.set(id, { id, room: room.room, item: observation.item, expected: null, moveIn: room.moveIn, moveOut: room.moveOut, observations: [] });
    cases.get(id)!.observations.push(observation);
  }
  return Array.from(cases.values());
}

export function analyzeEvidence(cases: EvidenceCase[], threshold = 0) {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error("Threshold must be between 0 and 1.");
  const rows: CaseResult[] = cases.map((item) => {
    const retained = item.observations.filter((o) => Number.isFinite(o.confidence) && o.confidence >= threshold && o.confidence >= 0 && o.confidence <= 1);
    const flagged = retained.filter((o) => o.verdict !== "no_change");
    const exact = item.expected !== null && retained.some((o) => o.verdict === item.expected);
    const outcome: Outcome = !item.observations.length ? "no_record" : !retained.length ? "withheld" : item.expected === null ? (flagged.length ? "false_alarm" : "unchanged") : exact ? "exact" : flagged.length ? "wrong_verdict" : "no_change";
    return { ...item, retained, flagged, exact, outcome, distinctVerdicts: [...new Set(retained.map((o) => o.verdict))] };
  });
  const planted = rows.filter((r) => r.expected !== null);
  const unplanted = rows.filter((r) => r.expected === null);
  const all = rows.flatMap((r) => r.observations);
  return {
    threshold, rows,
    observationCount: all.length,
    retainedCount: rows.reduce((n, r) => n + r.retained.length, 0),
    planted: planted.length,
    detected: planted.filter((r) => r.flagged.length).length,
    exactVerdict: planted.filter((r) => r.exact).length,
    damagePlanted: planted.filter((r) => r.expected === "damage").length,
    damageFound: planted.filter((r) => r.expected === "damage" && r.exact).length,
    decoys: planted.filter((r) => r.expected === "fair_wear").length,
    decoysWronglyDamage: planted.filter((r) => r.expected === "fair_wear" && r.flagged.some((o) => o.verdict === "damage")).length,
    unplantedItemsChecked: unplanted.reduce((n, r) => n + r.observations.length, 0),
    falseAlarms: unplanted.reduce((n, r) => n + r.flagged.length, 0),
    missingRecords: planted.filter((r) => !r.observations.length).length,
  };
}

export const outcomeLabels: Record<Outcome, string> = {
  exact: "Expected label found", wrong_verdict: "Wrong change label", no_change: "Change missed", no_record: "No saved observation",
  withheld: "All observations withheld", false_alarm: "Unplanted change flag", unchanged: "No change flagged",
};

export function explainCase(row: CaseResult): string {
  switch (row.outcome) {
    case "no_record": return "No matched crop pair or judge result was saved for this item. The published evaluation calls it ‘not segmented’. Without raw segmentation responses, the exact failure stage cannot be independently reconstructed.";
    case "withheld": return "The saved observations are below this threshold or have invalid confidence. Withheld is not the same as no change; a person still needs to inspect the evidence.";
    case "no_change": return `The test design planted ${pretty(row.expected!)}. Retained observations say no change, so this test change was missed.`;
    case "wrong_verdict": return `The test design planted ${pretty(row.expected!)}. The retained model observations flagged a change, but none used the expected label.`;
    case "false_alarm": return "This item has no planted change, yet a retained observation flags one. This is a false alarm relative to the test design, not independent proof that the generated pixels are unchanged.";
    case "unchanged": return "This item has no planted change, and retained model observations do not flag a change. The test intent is not an independent annotation of every generated pixel.";
    case "exact": return row.distinctVerdicts.length > 1
      ? "At least one retained crop observation has the expected label. Other crops disagree. The published item-level scoring counts any exact match; it does not require agreement across crops."
      : "At least one retained observation matches the planted test label. That is a fixture result, not proof of accuracy on real homes or tenant responsibility.";
  }
}
