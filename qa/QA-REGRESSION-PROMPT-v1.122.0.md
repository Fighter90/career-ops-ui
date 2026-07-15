# QA Regression Prompt — v1.122.0 (Hindi — the 17th locale)

> Delta-focused sign-off for v1.122.0. Baseline: v1.121.0 (all green).
> Scope: **no new routes, no new adapters, no behaviour change** — the delta is Hindi
> (hi) joining as the 17th interface language across every surface, and every ×16
> parity gate becoming ×17.

## What changed

1. **SPA**: `public/js/lib/locales/i18n-dict.hi.js` (~1,110 keys, Devanagari),
   registered in the assembler (`LANGS`/`TABLES`), `i18n.js` (`LANGS` entry 🇮🇳 +
   `detect()` for `hi*` browsers), `index.html` script order. LTR (no RTL changes).
2. **Help**: `docs/help/hi.md` — the full guide at the gated **29 H2 / 105 H3** parity.
3. **Docs**: `README.hi.md` (full translation, language-switcher lines updated ×17),
   `CHANGELOG.hi.md` (starts at v1.122.0 — de/it/tr precedent), stale translations
   lines in older CHANGELOGs repaired (de/it/tr/hi links added).
4. **Site**: `hi` in `locales.ts` (slug `hi`, `hi_IN`), `site/src/i18n/hi.json` (224
   keys), `check-i18n` CODES ×17, `sync-assets` floors 16→17 + `locales: 17` fact →
   **86 built pages** (17 × 5 + 404).
5. **Gates ×17**: `tests/helpers/i18n-vm.mjs` I18N_LANGS (drives the i18n parity suite,
   snapshot, Playwright locale sweep), help-bundle lists in `help-ui`/`manifesto-link`/
   `site-pages`/`docs-fab`/`usage-hud`/`lang-switcher-rtl`/`site-scripts`,
   `check-changelog-parity`, `tools/i18n-audit`, dashboard-screenshot script (+
   `images/dashboard-hi.png`).
6. **Wiki**: `Home-(हिन्दी)` page + Home language list.

## Sign-off checklist

- [ ] `npm test` — full suite green (count grows vs 1856 with the ×17 parametrized cases).
- [ ] `node scripts/check-changelog-parity.mjs` — all **16** translated changelogs at 1.122.0 (hi included).
- [ ] Help gates: every bundle incl. `hi.md` exactly **29 H2 / 105 H3**.
- [ ] i18n: snapshot regenerated with 17 langs per key; `node tools/i18n-audit.mjs` clean.
- [ ] `cd site && npm run build` (Node ≥ 22) — **86 pages**; `dist/hi/{index,help,methodology,license,changelog}/`
      exist; spot-check `dist/hi/index.html` is Devanagari, hreflang alternates include `hi`.
- [ ] SPA smoke: lang switcher shows 🇮🇳 हिन्दी; switching renders Devanagari across
      sidebar/nav; `#/help` shows the Hindi guide; docs-assistant answers from `hi.md`.
- [ ] `images/dashboard-hi.png` exists and README.hi.md references it.
- [ ] READMEs ×17: banner v1.122.0, language-switcher line carries हिन्दी everywhere.
- [ ] No regression: `/api/health` 1.122.0; manifesto link intact; existing 16 locales unchanged.
