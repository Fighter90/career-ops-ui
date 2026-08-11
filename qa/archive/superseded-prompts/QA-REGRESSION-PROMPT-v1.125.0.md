# QA Regression Prompt — v1.125.0 (cvstart.org "Job sources" section)

> Delta-focused sign-off. Baseline: v1.124.0 (all green). Site-only feature.

## What changed

1. **`site/src/components/Sources.astro`** — landing section `#sources` (between
   Screenshots and Compare): all **67** scanner sources as chips (62 EN + RU
   subheading with 5), each linking to the source's public site (`rss` → the
   user guide). List synced from the live registry at build:
   `sync-assets.mjs` imports `server/lib/sources/registry.mjs` → `facts.sources`
   (floor ≥ 67).
2. **Header nav** — `sources` anchor (`nav.sources` ×17); 4 new site i18n keys
   (`nav.sources`, `src.title`, `src.lead` with `{n}`, `src.ru`) — check-i18n ×17 green.
3. **Drift gate** — `tests/site-sources.test.mjs` (4): component wired, SOURCE_URLS
   covers EVERY registry value, sync exports facts.sources, keys ×17.
4. Landing JSON-LD `inLanguage` now includes `hi` (was missed in v1.122.0).

## Sign-off checklist

- [ ] `npm test` — ≥ **1949** green.
- [ ] `cd site && npm run build` (Node ≥ 22) — 86 pages; `dist/<loc>/index.html`
      contains `id="sources"`; ru shows «Источники вакансий», chips link out
      (spot-check hh.ru / Greenhouse / Welcome to the Jungle hrefs).
- [ ] Adding a fake source without a SOURCE_URLS row fails `site-sources` (drift).
- [ ] Header nav shows Sources on ≥ xl and in the burger; anchor scrolls to the section.
- [ ] No SPA/server changes: `/api/health` 1.125.0, everything else untouched.
