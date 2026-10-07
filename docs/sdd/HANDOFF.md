# HANDOFF — how any coding agent (OpenCode, Claude Code, Codex…) continues this project

This is the operating manual. Read it, then `PLAN.md` (order) and `BACKLOG.md` (what is left).

## State (2026-10-07)

- Released: **v1.240.0** (parent parity @ `62905981`, 109 sources) — tagged, GitHub release, npm
  package, cvstart.org, deployed to resumecraft.ru. **v1.241.0** (review hardening + job map #381)
  is on PR #388; see `PROGRESS.md` for whether it has shipped.
- Next: Phase 2 (v1.242.0 sources correctness) → Phase 3 (client) → Phase 4 (`#/scan` redesign) →
  Phase 5 (Tamil) → Phase 6 (upstream ports). Items live in `BACKLOG.md`.

## Non-negotiable rules

1. The parent project at `../` (Fighter90/career-ops) is **read-only** except an authorised
   `git pull`/merge of upstream `career-ops-hq/career-ops` + push to the fork, done with the
   ADR-0002 divergence checks (`docs/adr/0002-defend-fork-divergences.md`).
2. **Every fix starts with a failing test** (red → green). Tests are CI-isolated: dynamic
   `await import()` inside `before()`, `CAREER_OPS_ROOT` = a temp dir containing `cv.md`, injected
   `fetchImpl`, no network, servers bound to `127.0.0.1`.
3. **One branch = one release = one concern.** When a release ships, its branch is merged into
   `main` and deleted; no other branches are left in the repo (maintainer's rule).
4. **First command of any session:** `git fetch origin && git log --oneline origin/main -5` and
   `gh pr list` — another session may already have shipped the version you are about to cut.
5. Counts (sources/adapters/tests) come from the live registry and the test run, never by hand.
6. Done = gates + deploy verify, not "tests pass" (see *Ship train*).

## Environment

```bash
export PATH=/opt/homebrew/bin:$PATH        # gh lives here
source ~/.nvm/nvm.sh && nvm use 22          # Node 22 (site build and node:sqlite need it)
```

## Gates (all must be green before a PR)

```bash
npm run test:ci                 # unit + integration + .also check + changelog parity + i18n audit
npm run test:e2e:browser        # Playwright (a whole-suite failure = missing browser: npx playwright install chromium)
node evals/workflow/run.mjs     # release-workflow graders
npm run test:coverage:gate      # coverage ratchet (scripts/coverage-baseline.json)
```

## Ship train (every release, patch included)

1. `npm version X.Y.Z --no-git-tag-version`; EN `CHANGELOG.md` entry (Added/Fixed/Notes — Notes
   must name what is deliberately *not* done); README banner (new lead, previous = old lead, drop
   the older previous); badges ×17 by script; `qa/QA-REGRESSION-PROMPT-vX.Y.Z.md` (archive the old
   one to `qa/archive/superseded-prompts/`); `docs/sdd/CONVENTIONS.md` test baseline;
   `.claude/PROJECT-CONTEXT.md` repo state; `PROGRESS.md`.
2. 16 locale files ×2 (`README.<L>.md`, `CHANGELOG.<L>.md`) — one sub-agent per locale; English
   source of truth; the file's own section labels; exactly one `## [X.Y.Z]` per file.
   If the source count changed: help ×17 §17 sentence, `CONTEXT.md`, `CLAUDE.md`.
3. `cd site && npm run build` **after** all 17 changelogs are final; then
   `grep -L 'X.Y.Z' site/src/content/changelog/*.md` must print nothing.
4. Gates (above). Commit (`Co-Authored-By:` trailer), push branch, `gh pr create`.
5. `gh pr checks <n> --watch`; fix failures (CodeQL: real findings get fixed; the known
   false-positive classes `js/http-to-file-access`, `js/missing-rate-limiting` on this loopback app are
   dismissed with a reason after merge).
6. `gh pr merge <n> --squash --delete-branch`; `git checkout main && git pull`.
7. `git tag vX.Y.Z <merge sha> && git push origin vX.Y.Z` → Release workflow.
8. `gh workflow run publish-package.yml --ref vX.Y.Z` (never auto).
9. cvstart.org: Pages deploys on `site/**` pushes; otherwise `gh workflow run deploy-pages.yml --ref main`.
10. **resumecraft.ru:** `gh workflow run deploy.yml --ref main -f mode=deploy -f ui_ref=vX.Y.Z -f parent_ref=<parent sha>`;
    watch it; the log must show `version=X.Y.Z` and the public check `401` (basic auth) — a `421`
    means `ALLOWED_HOSTS` is wrong. Then `-f mode=verify`.
11. Wiki: fresh clone of `Fighter90/career-ops-ui.wiki`, Home ×17 banners, Scanner-Providers rows,
    Testing-and-QA / Release-Process counts; push.
12. Delete the release branch locally and remotely; update `PROGRESS.md`.

## Post-release standing rules (user-mandated 2026-10-07 — never skip, never trim)

Every release — patch included — also carries ALL of the following. If any step is missed,
the release is not done:

1. **Full regression on BOTH stands**: local `127.0.0.1:4317` AND prod (resumecraft.ru).
   All views, all 17 locales, LLM providers live (`gh workflow run remote-qa.yml -f live=true`),
   scanner (`-f scan=true`), plus an adversarial browser pass (Playwright; creds via env,
   never committed). Findings become Linear issues (Russian) in the carrer-ops-ui workspace
   immediately — then they are executed in order until done.
2. **A QA regression prompt per release**: `qa/QA-REGRESSION-PROMPT-vX.Y.Z.md`, with the
   real counts; the previous prompt moves to `qa/archive/`.
3. **CHANGELOG ×17**: EN entry first, then all 16 locale files (one agent per locale,
   English is the source of truth, exactly one `## [X.Y.Z]` per file) — changelog parity
   and the `locale-fanout-integrity` grader must be green.
4. **A spec per phase/release in `docs/sdd/specs/`** (`_TEMPLATE.md`): goal, scope, out of
   scope, acceptance criteria, Verification filled with REAL output before the PR merges.
5. **Wiki refresh in the same release**: Home ×17 banners + test floor, Scanner-Providers,
   Testing-and-QA / Release-Process counts, Roadmap page mirror of Linear.
6. **Site freshness**: `cd site && npm run build` only after all 17 changelogs are final;
   `grep -L 'X.Y.Z' site/src/content/changelog/*.md` must print nothing (sync-assets keeps
   them in the build).
7. **Linear statuses move with the work**: In Progress when an agent starts, In Review when
   the PR is up, Done only when the release is deployed and verified — with a comment
   carrying the evidence (counts, run links).
8. **Every PR is merged into `main`** as soon as its CI is green — no PR lingers open, no
   work lives only on a branch across sessions. Squash-merge (`--delete-branch`), continue
   from a fresh `git checkout main && git pull`; if a later finding appears, it is a new
   commit/PR on top of main, never a stranded branch.

## Parent sync

Use `.claude/skills/parent-sync/SKILL.md` (it is plain Markdown — any agent can follow it): divergence
snapshot → merge upstream → resolve → parent suite on Node 22 → push fork → scope
`<last-sync>..origin/main` → port providers (one agent per provider, three files each, never the
shared registry/gate files) → wire registry + regenerate gate lists from the live registry → docs → ship.

## Where things are

| What | Where |
|---|---|
| Vocabulary (`source` vs `adapter`, `mirror` vs `relay`) | `CONTEXT.md` |
| Decisions | `docs/adr/` |
| Specs (the only folder) | `docs/sdd/specs/` (template `_TEMPLATE.md`) |
| Invariant → gate matrix | `docs/sdd/TRACEABILITY.md` |
| Open fixes | `docs/sdd/BACKLOG.md` |
| Program order | `docs/sdd/PLAN.md` |
| Code conventions | `docs/sdd/CONVENTIONS.md` |
