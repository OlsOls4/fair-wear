// Stage 3: match the same object across visits.
// Score = label agreement (exact or synonym) + appearance cosine (when an embedding is
// present) + where it sits in the frame. Greedy one-to-one assignment, best score first.
import type { Item, MatchedPair } from "./types";

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

function centre(i: Item) {
  const b = i.box; if (!b) return undefined;
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] as const;
}

export function pairScore(b: Item, a: Item): number {
  if (b.room !== a.room) return 0;
  const ls = labelScore(b.label, a.label);
  if (ls < 0.5) return 0;
  let s = ls;
  const c = cosine(b.embedding, a.embedding);
  if (c !== undefined) s += c;              // appearance agreement, 0..1
  const cb = centre(b), ca = centre(a);
  if (cb && ca) s += 0.25 * (1 - Math.min(1, Math.hypot(cb[0] - ca[0], cb[1] - ca[1]))); // normalised coords
  return s;
}

export function matchItems(before: Item[], after: Item[], minScore = 0.5): MatchedPair[] {
  const cands: { b: number; a: number; s: number }[] = [];
  before.forEach((b, i) => after.forEach((a, j) => { const s = pairScore(b, a); if (s >= minScore) cands.push({ b: i, a: j, s }); }));
  cands.sort((x, y) => y.s - x.s);
  const ub = new Set<number>(), ua = new Set<number>();
  const pairs: MatchedPair[] = [];
  for (const c of cands) {
    if (ub.has(c.b) || ua.has(c.a)) continue;
    ub.add(c.b); ua.add(c.a);
    const b = before[c.b], a = after[c.a];
    pairs.push({ room: b.room, label: normLabel(b.label), before: b, after: a, similarity: c.s });
  }
  before.forEach((b, i) => { if (!ub.has(i)) pairs.push({ room: b.room, label: normLabel(b.label), before: b, similarity: 0 }); });
  after.forEach((a, j) => { if (!ua.has(j)) pairs.push({ room: a.room, label: normLabel(a.label), after: a, similarity: 0 }); });
  return pairs;
}

export type ChangeStatus = "added" | "removed" | "moved" | "unchanged";
/** Object-level change call from matched pairs (used for the SceneDiff benchmark). */
// Handheld walkthroughs move the camera, so "moved" can't come from box positions;
// it is set on the pair by the Muse Spark comparison (item.moved).
export function changeStatus(p: MatchedPair): ChangeStatus {
  if (!p.after) return "removed";
  if (!p.before) return "added";
  return p.before.moved || p.after.moved ? "moved" : "unchanged";
}
