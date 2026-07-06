# Scan Exclude filter + pipeline overview strip (v1.109.0)

**Status:** Shipped · **Version:** 1.109.0 · **Date:** 2026-07-06

## Problem

Parent-web layout parity: the scan page wanted an explicit "roles to find" +
"Exclude" filter pair, and the pipeline page wanted a compact status overview
(`Pipeline · N in inbox · N tracked · …`). The underlying data already existed —
`#/scan` had rich filters (remote/source/country/age/salary/favorites) and
`#/tracker` already had a clickable status-funnel — so this is additive UI, not a
redesign.

## Solution

### Scan (`public/js/views/scan.js`)

- The **Search** box now treats commas as **OR** ("roles to find" — a row shows
  if it matches any term).
- A new **Exclude** field hides any row whose company/role/location contains any
  of its comma-separated terms.
- Both round-trip through the saved-search state (`getFilterState`/
  `setFilterState`) and are cleared by Reset; Enter applies.

### Pipeline (`public/js/views/pipeline.js`)

- An **overview strip** above the add-URL card: chips for **in inbox**
  (`data/pipeline.md` count) + **tracked** (tracker row count) + the
  **Applied / Responded / Interview / Offer** counts from `GET /api/tracker`,
  each linking to `#/tracker`. Read-only; degrades to just the inbox count if the
  tracker read fails.

## Invariants

- Client-only — no new route, no writes, no LLM. CSP-safe (`UI.el` +
  `addEventListener`, inline styles only).

## Tests

`tests/scan-pipeline-ui-v1109.test.mjs` (2 source-pattern checks, matching the
client-view convention): the exclude/include-OR filter logic + saved-search
round-trip; the pipeline overview strip + graceful degradation. 4 new i18n keys
×16 (`scan.filterExclude`/`scan.lblExclude` + `pipe.ovInbox`/`pipe.ovTracked`).
Help §7 + §8 extended in place. Full suite **1706** green.
