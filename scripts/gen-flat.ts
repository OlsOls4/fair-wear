// Builds the SIMULATED demo flat: 4 rooms, a "move-in" image from Muse Image and a "move-out" edit with planted changes.
// Sandbox only (needs the bound Meta key; budget guard enforced). Output: public/demo/flat/*.jpg + eval/flat/planted.json
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { museImageRaw } from "../lib/pipeline/models";
import { budgetStatus } from "../lib/pipeline/budget";

const ROOMS = [
  { room: "bedroom", before: "Photorealistic amateur phone photo of an empty UK rental bedroom, magnolia walls, beige carpet, a window with grey curtains and a radiator, built-in white wardrobe, soft daylight, wide angle", planted: [
    { item: "wall", verdict: "damage", edit: "a deep 8 cm gouge in the magnolia wall plaster with exposed white plaster, on the wall right of the window just above the skirting board" },
    { item: "carpet", verdict: "fair_wear", edit: "a subtle slightly flattened, marginally darker patch of carpet pile in front of the wardrobe doors from ordinary foot traffic" } ] },
  { room: "living-room", before: "Photorealistic amateur phone photo of an empty UK rental living room, light grey walls, mid-grey carpet, bay window with cream curtains, white skirting boards, soft daylight, wide angle", planted: [
    { item: "carpet", verdict: "damage", edit: "a large dark brown spilled-drink stain about 30 cm across on the carpet near the middle of the room" },
    { item: "curtains", verdict: "fair_wear", edit: "the cream curtains slightly sun-faded along their upper folds and edges (gentle even fading, no stains or tears)" } ] },
  { room: "kitchen", before: "Photorealistic amateur phone photo of a clean UK rental kitchen, wood-effect laminate worktop, white shaker cupboards, built-in electric oven and hob, stainless sink, vinyl floor, daylight, wide angle", planted: [
    { item: "worktop", verdict: "damage", edit: "a round dark brown heat-damage ring about 12 cm across on the laminate worktop next to the hob, with a slightly lifted edge" },
    { item: "oven", verdict: "cleaning", edit: "the oven door glass and hob dirty with greasy brown residue and food splatters (dirty, but undamaged)" } ] },
  { room: "bathroom", before: "Photorealistic amateur phone photo of a clean UK rental bathroom, white bath with shower screen, white tiles with white grout, white toilet and basin, white sealant around the bath, daylight, wide angle", planted: [
    { item: "bath", verdict: "damage", edit: "a small chip about 4 cm wide missing from the white enamel on the bath rim, showing grey metal beneath" },
    { item: "sealant", verdict: "cleaning", edit: "dark mildew spots and limescale marks along the sealant around the bath and on the shower screen (needs cleaning, nothing broken)" } ] },
];
const dataUrl = (b: Buffer) => `data:image/jpeg;base64,${b.toString("base64")}`;
const toJpg = (webp: Buffer) => {
  fs.writeFileSync("/tmp/in.webp", webp);
  execFileSync("python3", ["-c", "from PIL import Image;im=Image.open('/tmp/in.webp').convert('RGB');im.thumbnail((1280,1280));im.save('/tmp/out.jpg',quality=82)"]);
  return fs.readFileSync("/tmp/out.jpg");
};
(async () => {
  fs.mkdirSync("public/demo/flat", { recursive: true });
  const only = process.argv[2];
  const manifest: any[] = fs.existsSync("eval/flat/planted.json") ? JSON.parse(fs.readFileSync("eval/flat/planted.json", "utf8")) : [];
  for (const r of ROOMS) {
    if (only && only !== r.room) continue;
    if (manifest.find((m) => m.room === r.room)) { console.log("skip", r.room); continue; }
    const bf = `public/demo/flat/${r.room}-move-in.jpg`;
    const before = fs.existsSync(bf) ? fs.readFileSync(bf) : toJpg(await museImageRaw(r.before));
    fs.writeFileSync(`public/demo/flat/${r.room}-move-in.jpg`, before);
    const editPrompt = `Edit this photo. Keep the exact same room, camera position, furniture, fittings, lighting and framing; change only the following: ${r.planted.map((p) => p.edit).join("; and ")}.`;
    const after = toJpg(await museImageRaw(editPrompt, [dataUrl(before)]));
    fs.writeFileSync(`public/demo/flat/${r.room}-move-out.jpg`, after);
    manifest.push({ room: r.room, simulated: true, moveIn: `/demo/flat/${r.room}-move-in.jpg`, moveOut: `/demo/flat/${r.room}-move-out.jpg`, planted: r.planted.map(({ item, verdict }) => ({ item, verdict })) });
    fs.mkdirSync("eval/flat", { recursive: true });
    fs.writeFileSync("eval/flat/planted.json", JSON.stringify(manifest, null, 1));
    console.log("done", r.room, budgetStatus().spentUsd);
  }
})();
