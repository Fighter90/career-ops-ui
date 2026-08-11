# QA REGRESSION PROMPT — career-ops-ui **v1.116.0** (Usage meter rework + widget E2E)

Delta regression for the reworked usage meter + the first end-to-end widget test.
Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.116.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates
```bash
npm test                                   # unit ≥1737 (usage-hud ×10, cv-import barrier)
npm run test:e2e:browser                   # incl. tests/playwright-widgets.mjs (2 E2E, needs a browser)
node --test tests/usage-hud.test.mjs tests/security-hardening-v1111.test.mjs
```

## §1 — What changed
1. **Usage meter pinned to the sidebar bottom** (fixed, full sidebar width) — pads the sidebar so the **menu is never covered**; **refreshes live** (15 s + tab-focus + route change); rows show real `<tokens> · <est. cost>` (bars scale vs the 30d window), not a 100% share.
2. **`cv-import.mjs`** reads the buffer size behind a `typeof … === 'number'` barrier (closes CodeQL #384 at source).
3. **`tests/playwright-widgets.mjs`** — real-browser E2E for the Ask-the-docs launcher + the usage meter.

## §2 — Verify (en + ru + one CJK + ar; light + dark)
- **Menu never covered:** on every page the USAGE meter sits pinned at the bottom of the left sidebar; scroll the sidebar — the last nav items + version footer always clear ABOVE it (it reserves space). Resize the window — the reserved space tracks the meter height.
- **Live refresh:** run a live AI action (with a key) → within ~15 s (or on tab-refocus) the 24h row's tokens + cost tick up. Manual-mode runs add nothing.
- **Honest rows:** each window shows `<tokens> · <$cost>`; with all usage recent the three rows are equal (correct) — no misleading "100%".
- **Collapse:** clicking the header collapses the body; the state persists across navigation/reload. RTL → pinned bottom-**right** edge.
- **CV upload still gated:** empty → error, >10 MB → error, normal file imports (the `typeof` barrier is behaviour-neutral).
- **E2E:** `npm run test:e2e:browser` green including the 2 widget tests; zero console errors.

## §3 — Sign-off
All §0 gates green · menu never covered by the pinned meter · live refresh works · rows show tokens·cost (no 100%) · collapse persists · RTL mirrored · CV uploads still gated · widget E2E green.
