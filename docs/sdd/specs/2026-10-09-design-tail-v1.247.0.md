# SPEC — Design sweep tail + full dark map — v1.247.0

- **Status:** Done (deployed, prod-verified)
- **Release:** v1.247.0 (PR #418 code+train, tag `v1.247.0`); CodeQL
  follow-up #421; site ta landing #419 (separate track, same day)
- **Related:** CAR-49…58 minors/polish; base v1.246.0
- **Owner:** design-tail agent (worktree v12470) + orchestrator

## Goal

Close every remaining minor/polish finding of the CAR-49…58 sweep and ship
the dark map the previous release deliberately deferred.

## Scope (21 items, headliners)

- **Dark map, complete**: the CSP `img-src` was legitimately extended with
  the Carto host (explicitly authorized this round — a server-side edit);
  the default dark mode renders **CSS-inverted OSM tiles** (keyless; Carto
  now gates its basemaps behind an API key — verified by request), a keyed
  Carto-dark preset ships via `MAP_TILE_DARK_URL`; the tile layer remounts
  live on theme flip (MutationObserver + matchMedia).
- `.callout--warn` dark variants + regression fix (`.callout a` overpowered
  `.btn-primary` → scoped `:not(.btn)`).
- Unified icon systems (CV header text-only; topbar stroke-SVG set; theme
  sun/moon drawn by CSS), empty states (pipeline preview,
  interview-digest, orientation), `UI.pageMeta` ⏱+cost pattern, config
  `displayPath()` (never absolute paths), LLM_PROVIDER 3-line helper,
  EMAIL nowrap, health overflow-wrap, help RTL code isolation, hero pill
  wrap, tracker tabs sentence case ×18, saved-search Delete `.btn-danger`.
- Full docs train: CHANGELOG ×18, README ×18, QA prompt v1.247.0,
  CONVENTIONS/PROJECT-CONTEXT, site facts.

## Verification (real output)

- `npm run test:ci` → **5116 tests / 0 fail**; new
  `tests/design-qa-v1247.test.mjs`, 27 contracts.
- Browser suites green; e2e 21/0; evals 12 pass · 0 fail · 2 worktree
  env-skips; site build green; CSS contracts 790/800/798.
- Prod (resumecraft.ru): smoke **15/15**; targeted map check — dark theme
  applies `invert(1) hue-rotate(180deg) brightness(.87) contrast(.88)
  saturate(.55)` to `.leaflet-tile`, light → `none`; zoom control
  `rgb(30,35,46)`.

## Notes

- The worktree needed its own `site/node_modules` (npm ci) — the first
  site build failed on a missing astro module, green after install.
- The capture scripts gained `ta` in `LOCALE_TO_FILE` (both dashboard and
  map); `dashboard-ta.png` captured.
