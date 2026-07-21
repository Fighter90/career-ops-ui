---
name: parent-sync
description: Sync web-ui with a newer parent career-ops release — pull the parent, scope the delta, port providers/fixes, fan out docs ×17, run every gate, ship the parity release end-to-end. Trigger when the user says "обнови родителя", "parent-sync", "возьми новое из родителя", or pastes a santifer/career-ops release URL.
---

# parent-sync — parity release pipeline

Proven across v1.119.0 (parent 1.19), v1.120.0 (1.20), v1.123.0 (1.21). Each phase
below is a hard gate — do not skip, do not reorder. The parent repo (`..`) is
**READ-ONLY** except the user-authorized `git pull` itself.

## Phase 1 — Pull & scope

1. `cd .. && git rev-parse HEAD` (save OLD), `git pull`, `cat VERSION`.
   Diff by **commit range**, never by VERSION (release-please lags main).
2. Read the new CHANGELOG entries + `git diff OLD..HEAD --name-status`.
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
  release badge + link, adapter counts.
- `docs/help/en.md` §17: registry count sentence.
- `qa/QA-REGRESSION-PROMPT-vX.Y.Z.md` (delta-focused sign-off checklist).
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
- Site build only if `site/` changed (Node ≥ 22 via nvm).
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

## Known traps

- gh commands resolve the repo from cwd — never run them from the wiki clone.
- grep may treat emoji-bearing JS as binary — use `grep -a` / `rg`.
- The scratchpad wiki clone vanishes between sessions; always re-clone.
- CodeQL on main is advisory-red at worst; known FP classes (missing-rate-limiting,
  FS-write-route) are dismissed post-merge, but URL-substring findings have a
  real fix (extraction + `===`).
- Never point a running test at the real parent: `CAREER_OPS_ROOT=$(mktemp -d)`
  + dynamic imports inside `before()`.
