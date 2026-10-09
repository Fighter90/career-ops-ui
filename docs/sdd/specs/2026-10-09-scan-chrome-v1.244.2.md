# SPEC — Scan chrome polish + results-table hardening — v1.244.2

- **Status:** Done (deployed, prod-verified)
- **Release:** v1.244.2 (PR #413, tag `v1.244.2`)
- **Related:** CAR-46 (scan polish), CAR-47 (row stretching); base v1.244.1
- **Owner:** scan-polish agent + orchestrator

## Goal

The `#/scan` chrome reads as one consistent control surface, and board-side
data can no longer stretch the results table.

## Context

After v1.244.0's redesign the launcher was a loose row, the reposts panel
rendered a 155,000-px body for a 1,560-cluster dataset, and boards could put
a benefits blurb into the salary field (6-line cells on every row).

## Scope

- `public/js/views/scan.js` + `public/css/components.css`: launcher card
  (aligned control row, dominant primary), terminal status bar (state dot
  idle/running/done/error, reduced-motion safe), capped reposts disclosure
  with sticky header, filters grid.
- `public/js/lib/scan-results.js`: `salaryHead()` (money range only, blurb →
  tooltip), empty-title → company + dash, seniority nowrap, muted «◎ —» for
  unscored rows.
- `tests/scan-redesign-layout.test.mjs`: aux-height contract measures the
  content element (`td.scan-cell-aux > *`), not the stretching td.

## Incident & recovery (recorded per PROGRESS.md)

An rsync overlay from the corrupted v12440 worktree silently clobbered the
uncommitted scan-polish work. Recovered byte-exact from the **opencode
snapshot store** (content-addressed git blobs): located the tree whose
components.css blob carries the polished chrome (`3c3ef56c`) and extracted
five files. Pre-commit review findings closed in the follow-up commit
(README hrefs ×17, CHANGELOG↔code claim, max-per-source label, it locale
copy, PROGRESS status).

## Verification (real output)

- `npm run test:ci` → at ship: **5067 tests, 5066 pass, 0 fail** (the
  5045→5060→5067 intermediate counts reflect the salvage dance).
- `npm run test:e2e:browser` → green; layout contracts 5/5 (aux one-line).
- `node evals/workflow/run.mjs` → **14 pass · 0 fail** (after the QA-prompt +
  baselines fix: the first run failed `qa-prompt-mandatory` and
  `no-blanket-version-sweep` — both were real doc-train gaps, fixed).
- Prod (resumecraft.ru): `/api/health` = `1.244.2`; Playwright smoke
  **15/15**; targeted checks — `.scan-terminal` ✓, `.scan-launcher` ✓,
  `.reposts` ✓, salary cells one-line ✓.
- Site build: 86 pages, green.

## Notes

- CHANGELOG history restoration: the salvage had dropped `## [1.244.1]` /
  `## [1.244.0]` from 14 locale files — restored from HEAD before merge
  (the parity gate only checks the newest entry, it cannot see this).
