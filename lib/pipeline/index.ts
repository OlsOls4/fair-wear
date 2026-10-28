import type { EvidencePack, Finding, Item, MatchedPair } from "./types";
import { museImageCard, museSparkJSON, museSparkText, sam31Track } from "./models";
import { guidanceFor } from "./guidance";

// Stage 1: frames come from client-side sampling (1 fps) or ffmpeg on upload.
// Stage 2: SAM 3.1 tracks rental-relevant items per room video.
export const ITEM_PROMPTS = ["wall", "carpet", "floor", "skirting board", "door", "window", "curtains", "worktop", "hob", "oven", "fridge", "sink", "bath", "shower screen", "toilet", "mattress", "sofa", "table", "wardrobe"];

export async function extractItems(videoUrl: string, visit: Item["visit"], room: string, prompts: string[] = ITEM_PROMPTS, frames = 900): Promise<Item[]> {
  // SAM 3.1 takes one concept per request, so run the item list in parallel batches.
  const items: Item[] = [];
  const batches = [];
  for (let i = 0; i < prompts.length; i += 6) batches.push(prompts.slice(i, i + 6));
  for (const batch of batches) {
    const results = await Promise.all(batch.map((c) => sam31Track({ video_url: videoUrl }, c, frames).then((r) => [c, r] as const)));
    for (const [label, recs] of results) {
      const byId = new Map<number, typeof recs>();
      recs.forEach((r) => byId.set(r.id, [...(byId.get(r.id) ?? []), r]));
      for (const [oid, rs] of byId) {
        // best frame = largest confident box
        const best = rs.reduce((a, b) => ((b.box[2] - b.box[0]) * (b.box[3] - b.box[1]) * (b.conf ?? 1) > (a.box[2] - a.box[0]) * (a.box[3] - a.box[1]) * (a.conf ?? 1) ? b : a));
        const box = best.w && best.h ? ([best.box[0] / best.w, best.box[1] / best.h, best.box[2] / best.w, best.box[3] / best.h] as [number, number, number, number]) : undefined;
        items.push({ id: `${visit}-${room}-${label}-${oid}`, visit, room, label, box, maskRle: best.mask, bestFrame: { visit, room, t: best.frame, url: videoUrl } });
      }
    }
  }
  return items;
}

// Stage 3: matching lives in ./matching (label + appearance + position, greedy one-to-one).
export { matchItems, changeStatus, normLabel } from "./matching";

// Stage 4: judge each pair against scheme guidance.
export async function judge(pair: MatchedPair, tenancyYears: number): Promise<Finding> {
  const g = guidanceFor(pair.label);
  const out = await museSparkJSON<Partial<Finding>>(
    "You are a UK tenancy deposit adjudication assistant. Compare BEFORE and AFTER crops of the same item. Return JSON {verdict, confidence, description, apportionmentPct}. Fair wear and tear is deterioration from reasonable use over time; damage is beyond that. Apportion by remaining useful life.",
    JSON.stringify({ item: pair.label, room: pair.room, tenancyYears, usefulLifeYears: g.usefulLifeYears }),
    [pair.before?.bestFrame.url, pair.after?.bestFrame.url].filter(Boolean) as string[],
  );
  return { pair, verdict: out.verdict ?? "no_change", confidence: out.confidence ?? 0.5, description: out.description ?? "", usefulLifeYears: g.usefulLifeYears, tenancyYears, apportionmentPct: out.apportionmentPct, guidanceRefs: g.refs };
}

// Stage 5: cards + pack.
export async function buildPack(property: string, findings: Finding[]): Promise<EvidencePack> {
  for (const f of findings.filter((x) => x.verdict !== "no_change")) {
    f.cardUrl = await museImageCard(`Clean evidence card graphic titled "${f.pair.room}: ${f.pair.label}" with verdict "${f.verdict.replace("_", " ")}" and the note "${f.description.slice(0, 120)}". Minimal, legible, neutral colours.`);
  }
  const replyDraft = await museSparkText("Draft a polite, firm reply from a UK tenant to a landlord's deposit deduction list, citing each finding and the deposit scheme's fair wear and tear guidance. Plain British English.", JSON.stringify(findings.map((f) => ({ room: f.pair.room, item: f.pair.label, verdict: f.verdict, description: f.description, apportionmentPct: f.apportionmentPct }))));
  return { property, generatedAt: new Date().toISOString(), findings, replyDraft };
}
