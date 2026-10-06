# Floating "Ask the docs" assistant (v1.113.0)

**Status:** Shipped · **Version:** 1.113.0 · **Date:** 2026-07-06

## What

A gradient **robot chat launcher** pinned to the bottom-right corner (bottom-left
in RTL) of **every** page. Clicking it opens a compact chat panel that answers
how-to questions grounded ONLY in the in-app help guide in the current language —
the exact same endpoint the `#/docs-assistant` page uses
(`POST /api/docs-assistant/ask`), so it never reads the user's CV, profile, or
tracker. Live with an LLM key; without one it hands over a ready-to-run prompt.

Matches the requested design: a glowing blue→purple gradient circle with a white
speech-bubble icon; the open panel has a robot avatar, a title, a green-dot
"online" status, a greeting bubble, icon starter-chips, and a gradient
paper-plane send button.

## How

- **`public/js/lib/docs-fab.js`** (`window.DocsFab`) — self-contained IIFE that
  builds the launcher + panel with `UI.el` and mounts them into `document.body`.
  Loaded from `index.html` after `api.js`/`i18n.js` (needs `UI`/`API`/`I18n`).
  Reuses the docs-assistant send flow verbatim; answers render through `UI.md()`
  (the escape-first XSS boundary). Icons are compile-time constant SVG strings.
- **Behavior:** greet-on-first-open with 3 localized starter chips; `Enter` or
  the send button asks; `Escape`, the X button, or a click outside close it and
  return focus to the launcher; a `hashchange` listener hides the launcher on the
  dedicated `#/docs-assistant` route to avoid a duplicate entry point.
- **`app.css`** — a widget section with self-contained cool-gradient accent tokens
  (deliberately distinct from the coral brand, per the requested look),
  theme-aware light/dark surfaces, an explicit `.docs-fab__panel[hidden]{display:none}`
  override (the v1.58.35 cascade lesson), RTL mirroring to bottom-left, a
  reduced-motion block, and a ≤480px full-width panel.
- **i18n** — 6 new keys ×16 (`fab.open`/`fab.title`/`fab.status`/`fab.close`/
  `fab.greeting` + `docs.err`); static labels carry `data-i18n*` attributes so
  `app.js::applyI18n()` re-localizes them on boot and every language switch.

## Invariants / security

- **No new server route** — reuses `POST /api/docs-assistant/ask` (grounded,
  reads no user data, rate-limited, manual fallback).
- **CSP-safe:** no inline handlers (all `addEventListener`); the only `innerHTML`
  writes are compile-time constant SVG icons; dynamic answer markdown goes through
  `UI.md()`.
- **Accessible:** `role="dialog"`, `aria-haspopup`/`aria-expanded`/`aria-controls`
  on the launcher, `aria-label`/`aria-live` on the log, visible focus rings,
  keyboard close.

## Tests

`tests/docs-fab.test.mjs` (8): endpoint reuse (+`run:true`), CSP-safety (no inline
`on*=`, uses `addEventListener` + `UI.md`), global mount + route-hide guard,
index.html load order, `data-i18n` hooks, the 6 keys ×16, the `[hidden]` override,
and RTL mirroring. Verified live via Playwright (launcher + panel render, zero
console errors). Suite **1714 → 1722**.
