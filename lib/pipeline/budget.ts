// Local estimated-cost guard, not an account-wide billing limit. Unknown outcomes
// retain their reservations. Rates and token/frame estimates can differ from billing.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const BUDGET_CAP_USD = Number(process.env.FAIRWEAR_BUDGET_USD ?? 9);
const LEDGER = process.env.FAIRWEAR_LEDGER ?? path.join(process.cwd(), "data", "spend-ledger.json");

// Historical brief prices, not a live provider price lookup.
export const PRICES = {
  samVideoPerFrame: 0.2 / 1000,
  samImage: 2.5 / 1000,
  museImage: 0.01,
  sparkInPerToken: 1.25 / 1e6,
  sparkOutPerToken: 4.25 / 1e6,
};

interface Entry { id?: string; at: string; kind: string; reservedUsd: number; actualUsd?: number; note?: string }
interface Ledger { capUsd: number; entries: Entry[] }
export class BudgetExceeded extends Error {}
export class BudgetLedgerError extends Error {}
const amount = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
function validate(l: Ledger): Ledger {
  if (!amount(BUDGET_CAP_USD) || !l || !amount(l.capUsd) || !Array.isArray(l.entries)) {
    throw new BudgetLedgerError("Budget guard: invalid cap or ledger; refusing calls.");
  }
  const ids = new Set<string>();
  for (const e of l.entries) {
    if (!e || typeof e.at !== "string" || typeof e.kind !== "string" || !amount(e.reservedUsd) ||
      (e.actualUsd !== undefined && !amount(e.actualUsd)) ||
      (e.id !== undefined && (typeof e.id !== "string" || !e.id || ids.has(e.id)))) {
      throw new BudgetLedgerError("Budget guard: invalid ledger entry; refusing calls.");
    }
    if (e.id) ids.add(e.id);
  }
  return l;
}
function load(): Ledger {
  let raw: string;
  try { raw = fs.readFileSync(LEDGER, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return validate({ capUsd: BUDGET_CAP_USD, entries: [] });
    throw new BudgetLedgerError("Budget guard: ledger cannot be read; refusing calls.");
  }
  try { return validate(JSON.parse(raw)); }
  catch { throw new BudgetLedgerError("Budget guard: ledger is invalid; refusing calls without overwriting it."); }
}
function save(l: Ledger) {
  validate(l);
  const tmp = `${LEDGER}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(l, null, 1), { flag: "wx", mode: 0o600 });
    fs.renameSync(tmp, LEDGER);
  } finally { fs.rmSync(tmp, { force: true }); }
}
// Exclusive, short-lived lock shared by reservations and settlements. Never break
// an existing/stale lock automatically: its owner or ledger may need reconciliation.
function locked<T>(operation: () => T): T {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  let fd: number;
  try { fd = fs.openSync(`${LEDGER}.lock`, "wx", 0o600); }
  catch { throw new BudgetLedgerError("Budget guard: ledger lock unavailable; refusing calls."); }
  try { return operation(); }
  finally { fs.closeSync(fd); fs.unlinkSync(`${LEDGER}.lock`); }
}
export function spentUsd(l = load()) {
  validate(l);
  const total = l.entries.reduce((s, e) => s + (e.actualUsd ?? e.reservedUsd), 0);
  if (!amount(total)) throw new BudgetLedgerError("Budget guard: invalid total; refusing calls.");
  return total;
}

/** Reserve before sending. Settle only with complete, validated usage; otherwise keep the estimate. */
export function reserve(kind: string, reservedUsd: number, note?: string) {
  if (!amount(reservedUsd)) throw new BudgetExceeded("Budget guard: invalid reservation; refused.");
  const id = randomUUID();
  locked(() => {
    const l = load();
    const cap = Math.min(l.capUsd, BUDGET_CAP_USD);
    const spent = spentUsd(l);
    if (spent + reservedUsd > cap) {
      throw new BudgetExceeded(`Budget guard: ${kind} needs $${reservedUsd.toFixed(4)}, spent $${spent.toFixed(4)} of $${cap} cap — refused.`);
    }
    l.entries.push({ id, at: new Date().toISOString(), kind, reservedUsd, note });
    save(l);
  });
  return (actualUsd?: number) => {
    if (actualUsd === undefined) return;
    if (!amount(actualUsd)) throw new BudgetLedgerError("Budget guard: invalid settlement; reservation retained.");
    locked(() => {
      const l = load();
      const entry = l.entries.find((e) => e.id === id);
      if (!entry) throw new BudgetLedgerError("Budget guard: reservation missing; refusing settlement.");
      if (entry.actualUsd !== undefined && entry.actualUsd !== actualUsd) {
        throw new BudgetLedgerError("Budget guard: conflicting settlement; refusing overwrite.");
      }
      entry.actualUsd = actualUsd;
      save(l);
    });
  };
}

export function sparkCost(inTok: number, outTok: number) {
  if (!Number.isSafeInteger(inTok) || inTok < 0 || !Number.isSafeInteger(outTok) || outTok < 0) {
    throw new BudgetLedgerError("Budget guard: invalid token usage.");
  }
  return inTok * PRICES.sparkInPerToken + outTok * PRICES.sparkOutPerToken;
}

export function budgetStatus() {
  const l = load();
  return { capUsd: Math.min(l.capUsd, BUDGET_CAP_USD), spentUsd: spentUsd(l), calls: l.entries.length, ledger: LEDGER };
}
