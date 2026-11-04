// Offline checks for guidance maths, schema validation and the hand-labelled case file. No model calls.
import { readFileSync } from "node:fs";
import { apportion, explain, guidanceFor, isMouldLike, noteFor } from "../lib/pipeline/guidance";
import { defaultDecision } from "../lib/decisions";
import { validateJudge } from "../lib/pipeline/schema";

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`); };

eq("wall (decor, 5-yr scheme start) damage after 2 yrs, new at move-in -> 60%", apportion("damage", "wall", 2, 0), 60);
eq("wall already 3 yrs old at move-in + 2 yrs -> 0%", apportion("damage", "wall", 2, 3), 0);
eq("DPS worked example: carpet 2 yrs old of 5-yr life -> 60%", apportion("damage", "carpet", 0, 2), 60);
eq("unknown age = worst case if new (carpet, 2 yrs) -> 60%", apportion("damage", "carpet", 2, null), 60);
eq("explain gives pounds of claimed", explain("damage", "carpet", 2, 0, 500).amount, 300);
eq("explain says landlord must prove unknown age", /prove/.test(explain("damage", "carpet", 2, null).plain), true);
eq("note matches verdict (no wear note under damage)", /expected wear/.test(noteFor("carpet", "damage")), false);
eq("mould detector", isMouldLike("heavy black mould along the sealant"), true);
eq("mould cleaning is never auto-accepted", defaultDecision({ verdict: "cleaning", item: "bath", description: "black mould on sealant", confidence: 0.95 }).decision, "dispute");
eq("fair wear defaults to dispute", defaultDecision({ verdict: "fair_wear", item: "wall", description: "nail holes", confidence: 0.9 }).decision, "dispute");
eq("borderline damage goes to review (dispute)", defaultDecision({ verdict: "damage", item: "carpet", description: "dark patch", confidence: 0.82 }).decision, "dispute");
eq("plain cleaning defaults to agree", defaultDecision({ verdict: "cleaning", item: "oven", description: "grease build-up", confidence: 0.9 }).decision, "agree");
eq("no change is not claimed", defaultDecision({ verdict: "no_change", item: "sofa", description: "same", confidence: 0.9 }).decision, "not_claimed");
eq("confident damage (90%+) defaults to agree", defaultDecision({ verdict: "damage", item: "door", description: "split panel", confidence: 0.9 }).decision, "agree");
eq("fair wear -> 0", apportion("fair_wear", "carpet", 2), 0);
eq("cleaning -> 100", apportion("cleaning", "oven", 2), 100);
eq("unknown item damage -> undefined", apportion("damage", "chandelier", 2), undefined);
eq("life beyond limit clamps to 0", apportion("damage", "curtains", 9), 0);
eq("guidance lookup case-insensitive", guidanceFor("Carpet").usefulLifeYears, 5);

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
