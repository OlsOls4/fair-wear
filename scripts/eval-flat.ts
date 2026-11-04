// Scores saved pipeline output against planted changes; importing this file never rewrites artifacts.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { normLabel } from "../lib/pipeline/matching";

interface FlatObservation { id: string; room: string; item: string; verdict: string }
interface PlantedRoom { room: string; planted: { item: string; verdict: string }[] }

export function scoreFlat(findings: FlatObservation[], planted: PlantedRoom[]) {
  const rows: { room: string; item: string; planted: string; got: string; detected: boolean; exact: boolean }[] = [];
  const claimed = new Set<string>();
  const flagsChange = (finding: FlatObservation) => finding.verdict !== "no_change" && finding.verdict !== "unresolved";
  for (const r of planted) for (const p of r.planted) {
    const cands = findings.filter((f) => f.room === r.room && normLabel(f.item) === normLabel(p.item));
    cands.forEach((f) => claimed.add(f.id));
    const flagged = cands.filter(flagsChange);
    const exact = cands.find((f) => f.verdict === p.verdict);
    const fallback = cands.some((f) => f.verdict === "unresolved") ? "unresolved" : cands.length ? "no_change" : "not_segmented";
    rows.push({ room: r.room, item: p.item, planted: p.verdict, got: exact ? p.verdict : (flagged[0]?.verdict ?? fallback), detected: flagged.length > 0, exact: !!exact });
  }
  const falseAlarms = findings.filter((f) => !claimed.has(f.id) && flagsChange(f));
  const damageRows = rows.filter((r) => r.planted === "damage");
  return {
    planted: rows.length, detected: rows.filter((r) => r.detected).length, exactVerdict: rows.filter((r) => r.exact).length,
    damagePlanted: damageRows.length, damageFound: damageRows.filter((r) => r.exact).length,
    decoys: rows.filter((r) => r.planted === "fair_wear").length, decoysWronglyDamage: rows.filter((r) => r.planted === "fair_wear" && r.got === "damage").length,
    unplantedItemsChecked: findings.length - claimed.size, falseAlarms: falseAlarms.length, falseAlarmItems: falseAlarms.map((f) => `${f.room}/${f.item}: ${f.verdict}`), rows,
  };
}

function main() {
  const planted: PlantedRoom[] = JSON.parse(fs.readFileSync("eval/flat/planted.json", "utf8"));
  const res = JSON.parse(fs.readFileSync("public/demo/flat-results.json", "utf8"));
  const out = scoreFlat(res.findings, planted);
  fs.writeFileSync("eval/flat/results.json", JSON.stringify(out, null, 1));
  fs.writeFileSync("public/demo/flat-eval.json", JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
