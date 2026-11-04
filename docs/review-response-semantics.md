# Explicit review choices and draft semantics

The review board's historical `Agree` key is kept in memory, tab storage and the
one-use handoff so existing selected responses are not discarded or migrated.
Its visible label and current-draft meaning are now **Discuss after evidence**:
no responsibility, amount or charge is accepted. Original model JSON, reply and
PDF artifacts remain unchanged and separately labelled.

Untouched included findings produce neutral “Review pending. No reviewer response
selected” requests. They cannot generate first-person dispute or willingness to
discuss. Explicit changes or confirmations can generate those responses.
Not-claimed suggestions remain omitted, with counts clearly identified as including
suggestions. Every finding supports confirmation and undo, including ordinary
non-persisted boards and findings outside the handoff's three example claims.

The handoff still includes only explicit choices for bedroom carpet, kitchen oven
and bathroom bath. Other findings and untouched suggestions never enter it.
Dispute maps to Question this deduction; the legacy Agree key maps to Discuss after
evidence; Not claimed maps to Leave out of response. Case Builder's untouched
examples start as Question this deduction, not as imported review choices.
Builder edits do not update board choices. No acceptance option was introduced.

## Verification

- Full `npm run check`: type checks, offline logic, DOM accessibility and keyboard
  focus, explicit change/confirmation/undo, neutral untouched draft, current copy
  and download, filtering, reset, storage failures, reload-style restoration,
  one-use transfer, export provenance, and archived-artifact separation.
- Production build with `NEXT_TELEMETRY_DISABLED=1 MOCK=1 FAIRWEAR_ALLOW_PAID=0`.
- Browser regression expectations updated for the visible label. Native Chromium
  execution could not start in this runner: local socket creation was denied
  (`socket() failed: Operation not permitted`), including on an escalated attempt.
  No browser assertions ran, and rendered layout/native downloads are unverified.
- No deployment, push, paid/model calls or original artifact rewrites.
