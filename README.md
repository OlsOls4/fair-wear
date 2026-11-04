# Fair Wear

Prototype deposit-dispute evidence review for UK renters. The offline pipeline uses SAM 3.1 to segment items, Muse Spark to suggest classifications, and Muse Image to generate simulated demo scenes. The public site explores a precomputed sample; it does not analyse uploaded videos or determine liability.

Built for the Meta Global AI Developer Hackathon (Indie track). Status: scaffold; runs in MOCK mode without `META_API_KEY`.

- `lib/pipeline/` — sample → segment/track → match → judge → pack
- `docs/architecture.md` — design and day plan
- `docs/demo-script.md` — demo video script
- `docs/data-licences.md` — what demo data we can use

## Evaluation (SceneDiff SD-V)
`eval/scenediff/gt.json` holds object-level ground truth (added / removed / moved) for 20 indoor SD-V pairs from SceneDiff (MIT, arXiv 2512.16908). Videos are not redistributed. Run `npx tsx scripts/eval-scenediff.ts --predictor oracle|mock|spark`; the oracle run scores 1.0 (harness check), real-model numbers go here once run.

## Cost guard
Every paid Meta Model API call reserves its worst-case cost in a local ledger before it is sent (`lib/pipeline/budget.ts`) and is refused past a hard lifetime cap. Paid calls need a key plus `FAIRWEAR_ALLOW_PAID=1` and never run on Vercel; the public site serves pre-computed results or MOCK output. `npx tsx scripts/test-budget.ts` checks the refusal.

`npm install && npm run dev`

## Review UI and local checks

The review UI extends the public 30 Oct version (`fb0dd3a`) and preserves its original model output.

- Each finding has a suggested **Agree**, **Dispute**, or **Not claimed** response that the reviewer can change. Mould cleaning, fair wear, and damage below 90% confidence default to Dispute. Ordinary cleaning and damage at or above 90% default to Agree. No change defaults to Not claimed. Invalid damage confidence and unspecified verdicts conservatively default to Dispute.
- The current draft is generated locally from all selected responses, including filtered-out cards. Not claimed items are omitted. The text requests evidence and costs, and does not accept model percentages as an agreed amount. Nothing is sent. Selections reset on reload.
- Replacement-life calculations require explicit item age at move-in, tenancy length, expected useful life and a quality/condition basis. Missing inputs stay unknown; the item label never silently supplies them. Complete inputs produce an illustration, not liability or an agreed cost. Unsupported legacy percentages are withheld in the current UI. Cleaning has no replacement-life percentage.
- Original 30 Oct Muse Spark reply/PDF artifacts are retained unchanged and visibly separated from the current draft. They do not reflect review selections.
- Published errors from real pipeline evaluation on generated imagery are shown on relevant cards and in the summary. Evidence crops can be enlarged without trimming, with sample provenance visible in the viewer and exported draft. The guided sample requires no personal files.
- Paired report evidence opens with a draggable move-in/move-out reveal and a native keyboard slider. Move-in and Move-out still show complete individual crops, both originals remain linked, and single-image findings keep their normal viewer. Each crop is fitted independently without stretching; the visible framing/scale caveat makes clear this is not an aligned measurement.
- Controls have item-specific labels, linked explanations, larger touch targets and higher-contrast badges. Real-browser verification is still required to establish rendered layout and native behavior.
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

## What was built when
Hackathon rules require new work. Before kickoff (15 Oct 2026) I wrote the plan (docs/architecture.md, demo script, data-licence notes) and an empty Next.js skeleton with stub functions. All working functionality — Meta Model API integration, SAM 3.1 parsing, matching, judging, UI, evidence pack — was built from 26 Oct 2026 onwards; see the git history.

- 26–27 Oct: Meta Model API wrappers (SAM 3.1 wire parser, Muse Spark, Muse Image), rules digest.
- 28 Oct: hard budget guard, ffmpeg frame sampler with Laplacian sharpness filter, label/appearance/position matcher, SceneDiff SD-V ground truth + eval harness.
- 29 Oct: judge prompt + JSON-schema validation of Muse Spark output (one retry), deterministic useful-life apportionment (`guidance.ts`, `npx tsx scripts/test-judge.ts`), 10 hand-labelled synthetic cases (`eval/judge/cases.json`), findings board + upload flow + reply-draft UI (sample data clearly labelled; real model runs pending key access).
- 29 Oct (later): first real end-to-end runs. Simulated demo flat (4 rooms, 8 planted changes incl. 2 fair-wear decoys) generated with Muse Image (`scripts/gen-flat.ts`); SAM 3.1 image segmentation (streamed) -> matching -> Muse Spark judging via `scripts/run-demo.ts`; scored against the planted truth with `scripts/eval-flat.ts` (6/8 changes detected, 4/8 exact verdicts, 3/4 real damage found, 1/2 fair-wear decoys wrongly called damage, 1 false alarm; the misses are published). The live site serves this pre-computed output; the Meta key is never on the public site. Total model spend so far about $0.51 of free credits.
- 30 Oct: evidence pack. `scripts/make-reply.ts` has Muse Spark write the line-by-line reply to the landlord from the real findings; `scripts/build-pack.py` renders side-by-side move-in/move-out comparison cards and a downloadable PDF evidence pack (summary table, cards, reply). Findings board links the PDF and shows the Muse Spark reply. Spend so far about $0.54 of free credits; Billing still shows nothing owed.

## Evidence Lab

`/inspect` traces the generated room inputs, actual saved crop pairs, exact recorded model claims and separate human review choices. Its confidence-threshold sandbox exposes the tradeoff between fewer mistaken flags and lost correct signals; it does not rerun models or claim improved accuracy. A deterministic SHA-256 manifest and optional in-browser verification cover all 51 source files, without pretending that missing SAM masks or raw API traces exist.

Run `npm run evidence:check`, `npm run test:evidence`, and `npm run test:evidence:dom` for offline verification. See [Evidence Lab design and reproduction](docs/evidence-lab.md) for provenance limits, scoring semantics, exports and optional browser checks. Source demo artifacts remain unchanged.
