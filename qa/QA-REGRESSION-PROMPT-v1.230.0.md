# QA regression sign-off — career-ops-ui v1.230.0

Parity release against parent **career-ops v1.32.0**. No new sources: the registry
stays at **90** (85 EN + 5 RU). Three provider fixes ported, one web-ui-only defect
found while porting, and three parent changes deliberately NOT ported.

Everything below is checkable. Where a claim rests on upstream measurement rather
than something you can reproduce here, it says so.

---

## §0 — Gates

```bash
npm run test:ci                       # 2962 pass, 0 fail  (was 2956, +6)
node --test tests/sources-radancy.test.mjs      # 17 (was 15)
node --test tests/sources-wttj.test.mjs         # 17 (was 13)
node --test tests/sources-greenhouse-offices.test.mjs
node scripts/check-changelog-parity.mjs         # 16 locales at v1.230.0, dates equal
```

The parity gate now compares the **date** as well as the version — it was extended
in v1.229.0 after that release shipped an EN date the 16 locales did not carry, and
passed clean anyway.

---

## §1 — What changed

| area | change | source |
|---|---|---|
| `wttj` | server-side Algolia `filters`; cap 200 → 1000 when filtered; `queries` optional with a filter | parent #3757 |
| `radancy` | truncation warning no longer driven by `data-total-results` | parent #3839 |
| `radancy` | random per-request cache-buster on every JSON fragment | parent #3839 |
| `greenhouse` | office lists sorted — both the `/offices` set AND web-ui's own `offices[0]` fallback | parent #3839 + web-ui-only |

---

## §2 — Manual pass

1. **wttj with a filter only.** Configure `wttj: { filters: 'offices.country_code:FR' }`
   and no `queries`. Expect a scan, not the "narrow it" error. Check the outbound
   Algolia body carries `filters=` and `query=` empty.
2. **wttj with neither.** `wttj: {}` must still throw — a global board must never be
   scanned by accident.
3. **radancy on a tenant whose banner overstates.** Scan any Radancy tenant to
   completion with generous `max_jobs`/`max_pages`. Expect **no** "truncated"
   line. Before this release a majority of tenants produced one.
4. **radancy on your own cap.** Set `max_jobs: 10`. Expect exactly one "truncated
   at 10 … (max_jobs/max_pages reached)" line — the case you can act on.
5. **greenhouse office ordering.** Scan a board whose jobs carry multiple offices
   twice. The `location` string must be byte-identical across runs.

---

## §3 — Invariants

- Registry still **90 / 85**: `/api/scan/sources` length, `ALL_ADAPTERS.length`.
- The cache-buster must be unique per **call**, not per page — `buildFragmentUrl`
  called twice for the same page must differ (pinned by test).
- `filters` longer than 1000 chars is refused before any request is sent.
- Radancy's `totalResults` may appear in the warning text; it must never decide
  whether the warning fires (pinned by test: the old condition fails it).

---

## §4 — Not ported, and why

- **iCIMS #3728** (read every `jobLocation` entry). web-ui's iCIMS reads the
  location from the **list page's** HTML and never opens a detail page, so the
  JSON-LD path that fix targets does not exist here.
- **`_http.mjs`** (`isRefusedRedirectError` extracted). A refactor for a second
  consumer — `discover-ats.mjs` — that web-ui does not have. `isRetryableError`'s
  behaviour is unchanged either way.
- **Location-aware dedupe #3751.** Lives in the parent CLI's `scan.mjs`
  scan-history pipeline; web-ui's scan route keeps its own.

---

## §5 — Upstream evidence not reproducible here

Two claims in the CHANGELOG rest on the parent's live measurements, not on
anything this repo can re-run:

- `data-total-results` overstating by 10–56% on 4 of 9 live tenants.
- A JSON-route cache replaying stale pages on careers.munichre.com, 9 runs of 9,
  fixed by a random parameter where `Cache-Control`/`Pragma` did nothing.

Both are recorded as upstream findings. What IS pinned here is the resulting
behaviour: the warning no longer keys off the banner, and the buster is fresh
per call.

---

## §6 — Sign-off

- [ ] `npm run test:ci` → 2962 / 0
- [ ] §2 manual pass on a real Radancy tenant and a real WTTJ filter
- [ ] README ×17 badges + banner at v1.230.0 / 2962
- [ ] CHANGELOG ×17 at v1.230.0, same date
- [ ] help ×17 untouched (source count unchanged)
- [ ] site changelog mirrors ×17 carry v1.230.0
- [ ] wiki Home banners ×17
