import fs from "node:fs";
import { museImageRaw } from "../lib/pipeline/models";
import { budgetStatus } from "../lib/pipeline/budget";
(async () => {
  const b = await museImageRaw("Photorealistic phone photo of an empty UK rental bedroom, magnolia walls, beige carpet, single window with grey curtains, built-in wardrobe, daylight, wide angle, slightly imperfect amateur framing");
  fs.writeFileSync("data/smoke-bedroom-before.webp", b);
  console.log("bytes", b.length, budgetStatus());
})();
