# Guided workflow review

The optional “Try the full workflow” disclosure on home and sample review connects three existing capabilities: inspect saved evidence and confidence filtering, make a human response on the bedroom carpet finding, and carry selected responses into a fictional case for targeted evidence requests and local export. It is collapsed by default, uses native details/summary without client state, and becomes a single-column list below 700px.

The landing comparison now says “Disagrees with planted test intent” instead of “Known model error”. Evaluation copy distinguishes planted intent from independent annotation of generated pixels. Saved sample data, model outputs and review decisions are unchanged.

Validation:
- `npm run check` passed, including source-integrity and existing interaction suites.
- `node --import tsx scripts/test-walkthrough.tsx` passed: native disclosure, existing threshold anchor and finding targets, explicit separate review state and export caveats, qualified language.
- `npm run typecheck` and `git diff --check` passed.
- Production build was attempted but its worker was terminated with SIGKILL during compilation. No build success claimed.
- Real Chromium checks were attempted but launch failed with `socket() failed: Operation not permitted`, including the approved escalated invocation. Keyboard/mobile behavior is not browser-verified. Responsive CSS and native semantics are implemented, but visual QA remains necessary.

No push, deployment, new model calls or sample-data changes.
