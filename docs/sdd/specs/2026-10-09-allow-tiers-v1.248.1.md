# SPEC — location_filter always_allow / block_hard tiers — v1.248.1

- **Status:** Done (deployed, prod-verified)
- **Release:** v1.248.1 (PR #424, tag `v1.248.1`); CodeQL follow-up #421
  preceded it
- **Related:** CAR-60; base v1.248.0; parent scan.mjs #652/#4549 lineage
- **Owner:** orchestrator

## Goal

Close CAR-60: give web-ui's `location_filter` the parent's `always_allow`
and `block_hard` tiers so a multi-country location string survives a
blocked-sibling list while an explicit hard block stays unrescuable.

## Scope

- `server/lib/location-filter.mjs::buildLocationFilter` — tier order:
  `block_hard` match → reject; `always_allow` match → pass; `block` match →
  reject; `allow` empty → pass; non-empty → ≥ 1 keyword. `strict` counts
  `block_hard` as a restricting tier. Matching stays case-insensitive
  substring (web-ui idiom).
- `tests/location-filter.test.mjs` +5 tier tests; the workable consumer
  test now runs **in the parent's own form** (block siblings + always_allow
  home region), the interim allow-list form kept as a second verdict.
- `docs/help` ×18: both tiers documented in the location_filter semantics
  list (8 locales had wrapped block bullets — orphan continuations
  re-joined after insertion).
- README ×18: language-switcher lines gained the missing **Tamil** entry
  (18 flags; the v1.245.0 fan-out updated badges/changelogs but missed the
  picker lines; ta.md already carried the full line).
- CLAUDE.md / AGENTS.md / `docs/sdd/HANDOFF.md`: ×17 → ×18 sweeps.
- Docs train: CHANGELOG ×18, QA prompt v1.248.1, CONVENTIONS/PROJECT-
  CONTEXT (5136), site facts.

## Deliberate no-ports (this release)

- The parent's word-boundary location keyword compiler
  (`compileLocationKeyword`) and its USPS state-name table: web-ui keeps
  case-insensitive substring matching; the table serves US-centric configs.
  Filed under CAR-60 for a future US-config need.

## Verification (real output)

- `npm run test:ci` → **5144 tests / 5136 pass / 0 fail** (first run in the
  fresh worktree failed 957 — missing `node_modules`; green after `npm ci`).
- `node --test tests/location-filter.test.mjs` → 16/16;
  `tests/sources-workable.test.mjs` → 26/26.
- e2e 21/0 (worktree needed the `node_modules/playwright` symlink — same
  devDep-outside-repo arrangement as prior worktrees).
- evals **12 pass · 0 fail · 2 skip** (first run failed
  `no-blanket-version-sweep`: the baselines step had been skipped when the
  fan-out chain broke — real gap, fixed: CONVENTIONS v1.248.1: 5136,
  PROJECT-CONTEXT head 5130 → 5136).
- Site build 91 pages; prod `/api/health` = `1.248.1`; smoke **15/15**;
  Pages success.

## Full-functional browser sweep (same day, against the v1.247.0 local deploy)

1152 page loads (32 views × 18 locales × light/dark): **0 broken images,
0 flow failures, 0 product console errors** (126 console entries = the
sweep's own basic-auth header on third-party font requests), **0 true raw
i18n keys** (576 regex hits were file names, domains, help examples and the
by-design `CODE.activity-raw-slug` mono tails); functional flows
(en/ru/ar/ta): nav-all-views, scan controls, tracker tabs, CV editor,
theme toggle, lang switch, help TOC, map theme flip, config toggle,
health — 0 failures.
