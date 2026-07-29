# QA Regression Prompt — v1.129.0 (scan seniority facet + freshness column)

> Minor release. Wires the v1.128.0 `job-facets.js` lib into the `#/scan` UI.
> Baseline: v1.128.0 (all green, 2066).

## What changed

- **Seniority filter** on `#/scan` — a dropdown that buckets each posting's
  title (lead/staff/senior/mid/junior/intern via `JobFacets.seniorityFromTitle`)
  and auto-populates from the current results (like the Country facet). Titles
  with no seniority word always pass. Round-trips through saved searches / Reset
  / Apply.
- **Seniority column** — a badge in the results table.
- **Age column** — zero-token freshness (`today` / `Nd`) from
  `JobFacets.daysSince(job.date)`; blank when the posting has no date.
- 12 new i18n keys ×17; +3 tests → **2069**.

## Sign-off checklist

- [ ] `npm test` — **2069** green.
- [ ] `node --test tests/scan-seniority-facet-v1129.test.mjs` — 3/3.
- [ ] `node --test tests/i18n-coverage.test.mjs` — every `t()` key mapped
      (the `senLabel()` literal-key lookup, not a dynamic `scan.sen.` concat).
- [ ] Manual: run a scan on `#/scan` → the **Seniority** dropdown lists the
      buckets present in results with counts; picking one filters the table;
      Reset clears it; a saved search restores it.
- [ ] Manual: results table shows a **Seniority** badge and an **Age**
      cell (`today` / `3d`) per row; dateless rows show a blank Age.
- [ ] Switch UI language → the Seniority labels + column headers localize
      (check EN + one RTL, e.g. ar).
- [ ] Help H2/H3 unchanged (29/105); CHANGELOG parity ×17 at 1.129.0.
- [ ] `/api/health` → `version 1.129.0`, `parentVersion 1.23.0`.
