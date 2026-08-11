# QA REGRESSION PROMPT — career-ops-ui **v1.114.0** (AI usage & cost meter in the sidebar)

Delta regression for the bottom-left "USAGE" meter present on **every** page.
Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.114.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates
```bash
npm test                                 # full suite (≥1730; new: usage-hud ×8)
node --test tests/usage-hud.test.mjs     # endpoint reuse (read-only), CSP-safe, sidebar mount + fallback, i18n, RTL
node --test tests/i18n-locale-files.test.mjs tests/i18n-coverage.test.mjs   # 3 new keys ×16 (hud.*)
```

## §1 — What changed
A compact **USAGE** meter (`public/js/lib/usage-hud.js`, `window.UsageHud`) is mounted into the **sidebar** above the version footer (a fixed bottom-left card if there is no sidebar; bottom-right in RTL) on every page. It shows LLM token use over **24h / 7d / 30d** as `<tokens> · <share%>` green meter bars (share of all-time) + an estimated 24h-cost footer, from the **read-only** `GET /api/usage` rollup of `data/llm-usage.jsonl` — the same source as the `#/usage` page.

## §2 — Verify (walk in en + ru + one CJK + ar)
- **Every page:** the USAGE section shows at the bottom of the sidebar with a gauge icon + localized "USAGE" header; scrolling the sidebar reveals it above the version footer. It never overlaps or hides nav items.
- **Data:** three rows (24h / 7d / 30d), each `<tokens> · <share%>` + a green bar whose width = share of all-time; the footer shows the estimated 24h cost. With **no usage logged**, a localized "no AI usage yet" line shows instead.
- **Collapse:** clicking the header collapses to just the header (chevron rotates); the collapsed state **persists** across reloads (localStorage). Re-expand restores the meter.
- **Read-only + honest:** the widget only ever `GET`s `/api/usage` (no writes); cost is labelled an estimate; manual-mode runs (no key) add nothing.
- **i18n:** switch locale → header + empty-state + footer re-localize (no raw `hud.*` leak). **ar:** the fixed-corner fallback mirrors to the bottom-**right**; the sidebar variant follows the RTL sidebar.
- **Theme:** light + dark both legible (track + green fill + text). **Mobile (<900px):** the fixed-overlay fallback is hidden; the sidebar variant rides inside the drawer.
- **CSP:** zero console errors; no inline handlers.

## §3 — Sign-off
All §0 gates green · USAGE meter on every page in the sidebar (fallback corner) without hiding nav · 3 rows + bars + est-cost footer or empty-state · collapse persists · read-only GET only · 3 keys ×16 re-localize · RTL + dark/light OK · zero console errors.
