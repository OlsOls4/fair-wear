import fs from "node:fs";
import { museSparkJSON } from "../lib/pipeline/models";
import { JUDGE_SYSTEM } from "../lib/pipeline/prompts";
import { JUDGE_SCHEMA } from "../lib/pipeline/schema";
const u = (f: string) => "data:image/jpeg;base64," + fs.readFileSync(f).toString("base64");
(async () => {
  const d = "public/demo/flat/crops/";
  const raw = await museSparkJSON<unknown>(JUDGE_SYSTEM, JSON.stringify({ item: "carpet", room: "bedroom", tenancyYears: 2 }), [u(d + "bedroom-move_in-carpet-0.jpg"), u(d + "bedroom-move_out-carpet-0.jpg")], JUDGE_SCHEMA as any);
  console.log(JSON.stringify(raw));
})();
