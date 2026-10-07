# Usage meter rework + first end-to-end widget test (v1.116.0)

**Status:** Shipped · **Version:** 1.116.0 · **Date:** 2026-07-06

## What

Three things, driven by user feedback + a forwarded CodeQL notification:

1. **Usage meter (v1.114.0) reworked** (`public/js/lib/usage-hud.js` + `app.css`):
   - **Pinned to the bottom of the sidebar** — `position: fixed`, full `--sidebar-w`
     width, matching the sidebar surface, on top of it (`z-index: 11`).
   - **The menu is never covered** — `syncSidebarPad()` sets the sidebar's
     `padding-bottom` to the HUD's own height (recomputed on collapse + resize +
     each render), so the nav + version footer always scroll clear above it.
   - **Refreshes live** — a 15 s interval, plus on `visibilitychange` (tab focus)
     and `hashchange` (route change).
   - **Honest display** — each window row shows the real `<tokens> · <est. cost>`;
     bars scale against the widest shown window (30d), replacing the previous
     "share %" that read as 100 % for anyone whose usage was all recent.
2. **Durable CodeQL barrier** (`server/lib/cv-import.mjs`): the verified-Buffer
   size is read behind an explicit `typeof rawLen === 'number' && Number.isFinite`
   guard — a barrier the `js/type-confusion-through-parameter-tampering` query
   recognizes — closing the recurring false positive (alert #384) at the source.
   Behaviour is unchanged (a real Buffer's length is always a finite number).
3. **First end-to-end widget acceptance test** (`tests/playwright-widgets.mjs`):
   drives both persistent overlays in a real Chromium — the Ask-the-docs launcher
   (open → greeting + chips → Escape-close → hidden on `#/docs-assistant`) and the
   usage meter (fixed, 3 tokens·cost rows from a seeded `data/llm-usage.jsonl`,
   header-collapse persisting). Wired into `npm run test:e2e:browser`.

## Invariants

- Read-only widget (only `GET /api/usage`); no new route, no CSP change.
- CSP-safe (no inline handlers; only innerHTML is a compile-time constant SVG).
- Tests: `tests/usage-hud.test.mjs` (10, updated) + `tests/playwright-widgets.mjs`
  (2 E2E). Unit suite **1735 → 1737**. Help §6 extended ×16 (H2/H3 counts stable).
