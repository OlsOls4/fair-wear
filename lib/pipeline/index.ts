import type { CalculationBasis, EvidencePack, Finding, Item, MatchedPair } from "./types";
import { MOCK, museImageCard, museSparkJSON, museSparkText } from "./models";
import { calculateShare, guidanceFor } from "./guidance";
import { JUDGE_SCHEMA } from "./schema";
import { judgePair } from "./judgement";
import { JUDGE_SYSTEM, REPLY_SYSTEM } from "./prompts";

// The end-to-end video path is disabled until verified frame extraction/cropping is wired in.
// The separate offline still-image runner remains available.
export const ITEM_PROMPTS = ["wall", "carpet", "floor", "skirting board", "door", "window", "curtains", "worktop", "hob", "oven", "fridge", "sink", "bath", "shower screen", "toilet", "mattress", "sofa", "table", "wardrobe"];

export { UnsupportedVideoAnalysisError } from "./video-support";
import { UnsupportedVideoAnalysisError } from "./video-support";

/** Reserved video-pipeline entrypoint. Never treat a video URL/frame index as an image.
 * Keep this signature for callers, but reject before sampling, SAM, matching or Spark.
 * Still-image inference is independently implemented in scripts/run-demo.ts.
 */
export async function extractItems(_videoUrl: string, _visit: Item["visit"], _room: string, _prompts: string[] = ITEM_PROMPTS, _frames = 900): Promise<Item[]> {
  throw new UnsupportedVideoAnalysisError();
}

// Stage 3: matching lives in ./matching (label + optional appearance, mutually unique best; no unregistered position).
export { matchItems, changeStatus, normLabel } from "./matching";

// Stage 4: judge each pair. Muse Spark classifies (schema-validated, one retry); guidance.ts apportions deterministically.
export { JudgeValidationError } from "./judgement";

export async function judge(pair: MatchedPair, tenancyYears: number, ageAtMoveInYears?: number, basis?: CalculationBasis): Promise<Finding> {
  const g = guidanceFor(pair.label);
  const urls = [pair.before?.bestFrame?.url, pair.after?.bestFrame?.url].filter(Boolean) as string[];
  const user = JSON.stringify({ item: pair.label, room: pair.room, tenancyYears, guidance: g.note, before: pair.before ? "BEFORE image attached first" : "no BEFORE crop", after: pair.after ? "AFTER image attached" : "no AFTER crop" });
  return judgePair(pair, { tenancyYears, ageAtMoveInYears, basis, simulated: MOCK }, MOCK ? undefined : (previousError) =>
    museSparkJSON<unknown>(JUDGE_SYSTEM, previousError ? `${user}\nYour previous reply was invalid (${previousError}). Return only the JSON object.` : user, urls, JUDGE_SCHEMA as unknown as Record<string, unknown>));
}

// Stage 5: cards + pack.
export async function buildPack(property: string, findings: Finding[]): Promise<EvidencePack> {
  for (const f of findings.filter((x) => x.verdict !== "no_change" && x.verdict !== "unresolved")) {
    f.cardUrl = await museImageCard(`Clean evidence card graphic titled "${f.pair.room}: ${f.pair.label}" with verdict "${f.verdict.replace("_", " ")}" and the note "${f.description.slice(0, 120)}". Minimal, legible, neutral colours.`);
  }
  const replyDraft = await museSparkText(`${REPLY_SYSTEM} Do not infer acceptance or liability from a classification or percentage. Any remaining-life maths is illustrative only. Missing inputs require evidence, not a guessed number.`, JSON.stringify(findings.map((f) => ({
    room: f.pair.room, item: f.pair.label, verdict: f.verdict, description: f.description,
    // Recalculate rather than trusting an old percentage stored without its assumptions.
    shareCalculation: calculateShare(f.verdict, f.tenancyYears!, f.ageYears, f.calculationBasis),
    calculationBasis: f.calculationBasis, ageAtMoveInYears: f.ageYears, tenancyYears: f.tenancyYears,
  }))));
  return { property, generatedAt: new Date().toISOString(), findings, replyDraft };
}
