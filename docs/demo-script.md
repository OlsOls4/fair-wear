# Fair Wear demo script

Target: under 3 minutes. This script describes the review UI rebuilt from the public 30 Oct baseline. Record the tested version actually running on screen. Keep **Generated test images · Real model results** visible. Do not present the generated scenes as a real tenancy or imply live video analysis.

## 0:00–0:20: The problem and scope

Show the homepage, then choose **Explore sample comparison**.

“Rental deposit disagreements often come down to what changed and what the evidence shows. Fair Wear helps organise comparison evidence and prepare a response for review. This prototype uses generated rooms with planted changes. The public demo runs on precomputed model output, so it needs no personal videos.”

## 0:20–0:50: The model pipeline

Show the workflow, then the relevant code: `scripts/run-demo.ts`, `lib/pipeline/models.ts`, `lib/pipeline/matching.ts`.

“Muse Image generated the sample scenes. SAM 3.1 segmented item regions in the move-in and move-out images. The matcher paired regions, and Muse Spark suggested a classification for each comparison. These are real model outputs from an offline run, not model calls happening during this presentation.”

Do not show unimplemented tracking animations or claim that this sample run analysed two videos.

## 0:50–1:25: Evidence, errors and review

Show sample findings. Enlarge the bedroom carpet evidence, switch move-in/move-out, then close it. Point to its known-error notice and the published evaluation.

“This bedroom carpet was planted as fair wear, but the model called it damage. We expose that error beside the evidence. On this small generated test, the pipeline detected six of eight planted changes and gave four exact verdicts. It found three of four planted damage cases, miscalled one of two fair-wear decoys as damage, and produced one false alarm. These are diagnostic results, not a claim about real-home accuracy.”

## 1:25–2:05: Control the response

Filter to Cleaning. Show ordinary oven cleaning suggested as Discuss after evidence and bath mould suggested as Dispute. Change the oven to Dispute, then return to All.

“Suggested responses are separate from model verdicts. Fair wear, mould cleaning and damage below ninety percent confidence start as Dispute. Ordinary cleaning and higher-confidence damage start as Discuss after evidence, never acceptance. No change starts as Not claimed. I can override any choice; filtering does not lose my changes. Confidence is not proof of responsibility.”

## 2:05–2:40: A draft that follows the choices

Choose **Open current draft**. Show the oven dispute. Change one item to Not claimed and show that it disappears. Download the current text draft.

“The draft follows the choices I make. It asks for supporting evidence and costs rather than automatically accepting the model's percentage estimates. Nothing is sent. The original model reply and PDF remain separately labelled as unchanged artifacts; they do not include my selections.”

## 2:40–2:55: Close

Show the repository and the verified live URL in the recording's end card.

“Fair Wear combines segmentation, visual comparison and human review. The next validation step is consented real-world evidence with stronger matching and calibrated uncertainty. The current prototype makes its limits visible and keeps the renter in control.”

## Recording checks

- Rehearse against the deployed commit and stay below the submission's confirmed time limit.
- Use only assets whose rights are documented in `docs/data-licences.md`; label generated scenes throughout.
- Do not use invented deduction amounts, findings, legal outcomes, or placeholder benchmark percentages.
- Do not call the evidence pack adjudicator-ready or claim that every item/change is found.
- SceneDiff oracle scores validate the evaluation harness only. Do not present them as measured model accuracy.
- Show current test output only if the commands actually passed on the recorded commit. Browser execution may be blocked in restricted environments, so do not claim visual QA solely from a build or DOM test.
