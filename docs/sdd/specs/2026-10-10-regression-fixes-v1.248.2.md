# SPEC — Regression fixes: eval-timer junk, SCORE parser, tracker i18n, a11y — v1.248.2

- **Status:** Done (deployed, prod-verified)
- **Release:** v1.248.2 (PR, tag `v1.248.2`)
- **Related:** CAR-61…68 (the regression-round findings, all filed in Linear
  in Russian per the fix-prompt rules); base v1.248.1
- **Owner:** two agents (server+scripts / SPA+dicts, disjoint ownership) +
  orchestrator

## Goal

Close all eight findings from the v1.248.1 regression round.

## Scope

- **CAR-61a** `server/lib/routes/auto-pipeline.mjs`: JD gate 50 → 200 chars
  before the LLM call — placeholder pages end as SSE error + console warn,
  no `…-t-role-<ts>.md` report, no tracker row (42 junk reports on prod).
- **CAR-61b** `scripts/post-qa-cleanup.mjs`: dry-run by default; `--apply`
  removes ZZ-QA-TEST tracker rows, `*-t-role-*` reports without a valid
  SCORE (reuses `asciiNumber`), `example.com` pipeline entries — with
  automatic backups (`*.bak-<ts>`, reports moved to
  `qa/cleanup-backup-<ts>/`). 4 fixture tests.
- **CAR-61c** prod cleanup: dry-run shown, `--apply` awaits an explicit
  user yes (16 ZZ-QA-TEST rows incl. one Hired, 42 t-role reports,
  example.com pipeline entries).
- **CAR-62** `scripts/remote-qa/lang-check.mjs`: `ta: /[஀-௿]/u` + unit
  tests.
- **CAR-63** ar/ja eval drift: re-run **did not repeat** (both lang ✓ +
  A–G ✓) — closed with evidence; lang-check ta + SCORE hardening ship as
  defense-in-depth.
- **CAR-64** `eval-validate.mjs`: `asciiNumber` real formats («4,2/5»
  decimal, 3-digit thousands, «**4.2**», «SCORE :»); failed check logs only
  the `SCORE:` line. +4 tests, red-without-fix verified.
- **CAR-65** tracker statuses localized ×18 (display via `t()`, canonical
  untouched); `track.status.*` keys in every dict.
- **CAR-66** honest ETA «~2–4 min» ×18 (advisor.eta/eval.eta/stats.marketEta
  reconciled — evaluate renders `eval.eta`, deep/mode-page keep
  `advisor.eta`, stats uses `stats.marketEta`; UX-D-J + P4-ETA contracts
  updated) + subtitle A–G ×18.
- **CAR-67** contrast ≥4.5:1 (api-keys counter, pipeline counter); empty
  facet chip skipped.
- **CAR-68** Delete destructive-when-selected, EMAIL card no clip at 1440,
  live-evals pill spacing (RTL incl.), docs-FAB/Leaflet, help «?» nowrap,
  usage air, health name «career-ops-ui».

## Verification (real output)

- `npm run test:ci` → **5173 tests / 5170 pass / 0 fail** (first run had
  7 fails: the ETA key conflict between the two agents' contracts
  (eval.eta vs advisor.eta) reconciled, UX-A11 regexes updated A–F → A–G,
  and the Playwright headless-shell browser was missing in the cache —
  installed).
- `test:coverage:gate` → 98.17 % line / 89.42 % branch (307 files) ·
  `e2e` 21/0 · `e2e:browser` green · `e2e:full` green · evals 12 pass ·
  0 fail · i18n audit clean · snapshot regenerated (1514 keys).
- Full browser sweep (prior local deploy): 1152 loads, 0 product errors.
- remote-qa live ar+ja: **both lang ✓ + A–G ✓** (drift did not repeat).

## Notes

- The two agents share one worktree; agent A's intermediate stash briefly
  removed agent B's edits — all 27 files restored, `stash@{0}` kept as
  insurance until B's confirmation.
- Prod cleanup (CAR-61c) is gated on an explicit user yes; the dry-run
  plan precedes any `--apply`.
