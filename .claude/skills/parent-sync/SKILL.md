---
name: parent-sync
description: Sync web-ui with a newer parent career-ops release — pull the parent, scope the delta, port providers/fixes, fan out docs ×17, run every gate, ship the parity release end-to-end. Trigger when the user says "обнови родителя", "parent-sync", "возьми новое из родителя", or pastes a santifer/career-ops release URL.
---

# parent-sync — parity release pipeline

Proven across v1.119.0 (parent 1.19), v1.120.0 (1.20), v1.123.0 (1.21). Each phase
below is a hard gate — do not skip, do not reorder. The parent repo (`..`) is
**READ-ONLY** except the user-authorized `git pull` itself.

**Also covers audit-driven patch releases** (no parent delta — e.g. v1.134.1
validation-hardening from a full-project + all-locales audit). Skip Phases 1–2
(no pull, no provider port); Phases 3–7 apply UNCHANGED — QA prompt, docs ×17,
site changelog resync, wiki, cross-surface verify are all still mandatory. The
count that moves on a fix-only release is usually just the **test count**.

## Phase 1 — Pull & scope

1. `cd .. && git rev-parse HEAD` (save OLD), `git pull` (confirm `origin` is the fork
   and you're on `main` first: `git remote get-url origin` / `git branch --show-current`),
   `cat VERSION`.
   Diff by **commit range** to `origin/main` HEAD — never by VERSION and **never to
   the `career-ops-vX.Y.Z` tag**. On this fork BOTH lag main: release-please cuts the
   tag/VERSION behind `main`, so the fork's HEAD carries post-tag providers/fixes.
   A pasted release-URL tempts you to `OLD..<tag>` — that under-scopes (v1.210.0 did
   exactly this against `career-ops-v1.27.0` and missed **yourator** + the
   `_html-entities`/`_trust-validator` fixes already on HEAD, forcing an extra
   v1.211.0). Use `OLD..origin/main`, the HEAD you actually reset/deploy to.
2. Read the new CHANGELOG entries + `git diff OLD..origin/main --name-status`.
   Before porting a MIRROR fix, grep web-ui for the shared idiom first — web-ui is
   sometimes already AHEAD (its senjob used the shared C0-safe decoder from day one;
   jobvite already imported it), so the parent's fix is a no-port.
3. Classify every change:
   - `providers/*.mjs` **added** → PORT as a web-ui source+adapter (Phase 2).
   - Changes to code web-ui MIRRORS (`role-matcher`, `detect-reposts`,
     `trust-validator`, `scan-sanitize`, providers already ported, `cooldown`) →
     PORT the diff into `server/lib/` + port the parent's test cases.
   - Scripts web-ui RELAYS read-only (`stats.mjs`, `salary-gap.mjs`,
     `analyze-patterns.mjs`, `followup-*`) → usually NO code change (fail-soft
     relay absorbs shape changes) — note it.
   - CLI-only (modes/*.md prompts, updater, doctor, PDF templates, ledger/site
     infra, dashboard Go TUI) → NOT ported; document in the CHANGELOG **Notes**
     section with the reason ("web-ui does not shell into this" or "already
     covered by X since vY").
   - Parent UI/dashboard features (footer links, help entries) → mirror the
     CONCEPT in the SPA if it's user-facing (precedent: the Manifesto link).

## Phase 2 — Port a new provider

Two files + four gates (memory: a web-ui source is never just one file):

1. `server/lib/sources/<slug>.mjs` — `export const meta = {value,label,region}`
   (auto-discovered; no registry edit), exported pure helpers for tests, fetch
   via `fetchJson`/`fetchText` from `http-json.mjs` with injectable `fetchImpl`,
   reuse `BROWSER_LIKE_USER_AGENT`, host-pinned SSRF regex + HTTPS-only, page
   caps, per-company fail-soft. Mirror `successfactors`/`avature` (per-tenant),
   `tencent`/`meituan` (JSON API + pagination config).
2. `server/lib/portals/adapters/<slug>.mjs` + register in `ALL_ADAPTERS`
   (`server/lib/portals/registry.mjs`). NOTE: `ALL_ADAPTERS` counts **EN portal
   adapters only**; the public "N adapters" number = sources registry total
   (EN + 5 RU). Verify both with a quick `node -e import(...)`.
3. Bump gates: `tests/adapter-registry.test.mjs` (length + sorted ids),
   `tests/scan-sources-endpoint.test.mjs` (EN set), `FALLBACK_SOURCES` in
   `public/js/views/scan.js` (exact value+label parity — the
   `scan-fallback-sources` drift test enforces it).
4. New CI-isolated suite `tests/sources-<slug>.test.mjs` (fake fetch, no
   network) porting the parent's meaningful test cases — including its quirks
   (e.g. ORC ignores `hasMore`; port the authoritative behavior, not the brief).

Delegate ports to subagents — **one agent per provider**, each restricted to
EXACTLY three files (its source, its adapter, its suite) and explicitly
FORBIDDEN from touching `registry.mjs`, the two gate tests, and `scan.js`;
the orchestrator does that shared-file wiring in ONE pass afterwards.
**Wait for EVERY port agent's completion notification before wiring** — a
file existing on disk does not mean the agent is done rewriting it (v1.124.0:
the wttj adapter vanished mid-wire because its agent was still iterating).
When bumping the two gate tests, don't hand-insert ids into the sorted
literals — regenerate both lists from the live registry
(`node -e "import('./server/lib/portals/registry.mjs')…"`), because manual
insertion breaks alphabetical order. Verify the agents' claimed counts
against the actual registry yourself.

## Phase 3 — EN docs

- `CHANGELOG.md`: new `## [X.Y.Z] — YYYY-MM-DD` entry (Added / Fixed / Notes).
- `README.md`: banner heading + body → new version, prepend trail items,
  release badge + link, adapter counts. **Patch releases too** (v1.125.1/.2
  lesson): every release — patch included — must update ALL FOUR banner
  touch-points ×17: release badge + tag link, the `🆕 Latest release` line,
  a short translated narrative lead prepended to the body (old train stays
  below), and prepended trail items. Credit external contributors by
  @handle in the lead and the CHANGELOG entry. The README **Contributors
  block is a hand-maintained row of circular avatars** — maintained by the
  `contributor-pr` skill (see it for the URL template; `mask=circle`
  REQUIRES `&output=png`, JPEG sources have no alpha). Flags belong on
  language LISTS only — never on code-literal file links.
  External-contributor PRs have their own pipeline: `contributor-pr`.
- `docs/help/en.md` §17: registry count sentence.
- `qa/QA-REGRESSION-PROMPT-vX.Y.Z.md` (delta-focused sign-off checklist) —
  **MANDATORY EVERY release, patch included** (v1.134.1 lesson: shipped without
  it, user flagged the gap). Model it on the previous release's file: §0 gates
  (exact `node --test` lines for the new/changed suites + the new test count),
  §1 what-changed, §2 manual browser pass, §3 contract/security invariants,
  §4 not-ported/not-applicable, §5 sign-off. It is the last EN-doc artifact —
  do not merge the release branch until it exists.
- `npm version X.Y.Z --no-git-tag-version`; CLAUDE.md "(currently …)",
  `.claude/PROJECT-CONTEXT.md` repo-state line, `docs/sdd/CONVENTIONS.md`
  counts (test count AFTER the full run).

## Phase 4 — Locale fan-out (×16, hi included)

One subagent per locale (sonnet), each owning EXACTLY its three files:
`README.<L>.md` (banner + counts), `CHANGELOG.<L>.md` (entry above the previous
version, exact heading `## [X.Y.Z] — date`, the file's own section labels),
`docs/help/<L>.md` (§17 counts; NO heading changes). File names: Korean is
`ko-KR` for docs but `ko` for site JSONs. CHANGELOG.hi.md starts at v1.122.0.

**Mechanical parts stay OUT of agent prompts and are done by script over all
17 files**: badges (`tests-N%20passed`, `release-vX.Y.Z-blue` + tag link),
literal count strings, and the README language-switcher line (17 flag+link
entries — 🇬🇧🇪🇸🇧🇷🇰🇷🇯🇵🇷🇺🇨🇳🇹🇼🇫🇷🇵🇱🇺🇦🇩🇰🇸🇦🇩🇪🇮🇹🇹🇷🇮🇳; each file links the
other 16 and bolds its own, so a detector must NOT require the file's own
name on the line). Lesson (v1.123.0): a badge sweep that skips locales or
tells agents "don't touch badges" leaves stale badges — sweep ALL 17 yourself.
Standing user expectations every parity release must satisfy: new sources
appear in the `#/scan` Source filter (FALLBACK + live registry — the drift
gate proves it), language-picker blocks are only touched when a locale was
actually added, and the README language lines stay complete ×17 (audit:
every line carries exactly 17 flags).

**Integrity sweep after the fan-out** (the parity gates are blind to these):
- every help bundle exactly **29 H2 / 105 H3** (current gate);
- exactly one new `## [X.Y.Z]` per changelog ×17;
- no English glosses in headings/link texts (ar is the usual offender);
- CJK files use full-width punctuation in new prose;
- `node scripts/check-changelog-parity.mjs` green.

## Phase 5 — Gates

- `npm test` — full suite, **capture the exit code directly** (never
  `npm test | grep`); record the new count and write it into badges ×17,
  CONVENTIONS, PROJECT-CONTEXT, wiki.
- `node tools/i18n-audit.mjs` if dicts changed; regenerate
  `tests/fixtures/i18n-dict.snapshot.json` via `tests/helpers/i18n-vm.mjs`.
- Site build only if `site/` changed (Node ≥ 22 via nvm). **Run it AFTER all
  17 root CHANGELOGs are final** — `site/scripts/sync-assets.mjs` (prebuild)
  copies each `CHANGELOG.<L>.md` → committed `site/src/content/changelog/<L>.md`,
  so a build mid-fan-out snapshots a partial set (v1.134.1: 8 mirrors staged
  stale, parity gate blind — it only checks the ROOT files). After the fan-out,
  re-run `npm run build` once and confirm `grep -L '<new-version>'
  site/src/content/changelog/*.md` is empty before committing.
- URL-presence assertions in new tests: extraction + strict equality, never
  `String.includes(url)` or unanchored regexes (CodeQL flags both).

## Phase 6 — Ship

1. Branch `feat/vX.Y.Z-<slug>` → commit (conventional, body lists the delta,
   `Co-Authored-By: Claude` trailer) → push → `gh pr create`.
2. `gh pr checks <n> --watch` until green (Playwright is slowest; ci.yml is the
   hard gate, pre-commit AI review is advisory).
3. `gh pr merge <n> --squash --delete-branch` (needs the user's standing/explicit
   merge authorization) → `git checkout main && git pull`.
4. `git tag vX.Y.Z && git push origin vX.Y.Z` → Release workflow fires itself.
5. `gh workflow run publish-package.yml --ref vX.Y.Z` — Publish NEVER auto-fires.
6. Pages deploy is paths-filtered on `site/**`: if the release touched no site
   files but landing facts changed (version/tests/adapters badges feed
   `facts.json`), dispatch `gh workflow run deploy-pages.yml --ref main`.
7. Wiki: clone `Fighter90/career-ops-ui.wiki` into the scratchpad (re-clone
   every time — scratchpad clones do not survive), update Home banners ×17
   (version · adapters · tests), Scanner-Providers (as-of line + a table row per
   new provider), Testing-and-QA / Release-Process counts; commit + push.
8. Local redeploy: `pkill -f "node server/index.mjs"; nohup npm start …` from
   fresh main; verify `/api/health` (version + parentVersion) and, for a new
   provider, that `/api/scan/sources` lists it.
9. Verify externally: `gh release view vX.Y.Z`, package version via
   `gh api /users/Fighter90/packages/npm/career-ops-ui/versions` (run gh from
   the repo dir, not the wiki clone), cvstart.org version badge.

## Phase 7 — Final cross-surface verification (every release, patch included)

The user's standing sign-off question is *"docs/sdd? help? README? site? wiki?
на всех языках проверил?"* — answer it with a live sweep, not from memory. When
a release moves a count (source/test/locale) grep the repo + wiki for the OLD
number first (see the [[release-fanout-misses-these-surfaces]] memory), then
confirm each surface:

- **README ×17** — exactly one `🆕 vX.Y.Z` banner + one `📜` CHANGELOG line per
  file; `tests-<N>` + `release-vX.Y.Z` badges swept; zero stale old-version /
  old-count tokens. `for L in "" .es .pt-BR …; do …; done`.
- **CHANGELOG ×17** — exactly one `## [X.Y.Z]` per file; `check-changelog-parity`
  green.
- **help ×17** (`docs/help/<L>.md`) — §17 source-count sentence matches the
  registry; **help never carries a test count** (don't add one). If the source
  count didn't change, help is untouched — verify, don't edit.
- **docs/sdd/CONVENTIONS.md** — "Current count as of **vX.Y.Z**: **N**" test
  baseline bumped. **docs/architecture/** `OVERVIEW.md`/`API.md` "N adapters as
  of vPREV" are historical attributions — leave them unless the count changed.
- **site** — `site/src/content/changelog/*.md` all 17 carry the new entry
  (build-generated, see Phase 5); `site/src/generated/facts.json` version =
  new; live `cvstart.org` HTML carries the version token (raw
  `/generated/facts.json` 404 is expected — it's bundled at build).
- **wiki ×17** — Home banners (version · adapters · tests), Testing-and-QA +
  Release-Process counts. Scanner-Providers "as-of" + per-provider row change
  ONLY when a source was added. Watch localized/CJK/Arabic-diacritic postfixes
  when sweeping the count (a naive grep misses ja "アダプター N 個", ar shadda forms).
- **runtime** — local `/api/health` version + parentVersion; Release + Publish
  (package version) + Pages runs all `success`; Dependabot alerts 0 open if a
  lockfile bump shipped.

## Known traps

- gh commands resolve the repo from cwd — never run them from the wiki clone.
- **Skipping the QA prompt.** `qa/QA-REGRESSION-PROMPT-vX.Y.Z.md` is a HARD
  Phase-3 artifact for EVERY release, patch included — the easiest thing to
  forget on a fix-only ship (v1.134.1 shipped without it). No merge until it
  exists.
- **Site changelog mirror is build-time-generated.** `sync-assets.mjs` regens
  `site/src/content/changelog/*.md` from the root CHANGELOGs; a site build run
  BEFORE the fan-out finishes commits a partial set, and the parity gate (root
  only) won't catch it. Always re-run the site build after the fan-out and grep
  the 17 mirrors for the new version.
- grep may treat emoji-bearing JS as binary — use `grep -a` / `rg`.
- The scratchpad wiki clone vanishes between sessions; always re-clone.
- CodeQL on main is advisory-red at worst; known FP classes (missing-rate-limiting,
  FS-write-route) are dismissed post-merge, but URL-substring findings have a
  real fix (extraction + `===`).
- Never point a running test at the real parent: `CAREER_OPS_ROOT=$(mktemp -d)`
  + dynamic imports inside `before()`.
