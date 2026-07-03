# Spec — Target-Roles Market Statistics (v1.86.0)

**Status:** in progress · **Date:** 2026-07-03 · **Release:** v1.86.0
**Ask:** "Статистика по целевым ролям" — market vacancy & salary statistics for the user's **target roles**, filterable by country, with salary-by-region charts and vacancy-count trends persisted over time.

## Requirements (from the user)

- **Target roles come from settings, not hard-coded** — read from `/api/profile` → `summary.target_roles` (which resolves `target.roles` / `target_roles.primary` in `config/profile.yml`).
- **Salary levels by region** — generated from the *sparse* data the system already collects (scan results), grouped by country/region (e.g. Russia and other countries).
- **Vacancy counts + dynamics** — counts per role/country, and a trend over time (so it must be **persisted**).
- **Hybrid data source** (approved): (a) persist snapshots aggregated from local scan data; (b) on-demand refresh.
- **All 16 locales.**

## Data source (honest, no fabrication)

The system's own local scan output is the source of truth — no invented market data:
- **Latest jobs:** `data/last-scan.json` (served by `GET /api/scan-results`) — each job has `title`, `company`, `location`, `salary` (display string), `isRemote`, `url`.
- **Target roles:** `GET /api/profile` → `summary.target_roles: string[]`.
- **Trend store (new):** `data/role-stats.jsonl` — one JSON snapshot per line, server-timestamped.

"Sparse" is expected: when there's little data, charts show what exists + a sample-size caveat; they never invent numbers.

## Architecture

```
public/js/views/stats.js  ──GET /api/stats/roles──►  server/lib/routes/stats.mjs
   (country filter, SVG      ──GET /api/stats/trend──►     └─ server/lib/role-stats.mjs (pure)
    charts, snapshot btn)    ──POST /api/stats/snapshot─►        parseSalaryUSD · detectCountry · aggregate
```

### `server/lib/role-stats.mjs` (pure, unit-tested)
- `parseSalaryUSD(str) → {min,max,currency}|null` — parse common salary strings (`$120k–150k`, `€90,000`, `100000 USD`, `₽300000`), best-effort; returns null when unparseable. Currency detected; USD-normalized `*_usd` via a small fixed FX table (documented as approximate).
- `detectCountry(location) → {code,name}` — free-text → country using a server-side alias table (ports the `countries.js` data into a shared `countries-data.mjs`); `remote` and `other` buckets.
- `aggregate(jobs, roles) → { generatedAt, totalJobs, perRole: [{ role, total, byCountry:{code:count}, salary:{count,minUsd,medianUsd,maxUsd} }], byCountry, salaryByCountry }` — matches each job to a target role by fuzzy title contains (reuse `role-matcher.mjs` if suitable), groups by `detectCountry`, and computes salary quartiles per country from parsed salaries.

### `server/lib/routes/stats.mjs` — `registerStatsRoutes(app)`
- `GET /api/stats/roles` — read last-scan + profile, return `aggregate(...)`. Empty-safe (no scan yet → `{totalJobs:0, perRole:[]}`).
- `GET /api/stats/trend?role=&country=` — return parsed `role-stats.jsonl` (filtered), for the trend chart.
- `POST /api/stats/snapshot` — compute current aggregate, append a compact snapshot (`{ts, totalJobs, perRole:[{role,total,medianUsd}], byCountry}`) to `data/role-stats.jsonl`. Server stamps `ts`. This is the only write; guarded like other writes.

### `public/js/views/stats.js` — `#/stats`
- Nav item "Statistics by target roles" (`nav.stats`).
- **Country filter** `<select>` (flags via `window.Countries`), plus "All".
- **Charts (inline SVG, no new deps):** (1) vacancy count by country (bar), (2) median salary by country/region (bar), (3) vacancy-count trend from snapshots (line). Each per selected role / all roles.
- **"Save snapshot"** button → `POST /api/stats/snapshot`, toast confirmation; trend chart refreshes.
- Empty states + sample-size caveats. Every string i18n-keyed in all 16 locales.

## Security / boundaries
- Reads parent files only through existing `PATHS`; the single write (`role-stats.jsonl`) lands in `data/` (this project's writable area), never parent CV/profile.
- No new runtime deps. SVG charts hand-rolled. CSP unaffected (no inline handlers; `addEventListener`).

## Testing
- `tests/role-stats.test.mjs` — unit: salary parsing (currencies, ranges, junk), country detection (aliases, remote, other), aggregate (grouping, quartiles, empty input).
- `tests/stats-routes.test.mjs` — integration: the 3 routes against `createApp()` with a fixture `last-scan.json` + `profile.yml` under `CAREER_OPS_ROOT=mktemp`; snapshot append + trend read round-trip.
- E2E: `#/stats` nav renders, country filter changes charts, snapshot button posts.
- Coverage ≥ 80% on `role-stats.mjs`.

## Out of scope (later)
- Live external market APIs (we aggregate local scan data; a full scan is still triggered from the Scan page).
- Historical back-fill before the first snapshot.
