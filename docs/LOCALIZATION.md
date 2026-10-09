# Localization guide

How translation works in **career-ops-ui**, and how to add or edit a language. The SPA ships **18 locales** — `en`, `es`, `fr`, `pt-BR`, `ko`, `ja`, `ru`, `zh-CN`, `zh-TW`, `pl`, `uk`, `da`, `ar`, `de`, `it`, `tr`, `hi`, `ta` (Hindi added v1.122.0, Tamil v1.245.0) — and every user-facing string flows through the i18n layer. **Arabic (`ar`) is right-to-left** (I18N-EXPAND, v1.70.0): `i18n.js` sets `<html dir="rtl">` for RTL locales and `app.css` carries a scoped `[dir="rtl"]` block. The in-app language picker is a flag-prefixed `<select>` (`renderLangSwitcher` in `public/js/app.js`).

> **Help guide (v1.71.1; de/it/tr in v1.85.0, ta in v1.245.0).** The long-form help bundle (`docs/help/<locale>.md`) is fully translated in all **18 locales** — `pl`/`uk`/`ar` bundles were added in v1.71.1, `de`/`it`/`tr` in v1.85.0 and `ta` in v1.245.0, each holding the gated **33 H2 / 125 H3** structure (the H2 count is asserted by `tests/help-ui.test.mjs` + `tests/canonical-docs-coverage.test.mjs`; Hermes is §30, the cloud stack §31).

> **Tamil specifics (`ta`, v1.245.0).** Tamil is an LTR script — never add it to `RTL_LANGS`. The switcher flag is **🇱🇰** (v1.248.2 — moved from 🇮🇳: two identical flags beside `hi` read as a duplicate; Sri Lanka is Tamil's other home state, where Tamil is official; the `ta-LK` variant resolves to the same locale). `detect()` covers `ta`, `ta-IN` and `ta-LK`. Per the `hi` table's Indic-tech convention, provider names, model ids, env vars, file paths, and `/career-ops …` commands stay Latin; the surrounding prose is Tamil. The cvstart.org landing speaks Tamil too (#419 added `site/src/i18n/ta.json` + the `locales.ts` entry); the site's help/changelog content sync (`site/scripts/sync-assets.mjs`) already picks `docs/help/ta.md` and `CHANGELOG.ta.md` up automatically.

> Server diagnostics stay **English by policy** (consistency across logs). Only client-owned UI strings are localized. Don't add per-locale text to server error bodies.

---

## Architecture (I18N-SPLIT, v1.60.0)

Translations live **one file per locale** under `public/js/lib/locales/`:

```
public/js/lib/locales/
  i18n-dict.en.js       window.__I18N_DICT_EN = { 'nav.scan': 'Scan', … }
  i18n-dict.es.js       window.__I18N_DICT_ES = { 'nav.scan': 'Búsqueda', … }
  i18n-dict.pt-BR.js    window.__I18N_DICT_PT_BR = { … }
  i18n-dict.ko.js  i18n-dict.ja.js  i18n-dict.ru.js  i18n-dict.zh-CN.js  i18n-dict.zh-TW.js
  i18n-dict.aliases.js  window.__I18N_ALIASES = { 'nav.help': 'help.title', … }
```

Each locale file is a flat `key → string` table. They load in order via `<script src>` in [`public/index.html`](../public/index.html), then:

- [`public/js/lib/i18n-dict.js`](../public/js/lib/i18n-dict.js) — a small **assembler** that merges every `window.__I18N_DICT_<LANG>` table + the alias map into the key-major `window.__I18N_DICT` (`{ 'nav.scan': { en: 'Scan', es: 'Búsqueda', … } }`).
- [`public/js/lib/i18n.js`](../public/js/lib/i18n.js) — the resolver: `t('key', 'fallback')`, `setLang`, `getLang`, persisted in `localStorage`.

**No build step, no runtime fetch** — all synchronous classic scripts (a hard project rule). A translator edits a single language file in isolation; the assembler and `t()` never change.

### Using strings in the UI

```html
<!-- Static markup: the key + an English fallback -->
<span data-i18n="nav.scan">Scan</span>
<input data-i18n-placeholder="top.search" />
<button data-i18n-aria-label="notif.bellAria">…</button>
```

```js
// Dynamic JS:
const t = window.I18n.t;
el.textContent = t('nav.scan', 'Scan');   // fallback used only if the key is missing
```

The fallback is a dev convenience — a key missing from the dictionary fails CI (see [Gates](#gates)).

---

## Common task — add or edit a translation key

1. **Add the key to all 18 locale files** in `public/js/lib/locales/` — same key, translated value:
   ```js
   // i18n-dict.en.js
   'scan.newButton': 'Run scan',
   // i18n-dict.es.js
   'scan.newButton': 'Ejecutar búsqueda',
   // …ko, ja, ru, pt-BR, zh-CN, zh-TW
   ```
   Keys are single-quoted; values are normal strings. Keep the same key in every file — **parity is gated**.
2. **Use it** in markup (`data-i18n="scan.newButton"`) or JS (`t('scan.newButton')`).
3. **Regenerate the snapshot** — adding or removing a key changes the assembled dict, so `tests/fixtures/i18n-dict.snapshot.json` must be re-captured or `tests/i18n-locale-files.test.mjs` fails:
   ```bash
   node --input-type=module -e '
   import { loadAssembledDict } from "./tests/helpers/i18n-vm.mjs";
   import { writeFileSync } from "node:fs";
   writeFileSync("tests/fixtures/i18n-dict.snapshot.json",
     JSON.stringify(loadAssembledDict(), null, 2) + "\n");
   '
   ```
4. **Run the gates** (see below). `tests/i18n-coverage.test.mjs` fails if any locale is missing the key; `tests/i18n-locale-files.test.mjs` fails on key-set drift between locales; `tests/i18n-dead-keys.test.mjs` fails if the key is never referenced anywhere in the repo (don't add speculative keys).

> Editing an existing string? Just change the value in the relevant locale file(s). If you change `en`, re-check the `data-i18n` fallback in the markup so they don't disagree.

### Aliases — share one string across duplicate-concept keys

When several keys must always read identically in **every** locale (e.g. the sidebar label, the page title, and the dashboard tile for "Help"), make them aliases instead of duplicating the translation:

```js
// i18n-dict.aliases.js
'nav.help': 'help.title',          // nav.help resolves to help.title in every locale
'dash.quick.helpCta': 'help.title',
```

`t('nav.help')` returns `t('help.title')`. Rules (enforced by `tools/i18n-audit.mjs` + `tests/i18n-alias.test.mjs`):

- The alias **target must exist** as a real key (in the per-locale files).
- **No chains** — an alias target must not itself be an alias.
- An alias key must **not** also appear in the per-locale tables.
- Only alias keys that are byte-identical in all 18 locales. Keys that merely collapse in English but diverge elsewhere (e.g. `nav.config` "App settings" vs `config.title`, which differ in Spanish) stay **independent**.

---

## Bigger task — add a brand-new locale

Adding, say, French (`fr`) touches a fixed set of files. Work through them in order:

1. **Create the table** `public/js/lib/locales/i18n-dict.fr.js`:
   ```js
   /* global window */
   window.__I18N_DICT_FR = {
     'nav.dashboard': 'Tableau de bord',
     // … every key that exists in i18n-dict.en.js (full parity required)
   };
   ```
   Tip: copy `i18n-dict.en.js`, rename the global to `__I18N_DICT_FR`, translate every value.
2. **Register the language** in [`public/js/lib/i18n.js`](../public/js/lib/i18n.js): add `{ code: 'fr', label: 'Français', flag: '🇫🇷' }` to `LANGS` — the `flag` regional-indicator emoji is what the language `<select>` renders — and a `if (browser.startsWith('fr')) return 'fr';` line in `detect()` (region variants resolve by prefix, e.g. `fr-CA`). For a right-to-left language also add its code to `RTL_LANGS` in the same file so `<html dir="rtl">` is set (see `tests/i18n-detect.test.mjs`, which pins the whole detect() mapping).
3. **Wire the assembler** in [`public/js/lib/i18n-dict.js`](../public/js/lib/i18n-dict.js): add `'fr'` to its `LANGS` array and `fr: window.__I18N_DICT_FR` to `TABLES`.
4. **Load it** in [`public/index.html`](../public/index.html): add `<script src="/js/lib/locales/i18n-dict.fr.js"></script>` **before** `i18n-dict.aliases.js`.
5. **Update tooling/tests** that enumerate locales: `tools/i18n-audit.mjs` (`LOCALES`), `tests/helpers/i18n-vm.mjs` (`I18N_LANGS`), `scripts/check-changelog-parity.mjs` (`LOCALES`), and the `ci.yml` inline check's `langs` array.
6. **Regenerate the snapshot** — a new locale changes `__I18N_DICT`, so `tests/fixtures/i18n-dict.snapshot.json` must be updated. Capture the new assembled dict:
   ```bash
   node --input-type=module -e '
   import { loadAssembledDict } from "./tests/helpers/i18n-vm.mjs";
   import { writeFileSync } from "node:fs";
   writeFileSync("tests/fixtures/i18n-dict.snapshot.json",
     JSON.stringify(loadAssembledDict(), null, 2) + "\n");
   '
   ```
7. **Companion content** (for a fully-supported locale): `docs/help/fr.md` (help bundle, must keep the 33-H2 / 125-H3 parity), `CHANGELOG.fr.md`, `README.fr.md`.
8. **Run all gates** and fix any parity failures.

---

## Gates

Run these before pushing — they are the same checks CI enforces:

```bash
npm test                                  # incl. i18n-coverage + i18n-locale-files + i18n-alias
node tools/i18n-audit.mjs                 # personal-data / parity / empty / bare-date / alias integrity
npm run test:e2e:browser                  # incl. playwright-locale-sweep (every page × every locale, real Chromium)
node scripts/check-changelog-parity.mjs   # all CHANGELOG.<locale>.md at the same version
```

| Gate | What it locks |
|---|---|
| `tests/i18n-coverage.test.mjs` | every key present in all 18 locales; every `t('key')` call maps to a real entry |
| `tests/i18n-locale-files.test.mjs` | per-locale key parity · alias integrity · `index.html` load order · assembled dict ≡ snapshot |
| `tests/i18n-alias.test.mjs` | alias targets exist, no chains, `t(alias) === t(canonical)` in every locale |
| `tools/i18n-audit.mjs` | no personal data, no empty values, no bare-calendar-date placeholders, no broken aliases |
| `tests/playwright-locale-sweep.mjs` | every page renders + localizes in every locale, zero console errors |
| `tests/i18n-no-latin-leaks.test.mjs` | no Latin-only `*.title` on the non-Latin locales (ru/ko/ja/zh-CN/zh-TW/uk/ar/hi/ta) |
| `tests/i18n-no-personal-data.test.mjs` | no maintainer PII across any locale file |
| `tests/i18n-dead-keys.test.mjs` | zero dictionary keys that no code references (removal guard against translator busywork) |
| `tests/i18n-detect.test.mjs` | the full `detect()` browser-language → locale mapping (da, zh-Hant/zh-HK/zh-MO → zh-TW, …) |
| `tests/i18n-field-specs-keys.test.mjs` | every `labelKey`/`hintKey` in `views/config/field-specs.js` exists in the dict |
| `tests/i18n-provider-facts.test.mjs` | provider hints stay factually true (no "Hermes last in the auto order"; lists stay open-ended) |
| `tests/i18n-untranslated.test.mjs` | the registered (locale, key) pairs carry real translations, not the en string |
| `tests/i18n-rtl-arrows.test.mjs` | ar arrow strings point ← (RTL), never → |
| `tests/i18n-pipe-hint.test.mjs` | `pipe.hint` keeps both sentences in every locale |
| `tests/i18n-cv-diagnostics-i18n.test.mjs` | cv-diagnostics speaks the active locale (`diag.*`); en values byte-match the legacy strings |

> Node tests load the dictionary through `tests/helpers/i18n-vm.mjs` (`loadAssembledDict`, `loadI18n`, `legacyDictText`, `allLocaleSource`) — it replays the browser load order in a `node:vm`. When comparing an assembled-in-vm dict to the JSON snapshot, round-trip through `JSON.parse(JSON.stringify(...))` first (vm objects have a foreign prototype, so `deepStrictEqual` otherwise reports a false mismatch).

See also [`docs/sdd/CONVENTIONS.md`](sdd/CONVENTIONS.md) → **i18n**.
