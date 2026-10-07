# PLAN — program of work, October 2026

One plan for everything raised in the 2026-10-06 session, so work is not mixed. **One release
per concern; one agent per file group; every fix lands with its test.** Order is by risk to
users: ship what is finished, then close crash/security holes, then dead data sources, then
UI, then new features.

Evidence for every item is in the reviews: ~190 verified findings from 28 read-only review
agents (slices: server infra, scanners, LLM layer, routes ×3, sources ×8, adapters ×2, SPA
views ×3, client libs ×2, tests ×3, scripts/CI, security sweep, i18n, CSS/a11y).

## Releases

| # | Release | Concern | Status |
|---|---|---|---|
| 1 | **v1.240.0** | Parent parity @ `62905981` (6 sources, 6 provider fixes) + checklist `pipeline.md` (#380, @bullitt186) | **Ready — PR → CI → merge → tag → release → publish → wiki → deploy** |
| 2 | **v1.241.0** | **Server hardening** — security, process-crash, data-loss | Foundation done (Host/Origin guard, async-error safety, `CAREER_OPS_ROOT`, runner kill); agents A–D next |
| 3 | **v1.242.0** | **Sources correctness** — dead sources, "malformed 200 = empty board", pagination, SSRF pins | Planned (agents E–F) |
| 4 | **v1.243.0** | **Client fixes** — views, libs, CSS/a11y, i18n gaps | Planned (agents G–H, I18N) |
| 5 | **v1.244.0** | **`#/scan` redesign** — row anatomy, title cell, filters, pagination | Spec drafted |
| 6 | **v1.245.0** | **Tamil (`ta`) locale** — the 18th language | Planned |
| 7 | **v1.246.0** | **Upstream features** — inline status edit, batch spend confirm, evidence-confidence chip, saved contacts | Backlog, ranked |

Coverage (**≥ 90 % line and branch** on `server/` and `public/`, measured; baseline 97.4 % line /
86.0 % branch) is not a release of its own: each of releases 2–5 raises it on the files it
touches, `scripts/coverage-report.mjs` (created by agent T in step 1.2) gates it, and release 6 publishes the final table.
Spec: `specs/2026-10-06-test-coverage-90.md`.

## Execution checklist (agent mode) — the order work actually happens in

Every release runs the same **ship train**: `test:ci` + browser suite + `evals/workflow` + i18n audit +
changelog parity → docs ×17 (English by the orchestrator, one agent per other locale) → QA prompt → PR → CI green → squash-merge →
tag → Release workflow → `publish-package.yml` → Pages deploy → wiki → **`deploy.yml mode=deploy`**
to resumecraft.ru → `deploy.yml mode=verify` → local restart. Nothing is "done" before verify passes.

| Phase | Step | Who | Exit criterion |
|---|---|---|---|
| **0** | 0.1 Open PR for `feat/v1.240.0-parent-parity`, CI green, merge | orchestrator | merged to `main` |
| | 0.2 Review external PR **#381** (job map: OSM tiles + Nominatim) — CSP, privacy, SSRF, tests, i18n ×17 | review agent + local suite | approve-or-request-changes recorded on the PR |
| | 0.3 Ship train v1.240.0 | orchestrator (locale docs already done) | prod `/api/health` = 1.240.0 |
| **1** | 1.1 Rebase `fix/v1.241.0-review-hardening` on `main` | orchestrator | clean rebase, suite green |
| | 1.2 Fix-and-cover agents **A** infra · **B** routes-llm · **C** routes-data · **D** scanners · **CI** workflows/packaging · **T** test isolation + create `scripts/coverage-report.mjs` (each owns its files only) | 6 agents in parallel | each group's findings closed with a red→green test; its files ≥ 90 % branch |
| | 1.3 Integrate: one suite run, locale keys added in one pass, review of the combined diff | orchestrator + 1 reviewer | suite + browser green |
| | 1.4 Ship train v1.241.0 (deploy writes the `ALLOWED_HOSTS` drop-in) | orchestrator + locale agents | prod verify passes, public check 401 (gated), not 421 |
| **2** | 2.1 `server/lib/sources/_shape.mjs` helper | 1 agent | helper + tests merged first |
| | 2.2 Source-family agents (≈6, alphabetical families) + adapters host-pin agent | 7 agents | justjoin/nofluffjobs live again; every source throws on a malformed 200 |
| | 2.3 Ship train v1.242.0 | orchestrator + locale agents | prod verify passes |
| **3** | 3.1 Client agents: libs · views ×3 · CSS/a11y · i18n | 6 agents | findings closed, Playwright green |
| | 3.2 Ship train v1.243.0 | orchestrator + locale agents | prod verify passes |
| **4** | `#/scan` redesign per spec — design pass, layout tests red, implementation, 17 locales | 2–3 agents | spec acceptance criteria |
| **5** | Tamil locale (`ta`) | 1 agent + locale fan-out | 18 locales green |
| **6** | Upstream features backlog | per feature | per spec |
| **∞** | Coverage ratchet: `scripts/coverage-report.mjs` gate raised each phase to the measured value | each phase | final ≥ 90 % line **and** branch |

External PRs that arrive meanwhile go through `.claude/skills/contributor-pr` and ride the next ship train.

## Release 2 — server hardening (v1.241.0): groups and the findings each owns

| Group | Files (owned exclusively) | Must fix |
|---|---|---|
| **A** infra | `lib/fetch-timeout.mjs`, `http-json.mjs`, `safe-fetch.mjs`, `security.mjs`, `rate-limit.mjs`, `dotenv.mjs`, `env-config.mjs`, `openai.mjs` (base URL), `html-to-text.mjs`, `cv-import.mjs`, `activity-log.mjs` | redirect hop guard + body deadline; trailing-dot FQDN; BUCKETS eviction; `.env` inline comments; `*_BASE_URL` vendor pins; quadratic regexes (`html-to-text`, `stripDangerousMarkdown`); pandoc `--sandbox`; bind-host exposure; activity filter-before-slice |
| **B** routes-llm | `routes/llm.mjs`, `auto-pipeline.mjs`, `career-plan.mjs`, `batch.mjs`, `cv-studio.mjs`, `lib/llm-dispatch.mjs`, `anthropic.mjs`, `gemini.mjs`, `prompts.mjs`, `llm-usage.mjs` | the crash bodies; cv-studio URL path; slug collision; provider cascade + usage; `--no-save`; truncation flag; 16 KB file cap; max_completion_tokens; empty-answer error; JD trust boundary; batch process group |
| **C** routes-data | `routes/{interview,networking,jds,logos,activity,docs-assistant,discover-ats,assessments,stats,tracker,portals,scan,pipeline,runners,content,config}.mjs`, `lib/parsers.mjs`, `lib/discover-ats.mjs` | NUL/typing crashes; null portals entry; scan both-phase abort; pipeline delete data loss; PDF `--skip-fact-check`; history slice; overwrite/collision; CJK tokenizer; `Object.hasOwn`; `\s*` → `[ \t]*`; unicode slugify |
| **D** scanners | `lib/en-scanner.mjs`, `ru-scanner.mjs`, `scan-quarantine.mjs`, `cooldown.mjs`, `location-filter.mjs`, `detect-reposts.mjs`, `liveness-*.mjs`, `portals/registry.mjs`, `portals/adapters/{collage,feishu-jobs,mokahr,telegram,telegram-channel}.mjs` | **snapshot never replaced by an emptier scan** (R-12); quarantine keyed by url; within-run dedup; blank-entry filters; yaml errors surfaced; atomic writes; `resolveAdapter` catches; adapters return `null` |

Each agent: red test → fix → green, coverage of its files ≥ 90 %, **no edits outside its files**, and a
list of any new user-visible string (the orchestrator adds locale keys in one pass).

## Release 3 — sources (v1.242.0)

Dead in production: **justjoin** (envelope changed), **nofluffjobs** (400 without `salaryCurrency`).
Then, uniformly across ~40 sources: a 200 with the wrong shape **throws**; page-1 failure throws,
later-page failure keeps partials; pagination stops on the **raw** page length; job URLs must be
https on the pinned host; host pins replace `includes('vendor')` in adapters (lever, greenhouse,
ashby, smartrecruiters, workable, ibm, arbeitsagentur, workingnomads, remoteok, remotive, rss);
`himalayas`/`jobicy` cursor pagination; `mycareersfuture` 12-field shape; `workday` pagination +
strict. A shared helper `server/lib/sources/_shape.mjs` (`requireArray`, `requireContainer`) is added
**first**, by one agent, before the per-family agents start (the registry skips `_` files).

## Release 4 — client (v1.243.0)

Skip-link 404; `API.stream` double error; stream-without-`done`; unsaved-edit guards (cv, two-pager,
career-plan, memory); swallowed load errors that let Save overwrite; listener leaks (`scan:refresh`,
`providers-changed`, `providerCostHint`); orphaned scan SSE on navigation; salary/currency/country
parsers (`skills`, `role-stats`, `fit-score`, `countries`); privacy mask; Unicode word boundaries;
CSS/a11y (dark-theme toast contrast, sticky banners over the topbar, drawer focus, landmarks,
`--rausch` contrast, RTL tables); i18n gaps (Danish detection, provider lists in 17 locales,
`hi` leak guard, six truncated `pipe.hint`, 33 dead keys).

## Release 5 — `#/scan` redesign (v1.244.0)

See `specs/2026-10-06-scan-page-redesign.md`. Maintainer's concrete complaint: the title cell
carries company + `⬆ boost` + fit chip + `◎ score` + a title ending `| Germany | Remote` on one line.

## Release 6 — Tamil locale · Release 7 — upstream features

Tamil: parent has `README.ta.md` (Jul 2026); web-ui has 17 locales. Follows `docs/LOCALIZATION.md`
(*add a brand-new locale*): dict, `LANGS`/`flag`, `detect()`, help, README, CHANGELOG, site, snapshot.
Upstream backlog (ranked in the research): scan-history `skipped_*` statuses, liveness regexes,
CJK title-filter word edge, default Anthropic model id, outcome/JD-archive timeout, stream-completion
toast, inline tracker status select, batch cost confirm, `score_evidence`/`confidence_gaps` chip,
saved-contact lookup, `language.modes_dir` awareness.

## Rules that keep this from being mixed again

1. **A branch = a release = a concern.** The v1.240.0 branch carries parity only; hardening is
   `fix/v1.241.0-review-hardening`; nothing from a later release is committed to an earlier one.
2. **First action of any release: `git fetch && git log origin/main -5`** (two sessions once shipped the same version).
3. **Findings are tracked, not remembered:** the digest of every verified finding (severity, file:line,
   fix) is the checklist; each fix commit names the finding it closes.
4. **Done means gates, not claims:** `npm run test:ci`, browser suite, `evals/workflow`, i18n audit,
   changelog parity, and — for UI — a real-browser pass; deploy verified on `/api/health`.
