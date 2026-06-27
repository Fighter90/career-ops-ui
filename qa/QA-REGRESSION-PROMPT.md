# QA REGRESSION PROMPT — career-ops-ui **v1.78.1** (DEFINITIVE · WHOLE PROJECT · ALL LANGUAGES)

Single standalone hand-off for a QA tester (human or agent) to verify the **entire** career-ops-ui build end-to-end, in **all 13 languages**. Walking this top-to-bottom signs off the build without needing the rest of the `qa/` tree.

- **Version under test:** `package.json` **1.78.1** · parent career-ops **1.13.0** parity.
- **Baseline:** **1238** `node --test` cases · Playwright (smoke + full-cycle + forms + **locale-sweep ×13** + theme-toggle) · 20 smoke E2E · 23 comprehensive E2E · CI matrix green on Node 18/20/22 + Playwright + CodeQL.
- **Server:** `npm start` → `http://127.0.0.1:4317`.
- **Sibling docs:** `qa/QA-REGRESSION-PROMPT-v1.76.0-FULL.md` (parent-parity gate driver) · `key/E2E-REGRESSION-EVERY-BUTTON-EVERY-LANGUAGE-v1.78.0.md` (exhaustive UI click-through) · `REGRESSION-FINAL.md` (invariant ledger).

---

## §0 — Gates (all must be green before sign-off)

```bash
npm test                                    # full suite (≥1238 cases)
npm run test:ci                             # unit + check-no-also + check-changelog-parity + i18n-audit
node tools/i18n-audit.mjs                   # "no hard failures — dictionary is clean"
node scripts/check-changelog-parity.mjs     # "all 12 locales at v1.78.1" (EN + 12 = 13 files)
npm run test:coverage                       # ≥80% line / ≥75% branch (baseline ~93/~83)
npm run test:e2e:browser                    # playwright smoke + full-cycle + forms + locale-sweep(13) + theme-toggle
npm run test:e2e && npm run test:e2e:full   # smoke (20) + comprehensive (23) E2E
node scripts/portals-health-check.mjs       # portals.yml reachability (informational)
```
**Never** `npm test 2>&1 | grep …` — grep masks the exit code. Run, capture `$?`, grep separately. Same for `git … 2>&1 | tail`.

---

## §1 — Methodology footguns (READ FIRST)

1. **Assert behaviour, not filenames.** Helpers may be inlined in a view (`git grep` the behaviour marker, not an imagined filename).
2. **Raw-path SSRF probe:** `curl --path-as-is "http://127.0.0.1:4317/api/jds/../../../etc/passwd"` → `{"error":"invalid path"}`. Plain `fetch`/`curl` normalise the URL and never hit the guard.
3. **Pre-commit AI review is advisory; `ci.yml` is the hard gate.** Watch the CI run.
4. **`PATHS` resolves once per process.** Don't reimport `paths.mjs`; CI-isolated tests bootstrap their own `CAREER_OPS_ROOT`. A test that sets `CAREER_OPS_ROOT` in `before()` must load paths.mjs carriers via dynamic `import()` inside `before()`. Guards: `tests/paths-once.test.mjs`, `tests/test-root-isolation.test.mjs`.
5. **`cleanLlmMarkdown` is NOT an XSS sanitizer.** XSS boundary = `UI.md()` (client) + `stripDangerousMarkdown()` (CV ingress) + `sanitizeJobDescription()` (JD). `scan-sanitize.mjs` is a write/egress sanitizer, not XSS.
6. **`[hidden]` is a no-op against an author `display:` rule** — components with `display:flex|grid` need an explicit `.sel[hidden]{display:none}`.
7. **Parent career-ops is READ-ONLY** (hard rule #1). Tests must not assume it exists.
8. **Server error bodies are English-by-policy.** Only client UI strings are localized.
9. **Two scanner registries — don't conflate.** `server/lib/sources/registry.mjs` (auto-discovered `meta`) drives the `#/scan` *dropdown* + RU dispatch; `server/lib/portals/registry.mjs` (`ALL_ADAPTERS`, hand-maintained) is what the EN scanner walks to *fetch*. A new EN board needs BOTH.
10. **Playwright headless shell:** missing → `npx playwright install chromium-headless-shell` (env gap, not a regression).
11. **Cross-realm vm arrays:** spread (`[...]`) a vm-realm array before `deepEqual` against a main-realm literal.

---

## §2 — What changed recently (verify these deltas first)

| # | Area (release) | Must-see behaviour |
|---|---|---|
| 1 | **6 new ATS sources (v1.76.0 — parent v1.13.0)** | `#/scan` **Source** dropdown lists **25** adapters incl. **BambooHR, Breezy HR, Comeet, Personio, Recruitee, SolidJobs**. `GET /api/scan/sources` returns 25 (20 EN + 5 RU). Per-tenant ATS auto-detect from `careers_url` host (Comeet from full `api:`); each pins host with an anchored regex + `redirect:'error'` (SSRF). |
| 2 | **trust_filter (v1.76.0)** | `trust_filter: {enabled:true}` in `portals.yml` → low-trust rows get a **⚠ score** badge (tooltip = flag codes). Annotate-only; NEVER drops a row. Absent → no badge. |
| 3 | **No result cap (v1.76.0)** | `MAX_STORED_RESULTS` removed. A scan with >2000 matches stores them all; the table pages **200/row** through everything (pager under the table). Nothing truncated. |
| 4 | **Title-filter robustness (v1.76.0)** | `title_filter.negative:['coo']` does NOT drop "Coordinator" (word-boundary acronyms); malformed `title_filter` entries don't crash a scan. EN + RU scanners. |
| 5 | **Arbeitsagentur remoteMatch (v1.76.0)** | `remoteMatch: title\|filter\|off` + `remoteMaxPages` (server-side `homeoffice=nv_true` + pagination on `filter`). |
| 6 | **Danish — 13th locale (v1.77.0)** | `#lang-select` has **🇩🇰 Dansk**; selecting it localizes the chrome and `GET /api/help/da` serves the Danish bundle. |
| 7 | **Country filter (v1.78.0)** | `#/scan` results panel has a **Country** dropdown listing detected countries with **flag + count** (e.g. `🇩🇪 Germany (12)`). Keeps only rows in that country; composes with the Remote/Hybrid/Onsite filter; **Reset** clears it; pure-Remote / unresolved locations stay under **All countries**. `countries.js` detection is conservative (never guesses). |
| 8 | **Rebrand (v1.78.0)** | Tab title + sidebar logo say **career-ops-ui**; the sidebar logo-mark is the new radar icon; `/favicon.ico`, `/favicon-16.png`, `/favicon-32.png`, `/apple-touch-icon.png` serve 200. |
| 9 | **Scan auto-refresh (v1.78.1)** | The `#/scan` results table updates automatically *during* a scan and once more after the terminal `done` — no manual reload. `runScanAll` polls every 2.5s + does a 300ms post-flush refresh. |
| 10 | **Global search → Scan (v1.78.1)** | Top-bar search badge reads **Enter**. Enter on a URL → auto-pipeline; Enter on any other text → `#/scan` with the search box pre-filled (was `#/tracker`). **Same-route guard:** if already on `#/scan`, it force-re-renders so the prefill is consumed (never leaks to the next visit). |
| 11 | **Logo → home (v1.78.1)** | Clicking the brand logo (now an `<a href="#/dashboard">` with a localized `data-i18n-aria-label="nav.logoHome"`) navigates to the dashboard. Global-search Enter on `#/scan` force-re-renders (same-route guard) so the prefill never leaks. |

---

## §3 — Security envelope (verify once)

- CSP: `default-src 'self'`, `img-src 'self' data:`, NO `'unsafe-inline'`/`'unsafe-eval'` in `script-src`, `frame-ancestors 'none'`. `X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy` set. Every handler is `addEventListener` (no inline `onclick=`).
- SSRF: `isValidJobUrl()` gates `/api/pipeline` + `/api/pipeline/preview`; outbound via `safeGet()` (DNS-pinned redirect revalidation). All 25 source fetchers use `redirect:'error'`; the 6 v1.78 per-tenant ATSes pin host with an anchored regex first.
- XSS: CV/markdown → `stripDangerousMarkdown()` + `UI.md()`; JD → `sanitizeJobDescription()`; slugs → `sanitizePathName()`; scan egress → `scan-sanitize.mjs`.
- Rate-limit on LLM routes; file-lock on tracker writes; activity-log redaction. `.aiignore` excludes real user data; no secrets/PII committed (incl. screenshots).

---

## §4 — Functional spec — every page (run the §6 language loop over all of it)

### 4.1 Dashboard (`#/dashboard`)
Stat cards, funnel chips, quick-action buttons, recent-activity links. Page title localizes; first-paint focuses the `<h1>` (WCAG 2.4.3) without stealing focus.

### 4.2 Scan (`#/scan`) — the heaviest surface
- **🌐 Scan** streams SSE (`start`/`log`/`progress`/`done`/`error`); determinate progress bar; **Stop** aborts immediately mid-paginate; persistent error banner + Retry; `role=log` console (aria-live).
- **Company** select + **Dry-run** checkbox.
- **Filters panel:** Search · Work type (Remote/Hybrid/Onsite/Reloc) · Salary from/to · **Source** (25) · **Country** (🆕 flags + counts) · Scope (all/fresh) · **Apply** + **Reset** (Reset clears Country too).
- **Country filter:** options carry flags + counts; pick `🇩🇪 Germany` → only German-location rows; compose with Work-type=Remote; Reset restores; "All countries" shows all; a pure-Remote row is reachable only under "All countries".
- **Advanced filters** disclosure: stack/level/dynamic chips (multi-select intersection, clear).
- Row badges: **⚠ trust** (when `trust_filter` on) and **⬆ boosted** (when `seniority_boost` set). Pager prev/next through **all** matches (no cap).
- **Active Companies** card: expand, filter, ✓/○ grouping, ↗ careers links, click-to-filter; Workday-blocked 🔒 chip when applicable.

### 4.3 Pipeline (`#/pipeline`)
Add via global search (Enter → AutoPipeline modal; Shift+Enter → add-only); `POST /api/pipeline/preview` modal (discard reason visible); row delete via focus-trapped `UI.confirm()`; virtualizes past 1000 rows.

### 4.4 Evaluate / Deep / Batch / Auto
- `#/evaluate` (oferta): JD/URL input, ⚡ Run-live (honest cost ballpark or manual-mode note), report render (Blocks A–G incl. Block G Legitimacy, `## Machine Summary` YAML, header has URL + Legitimacy), locale directive honored.
- `#/deep`: query, run, saved-research cards, Generate-PDF.
- `#/batch`: batch evaluate; `/api/batch/merge` runs `merge-tracker.mjs` (file-locked) → no dupes (company+role).
- `#/auto`: server-side SSE auto-pipeline (evaluate + report + PDF + tracker).

### 4.5 Modes (`POST /api/mode/:slug`)
Allowlist = batch, contacto, cover, followup, interview-prep, patterns, project, training. Unknown slug → 404; allowlisted-but-missing-template → 404 (not 500). Single-shot artifact contract; `run` flag never echoed into the prompt; 6-provider context inlines `cv.md` + `config/profile.yml` (Anthropic / Gemini / OpenAI / Qwen / OpenRouter / GitHub Models). **Cover** (`#/cover`, JD+Company required) → Generate-PDF.

### 4.6 Apply / Tracker / Reports / CV
- `#/apply`: apply checklist; form contracts.
- `#/tracker`: reads `data/applications.md`; canonical states (`templates/states.yml`); funnel chips; paginator (25/page, `pager.reset()` on filter).
- `#/reports`: list + `#/reports/:slug` render + Generate-PDF; report links root-relative (normalized by `merge-tracker.mjs`).
- `#/cv`: `PUT /api/cv` round-trips through `stripDangerousMarkdown`; Generate-PDF via `/api/stream/pdf`.

### 4.7 Config / Health / Activity / Notifications / Help
- `#/config`: Profile field-form (non-destructive merge), Modes tab, API-keys tab (race-safe summary chip, WAI-ARIA tabs, confirm-gates). `POST /api/config` → `validateConfig` → `updateEnvFile`. The `trust_filter` / per-tenant `careers_url` / `content_filter` keys are edited via the raw-YAML editor (round-trip untouched), not the field-form.
- `#/health`: OK/OPTIONAL/FAIL cards (no overflow); run `doctor.mjs` / `verify-pipeline.mjs`.
- `#/activity`: log; redaction.
- Notifications drawer (🔔): unread badge; journal of last 50 toasts, each `(METHOD /path · HTTP NNN)` postfix in `<details>`; Clear-all + per-entry dismiss.
- `#/help`: **13 markdown bundles** (en, es, pt-BR, ko-KR, ja, ru, zh-CN, zh-TW, fr, pl, uk, **da**, ar); `GET /api/help/<lang>` serves each. Invariant **19 H2 / 75 H3** per bundle (`canonical-docs-coverage` + `help-ui` + `help-ru-config-section`). §7 documents the Source dropdown (25) + the **Country** filter; §17 says **25 adapters**. TOC scroll-spy.

### 4.8 Runners / PDF / OpenRouter / output
Buffered `/api/run/*` (doctor, verify, normalize, dedup, merge, sync-check); streaming `/api/stream/*` (scan, liveness, pdf + /report /deep /inline); `/api/output/pdfs` list + download (Content-Disposition, name sanitized). `/api/openrouter/models` catalogue proxy. PDFs embed fonts.

---

## §5 — Cross-cutting controls (test once per language)

- **Sidebar nav:** every `.nav-item` navigates + sets active state; focus moves to the new `<h1>`; groups expand/collapse. Logo = radar icon + **career-ops-ui** text.
- **Language `<select>` (`#lang-select`):** **13** options switch live; chrome re-localizes, zero console errors; persists to `localStorage['career-ops-ui:lang']` across reload. **ar → `<html dir="rtl">`**; every LTR locale (incl. **da**) resets `dir="ltr"` (no RTL leak).
- **Theme toggle:** light/dark persists; tokens (not hardcoded hex) recolor.
- **Mobile drawer (<900 px):** hamburger opens/closes; hide is real (no `display:` override leak).
- **Global search (`#global-search`, ⌘K/Ctrl-K):** URL → AutoPipeline / add-only; query → in-app filter.
- **Tab title:** per-route `… — career-ops-ui`; default `career-ops-ui — command center`.

---

## §6 — i18n acceptance (all 13 locales)

Locales: `en, es, pt-BR, ko, ja, ru, zh-CN, zh-TW, fr, pl, uk, da, ar` (dict file uses `ko`; help/README/CHANGELOG use `ko-KR`). For EACH locale, re-run §4 + §5 and verify:
1. Every nav label, page title, button, filter label (incl. `scan.lblCountry` / `scan.allCountries`), and help bundle render in that language — no raw `key.path` leaks, no English fallback on a shipped key.
2. Country *names* stay English with flags (intentional — proper nouns); the dropdown **label** + "All countries" are localized.
3. Zero console errors across the full sweep (`tests/playwright-locale-sweep.mjs` is the automated floor; this is the manual deepening).
4. **da:** dashboard, scan (incl. country filter), help, language picker read natural Danish (æ/ø/å).
5. **ar:** RTL mirrors the chrome; LTR locales unaffected after switching away.
6. Parity gates green: `tests/i18n-locale-files.test.mjs` (snapshot + key parity), `tests/i18n-coverage.test.mjs`, `tools/i18n-audit.mjs`, `tests/lang-switcher-rtl.test.mjs` (13 locales).
7. **No hard-coded UI English (v1.78.1 review fixes):** the brand logo announces a localized name via `data-i18n-aria-label="nav.logoHome"` (all 13); `health.title` is translated in EVERY locale incl. the two that previously leaked English — **pl** `Kondycja`, **da** `Systemtilstand`. (Latin locales are exempt from the no-latin-leaks gate, so this is a quality check, not a gate.)

---

## §7 — Docs / branding / release mechanics

- **README ×13** + **CHANGELOG ×13** at **v1.78.0** (parity gate green); each language switcher lists all 13 incl. **Dansk**. README "Latest release" blurb describes the country filter. All 13 `images/dashboard-<locale>.png` regenerated with the new branding.
- **Help ×13** carry the Country-filter bullet; H2/H3 counts unchanged (19/75).
- **Branding:** new radar icon as favicon (`favicon.ico` + 16/32 + apple-touch-icon) and sidebar logo; app name **career-ops-ui** in title + logo. Parent `career-ops` references intentionally unchanged.
- **Release:** `package.json` 1.78.0; footer reads `/api/health`; `parentVersion` = 1.13.0 (independent). Tag `v1.78.0` → `release.yml` → `publish-package.yml` (GitHub Packages). `images/` holds only README/help screenshots (icon masters live in `public/`).

---

## §8 — Exit criteria
- Every (page × control × 13 languages) PASS or a logged FAIL→fix (one-fix-per-release; HIGH → MEDIUM → LOW).
- `npm test` ≥ **1238** green; `npm run test:ci` green; coverage ≥ floor; Playwright (locale-sweep ×13) green; CI matrix green.
- Zero console errors; no RTL leak; no untranslated shipped key; favicon/icon endpoints 200.
- All §2 deltas verified live.
