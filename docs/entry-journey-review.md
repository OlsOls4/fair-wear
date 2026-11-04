# Entry journey review (4 November 2026)

Base: `a04380a`. Scope: accurate repository introduction and a coherent sample entry path; no source model artifacts, evidence viewer, handoff semantics or private-case behavior changed.

## Findings and changes

- README called the project a scaffold running MOCK and left real-model evaluation as a future placeholder despite the committed generated-flat run. It now separates the recorded real SAM/Muse run from local MOCK wrappers and the SceneDiff oracle/mock harness. It publishes the recorded fixture counts, links the evidence, explains its small synthetic/non-held-out nature and missing raw traces, and describes current live-analysis, storage and export limits. Original architecture notes are labelled as a plan, not a feature inventory.
- Homepage comparison defaulted to living room. It now begins with the bedroom and its disclosed fair-wear/model-damage mismatch. All four rooms and comparison controls remain available.
- The first board shortcut targeted living-room carpet, which the three-claim case handoff does not include. “Inspect a change” now targets bedroom carpet; “Inspect a label mismatch” targets the bath misclassification. Both are supported handoff claims. Sample-only explanatory text describes how to select a response and carry it into the matching fictional claim.
- DOM regressions now check these destinations, repeated activation, filtered-out navigation and dismissal/reset follow-ons. Handoff regression explicitly checks the first guided target matches a case claim. Native browser scripts have corresponding expected destinations and a new homepage → bedroom shortcut → existing handoff/export flow.

## Verification

Passed on this checkout, with `MOCK=1 FAIRWEAR_ALLOW_PAID=0`:

- `npm run check`: full aggregate typecheck, unit tests, 62 review DOM checks, 25 session checks, 40 sample-handoff checks, Evidence Lab tests/manifest integrity and Case Builder tests.
- `NEXT_TELEMETRY_DISABLED=1 npm run build`: production build.
- `python scripts/test-pack-format.py`: formatter and confidence-boundary checks.
- SceneDiff oracle: 20 pairs / 55 objects, precision/recall/F1 = 1, zero paid calls. Harness sanity only.
- Python syntax compilation of both edited browser scripts; `git diff --check`.

Existing React/jsdom warnings about the styled-jsx attribute were non-failing. No paid model calls, source artifact replacements, pushes or deployments were made.

## Browser QA still required

Chromium launch was attempted for `scripts/test-ui.py` and `scripts/test-sample-transfer-browser.py`. Both aborted before page execution because this environment disallowed Chromium's local socket (`socket() failed: Operation not permitted`), including after an approved sandbox escalation. Thus these are **blocked, not passed**. No rendered screenshots or native interaction results were obtained for this change.

On a permitted Chromium environment, run a mock production server and both scripts with their URL variables (`FAIRWEAR_TEST_URL` and `FAIRWEAR_TRANSFER_REVIEW_URL`) set to that server. Confirm:

1. Desktop/mobile homepage starts with bedroom, all room/preset/slider controls work and the revised order/layout fits.
2. Homepage CTA → first shortcut focuses bedroom carpet even after filtering; second shortcut focuses bathroom bath. Repeated shortcuts and evidence dismissal preserve focus and choices.
3. Explicitly select a bedroom response, continue, and verify the corresponding starting choice/current response in Case Builder and its portable export. Untouched and unrelated findings are not imported.
4. Existing handoff interruption, reset, Back/Forward, reload and private-mode checks still pass; distinguish actual BFCache restoration from ordinary navigation.

Rerun checks and browser QA after integration with other work, particularly changes to the evidence viewer or provenance documentation.
