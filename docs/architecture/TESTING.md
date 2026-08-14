# Testing pyramid

> Lives next to [SERVER.md](SERVER.md) / [API.md](API.md) / [DATA-FLOWS.md](DATA-FLOWS.md). Read in that order if you're new to the project.

This document explains how the test suite is structured, what each tier guarantees, and how to land a new test in the right place. Adopting the four-tier pyramid (unit → functional → acceptance → e2e) is a v1.26.0 deliverable in response to the "100% coverage of working functionality" mandate from the v1.25 backlog.

## Goal: 100% line coverage of working functionality

**Working functionality** = code paths the SPA / CLI actually exercises against a healthy stand. Explicitly **out of scope** for the 100% target:

- The `if (isMain) { … }` boot block in `server/index.mjs` — only runs when launched as the CLI entrypoint, never during `createApp()`-style tests.
- Defensive `try { … } catch {}` blocks around platform calls (`localStorage`, `dnsLookup` test stubs, FS errors on Safari private mode). These exist to prevent crashes in environments we can't reach from a Node test runner.
- Pre-existing fuzz / bug-only regression paths that exist solely to document a known bypass (e.g., `stripDangerousMarkdown` is a soft strip — the real guard is `UI.md`'s escape-first pipeline).

**Stretch goal** (currently at): line ≥ 95 %, branch ≥ 90 %. The v1.10.x baseline was 93 line / 83 branch — we held it through v1.25 and are now pushing toward 100 line on every module that the SPA actively uses.

## The four tiers

```
                    ┌─────────────────────────┐
                    │       E2E (Playwright)  │  62+20+23 cases, headless Chromium
                    │       e2e/ + e2e:full   │  full SPA + server + parent-fixture
                    └─────────────────────────┘
                  ┌───────────────────────────────┐
                  │      Acceptance (workflow)    │  multi-endpoint user journeys
                  │      acceptance/*.test.mjs    │  CV save → evaluate → tracker
                  └───────────────────────────────┘
              ┌─────────────────────────────────────────┐
              │           Functional (per-endpoint)     │  120+ tests covering every
              │           api / route / per-resource    │  /api/* shape, validation,
              └─────────────────────────────────────────┘  side effect, error path
       ┌────────────────────────────────────────────────────────┐
       │                Unit (pure functions, no I/O)            │  340+ tests on
       │   parsers · security · prompts · file-lock · rate-limit │  helpers, sanitizers,
       │   safe-fetch · env-config · activity-log · scanners-mock│  parsers, math
       └────────────────────────────────────────────────────────┘
   ┌──────────────────────────────────────────────────────────────────┐
   │        Shell surface (bin/*.sh · .githooks · scripts/*.mjs)       │  syntax + behaviour
   │   sh-files.test.mjs · cli-doctor · open-dashboard · ai-precommit  │  contracts for the
   └──────────────────────────────────────────────────────────────────┘  CLI / hook layer
```

> **Totals (v1.197.0):** **2527** `node --test` cases across **296** files (Tier 1–3),
> plus 4 Playwright/E2E surfaces. (v1.55.1→v1.56.0 added 12 CI-isolated
> suites for the consolidated UX fix-prompt: auto-stepper-prerender,
> cv-editor-a11y, onboarding-key-banner, auto-eta-stop, dashboard-hero,
> scan-advanced-disclosure, pipeline-virtualize, tracker-server-paged,
> cv-breadcrumb, run-cost-line, help-toc-autoscroll,
> dashboard-initial-focus.) The shell-surface base was the last
> untested layer — `tests/sh-files.test.mjs` (WS9, v1.53.0) added syntax
> (`bash -n`), shebang/exec-bit, and behavioural-contract coverage for
> all 4 `bin/*.sh` scripts + the `.githooks/pre-commit` hook + the
> `install-hooks` wiring (the v1.40 help-heredoc, v1.43 browser-raise
> delegation, WS7 reviewer, CLAUDE.md #7 no-`--no-verify` rule are all
> regression-guarded). `scripts/*.mjs` logic is covered by
> `cli-doctor`, `open-dashboard`, `ai-precommit-review`,
> `provider-selector` (init), and the changelog/also CI-gate scripts
> run in CI on every push.

### Tier 1 — Unit (no network, no FS, no spawn)

**Purpose:** lock the contract on every pure helper so refactoring one file can't silently mis-translate inputs to outputs.

**Lives in:** `tests/*.test.mjs` files whose Node `test()` calls do NOT instantiate `createApp()` and don't touch `process.env` beyond stubs that reset in `beforeEach`/`afterEach`.

**Examples in this repo (representative subset):**

| Test file | What it locks |
|---|---|
| `parsers.test.mjs` | `parseApplications`, `parsePipeline`, `parseReportHeader`, `slugify`, GFM pipe-escape round-trip |
| `security.test.mjs` (implicit via `url-validation`, `cv-xss`, `jd-sanitize`) | `isValidJobUrl` SSRF sweep, `stripDangerousMarkdown` HTML-entity bypass sweep, `sanitizeJobDescription` control-char strip, `sanitizePathName` traversal sweep |
| `i18n-coverage.test.mjs` | Every `t('key', '…')` call in `public/js/**` resolves to a DICT entry with all 17 locales |
| `file-lock.test.mjs` (inside `concurrent-tracker-write.test.mjs`) | `withFileLock` serializes per-path, releases on throw, different paths run in parallel |
| `rate-limit.test.mjs` | `llmRateLimit` is no-op on loopback, 429s on public bind at the configured limit, distinct IPs get distinct buckets, window expiry resets bucket |
| `ssrf-redirect-rebind.test.mjs` | `safeGet` rejects DNS rebind, fails closed on lookup error, caps body size, follows ≤ 3 hops, pins IP via custom transport injection |
| `path-traversal.test.mjs` | `sanitizePathName` end-to-end across every consuming route (`:name` / `:slug` / `?slug=` params) |
| `cv-xss-bypasses.test.mjs` | `stripDangerousMarkdown` entity-aware: `&lt;script&gt;`, `java&#115;cript:`, `<img src="data:image/svg+xml,<svg onload=…>">` all neutralized |
| `config-view-syntax.test.mjs` | `public/js/views/config.js` parses, contains no `.also(` leftovers, has the `const root = c(…) … return root;` migration anchors |

**Rule of thumb:** if the test needs to bind a port or write to the parent's data files, it's NOT a unit test. Move it to Tier 2.

### Tier 2 — Functional (one endpoint per test)

**Purpose:** every `/api/*` endpoint shipping production traffic has a test that exercises its happy-path + every documented error response. The test boots `createApp()` against an ephemeral port + temp `CAREER_OPS_ROOT`, hits the endpoint with `fetch`, and asserts the response shape.

**Lives in:** `tests/api.test.mjs`, `tests/<resource>-*.test.mjs` (e.g., `pipeline-preview.test.mjs`, `scan-consolidated.test.mjs`).

**Representative coverage (per-route):**

| Route | Functional test | Key invariants |
|---|---|---|
| `GET /api/health` | `api.test.mjs` | 200 + `{ ok, version, parentVersion, checks: [] }` shape |
| `GET /api/dashboard` | `api.test.mjs` | aggregates `counts`, `avgScore`, `byStatus`, `recent`, `lastReport` |
| `GET/POST /api/config` | `config-endpoint.test.mjs`, `config-groups.test.mjs` | masked secrets on read, write applies `process.env` in-place, KNOWN_KEYS allowlist enforced |
| `GET/POST/DELETE /api/tracker` | `api.test.mjs`, `concurrent-tracker-write.test.mjs` | dedup by (company, role), pipe-escape round-trip, `withFileLock` serializes |
| `GET/POST/DELETE /api/pipeline` | `pipeline-preview.test.mjs`, `api.test.mjs` | `isValidJobUrl` gate, dedup, mutex on writes |
| `GET /api/pipeline/preview` | `pipeline-preview.test.mjs` | SSRF redirect revalidation, 8 KB body cap, per-hop privacy check, `_setTransport` injection |
| `GET/POST/DELETE /api/jds/*` | `jds-routes.test.mjs` *(NEW v1.26.0)* | CRUD + `sanitizePathName` per `:name` |
| `GET /api/cv` / `PUT /api/cv` / `POST /api/cv/import` | `cv-import.test.mjs`, `cv-xss.test.mjs` | multer multipart, 11 MB cap, XSS strip on save, format conversion (md/txt/html/pdf/docx) |
| `POST /api/evaluate` | `evaluate.test.mjs`, `api.test.mjs` | Anthropic preferred when both keys present, Gemini fallback, manual prompt fallback, JD sanitizer |
| `POST /api/auto-pipeline` | `auto-pipeline.test.mjs`, `auto-pipeline-manual-mode.test.mjs` | SSE stage events, validate→fetch→evaluate→report→tracker, `mode: 'manual'` short-circuit |
| `GET /api/stream/scan?source=…` | `scan-consolidated.test.mjs` | unified SSE endpoint, retired `/api/stream/scan-{en,ru}` + `/api/scan-ru/config` → 404 |
| `POST /api/batch` | `batch-routes.test.mjs` *(NEW v1.26.0)* | TSV editor save, runner spawn with `--noprofile --norc`, tracker-additions merge |

**Rule of thumb:** functional tests should pass with NO `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` set (force the manual fallback) AND with mock keys (via `process.env.ANTHROPIC_API_KEY = 'sk-test'` + mocking the SDK adapter).

### Tier 3 — Acceptance (multi-endpoint workflows)

**Purpose:** verify the **user journey** end-to-end at the API layer. Each test threads multiple endpoints in the sequence the SPA invokes them.

**Lives in:** `tests/acceptance/*.test.mjs` (NEW directory in v1.26.0).

**Representative journeys (NEW v1.26.0):**

| Journey | Endpoints touched |
|---|---|
| **JD ingestion → evaluation → tracker** | `POST /api/jds` (save raw JD) → `POST /api/evaluate { save: true }` (evaluate + save report) → `POST /api/tracker` (add row) → `GET /api/tracker` (verify presence) |
| **Pipeline → preview → evaluate → save** | `POST /api/pipeline` (queue URL) → `GET /api/pipeline/preview?url=…` (server-side fetch) → `POST /api/evaluate` (evaluate JD) → `POST /api/reports` (save markdown) |
| **Deep research → save → list** | `POST /api/deep { run: true }` (Anthropic-mocked) → file landed under `interview-prep/` → `GET /api/interview-prep` (verify in list) → `GET /api/interview-prep/:name` (full body) |
| **App settings round-trip** | `GET /api/config` (read masked) → `POST /api/config { ANTHROPIC_API_KEY: 'sk-real' }` → re-read masked → effective `process.env` mutated |
| **Auto-pipeline manual mode end-to-end** | `POST /api/auto-pipeline { mode: 'manual' }` → SSE stream emits 5 stages → `done` payload carries the prompt → user copies to Claude Code |

**Rule of thumb:** acceptance tests cross route boundaries but stay in-process (`createApp()` + `fetch`). No browser. No subprocess spawning. They prove the contract between endpoints, not the browser rendering.

### Tier 4 — End-to-end (Playwright headless Chromium)

**Purpose:** the real browser path — JS load order, CSP, hash routing, SPA rendering, user interaction.

**Lives in:** `tests/playwright-smoke.mjs`, `tests/playwright-full-cycle.mjs`, `tests/e2e.mjs`, `tests/e2e-comprehensive.mjs`.

**Existing flows (62 Playwright + 20 smoke + 23 comprehensive):**

- Dashboard render + footer version
- Sidebar navigation (every route from CV → Help)
- Language switcher (17 locales rotate, persist across reload, `<html lang>` updates)
- Connection banner shows on server kill, auto-hides on recovery (v1.23.0 cadence fix)
- CV save round-trip + XSS strip in preview
- Pipeline add + dedup + invalid URL reject
- Tracker `Acme | Co` pipe round-trip (BF-1 regression)
- Reports threshold card
- Evaluate manual-prompt fallback
- Config keys masked
- Skip link (WCAG 2.4.1)
- Auto-pipeline SSE start + step events
- 404 page

**Rule of thumb:** if the contract is "the browser does X", it lives in Tier 4. If it's "the server returns Y for input Z", it lives in Tier 2.

## How to run

```bash
npm test                        # Tier 1 + 2 + 3 (node --test tests/**/*.test.mjs)
npm run test:coverage           # Same + V8 coverage report
npm run test:e2e                # Tier 4 smoke (Playwright headless)
npm run test:e2e:full           # Tier 4 comprehensive
npm run test:e2e:browser        # Tier 4 Playwright smoke + full-cycle node-test bridge
npm run test:ci                 # Tier 1+2+3 + check-no-also-leftovers + check-changelog-parity
```

## Adding a new test

1. **Pick the right tier.** If it's a pure function: Tier 1. If it hits one endpoint: Tier 2. If it threads multiple endpoints: Tier 3. If it needs a browser: Tier 4.
2. **Follow the CI-isolation rule** (`CLAUDE.md` hard rule #8). No assumption that the parent career-ops project is present. Build fixtures via `mkdtempSync` + `process.env.CAREER_OPS_ROOT`.
3. **For acceptance tests**, put the new file under `tests/acceptance/` (created in v1.26.0). Each file describes ONE user journey, names the endpoints touched in the file-level docstring, and asserts the visible state at every step.

## Coverage targets per module

The `npm run test:coverage` reporter prints per-file line/branch percentages. The v1.26.0 release pushed:

- `server/lib/security.mjs` → ≥ 99 % line
- `server/lib/safe-fetch.mjs` → ≥ 95 % line
- `server/lib/file-lock.mjs` → ≥ 95 % line
- `server/lib/rate-limit.mjs` → 100 % line
- `server/lib/routes/auto-pipeline.mjs` → ≥ 75 % line (up from 46 %)
- `server/lib/routes/batch.mjs` → ≥ 85 % line (up from 67 %)
- `server/lib/routes/jds.mjs` → ≥ 90 % line (up from 62 %)

When a future patch drops any of these below the floor, the patch should bring fresh tests along with it.
