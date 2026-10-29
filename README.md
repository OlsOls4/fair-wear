# Fair Wear

Deposit-dispute evidence for UK renters from two phone walkthroughs. SAM 3.1 tracks every item, Muse Spark separates fair wear and tear from damage, Muse Image renders comparison cards, and you get an evidence pack plus a draft reply to your landlord.

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

MIT licence.

## What was built when
Hackathon rules require new work. Before kickoff (15 Oct 2026) I wrote the plan (docs/architecture.md, demo script, data-licence notes) and an empty Next.js skeleton with stub functions. All working functionality — Meta Model API integration, SAM 3.1 parsing, matching, judging, UI, evidence pack — was built from 26 Oct 2026 onwards; see the git history.

- 26–27 Oct: Meta Model API wrappers (SAM 3.1 wire parser, Muse Spark, Muse Image), rules digest.
- 28 Oct: hard budget guard, ffmpeg frame sampler with Laplacian sharpness filter, label/appearance/position matcher, SceneDiff SD-V ground truth + eval harness.
- 29 Oct: judge prompt + JSON-schema validation of Muse Spark output (one retry), deterministic useful-life apportionment (`guidance.ts`, `npx tsx scripts/test-judge.ts`), 10 hand-labelled synthetic cases (`eval/judge/cases.json`), findings board + upload flow + reply-draft UI (sample data clearly labelled; real model runs pending key access).
