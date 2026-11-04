# Video analysis is disabled

The end-to-end video path is unsupported, including in local paid mode. `extractItems` now throws `UnsupportedVideoAnalysisError` immediately, before any frame sampling, budget reservation, network/model request, matching or judging. The reserved API first checks demo mode and request qualification:

- Public/demo mode: HTTP 503, `analysis_unavailable`, with no findings or pack, as before.
- Non-demo mode with an invalid request: HTTP 422, `analysis_context_required`, before extraction.
- Non-demo mode with a qualifying request: HTTP 501, `video_analysis_unsupported`, before any model call or pack generation.

This gate applies to all references given to the video entrypoint, including opaque URLs and filenames ending in `.jpg`. A file extension or caller label cannot establish that a video has been extracted into a real image. The API does not become a still-image endpoint by supplying an image-looking URL.

## Why the previous wiring was unsafe

The previous extractor sent a video reference to SAM tracking, selected a record by box area/confidence, and stored the original video URL as `bestFrame.url`. `judge` then supplied that URL through Spark's image input. No decoded image or source-local crop had been produced. The SAM frame index was also stored in the timestamp field without establishing the video's timebase. `frames.ts` contains standalone ffmpeg sampling helpers, but those helpers were not connected to this path. Their existence is not evidence that a selected SAM frame was extracted or verified.

The shortcut was removed, not replaced with mock crops or synthetic inference. Re-enabling the path requires independently tested media decoding, frame-index/timebase mapping, source-local crop generation, actual image references to Spark, provenance, and handling of failed extraction. No such capability is claimed here.

## What remains unchanged

The recorded demonstration uses still images: `scripts/run-demo.ts` calls `sam31Segment`, crops actual local source-image bytes and supplies image data to the judge. This separate offline path is unchanged. No images or model output were regenerated; the saved public demo, scores, PDF and reply are unchanged. Local Case Builder photos remain a manual human-authored workflow with no inference.

The standalone `sam31Track` transport wrapper remains a developer component for explicitly authorized SAM tracking experiments; it is not an operational end-to-end Fair Wear video-analysis service. The product video extractor/API no longer reaches it. Paid scripts still require explicit opt-in and the budget guard; this change neither performs nor authorizes a model run.

## Verification

`npm test` includes `scripts/test-video-support.ts`. It enables paid-mode flags with synthetic credentials, traps network calls and uses a disposable ledger. It verifies direct video entrypoints and qualified requests make zero requests/reservations; invalid requests stop earlier; public/demo mode remains disabled. A separate in-memory fake transport confirms the still-image SAM wrapper remains accessible, after which video rejection leaves that synthetic reservation unchanged. These are offline capability/control-flow checks, not real model runs, video-accuracy evidence or an improvement to the recorded image demonstration.
