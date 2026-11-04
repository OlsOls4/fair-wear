// Offline checks for guidance maths, schema validation and the hand-labelled case file. No model calls.
import { readFileSync } from "node:fs";
import { apportion, calculateShare, guidanceFor } from "../lib/pipeline/guidance";
import { validateJudge } from "../lib/pipeline/schema";

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`); };

const wallBasis = { usefulLifeYears: 4, qualityBasis: "Illustrative standard paint in sound starting condition" };
const carpetBasis = { usefulLifeYears: 7, qualityBasis: "Illustrative carpet quality; not verified" };
eq("wall with explicit assumptions -> 50% illustration", apportion("damage", "wall", 2, 0, wallBasis), 50);
eq("wall already 2 yrs old -> 0% illustration", apportion("damage", "wall", 2, 2, wallBasis), 0);
eq("carpet with explicit assumptions -> 71% illustration", apportion("damage", "carpet", 2, 0, carpetBasis), 71);
eq("unknown age never defaults to new", apportion("damage", "wall", 2, undefined, wallBasis), undefined);
eq("age alone does not supply lifespan", apportion("damage", "wall", 2, 0), undefined);
eq("known item without inputs has no percentage", apportion("damage", "carpet", 2), undefined);
eq("missing item needs inputs too", apportion("missing", "table", 2), undefined);
eq("missing item with explicit basis can illustrate", apportion("missing", "table", 2, 0, wallBasis), 50);
eq("fair wear legacy field -> 0", apportion("fair_wear", "carpet", 2), 0);
eq("cleaning does not imply 100% liability", apportion("cleaning", "oven", 2), undefined);
eq("unknown label can use explicit item-specific inputs", apportion("damage", "chandelier", 2, 0, wallBasis), 50);
eq("life beyond limit clamps to 0", apportion("damage", "curtains", 9, 0, wallBasis), 0);
eq("guidance lookup case-insensitive", guidanceFor("Carpet").usefulLifeYears, 7);
eq("table lives labelled background examples", guidanceFor("Carpet").lifespanBasis, "background_example");
eq("prototype property is not an item", guidanceFor("constructor").usefulLifeYears, undefined);
eq("missing assumptions identified", calculateShare("damage", 2).missingInputs, ["age_at_move_in", "useful_life", "quality_basis"]);
eq("complete inputs explicitly illustrative", calculateShare("damage", 2, 0, wallBasis).status, "illustrative");
eq("cleaning has no replacement calculation", calculateShare("cleaning", 2).status, "not_applicable");
eq("quality cannot be blank", apportion("damage", "wall", 2, 0, { ...wallBasis, qualityBasis: "  " }), undefined);
for (const invalid of [NaN, Infinity, -Infinity, -1]) {
  eq(`reject invalid age ${invalid}`, apportion("damage", "wall", 2, invalid, wallBasis), undefined);
  eq(`reject invalid tenancy ${invalid}`, apportion("damage", "wall", invalid, 0, wallBasis), undefined);
  eq(`reject invalid lifespan ${invalid}`, apportion("damage", "wall", 2, 0, { ...wallBasis, usefulLifeYears: invalid }), undefined);
}
eq("zero lifespan rejected", apportion("damage", "wall", 2, 0, { ...wallBasis, usefulLifeYears: 0 }), undefined);
eq("zero age and tenancy are valid", apportion("damage", "wall", 0, 0, wallBasis), 100);
eq("fractional years allowed", apportion("damage", "wall", 0.5, 0.5, wallBasis), 75);

eq("validator accepts good", validateJudge({ verdict: "damage", confidence: 0.8, description: "Gouge.", moved: false, evidence: "x" }).ok, true);
eq("validator rejects bad verdict", validateJudge({ verdict: "broken", confidence: 0.8, description: "x" }).ok, false);
eq("validator rejects empty description", validateJudge({ verdict: "damage", confidence: 0.8, description: " " }).ok, false);
for (const confidence of [85, 101, 1000, -1, 1.01, NaN, Infinity, -Infinity, "0.99", "99garbage", null, undefined]) {
  eq(`validator rejects malformed confidence ${String(confidence)}`, validateJudge({ verdict: "damage", confidence, description: "x" }).ok, false);
}
for (const confidence of [0, 0.89999, 0.9, 1]) {
  const valid = validateJudge({ verdict: "damage", confidence, description: "x", moved: false, evidence: "x" });
  eq(`validator preserves valid confidence ${confidence}`, valid.ok && valid.value.confidence, confidence);
}
eq("validator rejects null", validateJudge(null).ok, false);

const cases = JSON.parse(readFileSync("eval/judge/cases.json", "utf8"));
const counts: Record<string, number> = {};
for (const c of cases.cases) counts[c.expected] = (counts[c.expected] ?? 0) + 1;
eq("10 labelled cases", cases.cases.length, 10);
eq("every case has a known item or is 'table' for missing", cases.cases.every((c: any) => guidanceFor(c.item).usefulLifeYears), true);
console.log("label mix", counts);
process.exit(fails ? 1 : 0);
