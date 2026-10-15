# Fair Wear — architecture and build plan

Meta Global AI Developer Hackathon, Indie track, theme "Build for Your World". Build window 26 Oct – 4 Nov 2026 21:00 ET (5 Nov 01:00 GMT).

## User flow
1. Tenant creates a "property" and picks rooms.
2. Uploads a move-in walkthrough and a move-out walkthrough per room (phone video, 30–90 s each), plus tenancy length.
3. Gets a findings board (per item: before/after crops, verdict, confidence, apportionment) and downloads an evidence pack (PDF) + draft reply to the landlord's deduction list.

## Pipeline (lib/pipeline/)
| Stage | What | Model / tool |
|---|---|---|
| 1 Sample | 1 fps frames per room video; drop blurry frames (Laplacian variance) | ffmpeg (server) or canvas (client) |
| 2 Segment + track | Text-prompted item list (ITEM_PROMPTS) tracked through each video; best frame per item = largest, sharpest mask | **SAM 3.1** (video, promptable concepts) |
| 3 Match | Same item across visits: room + label, then mask-crop embedding cosine; ambiguous cases (two doors) resolved by Muse Spark given both crops | SAM 3.1 masks + **Muse Spark** |
| 4 Judge | Per matched pair: verdict (no_change / fair_wear / damage / cleaning / missing / added), confidence, plain-English description, apportionment using useful life × tenancy length | **Muse Spark** (vision, JSON output) + guidance table |
| 5 Pack | Annotated comparison card per finding; evidence pack PDF; line-by-line reply draft | **Muse Image**, Muse Spark, react-pdf |

Fallback: if SAM 3.1 video tracking is rate-limited, run per-frame segmentation on 5 key frames per room.

## Stack
Next.js 15 App Router + TypeScript on Vercel (project `fair-wear`), repo github.com/OlsOls4/fair-wear (MIT). Uploads to Vercel Blob (free tier) or direct-to-model URLs. MOCK mode (no META_API_KEY) returns fixtures so the UI works without model access. Long jobs: route handler with maxDuration 300; split per room if needed.

## Demo data (see docs/data-licences.md)
- Primary: synthetic before/after pairs — real CC-BY walkthrough clips (move-in) with damage painted in by Muse Image on keyframes (move-out), clearly labelled as generated.
- Matching benchmark: SceneDiff SD-V subset (MIT) — report item-matching precision/recall on added/removed/moved objects.
- Condition sanity check (eval only, not shown commercially): miProgram UK inspection sample.

## Day plan
- D1 26 Oct: acceptance, rules, API keys; wire Muse Spark + SAM 3.1 calls in models.ts; smoke test on one frame.
- D2 27 Oct: frame sampling + SAM 3.1 tracking on one room; best-frame selection.
- D3 28 Oct: matching + SceneDiff mini-eval script (20 pairs).
- D4 29 Oct: judge prompt + guidance table; JSON schema validation; 10 hand-labelled synthetic cases.
- D5 30 Oct: build synthetic demo flat (4 rooms, ~8 planted changes incl. 3 fair-wear decoys).
- D6 31 Oct: UI — upload, progress, findings board.
- D7 1 Nov: Muse Image cards + PDF pack + reply draft.
- D8 2 Nov: polish, accuracy numbers on README, deploy.
- D9 3 Nov: demo video (script in docs/demo-script.md), submission text.
- D10 4 Nov: submit by 18:00 ET (buffer 3 h before 21:00 ET deadline).
