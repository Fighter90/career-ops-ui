# QA REGRESSION PROMPT — career-ops-ui **v1.115.0** (Design polish)

Delta regression for a **CSS-only** conservative polish — coral brand kept.
Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.115.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates
```bash
npm test                                     # ≥1735; new: design-polish-v1115 ×5
node --test tests/design-polish-v1115.test.mjs
```

## §1 — What changed (CSS only)
Dashboard metric cards lift + coral border on hover; content cards lift a hair;
primary/dark/danger buttons gain a resting shadow + hover lift; `.metric-value`
uses tabular-nums; interactive controls get a soft coral focus halo behind the
2px ring. Motion is behind `prefers-reduced-motion`.

## §2 — Verify (en + one CJK + ar, light + dark)
- **Dashboard:** hover a metric card → subtle lift + coral border; hover a button
  → subtle lift + deeper shadow; numbers are monospaced-aligned.
- **Focus (keyboard only):** Tab through buttons / tiles / nav / links → a crisp
  2px coral ring **with a soft coral halo**; inputs keep their existing ring.
- **Anti-regression:** route `<h1>`s (managed focus) must **NOT** show a coral
  box/halo on navigation (the v1.58.x spurious-ring bug). No global
  `*:focus-visible` box-shadow.
- **Reduced motion:** with `prefers-reduced-motion` on, no lifts animate.
- **RTL + dark:** unaffected; contrast intact.

## §3 — Sign-off
All §0 gates green · hover/focus polish visible on controls · route headings show
no spurious ring · reduced-motion honored · dark + RTL intact · zero console errors.
