# Server Module Map — career-ops-ui

> Per-file purpose for `server/`. Pair with `OVERVIEW.md` (top-level) and `API.md` (route reference).

## `server/index.mjs` (~645 LOC — pure orchestrator)

The Express app factory `createApp()`. Every route topic lives in `server/lib/routes/<topic>.mjs`. `index.mjs` is: middleware (request guard, security headers, body parsing, activity log, static files), **39 `register<Topic>Routes(app)` calls** (one per route module, grouped by surface), and the SPA catch-all. No inline route handlers remain.

## Route modules (`server/lib/routes/` — 39 files)

One module per topic, each exporting `register<Topic>Routes(app)`. Endpoints per file (source of truth: the code):

| Module | Endpoints |
|---|---|
| `activity.mjs` | GET `/api/activity` |
| `assessments.mjs` | GET/POST `/api/assessments` |
| `auto-pipeline.mjs` | POST `/api/auto-pipeline` (SSE) |
| `batch.mjs` | GET/PUT `/api/batch`, GET `/api/stream/batch` (SSE), POST `/api/batch/merge` |
| `career-plan.mjs` | GET/PUT `/api/career-plan`, POST `/api/career-plan/generate` |
| `cli-detect.mjs` | GET `/api/cli-detect` |
| `config.mjs` | GET/POST `/api/config` (parent `.env` round-trip) |
| `content.mjs` | GET/PUT `/api/cv`, GET/PUT `/api/profile`, GET `/api/portals`, GET `/api/modes`, GET/PUT `/api/modes/_profile`, GET `/api/modes/:name` |
| `cv-studio.mjs` | POST `/api/cv-studio/{humanize,tailor,add-entry,verify-facts}` |
| `cv-sync.mjs` | GET `/api/cv-sync-check` |
| `discover-ats.mjs` | POST `/api/portals/discover`, POST `/api/portals/track` |
| `docs-assistant.mjs` | POST `/api/docs-assistant/ask` |
| `export.mjs` | POST `/api/export/docx` |
| `followup.mjs` | GET `/api/followup`, POST `/api/followup/seed` |
| `funded.mjs` | GET `/api/company-funded` |
| `geocode.mjs` | GET `/api/geocode` (Nominatim proxy, rate-limited, `.cache/geocode.json`) |
| `health.mjs` | GET `/api/ping`, GET `/api/health`, GET `/api/status/providers`, GET `/api/dashboard` |
| `help.mjs` | GET `/api/help/:lang` |
| `interview.mjs` | POST `/api/mock-interview/{turn,save}`, GET/DELETE `/api/mock-interview/sessions[/:name]`, GET `/api/interview/weekly-digest` |
| `jds.mjs` | GET/POST `/api/jds`, GET/DELETE `/api/jds/:name`, GET `/api/jds/:name/{skill-gap,reuse}` |
| `liveness.mjs` | GET `/api/liveness` |
| `llm.mjs` | POST `/api/evaluate`, POST `/api/evaluate/test-{gemini,anthropic}`, POST `/api/deep`, GET/DELETE `/api/interview-prep[/:name]`, POST `/api/mode/:slug`, POST `/api/apply-helper` |
| `logos.mjs` | GET `/api/logo` |
| `map.mjs` | GET `/api/map/jobs`, GET `/api/commute` |
| `market.mjs` | POST `/api/stats/market` |
| `memory.mjs` | GET/PUT `/api/memory`, POST `/api/memory/suggest` |
| `networking.mjs` | POST `/api/networking/{plan,save}`, GET/DELETE `/api/networking/plans[/:name]` |
| `openrouter.mjs` | GET `/api/openrouter/models` |
| `orientation.mjs` | POST `/api/orientation/generate` |
| `outcome.mjs` | POST `/api/outcome` |
| `pipeline.mjs` | GET/POST/DELETE `/api/pipeline`, POST `/api/pipeline/restore`, GET `/api/pipeline/preview` |
| `portals.mjs` | POST `/api/portals/toggle`, POST `/api/portals/health` |
| `reports.mjs` | GET/POST `/api/reports`, GET `/api/reports/:slug` |
| `runners.mjs` | GET `/api/runners` (buffered action index), buffered `/api/run/*`, streaming GET `/api/stream/{scan-parent,liveness,pdf,pdf/report,pdf/deep}`, POST `/api/stream/pdf/inline`, GET `/api/output/pdfs[/:name]` |
| `scan.mjs` | GET `/api/stream/scan` (SSE), GET `/api/scan/regional/config`, GET `/api/scan/sources`, GET `/api/scan/reposts`, GET `/api/scan-results` |
| `stats.mjs` | POST `/api/stats/snapshot`, GET `/api/stats/{trend,patterns,lifetime,salary-gap,funnel,company-history,upskill,rejection-latency}` |
| `tracker.mjs` | GET `/api/tracker`, GET `/api/tracker/stages`, POST `/api/tracker`, POST `/api/tracker/backfill-scores` |
| `two-pager.mjs` | GET/PUT `/api/two-pager`, POST `/api/two-pager/draft` |
| `usage.mjs` | GET `/api/usage` |

Top-level helpers (defined as inline functions, used by multiple route handlers):

| Helper | Purpose |
|---|---|
| `isPubliclyExposed()` | True when `HOST` is not loopback. Gates CSP attachment + path redaction in /api/health. |
| `isValidJobUrl(url)` | SSRF guard. Rejects loopback, `file://`, `data:`, `gopher://`, IP literals, and strings with script chars / templates. |
| `stripDangerousMarkdown(md)` | Strip `<script>`, `javascript:` URLs, `onerror`/`onclick`/etc. attrs, base64 data URLs from Markdown before persisting CV. |
| `sanitizeJobDescription(s)` | JD ingress: cap length, strip control chars, normalize whitespace. |
| `buildEvaluationPrompt(jd)` | Compose the standard "score this JD vs the CV" prompt. |
| `buildDeepPrompt(company, role?)` | Compose the deep-research prompt. |
| `buildModePrompt(template, slug, ctx)` | Prepend a JSON `<context>` block to a mode template. |
| `safeReadApps()` / `safeReadPipeline()` / `safeListReports()` | Defensive readers — return empty array on missing files. |
| `checkProfileCustomized()` | Heuristic: is `profile.yml` still the placeholder shipped by career-ops? |

## `server/lib/`

### Helpers inventory (51 modules)

Modules with a detailed section below are marked ●. The rest in one line:

| Module | Purpose |
|---|---|
| `paths.mjs` ● | Parent-project path resolution (single source of truth). |
| `parsers.mjs` ● | Markdown table parsers + slug helpers. |
| `runner.mjs` ● | Buffered / SSE Node-script spawning in the parent. |
| `ru-scanner.mjs` ● / `en-scanner.mjs` ● | In-process RU (5 sources) / EN (adapter-driven) sweeps. |
| `security.mjs` ● | Project-wide sanitizers + SSRF/host checks. |
| `safe-fetch.mjs` ● | DNS-rebind-safe GET (preview, auto-pipeline JD fetch). |
| `file-lock.mjs` ● | Per-path async mutex for read-modify-write. |
| `rate-limit.mjs` ● | LLM-route limiter (no-op on loopback). |
| `prompts.mjs` ● | LLM payload builders (`bundleProjectContext`, …). |
| `store.mjs` ● | Defensive readers + first-boot portals bootstrap. |
| `http-json.mjs` | Shared scanner transport (`fetchJson`/`fetchText`): pinned Accept-Encoding, DNS-guard, UA, retry-friendly read-only `.location`/`.retryAfter`. |
| `fetch-timeout.mjs` | `makeTimeoutFetch` — timeout + DNS-rebind guard combined (FULL-M2). |
| `http-timeouts.mjs` | Keep-alive/proxy-safe timeout constants. |
| `request-guard.mjs` | Host/Origin allowlist + `Sec-Fetch-Site` acting-GET gate (CAR-158). |
| `async-safety.mjs` | Async route wrappers so a rejected handler is a 500, not a process crash. |
| `env-config.mjs` ● | `.env` round-trip + `providerOrder`/`AUTO_ORDER` (18 providers). |
| `dotenv.mjs` | Minimal `.env` loader. |
| `activity-log.mjs` | State-changing-request journal → `data/activity.jsonl` (secret-redacting). |
| `llm-dispatch.mjs` ● | The one provider-choice point (`runActiveProvider`, 18-provider cascade). |
| `llm-output.mjs` | `cleanLlmMarkdown` — strips echoed tool/agent scaffolding. |
| `llm-usage.mjs` / `llm-pricing.mjs` | Token/cost journal (`data/llm-usage.jsonl`) + per-provider price table. |
| `anthropic.mjs` ● / `gemini.mjs` / `openai.mjs` | Provider clients (Anthropic Messages; Gemini `generateContent`; the shared OpenAI-compatible core + catalogue). |
| `eval-validate.mjs` | Report validation: A–G blocks, SCORE_SUMMARY, locale checks (abjad/Cyrillic letters accepted). |
| `liveness-core.mjs` / `liveness-api.mjs` | Posting "still live?" classification (hard/soft expired tiers); API-first liveness. |
| `classify-tier.mjs` | Seniority tier classifier (scan filter). |
| `role-matcher.mjs` | Fuzzy role matching + level extraction (repost detection). |
| `detect-reposts.mjs` | Scan-history repost clustering. |
| `url-key.mjs` / `text-key.mjs` | Canonical posting-URL dedup keys; Unicode text keys. |
| `scan-quarantine.mjs` / `scan-sanitize.mjs` / `cooldown.mjs` / `location-filter.mjs` | Scan hygiene: permanent-failure quarantine, TSV field sanitization, re-apply cooldown, location allow/block tiers. |
| `title-fit.mjs` | Zero-token title-fit chip scoring. |
| `comp-compare.mjs` | Canonical server-side salary comparison (CAR-109). |
| `commute.mjs` | Commute projection for `#/map` + tracker lens. |
| `discover-ats.mjs` | Company name → Greenhouse/Ashby/Lever board resolver. |
| `trust-validator.mjs` | Job trust score + flags annotation (never drops a job). |
| `html-to-text.mjs` / `html-entities.mjs` | Quote-aware HTML→text stripping; named-entity decoding. |
| `help-markdown.mjs` | GitHub-only block stripping for served help markdown. |
| `states.mjs` | Canonical tracker status vocabulary (reads `templates/states.yml` live, ships a fallback). |
| `config-field-domains.mjs` | `#/config` dropdown domains (provider model lists). |
| `parent-relay.mjs` | Read-only shell-out to parent JSON scripts (stats/jds/followup relays). |
| `cv-import.mjs` | CV file upload parsing (multer-backed). |
| `docx.mjs` | Dependency-free `.docx` writer (`/api/export/docx`). |

### `paths.mjs` (60 LOC)

`resolveProjectRoot()`, `WEB_UI_ROOT`, `PUBLIC_DIR`, `PROJECT_ROOT`, `path()` helper, `PATHS` map (all paths the rest of the codebase needs). Single source of truth — never duplicate.

### `parsers.mjs` (190 LOC)

Markdown table parsers and slug helpers:

- `parseApplications(text)` → `{ num, date, company, role, score, scoreNum, status, pdf, report, notes }[]`
- `parsePipeline(text)` → `string[]` of URLs
- `addPipelineUrl(text, url)` → updated text (idempotent)
- `removePipelineUrl(text, url)` → updated text
- `parseReportHeader(text)` → `{ company, role, score, source, … }`
- `slugify(s)` — lowercases, strips non-`[a-z0-9-]`, collapses `-`
- `today()` — `YYYY-MM-DD`

### `runner.mjs` (90 LOC)

Spawns Node scripts in the parent project.

- `runNodeScript(script, args, opts)` — buffered, returns `{ code, stdout, stderr, killed }`. `opts.timeoutMs` defaults to 60 s.
- `streamNodeScript(res, script, args)` — SSE. Writes `event: start/log/done/error` frames. Kills child on `res.close`.

### `ru-scanner.mjs` (~340 LOC)

In-process scanner for 5 RU portals (since v1.29.0): hh.ru, Habr Career, Trudvsem, GetMatch, GeekJob.

- `loadConfig()` — reads `russian_portals:` block from `portals.yml`. Default `sources` (when the array is unset) pulls from `registry.mjs::RU_CONFIG_KEYS` → all 5 adapters.
- `RU_DISPATCH` — table mapping each `russian_portals.sources` key to its adapter (`search` fn + `label` for log lines). Adding a 6th RU source = one row here + one adapter file (which now self-registers via its `meta` export — see `sources/registry.mjs` below; no manual registry edit since v1.69.0).
- `runRuScan({ writeFiles, onLog })` — iterates `cfg.sources` and runs each adapter via the dispatch table. Normalizes to the common job shape, dedup-filters via title-filter + scan-history, writes `data/scan-history.tsv` (append) and `data/last-scan.json` (replace) when `writeFiles`. Per-source failures are caught and reported in `errors[]` without aborting the rest of the sweep. Calls `onLog('stdout'|'stderr', line)` per progress event.

### `en-scanner.mjs` (230 LOC)

Same shape but for the 6 EN ATS via `lib/sources/*.mjs` (Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday).

- `runEnScan({ writeFiles, companyName?, onLog })` — `companyName` filters the company list to one entry.
- Reads `tracked_companies:` from `portals.yml` (career-ops v1.7+) and falls back to legacy `companies:`. Only entries with `enabled !== false` are scanned.
- `loadLastScan()` — reads `data/last-scan.json`, returns `{ en, ru, ... }` keyed by scan kind (or empty on missing).
- **`MAX_STORED_RESULTS`** (v1.69.1) — exported here and shared with `ru-scanner.mjs`. Caps how many *matching* (post-filter) results each scanner stores in `data/last-scan.json` / renders in the `#/scan` table. Default **2000**, override via `SCAN_MAX_RESULTS`. Was a hard `slice(0, 500)` per region that silently truncated large regional sweeps (RU 1352 → 500). **Display-only** — appending to `pipeline.md` / `scan-history.tsv` uses the uncapped `fresh` set and is never truncated.

### `sources/{greenhouse,ashby,lever,habr,hh,…}.mjs`

Per-portal HTTP clients. Each exports a fetch/search function returning a normalized job array. Self-contained — no shared state.

Since **v1.69.0 (P-14)** every adapter also exports a self-describing `meta` block:

```js
export const meta = { value, label, region: 'en' | 'ru', configKey? };
```

### `sources/registry.mjs` — dynamic source registry (v1.69.0)

The single source of truth for the scanner, the `GET /api/scan/sources` endpoint, and the `#/scan` filter dropdown. **No longer a hand-maintained array.** At module boot it `readdirSync`-scans the `sources/` folder and dynamically `import()`s every `*.mjs` (except `registry.mjs` itself), collecting each module's `meta` export — resolved via top-level `await` (Node 18+ ESM). Malformed `meta` (missing `value`/`label`, `region` outside `en|ru`, RU without `configKey`) is skipped with a single `[sources/registry]` `console.warn`, keeping half-migrated branches diagnosable.

- Public API (unchanged across v1.69.0): `SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`, `getRegionalSources()`.
- `discoverSources(dir)` — exposed so tests can validate drop-in behaviour against a temp directory.
- Discovered order: `en` first then `ru`, alphabetical by label inside each region (matches the pre-v1.69.0 hand-maintained order, so the dropdown stays stable).
- **To add a source:** drop a `<slug>.mjs` with a `meta` export into `sources/`. RU sources additionally need their `configKey` listed in the parent's `portals.yml::russian_portals.sources` and a `RU_DISPATCH` row in `ru-scanner.mjs`. Full walkthrough: in-app Help §17.

### `anthropic.mjs` (70 LOC)

Minimal Anthropic adapter.

- `hasAnthropicKey()` — boolean check on `process.env.ANTHROPIC_API_KEY`.
- `runAnthropic(prompt, { maxTokens })` — single non-streaming `POST /v1/messages`. Returns `{ markdown }` or `{ error }`.

Hardcoded model: see source. Bump model in a versioned commit; don't quietly switch.

### `security.mjs` (post-P-2)

Project-wide sanitizers and host-trust checks — single source of truth.

- `isValidJobUrl(url)` — SSRF guard. Rejects loopback, `file://`, `data:`, IP literals, oversized strings.
- `isPrivateOrLoopbackHost(host)` — RFC1918 + loopback + link-local + CGNAT + IPv6 ULA detector (PR-3).
- `stripDangerousMarkdown(md)` — strip `<script>`, `<iframe>`, `on*=` handlers, `javascript:` URIs, etc. before persisting CV.
- `sanitizeJobDescription(s)` — JD ingress: cap length, strip control chars, normalize whitespace.
- `sanitizePathName(s)` — **v1.21.0 (H-4)** — `:name` / `:slug` route-param sanitizer. Strips non-`[\w\-.]`, drops leading dot-runs, collapses internal dot-runs, caps at 200 chars. Returns `''` for inputs with no usable characters — callers MUST treat empty as 400. Replaces 10 duplicated `replace(/[^\w\-.]/g, '')` copies that kept `.` chars and let `..pdf`, `....md` through.
- `isPubliclyExposed()` — true when `HOST` is non-loopback (gates CSP attachment + path redaction + rate-limit activation).

Re-exported from `index.mjs` for backward-compat with earlier external consumers.

### `safe-fetch.mjs` *(v1.21.0, B-1)*

DNS-rebind-safe GET fetcher used by `/api/pipeline/preview` and `/api/auto-pipeline`. The previous pattern did one explicit `dnsLookup` for validation, then let `fetch()` do its own independent lookup — a DNS rebind attacker with TTL=0 could return a public IP on lookup 1 and a private/loopback IP on lookup 2.

- `safeGet(url, opts)` — resolves the hostname ONCE, validates against `isPrivateOrLoopbackHost`, then pins the TCP connection to that exact IP via `node:http(s)` with `servername` set so TLS SNI / cert validation still target the canonical hostname. Follows up to 3 redirects with per-hop revalidation. Fail-CLOSED on lookup error.
- `_setTransport(fn)` — test-only injection point. Lets tests stub the network layer without monkey-patching `globalThis.fetch`. Returns a `restore` function.

Why `node:http(s)` and not undici Agent — Node ≥ 18 ships undici as the fetch implementation but doesn't expose `import { Agent } from 'undici'` directly. Adding `undici` as an npm dep would contradict the "no new runtime deps lightly" rule.

### `file-lock.mjs` *(v1.21.0, H-6)*

Per-path async mutex for read-modify-write operations on `applications.md` / `pipeline.md`.

- `withFileLock(path, fn)` — serializes critical sections on the same path; independent paths run in parallel. ~76 LOC, in-memory `Map<path, Promise>` chain. Releases the lock even when `fn` throws.

Without this, two concurrent `POST /api/tracker` would both read `num=42`, both write `num=43`, and silently drop the earlier row. Used by `routes/tracker.mjs`, `routes/pipeline.mjs` (POST + DELETE), and `routes/auto-pipeline.mjs` tracker step. Single-process Express assumption documented in the module header.

### `rate-limit.mjs` *(v1.21.0, H-5)*

In-memory rate limiter for LLM-calling routes. No-op on loopback (`HOST=127.0.0.1`); 10 req/min/IP on public bind (`HOST=0.0.0.0`).

- `llmRateLimit(req, res, next)` — Express middleware. Returns 429 with `Retry-After` + `X-RateLimit-Limit` + `X-RateLimit-Reset` headers on bucket overflow.
- Configurable via `LLM_RATE_LIMIT="N/Ws"` env (e.g. `"3/30s"`).
- Wired into `/api/evaluate`, `/api/deep`, `/api/mode/:slug`, `/api/auto-pipeline`. v2.0 P-12 auth gate will eventually replace this with proper per-user accounting.

### `prompts.mjs` (post-P-2)

LLM-bound payload builders.

- `bundleProjectContext({ modeSlugs })` — read cv/profile/mode files, return delimited block. Used by Anthropic SDK calls (REVIEW-A1).
- `buildEvaluationPrompt(jd)` — `/api/evaluate` standard prompt.
- `buildDeepPrompt(company, role)` — `/api/deep` deep-research prompt.
- `buildModePrompt(template, slug, ctx)` — `/api/mode/:slug` generic mode wrapper.
- `buildApplyChecklist(url, jd)` — `/api/apply-helper` checklist text.

### `store.mjs` (post-P-2)

Defensive readers for parent-project Markdown / YAML, plus first-boot bootstrap.

- `safeReadApps()` / `safeReadPipeline()` / `safeListReports()` — return `[]` on missing/unreadable instead of throwing.
- `checkProfileCustomized()` — placeholder-name detector for the Health page nudge.
- `ensureRussianPortalsDefaults()` — idempotent first-boot append of `russian_portals:` to `portals.yml` (FIX-H2).

### `routes/activity.mjs` *(P-2 phase 2)*

`registerActivityRoutes(app)` — `GET /api/activity?limit=N&type=<prefix>` returns the tail of `data/activity.jsonl`.

### `routes/config.mjs` *(P-2 phase 2)*

`registerConfigRoutes(app)` — `GET /api/config` (returns known env keys, secrets masked) and `POST /api/config` (validates + writes parent `.env`, applies live to `process.env`). Backs the `/#/config` page.

### `routes/content.mjs` *(P-2)*

`registerContentRoutes(app)` — CV (`GET /api/cv`, `PUT /api/cv` with `stripDangerousMarkdown`), Profile (`GET /api/profile`), Portals (`GET /api/portals`), Modes (`GET /api/modes`, `GET /api/modes/:name`).

### `routes/health.mjs` *(P-2 phase 2)*

`registerHealthRoutes(app)` — `GET /api/health` (the required + optional checks bundle, with LAN-fingerprinting redaction when `HOST` is non-loopback) and `GET /api/dashboard` (KPI summary).

### `routes/help.mjs` *(P-2 phase 2)*

`registerHelpRoutes(app)` — `GET /api/help/:lang`. Locales live in `web-ui/docs/help/<lang>.md`, falls back to `en.md` for unknown locales. `:lang` sanitized to `[a-zA-Z0-9_-]+`.

### `routes/jds.mjs` *(P-2 phase 2)*

`registerJdsRoutes(app)` — full CRUD for `jds/*.txt`: list, read, delete (`.txt` suffix required), append-with-slug.

### `routes/llm.mjs` *(P-2 phase 2 + P-7)*

`registerLlmRoutes(app)` — every LLM-bound endpoint: `/api/evaluate` (Anthropic preferred over Gemini, manual fallback), `/api/evaluate/test-{gemini,anthropic}` smoke, `/api/deep`, `/api/mode/:slug` (whitelisted), `/api/apply-helper`, `/api/interview-prep*` archive. Routes through `bundleProjectContext` for Anthropic SDK calls (REVIEW-A1).

### `routes/pipeline.mjs` *(P-2 phase 2)*

`registerPipelineRoutes(app)` — `GET/POST/DELETE /api/pipeline` plus the SSRF-safe `GET /api/pipeline/preview` (manual redirect-walking with per-hop `isValidJobUrl` check, capped at 3 hops, 15 s timeout, 8 KB body cap).

### `routes/reports.mjs` *(P-2 phase 2)*

`registerReportsRoutes(app)` — `GET /api/reports` and `GET /api/reports/:slug` (header parsed, full Markdown returned).

### `routes/runners.mjs` *(P-2)*

`registerRunnerRoutes(app)` — buffered `POST /api/run/*` table (doctor, verify, normalize, dedup, merge, sync-check), streaming `GET /api/stream/{scan,liveness,pdf}`, and `GET /api/output/pdfs[/:name]` for generated-PDF list/download.

### `routes/scan.mjs` *(P-2)*

`registerScanRoutes(app)` — `/api/stream/scan?source=ats|regional|both`, `/api/scan/regional/config`, `/api/scan-results`. Uses the in-process scanners; honors `AbortSignal` from client disconnect (REVIEW-B3). v1.18.0 retired the `/api/stream/scan-{en,ru}` split aliases; v1.20.0 retired the `/api/scan-ru/config` legacy alias.

### `routes/tracker.mjs` *(P-2 phase 2)*

`registerTrackerRoutes(app)` — `GET /api/tracker` (rows from `data/applications.md`) and `POST /api/tracker` (append with status whitelist, score format check, dedup by `company+role` case-insensitive, table bootstrap on first write).

### `dotenv.mjs` (40 LOC)

Tiny `.env` loader. Reads `KEY=VALUE` lines, ignores comments, supports unquoted and double-quoted values. Called once at boot from `server/index.mjs`.

### `env-config.mjs` (170 LOC)

Backs `/api/config`.

- `KNOWN_KEYS` — explicit allowlist of env vars the UI manages.
- `SECRET_KEYS` — subset whose values are masked on read.
- `parseEnv(text)` / `updateEnvFile(path, overrides)` — round-trip-safe.
- `maskSecret(value)` — preserves length hint, hides body.
- `validateConfig(body)` — per-key validators (URL format, ASCII-only, etc.).

### `activity-log.mjs` (160 LOC)

- `activityMiddleware(req, res, next)` — records every state-changing request to `data/activity.jsonl`. GET requests are recorded only for `/api/run/*` and `/api/stream/*`. Redacts `SECRET_KEYS` in body and headers.
- `readActivity({ limit, actionPrefix? })` — reads from the tail.
- `logActivity(entry)` — programmatic append (used internally).

## Cross-cutting concerns

### Security headers & request guard

Always-on baseline: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`. **CSP is unconditional since v1.58.4 (NEW-1)** — it used to be layered on only for non-loopback binds, which left `/` and `/api/health` CSP-less on `127.0.0.1`; defence-in-depth no longer depends on the bind address. The CSP excludes `'unsafe-inline'` from `script-src` — every event handler in the SPA is `addEventListener`.

The request guard (`request-guard.mjs`) enforces a `Host` allowlist + same-origin checks on acting requests (writes and acting GETs via `Sec-Fetch-Site`/`Origin`, CAR-158); `ALLOWED_HOSTS` extends it beyond loopback. Async route handlers are wrapped (`async-safety.mjs`) so a rejected promise answers a JSON 500 instead of crashing the process.

### Outbound transport envelope

All outbound HTTP funnels through a small set of transports — never bare `globalThis.fetch` in scanner/source code:

- **`safe-fetch.mjs::safeGet`** — user-supplied URL fetches (`/api/pipeline/preview`, auto-pipeline JD fetch): one DNS resolution, private/loopback rejection, IP-pinned TCP connect, per-hop redirect revalidation, body cap. Fail-CLOSED.
- **`http-json.mjs` (`fetchJson`/`fetchText`)** — the scanner/source transport: pinned `Accept-Encoding`, browser-like UA, DNS-rebind guard on the real fetch path (moved inside `makeTimeoutFetch`, FULL-M2), read-only `.location` / `.retryAfter` on non-ok. Sources take an injected `fetchImpl` for tests; a structural guard fails CI if a source calls `fetch` directly.
- **`fetch-timeout.mjs::makeTimeoutFetch`** — timeout + guard combined; ~25 sources inject it directly, which is why the guard lives inside it.

### Body parsing limits

`express.json({ limit: '5mb' })` and `express.text({ limit: '5mb' })`. Long-string routes (CV markdown) enforce a tighter cap inline (1 MB) and return 413.

### Path-traversal guard

Every route that maps a `:param` to a filesystem path applies `replace(/[^\w\-.]/g, '')`. DELETE routes additionally require a known suffix (`.md`, `.txt`, `.pdf`).

### Timeouts

All outbound fetches use `AbortController`. All script spawns have a hard timeout. The streaming endpoints kill children on client disconnect (`res.on('close')`).

## Adding a new lib module

1. Single responsibility, < 400 LOC.
2. Pure functions where possible; side-effects (writes, network) clearly marked.
3. Export a named API; no default exports.
4. Add a unit test in `tests/<name>.test.mjs`.
5. If it reads/writes a parent file, document the row in `DATA-FLOWS.md` in the same PR.
6. If it hosts an Express route, register that in the `index.mjs` route table — do not export an Express subapp until phase P-2 is complete.
