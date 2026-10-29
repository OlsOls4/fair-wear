// Offline checks for guidance maths, schema validation and the hand-labelled case file. No model calls.
import { readFileSync } from "node:fs";
import { apportion, guidanceFor } from "../lib/pipeline/guidance";
import { validateJudge } from "../lib/pipeline/schema";

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`); };

eq("wall damage after 2 of 4 yrs -> 50%", apportion("damage", "wall", 2), 50);
eq("wall damage, wall already 2 yrs old -> 0%", apportion("damage", "wall", 2, 2), 0);
eq("carpet damage after 2 of 7 yrs -> 71%", apportion("damage", "carpet", 2), 71);
eq("fair wear -> 0", apportion("fair_wear", "carpet", 2), 0);
eq("cleaning -> 100", apportion("cleaning", "oven", 2), 100);
eq("unknown item damage -> undefined", apportion("damage", "chandelier", 2), undefined);
eq("life beyond limit clamps to 0", apportion("damage", "curtains", 9), 0);
eq("guidance lookup case-insensitive", guidanceFor("Carpet").usefulLifeYears, 7);

eq("validator accepts good", validateJudge({ verdict: "damage", confidence: 0.8, description: "Gouge.", moved: false, evidence: "x" }).ok, true);
eq("validator rejects bad verdict", validateJudge({ verdict: "broken", confidence: 0.8, description: "x" }).ok, false);
eq("validator rejects empty description", validateJudge({ verdict: "damage", confidence: 0.8, description: " " }).ok, false);
const pct = validateJudge({ verdict: "damage", confidence: 85, description: "x" });
eq("validator normalises 85 -> 0.85", pct.ok && pct.value.confidence, 0.85);
eq("validator rejects null", validateJudge(null).ok, false);

const cases = JSON.parse(readFileSync("eval/judge/cases.json", "utf8"));
const counts: Record<string, number> = {};
for (const c of cases.cases) counts[c.expected] = (counts[c.expected] ?? 0) + 1;
eq("10 labelled cases", cases.cases.length, 10);
eq("every case has a known item or is 'table' for missing", cases.cases.every((c: any) => guidanceFor(c.item).usefulLifeYears), true);
console.log("label mix", counts);
process.exit(fails ? 1 : 0);
