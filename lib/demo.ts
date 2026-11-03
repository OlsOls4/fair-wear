import data from "../public/demo/flat-results.json";
import evaluation from "../public/demo/flat-eval.json";
import type { F } from "./findings";
import { normLabel } from "./pipeline/matching";

export const demoData = data;
export const demoEvaluation = evaluation;
const label = (value: string) => value.replaceAll("_", " ");

/** Expose the published fixture's known errors without changing model output or decisions. */
export const demoFindings: F[] = data.findings.map((finding) => {
  const mismatch = evaluation.rows.find((row) => !row.exact && row.room === finding.room
    && normLabel(row.item) === normLabel(finding.item) && row.got === finding.verdict);
  const falseAlarm = evaluation.falseAlarmItems.includes(`${finding.room}/${finding.item}: ${finding.verdict}`);
  const evaluationNote = mismatch
    ? `The planted test expected ${label(mismatch.planted)} here; the model reported ${label(mismatch.got)}.`
    : falseAlarm ? "The published evaluation flags this as a false alarm on an item with no planted change." : undefined;
  return { ...finding, evaluationNote };
});
