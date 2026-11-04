// JSON schema + validator for Muse Spark's judge output. Dependency-free; never trust model JSON blindly.
import type { Verdict } from "./types";

export const VERDICTS: Verdict[] = ["no_change", "fair_wear", "damage", "cleaning", "missing", "added", "unresolved"];

export const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "confidence", "description", "moved", "evidence"],
  properties: {
    verdict: { type: "string", enum: VERDICTS },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    description: { type: "string", maxLength: 300 },
    moved: { type: "boolean" },
    evidence: { type: "string", maxLength: 200 },
  },
} as const;

export interface JudgeOut { verdict: Verdict; confidence: number; description: string; moved: boolean; evidence: string }

export function validateJudge(raw: unknown): { ok: true; value: JudgeOut } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "not an object" };
  const o = raw as Record<string, unknown>;
  if (typeof o.verdict !== "string" || !VERDICTS.includes(o.verdict as Verdict)) return { ok: false, error: `bad verdict: ${String(o.verdict)}` };
  // Match JUDGE_SCHEMA exactly. Coercing strings or clipping percentages can turn
  // malformed output into apparent certainty and suggest agreement with a charge.
  const conf = o.confidence;
  if (typeof conf !== "number" || !Number.isFinite(conf) || conf < 0 || conf > 1) {
    return { ok: false, error: "confidence must be a finite number between 0 and 1" };
  }
  if (typeof o.description !== "string" || !o.description.trim()) return { ok: false, error: "missing description" };
  if (o.description.length > 300) return { ok: false, error: "description exceeds 300 characters" };
  if (typeof o.moved !== "boolean") return { ok: false, error: "moved must be a boolean" };
  if (typeof o.evidence !== "string" || o.evidence.length > 200) return { ok: false, error: "evidence must be a string of at most 200 characters" };
  if (Object.keys(o).some((key) => !(JUDGE_SCHEMA.required as readonly string[]).includes(key))) return { ok: false, error: "unexpected field" };
  return {
    ok: true,
    value: {
      verdict: o.verdict as Verdict,
      confidence: conf,
      description: o.description.trim(),
      moved: o.moved,
      evidence: o.evidence,
    },
  };
}
