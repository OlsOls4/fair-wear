// Builds public/demo/sample.json from the hand-labelled cases. This is an illustration of the findings board,
// NOT model output: descriptions are the hand-written case notes and every finding is flagged simulated.
// Replace with real pipeline output once the Meta Model API run is done (scripts/run-demo.ts).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { apportion, calculateShare, guidanceFor } from "../lib/pipeline/guidance";

const cases = JSON.parse(readFileSync("eval/judge/cases.json", "utf8"));
const findings = cases.cases.map((c: any) => {
  const g = guidanceFor(c.item);
  return {
    id: c.id, room: c.room, item: c.item, verdict: c.expected, confidence: null, description: c.change,
    exampleUsefulLifeYears: g.usefulLifeYears, lifespanBasis: g.lifespanBasis, tenancyYears: cases.tenancyYears,
    shareCalculation: calculateShare(c.expected, cases.tenancyYears),
    apportionmentPct: apportion(c.expected, c.item, cases.tenancyYears), guidanceNote: g.note, simulated: true,
  };
});
const outputDir = process.env.FAIRWEAR_DEMO_OUTPUT_DIR ?? "public/demo";
mkdirSync(outputDir, { recursive: true });
writeFileSync(`${outputDir}/sample.json`, JSON.stringify({ property: "Demo flat (simulated)", source: "hand-labelled-sample", note: "Illustration of the findings board. Not model output.", tenancyYears: cases.tenancyYears, findings }, null, 2));
console.log(`wrote ${findings.length} findings`);
