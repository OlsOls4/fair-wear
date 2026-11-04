# Reviewed changes integration (4 November 2026)

Base: `a04380a`. Combined locally in the isolated `integrate-reviewed` branch.

## Included changes and conflicts

- `2ec1d2c`: README provenance and the bedroom/bath guided sample journey.
- `994d207`: exact public finding navigation from inspected crops.
- `57fabdd` and `9833eec`: optional per-deduction evidence tracking and request wording.
- `bb769cf`: conservative ambiguous-correspondence abstention and coverage reporting.

All five cherry-picks applied without conflicts. Git automatically merged `components/Board.tsx`, `README.md` and `package.json`; no manual conflict resolution was needed. Segmentation-viewer work is excluded. No saved submission, source demo artifacts or historical evaluations were changed. Nothing was pushed or deployed.

## Cross-feature review

- Both guided stops remain mapped to the existing three-claim handoff: bedroom carpet first, bathroom bath second.
- Public crop links only select/focus a valid recorded finding. They do not import Evidence Lab notes or change responses. Stored explicit responses and the one-use Case Builder handoff retain their separate behavior.
- Per-claim evidence checklists affect requests and portable HTML, not model findings, sample-response provenance, totals or correspondence coverage. Omitted claims remain excluded. Checklists begin unknown even when sample photos exist.
- New correspondence reports concern future pipeline execution; the current UI still uses unchanged cached findings. No improved model accuracy or geometric alignment is claimed. Candidate records may include embedded crops after downstream processing, increasing future output size; this is a nonblocking limitation, not a measured performance improvement.

## Verification on the combined checkout

Passed with `MOCK=1 FAIRWEAR_ALLOW_PAID=0` and a 512 MiB Node heap:

- `npm run check`: complete aggregate, including typecheck, matching/coverage regressions, 62 review DOM checks, 30 sample-session checks, 40 handoff checks, 18 evidence checks, 14 Evidence Lab DOM checks, Case Builder and evidence-tracker regressions, and 19 Case Builder DOM checks.
- `NEXT_TELEMETRY_DISABLED=1 npm run build`: production build, including all nine generated pages.
- `python scripts/test-pack-format.py`: formatter and confidence-boundary checks.
- SceneDiff `--predictor oracle`: 20 pairs / 55 objects, precision/recall/F1 1.0, zero model calls. This is harness sanity only.
- `git diff --check`.

The evidence integrity check verified all 51 source fingerprints and unchanged fixture metrics, snapshot `f48c86061e464486485e6bed20356d36fb7bf98b0667d2992cdc2c9848e2d12f`. No `public/` or `eval/` files differ from the base. Existing npm proxy and React/jsdom styled-jsx warnings were non-failing.

## Browser QA still needed

Native browser QA was **not run on this integration checkout**. The individual changes' reviews documented Chromium startup being blocked by this environment's local-socket restriction. DOM mocks and a successful build do not establish native navigation, downloads or rendered layout.

In a Chromium-capable environment, start the combined production build with mock mode and paid calls disabled. Run all four suites (`scripts/test-ui.py`, `scripts/test-evidence-browser.py`, `scripts/test-sample-transfer-browser.py`, `scripts/test-case-builder-browser.py`) with their documented URL variables pointing at that server. Also check this combined flow:

1. At desktop and mobile widths, open the homepage bedroom sample; visit Evidence Lab, select a crop and follow its exact public finding link. Verify focus, scrolling and existing response retention.
2. Use the bedroom and bath guided shortcuts repeatedly after filters, open/close evidence, choose a response and continue to Case Builder. Verify the matching claim and original model result remain distinct from the imported starting response.
3. Enable evidence tracking on that claim, edit all status types and cost applicability, switch claims and return, omit/reinclude it, and export. Check request wording, omitted evidence, reviewer-status disclosure, no overflow and native download contents.
4. Exercise cancellation, failed export, reset, Back/Forward, reload, repeated links and private-case entry. Private mode must remain empty and discard sample/checklist state. Distinguish real BFCache restoration from ordinary navigation.

The updated browser suites cover existing flows; the integrated checklist sequence above additionally needs native/manual coverage. No segmentation UI should appear.
