# Evidence desk visual refresh

The design uses a warm paper background, forest-green controls, restrained citrus highlights and editorial serif headings. The goal is to make the evidence the focal point while distinguishing generated imagery, real precomputed model output and reviewer decisions.

## What changed

- A visual homepage with a four-room, before/after comparison using the existing Muse Image scenes. Native range controls and explicit full-scene presets provide keyboard alternatives to dragging the image divider.
- Each room explains a different review issue: visible carpet change, a known fair-wear false positive, distinct cleaning/damage questions and an unsegmented missed item.
- The sample review remains the primary action. No live inference, personal-file upload or liability determination is implied.
- A consistent header/footer, focus styles, skip link, responsive layout and reduced-motion support.
- Published evaluation metrics remain prominent. An expandable disclosure contains every known error. Individual finding error notes remain unchanged.
- Review board styling changes without modifying Board.tsx, its decisions, exports, evidence dialogs or keyboard navigation behavior.

## Verification

- npm run typecheck
- npm run test:ui:dom (47 checks, including the new room selectors and comparison presets)
- npm test (decision, draft, judge/schema, failure, assumption and budget guards)
- MOCK=1 FAIRWEAR_ALLOW_PAID=0 NEXT_TELEMETRY_DISABLED=1 npm run build
- git diff --check

The optional browser regression script now includes comparison keyboard operation, pointer dragging, all four rooms, full-scene presets, mobile screenshots and the new home headline. Its existing review regressions remain intact. It requires execution in a browser-capable environment. Chromium launch in this executor fails with `socket() failed: Operation not permitted`, including after escalation, so screenshots and actual rendering have not been verified here. Do not treat the DOM tests as browser or visual verification.

No new dependencies, paid model calls, external fonts, remote assets or production deployment are introduced.
