# SPEC — Relevance-first commute map — v1.249.0

- **Status:** Complete
- **Release:** v1.249.0 (planned PR and tag)
- **Related:** upstream career-ops PR #4835; `career-ops-plugin-commute` v0.2.0; ADR-0002
- **Owner:** orchestrator

## Goal

Turn the job map into a relevance-first decision surface: strong jobs attract
attention, weak jobs recede, score and commute filters are persistent, the
tracker shares commute filtering, and a phone retains a usable map with a
tap-to-peek interaction.

## Context

The upstream commute plugin is merged and writes `data/commute.tsv`; its public
configuration lives at `config/plugins.yml → plugins.commute`. The UI previously
used bright red for weak jobs, had no score or commute filtering, put map chrome
over much of a phone viewport, and treated a marker tap as immediate navigation.

## Scope

1. Read the upstream plugin contract without depending on its implementation.
2. Serve a privacy-bounded, no-store `GET /api/commute` projection and join it
   by the same canonical posting-URL algorithm in server and browser code.
3. Add score, unevaluated, commute, unknown-commute and layer filters with local
   preferences, Reset and explicit Fit results.
4. Replace semantic red/yellow/green markers with a sequential teal-to-grey
   relevance palette; style clusters from their best visible job.
5. Add the configured home marker, but never include it in jobs, clusters,
   filters or counts.
6. On coarse pointers, open one bottom sheet as a marker peek (company + title,
   score/fit and commute); a second card tap navigates. Desktop retains hover
   tooltips and direct marker navigation.
7. Add tracker location/drive columns plus commute filter and sort, sharing the
   commute preferences with the map.
8. Add all new strings to all 18 locale dictionaries.

## Out of scope

- Running the router, geocoder or commute refresh from the UI.
- Editing plugin settings or exposing router/email configuration.
- Changing the parent career-ops repository or requiring the Fighter90 fork.
- Automatically reframing the map when a filter changes.

## Acceptance criteria

1. `tests/commute-api.test.mjs` proves TSV/config parsing, canonical joins,
   parent-root isolation, `no-store`, and the privacy projection.
2. `tests/client-url-key.test.mjs` proves server/browser URL-key parity.
3. `tests/map-prefs.test.mjs` proves defensive persistence and Reset.
4. `tests/map-relevance-controls.test.mjs` locks filters, mobile sheet/peek,
   relevance palette, best-job clusters and tracker integration.
5. `tests/map-layer-stats.test.mjs` remains green: the home marker never enters
   job counts and active-layer denominators remain consistent.
6. `npm run test:ci` and `npm run test:e2e:browser` pass; where no browser binary
   exists, the skipped browser gate is recorded explicitly rather than claimed.

## Plan

1. Add red tests for the upstream contract, URL identity and preferences.
2. Implement the read-only server adapter and endpoint.
3. Implement shared browser helpers and tracker integration.
4. Rework the map controls, rendering, clusters and coarse-pointer flow.
5. Add responsive CSS and 18-locale strings.
6. Run focused gates, full CI, browser QA and release-surface checks.

## Risks and invariants touched

- **R-01/R-02:** only declared parent files are read and every test uses a temp
  `CAREER_OPS_ROOT`.
- **R-07:** job data is inserted with `textContent`/`UI.el`; the one static home
  glyph contains no data; CSP is unchanged.
- **R-08:** locale key-set parity, snapshot and audit gates cover new strings.
- **R-09:** package version, changelogs, README badges, site mirrors and QA prompt
  move together.
- The map source assertions are intentionally weak structural gates; the
  opt-in Playwright map suite remains the behavioural browser gate.

## Verification

- `env -u OPENROUTER_API_KEY npm run test:ci`: **5210 tests, 5202 pass,
  0 fail, 8 skip**; changelog parity and the 1534-key × 18-locale audit pass
  with no hard failures.
- `env -u OPENROUTER_API_KEY npm run test:coverage:gate`: the new commute
  adapter is at **100% line / 91.80% branch / 100% function** coverage and the
  repository coverage floor passes.
- `node evals/workflow/run.mjs`: **12 pass, 0 fail, 2 environment skips**.
- `npm run test:e2e:browser`: **2 pass, 0 fail, 128 skip** because the local
  package does not resolve Playwright. The installed `playwright-cli` was used
  for an isolated real-browser check instead: desktop controls and persistence
  passed; at 390 × 844 the map remained 730 px tall, the compact peek stayed
  inside the viewport, hid filter controls, showed company/title plus commute,
  and the first marker tap did not navigate.
