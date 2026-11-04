import { DECISIONS, type Decision } from "./decisions";
import { SAMPLE_RESPONSE_MAP, SAMPLE_CASE_EXAMPLES, type CaseItem } from "./case-builder";
import { SAMPLE_REVIEW_REVISION } from "./sample-review-session";

/** A one-use handoff of the three public examples, never a store for case documents. */
export const SAMPLE_CASE_TRANSFER_KEY = "fair-wear:sample-case-transfer:v1";
export const SAMPLE_CASE_TRANSFER_SOURCE = "sample-review";
const validToken = (token: unknown): token is string => typeof token === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);
type SampleTransfer = Record<string, Decision>;
type SampleStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const ids = SAMPLE_CASE_EXAMPLES.map((item) => item.id);
export function prepareSampleCaseTransfer(storage: SampleStore, decisions: Record<string, Decision>, token: string): string {
  if (!validToken(token)) throw new Error("Invalid sample handoff token");
  const responses: SampleTransfer = {};
  for (const id of ids) {
    const selected = Object.hasOwn(decisions, id) && DECISIONS.includes(decisions[id]);
    if (selected) responses[id] = decisions[id];
  }
  storage.setItem(SAMPLE_CASE_TRANSFER_KEY, JSON.stringify({ version: 1, revision: SAMPLE_REVIEW_REVISION, token, responses }));
  return `/case-builder?from=${SAMPLE_CASE_TRANSFER_SOURCE}&transfer=${encodeURIComponent(token)}`;
}

/** Consume before parsing: malformed/stale handoffs cannot keep replaying. Storage failures propagate. */
export function takeSampleCaseTransfer(storage: SampleStore, token: string | null): SampleTransfer | null {
  const raw = storage.getItem(SAMPLE_CASE_TRANSFER_KEY);
  if (raw !== null) storage.removeItem(SAMPLE_CASE_TRANSFER_KEY);
  if (!raw || raw.length > 8192 || !validToken(token)) return null;
  try {
    const record: unknown = JSON.parse(raw);
    if (!record || typeof record !== "object" || Array.isArray(record)) return null;
    const saved = record as Record<string, unknown>;
    if (saved.token !== token || saved.version !== 1 || saved.revision !== SAMPLE_REVIEW_REVISION || !saved.responses || typeof saved.responses !== "object" || Array.isArray(saved.responses)) return null;
    const responses = saved.responses as Record<string, unknown>;
    const clean: SampleTransfer = {};
    for (const id of ids) {
      if (!Object.hasOwn(responses, id)) continue;
      const decision = responses[id];
      if (!DECISIONS.includes(decision as Decision)) return null;
      clean[id] = decision as Decision;
    }
    return clean;
  } catch { return null; }
}

export function applySampleCaseTransfer(items: CaseItem[], transfer: SampleTransfer): CaseItem[] {
  return items.map((item) => {
    const id = item.model?.id;
    const review = id && Object.hasOwn(transfer, id) && ids.some((allowed) => allowed === id) ? transfer[id] : undefined;
    // Match the recorded public finding, never arbitrary personal IDs or item labels.
    return review ? { ...item, response: SAMPLE_RESPONSE_MAP[review], sampleReview: review } : item;
  });
}
