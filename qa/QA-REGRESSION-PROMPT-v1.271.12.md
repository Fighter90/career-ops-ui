# QA regression prompt — v1.271.12

The #/scan wire-weight fix (the owner-reported slow search page), shipped as a normal release train.

**Story:** the prod perf probe (12 endpoints, 5 rounds) measured the scan page's mount-time data endpoints at `/api/scan-results` 1.9 s / 3.77 MB and `/api/scan/reports`-class `/api/scan/reposts` **4.6 s / 2.97 MB** — ~6.5 s of API time per `#/scan` visit. Fixed without changing what renders: (1) scan-results descriptions capped server-side at 4000 chars — the exact slice `scan/runner.js` already applies, rows render byte-identical; (2) repost clustering memoized on the scan-history's mtime+size+window — recomputed once per history change. The perf probe now covers the scan page's endpoints too.

## §0 Gates at ship time

- `npm run test:ci` — **8329 tests / 8312 pass / 0 fail** (local Node 22, 2026-11-12).
- `npm run test:e2e:browser` — **210 / 209 pass / 0 fail / 1 opt-in skip** (rerun on the fixed tree).
- `node evals/workflow/run.mjs` — 0 ✗.
- CI on main: green (see the run on the release commit).

## §1 What changed

- `server/lib/routes/scan.mjs` — `/api/scan-results` caps each row's `description` at 4000 (both the bare-snapshot and the paged branches); `/api/scan/reposts` memoizes `detectRepostsFromFile` keyed on mtime+size+window (Map, cleared past 8 entries; a changed history recomputes — verified by test).
- `scripts/remote-qa/perf-probe.mjs` — the endpoint list gains the scan page's four mount-time endpoints.
- `tests/scan-wire-weight.test.mjs` — NEW, 5 specs (caps in both branches; memo identical-repeat / invalidate-on-change / per-window).
- CHANGELOG ×19 + README ×19 (banners v1.271.12, badges 8312) + `qa/QA-REGRESSION-PROMPT-v1.271.12.md` (this file; v1.271.11's archived).

## §2 Manual browser pass

- `#/scan` loads visibly faster on a prod-sized snapshot; the row peek description still renders (now truncated server-side at 4000 — no visual difference).
- The reposts disclosure still lists clusters; after a new scan (history changes) it recomputes.
- No new console errors on `#/scan`, `#/tracker`, `#/pipeline`.

## §3 Contract invariants

- The repost detection algorithm, scan filtering, and dedup are untouched — only where the wire stops and when the computation re-runs.
- `/api/pipeline` deliberately unchanged (CAR-250 data-owner design work, documented in the release Notes).

## §4 Sign-off

Release train: docs (agents ×18) + gates + tag + Release/Publish/Pages + resumecraft deploy/verify + perf probe before/after (the after-numbers are the acceptance evidence) + wiki ×19.
