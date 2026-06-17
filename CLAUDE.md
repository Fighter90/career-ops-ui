# career-ops-ui — Agent Instructions

> Project-level CLAUDE.md. Loaded automatically by Claude Code (and equivalently by Codex via AGENTS.md, Gemini CLI via GEMINI.md). User instructions and `~/.claude/CLAUDE.md` still take precedence.

## What this repo is

`career-ops-ui` is an **Express + vanilla-JS SPA** that puts a polished web interface on top of [`santifer/career-ops`](https://github.com/santifer/career-ops) — a Claude-Code-driven AI job-search pipeline. It does **not** replace career-ops; it sits inside it as `career-ops/web-ui/` and reads/writes the same files (`cv.md`, `data/applications.md`, `reports/`, `portals.yml`, …).

Stack at a glance:

| Layer | Tech | Files |
|---|---|---|
| Server | Node ≥18, Express 4, js-yaml | `server/index.mjs` (~130 lines, orchestrator only), `server/lib/*.mjs`, `server/lib/routes/*.mjs` (15 modules) |
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
- **No new runtime deps lightly.** Current production deps: `express` and `js-yaml`. Anything else needs justification in a spec.
- **File size targets** (from `~/.claude/rules/coding-style.md`): <400 lines per file. `server/index.mjs` was 1230 LOC at v1.7.x; **P-2 phase 1** (v1.8.0) split it to 762 LOC, **P-2 phase 2** (v1.9.0) finished the job — now ~130 LOC orchestrator. New routes go into `server/lib/routes/<topic>.mjs` exporting `register<Topic>Routes(app)`. Fifteen route modules cover: activity, auto-pipeline (server-side SSE auto-pipeline), batch (batch evaluate), config, content (cv/profile/portals/modes), health (+ dashboard), help, jds, llm (evaluate/deep/mode/apply/interview-prep), openrouter (GET /api/openrouter/models — model-catalogue proxy), pipeline (+ preview), reports, runners (buffered + streaming + PDFs), scan (in-process), tracker.
- **Routes follow REST norms:** `GET /api/<resource>`, `POST /api/<resource>` (create/append), `PUT /api/<resource>` (replace), `DELETE /api/<resource>/:id`. Streaming uses `GET /api/stream/<verb>` with SSE.
- **Conventional commits:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`. Optional scope: `feat(scan): …`, `fix(api): …`. Breaking change: `feat!:`.
- **Versioning:** `package.json` is the source of truth (currently 1.74.2). The footer reads it via `/api/health`. The parent's `VERSION` file is reported separately as `parentVersion` — they drift independently.
- **i18n (per-locale, I18N-SPLIT v1.60.0; I18N-EXPAND v1.70.0):** translations live one-file-per-locale in `public/js/lib/locales/i18n-dict.<lang>.js` (each `window.__I18N_DICT_<LANG> = { key: string }`) plus `i18n-dict.aliases.js`. `public/js/lib/i18n-dict.js` is a small **assembler** that merges them into `window.__I18N_DICT`; `i18n.js`'s `t()` is unchanged. As of v1.70.0 there are **12 locales** (`en, es, pt-BR, ko, ja, ru, zh-CN, zh-TW, fr, pl, uk, ar`) — add a new key to **all 12 locale files** (parity gated by `tests/i18n-locale-files.test.mjs` + `tests/i18n-coverage.test.mjs`; regenerate `tests/fixtures/i18n-dict.snapshot.json` after). Adding a *locale* touches: the locale file, the assembler `LANGS`/`TABLES`, `i18n.js` `LANGS`+`detect()`, `index.html` `<script>` order, `tests/helpers/i18n-vm.mjs` `I18N_LANGS`, `tools/i18n-audit.mjs`, `scripts/check-changelog-parity.mjs`, then the snapshot. **Arabic is RTL:** `i18n.js` sets `<html dir="rtl">` (`RTL_LANGS`) and the `[dir="rtl"]` block in `app.css` mirrors the chrome; LTR locales are byte-for-byte unchanged. The language picker is a flag `<select>` (`renderLangSwitcher` in `app.js`). The in-app **help guide** (`docs/help/`) is fully translated in all **12 locales** (pl/uk/ar UI dict shipped v1.70.0; their **help bundles** were added in v1.71.1; each bundle holds the gated 19 H2 / 75 H3 structure). All loaded via `<script src>` — no build, no fetch. Node tests/tooling load the dict through `tests/helpers/i18n-vm.mjs`.

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
