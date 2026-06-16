# QA REGRESSION PROMPT — career-ops-ui v1.70.0 · FULL / EXHAUSTIVE

> **Scope:** the *entire* project as of `package.json` **1.70.0**, with extra
> scrutiny on the v1.70.0 surface: **3 new locales (pl, uk, ar-RTL)**, the
> **flag `<select>` language switcher**, the ported **cover-letter mode**, and
> **parent career-ops v1.11.0** compatibility.
> **Role:** strict release-gate QA engineer. Prove the whole app works and that
> nothing regression-locked has drifted.
> **Output:** save your run report to
> `qa/v55-regression/<YYYY-MM-DD>-REGRESSION-v1.70.0.md` with PASS/FAIL + evidence
> per item. One finding = one fix-ship (one-fix-per-release doctrine).
>
> **Sibling perennials (run alongside, do not duplicate):**
> `REGRESSION-FINAL.md`, `UX-AUDIT-PROMPT.md`, `FUNCTIONALITY-CHECK.md`, and the
> previous `QA-REGRESSION-PROMPT-v1.69.2-FULL.md`. This FULL prompt is the
> single-pass driver for the v1.70.0 surface.

---

## §−1 — Methodology footguns (READ FIRST)

1. **Never `npm test 2>&1 | grep …`.** `grep` returns 0 on match even when the suite failed. Run `npm test`, capture `$?`, *then* grep separately. Same for `git … 2>&1 | tail`.
2. **Pre-commit AI review is advisory; `ci.yml` is the hard gate.** Watch the CI run, not just the local hook.
3. **`PATHS` resolves once per process.** Don't reimport `paths.mjs`; CI-isolated tests bootstrap their own `CAREER_OPS_ROOT`. Locks: `tests/paths-once.test.mjs`, `tests/test-root-isolation.test.mjs`.
4. **`cleanLlmMarkdown` is NOT an XSS sanitizer.** XSS boundary = `UI.md()` (client) + `stripDangerousMarkdown()` (CV ingress).
5. **`[hidden]` is a no-op against an author `display:` rule.** Any component setting `display:flex|grid|inline-flex` needs an explicit `.sel[hidden]{display:none}`.
6. **Parent career-ops is READ-ONLY.** Tests must not assume it exists; point `CAREER_OPS_ROOT` at a `mktemp -d`.
7. **Server error bodies are English-by-policy.** Only client UI strings are localized.
8. **Playwright headless shell:** if browser tests fail at the `before`/launch hook with `Executable doesn't exist … chromium_headless_shell`, run `npx playwright install chromium-headless-shell` — it's an env gap, not a regression.

---

## §0 — Gates (must all be green)

```bash
npm test                                   # expect: # pass 1086  # fail 0
npm run test:ci                            # unit + check-no-also + check-changelog-parity + i18n-audit
node tools/i18n-audit.mjs                  # "no hard failures — dictionary is clean"
node scripts/check-changelog-parity.mjs    # "all 11 locales at v1.70.0"
npm run test:e2e:browser                   # incl. playwright-locale-sweep (12 locales × routes)
npm run test:e2e && npm run test:e2e:full  # smoke (20) + comprehensive (23)
```

Floors (must not drop): **1086** unit · Playwright locale-sweep **12/12** · 20 smoke E2E · 23 comprehensive E2E.

---

## §1 — i18n: the 3 new locales (pl, uk, ar)

1. **Parity.** `tests/i18n-locale-files.test.mjs` green: all 12 locale files share the same **697-key** set; assembled dict ≡ `tests/fixtures/i18n-dict.snapshot.json` (707 keys incl. 10 aliases).
2. **Coverage.** `tests/i18n-coverage.test.mjs` iterates `I18N_LANGS` (now 12) — every key present in pl/uk/ar.
3. **No Latin leaks.** `tests/i18n-no-latin-leaks.test.mjs` includes `uk` + `ar` in `NON_LATIN_LOCALES`; every `*.title` reads in native script (whitelist: CV/API/URL/JD/PDF/TSV/CSV/LinkedIn/OpenAI/OpenRouter/Anthropic/Gemini/Qwen/GitHub/Pipeline).
4. **No personal data.** `tests/i18n-no-personal-data.test.mjs` clean across all 12.
5. **Manual sweep.** In the browser, switch to each of pl/uk/ar and visit every nav route. Confirm: nav labels, page titles, buttons, hints all localized; no raw `key.path` strings; no console errors.
6. **Translation-quality spot-check (human):** these 3 dictionaries are AI-translated (parity-gated, not yet native-reviewed). Spot-check pl/uk/ar nav + dashboard + settings + cover-letter copy for naturalness; file fixes as value-only edits in the locale file.

## §2 — Arabic RTL

1. Switch to Arabic → `document.documentElement.dir === 'rtl'`; switch back to any LTR locale → `dir === 'ltr'`. (`i18n.js` `RTL_LANGS`, e2e.mjs flow 2d asserts this.)
2. Visual: sidebar pinned **right**, main content cleared on the right, nav/text right-aligned, notifications drawer docks **left**, markdown tables/blockquotes right-aligned. (`[dir="rtl"]` block in `app.css`; reference screenshot `images/dashboard-ar.png`.)
3. Mobile (≤768px): off-canvas sidebar slides from the **right** in RTL.
4. LTR locales unchanged (byte-for-byte; the block is scoped under `[dir="rtl"]`).

## §3 — Flag `<select>` language switcher

1. Sidebar shows a single `#lang-select` with 12 options, each `🏳 Label`; current locale preselected.
2. `change` switches locale (re-renders + persists to `career-ops-ui:lang`); reload preserves it.
3. Accessibility: `aria-label` from `top.langLabel` (localized ×12); keyboard-operable; `.lang-select` ≥32px min-height (WCAG 2.5.8 — `tests/qa-report-fixes.test.mjs` UX-A4).
4. CSP-safe: handler via `addEventListener`, no inline JS. No `.lang-btn` remnants in app.js/app.css/tests.
5. Flag glyph degradation: on Windows the flag may render as region letters — the label still identifies the language (acceptable).

## §4 — Cover-letter mode (parent feature port)

1. `#/cover` route renders (under the **Application** nav group). Fields: Job description (required), Company (required), Role, Greeting (optional).
2. `cover` is in the server `MODE_ALLOWLIST`; `POST /api/mode/cover` reads `modes/cover.md` from the parent and bundles `cv.md` / `modes/_profile.md`.
3. With a key configured, "Run live" generates a letter; without, the manual-prompt block is shown. JD sanitization still applies (≥50 chars gate).
4. `cover.*` + `nav.cover` keys present in all 12 locales.

## §5 — Parent career-ops v1.11.0 compatibility

1. `/api/health` reports `parentVersion` `1.11.0`.
2. `data/applications.md` remains the markdown source of truth; the v1.11.0 SQLite tracker index is a derived cache the UI does not depend on. Tracker reads/writes still work (header-mapped columns).
3. Scan, evaluate, deep, apply, pipeline, tracker flows unaffected.

## §6 — Deferred parent features (NOT in v1.70.0 — verify they are absent-by-design, then triage for a follow-up)

These shipped in parent career-ops v1.10.0/v1.11.0 but are **not yet surfaced** in the SPA. Confirm nothing half-wired leaked in, and prioritize for the next release:

- **Interactive interview onboarding** (`modes/interview.md`) — multi-turn; poor fit for the single-shot mode runner. Needs a bespoke flow.
- **Reverse-ATS discovery** (`scan-ats-full.mjs`) — CLI-side; would need an in-process adapter + UI surface.
- **Newer scan providers / SolidJobs (#853), scan-history TTL + recheck (#895), `--rediscover-404` (#808)** — parent scanner internals; web-ui has its own source registry (P-14) so these need per-adapter ports.
- **In-app help guide** (`docs/help/`) for pl/uk/ar — currently falls back to `en.md`. Translating the 9th→12th help bundles (19 H2 / 75 H3 parity) is the natural follow-up.
- **OpenCode first-class parity (#707)** — verify the SPA's command surface still matches the parent docs.

## §7 — Docs & release hygiene

1. README badges show `v1.70.0`; switcher line lists all 12 locales; `README.{pl,uk,ar}.md` exist and reference `career-ops.org` + OpenCode/Qwen.
2. `canonical-docs-coverage` green (9 gated READMEs + 9 help bundles unchanged).
3. CHANGELOG: en + all 11 locale files at `## [1.70.0]`; parity gate green.
4. `images/dashboard-{pl,uk,ar}.png` exist; all 12 regenerated. **⚠ Privacy:** dashboard screenshots embed live data (counts + latest evaluation title) — confirm nothing sensitive is exposed before the repo goes/ stays public; regenerate against a clean fixture profile if needed.
5. Docs count refs updated to 12 locales (CLAUDE.md, CONVENTIONS.md, OVERVIEW.md, LOCALIZATION.md).
