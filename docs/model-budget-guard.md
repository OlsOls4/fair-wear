# Future/local model budget guard

This guard applies only to explicitly opted-in local scripts. It does not enable inference on the public site, change saved model results or establish provider billing.

## Fail-closed behavior

- The configured cap, stored cap, reservations, settlements and ledger total must be finite nonnegative numbers. Existing ledger entries without IDs remain readable; new entries use unique IDs for settlement.
- Only a missing ledger starts a new empty ledger. Malformed JSON, invalid entries and other read errors stop calls without overwriting the ledger.
- Reservation and settlement each hold an exclusive local filesystem lock. A competing writer is refused rather than waiting or losing another writer's update. Writes use distinct temporary files and atomic rename.
- The persisted reservation precedes the network request. HTTP errors and network errors are not automatically retried. Any subsequent caller-initiated attempt needs a new reservation. The judge's separate output-validation retry likewise creates a new reservation through the wrapper.
- Unknown outcomes retain the estimate. Image failures no longer settle to zero. Spark settlement requires both token counts to be nonnegative safe integers. Missing usage retains the reservation; present but malformed usage fails and retains it. A valid reported cost can exceed the reservation and is recorded, so subsequent calls are blocked if the local cap is exceeded.
- Settlement matches a unique reservation ID, not an array position. Missing reservations or conflicting repeated settlements fail.

## Limits and recovery

This is an estimated-cost local guard, not a guaranteed billing ceiling. Spark input-token/image estimates and caller-supplied SAM frame bounds are not verified provider limits. Prices are historical configured constants, not a live price lookup. Other scripts/accounts/machines can spend outside this ledger. Deleting or changing the ledger/path resets or changes its history. Atomic replacement and locks are not a provider transaction or a power-loss durability guarantee.

A crash may leave a lock and/or an unsettled reservation. Do not automatically delete locks, clear reservations, reset the ledger or infer that an error was free. Stop local paid runs, verify no writer is active, preserve the ledger and reconcile uncertain calls against provider records before manually repairing it. A missing ledger should only be used when deliberately starting a separately accounted budget. Changes to the ledger are operator decisions, not automated recovery.

Tests in `scripts/test-budget.ts` use unique temporary ledgers and an in-memory fetch stub. They cover corrupt/read-failing ledgers, invalid caps and amounts, lock contention, stale settlement identity, unknown costs, single-attempt HTTP failures and no-send behavior on guard failure. They never invoke a provider or inspect credentials or existing ledgers.
