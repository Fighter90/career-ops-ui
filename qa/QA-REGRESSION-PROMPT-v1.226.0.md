# QA REGRESSION PROMPT — career-ops-ui **v1.226.0** (career-ops 1.30.0 parity — 2 Vietnamese sources)

**Parity release.** Ports two new scan sources from parent career-ops 1.30.0: **ITviec** + **CareerViet** (Vietnam). Registry 83 → **85 sources** (80 EN + 5 RU), `ALL_ADAPTERS` 78 → **80**. parentVersion 1.29.0 → 1.30.0.

## §0 — Gates
```bash
npm test                                              # 2818 (±2 flaky live scan-stream), exit 0
node --test tests/sources-itviec.test.mjs tests/sources-careerviet.test.mjs   # 15 + 17
node --test tests/adapter-registry.test.mjs tests/scan-sources-endpoint.test.mjs tests/scan-fallback-sources.test.mjs tests/site-sources.test.mjs
node scripts/check-changelog-parity.mjs               # 16 non-EN at v1.226.0
```

## §1 — Two new providers
- **`server/lib/sources/itviec.mjs`** + **`server/lib/sources/careerviet.mjs`** — host-pinned HTML scrapers (itviec.com / careerviet.vn) via `http-json.mjs::fetchText`, injectable `fetchImpl`, HTTPS-only SSRF pin, per-company fail-soft, page caps, web-ui-shaped job objects. `meta = { value, label:'ITviec'|'CareerViet', region:'en' }` (auto-discovered).
- **`server/lib/portals/adapters/{itviec,careerviet}.mjs`** — `provider:` selection only (never careers_url), mirror `torre.mjs`.
- Wired into `ALL_ADAPTERS` (registry.mjs). Gate lists regenerated from the live registry: `adapter-registry` ids+count (80), `scan-sources-endpoint` EN set, `scan-results` `FALLBACK_SOURCES`, site `Sources.astro` `SOURCE_URLS`.
- Tests: `tests/sources-itviec.test.mjs` (15) + `tests/sources-careerviet.test.mjs` (17), CI-isolated (fake fetch, no network).

## §2 — Not ported (documented)
career-ops 1.30.0's community/CLI wave: the **Hired Wall**, `/calibrate`, clean-markers, template packs, doctor, pdf/LaTeX, and the eval/tracker/scan CLIs web-ui doesn't shell into. Already in web-ui: the `_html-to-text` quoted-angle-brackets fix (v1.214.2) and detect-reposts `roleFuzzyMatch`. Deferred: `title-filter stem:` prefix (web-ui filtering lives in `en-scanner`, cleanly separable — like the earlier `word:` matcher).

## §3 — Manual pass
`#/scan` Source filter lists **ITviec** and **CareerViet**. `/api/scan/sources` returns 85 (80 EN + 5 RU). cvstart.org Job-sources shows both.

## §4 — Sign-off
Suite **2818** green · 2 sources + adapters + tests · 5 gate surfaces regenerated · parity ×17 at v1.226.0 · README banner+badges ×17 · help §17 count 83→85 ×17 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed · site rebuilt (facts.json 85). Deploy: Pages, local + resumecraft restart, wiki (85 sources · 80 adapters).
