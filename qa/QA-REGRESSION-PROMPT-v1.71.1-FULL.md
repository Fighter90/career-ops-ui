# QA REGRESSION PROMPT — career-ops-ui v1.71.1 · FULL / EXHAUSTIVE (whole project)

> **Scope:** the *entire* career-ops-ui project, *all* functionality, as of `package.json` **1.71.1**. This is the single-pass, full-surface driver — it supersedes the v1.70.0 and v1.69.2 FULL prompts and folds in everything from v1.59 → v1.71.
> **Role:** strict release-gate QA engineer. Prove the whole app works, correctly and clearly, and that nothing regression-locked has drifted.
> **Output:** save your run report to `qa/v55-regression/<YYYY-MM-DD>-REGRESSION-v1.71.1.md` with a PASS/FAIL per item and evidence (command output, HTTP traces, screenshots). One finding = one fix-ship (one-fix-per-release doctrine; HIGH → MEDIUM → LOW).
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

---

## §0 — Gates (all must be green)

```bash
npm test                                    # full unit/integration suite
npm run test:ci                             # unit + check-no-also + check-changelog-parity + i18n-audit
node tools/i18n-audit.mjs                   # "no hard failures — dictionary is clean"
node scripts/check-changelog-parity.mjs     # "all 11 locales at v1.71.1"
npm run test:coverage                       # ≥80% line / ≥83% branch (baseline ~93/~83)
npm run test:e2e:browser                    # playwright smoke + full-cycle + forms + locale-sweep(12) + theme-toggle
npm run test:e2e && npm run test:e2e:full   # smoke (20) + comprehensive (23) E2E
node scripts/portals-health-check.mjs       # portals.yml reachability (informational)
```

Floors: unit suite ≥ its current count (run to confirm) · locale-sweep **12/12** · 20 smoke E2E · 23 comprehensive E2E · coverage ≥80%.

---

## §1 — Setup / onboarding / parent contract
- Cold start with a `mktemp -d` `CAREER_OPS_ROOT`: `/api/health` reports `onboardingNeeded` correctly; missing `cv.md`/`profile.yml`/`portals.yml` surfaced.
- `parentVersion` reads the parent `VERSION` file (currently **1.11.0**); web-ui `version` from `package.json` (**1.71.1**) — they drift independently.
- **Parent is read-only**: reads always safe; writes ONLY on explicit user actions (`POST /api/pipeline`, `POST /api/tracker`, `PUT /api/cv`, `POST /api/jds`, `DELETE /api/{jds,interview-prep}/:name`, `POST /api/config`, streaming runners). No code path writes the parent unprompted.
- `data/applications.md` is the markdown source of truth; the parent's v1.11.0 SQLite index (`applications.db`) is a derived cache the web-ui ignores. Tracker columns are header-mapped in the parent — check `server/lib/parsers.mjs` still reads a standard layout correctly (known watch item if a user inserts columns).

## §2 — Security envelope (do not weaken)
- CSP set in `server/index.mjs`: `script-src` has **no** `'unsafe-inline'` / `'unsafe-eval'`; `frame-ancestors 'none'`. Every handler is `addEventListener` — grep views for inline `onclick=`/`<script>` → none.
- SSRF: `isValidJobUrl()` gates `/api/pipeline` + `/api/pipeline/preview` (no loopback/file://, no script chars). Any URL-fetching endpoint routes through it; outbound via `safeGet()` (DNS-pinned redirect revalidation).
- XSS: CV/markdown ingress → `stripDangerousMarkdown()`; client render → `UI.md()`. JD → `sanitizeJobDescription()`. Slugs → `sanitizePathName()`.
- Rate limit on LLM routes (`llmRateLimit`); file-lock on tracker writes (`withFileLock` + the parent's own merge-tracker lock); activity-log redaction.
- `.aiignore` excludes real user data; no secrets/PII in any committed file (incl. screenshots — see §10).

## §3 — Scan (in-process EN + RU source registry)
- `/api/scan/sources` returns the auto-discovered registry (P-14): adapters self-register from `server/lib/sources/*.mjs` via `meta`. EN: Greenhouse/Ashby/Lever/Workable/SmartRecruiters/Workday; RU: hh.ru/Habr/Trudvsem/GetMatch/GeekJob (+RSS).
- `GET /api/stream/scan?source=` streams SSE (`start`/`log`/`done`/`error`); determinate progress bar; Stop button; `role=log` console; error banner.
- Results table: location / Remote-Hybrid / relocation / salary / source filters + dynamic stack/level/keyword chips; Active-Companies card with per-board API health. Display cap `MAX_STORED_RESULTS` (2000, `SCAN_MAX_RESULTS` override) — large sweeps not silently truncated.
- Salary filtering honored; appending to `pipeline.md` + `scan-history.tsv` uses the uncapped fresh set.

## §4 — Pipeline / evaluate / batch / deep
- `POST /api/pipeline/preview` + `POST /api/pipeline` (SSRF-gated); discard-reason visible in preview.
- `/api/evaluate` (oferta): A–G blocks incl. Block G legitimacy; `## Machine Summary` YAML; report header has URL + Legitimacy; locale directive honored (output in UI locale).
- Batch evaluate (TSV SPA at `#/batch`); `/api/batch/merge` runs `merge-tracker.mjs` (file-locked). After a batch, tracker has no dupes (company+role).
- `/api/deep` deep research; saved-research cards; Generate-PDF.

## §5 — Modes (generic runner) — `POST /api/mode/:slug`
- `MODE_ALLOWLIST` = batch, contacto, **cover**, followup, interview-prep, patterns, project, training. Unknown slug → 404; allowlisted-but-missing-template → 404 (not 500). `run` flag never echoed into the prompt. Prompt references cv.md/profile.yml/_shared.md. Covered by `tests/modes-endpoints.test.mjs`.
- Locale: `buildLocaleDirective` + `SCAFFOLD_STRINGS` localize the wrapper for all 12 locales incl. fr/pl/uk/ar (`tests/locale-scaffold.test.mjs`); parent mode body stays English (read-only).

## §6 — Cover letter (v1.70.0 mode + v1.71.0 PDF)
- `#/cover` under the Application nav group; fields JD (required) + Company (required) + Role + Greeting (optional). `cover.*` + `nav.cover` keys in all 12 locales.
- Result offers **Generate PDF** → `POST /api/stream/pdf/inline` → `generate-pdf.mjs` (shared inline markdown→PDF, same as interview-prep). PDF downloads from `output/`. Covered by `tests/cover-letter-pdf.test.mjs`.

## §7 — Apply / tracker / reports / CV
- `#/apply` apply-checklist (renamed from "Apply helper"); form contracts preserved.
- `/api/tracker` reads `data/applications.md`; canonical states (`templates/states.yml`); paginator with `pager.reset()` on filter.
- `/api/reports` list + `#/reports/:slug` render + Generate-PDF; report links root-relative normalized by `merge-tracker.mjs`.
- `#/cv`: `PUT /api/cv` round-trips through `stripDangerousMarkdown`; Generate-PDF via `/api/stream/pdf` (CV markdown→HTML→`generate-pdf.mjs`); Japanese CVs now render with the parent's `lang="ja"` CJK font fallback (passive gain).

## §8 — Config / health / activity / notifications / help
- `#/config`: Profile field-form (canonical §Step-5 schema, non-destructive merge), Modes tab, API-keys tab (race-safe summary chip, WAI-ARIA tabs, confirm-gates). `POST /api/config` → `validateConfig` → `updateEnvFile`. **Watch:** newer profile.yml keys (`cover_letter.*`, `followup_cadence.*`, `auto_pdf_score_threshold`, `cv.output_format`, `location.*`, `candidate.telegram`) are NOT yet in the config UI — confirm absence is graceful (raw-YAML editor still edits them).
- `#/health`: OK/OPTIONAL/FAIL cards (no overflow — `.health-check-row`); run `doctor.mjs`/`verify-pipeline.mjs`; Playwright-MCP warning surfaced.
- `#/activity` log; notifications drawer (bell + unread badge, last 50 toasts, journal of `(METHOD /path · HTTP NNN)` postfixes).
- `#/help`: **12 markdown bundles** (en/es/pt-BR/ko-KR/ja/ru/zh-CN/zh-TW/fr/pl/uk/ar — pl/uk/ar fully translated in v1.71.1). `GET /api/help/<lang>` serves each locale's own bundle (verify pl→pl, uk→uk, ar→ar, no 404). Help invariant: 19 H2 / 75 H3 per bundle (`canonical-docs-coverage` + `help-ui` + `help-ru-config-section`).

## §9 — i18n (12 locales) + Arabic RTL
- 12 locales: en, es, pt-BR, ko, ja, ru, zh-CN, zh-TW, fr, pl, uk, ar. Parity (697 keys) + snapshot (707) gated. No Latin-only `*.title` on non-Latin locales (ru/ko/ja/zh-CN/zh-TW/uk/ar). No PII.
- Flag `<select>` switcher (`#lang-select`, 12 options, `top.langLabel` aria, CSP-safe). Persists to `career-ops-ui:lang`. `tests/lang-switcher-rtl.test.mjs`.
- Arabic: `setLang('ar')` → `<html dir="rtl">`; LTR locales reset to ltr. `[dir="rtl"]` block mirrors sidebar/drawer/markdown/inline spacing; LTR unchanged. Reference: `images/dashboard-ar.png`.
- Full browser sweep: every page localizes in every locale, zero console errors (`tests/playwright-locale-sweep.mjs`).

## §10 — Runners / PDF / OpenRouter / output
- Buffered `/api/run/*`: doctor, verify, normalize, dedup, merge, sync-check. Streaming `/api/stream/*`: scan-parent, liveness, pdf (+ /report /deep /inline). `/api/output/pdfs` list + download (Content-Disposition, name sanitized).
- `/api/openrouter/models` catalogue proxy; provider selector; honest cost hint.
- PDFs embed fonts (parent `08d1e9a` data-URL fonts). **Screenshots privacy:** `images/dashboard-*.png` are generated from a fixture (no real job data) — if regenerated, confirm no live data leaks before commit.

## §11 — Deferred / backlog (verify absent-by-design; triage for future)
- Parent features not yet in the SPA: interactive **interview** onboarding (multi-turn — needs chat UI), **reverse-ATS** discovery (`scan-ats-full.mjs` — clean `/api/stream/scan-ats-full` candidate), **follow-up cadence** API (`followup-cadence.mjs` exports — in-process dashboard widget), **rejection-pattern** data (`analyze-patterns.mjs` — `/api/patterns`), **portals validator** (`validate-portals.mjs`), **update-check** badge (`update-system.mjs check`), **SQLite tracker query** (Node ≥22.5 gate), **ofertas** multi-job compare. None should be half-wired; confirm clean. (The pl/uk/ar **help-guide** translation — previously deferred — shipped in v1.71.1; all 12 help bundles are now fully translated.)
