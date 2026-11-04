// REAL SAM 3.1 VIDEO tracking on a simulated walkthrough pair (bedroom move-in / move-out).
// The clips are short pans made with ffmpeg from the Muse Image stills (12 s, 5 fps, 60 frames), so they are simulated
// handheld walkthroughs, not real footage. Each concept is one sam-3.1 video request with persistent object IDs.
// Cost: 60 frames x $0.0002 x concepts x 2 visits (6 concepts = ~$0.15), budget-guarded.
//   NODE_USE_ENV_PROXY=1 MODEL_API_KEY=injected FAIRWEAR_ALLOW_PAID=1 npx tsx scripts/track-video.ts [concept...]
import fs from "node:fs";
import { sam31Track } from "../lib/pipeline/models";
import { budgetStatus } from "../lib/pipeline/budget";
import { decodeMask, writePgm } from "../lib/pipeline/masks";

const ALL: [string, string][] = [["wall", "wall"], ["beige carpet", "carpet"], ["curtain", "curtains"], ["wardrobe", "wardrobe"], ["window", "window"], ["radiator", "radiator"]];
const FRAMES = 60;
const OUT = "public/demo/video/tracks.json";
(async () => {
  const only = process.argv.slice(2);
  const concepts = only.length ? ALL.filter(([p]) => only.includes(p)) : ALL;
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { records: [] };
  let records: any[] = prev.records.filter((r: any) => !concepts.find(([p]) => p === r.phrase));
  fs.mkdirSync("data/vmasks", { recursive: true });
  for (const visit of ["move-in", "move-out"]) {
    const file = `public/demo/video/bedroom-${visit}-walkthrough.mp4`;
    const url = "data:video/mp4;base64," + fs.readFileSync(file).toString("base64");
    const res = await Promise.all(concepts.map(([phrase, label]) => sam31Track({ video_url: url }, phrase, FRAMES).then((r) => [phrase, label, r] as const)));
    for (const [phrase, label, recs] of res) {
      for (const r of recs) {
        const d = decodeMask(r.mask);
        const key = `${visit}-${label}-${r.id}-f${r.frame}`;
        if (d) writePgm(`data/vmasks/${key}.pgm`, d);
        records.push({ key, visit, phrase, label, id: r.id, frame: r.frame, box: r.box, conf: r.conf, maskW: d?.w, maskH: d?.h });
      }
      console.log(visit, phrase, recs.length, "records,", new Set(recs.map((r) => r.id)).size, "ids");
    }
  }
  fs.writeFileSync(OUT, JSON.stringify({ model: "sam-3.1", mode: "video", fps: 5, frames: FRAMES, simulated: true,
    note: "SAM 3.1 video tracking records (box, confidence, per-video object id) for two simulated 12 s walkthrough pans of the Muse Image bedroom. Masks decoded locally; raw tokens not redistributed.", records }, null, 1));
  console.log(budgetStatus());
})();
