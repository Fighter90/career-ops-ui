# QA regression — v1.247.0

Feature release on v1.246.0: **the tail of the CAR-49…58 design sweep** —
every remaining minor/polish finding, plus the dark map deferred by the
previous release. Headliners: the map renders a real dark theme (CSS-inverted
OSM tiles by default; keyed Carto-dark preset via `MAP_TILE_DARK_URL`, CSP
`img-src` extended for its host; tile layer remounts live on theme flip),
`.callout--warn` dark variants (+ regression fix: `.callout a` scoped
`:not(.btn)`), a single stroke-SVG topbar icon set (emoji gone),
`UI.pageMeta` ⏱+cost pattern, activity of empty states
(pipeline/interview-digest/orientation), config `displayPath()` (never
absolute paths), tracker tabs sentence case ×18, assessments-style label
hygiene across forms. Counts: **5090 → 5116** unit.

## §0 — Gates
```bash
npm run test:ci                      # 5116 pass, exit 0
npm run test:e2e:browser             # green
npm run test:e2e                     # 21 pass · 0 fail
node evals/workflow/run.mjs          # 14 pass · 0 fail
```

## §1 — Verify (in the SPA)
1. **Map dark**: dark theme flips the tiles to the inverted layer and back —
   live, without a reload; zoom/layers/attribution stay dark; no CSP console
   errors. With `MAP_TILE_DARK_URL` set, the keyed Carto layer renders.
2. **Yellow callouts** (`config` save, `batch`, hero warning): readable dark
   variants; the primary button inside a callout keeps its primary styling.
3. **Apply**: info-card URL wraps whole words, link visible in dark.
4. **CV**: header buttons text-only and consistent.
5. **Tracker**: status tabs sentence case in every locale (check de/ru/ar).
6. **Topbar**: bell/theme/doctor icons render as stroke SVGs in light+dark;
   theme flip still works without a reload.
7. **Dashboard**: Pipeline quick-action ring appears only on hover/focus.
8. **Scan**: saved-search Delete reads destructive.
9. **Pipeline**: empty preview shows title + hint + CTA.
10. **Meta line**: evaluate/deep/auto/mode-page/orientation show ⏱ + cost in
    one line under the title; auto h1 has no ✨.
11. **interview-digest / orientation**: designed empty states before first run.
12. **Career-plan**: export disabled until content exists.
13. **stats**: no duplicate «Market report» heading; region placeholder fits.
14. **Config**: saved-file subtitle shows `~/…` or bare file name (never an
    absolute path); LLM_PROVIDER helper reads as three short lines.
15. **Profile**: EMAIL card keeps the address on one line at 1440.
16. **Health**: «Run buttons» text never breaks mid-word.
17. **Help (ar)**: inline code stays LTR/isolated, scrollable, unbroken.
18. **Hero (ru/ar)**: «Live evals» pill icon + text no longer collide.

## §2 — Deploy
`/api/health`: `version: 1.247.0`. Public check **401**.

## §3 — Sign-off
- [ ] §0 green · [ ] §1 1–18 · [ ] §2 prod verify passed
