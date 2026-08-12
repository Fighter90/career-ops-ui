# QA REGRESSION PROMPT — career-ops-ui **v1.164.0** (FIX-6: search placeholder fits)

**Audit finding (LOW, `FIX-PROMPT-post-v1.158.0.md` SHIP 6).** The top-bar global-search placeholder overflowed its box in **every** locale (`scrollWidth > clientWidth`, `white-space: nowrap`); the "…or URL" half — which teaches the paste-a-URL auto-pipeline flow — was never visible. Copy-only fix.

- **Under test:** `package.json` **1.164.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2422, exit 0 (capture $? directly, never | grep)
node --test tests/search-placeholder-fit.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.164.0
```

## §1 — Root cause + fix

- `top.search` was "Find a company, role or URL…" (~28 chars). When the searchbar `flex`-shrinks on a busy top bar (sidebar + actions + the ⌘K chip), the input clips the placeholder and the URL half disappears.
- `top.search` (×17) is now the short **"Search or paste a URL"** (≤24 chars in every locale), which fits even in a narrow searchbar while keeping the URL affordance. The hardcoded `public/index.html` placeholder fallback matches. The input's `aria-label` still conveys the full "Cmd+K … paste a URL and Enter for auto-pipeline" detail (a11y unchanged).

## §2 — Manual pass

1. **Standard desktop (1280 px)** — the full placeholder is visible in `en`, one CJK locale, and `ar` (RTL); no clipping, no collision with the ⌘K/Ctrl K hint chip.
2. **Narrow (420 px)** — the placeholder still degrades sanely (may truncate, but the field is usable).
3. **Paste-a-URL** — pasting a job URL + Enter still starts the auto-pipeline (behaviour unchanged).

## §3 — Invariants

- **Copy-only** — no route, CSP, SSRF, or parent-write change. One existing i18n key reworded ×17; no new keys (snapshot **1219** unchanged).
- **A11y unchanged** — the visually-hidden label + the input `aria-label` still carry the full description.

## §4 — Sign-off

Suite **2422** green · placeholder fully visible in en/CJK/ar at 1280 px · no ⌘K collision · ≤24 chars ×17 · paste-a-URL still works · a11y label intact. **Closes SHIP 6 (FIX-6, LOW).**
