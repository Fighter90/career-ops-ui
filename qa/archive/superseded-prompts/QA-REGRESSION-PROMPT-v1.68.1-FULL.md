# QA REGRESSION PROMPT — career-ops-ui v1.68.1 · FULL / EXHAUSTIVE

> **Scope:** the *entire* project, *all* functionality, as of `package.json` **1.68.1**.
> **Role:** you are a strict release-gate QA engineer. Prove the whole app works,
> correctly and clearly, and that nothing on the regression-locked list has drifted.
> **Output:** save your run report to
> `qa/v54-regression/<YYYY-MM-DD>-REGRESSION-v1.68.1.md` with a PASS/FAIL per item
> and evidence (command output, screenshots, HTTP traces). One finding = one fix-ship.
>
> **Sibling perennials (run alongside, do not duplicate):**
> `REGRESSION-FINAL.md` (§0→§15 invariant ledger + §A exhaustive matrix),
> `UX-AUDIT-PROMPT.md` (Senior-UX heuristic audit vs career-ops.org/docs),
> `FUNCTIONALITY-CHECK.md` (functional-correctness walkthrough). This FULL prompt is
> the **single-pass driver** for the v1.68.1 surface; it folds in the v1.59→v1.68
> features the perennial ledger predates (RSS adapter, per-request fetch-timeout,
> determinate SSE progress bar, French locale, OpenRouter catalogue, multer upload,
> hh.ru HTML scrape, RU multi-page pagination, **scan salary range filter**,
> **60s per-source fetch timeout**, **scan filter-panel rework**).

---

## §−1 — Methodology footguns (READ FIRST)

1. **Never `npm test 2>&1 | grep …`.** `grep` returns 0 on match even when the suite
   failed. Run `npm test`, capture `$?`, *then* grep separately. Same for any
   `git … 2>&1 | tail` — it hides commit-hook failures.
2. **Pre-commit AI review is advisory; `ci.yml` is the hard gate.** A green local
   hook + red CI is possible. Watch the CI run.
3. **`PATHS` resolves once per process.** Don't reimport `paths.mjs` to bust the
   cache; CI-isolated tests bootstrap their own `CAREER_OPS_ROOT`. Lock:
   `tests/paths-once.test.mjs`.
4. **`cleanLlmMarkdown` is NOT an XSS sanitizer.** The XSS boundary is `UI.md()`
   on the client and `stripDangerousMarkdown()` on the CV ingress. Don't conflate.
5. **`[hidden]` is a no-op against an author `display:` rule.** Any component that
   sets `display:flex|grid|inline-flex` needs an explicit `.sel[hidden]{display:none}`
   override (or toggle a class).
6. **Parent career-ops is READ-ONLY.** Tests must not assume it exists; point
   `CAREER_OPS_ROOT` at a `mktemp -d` and write only the files the path needs.
7. **Server error bodies are English-by-policy.** UI strings are localized; server
   500/4xx JSON messages stay English (DOC-1). Don't file these as i18n gaps.

---

## §0 — Pre-flight (HARD GATE — nothing below runs until this is green)

```bash
node -v                       # ≥ 18
node -p "require('./package.json').version"   # → 1.68.1
npm ci                        # clean install; prod deps = express, js-yaml, multer
npm run test:ci               # = npm test + check-no-also-leftovers + changelog-parity + i18n-audit
echo "unit exit: $?"          # MUST be 0
npm run test:e2e              # smoke E2E (tests/e2e.mjs)        → ≥ 20/20
npm run test:e2e:full         # comprehensive E2E               → ≥ 23/23
npm run test:e2e:browser      # 5 Playwright suites             → ≥ 70 green
npm run test:coverage         # ≥ 80% line / ≥ 80% branch on non-trivial logic
```

**Baselines (floors, may only go up):** **≥1063** `node --test` · **≥70** Playwright ·
**≥20** smoke E2E · **≥23** comprehensive E2E · 129 unit test files. If any number is
*below* the README badge (1063), the badge or the suite drifted — STOP and reconcile.

**Gate fails ⇒ abort the cycle.** Do not proceed to manual checks on a red suite.

---

## §1 — Boot & version honesty

- `npm start` → server on `127.0.0.1:4317`, no unhandled rejection in the log.
- `GET /api/health` returns `{ version: "1.68.1", parentVersion: <string|null>, … }`.
  `version` and `parentVersion` are independent — `parentVersion` reflects the parent
  `VERSION` file (or null if no parent present). Footer in the SPA reads `version`.
- All 9 README badges read `tests-1063` and `release-v1.68.1`; the top-of-README
  **"🆕 Latest release — v1.68.1"** blockquote (line 15, all 9 locales) details the
  reworked `#/scan` filter panel + the now-working salary filter.
- `CHANGELOG.{md,es,fr,ja,ko-KR,pt-BR,ru,zh-CN,zh-TW}.md` all carry `[1.67.0]` + `[1.67.1]` + `[1.68.0]` + `[1.68.1]`
  entries (parity gated by `check-changelog-parity.mjs`).

---

## §2 — Every SPA route renders clean (no framework, hash-router)

Load each hash route; assert: an H1 renders, no uncaught console error, no English
bleed in a non-English locale, CSP not violated (no inline-script warning).

```
#/dashboard  #/scan      #/pipeline   #/tracker   #/reports   #/cv
#/config     #/health    #/help       #/auto      #/batch     #/batch-prompt
#/deep       #/contacto  #/outreach   #/project   #/interview-prep
#/portals    #/profile
```

17 view modules back these: `activity, apply, auto, batch, config, cv, dashboard,
deep, evaluate, health, help, mode-page, pipeline, reports, scan, settings, tracker`.
Unknown hash → router error template renders (styled, localized), never a blank page.

---

## §3 — Scanner surface (the v1.66.0 / v1.67.x headline area)

**Sources (12 + registry):** EN ATS — `greenhouse, ashby, lever, workable,
smartrecruiters, workday`; RU — `hh, habr, trudvsem, getmatch, geekjob`; generic —
`rss`. Orchestrators: `en-scanner.mjs` + `ru-scanner.mjs` run **in-process**
(AbortSignal-aware); the buffered `/api/run/*` paths shell out via `runner.mjs`.

- `GET /api/scan/sources` and `GET /api/scan/regional/config` return the configured
  catalogue; `#/scan` source-filter dropdown lists every enabled source incl. RSS.
- **SSE scan:** `GET /api/stream/scan?source=ats|regional|both`. The 🌐 Scan button
  calls `both`. Determinate progress bar advances; per-source detail lines stream;
  results table renders with location / Remote-Hybrid / relocation / salary / source
  filters + dynamic stack/level/keyword chips. Active-Companies card shows API health.
- **Client disconnect** (close the EvenSource / navigate away) aborts in-flight
  fetches — no orphan requests (`AbortSignal` honored end-to-end).
- **Per-request fetch timeout** (`fetch-timeout.mjs`) wraps every source fetch; a slow
  source times out without hanging the whole scan.

**v1.68.0 filter panel + salary filter (regression-lock):**
- `#/scan` results have a labelled `.scan-filters` panel: every filter is a `.field`
  with its **label ABOVE** the control (Search · Work type · Salary from / to · Source
  · Scope). Explicit **Apply** (`scan.applyFilters`) + **Reset** (`scan.resetFilters`)
  buttons drive it (Enter in any text/number field applies); selects apply on change;
  an on-page hint (`scan.filtersHint`) explains it. NOT the old live-on-input wiring.
- Work type filter has an **On-site** option (`scan.onsite`) — Remote / Hybrid /
  On-site / Relocation. All new keys present in 9 locales.
- `window.Skills.parseSalaryRange(str)` extracts numeric bound(s) from the free-text
  salary (`от 100 000 до 200 000 ₽`, `120000-150000 USD`, `$120K–$150K`; K/к ×1000;
  NBSP/comma thousands); `salaryInRange(row, min, max)` keeps a row when its range
  overlaps `[min, max]`. **STRICT (v1.68.0): once a bound is set, rows with NO listed
  salary are HIDDEN** (the previous additive keep-all was the reported "filter does
  nothing" bug). Currency-agnostic (no FX). Lock test: `tests/salary-filter.test.mjs`
  + `tests/scan-advanced-disclosure.test.mjs` (panel structure).

**v1.68.1 timeout (regression-lock):** `DEFAULT_SCAN_TIMEOUT_MS` defaults to **60000**
(15000 v1.63.0 → 30000 v1.67.0 → 10000 v1.67.1 → **60000 v1.68.1**), overridable via
`SCAN_FETCH_TIMEOUT_MS`. 10s fail-fast also cut off slow-but-alive Ashby boards; 60s
lets them return. Trade-off: a dead source holds a concurrency slot for the full minute
and chronic hangers may still time out (a per-source / lower-Ashby-concurrency fix would
address those). Lock test: `tests/fetch-timeout.test.mjs` (`=== 60000`).

**v1.66.0 pagination invariant (regression-lock):**
- `hh.mjs` walks `&page=0,1,2…`; `habr.mjs` walks `&page=1,2,3…` (1-indexed);
  `trudvsem.mjs` pages by `offset` and stops on `meta.total`.
- All three **dedup across pages** (by `id` / `url||id`) and **stop when a page adds
  nothing new**, with a hard `MAX_PAGES = 50` safety cap.
- **First page failing is fatal** (throws, surfaces source-down; hh.ru 403 sets
  `geoBlocked`); a *later* page failing is **non-fatal** — keep what was collected.
- Per-page fetch keeps the existing timeout + `AbortSignal`.
- Lock tests: `tests/ru-scanner.test.mjs`, `tests/sources-trudvsem.test.mjs`.

**v1.65.0 lock:** `hh.mjs` scrapes `hh.ru/search/vacancy` (server HTML), NOT
`api.hh.ru`; no `undici`, no `HH_PROXY`/`HH_USER_AGENT`. Prod deps stay
`express + js-yaml + multer` only.

---

## §4 — LLM / evaluation surface (4-provider OR matrix)

Providers: **Anthropic | Gemini | OpenAI | Qwen** (`anthropic.mjs`, `openai.mjs`,
Gemini + Qwen via OpenAI-compatible/OpenRouter paths). Model selection persists in
`#/config`/`#/settings`.

- `POST /api/evaluate`, `POST /api/deep`, `POST /api/mode/:slug`,
  `POST /api/apply-helper` — route to the configured provider, honoring the live
  parent `.env` key (not a stale process-start snapshot).
- `POST /api/evaluate/test-anthropic` and `POST /api/evaluate/test-gemini` — key
  smoke tests; return a clear ok/fail without leaking the key.
- `GET /api/openrouter/models` — model-catalogue proxy (`openrouter.mjs`); returns a
  usable list, degrades gracefully (clear error toast) when offline/unauthorized.
- `GET /api/status/providers` — per-provider readiness; `#/config` reflects it.
- **Missing key ⇒ honest failure**, never a silent empty result. Cost hints render
  before an LLM action where the UI promises them.

---

## §5 — Pipeline, tracker & the parent read-only write-through contract

Reads are always safe. **Writes happen only on explicit user actions:**
`POST /api/pipeline`, `POST /api/tracker`, `PUT /api/cv`, `POST /api/jds`,
`DELETE /api/jds/:name`, `DELETE /api/interview-prep/:name`, `POST /api/config`,
`PUT /api/profile`, `PUT /api/modes/_profile`, and the streaming script runners.

- `GET /api/pipeline` lists the inbox; `POST /api/pipeline` appends a URL (gated by
  `isValidJobUrl`); `GET /api/pipeline/preview` fetches a preview (same SSRF gate);
  `DELETE /api/pipeline` clears.
- `POST /api/tracker` appends to `data/applications.md`; **never duplicates** an
  existing company+role (updates in place). Canonical statuses only
  (`templates/states.yml`); score before status in the table.
- `GET/POST /api/reports`, `GET /api/reports/:slug` — report read/append.
- `GET/PUT /api/cv` — CV round-trips through `stripDangerousMarkdown()` on ingress.
- `GET /api/output/pdfs`, `GET /api/output/pdfs/:name`, `POST /api/stream/pdf/inline`,
  `GET /api/stream/pdf{,/deep,/report}` — PDF generation (Playwright).
- Confirm: with `CAREER_OPS_ROOT` pointed at a temp dir, no write ever escapes it; a
  pure GET sweep never mutates parent files.

---

## §6 — Config & Modes field-forms

- `GET/POST /api/config` — round-trips parent `.env` keys; **merge, not replace**
  (writing one field must not wipe the others).
- `GET /api/profile` / `PUT /api/profile`, `GET /api/modes/_profile` /
  `PUT /api/modes/_profile` — user personalization layer (never system-layer).
- `GET /api/modes`, `GET /api/modes/:name` — canonical-schema field-form renders each
  mode; editing one field preserves the rest.
- `GET /api/portals` — portals catalogue for the scan config.

---

## §7 — Security envelope (must stay real, not decorative)

- **CSP** (`server/index.mjs`): `script-src` has **no `'unsafe-inline'`, no
  `'unsafe-eval'`**; `frame-ancestors 'none'`; `style-src` allows
  `'unsafe-inline'` + Google Fonts only. Plus `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`. Every handler is
  `addEventListener` — grep the SPA for `onclick=`/inline `on*=` → must be **zero**.
- **SSRF gate** (`security.mjs::isValidJobUrl`, backed by `isPrivateOrLoopbackHost`/
  `isPubliclyExposed`): blocks loopback, private ranges, `file://`, script chars.
  Every endpoint that fetches a user-supplied URL (`/api/pipeline`,
  `/api/pipeline/preview`) MUST pass through it. Try `http://127.0.0.1`,
  `http://169.254.169.254`, `file:///etc/passwd`, `http://localhost:4317` → all 4xx.
- **Sanitizers:** `stripDangerousMarkdown()` (CV/markdown ingress),
  `sanitizeJobDescription()`, `sanitizePathName()` (path traversal on `:name`/`:slug`
  params — try `../`, absolute paths → rejected). Client XSS boundary is `UI.md()`.
- **Rate limit** (`rate-limit.mjs`) and **file lock** (`file-lock.mjs`) guard write
  endpoints against floods / concurrent writes.

---

## §8 — i18n & docs parity (9 locales)

- Locales: `en, es, fr, ja, ko, pt-BR, ru, zh-CN, zh-TW`. One-file-per-locale under
  `public/js/lib/locales/i18n-dict.<lang>.js` + `i18n-dict.aliases.js`; assembler
  `i18n-dict.js` merges into `window.__I18N_DICT`; `t()` unchanged. **Every key must
  exist in all 9 files** — gated by `npm run audit:i18n` (in `test:ci`). v1.67.0 added
  `scan.salaryFrom` / `scan.salaryTo` (×9); the byte-for-byte assembled-dict snapshot
  (`tests/fixtures/i18n-dict.snapshot.json`) was regenerated for exactly those 2 keys.
- Per-locale render sweep: switch language, walk every `#/` route, assert no English
  bleed (except server error JSON, which is English-by-policy).
- **Help bundles** (`GET /api/help/:lang`): **19 H2 / 73 H3** parity across locales
  (locks: `canonical-docs-coverage`, `help-ru-config-section`, `help-ui` tests).
  In-app `#/help` full-text search filters sections.
- README: all 9 link Français + state 9 languages; CHANGELOG parity at 1.68.1;
  `LOCALIZATION.md` lists fr and the 19 H2 count.

---

## §9 — Endpoint contract sweep (every route honours its contract)

Hit each and assert correct method, status, content-type, and shape. GET set is
side-effect-free:

```
GET  /api/health · /api/activity · /api/dashboard · /api/config · /api/cv · /api/profile
GET  /api/portals · /api/modes · /api/modes/:name · /api/modes/_profile
GET  /api/jds · /api/jds/:name · /api/interview-prep · /api/interview-prep/:name
GET  /api/reports · /api/reports/:slug · /api/tracker · /api/batch
GET  /api/pipeline · /api/pipeline/preview · /api/scan-results · /api/scan/sources
GET  /api/scan/regional/config · /api/status/providers · /api/openrouter/models
GET  /api/output/pdfs · /api/output/pdfs/:name
GET  /api/stream/{scan,scan-parent,batch,liveness,pdf,pdf/deep,pdf/report}   (SSE)
POST /api/{evaluate,evaluate/test-anthropic,evaluate/test-gemini,deep,mode/:slug}
POST /api/{apply-helper,auto-pipeline,pipeline,tracker,reports,jds,config,batch/merge}
POST /api/stream/pdf/inline
PUT  /api/{cv,profile,modes/_profile,batch}
DELETE /api/{pipeline,jds/:name,interview-prep/:name}
GET  /api/*  → 404 JSON ; GET *  → SPA index (catch-all)
```

15 route modules register these: `registerActivityRoutes, registerAutoPipelineRoutes,
registerBatchRoutes, registerConfigRoutes, registerContentRoutes, registerHealthRoutes,
registerHelpRoutes, registerJdsRoutes, registerLlmRoutes, registerOpenrouterRoutes,
registerPipelineRoutes, registerReportsRoutes, registerRunnerRoutes, registerScanRoutes,
registerTrackerRoutes`. `server/index.mjs` is a ~130-LOC orchestrator only.

---

## §10 — Deploy hygiene & resilience

- No `.env` committed; `.env.example` has placeholders only.
- `node scripts/portals-health-check.mjs` audits `portals.yml` reachability.
- Server survives a downed source (per-source failure is non-fatal, surfaced as a
  toast in the notifications drawer 🔔 — the only place toasts re-surface).
- SSE endpoints flush headers immediately and clean up on disconnect.
- `UI.toast(msg, kind)` is the only user-facing diagnostic channel (auto-tucks a
  trailing `(METHOD /path · HTTP NNN)` into a collapsed `<details>` and journals it);
  no ad-hoc `console.log` for user-facing errors.

---

## §11 — Sign-off matrix

| # | Area | Gate | PASS/FAIL | Evidence |
|---|---|---|---|---|
| 0 | Pre-flight | test:ci + e2e + e2e:full + e2e:browser + coverage all green | | |
| 1 | Boot & version | /api/health = 1.68.1; badges (1063); CHANGELOG ×9 | | |
| 2 | SPA routes | all 19 hash routes render clean, no console error | | |
| 3 | Scanner | 12 sources; SSE both; **RU pagination lock**; hh.ru scrape lock; **salary от/до filter (strict)**; **labelled panel + Apply**; **On-site**; **60s timeout** | | |
| 4 | LLM | 4-provider matrix; live-`.env` key; OR catalogue; status | | |
| 5 | Pipeline/tracker | write-through only on user action; no dup; temp-root isolation | | |
| 6 | Config/Modes | merge-not-replace; field-forms intact | | |
| 7 | Security | CSP (no unsafe-inline/eval); SSRF 4× blocked; sanitizers; path-traversal | | |
| 8 | i18n/docs | 9-locale key parity; 19 H2 / 73 H3 help; no English bleed | | |
| 9 | Endpoints | every route honours method/status/shape | | |
| 10 | Deploy/resilience | no .env; downed-source non-fatal; SSE cleanup | | |

---

## §12 — On failure

One finding = one fix-ship, severity-ordered (HIGH → MEDIUM → LOW), **never batched**:
bump `package.json` + CHANGELOG ×9 (parity-gated) + a regression-lock test +
Playwright-verify the screen + pre-commit AI-review to LGTM + `ci.yml` green + redeploy.
Never `--no-verify`, never `--force`, never `git reset --hard` without explicit user
approval. Save the run report under `qa/v54-regression/`.

**Known open item (do not re-file):** G-005 — `oferta.md` report blocks A-G vs
canonical career-ops.org A-F. Cross-repo, blocked on a parent commit (hard rule #1
forbids editing the parent). Nomenclature drift, not a functional break. See
`G-005-closure-kit.md`.
