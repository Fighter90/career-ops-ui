# QA REGRESSION PROMPT — career-ops-ui **v1.219.0** (Torre source + a16z fix + provider-label consistency)

**Parent-sync + provider-consistency release.** Adds the Torre scan source, fixes the a16z Speedrun pagination truncation, and finishes correcting provider labels/monograms in the last two chrome spots.

- **Under test:** `package.json` **1.219.0**. Sources **82 → 83** (78 EN + 5 RU). Providers **18** (unchanged). Help gates unchanged.

## §0 — Gates

```bash
npm test                                                   # 2768, exit 0
node --test tests/sources-torre.test.mjs tests/sources-a16z-speedrun-talent.test.mjs tests/adapter-registry.test.mjs tests/scan-sources-endpoint.test.mjs tests/scan-fallback-sources.test.mjs tests/provider-logo.test.mjs
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.219.0
```

## §1 — What changed

- **New source `torre` (region en).** `server/lib/sources/torre.mjs` — torre.ai's pan-LatAm POST/JSON opportunity search (`https://search.torre.co/opportunities/_search`). SSRF-safe: host-pinned to `search.torre.co`, HTTPS-only (`assertTorreUrl`), `redirect:'error'`, permalink built from an `ID_RE`-anchored id (`https://torre.ai/post/{id}`). Single capped 20-row request, no paging (the API can't page). Adapter matches only on explicit `provider: torre`. Wired into `ALL_ADAPTERS` (77→78), the two gate tests, `scan-results.js` FALLBACK_SOURCES, and `Sources.astro` SOURCE_URLS.
- **a16z Speedrun pagination fix (#2547).** `sources/a16z-speedrun-talent.mjs`: a positive `total_pages` now outranks a short page; an empty page always ends iteration; a short page is only the fallback when the feed omits `total_pages`. Fixes a silent truncation (149 of ~300) when a board rotates a listing mid-sweep. +2 tests.
- **Provider labels (bundled).** `app.js` onboarding banner: last stale 4-provider `NAME` map → `ProviderStatus.label` + monogram. `config.providerModelNote` ×17: "seven providers" → the full 18-provider roster; `llmProviderHint` slug pin-list gained `ark`/`arkcn` ×17. Snapshot regenerated.
- **NOT ported:** getonbrd multiple-categories-per-entry (#3330) — the web-ui adapter builds the category into the endpoint URL, so it needs a source-level `resolveCategories` refactor; queued (noted in CHANGELOG).

## §2 — Manual browser pass

1. `#/scan` Source filter lists **Torre**; a `tracked_companies` entry `{ name: Torre, provider: torre, search: "engineering manager", enabled: true }` scans (LatAm remote roles), gated by title/location filters.
2. The onboarding banner (top of page) with a new provider configured (e.g. DeepSeek) shows **DeepSeek + its monogram** (not a raw slug). `#/config` provider note names the full roster.

## §3 — Invariants / security

- Torre reaches `fetch` only through the host-pinned `assertTorreUrl` + `fetchJson` (`redirect:'error'`); no third-party top-level import (Pages-build safe). No CSP/SSRF-envelope change. Parent read-only contract intact. Provider tiles remain CSP-safe inline SVG.

## §4 — Sign-off

Suite **2768** green · **83 sources** (registry + `/api/scan/sources` + FALLBACK + Sources.astro in lockstep; adapter-registry 78) · a16z #2547 covered · provider monograms on all surfaces incl. the onboarding banner · help §17 "83 adapters (78 EN + 5 RU)" ×17 · changelog parity ×17 at v1.219.0 · README banner+badges ×17 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed. Deploy: Pages (site + help + facts), local + resumecraft restart.
