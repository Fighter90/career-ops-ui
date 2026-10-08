# PROGRESS.md — working state

State and direction of in-flight work. Git shows what changed; this file says where
the work stands, what was already tried and rejected, and what to do next. Read it at
session start; update it after each meaningful step, in the same commit.

Release history belongs in [CHANGELOG.md](CHANGELOG.md), decisions in
[docs/adr/](docs/adr/), vocabulary in [CONTEXT.md](CONTEXT.md). Anything already
recoverable from those does **not** belong here.

_Last updated: 2026-10-08 · **v1.243.0 client fixes in release train** (8 agents, +224 tests); v1.242.1 SHIPPED (resumecraft.ru deployed+verified, Playwright 15/15, full regression green; live-LLM × 7 locales blocked by upstream credit exhaustion — Linear CAR-44, 11/17 passed live before the credits ran out)_

---

## Current state

**v1.242.0 — IN RELEASE TRAIN 2026-10-07** (sources correctness: 9 parallel fix agents over the source families, ~600 new tests, all gates green; Linear CAR-6…CAR-16). Before it: **v1.241.0/1.241.1 — SHIPPED 2026-10-07** (tag `v1.241.0` @ `c6de9cca`, npm published, cvstart.org deployed, resumecraft.ru deployed with `ALLOWED_HOSTS=resumecraft.ru`, public check 401). **Hardening from the 2026-10-06 code review** (28 read-only review agents, ~190 verified
findings, fixed by 6 fix-and-cover agents A/B/C/D/CI/T). Tests **4404**, browser **118**, server coverage
baseline line 96.7 % / branch 86.3 % (`scripts/coverage-baseline.json`, ratchet). Ships the job map (#381).
v1.240.0 (parent parity @ `62905981`, 109 sources) is released and deployed.

Remaining plan (`docs/sdd/PLAN.md`): v1.243.0 client fixes,
v1.244.0 `#/scan` redesign, v1.245.0 Tamil locale, v1.246.0 upstream features, plus the
newest parent/upstream delta (research in progress). All web-ui branches are merged into
`main` and deleted after each release (maintainer's rule, 2026-10-07).

## Next step

Phase 2 — v1.242.0 sources correctness: start with `docs/sdd/BACKLOG.md` → *v1.242.0*. Any agent: read `docs/sdd/HANDOFF.md` first (OpenCode: `/continue`). Code-scanning: all open alerts on `main` are fixed or dismissed with a written reason (2026-10-07); Dependabot: 0 open.


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
