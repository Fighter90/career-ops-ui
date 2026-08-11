# QA REGRESSION PROMPT — career-ops-ui **v1.96.0** (Epic 27: Career orientation)

Delta regression for the `#/orientation` page. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.96.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite (new: orientation-routes ×2)
node --test tests/orientation-routes.test.mjs  # reflection framing + no fabricated scores + CV/profile-seeded manual mode
node --test tests/i18n-coverage.test.mjs       # 7 new keys ×16 locales, zero missing
node --test tests/help-ui.test.mjs             # 28 H2 per bundle
node --test tests/help-ru-config-section.test.mjs  # 28 H2 / 102 H3
node tools/i18n-audit.mjs                       # clean
node scripts/check-changelog-parity.mjs         # all 15 locales at v1.96.0
```

## §1 — What changed

New **`#/orientation`** page (nav: **Growth → Career orientation** 🧩).

1. **Generate.** Click **Generate profile** → `POST /api/orientation/generate`. Live (with a key) returns a Markdown career-orientation profile; no key → a copy-paste prompt (mode `manual`). Built from the user's own CV + profile + two-pager + memory (`bundleProjectContext`) and covers: **best-fit career vectors** (which of the eight archetypes fit, with evidence), a **career-type leaning**, **recommended roles**, **professional strengths**, **working-style tendencies**, and **development recommendations**.
2. **Export.** Download .md / Save as PDF / Copy (shared `report-export.js`). Nothing is saved server-side.

## §2 — Contract & security invariants

- **Reflection, not a test.** The prompt frames output as an AI reflection of how the CV reads — NOT a psychometric test. It never invents achievements and never reports numeric test scores as if measured.
- **No writes.** `orientation.mjs` never touches the filesystem — generate-only, fresh each time. (No `js/http-to-file-access` surface; CodeQL should stay clean.)
- **Bounded + rate-limited.** `POST /api/orientation/generate` carries `llmRateLimit`.
- **CSP-safe.** `UI.el` + `addEventListener`; `UI.md()` render boundary; Blob download.

## §3 — i18n

7 new keys (`orient.*` + `nav.orientation`) present + translated in all **16** locales. Switch locale: nav item, generate button, running/failed toasts, subtitle + reflection note read in-language. Arabic RTL.

## §4 — Sign-off

All §0 gates green · profile generates (or manual prompt with no key) seeded from your CV/profile · Download .md / Save as PDF / Copy work · nothing written to disk · 7 keys ×16 · reflection-not-test / no-writes / CSP invariants intact.
