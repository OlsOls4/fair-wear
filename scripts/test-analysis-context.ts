import assert from "node:assert/strict";
import { createAnalyzeHandler } from "../lib/pipeline/analyze";
import { independentCropBoxes } from "./crop-plan";
import { validateJudge } from "../lib/pipeline/schema";

process.env.MOCK = "1";
process.env.FAIRWEAR_ALLOW_PAID = "0";
globalThis.fetch = async () => { throw new Error("Network forbidden"); };
const room = { room: "fixture", moveInUrl: "opaque-source-A", moveOutUrl: "opaque-source-B",
  moveInDate: "2022-01-01", moveOutDate: "2024-01-01", provenance: "user_supplied_records", sameRoomConfirmed: true, sameItemsConfirmed: true };
const input = { property: "Synthetic fixture", context: "tenancy", tenancyYears: 2, rooms: [room] };
const calls: string[] = [];
const handler = createAnalyzeHandler({ mock: false,
  extractItems: async () => { calls.push("extract"); return []; },
  judge: async () => { calls.push("judge"); throw new Error("No items"); },
  buildPack: async () => { calls.push("pack"); throw new Error("No findings"); },
});
async function run(body: unknown) { return handler(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) })); }
async function main() {
  for (const body of [null, {}, [], { ...input, context: undefined }, { ...input, context: "cleaning" }, { ...input, context: "unknown" },
    ...[undefined, null, "2", 0, -1].map(tenancyYears => ({ ...input, tenancyYears })),
    ...[{ moveInDate: undefined }, { moveOutDate: undefined }, { moveInDate: "2024-01-01", moveOutDate: "2022-01-01" },
      { moveInDate: "2024-02-30" }, { moveInDate: room.moveOutDate }, { provenance: "unknown" },
      { provenance: "found-online" }, { sameRoomConfirmed: false }, { sameItemsConfirmed: undefined }, { moveOutUrl: "" }]
      .map(change => ({ ...input, rooms: [{ ...room, ...change }] })),
    // Validate the whole batch before extracting anything from a qualified first room.
    { ...input, rooms: [room, { ...room, moveInDate: undefined }] },
  ]) {
    const response = await run(body);
    assert.equal(response.status, 422);
    const result = await response.json();
    assert.equal(result.status, "unresolved");
    assert.equal("pack" in result, false);
    assert.deepEqual(calls, []);
  }
  // Opaque URLs supply neither chronology nor provenance. Explicit declarations qualify;
  // validation never claims to authenticate their truth or parse dates from filenames.
  const result = await (await run(input)).json();
  assert.deepEqual(calls, ["extract", "extract"]);
  assert.equal(result.pack.context.source, "user_declared");
  assert.match(result.pack.context.limitation, /not independently verified/);
  assert.equal(result.pack.context.records[0].sameItemsConfirmed, true);
  const before = [10, 20, 100, 80, 200, 100], after = [200, 10, 400, 90, 800, 400];
  const crop = independentCropBoxes(before, after);
  assert.deepEqual(crop.before, before.slice(0, 4)); assert.deepEqual(crop.after, after.slice(0, 4));
  assert.equal(crop.sharedCoordinates, false); assert.equal(crop.registration, "unverified");
  // Equal-sized views still do not establish registration; reversal only swaps local crops.
  const equal = [110, 0, 180, 90, 200, 100];
  assert.equal(independentCropBoxes(before, equal).sharedCoordinates, false);
  assert.deepEqual(independentCropBoxes(equal, before).after, before.slice(0, 4));
  for (const bad of [[0, 0, 900, 50, 200, 100], [0, 0, 0, 1, 10, 10], [NaN, 0, 1, 1, 10, 10]]) assert.throws(() => independentCropBoxes(before, bad));
  // Schema checks shape, not truth: this causal statement can pass. Prompts are not enforcement.
  assert.equal(validateJudge({ verdict: "cleaning", confidence: .9, description: "Someone cleaned this surface.", moved: false, evidence: "It looks lighter." }).ok, true);
  console.log("Passed offline context gates, chronology reversal, attestation retention, independent crop and validator-limit tests; no model calls.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
