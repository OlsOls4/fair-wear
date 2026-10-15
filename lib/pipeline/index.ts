import type { EvidencePack, Finding, Item, MatchedPair } from "./types";
import { museImageCard, museSparkJSON, sam31Track } from "./models";
import { guidanceFor } from "./guidance";

// Stage 1: frames come from client-side sampling (1 fps) or ffmpeg on upload.
// Stage 2: SAM 3.1 tracks rental-relevant items per room video.
export const ITEM_PROMPTS = ["wall", "carpet", "floor", "skirting board", "door", "window", "curtains", "worktop", "hob", "oven", "fridge", "sink", "bath", "shower screen", "toilet", "mattress", "sofa", "table", "wardrobe"];

export async function extractItems(videoUrl: string, visit: Item["visit"], room: string): Promise<Item[]> {
  const tracks = await sam31Track(videoUrl, ITEM_PROMPTS);
  return tracks.map((t) => ({ id: `${visit}-${room}-${t.id}`, visit, room, label: t.label, bestFrame: { visit, room, t: t.frames[0] ?? 0, url: videoUrl } }));
}

// Stage 3: match same object across visits (label + embedding cosine; Muse Spark tie-break).
export function matchItems(before: Item[], after: Item[]): MatchedPair[] {
  const used = new Set<string>();
  const pairs: MatchedPair[] = before.map((b) => {
    const a = after.find((x) => !used.has(x.id) && x.room === b.room && x.label === b.label);
    if (a) used.add(a.id);
    return { room: b.room, label: b.label, before: b, after: a, similarity: a ? 1 : 0 };
  });
  after.filter((a) => !used.has(a.id)).forEach((a) => pairs.push({ room: a.room, label: a.label, after: a, similarity: 0 }));
  return pairs;
}

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
    f.cardUrl = await museImageCard(`Annotated before/after comparison card: ${f.pair.label}, ${f.verdict}`, [f.pair.before?.bestFrame.url, f.pair.after?.bestFrame.url].filter(Boolean) as string[]);
  }
  const replyDraft = await museSparkJSON<string>("Draft a polite, firm reply to a landlord's deduction list, citing each finding.", JSON.stringify(findings));
  return { property, generatedAt: new Date().toISOString(), findings, replyDraft: typeof replyDraft === "string" ? replyDraft : "" };
}
