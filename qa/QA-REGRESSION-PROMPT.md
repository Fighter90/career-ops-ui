# QA REGRESSION PROMPT — career-ops-ui **v1.226.0** (DEFINITIVE · WHOLE PROJECT · ALL LANGUAGES)

Single standalone hand-off for a QA tester (human or agent) to verify the **entire** career-ops-ui build end-to-end, in **all 17 languages**, covering every feature shipped from **v1.76.0 through v1.119.4**. Walking this top-to-bottom signs off that surface without needing the rest of the `qa/` tree. §§ below cover the v1.76→v1.97 surface; **§14 (at the end) covers everything added v1.98→v1.119.4**. **Deltas after v1.119.4 (v1.120 → v1.128) live in the per-release sibling prompts** `qa/QA-REGRESSION-PROMPT-v1.1XX.X.md` — headline changes since: Hindi as the 17th locale (v1.122.0), the CareerOps Manifesto + cvstart.org Methodology/License/Changelog pages (v1.120–v1.121), the external-contributor pack (v1.125.2), the da/hi prompt-locale fix (v1.125.3), the CLI-roster resync + Cursor re-add (v1.126.0/v1.127.0), **parent v1.23.0 parity — Flowxtra/VDAB/iCIMS sources (v1.127.0)**, and **four ports from the parent web app — states.yml live read / name→domain logos / 4-tier score tone / job-facets (v1.128.0)**.

- **Version under test:** `package.json` **1.226.0** · **37 route modules** · **85 sources (80 EN + 5 RU)** · **18 LLM live-eval providers** · **17 locales**. This is the whole-project BASE snapshot; per-release deltas after it live in the sibling `QA-REGRESSION-PROMPT-v1.1XX.X` / `v1.2XX.X` prompts (current tip: **v1.226.0**).
- **Baseline:** **2066** `node --test` cases · Playwright (smoke + full-cycle + forms + **locale-sweep ×17** + theme-toggle) · 20 smoke E2E · 23 comprehensive E2E · CI matrix green on Node 18/20/22 + Playwright + CodeQL.
- **Server:** `npm start` → `http://127.0.0.1:4317`.
- **Sibling docs:** `qa/QA-REGRESSION-PROMPT-v1.1XX.0.md` (per-release delta drivers, v1.90–v1.119.0 incl. the v1.110 milestone snapshot + per-version v1.111/v1.112/v1.113/v1.117/v1.118.0/v1.118.2/v1.119.0/v1.119.2) · `qa/UX-AUDIT-PROMPT.md` (UX audit) · `qa/FUNCTIONALITY-CHECK.md` (functional correctness) · `qa/DESIGNER-EXPORT-PROMPT.md` (design export) · `REGRESSION-FINAL.md` (invariant ledger).

---

## §0 — Gates (all must be green before sign-off)

```bash
npm test                                    # full suite (≥1845 cases)
npm run test:ci                             # unit + check-no-also + check-changelog-parity + i18n-audit
node tools/i18n-audit.mjs                   # "no hard failures — dictionary is clean"
node scripts/check-changelog-parity.mjs     # "all 16 locales at v1.226.0" (EN + 16 = 17 files)
npm run test:coverage                       # ≥80% line / ≥75% branch (baseline ~96/~86)
npm run test:e2e:browser                    # playwright smoke + full-cycle + forms + locale-sweep(16) + theme-toggle
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
12. **hh.ru from a non-Russian IP returns HTTP 451** (geo/legal block, July 2026) — the scan disabling hh with the VPN hint is CORRECT behavior, not a bug. Don't file it; don't "fix" it.
13. **`site/` has a build step — that's the recorded carve-out, not a violation.** The no-bundler rule still applies to `public/`; nothing in `server/`/`public/` may import from `site/`.
12. **Live-LLM routes cascade or fall back.** The AI routes (evaluate/deep/market/career-plan/orientation/cv-studio/memory-suggest/two-pager-draft/mock-interview/networking) run the shared `runActiveProvider` cascade; with no key they return an honest copy-paste **manual prompt** (mode `manual`), never a fabricated answer. Test both paths.
13. **i18n key duplication is invisible to parity.** Duplicate `'key':` lines in a locale dict pass the snapshot (last-wins) but are a CodeQL `js/duplicate-property` defect — grep each dict for dup keys after any fan-out.

---

## §2 — What changed since v1.76.0 (verify these deltas)

### Scanner / parity (v1.76.0 → v1.97.0)

| # | Area (release) | Must-see behaviour |
|---|---|---|
| 1 | **6 new ATS sources (v1.76.0)** | Per-tenant ATSes BambooHR / Breezy HR / Comeet / Personio / Recruitee / SolidJobs / **Teamtailor** + board-wide **We Work Remotely**. Host-detected from `careers_url`; anchored host regex + `redirect:'error'` (SSRF). |
| 2 | **trust_filter (v1.76.0)** | `trust_filter:{enabled:true}` → low-trust rows get a **⚠ score** badge (tooltip = flag codes). Annotate-only; never drops a row. |
| 3 | **No result cap (v1.76.0)** | `MAX_STORED_RESULTS` removed; a >2000-match scan stores all, table pages 200/row. |
| 4 | **Title-filter robustness (v1.76.0 + #1261/v1.79.0)** | `negative:['coo']` doesn't drop "Coordinator" (word-boundary); keywords trimmed BEFORE length check (a whitespace-only keyword is dropped, not a match-everything). EN + RU. |
| 5 | **Country filter (v1.78.0)** | `#/scan` results panel **Country** dropdown (🇩🇪 Germany (12)); composes with Work-type; Reset clears it; pure-Remote/unresolved stay under **All countries**. |
| 6 | **Rebrand + scan UX (v1.78.0/.1)** | Tab/logo say **career-ops-ui** (radar icon favicon set 200); scan auto-refresh during+after; global-search Enter→#/scan prefill (same-route re-render guard); logo→#/dashboard (`nav.logoHome` aria-label). |
| 7 | **13 new scan sources (v1.81.0)** | Arbeitnow / Himalayas / Jobicy / Landing.jobs / 4 Day Week / The Muse / The Hub / Jobspresso (RSS) / Hacker News "Who is hiring?" (Algolia) / JustJoin.it / NoFluffJobs / Pinpoint / Rippling. Registry → **40** adapters. |
| 8 | **NoDesk (v1.82.0)** + **repost/ghost detector (v1.83.0)** | NoDesk board-wide RSS (→ **41** adapters). `#/scan` **🔁 Reposted / ghost roles** panel: `GET /api/scan/reposts` clusters company+role re-listed under different URLs in a 90-day window (read-only, fail-soft). |
| 9 | **Re-apply cooldown + comp→pipeline (v1.84.0)** | `re_apply_windows:` in `config/profile.yml` skips recently-applied roles at a company (log `Cooldown skipped: N`). A salaried offer writes `url \| salary` into `data/pipeline.md` (URL stays dedup key; cell sanitized). |
| 10 | **4 zero-auth providers (v1.87.0)** | **getonbrd** (JSON:API), **amazon** (amazon.jobs), **avature** + **successfactors** (per-tenant HTML ATS). Registry → **45** adapters. |
| 11 | **Scan i18n gaps + X-Powered-By off (v1.88.0)** | 4 new `scan.*` keys ×16; `X-Powered-By` header disabled (`tests/security-headers.test.mjs`). |
| 12 | **Dassault Systèmes + audit sweep (v1.97.0 — parent #1498)** | `#/scan` **Source** dropdown lists **46** adapters; `GET /api/scan/sources` returns **46** (41 EN + 5 RU) including **Dassault Systèmes** (`provider: dassault` or a 3ds.com host; zero-token Exalead XML; host-pinned to `www.3ds.com`). Ported robustness: avature two-variant markup (#1541), getonbrd `published_at>0` guard, successfactors last-page cap (#1528). Server fixes: `safe-fetch` over-cap no longer hangs; SSE `stream.*` activity-logging reachable. SPA: `#/stats` tab async-race guard; mock-interview/networking delete confirms show a body. |

### New pages & features (v1.85.0 → v1.96.0)

| # | Feature (release) | Must-see behaviour |
|---|---|---|
| 13 | **de / it / tr — locales 14–16 (v1.85.0)** | `#lang-select` has 🇩🇪 Deutsch, 🇮🇹 Italiano, 🇹🇷 Türkçe; chrome + `#/help` localize; all three ship README/CHANGELOG. Total **16 locales**. |
| 14 | **`#/stats` Statistics (v1.86.0 base → v1.94.0 rework)** | Three tabs: **Market report** (AI salary/market analysis for target roles + region + **currency selector**; directional-estimate labelled; manual fallback with no key), **My pipeline** (score distribution, status funnel, top companies/roles, applications-over-time, conversion rates — all from your tracker; graceful empty state), **Target-role trend** (vacancy/salary by country + saved-snapshot trend + currency). MD/PDF/copy export via `report-export.js`. |
| 15 | **Two-pager (v1.89.0)** | `#/two-pager` guided builder + **AI-fill** (`POST /api/two-pager/draft`); **Save** → `config/two-pager.yml` (user layer); a `◎` fit badge appears on `#/scan` rows; the two-pager is inlined into eval prompts. |
| 16 | **Mock interview (v1.90.0)** | `#/mock-interview` turn-by-turn chat (`POST /api/mock-interview/turn`) with STAR+R feedback + score + follow-up; **Save transcript** → `interview-prep/mock-*.md`; **Saved sessions** list with view/**delete** (delete confirm shows a body). Manual prompt with no key. |
| 17 | **Networking (v1.91.0)** | `#/networking` builds a who-to-contact + intro-path + outreach-drafts + dossier plan (`POST /api/networking/plan`); save/list/**delete** → `networking/net-*.md`. |
| 18 | **CV Studio (v1.92.0)** | `#/cv-studio`: deterministic **résumé diagnostics** score (client `cv-diagnostics.js`), in-browser **PII privacy mask** (`cv-privacy.js` — email/phone/URL/address; skips year-ranges/ISO dates), and **make-it-human** voice-match rewrite (`POST /api/cv-studio/humanize`, grounded in `voice-dna.md` + `writing-samples/`, no fabrication, no writes). |
| 19 | **Memory (v1.93.0)** | `#/memory` editable about-me note (`GET`/`PUT /api/memory` → `config/memory.md`) + **Suggest from my data** (`POST /api/memory/suggest`). The note is inlined into `bundleProjectContext` so it reaches **every** AI request. |
| 20 | **Career plan (v1.95.0)** | `#/career-plan` (nav **Growth → Career plan** 🧭): horizon (6/12/24) + focus → AI development plan (SWOT, SMART/OKR/WOOP goals, month-by-month roadmap); edit + **Save** → `config/career-plan.md`; MD/PDF export. |
| 21 | **Career orientation (v1.96.0)** | `#/orientation` (nav **Growth → Career orientation** 🧩): **Generate profile** → best-fit archetype vectors + roles + strengths + working-style + development recs; **reflection, not a psychometric test** (no invented achievements, no measured scores); generate-only, MD/PDF export, nothing saved. |

---

## §3 — Security envelope (verify once)

- CSP: `default-src 'self'`, `img-src 'self' data:`, NO `'unsafe-inline'`/`'unsafe-eval'` in `script-src`, `frame-ancestors 'none'`. `X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy` set; `X-Powered-By` disabled. Every handler is `addEventListener` (no inline `onclick=`).
- SSRF: `isValidJobUrl()` gates `/api/pipeline` + `/api/pipeline/preview`; outbound via `safeGet()` (DNS-pinned redirect revalidation). All 46 source fetchers use `redirect:'error'`; per-tenant ATSes (incl. **dassault** → `www.3ds.com`) pin host with an anchored check first. `safe-fetch` size-cap settles cleanly (no hang) on over-cap bodies.
- XSS: CV/markdown → `stripDangerousMarkdown()` + `UI.md()`; JD → `sanitizeJobDescription()`; slugs → `sanitizePathName()`; scan egress → `scan-sanitize.mjs`. All model output in the AI views (`stats`, `career-plan`, `orientation`, `market`, `cv-studio`, `mock-interview`, `networking`, `memory`) renders via `UI.md()`.
- User-layer writes only: `PUT /api/{cv,profile,two-pager,memory,career-plan}`, `POST /api/{pipeline,tracker,reports,jds}`, mock-interview/networking saves (path-contained `sanitizePathName`/`resolveSessionFile`/`resolvePlanFile`). LLM routes carry `llmRateLimit`; tracker writes file-locked; activity-log redacts. `.aiignore` excludes real user data; no secrets/PII committed.

---

## §4 — Functional spec — every page (run the §6 language loop over all of it)

### 4.1 Dashboard (`#/dashboard`)
Stat cards, funnel chips, quick-action buttons, recent-activity links, active-provider chip. Page title localizes; first-paint focuses `<h1>` (WCAG 2.4.3) without stealing focus.

### 4.2 Scan (`#/scan`) — the heaviest surface
- **🌐 Scan** streams SSE (`start`/`log`/`progress`/`done`/`error`); determinate progress bar; **Stop** aborts mid-paginate; persistent error banner + Retry; `role=log` console.
- **Company** select + **Dry-run** + **Max per source** cap.
- **Filters:** Search · Work type (Remote/Hybrid/Onsite/Reloc) · Salary from/to · **Source (50)** · **Country** (flags + counts) · **Posted within** (Any/24h/7d/30d) · Scope (all/fresh) · **Apply** + **Reset**.
- Row badges: **⚠ trust**, **⬆ boosted**, **◎ fit** (two-pager). Pager 200/row through **all** matches.
- **Saved searches** + **★ favorites** (localStorage); **🔁 Reposted / ghost roles** panel; **Active Companies** card (expand/filter/✓○/↗/click-to-filter/🔒 Workday-blocked).

### 4.3 Pipeline (`#/pipeline`)
Add via global search (Enter → AutoPipeline modal; Shift+Enter → add-only); `POST /api/pipeline/preview` modal; row delete via focus-trapped `UI.confirm()`; virtualizes past 1000 rows.

### 4.4 Evaluate / Deep / Batch / Auto
- `#/evaluate` (oferta): JD/URL, ⚡ Run-live (honest cost or manual note), report (Blocks A–G incl. Legitimacy, `## Machine Summary` YAML), locale directive honored; two-pager + memory inlined.
- `#/deep`: query, run, saved-research cards, Generate-PDF.
- `#/batch`: batch evaluate; `/api/batch/merge` runs `merge-tracker.mjs` (file-locked) → no dupes.
- `#/auto`: server-side SSE auto-pipeline (evaluate + report + PDF + tracker).

### 4.5 Modes (`POST /api/mode/:slug`)
Allowlist = batch, contacto, cover, followup, interview-prep, patterns, project, training. Unknown/missing-template → 404 (not 500). Single-shot; `run` flag never echoed; 6-provider context inlines `cv.md` + `config/profile.yml` (+ memory + two-pager). **Cover** (`#/cover`) → Generate-PDF.

### 4.6 Growth — Career plan & Career orientation
- `#/career-plan` (**Growth** group 🧭): horizon (6/12/24) + focus → Generate; editable textarea; **Save** → `config/career-plan.md`; **Preview**; Download .md / Save PDF / Copy. Manual prompt with no key.
- `#/orientation` (**Growth** group 🧩): **Generate profile** → archetype vectors/roles/strengths/working-style/dev-recs; reflection-not-test note; Download .md / Save PDF / Copy; nothing saved.

### 4.7 Statistics (`#/stats`)
Three tabs (**Market report** / **My pipeline** / **Target-role trend**) with a currency selector on Market + Trend, real SVG charts on My pipeline (empty-state when the tracker is empty), and MD/PDF/copy export. Switching tabs rapidly must never leave a stale render (async-race guard).

### 4.8 Candidate tooling — Two-pager / Mock interview / Networking / CV Studio / Memory
- `#/two-pager`: guided builder + AI-fill; Save → `config/two-pager.yml`; feeds the `◎` scan badge.
- `#/mock-interview`: turn-by-turn chat + score/feedback; Save transcript; saved-sessions list with view/delete (delete confirm has a body).
- `#/networking`: plan generate + save/list/delete.
- `#/cv-studio`: diagnostics score + privacy mask + humanize rewrite.
- `#/memory`: about-me note edit/save + Suggest.

### 4.9 Apply / Tracker / Reports / CV
- `#/apply`: apply checklist; form contracts.
- `#/tracker`: reads `data/applications.md`; canonical states (`templates/states.yml`); funnel chips; paginator (25/page).
- `#/reports`: list + `#/reports/:slug` render + Generate-PDF; report links root-relative.
- `#/cv`: `PUT /api/cv` round-trips through `stripDangerousMarkdown`; Generate-PDF; unsaved-buffer guard on nav-away.

### 4.10 Config / Health / Activity / Notifications / Help
- `#/config`: Profile field-form (non-destructive merge), Modes tab, API-keys tab (race-safe summary chip, WAI-ARIA tabs). `trust_filter` / per-tenant `careers_url` / `re_apply_windows` / `content_filter` edited via the raw-YAML editor.
- `#/health`: OK/OPTIONAL/FAIL cards + `Fix →` CTAs; run `doctor.mjs` / `verify-pipeline.mjs`.
- `#/activity`: log; redaction; SSE `stream.*` starts now logged.
- Notifications drawer (🔔): unread badge; journal of last 50 toasts; Clear-all + per-entry dismiss.
- `#/help`: **16 markdown bundles** (`GET /api/help/<lang>`). Invariant **28 H2 / 102 H3** per bundle (`canonical-docs-coverage` + `help-ui` + `help-ru-config-section`). §17 documents adding a job-portal source (**46 adapters**). TOC scroll-spy.

### 4.11 Runners / PDF / OpenRouter / output
Buffered `/api/run/*`; streaming `/api/stream/*` (scan, liveness, pdf + /report /deep /inline); `/api/output/pdfs` list + download; `/api/openrouter/models` catalogue proxy. PDFs embed fonts.

---

## §5 — Cross-cutting controls (test once per language)

- **Sidebar nav:** every `.nav-item` navigates + sets active; focus to new `<h1>`; groups (incl. **Growth**) expand/collapse. Logo = radar icon + **career-ops-ui**.
- **Language `<select>` (`#lang-select`): 16 options** switch live; chrome re-localizes, zero console errors; persists across reload. **ar → `<html dir="rtl">`**; every LTR locale resets `dir="ltr"`.
- **Theme toggle:** light/dark persists; tokens recolor.
- **Mobile drawer (<900 px):** hamburger opens/closes; hide is real (no `display:` override leak); tap-targets adequate.
- **Global search (⌘K/Ctrl-K):** URL → AutoPipeline / add-only; query → `#/scan` prefill.
- **Ask-the-docs launcher (🤖 bottom-right / bottom-left RTL):** present on every page except `#/docs-assistant`; opens/closes; localized; answers from the help guide only; zero console errors.
- **Tab title:** per-route `… — career-ops-ui`.

---

## §6 — i18n acceptance (all 16 locales)

Locales: `en, es, pt-BR, ko, ja, ru, zh-CN, zh-TW, fr, pl, uk, da, ar, de, it, tr` (dict files use `ko`/`zh-CN`; help/README/CHANGELOG use `ko-KR`). For EACH locale, re-run §4 + §5 and verify:
1. Every nav label, page title, button, filter label, and help bundle render in that language — no raw `key.path` leaks, no English fallback on a shipped key. (Recently corrected: uk `config.modes*`, ru `eval.jdLbl`, it `dash.quick.contactoSub`.)
2. Country *names* stay English with flags (intentional); the dropdown label + "All countries" are localized.
3. Zero console errors across the sweep (`tests/playwright-locale-sweep.mjs` is the automated floor).
4. **de/it/tr:** natural German/Italian/Turkish across all pages. **ar:** RTL mirrors the chrome; LTR locales unaffected after switching away.
5. Parity gates green: `tests/i18n-locale-files.test.mjs`, `tests/i18n-coverage.test.mjs`, `tools/i18n-audit.mjs`, `tests/lang-switcher-rtl.test.mjs` (16 locales). Grep each dict for duplicate keys (CodeQL `js/duplicate-property`).

---

## §7 — Docs / branding / release mechanics

- **README ×16** + **CHANGELOG ×16** at **v1.119.4** (parity gate green — `node scripts/check-changelog-parity.mjs`); each language switcher lists all 16. README "Latest release" blurb describes the current release; localized "New:" trailers are native per locale (no English leak).
- **Help ×16** hold the gated **28 H2 / 103 H3**; §17 says **61 adapters — 56 EN + 5 RU**.
- **Branding:** radar-icon favicon set + sidebar logo; app name **career-ops-ui**. Parent `career-ops` references intentionally unchanged.
- **Release:** `package.json` 1.119.4; footer reads `/api/health`; `parentVersion` = 1.19.0 (independent; semver only). Tag `v1.119.4` → `release.yml`; **Publish is triggered by the GitHub Release event** (do NOT also `gh workflow run` — a parallel manual dispatch races the release-triggered run to an E409; the workflow is E409-tolerant) → GitHub Packages. **31 route modules.**

---

## §8 — Exit criteria
- Every (page × control × 16 languages) PASS or a logged FAIL→fix (one-fix-per-release; HIGH → MEDIUM → LOW).
- `npm test` ≥ **1845** green; `npm run test:ci` green; coverage ≥ floor; Playwright (locale-sweep ×16) green; CI matrix green; **CodeQL backlog closed (167→0; final 6 fixed at source in v1.111 — sanitizer escape belt, type-confusion coercion, dynamic-dispatch removal)**.
- Zero console errors; no RTL leak; no untranslated shipped key; no duplicate dict keys; favicon/icon endpoints 200.
- All §2 deltas verified live (scanner 61 adapters incl. Dassault + the v1.118/v1.119 parity batches; the eight v1.85–v1.96 pages; the v1.97 audit fixes) **and all §14 additions (v1.98–v1.119.0)**.

---

## §14 — Additions v1.98 → v1.113 (verify these too)

| # | Feature (release) | Must-see behaviour |
|---|---|---|
| 1 | **In-app bug reporter (v1.98.0)** | Notifications drawer → **🐞 Report a bug** → preview-then-confirm modal with a privacy-floored diagnostic snapshot (app/parent version, screen, browser, `/api/health` checks summary, last 20 errors) + a `co-web-<base36>` dedupe fingerprint → pre-filled GitHub issue. **Never** CV/profile/URLs/keys. |
| 2 | **Portals health (v1.99.0)** | `#/portals` lists every tracked company (provider + enabled); **Check portal health** → `POST /api/portals/health` SSRF-safe probes each `careers_url`, flags dead slugs (dead-first). Read-only. |
| 3 | **Two-pager export + AI auto-fill (v1.100.0)** | `#/two-pager` **✨ AI fill assistant** fills every field live from CV+profile (manual-prompt fallback with no key); **👁 Preview & export** → Download .md / Save as PDF / **Save as DOCX** / Copy. The same DOCX button now appears on market report / career plan / orientation. `.docx` opens in Word. |
| 4 | **CV Doctor (v1.101.0)** | `#/cv-studio` **Tailor to a job** → paste a JD → tailored résumé + cover letter + a **checklist-gate report** (`GATE: PASS\|BLOCKED`). Generic (no hardcoded companies/roles); grounded in CV+profile+two-pager; never fabricates; export bar. |
| 5 | **Ask the docs (v1.102.0)** | `#/docs-assistant` (💬, under Help) answers how-to questions **only** from the help guide in your language, lists the sections used, never reads CV/profile. Manual prompt with no key. |
| 6 | **AI CLI tools (v1.103.0)** | `#/config` **AI CLI tools** tab lists Claude Code/Codex/Gemini/OpenCode/Copilot/Qwen/Antigravity — installed ✓/— + path. Read-only PATH scan; **never executes** a binary. |
| 7 | **Company logos (v1.104.0)** | `#/config` **Appearance → Show company logos** (off by default) → `#/scan` rows show the company's favicon (from its OWN domain via `GET /api/logo`, SSRF-safe, cached); shared ATS hosts show a letter badge; broken logo → letter badge. No third-party logo API. |
| 8 | **AI usage & cost (v1.105.0)** | `#/usage` (💳, next to Health) → per-provider tokens + **estimated USD** over 24h/7d/30d/all; each live call appends to `data/llm-usage.jsonl` (local only); manual-mode runs cost nothing and aren't recorded. Prices editable in `server/lib/llm-pricing.mjs`. |
| 9 | **Security hardening (v1.106–v1.108)** | Route-render error text is escaped before `innerHTML`; profile/config property writes reject `__proto__`/`constructor`/`prototype`; `stripDangerousMarkdown` runs to a fixed point + removes `</script foo>`/unclosed openers; prompt dispatch is own-key+typeof; PDF slug capped before its regex; array `filename` coerced. Valid input unchanged. |
| 10 | **Scan Exclude + pipeline overview (v1.109.0)** | `#/scan` Search treats commas as OR; new **Exclude** field hides rows matching any comma-word (both saved in searches). `#/pipeline` overview strip: **N in inbox · N tracked · Applied/Responded/Interview/Offer**, each chip → `#/tracker`. |
| 11 | **CodeQL backlog closeout (v1.111.0)** | Server-internal security hardening, **no user-facing change**: `stripDangerousMarkdown` escapes any *truncated* dangerous-tag opener (`<script`/`<iframe`/… with no `>`) that survives the strip loop → output provably tag-free; CV import reads the verified-Buffer size via `Number()`; mode role-lines are template **strings** interpolated with `String.replace` (no dynamic dispatch). Verify: CV save/preview still safe, uploads still size-gated, mode prompts render per-locale. |
| 12 | **Docs & QA consolidation (v1.112.0)** | Docs-only: `docs/sdd/CONVENTIONS.md` route count corrected 24→30; this prompt consolidated; +1 oversize-upload coverage test. No behavior change. |
| 13 | **Floating "Ask the docs" launcher (v1.113.0)** | A gradient **robot chat button** floats bottom-right (bottom-left in RTL) on **every** page (`public/js/lib/docs-fab.js`), opening a compact chat over the same grounded `POST /api/docs-assistant/ask` endpoint (help-guide only, never CV/profile). Robot avatar + online status + starter chips; Escape / click-outside / X close it; hidden on `#/docs-assistant`. 6 new i18n keys ×16 (`fab.*` + `docs.err`). Verify per-locale + RTL-mirrored + dark/light + zero console errors. See `qa/QA-REGRESSION-PROMPT-v1.113.0.md`. |
| 14 | **AI usage & cost meter (v1.114.0)** | A compact **USAGE** section sits in the sidebar (above the version footer; fixed bottom-left / bottom-right RTL fallback) on every page — LLM token use over 24h/7d/30d as `<tokens> · <share%>` green bars + an estimated 24h-cost footer, from the read-only `GET /api/usage` rollup (same source as `#/usage`). Collapsible (persists); read-only; cost is an estimate; manual runs are free. 3 new i18n keys ×16 (`hud.*`). See `qa/QA-REGRESSION-PROMPT-v1.114.0.md`. |
| 15 | **Design polish (v1.115.0)** | CSS-only, coral brand kept: metric cards lift + coral border on hover, buttons gain resting shadow + hover lift, `.metric-value` tabular-nums, interactive controls get a soft coral focus halo (NOT a global `*:focus-visible` — the managed-focus route `<h1>`s must stay ring-free; v1.58.x lesson). Motion behind `prefers-reduced-motion`. See `qa/QA-REGRESSION-PROMPT-v1.115.0.md`. |
| 16 | **Usage meter rework + widget E2E (v1.116.0)** | The usage meter is **pinned to the bottom of the sidebar** (fixed, full width) and pads the sidebar so the **menu is never covered**; **refreshes live** (15 s + tab-focus + route); rows show real `<tokens> · <est. cost>` (bars vs 30d), not a 100% share. `cv-import.mjs` reads the buffer size behind a `typeof` barrier (closes CodeQL #384). First real-browser **E2E** (`tests/playwright-widgets.mjs`) drives both persistent widgets. See `qa/QA-REGRESSION-PROMPT-v1.116.0.md`. |
| 17 | **Parent parity pack (v1.117.0)** | Six parent capabilities in the UI: `#/followup` **cadence board** (urgency chips + table + Seed button; fail-soft without the parent), `#/stats` **Rejection patterns** tab (outcome mix + recommendations + per-ATS-vendor advance rate), CV Studio **Add to CV** card (grounded bullets from URL/text — SSRF-gated fetch, suggestions only, NO writes), **4 new scan providers** (beesite/HigherEdJobs/JibeApply/softgarden → **50 adapters, 45 EN + 5 RU**), Apply **knock-out pre-scan** step, `/api/run/reconcile`. 41 new i18n keys ×16. See `qa/QA-REGRESSION-PROMPT-v1.117.0.md`. |
| 18 | **Parent v1.18.0 parity (v1.118.0)** | **9 new scan providers** (csod/Phenom/Radancy/Deutsche Bahn/EchoJobs/TKMS/Heckler & Koch/Rheinmetall/LaraJobs → **59 adapters, 54 EN + 5 RU**) + **Lever EU** (`jobs.eu.lever.co`); canonical **`Hired`** status (whitelist + celebratory badge + job-landed banner + funnel/conversions); `#/stats` **Lifetime** tab relaying parent `stats.mjs` + `salary-gap.mjs` (`GET /api/stats/lifetime`, `GET /api/stats/salary-gap` — zero-token, fail-soft); 28 i18n keys ×16; help §14/§26 ×16 (**103 H3**). See `qa/QA-REGRESSION-PROMPT-v1.118.0.md`. |
| 19 | **hh.ru 451 geo-block (v1.118.1)** | hh.ru serves **HTTP 451** to non-RU IPs on the public search pages (July 2026). `searchHH` flags 451 as `geoBlocked` (like 403) → RU scan **disables hh after the first block** with a per-cause log hint (451 → Russian IP / VPN, see help §7; 403 → anti-bot). Help `### hh.ru` subsection rewritten ×16 ("works from any IP" is gone). A 451 from a non-RU network is ENVIRONMENT, not a regression. See `qa/QA-REGRESSION-PROMPT-v1.118.2.md` §1. |
| 20 | **cvstart.org marketing landing (v1.118.0–.2, PRs #116/#118/#119)** | `site/` — a SEPARATE Astro 7 static artifact (33 pages: 16 locales × home+help + 404), built ONLY in CI (`deploy-pages.yml`, Node 22, paths-filtered; the no-build rule still owns `public/` — carve-out recorded in CLAUDE.md). Build gates in-workflow: `npx astro check` + `scripts/check-i18n.mjs` (16×190 keys). Guards in the main suite: `tests/site-scripts.test.mjs` (+4 — parity gate fails on broken dict; sync-assets never writes outside `site/`). Live: `https://cvstart.org` (EN `/` + 15 prefixes, `/ar/` RTL), facts (version/tests/adapters) are a BUILD-TIME snapshot — stale facts mean redeploy Pages, not a code bug (since v1.119.0 the star counter additionally live-refreshes client-side and a weekly cron rebuilds Pages). `cvstart.ru` → `cvstart.org/ru/<path>` via the separate `cvstart-ru-redirect` repo. |
| 21 | **Parent v1.19.0 parity + landing refresh (v1.119.0)** | **2 new scan providers** (Meituan `zhaopin.meituan.com` / Tencent `careers.tencent.com` — zero-auth Chinese tech-board JSON APIs, keyword fan-out + URL dedup → **61 adapters, 56 EN + 5 RU**); **Workday CXS browser-like headers** (parent #1813 — UA/accept-language/origin/referer derived from the CXS URL; shared `BROWSER_LIKE_USER_AGENT` in `http-json.mjs`, Glints parity); landing: **live client-side GitHub star counter** (`[data-gh-stars]` in `site.js`), **contributors block** (build-time `/contributors` snapshot, bots filtered, 3 site i18n keys ×16 → 193), weekly `schedule:` Pages rebuild + `GITHUB_TOKEN`-authenticated facts. See `qa/QA-REGRESSION-PROMPT-v1.119.0.md`. |
| 22 | **v1.119.1–.2 follow-ups** | `#/scan` Source-dropdown offline fallback synced to **61** + drift guard `tests/scan-fallback-sources.test.mjs` (exact value+label parity — **1845**); **CONTRIBUTING.md** written (the landing/README links now resolve); landing **language flags** (locales.ts `flag` field → switcher + footer grid + lang banner); footer: dead Discussions → **Wiki**, author credit **Sergei Emelianov** (sergey-cv.com · LinkedIn), `footer.createdBy` ×16 (site dicts stay 193 keys); **v1.119.3:** SECURITY.md + private vulnerability reporting enabled on the repo; **v1.119.4:** LICENSE names Sergei Emelianov + NOTICE.md licensing breakdown. See `qa/QA-REGRESSION-PROMPT-v1.119.2.md`. |

**New routes since v1.97:** `POST /api/portals/health`, `POST /api/export/docx`, `POST /api/cv-studio/tailor`, `POST /api/docs-assistant/ask`, `GET /api/cli-detect`, `GET /api/logo`, `GET /api/usage`; v1.117 added followup (31 route modules total). **New i18n:** every one is present + translated in all **16** locales (`i18n-coverage` + `i18n-locale-files` green). **New Help:** each surfaced in `docs/help/*` (in-place for two-pager/CV-Studio/settings/health/scan/pipeline; §-level for portals/docs-assistant where applicable).
