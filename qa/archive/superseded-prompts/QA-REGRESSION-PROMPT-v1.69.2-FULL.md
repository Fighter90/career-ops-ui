# QA REGRESSION PROMPT — career-ops-ui v1.69.2 · FULL / EXHAUSTIVE

> **Scope:** the *entire* project, *all* functionality, as of `package.json` **1.69.2**.
> **Role:** you are a strict release-gate QA engineer. Prove the whole app works,
> correctly and clearly, and that nothing on the regression-locked list has drifted.
> **Output:** save your run report to
> `qa/v54-regression/<YYYY-MM-DD>-REGRESSION-v1.69.2.md` with a PASS/FAIL per item
> and evidence (command output, screenshots, HTTP traces). One finding = one fix-ship.
>
> **Sibling perennials (run alongside, do not duplicate):**
> `REGRESSION-FINAL.md` (§0→§15 invariant ledger + §A exhaustive matrix),
> `UX-AUDIT-PROMPT.md` (Senior-UX heuristic audit vs career-ops.org/docs),
> `FUNCTIONALITY-CHECK.md` (functional-correctness walkthrough). This FULL prompt is
> the **single-pass driver** for the v1.69.2 surface; it folds in the v1.59→v1.69
> features the perennial ledger predates (RSS adapter, per-request fetch-timeout,
> determinate SSE progress bar, French locale, OpenRouter catalogue, multer upload,
> hh.ru HTML scrape, RU multi-page pagination, scan salary range filter,
> 60s per-source fetch timeout, scan filter-panel rework, **P-14 plug-in scanner
> auto-discovery**).

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
8. **`registry.mjs` uses top-level `await`.** Importing it resolves the dynamic
   `import()` of every `sources/*.mjs` before `SOURCES` is populated. A new adapter
   that throws *at module load* breaks discovery — keep adapter top-level code pure.
9. **Test-root isolation (v1.69.2).** `paths.mjs` resolves `PROJECT_ROOT` EAGERLY at
   import, once per process. Any test needing an isolated `CAREER_OPS_ROOT` MUST set
   the env var BEFORE the first import of a paths.mjs carrier (`server/index.mjs`,
   `prompts.mjs`, `store.mjs`, `en-scanner.mjs`, `ru-scanner.mjs`, `paths.mjs`) —
   i.e. load them via dynamic `import()` inside `before()`. A top-level static import
   pins the REAL parent and leaks writes (e.g. `PUT /api/profile`) into the user's
   real `config/profile.yml` / `data/`. Guard: `tests/test-root-isolation.test.mjs`.
   Manual check: snapshot the real `config/profile.yml` + `data/scan-history.tsv`
   (md5), run `npm test`, confirm both are byte-identical afterward.

---

## §0 — Pre-flight (HARD GATE — nothing below runs until this is green)

```bash
node -v                       # ≥ 18
node -p "require('./package.json').version"   # → 1.69.2
npm ci                        # clean install; prod deps = express, js-yaml, multer
npm run test:ci               # = npm test + check-no-also-leftovers + changelog-parity + i18n-audit
echo "unit exit: $?"          # MUST be 0
npm run test:e2e              # smoke E2E (tests/e2e.mjs)        → ≥ 20/20
npm run test:e2e:full         # comprehensive E2E               → ≥ 23/23
npm run test:e2e:browser      # Playwright suites               → ≥ 70 green
npm run test:coverage         # ≥ 80% line / ≥ 80% branch on non-trivial logic
```

**Baselines (floors, may only go up):** **≥1086** `node --test` · **≥70** Playwright ·
**≥20** smoke E2E · **≥23** comprehensive E2E · 133 unit test files. If any number is
*below* the README badge (1086), the badge or the suite drifted — STOP and reconcile.

**Gate fails ⇒ abort the cycle.** Do not proceed to manual checks on a red suite.

---

## §1 — Boot & version honesty

- `npm start` → server on `127.0.0.1:4317`, no unhandled rejection in the log. The
  boot log must NOT carry a `[sources/registry] … has no valid export const meta —
  skipped` warning (every shipped adapter declares a valid `meta`).
- `GET /api/health` returns `{ version: "1.69.2", parentVersion: <string|null>, … }`.
  `version` and `parentVersion` are independent — `parentVersion` reflects the parent
  `VERSION` file (or null if no parent present). Footer in the SPA reads `version`.
- All 9 README badges read `tests-1086` and `release-v1.69.2`; the top-of-README
  **"🆕 Latest release — v1.69.2"** blockquote (line 15, all 9 locales) describes the
  P-14 plug-in scanner auto-discovery. Each README also ends with a localized
  **Contributors** section (`contrib.rocks` image + graph link).
- `CHANGELOG.{md,es,fr,ja,ko-KR,pt-BR,ru,zh-CN,zh-TW}.md` all carry a `[1.69.2]` entry
  dated `2026-06-12` (parity gated by `check-changelog-parity.mjs`).

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

## §3 — Scanner surface (incl. P-14 auto-discovery headline)

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
- **Client disconnect** (close the EventSource / navigate away) aborts in-flight
  fetches — no orphan requests (`AbortSignal` honored end-to-end).
- **Per-request fetch timeout** wraps every source fetch; a slow source times out
  without hanging the whole scan.

**§3.1 — P-14 plug-in scanner auto-discovery (v1.69.2 regression-lock):**
- `server/lib/sources/registry.mjs` is **dynamic**: at module boot it `readdirSync`-scans
  `server/lib/sources/` and dynamically `import()`s every `*.mjs` (except `registry.mjs`),
  collecting each module's `export const meta = { value, label, region, configKey? }`,
  resolved via **top-level `await`**. There is NO static `SOURCES = [...]` array.
- Each of the 12 adapters declares a `meta` block; `value`/`configKey` match the
  pre-v1.69 IDs exactly (`habr-career`/`habr`, `hh.ru`/`hh`, `geekjob`, `getmatch`,
  `trudvsem`, + EN ATS). `GET /api/scan/sources` returns the SAME 11-row catalogue
  (6 EN + 5 RU; `rss` is EN region) — proven by `tests/scan-sources-endpoint.test.mjs`.
- **Validation:** a file with missing `value`/`label`, `region` outside `'en'|'ru'`, or
  an RU adapter without `configKey` is **skipped** with exactly one
  `[sources/registry] <file> … skipped` `console.warn`. `registry.mjs` excludes itself
  from discovery; a missing directory yields `[]` (never throws).
- **Public API unchanged:** `SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`,
  `getRegionalSources()`. Ordering = `en` first then `ru`, alphabetical by label inside
  each region (dropdown order stays stable for users). `discoverSources(dir)` is
  exported for tests to validate drop-in behaviour against a temp directory.
- **Manual smoke:** drop `server/lib/sources/fake.mjs` exporting
  `export const meta = { value:'fake', label:'Fake', region:'en' }`, restart → it
  surfaces in `GET /api/scan/sources` and the `#/scan` dropdown; delete the `meta` →
  one boot warning + the source disappears.
- Lock test: `tests/sources-registry-discovery.test.mjs` (14 cases) +
  `tests/scan-sources-endpoint.test.mjs` (backwards-compat catalogue).

**§3.2 — display cap (v1.69.2 regression-lock):**
- The stored/displayed match set per region is capped at `MAX_STORED_RESULTS`
  (shared constant in `en-scanner.mjs`, imported by `ru-scanner.mjs`; **default
  2000**, override via `SCAN_MAX_RESULTS`). Was a hard `slice(0, 500)` that
  silently truncated large regional sweeps (a real RU scan of 1352 matching jobs
  showed only 500). **Display-only** — `pipeline.md` / `scan-history.tsv`
  additions use the uncapped `fresh` set. Neither scanner may hard-code
  `slice(0, 500)`. Lock: `tests/scan-result-cap.test.mjs` (3 cases).

**§3.3 — #/health card overflow (v1.69.2 regression-lock):**
- `#/health` check cards must not overflow: a long name/value (e.g. `PROFILE
  CUSTOMIZED · …`, `PLAYWRIGHT (PARENT NODE_MODULES)`) must shrink/wrap and never
  collide with the **Fix →** button + status badge. The row carries
  `.health-check-row` (left content `min-width: 0`, action group `flex: 0 0
  auto`). Lock: `tests/health-card-overflow.test.mjs` (2 cases).

**v1.68.0 filter panel + salary filter (regression-lock):**
- `#/scan` results have a labelled `.scan-filters` panel: every filter is a `.field`
  with its **label ABOVE** the control (Search · Work type · Salary from / to · Source
  · Scope). Explicit **Apply** (`scan.applyFilters`) + **Reset** (`scan.resetFilters`)
  buttons drive it (Enter in any text/number field applies); selects apply on change;
  an on-page hint (`scan.filtersHint`) explains it. NOT the old live-on-input wiring.
- Work type filter has an **On-site** option (`scan.onsite`) — Remote / Hybrid /
  On-site / Relocation. All keys present in 9 locales.
- `window.Skills.parseSalaryRange(str)` extracts numeric bound(s) from the free-text
  salary; `salaryInRange(row, min, max)` keeps a row when its range overlaps
  `[min, max]`. **STRICT: once a bound is set, rows with NO listed salary are HIDDEN.**
  Lock: `tests/salary-filter.test.mjs` + `tests/scan-advanced-disclosure.test.mjs`.

**v1.68.1 timeout (regression-lock):** `DEFAULT_SCAN_TIMEOUT_MS` defaults to **60000**,
overridable via `SCAN_FETCH_TIMEOUT_MS`. Lock test: `tests/fetch-timeout.test.mjs`.

**v1.66.0 pagination invariant (regression-lock):** `hh.mjs`/`habr.mjs`/`trudvsem.mjs`
page, dedup across pages, stop when a page adds nothing new (hard `MAX_PAGES=50`).
First page failing is fatal; a later page failing is non-fatal. Locks:
`tests/ru-scanner.test.mjs`, `tests/sources-trudvsem.test.mjs`.

**v1.65.0 lock:** `hh.mjs` scrapes `hh.ru/search/vacancy` (server HTML), NOT
`api.hh.ru`; prod deps stay `express + js-yaml + multer` only.

---

## §4 — LLM / evaluation surface (4-provider OR matrix)

Providers: **Anthropic | Gemini | OpenAI | Qwen**. Model selection persists in
`#/config`/`#/settings`.

- `POST /api/evaluate`, `POST /api/deep`, `POST /api/mode/:slug`,
  `POST /api/apply-helper` — route to the configured provider, honoring the live
  parent `.env` key (not a stale process-start snapshot).
- `POST /api/evaluate/test-anthropic` / `…/test-gemini` — key smoke tests; clear
  ok/fail without leaking the key.
- `GET /api/openrouter/models` — model-catalogue proxy; degrades gracefully offline.
- `GET /api/status/providers` — per-provider readiness; `#/config` reflects it.
- **Missing key ⇒ honest failure**, never a silent empty result.

---

## §5 — Pipeline, tracker & the parent read-only write-through contract

Reads are always safe. **Writes happen only on explicit user actions:**
`POST /api/pipeline`, `POST /api/tracker`, `PUT /api/cv`, `POST /api/jds`,
`DELETE /api/jds/:name`, `DELETE /api/interview-prep/:name`, `POST /api/config`,
`PUT /api/profile`, `PUT /api/modes/_profile`, and the streaming script runners.

- `POST /api/tracker` appends to `data/applications.md`; **never duplicates** an
  existing company+role. Canonical statuses only (`templates/states.yml`).
- `GET/PUT /api/cv` — CV round-trips through `stripDangerousMarkdown()` on ingress.
- Confirm: with `CAREER_OPS_ROOT` at a temp dir, no write escapes it; a pure GET sweep
  never mutates parent files.

---

## §6 — Config & Modes field-forms

- `GET/POST /api/config` — round-trips parent `.env` keys; **merge, not replace**.
- `GET/PUT /api/profile`, `GET/PUT /api/modes/_profile` — user personalization layer.
- `GET /api/modes`, `GET /api/modes/:name` — canonical-schema field-form; editing one
  field preserves the rest. `GET /api/portals` — portals catalogue.

---

## §7 — Security envelope (must stay real, not decorative)

- **CSP** (`server/index.mjs`): `script-src` has **no `'unsafe-inline'`, no
  `'unsafe-eval'`**; `frame-ancestors 'none'`; plus `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`. Grep the SPA for
  `onclick=`/inline `on*=` → must be **zero**.
- **SSRF gate** (`security.mjs::isValidJobUrl`): blocks loopback, private ranges,
  `file://`, script chars. Try `http://127.0.0.1`, `http://169.254.169.254`,
  `file:///etc/passwd`, `http://localhost:4317` → all 4xx.
- **Sanitizers:** `stripDangerousMarkdown()` (CV/markdown ingress),
  `sanitizePathName()` (path traversal on `:name`/`:slug` — try `../` → rejected).
  Client XSS boundary is `UI.md()`.
- **Note:** the P-14 registry only ever `import()`s files already on disk inside
  `server/lib/sources/`; no HTTP route passes user input to `discoverSources()`. No new
  attack surface — confirm no route writes into `server/lib/sources/`.
- **Rate limit** + **file lock** guard write endpoints.

---

## §8 — i18n & docs parity (9 locales)

- Locales: `en, es, fr, ja, ko, pt-BR, ru, zh-CN, zh-TW`. One-file-per-locale under
  `public/js/lib/locales/i18n-dict.<lang>.js` + `i18n-dict.aliases.js`; assembler
  `i18n-dict.js` merges into `window.__I18N_DICT`. **Every key must exist in all 9
  files** — gated by `npm run audit:i18n` (in `test:ci`).
- Per-locale render sweep: switch language, walk every `#/` route, assert no English
  bleed (except server error JSON, which is English-by-policy).
- **Help bundles** (`GET /api/help/:lang`): **19 H2 / 75 H3** parity across all 9
  locales (locks: `canonical-docs-coverage`, `help-ru-config-section`, `help-ui`).
  **§17 "How to add a new job-portal source" was rewritten for the v1.69.2 drop-in
  flow** (Step 2 = "Declare the adapter's `meta`", no registry edit) — H2/H3 counts
  unchanged. In-app `#/help` full-text search filters sections.
- README: all 9 link Français, state 9 languages, carry the Contributors section;
  CHANGELOG parity at 1.69.2.

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

15 route modules register these (`register*Routes`); `server/index.mjs` is a ~130-LOC
orchestrator only.

---

## §10 — Deploy hygiene & resilience

- No `.env` committed; `.env.example` has placeholders only.
- `node scripts/portals-health-check.mjs` audits `portals.yml` reachability.
- Server survives a downed source (per-source failure non-fatal, surfaced as a toast
  in the notifications drawer 🔔).
- SSE endpoints flush headers immediately and clean up on disconnect.
- `UI.toast(msg, kind)` is the only user-facing diagnostic channel.

---

## §11 — Sign-off matrix

| # | Area | Gate | PASS/FAIL | Evidence |
|---|---|---|---|---|
| 0 | Pre-flight | test:ci + e2e + e2e:full + e2e:browser + coverage all green (≥1086 unit) | | |
| 1 | Boot & version | /api/health = 1.69.2; badges (1086); CHANGELOG ×9 dated 2026-06-12; no registry boot-warning | | |
| 2 | SPA routes | all 19 hash routes render clean, no console error | | |
| 3 | Scanner | 12 sources; SSE both; **P-14 auto-discovery (meta-driven, no static array)**; backwards-compat catalogue; RU pagination lock; hh.ru scrape lock; strict salary filter; labelled panel + Apply; On-site; 60s timeout | | |
| 4 | LLM | 4-provider matrix; live-`.env` key; OR catalogue; status | | |
| 5 | Pipeline/tracker | write-through only on user action; no dup; temp-root isolation | | |
| 6 | Config/Modes | merge-not-replace; field-forms intact | | |
| 7 | Security | CSP (no unsafe-inline/eval); SSRF 4× blocked; sanitizers; path-traversal; no route writes into sources/ | | |
| 8 | i18n/docs | 9-locale key parity; **19 H2 / 75 H3** help; §17 drop-in rewrite; no English bleed | | |
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
