# API Reference — career-ops-ui

> Complete inventory of the routes exposed by `server/index.mjs`. Source of truth is the code; this doc is the contract. If a PR adds, removes, or changes a route, this doc updates in the same PR.

All paths are prefixed with `http://127.0.0.1:4317` (default). Body / query types are described informally; see the route handler for exact validation.

## Cross-cutting security envelope (v1.21.0+)

- **DNS-rebind safety:** `/api/pipeline/preview` and `/api/auto-pipeline` route through `server/lib/safe-fetch.mjs::safeGet` — one DNS lookup, pinned TCP connection. Per-hop redirect revalidation. Fail-CLOSED on lookup error.
- **Path-traversal sanitization:** every `:name` / `:slug` / `?slug=` / `?name=` route param goes through `sanitizePathName()` from `server/lib/security.mjs`. Empty result → 400.
- **Rate limiting:** `/api/evaluate`, `/api/deep`, `/api/mode/:slug`, `/api/auto-pipeline` wear `llmRateLimit` from `server/lib/rate-limit.mjs`. **No-op on loopback (`HOST=127.0.0.1`); 10 req/min/IP on public bind (`HOST=0.0.0.0`).** Configurable via `LLM_RATE_LIMIT="N/Ws"`. 429 + `Retry-After` + `X-RateLimit-*` headers on overflow.
- **Concurrent writes:** `/api/tracker` (POST), `/api/pipeline` (POST + DELETE), and `/api/auto-pipeline`'s tracker step are wrapped in `withFileLock(path, fn)` from `server/lib/file-lock.mjs`. Read-modify-write on the same data file is serialized per-process. Independent files run in parallel.

## Categories

1. [Configuration](#configuration)
2. [Activity log](#activity-log)
3. [Health & dashboard](#health--dashboard)
4. [Tracker](#tracker)
5. [Pipeline](#pipeline)
6. [Reports](#reports)
7. [JDs](#jds)
8. [CV](#cv)
9. [Profile](#profile)
10. [Portals](#portals)
11. [Modes](#modes)
12. [Buffered script runners](#buffered-script-runners)
13. [Streaming script runners (SSE)](#streaming-script-runners-sse)
14. [Output PDFs](#output-pdfs)
15. [In-process scanners](#in-process-scanners)
16. [Evaluate](#evaluate)
17. [Deep research](#deep-research)
18. [Interview prep](#interview-prep)
19. [Generic mode prompts](#generic-mode-prompts)
20. [Help](#help)

---

## Configuration

### `GET /api/config`

Returns known env-config keys with values pulled from `<parent>/.env` first, falling back to `process.env`. Secret keys are masked.

```json
{
  "envFile": "/path/to/.env",
  "keys": ["GEMINI_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "..."],
  "secretKeys": ["GEMINI_API_KEY", "ANTHROPIC_API_KEY"],
  "values": { "GEMINI_API_KEY": "AIza••••", "ANTHROPIC_MODEL": "claude-sonnet-4-6" }
}
```

### `POST /api/config`

Body: `{ <KEY>: <value>, ... }`. Only `KNOWN_KEYS` are accepted; unknown keys are silently dropped. Validates via `validateConfig`. Writes to `<parent>/.env` and updates `process.env` in-place. Empty string deletes the key.

Errors: `400 { error: 'validation failed', details: [...] }`.

---

## Activity log

### `GET /api/activity?limit=N&type=<prefix>`

Returns the last `N` (default 200) state-changing requests. Filterable by action prefix.

```json
{ "events": [ { "ts": "2026-05-07T10:11:12Z", "action": "POST /api/tracker", "ip": "127.0.0.1", "...": "..." } ] }
```

---

## Health & dashboard

### `GET /api/health`

Liveness + setup readiness. Required checks affect `ok`; optional checks affect `warnings`.

```json
{
  "ok": true,
  "warnings": 1,
  "version": "1.7.2",
  "parentVersion": "1.7.0",
  "checks": [
    { "name": "Node version", "required": true, "ok": true, "value": "v20.20.0" },
    { "name": "GEMINI_API_KEY", "required": false, "ok": false, "value": "unset (manual mode)" }
  ]
}
```

When `HOST=0.0.0.0`, absolute paths and Node version are replaced with `"hidden"` to reduce LAN fingerprinting.

### `GET /api/dashboard`

Aggregates application counts, status histogram, average score, recent applications, recent pipeline URLs, last report.

### `GET /api/status/providers` (v1.55.3)

Read-only LLM-provider readiness for the SPA onboarding banner / chip and the `⚡ Run live` cost hint. No secrets — only provider names + the active model id.

```json
{ "activeProvider": "openai", "activeModel": "gpt-5-codex", "keysConfigured": ["anthropic", "openai"] }
```

`keysConfigured` uses the same effective-env view as the `llm.mjs` gate sites (`process.env` ∨ parent `.env`). `activeProvider` is what the OR-router would actually pick (`selectActiveProvider()` walks `providerOrder()`, honoring an `LLM_PROVIDER` pin); `null` when no key is set anywhere.

---

## Tracker

### `GET /api/tracker` → `{ rows: Application[] }`

Parses `data/applications.md` into rows.

**Optional server-side pagination (v1.55.8).** With **no** query params the response is exactly `{ rows: [...] }` (back-compat — every legacy caller untouched). Pass `?page=&pageSize=&status=` to get a paginated envelope:

```json
{ "rows": [ ...slice ], "total": 23, "page": 1, "pageSize": 25, "funnel": { "Applied": 12, "Interview": 5, "Offer": 2 } }
```

`pageSize` is clamped to `[1, 500]`, `page` to `≥1`; `status` filters `rows`+`total`; `funnel` is the whole-history status→count breakdown (independent of the page/filter, so the `#/tracker` funnel chips are always accurate).

### `POST /api/tracker`

Body: `{ company, role, score?, status?, url?, reportSlug?, notes?, date? }`. Required: `company`, `role`. Status whitelist: `Evaluated, Applied, Responded, Interview, Offer, Rejected, Discarded, SKIP`. Dedup by `(company, role)` case-insensitive — returns `{ deduped: true, existingNum }` instead of creating a duplicate. Auto-numbers (zero-padded), bootstraps the table header if missing.

---

## Pipeline

### `GET /api/pipeline` → `{ urls: string[] }`

### `POST /api/pipeline`

Body: `{ url }` (alias `text`). Validated by `isValidJobUrl()`. Dedups silently.

### `GET /api/pipeline/preview?url=<URL>`

Server-side fetch of a JD page. Returns stripped text (script/style/tags removed, HTML entities decoded, capped at 8 KB). Hard-timeout 15 s. Used by the pipeline split-pane preview.

### `DELETE /api/pipeline?url=<URL>`

---

## Reports

### `GET /api/reports` → `{ reports: ReportSummary[] }`

### `GET /api/reports/:slug`

Returns `{ slug, ...parseReportHeader(text), markdown }`. `:slug` is sanitized (`[^\w\-.]/g`) and may or may not include `.md` suffix.

---

## JDs

### `GET /api/jds` → `{ jds: { name, size, mtime }[] }`

### `GET /api/jds/:name` → `text/plain`

### `DELETE /api/jds/:name`

Requires `.txt` suffix and sanitized name.

### `POST /api/jds`

Body: `{ text, slug? }`. If `slug` supplied, normalised via `slugify`; non-empty result required. Returns `{ ok, name, warning? }`.

---

## CV

### `GET /api/cv` → `{ markdown }`

### `PUT /api/cv`

Body: `{ markdown }` or raw `text/markdown`. Max 1 MB. Sanitised via `stripDangerousMarkdown` before write. Response includes `sanitized: boolean` indicating whether anything was stripped.

---

## Profile

### `GET /api/profile` → `{ profile, raw }`

Reads `config/profile.yml`. `profile` is parsed YAML; `raw` is the source string (so the SPA can show "edit raw" without re-emitting YAML it can't round-trip).

---

## Portals

### `GET /api/portals` → `{ portals, raw }`

Reads `portals.yml`.

---

## Modes

### `GET /api/modes` → `{ modes: string[] }`

Lists `modes/<name>.md` slugs (no extension).

### `GET /api/modes/:name` → `text/plain`

Sanitized name. Returns the raw mode prompt template.

---

## Buffered script runners

All `POST` (no body required). Spawn `node <script>` in the parent project, capture stdout/stderr, return when finished or after 60 s timeout.

| Route | Script |
|---|---|
| `POST /api/run/doctor` | `doctor.mjs` |
| `POST /api/run/verify` | `verify-pipeline.mjs` |
| `POST /api/run/normalize` | `normalize-statuses.mjs` |
| `POST /api/run/dedup` | `dedup-tracker.mjs` |
| `POST /api/run/merge` | `merge-tracker.mjs` |
| `POST /api/run/sync-check` | `cv-sync-check.mjs` |

Response: `{ code, stdout, stderr, killed?: boolean }`.

---

## Streaming script runners (SSE)

`Content-Type: text/event-stream`. Events: `start`, `log` (`{ stream: 'stdout'|'stderr', line }`), `done` (`{ code, ... }`), `error`.

| Route | Script | Notes |
|---|---|---|
| `GET /api/stream/scan` | `scan.mjs` | Query: `dryRun=1`, `company=<name>`. |
| `GET /api/stream/liveness` | `check-liveness.mjs` | |
| `GET /api/stream/pdf` | `generate-pdf.mjs` | Requires Playwright in parent `node_modules`. |

---

## Output PDFs

### `GET /api/output/pdfs` → `{ files: { name, size, mtime }[] }`

### `GET /api/output/pdfs/:name`

Sets `Content-Disposition: attachment`. Sanitized name; must end with `.pdf`.

---

## In-process scanners

Run in this Node process — do not spawn `scan.mjs`. Same SSE event shape as streaming runners.

### `GET /api/stream/scan?source=ats|regional|both`

Consolidated SSE entrypoint (v1.18.0 — the legacy `/api/stream/scan-{en,ru}` aliases were retired after their Sunset window expired).

- `source=ats` — Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (v1.14+).
- `source=regional` — 5 RU adapters since v1.29.0: hh.ru + Habr Career + Trudvsem + GetMatch + GeekJob. Driven by `russian_portals:` in `portals.yml` (`sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]` — default if unset).
- `source=both` (default) — ATS phase first, then regional, in one SSE connection. The server emits one `done` per phase. **v1.29.2 multi-phase contract:** the first `done` carries `final: false` and the second `final: true`. SSE consumers (`API.stream` in `public/js/api.js`) close the EventSource only when `data.final !== false`. Pre-v1.29.2 the client closed on the first `done` and silently dropped the regional phase — guarded by `tests/scan-stream-multi-phase.test.mjs`.

Queries: `dryRun=1` (skip writes to `data/scan-history.tsv` + `data/last-scan.json`), `company=<slug>` (ATS-only narrow). Honors `AbortSignal` from client disconnect; in-flight upstream fetches abort instead of running to completion (REVIEW-B3).

### `GET /api/scan/sources` → `{ sources: [{ value, label, region, configKey? }, ...] }` *(v1.29.0)*

Canonical source registry, served from `server/lib/sources/registry.mjs`. Returns 11 entries (6 EN ATS + 5 RU). The `#/scan` source-filter dropdown fetches this on mount and rebuilds its `<option>` list dynamically — adding a 12th adapter = one entry in the registry, dropdown updates automatically. `Cache-Control: max-age=60`.

### `GET /api/scan/regional/config` → `{ sources, area, per_page, only_remote, queries }`

Effective `russian_portals:` config from `portals.yml`. (Legacy alias `/api/scan-ru/config` retired in v1.20.0.)

### `GET /api/scan-results` → contents of `data/last-scan.json` + `workdayFallback` (v1.17+)

---

## Evaluate

### `POST /api/evaluate`

Body: `{ jd, save? }`. JD sanitised + length-checked (≥50 chars after sanitisation).

- If `GEMINI_API_KEY` set → spawn `gemini-eval.mjs --file <tmp>` (timeout 120 s). Response: `{ mode: 'gemini', ...runResult }`.
- Else → return `{ mode: 'manual', prompt }` for copy-paste.
- If `save: true`, the JD is also persisted under `jds/jd-<date>-<ts>.txt`.

### `POST /api/evaluate/test-gemini`

Smoke test. 400 if `GEMINI_API_KEY` not set. Otherwise runs `gemini-eval.mjs` against a hardcoded short JD; returns a 200-char sample of the response so the user can verify the key is wired up.

---

## Deep research

### `POST /api/deep`

Body: `{ company, role?, run? }`. Builds a deep-research prompt.

- `run: true` + `ANTHROPIC_API_KEY` → runs via Anthropic SDK (`maxTokens: 8192`). Persists Markdown to `interview-prep/<company>-<role>.md`.
- `run: true` + `GEMINI_API_KEY` (no Anthropic) → runs via `gemini-eval.mjs`.
- `run: true` with no keys, or `run` falsey → returns the assembled `prompt` for manual paste.

Response: `{ mode: 'anthropic'|'gemini'|'manual', prompt, markdown?, saved?, code? }`.

---

## Interview prep

### `GET /api/interview-prep` → `{ files: { name, size, mtime }[] }`

### `GET /api/interview-prep/:name` → `{ name, markdown }`

### `DELETE /api/interview-prep/:name`

Sanitized name; must end with `.md`.

---

## Generic mode prompts

### `POST /api/mode/:slug`

`MODE_ALLOWLIST = ['batch', 'contacto', 'followup', 'interview-prep', 'patterns', 'project', 'training']`.

Reads `modes/<slug>.md`, prepends the request body as a JSON context block via `buildModePrompt(template, slug, context)`. Same Anthropic / Gemini / manual fallback as `/api/deep`.

---

## Help

### `GET /api/help/:lang` → `{ lang, markdown }`

Reads `web-ui/docs/help/<lang>.md`. Falls back to `en.md` if requested locale missing. `:lang` sanitized to `[a-zA-Z0-9_-]+`.

---

## Error envelope

All error responses are JSON:

```json
{ "error": "<short message>", "details": [ "..." ] }
```

Status codes:

| Code | When |
|---|---|
| 200 | Success (even when behavior was a no-op or dedup). |
| 400 | Validation failed. |
| 404 | Resource missing. |
| 413 | Body too large. |
| 500 | Unexpected exception. |
| 502 | Upstream LLM call failed (Anthropic / Gemini). |

Conventions enforced by `web-ui-route-reviewer`. New routes keep this envelope.
