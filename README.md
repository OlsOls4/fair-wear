# Fair Wear

Prototype deposit-dispute evidence review for UK renters. The offline pipeline uses SAM 3.1 to segment items, Muse Spark to suggest classifications, and Muse Image to generate simulated demo scenes. The public site explores a precomputed sample; it does not analyse uploaded videos or determine liability.

Built for the Meta Global AI Developer Hackathon (Indie track). **Working prototype with recorded real-model results**, not a live video-analysis service. Local model wrappers fall back to MOCK fixtures without a key and explicit paid-call opt-in; the public sample instead replays the saved real run.

End-to-end video analysis is explicitly disabled even in local paid mode because verified frame extraction/cropping is not connected. The separate offline still-image runner and cached sample are unchanged. See [video capability gate](docs/video-analysis-support.md).

## Try the complete sample journey

1. On `/`, compare the generated bedroom scenes, then open **Try the sample review**.
2. On `/demo`, use the three numbered sample-claim shortcuts, starting with **1. bedroom carpet**, to focus its evidence. The test intended fair wear; Muse Spark called it damage. Inspect the evidence and select a response. **2. kitchen oven** and **3. bathroom bath** complete the optional path. The bath’s cleaning label disagrees with planted damage intent. Jumping or using Next never confirms a response; the expanded evaluation and all 20 findings remain available.
3. Choose **Continue to case builder** to carry selected responses for bedroom carpet, kitchen oven and bathroom bath into a fresh fictional case. Other findings and untouched suggestions are not imported. Review the disclosed response mapping before continuing; no charge is accepted.
4. Edit the case and export the response/evidence bundle locally. Export before leaving: case notes and photos are not saved. Nothing is sent to a landlord.

`/inspect` separately replays the recorded evidence and published mistakes. Its review choices do not update the sample board or case builder.

## Recorded evaluation: generated flat

Muse Image generated four paired room scenes. The offline SAM 3.1 image-segmentation → matching → Muse Spark judgement run produced 20 saved crop-pair observations. Against eight planted changes, the recorded results are:

- **6/8** planted changes detected; **4/8** exact verdicts.
- **3/4** planted damage cases found; **1/2** fair-wear decoys wrongly called damage.
- **1 false alarm** across nine unplanted crop observations.

See [saved results](public/demo/flat-results.json), [evaluation](public/demo/flat-eval.json), [test intent](eval/flat/planted.json) and [scoring/provenance details](docs/evidence-lab.md). The bedroom carpet error, missed curtain change, bath misclassification and missing sealant observation are published, not repaired in the historical output.

This is a tiny, non-held-out synthetic fixture, not a real-home accuracy benchmark. Planted intent is not independent annotation of generated pixels, and model confidence is not calibrated. The saved run lacks raw SAM masks/boxes and raw API envelopes; its image crops and findings are inspectable, but its segmentation cannot be independently reconstructed from the retained files. The public app does not analyse videos, determine liability or send a response. Private Case Builder photos are selected locally for a human-authored case, not analysed by a model. Historical PDF/reply artifacts do not reflect current review choices.

## Separate SceneDiff harness

`eval/scenediff/gt.json` holds object-level ground truth (added / removed / moved) for 20 indoor SD-V pairs from SceneDiff. Videos are not redistributed. The committed oracle run scores 1.0 because it returns the ground truth: this checks the harness, not a model. Committed mock results likewise test the harness. **No real-model SceneDiff benchmark result is published in this repository.** The generated-flat results above are a separate evaluation. See `scripts/eval-scenediff.ts` for `oracle`, `mock` and opt-in `spark` predictors.

## Run locally and control model costs

```sh
npm ci
MOCK=1 FAIRWEAR_ALLOW_PAID=0 npm run dev
```

The sample works without credentials. Offline paid model scripts require `MODEL_API_KEY` (or `META_API_KEY`) plus `FAIRWEAR_ALLOW_PAID=1`, with `MOCK` unset; paid calls are disabled on Vercel. Each call reserves an estimated cost in a local ledger before sending and is refused if that estimate would exceed the configured ledger cap. Invalid or unreadable ledgers, invalid costs/caps and lock contention fail closed. Transport failures are not automatically retried, and failed or uncertain calls retain their reservations. Complete valid Spark token usage can replace a reservation using the configured historical rates. This local guard is not an account-wide billing limit or a guaranteed billing ceiling: token/frame estimates and rates may differ from actual billing. See [budget guard limitations and recovery](docs/model-budget-guard.md). No paid calls are needed for the checks below.

- `lib/pipeline/` — sampling, segmentation, matching, judging and pack construction.
- `docs/architecture.md` — original design/build plan, not a current feature inventory.
- `docs/demo-script.md` — demo script.
- `docs/data-licences.md` — data sources and permitted uses.

## Review UI and local checks

The review UI extends the public 30 Oct version (`fb0dd3a`) and preserves its original model output.

- Each finding has a suggested **Discuss after evidence**, **Dispute**, or **Not claimed** response that the reviewer can change. Mould cleaning, fair wear, and damage below 90% confidence default to Dispute. Ordinary cleaning and damage at or above 90% default to Discuss after evidence. No change defaults to Not claimed. Invalid damage confidence and unspecified verdicts conservatively default to Dispute.
- All findings support explicit confirmation and undo; changing a response also records an explicit choice. Untouched suggestions generate neutral “Review pending” evidence requests, not first-person disputes or agreements. The legacy stored value `Agree` is retained for compatibility but displayed as Discuss after evidence and never rendered as acceptance. Counts include suggestions and separately disclose the number of explicit choices. The current draft is generated locally from explicit responses and neutral evidence requests, including filtered-out cards. Not claimed items are omitted. The text requests evidence and costs, and does not accept model percentages as an agreed amount. Nothing is sent. Public sample responses survive navigation and reload in the same browser tab using session storage; Reset suggested responses clears them. Browser session restore may retain them after closing a tab. Storage contains only public sample references and choices, never photos or personal case fields. If storage is unavailable, the page warns that choices remain in memory only. Continue to case builder explicitly carries only changed or explicitly confirmed responses for its three matching fictional claims through a one-use, token-bound tab handoff. Untouched suggestions are not imported. Case notes and photos are never persisted, and builder edits remain in memory only. Evidence lab storage behavior is unchanged.
- The optional sample-to-case handoff maps Dispute to Question this deduction, Discuss after evidence to Discuss after evidence, and Not claimed to Leave out of response. These mappings are disclosed before continuing; no charge is accepted. Imported starting choices, editable current responses and original model results are separately labelled in the builder and portable HTML. Ordinary builder entry, reload and private mode never import saved review choices. Reset example case confirms before clearing edits and leaves saved board choices alone.
- UI and portable HTML totals explicitly sum only known amounts. A category with only unknown/invalid amounts reads Not yet known, while a supplied zero remains £0.00. Any included unknown amount produces a prominent Total incomplete notice in the UI, HTML and text draft; omitted amounts do not affect it. Arithmetic is unchanged.
- Private exports with blank room or item labels show a completeness reminder with links to the missing fields, Cancel export and an explicit Export anyway. Unknown amounts remain allowed and are excluded from totals; omitted deductions do not prompt. This is not evidence or legal validation and does not change any case data.
- Case Builder photos open in a keyboard-accessible modal, for both sample scenes and local display copies. Fit-to-window preserves the complete image; actual-size mode allows scrolling over fine detail. Labels retain the chosen source order and disclose unverified timing. Viewing adds no uploads or persistence and does not change the case or its exports.
- Private deductions can be removed after confirmation, clearing their notes, photos and checklist from the current case while preserving other deductions. Removal recovers a slot at the 12-item limit; removing the last item opens a fresh blank deduction. Existing downloads remain unchanged. Choose Leave out of response instead to retain an item but exclude it from exports.
- Private cases have an optional case-wide photo-label selector: Move-in/Move-out by default, or Before/After (other comparison) for cleaning and other comparisons. Labels and order are reviewer-selected with timing explicitly unverified in the UI, draft and portable HTML. The choice stays in memory, resets for a new case, and does not change evidence statuses, cost assumptions, responses or recorded sample model findings.
- The optional per-deduction evidence tracker records reviewer choices for move-in/out records, itemised costs and (for replacement costs) age/condition basis. Unknown is distinct from not available; photos and assumptions never auto-mark records as provided. Enabled checklists generate item-specific requests and appear in portable HTML, while omitted claims and their checklists are excluded. Provided and not-applicable rows generate no requests. Disabling clears that claim’s checklist and restores standard requests. These subjective statuses never authenticate evidence, accept charges or change totals, and stay in memory only.
- Replacement-life calculations require explicit item age at move-in, tenancy length, expected useful life and a quality/condition basis. Missing inputs stay unknown; the item label never silently supplies them. Complete inputs produce an illustration, not liability or an agreed cost. Unsupported legacy percentages are withheld in the current UI. Cleaning has no replacement-life percentage.
- Original 30 Oct Muse Spark reply/PDF artifacts are retained unchanged and visibly separated from the current draft. They do not reflect review selections.
- Published errors from real pipeline evaluation on generated imagery are shown on relevant cards and in the summary. Evidence crops can be enlarged without trimming, with sample provenance visible in the viewer and exported draft. The guided sample requires no personal files.
- Paired report evidence opens with a draggable move-in/move-out reveal and a native keyboard slider. Move-in and Move-out still show complete individual crops, both originals remain linked, and single-image findings keep their normal viewer. Each crop is fitted independently without stretching; the visible framing/scale caveat makes clear this is not an aligned measurement.
- Controls have item-specific labels, linked explanations, larger touch targets and higher-contrast badges. Real-browser verification is still required to establish rendered layout and native behavior.
- Future inference keeps unmatched or unavailable views explicitly **Unresolved**, without a model call, invented confidence, missing/added inference or replacement-life share. Models can also abstain on incomparable views. Unresolved requests comparable records and human review. Existing saved results are unchanged; see [pipeline evidence gaps and schema migration](docs/pipeline-evidence-gaps.md).
- Model judgements must match the output schema, including numeric confidence from 0 to 1. Malformed JSON or invalid fields receive one retry and then fail without a finding or evidence pack; network and budget failures are not converted into verdicts. The public demo analysis endpoint returns an explicit unavailable response, even for empty input, rather than producing placeholder results.

See [review method and assumptions](docs/review-method.md) for the separation between model classification, response choices and cost illustrations.

Run `npm run check` for the combined type, review UI, Evidence Lab, source-integrity and private Case Builder checks. The production build and real-browser checks remain separate.

Offline checks (no model calls):

```sh
npm ci
npm test
npm run test:ui:dom
npm run typecheck
MOCK=1 FAIRWEAR_ALLOW_PAID=0 NEXT_TELEMETRY_DISABLED=1 npm run build
```

`npm test` runs decision, draft, judge/schema, assumption-propagation and budget-refusal regressions. `npm run test:ui:dom` checks review interactions using jsdom with mocked native clipboard, download and dialog APIs; it is not a visual or real-browser check. SceneDiff harness sanity check: `MOCK=1 FAIRWEAR_ALLOW_PAID=0 node --import tsx scripts/eval-scenediff.ts --predictor oracle --out /tmp/fair-wear-oracle.json`.

`python scripts/test-pack-format.py` checks the PDF formatter's missing-input and confidence-boundary behavior using the Python standard library only. To validate a rebuilt PDF without replacing original artifacts, set `FAIRWEAR_DEMO_INPUT_DIR=public/demo` and `FAIRWEAR_DEMO_OUTPUT_DIR=/tmp/fair-wear-pack-check` before running `python scripts/build-pack.py` (requires Pillow and ReportLab). Keep validation output outside `public/demo`; intentionally replacing original artifacts also requires updating their provenance labels and checking all references.

Optional real-browser regression suite: with Python Playwright and its Chromium browser installed, start the production server on port 3200 (`npm run start -- --port 3200`) and run `python scripts/test-ui.py`. Set `FAIRWEAR_TEST_BROWSER_PATH` to use an existing Chromium binary. The suite covers defaults, overrides, filtering, draft exports, evidence dialogs, navigation and mobile overflow. It writes screenshots to `/tmp/fair-wear-ui` by default. Browser execution needs an environment that permits Chromium's local sockets; a successful build or DOM test is not a substitute for browser verification.

MIT licence.

## Offline fixed-label comparison

`npm run evidence:baseline` compares the saved results with labelling every saved crop **damage**, without model calls or changing artifacts. Both get 4/8 planted item groups with any expected label. Recorded output correctly labels 3/4 planted damage cases versus 4/4, mislabels 1/2 fair-wear groups versus 2/2, and flags 1/9 unplanted crop observations versus 9/9. The recorded unplanted flag is fair wear, not damage; the nine observations span five item groups. One planted group has no saved observation and stays absent in both policies.

This is a trivial fixed-verdict comparator, **not a model ablation or evidence of overall accuracy superiority**. Group scores accept any matching crop, and generated test intent is not independent pixel-level truth. See [the full comparison, denominators and limitations](docs/evidence-lab.md#fixed-label-policy-comparator-not-a-model-ablation). The calculation and immutability checks run in `npm run test:evidence`.

## What was built when
Hackathon rules require new work. Before kickoff (15 Oct 2026) I wrote the plan (docs/architecture.md, demo script, data-licence notes) and an empty Next.js skeleton with stub functions. All working functionality — Meta Model API integration, SAM 3.1 parsing, matching, judging, UI, evidence pack — was built from 26 Oct 2026 onwards; see the git history.

- 26–27 Oct: Meta Model API wrappers (SAM 3.1 wire parser, Muse Spark, Muse Image), rules digest.
- 28 Oct: hard budget guard, ffmpeg frame sampler with Laplacian sharpness filter, label/appearance/position matcher, SceneDiff SD-V ground truth + eval harness.
- 29 Oct: judge prompt + JSON-schema validation of Muse Spark output (one retry), deterministic useful-life apportionment (`guidance.ts`, `npx tsx scripts/test-judge.ts`), 10 hand-labelled synthetic cases (`eval/judge/cases.json`), findings board + upload flow + reply-draft UI (sample data clearly labelled; real model runs pending key access).
- 29 Oct (later): first real end-to-end runs. Simulated demo flat (4 rooms, 8 planted changes incl. 2 fair-wear decoys) generated with Muse Image (`scripts/gen-flat.ts`); SAM 3.1 image segmentation (streamed) -> matching -> Muse Spark judging via `scripts/run-demo.ts`; scored against the planted truth with `scripts/eval-flat.ts` (6/8 changes detected, 4/8 exact verdicts, 3/4 planted damage cases found, 1/2 fair-wear decoys wrongly called damage, 1 false alarm; the misses are published). The live site serves this pre-computed output; the Meta key is never on the public site. Total model spend so far about $0.51 of free credits.
- 30 Oct: evidence pack. `scripts/make-reply.ts` has Muse Spark write the line-by-line reply to the landlord from the real findings; `scripts/build-pack.py` renders side-by-side move-in/move-out comparison cards and a downloadable PDF evidence pack (summary table, cards, reply). Findings board links the PDF and shows the Muse Spark reply. Spend so far about $0.54 of free credits; Billing still shows nothing owed.

## Evidence Lab

`/inspect` traces the generated room inputs, actual saved crop pairs, exact recorded model claims and separate human review choices. Its confidence-threshold sandbox exposes the tradeoff between fewer mistaken flags and lost correct signals; it does not rerun models or claim improved accuracy. A deterministic SHA-256 manifest and optional in-browser verification cover all 51 source files, without pretending that missing SAM masks or raw API traces exist.

Run `npm run evidence:check`, `npm run test:evidence`, and `npm run test:evidence:dom` for offline verification. See [Evidence Lab design and reproduction](docs/evidence-lab.md) for provenance limits, scoring semantics, exports and optional browser checks. Source demo artifacts remain unchanged.

## Correspondence ambiguity

Future pipeline runs accept only mutually unique best correspondences, keep competing candidates in an explicit review bucket, and record item coverage rather than silently treating rejected candidates as added or removed. See [safeguards and verification limits](docs/correspondence-safeguards.md). This does not change the cached demonstration or its recorded metrics.

## Future/local inference API input qualification

The future/local inference API requires explicit tenancy context, supplied tenancy years, dated records and requester same-room/item attestations. Public demo analysis remains disabled (HTTP 503). Outside demo mode, missing or cleaning-only context returns actionable HTTP 422 before any inference. No date, identity, chronology or liability is inferred from filenames or appearance. This intentionally breaks unqualified legacy API requests; the cached public demo is unchanged. Future crop runs use independent source-local bounds, never an unverified cross-image union. See [API migration and verification limits](docs/analysis-context-contract.md).

## SAM transport failures

Future offline runs distinguish completed zero detections from failed, refused or truncated SAM streams. Invalid stream completion stops analysis without a pack; completed empty output remains valid. See [SAM response boundary](docs/sam-response-boundary.md) for offline protocol-fixture tests and remaining parser limits. This does not rerun or improve the measured accuracy of the saved demo.
