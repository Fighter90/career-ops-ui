# MASTER E2E REGRESSION — career-ops-ui · EVERY BUTTON · EVERY PAGE · EVERY LANGUAGE (v1.78.0)

> **Version under test:** `package.json` **1.78.0** (parent career-ops **1.13.0** parity).
> **Covers the untested release train:** v1.76.0 (6 new ATS sources + `trust_filter` + uncapped scan + title-filter robustness) → v1.77.0 (**Danish**, 13th locale) → v1.78.0 (**Scan country filter**).
> **Goal:** drive the *running app* end-to-end and click **every interactive control on every page in every one of the 13 languages**, proving each does what it claims with zero console errors and no layout breakage (incl. Arabic RTL).
> **Role:** strict release-gate QA engineer. This is the exhaustive click-through driver. The unit/CI gate lives in `qa/QA-REGRESSION-PROMPT-v1.76.0-FULL.md`; this file is the **human/agent UI sweep** the gate can't cover.
> **Output:** save your run to `key/runs/<YYYY-MM-DD>-E2E-v1.78.0.md` — one row per (page × language × control) with PASS/FAIL + evidence (screenshot path, console-log excerpt, HTTP trace). Any FAIL = one fix-ship (one-fix-per-release; HIGH → MEDIUM → LOW).

---

## 0. How to run

1. **Start the server:** `npm start` → `http://127.0.0.1:4317`. For a clean parent, set `CAREER_OPS_ROOT=$(mktemp -d)` and bootstrap `cv.md` / `config/profile.yml` / `portals.yml` (writes never hit real user data — CLAUDE.md hard rule #2).
2. **Driver:** Playwright MCP (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_take_screenshot`, `browser_console_messages`). Missing shell → `npx playwright install chromium-headless-shell`.
3. **Per control, capture:** (a) console is error-free before+after; (b) the expected DOM change / toast / navigation / network call happened; (c) a screenshot when layout matters.
4. **Language loop — now 13:** the language `<select>` (`#lang-select`, top-right) has **13** options. For EACH locale, re-run the per-page sweep in §3. Order: `en, es, pt-BR, ko, ja, ru, zh-CN, zh-TW, fr, pl, uk, da, ar`. Selection persists to `localStorage['career-ops-ui:lang']` and survives reload. **`ar` → `<html dir="rtl">`**; every other locale (incl. the new **da**) is LTR.
5. **Never** `npm test 2>&1 | grep …` (grep masks the exit code). Run, capture `$?`, grep separately.

---

## 1. What changed recently — verify these deltas FIRST

| # | Area (release) | Must-see behavior |
|---|---|---|
| 1 | **Scan sources (v1.76.0)** | `/#/scan` **Source** dropdown lists **25** adapters incl. the six new per-tenant ATSes: **BambooHR, Breezy HR, Comeet, Personio, Recruitee, SolidJobs**. `GET /api/scan/sources` returns all 25 (20 EN + 5 RU). |
| 2 | **Per-tenant detection (v1.76.0)** | A `tracked_companies` entry with `careers_url: https://<tenant>.bamboohr.com` (or `.breezy.hr`, `.jobs.personio.de`, `.recruitee.com`, `solid.jobs/public-api/offers/<div>`) is scanned without a `provider:`; Comeet needs the full `api:` careers-api URL. Off-domain host → "untrusted hostname" in the per-source error log. |
| 3 | **trust_filter (v1.76.0)** | With `trust_filter: { enabled: true }` in `portals.yml`, low-trust rows (shortener domain / company↔domain mismatch / missing URL) show a **⚠ score** badge in the results table (tooltip lists flag codes). It NEVER drops a row. No `trust_filter` → no badge. |
| 4 | **No result cap (v1.76.0)** | A scan yielding >2000 matches stores them all; the table pages 200/row through everything (pager under the table). Nothing truncated. |
| 5 | **Title filter (v1.76.0)** | `title_filter.negative: ['coo']` does NOT drop "Coordinator"; malformed `title_filter` entries don't crash a scan. |
| 6 | **Danish — 13th locale (v1.77.0)** | `#lang-select` has a **🇩🇰 Dansk** option; selecting it localizes the whole chrome + `/#/help` serves the Danish bundle (`GET /api/help/da`). `images/dashboard-da.png` exists. |
| 7 | **Country filter (v1.78.0)** | `/#/scan` results panel has a **Country** dropdown (localized label) listing detected countries with **flag emoji + count** (e.g. `🇩🇪 Germany (12)`). Selecting one keeps only rows in that country; **Reset** clears it; it composes with the Remote/Hybrid/Onsite work-type filter. Pure "Remote" / unresolved locations stay under **All countries**. |

---

## 2. Cross-cutting controls (test once per language, every language)

- **Sidebar nav:** every `.nav-item` navigates + sets active state; focus moves to the new view's `<h1>` (WCAG 2.4.3); collapsed groups expand/collapse.
- **Language `<select>` (`#lang-select`):** all **13** options switch live; chrome re-localizes, zero console errors; persists across reload. **ar → `<html dir="rtl">`**; switching back to any LTR locale (incl. **da**) resets `dir="ltr"` (no leaked RTL).
- **Theme toggle:** light/dark persists; tokens (not hardcoded hex) recolor.
- **Mobile drawer (<900 px):** hamburger opens/closes; `[hidden]`/class toggle actually hides (no `display:` override leak).
- **Notifications drawer (bell):** unread badge counts; journal lists last 50 toasts, each `(METHOD /path · HTTP NNN)` postfix in a `<details>`; Clear-all + per-entry dismiss.
- **Global search (`#global-search`, ⌘K/Ctrl-K):** URL → AutoPipeline modal (Enter) / add-only (Shift+Enter); query → in-app filter.

---

## 3. Per-page control sweep (run for EACH of the 13 languages)

For every page: navigate, snapshot, assert the localized `<h1>`, click every button/link/select/input, confirm behavior + clean console.

- **Dashboard (`#/dashboard`):** stat cards, funnel chips, quick-action buttons, recent activity links.
- **Scan (`#/scan`)** — the heaviest surface this cycle:
  - **🌐 Scan** button streams SSE (start/log/progress/done); **Stop** aborts immediately mid-paginate; progress bar determinate; error banner + Retry.
  - **Company** select + **Dry-run** checkbox.
  - Results **filters panel**: **Search**, **Work type** (Remote/Hybrid/Onsite/Reloc), **Salary from/to**, **Source** (25), **Country** (🆕 flags + counts), **Scope** (all/fresh); **Apply** + **Reset** (Reset clears Country too).
  - **Country filter checks:** options carry flags; counts match; pick `🇩🇪 Germany` → only German-location rows remain; combine with Work-type=Remote; Reset restores; "All countries" shows everything; a pure-Remote row is reachable only under "All countries".
  - **Advanced filters** disclosure: stack/level/dynamic chips (multi-select intersection; clear).
  - **trust** ⚠ badge (when `trust_filter` on); **⬆ boosted** badge (when `seniority_boost` set); pager prev/next pages through ALL matches.
  - **Active Companies** card: expand, filter, ✓/○ grouping, ↗ careers links, click-to-filter.
- **Pipeline (`#/pipeline`):** add via search, preview modal (discard reason), row delete (UI.confirm modal), virtualization past 1000 rows.
- **Evaluate (`#/evaluate`):** JD/URL input, ⚡ Run-live (cost ballpark), report render (A–G + Legitimacy).
- **Deep (`#/deep`):** query, run, saved-research cards, Generate-PDF.
- **Apply (`#/apply`):** checklist controls; form contracts.
- **Tracker (`#/tracker`):** funnel chips, status edits, paginator (25/page, resets on filter).
- **Reports (`#/reports`):** list, open `#/reports/:slug`, Generate-PDF.
- **CV (`#/cv`):** edit, Save (`PUT /api/cv` through `stripDangerousMarkdown`), Generate-PDF.
- **Modes (`#/<mode>`: cover, contacto, followup, interview-prep, patterns, project, training, batch):** form fields, ⚡ Run-live, single-shot artifact, provider context; **cover** → Generate-PDF.
- **Config (`#/config`):** Profile field-form (non-destructive merge), Modes tab, API-keys tab (race-safe chip, WAI-ARIA tabs, confirm-gates), raw-YAML editor (the `trust_filter` / per-tenant `careers_url` / country data round-trip untouched).
- **Health (`#/health`):** OK/OPTIONAL/FAIL cards (no overflow), run doctor/verify buttons.
- **Activity (`#/activity`):** log entries, redaction.
- **Help (`#/help`):** TOC spy, all H2/H3 anchors, language matches `#lang-select` (incl. **da**), §7 documents the **Country** filter, §17 says **25 adapters**.

---

## 4. Per-language acceptance (all 13)

For each of `en, es, pt-BR, ko, ja, ru, zh-CN, zh-TW, fr, pl, uk, da, ar`:
1. Every nav label, page title, button, filter label, and help bundle renders in that language (no raw `key.path` leaks, no English fallback on a shipped key).
2. The **Country** dropdown label + "All countries" option are localized (`scan.lblCountry` / `scan.allCountries`); the country *names* stay in English with flags (intentional — proper nouns).
3. Zero console errors across the full page sweep (`tests/playwright-locale-sweep.mjs` is the automated floor; this is the manual deepening).
4. **da specifically:** dashboard, scan (incl. country filter), help bundle, and the language picker all read natural Danish (æ/ø/å).
5. **ar specifically:** RTL mirrors the chrome; LTR locales unaffected after switching away.

---

## 5. Exit criteria

- Every (page × control × 13 languages) row PASS or a logged FAIL→fix.
- `npm test` green (≥**1229**), `npm run test:e2e:browser` green (locale-sweep ×13), CI green.
- No console errors anywhere; no RTL leak; no untranslated shipped key.
- The seven §1 deltas all verified live.
