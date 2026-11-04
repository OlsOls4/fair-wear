# Private claim-to-evidence builder

## Why this is the highest-value complementary addition

Fair Wear's model evidence is useful only if a renter can turn it into a response. The existing archived PDF preserves the original model reply and cannot incorporate reviewer changes. `/case-builder` closes that loop with editable proposed deductions, human notes and choices, optional transparent arithmetic, and a portable evidence bundle reflecting the current state.

This is deliberately complementary to the recorded Evidence Lab. It gives a judge an action-led demonstration and lets a real renter organise their own photos today without pretending that live AI inference is available. It does not improve the published model accuracy or validate the prototype on real tenancies.

## Prioritised scope

1. **Implemented: claim → evidence → response → portable bundle.** Three visibly fictional example deductions (£480 carpet, £80 oven cleaning, £350 bath) link to exact recorded model findings. Human choices and notes propagate to the exported response; excluded claims and photos are omitted. The original model suggestion and known evaluation limitation remain separately labelled.
2. **Implemented: private manual case.** Separate mode starts empty, takes real claim details and JPEG/PNG/still WebP photos locally, and produces the same bundle with no model statements. Selected files are not uploaded or analysed. Nothing is persisted automatically.
3. **Implemented: explicit cost exploration.** A replacement-only arithmetic illustration requires replacement cost, age at move-in, tenancy length, useful life and a quality/condition basis. Blank/invalid inputs remain unknown; cleaning and repair do not get replacement-life calculations. Exact decimal year units and integer pennies prevent half-penny floating-point errors. This is not a suggested settlement, accepted charge or liability estimate, and it never changes totals.
4. **Deferred: real photo inference, OCR claim ingestion, saved accounts, collaboration and direct sharing.** These require new reliability/privacy/integration work and do not fit the zero-spend release. No automatic external messages or sharing.

## Truth and privacy boundaries

- Sample image origins: Muse Image-generated scenes. SAM 3.1/Muse Spark outputs are real, recorded offline results. Fictional monetary amounts and claim wording are authored examples, not recorded landlord demands.
- Personal mode has no model inference and cannot mix sample images or retained model findings into the case via the UI.
- Photo files are accepted only as JPEG/PNG/still WebP, maximum 8 MiB and 24 megapixels, maximum dimension 12,000. Image header dimensions are checked before decoding. Display copies are resized to at most 1,600 pixels on either axis using canvas, without copying EXIF metadata.
- SHA-256 identifies the original selected file if browser WebCrypto is available. It does not verify authenticity, authorship or capture date. Original filenames are not included in the bundle. Keep original photos separately.
- Personal image preparation/export invokes no fetch. Sample export fetches only fixed same-origin `/demo/flat/crops/` assets with no credentials. Omitted images are never fetched or embedded.
- HTML export escapes all text, rejects non-embedded image references and SVG, includes no scripts, and applies a restrictive CSP. Photos are embedded so the file works offline. Browser Print → Save as PDF is the PDF route, not a newly generated server-side PDF.
- Bundle contents may contain personal information. Review before sharing. Nothing is automatically sent or shared.
- A reload/navigation warning protects unsaved edits where supported. It is not persistence. Exported HTML is read-only and cannot currently be re-imported for editing.

## Demo sequence (35–50 seconds)

Open `/case-builder`: three fictional claims total £910. The bedroom carpet is the known false positive (82% uncalibrated model confidence; planted fair wear). Add a human note questioning replacement. Mark oven “Discuss after evidence” and bath “Leave out”. Totals become £480 questioned and £80 for discussion, explicitly not savings or accepted amounts. Expand cost assumptions and use hypothetical £600 replacement, age 3, tenancy 2, useful life 8, basis “Illustrative assumptions only”: £225 remaining-value illustration. Change age to 5: £75. Claim remains £480. Export and open the standalone file: current notes, actual images, preserved model finding and explicit fiction labels appear together. Show “Start a private case” to demonstrate manual real-input viability, not new model inference.

## Integration

Feature styles are isolated. The shared shell links to `/case-builder` and `/inspect`. The route has `id="main-content"` for the shared skip link and uses the title `Build your response` for a global title template. There is no duplicate local navigation. No existing Board state transfers to this builder; do not imply otherwise.

## Verification

- `node --import tsx scripts/test-case-builder.ts`: 16 pure correctness/security/privacy checks.
- `node --import tsx scripts/test-image-dimensions.ts`: 5 image-header test groups including generated JPEG assets, oversized dimensions and animation rejection.
- `node --import tsx scripts/test-case-builder-dom.tsx`: 13 DOM interaction checks with native file/download APIs mocked. Includes response persistence, editable calculation, export failure recovery and mode-change cancellation. `npm run test:case` runs all new offline checks.
- Existing `npm test`, `npm run test:ui:dom`, typecheck and production build pass.
- `python scripts/test-case-builder-browser.py`: full real-browser regression prepared for local server on `127.0.0.1:3342`, including desktop/mobile, correction propagation, offline HTML rendering, PDF print, private image no-network assertions and malicious input rejection. **Not yet established here:** Chromium process startup is blocked by `socket() Operation not permitted`, including an escalation attempt. Do not describe browser checks as passed until run in an allowed environment.
