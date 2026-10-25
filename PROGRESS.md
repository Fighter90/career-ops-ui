# PROGRESS.md — working state

State and direction of in-flight work. Git shows what changed; this file says where
the work stands, what was already tried and rejected, and what to do next. Read it at
session start; update it after each meaningful step, in the same commit.

Release history belongs in [CHANGELOG.md](CHANGELOG.md), decisions in
[docs/adr/](docs/adr/), vocabulary in [CONTEXT.md](CONTEXT.md). Anything already
recoverable from those does **not** belong here.

_Last updated: 2026-10-25 · **v1.257.0 SHIPPED** (CAR-103 help tokenizer `\p{M}` — hi/ta retrieval; CAR-106 — provider-reported cost in the usage record, Hermes $0.0000 fixed; 5713 tests, browser 143/143, evals 14/0/1; deployed, health 1.257.0, verify ✓, publish ✓) · before it: **v1.256.0** (CAR-127/128 identity + CAR-129 sort/backfill; live 18/19, ta fail = CAR-70) · before that: **v1.255.2** (CAR-99/97/98)_

---

## Current state

**v1.257.0 — SHIPPED 2026-10-25** (CAR-103: docs-assistant tokenizer keeps `\p{M}` — a Hindi query matched 0 sections, Tamil matched fragments, hi/ta retrieval works; CAR-106: the usage record keeps a provider-reported `cost?` — Hermes showed $0.0000 over 9.5 M tokens; both landed as clean cherry-picks after the first PRs carried a stale worktree base — #470/#471 superseded by #472/#473). **Tests 5713** (+8), evals 14/0/1, deployed + verify ✓ + publish ✓, release-badge sweep ×18 (was stale at v1.255.2 for two releases), wiki ×19 at 1.257.0/5713.

**In flight (agent fleet):** CAR-130 form errors, CAR-111 Anthropic prompt caching, CAR-110 deep-research source contract, CAR-100 labelN() counter semantics, CAR-112 loading skeletons/h1 — five worktrees, red→green discipline, no new i18n keys (stop-and-report if needed). **Blocked:** PR #475 (CAR-104, bundle 3.1 MB → 598 KB br + hand-offs) waits for CodeQL alert #577 dismissal — false positive of the documented v1.106.0 class (fixed PATHS path, not request data); needs `security_events` scope or a manual web dismissal. **Awaiting owner:** backfill run on prod (`POST /api/tracker/backfill-scores`, ~181 rows — writes data/applications.md, idempotent).

**v1.256.0 — SHIPPED 2026-10-25** (tracker data quality: CAR-128 dash-order heuristic — «Senior Frontend Engineer - Grafana Labs» no longer files the role as the company (13 rows) + an employment-type guard; CAR-127 — hh.ru/habr slugs are never employers (120 «hh» rows) and the mid-sentence Cyrillic employer inference was found silently dead since v1.248.4 (ASCII `\b`/`\w`) and revived for job-board hosts; CAR-129 — tracker score sort nulls-last + `POST /api/tracker/backfill-scores` (sentinels/scored/report-less/scoreless untouched, idempotent); an opus-5-5 review round + 3 project reviewers applied — no bare «X ищет» fabrication, [вВ] anchors, duplicate-# cell re-check, score-shape guard, employment-type guard). **Tests 5705** (+10), browser 143/143, evals 14/0/1, coverage 98.3/89.8. Docs train ×18 (ta included — the parity gate caught the missing mirror), QA prompt v1.256.0, site built. **Open after-ships:** run the backfill on prod (writes `data/applications.md` — needs the owner's explicit yes); CAR-104 (`fix/car104-bundle-compression`, bundle 3.1 MB → 598 KB br + cacheable, 16 specs red→green) is pushed and waits as release v1.257.0 with its hand-offs (.gitignore for `.br/.gz`, deploy.yml rollback rm); CAR-100 re-scoped to the `labelN()` semantics (prod check: CAR-99 fix IS deployed, counter now 1554/90); CAR-102 Canceled with prod evidence (only ru/en reports exist; recent ones carry `## Machine Summary`; `---SCORE_SUMMARY---` is stripped at save by design).

**v1.255.2 — SHIPPED 2026-10-24** (CAR-99: the 120 `,,` elision holes in `FALLBACK_SOURCES` removed + a dense-array gate — every `#/scan` render had thrown `id.length` on undefined; CAR-97: vi stop-word table in the live-QA language checker; CAR-98: the closing evaluation reminder makes the SCORE_SUMMARY block mandatory). Tests **5695** (0 fail), browser 143/143, live ×19 re-check post-deploy.

**v1.247.0 — SHIPPED 2026-10-09** (design sweep tail: CAR-49…58 minors + the dark map tiles the previous release deferred). Tests **5116** (0 fail), browser **118**, e2e **23/23 + 21/21**; server coverage baseline in `scripts/coverage-baseline.json` (ratchet). The 2026-10-07/08 trains are done and shipped: **v1.242.0** sources correctness (9 parallel fix agents, ~600 tests, CAR-6…16), **v1.243.0** client fixes, **v1.244.x** `#/scan` redesign (prod verified).

Remaining plan (`docs/sdd/BACKLOG.md` + Linear CAR): merge the pushed agent branches **CAR-103** (`fix/car103-help-tokenizer`) and **CAR-106** (`fix/car106-hermes-usage-cost`) as their own releases, then CAR-104 as v1.257.0; then the bug queue (CAR-130, CAR-111 prompt caching, CAR-110 deep-research sources, CAR-105 map geocoding), then the UX epics (CAR-113…124) and the docs/cvstart batch (CAR-131…141). All web-ui branches are merged into `main` and deleted after each release (maintainer's rule, 2026-10-07).

## Next step

Merge `fix/car103-help-tokenizer` + `fix/car106-hermes-usage-cost` (CI green, one release each or one combined patch — same concern class: small verified fixes), then ship CAR-104 as v1.257.0. Code-scanning: all open alerts on `main` are fixed or dismissed with a written reason (2026-10-07); Dependabot: 0 open.


**Deploying** — `Actions → Deploy (server) → Run workflow`: `recon` (read-only), `deploy`, `verify`
(read-only smoke, also runs after every deploy). Secrets: `DEPLOY_SSH_KEY` (passphrase-less
`careerops-ci`, Timeweb key id 789655), `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KNOWN_HOSTS`.

Server layout: parent checkout `/opt/career-ops/src`, web-ui `/opt/career-ops/src/web-ui`, both owned by
`careerops`; `career-ops-ui.service` (viewer, 127.0.0.1:4317, Caddy + basic auth in front),
`hermes-gateway.service` (Telegram bot), `claude-bridge.service` (127.0.0.1:8788, the viewer's
`HERMES_BASE_URL`), `career-ops-scan`/`career-ops-eval` timers. Releases are copied over the trees (git
HEADs are stale: web-ui v1.198.0, parent August), so `git status` there is meaningless; `mode=deploy`
extracts `git archive <ref>` over each tree after a tar backup of every file it overwrites, and restores
on any failure (simulated locally: success + 4 failure paths byte-exact).

Still open:
- delete `claude/zen-brahmagupta-m8zguo` in career-ops-ui, career-ops, career-ops-coworker (needs a
  token with delete rights; the wiki update itself is already live — commit `41ac75d`);
- career-ops code scanning: local CodeQL on fork `main` (JS/TS 1223 files, Go, Actions) = **0 results**;
  the alerts on GitHub stay open only because no push workflow (CodeQL included) has run in the fork
  since 2026-07-15 — the user re-enables Actions there and the next push closes them;
- remote regression is `.github/workflows/remote-qa.yml` (secrets `PROD_URL`, `AUTH_LOGIN` / `AUTH_PASSWORD`;
  dispatch inputs `live`, `locales` (e.g. `hi`) and `scan` for a targeted re-check);
  the production hostname is never written into the repo — workflows read it from `PROD_URL`, and
  the report headers do not print it;
- Actions logs of this public repo are public: keep recon/verify output to versions, states and status
  codes (the first recon printed the profile name and which provider keys are set; its logs were deleted);
- Telegram end to end (a real message through the bot) is not exercised by `verify`; it checks the
  services and the bridge only.

The next parity release starts at
[`.claude/skills/parent-sync`](.claude/skills/parent-sync/SKILL.md) Phase 1 —
**and its first action is the divergence diff from [ADR-0002](docs/adr/0002-defend-fork-divergences.md),
before any merge.**

## Known issues

- **Two sessions can ship the same version.** On 2026-10-06 a local session built v1.239.0 from a
  stale `main` while another had already released v1.239.0–1.239.4 (#373–#379). The collision was
  only visible in the PR's conflicts. **First action of any release: `git fetch origin && git log
  origin/main -5`** — and never start from a local `main` you have not just reset to `origin/main`.
- **A test that sets `CAREER_OPS_ROOT` to a temp dir needs `cv.md` or `portals.yml` in it.**
  `paths.mjs` ignores the variable otherwise and falls back to `../` — the real parent on a
  developer machine (CI has none, so only local runs showed it).

- **The scan runs inside the viewer process and blocks its event loop for seconds.** v1.238.1 made it
  single-flight and raised the heap; v1.238.2 stopped the resulting keep-alive resets (502s). Pages
  still answer slowly while a scan runs; the real fix is a worker thread or child process for the
  scanner, with the SSE stream fed from it.
- **The cloud sandbox's git proxy refuses tag pushes (and branch deletes).** Cut a release by
  dispatching `release.yml` on `main` with `tag=v<version>`: when the tag does not exist it is
  created at the dispatched commit, after the `package.json` version check. It then dispatches
  `publish-package.yml` on the tag (a GITHUB_TOKEN release fires no `release` event). `deploy.yml` takes a
  commit SHA as `ui_ref`, so a deploy never waits on the tag.
- **A guard keyed on function identity silently stops guarding when the transport is wrapped.**
  `guardResolvedHost` ran only when `fetchImpl === globalThis.fetch`; the scanners inject
  `makeTimeoutFetch()`, so from v1.235.0 on no real scan was DNS-checked while every unit
  test (which passes the global fetch or a stub) looked fine. Fixed in v1.238.0 by running
  the guard inside the wrapper. When adding a check to the transport, put it at the
  chokepoint (`makeTimeoutFetch`), not behind an identity test.
- **Chromium in the cloud sandbox does not trust the egress proxy's CA** → ~44 Playwright
  failures at once on `ERR_CERT_AUTHORITY_INVALID` (an external font). Environment: import
  `/root/.ccr/ca-bundle.crt` into `~/.pki/nssdb` with `certutil`. `npm i --no-save playwright@1.56`
  matches the preinstalled chromium-1194.
- **Playwright browsers are not pinned to the repo.** A Playwright bump changes the
  chromium build id and the browser suite then fails **116/116** on `hookFailed`, which
  reads like a catastrophic regression and is not one. Fix: `npx playwright install chromium`.
  Rule of thumb: a whole-suite failure is environment, a scattered failure is code.
- **Only the CI key deploys now.** The old `id_careerops_deploy` key's passphrase is lost; deploys go
  through the Actions workflow with the passphrase-less `careerops-ci` key. Adding it to a running server
  through the Timeweb API (`POST /servers/{id}/ssh-keys`) worked without a reboot.
- **A failed remote hash check reports the worst case.** The deploy verifier diffs
  local vs remote sha256 lists; if the ssh call fails, the remote list is *empty* and
  the diff reports every file as differing. Confirm the remote side actually answered
  before believing a large "differing" count.
- **`raw.githubusercontent.com` caches wiki pages.** A pushed wiki change can read as
  missing for minutes. Verify with a fresh `git clone` of the wiki, not the raw URL.
- **`tests/playwright-config-save-scope.mjs` → `CONFIG-2: clearing a filled field still unsets it` is flaky locally.**
  Observed 2026-09-22: three consecutive runs passed **116/116, 116/116, then 115/116** with no code
  change between them; the single failure was this test. CI has been green on it. Timing-related, not a
  product defect. To tell it from a regression: re-run that file alone —
  `node --test tests/playwright-config-save-scope.mjs` — and if it passes, it is this flake. Contrast the
  other shape: **0/116 passing** at once is a missing Playwright browser, not code. Worth a deterministic wait.
- **A divergence can erode across merges without any single merge looking wrong.** The Hermes
  README badge was down to 4 of 17 parent READMEs by 2026-09-22 — upstream had restructured
  those files twice, and each time the non-conflicting ones silently took upstream's shape.
  Check a divergence's FULL footprint, not just the files that happen to conflict; see the
  erosion log in [ADR-0002](docs/adr/0002-defend-fork-divergences.md).
- **SEEK is migrating hosts** (`www.seek.com.au` → `au.seek.com`, `www.seek.co.nz` →
  `nz.seek.com`). As of 2026-09-22 the detail pages already 301 and both host pairs serve
  the v5 API at 200. Both are allowlisted, so users can move whenever they like. The day
  the API path starts redirecting, an entry still on a `www.` host will fail — the
  transport refuses redirects on purpose (`redirect:'error'`, SSRF) — and the fix is a
  config change, not a code change.
- Local disk runs tight (~1–2 GB free). The `uv` cache regrows while the `chroma-mcp`
  MCP server is running; a one-off clean does not hold.

## Abandoned approaches

- **Relying on GitHub's secret mask for truncated text.** The mask matches the secret's exact value;
  a remote-QA finding cut to 180 chars ended mid-host and printed part of the prod hostname into a
  public log (2026-09-27). `scripts/remote-qa/redact.mjs` now removes the host before any truncation
  and from the whole report; `tests/remote-qa-redact.test.mjs` guards both scripts.
Recorded so they are not retried.

- **Blanket token sweeps across docs (`s/3164/3201/g`, `s/1.236.0/1.237.0/g`).**
  They rewrite *historical attributions* into lies — the v1.236.0 record in
  `PROJECT-CONTEXT.md` briefly claimed "3066 → 3201", and a wiki sweep would have
  falsified `As of **v1.236.0** the scanner ships **94 adapters**`, a line that is
  correct precisely because the count has not moved since. Sweep by line context,
  keep `as of` / `since vX` / `— vX.Y.Z` lines, and diff afterwards.
- **`\b` word boundaries for count sweeps near non-Latin scripts.** `\b` is ASCII-only,
  so `94개`, `94 個`, `94 محوّل` do not match; and a digit boundary still matches *inside*
  `Fighter90`. Use literal, digit-guarded replacement (`(?<!\d)94(?!\d)`) and diff the
  identifiers afterwards.
- **Telling locale agents to preserve English phrases "byte for byte".** Over-literal
  instructions left `53 of 291` sitting inside Spanish, Portuguese, Polish, Ukrainian
  and Italian prose. Preserve *digits and identifiers*; translate every connector.
  Literal quoted page text (`"This role is closed"`, `"JOB EXPIRED"`) is the one
  exception and should be named as such.
- **Running the site build before the locale fan-out finishes.** `site/scripts/sync-assets.mjs`
  copies each root `CHANGELOG.<L>.md` into `site/src/content/changelog/`, so a build
  mid-fan-out commits a partial set — and the parity gate checks only the root files,
  so it stays green. Build after, then `grep -L '<version>' site/src/content/changelog/*.md`.
- **Asserting a behavioural marker on the overall verdict.** Checking
  `classifyLiveness(...).result === 'expired'` made two correct fixes look broken: a
  bare test string trips `insufficient_content`, which is also `expired`. Assert the
  specific `code` the change is about.
- **Localizing a link's label without localizing its target.** The book footer link got a
  translated Russian label while every locale's href still pointed at the English edition —
  so the one locale whose label promised a Russian book was the one that led to the English
  one. A `data-i18n-href` applier and a `footer.patternsUrl` key fix it; the regression test
  asserts that *a translated title implies a localized URL*, in both directions.
- **Trusting a behavioural marker as external verification.** Markers prove the code does
  what the fix intends; they do not prove the live site behaves that way. The Jobstreet fix
  was only *confirmed* when an outside probe showed `/id/job/<id>` returning a clean 404 on
  the AU/NZ/HK/MY hosts and `/job/<id>` hitting a real Cloudflare-guarded route. Keep both
  kinds of check; do not let the first stand in for the second.
- **Following upstream's `providers/telegram.mjs` deletion** — see [ADR-0001](docs/adr/0001-keep-both-telegram-sources.md).
- **Taking upstream's `LOCATIONISH_RE`** — see [ADR-0002](docs/adr/0002-defend-fork-divergences.md).
- **Dispatching `parent_ref` the server clone cannot resolve** (v1.248.8): the deploy verifies `git rev-parse $PARENT_REF^{commit}`
  against the SERVER's parent clone after a plain `fetch origin` — so the ref must be the exact SHA **pushed to the fork's main**
  before dispatch. A mistyped full SHA fails as `unknown parent ref`; a merge that is local-only fails the same way. Copy the SHA
  from `git rev-parse HEAD` in the fork checkout, never reconstruct it.
- **Re-cutting a release tag after the PR train continued on main**: cut the tag from the final main (post follow-up PRs), delete the
  stale tag + release first (`gh release delete`, `git push :refs/tags/…`), and redeploy — v1.248.7 did this for #437, v1.248.8's
  follow-up (#440, test-only) rode the tag as-is because prod matched the tagged commit.

- **A wiki sweep is not a gate** (v1.252.0 → v1.252.1): the per-release wiki sweep replaced badges and tag
  links but never the "Current release:" banner line, and every locale's banner had drifted separately
  (EN 5245, localized pages 5177; the adapter count was stale at 109 vs the registry's 105 — and the CJK
  banners put the word before the number with a full-width colon). A hand-run sweep cannot be trusted to
  cover a shape it was written for once the shape drifts. Fixed by `scripts/wiki-banner-check.mjs`
  (language-agnostic by SHAPE: version + four ·-separated counters) wired into the release train.
- **A tmp worktree dies with the agent-server restart — commit per coherent chunk** (v1.252.1): a whole
  docs train (CHANGELOG ×18, README ×18, prompts, baselines) was lost once to an uncommitted worktree
  wipe. Redo cost ~20 min; the rule since: `git commit` after every coherent chunk (code+tests, then
  docs), push the branch before running long gates.
