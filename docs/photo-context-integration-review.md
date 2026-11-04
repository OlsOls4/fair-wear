# Photo-context integration review (4 November 2026)

Local branch: `integrate-real-photo-reviewed`. Base: `f96c44f6350e9316fc34b60827418445deb47f57`, itself based on published `c297c316`. Integrated photo-context commit `642c3102584b2cd7a89400baf4bc4b68701c20e4` as `90bc5e9`.

## Conflict resolution and cross-feature coverage

The only manual conflict was in `lib/case-builder.ts`, where both changes updated export provenance. The integration preserves both:
- Selected, included photos are distinguished from no-photo cases. Omitted photos do not count as included evidence, and a text draft never claims to attach photos.
- Personal cases retain their case-wide Move-in/Move-out or Before/After selection in captions and exports. Both identify timing as unverified. The other-comparison wording describes the comparison rather than implying photos exist when none were selected.

Regression coverage additionally verifies:
- Both contexts with empty, no-photo, omitted-photo and single-photo cases retain accurate provenance and unverified chronology.
- Private context cannot change sample handoff labels, imported response choices or preserved model results; injected context in a transfer payload is ignored.
- Relabeling a private case preserves its response, checklist statuses, claimed amount and review note. Adding another claim shares the context, cancelled mode changes retain it, and a new private case resets it.
- Existing explicit confirmation, undo, stale-handoff cleanup, walkthrough/repeated-link navigation, and position-free correspondence safeguards remain covered by the full suite.

## Verification

Passed with `MOCK=1 FAIRWEAR_ALLOW_PAID=0`:
- Full `npm run check`: includes 62 review DOM checks, 30 review-session checks, 54 handoff checks, walkthrough/repeated-link tests, safe matching regressions, 19 case-builder checks and 26 case-builder DOM checks.
- Evidence checks: 18 analysis/integrity checks, 14 Evidence Lab DOM checks, all 51 source fingerprints and fixture metrics unchanged.
- Production `npm run build`, with telemetry disabled and a 512 MiB Node heap: all 9 static pages generated.
- Python PDF formatter and confidence-boundary checks.
- SceneDiff oracle harness: 20 pairs / 55 objects, precision/recall/F1 1.0. This is harness sanity, not model accuracy; zero model calls.
- `git diff --check`.

No `public/` or `eval/` files changed. No user photos were read, copied or committed. Only existing generated sample fixtures and synthetic image data were used by tests. No model calls, push, deployment or submission changes.

## Remaining preview requirement

Attempted `python scripts/test-case-builder-browser.py`; Chromium failed before any browser assertions with `socket() failed: Operation not permitted`. Native browser QA is blocked by this execution environment, not passed. DOM tests mock native file, download, confirmation and route behavior.

Before release, test a preview of this exact integrated branch for desktop/mobile layout, file decoding, exported images rendering offline, print/PDF output, case-wide labels and unverified chronology, mode-change cancellation, Back/Forward/reload, explicit confirm/undo plus handoff, and repeated walkthrough links after filtering. Use synthetic or appropriately authorized photos; do not commit personal files. The integration remains local and unpublished.
