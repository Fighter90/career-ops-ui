# Parent parity pack (v1.117.0)

**Status:** Shipped · **Version:** 1.117.0 · **Date:** 2026-07-06

## What

Implements the improvement list from the parent-repo gap analysis (2026-07-06):
six parent career-ops capabilities surfaced in the UI in one release.

| # | Capability | Where | How |
|---|---|---|---|
| 1 | **Follow-up cadence board** | `#/followup` (above the LLM form) | `server/lib/routes/followup.mjs` (31st module): `GET /api/followup` shells out to the parent's `followup-cadence.mjs` (JSON stdout → per-application urgency 🔴urgent/🟠overdue/🟡waiting/🔵cold + days-to-next); `POST /api/followup/seed` runs `followup-seed.mjs` (`{appNum}` or `{backfill:true}`, optional `force`) — the explicit user write of `data/follow-ups.md` pin directives. |
| 2 | **Rejection / ATS-channel analytics** | 4th tab on `#/stats` | `GET /api/stats/patterns` (in `stats.mjs`) shells out to `analyze-patterns.mjs` (read-only): outcome mix, recommendations, per-ATS-vendor advance rate (Bommasani et al., FAccT 2026), sub-sample vendors starred. |
| 3 | **Add to CV** | CV Studio card | `POST /api/cv-studio/add-entry`: URL (**`isValidJobUrl` + `safeGet`** — the SSRF envelope; HTML-stripped, size-capped) or pasted text → grounded-bullets prompt via the shared cascade (manual fallback). **Suggestions only — no file writes**; the user pastes accepted bullets into the CV editor (normal `PUT /api/cv` path). |
| 4 | **4 scan providers** | Scan source dropdown | `beesite` (GJB `/search` JSON, bounded newest-first walk), `higheredjobs` (RSS category feed, exact-host pinned), `jibeapply` (iCIMS `/api/jobs`, sequential capped pagination), `softgarden` (server-rendered widget page). Each = source (`meta` auto-discovered) + adapter in `ALL_ADAPTERS`. Registry **46 → 50** (41→45 EN + 5 RU). |
| 5 | **Knock-out pre-scan** | Apply checklist | `buildApplyChecklist` step 2: scan for visa/degree/salary/on-site/clearance disqualifiers BEFORE drafting; flag `⚠️ KNOCK-OUT WARNING`. |
| 6 | **Reconcile runner** | Maintenance runners | `/api/run/reconcile` → `reconcile-pipeline.mjs` (buffered runner allowlist). |

## Design decisions

- **Shell-out over reimplementation** (the drift-avoidance recommendation from
  the gap analysis): cadence math and pattern analysis run the PARENT scripts
  with `runNodeScript` (cwd=PROJECT_ROOT, timeouts, SIGTERM→SIGKILL), so the
  parent remains the single source of truth. All shell-out routes are
  **fail-soft**: script absent / non-zero exit / bad JSON → `{available:false}`
  and an honest UI note, never a 500 (CI and standalone installs keep working).
- **Add-to-CV never writes.** The one item the analysis flagged as touching the
  SSRF + CV-write envelope ships in its safe form: URL fetch behind
  `isValidJobUrl` + DNS-pinned `safeGet`; output is a reviewed suggestion the
  user pastes through the existing `stripDangerousMarkdown`-guarded CV editor.
- The prompt forbids invented metrics/employers/dates ("keywords get
  reformulated, never fabricated") and uses candidate context for tone/dedup only.

## Tests

`tests/sources-parity-v1117.test.mjs` (6 — stubbed-transport fetch/parse,
host-pinning, meta, adapter contracts) + `tests/parity-routes-v1117.test.mjs`
(7 — fake parent scripts in a mkdtemp root: cadence relay, seed validation +
args, patterns relay, add-entry 400/manual-prompt/no-writes, SSRF gate 400s,
reconcile registered, knock-out step present). Count assertions bumped
(`adapter-registry`, `scan-sources-endpoint`). Suite **1737 → 1750**.

## Docs

41 i18n keys ×16 + snapshot; Help ×16 (§13 cadence board, §24 add-to-CV,
§26 patterns tab, §17 counts 46→50/41→45); CHANGELOG ×16; README ×16;
CLAUDE.md + SDD CONVENTIONS (31 route modules, 1750 baseline); qa prompt
v1.117 + master §14 row 17.
