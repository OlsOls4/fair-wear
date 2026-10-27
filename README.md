# Fair Wear

Deposit-dispute evidence for UK renters from two phone walkthroughs. SAM 3.1 tracks every item, Muse Spark separates fair wear and tear from damage, Muse Image renders comparison cards, and you get an evidence pack plus a draft reply to your landlord.

Built for the Meta Global AI Developer Hackathon (Indie track). Status: scaffold; runs in MOCK mode without `META_API_KEY`.

- `lib/pipeline/` — sample → segment/track → match → judge → pack
- `docs/architecture.md` — design and day plan
- `docs/demo-script.md` — demo video script
- `docs/data-licences.md` — what demo data we can use

`npm install && npm run dev`

MIT licence.

## What was built when
Hackathon rules require new work. Before kickoff (15 Oct 2026) I wrote the plan (docs/architecture.md, demo script, data-licence notes) and an empty Next.js skeleton with stub functions. All working functionality — Meta Model API integration, SAM 3.1 parsing, matching, judging, UI, evidence pack — was built from 26 Oct 2026 onwards; see the git history.
