import fs from "node:fs";
import { museImageRaw } from "../lib/pipeline/models";
(async () => {
  const b = fs.readFileSync("public/demo/flat/bathroom-move-in.jpg");
  const ref = ["data:image/jpeg;base64," + b.toString("base64")];
  const cands = [
   "Edit this photo. Keep the exact same room, camera position, furniture, fittings, lighting and framing; change only the following: a small chip in the white enamel on the side edge of the bath, showing grey metal underneath; and grimy grey-brown marks and limescale along the sealant strip where the bath meets the tiles",
   "Edit this photo. Keep everything the same; change only: a small chip in the white enamel on the edge of the bath",
   "Edit this photo. Keep everything the same; change only: grubby limescale marks along the sealant where the bath meets the tiles",
  ];
  let i = 0;
  for (const c of cands) { try { const o = await museImageRaw(c, ref); fs.writeFileSync(`/tmp/bath${i}.webp`, o); console.log("ok", i); } catch (e) { console.log("fail", i, String(e).slice(0,120)); } i++; }
})();
