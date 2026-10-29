// Runs the REAL pipeline (SAM 3.1 image segmentation -> match -> Muse Spark judge) over the simulated demo flat
// and writes public/demo/flat-results.json for the findings board + eval/flat/results.json (accuracy vs planted changes).
// Sandbox only: needs the bound Meta key + FAIRWEAR_ALLOW_PAID=1; every call goes through the budget guard.
//   NODE_USE_ENV_PROXY=1 MODEL_API_KEY=injected FAIRWEAR_ALLOW_PAID=1 npx tsx scripts/run-demo.ts [room]
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { sam31Segment } from "../lib/pipeline/models";
import { matchItems, normLabel } from "../lib/pipeline/matching";
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
const dir = "public/demo/flat";
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
  for (const p of planted) {
    if (only && only !== p.room) continue;
    const [bi, bo] = await Promise.all([items(p.room, "move_in"), items(p.room, "move_out")]);
    const pairs = matchItems(bi, bo).filter((x) => x.before && x.after);
    // Handheld walkthroughs would need frame alignment; the demo flat uses a fixed camera, so crop BOTH visits to the union of the two boxes.
    for (const pr of pairs) {
      const b = (pr.before as any).px as number[], a = (pr.after as any).px as number[];
      const u = [Math.min(b[0], a[0]), Math.min(b[1], a[1]), Math.max(b[2], a[2]), Math.max(b[3], a[3])];
      for (const it of [pr.before!, pr.after!]) {
        const crop = `${dir}/crops/${p.room}-${it.visit}-${pr.label.replace(/ /g, "_")}-${it.id.split("-").pop()}.jpg`;
        fs.mkdirSync(`${dir}/crops`, { recursive: true });
        py(it.bestFrame.url, ...u.map(String), crop, "0.03", "768");
        (it as any).cropFile = "/" + crop.replace(/^public\//, "");
        it.bestFrame = { ...it.bestFrame, url: "data:image/jpeg;base64," + fs.readFileSync(crop).toString("base64") };
      }
    }
    console.log(p.room, "items", bi.length, bo.length, "pairs", pairs.length, "spent", budgetStatus().spentUsd.toFixed(3));
    for (let i = 0; i < pairs.length; i += 4) {
      const fs_ = await Promise.all(pairs.slice(i, i + 4).map(async (pr) => {
        const f = await judge(pr, TENANCY_YEARS);
        const g = guidanceFor(pr.label);
        return {
          id: `${p.room}-${pr.label}-${i}-${pr.before!.id.split("-").pop()}`, room: p.room, item: pr.label, verdict: f.verdict, confidence: f.confidence,
          description: f.description, usefulLifeYears: g.usefulLifeYears, tenancyYears: TENANCY_YEARS, apportionmentPct: f.apportionmentPct,
          guidanceNote: g.note, simulated: true, before: (pr.before as any).cropFile, after: (pr.after as any).cropFile,
        };
      }));
      all.push(...fs_);
    }
  }
  const OUT = "public/demo/flat-results.json";
  if (only && fs.existsSync(OUT)) all.unshift(...JSON.parse(fs.readFileSync(OUT, "utf8")).findings.filter((f: any) => f.room !== only)); // merge: re-run one room
  fs.writeFileSync(OUT, JSON.stringify({
    property: "Demo flat (simulated)", source: "pipeline-run", note: "Real Fair Wear pipeline output (SAM 3.1 + Muse Spark) on Muse Image-generated rooms with planted changes. All imagery is simulated.",
    tenancyYears: TENANCY_YEARS, findings: all,
  }, null, 1));
  console.log(all.map((f) => `${f.room}/${f.item}: ${f.verdict} (${Math.round(f.confidence * 100)}%) ${f.description}`).join("\n"));
  console.log(budgetStatus());
})();
