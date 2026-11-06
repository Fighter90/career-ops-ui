# QA Regression Prompt — v1.268.1 (patch: the v1.268.0 contract fixed)

> Basis: the prod regression of resumecraft.ru per `qa/QA-REGRESSION-PROMPT-v1.268.0.md`, 2026-11-05, Chrome + live calls `save:false`. Verdict: **not accepted** — the §0 score-spread gate was red and both migration runners were dead in dry-run. This patch fixes the contract; no new features (the stats overhaul and the kanban funnel are separate tracked work — CAR-247 / CAR-237).

## §0 Local gates (the numbers this release carries)

| Gate | Command | Expected |
|---|---|---|
| Unit + integration | `npm run test:ci` | **7605 tests · 7602 pass · 0 fail · 3 skip** |
| Browser | `npm run test:e2e:browser` | **182 pass · 0 fail · 1 opt-in skip** |
| Coverage | `npm run test:coverage:gate` | ≥ 98.49 line / 90.31 branch ratchet — measured **98.53 / 90.35** |
| Workflow evals | `node evals/workflow/run.mjs` | **0 ✗** (incl. the NEW `evaluate-locale-parity` + `evaluate-repeatability` offline graders) |
| Changelog parity | `node scripts/check-changelog-parity.mjs` | ✓ ×19 at 1.268.1, 487 releases each |
| Health | `GET /api/health` | `1.268.1` / parent `1.38.0` |

## §1 Two-step evaluate — the acceptance gates that were red, now must be green

1. **Locale parity (live, `save:false`)**: 1 fixed JD × 19 locales → machine block 19/19, header date = today ×19, **score spread max−min ≤ 0.5** (v1.268.0 measured 1.5). The score is server-computed from anchored integer sub-scores; temperature 0 + seed; median-of-3 self-consistency.
2. **Repeatability (live)**: 1 JD × 3 repeats × 3 locales (en, ru, de) → intra-locale spread **≤ 0.2** (with the scoring cache: 0).
3. **Prompt cache**: the second call of every locale → `steps[*].cached > 0` on at least one step; `#/usage` shows the «From cache» column and hit-% (`/api/usage` exposes `cachedIn` + `cacheHitRate` per window).
4. **Report rendering**: A–G present; no server fallback body without a warning; render budget = `evalMaxTokens(lang)` (16384 EN / 32768 token-dense).

## §2 Migration runners (dry-run ONLY on prod — apply is an owner action)

5. `POST /api/runners/report-dates` dry-run → `count ≈ 368`, `rows[{file, headerDate, fileDate}]` consistent with `/api/reports` date mismatches; localized headers (ru/de/…) recognized.
6. `POST /api/runners/company-fix` dry-run → `fixed != null` for **≥ 90 %** of rows; `source: 'report' | 'ats'`; the rest in `unresolved[]` with reasons.
7. `POST /api/runners/score-backfill` dry-run → `fixed != null` for **≥ 90 %** of the 159 scoreless rows.
8. No runner writes anything without `mode: 'apply'` — verify a dry-run leaves the tracker/reports byte-identical.

## §3 UX spots fixed in this patch

9. `#/scan` quick-view and every modal dialog: a 60+ char title does NOT intersect the ✕ button at 1440/390/RTL (Playwright pin: `tests/playwright-dialog-overlap.mjs`).
10. Sidebar: drag the inline-end border → 200–420 px, persists, double-click resets, Arrow keys adjust, mobile drawer untouched (`tests/playwright-sidebar-resize.mjs`).
11. `#/evaluate`: no «⏱ ~2–4 мин» in ANY locale — the live p50/p90 hint instead (sweep ×19).
12. `#/stats` → Overview → status funnel: no untranslated «Evaluated» (sweep ×18).
13. `#/pipeline`: «Группами | Списком» toggle works and persists.
14. Single failed request → toast only; the «server down» banner rises on a failed `/api/health` or ≥2 consecutive failures.

## §4 Dual-provider gate (CAR-246)

15. Run the §1 parity + repeatability evals TWICE: on the active provider (OpenRouter deepseek/deepseek-v3.2) and on Hermes (claude-haiku-4-5, `127.0.0.1:8788/v1`) — provider override for the eval script ONLY, never the prod `.env`. If Hermes passes where deepseek fails, that is the owner's argument to switch the default — no change in this release.

## Standard sweep

All views × all 19 locales (browser suite 182 pass / 0 fail / 1 opt-in skip locally), LLM providers live with `save:false`, scanner via the hourly timer, remote-QA (prod routes + site + links) green. Findings → Linear (carrer-ops-ui workspace) immediately, then executed in order.
