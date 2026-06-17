# career-ops-ui — Quick Agent Context

> **Purpose.** Single-file orientation for AI agents and IDE assistants
> joining a session. The canonical project rules live in
> [`../CLAUDE.md`](../CLAUDE.md). This file is the compressed version
> a fresh agent should read first.
>
> **Audience.** Claude Code subagents, Cursor / Codex / Aider sessions,
> any IDE assistant that doesn't auto-load CLAUDE.md.
>
> **Repo state.** v1.71.1 (2026-06-17). **1103** `node --test` cases,
> Playwright (smoke + full-cycle + forms + locale-sweep ×12 + theme-toggle). **v1.70.0 (I18N-EXPAND)** added 3 locales — Polish (pl), Ukrainian (uk), Arabic (ar, full RTL via `<html dir>` + `[dir="rtl"]` in app.css) — for **12 UI locales**, plus a flag `<select>` language switcher; **v1.71.0** ported the parent's cover-letter mode to `#/cover` with a Generate-PDF button; **v1.71.1** translated the in-app help guide into all 12 locales (`docs/help/{pl,uk,ar}.md`). Parent tracked at **career-ops v1.11.0**. **v1.69.0 (P-14)** made `server/lib/sources/registry.mjs`
> auto-discover scanner adapters at boot (drop a `*.mjs` with an `export const meta` block — no registry edit).
> **v1.60.0 (I18N-SPLIT)** split the 8-language
> translation megafile into one file per locale under `public/js/lib/locales/`; `i18n-dict.js` is now an
> assembler, `t()` and all call-sites unchanged (lossless, 678 keys). v1.55.1→v1.56.4 consolidated UX fix-prompt
> complete; **v1.57.0** adds OpenRouter as a 5th headless live-eval
> provider (one key → 300+ models, live `#/config` model dropdown via
> `GET /api/openrouter/models`) and fixes the `/#/config`
> "validation failed" bug (keys pasted with whitespace/newline now
> trim + save for every provider). Sole open item: G-005 (cross-repo,
> blocked on the parent oferta.md commit).

---

## What this repo is

`career-ops-ui` is an Express + vanilla-JS SPA that puts a polished
web interface on top of
[`santifer/career-ops`](https://github.com/santifer/career-ops) —
a Claude-Code-driven AI job-search pipeline. It sits inside the
parent project as `career-ops/web-ui/` and reads/writes the same
data files (`cv.md`, `data/applications.md`, `reports/`,
`portals.yml`).

**Single-tenant, loopback-by-default, no telemetry, no cloud accounts.**

---

## Stack snapshot

| Layer | Tech | Where |
|---|---|---|
| Server | Node ≥ 18, Express 4, js-yaml, multer | `server/index.mjs` (~130-LOC orchestrator) + `server/lib/routes/*.mjs` (15 modules) |
| Helpers (v1.21+) | ESM, no transpiler | `server/lib/{paths,parsers,runner,security,prompts,store,anthropic,env-config,activity-log,dotenv,safe-fetch,file-lock,rate-limit,en-scanner,ru-scanner}.mjs` + `server/lib/sources/{greenhouse,ashby,lever,rss,smartrecruiters,workable,workday,geekjob,getmatch,habr,hh,trudvsem}.mjs` (12 adapters, auto-discovered via `registry.mjs` since v1.69.0/P-14) |
| SPA | Vanilla JS, hash-router | `public/index.html`, `public/js/{app,router,api}.js`, `public/js/views/*.js`, `public/js/lib/{i18n,i18n-dict,skills,auto-pipeline,pdf-generate}.js`, `public/js/lib/locales/i18n-dict.<lang>.js` (12 + aliases) |
| Styling | Hand-written CSS + design tokens | `public/css/app.css` |
| Tests | `node --test` (TAP) + Playwright | `tests/*.test.mjs`, `tests/playwright-smoke.mjs`, `tests/e2e*.mjs` |
| Build | None | Files served as-is from `public/` |
| CI | GitHub Actions, Node 18/20/22 | `.github/workflows/{ci,release,publish-package,ai-review,dashboard-screenshots}.yml` |

**Test baseline (v1.71.0):** 1100/1100 unit · Playwright (smoke + full-cycle + forms + locale-sweep ×12 + theme-toggle) · 20/20 smoke E2E · 23/23 comprehensive E2E · coverage ~93% line / ~83% branch.

---

## Hard rules (full text in `CLAUDE.md`)

1. **Never edit anything outside `web-ui/`.** Parent career-ops is read-only from this repo.
2. **Never load real user data into context.** `.aiignore` exists.
3. **Never weaken security headers.** CSP excludes `'unsafe-inline'`.
4. **Never bypass `isValidJobUrl`** for URL-fetching endpoints. v1.21+ also requires routing through `server/lib/safe-fetch.mjs::safeGet` for the actual fetch (DNS-rebind defense).
5. **Never sanitize CV markdown outside `stripDangerousMarkdown`.** Entity-aware as of v1.22.0.
6. **Never commit `.env`.** Use `.env.example` placeholders.
7. **Never use `--no-verify` / `--force` / `git reset --hard`** without explicit user approval.
8. **Tests must be CI-isolated.** No parent dependency, no live network, no port collision (`server.listen(0)`).

---

## v1.21–v1.22 security envelope (added since last big update)

When auditing or extending these surfaces, route through the helpers below — don't reinvent.

| Surface | Helper | Lives in |
|---|---|---|
| URL validation (input gate) | `isValidJobUrl(s)` | `server/lib/security.mjs` |
| Outbound GET (DNS-pinned, redirect-revalidated) | `safeGet(url, opts)` | `server/lib/safe-fetch.mjs` |
| `:name` / `:slug` route-param sanitization | `sanitizePathName(s)` | `server/lib/security.mjs` |
| CV markdown XSS strip (entity-aware) | `stripDangerousMarkdown(s)` | `server/lib/security.mjs` |
| LLM endpoint throttle (LAN deploys only) | `llmRateLimit` middleware | `server/lib/rate-limit.mjs` |
| Concurrent-write mutex on parent files | `withFileLock(path, fn)` | `server/lib/file-lock.mjs` |
| i18n key coverage (CI canary) | `tests/i18n-coverage.test.mjs` | (test-time) |
| a11y form-wire validity (CI canary) | `tests/a11y-form-wires.test.mjs` | (test-time) |

---

## SPA invariants

- **No build step.** Add a script via `<script src>` in `public/index.html`; the file ships as-is.
- **No inline event handlers.** CSP blocks them. Use `addEventListener` via the `on*` branch of `UI.el()`.
- **All markdown rendering** goes through `UI.md(text)` (in `public/js/api.js`). It escape-firsts. Don't bypass with raw `innerHTML`.
- **All i18n** goes through `t('key', 'EN fallback')`. The fallback is for development; missing-from-DICT keys fail the `i18n-coverage` test in CI.
- **a11y form wires.** Every `<input>` / `<textarea>` / `<select>` needs either a `<label htmlFor="…">` or an `aria-label`. Every `aria-describedby` must point at an existing `id`. The `a11y-form-wires` test enforces both.
- **`UI.el()`** accepts `htmlFor` as a React-style alias for the `for` attribute (v1.20.0+, null-guarded v1.22.0+).

---

## Project tree (top three levels)

```
career-ops-ui/
├─ AGENTS.md, CLAUDE.md, GEMINI.md            # agent shims (CLAUDE.md is canonical)
├─ CHANGELOG.{,es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW,fr,pl,uk,ar}.md
├─ README.{,es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW,fr,pl,uk,ar}.md
├─ LICENSE, package.json, package-lock.json
├─ bin/
│  ├─ start.sh                                  # one-shot launcher
│  ├─ setup.sh                                  # bootstrap (clones career-ops + web-ui)
│  └─ run_all.sh                                # every test surface in one go
├─ server/
│  ├─ index.mjs                                 # orchestrator: middleware + 14 register*Routes(app)
│  └─ lib/
│     ├─ paths.mjs, parsers.mjs, runner.mjs
│     ├─ security.mjs                          # isValidJobUrl, sanitizePathName, stripDangerousMarkdown, …
│     ├─ safe-fetch.mjs                        # v1.21.0 (B-1) DNS-pinned safeGet
│     ├─ file-lock.mjs                         # v1.21.0 (H-6) withFileLock
│     ├─ rate-limit.mjs                        # v1.21.0 (H-5) llmRateLimit
│     ├─ prompts.mjs, store.mjs, anthropic.mjs
│     ├─ env-config.mjs, activity-log.mjs, dotenv.mjs
│     ├─ en-scanner.mjs, ru-scanner.mjs
│     ├─ sources/                              # 12 adapter clients + registry.mjs (auto-discovery, P-14 v1.69.0)
│     ├─ portals/                              # adapter registry + resolveAdapter()
│     └─ routes/                               # 15 route modules — one per topic (incl. openrouter)
├─ public/
│  ├─ index.html                               # CSP-locked shell
│  ├─ css/app.css                              # design tokens, WCAG 2.2 AA + 1.4.1 redundant cues
│  └─ js/{app,router,api}.js + js/lib/* + js/views/*
├─ tests/
│  ├─ *.test.mjs                               # 900 unit + integration
│  ├─ playwright-{smoke,full-cycle,forms}.mjs  # 58 browser flows
│  ├─ e2e{,-comprehensive}.mjs                 # 20 + 23 E2E
│  └─ fixtures/                                # CI-isolated test data
├─ docs/
│  ├─ PROJECT.md, ROADMAP.md, PRODUCTION-READINESS.md, portals-examples.md
│  ├─ sdd/{SDD-GUIDE,CONVENTIONS}.md
│  ├─ architecture/{OVERVIEW,SERVER,FRONTEND,API,DATA-FLOWS}.md
│  ├─ reviews/REVIEW-*.md                      # per-release code reviews
│  ├─ specs/V1.20.1-BACKLOG.md                 # last sprint backlog (closed)
│  ├─ help/{en,es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md   # 16-section help bundles
│  └─ adr/                                     # architecture decision records
├─ .claude/
│  ├─ settings.json
│  ├─ PROJECT-CONTEXT.md                       # this file
│  ├─ agents/                                  # 3 project-specific subagents
│  └─ commands/                                # slash-command stubs
├─ .github/
│  ├─ workflows/                               # 5 CI workflows
│  └─ copilot-instructions.md                  # GitHub Copilot canonical entry point
├─ qa/
│  └─ claude-cowork-browser-test-prompt.md     # E2E manual + automated prompt
└─ .planning/                                   # GSD scratch (gitignored)
```

---

## How to navigate

| Question | Read this |
|---|---|
| High-level project goal | [`../docs/PROJECT.md`](../docs/PROJECT.md) |
| Server architecture | [`../docs/architecture/SERVER.md`](../docs/architecture/SERVER.md) |
| Every endpoint + payload | [`../docs/architecture/API.md`](../docs/architecture/API.md) |
| Data flows in/out of parent files | [`../docs/architecture/DATA-FLOWS.md`](../docs/architecture/DATA-FLOWS.md) |
| Last shipped release | [`../docs/reviews/REVIEW-2026-05-14-v1.21.0.md`](../docs/reviews/REVIEW-2026-05-14-v1.21.0.md) |
| Deferred work | [`../docs/PRODUCTION-READINESS.md`](../docs/PRODUCTION-READINESS.md) |
| Spec-driven workflow | [`../docs/sdd/SDD-GUIDE.md`](../docs/sdd/SDD-GUIDE.md) |
| Coding conventions | [`../docs/sdd/CONVENTIONS.md`](../docs/sdd/CONVENTIONS.md) |

---

## Standard agent loop (for non-trivial work)

```
1. gsd-explore           → research what exists / what's needed
2. gsd-plan-phase        → docs/specs/V<X.Y.Z>-BACKLOG.md or .planning/ artifact
3. gsd-execute-phase     → small atomic commits with passing tests
4. gsd-verify-work       → goal-backward check against the spec
5. gsd-code-review       → produce docs/reviews/REVIEW-*.md
```

For trivial work (single file, single concern, < 30 min): just edit, run tests, commit.

---

## Common pitfalls (read once, avoid forever)

- **Hardcoded `../cv.md`** — use `PATHS.cv` from `server/lib/paths.mjs`.
- **Hardcoded port 4317** — tests bind to `:0` and read `server.address().port`.
- **Inline event handlers** (`<button onclick="…">`) — CSP rejects. Use `addEventListener` via `UI.el()`.
- **`innerHTML` without `UI.md`** — bypass of XSS strip. Route all markdown through `UI.md(text)`.
- **`globalThis.fetch` for outbound HTTP** — bypasses DNS-rebind defense. Use `safeGet` from `server/lib/safe-fetch.mjs`.
- **Read-modify-write on `applications.md` / `pipeline.md`** without `withFileLock(path, fn)` — race condition will silently drop rows.
- **New i18n key without DICT entry** — `tests/i18n-coverage.test.mjs` (+ `tests/i18n-locale-files.test.mjs` parity) fails. Add the key to **all 12 per-locale files** `public/js/lib/locales/i18n-dict.<lang>.js` (I18N-SPLIT v1.60.0) — NOT to `i18n.js` (logic-only) or `i18n-dict.js` (assembler).
- **`aria-describedby` without matching `id`** — `tests/a11y-form-wires.test.mjs` fails.
- **New runtime dep** — current production deps are `express`, `js-yaml`, `multer`. Adding more needs a spec.
- **Real LLM calls in tests** — mock the SDK adapter; never hit Anthropic / Gemini from a unit test.

## Realizations / hard-won notes (v1.57–v1.60)

- **I18N-SPLIT (v1.60.0) — per-locale dictionary.** Translations live ONLY in `public/js/lib/locales/i18n-dict.<lang>.js` (12 files) + `i18n-dict.aliases.js`; `i18n-dict.js` is an assembler that rebuilds `window.__I18N_DICT` — it stores nothing. Three traps: (1) **vm-realm deepEqual** — objects assembled inside `node:vm` have a foreign `Object.prototype`, so `deepStrictEqual` vs a JSON snapshot throws "same structure but not reference-equal"; round-trip `JSON.parse(JSON.stringify(x))` first. (2) **Load order is load-bearing** — all 12 locale `<script>`s must precede `i18n-dict.js`, which must precede `i18n.js` (locked by `tests/i18n-locale-files.test.mjs`). (3) **A "passing" CI step can be a no-op** — the `ci.yml` inline i18n check validated an *empty* dict for ~37 releases after the v1.23 split (it loaded only `i18n.js`); now it loads the full chain + a `keys < 600` floor. Node tests load the dict via `tests/helpers/i18n-vm.mjs` (`loadAssembledDict` / `loadI18n` / `legacyDictText` / `allLocaleSource`).
- **`PATHS` resolves ONCE per process** (`server/lib/paths.mjs`, at module load). Set `CAREER_OPS_ROOT` *before* the first `server/*` import; you cannot switch parent roots mid-process. `node --test` isolates per *file* (child process) — multi-root within one file is infeasible. Path/IO-coupled helpers (`checkProfileCustomized`) → guard **statically** (assert the source contract), not via cache-bust dynamic imports. (v1.58.0 cache-bust test passed locally, failed CI on all Node versions → v1.58.1 static-guard fix.)
- **Pre-commit AI review is advisory; `ci.yml` is the hard gate.** A green pre-commit + red CI is possible (v1.58.0). Always re-confirm CI/Publish conclusions after a tag push.
- **`publish-package.yml` runs the test suite** before publishing and is **manual `workflow_dispatch`** — the `GITHUB_TOKEN`-created Release does NOT trigger it. A failing test reds both CI *and* Publish.
- **`api.js` is parsed as binary by `grep`** (stray byte) — use `grep -a` or `sed`.
- **The SPA's `api.js` auto-injects `lang` into every JSON POST body.** Non-LLM routes that strictly reject unknown keys must `delete body.lang` before validating (this was the real `/#/config` "validation failed" root cause, v1.57.2).
- **Server diagnostics stay English by policy; the SPA localizes its own chrome.** Don't add one-off i18n to a server error string — it'd be inconsistent with every other server error. Localize client-owned strings only (`api.netError`/`api.netHint`).
- **Live smoke = GET only.** Write-side endpoints on the deployed server write the real parent `.env`/files. Verify writes via CI-isolated tests with `CAREER_OPS_ROOT=mktemp`.
- **`cleanLlmMarkdown` (`server/lib/llm-output.mjs`)** strips echoed tool/agent scaffolding from model prose; apply at every provider boundary + on serving saved briefs. It is NOT an HTML sanitizer — `UI.md()` remains the XSS boundary.
- **Repro before patching (v1.58.5, NEW-3).** The v1.58.3 MASTER regression observed two POSTs to `/api/mode/followup` after a single Run-live click — but source inspection of `public/js/views/mode-page.js::submit()` showed no structural double-bind (single `onClick` per button, no parent `<form>`, no `addEventListener('submit')`), and `UI.withSpinner` (FIX-L1) already disables the button while the request is in flight. Following the fix-prompt's "repro first" doctrine: NEW-3 was triaged **not-reproducible**, and a Playwright test in `tests/playwright-smoke.mjs` was written to *prove* exactly-one-POST under the exact regression recipe (date left blank, manual button shares `submit()` with Run live, 3 s window). When in doubt about a flaky-symptom report, write the regression-locking test first; if it goes green the QA observation is recipe-only, not a shipped code bug. Two practical Playwright lessons reinforced here: (i) cross-test localStorage pollution (a prior language-switcher test leaves `career-ops-ui:lang=ru` in the shared context) — fix with `page.addInitScript(() => localStorage.setItem('career-ops-ui:lang','en'))` so the SPA reads EN at module init *before* any view renders; (ii) use a locale-stable selector (e.g. the `▶` glyph is identical across all 8 locales) instead of localized button text.
- **CSP is unconditional (v1.58.4, NEW-1).** Before v1.58.4 the `Content-Security-Policy` header was layered on only when `isPubliclyExposed()` was true (HOST bound beyond loopback). The v1.58.3 MASTER regression (§5) flagged that `/` and `/api/health` returned **no** CSP on `127.0.0.1`, leaving `UI.md()`'s escape-first contract as the sole XSS defence — defence-in-depth must not depend on the bind address. CSP is now always emitted with the identical directive set. The directive set itself is unchanged (Google Fonts allowlist preserved for Inter; `script-src 'self'` only, never `'unsafe-inline'`/`'unsafe-eval'`). When you add a new asset/source, update both the policy in `server/index.mjs` *and* the route-walk in `tests/playwright-smoke.mjs` — the latter monkeys console errors for `Refused to … because it violates the following Content Security Policy directive` across en/ru/ja/zh-TW × 7 routes.
