// Re-runs SAM 3.1 IMAGE segmentation on the 8 demo-flat photos (no Muse Spark) and KEEPS the masks, which the first
// run threw away. Writes public/demo/seg/sam-records.json (boxes, confidence, raw one_bit mask tokens) and
// data/masks/*.pgm (decoded rasters) for scripts/draw-masks.py. ~30 SAM image calls at $0.0025 = ~$0.08, budget-guarded.
//   NODE_USE_ENV_PROXY=1 MODEL_API_KEY=injected FAIRWEAR_ALLOW_PAID=1 npx tsx scripts/save-masks.ts
import fs from "node:fs";
import { sam31Segment } from "../lib/pipeline/models";
import { budgetStatus } from "../lib/pipeline/budget";
import { decodeMask, writePgm } from "../lib/pipeline/masks";
import { CONCEPTS } from "./demo-concepts";

(async () => {
  fs.mkdirSync("data/masks", { recursive: true });
  const out: any[] = [];
  for (const room of Object.keys(CONCEPTS)) for (const visit of ["move_in", "move_out"] as const) {
    const file = `public/demo/flat/${room}-${visit === "move_in" ? "move-in" : "move-out"}.jpg`;
    const url = "data:image/jpeg;base64," + fs.readFileSync(file).toString("base64");
    const res = await Promise.all(CONCEPTS[room].map(([phrase, label]) => sam31Segment(url, phrase).then((r) => [phrase, label, r] as const)));
    for (const [phrase, label, recs] of res) for (const r of recs) {
      const d = decodeMask(r.mask);
      const key = `${room}-${visit}-${label.replace(/ /g, "_")}-${r.id}`;
      if (d) writePgm(`data/masks/${key}.pgm`, d);
      out.push({ key, room, visit, phrase, label, id: r.id, box: r.box, frameW: r.w, frameH: r.h, conf: r.conf, maskH: d?.h, maskW: d?.w, maskArea: d ? d.raster.reduce((a, b) => a + b, 0) : 0, mask: r.mask });
    }
    console.log(room, visit, out.length, budgetStatus().spentUsd.toFixed(4));
  }
  fs.writeFileSync("public/demo/seg/sam-records.json", JSON.stringify({ model: "sam-3.1", mode: "image", mask_encoding: "one_bit", simulated: true, note: "Raw SAM 3.1 records for the simulated demo flat; mask = the API's one_bit token (decode with @meta-sam/parser decodeMaskToRaster).", records: out }, null, 1));
  console.log(budgetStatus());
})();
