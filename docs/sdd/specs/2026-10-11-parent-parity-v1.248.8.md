# SPEC — Parent parity 115 commits + ta/ja language work — v1.248.8

- **Status:** Done (deployed, prod-verified)
- **Release:** v1.248.8 (PR, tag `v1.248.8`)
- **Parent:** Fighter90/career-ops db11bee7 = merge of career-ops-hq 3c1aebdc..1db6517a (115 commits)
- **Related:** CAR-74, CAR-75, CAR-76 (closed by this release); CAR-70 (ta drift — umbrella, remains)

## Parent fork sync (phase 0)

The fork merge DEFENDED the standing divergences: upstream deleted
providers/telegram.mjs (the fork-only file survives — ADR-0001) and
reverted the Cyrillic Unicode-boundary LOCATIONISH_RE to ASCII `\b`
(kept — ADR-0002; the revert produces zero merge conflicts, exactly the
shape the skill warns about). One UD conflict (tracker-columns-tests.mjs)
resolved upstream: the coverage moved to in-process tests/tracker-columns.test.mjs (120 pass).

## Scope

1. **pageup source+adapter** — the new parent provider, ported to the
   web-ui source contract (meta auto-discovery, assertPageupUrl SSRF pin
   on the vendor host, parsePageupListing pure + bounded, pagination with
   the no-fresh / short-page stop rules, max_pages cap tagging
   `pageupTruncated`). Registry 105 adapters; all three count gates
   regenerated from the live registry; 26-case CI-isolated suite.
2. **extractCellUrl (#3516)** — the parent renders tracker URL cells as
   markdown links; the href is the dedup key. parseApplications extracts
   at parse time; bare URLs and placeholders pass through verbatim.
   markdownLinkDestination/parseMarkdownLinks ported alongside.
3. **states fallback** — `assessment` between Responded and Interview
   (the live states.yml read picks the parent's new state up automatically;
   the last-resort constant is updated for parity).
4. **CAR-74** — the ta looping report (46 587 chars, Block B repeated,
   no D–G/score): `cutRepeatedBlockHeadings` cuts at the first repeat,
   the rejection reason names the loop, and non-EN prompts carry a ready
   `## A) … ## G)` heading skeleton so the machine format and the
   language mandate stop competing.
5. **CAR-75** — lang-check's script share is a PROSE metric: tables,
   SCORE_SUMMARY, code, URLs are stripped before scriptShare. A Japanese
   report with Latin tables holds lang ✓ deterministically.
6. **CAR-76** — /api/evaluate carries the `report not in <locale>`
   warning (both provider tails) and prod-llm prints the warning codes as
   a table column (codes only — the log is public).

## No-port (documented)

scan-ats-full infrastructure (fetchListing/listingIdentity/
_connection-scope — web-ui has no reverse-ATS sweep); the liveness
expired→scan-history recorder (web-ui has no scan-history writer; the
pure planner ports when one appears); coverage-check/discover/story-bank
template/pdf --ats/text mode/domain_filter (CLI-only); dedup-tracker
req-id fix (web-ui has no dedup-tracker); dashboard Go TUI; README.vi.md
(the parent's new locale — web-ui's locale set is its own).

## Verification (real output)

- `npm run test:ci` → **5219 tests / 5216 pass / 0 fail** (+23: pageup
  suite 26, url-cell 7, looping 1, ja-prose 1, states/coverage updates).
- coverage gate 98.17/89.43 · e2e 21/0 · browser/full green · evals 12/0 ·
  link-check «No broken links».
- Prod live ja+ta (after deploy): two runs, lang ✓ + A–G ✓ + warnings
  column visible.
