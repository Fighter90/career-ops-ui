# QA Regression Prompt — v1.268.0

> Release: **v1.268.0** (2026-11-05) · minor — the evaluate two-step contract (CAR-229/230/111 + CAR-232/233 runners + Permissions-Policy)
> Prod target: resumecraft.ru = **1.268.0**, parent 1.38.0 (fork @ `31a29b30`, unchanged — no parent-sync in this release)
> Tests: **7439** unit (7510 pass / 0 fail / 3 skip) · Playwright **176** (0 fail / 1 opt-in skip) · registry unchanged **129 = 124 EN + 5 RU · 124 adapters**

## §0 gates (must be green before the sweep — real numbers, no re-derivation by hand)

| Gate | Command | Expected |
|---|---|---|
| Unit + integration + parity | `npm run test:ci` | **7439 tests · 7510 pass · 0 fail · 3 skip** |
| Coverage ratchet | `npm run test:coverage` | **98.49 line / 90.31 branch** (gate ≥90 line / ≥80 branch) |
| Browser suite | `npm run test:e2e:browser` | **0 fail / 1 opt-in skip** (the `SCAN_REDESIGN_CAPTURE=1` layout-capture test) |
| Workflow graders | `node evals/workflow/run.mjs` | **0 ✗** |
| Changelog parity | `node scripts/check-changelog-parity.mjs` | **✓ ×19** |
| Prod-live evaluate | evaluate ×19 locales, `save:false` | **machine block 19/19 · score spread ≤ 0.5 · p90 ≤ 180 s · `cached_tokens > 0` from each locale's 2nd call** |

A red §0 gate is a finding, not a sweep item: triage before touching the manual checklist.

## What shipped (verify these first)

1. **Two-step evaluate (CAR-229).** Evaluate one JD: the SCORING step emits canonical English JSON only
   (temperature pinned 0.1, 120 s clock), the RENDER step elaborates A–G in the report locale (≤300 s)
   and is forbidden to touch numbers, the header, or any machine block — the SERVER assembles the
   `# Evaluation:` header, the `**Date:**/**Score:**/**Legitimacy:**` lines, `---SCORE_SUMMARY---` and
   the ```yaml machine block from the scoring JSON. The client payload keeps the yaml block and strips
   the summary block. Same synthetic JD in two different locales must land within **0.5** of each other.
2. **SSE stage progress (CAR-230).** `#/evaluate` streams scoring → rendering → assembling instead of
   one silent POST; the loading line quotes REAL p50/p90 latency from the usage journal (no stale
   "2–4 min" copy). A non-JSON scoring answer retries once; a render that still misses sections falls
   back to a server-built body with the warning carried — the machine surface stays complete.
3. **Prompt cache for every locale (CAR-111).** Both steps share ONE byte-stable English instruction
   header; the locale directive, the scoring JSON and the JD ride the uncached tail. On prod, the
   **2nd evaluate call of each locale** must show `cached_tokens > 0` in the usage journal — including
   the 18 non-en locales (the per-locale cache miss is structurally gone; a test pins byte-identical
   stable prefixes across all 19).
4. **Data migration runners (CAR-232/233).** `POST /api/runners/report-dates` and
   `POST /api/runners/company-fix`: **dry-run is the default**; apply writes a timestamped `.bak`
   backup and touches only the named cells. Prod scope: 368 pre-2026-10-26 report-date rows; 123
   tracker Company cells holding a source name ("hh") + 14 holding a role title. **Dry-run output
   review + apply are OWNER actions** — QA runs dry-run only and confirms the JSON preview reads
   correctly; never apply from QA.
5. **Permissions-Policy header.** Every response carries
   `camera=(), microphone=(), geolocation=(), payment=(), usb=()` — check on `/` and one `/api/*`
   route (the surfaces this app never uses are explicitly denied).

## Two-step evaluate checklist (the release's core contract)

- [ ] **Manual-mode prompt echo works**: a manual (no-provider-key) evaluate still echoes the prompt
      surface cleanly — the two-step split did not break the manual fallback path.
- [ ] **Auto-pipeline reports carry the yaml machine block**: run one auto-pipeline entry end-to-end —
      the saved report has the server-built header + `---SCORE_SUMMARY---` + ```yaml block, and the
      tracker row it creates gets a real score.
- [ ] **de/uk reports now HAVE the header + score line**: run evaluate `save:false` in de and uk —
      both carry the `# Evaluation:` header and a score line (these locales were among the ones that
      previously missed the machine surface).
- [ ] **The tracker score column fills from the server-written summary**: after one saved evaluate,
      the tracker row's Score cell is populated from the server-assembled `---SCORE_SUMMARY---` —
      not blank, not model prose.

## Standard sweep (every release)

- [ ] All views render; 19 locales switch cleanly (no Latin leaks, RTL holds); dark/light across sidebar/tracker/scan.
- [ ] Mobile 390 px: sidebar drawer, scan table, tracker — no horizontal overflow.
- [ ] `#/health` all green; `/api/health` reports `1.268.0`.
- [ ] cvstart.org: mirrors stamped `v1.268.0`; the Sources section shows 129.
- [ ] README ×19 banners name v1.268.0 (lead) / v1.267.2 (previous); badges tests-7510 / release-v1.268.0.

## Credentials & ethics

- Prod checks authenticate with `PROD_URL` / `AUTH_LOGIN` / `AUTH_PASSWORD` from the environment only —
  never pasted into files, never committed, never logged into a report.
- The ×19 live evaluate sweep spends provider tokens: run `save:false`, sequentially, one retry on a
  transient failure — stop and report on the second failure of the same locale.
- QA never submits a job application, never sends a message/email, and never mutates prod data: the
  migration runners stay on dry-run; everything apply-shaped is an owner action after human review.

## Not in scope (by design)

- The P2/P3 fix-program tails (scoped and queued, deliberately not in this release): the help-guide
  `{{t:key}}` placeholder mechanism + deep-link label localization (CAR-107), the dashboard glossary
  sweep (CAR-108), map aggregates + hh.ru area geocoding (CAR-105), the tracker header menu for
  destructive operations (CAR-117), site header blur + copy feedback (CAR-132/141), README ar/pl/uk/vi
  parity, per-locale dict chunks (CAR-104).
- The prod data migrations themselves (report dates, tracker companies, score backfill) — the tooling
  ships here; the data changes are owner actions, not QA steps.
