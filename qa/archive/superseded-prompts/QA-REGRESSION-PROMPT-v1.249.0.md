# QA regression — v1.249.0 (relevance-first commute map)

> Baseline: v1.248.7 → v1.249.0.

## §0 — Gates

```bash
npm run test:ci
npm run test:coverage:gate
npm run test:e2e
npm run test:e2e:browser
npm run test:e2e:full
node evals/workflow/run.mjs
```

## §1 — Commute contract and privacy

1. With `career-ops-plugin-commute` v0.2.0 data, `/api/commute` joins records
   to scan/map/tracker rows whose URLs differ only by tracking parameters.
2. The response is `Cache-Control: no-store` and contains only home coordinates,
   max minutes and safe per-job fields. It never exposes router URLs, email or
   other plugin settings.
3. With no plugin/config/data, map and tracker still load and commute controls
   disappear without an error.

## §2 — Relevance and filters

1. Highest-scoring jobs are the largest, strongest teal markers; lower scores
   progressively recede to grey. Weak jobs are not bright red.
2. Score choices are All, 3.0+, 3.8+ and 4.2+; unevaluated is independently
   visible by default and can be hidden.
3. Commute ceilings include the profile maximum plus 30/45/60/90; unknown
   commutes remain visible by default and can be hidden independently.
4. Filter changes do not pan or zoom. “Fit results” reframes explicitly.
5. Reset restores all layers and inclusive defaults. Reload preserves choices.
6. A cluster shows its best visible score/fit plus total, and uses that job's
   relevance colour. The home marker is neutral and never changes counts.

## §3 — Phone interaction (320, 390 and 430 px)

1. The map occupies the usable viewport; only the visible/total chip and Filters
   button float over it. Filters use one bottom sheet with 44 px controls.
2. Tapping a job marker opens the sheet as a peek with company + title,
   score/fit and commute; it does not navigate on the first tap.
3. Tapping the peek card navigates. Closing or tapping the map dismisses it.
4. The selected marker is panned above the sheet and attribution stays visible.

## §4 — Desktop and tracker

1. Desktop marker hover still peeks; marker click navigates directly.
2. The horizontal toolbar remains outside the map and does not cover data.
3. Tracker shows Location and Drive when commute data exists, supports commute
   sort/filter, flags drives over the configured profile maximum, and shares
   saved commute choices with the map.

## §5 — Sign-off

- [ ] gates green · [ ] privacy projection checked · [ ] desktop checked ·
  [ ] 320/390/430 px checked · [ ] tracker checked · [ ] all 18 locales smoke
