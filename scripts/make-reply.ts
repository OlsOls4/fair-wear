// Muse Spark drafts the line-by-line reply to the landlord from the REAL findings (sandbox only, budget-guarded).
//   NODE_USE_ENV_PROXY=1 MODEL_API_KEY=injected FAIRWEAR_ALLOW_PAID=1 npx tsx scripts/make-reply.ts
import fs from "node:fs";
import { museSparkText } from "../lib/pipeline/models";
import { REPLY_SYSTEM } from "../lib/pipeline/prompts";
import { budgetStatus } from "../lib/pipeline/budget";

(async () => {
  const d = JSON.parse(fs.readFileSync("public/demo/flat-results.json", "utf8"));
  const ORDER = ["damage", "missing", "cleaning", "fair_wear", "added"];
  const fs2 = d.findings.filter((f: any) => f.verdict !== "no_change")
    .sort((a: any, b: any) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict))
    .map((f: any, i: number) => ({ ref: `E${i + 1}`, room: f.room, item: f.item, verdict: f.verdict, what: f.description, usefulLifeYears: f.usefulLifeYears, tenancyYears: f.tenancyYears, tenantSharePct: f.apportionmentPct }));
  const user = `Property: ${d.property}. Tenancy length: ${d.tenancyYears} years. The landlord's deduction list is not supplied, so respond to each finding below as if it were claimed. Findings (refs are photo evidence numbers in the attached pack):\n${JSON.stringify(fs2, null, 1)}`;
  const text = await museSparkText(REPLY_SYSTEM, user);
  if (!text.trim()) throw new Error("empty reply");
  fs.writeFileSync("public/demo/reply-draft.json", JSON.stringify({ model: "muse-spark", simulated: true, refs: fs2, text }, null, 1));
  console.log(text); console.log(budgetStatus());
})();
