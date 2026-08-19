# QA REGRESSION PROMPT — career-ops-ui **v1.210.0** (career-ops 1.27.0 parity: Senjob source + title entity-decode ×5)

**Parity release.** Parent career-ops reached **1.27.0**. The web-ui-relevant delta was one new scan source (**Senjob**, the scanner's first African board) plus a scan-quality fix (**HTML-entity title decoding** on five providers). Everything else in the 44-commit parent delta was CLI-only or relay-absorbed.

- **Under test:** `package.json` **1.210.0**. Registry **80** sources = 75 EN + 5 RU; `ALL_ADAPTERS` **75**.

## §0 — Gates

```bash
npm test                                     # 2643, exit 0
node --test tests/sources-senjob.test.mjs    # 13 (new source)
node --test tests/sources-title-entity-decode.test.mjs   # 5 (the 5 patched providers)
node --test tests/adapter-registry.test.mjs tests/scan-sources-endpoint.test.mjs tests/scan-fallback-sources.test.mjs   # gate lists incl. senjob
node scripts/check-changelog-parity.mjs      # 16 non-EN at v1.210.0
```

## §1 — What changed

- **New source — Senjob** (`server/lib/sources/senjob.mjs` + `server/lib/portals/adapters/senjob.mjs`). Zero-token HTML scraper for senjob.com (Senegal). Anchored on the `/jobseekers/{slug}_e_{id}.html` URL shape + the hidden ISO date; **throws** on a listing page that still has posting links but parses to zero (a markup break must look like a broken board, not an empty country); host-pinned via `SENJOB_HOST_RE` + `assertSenjobUrl` (HTTPS-only, `redirect:'error'`, browser UA); C0-safe decode through the shared `html-entities.mjs`. Wired across all 5 surfaces (registry, `adapter-registry` + `scan-sources-endpoint` sorted lists, `FALLBACK_SOURCES`, `SOURCE_URLS`).
- **Title entity-decode** on **beesite, csod, hackernews, phenom, tkms** — titles arrive HTML-escaped, so an undecoded "R&D" (as `R&amp;D`) failed the user's own `r&d` `title_filter` and the posting was silently dropped; titles (and phenom locations) now `decodeEntities` before matching. hackernews's 7-form local entity map was replaced with the shared decoder (so numeric/other entities decode too).

## §2 — Manual browser pass

1. `#/scan` → the **Source** filter dropdown lists **Senjob** (offline `FALLBACK_SOURCES` and live `/api/scan/sources` agree — the drift gate proves it).
2. `GET /api/scan/sources` returns **80** entries; the EN set includes `senjob`.
3. cvstart.org **Job sources** section links Senjob → senjob.com (`SOURCE_URLS`).
4. No console errors on `#/scan`.

## §3 — Contract / security invariants

- Senjob fetches only senjob.com (host-pinned, HTTPS-only, `redirect:'error'`), never a name-derived arbitrary host.
- The scraper never emits a C0 control into a title/location (shared decoder's `isEmittableCodePoint`).
- Parent read-only contract unchanged; no new write route. No new npm dependency.

## §4 — Not ported / not applicable

- **detect-reposts `validateFlags`** — CLI-only flag validation; web-ui imports `detectReposts` as a library, never runs it as a CLI. No surface.
- **discover-ats `isDefinitiveAbsence` / httpStatus (#2883)** — a CLI "definitively-absent vs inconclusive" refinement; web-ui's board discovery reports only positive matches, so there is no consuming surface.
- **yourator** board and other post-1.27.0 commits on the fork — queued for the next sync.

## §5 — Sign-off

Suite **2643** green · new suites `sources-senjob` (13) + `sources-title-entity-decode` (5) · gate lists (adapter-registry / scan-sources-endpoint / FALLBACK / SOURCE_URLS) carry `senjob` · registry **80** = 75 EN + 5 RU · CHANGELOG parity ×17 at v1.210.0 · help §17 count 79→80 · 74→75 ×17 · README banner/badges ×17 · API/OVERVIEW/CONVENTIONS counts refreshed · site Sources.astro + wiki updated. Deploy: resumecraft rsync of the 8 changed server files (senjob source+adapter + 5 patched sources + registry); server picks up the new source on restart. cvstart.org Pages rebuild (site/ changed).
