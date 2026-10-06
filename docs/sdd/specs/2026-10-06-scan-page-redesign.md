# SPEC — Redesign the `#/scan` results page (v1.244.0)

- **Status:** Draft
- **Release:** v1.244.0 (planned)
- **Related:** `public/js/views/scan.js`, `public/js/views/scan/{filters,runner}.js`, `public/js/lib/scan-results.js`, `public/css/components.css` (`.scan-*`), `docs/sdd/specs/2026-10-06-parent-parity-v1.240.0.md`
- **Owner:** maintainer

## Goal
The scan page reads cleanly at 1440 px and at phone width: one posting = one scannable row, the **second column** never sprawls, filters know every source.

## Context
Reported by the maintainer (2026-10-06) with a real row:

> `Grafana Labs ⬆ буст  сильное совпадение  ◎ 65  Senior Backend Engineer - Databases - Analytics | Germany | Remote` — "everything in one line and it does not fit … this looks terrible in the scan table."

Today the title cell concatenates the company, a **boost** badge (`⬆ буст`), the **title-fit chip** (`strong / related / weak fit`, v1.238.0), the **fit score** (`◎ 65`) and a title that itself carries `| Germany | Remote`. A full-page capture of the page with real data is 1440 × 37 000 px — the table is also unbounded in length.

## Scope
1. **Row anatomy** — a fixed grid per row: *signal* (fit score as a compact ring/number with the chip as an icon + tooltip), *posting* (title on line 1, `company · location` on line 2, truncated with `title=` for the full text), *meta* (source, date, work-type as icons with tooltips), *action*. Boost, fit and score become **icons with accessible names**, not words.
2. **Title hygiene** — split a trailing `| Country | Remote` segment from the title into the meta line instead of rendering it inline.
3. **Column sizing** — `min-width: 0`, `overflow-wrap`, a bounded second column; no horizontal page scroll at ≥ 320 px.
4. **Pagination / virtualisation** of the results list (page size selectable), so a 700-row scan is not a 37 000 px page.
5. **Filters** — every registry source selectable (live registry + `FALLBACK_SOURCES`, already gated); filter chips for work type, date, country (after the `countries.js` fixes from the review), fit; filter state in the URL hash and `localStorage` (try/catch).
6. **Accessibility** — real `<table>` semantics or ARIA grid, keyboard row navigation, visible focus, `prefers-reduced-motion`, RTL mirroring, 17 locales (no hard-coded English).

## Out of scope
Changing what the scanner finds, the scoring formulas, or the `last-scan.json` format. Title-fit stays an annotation (never mutates results or counts).

## Acceptance criteria
1. At 1440 px and 390 px, a row never exceeds two text lines in the posting column; no element overflows the viewport. *(Playwright layout test with a fixture scan containing the Grafana row and a 200-character title)*
2. Boost, fit and score are exposed as icons whose accessible names are localized in all 17 locales. *(`tests/i18n-coverage.test.mjs`, new keys; axe-style check in Playwright)*
3. Results render in pages; the DOM node count for 700 rows stays under a stated budget. *(Playwright)*
4. The Source filter lists all registry sources; selecting one filters rows. *(existing gates + a Playwright case)*
5. No regression: counts, order and `last-scan.json` unchanged by title-fit. *(existing `title-fit` suite)*

## Plan
1. Capture the current layout (screenshots at 1440 / 1024 / 390, light + dark, ru + en + ar) as the *before*.
2. Write the Playwright layout tests (red).
3. Implement the row grid and CSS; icons with tooltips; title split helper (unit-tested, Unicode-aware).
4. Pagination; filter chips; URL/hash state.
5. Locale keys ×17; help §scan ×17; screenshots *after*.

## Risks and invariants touched
`TRACEABILITY.md` **R-07** (CSP-safe DOM), **R-08** (i18n parity ×17). The results table is also read by `public/js/lib/job-facets.js` and the Playwright suites — selectors are updated in the same commit.

## Verification
*(filled when done.)*
