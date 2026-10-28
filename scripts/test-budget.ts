// Checks the budget guard refuses calls past the cap (uses a throwaway ledger).
import fs from "node:fs";
process.env.FAIRWEAR_LEDGER = "/tmp/fw-test-ledger.json"; process.env.FAIRWEAR_BUDGET_USD = "1";
fs.rmSync(process.env.FAIRWEAR_LEDGER, { force: true });
(async () => {
const { reserve, budgetStatus, BudgetExceeded } = await import("../lib/pipeline/budget");
const s = reserve("a", 0.6); s(0.5);
reserve("b", 0.4);
let refused = false; try { reserve("c", 0.2); } catch (e) { refused = e instanceof BudgetExceeded; }
console.log(budgetStatus(), refused ? "REFUSED_OK" : "FAIL");
if (!refused) process.exit(1);
})();
