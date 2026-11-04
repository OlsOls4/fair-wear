// Stage 3: propose conservative cross-visit correspondences, not verified physical identity.
// Score = label agreement + optional appearance cosine. Unregistered frame positions
// cannot identify an object across cameras/visits. Accept only mutually unique best candidates.
import type { Item, MatchedPair, MatchingResult, UnresolvedCorrespondence } from "./types";

const SYNONYMS: Record<string, string> = {
  rug: "carpet", flooring: "floor", "floorboards": "floor", drapes: "curtains", blind: "curtains", blinds: "curtains",
  countertop: "worktop", counter: "worktop", cooker: "oven", stove: "hob", couch: "sofa", settee: "sofa",
  closet: "wardrobe", cupboard: "wardrobe", "fridge freezer": "fridge", refrigerator: "fridge", basin: "sink", tub: "bath",
};

export function normLabel(label: string): string {
  const l = label.toLowerCase().replace(/_\d+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/s$/, (m) => (/(ss|us)$/.test(label) ? m : ""));
  return SYNONYMS[l] ?? l;
}

export function labelScore(a: string, b: string): number {
  const x = normLabel(a), y = normLabel(b);
  if (x === y) return 1;
  const tx = new Set(x.split(" ")), ty = new Set(y.split(" "));
  const inter = [...tx].filter((t) => ty.has(t)).length;
  return inter / Math.max(tx.size, ty.size); // "kitchen worktop" vs "worktop" = 0.5
}

export function cosine(a?: number[], b?: number[]): number | undefined {
  if (!a || !b || a.length !== b.length) return undefined;
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? d / Math.sqrt(na * nb) : undefined;
}

export function pairScore(b: Item, a: Item): number {
  if (b.room !== a.room) return 0;
  const ls = labelScore(b.label, a.label);
  if (ls < 0.5) return 0;
  let s = ls;
  const c = cosine(b.embedding, a.embedding);
  if (c !== undefined) s += c;              // appearance agreement, 0..1
  // Boxes are crop locations only. No verified registration exists in this pipeline;
  // position must not break same-label ties, even in nominally fixed-camera inputs.
  return s;
}

// Absolute score margin, not a confidence probability. Close alternatives require review.
export const MATCH_TIE_TOLERANCE = 0.05;
export function matchItems(before: Item[], after: Item[], minScore = 0.5, tieTolerance = MATCH_TIE_TOLERANCE): MatchingResult {
  if (!Number.isFinite(minScore) || minScore <= 0 || !Number.isFinite(tieTolerance) || tieTolerance < 0) {
    throw new Error("Matching requires a positive finite minScore and nonnegative finite tieTolerance");
  }
  type Candidate = { b: number; a: number; s: number };
  const byBefore: Candidate[][] = before.map(() => []), byAfter: Candidate[][] = after.map(() => []);
  before.forEach((b, i) => after.forEach((a, j) => {
    const s = pairScore(b, a);
    if (Number.isFinite(s) && s >= minScore) {
      const c = { b: i, a: j, s }; byBefore[i].push(c); byAfter[j].push(c);
    }
  }));
  // Evaluate ORIGINAL candidate sets once. Never promote a runner-up after consuming a match.
  const best = (cs: Candidate[]) => {
    if (!cs.length) return undefined;
    const max = Math.max(...cs.map(c => c.s));
    const top = cs.filter(c => max - c.s <= tieTolerance + 1e-12);
    return top.length === 1 ? top[0] : undefined;
  };
  const bb = byBefore.map(best), ba = byAfter.map(best);
  const ub = new Set<number>(), ua = new Set<number>();
  const pairs: MatchedPair[] = [];
  for (const c of bb) {
    if (!c || ba[c.a] !== c) continue;
    ub.add(c.b); ua.add(c.a);
    pairs.push({ room: before[c.b].room, label: normLabel(before[c.b].label), before: before[c.b], after: after[c.a], similarity: c.s });
  }
  const unresolved: UnresolvedCorrespondence[] = [];
  let beforeOnly = 0, afterOnly = 0;
  const matchedPairs = pairs.length;
  before.forEach((item, i) => {
    if (ub.has(i)) return;
    if (!byBefore[i].length) { beforeOnly++; pairs.push({ room: item.room, label: normLabel(item.label), before: item, similarity: 0 }); }
    else unresolved.push({ status: "needs_review", side: "before", item, reason: bb[i] ? "not_mutually_unique" : "tied_best", candidates: byBefore[i].map(c => ({ item: after[c.a], similarity: c.s })) });
  });
  after.forEach((item, i) => {
    if (ua.has(i)) return;
    if (!byAfter[i].length) { afterOnly++; pairs.push({ room: item.room, label: normLabel(item.label), after: item, similarity: 0 }); }
    else unresolved.push({ status: "needs_review", side: "after", item, reason: ba[i] ? "not_mutually_unique" : "tied_best", candidates: byAfter[i].map(c => ({ item: before[c.b], similarity: c.s })) });
  });
  return { pairs, unresolved, minScore, tieTolerance, coverage: {
    beforeItems: before.length, afterItems: after.length, matchedPairs, beforeOnly, afterOnly,
    unresolvedBefore: unresolved.filter(x => x.side === "before").length,
    unresolvedAfter: unresolved.filter(x => x.side === "after").length,
    resolvedItems: 2 * matchedPairs + beforeOnly + afterOnly, totalItems: before.length + after.length,
  } };
}

export type ChangeStatus = "added" | "removed" | "moved" | "unchanged" | "unresolved";
/** Matching alone cannot prove addition/removal: a missed detection or absent view looks the same. */
// Handheld walkthroughs move the camera, so "moved" can't come from box positions;
// it is set on the pair by the Muse Spark comparison (item.moved).
export function changeStatus(p: MatchedPair): ChangeStatus {
  if (!p.before || !p.after) return "unresolved";
  return p.before.moved || p.after.moved ? "moved" : "unchanged";
}
