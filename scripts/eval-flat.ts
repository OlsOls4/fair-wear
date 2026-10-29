// Scores public/demo/flat-results.json (real pipeline output) against the planted changes in eval/flat/planted.json.
import fs from "node:fs";
import { normLabel } from "../lib/pipeline/matching";
const planted: any[] = JSON.parse(fs.readFileSync("eval/flat/planted.json", "utf8"));
const res = JSON.parse(fs.readFileSync("public/demo/flat-results.json", "utf8"));
const rows: any[] = [];
const claimed = new Set<string>();
for (const r of planted) for (const p of r.planted) {
  const key = (f: any) => f.room === r.room && normLabel(f.item) === normLabel(p.item);
  const cands = res.findings.filter(key);
  cands.forEach((f: any) => claimed.add(f.id));
  const flagged = cands.filter((f: any) => f.verdict !== "no_change");
  const exact = cands.find((f: any) => f.verdict === p.verdict);
  rows.push({ room: r.room, item: p.item, planted: p.verdict, got: exact ? p.verdict : (flagged[0]?.verdict ?? (cands.length ? "no_change" : "not_segmented")), detected: flagged.length > 0, exact: !!exact });
}
const falseAlarms = res.findings.filter((f: any) => !claimed.has(f.id) && f.verdict !== "no_change");
const n = rows.length;
const damageRows = rows.filter((r) => r.planted === "damage");
const out = {
  planted: n, detected: rows.filter((r) => r.detected).length, exactVerdict: rows.filter((r) => r.exact).length,
  damagePlanted: damageRows.length, damageFound: damageRows.filter((r) => r.exact).length,
  decoys: rows.filter((r) => r.planted === "fair_wear").length, decoysWronglyDamage: rows.filter((r) => r.planted === "fair_wear" && r.got === "damage").length,
  unplantedItemsChecked: res.findings.length - claimed.size, falseAlarms: falseAlarms.length, falseAlarmItems: falseAlarms.map((f: any) => `${f.room}/${f.item}: ${f.verdict}`), rows,
};
fs.writeFileSync("eval/flat/results.json", JSON.stringify(out, null, 1));
fs.writeFileSync("public/demo/flat-eval.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
