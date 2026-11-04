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

The reviewer can change any response. Filters do not remove decisions from the current draft. Not claimed omits an item. Selections are held only in the current page and reset on reload.

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
