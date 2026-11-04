# Review method and assumptions

Fair Wear is an evidence-review prototype. It separates three questions that a model verdict cannot settle on its own:

1. What visible change might have occurred?
2. How does the reviewer want to respond to a proposed deduction?
3. What cost, if any, is supported by evidence?

## Suggested responses

`lib/decisions.ts` supplies deterministic starting choices, independent of any cost calculation:

- Fair wear, mould cleaning, and damage below 90% model confidence: **Dispute**.
- Other cleaning and damage at or above 90%: **Agree**.
- No change: **Not claimed**.
- Unresolved comparisons: **Dispute** pending comparable records and human review, with no replacement-life illustration. An absent observation is not proof that an item is missing or added.
- Invalid damage confidence and unspecified verdicts: **Dispute** for review.

These are suggestions, not user consent or findings of liability. The model's confidence is uncalibrated; 90% is a review-rule threshold, not evidence of 90% accuracy. The display avoids rounding an under-threshold value up to 90%.

The reviewer can change any response. Filters do not remove decisions from the current draft. Not claimed omits an item. The public sample board on `/demo` and `/upload` shares response choices in browser session storage, so navigation and reload in the same tab preserve them. Reset suggested responses removes those saved choices. Browser session restore can preserve session storage after a tab is closed; this is not a promise of deletion on close. No cross-device or cross-tab synchronisation is provided.

Only allowlisted public sample finding references and valid response choices are saved, with a schema version and sample-compatibility fingerprint. Photos, personal case fields and notes never enter this store. Changed sample data, malformed records, unknown references and invalid choices are ignored. Generic boards and private cases do not opt into sample persistence. If storage is blocked or a write fails, review still works in memory and the UI explains that choices may be lost on navigation or reload. A failed reset explicitly warns that old saved choices could reappear and offers a retry.

## Optional sample-to-case handoff

The sample review contains 20 findings; Case builder intentionally uses only three fictional proposed deductions: bedroom carpet (£480), kitchen oven (£80) and bathroom bath (£350). **Continue to case builder** explicitly starts a fresh sample case. Before navigating, it discloses this limited scope and the mapping:

- A changed **Dispute** response becomes **Question this deduction**.
- A changed **Agree** response becomes **Discuss after evidence**, not acceptance of responsibility or an amount.
- A changed **Not claimed** response becomes **Leave out of response**, excluding the item and its photos from the export.

Only explicit changed responses for those exact three public references carry over. Unchanged board suggestions are not treated as reviewed choices; untouched builder items start as Question this deduction. Other findings remain on the board. The destination reports how many responses transferred, and each transferred item labels its starting choice separately from its editable current response and unchanged model suggestion. The portable HTML retains those distinctions. No model inference is performed.

An allowlisted snapshot of public references and decision enums is written only when Continue is pressed. A random one-use token binds that snapshot to the destination URL; the payload also requires the current schema and sample revision. The destination consumes the snapshot and removes the URL marker. Missing, incompatible, reused or malformed handoffs leave the starting case unchanged with a visible warning. Extra fields and unknown references cannot enter the case. Repeated clicks are guarded. Cancel handoff, changing a response or resetting board choices clears an abandoned snapshot and re-enables Continue after interrupted navigation. Clearing the snapshot does not promise to stop browser navigation that has already begun. Storage failure keeps the source page and its current choices available for retry.

Ordinary Case builder navigation never imports saved review choices. Reload starts the unchanged three-item example rather than replaying the handoff. A browser Back/Forward-cache restore preserves the current in-memory case without re-importing newer board choices. Starting a private case removes all sample choices and model annotations; returning to the example does not re-import them. Reset example case confirms before discarding case edits and never clears saved board responses. Builder edits do not sync back to the board. Photos, notes, edited amounts and private case fields are never written to the handoff or review stores; export before leaving to keep a case.

Run `npm run test:sample-transfer` for pure validation and DOM lifecycle checks. With a local mock production server running, `FAIRWEAR_TRANSFER_REVIEW_URL=http://127.0.0.1:3351 python scripts/test-sample-transfer-browser.py` covers real navigation, downloads, resets, isolation and mobile overflow. It separately reports whether the browser actually used Back/Forward cache; dispatching a persisted pageshow event alone is not proof of real BFCache coverage. Browser execution requires an environment that permits Chromium sockets.

## Replacement-life illustration

`calculateShare` in `lib/pipeline/guidance.ts` requires explicit inputs for damage or missing items:

- Age at move-in, in years, including an explicit zero when assuming new.
- Tenancy length, in years.
- Expected useful life for this item.
- A stated quality/condition basis for that life assumption.

Unknown age is not treated as zero. A generic item label does not establish lifespan or quality. Invalid or missing inputs return a `needs_inputs` result with no percentage. The current board recomputes from inputs rather than trusting a cached percentage.

For complete inputs, the illustrative calculation is:

`100 × max(0, min(1, 1 − (move-in age + tenancy length) / expected life))`, rounded to a whole percentage.

This is only remaining-life arithmetic. Supplied assumptions are not automatically verified. The calculation does not establish cause, responsibility, actual cost, whether repair is preferable, or an amount the tenant should pay. Cleaning has no replacement-life percentage. Generic lifespan examples remain labelled background examples for compatibility, not scheme-prescribed values or item-specific evidence.

## Sample provenance and original artifacts

The sample uses Muse Image-generated scenes with planted changes, SAM 3.1 image segmentation and Muse Spark classification from an offline run. Public pages serve those precomputed findings; they do not analyse visitors' files. Finding references connect each card with its line in the current draft. The enlarged viewer and text export retain the sample disclaimer.

Original JSON findings, evaluation output, model reply and PDF are preserved to keep the original run inspectable. Their legacy percentage estimates and admissions are not current user choices. The original reply and PDF are labelled unchanged and separated from the current draft. Known evaluation errors are shown rather than silently corrected in the original data.

The eight-change generated test found six changes and four exact verdicts, including three of four planted damage cases, one fair-wear decoy called damage and one false alarm. This small test is diagnostic, not validation on real homes. SceneDiff oracle scores test the scoring harness only.

## Draft and verification limits

The current response draft is generated locally from the selected choices. It requests evidence and costs, does not accept numerical liability, and is never sent automatically. Copy and download export that current text, not the archived model reply.

Offline tests cover thresholds, invalid inputs, assumption propagation, current-draft choices, evidence references and error handling. DOM interaction tests mock native clipboard, download and dialog APIs. They do not establish real-browser focus behavior, responsive rendering or visual accessibility. Use the included browser suite in a browser-capable environment before treating those behaviors as verified.
