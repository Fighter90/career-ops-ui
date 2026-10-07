# SPEC — v1.242.0 sources correctness (Phase 2)

- **Status:** Done (shipped with v1.242.0)
- **Release:** v1.242.0
- **Related:** PLAN.md release 3 · Linear CAR-6…CAR-16 · `2026-10-06` review (sources ×8 + adapters ×2 slices) · parent parity v1.240.0
- **Owner:** maintainer

## Goal

A scan result can be trusted again: every board source either answers with its documented
shape or fails loudly — no more dead sources reading as "0 postings", no more challenge
pages masquerading as empty boards, no more hostile board URLs redirecting a scan.

## Context

The 2026-10-06 review (28 agents, ~190 findings) verified with file:line evidence that
~40 board sources read a malformed/Cloudflare-challenge 200 as `[]` and reported the scan
as healthy-but-empty; two sources were dead in production (justjoin envelope change,
nofluffjobs 400 without `salaryCurrency`); himalayas/jobicy fetched only the newest ~20
postings of 100k+ catalogs; 14 adapters matched vendors by substring (`clever.com` ⊃
`lever.co`), so a hostile `api:`/`careers_url:` could claim an off-host endpoint (blind
SSRF via 302) and `workingnomads` could reach `http://169.254.169.254` past the DNS guard;
one throwing adapter aborted the whole EN scan (`companies.map(detectApi)` outside any
per-company catch).

## Scope

- New shared guard module `server/lib/sources/_shape.mjs` (`requireObject`,
  `requireArray`, `requireContainer` — dotted-path containers, null-is-absent), landed
  first (CAR-7), used by every family fix.
- Per-family fixes by 9 agents over disjoint file groups (sources-1…sources-8, adapters
  + registry). Cross-cutting contract: page-1 wrong shape **throws**; later-page failure
  keeps partials and logs; pagination stops on the **raw** page length; job URLs are
  `https:` on the pinned host; adapters parse `api` and match exact hosts; adapters never
  throw from `matches()`/`buildEndpoint()` (string-or-null).
- Docs: BACKLOG closed sections removed, CHANGELOG ×17, README lead ×17, QA prompt
  v1.242.0, CONVENTIONS/PROJECT-CONTEXT/PROGRESS baselines.

## Out of scope

- Client findings from the same review (Phase 3 → v1.243.0).
- `sources/habr.mjs` dedicated tests (ratchet exemption, still open in BACKLOG).
- `site/tsconfig.json` (tracked in the astro-check spec's follow-up note).

## Acceptance criteria

1. justjoin and nofluffjobs return postings from their live APIs (fixtures encode the
   real envelopes; live probes done by the sources-5 agent).
2. Every source throws a labelled `TypeError` on a page-1 wrong shape and keeps partials
   on later-page failures (`tests/sources-shape.test.mjs` + per-family suites).
3. `resolveAdapter` and `detectApi` cannot abort a scan on garbage portals entries
   (`tests/en-scanner-detect-failures.test.mjs`, `tests/scan-adapter-resolve-safety.test.mjs`).
4. Adapter `matches()`/`buildEndpoint()` accept only parsed exact hosts; look-alikes and
   non-https refused with zero I/O (`tests/adapters-api-host-pin.test.mjs`,
   `tests/adapters-pin-coverage.test.mjs`).
5. himalayas/jobicy walk their full catalogs with page caps; workday past 100 postings;
   telegram keeps the newest posts.

## Verification

_(real output at integration time)_

- Integration: `npm run test:ci` → **4812 pass / 0 fail** (was 4419); browser **118/118**;
  `node evals/workflow/run.mjs` 12 pass / 0 fail / 2 skip; `npm run test:coverage:gate` ✓
  (mean **98.15 % line / 89.36 % branch**, floor 96/86 — raised from 86.3 % branch).
- One CI-only integration fix: duplicate pt-BR 1.242.0 entry (locale agent + orchestrator
  double-insert) collapsed to one; caught by the `locale-fanout-integrity` workflow grader.
- CI on the PR: all gates green across node 18/20/22, CodeQL, Playwright e2e.
- Deploy + full regression (local + prod, ×17 locales, live LLM + scan via remote-qa)
  run per the standing release process after merge.
