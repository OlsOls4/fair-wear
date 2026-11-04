# Evidence Lab

`/inspect` is a read-only replay and deterministic analysis of the existing recorded pipeline run. It uses generated test inputs and real recorded model results. It makes no model calls and does not alter the original findings or evidence-pack artifacts.

## A judge can inspect the complete available chain

1. Select the bedroom-carpet mismatch. Its planted test intent was fair wear; the recorded model label is damage with 82% self-reported confidence. Test intent is not an independent annotation of generated pixels.
2. Expand the full-room inputs and inspect both generated visits. Inspect the actual saved crop pair below. The original runner used room/label/position matching and the union of both SAM boxes. No masks or boxes are invented for the inspector.
3. Read the exact recorded description and inspect other crop observations for the same item. Some groups contain contradictory labels, which are preserved.
4. Record a separate local human review. This neither rewrites the historical model result nor changes the findings-board draft. Untouched cases export a null human review and an explicit unreviewed status; the default hold is not presented as a human decision. All review choices reset on reload and can be downloaded in the inspection report.
5. Inspect the missing sealant result. No saved observation is not evidence that an item is missing. The original evaluation says “not segmented”, but missing raw traces prevent independent reconstruction of the exact failure stage.

## Threshold sensitivity, not an accuracy improvement

The baseline matches all nine numeric metrics in the original published evaluation. There are 20 saved crop-pair observations in 13 item groups; eight groups have planted changes. Unplanted checks are counted per crop observation (nine), not per item.

- All observations: 20/20 retained, 6/8 planted changes detected, 4/8 exact labels, 1/2 fair-wear decoys called damage, 1/9 unplanted observations flagged.
- At least 90% self-reported confidence: 13/20 retained, 3/8 planted changes detected, 2/8 exact labels, 0/2 fair-wear decoys called damage, 0/9 unplanted observations flagged.

The improvement in one failure count is accompanied by substantial loss of correct signals. Withholding is not the same as a no-change prediction. This tiny, non-held-out generated fixture cannot establish calibrated confidence, a recommended operating threshold, real-home accuracy or liability.

The exact-match metric follows the recorded evaluator: any retained observation with the expected label counts as an exact result. It does not demand consensus. A decoy damage flag is counted if any retained observation labels a fair-wear case as damage, even if another observation matches the expected label.

## Fixed-label policy comparator, not a model ablation

Run `npm run evidence:baseline` to calculate this read-only comparison from the same saved observations and planted labels. The comparator replaces every eligible saved crop verdict with `damage`; it does not inspect test labels to choose a prediction. It preserves crop multiplicity, confidence eligibility and absent observations. No model runs, network requests or artifact writes are involved.

| Metric | Recorded output | Always damage |
| --- | ---: | ---: |
| Planted item groups with a change flag | 6/8 | 7/8 |
| Planted item groups with any expected label | 4/8 | 4/8 |
| Planted damage groups labelled damage | 3/4 | 4/4 |
| Fair-wear groups labelled damage | 1/2 | 2/2 |
| Unplanted crop observations with any change flag | 1/9 | 9/9 |
| Unplanted crop observations labelled damage | 0/9 | 9/9 |

Both policies use 20 saved crop observations. The nine unplanted observations belong to five item groups; the eight planted groups include one with no saved observation (bathroom sealant). The fixed policy cannot recover that missing record. The recorded unplanted flag is **fair wear**, not damage. Counts of unplanted flags are not counts of independent objects or incorrect damage accusations.

This deliberately trivial policy exposes a tradeoff: recorded output produces fewer unplanted flags and fewer fair-wear damage labels, but correctly labels one fewer planted damage case. Both have the same 4/8 any-crop exact-label score. The comparison does not demonstrate overall accuracy superiority, calibration, real-home performance or the contribution of SAM, matching or a particular model. Several crops can disagree within one group; any expected label still counts as an exact result. Generated test intent is not independent pixel-level ground truth. Raw segmentation responses, masks and boxes were not saved, so removing a pipeline component cannot be faithfully replayed from these artifacts.

`lib/evidence/policy-baseline.ts` uses the same deterministic scorer as the inspector. `npm run test:evidence` checks both policies' counts, the five-group/nine-observation distinction, missing records, confidence eligibility and source immutability. Historical results, source manifests and the public UI remain unchanged.

## Reproducible integrity

`npm run evidence:build` reads the existing files, reproduces the published aggregate metrics, and creates two new files only:

- `public/evidence/planted.json`: byte-identical copy of `eval/flat/planted.json`, so browser verification can inspect the source test intent.
- `public/evidence/manifest.json`: deterministic SHA-256 fingerprints for 8 generated full-room inputs, 40 saved crop images, recorded findings, published evaluation and test intent. The snapshot ID hashes the ordered source descriptors.

`npm run evidence:check` detects source changes or stale manifests without writing anything. Browser verification applies the same SHA-256 function to the 51 files and rejects missing, truncated or modified bytes. A byte match is integrity relative to this manifest, not third-party attestation that a model ran or that its results are correct. Raw SAM responses, masks, boxes and raw Muse Spark API envelopes were not saved and are explicitly unavailable.

The downloaded `fair-wear-inspection.json` includes the threshold, deterministic outcomes, exact recorded claim fields, independent human review choices, missing-trace disclosures, source hashes and the browser's current verification status. Legacy apportionment percentages are excluded. Exports do not transmit data or alter any files on the server.

## Tests

- `npm run test:evidence`: deterministic metric reproduction, all eight fixture rows, missing-record behavior, mixed crop results, threshold boundaries, monotonic retained coverage, invalid inputs, duplicate protection, immutability, unsafe-source rejection, all 51 byte hashes, corruption and truncation rejection.
- `npm run test:evidence:dom`: case/crop navigation, local review persistence, source links, threshold controls, report export, successful integrity checks and corrupt-source failure. Native downloads and requests are mocked; these are not browser tests.
- `python scripts/test-evidence-browser.py`: optional real-browser regression for images, focus, navigation, downloads, repeated verification, reload and mobile overflow. Requires a running production server and a permitted Chromium environment.

The public site remains static for this route. There is no new endpoint, upload flow, key, paid call, external dependency or modification to the original demo artifacts.

## Continue to the matching finding

The selected saved crop links to its exact public finding on `/demo#finding=<observation-id>`. The board validates the ID against its findings, reveals all cards and moves keyboard focus to that labelled card. Multiple-crop cases follow the selected crop, including observations withheld by the threshold. Cases with no saved observation offer the full board without inventing a match. Unknown or malformed finding links show a fallback notice.

This is navigation only: no inspection note, review choice, classification, photo or private field is transferred or written to storage. Existing board responses remain intact. Choose a board response separately. The public-reference fragment can be bookmarked and revisited, so it intentionally is not a one-use handoff. The separate sample-to-case response transfer retains its token-bound one-use behavior.
