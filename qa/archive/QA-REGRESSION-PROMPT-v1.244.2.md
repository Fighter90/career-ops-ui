# QA regression — v1.244.2

Feature release on v1.244.1: **scan page chrome polish + results-table
hardening** — launcher card (aligned control row, dominant primary button),
terminal status bar (state dot idle/running/done/error, reduced-motion safe),
reposts disclosure (capped panel, sticky header — a 1,560-cluster dataset
rendered a 155,000-px panel before), filters as a uniform responsive grid;
salary cells keep only the money range (`salaryHead`, blurb → tooltip),
empty-title rows render the company, seniority badge never wraps, unscored
rows show muted «◎ —» with a two-pager-compare tooltip, aux layout contract
measures the content element. Counts: **5045 → 5068** unit / browser
contracts extended.

## §0 — Gates
```bash
npm run test:ci                      # 5068 pass, exit 0
npm run test:e2e:browser             # layout contracts pass
SCAN_REDESIGN_RED=0 CAREER_OPS_PLAYWRIGHT_PATH=<playwright> node --test tests/scan-redesign-layout.test.mjs
node --test tests/scan-filters-grid.test.mjs tests/scan-reposts-liveness.test.mjs tests/scan-title-split.test.mjs
```

## §1 — Verify (in #/scan)
1. **Launcher**: URL / keyword / max-per-source row aligns; Run is the single
   dominant primary; saved-search row sits under it (light + dark).
2. **Terminal status bar**: idle → running (dot pulses; reduced-motion: no
   pulse) → done (green) / error (red + Retry banner). No layout shift.
3. **Reposts disclosure**: open with a large dataset — panel is height-capped
   and scrolls under a sticky header; count badge matches.
4. **Filters grid**: filters + footer controls form an even responsive grid at
   1440 / 1024 / 390; no orphan buttons.
5. **Salary cell**: a board row with «$243K – $286K • Offers Equity • 401(k)…»
   renders one money line; the blurb lives in the tooltip; the row height is
   unchanged vs a plain-salary row.
6. **Empty title**: a row with a blank title shows the company (then «—»), not
   a blank cell.
7. **Seniority**: a long seniority badge stays on one line in its column.
8. **Unscored row**: shows muted «◎ —»; tooltip explains no two-pager keyword
   match; does not look broken next to scored rows.
9. Everything else from the v1.244.1 QA prompt §1 holds (icon aria-labels,
   title split, meta dates).

## §2 — Deploy
`/api/health`: `version: 1.244.2`. Public check **401**.

## §3 — Sign-off
- [ ] §0 green · [ ] §1 1–9 · [ ] §2 prod verify passed
