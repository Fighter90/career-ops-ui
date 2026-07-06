# QA REGRESSION PROMPT — career-ops-ui **v1.113.0** (Floating "Ask the docs" assistant)

Delta regression for the floating help-chat launcher present on **every** page.
Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.113.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates
```bash
npm test                                 # full suite (≥1722; new: docs-fab ×8)
node --test tests/docs-fab.test.mjs      # CSP-safe wiring, endpoint reuse, i18n keys, RTL, [hidden] override
node --test tests/i18n-locale-files.test.mjs tests/i18n-coverage.test.mjs   # 6 new keys ×16 (fab.* + docs.err)
```

## §1 — What changed
A gradient **robot chat launcher** (`public/js/lib/docs-fab.js`, `window.DocsFab`) floats bottom-right (bottom-left in RTL) on every page, mounted globally from `index.html`. It opens a compact chat over the SAME grounded endpoint as `#/docs-assistant` (`POST /api/docs-assistant/ask`) — help-guide-only, never CV/profile/tracker.

## §2 — Verify (walk in en + ru + one CJK + ar)
- **Every page:** the launcher shows in the bottom-right (glowing gradient circle + white chat-bubble icon); **not** shown on `#/docs-assistant` itself.
- **Open:** click → panel opens with a robot avatar, localized title + green-dot online status, a localized greeting bubble, and 3 starter chips (each with an icon). Focus moves into the input.
- **Ask (with a key):** a starter chip or a typed question → answer bubble rendered via `UI.md()`, with a "From: …" sections line; the log scrolls. **No key:** a ready-to-run prompt opens in a modal + a manual-mode bubble.
- **Close:** the X button, `Escape`, and a click outside the panel all close it and return focus to the launcher.
- **i18n:** switch locale → launcher aria/title, panel title, status, greeting, placeholder, send aria all re-localize (no raw key leak). **ar:** launcher + panel mirror to the bottom-**left**; chrome RTL-correct.
- **Theme:** light + dark both legible (panel surface, bubbles, chips, send button).
- **CSP:** zero console errors; no inline handlers; answer HTML escaped-first.

## §3 — Sign-off
All §0 gates green · launcher on every page except `#/docs-assistant` · open/ask/close flow works live or manual · 6 keys ×16 re-localize · RTL mirrors left · dark+light legible · zero console errors.
