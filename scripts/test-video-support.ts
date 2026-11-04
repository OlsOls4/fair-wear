// Exercise the real video entrypoint with paid mode synthetically enabled and a
// transport trap. No existing credential/ledger is read and no network is allowed.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { UnsupportedVideoAnalysisError } from "../lib/pipeline/video-support";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fw-video-gate-"));
const ledger = path.join(dir, "ledger.json");
process.env.MODEL_API_KEY = "offline-test-placeholder";
process.env.META_API_KEY = "offline-test-placeholder";
process.env.MOCK = "0";
process.env.FAIRWEAR_ALLOW_PAID = "1";
process.env.FAIRWEAR_LEDGER = ledger;
process.env.FAIRWEAR_BUDGET_USD = "1";
delete process.env.VERCEL;
let network = 0;
globalThis.fetch = async () => { network++; throw new Error("Network forbidden"); };
async function main() {
  const { extractItems } = await import("../lib/pipeline/index");
  const { MOCK } = await import("../lib/pipeline/models");
  assert.equal(MOCK, false, "Prove the guard is independent of demo mode or missing keys");
  for (const source of ["https://example.invalid/room.mp4", "data:video/mp4;base64,AAAA", "opaque-reference", "https://example.invalid/disguised.jpg", ""]) {
    await assert.rejects(extractItems(source, "move_in", "bedroom"), error => error instanceof UnsupportedVideoAnalysisError && error.code === "VIDEO_ANALYSIS_UNSUPPORTED");
    await assert.rejects(extractItems(source, "move_out", "bedroom", [], 0), UnsupportedVideoAnalysisError);
  }
  assert.equal(network, 0); assert.equal(fs.existsSync(ledger), false);
  const { POST } = await import("../app/api/analyze/route");
  const body = { property: "Synthetic video request", context: "tenancy", tenancyYears: 2, rooms: [{
    room: "bedroom", moveInUrl: "https://example.invalid/before.mp4", moveOutUrl: "https://example.invalid/after.mp4",
    moveInDate: "2022-01-01", moveOutDate: "2024-01-01", provenance: "user_supplied_records", sameRoomConfirmed: true, sameItemsConfirmed: true,
  }] };
  const response = await POST(new Request("http://localhost/api/analyze", { method: "POST", body: JSON.stringify(body) }));
  assert.equal(response.status, 501);
  const result = await response.json();
  assert.equal(result.mock, false); assert.equal(result.error, "video_analysis_unsupported");
  assert.match(result.message, /No model calls were made/);
  assert.equal("pack" in result, false); assert.equal("findings" in result, false);
  assert.equal(network, 0); assert.equal(fs.existsSync(ledger), false);
  // A malformed request is still rejected by input qualification, also without calls.
  const invalid = await POST(new Request("http://localhost/api/analyze", { method: "POST", body: "{}" }));
  assert.equal(invalid.status, 422); assert.equal(network, 0);
  const publicMode = spawnSync(process.execPath, ["--import", "tsx", "--eval", `
    const assert = require('node:assert/strict');
    globalThis.fetch = async () => { throw new Error('Network forbidden'); };
    const { POST } = require('./app/api/analyze/route.ts');
    (async () => { for (const body of ['{}', 'invalid', ${JSON.stringify(JSON.stringify(body))}]) {
      const response = await POST(new Request('http://localhost', { method: 'POST', body }));
      assert.equal(response.status, 503); const result = await response.json();
      assert.equal(result.error, 'analysis_unavailable'); assert.equal(result.mock, true); assert.equal('pack' in result, false);
    } })().catch(e => { console.error(e); process.exitCode = 1; });
  `], { cwd: process.cwd(), env: { ...process.env, MOCK: "1", FAIRWEAR_ALLOW_PAID: "0" }, encoding: "utf8" });
  assert.equal(publicMode.status, 0, publicMode.stderr);
  assert.equal(fs.existsSync(ledger), false);
  // Still-image wrapper remains usable through a wholly in-memory fake transport.
  const { sam31Segment } = await import("../lib/pipeline/models");
  globalThis.fetch = async (_url, init) => {
    network++;
    const request = JSON.parse(String(init?.body));
    assert.equal(request.model, "sam-3.1");
    assert.equal(request.input[0].content[1].type, "input_image");
    return new Response('data: {"type":"response.completed","response":{"status":"completed","output":[]}}\n\n');
  };
  assert.deepEqual(await sam31Segment("data:image/jpeg;base64,offline-fixture", "wall"), []);
  assert.equal(network, 1);
  const imageLedger = fs.readFileSync(ledger, "utf8");
  globalThis.fetch = async () => { network++; throw new Error("Network forbidden"); };
  await assert.rejects(extractItems("opaque-video", "move_in", "bedroom"), UnsupportedVideoAnalysisError);
  assert.equal(network, 1); assert.equal(fs.readFileSync(ledger, "utf8"), imageLedger);
  console.log("PASS video capability gate: direct real entrypoint and API reject before transport/reservation, including with paid mode enabled. No real model/network calls.");
}
main().finally(() => fs.rmSync(dir, { recursive: true, force: true })).catch(error => { console.error(error); process.exitCode = 1; });
