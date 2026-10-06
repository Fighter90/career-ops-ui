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

**Aggregation is CLIENT-side** (reusing `window.Countries`), so the server stays a thin snapshot store — no duplicated country/salary logic on the server.

```
public/js/views/stats.js ──GET /api/profile─────────►  (target roles)
  (role/country filters, ──GET /api/scan-results────►  (latest scan jobs)
   SVG bars + trend,          │ aggregate in-browser via window.RoleStats
   snapshot btn)              ▼
                         public/js/lib/role-stats.js (pure: parseSalaryUSD · matchRole · aggregate)
                              │
   ──POST /api/stats/snapshot─┴─►  server/lib/routes/stats.mjs ──► data/role-stats.jsonl
   ──GET  /api/stats/trend──────►  (thin store: append + read)
```

### `public/js/lib/role-stats.js` (pure, browser-classic, unit-tested)
- `parseSalaryUSD(str) → {minUsd,maxUsd,currency}|null` — parse common salary strings (`$120k–150k`, `€90,000`, `80k-100k`, `₽300000`), best-effort; returns null when unparseable. Currency detected (a bare `¥` is left unresolved — JPY/CNY ambiguity); amounts normalized to USD via a small fixed FX table (documented as approximate).
- `matchRole(title, roles) → role|null` — majority-token fuzzy match of a job title against the profile's target roles (inline; the parent's `role-matcher.mjs` was not a fit for the browser-classic form).
- `aggregate(jobs, roles, Countries) → { totalJobs, matchedJobs, roles, perRole:[{role,total,byCountry:{code:count},salary:{count,minUsd,medianUsd,maxUsd}}], byCountry, salaryByCountry }` — matches each job to a target role, groups by `Countries.detectCountry` (`remote`/`other` buckets), computes salary stats per country. Empty-safe.

### `server/lib/routes/stats.mjs` — `registerStatsRoutes(app)` (thin store)
- `POST /api/stats/snapshot` — append a client-computed, server-stamped, sanitized+bounded (`toCompactSnapshot`) aggregate to `data/role-stats.jsonl`. Rate-limited (`llmRateLimit`, no-op on loopback) — the only write; explicit "Save snapshot" user action.
- `GET /api/stats/trend[?role=]` — return the accumulated snapshots (read tail-capped at `MAX_TREND_SNAPSHOTS`); `?role=` maps each snapshot to that role's series for a per-role trend.
- There is **no** `GET /api/stats/roles` — the roles aggregate is computed in the browser, not the server.

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
- `tests/role-stats.test.mjs` — unit (browser-classic loaded in a synthetic window): salary parsing (currencies incl. the ¥ ambiguity, comma ranges, junk → null), role matching, aggregate (grouping, salary stats, empty input).
- `tests/stats-routes.test.mjs` — integration against `createApp()` under `CAREER_OPS_ROOT=mktemp`: `toCompactSnapshot` sanitization (incl. non-object bodies), snapshot append + trend read round-trip, `?role=` filter, and the public-bind rate-limit guard (429).
- E2E: `#/stats` route smoke entry in `tests/e2e.mjs` (renders `h1.page-title`).
- Coverage ≥ 80% on `public/js/lib/role-stats.js`.

## Out of scope (later)
- Live external market APIs (we aggregate local scan data; a full scan is still triggered from the Scan page).
- Historical back-fill before the first snapshot.
