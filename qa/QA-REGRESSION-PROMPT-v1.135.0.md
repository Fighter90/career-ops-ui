# QA REGRESSION PROMPT — career-ops-ui **v1.135.0** (parent career-ops v1.26.0 parity)

Delta regression for **5 new scan sources** + 4 provider correctness fixes. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.135.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                          # full suite — 2306, exit 0 (capture $? directly, never | grep)
# new sources
node --test tests/sources-join.test.mjs tests/sources-joinup.test.mjs tests/sources-getro.test.mjs tests/sources-consider.test.mjs tests/sources-remotli.test.mjs
# provider fixes
node --test tests/sources-a16z-speedrun-talent.test.mjs tests/sources-hackernews.test.mjs tests/arbeitsagentur-remote.test.mjs tests/sources-thehub.test.mjs tests/http-json.test.mjs tests/sources-config-providers.test.mjs
# registry + drift gates
node --test tests/adapter-registry.test.mjs       # ALL_ADAPTERS.length === 73, sorted ids incl. the 5 new
node --test tests/scan-sources-endpoint.test.mjs  # EN set (73) incl. join/joinup/getro/consider/remotli
node --test tests/scan-fallback-sources.test.mjs  # FALLBACK_SOURCES value parity with the registry (78)
node --test tests/site-sources.test.mjs           # SOURCE_URLS covers every registry value
node scripts/check-changelog-parity.mjs           # all 16 locales at v1.135.0
```

## §1 — What changed

Parent **v1.26.0** parity. Registry now **78 sources = 73 EN + 5 RU** (`ALL_ADAPTERS` 73).

**5 new sources** (each source + adapter + CI-isolated suite):
1. **`join`** (JOIN) — `join.com/companies/<slug>` Next.js `__NEXT_DATA__` scrape, host-pinned, page-capped; detected from a join.com careers URL.
2. **`getro`** (Getro) — VC portfolio boards via `api.getro.com/api/v2/collections/{id}/search/jobs` POST; explicit `getro_collection:` id; jobs attributed to the portfolio employer.
3. **`consider`** (Consider) — getconsider.com boards via same-origin `/api-boards/search-jobs` POST; **structural SSRF guard** on the config-driven host (public HTTPS only — rejects IP-literals/loopback/`*.internal`).
4. **`joinup`** (JOINUP) — joinup.ch SSR newest-page scrape; fail-closed on a scraper break.
5. **`remotli`** (Remotli) — remotli.ch `?remote=all` JSON; emits the employer's own ATS `applyUrl` (cross-listings dedup) + CHF salary string.

**4 provider fixes** (boards web-ui already carries):
- **a16z Speedrun** — transient-failure retry (new shared `fetchJsonWithRetry`, 429/5xx/timeout only, never a 4xx) so a mid-sweep blip no longer aborts the whole board; page budget `DEFAULT_MAX_PAGES` 3→6, `MAX_PAGES_CAP` 120→1000.
- **arbeitsagentur** — v6 Jobsuche API (`/pc/v6/jobs`; `ergebnisliste`/`referenznummer`/… shape; `filter` mode narrows server-side, no detail-endpoint calls).
- **thehub** — v2 `jobsandfeatured` API; posting URLs rebuilt from the job id; rows carry no date (exempt from the age filter).
- **hackernews** — Algolia lookup by the `author_whoishiring` account tag, not a free-text query.

## §2 — Manual browser pass

1. **`#/scan` Source filter** — the dropdown lists **JOIN, Getro, Consider, JOINUP, Remotli** (offline FALLBACK + live registry). Chip count / source list reflects **78**.
2. **`#/portals` health** — unchanged contract: a genuinely-down board shows a real failure; a16z no longer reads as an empty board after a transient blip.
3. **cvstart.org landing** (after Pages redeploy) — the Job-sources section shows **78** sources incl. the 5 new chips (join.com / getro.com / getconsider.com / joinup.ch / remotli.ch).
4. No new UI strings / i18n keys (source labels are data) — nothing else in the chrome changes.

## §3 — Contract & security invariants

- **SSRF:** join (join.com), getro (api.getro.com), joinup (joinup.ch), remotli (remotli.ch API URLs) are host-pinned, HTTPS-only, `redirect:'error'`. **consider** pins a config-driven host with a structural guard (public registrable https origin only). remotli's emitted `applyUrl` is display-only (any https origin, never fetched) — the host lock stays on the API URLs.
- **Dead-board-throw:** every new source THROWS when nothing resolved (page-0 / single request), keeps partials on a later-page failure (`succeededOnce`). a16z's retry sits *inside* that contract (retries exhaust → page-0 throws, later-page keeps partials).
- **Read-only / in-process:** no new writes; the EN/RU scanners still run in-process.
- **Registry parity:** the 5 gate lists (adapter-registry ids, scan-sources EN set, `FALLBACK_SOURCES`, `SOURCE_URLS`, `http-json` retry tests) all include the new sources / helper.

## §4 — Not ported (parent parity note)

- Unicode role-dedup / company-key #2569 / #2587 / #2429: web-ui's `detect-reposts` already keys company on a plain lowercase (non-Latin-safe); `trust-validator`'s ASCII heuristic degrades to "no flag", never a silent merge; role-token collapse matches the parent's deliberate out-of-scope decision.
- followup rejection-latency #2014 + `company-funded` touch-ups: relay-absorbed (fail-soft), no code change.
- scan env-paths #2568 / `--flag=value` #2589: web-ui runs scanners in-process, no CLI surface.
- UA-consolidation refactor #2536 (oraclecloud/vdab/jobspresso): no-op — web-ui already centralizes `BROWSER_LIKE_USER_AGENT`.
- CLI-only: untrusted-content roster #2521, oferta/offer-prep, doctor, cover/cv template changes, YC-seed paging, `.gitattributes`, and the parent's own Next.js `web/` changes.

## §5 — Sign-off

All §0 gates green (**2306**, exit 0) · 5 new sources in the `#/scan` Source filter + on the landing (78 sources) · a16z transient-retry keeps the board · arbeitsagentur v6 / thehub v2 / hackernews whoishiring live · registry + drift gates green · SSRF host-pinning (+ consider structural guard) intact · no new i18n keys · CHANGELOG parity ×17.
