# Conservative correspondence safeguards

Implemented against `a04380a`; this changes future pipeline runs, not the cached public demonstration.

## Decision rule

`matchItems` returns `{ pairs, unresolved, coverage, minScore, tieTolerance }`, rather than an array. `pairs` contains mutually unique best matches and genuine one-sided observations that have **no eligible candidate**. Every other unpaired observation is in `unresolved`, with its side, original item, candidate items/scores and a `tied_best` or `not_mutually_unique` reason. These records have `needs_review` status, not an added/missing/condition verdict.

Eligibility retains the existing same-room label/appearance/box score and default minimum score 0.5. A best candidate must be unique on **both** sides with an absolute score separation greater than 0.05 (plus 1e-12 numerical boundary protection). The tolerance is explicit and configurable, not a calibrated probability. Both sides are evaluated against the complete original eligible candidate sets. Matches never remove competitors and promote a runner-up. Visit-local track IDs are neither identity evidence nor tie-breakers.

An otherwise accepted pair can have weaker competitors. Those rejected competitors stay unresolved rather than becoming false additions/removals. Items from different rooms cannot match; if they have no other candidate they retain the existing one-sided evidence-gap behavior. A no-candidate observation still cannot prove an actual addition or removal: `changeStatus` and the judge's existing one-sided handling remain unresolved.

## Downstream behavior and coverage

- `/api/analyze` uses a shared, dependency-injected handler. Only `pairs` can enter `judge`; ambiguous observations cannot. Per-room correspondence reports are retained inside `pack.correspondence`, including full candidates, thresholds and counts. A deterministic warning is prepended to the reply whenever ambiguity remains. All-ambiguous/empty input does not request a model-written pack. The existing demo-mode 503 refusal and validation-failure 502 response remain intact.
- The offline demo crop runner judges only accepted two-sided pairs. It saves per-room reports in `correspondence`, with `judgedPairs`, explicit `skippedOneSided` observations and the complete unresolved bucket. Counts cover every extracted observation. Partial room reruns preserve other room reports and mark `legacyCoverageUnknown` if retained legacy findings have no coverage report; missing historical coverage is never represented as zero.
- Coverage counts are observation counts, not unique physical objects or accuracy: `beforeItems = matchedPairs + beforeOnly + unresolvedBefore`, and the analogous equation holds after. `resolvedItems` means resolved for correspondence routing, **not** proven condition or liability. One-sided observations counted there still have evidence-gap semantics downstream.
- Cached `public/demo`, saved evaluations and historical metrics are untouched. No paid model run was performed. Future output consumers must inspect correspondence and coverage before interpreting findings as complete; the existing cached-sample UI does not gain a new ambiguity review interface in this change.

## Tests and limitations

Offline regressions cover input permutations, exact and near ties (including the tolerance boundary), same labels, equal track IDs across visits, 2×1 and 1×2 cases, differing rooms, supported unique pairs, original-set runner-up rejection, one-sided behavior, item accounting, no-judge API orchestration, no model pack for all-ambiguous inputs, demo coverage and validation failure behavior.

Validation: full `npm run check` aggregate, production build (MOCK=1, paid calls disabled), PDF formatter tests and SceneDiff oracle harness passed. The oracle is only a harness sanity check, not new model accuracy. Typechecking initially exceeded available memory and passed when rerun with `NODE_OPTIONS=--max-old-space-size=384`.

All four optional browser suites were attempted against the local production server but Chromium exited at launch because this execution environment blocks its socket operation. No browser behavior is claimed verified. No UI files changed. The production server itself started successfully when explicitly bound to 127.0.0.1.

Remaining limitations: this is conservative score-based abstention, not geometric alignment or validated cross-visit identity. A unique label-only candidate can still be incorrect; camera motion, occlusion, segmentation duplicates, inconsistent room labels and incomplete views remain unresolved research problems. The 0.05 margin is a policy threshold without empirical calibration. No real-data coverage/accuracy improvement is claimed. Failed runs still return an error instead of partial evidence packs; the demo runner writes its combined output only on successful completion.
