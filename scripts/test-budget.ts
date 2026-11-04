// Offline-only budget tests. Never use or inspect an existing ledger or credential.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fw-budget-"));
const ledger = path.join(dir, "ledger.json");
process.env.FAIRWEAR_LEDGER = ledger;
process.env.FAIRWEAR_BUDGET_USD = "1";
async function main() {
  const { reserve, budgetStatus, BudgetExceeded, BudgetLedgerError, sparkCost, PRICES } = await import("../lib/pipeline/budget");
  const read = () => fs.readFileSync(ledger, "utf8");
  const reset = () => fs.writeFileSync(ledger, JSON.stringify({ capUsd: 1, entries: [] }));
  const s = reserve("a", 0.6); s(0.5);
  reserve("b", 0.4);
  assert.equal(budgetStatus().spentUsd, 0.9);
  assert.throws(() => reserve("c", 0.2), BudgetExceeded);
  assert.throws(() => s(0), BudgetLedgerError);
  for (const value of [NaN, Infinity, -1]) {
    assert.throws(() => reserve("invalid", value), BudgetExceeded);
    assert.throws(() => s(value), BudgetLedgerError);
  }
  const valid = read();
  for (const corrupt of ["{", "null", "[]", '{}', '{"entries":[],"capUsd":"1"}',
    JSON.stringify({ capUsd: -1, entries: [] }),
    JSON.stringify({ capUsd: 1, entries: [{ at: "now", kind: "x", reservedUsd: -1 }] }),
    JSON.stringify({ capUsd: 1, entries: [{ at: "now", kind: "x", reservedUsd: 1, actualUsd: null }] })]) {
    fs.writeFileSync(ledger, corrupt);
    assert.throws(() => reserve("blocked", 0.01), BudgetLedgerError);
    assert.equal(read(), corrupt);
  }
  fs.writeFileSync(ledger, valid);
  fs.writeFileSync(`${ledger}.lock`, "held by another writer");
  assert.throws(() => reserve("concurrent", 0), BudgetLedgerError);
  assert.throws(() => s(0.5), BudgetLedgerError);
  assert.equal(read(), valid);
  fs.unlinkSync(`${ledger}.lock`);
  fs.unlinkSync(ledger); fs.mkdirSync(ledger);
  assert.throws(() => reserve("unreadable", 0.1), BudgetLedgerError);
  fs.rmdirSync(ledger);
  reset();
  const pending = reserve("pending", 0.2);
  pending(); assert.equal(budgetStatus().spentUsd, 0.2);
  reset(); assert.throws(() => pending(0.1), BudgetLedgerError);
  assert.equal(budgetStatus().spentUsd, 0);
  for (const n of [-1, NaN, Infinity, 1.2, "3", undefined]) assert.throws(() => sparkCost(n as number, 0), BudgetLedgerError);
  // Invalid configured caps are checked in fresh module instances.
  for (const cap of ["NaN", "Infinity", "-1", "garbage"]) {
    const child = spawnSync(process.execPath, ["--import", "tsx", "--eval", `const { reserve } = require('./lib/pipeline/budget.ts'); try { reserve('invalid cap', 0); process.exit(1); } catch { process.exit(0); }`], {
      cwd: process.cwd(), env: { ...process.env, FAIRWEAR_BUDGET_USD: cap }, encoding: "utf8",
    });
    assert.equal(child.status, 0, child.stderr);
  }
  // Independent processes must never overwrite another successful reservation.
  reset();
  const results = await Promise.all(Array.from({ length: 6 }, () => new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "--eval", `const { reserve, BudgetExceeded, BudgetLedgerError } = require('./lib/pipeline/budget.ts'); let accepted = 0; for (let i = 0; i < 5; i++) { try { reserve('parallel', 0.125); accepted++; } catch (e) { if (!(e instanceof BudgetExceeded || e instanceof BudgetLedgerError)) throw e; } } console.log(accepted);`], { cwd: process.cwd(), env: process.env });
    let stdout = "", stderr = "";
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(Number(stdout.trim())) : reject(new Error(stderr)));
  })));
  const accepted = results.reduce((a, b) => a + b, 0);
  assert.ok(accepted > 0 && accepted <= 8);
  assert.equal(budgetStatus().calls, accepted);
  assert.equal(budgetStatus().spentUsd, accepted * 0.125);
  // Exercise real wrapper control flow against an in-memory transport only.
  process.env.MODEL_API_KEY = "offline-test-placeholder";
  process.env.META_API_KEY = "offline-test-placeholder";
  process.env.FAIRWEAR_ALLOW_PAID = "1";
  process.env.MOCK = "0";
  delete process.env.VERCEL;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("offline transport failure"); };
  const { museImageRaw, museImageCard, museSparkText, museSparkJSON, sam31Segment, sam31Track } = await import("../lib/pipeline/models");
  for (const frames of [-1, 0, 1.5, NaN, Infinity]) {
    reset(); calls = 0;
    await assert.rejects(sam31Track({ video_url: "offline" }, "test", frames), /positive integer frame bound/);
    assert.equal(calls, 0); assert.equal(budgetStatus().calls, 0);
  }
  for (const invoke of [() => museImageRaw("test"), () => museImageCard("test"), () => museSparkText("test", "test"), () => museSparkJSON("test", "test")]) {
    reset(); calls = 0;
    await assert.rejects(invoke(), /offline transport failure/);
    assert.equal(calls, 1);
    assert.ok(budgetStatus().spentUsd > 0);
    assert.equal(budgetStatus().calls, 1);
  }
  // SAM sanitizes transport details, but it must preserve single-call reservations.
  const { SamResponseError } = await import("../lib/pipeline/sam-response");
  for (const [invoke, reserved] of [
    [() => sam31Segment("offline", "test"), PRICES.samImage],
    [() => sam31Track({ video_url: "offline" }, "test", 7), 7 * PRICES.samVideoPerFrame],
  ] as const) {
    for (const failure of ["network", "body", 429, 500, 503] as const) {
      reset(); calls = 0;
      globalThis.fetch = async () => {
        calls++;
        if (failure === "network") throw new Error("offline private transport detail");
        if (failure === "body") return { text: async () => { throw new Error("offline private body detail"); } , ok: true } as unknown as Response;
        return new Response("offline private provider detail", { status: failure });
      };
      await assert.rejects(invoke(), error => error instanceof SamResponseError
        && error.code === "SAM_RESPONSE_INVALID"
        && error.message === "SAM request or response body did not complete.");
      assert.equal(calls, 1);
      assert.equal(budgetStatus().calls, 1);
      assert.equal(budgetStatus().spentUsd, reserved);
      assert.equal(JSON.parse(read()).entries[0].actualUsd, undefined);
    }
  }
  for (const status of [429, 500, 503]) {
    reset(); calls = 0;
    globalThis.fetch = async () => { calls++; return new Response("offline failure", { status }); };
    await assert.rejects(museImageRaw("test"));
    assert.equal(calls, 1); assert.equal(budgetStatus().spentUsd, 0.01);
  }
  for (const usage of [{}, { prompt_tokens: 1 }, { prompt_tokens: -1, completion_tokens: 0 }, { prompt_tokens: "1", completion_tokens: 1 }]) {
    reset();
    globalThis.fetch = async () => Response.json({ usage, choices: [{ message: { content: "ok" } }] });
    await assert.rejects(museSparkText("test", "test"), BudgetLedgerError);
    assert.ok(budgetStatus().spentUsd > 0);
    assert.equal(JSON.parse(read()).entries[0].actualUsd, undefined);
  }
  reset();
  globalThis.fetch = async () => Response.json({ usage: { prompt_tokens: 1, completion_tokens: 1 }, choices: [{ message: { content: "ok" } }] });
  assert.equal(await museSparkText("test", "test"), "ok");
  assert.equal(budgetStatus().spentUsd, sparkCost(1, 1));
  fs.writeFileSync(ledger, "broken"); calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("must not send"); };
  await assert.rejects(museImageRaw("test"), BudgetLedgerError);
  await assert.rejects(sam31Segment("offline", "test"), BudgetLedgerError);
  assert.equal(calls, 0);
  console.log("Budget fail-closed and offline model transport regressions passed");
}
main().finally(() => fs.rmSync(dir, { recursive: true, force: true })).catch((error) => { console.error(error); process.exitCode = 1; });
