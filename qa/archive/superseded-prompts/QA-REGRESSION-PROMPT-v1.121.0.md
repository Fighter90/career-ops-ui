# QA Regression Prompt — v1.121.0 (cvstart.org Methodology / License / Changelog pages)

> Delta-focused sign-off for v1.121.0. Baseline: v1.120.0 (all green).
> Scope: **no new server routes, no new scan adapters, no SPA behaviour change** —
> the delta is three new localized cvstart.org pages sourced from the repo, the
> career-ops.org/methodology links across the docs, and the refreshed README banner.

## What changed

1. **cvstart.org pages ×16 locales** (site/ only):
   - `/methodology/` (+ `/<locale>/methodology/`) — i18n-keyed summary of
     [career-ops.org/methodology](https://career-ops.org/methodology): score-threshold
     table (mirrors the README), six dimensions, never-do rules, manifesto tie-in,
     canonical links. Component `MethodologyPage.astro`.
   - `/license/` — canonical MIT text rendered verbatim (synced from `LICENSE` into
     `site/src/generated/license.txt` at build) + NOTICE.md pointer. `LicensePage.astro`.
   - `/changelog/` — per-locale render of the repo's `CHANGELOG(.<lang>).md`, synced
     into a new `changelog` content collection at build. `ChangelogPage.astro`.
2. **Nav/footer**: header gained a **Methodology** entry (`PAGE_IDS` page-link pattern);
   footer Resources now links local `/methodology/`, `/changelog/`, `/license/` and the
   parent methodology page; the bottom-bar license link points at the local page.
3. **`localePath`/`Page` type** generalized (`'' | 'help' | 'methodology' | 'license' | 'changelog'`)
   — hreflang alternates and the language switcher work on all new pages.
4. **site i18n**: 30 new keys ×16 (`check-i18n` parity green; `tests/site-pages.test.mjs`).
5. **Docs**: README ×16 — banner refreshed to v1.121.0 (was still v1.119.5), badges
   tests 1850 / release v1.121.0, + methodology/FAQ/glossary links in the canonical
   guides list; help ×16 — §1 canonical list gained the methodology item (29 H2 / 105 H3
   unchanged); CHANGELOG ×16 — the 1.121.0 entry; wiki links refreshed.
6. **New suite** `tests/site-pages.test.mjs` (6 cases).

## Sign-off checklist

- [ ] `npm test` — full suite green, count ≥ 1856.
- [ ] `node --test tests/site-pages.test.mjs` — 6/6.
- [ ] `node scripts/check-changelog-parity.mjs` — all 16 at `1.121.0`.
- [ ] Help gates unchanged: every bundle exactly **29 H2 / 105 H3**.
- [ ] `cd site && npm run build` (Node ≥ 22) — **81 pages**; `dist/<locale>/{methodology,license,changelog}/index.html`
      exist for all 16 locales; `node scripts/check-i18n.mjs` green.
- [ ] Spot-check `dist/ru/methodology/index.html`: localized title, threshold table,
      link to career-ops.org/methodology; `dist/ru/changelog/index.html` shows the
      **Russian** changelog (not English); `dist/ar/license/index.html` keeps the MIT
      text LTR inside the RTL chrome.
- [ ] Header/footer on the landing: Methodology entry present, footer Resources shows
      the three local links; language switcher preserves the page (e.g. /ru/license/ → /de/license/).
- [ ] README banner v1.121.0 in all 16 READMEs; no README still says v1.119.5.
- [ ] No SPA regressions: `/api/health` reports 1.121.0; sidebar manifesto link intact.
