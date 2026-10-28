// Hard budget guard for Meta Model API usage.
// Every paid call reserves its worst-case cost BEFORE it is sent and is refused if the
// persisted lifetime total would pass the cap. Actual cost (from usage, when the API
// reports it) replaces the reservation afterwards. The ledger lives on local disk, so the
// guard only works where a key is present — the sandbox. The live site never has a key.
import fs from "node:fs";
import path from "node:path";

export const BUDGET_CAP_USD = Number(process.env.FAIRWEAR_BUDGET_USD ?? 9); // lifetime cap, under the $10 promise
const LEDGER = process.env.FAIRWEAR_LEDGER ?? path.join(process.cwd(), "data", "spend-ledger.json");

// List prices (USD) from the hackathon brief, standard mode.
export const PRICES = {
  samVideoPerFrame: 0.2 / 1000,
  samImage: 2.5 / 1000,
  museImage: 0.01,
  sparkInPerToken: 1.25 / 1e6,
  sparkOutPerToken: 4.25 / 1e6,
};

interface Entry { at: string; kind: string; reservedUsd: number; actualUsd?: number; note?: string }
interface Ledger { capUsd: number; entries: Entry[] }

function load(): Ledger {
  try { return JSON.parse(fs.readFileSync(LEDGER, "utf8")); } catch { return { capUsd: BUDGET_CAP_USD, entries: [] }; }
}
function save(l: Ledger) {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  const tmp = LEDGER + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(l, null, 1));
  fs.renameSync(tmp, LEDGER);
}

export function spentUsd(l = load()) {
  return l.entries.reduce((s, e) => s + (e.actualUsd ?? e.reservedUsd), 0);
}

export class BudgetExceeded extends Error {}

/** Reserve cost before a call. Throws BudgetExceeded if it would pass the cap. Returns a settle() callback. */
export function reserve(kind: string, reservedUsd: number, note?: string) {
  const l = load();
  const cap = Math.min(l.capUsd ?? BUDGET_CAP_USD, BUDGET_CAP_USD);
  const spent = spentUsd(l);
  if (!(reservedUsd >= 0) || spent + reservedUsd > cap) {
    throw new BudgetExceeded(`Budget guard: ${kind} needs $${reservedUsd.toFixed(4)}, spent $${spent.toFixed(4)} of $${cap} cap — refused.`);
  }
  const entry: Entry = { at: new Date().toISOString(), kind, reservedUsd, note };
  l.entries.push(entry);
  save(l);
  const idx = l.entries.length - 1;
  return (actualUsd?: number) => {
    if (actualUsd === undefined) return; // keep the (worst-case) reservation
    const l2 = load();
    if (l2.entries[idx]) { l2.entries[idx].actualUsd = actualUsd; save(l2); }
  };
}

export function sparkCost(inTok: number, outTok: number) {
  return inTok * PRICES.sparkInPerToken + outTok * PRICES.sparkOutPerToken;
}

export function budgetStatus() {
  const l = load();
  return { capUsd: Math.min(l.capUsd ?? BUDGET_CAP_USD, BUDGET_CAP_USD), spentUsd: spentUsd(l), calls: l.entries.length, ledger: LEDGER };
}
