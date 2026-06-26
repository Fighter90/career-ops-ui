# PROJECT.md — career-ops-ui

> The "what / why / for whom" of this project. Loaded by GSD at the start of every planning session. Update when the mission, audience, or scope changes — not for routine engineering work.

## What

**`career-ops-ui`** is a single-page web interface for the [`Fighter90/career-ops`](https://github.com/Fighter90/career-ops) AI job-search pipeline. It runs as an Express server bound to `127.0.0.1:4317`, reads the user's career-ops project (CV, applications tracker, reports, pipeline, portals), and exposes a CRM-style UI for browsing, scanning, evaluating, and tracking job offers without leaving the browser.

It is **purely additive** — nothing inside `career-ops/` changes when this UI is dropped in. The user's customizations (`cv.md`, `config/profile.yml`, `modes/*`) remain authoritative.

## Why

The parent career-ops system stores its state in plain Markdown / YAML across many files. That works inside Claude Code (where the agent navigates filesystems trivially) but is hostile to humans:

- Pasting a JD URL means switching to a terminal and editing `data/pipeline.md`.
- Reading a report means opening Markdown in an editor.
- Triggering a scan means knowing which `.mjs` script to run with which flags.
- Tracker drift, missing PDFs, broken status values are invisible until something fails.

`career-ops-ui` collapses all of that into a single web tab: live SSE scan logs, side-by-side CV markdown editor, one-click doctor / verify / dedup, an interactive pipeline preview, and a tracker that reads/writes the same canonical Markdown files.

## For whom

- **Primary audience:** career-ops users who already have it set up, prefer a UI over a terminal for daily use, and want a faster glance at "what's in flight, what scored well, what's next."
- **Secondary audience:** open-source contributors who fork career-ops and want a starting point for a custom pipeline UI.

The UI is **single-tenant by design** — it binds to loopback by default, has no auth, and assumes the operator owns both the machine and the parent career-ops project.

## Scope

### In scope

- Reading and rendering all career-ops state (cv, profile, portals, applications, reports, pipeline, JDs, scan history, follow-ups, interview-prep, output PDFs).
- Triggering parent-project scripts (`scan.mjs`, `doctor.mjs`, `verify-pipeline.mjs`, `normalize-statuses.mjs`, `dedup-tracker.mjs`, `merge-tracker.mjs`, `generate-pdf.mjs`, `check-liveness.mjs`, `gemini-eval.mjs`) via buffered or SSE-streaming endpoints.
- In-process portal scanners — **25 adapters**: 20 EN-region (Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday + RSS, the v1.75.0 aggregators RemoteOK / Remotive / Working Nomads / IBM / Arbeitsagentur / Glints / Jobstreet · SEEK, and the v1.76.0 per-tenant ATSes BambooHR / Breezy HR / Comeet / Personio / Recruitee / SolidJobs) + 5 RU portals (hh.ru / Habr Career / Trudvsem / GetMatch / GeekJob). All bypass Playwright. Discoverable via `GET /api/scan/sources`. Since v1.69.0 (P-14) the source registry auto-discovers a `<slug>.mjs` with a `meta` export for the dropdown — but a fetchable EN board ALSO needs an adapter under `server/lib/portals/adapters/<slug>.mjs` in `ALL_ADAPTERS` (the two-registry rule). The seven v1.75.0 aggregators are selected by an explicit `provider:` field; the config-driven four (IBM / Arbeitsagentur / Glints / Jobstreet · SEEK) read a per-entry `<provider>:` block threaded through as `opts.company`; the six v1.76.0 per-tenant ATSes auto-detect from the `careers_url` host (or, for Comeet, an explicit `api:` URL). A `trust_filter` block (v1.76.0, parent career-ops v1.13.0) annotates each posting with a trust score/level/flags without dropping it; the `#/scan` table no longer caps stored results (`MAX_STORED_RESULTS` removed) and pages through everything.
- A live "Run" pathway via Anthropic / Gemini SDKs when the user provides an API key, or a copy-paste prompt path when no key is present.
- i18n across 8 locales (en, es, pt-BR, ko-KR, ja, ru, zh-CN, zh-TW).

### Out of scope

- Multi-user deployment, authentication, RBAC, multi-tenancy.
- A bundler / build step (Vite, Webpack) — the SPA stays as plain `<script>` tags.
- TypeScript adoption (revisit only if the codebase exceeds ~10k LOC).
- Any write to the parent career-ops project that wasn't initiated by an explicit user click.

## Constraints

- **Loopback by default.** When `HOST=0.0.0.0`, the server hardens with CSP — but the UI is still un-authenticated and assumes a trusted LAN.
- **Node ≥ 18.** No polyfills below.
- **Two production deps only.** `express` and `js-yaml`. Adding a third needs a spec.
- **CSP excludes `unsafe-inline` from `script-src`.** Every event handler is `addEventListener`. This must remain.
- **Parent project layout discovery.** `CAREER_OPS_ROOT` env, then `..`, then `cwd()`. The UI must keep working under all three.

## Success criteria

- A user can run `bash bin/start.sh` from a fresh clone and reach a usable dashboard in under 60 seconds. ✅ verified 2026-05-08.
- 100 % of user-facing actions work without an API key (manual prompt fallback). ✅ all `/api/*` endpoints fall through to a prompt-text response when no key is set.
- Test coverage stays ≥80 % line / ≥75 % branch. ✅ ~93 % line / ~83 % branch as of v1.8.0.
- No security regression: every PR passes `web-ui-route-reviewer` and `spa-view-reviewer`. ✅ subagent definitions live under `.claude/agents/`.
- Live LLM execution paths (`/api/deep`, `/api/mode/:slug`) deliver grounded output (cv + profile + mode templates inlined). ✅ verified 2026-05-08 against `claude-sonnet-4-6` — 26 KB markdown returned for a deep-research call.

## Glossary

| Term | Meaning |
|---|---|
| **Parent project** | The career-ops repo that this UI sits inside. Owns all user data. |
| **Live mode** | Backend executes prompts via Anthropic / Gemini SDK (key required). |
| **Manual mode** | Backend returns the assembled prompt as text; user pastes it elsewhere. |
| **Mode** | A prompt template under `modes/<slug>.md` in the parent (`oferta`, `deep`, `interview-prep`, `contacto`, `apply`, …). |
| **Tracker** | `data/applications.md` — the canonical Markdown table of every offer the user has seen. |
| **Pipeline** | `data/pipeline.md` — the inbox of pending JD URLs. |
| **Report** | A Markdown file under `reports/` produced by `oferta` mode evaluation. |

## Versioning

`package.json::version` is the source of truth. The footer renders it via `/api/health.version`. The parent's `VERSION` file is reported separately as `parentVersion` — they evolve independently. Use semver: breaking SPA contracts bump major, new endpoints / views bump minor, fixes bump patch.

## Links

- Parent project: <https://github.com/Fighter90/career-ops>
- This repo: <https://github.com/Fighter90/career-ops-ui>
- License: MIT
