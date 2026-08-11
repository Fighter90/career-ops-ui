# QA Regression Prompt — v1.130.0 (parent career-ops v1.24.0 parity)

> Minor release. Two new scan sources + two mirrored source fixes.
> Baseline: v1.129.1 (all green, 2073).

## What changed

- **Two new scan sources** (in-process, no new deps; both self-register via
  `export const meta` and get an EN portal adapter):
  - **a16z Speedrun** (`a16z-speedrun-talent`, parent #2231) — the a16z Speedrun
    *talent-network* board-wide JSON feed. Host-pinned `speedrun-talent-network.com`,
    HTTPS-only, 0-indexed pagination with a page cap, per-company `q`/config
    threading, fail-soft. +`tests/sources-a16z-speedrun-talent.test.mjs` (16).
  - **Cryptocurrency Jobs** (`cryptocurrencyjobs`) — the Web3 board
    `cryptocurrencyjobs.co`, via its public RSS 2.0 feed (zero-auth). Two-pass
    XML-entity decode, remote-only listings, employer parsed from the
    `"… at <Company>"` title tail. +`tests/sources-cryptocurrencyjobs.test.mjs` (14).
  - Registry total → **72 sources = 67 English + 5 Russian** (`ALL_ADAPTERS` = 67).
- **echojobs mirror** (parent #2258) — a case-insensitive `hybrid` marker now
  yields `"<City> · Hybrid"` (or bare `Hybrid`) and `workplaceType: 'Hybrid'`
  instead of collapsing to `Remote`. +`tests/sources-echojobs.test.mjs` (7).
- **radancy mirror** (parent a3e6df9) — parses legacy TalentBrew markup + the
  JSON results-fragment transport (`buildFragmentUrl`/`readFragmentTotals`),
  gated on an injectable `opts.fetchJson`. +`tests/sources-radancy.test.mjs` (13).
- +50 tests → **2123**. No i18n/help H2/H3 changes (help §17 count sentence
  bumped 70→72 / 65→67 only).

## Sign-off checklist

- [ ] `npm test` — **2123** green (capture `$?` directly, never `| grep`).
- [ ] `node --test tests/sources-a16z-speedrun-talent.test.mjs tests/sources-cryptocurrencyjobs.test.mjs tests/sources-echojobs.test.mjs tests/sources-radancy.test.mjs` — 16 + 14 + 7 + 13.
- [ ] `node --test tests/adapter-registry.test.mjs` — `ALL_ADAPTERS.length === 67`, sorted-id list matches.
- [ ] `node --test tests/scan-sources-endpoint.test.mjs` — EN set includes `a16z-speedrun-talent` + `cryptocurrencyjobs` (67 EN values).
- [ ] `node --test tests/scan-fallback-sources.test.mjs` (drift) — `FALLBACK_SOURCES` in `scan.js` matches the live registry (value + label).
- [ ] Manual: `GET /api/scan/sources` lists both new sources with the right region/label.
- [ ] Manual: `#/scan` Source filter shows **a16z Speedrun** and **Cryptocurrency Jobs**.
- [ ] Site: cvstart.org "Job sources" chips include both (build from `site/` before checking).
- [ ] Help H2/H3 unchanged (29/105); §17 count sentence reads **72** / **67 English + 5 Russian**.
- [ ] CHANGELOG parity ×17 at 1.130.0 (`node scripts/check-changelog-parity.mjs`).
- [ ] `/api/health` → `version 1.130.0`, `parentVersion 1.24.0`.
