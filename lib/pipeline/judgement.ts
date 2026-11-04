import { validateJudge, type JudgeOut } from "./schema";

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
