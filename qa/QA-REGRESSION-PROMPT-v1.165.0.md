# QA REGRESSION PROMPT — career-ops-ui **v1.165.0** (FIX-7: consistent "Two-pager" term)

**Audit finding (LOW, `FIX-PROMPT-post-v1.158.0.md` SHIP 7).** In `ar`, every sidebar item was Arabic except **"Two-pager"** (Latin) — the only Latin string in an otherwise fully mirrored RTL chrome, while the page `<h1>` (`twoPager.title`) was already localized. i18n-only fix.

- **Under test:** `package.json` **1.165.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2424, exit 0 (capture $? directly, never | grep)
node --test tests/two-pager-term-consistency.test.mjs
node tools/i18n-audit.mjs                    # no hard failures
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.165.0
```

## §1 — Decision + fix

- **Enforced decision:** within each locale, `nav.twoPager` and `twoPager.title` must agree on the term — either both keep the Latin product noun "Two-pager", or both use the localized form. Audit found **only `ar`** split (nav Latin, title localized `الصفحتان الخاصتان بك`).
- `ar` `nav.twoPager` is now the localized **الصفحتان**, matching its title. All other 16 locales were already internally consistent (en/es/pt-BR/fr/da/de/it/tr keep Latin in both; ru/zh-CN/zh-TW/pl/uk localize both; ko/ja/hi transliterate both).
- `tests/two-pager-term-consistency.test.mjs` fails the build if any locale ever splits nav vs title again.

## §2 — Manual pass

1. **`#/two-pager` in `ar` (RTL)** — the sidebar item and the page `<h1>` both read the localized Arabic term; no lone Latin "Two-pager" in the nav.
2. **Latin-keeping locale (e.g. `de`/`es`)** — nav and title both still use "Two-Pager"/"two-pager" (unchanged).
3. **Localizing locale (e.g. `ru`/`zh-CN`)** — nav and title both localized (unchanged).

## §3 — Invariants

- **i18n-only** — no route, CSP, SSRF, or parent-write change. One value changed (`ar`); no new keys (snapshot **1219**, parity ×17, i18n-audit clean).
- **Consistency gated** — nav↔title term agreement enforced for all 17 locales.

## §4 — Sign-off

Suite **2424** green · `ar` nav no longer shows the lone Latin "Two-pager" · nav↔title agree in all 17 locales · consistency canary green · parity ×17. **Closes SHIP 7 (FIX-7, LOW).**
