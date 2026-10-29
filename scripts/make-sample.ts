// Builds public/demo/sample.json from the hand-labelled cases. This is an illustration of the findings board,
// NOT model output: descriptions are the hand-written case notes and every finding is flagged simulated.
// Replace with real pipeline output once the Meta Model API run is done (scripts/run-demo.ts).
import { readFileSync, writeFileSync } from "node:fs";
import { apportion, guidanceFor } from "../lib/pipeline/guidance";

const cases = JSON.parse(readFileSync("eval/judge/cases.json", "utf8"));
const findings = cases.cases.map((c: any) => {
  const g = guidanceFor(c.item);
  return {
    id: c.id, room: c.room, item: c.item, verdict: c.expected, confidence: null, description: c.change,
    usefulLifeYears: g.usefulLifeYears, tenancyYears: cases.tenancyYears,
    apportionmentPct: apportion(c.expected, c.item, cases.tenancyYears), guidanceNote: g.note, simulated: true,
  };
});
writeFileSync("public/demo/sample.json", JSON.stringify({ property: "Demo flat (simulated)", source: "hand-labelled-sample", note: "Illustration of the findings board. Not model output.", tenancyYears: cases.tenancyYears, findings }, null, 2));
console.log(`wrote ${findings.length} findings`);
