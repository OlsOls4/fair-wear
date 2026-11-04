# SAM geometry boundary

Future offline runs validate SAM text before matching or judging. Previously, missing numeric fields could become `NaN`, out-of-image boxes could pass, and malformed nonempty lines could be silently skipped while valid earlier records escaped as a partial result. Now a malformed record anywhere aborts the entire response with `SamResponseError`; the analysis handler returns `segmentation_unavailable` without findings or a pack. An empty or whitespace-only text lane remains a valid zero-detection result after transport completion has been verified.

## Supported protocol and deliberate behavior

The implementation follows the [Meta SAM text protocol](https://github.com/meta-models/meta-sam/blob/main/protocol/sam3.md), checked 4 November 2026, for source geometry and token structure:

- Frame indices must be nonnegative safe integers. Sparse and reverse frame order is valid. Image responses require frame zero.
- Object IDs are retained as decimal strings, including large and leading-zero IDs. They are not array positions or JavaScript numbers.
- SAM's inclusive far corner is converted once to half-open bounds. A one-pixel box is valid, including at the final pixel of the source image. Coordinates and dimensions must be safe integers, with positive source dimensions and complete containment.
- Box/mask token order, optional record commas, reordered fields, unknown fields/tokens and frame-header extensions remain supported. Unknown extensions produce diagnostics, not data loss. Duplicate box/mask tokens or non-confidence fields are malformed.
- Confidence is optional. Valid finite values in [0,1], including the documented decimal/exponent forms, are retained. Invalid or duplicate confidence is omitted with an `ignored_confidence` warning, as required by the protocol. Missing confidence is neither zero nor proof of certainty. A mask's different confidence never replaces the box confidence.
- Malformed nonempty text is rejected, not silently skipped. Unlike the generic parser's partial-record diagnostic output, Fair Wear deliberately refuses the whole response to avoid judging an incomplete detection set.

`parseSamText` returns records plus structured warnings, deduplicated by code/key. `parseSamLines` retains the simpler records-only interface. The model wrapper logs warning codes and line numbers without raw provider content. IDs are now strings and boxes now half-open: downstream custom consumers must adopt these semantics. Existing string interpolation, object grouping and the crop helper have been checked. Historical output files are not migrated or regenerated.

## Mask limits

The parser checks that a mask token exists, requires zero mask origin, verifies positive safe raster dimensions/product and a supported encoding marker/base85 alphabet. It preserves the original mask token fields. It does **not** validate the encoded length prefix or payload completeness, decode arithmetic coding, verify canonical encoding, establish mask/box pixel alignment, or prove the mask's semantic accuracy. For example, an alphabet-valid short payload such as `!a` can pass the envelope check without being decodable. Passing the envelope check is not a verified mask. Full mask decoding requires the official decoder or equivalent separately tested work.

## Offline checks

`npm test` includes `scripts/test-sam-geometry.ts`. Handwritten fixtures cover empty output, valid and malformed geometry, single-pixel/edge crops, huge IDs, protocol extensions, reverse frame order, optional/invalid confidence, truncated records, rejection of partial responses and downstream failure containment. The transport test now expects string IDs and half-open bounds. The fixtures are not retained historical model traces. No paid/model calls or new accuracy measurements were made. The public sample, generated imagery, crops and evaluation results remain unchanged.
