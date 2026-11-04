// Runs the REAL pipeline (SAM 3.1 image segmentation -> match -> Muse Spark judge) over the simulated demo flat
// and writes public/demo/flat-results.json for the findings board + eval/flat/results.json (accuracy vs planted changes).
// Sandbox only: needs the bound Meta key + FAIRWEAR_ALLOW_PAID=1; every call goes through the budget guard.
//   NODE_USE_ENV_PROXY=1 MODEL_API_KEY=injected FAIRWEAR_ALLOW_PAID=1 npx tsx scripts/run-demo.ts [room]
import fs from "node:fs";
import path from "node:path";
import { confidenceLabel } from "../lib/findings";
import { execFileSync } from "node:child_process";
import { sam31Segment } from "../lib/pipeline/models";
import { independentCropBoxes } from "./crop-plan";
import { planDemoCorrespondence } from "./demo-correspondence";
import { judge } from "../lib/pipeline";
import { guidanceFor } from "../lib/pipeline/guidance";
import { budgetStatus } from "../lib/pipeline/budget";
import type { Item } from "../lib/pipeline/types";

const CONCEPTS: Record<string, [string, string][]> = {
  bedroom: [["wall", "wall"], ["beige carpet", "carpet"], ["curtain", "curtains"], ["wardrobe", "wardrobe"]],
  "living-room": [["wall", "wall"], ["grey carpet", "carpet"], ["curtain", "curtains"]],
  kitchen: [["wooden worktop", "worktop"], ["oven", "oven"], ["hob", "hob"], ["sink", "sink"]],
  bathroom: [["bathtub", "bath"], ["glass shower screen", "shower screen"], ["toilet", "toilet"], ["white sealant strip along the bath", "sealant"]],
};
const TENANCY_YEARS = 2;
const outputDir = process.env.FAIRWEAR_DEMO_OUTPUT_DIR ?? "public/demo";
const dir = `${process.env.FAIRWEAR_DEMO_INPUT_DIR ?? "public/demo"}/flat`;
const cropDir = path.join(outputDir, "flat/crops");
const py = (...a: string[]) => execFileSync("python3", ["scripts/crop.py", ...a]).toString().trim();

async function items(room: string, visit: "move_in" | "move_out"): Promise<Item[]> {
  const file = `${dir}/${room}-${visit === "move_in" ? "move-in" : "move-out"}.jpg`;
  const [W, H] = py(file).split(" ").map(Number);
  const url = "data:image/jpeg;base64," + fs.readFileSync(file).toString("base64");
  const out: Item[] = [];
  const results = await Promise.all(CONCEPTS[room].map(([phrase, label]) => sam31Segment(url, phrase).then((r) => [label, r] as const)));
  for (const [label, recs] of results) {
    for (const r of recs) {
      if ((r.conf ?? 1) < 0.5) continue;
      const [x1, y1, x2, y2] = r.box;
      out.push({ id: `${visit}-${room}-${label}-${r.id}`, visit, room, label, box: [x1 / W, y1 / H, x2 / W, y2 / H], bestFrame: { visit, room, t: 0, url: file } });
      (out[out.length - 1] as any).px = [x1, y1, x2, y2, W, H];
    }
  }
  return out;
}

(async () => {
  const only = process.argv[2];
  const planted: any[] = JSON.parse(fs.readFileSync("eval/flat/planted.json", "utf8"));
  const all: any[] = [];
  const correspondence: any[] = [];
  for (const p of planted) {
    if (only && only !== p.room) continue;
    const [bi, bo] = await Promise.all([items(p.room, "move_in"), items(p.room, "move_out")]);
    const { pairs, report } = planDemoCorrespondence(p.room, bi, bo);
    correspondence.push(report);
    // No verified registration: crop each source independently, never union cross-image coordinates.
    for (const pr of pairs) {
      const b = (pr.before as any).px as number[], a = (pr.after as any).px as number[];
      const boxes = independentCropBoxes(b, a);
      for (const it of [pr.before!, pr.after!]) {
        const crop = `${cropDir}/${p.room}-${it.visit}-${pr.label.replace(/ /g, "_")}-${it.id.split("-").pop()}.jpg`;
        fs.mkdirSync(cropDir, { recursive: true });
        py(it.bestFrame.url, ...(it === pr.before ? boxes.before : boxes.after).map(String), crop, "0.03", "768");
        (it as any).cropFile = crop.startsWith("public/") ? "/" + crop.slice(7) : path.resolve(crop);
        it.bestFrame = { ...it.bestFrame, url: "data:image/jpeg;base64," + fs.readFileSync(crop).toString("base64") };
      }
    }
    console.log(p.room, "items", bi.length, bo.length, "pairs", pairs.length, "unresolved", report.unresolved.length, "coverage", report.coverage, "spent", budgetStatus().spentUsd.toFixed(3));
    for (let i = 0; i < pairs.length; i += 4) {
      const fs_ = await Promise.all(pairs.slice(i, i + 4).map(async (pr) => {
        const f = await judge(pr, TENANCY_YEARS);
        const g = guidanceFor(pr.label);
        return {
          id: `${p.room}-${pr.label}-${i}-${pr.before!.id.split("-").pop()}`, room: p.room, item: pr.label, verdict: f.verdict, confidence: f.confidence,
          description: f.description, usefulLifeYears: f.usefulLifeYears, ageYears: f.ageYears, tenancyYears: TENANCY_YEARS, apportionmentPct: f.apportionmentPct,
          calculationBasis: f.calculationBasis, shareCalculation: f.shareCalculation,
          exampleUsefulLifeYears: g.usefulLifeYears, lifespanBasis: g.lifespanBasis,
          guidanceNote: g.note, simulated: true, before: (pr.before as any).cropFile, after: (pr.after as any).cropFile,
        };
      }));
      all.push(...fs_);
    }
  }
  const OUT = path.join(outputDir, "flat-results.json");
  fs.mkdirSync(outputDir, { recursive: true });
  let legacyCoverageUnknown = false;
  if (only && fs.existsSync(OUT)) {
    const prior = JSON.parse(fs.readFileSync(OUT, "utf8"));
    all.unshift(...prior.findings.filter((f: any) => f.room !== only));
    correspondence.unshift(...(prior.correspondence ?? []).filter((r: any) => r.room !== only));
    legacyCoverageUnknown = prior.legacyCoverageUnknown === true || prior.findings.some((f: any) => f.room !== only && !(prior.correspondence ?? []).some((r: any) => r.room === f.room));
  }
  fs.writeFileSync(OUT, JSON.stringify({
    property: "Demo flat (simulated)", source: "pipeline-run", note: "Real Fair Wear pipeline output (SAM 3.1 + Muse Spark) on Muse Image-generated rooms with planted changes. All imagery is simulated.",
    tenancyYears: TENANCY_YEARS, findings: all, correspondence, legacyCoverageUnknown,
  }, null, 1));
  console.log(all.map((f) => `${f.room}/${f.item}: ${f.verdict} (${confidenceLabel(f.confidence)}) ${f.description}`).join("\n"));
  console.log(budgetStatus());
})();
