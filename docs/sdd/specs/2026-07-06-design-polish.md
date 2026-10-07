# Design polish — conservative, coral brand kept (v1.115.0)

**Status:** Shipped · **Version:** 1.115.0 · **Date:** 2026-07-06 · **CSS-only.**

## What

A light refinement pass over the shared design system — **no restructuring, no
palette change** (the `--rausch` coral brand stays primary). It adds cohesion +
tactility to the components users touch most:

- **Dashboard metric cards** lift (`translateY(-2px)`) and pick up a coral border
  on hover — matching the quick-action tiles' interaction language.
- **Content cards** lift a hair on hover.
- **Primary / dark / danger buttons** gain a resting shadow + a gentle hover lift
  for depth (the `:active` scale press is unchanged).
- **Big numbers** (`.metric-value`) align via `tabular-nums`.
- **Interactive controls** (buttons, tiles, nav, links, chips) get a soft coral
  focus halo behind the crisp 2px keyboard ring.

## Anti-regression (the v1.58.x lesson)

The halo is **deliberately scoped** to interactive controls — it is NOT a global
`*:focus-visible { box-shadow }`, which would re-paint the spurious ring on the
managed-focus route `<h1>`s (tabindex="-1") that the codebase suppresses. Guarded
by `tests/design-polish-v1115.test.mjs`.

## Invariants

- CSS-only (`public/css/app.css`); no markup, i18n, route, or CSP change.
- All added motion sits behind `@media (prefers-reduced-motion: reduce)`.
- Verified live via Playwright (dashboard intact, zero console errors).
- Tests: `tests/design-polish-v1115.test.mjs` (5). Suite unchanged at 1730 + 5.
