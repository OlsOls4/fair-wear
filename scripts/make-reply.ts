// Muse Spark drafts the line-by-line reply to the landlord from the REAL findings (sandbox only, budget-guarded).
//   NODE_USE_ENV_PROXY=1 MODEL_API_KEY=injected FAIRWEAR_ALLOW_PAID=1 npx tsx scripts/make-reply.ts
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { calculateShare } from "../lib/pipeline/guidance";
import type { CalculationBasis, Verdict } from "../lib/pipeline/types";
import { museSparkText } from "../lib/pipeline/models";
import { REPLY_SYSTEM } from "../lib/pipeline/prompts";
import { budgetStatus } from "../lib/pipeline/budget";

interface ReplyFinding {
  room: string; item: string; verdict: Verdict; description: string;
  tenancyYears?: number; ageYears?: number; calculationBasis?: CalculationBasis;
}

export function prepareReplyFindings(findings: ReplyFinding[]) {
  const order = ["damage", "missing", "cleaning", "fair_wear", "added"];
  return findings.filter((f) => f.verdict !== "no_change")
    .sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict))
    .map((f, i) => ({
      ref: `E${i + 1}`, room: f.room, item: f.item, verdict: f.verdict, what: f.description,
      ageAtMoveInYears: f.ageYears, tenancyYears: f.tenancyYears, calculationBasis: f.calculationBasis,
      shareCalculation: calculateShare(f.verdict, f.tenancyYears!, f.ageYears, f.calculationBasis),
    }));
}

async function main() {
  const inputDir = process.env.FAIRWEAR_DEMO_INPUT_DIR ?? "public/demo";
  const outputDir = process.env.FAIRWEAR_DEMO_OUTPUT_DIR ?? "public/demo";
  const d = JSON.parse(fs.readFileSync(path.join(inputDir, "flat-results.json"), "utf8"));
  const refs = prepareReplyFindings(d.findings);
  const user = `Property: ${d.property}. Tenancy length: ${d.tenancyYears} years. The landlord's deduction list and tenant decisions are not supplied. Request evidence for potential claims without accepting charges. Findings (refs are photo evidence numbers):\n${JSON.stringify(refs, null, 1)}`;
  const text = await museSparkText(`${REPLY_SYSTEM} Do not infer acceptance from the model classification. Any remaining-life percentage is an illustration based on supplied assumptions, not liability or an agreed amount. If inputs are missing, request evidence rather than supplying a percentage.`, user);
  if (!text.trim()) throw new Error("empty reply");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "reply-draft.json"), JSON.stringify({ model: "muse-spark", simulated: true, calculationVersion: 2, refs, text }, null, 1));
  console.log(text); console.log(budgetStatus());
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
