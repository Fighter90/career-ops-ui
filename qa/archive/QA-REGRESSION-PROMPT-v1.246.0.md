# QA regression — v1.246.0

Feature release on v1.245.0: **all ten top findings from the CAR-48
senior-design sweep** — the apply-dark blocker (invisible info-card link,
≈1.0:1 → ≈7.3:1 via theme-aware `.callout--info` tokens) and the seven majors:
RTL directional isolation for numeric compositions (score pills, report
bands; ar ranges rephrased in words), CV markdown forced `dir="ltr"`,
reports DATE nowrap, sidebar scrollport ending above the USAGE HUD (+fade,
RTL mirrored), mobile scan @390 controls wrap, map controls theme-aware
(tiles pinned by CSP `img-src` — deliberate non-action), FAB scroll
clearance (+88px padding); plus activity action slugs ×18 locales with a
raw-id fallback and assessments `htmlFor`/`id` labels. Counts:
**5075 → 5090** unit.

## §0 — Gates
```bash
npm run test:ci                      # 5090 pass, exit 0
npm run test:e2e:browser             # browser suites green
npm run test:e2e                     # 21 pass · 0 fail (Flow 2b reloads after the server down/up flow)
node evals/workflow/run.mjs          # 14 pass · 0 fail
```

## §1 — Verify (in the SPA)
1. **Apply dark**: the info-card surface and its “Need Playwright?” link are
   readable in dark mode (light + dark + system-dark).
2. **RTL numerics** (ar locale): report score pill reads «X.X / 5» left-to-
   right; bands read «≥ 4.5» / «< 3.5»; dashboard «/ 5.0» intact.
3. **CV in ar**: the markdown textarea and preview stay LTR; buttons/headers
   stay RTL.
4. **Reports**: DATE cells hold one line in every locale/theme.
5. **Sidebar**: scrolling to the bottom never slides the last nav item under
   the USAGE HUD; a fade marks the cut (RTL mirrored).
6. **Mobile scan @390**: “Save search” fully visible; controls wrap.
7. **Map dark**: zoom/layers/attribution render dark; the legend and controls
   no longer argue with light tiles.
8. **FAB**: at scroll-end, Portals Disable buttons / Reports score pill /
   two-pager input / Leaflet attribution are all clickable.
9. **Activity** (any locale): ACTION shows translated verbs, filter chips
   translated; an unknown slug falls back to its raw id (never a bare key).
10. **Assessments**: fields carry visible labels bound via for/id.

## §2 — Deploy
`/api/health`: `version: 1.246.0`. Public check **401**.

## §3 — Sign-off
- [ ] §0 green · [ ] §1 1–10 · [ ] §2 prod verify passed
