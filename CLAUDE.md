# career-ops-ui — Agent Instructions

> Project-level CLAUDE.md. Loaded automatically by Claude Code (and equivalently by Codex via AGENTS.md, Gemini CLI via GEMINI.md). User instructions and `~/.claude/CLAUDE.md` still take precedence.

## What this repo is

`career-ops-ui` is an **Express + vanilla-JS SPA** that puts a polished web interface on top of [`Fighter90/career-ops`](https://github.com/Fighter90/career-ops) — a Claude-Code-driven AI job-search pipeline. It does **not** replace career-ops; it sits inside it as `career-ops/web-ui/` and reads/writes the same files (`cv.md`, `data/applications.md`, `reports/`, `portals.yml`, …).

Stack at a glance:

| Layer | Tech | Files |
|---|---|---|
| Server | Node ≥18, Express 4, js-yaml | `server/index.mjs` (~130 lines, orchestrator only), `server/lib/*.mjs`, `server/lib/routes/*.mjs` (36 modules) |
| SPA | Vanilla JS, hash-router, no framework | `public/index.html`, `public/js/{app,router,api}.js`, `public/js/views/*.js` |
| Styling | Hand-written CSS, docs-style tokens | `public/css/app.css` |
| Tests | `node --test` (TAP), in-process Express, fetch | `tests/*.test.mjs`, `tests/e2e*.mjs` |
| Build | None — files served as-is from `public/` | — |

**Read the docs before editing.** Start with `docs/architecture/OVERVIEW.md`, then dive into the layer you're touching.

---

## Spec-Driven Development (GSD flavour)

This project uses the **GSD pipeline** (`gsd-*` skills shipped via `superpowers@claude-plugins-official`). The cardinal rule: **no non-trivial code change without a written spec and plan first.**

```
discuss → spec → plan → execute → verify → review
   (gsd-discuss-phase)  (gsd-spec-phase)  (gsd-plan-phase)
   (gsd-execute-phase)  (gsd-verify-work) (gsd-code-review)
```

| Trigger | Skill / Command |
|---|---|
| New feature, system, or refactor | `gsd-explore` → `gsd-plan-phase` |
| Implementing an approved plan | `gsd-execute-phase` (with TDD discipline) |
| Bug with multiple hypotheses | `superpowers:systematic-debugging` |
| AI integration phase | `gsd-ai-integration-phase` |
| UI design contract | `gsd-ui-phase` |
| Code review on a phase | `gsd-code-review` (or `gsd-ns-review`) |
| Security audit on a phase | `gsd-secure-phase` |
| Wrap a milestone | `gsd-complete-milestone` |

**Trivial changes (single-file fix, comment update, README typo, version bump) skip the pipeline.** Use `gsd-quick` if you want the atomic-commit / state-tracking guarantees without the planning ceremony.

GSD writes its planning artifacts under `.planning/`. The `docs/` tree is the **public contract** — long-lived architecture, conventions, and ADRs that ship with the repo. Specs that graduate from `.planning/` and become permanent reference live under `docs/specs/` and `docs/adr/`.

See `docs/sdd/SDD-GUIDE.md` for the full workflow.

---

## Hard rules — do NOT violate

1. **Never edit anything outside `web-ui/`.** The parent career-ops project (`../cv.md`, `../config/`, `../modes/`, `../data/`, `../reports/`, …) is **off-limits** to this repo. The user owns those files. The server reads them at runtime and writes only when an explicit user action triggers it (e.g. POST `/api/tracker`). Code changes never touch them.
2. **Never load real user data into context.** `cv.md`, `data/applications.md`, salary numbers in `config/profile.yml`, contents of `reports/` — these may contain a live job search. The `.aiignore` file already excludes them; honor it. If you need to test against realistic data, write a fixture under `tests/fixtures/`.
3. **Never weaken security headers.** `server/index.mjs` sets CSP / `X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy`. CSP excludes `'unsafe-inline'` from `script-src` on purpose — every event handler is `addEventListener`, never inline `onclick=`. Don't add inline scripts; don't add `'unsafe-eval'`; don't relax `frame-ancestors 'none'`.
4. **Never bypass URL validation.** `isValidJobUrl()` gates `/api/pipeline` and `/api/pipeline/preview` against SSRF (no loopback, no file://, no script chars). Any new endpoint that fetches user-supplied URLs MUST go through the same validator.
5. **Never sanitize CV markdown to a different schema than `stripDangerousMarkdown()` defines.** XSS hardening lives in one function; route every CV/markdown ingress through it.
6. **Never commit `.env`.** `.env.local`, `.env.*.local`, and `.env` are gitignored. Use `.env.example` placeholders only.
7. **Never use `--no-verify`, `--force`, or `git reset --hard` without explicit user approval.** Pre-commit hooks fail for a reason — fix the cause, don't skip the check.
8. **Tests must be CI-isolated.** Tests cannot assume the parent career-ops project is present. Build fixtures under `tests/fixtures/` or set `CAREER_OPS_ROOT=$(mktemp -d)` and bootstrap the minimal layout the test needs.

---

## Coding conventions

- **ESM only** — `"type": "module"`, `.mjs` for server, `.js` (ESM-by-convention, browser-loaded as classic scripts) for the SPA. No CommonJS.
- **Node ≥ 18.** Use `node:` prefix for built-ins (`node:fs`, `node:path`, `node:url`, …).
- **No bundlers, no transpilers, no TypeScript.** The SPA loads scripts via `<script src="…">` in `public/index.html`. Adding a build step is a ROADMAP-level decision, not a unilateral one.
  - **Carve-out (v1.119.0): `site/`** — the cvstart.org marketing landing is a SEPARATE static artifact with its own `package.json` and an Astro build that runs ONLY in CI (`.github/workflows/deploy-pages.yml`, paths-filtered). The no-build rule keeps applying to the SPA in `public/`; nothing in `server/` or `public/` may import from `site/`. See `site/README.md`.
- **No new runtime deps lightly.** Current production deps: `express`, `js-yaml`, and `multer`. Anything else needs justification in a spec.
- **File size targets** (from `~/.claude/rules/coding-style.md`): <400 lines per file. `server/index.mjs` was 1230 LOC at v1.7.x; **P-2 phase 1** (v1.8.0) split it to 762 LOC, **P-2 phase 2** (v1.9.0) finished the job — now ~130 LOC orchestrator. New routes go into `server/lib/routes/<topic>.mjs` exporting `register<Topic>Routes(app)`. Thirty-six route modules cover: liveness (v1.200.0 — GET /api/liveness zero-token/zero-browser "still live?" check for ATS-hosted postings (Greenhouse/Lever/Ashby/Workday/SmartRecruiters) via SSRF-safe safeGet; conservative — only 404/410 → expired; `#/tracker` badge), discover-ats (v1.202.0 — POST /api/portals/discover probes Greenhouse/Ashby/Lever for a company NAME via fixed-host+charset-validated safeGet, ≤12 probes; POST /api/portals/track explicit portals.yml write, known-host + adapter-recognized + control-char guarded; `#/portals` card), cv-sync (v1.204.0 — GET /api/cv-sync-check read-only relay of the parent's cv-sync-check.mjs which has NO --json — light structured parse of its ERROR:/WARN: lines into {ok,errors[],warnings[]}; `#/config` "Setup doctor" tab), assessments (v1.205.0 — GET /api/assessments relays assessment-log.mjs (default bare output IS the JSON list); POST /api/assessments explicit write via array-args to `assessment-log.mjs add`, control-char guarded so a TAB/newline can't break/inject a TSV row; `#/assessments` Skills log), funded (v1.133.0 — GET /api/company-funded relays the parent's company-funded.mjs read-only via `--json --dry-run` for funded-company discovery from public host-pinned RSS feeds; no writes, user-triggered `#/funded`), followup (v1.117.0 — GET /api/followup shells out to the parent's followup-cadence.mjs for per-application urgency and POST /api/followup/seed runs followup-seed.mjs (explicit user write of data/follow-ups.md pins); fail-soft {available:false} without the parent scripts), activity, auto-pipeline (server-side SSE auto-pipeline), batch (batch evaluate), career-plan (v1.95.0 — GET/PUT /api/career-plan writes the user-layer `config/career-plan.md`; POST /api/career-plan/generate builds an AI development plan from CV+profile+two-pager+memory, horizon + focus; shared cascade, manual fallback), config, content (cv/profile/portals/modes), cv-studio (v1.92.0 — POST /api/cv-studio/humanize voice-match rewrite; v1.101.0 — POST /api/cv-studio/tailor tailors the CV + writes a cover letter for a pasted JD through a generic recruiter checklist gate (errors block / warnings advise), grounded in CV+profile+two-pager, no hardcoded companies/roles; no writes; v1.117.0 — POST /api/cv-studio/add-entry turns a project/publication URL (isValidJobUrl + safeGet, SSRF-guarded) or pasted text into ATS bullets grounded ONLY in that source — suggestions only, never writes), cli-detect (v1.103.0 — GET /api/cli-detect reports which agent CLIs are installed + their paths via a read-only PATH scan; NEVER executes a found binary, no writes/LLM/network; surfaced as an "AI CLI tools" tab in `#/config`; v1.126.0 — roster resynced with the parent's docs/SUPPORTED_CLIS.md; v1.127.0 — parent #2115 re-added Cursor, so cli-detect probes `cursor` too: 9 first-class CLIs (Claude Code/Cursor/Codex/OpenCode/Antigravity `agy`/Grok Build/Qwen/Kimi/GitHub Copilot) + Gemini legacy = 10 tools; v1.173.0 — parent added Hermes (Nous Research) as a supported agent runtime, so cli-detect probes `hermes` too: 10 first-class CLIs + Gemini legacy = 11 tools), logos (v1.104.0 — GET /api/logo?domain= proxies a company's favicon from its OWN domain via the SSRF-safe `safeGet` binary path — privacy-preserving (no third-party logo API), size-capped, in-memory LRU cached, no disk writes; the client `public/js/lib/company-logo.js` renders it only when the user enables logos and skips shared ATS hosts in favour of a letter-avatar), usage (v1.105.0 — GET /api/usage rolls up `data/llm-usage.jsonl` into per-provider token totals + estimated USD over 24h/7d/30d/all; live provider calls append via `server/lib/llm-usage.mjs::recordUsage` (hooked in `runActiveProvider` + `routes/llm.mjs`), priced by the editable `server/lib/llm-pricing.mjs` table; read-only route, `#/usage` view), docs-assistant (v1.102.0 — POST /api/docs-assistant/ask answers how-to questions grounded ONLY in the app's own in-app help guide `docs/help/<lang>.md`: dependency-free keyword retrieval picks the top `##` sections for the question, the model answers from them or says the guide doesn't cover it; reads no user data, no writes; shared cascade + manual fallback), export (v1.100.0 — POST /api/export/docx turns client-held Markdown into a downloadable `.docx` via the dependency-free `server/lib/docx.mjs`; stateless, bounded, no writes/LLM/URL-fetch), health (+ dashboard), help, interview (v1.90.0 — mock interview turn/save/sessions; v1.133.0 — GET /api/interview/weekly-digest relays the parent's zero-LLM weekly-digest.mjs read-only, surfaced as `#/interview-digest`), jds, llm (evaluate/deep/mode/apply/interview-prep), market (v1.94.0 — POST /api/stats/market builds an AI salary/market report from the CV+profile target roles, a region + a currency; shared provider cascade, manual fallback, no writes), memory (v1.93.0 — about-me note GET/PUT/suggest; writes the user-layer `config/memory.md`, inlined into `bundleProjectContext` so it reaches every AI request), networking (v1.91.0 — networking plan/save/plans; writes the user-layer `networking/net-*.md`), openrouter (GET /api/openrouter/models — model-catalogue proxy), orientation (v1.96.0 — POST /api/orientation/generate builds an AI career-orientation profile — best-fit archetype vectors + roles + strengths + working-style + development recs — from CV+profile+two-pager+memory; reflection-not-test framing, shared cascade, manual fallback, no writes), pipeline (+ preview), portals (v1.99.0 — POST /api/portals/health probes each tracked company's careers_url via SSRF-safe safeGet to flag dead ATS slugs; read-only), reports, runners (buffered + streaming + PDFs), scan (in-process), stats (v1.86.0 — target-roles snapshot store + trend; v1.117.0 — GET /api/stats/patterns shells out to the parent's analyze-patterns.mjs, read-only; v1.118.0 — GET /api/stats/lifetime and GET /api/stats/salary-gap relay the parent's stats.mjs / salary-gap.mjs the same way: zero-token, read-only, fail-soft {available:false}), tracker (v1.118.0 — 'Hired' joined the canonical status whitelist, parent states.yml parity; celebratory badge + job-landed banner on #/tracker), two-pager (v1.89.0 — candidate two-pager GET/PUT/draft; writes the user-layer `config/two-pager.yml`; inlined into eval prompts + `◎` fit badge on scan; v1.100.0 — `POST /api/two-pager/draft {run:true}` runs the shared cascade live and parses the returned YAML back into the bounded shape so the form auto-fills, manual fallback preserved). The `#/stats` view is an eight-tab **Statistics** section (v1.94.0 — AI market report + own-pipeline analytics + target-role trend; v1.117.0 — rejection patterns; v1.118.0 — Lifetime: parent stats.mjs roll-up + salary-gap.mjs compensation observations; v1.185.0 — funnel & velocity; v1.191.0 — "what to learn next" upskill; v1.193.0 — rejection-latency) with Markdown/PDF/**DOCX** export via the shared `public/js/lib/report-export.js` (also used by `#/career-plan`, `#/orientation`, and `#/two-pager` — DOCX added in v1.100.0). CV Studio also ships two pure client libs: `public/js/lib/cv-diagnostics.js` (deterministic résumé score) and `public/js/lib/cv-privacy.js` (in-browser PII masking). v1.98.0 (parent web-v0.2.0 parity) added the **in-app bug reporter** — `public/js/lib/logbuf.js` (error ring buffer, loads first) + `public/js/lib/bug-report.js` (`window.BugReport` — privacy-floored diagnostic snapshot from `/api/health` + a `co-web-<base36>` dedupe fingerprint → preview-then-confirm → pre-filled GitHub issue; never CV/profile/URLs/keys), wired into the notifications-drawer head; no new server route. v1.113.0 added the **floating "Ask the docs" assistant** — `public/js/lib/docs-fab.js` (`window.DocsFab`, loaded from `index.html`, mounted into `document.body`): a gradient robot chat launcher pinned bottom-right (bottom-left in RTL) on every page that opens a compact chat over the SAME grounded `POST /api/docs-assistant/ask` endpoint (help-guide only, never CV/profile/tracker); CSP-safe (no inline handlers, `UI.md()` render boundary, static-constant SVG icons), theme-aware + RTL-mirrored styles in `app.css`, hidden on `#/docs-assistant`; no new server route. v1.114.0 added the **AI usage & cost HUD** — `public/js/lib/usage-hud.js` (`window.UsageHud`, loaded from `index.html`): a compact "USAGE" meter **pinned to the bottom of the sidebar** (v1.116.0 — `position: fixed`, full `--sidebar-w` width, on top of the sidebar, bottom-right in RTL; the widget pads the sidebar's bottom by its own height so the nav + version footer always scroll clear above it and the menu is never covered) showing LLM token use across 24h/7d/30d windows as `<tokens> · <est. cost>` green meter bars (bars scale against the 30d window — no misleading "share %") + an estimated 24h-cost footer, from the read-only `GET /api/usage` rollup (the same source as `#/usage`); **refreshes live** (15 s interval + on tab-focus + on route change), collapsible (state persists), CSP-safe (static-constant gauge SVG), no new server route. New live-LLM routes use the shared `server/lib/llm-dispatch.mjs` provider cascade (`runActiveProvider`/`providerAvailable`).
- **Routes follow REST norms:** `GET /api/<resource>`, `POST /api/<resource>` (create/append), `PUT /api/<resource>` (replace), `DELETE /api/<resource>/:id`. Streaming uses `GET /api/stream/<verb>` with SSE.
- **Conventional commits:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`. Optional scope: `feat(scan): …`, `fix(api): …`. Breaking change: `feat!:`.
- **Versioning:** `package.json` is the source of truth (currently 1.213.0). The footer reads it via `/api/health`. The parent's `VERSION` file is reported separately as `parentVersion` — they drift independently.
- **i18n (per-locale, I18N-SPLIT v1.60.0; I18N-EXPAND v1.70.0):** translations live one-file-per-locale in `public/js/lib/locales/i18n-dict.<lang>.js` (each `window.__I18N_DICT_<LANG> = { key: string }`) plus `i18n-dict.aliases.js`. `public/js/lib/i18n-dict.js` is a small **assembler** that merges them into `window.__I18N_DICT`; `i18n.js`'s `t()` is unchanged. As of v1.122.0 there are **17 locales** (`en, es, pt-BR, ko, ja, ru, zh-CN, zh-TW, fr, pl, uk, da, ar, de, it, tr, hi` — Hindi added v1.122.0) — add a new key to **all 17 locale files** (parity gated by `tests/i18n-locale-files.test.mjs` + `tests/i18n-coverage.test.mjs`; regenerate `tests/fixtures/i18n-dict.snapshot.json` after). Adding a *locale* touches: the locale file, the assembler `LANGS`/`TABLES`, `i18n.js` `LANGS`+`detect()`, `index.html` `<script>` order, `tests/helpers/i18n-vm.mjs` `I18N_LANGS`, `tools/i18n-audit.mjs`, `scripts/check-changelog-parity.mjs`, then the snapshot. **Arabic is RTL:** `i18n.js` sets `<html dir="rtl">` (`RTL_LANGS`) and the `[dir="rtl"]` block in `app.css` mirrors the chrome; LTR locales are byte-for-byte unchanged. The language picker is a flag `<select>` (`renderLangSwitcher` in `app.js`). The in-app **help guide** (`docs/help/`) is fully translated in all **17 locales** (pl/uk/ar shipped v1.70.0–v1.71.1; de/it/tr added in v1.85.0; each bundle holds the gated 31 H2 / 118 H3 structure — §20 "Statistics by target roles" added v1.86.0 through §28 "Career orientation" added v1.96.0; §29 "The CareerOps Manifesto" (+2 H3) added v1.120.0 for parent v1.20.0 parity, alongside the sidebar-footer manifesto link (`footer.manifesto` key ×17) and the cvstart.org footer link). All loaded via `<script src>` — no build, no fetch. Node tests/tooling load the dict through `tests/helpers/i18n-vm.mjs`.

See `docs/sdd/CONVENTIONS.md` for the complete list (CSS, i18n keys, error handling, logging).

---

## Testing discipline

- **Unit / integration:** `node --test tests/*.test.mjs`. Spawn `createApp()` in-process, hit it with `fetch` against an ephemeral port. Never hardcode `4317`.
- **Baseline at v1.69.0:** **1079** unit · **70** Playwright (smoke + full-cycle + forms + locale-sweep) · **20** smoke E2E · **23** comprehensive E2E. The next ship must keep all four ≥ this floor.
- **E2E:** `tests/e2e.mjs` and `tests/e2e-comprehensive.mjs` run the real server end-to-end. They're long but they catch SPA regressions the unit tests can't.
- **Coverage floor:** 80 % on non-trivial logic. Current baseline is ~93 % line / ~83 % branch — keep it there or above. Run `npm run test:coverage`.
- **TDD when adding behavior:** red → green → refactor. Skip TDD only for pure refactors with full coverage already present.
- **No mocks of internal collaborators.** If you need to fake the parent project, point `CAREER_OPS_ROOT` at a `mktemp -d` and write the minimal files (`cv.md`, `portals.yml`, …) the path under test needs.

---

## Hard-won lessons (v1.58.x cycle — 32 single-fix releases)

These are the traps that cost a release each. Don't re-step.

1. **`[hidden]` is a no-op against an author `display:` rule** (v1.58.34 → v1.58.35 user-reported drawer bug). Author CSS beats UA-level `[hidden] { display: none }` even at the same author specificity (last rule wins). If a component class sets `display: flex / inline-flex / grid`, always add an explicit `.selector[hidden] { display: none }` override — or toggle a class instead of the `hidden` attribute.
2. **`npm test 2>&1 | grep …` masks the exit code** (v1.58.27 / v1.58.30). `grep` returns 0 on match even when `npm test` failed. Two ships shipped failing tests because of this pattern; both were repaired in the next release. Always split: run `npm test` first, capture `$?`, then grep separately. The same applies to `git commit … 2>&1 | tail -3` — that hides commit-hook failures too.
3. **`cleanLlmMarkdown` is NOT an XSS sanitizer** (v1.58.3 R-2 doctrine). The XSS boundary is `UI.md()` on the client and `stripDangerousMarkdown()` on the CV ingress server side. Adding the LLM declutter step (`cleanLlmMarkdown`) to either is a category error. Keep responsibilities split.
4. **Author level cascade order matters when overriding UA defaults** (v1.58.35 lesson). The UA stylesheet for `[hidden]` is `display: none`. An author rule `.x { display: flex }` on the same element wins regardless of order in the cascade because author > user-agent. The general rule: any `display:` on an element shadows the UA `[hidden]` behavior.
5. **Doctrine: one-fix-per-release.** 32 v1.58.x releases all CI-green, all AI-review-LGTM. The single batched ship (v1.58.33 — U-13/U-14/U-15) was justified only because the three items shared CSS + tests and closed the cycle's leftovers. Otherwise: HIGH → MEDIUM → LOW, never bundled. Each release ships: bump + CHANGELOG ×8 (parity-gated) + a test + Playwright-verify + pre-commit AI-review LGTM + `ci.yml` green + redeploy.
6. **Pre-commit AI review is advisory; `ci.yml` is the hard gate.** A green pre-commit + red CI is possible (v1.58.0 lesson). Watch the CI run, not just the local commit hook.
7. **`PATHS` resolves once per process.** Static guard in `tests/paths-once.test.mjs`. Don't dynamically reimport `paths.mjs` to bust the cache — it breaks CI-isolated tests that bootstrap their own `CAREER_OPS_ROOT`. **Corollary — eager-import leak (v1.69.2):** `paths.mjs` resolves `PROJECT_ROOT` at *import time*. A test that sets `CAREER_OPS_ROOT` in `before()` must load every paths.mjs carrier (`server/index.mjs`, `prompts.mjs`, `store.mjs`, `en-scanner.mjs`, `ru-scanner.mjs`, `paths.mjs`) via **dynamic `import()` inside `before()`** — a top-level static import runs *before* the env is set, pins the REAL parent, and leaks writes (e.g. `PUT /api/profile`) into the user's real `config/profile.yml` / `data/`. `critical-fixes.test.mjs` did exactly this. Guard: `tests/test-root-isolation.test.mjs`.
8. **Help bundle parity (H2 + H3)** is locked by `tests/{canonical-docs-coverage,help-ru-config-section,help-ui}.test.mjs`. As of v1.69.0: **19** H2 sections (§19 "Localizing the app" added; was 18 pre-§19), **75** H3 subsections (v1.62.x added §5 "rss", v1.64.0 added §7 "Scanning hh.ru from outside Russia"). Adding a new H2 section means bumping the count in `canonical-docs-coverage` + `help-ui`; adding an H3 means bumping `help-ru-config-section`. v1.69.0 (P-14) rewrote §17 "How to add a new job-portal source" in place (count unchanged).
9. **`UI.toast()` parses its own postfix** (v1.58.24 / U-4). A trailing `(METHOD /path · HTTP NNN)` is auto-tucked into a collapsed `<details>`. Don't manually pre-strip it at the call site — the renderer handles it and the journal (v1.58.33 / U-13) captures the headline+detail split.
10. **Notifications drawer** (v1.58.34 / v1.58.35) is the only place that re-surfaces toasts. Don't add ad-hoc `console.log` for user-facing diagnostics; use `UI.toast(msg, kind)` and it'll automatically land in the journal.

---

## Working with the parent career-ops project

This repo is a **viewer + thin write-through** for career-ops. The contract is documented in `docs/architecture/DATA-FLOWS.md`. Key invariants:

- `server/lib/paths.mjs::resolveProjectRoot()` finds the parent via `CAREER_OPS_ROOT` env, then `..`, then `cwd()`. Use `PATHS.*` everywhere — never hardcode `../cv.md`.
- Reads are always safe. Writes happen only on explicit user actions: `POST /api/pipeline`, `POST /api/tracker`, `PUT /api/cv`, `POST /api/jds`, `DELETE /api/{jds,interview-prep}/:name`, `POST /api/config`, and the streaming script runners.
- The Russian portal scanner (`server/lib/ru-scanner.mjs`) and English portal scanner (`server/lib/en-scanner.mjs`) run **in-process** — they don't shell out to `scan.mjs` in the parent. The buffered runners (`/api/run/*`) DO shell out via `runner.mjs`.
- **Scanner source registry is dynamic (P-14, v1.69.0).** Each job board is a self-registering adapter under `server/lib/sources/<slug>.mjs`. `server/lib/sources/registry.mjs` no longer holds a hand-maintained array — at boot it `readdirSync`-scans the folder and dynamically `import()`s every `*.mjs` (top-level await), collecting each module's `export const meta = { value, label, region, configKey? }` block. To add a source, drop a file with a valid `meta`; malformed `meta` is skipped with one `console.warn`. Public API (`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`, `getRegionalSources`) is unchanged; `discoverSources(dir)` is exported for tests. Full walkthrough: help §17. RU sources additionally need a `RU_DISPATCH` row in `ru-scanner.mjs`.

---

## When in doubt

1. Re-read `docs/architecture/OVERVIEW.md`.
2. Run `npm test` — the suite documents existing invariants better than any prose.
3. Search the changelog (`CHANGELOG.md`) for the feature area — recent entries explain why things are the way they are.
4. Read **`.claude/PROJECT-CONTEXT.md` → "Realizations / hard-won notes"** and the latest `qa/v*-regression/FIX-PROMPT-*.md` — they record non-obvious traps (PATHS-resolves-once-per-process, CI-vs-pre-commit gate, the SPA `lang` injection, server-English-by-policy, GET-only live smoke, `cleanLlmMarkdown` ≠ XSS boundary).
5. Ask the user. Don't guess at security-sensitive code.

---

## Quick reference

| Command | Purpose |
|---|---|
| `npm start` | Run the server on `127.0.0.1:4317` |
| `npm run dev` | Run with `--watch` |
| `npm test` | Full test suite (`node --test`) |
| `npm run test:coverage` | Same, with V8 coverage |
| `npm run test:e2e` | Smoke E2E |
| `npm run test:e2e:full` | Comprehensive E2E |
| `bash bin/start.sh` | One-shot launcher (installs deps if missing, opens browser) |
| `node scripts/portals-health-check.mjs` | Audit `portals.yml` reachability |

| Directory | Owner |
|---|---|
| `server/` | This repo. Express + lib modules. Edit freely under conventions. |
| `public/` | This repo. SPA. Edit freely under conventions. |
| `tests/` | This repo. Keep CI-isolated. |
| `docs/` | This repo. Architecture, SDD, conventions, help. |
| `.claude/` | This repo. Agent config (subagents, commands, settings). |
| `.planning/` | GSD scratch (gitignored). Specs/plans/state per phase. |
| `..` (parent career-ops) | **NOT this repo.** Do not edit. |
