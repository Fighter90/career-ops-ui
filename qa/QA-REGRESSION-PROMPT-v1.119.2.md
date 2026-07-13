# QA REGRESSION PROMPT — career-ops-ui **v1.119.2** (release delta driver, closes the v1.119.x line)

Delta driver for v1.119.2 — **CONTRIBUTING.md + landing language flags + footer fixes**. Run on top of the definitive whole-project prompt (`qa/QA-REGRESSION-PROMPT.md`) and the v1.119.0 driver (which §6 already extends to v1.119.1). This is the final sign-off for the v1.119.x release line.

- **Version under test:** `package.json` **1.119.2** · `parentVersion` **1.19.0** · **31 route modules** · **61 adapters (56 EN + 5 RU)**.
- **Baseline:** **1845** `node --test` cases (unchanged from v1.119.1 — docs + `site/` only) · CHANGELOG/README parity ×16 at v1.119.2.

---

## §1 — CONTRIBUTING.md

1. `CONTRIBUTING.md` exists at the repo root and the two long-standing links to it resolve: the landing's OpenSource "Contributing guide" button and the footer Community column (both `${repoUrl}/blob/main/CONTRIBUTING.md`).
2. Content sanity: setup (`npm install`/`start`/`test`), project map table, the 6 hard rules (parent read-only, no user data, security envelope, ESM/no-deps, no-build SPA, CI-isolated tests), the two-registry walkthrough for scan sources **including the v1.119.1 `FALLBACK_SOURCES` third step**, the ×16 i18n contract, conventional commits, release process pointer to the wiki.
3. No dead links inside the file (Discussions is NOT referenced — the repo has it disabled; issues + wiki are).

## §2 — Landing language flags (cvstart.org)

1. `site/src/i18n/locales.ts` — every one of the 16 locale entries carries a `flag` field (regional-indicator emoji, same set as the SPA's `public/js/lib/i18n.js` `LANGS`: en 🇬🇧 · es 🇪🇸 · fr 🇫🇷 · pt-BR 🇧🇷 · ko 🇰🇷 · ja 🇯🇵 · ru 🇷🇺 · zh-CN 🇨🇳 · zh-TW 🇹🇼 · pl 🇵🇱 · uk 🇺🇦 · da 🇩🇰 · ar 🇸🇦 · de 🇩🇪 · it 🇮🇹 · tr 🇹🇷).
2. Flags render in **three** places: the header language switcher (summary + all 16 options), the footer Languages grid, and the "read in your language" banner text (`site.js` interpolates `{flag} {endonym}`).
3. `astro check` 0 errors; `node site/scripts/check-i18n.mjs` → **16 locales × 193 keys** (the `footer.discussions` key was removed AND `footer.createdBy` added in the same pass — net count unchanged).

## §3 — Landing footer fixes

1. The Community column links: GitHub · Issues · **Wiki** (`/wiki` — replaces the dead `/discussions` link; Discussions is not enabled on the repo) · Contributing guide. All four return HTTP 200.
2. The bottom bar credits the author between the license and the disclaimer: `footer.createdBy` (localized ×16) + **Sergey Emelyanov** → `https://sergey-cv.com/` (`rel="noopener author"`) · **LinkedIn** → `https://www.linkedin.com/in/sergey-emelyanov-in-job/`.
3. RTL spot-check: `/ar/` shows the flags and the author line correctly mirrored.

## §4 — Docs & gates

```bash
node scripts/check-changelog-parity.mjs   # "all 15 locales at v1.119.2"
npm run test:ci                           # 1845 green + parity + i18n audit
```

- README ×16: release badge v1.119.2, header line v1.119.2 (test badge stays 1845; banner paragraph remains the v1.119.0 parity text — patch release convention).
- CHANGELOG ×16: three v1.119.2 bullets (CONTRIBUTING / flags / footer) translated natively per locale.

## §5 — Sign-off

`npm test` green (≥1845) · `npm run test:ci` green · site `astro check` + `check-i18n` + build green (33 pages) · cvstart.org redeployed and showing flags + author credit + Wiki link · local server restarted at v1.119.2.
