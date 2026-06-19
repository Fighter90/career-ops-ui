# MASTER E2E REGRESSION — career-ops-ui · EVERY BUTTON · EVERY PAGE · EVERY LANGUAGE

> **Version under test:** `package.json` **1.75.2** (parent career-ops **1.12.0** parity).
> **Goal:** drive the *running app* end-to-end and click **every interactive control on every page in every one of the 12 languages**, proving each does what it claims with zero console errors and no layout breakage (incl. Arabic RTL).
> **Role:** strict release-gate QA engineer. This is the exhaustive click-through driver. The unit/CI gate lives in `qa/QA-REGRESSION-PROMPT-v1.75.2-FULL.md`; this file is the **human/agent UI sweep** that the gate can't cover.
> **Output:** save your run report to `key/runs/<YYYY-MM-DD>-E2E-v1.75.2.md` — one row per (page × language × control) with PASS/FAIL + evidence (screenshot path, console-log excerpt, HTTP trace). Any FAIL = one fix-ship (one-fix-per-release; HIGH → MEDIUM → LOW).

---

## 0. How to run

1. **Start the server:** `npm start` → `http://127.0.0.1:4317`. For a clean parent, set `CAREER_OPS_ROOT=$(mktemp -d)` and bootstrap `cv.md` / `config/profile.yml` / `portals.yml` (so writes never hit real user data — CLAUDE.md hard rule #2).
2. **Driver:** Playwright MCP (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_take_screenshot`, `browser_console_messages`). If `chromium_headless_shell` is missing → `npx playwright install chromium-headless-shell`.
3. **Per control, capture:** (a) `browser_console_messages` is empty of errors before+after the click; (b) the expected DOM change / toast / navigation / network call happened; (c) a screenshot when layout matters.
4. **Language loop:** the **language `<select>`** (`#lang-select`, top-right) has 12 options. For EACH locale, re-run the per-page control sweep in §3. Order: `en, es, pt-BR, ko, ja, ru, zh-CN, zh-TW, fr, pl, uk, ar`. The chosen locale persists to `localStorage['career-ops-ui:lang']` and survives reload.
5. **Never** `npm test 2>&1 | grep …` (grep masks the exit code). Run, capture `$?`, grep separately.

---

## 1. What changed recently — verify these deltas first (v1.75.0 → v1.75.2)

| # | Area | Must-see behavior |
|---|---|---|
| 1 | **Scan sources (v1.75.0)** | `/#/scan` **Source** dropdown lists **19** adapters incl. the seven new ones: **RemoteOK, Remotive, Working Nomads, IBM, Arbeitsagentur, Glints, Jobstreet · SEEK**. `GET /api/scan/sources` returns all 19. |
| 2 | **Aggregator selection (v1.75.0)** | Board-wide feeds fire on a bare `provider: <slug>` entry; the four config-driven ones (`ibm:` / `arbeitsagentur:` / `glints:` / `jobstreet:`) read their per-entry block. Copy-paste entries: `docs/portals-examples.md` → "Aggregator boards". |
| 3 | **content_filter (v1.75.0)** | Top-level `portals.yml` sibling of `location_filter` (description/snippet keyword gating). Editable via the raw-YAML editor on `/#/config` (not the field-form). |
| 4 | **Abort-aware pagination (v1.75.1)** | **Stop** during a paginating scan ends it immediately (no 300/200 ms wait-out). |
| 5 | **Non-JSON 2xx error (v1.75.1)** | A source returning an HTML 200 surfaces `non-JSON 2xx response from <url>` in the per-source error log, not a bare `SyntaxError`. |
| 6 | **scan-history hygiene (v1.75.1)** | A vacancy title with `\v \f U+2028 U+2029` does not inject a stray row into `scan-history.tsv`. |
| 7 | **Docs (v1.75.2)** | `/#/help` §5 shows the `content_filter` block + aggregators; §7 lists the 19 sources; §17 says "19 adapters". Verify in **all 12** help bundles (`GET /api/help/<lang>`). |

---

## 2. Cross-cutting controls (test once per language, every language)

- **Sidebar nav (6 groups, 23 items):** every `.nav-item` navigates and sets the active state; focus moves to the new view's `<h1>` (WCAG 2.4.3). Collapsed groups expand/collapse.
- **Language `<select>` (`#lang-select`):** all 12 options switch live; chrome re-localizes with zero console errors; persists across reload. **Arabic → `<html dir="rtl">`**; sidebar/drawer/markdown mirror; switching back to any LTR locale resets `dir="ltr"` (no leaked RTL).
- **Theme toggle:** light/dark persists; tokens (not hardcoded hex) recolor.
- **Mobile drawer (<900 px):** hamburger opens/closes the sidebar; `[hidden]`/class toggle actually hides it (no `display:` override leak).
- **Notifications drawer (bell):** unread badge counts; opens the journal (last 50 toasts, each with its `(METHOD /path · HTTP NNN)` postfix tucked into `<details>`).
- **Footer:** shows web-ui `version` (1.75.2) + `parentVersion` (1.12.0) from `/api/health`.

---

## 3. Per-page control inventory (run the full list in EACH of the 12 languages)

> For every button below: click it, confirm the expected result, confirm console stays clean. Required-field validation must block empty submits with a localized message. Destructive actions must route through the focus-trapped `UI.confirm()` (never native `confirm()`), with Esc/backdrop/×/Cancel all resolving "no".

### 3.1 `#/dashboard` (Command Center)
- Each dashboard **tile** navigates to its route. Stat cards render (no NaN/undefined). Quick-action buttons work.

### 3.2 `#/scan` — **primary v1.75.x surface**
- **🌐 Scan** button → SSE stream starts; determinate progress bar advances; `role=log` console streams; two phase headers (ATS + Regional).
- **Stop** button → aborts mid-stream (test mid-pagination per §1.4); `aria-busy` clears.
- **Source** dropdown → lists all **19** sources; selecting one filters the table.
- **Free-text** filter, **Remote/Hybrid/Onsite** dropdown, salary filter, dynamic **stack/level/keyword chips** → each narrows the results table; `pager.reset()` sends you to page 1.
- **Paginator** (prev/next/page) on the results table.
- **Active Companies** card → lists tracked boards with per-board API health (green ●, gray ○ for unrecognized).
- Append-to-pipeline action (if present) writes `pipeline.md` + `scan-history.tsv`.

### 3.3 `#/pipeline`
- **Preview** (`POST /api/pipeline/preview`) → SSRF-gated; discard-reason shown for rejected URLs.
- **Add / Process** (`POST /api/pipeline`) → URL validated by `isValidJobUrl()` (loopback/file:///script-chars rejected with a localized error).
- Per-row remove/clear controls.

### 3.4 `#/auto` (server-side SSE auto-pipeline)
- **Run** → streams; **Stop** aborts; error banner with **Retry**.

### 3.5 `#/evaluate` (oferta)
- JD/URL field + **Evaluate** → A–G blocks incl. Block G legitimacy; `## Machine Summary`; report header has URL + Legitimacy; output in the active UI locale.
- **Generate PDF** → `/api/stream/pdf/report` → downloads from `output/`.

### 3.6 `#/batch`
- TSV textarea + **Run batch**; **Merge** (`/api/batch/merge` → `merge-tracker.mjs`, file-locked) → no dupes (company+role) after.

### 3.7 `#/deep`
- Company field + **Deep research** → streams; saved-research cards; **Generate PDF**.

### 3.8 Mode pages — `#/project`, `#/training`, `#/followup`, `#/contacto`, `#/cover`, `#/interview-prep`, `#/patterns`
- Each: required-field gating; **Run live** → returns the **final artifact** (e.g. cover letter on `#/cover`), NOT an interactive questionnaire (single-shot contract v1.72.0).
- **Copy**, **Download**, **Open-in-tab** on the result.
- `#/cover`: JD (required) + Company (required) + Role + Greeting → **Generate PDF** (`/api/stream/pdf/inline`).
- Verify the prompt inlines `cv.md` + `config/profile.yml` for whichever provider is configured (6 providers: Anthropic / Gemini / OpenAI / Qwen / OpenRouter / GitHub Models).

### 3.9 `#/apply`
- Apply-checklist form; all field contracts preserved; submit/save controls.

### 3.10 `#/tracker`
- Renders `data/applications.md`; canonical states (`templates/states.yml`); **filter** input → `pager.reset()`; sortable `<th>` headers (aria-sort); paginator.
- Status-edit / note-edit controls (UPDATE existing rows only — never duplicate company+role).

### 3.11 `#/reports`
- List → click a report → `#/reports/:slug` renders; **Generate PDF**; report links are root-relative (clickable from tracker).

### 3.12 `#/activity`
- Activity log renders; paginator; redaction confirmed (no secrets/PII).

### 3.13 `#/cv`
- Markdown editor; **Save** (`PUT /api/cv`) round-trips through `stripDangerousMarkdown` (inject `<script>`/`onerror=` → stripped); **Generate PDF** (`/api/stream/pdf`).

### 3.14 `#/profile`
- Profile field-form (canonical Step-5 schema); non-destructive merge save; raw-YAML fallback for keys not in the field UI (incl. `content_filter`, aggregator `<provider>:` blocks).

### 3.15 `#/config`
- **Profile / Modes / API-keys** tabs → full WAI-ARIA (←/→/Home/End, roving tabindex, `aria-selected`).
- API-keys tab: race-safe summary chip; confirm-gates on destructive saves; `POST /api/config` → `validateConfig` → `updateEnvFile`.
- Raw-YAML editor edits `portals.yml` incl. `content_filter` + aggregator entries → round-trips untouched.

### 3.16 `#/health`
- OK/OPTIONAL/FAIL cards (no overflow, `.health-check-row`); **run doctor / verify-pipeline** buttons stream; Playwright-MCP warning surfaced if absent.

### 3.17 `#/help`
- Locale picker / TOC; **`GET /api/help/<lang>`** serves THIS locale's own bundle (en→en, ar→ar, … no 404, no English fallback for a translated locale).
- Verify the v1.75.2 doc deltas (§1 row 7) are present in the rendered bundle for the active language.
- Each H2/H3 anchor scrolls; 19 H2 / 75 H3 per bundle.

---

## 4. Per-language sweep checklist (repeat for ALL 12 — tick when its §3 pass is clean)

```
[ ] en      [ ] es      [ ] pt-BR   [ ] ko
[ ] ja      [ ] ru      [ ] zh-CN   [ ] zh-TW
[ ] fr      [ ] pl      [ ] uk      [ ] ar (RTL — verify mirroring + no leak back to LTR)
```

For each locale confirm, on every page: (1) no untranslated key leaks (`nav.*`, `*.title` raw keys visible), (2) no Latin-only string on a non-Latin locale where a translation exists, (3) zero console errors during the whole sweep (`tests/playwright-locale-sweep.mjs` is the automated baseline — this is the manual deepening), (4) no clipped/overflowing controls, (5) Arabic stays RTL and LTR locales stay LTR after switching.

---

## 5. Result template (one block per page × language)

```
### <page> · <locale>
- control: <name>  → expected: <result>  → PASS/FAIL  (evidence: <screenshot/console/HTTP>)
- ...
console errors: <none | list>
layout/RTL: <ok | issue>
```

---

## 6. Sign-off floors (all must hold before tagging)

- 23 routes × 12 locales reached, every listed control exercised.
- Zero uncaught console errors in any locale on any page.
- Arabic RTL mirrors correctly; no RTL leak into LTR locales.
- Every destructive action confirm-gated; every required field validated.
- The seven v1.75.0 sources visible + selectable in every locale; help deltas present in all 12 bundles.
- Cross-check against `qa/QA-REGRESSION-PROMPT-v1.75.2-FULL.md` (unit/CI gate) and `qa/REGRESSION-FINAL.md` (invariant ledger) — no contradiction.
