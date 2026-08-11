# QA REGRESSION PROMPT — career-ops-ui **v1.100.0** (Two-pager export + live auto-fill)

Delta regression for the `#/two-pager` page and the new document-export path. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.100.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite (new: export-routes ×5)
node --test tests/export-routes.test.mjs       # valid ZIP/OOXML docx, empty→400, 4-part pkg, YAML-fence parse
node --test tests/i18n-coverage.test.mjs       # 4 new keys ×16 locales, zero missing
node --test tests/help-ui.test.mjs             # 28 H2 per bundle
node --test tests/help-ru-config-section.test.mjs  # 28 H2 / 102 H3 (unchanged — §21 extended in place)
node tools/i18n-audit.mjs                       # clean
node scripts/check-changelog-parity.mjs         # all 15 locales at v1.100.0
```

## §1 — What changed

Two-pager (**Setup → Two-pager 🎯**) gains live auto-fill + a preview/export bar.

1. **AI auto-fill.** Click **✨ AI fill assistant**. With an LLM key configured it runs live (`POST /api/two-pager/draft {run:true}`), reads only your CV + profile, and **fills every field in place** (who I am / loves / must-haves / hates / deal-breakers / non-negotiables / target environment). Review, edit, then **Save**. With no key → the copy-the-prompt modal (unchanged fallback).
2. **Preview & export.** Click **👁 Preview & export** → a modal renders the two-pager as a formatted document with **Download .md / Save as PDF / Save as DOCX / Copy**. The DOCX opens cleanly in Word/Google Docs.
3. **Shared export bar.** The same **Save as DOCX** button now also appears on the **market report** (`#/stats`), **career plan** (`#/career-plan`), and **career orientation** (`#/orientation`) pages.

## §2 — Contract & security invariants

- **Source of truth.** Auto-fill uses only `bundleProjectContext` (CV + profile + memory + two-pager). Nothing is invented; the user reviews and Saves. Unknown YAML keys are dropped, arrays/strings capped (`parseYamlFields` → `normalizeTwoPager`).
- **Export route is inert.** `POST /api/export/docx` does **no** file writes, **no** LLM call, **no** user-URL fetch; body is bounded to 200 KB. `Content-Disposition` filename is sanitized.
- **No new dependency.** The `.docx` is built by hand on `node:zlib` (deps stay `express` + `js-yaml`).
- **CSP-safe.** `UI.el` + `addEventListener`; `UI.md()` render boundary; DOCX download via a Blob object URL on a user-clicked `<a download>` (same-origin POST, no inline script).

## §3 — i18n

4 new keys (`export.saveDocx`, `twoPager.preview`, `twoPager.aiFilling`, `twoPager.aiFilled`) present + translated in all **16** locales. Switch locale: the AI-fill / preview buttons, the filling/filled toasts, and the export-bar labels read in-language. Arabic RTL.

## §4 — Sign-off

All §0 gates green · auto-fill populates fields from CV (or manual prompt with no key) · Preview modal renders · Download .md / Save as PDF / Save as DOCX / Copy work on two-pager + market + career-plan + orientation · DOCX opens in Word · export route writes nothing to disk · 4 keys ×16 · source-of-truth / inert-export / no-new-dep / CSP invariants intact.
