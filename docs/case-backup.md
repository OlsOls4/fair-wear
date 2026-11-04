# Private case backups

## User value and boundary

Evidence gathering often takes more than one sitting. Private cases now have an explicit **Save editable backup** download and **Reopen private case** chooser. This closes the otherwise unavoidable loss of editable work on reload without creating an account, uploading files or using browser storage. It is a usability capability, not evidence of real-user validation, real-home accuracy or live inference.

The JSON backup is separate from the read-only HTML evidence bundle. It retains every item, including omitted items, review notes, assumptions, evidence-tracking choices and prepared display JPEGs. It is unencrypted and should stay private. The interface discloses this before saving. Omitted items still do not appear in the response/evidence HTML. Original photo files remain the user's responsibility. Reopening re-encodes display JPEGs for safety, so repeated backup/reopen cycles may reduce display quality; keep originals.

No automatic saving occurs. Download initiation is not proof of successful saving; the status explicitly asks the user to check the browser saved it. Leaving-page warnings remain active. Browser/device file location or syncing is outside this app's control.

## Import contract

- Only `fair-wear-private-case`, version `1`, personal mode; no sample backups or historical HTML imports.
- File size checked before reading; UTF-8 content bound checked again at 32 MiB.
- 1–12 items, unique safe IDs, allowlisted keys, field-specific text limits, enumerated response/cost/context/status values.
- Unknown fields, model output and sample review metadata fail closed rather than acquiring apparent model provenance.
- Only embedded local JPEG data URLs. Strict base64, JPEG signature/dimensions and final EOI required; dimensions limited to the 1600-pixel display-copy maximum. Image strings are capped at 5 MiB each. External URLs, SVG, arbitrary data MIME and sample origins are rejected.
- Data is reconstructed from validated fields, never executed or merged into application configuration. After structural validation, each photo is decoded serially in the browser, its natural dimensions checked, and its pixels re-encoded through canvas before any case state is replaced. Decode failure, unsupported canvas and a 15-second per-image timeout abort import. Text remains escaped by React and the existing evidence formatter. Nothing is sent to a server or written into a URL.
- Validate first; if the current case has edits, ask before replacement. Cancel, invalid file and read failure preserve the existing state. File chooser is reset so repeated import of the same file works.
- All main editing controls are disabled during asynchronous file reading. Restored items retain their IDs; new deductions avoid collisions.

A valid schema or original-file hash does not establish authorship, capture date, unmodified pixels, legal responsibility or authentic evidence. Backups can be edited outside Fair Wear. The restored-case notice expressly requires review. JPEG structural checks plus browser decoding protect the import path, not image authenticity. Imported photos are re-encoded to strip metadata, but visible private content remains. Only reopen backups you intended to keep, and review before sharing any output.

## Offline verification

`npm run test:case-backup` exercises roundtrip fidelity including omitted data and image hashes, schema/version failures, external/SVG/truncated/mislabeled images, forged model fields, duplicate IDs, item/string/file limits, escaped HTML output, current-state recovery, repeated reopen, identifier collision avoidance and no network/storage calls.

DOM tests mock the native chooser and download APIs. They do not establish actual browser download completion, native file-picker behavior, image decoding or rendered layout. The feature does not add paid calls or transmit real photos during testing.

Native browser regression: `python scripts/test-case-backup-browser.py` against a locally running build using `FAIRWEAR_CASE_TEST_URL`. It uses generated fixture imagery only. Browser execution must be verified in an environment that permits Chromium sockets; DOM mocks are not a substitute.
