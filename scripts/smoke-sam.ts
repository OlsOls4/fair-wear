import fs from "node:fs";
import { sam31Segment } from "../lib/pipeline/models";
(async () => {
  const b = fs.readFileSync("public/demo/flat/bedroom-move-out.jpg");
  const url = "data:image/jpeg;base64," + b.toString("base64");
  for (const c of ["window", "wardrobe", "curtain", "beige carpet"]) {
    const recs = await sam31Segment(url, c);
    console.log(c, recs.map((r) => ({ id: r.id, box: r.box, conf: r.conf, mask: r.mask.length })));
  }
})();
