# SPEC — Post-regression follow-up — v1.248.3

- **Status:** Done (deployed, prod-verified)
- **Release:** v1.248.3 (PR #427, tag `v1.248.3`); CodeQL follow-ups #421/#422
  preceded it
- **Related:** CAR-61 (t-role junk continued), CAR-67/68 follow-ups; base
  v1.248.2
- **Owner:** orchestrator (interdependent fixes — single agent not used)

## Goal

Close the four items the v1.248.2 regression verdict left open: §1 did not
work on prod, §8 was incomplete, plus two newly found bugs.

## Scope

1. **auto-pipeline validates BEFORE saving** — `validateEvaluationReport` +
   `extractScore` run between evaluate and the save; no score 0–5 or
   missing A–G → `step(2,'failed','evaluation incomplete: …')` +
   `fail(2, …, { rejected: true })`; no report file, no tracker row;
   activity `auto-pipeline.evaluation.rejected` (host only). Root causes on
   prod: 760 t.me pipeline links cleared the 200-char length gate (Telegram
   post pages sanitize long), and the report save had no content check.
2. **`guessCompanyRole` EMPTY_DOMAINS** — t.me/telegram.me/vk/linkedin/
   example… never become a company; a Telegram post falls back to its
   channel name (t.me/s/<channel>/<id>); an entry with neither company nor
   role is rejected instead of filed as `unknown-role` (44 junk t-role
   reports came from exactly that path).
3. **Failed-entry skip flag** — `fail()` carries `rejected: true` in the
   SSE error payload; the server-side eval timer skips such pipeline
   entries instead of retrying every 2 hours (the timer script lives on the
   server outside the repo — the contract is documented here and in the
   spec per the fix prompt).
4. **post-qa-cleanup header-first SCORE** — auto-pipeline strips the
   SCORE_SUMMARY block before saving, so the summary-only check flagged
   every saved Telegram posting as junk (8 of 41 on prod carry header
   scores). `hasValidScore` reads `parseReportHeader` first; the summary
   block is the fallback. A report with neither score nor A–G blocks is
   junk.
5. **Map attribution** — `.leaflet-bottom.leaflet-right { bottom: 96px }`:
   the docs FAB covered the OSM attribution (licence requires it visible).
   RTL mirrors the FAB away; 390px cleared by the same offset.
6. **dash-chip contrast** — labels and `--manual` variant →
   `--foggy-strong` (≥4.5:1; dark ≈6.2:1).
7. **README ×18 language lines gained the missing Tamil entry** (18 flags;
   found during the language-list audit).
8. **CLAUDE.md / AGENTS.md / HANDOFF.md ×17 → ×18 sweeps.**

## Verification (real output)

- `npm run test:ci` → **5180 tests / 5177 pass / 0 fail** (new:
  `tests/auto-pipeline-jd-gate.test.mjs` +4 (t.me validation, channel
  fallback, example.com, real-report still saves),
  `tests/post-qa-cleanup-qa-garbage.test.mjs` +3 (header-score survives,
  no-score junk, dry-run mtimes), `tests/playwright-map.mjs` +1 (4-corner
  attribution), llm-routes coverage/hardening updated to the rejection
  contract, `qa-report-fixes` ETA contract updated to eval.eta).
- Red-without-fix verified for every fix (temporary reverts → red with the
  expected reason → restore → green).
- `test:coverage:gate` 98.16/89.38 · e2e 21/0 · browser + e2e:full green ·
  evals 12 pass · 0 fail · changelog parity ×18 · i18n audit clean ·
  CSS 799/800/797.
- Full browser sweep (prior local deploy): 1152 loads, 0 product errors.
- remote-qa live ar+ja: both lang ✓ + A–G ✓ (drift did not repeat).
- Prod: `/api/health` = `1.248.3`; smoke **15/15**; map attribution 4
  corners visible in light AND dark (elementFromPoint); app.css carries
  the 96px lift and the foggy-strong chip rule.

## Notes

- CodeQL review round: `post-qa-cleanup` URL matching moved to host
  extraction + strict equality (`isExampleUrl`), sweepLines/sweepReports
  read-first instead of existsSync pre-checks (TOCTOU), the JD-gate warning
  logs the host only (CI logs are public), unused import dropped.
- ar/ja drift: the regression-round re-run did not repeat it; lang-check ta
  and the SCORE parser hardening ship as defense-in-depth.
- Prod cleanup (CAR-61c) still awaits the explicit user yes — and with the
  header-first fix it can no longer delete the 8 real Telegram postings.
