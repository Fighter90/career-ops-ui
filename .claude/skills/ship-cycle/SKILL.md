---
name: ship-cycle
description: The whole update-and-fix cycle for BOTH repos end to end — sync the career-ops fork with upstream and clear its code-scanning alerts, bring career-ops-ui to parity, run every local gate, merge, deploy to resumecraft.ru, then run the full remote regression (prod × all locales, cvstart.org, README/wiki links) and record the verdict. Trigger when the user says "обнови и почини всё", "полный цикл", "обнови career-ops и career-ops-ui", "задеплой и прогони регресс", "ship-cycle", or asks to fix code-scanning alerts in career-ops and roll the result out.
---

# ship-cycle — update, fix, deploy, verify (career-ops + career-ops-ui)

This skill **orchestrates**; the detail of a parity port lives in
[`parent-sync`](../parent-sync/SKILL.md) and of the server in
[`hermes-bridge`](../hermes-bridge/SKILL.md). Run the phases in order. Each ends
in a gate; a red gate is fixed before the next phase, never carried.

Proven on 2026-09-27 (v1.238.0 → resumecraft.ru, parent fork `f4f55def`).

## Phase 0 — Context (always)

1. Read `CONTEXT.md`, `PROGRESS.md` (**Abandoned approaches** and **Known issues**),
   and the ADRs the work touches. ADR-0002's divergence diff is the first action of
   any parent merge.
2. Sandbox facts that shape everything below:
   - egress blocks `resumecraft.ru`, `cvstart.org` and much of the internet —
     anything that must reach them runs **in GitHub Actions**, not here;
   - Chromium does not trust the egress CA: import the `Anthropic`/`CCR` certs from
     `/root/.ccr/ca-bundle.crt` into `~/.pki/nssdb` (`certutil`, from
     `libnss3-tools`) or ~44 browser tests fail on a font; use
     `npm i --no-save playwright@1.56` to match the preinstalled chromium-1194;
   - **never `pkill -f <pattern>`** when the pattern is in your own command line — it
     kills the shell (exit 144). Stop servers by port: `fuser -k 4321/tcp`.

## Phase 1 — career-ops fork: sync + code scanning

1. `add_repo Fighter90/career-ops` with `access: push`; clone to `/home/user/career-ops`.
2. Upstream is `career-ops-hq/career-ops`. Merge it into the fork's `main` via a PR
   (`Merge branch 'career-ops-hq:main' into main`); run the ADR-0002 divergence
   check before and after (`p{L}`×4 in `providers/telegram-channel.mjs`,
   `providers/telegram.mjs` present, `hermes` in `web/src/lib/clis.ts`,
   `vpFixtureEnv`×9 in `test-all.mjs`).
3. **Code-scanning alerts cannot be read with the tools here**, and must never be
   dumped into a public Actions log (that publishes the vulnerability). Reproduce
   them locally with the same suites the repo's `codeql.yml` uses:
   ```bash
   curl -sSL -o b.tgz https://github.com/github/codeql-action/releases/latest/download/codeql-bundle-linux64.tar.gz
   tar -xzf b.tgz            # → ./codeql/codeql ; ~30 GB free is plenty
   Q=./codeql/codeql
   $Q database create db-js  --language=javascript-typescript --source-root=/home/user/career-ops
   $Q database analyze db-js codeql/javascript-queries:codeql-suites/javascript-code-scanning.qls --format=sarif-latest --output=js.sarif
   (cd /home/user/career-ops/dashboard && $Q database create ../../db-go --language=go --source-root=.)
   $Q database analyze db-go codeql/go-queries:codeql-suites/go-code-scanning.qls --format=sarif-latest --output=go.sarif
   $Q database create db-act --language=actions --source-root=/home/user/career-ops
   $Q database analyze db-act codeql/actions-queries:codeql-suites/actions-code-scanning.qls --format=sarif-latest --output=act.sarif
   ```
   Fix every result at the root (PR #15 is the model: split the shell call site
   instead of pinning `shell:false`), then re-run the suite to **0 results**.
4. **Gate:** 0 results in all three SARIFs, `node test-all.mjs --quick` green.
5. If the alerts stay open on GitHub after the fix, check that CodeQL actually runs:
   `actions_list list_workflow_runs codeql.yml`. On 2026-09-27 the fork had run **no
   push workflow since 15 July**, so alerts could not close however clean the code
   was. That is a repository setting the user changes (Settings → Actions), not code.

## Phase 2 — career-ops-ui parity

Run [`parent-sync`](../parent-sync/SKILL.md) against the fork head from Phase 1 —
all of it: provider port, docs ×17, QA prompt, site changelog resync, wiki. Counts
come from the live registry, never from memory.

## Phase 3 — Local gates (career-ops-ui)

Run and **record every number**; a claim without a number is not a gate.

```bash
npm run test:ci                       # unit + changelog parity + i18n audit
npm run test:coverage                 # ≥90 % lines, ≥80 % branches
npm run test:e2e:browser              # Playwright; 0/N at once = missing browser, not code
npm run test:e2e && npm run test:e2e:full
node scripts/check-changelog-parity.mjs && node tools/i18n-audit.mjs && node evals/workflow/run.mjs
(cd site && npm ci && npm run build && node scripts/check-i18n.mjs)
```
Plus every targeted gate the release's `qa/QA-REGRESSION-PROMPT-v<ver>.md` §0 lists,
and its §2 manual browser pass automated with Playwright against a throw-away
`CAREER_OPS_ROOT` (see `scratchpad` pattern: seed `last-scan.json` + `profile.yml`).
If a QA-prompt number disagrees with the suite, find out which is wrong and fix
that one (v1.238.0 said title-fit 26; the suite has 24).

## Phase 4 — PR, CI, merge

- One PR per repo from the designated branch. CI must be fully green on the
  **current head** (unit ×3 Node versions, coverage, Playwright, CodeQL).
- **Never force-push.** If the branch's earlier commits were squash-merged, bring
  them in with `git merge -s ours origin/<branch>` and push normally.
- Merging may be refused as "merge without review" — then the user merges; say so
  plainly instead of looking for another route.

## Phase 5 — Deploy (resumecraft.ru)

Everything goes through `.github/workflows/deploy.yml` (Actions → Deploy (server)):

| mode | does |
|---|---|
| `recon` | read-only: versions, which release the files on disk match, possible hand edits, services, Hermes link, health |
| `deploy` | `git archive <ref>` over each tree after a tar backup of every file it overwrites; npm ci only if a lockfile changed; restart; health must report both versions; any failure restores the backup |
| `verify` | read-only smoke: every read-only route 200, unknown route 404, served sources == deployed registry, security headers, `career-ops-ui`/`hermes-gateway`/`claude-bridge` active, bridge `/v1/models` 200, 0 journal errors |

Secrets: `DEPLOY_SSH_KEY` (passphrase-less `careerops-ci`), `DEPLOY_HOST`,
`DEPLOY_USER` (`root`), `DEPLOY_KNOWN_HOSTS` (the **user** pins the host key — do not
pin it yourself). Pass `parent_ref` as a reviewed SHA, `ui_ref` as the release tag.

Server facts: parent `/opt/career-ops/src`, web-ui `/opt/career-ops/src/web-ui`, owner
`careerops`; releases have always been **copied over** the trees, so `git status`
there is meaningless and `git checkout` would be wrong. Rollback material stays in
`/opt/career-ops/backups/deploy-<stamp>`.

**Gate:** `deploy` green, then `verify` green.

## Phase 6 — Remote regression (what users actually see)

`.github/workflows/remote-qa.yml` (dispatch, weekly, or push to `claude/**` touching
it) runs three jobs:

- **prod** — `scripts/remote-qa/prod-regression.mjs`: every route × every UI locale
  on resumecraft.ru with basic auth from `AUTH_LOGIN` / `AUTH_PASSWORD`. Read-only by
  construction: non-GET `/api` and `/api/stream/*` are aborted in the browser and
  reported as `write-on-open`.
- **site** — `scripts/remote-qa/site-regression.mjs`: every page × locale × 1366/390
  on cvstart.org, hreflang, images, links, real 404.
- **links** — `scripts/remote-qa/link-check.mjs`: README ×17 + the wiki.

Read the job summaries; each finding is fixed at its root, locally reproduced
first (build the site, `astro preview`, run the same script against `localhost`).

**Gate:** all three jobs green.

## Phase 7 — Record and report

1. `PROGRESS.md`: current state, what is live where, what is still open; move any
   dead end to **Abandoned approaches**.
2. Tick the QA prompt's §5 sign-off lines that are now proven.
3. Report the verdict as a table — gate, number, source (local / CI run / server)
   — and list separately what was **not** verified and why.

## Pitfalls already paid for

- **Public Actions logs.** A recon once printed the profile name and which provider
  keys are set. Print versions, states and status codes only; delete a leaking run's
  logs (`actions_run_trigger delete_workflow_run_logs`).
- **Hash-only navigation** in Playwright is same-document: go to `about:blank` first
  or you read the previous view.
- **`Control+K`** sends `K`; the app listens for `k`. Use `Control+k`.
- **Help quotes i18n keys on purpose** (`'nav.scan'` in §19): scan text outside
  `<code>/<pre>` for leaked keys.
- **Markdown links with parentheses** (`Home-(Español)`) need a balanced-paren
  parser or the wiki looks 257-links broken.
- **A second copy of the locale registry** (the sitemap map in
  `site/astro.config.mjs`) silently dropped `hi`; `check-i18n.mjs` now compares it.
- **Grid items default to `min-width: auto`**: a single-column grid below `lg` let
  long TOC links and inline `code` push /help and /changelog sideways on phones.
