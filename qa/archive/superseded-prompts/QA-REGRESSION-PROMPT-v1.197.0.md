# QA REGRESSION PROMPT — career-ops-ui **v1.197.0** (Getro auto-resolve `collection_id`)

**Added (scanner feature).** A tracked Getro board no longer needs a hand-looked-up numeric `getro_collection`. Give it an https `careers_url` and the numeric collection id **auto-resolves** from the board page: one SSRF-safe `safeGet` reads the `network.id` embedded in the page's `__NEXT_DATA__`. An explicit `getro_collection` still wins and skips the fetch entirely.

- **Under test:** `package.json` **1.197.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2527, exit 0 (capture $? directly, never | grep)
node --test tests/sources-getro.test.mjs    # 27 subtests
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.197.0
```

## §1 — Change (`server/lib/sources/getro.mjs` + adapter)

- New `httpsCareersUrl(entry)` — the board's own `careers_url`, normalized, **https only** (http/other/junk → null).
- New `extractCollectionId(html)` — matches `<script id="__NEXT_DATA__">` (tolerant of attr order, a CSP nonce, quote style; a `data-id="__NEXT_DATA__"` must NOT match), JSON-parses it → `props.pageProps.network.id`, accepts an all-digit positive id (number or string).
- New async `resolveCollectionId(entry, {safeGetImpl, signal})` — explicit id wins with **no** network; else `safeGet` the careers page (DNS-pinned, 6 MB cap, 15 s timeout), status 200 → `extractCollectionId`; any failure → `null` (fail-soft).
- `fetchGetro` now `await resolveCollectionId(...)`; throws only when **neither** a numeric `getro_collection` **nor** a resolvable https `careers_url` is present. The resolved id is still gated by `assertGetroUrl` (host-pinned `api.getro.com`).
- Adapter `matches` now accepts `provider: getro` with an https `careers_url` even without an id (never `careers_url` alone without `provider: getro`); `buildEndpoint` returns the careers_url as the informational probe endpoint when there's no explicit id.

## §2 — Behaviour

| entry | `resolveCollectionId` | notes |
|---|---|---|
| `{getro_collection: 4283, careers_url: …}` | `'4283'` | explicit wins, **no** `safeGet` call |
| `{careers_url: 'https://jobs.x/jobs'}` (page has `network.id`) | resolved id | one `safeGet`, then scans `…/collections/<id>/search/jobs` |
| `{careers_url: 'http://jobs.x'}` | `null` | non-https never fetched |
| `{careers_url: 'https://x'}` + 403 / no `__NEXT_DATA__` / throw | `null` | fail-soft; `fetchGetro` then throws a helpful error |
| `{name: 'x'}` (no id, no careers_url) | `null` | `fetchGetro` throws `/getro_collection/` |

- **SSRF:** the board-page fetch goes through `safeGet` (private/loopback rejected, redirects re-validated, size-capped); the API URL stays host-pinned to `api.getro.com` via `assertGetroUrl`.
- **Regression:** an explicit-id board scans exactly as before (0 `safeGet` calls); dedup / age-cutoff / dead-board contract unchanged.

## §3 — Docs-hygiene bundled

- The shipped v1.196.0 CHANGELOG/README example URL `evil.com` → RFC-2606 `example.com` (17 CHANGELOG + 17 README + site changelog). Functionally identical — both rejected by hostname. SSRF **test fixtures** under `tests/` keep the internal `evil.com` convention (invisible to users).

## §4 — Sign-off

Suite **2527** green (+5 net; +8 new getro subtests) · CHANGELOG parity ×17 at v1.197.0 · README badge+banner ×17 · site changelog synced · no `evil.com` in any public doc.
