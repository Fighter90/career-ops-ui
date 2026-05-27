# Data Flows — career-ops-ui ↔ parent career-ops

> Every place the UI reads or writes a file owned by the parent project. Reads are unrestricted. Writes are explicit-user-action only — the table below is the complete list. Adding a new write requires a row here in the same PR.

## Project-root resolution

`server/lib/paths.mjs::resolveProjectRoot()` finds the parent in this order:

1. `CAREER_OPS_ROOT` env var (absolute or relative to `process.cwd()`).
2. `..` relative to the web-ui repo (the case where this lives at `career-ops/web-ui/`).
3. `process.cwd()` (the case where the server is launched from inside career-ops directly).

The first candidate that contains either `cv.md` or `portals.yml` wins. If none match, the first candidate is returned and the user discovers via Health page warnings.

All filesystem access goes through `PATHS.<thing>` — never literal `..`.

## Reads (safe, no constraint)

| Path | Read by | Surface |
|---|---|---|
| `cv.md` | `/api/cv` | CV view. |
| `config/profile.yml` | `/api/profile` | Profile view, Health "Profile customized" check. |
| `portals.yml` | `/api/portals`, `ru-scanner`, `en-scanner` | Settings, scan pages. |
| `data/applications.md` | `/api/tracker`, `/api/dashboard` | Tracker + Dashboard. |
| `data/pipeline.md` | `/api/pipeline`, `/api/dashboard` | Pipeline + Dashboard. |
| `data/activity.jsonl` | `/api/activity` | Activity log view. |
| `data/follow-ups.md` | (display only — no current view) | reserved. |
| `data/scan-history.tsv` | `ru-scanner`/`en-scanner` (append) | Scan view. |
| `data/last-scan.json` | `/api/scan-results` | Scan view results table. |
| `reports/*.md` | `/api/reports`, `/api/reports/:slug` | Reports view. |
| `jds/*.txt` | `/api/jds`, `/api/jds/:name` | JDs view, Evaluate. |
| `interview-prep/*.md` | `/api/interview-prep` | Deep research view. |
| `modes/*.md` | `/api/modes`, `/api/modes/:name`, `/api/mode/:slug` | Mode pages. |
| `output/*.pdf` | `/api/output/pdfs` | Output PDFs view. |
| `package.json`, `VERSION` | `/api/health` | Footer / Health. Verified against parent v1.7.0. |
| `.env` | `loadEnvFile`, `/api/config` | Boot, App Settings. |
| `node_modules/playwright`, `node_modules/js-yaml` | `/api/health` | Health setup hints. |

### Parent files we deliberately do NOT read

The parent project (career-ops v1.7.0+) ships extra surfaces this UI does not currently consume:

- `dashboard/` — a separate Go-based dashboard program shipped by the parent. Coexists with our SPA; no integration today.
- `analyze-patterns.mjs`, `followup-cadence.mjs`, `generate-latex.mjs`, `liveness-core.mjs`, `update-system.mjs`, `test-all.mjs` — utility scripts not bound to any `/api/run/*` route. Promote to a runner only when there's a UI page that needs them.
- `modes/{de,fr,ja,pt,ru}/` — translated mode files. The UI surfaces only the canonical English `modes/<slug>.md`. Locale routing for prompts is a future phase.
- `modes/{apply,auto-pipeline,latex,ofertas,pdf,pipeline,scan,tracker}.md` — modes available only via Claude Code today. Not in `MODE_ALLOWLIST`. Add an entry there + a UI page in `mode-page.js::MODES` to promote.

## Writes (explicit user action only)

Every row below corresponds to a documented HTTP action initiated by a UI control. No background jobs, no opportunistic writes, no auto-save side effects.

| Path | Triggered by | Route | Notes |
|---|---|---|---|
| `cv.md` | "Save" in CV view | `PUT /api/cv` | Sanitized via `stripDangerousMarkdown` (v1.22.0 M-4: entity-decoded before regex strip). 1 MB cap. |
| `data/applications.md` | "Add to tracker" | `POST /api/tracker` | Dedup by (company, role) case-insensitive. Bootstraps header if file empty. **v1.21.0 (H-6):** read-modify-write serialized via `withFileLock(PATHS.applications, fn)` from `server/lib/file-lock.mjs` — concurrent POSTs no longer drop rows. |
| `data/pipeline.md` | "Add URL" / paste in global search | `POST /api/pipeline`, `DELETE /api/pipeline?url=` | URL gated by `isValidJobUrl`. Dedup. **v1.21.0 (H-6):** both POST and DELETE wrapped in `withFileLock(PATHS.pipeline, fn)`. |
| `data/scan-history.tsv` | Scan run | `GET /api/stream/scan?source=ats\|regional\|both` (v1.18.0+) | Append-only. Skipped on `dryRun=1`. |
| `data/last-scan.json` | Scan run | (same) | Replaced atomically. Skipped on `dryRun=1`. |
| `data/activity.jsonl` | Every state-changing request | `activityMiddleware` | Append. Redacts `SECRET_KEYS`. |
| `jds/<slug>.txt` | "Save JD" in Evaluate, `save: true` in `/api/evaluate` | `POST /api/jds`, `POST /api/evaluate` | Slug sanitized; falls back to `jd-<date>-<ts>.txt`. |
| `interview-prep/<company>-<role>.md` | "Run live" in Deep | `POST /api/deep { run: true }` | Only on successful Anthropic / Gemini response. |
| `output/web-jd-*.txt`, `web-deep-*.txt`, `gemini-smoke-*.txt` | Live runs (Gemini path) | `POST /api/evaluate`, `POST /api/deep`, `POST /api/evaluate/test-gemini` | Tmp files for `gemini-eval.mjs --file`. Not user-facing; never cleaned up automatically (acceptable — small text files). |
| `portals.yml` | First boot only | `ensureRussianPortalsDefaults()` at startup | Append `russian_portals:` block if missing. Idempotent — second boot is a no-op. **The single auto-write the UI performs.** |
| `.env` (parent root) | "Save" in App Settings | `POST /api/config` | Only `KNOWN_KEYS`. Empty string deletes. Updates `process.env` in-place — no restart needed. |

## Spawned scripts (parent's Node)

`server/lib/runner.mjs` spawns `node <script>` inside the parent project for the routes in `API.md::Buffered script runners` and `Streaming script runners`. The spawned script's environment includes the parent's `.env` values (loaded into our `process.env` at boot and inherited).

Watch-outs:

- The spawned script may write anywhere inside the parent project — that's outside our auditing surface. Trust comes from the user owning the parent code.
- Hard timeout: 60 s buffered, 180 s for `gemini-eval.mjs`, no fixed cap on streaming runners (they live until client disconnect or natural exit).
- On client disconnect (SSE), the runner sends `SIGTERM` and falls through to `SIGKILL` after a grace period.

## Outbound URL fetches (DNS-rebind-safe)

**v1.21.0 (B-1).** Two endpoints fetch user-supplied URLs from the public internet: `/api/pipeline/preview` (HTML snippet for the preview pane) and `/api/auto-pipeline` (JD body for the LLM call). Both go through `server/lib/safe-fetch.mjs::safeGet`.

The previous implementation did one explicit `dnsLookup()` for the privacy check, then let `fetch()` do its own independent lookup — a DNS-rebind attacker with TTL=0 could return a public IP on lookup #1 and a private IP on lookup #2. The new `safeGet`:

1. Resolves the hostname **once** via `dns.promises.lookup`.
2. Checks the address against `isPrivateOrLoopbackHost` — rejects RFC1918, loopback, link-local 169.254/16 (AWS IMDS), CGNAT, IPv6 ULA / link-local.
3. Issues the request via `node:http`/`node:https` with `host`/`hostname` set to the validated IP — **no second lookup**. Sets `servername` (TLS SNI) and the `Host` header to the original hostname so cert validation and virtual hosting still target the right name.
4. Follows up to 3 HTTP redirects, re-validating each `Location` through `isValidJobUrl` + `isPrivateOrLoopbackHost`.
5. Streams the body and caps at `opts.maxBytes` (preview: 32 KB raw / 8 KB after strip; auto-pipeline: 256 KB raw / 64 KB after strip). v1.22.0 (M-2) confirmed via `tests/ssrf-redirect-rebind.test.mjs` cap test.

**Fail-CLOSED on DNS errors** — reverses the pre-v1.21 fail-OPEN catch in `pipeline.mjs:68-71`. Test stubs that need to bypass real DNS use the `_setTransport(fn)` injection point.

## LLM endpoint rate-limiting

**v1.21.0 (H-5).** `/api/evaluate`, `/api/deep`, `/api/mode/:slug`, `/api/auto-pipeline` wear `llmRateLimit` from `server/lib/rate-limit.mjs`. The middleware:

- **No-op on loopback** (`HOST=127.0.0.1` or default unset).
- **Active on public bind** (`HOST=0.0.0.0` or any non-loopback): 10 req/min/IP token bucket. Returns 429 with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Reset` headers on overflow.
- Configurable via `LLM_RATE_LIMIT="N/Ws"` (or `N/Wms`).

This is interim defense ahead of v2.0 P-12 auth gate.

## In-process portal fetches (NOT spawned)

`server/lib/ru-scanner.mjs` and `server/lib/en-scanner.mjs` perform HTTPS calls to:

- hh.ru search website (`hh.ru/search/vacancy`, HTML scrape — the `api.hh.ru` JSON API now 403s programmatic clients)
- Habr Career API (`career.habr.com/api/...`)
- Greenhouse boards (`boards-api.greenhouse.io/v1/boards/<slug>/jobs`)
- Ashby boards (`api.ashbyhq.com/posting-api/job-board/<slug>`)
- Lever boards (`api.lever.co/v0/postings/<slug>`)

These are read-only HTTP calls. Outputs land in `data/scan-history.tsv` and `data/last-scan.json` (see writes table).

## Anthropic / Gemini outbound

| Endpoint | When called |
|---|---|
| `https://api.anthropic.com/v1/messages` | `runAnthropic()` from `/api/deep`, `/api/mode/:slug` with `run: true` and `ANTHROPIC_API_KEY` set. |
| Gemini API (via `gemini-eval.mjs` in parent) | `/api/evaluate`, `/api/deep`, `/api/mode/:slug` with `run: true` and only `GEMINI_API_KEY` set. |

These are the only outbound LLM calls. Everything else stays loopback.

## Boundaries we never cross

1. **No write outside `PROJECT_ROOT`.** All writes resolve through `PATHS.*`.
2. **No write outside `data/`, `jds/`, `output/`, `reports/`, `interview-prep/` (and the two single-file exceptions: `cv.md`, `portals.yml`, `.env`).** Anything else is off-limits.
3. **No symlink writes.** If a target path resolves through a symlink, we don't follow it for write — we error out. (Add a test if you wire up new write paths to validate this.)
4. **No execution of arbitrary user-supplied scripts.** Buffered / streaming runners only invoke a hardcoded list of `.mjs` filenames in `runner.mjs`.

When adding a new data flow, update this doc and add a row to the appropriate table in the same PR. Reviewers (`web-ui-route-reviewer`) verify presence.
