# QA regression — v1.243.0

Minor on v1.242.1: **client fixes (Phase 3)** — unsaved-edit preservation, modal/SSE
lifecycle, salary/keyword Unicode parsing, i18n completion (da detect, cv-diagnostics
×17), CSS AA contrast, SPA-fallback 404. Counts: **5036** unit (was 4812) / **118+**
browser / coverage **98.15 % line / 89.34 % branch** (floor 96/86).

## §0 — Gates

```bash
npm run test:ci                      # 5036 pass, exit 0
npm run test:e2e:browser             # ≥118 pass (new navigation/contrast contracts)
node evals/workflow/run.mjs          # pass
npm run test:coverage:gate           # exit 0 (node 22)
```

## §1 — What changed (verify each)

1. **Unsaved-edit guards**: edit the CV → Cancel → decline-leave → edits are back;
   switch language mid-edit → prompt; career-plan keeps its generated plan.
2. **Modal**: #/tracker → Outcome → click another nav item — the modal CLOSES, the new
   view is clickable (was: modal blocked everything).
3. **Keyword chips with Cyrillic / c++ / .net** filter rows correctly (was: zero rows).
4. **Salaries**: `$100-150K`, `от 100 000 руб`, `100 тыс. руб.`, `50 000 Kč` render sane
   numbers in role stats (was: 150 / null / 90× / 50M).
5. **Locales**: a da-DK browser gets Danish; zh-Hant → 繁體; the CV-studio checklist is
   translated in ru/ja/hi (was: 16 English strings everywhere); no `da` → en fallback.
6. **Contrast**: dark-theme toasts/buttons/banners ≥ 4.5:1 (was 1.10:1); `--rausch`
   surfaces use AA tokens.
7. **Server**: `GET /app.js` → **404** (was the index shell); `GET /api/runners` →
   action index JSON; SPA routes still serve the shell.
8. **Misc**: evaluate shows the truncation warning; memory/two-pager refuse Save over a
   failed load; the docs FAB does not cover cards at 390 px; tracker "Proceed with
   Caution" is a warning badge; stats funnel counts canonical stages.

## §2 — Manual browser pass

#/cv (edit → cancel → decline → verify restore) · #/tracker → Outcome → navigate ·
#/scan (filters + a scan) · #/cv-studio checklist in ru · #/dashboard in da (via
devtools locale) · 390 px pass · dark theme.

## §3 — Invariants

No new routes; CSP untouched; parent files untouched; request guard untouched;
`data-i18n-aria-label` keys exist ×17 (css-a11y-layout test guards).

## §4 — Deploy

`/api/health`: `version: 1.243.0`. Public check **401**. Timers held/resumed.

## §5 — Sign-off

- [ ] §0 green · [ ] §1 1–8 · [ ] §2 in a real browser · [ ] §4 prod verify passed
