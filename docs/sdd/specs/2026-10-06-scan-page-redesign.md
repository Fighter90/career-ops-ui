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

## Implementation contract (Phase 4 step 2)

This section is the build-to contract enforced by `tests/scan-redesign-layout.test.mjs`
(RED as of this writing — it **must** fail against pre-redesign code and flip to
green in the implementation PR). Selectors/keys/budgets live in ONE place,
`SCAN_CONTRACT` in `tests/helpers/scan-redesign-fixture.mjs`; change them there
and here together.

### DOM structure

```
#scan-results
├── .flex (summary badges)                     — unchanged
├── details.scan-advanced (facet chips)        — unchanged
└── .table-wrap
    └── table.tbl                              — real <table> semantics stay (Scope 6)
        ├── thead > tr > th …
        └── tbody
            └── tr.scan-row                        ← every data row
                ├── td.scan-cell-star              ← existing ⭐ button, unchanged
                ├── td.scan-cell-company
                ├── td.scan-cell-posting           ← THE bounded column
                │   ├── span.scan-icon.scan-icon--boost    (only when r._boosted)
                │   │     role="img" · aria-label=t('scan.boostIcon') · title=boosted-by tooltip
                │   ├── span.scan-icon.scan-icon--fit      (only when a fit band exists)
                │   │     role="img" · aria-label=t('scan.fitIcon') · title=existing titleFitTip tooltip
                │   ├── span.scan-icon.scan-icon--score    (only when a fit score exists)
                │   │     role="img" · aria-label=t('scan.scoreIcon') · title=existing fitTip tooltip
                │   ├── a|.span.scan-posting-title         ← line 1 (title; trailing
                │   │     "| Country | Remote" split out per Scope 2; title= full text)
                │   └── div.scan-posting-meta              ← line 2: company · location ·
                │         source · date · work-type (icons w/ accessible names;
                │         aria-label may use t('scan.postedMeta'))
                └── …remaining grid cells (seniority/salary/etc. — implementation's
                          choice, but the posting cell above is contractual)
```

Rules the layout test measures (AC1, at **1440 px and 390 px**):
- `document.documentElement` has zero horizontal overflow; `.table-wrap` has zero
  internal horizontal scroll (the whole table fits — no `overflow-x` scrollbar).
- Every `td.scan-cell-posting`: `scrollWidth ≤ clientWidth`, and exactly two text
  blocks — `.scan-posting-title` and `.scan-posting-meta`, each within one line
  box (height ≤ 1.4 × line-height). No third text block in the cell.
- `#scan-results table tbody tr` remains a valid selector (Playwright suites and
  `job-facets.js` read it — spec §Risks).

### Pagination (AC3)

- New control `#scan-page-size` — a `<select>` whose options **include 50**
  (50/100/200/500 recommended); default page size **50** (first paint renders ≤ 50 rows).
- The existing `UI.paginate` bar stays (`.paginator`, `.pg-summary`).
- Budget: with the 700-row fixture corpus loaded, `#scan-results` contains
  **< 4000 DOM nodes** (TreeWalker, all node types).

### New i18n keys (AC2 — ×17 parity, R-08; parity gated by `tests/i18n-coverage.test.mjs`)

| Key | Replaces | Used as |
|---|---|---|
| `scan.fitIcon` | «strong/related/weak fit» words | aria-label of `.scan-icon--fit` |
| `scan.boostIcon` | «⬆ буст / ⬆ boosted» | aria-label of `.scan-icon--boost` |
| `scan.scoreIcon` | the bare «◎ 65» | aria-label of `.scan-icon--score` |
| `scan.postedMeta` | (new) meta-line announcement | aria-label/summary of `.scan-posting-meta` |

### Fixture & harness

- Corpus: `tests/fixtures/scan-redesign-fixture.json` — the exact complaint row
  (`Grafana Labs · ⬆ буст · сильное совпадение · ◎ 65 · Senior Backend Engineer -
  Databases - Analytics | Germany | Remote` — reproduced verbatim in the browser,
  en and ru), a 282-char title, 4 ru rows, 5+ sources, 700 rows total
  (`tests/helpers/scan-redesign-fixture.mjs` seeds a throw-away `CAREER_OPS_ROOT`:
  `data/last-scan.json` + `config/profile.yml` target_roles (→ strong band) +
  `config/two-pager.yml` (→ FitScore 65); measured before-state in
  `/tmp/scan-redesign/before/metrics.json`).
- Before screenshots (this step): `/tmp/scan-redesign/before/scan-{1440,1024,390}-{light,dark}-{en,ru}.png`.
- Run:
  - RED contract (fails today, by design): `SCAN_REDESIGN_RED=1 node --test tests/scan-redesign-layout.test.mjs`
  - Before captures: `SCAN_REDESIGN_CAPTURE=1 node --test tests/scan-redesign-layout.test.mjs`
  - Both need a browser: prefix `CAREER_OPS_PLAYWRIGHT_PATH=<parent>/node_modules/playwright`.
  - The env gates exist because the filename matches the unit-suite glob
    (`tests/*.test.mjs`); **the implementation PR removes the gates** (`SKIP` collapses
    to the Playwright-missing case), adds the file to `npm run test:e2e:browser`,
    and flips every assertion green. AC5's guard must stay green throughout.
- Measured before-state (v1.243.2, this fixture): a 200-row page slice alone is
  **5 493 nodes**; **all 200** title cells stand taller than two text lines
  (137 px @1440, 242 px @390); at 390 the table scrolls **675 px** inside
  `.table-wrap`; full-page height **16 126 px @1440 / 23 869 px @390**.
