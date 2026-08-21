# QA REGRESSION PROMPT — career-ops-ui **v1.212.0** (Job Bank (Canada) + Consider/Lever fixes; EchoJobs retired)

**Parity release (career-ops 1.28.0).** One new source, one retired source (net-zero on the registry count), two scan-quality fixes, gentler pacing.

- **Under test:** `package.json` **1.212.0**. Registry **81** = 76 EN + 5 RU, `ALL_ADAPTERS` **76** — **unchanged** (Job Bank in, EchoJobs out), so help §17 / OVERVIEW / API adapter counts are untouched by design.

## §0 — Gates

```bash
npm test                                                   # 2685, exit 0
node --test tests/sources-jobbankca.test.mjs               # 24 (new source)
node --test tests/sources-consider.test.mjs                # 21 (CSRF handshake)
node --test tests/sources-lever.test.mjs                   # 3  (new — allLocations merge)
node --test tests/sources-parity-v1118b.test.mjs           # 58 (echojobs retired from the batch)
node --test tests/adapter-registry.test.mjs tests/scan-sources-endpoint.test.mjs tests/scan-fallback-sources.test.mjs tests/site-sources.test.mjs   # gate lists: jobbankca in, echojobs out
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.212.0
```

## §1 — What changed

- **Added — Job Bank (Canada)** (`sources/jobbankca.mjs` + `adapters/jobbankca.mjs`). Zero-token public ATOM feed for Canada's federal national employment service. Config-driven `keywords` with a fallback to the profile's target roles (like `vdab`). **SSRF:** host-pinned to `www.jobbank.gc.ca` (HTTPS-only, `assertJobBankUrl` on the feed URL *and* every paginated URL, `redirect:'error'`). First source to import `PATHS` (read-only, for the profile fallback). Ports the parent's security-conscious `<link rel>` attribute-tokenization ATOM parser. Wired across all 5 surfaces (registry, adapter-registry + scan-sources-endpoint sorted lists, `FALLBACK_SOURCES`, `SOURCE_URLS`).
- **Removed — EchoJobs** (`sources/echojobs.mjs`, `adapters/echojobs.mjs`, `tests/sources-echojobs.test.mjs` deleted; un-wired from the registry, both gate tests, the SPA fallback list, `Sources.astro`, and `sources-parity-v1118b.test.mjs`). Its public feed is now behind bot protection and returns nothing.
- **Fixed — Consider boards return results again.** `sources/consider.mjs` now performs an anonymous CSRF handshake before the search POST: a `GET {origin}/jobs` (browser-like UA) that seeds a session cookie (`res.headers.getSetCookie()`) + a `csrfToken` scraped from the HTML, spread as `cookie` + `x-csrf-token` into the `POST /jobs` headers. Degrades fail-soft (`{cookie:null, csrfToken:null}`) so a handshake miss doesn't throw. Test seam via injectable `fetchImpl` (GET answered as calls[0], POST as calls[1]).
- **Fixed — multi-location Lever roles no longer hide half their locations.** `sources/lever.mjs` merges `cats.location` (primary) with `cats.allLocations` (deduped, ` · `-joined) instead of `loc || allLocs`. A role open in Barcelona **and** Montevideo now shows both — and isn't wrongly dropped by a location filter.
- **Notes — pacing.** `INTER_PAGE_DELAY_MS` 150→250 in `eightfold`/`oraclecloud`/`tencent`, to stay polite to single-host careers sites.

## §2 — Manual browser pass

1. `#/scan` **Source** filter lists **Job Bank (Canada)** and no longer lists **EchoJobs** (offline `FALLBACK_SOURCES` + live `/api/scan/sources` agree — the drift gate proves it).
2. `GET /api/scan/sources` returns **81**; the EN set includes `jobbankca` and excludes `echojobs`.
3. cvstart.org **Job sources** links Job Bank (Canada) → jobbank.gc.ca; EchoJobs chip is gone.
4. A Consider-powered company (e.g. a `provider: consider` portal) scans to non-empty results.
5. A multi-location Lever role renders every city in its location cell.

## §3 — Invariants / security

- Job Bank: only `www.jobbank.gc.ca` URLs are fetched (host-pinned, HTTPS-only, `redirect:'error'`); `assertJobBankUrl` guards both the feed URL and each paginated URL.
- Consider handshake fetches only the board's own `{origin}/jobs` (same origin as the POST) with `redirect:'error'`; no arbitrary-host fetch introduced.
- No new dependency, no new write route, parent read-only contract intact. `PATHS` import in jobbankca is read-only (profile target-role fallback).

## §4 — Not ported (already covered / deferred)

- **Deferred** — the anchored-keyword `word:` prefix matcher (parent `title-keywords.mjs`, ~170 LOC + ~380-line test). Opt-in scan-quality feature, cleanly separable → its own future release.
- **ashby retry/Retry-After fix** — web-ui's ashby is single-fetch (no manual retry loop), so it never re-probes a permanent 404/410; the fix's main goal is already met. `secondaryLocations` merge shipped v1.75.0.
- **`_trust-validator` asciiFold extraction to `lib/ascii-fold.mjs`** — web-ui keeps the fold logic inline in `trust-validator.mjs` (shipped v1.211.0); a refactor with no behavioural delta.
- **`_http.mjs` partial-HEAD fetch utility** — no web-ui consumer.
- **hackernews AI enhancement** — CLI-only (no web-ui surface).
- **pacing for avature/getro/icims/themuse/workday** — web-ui doesn't page those at 150 ms.

## §5 — Sign-off

Suite **2685** green · new `sources-jobbankca` (24) · `sources-consider` 21 (CSRF handshake) · new `sources-lever` (3) · `sources-parity-v1118b` 58 (echojobs retired) · gate lists (adapter-registry / scan-sources-endpoint / FALLBACK / SOURCE_URLS) carry `jobbankca`, not `echojobs` · registry **81** = 76 EN + 5 RU (`ALL_ADAPTERS` 76) — **unchanged** · CHANGELOG parity ×17 at v1.212.0 · help §17 **untouched** (count unchanged, anchor stays v1.211.0 — historically accurate) · CONVENTIONS/PROJECT-CONTEXT refreshed · site `Sources.astro` + wiki (version + tests only; adapter count unchanged; Scanner-Providers: +jobbankca row, echojobs marked retired). Deploy: resumecraft rsync of the new source+adapter + `consider.mjs` + `lever.mjs` + `eightfold/oraclecloud/tencent.mjs` + `registry.mjs` + `scan-results.js` (and delete the 2 echojobs server files), restart. cvstart.org Pages rebuild (site/ changed).
