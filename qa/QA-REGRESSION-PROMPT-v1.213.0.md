# QA REGRESSION PROMPT — career-ops-ui **v1.213.0** (MyCareersFuture + Greenhouse/Ashby scan-quality fixes)

**Parity release (post-career-ops-1.28.0-tag delta).** One new source, two scan-quality fixes; one hardening deferred.

- **Under test:** `package.json` **1.213.0**. Registry **82** = 77 EN + 5 RU, `ALL_ADAPTERS` **77**.

## §0 — Gates

```bash
npm test                                                   # 2724, exit 0
node --test tests/sources-mycareersfuture.test.mjs         # 30 (new source)
node --test tests/sources-greenhouse-offices.test.mjs      # 9 (was 6: +withContent, +contentToText, +content=true→description)
node --test tests/sources-ashby.test.mjs                   # 7 (was 3: +Remote-append, +workplaceType-wins, +fallback, +no-dup)
node --test tests/adapter-registry.test.mjs tests/scan-sources-endpoint.test.mjs tests/scan-fallback-sources.test.mjs tests/site-sources.test.mjs   # gate lists incl. mycareersfuture (ALL_ADAPTERS 77)
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.213.0
```

## §1 — What changed

- **Added — MyCareersFuture (Singapore)** (`sources/mycareersfuture.mjs` + `adapters/mycareersfuture.mjs`). Public search API (`api.mycareersfuture.gov.sg/v2/search`), POST body + query-string pagination, `MAX_PAGE_SIZE=100`/`DEFAULT_MAX_PAGES=5`/`MAX_PAGES_CAP=20`. **SSRF:** job-detail URLs host-locked to `www.mycareersfuture.gov.sg` (no port/userinfo), `redirect:'error'`. Config-driven `keywords` with a profile-target fallback — **js-yaml is lazy-loaded** (`await import` inside async `resolveProfileKeywords`), so the module is import-safe for the Pages registry enumeration (the v1.212.0/.1 lesson). Wired across all 5 surfaces (registry, adapter-registry + scan-sources-endpoint sorted lists, FALLBACK_SOURCES, SOURCE_URLS).
- **Fixed — Greenhouse content-filtering.** `fetchGreenhouse` now requests `?content=true` and `normalize` sets `description = contentToText(j.content)` — double-decode the entity-escaped body, strip script/style + tags, re-decode, collapse whitespace, cap 4000. en-scanner's `content_filter` reads `j.description ?? j.snippet`; **no source shipped a `description` before**, so the filter was inert. Greenhouse is now the first.
- **Fixed — Ashby remote-in-location.** `formatLocation` appends `Remote` (when the role is remote and the location doesn't already say so) so a location_filter blocking the office city doesn't drop a remote role; `workplaceType` wins over `isRemote` (an `isRemote:true`+`workplaceType:"Hybrid"` office role is no longer labeled remote). `normalize`'s exported `isRemote` uses the same precedence.

## §2 — Manual browser pass

1. `#/scan` **Source** filter lists **MyCareersFuture** (offline FALLBACK + live `/api/scan/sources` agree — drift gate proves it).
2. `GET /api/scan/sources` returns **82**; the EN set includes `mycareersfuture`.
3. cvstart.org **Job sources** lists MyCareersFuture → mycareersfuture.gov.sg; count reads **82**.
4. A Greenhouse company with a `content_filter` set now filters on the posting body; a remote Ashby role shows "… · Remote" in its location.

## §3 — Invariants / security

- MyCareersFuture: only `api.mycareersfuture.gov.sg` is fetched; job-detail URLs host-locked to `www.mycareersfuture.gov.sg`, `redirect:'error'`. `PATHS.profile` read is read-only; js-yaml lazy-loaded (static gate `tests/site-sources.test.mjs` enforces no top-level third-party import).
- Greenhouse `content=true` stays host-pinned (same boards-api URL); the offices enrichment path is unchanged (uses the original `/jobs` URL). No new dependency, no new route, parent read-only contract intact.

## §4 — Not ported / deferred

- **DNS-rebinding guard** (parent `_ip-guard.mjs` + `_dns-cache.mjs` + `_http.mjs` AsyncLocalStorage) — validates a resolved address against loopback/RFC1918/link-local/cloud-metadata before connecting. **Deferred to a dedicated release:** web-ui uses per-call `fetchImpl` injection + host-pinning + `safeGet`, not the parent's global patched fetch, so it needs a web-ui-specific design (and careful loopback-scoping so the ~10 local-server tests keep working). Security-sensitive → its own well-tested ship.
- **verify-portals HTML-entity decode** — CLI-only, no web-ui surface.

## §5 — Sign-off

Suite **2724** green · new `sources-mycareersfuture` (30) · `sources-greenhouse-offices` 6→9 · `sources-ashby` 3→7 · gate lists carry `mycareersfuture` (`ALL_ADAPTERS` 77) · registry **82** = 77 EN + 5 RU · CHANGELOG parity ×17 at v1.213.0 · help §17 count **81→82 / 76→77 + anchor → v1.213.0** ×17 · OVERVIEW/API/CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed · site Sources.astro + rebuild (facts **82**) + wiki. Deploy: resumecraft rsync of the new source+adapter + `greenhouse.mjs` + `ashby.mjs` + `registry.mjs` + `scan-results.js`, restart. cvstart.org Pages rebuild (site/ changed).
