# PROGRESS.md — working state

State and direction of in-flight work. Git shows what changed; this file says where
the work stands, what was already tried and rejected, and what to do next. Read it at
session start; update it after each meaningful step, in the same commit.

Release history belongs in [CHANGELOG.md](CHANGELOG.md), decisions in
[docs/adr/](docs/adr/), vocabulary in [CONTEXT.md](CONTEXT.md). Anything already
recoverable from those does **not** belong here.

_Last updated: 2026-09-22 · v1.237.0 shipped and deployed; external QA pass applied (BOOK-1, WIKI-1, SEEK hosts)_

---

## Current state

**Shipped and live: v1.237.0** (parent parity @ `93c4302b`). No new sources; four
mirrored fixes. Counts frozen at **94 sources (89 EN + 5 RU) / 89 adapters**; tests
**3164 → 3201**.

Verified live on every surface: server + local `1.237.0` / parent `1.33.0`, web-ui
380/380 and parent 924/924 files sha256-identical, resumecraft.ru, cvstart.org (+`/ru/`),
cvstart.ru, sergey-cv.com, chat-proxy origin allow/deny, npm, GitHub release, wiki.
0 CodeQL / 0 Dependabot alerts, 0 open PRs. Six behavioural markers green on the server.

**Parent:** fork `origin/main` at `0c2c1ff5`, behind `upstream/main` by 0.

## Next step

Nothing is in flight. The next parity release starts at
[`.claude/skills/parent-sync`](.claude/skills/parent-sync/SKILL.md) Phase 1 —
**and its first action is the divergence diff from [ADR-0002](docs/adr/0002-defend-fork-divergences.md),
before any merge.**

## Known issues

- **Playwright browsers are not pinned to the repo.** A Playwright bump changes the
  chromium build id and the browser suite then fails **116/116** on `hookFailed`, which
  reads like a catastrophic regression and is not one. Fix: `npx playwright install chromium`.
  Rule of thumb: a whole-suite failure is environment, a scattered failure is code.
- **The deploy key has a passphrase.** A non-interactive session cannot load it, and
  every `ssh` to the server then fails `Permission denied (publickey)`. The user must
  run `ssh-add ~/.ssh/id_careerops_deploy` first.
- **A failed remote hash check reports the worst case.** The deploy verifier diffs
  local vs remote sha256 lists; if the ssh call fails, the remote list is *empty* and
  the diff reports every file as differing. Confirm the remote side actually answered
  before believing a large "differing" count.
- **`raw.githubusercontent.com` caches wiki pages.** A pushed wiki change can read as
  missing for minutes. Verify with a fresh `git clone` of the wiki, not the raw URL.
- **SEEK is migrating hosts** (`www.seek.com.au` → `au.seek.com`, `www.seek.co.nz` →
  `nz.seek.com`). As of 2026-09-22 the detail pages already 301 and both host pairs serve
  the v5 API at 200. Both are allowlisted, so users can move whenever they like. The day
  the API path starts redirecting, an entry still on a `www.` host will fail — the
  transport refuses redirects on purpose (`redirect:'error'`, SSRF) — and the fix is a
  config change, not a code change.
- Local disk runs tight (~1–2 GB free). The `uv` cache regrows while the `chroma-mcp`
  MCP server is running; a one-off clean does not hold.

## Abandoned approaches

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
