# SAM response boundary

The offline Meta integration must distinguish **completed zero matches** from **segmentation unavailable**. Both previously became an empty list when an HTTP-200 SSE body contained a failure rather than text. A cut-off stream could also leak partial detections into matching and judging.

`readSamOutput` now requires `response.completed`, rejects error/incomplete/refusal events, checks lane finalizers against accumulated deltas, and rejects contradictory or multiple output-text lanes and invalid supplied lane identities. Request and response-body failures are wrapped in the same typed failure without exposing transport details. Completed empty output remains valid. The shared analysis handler returns HTTP 502 with `segmentation_unavailable` and no pack for this typed failure. The offline demo runner stops instead of writing new results when the response boundary fails. The public analysis route is still disabled; this is future-run hardening, not a live inference feature.

The reader accepts SSE comments, CRLF, data fields with or without a space, multiline data fields and arbitrary delta boundaries. Output-text lane finalizers are reconciled instead of appended twice. Aggregate `response.completed.response.output` contents are never used as fallback text or compared with an established lane. For the empty compatibility exception only, supplied aggregates with nonempty text, refusal, or malformed contents are rejected rather than converted to zero matches. Nonempty or delta-bearing output requires a lane finalizer. As a deliberate compatibility exception to the stricter Meta client-adapter contract, a completed empty stream without any deltas/finalizer is accepted because Meta’s public API documentation explicitly permits completed zero matches and does not promise a finalizer in that case. Reasoning and unrelated lifecycle events cannot substitute for completion. Remote error details are not copied into the public failure message.

## Evidence and limits

Run `MOCK=1 FAIRWEAR_ALLOW_PAID=0 node --import tsx scripts/test-sam-response.ts` (also in `npm test`). The test prohibits network access and uses handwritten protocol fixtures, **not retained historical SAM traces**. It covers valid and empty results, failures/refusals, truncated output, lane finalizers, ignored aggregate snapshots, malformed events and transport/body errors and prevention of downstream judging/pack generation. These are transport regression tests, not segmentation or accuracy measurements.

No model calls were made for this change. The recorded sample, crops, scores and original model artifacts are unchanged. No inference about real-property reliability follows. The stream reader does not establish media coverage or prove that the model found every object. Its downstream [geometry boundary](sam-geometry-boundary.md) now validates source-pixel boxes and token structure. Encoded mask pixels are still not decoded or verified; completed streams and valid geometry do not establish complete detection coverage. Raw model tracing and new benchmark runs remain future work requiring their own permissions and provenance.

Protocol references checked 4 November 2026:

- [Meta: read segmentation output](https://dev.meta.ai/docs/sam/reading-segmentation), including valid completed empty output.
- [Meta SAM protocol](https://github.com/meta-models/meta-sam/blob/main/protocol/sam3.md), including stream terminal failures and output-text handling.
