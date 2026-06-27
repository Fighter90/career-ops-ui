# QA REGRESSION PROMPT — career-ops-ui v1.61.0 · FRENCH = 9th LOCALE

Single hand-off for a QA tester (human or agent) to verify the **French-locale addition** end-to-end. Standalone — walking top-to-bottom signs off the feature. Pairs with the v1.60.0 I18N-SPLIT prompt (`qa/QA-REGRESSION-PROMPT.md`); this one focuses on everything that changed when **Français (`fr`)** became the 9th supported language.

**Baseline after the FR addition:** **1001** unit (0 fail) · **9-locale** parity everywhere · Playwright locale-sweep now **9 subtests** · 20 smoke E2E · 23 / 23 comprehensive E2E.
**Headline change:** the UI ships in **9 languages** — English, Español, **Français**, Português, 한국어, 日本語, Русский, 简体中文, 繁體中文. A new per-locale dictionary `public/js/lib/locales/i18n-dict.fr.js` (`window.__I18N_DICT_FR`, full **668-key** parity with `en`), a new help bundle `docs/help/fr.md` (**19 H2 / 73 H3**), and `fr` registered in the assembler, the language switcher, browser auto-detect, the snapshot, and every test locale list.
**Server:** `http://127.0.0.1:4317` (`npm start`).
**Browser smoke:** Chrome stable + 1 secondary.

> Credit: the initial `i18n-dict.fr.js` translation table came from **PR #9** (community contribution). This work registered it as a first-class locale and added the companion docs.

---

## §−1 — Probe methodology footguns (READ FIRST)

The four I18N-SPLIT footguns from `qa/QA-REGRESSION-PROMPT.md` §−1 **all still apply** — re-read them. The two that bite hardest here:

- **Footgun 3 (vm-realm deepEqual):** round-trip `JSON.parse(JSON.stringify(assembled))` before `deepStrictEqual` against the snapshot. `tests/i18n-locale-files.test.mjs` already does this — don't "fix" it.
- **Footgun 4 (split is text-invisible):** `i18n-dict.js` is an assembler, not a string store. A `grep 'nav.scan'` there returns nothing — the French strings live **only** in `public/js/lib/locales/i18n-dict.fr.js`.

**New FR-specific footgun — counting keys with grep lies.** `grep -cE "^\s*'[^']+':"` on `i18n-dict.fr.js` under-counts (multi-line values, quote-style variance). Count parity authoritatively in Node:
```bash
node --input-type=module -e '
import { loadAssembledDict } from "./tests/helpers/i18n-vm.mjs";
const D = loadAssembledDict(); let present=0, missing=0;
for (const k of Object.keys(D)) {
  const v = D[k];
  if (v && typeof v === "object" && !("@alias" in v)) ("fr" in v ? present++ : (missing++, console.log("MISSING fr:", k)));
}
console.log("fr present:", present, "| fr missing:", missing);   // → 668 / 0
'
```

---

## §0 — Boot

```bash
node --version                 # >= 18
npm ci
npm test                       # MUST report 1001 / 1001 pass, 0 fail
                               #   ⚠️ DO NOT pipe through `grep` — it masks the exit code
npm start                      # server on 127.0.0.1:4317
open http://127.0.0.1:4317
```
Expected: `/api/health` → `{"version":"1.61.0","ok":true}`. Footer reads **v1.61.0**.

> If `/api/health` still reads `1.60.0`, the version bump is missing — that is a **sign-off blocker** (see §7).

---

## §1 — Registration points (the 6 places `fr` must appear)

```bash
# 1. Language switcher + browser auto-detect
grep -n "code: 'fr'" public/js/lib/i18n.js          # → { code: 'fr', label: 'Français' }
grep -n "startsWith('fr')" public/js/lib/i18n.js     # → returns 'fr'

# 2. Assembler LANGS + window global
grep -n "'fr'\|__I18N_DICT_FR" public/js/lib/i18n-dict.js   # in LANGS array + fr: window.__I18N_DICT_FR

# 3. index.html script tag — BEFORE i18n-dict.aliases.js and i18n-dict.js
grep -n "locales/i18n-dict" public/index.html
#    Order MUST be: en es pt-BR ko ja ru zh-CN zh-TW fr → aliases → i18n-dict.js (assembler) → i18n.js

# 4. The dictionary file itself
head -1 public/js/lib/locales/i18n-dict.fr.js        # /* global window */
grep -n "window.__I18N_DICT_FR" public/js/lib/locales/i18n-dict.fr.js

# 5. Snapshot carries fr on every key
node --input-type=module -e 'import fs from "node:fs"; const s=JSON.parse(fs.readFileSync("tests/fixtures/i18n-dict.snapshot.json","utf8")); const k=Object.keys(s).find(x=>s[x]&&typeof s[x]==="object"&&!("@alias" in s[x])); console.log(Object.keys(s[k]));'   # must include 'fr'

# 6. Test locale lists all include fr
grep -n "fr" tests/helpers/i18n-vm.mjs tests/canonical-docs-coverage.test.mjs tests/help-ui.test.mjs
```
All six MUST be present. A missing one means a half-registered locale (renders raw `key.path`, or a test silently skips French).

---

## §2 — French renders in the real browser

1. Open `http://127.0.0.1:4317`, sidebar footer → switch language to **Français**.
2. Verify:
   - `<html lang="fr">` (DevTools → Elements).
   - Sidebar **Dashboard** label reads **`Tableau de bord`** (or the project's chosen FR string — never the raw `nav.dashboard` key).
   - Walk all 22 routes: `#content` non-empty, **zero console errors**, **no untranslated `key.path` leaks**, no truncation/overflow.
   - Per-route `document.title` updates to the French title.
3. Re-load the page on a route while `fr` is active → choice is remembered (localStorage), no flash of English.
4. **Mobile (375 px)** + **`prefers-reduced-motion: reduce`** in French: no layout break.

Automated equivalent:
```bash
node --test tests/playwright-locale-sweep.mjs   # now 9 subtests; the fr subtest walks all 22 routes
```

---

## §3 — Parity gates (the hard locks)

```bash
node --test tests/i18n-locale-files.test.mjs   # assembled ≡ snapshot · fr shares en's key set · load order
node tools/i18n-audit.mjs                       # 668 keys × 9 locales · 0 hard failures
node --test tests/canonical-docs-coverage.test.mjs tests/help-ui.test.mjs tests/help-ru-config-section.test.mjs
#   help bundle parity: 19 H2 / 73 H3 across all 9 locales (fr included)
node scripts/check-changelog-parity.mjs         # all 9 locales at v1.61.0  (needs CHANGELOG.fr.md — see §7)
```

Help-bundle structural spot-check (must be identical to en):
```bash
echo "en: H2=$(grep -cE '^## ' docs/help/en.md) H3=$(grep -cE '^### ' docs/help/en.md)"   # 19 / 73
echo "fr: H2=$(grep -cE '^## ' docs/help/fr.md) H3=$(grep -cE '^### ' docs/help/fr.md)"   # 19 / 73
diff <(grep -cE '^## ' docs/help/en.md) <(grep -cE '^## ' docs/help/fr.md)                 # counts equal
```

Manual (browser): open `#/help` in French → the auto-built TOC lists all 19 H2 sections; §19 reads **"Localizing the app into your language"** (French title) and its prose says the UI ships in **9 langues** and lists `i18n-dict.fr.js`.

---

## §4 — Companion-doc completeness (FR-addition deliverables)

These are the new artifacts a 9th locale requires. **Each missing item is a sign-off blocker.**

```bash
# 1. French help bundle (DONE — verify parity in §3)
test -f docs/help/fr.md && echo "help fr ok"

# 2. French README
test -f README.fr.md && echo "README.fr ok" || echo "README.fr MISSING — blocker"

# 3. French CHANGELOG (parity-gated by check-changelog-parity.mjs)
test -f CHANGELOG.fr.md && echo "CHANGELOG.fr ok" || echo "CHANGELOG.fr MISSING — blocker"

# 4. Français linked from the language nav of every README
grep -l "README.fr.md\|Français" README*.md | wc -l    # → 9 (every README points to the FR one)

# 5. docs/LOCALIZATION.md mentions fr in its supported-locale list
grep -n "fr\|Français" docs/LOCALIZATION.md
```

The §19 prose in **all 9 help bundles** and the `## Localization` section in **all 9 READMEs** should say **9 languages** and list Français — not the stale "8 languages". Confirm at least `en` and `fr` were bumped:
```bash
grep -n "9 language\|9 langues\|9 idiomas\|9 種\|9 개" docs/help/en.md docs/help/fr.md
```

---

## §5 — Full test pyramid (CI-equivalent)

```bash
npm test                  # 1001 / 1001 unit, 0 fail
npm run test:coverage     # line >= 93%, branch >= 83%
npm run test:e2e          # 20 / 20 smoke
npm run test:e2e:full     # 23 / 23 comprehensive
npm run test:e2e:browser  # Playwright incl. 9-locale sweep
npm run test:ci           # aggregate hard gate (unit + no-also + changelog-parity + i18n-audit)
git ls-files -z '*.js' '*.mjs' | xargs -0 -n1 node --check   # syntax gate
```
⚠️ Pre-commit AI review is advisory; **`ci.yml` is the hard gate.** Watch the GitHub Actions run after merge — all hard jobs must finish `success`.

---

## §6 — Standing invariants (quick reference)

1. **9-locale parity** — every `locales/i18n-dict.<lang>.js` (incl. `fr`) shares en's 668-key set (`i18n-locale-files`).
2. Assembled dict ≡ `tests/fixtures/i18n-dict.snapshot.json`; `fr` present on every non-alias key.
3. `index.html` order: 9 locales → aliases → assembler → `i18n.js` (fr before the assembler).
4. Help bundle parity: **19 H2 / 73 H3 across all 9 locales**.
5. CHANGELOG parity across all 9 locales (gate) — `fr` at the same version as the rest.
6. `t()`, every view, every call-site unchanged — adding a locale is data + registration only, no logic change.
7. Server diagnostic messages stay English on purpose; only the on-screen UI is translated.
8. Parent career-ops project remains read-only.

---

## §7 — Sign-off matrix

| Gate | Pass? |
|---|---|
| §−1 — footguns understood (vm-realm deepEqual, split text-invisibility, grep under-count) | ☐ |
| §0 — `npm test` 1001 / 1001, 0 fail · health version `1.61.0` (bump applied) | ☐ |
| §1 — all 6 registration points present | ☐ |
| §2 — French renders on all 22 routes, zero console errors, lang persists, mobile + reduced-motion OK | ☐ |
| §3 — parity gates green (locale-files · audit 668×9 · help 19/73 · changelog parity) | ☐ |
| §4 — companion docs complete: `docs/help/fr.md` ✓ · `README.fr.md` · `CHANGELOG.fr.md` · READMEs link FR · LOCALIZATION.md lists fr | ☐ |
| §5 — full pyramid + syntax gate | ☐ |
| §6 — standing invariants verified by test names | ☐ |
| Security envelope byte-stable; parent read-only contract preserved | ☐ |

---

## §8 — On failure
1. **Re-check §−1 first** — most i18n "failures" are probe-methodology errors (vm-realm deepEqual, grep under-count, split text-invisibility).
2. Identify the failing lock-test: `node --test tests/i18n-locale-files.test.mjs tests/i18n-coverage.test.mjs tests/i18n-alias.test.mjs tests/playwright-locale-sweep.mjs tests/canonical-docs-coverage.test.mjs`.
3. If a French value is missing/empty: add it to `public/js/lib/locales/i18n-dict.fr.js` (and regenerate the snapshot only via the sanctioned path), then re-run §3.
4. If help parity breaks: a French `##`/`###` count drifted from `en` — diff `docs/help/{en,fr}.md` headers and realign.
5. File `qa/FIX-PROMPT-fr-v1.61.<N+1>.md` with evidence, the §6 invariant ID, and the fix shape (HOW + TEST + ACCEPTANCE + CHANGELOG ×9 sketch).

**Doctrine reminders:** ONE fix per release · CHANGELOG parity non-negotiable (now ×9) · `ci.yml` is the hard gate · adding a locale never touches `t()` or any view.

---

*QA hand-off for the French 9th-locale addition (target v1.61.0). Hand to a human tester or agent — copy-paste top-to-bottom, fill the §7 matrix, file a FIX-PROMPT on any failure. Generated 2026-05-22 after registering `fr` end-to-end: 1001 / 1001 unit, French dict at full 668-key parity, help bundle at 19 H2 / 73 H3.*
