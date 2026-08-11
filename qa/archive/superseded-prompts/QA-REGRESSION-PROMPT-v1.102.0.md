# QA REGRESSION PROMPT — career-ops-ui **v1.102.0** (Ask the docs — grounded help chat)

Delta regression for the `#/docs-assistant` page. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.102.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite (docs-assistant-routes ×6)
node --test tests/docs-assistant-routes.test.mjs  # section split/rank, grounded prompt, manual seed, empty→400, traversal-safe
node --test tests/i18n-coverage.test.mjs       # 14 new docs.*/nav.docsAssistant keys ×16, zero missing
node --test tests/help-ui.test.mjs             # 28 H2 per bundle (unchanged)
node --test tests/help-ru-config-section.test.mjs  # 28 H2 / 102 H3 (unchanged — §1 extended in place)
node scripts/check-changelog-parity.mjs         # all 15 locales at v1.102.0
```

## §1 — What changed

New **Ask the docs** page (nav: **Help → Ask the docs** 💬).

1. **Ask.** Type a how-to question (or click a starter chip) → `POST /api/docs-assistant/ask`. With a key it answers live from the retrieved help sections and lists which sections it used; no key → a copy-paste prompt (mode `manual`) already filled with those sections.
2. **Grounding.** The server splits the help doc for your locale (`docs/help/<lang>.md`) into `##` sections, scores them by keyword overlap with your question, inlines the top 5, and instructs the model to answer **only** from them.

## §2 — Contract & security invariants

- **No user data.** Only the shipped help guide + your question are read — never `cv.md`, profile, tracker, or reports. (Verify: the assembled prompt contains help sections, not CV content.)
- **Grounded, no invention.** The model must answer from the excerpts or say the guide doesn't cover it; it must not fabricate features/routes/settings.
- **No writes.** `POST /api/docs-assistant/ask` is answer-only, `llmRateLimit`, question bounded 500 chars. No `js/http-to-file-access` surface.
- **Path-safe.** The locale code is sanitized (`[^a-zA-Z0-9_-]` stripped) so retrieval can't escape `docs/help/`.
- **CSP-safe.** `UI.el` + `addEventListener`; `UI.md()` render boundary.

## §3 — i18n

14 new keys (`docs.*` + `nav.docsAssistant`) present + translated in all **16** locales. Switch locale: nav item, title/subtitle, starter chips, placeholder, Ask button, thinking/failed states read in-language. Arabic RTL. Ask a question in each locale → the answer comes back in that language.

## §4 — Sign-off

All §0 gates green · question answers from real help sections (or manual prompt with no key) · the "From: …" footnote lists the sections used · never reads CV/profile/tracker · nothing written to disk · 14 keys ×16 · grounded-no-invention / no-writes / path-safe / CSP invariants intact.
