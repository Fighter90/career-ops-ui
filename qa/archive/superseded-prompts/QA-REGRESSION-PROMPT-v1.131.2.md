# QA Regression Prompt — v1.131.2 (`app.css` split)

> Patch / refactor. Pays down a file-size-contract debt: `app.css` (~1990 LOC)
> split into three ordered stylesheets. **No behavior, markup, or i18n change** —
> the cascade is byte-for-byte identical. Baseline: v1.131.1 (green, 2135).

## What changed

- `public/css/app.css` (~672) + new **`public/css/components.css`** (~595) + new
  **`public/css/overlays.css`** (~737). Contiguous, in-order cut; each within the
  800-LOC hard limit.
- `public/index.html` loads all three as `<link>`s **in that exact order**
  (`app.css` → `components.css` → `overlays.css`).
- New `tests/helpers/css.mjs::loadAppCss()` reads the concatenation; the 15
  CSS-asserting tests were migrated to it. New `tests/css-modularization.test.mjs`
  locks the split. `.github/workflows/dashboard-screenshots.yml` paths-filter
  widened to `public/css/*.css`. +3 tests → **2138**.

## Sign-off checklist

- [ ] `npm test` — **2138 / 2138**, exit 0.
- [ ] `node --test tests/css-modularization.test.mjs` — files exist · each ≤ 800 LOC · index.html link order app→components→overlays.
- [ ] **Byte-identity:** `diff <(git show <pre>:public/css/app.css) <(cat public/css/app.css <(tail -n +8 public/css/components.css) <(tail -n +8 public/css/overlays.css))` is empty (cascade unchanged).
- [ ] **In-browser (fixture-backed, no real data):** load any route; DevTools → all three `/css/*.css` return 200 and parse; `getComputedStyle('.sidebar').borderRightWidth` = `1px` (app.css), `getComputedStyle('.tracker-tab').minHeight` = `44px` (components.css), a `.usage-hud`/`.toast` rule applies (overlays.css). **0 console errors.**
- [ ] Visual spot-check in light + dark theme + one RTL locale (`ar`) — chrome, cards, tables, tabs, toast/drawer, docs-fab, usage-HUD all render as before.
- [ ] `npm run test:e2e:browser` — Playwright locale-sweep + theme-toggle green (catches any load-order regression).
- [ ] No change to server, routes, JS views, i18n dicts, or help (H2/H3 29/105).
- [ ] CHANGELOG parity ×17 at 1.131.2; README banner ×17; tests badge 2138 ×17.
- [ ] `/api/health` → `version 1.131.2`, `parentVersion 1.24.0`.
