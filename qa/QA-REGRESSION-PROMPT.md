# QA REGRESSION PROMPT — career-ops-ui v1.60.0 (DEFINITIVE FINAL)

Single hand-off for a QA tester (human or agent) to verify v1.60.0 end-to-end. Standalone — walking top-to-bottom signs off the build without needing the rest of the `qa/` tree.

**Baseline at v1.60.0:** **1000** unit · **70** Playwright (smoke + full-cycle + forms + locale-sweep) · 20 smoke E2E · **23 / 23** comprehensive E2E · CI matrix `success` on Node 18 / 20 / 22 + Playwright e2e.
**Headline change:** **I18N-SPLIT** — the 8-language translation megafile was split into one file per locale under `public/js/lib/locales/`. `i18n-dict.js` is now an assembler; `t()`, every view, every call-site unchanged. Lossless (assembled dict ≡ pre-split snapshot, **678 keys**). No user-facing behaviour change. See §4.
**Server:** `http://127.0.0.1:4317` (start with `npm start`).
**Browser smoke:** Chrome stable + 1 secondary (Firefox or Safari).

---

## §−1 — Probe methodology footguns (READ BEFORE STARTING)

Methodological errors that have caused **false-negative sign-offs**. Avoid them.

### Footgun 1 — file-path vs inline implementation
Assert the **behaviour**, not a specific filename. Some helpers live inlined inside an existing route module (e.g. the help TOC scroll-spy lives in `public/js/views/help.js`, not a separate `help-toc.js`). `git grep` for the behaviour marker, not for an imagined filename.

### Footgun 2 — URL normalisation on the client side
`fetch('/api/jds/../../../etc/passwd')` and `curl` (without `--path-as-is`) **normalise the URL before sending**, so they never exercise the server's `..` guard. To verify it, send a verbatim raw path:
```bash
curl -s --path-as-is "http://127.0.0.1:4317/api/jds/../../../etc/passwd"   # → {"error":"invalid path"}
```

### Footgun 3 — vm-realm deep-equality (I18N-SPLIT)
Objects built inside a `node:vm` context have a **different `Object.prototype`** than `JSON.parse`'d ones, so `assert.deepStrictEqual` throws *"same structure but not reference-equal"* even when every value matches. When comparing an assembled-in-vm dict to a JSON snapshot, **round-trip through JSON first**: `JSON.parse(JSON.stringify(assembled))`. (This is exactly what `tests/i18n-locale-files.test.mjs` does — don't "fix" it back.)

### Footgun 4 — the per-locale split is text-invisible to old greps
`public/js/lib/i18n-dict.js` no longer contains translation strings — it's an assembler. A grep for `'auto.eta'` there returns nothing; that is **not** a missing key. The strings live in `public/js/lib/locales/i18n-dict.<lang>.js`. Tests that scan dictionary text use the derived `legacyDictText()` view (`tests/helpers/i18n-vm.mjs`), never the assembler file.

---

## §0 — Boot

```bash
git fetch --tags
git checkout v1.60.0            # or: merge PR #4 to main first
node --version                 # >= 18
npm ci
make clean-test-fixtures       # purge example.com/qa-fixture-* rows from data/pipeline.md
npm test                       # MUST report 1000 / 1000 pass, 0 fail
                               #   ⚠️ DO NOT pipe through `grep` — it masks the exit code
npm start                      # server on 127.0.0.1:4317
open http://127.0.0.1:4317
```
Expected: `/api/health` → `{"version":"1.60.0","ok":true, checks: 20+ rows}`. Footer reads **v1.60.0**.

---

## §1 — Server-side envelope (curl probes, 60 seconds)

| # | Command | Expect |
|---|---|---|
| 1.1 | `curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://127.0.0.1:4317/api/no-such-endpoint` | `404 application/json` |
| 1.2 | `curl -s -o /dev/null -w "%{http_code} %{content_type}\n" -X POST http://127.0.0.1:4317/api/no-such-endpoint` | `404 application/json` |
| 1.3 | `curl -s --path-as-is "http://127.0.0.1:4317/api/jds/../../../etc/passwd"` | **`{"error":"invalid path"}`** — `--path-as-is` mandatory (§−1 Footgun 2) |
| 1.4 | `curl -s -i http://127.0.0.1:4317/api/cv \| grep -i cache-control` | `Cache-Control: no-store` |
| 1.5 | `curl -s http://127.0.0.1:4317/api/status/providers \| grep -o '"keysConfigured":\[[^]]*\]'` | array of provider names (NOT a number) |
| 1.6 | `Content-Security-Policy` on `/` | `default-src 'self'`; **no** `'unsafe-inline'` in `script-src`; `object-src 'none'`; `frame-ancestors 'none'` |
| 1.7 | `X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy` | `nosniff` / `DENY` / `same-origin` |

> **CSP note for I18N-SPLIT:** the 9 new `<script src="/js/lib/locales/…">` tags are same-origin classic scripts — covered by `script-src 'self'`, no inline JS added. The Playwright smoke's "zero CSP violations" walk confirms it.

---

## §2 — SPA route walk (en + 1 non-en locale)

For each route: open in browser, check H1 text, **no console errors**, **no untranslated `key.path` leaks**, no truncation.

| # | Route | What to verify |
|---|---|---|
| 2.1 | `#/dashboard` | Hero + 2 CTAs · provider chip (`⚡ Live evals: Anthropic <model>` or `📋 Manual prompt mode`) · 4 metric cards · Pipeline tile primary weight |
| 2.2 | `#/pipeline` | Counter accurate · filter chips · `+ Add` toast |
| 2.3 | `#/config → API keys` | `Active: <Provider>` + `Keys: N / 5`; not sticky-overlapping; Save never flashes `0 / 5` |
| 2.4 | `#/cv` | Edit → Save gains `.btn-dirty` · navigate away → unsaved-changes confirm |
| 2.5 | `#/deep` | Saved cards render · brief lacking ≥3/6 H2 → `.brief-warning` |
| 2.6 | `#/help` | TOC scroll-spy: after ~1500 ms `document.body.dataset.tocSpy === "active"`, exactly 1 `.help-toc a.toc-current` |
| 2.7 | `#/health` | Failing rows show `Fix →`; lands on correct config tab |
| 2.8 | `#/auto` | Stepper pre-renders 5 `aria-disabled` steps · ⚡ submit fires SSE |
| 2.9 | `#/scan` | `Open Scan` on top-bar · Advanced filters in `<details>` |
| 2.10 | `#/tracker` | Funnel chips · server-side pagination >50 rows · search `aria-label` |
| 2.11 | `#/evaluate` | Empty JD → distinct localized toast |
| 2.12 | `#/apply` | Interactive checklist · slug substituted |
| extra | `#/this-route-does-not-exist` | `404 — page not found` + Back-to-Dashboard |

**Locale switch:** sidebar footer → `ru`. Verify nav/H1 flip, `<html lang="ru">`, per-route `document.title` updates. (Automated across all 8 locales by §4.)
**Mobile (375 px)** and **`prefers-reduced-motion: reduce`**: no layout break, no fade/slide.

---

## §3 — Notifications drawer
Bell hidden at boot; opens only on bell click / Enter / Space; closes via ×, Esc, re-click. Last 50 toasts, Clear-All + per-entry dismiss, `(METHOD /path · HTTP NNN)` tucked in `<details>`.

---

## §4 — I18N-SPLIT verification — THE HEADLINE REGRESSION (v1.60.0)

### 4.1 File layout exists
```bash
ls public/js/lib/locales/
# → i18n-dict.{en,es,pt-BR,ko,ja,ru,zh-CN,zh-TW}.js  +  i18n-dict.aliases.js   (9 files)
test -f tests/fixtures/i18n-dict.snapshot.json && echo "snapshot present"
```

### 4.2 index.html load order (synchronous, no build, no fetch)
```bash
grep -n 'js/lib/locales/i18n-dict\|js/lib/i18n' public/index.html
# Order MUST be: 8 locale files → i18n-dict.aliases.js → i18n-dict.js (assembler) → i18n.js
```

### 4.3 Lossless migration + parity (the core lock)
```bash
node --test tests/i18n-locale-files.test.mjs
# All pass: assembled dict ≡ snapshot (678 keys) · every locale shares en's key set ·
# alias targets exist & aren't chained · index.html order correct.
node tools/i18n-audit.mjs        # 678 keys × 8 locales · 0 hard failures
```

### 4.4 Assembled dict is byte-identical to pre-split (manual spot-check)
```bash
node --input-type=module -e '
import { loadAssembledDict } from "./tests/helpers/i18n-vm.mjs";
const D = loadAssembledDict();
console.log("keys", Object.keys(D).length);                       // 678
console.log(D["nav.dashboard"].ko, "/", D["nav.dashboard"].ru);   // 대시보드 / Дашборд
console.log(D["nav.apply"]["@alias"]);                            // apply.title
'
```

### 4.5 Every page localizes in every locale (real browser)
```bash
node --test tests/playwright-locale-sweep.mjs
# 8 subtests (one per locale) — each walks all 22 routes:
#   • #content renders non-empty
#   • sidebar nav.dashboard reads the expected per-locale string (never the raw key)
#   • zero console errors
```
Manual confirm (browser): switch locale, the sidebar **Dashboard** label must read
`Panel` (es) · `Painel` (pt-BR) · `대시보드` (ko) · `ダッシュボード` (ja) · `Дашборд` (ru) · `仪表盘` (zh-CN) · `儀表板` (zh-TW).

### 4.6 CI inline gate is real again
The `ci.yml` "Verify i18n coverage" step now loads the per-locale files + alias map + assembler (it had been a silent no-op against an empty dict since the v1.23 split). Confirm it prints `keys 678 × 8 · missing/bad 0` and fails on a `< 600` floor.

---

## §5 — i18n parity sweep
Help bundle parity: **19 H2 / 73 H3 across all 8 locales** (`canonical-docs-coverage`, `help-ru-config-section`, `help-ui` tests).
Per-route H1 spot-checks: `#/pipeline` (es) → `Pipeline de candidaturas`; `#/dashboard` (ru) → `Командный центр`; `#/help` (ja) → `ヘルプ`. Footer hotkey: macOS `⌘K`, else `Ctrl+K`.
```bash
node scripts/check-changelog-parity.mjs    # all 8 locales at v1.60.0
node scripts/check-no-also-leftovers.mjs   # no `.also(` leftovers
node tools/i18n-audit.mjs                  # personal-data / parity / empty / bare-date — 0 hard failures
```

---

## §6 — Full test pyramid (CI-equivalent)
```bash
npm test                  # 1000 / 1000 unit, 0 fail
npm run test:coverage     # line >= 93%, branch >= 83%   (v1.60.0: 95.68% / 87.33%)
npm run test:e2e          # 20 / 20 smoke
npm run test:e2e:full     # 23 / 23 comprehensive
npm run test:e2e:browser  # 70 Playwright (smoke + full-cycle + forms + locale-sweep)
npm run test:ci           # the aggregate hard gate (unit + no-also + changelog-parity + i18n-audit)
```
⚠️ Pre-commit AI review is advisory; **`ci.yml` is the hard gate.** Watch the GitHub Actions run after merge — Node 18 / 20 / 22 + Playwright e2e must all finish `success`.

---

## §7 — Standing invariants (quick reference)
1. **I18N-SPLIT lossless** — assembled dict ≡ `tests/fixtures/i18n-dict.snapshot.json` (678 keys). `t()` and call-sites unchanged.
2. Per-locale key parity — every `locales/i18n-dict.<lang>.js` shares en's key set (`i18n-locale-files`).
3. `@alias` integrity — targets exist, no chains; `nav.config` stays distinct from `config.title` (`i18n-alias`).
4. `index.html` script order: 8 locales → aliases → assembler → `i18n.js`.
5. Help bundle parity: 19 H2 / 73 H3.
6. CSP excludes `'unsafe-inline'` from `script-src`; the locale `<script>`s are same-origin classic scripts.
7. `app.all('/api/*')` JSON-404 for every verb; `req.originalUrl` `..` guard hoisted above route registration.
8. `Cache-Control: no-store` on `GET /api/cv`.
9. Parent career-ops project is read-only — code never writes outside `web-ui/` except on explicit user actions.
10. CHANGELOG parity across all 8 locales (gate).

---

## §8 — Sign-off matrix

| Gate | Pass? |
|---|---|
| §−1 — 4 methodology footguns understood (incl. vm-realm deepEqual + split text-invisibility) | ☐ |
| §0 — `npm test` 1000 / 1000, 0 fail · health version `1.60.0` | ☐ |
| §1 — server envelope probes (incl. #1.3 with `--path-as-is`, CSP no `'unsafe-inline'`) | ☐ |
| §2 — all 13 routes + 1 non-en locale + mobile + reduced-motion | ☐ |
| §3 — notifications drawer interactions | ☐ |
| **§4 — I18N-SPLIT: 9 files · load order · `i18n-locale-files` · audit · locale-sweep (8×22) · CI inline gate** | ☐ |
| §5 — i18n parity gates + H1 spot-checks | ☐ |
| §6 — full pyramid (`npm test` + 3 e2e suites + 70 Playwright + coverage floor) | ☐ |
| §6 — CI matrix (Node 18 / 20 / 22 + Playwright e2e) all `success` after merge | ☐ |
| §7 — standing invariants verified by test names | ☐ |
| Security envelope byte-stable; parent read-only contract preserved | ☐ |

---

## §9 — On failure
1. **Re-check §−1 first** — most "failures" are probe-methodology errors (especially Footgun 3/4 for i18n).
2. Capture route + exact copy + browser/version + locale + screenshot.
3. Identify the failing lock-test: `node --test tests/i18n-locale-files.test.mjs tests/i18n-coverage.test.mjs tests/i18n-alias.test.mjs tests/playwright-locale-sweep.mjs`.
4. File `qa/FIX-PROMPT-v1.60.<N+1>.md` with evidence, the §7 invariant ID, and the fix shape (HOW + TEST + ACCEPTANCE + CHANGELOG ×8 sketch).
5. **Doctrine: one fix per release** (bundled HIGH+LOW only with written audit authorisation).
6. Pre-commit AI review advisory; `ci.yml` hard gate. Pass both before tagging.

**Open out-of-scope items (not regressions):** RTL (Arabic/Hebrew), drag-and-drop reorder, bulk delete, PWA/offline — all post-v1.60. Parent-blocked: `modes/deep.md` (C-1), `modes/oferta.md` (G-005), `portals.yml` (UX-022), CLI locale.

---

## §10 — Doctrine lessons (do not re-learn)
1. ONE fix per release; doctrine exceptions only with audit authorisation.
2. CHANGELOG parity non-negotiable — `check-changelog-parity.mjs` before every commit.
3. `ci.yml` is the hard gate; pre-commit AI review is advisory.
4. `[hidden]` is shadowed by author `display:` rules — add explicit override.
5. `npm test 2>&1 | grep` masks the exit code. Run first, grep second.
6. `cleanLlmMarkdown` is NOT an XSS sanitizer — boundaries are `stripDangerousMarkdown()` (server) + `UI.md()` (client).
7. `PATHS` resolves once per process.
8. `app.get('/api/*')` is GET-only — use `app.all`. Middleware **position** matters as much as content (path-traversal guard hoisted above route registration).
9. `req.url` is normalised; `req.originalUrl` is verbatim — use `originalUrl` for raw-string guards.
10. Playwright `page.goto(url)` is a no-op when only the hash changes — bounce via `about:blank`.
11. **I18N-SPLIT — vm-realm deepEqual:** objects assembled inside `node:vm` have a foreign prototype; `JSON.parse(JSON.stringify(x))` before `deepStrictEqual` against a snapshot.
12. **I18N-SPLIT — single source of truth:** translations live ONLY in `public/js/lib/locales/i18n-dict.<lang>.js`; `i18n-dict.js` assembles, it stores nothing. Tests that scan dict text use the derived `legacyDictText()` (never the assembler).
13. **I18N-SPLIT — load order is load-bearing:** the assembler reads `window.__I18N_DICT_<LANG>` / `__I18N_ALIASES`, so all 9 locale `<script>`s must precede `i18n-dict.js`, which must precede `i18n.js`. Locked by `i18n-locale-files.test.mjs`.
14. **Static lock-tests can pass while user-visible bugs stay open** — a regression-lock must drive the real scenario (the locale-sweep renders every page in every locale), not just `git grep` a symbol.
15. **A "passing" CI step can be a no-op** — the inline i18n check validated an empty dict for ~37 releases after the v1.23 split. Add a sanity floor (`keys < 600 → fail`) so an empty/half-loaded dict can never read as green.

---

*Definitive QA hand-off for v1.60.0. Hand to a human tester or an agent — copy-paste top-to-bottom, fill the §8 matrix, file a FIX-PROMPT on any failure. Generated 2026-05-22 after the I18N-SPLIT refactor: 1000 / 1000 unit · 70 Playwright (incl. 8-locale sweep) · 23 / 23 comprehensive e2e · coverage 95.68% line. No user-facing behaviour change vs v1.59.13.*
