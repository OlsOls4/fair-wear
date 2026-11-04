# Explicit confirmation for sample responses

Supported sample claims now distinguish untouched suggestions from changed or explicitly confirmed responses. A reviewer can keep the suggested response using Confirm Dispute (or the applicable suggestion), and Undo confirmation removes that choice without changing the visible suggestion. Existing changed selections remain explicit choices. A live count above Continue shows how many of the three supported claims will carry over, including filtered-out cards.

This reuses the existing public-ID/decision session store. No new data is stored. Reset clears confirmations, and confirm/undo invalidates an abandoned pending handoff. One-use token consumption, mapping, private mode and normal builder reload behavior are unchanged. The bath shortcut now says “Inspect a label mismatch”.

Validation:
- Full npm run check passed, including 46 handoff checks.
- Production build passed on retry after an initial build worker SIGKILL.
- Final accessible-name adjustment includes the visible Confirm label in the accessible name; focused handoff checks and typecheck rerun.
- Native Chromium execution remains blocked by this environment's local socket restriction, including after escalation. Dev server startup also encountered uv_interface_addresses restrictions. The included scripts/test-sample-confirmation-browser.py covers native Enter/Space, confirm/undo, filtered mixed choices, session reload, one-use transfer, reset and mobile overflow when run in an environment that permits the local browser and server. These native checks have not passed here.

Storage-failure follow-up: response persistence and pending handoff invalidation are now independent. If saving fails but removal works, Undo, selection changes and reset still clear the stale snapshot. If removal fails, a persistent warning and Cancel handoff retry remain available. Full npm run check passed with 53 handoff checks, including failed-save/removal combinations and successful cleanup retry. Native browser restrictions remain unchanged.
