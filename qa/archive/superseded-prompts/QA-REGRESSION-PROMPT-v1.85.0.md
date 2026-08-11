# QA REGRESSION PROMPT — career-ops-ui **v1.85.0** (German / Italian / Turkish locales)

Delta-focused regression for the **de / it / tr** locale expansion (13 → **16 locales**). Pairs with the whole-project driver `qa/QA-REGRESSION-PROMPT.md`. Parent parity: career-ops **v1.16.0** locale set.

- **Under test:** `package.json` **1.85.0**.
- **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates (all green)

```bash
npm test                                    # full suite (≥1560 cases)
node scripts/check-changelog-parity.mjs     # "all 15 locales at v1.85.0" (EN + 15 = 16 files)
node tools/i18n-audit.mjs                   # "no hard failures — dictionary is clean"
node --test tests/locales-de-it-tr.test.mjs # 6/6 — the release's own guard
npm run test:e2e:browser                    # locale-sweep + theme-toggle
```

## §1 — What changed (verify each)

1. **UI dictionaries** — `public/js/lib/locales/i18n-dict.{de,it,tr}.js`, **730 keys each**, byte-identical key set to `en`. Gate: `tests/i18n-locale-files.test.mjs` (parity + lossless snapshot), `tests/i18n-coverage.test.mjs`.
2. **Language switcher** — `#lang-select` lists **Deutsch 🇩🇪 · Italiano 🇮🇹 · Türkçe 🇹🇷** (16 options total). Gate: `tests/lang-switcher-rtl.test.mjs` (`getLangs().length === 16`), `tests/e2e.mjs` switcher check.
3. **Browser auto-detect** — `navigator.language` `de`/`it`/`tr` → that locale (`i18n.js` `detect()`).
4. **In-app Help** — `GET /api/help/{de,it,tr}` serves `docs/help/{de,it,tr}.md`, each **20 H2 / 78 H3** (§20 added v1.86.0). Manually: `#/help` in each language renders translated, not English.
5. **Prompt scaffolding** — `server/lib/prompts.mjs` `LOCALE_NAMES` + `SCAFFOLD_STRINGS` localized for de/it/tr (LLM output follows UI locale). Gate: `tests/locale-scaffold.test.mjs`.
6. **Docs** — `README.{de,it,tr}.md`, `CHANGELOG.{de,it,tr}.md` (seeded at v1.85.0), localized `dashboard-{de,it,tr}.png` screenshots (added in the v1.86.0 screenshot refresh).

## §2 — Footguns

- de/it/tr are **Latin-script** → exempt from `tests/i18n-no-latin-leaks.test.mjs` (only ru/ko/ja/zh/uk/ar are guarded). Only `ar` is RTL.
- Adding a locale touches **9 files** (dict, assembler `LANGS`/`TABLES`, `i18n.js` `LANGS`+`detect()`, `index.html` `<script>`, `i18n-vm.mjs` `I18N_LANGS`, `i18n-audit.mjs`, `check-changelog-parity.mjs`, snapshot, help) — see `docs/LOCALIZATION.md`.
- CHANGELOG/help/README use `ko-KR` file naming but the dict uses `ko`; de/it/tr use the simple code everywhere.

## §3 — Sign-off

All §0 gates green · switcher shows 16 flags · Help + dashboard render natively in de/it/tr · CHANGELOG parity at 1.85.0 across 16 files.
