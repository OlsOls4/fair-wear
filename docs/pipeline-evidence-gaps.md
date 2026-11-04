# Unresolved comparisons in future pipeline runs

This change applies to new inference, not the saved demo. No model has been rerun and no accuracy improvement has been measured. All original generated inputs, crop images, findings, replies, evaluation results and PDF bytes remain unchanged.

## Why an unmatched observation is not a missing item

The matcher has item detections, not independently established room coverage. An item can be unmatched because it was outside the view, obscured, missed by segmentation, labelled differently, or incorrectly matched to another item. The previous judge implementation treated an unmatched move-in observation as `missing` and an unmatched move-out observation as `added`, including overriding a low-confidence model answer. That inference was unsupported.

`judgePair` now checks for observations and usable image references from both visits before invoking a model. A one-sided pair, no observations, or an empty/missing image reference returns:

- `verdict: "unresolved"` and an explanation of the missing comparison evidence.
- `confidence: null`, because no model judgement was made. Null is not zero confidence or a confidence threshold decision.
- `judgementSource: "evidence_gap"`.
- `shareCalculation.status: "not_applicable"`, no percentage, and no generated comparison card.

The guard runs before model transport in real and mock paths. It does not retrieve the references or verify that URLs resolve to usable imagery. A supplied nonempty URL is not verified frame coverage.

`changeStatus` also returns `unresolved` for one-sided or empty pairs, rather than `added` or `removed`. Matching scores, thresholds and the matching algorithm have not been retuned.

## Model abstention and reviewer handling

The judge schema now accepts `unresolved` as a model result. The prompt instructs the model to use it for obscured, out-of-frame, mismatched or incomparable views. It no longer instructs uncertain comparisons to become `no_change`. Missing/added classifications still require visibly comparable evidence of absence and never receive a structural fallback. Model confidence remains a finite number from 0 to 1 in raw model JSON, including an abstention; numeric confidence is not proof that a classification is correct.

The board labels the state Unresolved and suggests Dispute pending human review. The local reply requests dated comparable records. A reviewer can change the response or omit the item. No replacement-life illustration applies, even if complete calculation inputs or a stale legacy percentage exist. Evidence Lab excludes unresolved observations from detected-change and false-alarm counts and does not describe an unresolved-only case as unchanged. The offline flat scorer also excludes abstentions from detected changes and false alarms, and preserves `got: "unresolved"` instead of calling an abstention unchanged. Offline PDF and reply preparation accept the new value. The pack retains the original observations and evidence request rather than generating an illustrative image card for an evidence gap.

## Consumer migration

No data migration or rewriting of old records is needed. These are intentional output/schema expansions that consumers must handle before using new pipeline output:

1. `Verdict` and `JUDGE_SCHEMA` add `unresolved`. Update exhaustive switches, validators, filters and verdict labels. Do not map an unknown verdict to `no_change`, `missing` or a charge.
2. `Finding.confidence` is `number | null`. Null denotes no model judgement. Do not coerce null to zero, a percentage, or an agreement/default-decision threshold. Raw model response validation still rejects null confidence.
3. `Finding.judgementSource` is optional (`model` or `evidence_gap`). Old saved findings omit it and remain valid; absence does not independently prove the source of a record.
4. `ChangeStatus` adds `unresolved`. Existing `added`/`removed` union members remain available for consumers with independent evidence, but the matcher no longer produces them automatically.
5. Evidence-analysis `Observation.confidence` accepts null and `Outcome` adds `unresolved`. Model abstentions are never positive change flags.

The public demo analysis endpoint remains unavailable. The original sample runner still filters to paired detections, so it does not yet expose all segmentation/matching gaps in its serialized results.

## Limits not solved here

The greedy label/appearance/position matcher is a heuristic, not a proof of object identity. It can confuse duplicate objects, and frame position is unreliable across camera movement. The architecture plan's proposed model ambiguity resolver is not implemented. There is no coverage/occlusion assessment or verified absence representation. The current absence guard is intentionally conservative: even a truly removed object stays unresolved without suitable comparison evidence. Models can still misjudge supplied paired imagery, and prompt instructions alone do not establish reliable abstention or prove physical absence. No real-property accuracy claim follows from these offline tests.

## Offline verification

`npm run check` includes `scripts/test-unresolved.ts` and the board DOM regressions. The flat-scorer regression tests both pure scoring and the real CLI in a disposable directory, including mixed abstentions and real change flags, and reproduces original saved evaluation output exactly. The new pipeline tests exercise absent/one-sided/blank-image observations with a request callback that would fail if invoked, model abstentions, invalid schema values, supported paired outcomes, cost withholding, draft wording, evidence scoring at confidence thresholds, and pack image-card suppression. Network access is prohibited by the new regression. `python scripts/test-pack-format.py` covers unresolved cost labels. `npm run evidence:check` verifies original source bytes and recorded metrics. DOM tests are not a real-browser or model-quality assessment.
