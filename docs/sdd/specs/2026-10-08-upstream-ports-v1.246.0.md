# SPEC — Phase 6 upstream ports (server-side trio) — v1.246.0

- **Status:** Done
- **Release:** v1.246.0 (planned)
- **Related:** parent commits `c0264e7c` (#4771), `b4e9a14e` (#4703), `d26fcde7` (#4774); open parent
  issue #4810 (line-break guard, folded into the #4771 port); `docs/sdd/BACKLOG.md` §v1.246.0;
  `docs/sdd/specs/2026-10-07-sources-correctness-v1.242.0.md` (the gem phase-2 shape gate this extends)
- **Owner:** Phase 6 port agent (server-side trio); items 2/4 stay with the route-reviewer track

## Goal

A live posting that says how or when it *will* close is no longer written off as expired, Gem
locations carry the country name a `location_filter` can match, and the pricing note acknowledges
the upstream Sonnet 5.5 / Opus 5.5 ids.

## Context

Parent fork `origin/main` = `08db03d8` (v1.35.0), 0 behind upstream. Three upstream fixes had no
web-ui counterpart:

1. **#4771** (`c0264e7c`): `HARD_EXPIRED_PATTERNS` name a closure without saying whether it
   *happened*, and they are checked before the apply control. A live posting whose copy says
   "applications may be accepted until the position has been filled" or "will be closed on
   15 December" matched, `scan --verify` recorded it as `skipped_expired`, and every later scan
   dedup-skipped the URL — a real job silently removed. web-ui's
   `server/lib/liveness-core.mjs` carried the same two unguarded `closed on …` patterns and
   matched via `firstMatch` (no occurrence-level clause check).
2. **#4703** (`b4e9a14e`): upstream routes standard/premium spend tiers to `claude-sonnet-5-5` /
   `claude-opus-5-5`. The parent ships **no pricing figures** for either id (verified: the ids
   appear only in `batch/batch-runner.sh` routing and `test-all.mjs` assertions).
3. **#4774** (`d26fcde7`): Gem's GraphQL board list carries each location's country only as
   `isoCountry` (alpha-2 `DE` and alpha-3 `DEU` both occur), and `formatLocation()` ignored it —
   "London" or "Remote, US" never showed the country name `location_filter` matches on. The parent
   added `providers/_country.mjs` (76 lines, `countryName` + `countryNameFromIso` with a static
   alpha-3 → alpha-2 table) and wired it into `providers/gem.mjs`.

## Scope

- `server/lib/liveness-core.mjs` — port `c0264e7c` verbatim in web-ui's comment voice: the two
  `(?<!\bbe\s)closed on …` lookbehinds, the `TIME_OR_CONDITION_CLAUSE` regex and `firstStatedMatch()`
  (the #4810 line-break guard is *inside* this port: the ten-word, no-clause-punctuation bound keeps
  a sign-in line ending in "if" from swallowing the banner under it), and `classifyLiveness` now
  resolves hard-expired banners through `firstStatedMatch`.
- `server/lib/sources/_country.mjs` — **NEW**, byte-for-byte copy of the parent's
  `providers/_country.mjs` (verified with `diff` against `git show`). The registry already skips
  `_` files (`server/lib/sources/registry.mjs:119`), same as `_safe-url.mjs` / `_shape.mjs`.
- `server/lib/sources/gem.mjs` — the isoCountry→country wiring only: import `countryNameFromIso`,
  add `containsWholeWord` (whole-word, case-insensitive, as in the parent's ashby/breezy/recruitee),
  and fold the country into `formatLocation` unless the name already says it; unknown codes add
  nothing.
- `server/lib/llm-pricing.mjs` — anthropic row annotated with the upstream ids and an explicit
  UNKNOWN-cost note (numbers unchanged — the file's own contract forbids inventing list prices).
- `tests/liveness-core-future-closure.test.mjs` — NEW; `tests/sources-gem.test.mjs` — extended
  (`_country` unit block + parse + end-to-end fetch cases).
- `docs/sdd/BACKLOG.md` — §v1.246.0 items 1 and 5 struck; item 3 reduced to its hand-off remainder.

## Out of scope (deliberate non-actions)

- **Items 2/4 of §v1.246.0 stayed out entirely** (inline tracker status edit; `fix-report-links.mjs`
  runner). Both add routes/`routes/runners.mjs` + client surface and need the route reviewer
  (`web-ui-route-reviewer` on the SSRF/CSP/sanitizer envelope) plus i18n ×17 — a coordination track
  this server-side phase deliberately does not open.
- **#4703 remainder is a hand-off, not a silent skip.** `config-field-domains.mjs` `ANTHROPIC_MODEL`
  and the browser mirror `public/js/views/config/field-specs.js` `ANTHROPIC_MODELS` are drift-gated
  by `tests/config-select-domains.test.mjs` (exact `deepEqual`, order included — "the first entry is
  the default"), so the two ids can only enter in ONE change touching both files. `field-specs.js`
  sits under `views/`, outside this phase's file ownership; the same follow-up may flip the
  `server/lib/anthropic.mjs` default and field-specs `defaultValue`/`hintFallback` (i18n keys
  unchanged). Until then the dropdown stays at Sonnet 4.6/Opus 4.7 — the curated lists are
  deliberately unenforced, so nothing breaks for a user who sets the new ids in `.env`.
- `server/lib/sources/agenticjobs.mjs` keeps its own `countryName` copy — the parent deduplicated it
  through `_country.mjs`, but touching that file is outside this phase's ownership.
- The REST path's `formatLocation(j.location)` receives a plain string and still renders `''` —
  a pre-existing gap in REST mode (parent's version behaves identically), untouched here.

## Acceptance criteria

1. A posting stating the condition or date it will close on + a visible Apply control classifies
   `active/apply_control_visible` — `tests/liveness-core-future-closure.test.mjs` (red before the
   fix: 2 of 4 tests failing on the six live cases).
2. A real banner still closes the posting, including right after a sign-in line containing "if"
   (#4810 guard) and a page whose copy says "until … has been filled" above the banner — same file.
3. `parseGemPostings` renders `isoCountry` as the country name in the location (`Berlin` +
   `DE` → `Berlin, Germany`; whole-word duplicate suppressed; unknown `XXX` adds nothing) and
   `fetchGem` folds it end-to-end — `tests/sources-gem.test.mjs` (red before the wiring: 2 of 29
   failing).
4. `server/lib/sources/_country.mjs` is byte-identical to the parent's `providers/_country.mjs` and
   stays invisible to the source registry — `diff` + registry `_` skip.
5. `npm run test:ci` green with the new tests included; coverage gate green with the committed
   baseline untouched.

## Plan

1. Liveness red test → port `c0264e7c` → green + the five existing liveness suites. *(done)*
2. `_country.mjs` copy → gem red tests → `formatLocation` wiring → green. *(done)*
3. Pricing note for #4703; hand-off note for the domains/mirror pair. *(done)*
4. Docs: spec + BACKLOG strike. *(done)*

## Risks and invariants touched

- The false-`expired` ratchet (an `expired` verdict permanently dedup-filters a URL): this change
  only *narrows* when hard patterns fire; the banner guards pin that genuinely closed postings still
  resolve `expired/expired_body`.
- `location_filter` matching (name-based): gem locations now carry country names — strictly more
  matchable input; unknown codes change nothing.
- Registry/gate lists: `_country.mjs` is invisible to the registry (`_` prefix), so the
  source-count gates never see it.
- Traceability rows for liveness classification and scanner normalization remain covered by the
  existing suites (all green, see Verification).

## Verification

Real output from this branch (Node 22, worktree `web-ui-v12460`):

- **Red (liveness), before the fix:**
  `node --test tests/liveness-core-future-closure.test.mjs` → `# tests 4 / # pass 2 / # fail 2`
  (the condition-closure and date-closure tests failed on the six live cases; banner + Russian
  guards passed as expected).
- **Green (liveness), after:** same file → `# tests 4 / # pass 4 / # fail 0`; the existing suites
  `node --test tests/liveness-core.test.mjs tests/liveness-core-soft-expiry.test.mjs
  tests/liveness-api-more-rungs.test.mjs tests/liveness-route.test.mjs tests/scan-reposts-liveness.test.mjs`
  → `# tests 38 / # pass 38 / # fail 0`.
- **Red (gem), before the wiring:**
  `node --test tests/sources-gem.test.mjs` → `# tests 29 / # pass 27 / # fail 2`
  (`not ok 28` parse-level folding, `not ok 29` fetch-level folding).
- **Green (gem), after:** same file → `# tests 29 / # pass 29 / # fail 0`.
- **Full gate:** `npm run test:ci` → **exit 0**; `# tests 5064 / # pass 5056 / # fail 0 /
  # cancelled 0 / # skipped 8` (skips pre-existing), changelog parity + no-also + i18n audit clean
  (`hard failures: 0 · warnings: 61`, pre-existing whitespace warnings).
- **Coverage ratchet:** `npm run test:coverage:gate` → **exit 0**, baseline untouched (no
  `--write-baseline`). Mean over the tree: before 306 files `line 98.14% / branch 89.30%` → after
  307 files (`server/lib/sources/_country.mjs` enters the set) `line 98.14% / branch 89.33%`.
  Per file: `liveness-core.mjs` 100/98.00/100 → 100/98.21/100; `sources/gem.mjs` 98.38/88.59/100 →
  98.46/88.46/100; `_country.mjs` (new) 97.37/93.33/100.
- **Port fidelity:** `diff <(git -C ../ show HEAD:providers/_country.mjs) server/lib/sources/_country.mjs`
  → empty (verbatim, 76 lines).
