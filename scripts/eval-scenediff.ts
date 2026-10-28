// SceneDiff SD-V mini-eval: object-level change detection (added / removed / moved).
// Usage:
//   npx tsx scripts/eval-scenediff.ts --data <scenediff_benchmark dir> [--predictor mock|oracle|spark] [--pairs N] [--out eval/scenediff/results-<predictor>.json]
// Predictors:
//   mock   – returns no changes (MOCK mode baseline; checks the harness end to end)
//   oracle – returns ground truth (sanity check: must score 1.0)
//   spark  – sharp keyframes from both videos -> Muse Spark lists changed objects -> scored.
//            Paid: only runs with MODEL_API_KEY + FAIRWEAR_ALLOW_PAID=1, every call goes through the budget guard.
import fs from "node:fs";
import path from "node:path";
import { sampleFrames } from "../lib/pipeline/frames";
import { labelScore } from "../lib/pipeline/matching";
import { MOCK, museSparkJSON } from "../lib/pipeline/models";
import { budgetStatus } from "../lib/pipeline/budget";

type Status = "added" | "removed" | "moved";
interface Obj { label: string; status: Status }
interface PairGT { scene_type?: string; videos: string[]; objects: Obj[] }

const arg = (k: string, d?: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const DATA = arg("data", "../scenediff/scenediff_benchmark")!;
const PRED = (arg("predictor", "mock") as "mock" | "oracle" | "spark");
const N = Number(arg("pairs", "20"));
const KEYFRAMES = Number(arg("keyframes", "6"));
const gt: Record<string, PairGT> = JSON.parse(fs.readFileSync("eval/scenediff/gt.json", "utf8"));

function pickEven<T>(xs: T[], k: number) { if (xs.length <= k) return xs; return Array.from({ length: k }, (_, i) => xs[Math.round((i * (xs.length - 1)) / (k - 1))]); }
const dataUrl = (f: string) => `data:image/jpeg;base64,${fs.readFileSync(f).toString("base64")}`;

async function predict(pair: string, g: PairGT): Promise<Obj[]> {
  if (PRED === "oracle") return g.objects.map((o) => ({ ...o }));
  if (PRED === "mock" || MOCK) return [];
  const dir = path.join(DATA, "data", pair);
  const [v1, v2] = g.videos.map((v) => path.join(dir, v));
  const f1 = pickEven(sampleFrames(v1, path.join("data/frames", pair, "v1"), { fps: 1, width: 640 }), KEYFRAMES);
  const f2 = pickEven(sampleFrames(v2, path.join("data/frames", pair, "v2"), { fps: 1, width: 640 }), KEYFRAMES);
  const out = await museSparkJSON<{ changes?: Obj[] }>(
    "You compare two walkthroughs of the same space taken at different times. The first " + f1.length + " images are visit 1 (before), the rest are visit 2 (after). " +
      "List every physical object that was added (only in after), removed (only in before) or moved (in both, different place). Ignore camera motion, lighting and viewpoint changes. " +
      'Return JSON {"changes":[{"label":"short object name","status":"added|removed|moved"}]}. Return an empty list if nothing changed.',
    `Scene: ${g.scene_type ?? pair}.`,
    [...f1, ...f2].map((f) => dataUrl(f.file)),
  );
  return (out.changes ?? []).filter((c) => ["added", "removed", "moved"].includes(c.status));
}

function score(pred: Obj[], truth: Obj[]) {
  // one-to-one greedy match on label similarity (>=0.5); status must also agree for a "status" hit
  const cands: { p: number; t: number; s: number }[] = [];
  pred.forEach((p, i) => truth.forEach((t, j) => { const s = labelScore(p.label, t.label); if (s >= 0.5) cands.push({ p: i, t: j, s }); }));
  cands.sort((a, b) => b.s - a.s);
  const up = new Set<number>(), ut = new Set<number>(); let statusHits = 0;
  for (const c of cands) { if (up.has(c.p) || ut.has(c.t)) continue; up.add(c.p); ut.add(c.t); if (pred[c.p].status === truth[c.t].status) statusHits++; }
  return { tp: up.size, statusHits, nPred: pred.length, nTrue: truth.length };
}

async function main() {
  const pairs = Object.keys(gt).slice(0, N);
  const rows: any[] = [];
  let tp = 0, sh = 0, np = 0, nt = 0;
  for (const p of pairs) {
    let pred: Obj[] = [], err: string | undefined;
    try { pred = await predict(p, gt[p]); } catch (e: any) { err = String(e.message ?? e); if (err.startsWith("Budget guard")) { console.error(err); break; } }
    const s = score(pred, gt[p].objects);
    tp += s.tp; sh += s.statusHits; np += s.nPred; nt += s.nTrue;
    rows.push({ pair: p, ...s, pred, err });
    console.log(`${p.padEnd(34)} true=${s.nTrue} pred=${s.nPred} found=${s.tp} statusOK=${s.statusHits}${err ? " ERR " + err.slice(0, 80) : ""}`);
  }
  const prec = np ? tp / np : 0, rec = nt ? tp / nt : 0;
  const summary = { predictor: PRED, mock: MOCK, pairs: rows.length, objects: nt, precision: +prec.toFixed(3), recall: +rec.toFixed(3), f1: prec + rec ? +((2 * prec * rec) / (prec + rec)).toFixed(3) : 0, statusAccuracyOnFound: tp ? +(sh / tp).toFixed(3) : 0, budget: budgetStatus(), at: new Date().toISOString() };
  console.log(JSON.stringify(summary, null, 1));
  const out = arg("out", `eval/scenediff/results-${PRED}.json`)!;
  fs.writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
}
main();
