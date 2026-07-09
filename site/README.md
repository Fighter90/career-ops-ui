# cvstart.org — marketing landing for career-ops-ui

Static, multilingual (16 locales) marketing site for
[career-ops-ui](https://github.com/Fighter90/career-ops-ui), deployed to
GitHub Pages at **https://cvstart.org** by
`.github/workflows/deploy-pages.yml`.

> **Build-step exception.** The root `CLAUDE.md` rule "no bundlers, no
> transpilers" applies to the **SPA in `public/`** and still stands. `site/`
> is a separate artifact with its own `package.json`; it is built by CI only
> (Astro), never at app runtime, and nothing in `server/` or `public/`
> depends on it.

## Stack

- [Astro 5](https://astro.build) — `output: 'static'`, 33 pages
  (16 × landing + 16 × help + 404)
- Tailwind CSS v4 via `@tailwindcss/vite` with `@theme` tokens
  (Airbnb-inspired light design; single dark "Built in the open" section)
- `@astrojs/sitemap` (i18n-aware), `astro:assets` + sharp (AVIF/WebP)
- Self-hosted fonts (`@fontsource-variable/figtree`, JetBrains Mono);
  CJK/Arabic use system stacks — no CJK webfonts
- Vanilla JS < 15 KB gzip (menu, language switcher, copy buttons, install
  tabs, scroll reveal, one-time language banner) — the page is fully
  readable without JS

## Layout

| Path | What |
|---|---|
| `src/i18n/locales.ts` | **Locale registry** — drives routes, hreflang, switcher, screenshot + help picks |
| `src/i18n/<code>.json` | Flat landing dictionaries ×16 — parity gated by `scripts/check-i18n.mjs` (build fails on a missing key) |
| `src/components/*.astro` | Header, Hero, InstallTabs, StatsBar, HowItWorks, Features, ScreenshotShowcase, Compare, HelpTeaser, OpenSource, Faq, FinalCta, Footer, Seo |
| `src/pages/` | `index`, `help`, `[locale]/index`, `[locale]/help`, `404` |
| `src/lib/compare.ts` | Verified competitor data (sources + check date inside) |
| `scripts/sync-assets.mjs` | **The only asset path** — copies `images/dashboard-*.png`, favicons and `docs/help/*.md` from the repo root, and snapshots repo facts (version, adapter/test/provider counts, GitHub stars) into `src/generated/facts.json` at build time |
| `scripts/generate-og.mjs` | Builds `public/og-default.png` (1200×630) with sharp |
| `scripts/check-i18n.mjs` | 16-locale key-parity gate (runs in `prebuild`) |

Synced copies (`src/assets/screenshots/`, `src/content/help/`,
`src/generated/`, favicons, the OG image) are **gitignored** — never edit
them by hand; edit the originals at the repo root.

## URLs and locales

English lives at `/` (no prefix); the other 15 locales at lowercase
prefixes: `/es/ /fr/ /pt-br/ /ko/ /ja/ /ru/ /zh-cn/ /zh-tw/ /pl/ /uk/ /da/
/ar/ /de/ /it/ /tr/`. Arabic is RTL (`<html dir="rtl">`, logical
properties). There are **no Accept-Language redirects** — a dismissible
one-time banner offers the browser's language; the choice is stored in
`localStorage` under `cvstart-lang`. Every page carries hreflang
alternates ×16 + `x-default`, absolute canonicals on `https://cvstart.org`,
and JSON-LD (`SoftwareApplication` on landings, `TechArticle` on help).

## Numbers policy

Every number on the landing (version, adapters, tests, providers, star
count) is read from the repo at **build time** via
`src/generated/facts.json` — never hardcoded from memory. Competitor
comparison cells were verified against vendors' public pricing pages on the
date shown in the table footnote; anything unverifiable renders as “—” or
“varies”.

## Develop

```bash
cd site
npm ci
npm run dev        # sync-assets runs automatically (predev)
npm run build      # sync + i18n gate + OG + astro build → dist/
npm run preview
npx astro check
```

## Deploy

Pushes to `main` that touch `site/**`, `docs/help/**`, or
`images/dashboard-*.png` trigger the Pages workflow (build → upload →
deploy). `public/CNAME` pins the custom domain `cvstart.org`.
