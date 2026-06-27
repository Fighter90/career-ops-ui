# QA REGRESSION PROMPT — career-ops-ui v1.75.2 · FULL / EXHAUSTIVE (whole project)

> **Scope:** the *entire* career-ops-ui project, *all* functionality, as of `package.json` **1.75.2**. Single-pass, full-surface driver — supersedes the v1.74.2 FULL prompt and folds in the v1.75.x scan-aggregator cycle (v1.75.0 → v1.75.1 → v1.75.2).
> **Role:** strict release-gate QA engineer. Prove the whole app works, correctly and clearly, and that nothing regression-locked has drifted.
> **Output:** save your run report to `qa/v56-regression/<YYYY-MM-DD>-REGRESSION-v1.75.2.md` with a PASS/FAIL per item and evidence (command output, HTTP traces, screenshots). One finding = one fix-ship (one-fix-per-release doctrine; HIGH → MEDIUM → LOW).
>
> **Sibling perennials (run alongside, do not duplicate):** `REGRESSION-FINAL.md` (invariant ledger), `UX-AUDIT-PROMPT.md`, `FUNCTIONALITY-CHECK.md`.

---

## §−1 — Methodology footguns (READ FIRST)

1. **Never `npm test 2>&1 | grep …`** — `grep` returns 0 on match even when the suite failed. Run `npm test`, capture `$?`, then grep separately. Same for `git … 2>&1 | tail`.
2. **Pre-commit AI review is advisory; `ci.yml` is the hard gate.** Watch the CI run, not just the local hook.
3. **`PATHS` resolves once per process.** Don't reimport `paths.mjs`; CI-isolated tests bootstrap their own `CAREER_OPS_ROOT`. Locks: `tests/paths-once.test.mjs`, `tests/test-root-isolation.test.mjs`. **Eager-import leak:** a test that sets `CAREER_OPS_ROOT` in `before()` must load every paths.mjs carrier via dynamic `import()` inside `before()`.
4. **`cleanLlmMarkdown` is NOT an XSS sanitizer.** XSS boundary = `UI.md()` (client) + `stripDangerousMarkdown()` (CV ingress).
5. **`[hidden]` is a no-op against an author `display:` rule** — components with `display:flex|grid` need an explicit `.sel[hidden]{display:none}`.
6. **Parent career-ops is READ-ONLY** (hard rule #1). Tests must not assume it exists.
7. **Server error bodies are English-by-policy.** Only client UI strings are localized.
8. **Playwright headless shell:** browser tests fail at the launch hook if `chromium_headless_shell` is absent → `npx playwright install chromium-headless-shell` (env gap, not a regression).
9. **Cross-realm vm arrays:** comparing a vm-realm array (`I18n.getLangs()`) to a main-realm literal with `deepEqual` fails on prototype identity — spread (`[...]`) first.
10. **Two scanner registries — don't conflate them (v1.75.0).** `server/lib/sources/registry.mjs` (auto-discovered `meta`) drives the `#/scan` *dropdown* + RU dispatch; `server/lib/portals/registry.mjs` (`ALL_ADAPTERS`, hand-maintained) is what the EN scanner walks to actually *fetch* (`matches` → `buildEndpoint` → fetch). A new EN board needs **both**. "Drop a file, no registry edit" is true for dropdown visibility only.
11. **`buildEndpoint(company)` must return a string** (the resolved URL). Returning a non-string silently drops the source from a sweep — `resolveAdapter` treats a falsy endpoint as "no match".
12. **Aggregators are `provider:`-selected, never `careers_url`-detected (v1.75.0).** The four config-driven ones (IBM / Arbeitsagentur / Glints / Jobstreet · SEEK) read a per-entry `<provider>:` block threaded as `opts.company`; URL-detected ATS fetchers ignore the extra opt.
13. **`delay(ms, signal)` must be abort-aware AND leak-free (v1.75.1).** Both the timeout and the `{once:true}` abort listener clear on whichever fires first. Don't reintroduce a bare `setTimeout` for pagination courtesy pauses.
14. **`scan-sanitize` is an egress (write) sanitizer, not an XSS boundary.** `normalizeScanScalar` collapses `\r \n \t \v \f U+2028 U+2029` (v1.75.1 widened set) so no record/line separator survives into `scan-history.tsv`. It does not replace `stripDangerousMarkdown`.

---

## §0 — Gates (all must be green)

```bash
npm test                                    # full unit/integration suite (≥1190 cases)
npm run test:ci                             # unit + check-no-also + check-changelog-parity + i18n-audit
node tools/i18n-audit.mjs                   # "no hard failures — dictionary is clean"
node scripts/check-changelog-parity.mjs     # "all 11 locales at v1.75.2"
npm run test:coverage                       # ≥80% line / ≥83% branch (baseline ~93/~83)
npm run test:e2e:browser                    # playwright smoke + full-cycle + forms + locale-sweep(12) + theme-toggle
npm run test:e2e && npm run test:e2e:full   # smoke (20) + comprehensive (23) E2E
node scripts/portals-health-check.mjs       # portals.yml reachability (informational)
```

Floors: unit suite **≥1190** (run to confirm) · locale-sweep **12/12** · 20 smoke E2E · 23 comprehensive E2E · coverage ≥80%.

---

## §1 — Setup / onboarding / parent contract
- Cold start with a `mktemp -d` `CAREER_OPS_ROOT`: `/api/health` reports `onboardingNeeded` correctly; missing `cv.md`/`profile.yml`/`portals.yml` surfaced.
- `parentVersion` reads the parent `VERSION` file (currently **1.12.0**); web-ui `version` from `package.json` (**1.75.2**) — they drift independently.
- **Parent is read-only**: reads always safe; writes ONLY on explicit user actions (`POST /api/pipeline`, `POST /api/tracker`, `PUT /api/cv`, `POST /api/jds`, `DELETE /api/{jds,interview-prep}/:name`, `POST /api/config`, streaming runners). No code path writes the parent unprompted.
- `data/applications.md` is the markdown source of truth; the parent's SQLite index is a derived cache the web-ui ignores. Tracker columns are header-mapped in `server/lib/parsers.mjs` — verify a standard layout still reads correctly.

## §2 — Security envelope (do not weaken)
- CSP set in `server/index.mjs`: `script-src` has **no** `'unsafe-inline'` / `'unsafe-eval'`; `frame-ancestors 'none'`. Every handler is `addEventListener` — grep views for inline `onclick=`/`<script>` → none.
- SSRF: `isValidJobUrl()` gates `/api/pipeline` + `/api/pipeline/preview` (no loopback/file://, no script chars). Any URL-fetching endpoint routes through it; outbound via `safeGet()` (DNS-pinned redirect revalidation).
- **Aggregator endpoints are pinned, not user-supplied.** Each adapter's `buildEndpoint` returns a fixed host (remoteok.com, remotive.com, workingnomads.com, www-api.ibm.com, rest.arbeitsagentur.de, glints.com [host-allowlisted], chalice-search). User config supplies only query params (keywords, country, siteKey) — confirm no path lets a `tracked_companies` entry redirect the fetch to an arbitrary host. Glints enforces `ALLOWED_GLINTS_HOSTS`.
- XSS: CV/markdown ingress → `stripDangerousMarkdown()`; client render → `UI.md()`. JD → `sanitizeJobDescription()`. Slugs → `sanitizePathName()`. Scan egress → `scan-sanitize.mjs` (separate concern; §−1.14).
- Rate limit on LLM routes (`llmRateLimit`); file-lock on tracker writes (`withFileLock`); activity-log redaction.
- `.aiignore` excludes real user data; no secrets/PII in any committed file (incl. screenshots — see §10).

## §3 — Scan (in-process EN + RU source registry) — **primary v1.75.x surface**
- `/api/scan/sources` returns the auto-discovered registry (P-14): adapters self-register from `server/lib/sources/*.mjs` via `meta`. **19 adapters** — 14 EN (Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday / RSS + the v1.75.0 aggregators **RemoteOK / Remotive / Working Nomads / IBM / Arbeitsagentur / Glints / Jobstreet · SEEK**) + 5 RU (hh.ru / Habr / Trudvsem / GetMatch / GeekJob). Verify the dropdown lists all 19 labels.
- **Aggregator selection.** Board-wide feeds (RemoteOK / Remotive / Working Nomads) fire on a bare `provider: <slug>` entry; the four config-driven ones read their `<provider>:` block (`ibm:` / `arbeitsagentur:` / `glints:` / `jobstreet:`). Use the copy-paste entries in `docs/portals-examples.md` → "Aggregator boards (v1.75.0)". Confirm each returns normalized jobs and that an ATS entry with a `careers_url` is unaffected by the extra `opts.company` thread.
- **content_filter (v1.75.0).** Top-level `portals.yml` sibling of `location_filter` with `positive`/`negative` lists matched against a posting's description/snippet. Semantics mirror `location_filter` (missing body passes; `negative` wins; `positive` non-empty → must match one). Only sources that carry a body (e.g. RSS, aggregators that ship a snippet) are gated — confirm enabling it never silently drops bodyless ATS rows.
- **Abort-aware pagination (v1.75.1).** Glints (300 ms) / Jobstreet·SEEK (200 ms) inter-page pauses resolve immediately on the scan's `AbortSignal`. Click **Stop** mid-paginate → the sweep ends without waiting out the pause; no orphan fetch.
- **Non-JSON 2xx (v1.75.1).** `fetchJson` wraps a non-JSON `2xx` body as `non-JSON 2xx response from <url>` (not a bare `SyntaxError`); the per-source error log names the misbehaving endpoint. Covered by `tests/http-json.test.mjs`.
- **scan-history write hygiene (v1.75.1).** A vacancy whose title/company/location carries `\v`, `\f`, `U+2028`, or `U+2029` must not introduce a stray record/line break in `scan-history.tsv`. Covered by `tests/scan-sanitize.test.mjs`.
- `GET /api/stream/scan?source=` streams SSE (`start`/`log`/`done`/`error`); determinate progress; Stop button; `role=log` console; error banner. Two-phase (ATS + regional) single 🌐 button — both phases in one stream.
- Results table: location / Remote-Hybrid / relocation / salary / source filters + dynamic stack/level/keyword chips; Active-Companies card with per-board API health. Display cap `MAX_STORED_RESULTS` (2000, `SCAN_MAX_RESULTS` override). Append to `pipeline.md` + `scan-history.tsv` uses the uncapped fresh set.

## §4 — Pipeline / evaluate / batch / deep
- `POST /api/pipeline/preview` + `POST /api/pipeline` (SSRF-gated); discard-reason visible in preview.
- `/api/evaluate` (oferta): A–G blocks incl. Block G legitimacy; `## Machine Summary` YAML; report header has URL + Legitimacy; locale directive honored.
- Batch evaluate (`#/batch`); `/api/batch/merge` runs `merge-tracker.mjs` (file-locked). After a batch, tracker has no dupes (company+role).
- `/api/deep` deep research; saved-research cards; Generate-PDF.

## §5 — Modes (generic runner) — `POST /api/mode/:slug`
- `MODE_ALLOWLIST` = batch, contacto, cover, followup, interview-prep, patterns, project, training. Unknown slug → 404; allowlisted-but-missing-template → 404 (not 500). `run` flag never echoed into the prompt.
- Locale: `buildLocaleDirective` + `SCAFFOLD_STRINGS` localize the wrapper for all 12 locales; parent mode body stays English.
- **Single-shot output contract:** `buildModePrompt` wraps every mode in a non-interactive contract; Run live returns the final artifact. Gated in `tests/locale-scaffold.test.mjs`.
- **Provider context (6 providers):** every live button inlines `cv.md` + `config/profile.yml` into the prompt for Anthropic / Gemini / OpenAI / Qwen / OpenRouter / GitHub Models. Gated by `tests/llm-provider-context.test.mjs` + `tests/gemini-connector.test.mjs`.

## §6 — Cover letter
- `#/cover` under Application nav; fields JD (required) + Company (required) + Role + Greeting. `cover.*` + `nav.cover` in all 12 locales.
- Result offers **Generate PDF** → `POST /api/stream/pdf/inline` → `generate-pdf.mjs`. Covered by `tests/cover-letter-pdf.test.mjs`.

## §7 — Apply / tracker / reports / CV
- `#/apply` apply-checklist; form contracts preserved.
- `/api/tracker` reads `data/applications.md`; canonical states (`templates/states.yml`); paginator with `pager.reset()` on filter.
- `/api/reports` list + `#/reports/:slug` render + Generate-PDF; report links root-relative normalized by `merge-tracker.mjs`.
- `#/cv`: `PUT /api/cv` round-trips through `stripDangerousMarkdown`; Generate-PDF via `/api/stream/pdf`.

## §8 — Config / health / activity / notifications / help
- `#/config`: Profile field-form (non-destructive merge), Modes tab, API-keys tab (race-safe summary chip, WAI-ARIA tabs, confirm-gates). `POST /api/config` → `validateConfig` → `updateEnvFile`. **Watch:** the new `content_filter` key and per-entry aggregator `<provider>:` blocks are edited via the raw-YAML editor, not the field-form — confirm their absence from the field UI is graceful (round-trips untouched).
- `#/health`: OK/OPTIONAL/FAIL cards (no overflow); run `doctor.mjs`/`verify-pipeline.mjs`.
- `#/activity` log; notifications drawer (bell + unread badge, last 50 toasts, journal of `(METHOD /path · HTTP NNN)` postfixes).
- `#/help`: **12 markdown bundles** (en/es/pt-BR/ko-KR/ja/ru/zh-CN/zh-TW/fr/pl/uk/ar). `GET /api/help/<lang>` serves each locale's own bundle. Help invariant: **19 H2 / 75 H3** per bundle (`canonical-docs-coverage` + `help-ui` + `help-ru-config-section`). v1.75.2 docs added §5 `content_filter` + aggregator prose and refreshed the §17 adapter count **without** changing the H2/H3 structure — confirm the counts still gate green.

## §9 — i18n (12 locales) + Arabic RTL
- 12 locales: en, es, pt-BR, ko, ja, ru, zh-CN, zh-TW, fr, pl, uk, ar. Parity + snapshot gated. No Latin-only `*.title` on non-Latin locales. No PII.
- Flag `<select>` switcher (`#lang-select`, 12 options, CSP-safe). Persists to `career-ops-ui:lang`. `tests/lang-switcher-rtl.test.mjs`.
- Arabic: `setLang('ar')` → `<html dir="rtl">`; LTR locales reset to ltr. `[dir="rtl"]` block mirrors chrome; LTR unchanged.
- Full browser sweep: every page localizes in every locale, zero console errors (`tests/playwright-locale-sweep.mjs`).

## §10 — Runners / PDF / OpenRouter / output
- Buffered `/api/run/*`: doctor, verify, normalize, dedup, merge, sync-check. Streaming `/api/stream/*`: scan-parent, liveness, pdf (+ /report /deep /inline). `/api/output/pdfs` list + download (Content-Disposition, name sanitized).
- `/api/openrouter/models` catalogue proxy; provider selector; honest cost hint.
- PDFs embed fonts. **Screenshots privacy:** `images/dashboard-*.png` are fixture-generated — confirm no live data before commit.

## §11 — Deferred / backlog (verify absent-by-design)
- Parent features not yet in the SPA: interactive **interview** onboarding, **reverse-ATS** discovery (`scan-ats-full.mjs`), **follow-up cadence** widget, **rejection-pattern** data, **portals validator**, **update-check** badge, **SQLite tracker query**, **ofertas** multi-job compare. None should be half-wired; confirm clean.
- v1.75.0 aggregators: all seven must be fully wired (dropdown + fetch + filter + dedup + append) — none half-present. Confirm each appears in `/api/scan/sources` AND in `ALL_ADAPTERS`.
