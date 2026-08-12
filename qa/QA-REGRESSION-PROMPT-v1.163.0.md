# QA REGRESSION PROMPT — career-ops-ui **v1.163.0** (FIX-5: help covers report → PDF)

**Audit finding (LOW, `FIX-PROMPT-post-v1.158.0.md` SHIP 5).** The in-app "Ask the docs" assistant, asked "How do I export a report to PDF?", answered that the help guide did not cover it — although `#/reports/:slug` has a working 📄 Generate PDF control. Docs/help-only fix.

- **Under test:** `package.json` **1.163.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2420, exit 0 (capture $? directly, never | grep)
node --test tests/help-reports-pdf-section.test.mjs tests/help-ru-config-section.test.mjs tests/locales-de-it-tr.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.163.0
```

## §1 — Root cause + fix

- The help guide's §10 Reports section had no PDF-export subsection, so the docs-assistant (grounded ONLY on the help guide's `##` sections) honestly said it wasn't covered.
- Added an **"Export a report to PDF"** H3 under §10 Reports in **all 17 bundles** (`docs/help/*.md`): open a report → **📄 Generate PDF** → `generate-pdf.mjs` writes to `output/*.pdf` (needs Playwright; Health page shows install state); nothing is sent — review before attaching.
- Help gate moves **31 H2 / 112 H3 → 31 H2 / 113 H3**; the count is updated in `help-ru-config-section.test.mjs` + `locales-de-it-tr.test.mjs`.

## §2 — Manual pass

1. **`#/docs-assistant`** (or the floating "Ask the docs" FAB) — ask "How do I export a report to PDF?": the answer now describes the 📄 Generate PDF button, the `output/*.pdf` destination, and review-before-send, citing the Reports section (not "the guide doesn't cover this").
2. **`#/help`** — §10 Reports has an "Export a report to PDF" subsection; repeat in a non-EN locale.
3. **The control still works** — on a saved report, 📄 Generate PDF streams and downloads (unchanged).

## §3 — Invariants

- **Docs/help only** — no code, route, CSP, SSRF, or parent-write change; no i18n-dict key.
- **Gate moved deliberately** — 113 H3 across all 17 bundles (31 H2 unchanged); parity ×17 green.

## §4 — Sign-off

Suite **2420** green · the docs-assistant answers the PDF-export question from the Reports section · §10 has the subsection in all 17 bundles · help gate 113 H3 · parity ×17. **Closes SHIP 5 (FIX-5, LOW).**
