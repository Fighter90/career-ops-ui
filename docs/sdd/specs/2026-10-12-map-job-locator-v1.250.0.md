# SPEC — Map: job locator + text search — v1.250.0

- **Status:** Done (deployed, prod-verified)
- **Release:** v1.250.0 (PR, tag `v1.250.0`)
- **Related:** owner request after the v1.249.0 commute map («everything is
  in one place and jumbled»); CAR-70 stays closed (accepted limitation)

## Goal

On `#/map` the located jobs were reachable only by hunting circles around
the Home marker. Add a job SELECT (locator) and a text SEARCH so the page
is workable directly. Drive-time MILES are explicitly deferred to the next
release (owner).

## Scope

1. **Job locator** — a `.job-map-toolbar` above the map carries a select
   listing the currently VISIBLE (post-filter) jobs sorted by
   company+title; choosing one flies to its circle (zooming to
   SPREAD_ZOOM so clusters separate), finds the drawn layer via a
   `__job` back-reference (NOT `_point` — L.Circle owns that property)
   and opens the peek — ALWAYS, desktop included (the locator's purpose
   is «show me this job», navigating would defeat it). render() rebuilds
   the options every pass, so the select mirrors the filters.
2. **Text search** — a search input in the same toolbar narrows
   `passes()` by company+title substring (case-insensitive matching,
   raw-case persistence), persisted in map-prefs `q` (both loadMap and
   loadMapValue — the writer sanitizes through loadMapValue). Reset
   clears it; the locator's options narrow with the visible set.
3. **Layout** — the docs FAB is hidden on `#/map` at every width (it
   covered the Leaflet attribution's bottom-right corner once the
   toolbar shifted the map); the mobile map floor in the two height
   specs moves 600 → 540 (the toolbar legally takes ~90px).
4. **i18n** — 4 new keys × 18 dictionaries; the assembled-dict snapshot
   regenerated; i18n-audit clean.

## Verification (real output)

- `npm run test:ci` → **5245 tests / 5242 pass / 0 fail** (new: 2 locator/
  search browser specs; map-prefs q coverage extended).
- `npm run test:e2e:browser` → **129 pass / 0 fail**.
- coverage gate green · e2e 21/21 · evals 12/0 · link-check green.
