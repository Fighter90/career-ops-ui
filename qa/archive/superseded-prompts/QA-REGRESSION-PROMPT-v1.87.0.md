# QA REGRESSION PROMPT — career-ops-ui **v1.87.0** (4 new zero-auth scan providers)

Delta-focused regression for the **getonbrd / amazon / avature / successfactors** scan providers (registry **41 → 45 adapters**, 40 EN + 5 RU). Parent parity: career-ops **v1.16.0**. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.87.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates (all green)

```bash
npm test                                        # full suite (≥1594 cases)
node --test tests/sources-getonbrd.test.mjs     # 6/6
node --test tests/sources-amazon.test.mjs       # 8/8
node --test tests/sources-avature.test.mjs      # 7/7
node --test tests/sources-successfactors.test.mjs # 8/8
node --test tests/adapter-registry.test.mjs tests/scan-sources-endpoint.test.mjs
```

## §1 — What changed (verify each)

1. **Two-registry wiring** (the classic footgun). Each board needs BOTH: (a) `server/lib/sources/<slug>.mjs` with `export const meta = {value,label,region:'en'}` (auto-discovered → `#/scan` dropdown), and (b) `server/lib/portals/adapters/<slug>.mjs` in `ALL_ADAPTERS` (what the EN scanner walks to fetch). `resolveAdapter()` must route each.
2. **getonbrd** — board-wide public JSON:API, **provider-selected** (`provider: getonbrd`). Host-pinned `www.getonbrd.com`, paginated (`page=`), `redirect:'error'`.
3. **amazon** — `amazon.jobs` search JSON, host-detected (`amazon.jobs` careers_url) **or** `provider: amazon`. Offset-paginated.
4. **avature** — per-tenant `*.avature.net`, HTML-parsed (`<article class="article--result">`), host-detected or `provider: avature`. Endpoint host-pinned to the entry's own `api:`/`careers_url`.
5. **successfactors** — per-tenant SAP RMK tile list (`*.successfactors.eu/.com`, `jobs2web.com`), HTML-parsed (`parseTiles`/`cityFromSlug`), host-detected or `provider: successfactors`. `date` is always empty (RMK list carries none).
6. **Counts** — `ALL_ADAPTERS.length === 40`; sorted-id list + `/api/scan/sources` EN set both = 40 (add `amazon`, `avature`, `getonbrd`, `successfactors`); `GET /api/scan/sources` returns 45 total (40 EN + 5 RU).

## §2 — Footguns

- **Security envelope:** every provider is zero-auth, **host-pinned** (an `assert<Name>Url` guard that throws off-host/non-HTTPS), and fetches with `redirect:'error'` (SSRF). The adapter's `buildEndpoint` also pins overrides so an off-host value never reaches the fetch slot.
- **CI-isolated tests:** fake `fetchImpl` (`{ok,status,json|text}`) — **no network, no parent project**. Pagination-regex footgun: match `/[?&]page=/` (or `/[?&]offset=/`), never `/page=/` (collides with `per_page=`).
- **Job shape:** `{ id, title, company, url, salary, location, isRemote, workplaceType, relocates, date, snippet, source }`; unavailable fields `''`/`false`; `date` ISO `YYYY-MM-DD` or `''`.
- These are scan sources only — no i18n keys, no new routes, no CSP/SSRF surface beyond the guarded fetch. Help §17 adapter count now reads **45**.

## §3 — Sign-off

All §0 gates green · each new provider appears in `#/scan` **Source** dropdown and `resolveAdapter` routes it · `/api/scan/sources` lists 45 · host guards reject off-host.
