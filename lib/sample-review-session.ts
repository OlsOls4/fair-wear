import { DECISIONS, type Decision } from "./decisions";
import { demoFindings } from "./demo";

/** Only public sample finding IDs and response choices may enter this store. */
export const SAMPLE_REVIEW_STORAGE_KEY = "fair-wear:sample-review:v1";
const allowedIds = new Set(demoFindings.map((finding) => finding.id));
const sampleSource = JSON.stringify(demoFindings);
// A cache-compatibility fingerprint, not a security or authenticity guarantee.
let fingerprint = 2166136261;
for (let index = 0; index < sampleSource.length; index++) {
  fingerprint = Math.imul(fingerprint ^ sampleSource.charCodeAt(index), 16777619);
}
export const SAMPLE_REVIEW_REVISION = `${sampleSource.length}:${fingerprint >>> 0}`;
type Responses = Record<string, Decision>;
type SampleStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function cleanResponses(value: unknown): Responses {
  const clean: Responses = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return clean;
  for (const [id, decision] of Object.entries(value)) {
    if (allowedIds.has(id) && DECISIONS.includes(decision as Decision)) {
      clean[id] = decision as Decision;
    }
  }
  return clean;
}

export function readSampleResponses(storage: SampleStore): Responses {
  const raw = storage.getItem(SAMPLE_REVIEW_STORAGE_KEY);
  if (!raw || raw.length > 8192) return {};
  try {
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    const record = saved as Record<string, unknown>;
    if (record.version !== 1 || record.revision !== SAMPLE_REVIEW_REVISION) return {};
    return cleanResponses(record.responses);
  } catch {
    return {};
  }
}

export function saveSampleResponses(storage: SampleStore, responses: Responses): void {
  const clean = cleanResponses(responses);
  if (!Object.keys(clean).length) {
    storage.removeItem(SAMPLE_REVIEW_STORAGE_KEY);
    return;
  }
  storage.setItem(SAMPLE_REVIEW_STORAGE_KEY, JSON.stringify({
    version: 1, revision: SAMPLE_REVIEW_REVISION, responses: clean,
  }));
}
