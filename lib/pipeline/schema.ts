// JSON schema + validator for Muse Spark's judge output. Dependency-free; never trust model JSON blindly.
import type { Verdict } from "./types";

export const VERDICTS: Verdict[] = ["no_change", "fair_wear", "damage", "cleaning", "missing", "added"];

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
  if (!raw || typeof raw !== "object") return { ok: false, error: "not an object" };
  const o = raw as Record<string, unknown>;
  if (typeof o.verdict !== "string" || !VERDICTS.includes(o.verdict as Verdict)) return { ok: false, error: `bad verdict: ${String(o.verdict)}` };
  const conf = typeof o.confidence === "string" ? parseFloat(o.confidence) : o.confidence;
  if (typeof conf !== "number" || !isFinite(conf)) return { ok: false, error: "bad confidence" };
  if (typeof o.description !== "string" || !o.description.trim()) return { ok: false, error: "missing description" };
  return {
    ok: true,
    value: {
      verdict: o.verdict as Verdict,
      confidence: Math.max(0, Math.min(1, conf > 1 ? conf / 100 : conf)),
      description: o.description.trim().slice(0, 300),
      moved: o.moved === true,
      evidence: typeof o.evidence === "string" ? o.evidence.slice(0, 200) : "",
    },
  };
}
