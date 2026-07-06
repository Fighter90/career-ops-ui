# AI usage & cost meter in the sidebar (v1.114.0)

**Status:** Shipped · **Version:** 1.114.0 · **Date:** 2026-07-06

## What

A compact **"USAGE"** meter on every page, showing LLM token use across
**24h / 7d / 30d** windows — each as `<tokens> · <share%>` with a green meter bar
(share of all-time) — plus an estimated 24h-cost footer. It surfaces the same
read-only data as the `#/usage` page (`GET /api/usage`, a rollup of the local
`data/llm-usage.jsonl` log); cost is an estimate and manual-mode runs are free
and uncounted.

Matches the requested design: a gauge-headed "USAGE" section with per-window
rows and green progress bars.

## How

- **`public/js/lib/usage-hud.js`** (`window.UsageHud`) — self-contained IIFE
  loaded from `index.html`. It **mounts into the sidebar** (`insertBefore` the
  `.sidebar-footer`) so it reads as a flush sidebar section (the `usage-hud--sidebar`
  variant: static, transparent, top-divider), with a **fixed bottom-left corner**
  fallback (`position: fixed`, card) when there is no sidebar. Bottom-right in RTL.
- **Collapsible:** the header toggles the body; the collapsed state persists in
  `localStorage`. A `hashchange` listener refreshes the cheap read-only GET on nav.
- **`app.css`** — theme-aware light/dark tokens (`--hud-*`), green meter bars,
  an explicit `.usage-hud__bodywrap[hidden]{display:none}` override (the v1.58.35
  cascade lesson), RTL mirroring, and a mobile rule that hides only the fixed
  fallback (the sidebar variant rides inside the drawer).
- **i18n** — 3 new keys ×16 (`hud.title`/`hud.empty`/`hud.estimate`) with
  `data-i18n*` hooks so `applyI18n()` re-localizes on language change.

## Invariants / security

- **Read-only** — the widget only `GET`s `/api/usage`; no writes, no new route.
- **CSP-safe** — no inline handlers; the only `innerHTML` is a compile-time
  constant gauge SVG.
- **Honest** — cost is labelled an estimate; the empty-state explains manual-mode
  runs cost nothing and aren't recorded.
- Sits in the opposite corner from the Ask-the-docs launcher (v1.113.0), so the
  two persistent overlays never collide.

## Tests

`tests/usage-hud.test.mjs` (8): read-only endpoint reuse (no `POST/PUT/DELETE`),
CSP-safety, sidebar mount + fixed fallback, index.html load order, `data-i18n`
hooks, the 3 keys ×16, collapse persistence + `[hidden]` override, RTL mirror.
Verified live via Playwright (sidebar-flush render, localized, zero console
errors). Suite **1722 → 1730**. Help gates unchanged (no new help section —
the meter surfaces the already-documented `#/usage` data).
