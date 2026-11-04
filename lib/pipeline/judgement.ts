import { validateJudge, type JudgeOut } from "./schema";
import type { CalculationBasis, Finding, MatchedPair } from "./types";
import { apportion, calculateShare, guidanceFor } from "./guidance";

export class JudgeValidationError extends Error {
  readonly code = "JUDGE_VALIDATION_FAILED";
  constructor(reason: string) {
    super(`Model judgement unavailable: ${reason}`);
    this.name = "JudgeValidationError";
  }
}

// Keep the validation boundary independent of the model transport so malformed
// replies and bounded retries can be tested without credentials or paid calls.
export async function requestValidatedJudgement(request: (previousError?: string) => Promise<unknown>): Promise<JudgeOut> {
  let lastError: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = validateJudge(await request(lastError));
      if (result.ok) return result.value;
      lastError = result.error;
    } catch (error) {
      // Only malformed JSON gets a validation retry. Budget, network and other
      // failures must remain failures, never classifications or hidden retries.
      if (!(error instanceof SyntaxError)) throw error;
      lastError = "response was not valid JSON";
    }
  }
  throw new JudgeValidationError(lastError!);
}

/** An absent detection/crop is not evidence that an object was added or removed.
 * This guard runs before model transport, including outside MOCK mode.
 */
export function comparisonGap(pair: MatchedPair): string | undefined {
  if (!pair.before && !pair.after) return "Neither visit has an item observation. No change can be assessed; provide comparable move-in and move-out evidence.";
  if (!pair.before) return "No matched move-in observation was supplied. This does not show that the item was added; provide comparable evidence from both visits.";
  if (!pair.after) return "No matched move-out observation was supplied. This does not show that the item is missing; provide comparable evidence from both visits.";
  if (![pair.before.bestFrame?.url, pair.after.bestFrame?.url].every((url) => typeof url === "string" && url.trim())) {
    return "Comparison imagery is unavailable for one or both visits. No change can be assessed; provide comparable move-in and move-out evidence.";
  }
}

/** Pure orchestration boundary: tests can supply replies without model calls or spend. */
export async function judgePair(
  pair: MatchedPair,
  options: { tenancyYears: number; ageAtMoveInYears?: number; basis?: CalculationBasis; simulated?: boolean },
  request?: (previousError?: string) => Promise<unknown>,
): Promise<Finding> {
  const gap = comparisonGap(pair);
  if (!gap && !request) throw new JudgeValidationError("No model judgement is available in MOCK mode.");
  const out = gap ? undefined : await requestValidatedJudgement(request!);
  const verdict = out?.verdict ?? "unresolved";
  const { tenancyYears, ageAtMoveInYears, basis } = options;
  return {
    pair, verdict, confidence: out?.confidence ?? null,
    description: gap ?? out!.description,
    judgementSource: gap ? "evidence_gap" : "model",
    simulated: options.simulated, usefulLifeYears: basis?.usefulLifeYears, ageYears: ageAtMoveInYears, tenancyYears,
    calculationBasis: basis, shareCalculation: calculateShare(verdict, tenancyYears, ageAtMoveInYears, basis),
    apportionmentPct: apportion(verdict, pair.label, tenancyYears, ageAtMoveInYears, basis), guidanceRefs: guidanceFor(pair.label).refs,
  };
}
