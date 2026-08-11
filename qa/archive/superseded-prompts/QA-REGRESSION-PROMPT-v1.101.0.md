# QA REGRESSION PROMPT — career-ops-ui **v1.101.0** (CV Doctor — tailor to a job)

Delta regression for CV Studio's new **Tailor to a job** card. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.101.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite (cv-studio-routes +3)
node --test tests/cv-studio-routes.test.mjs    # generic prompt (gate+bridge+no-fab, no hardcoded employer), manual seed, JD→400
node --test tests/i18n-coverage.test.mjs       # 10 new cvs.tailor* keys ×16, zero missing
node --test tests/help-ui.test.mjs             # 28 H2 per bundle (unchanged)
node --test tests/help-ru-config-section.test.mjs  # 28 H2 / 102 H3 (unchanged — §24 extended in place)
node scripts/check-changelog-parity.mjs         # all 15 locales at v1.101.0
```

## §1 — What changed

CV Studio (`#/cv-studio`) gains a 4th card, **Tailor to a job**.

1. **Tailor.** Paste a job description (optionally a target role/headline) → **🎯 Tailor résumé + cover letter** → `POST /api/cv-studio/tailor`. With a key it returns three Markdown sections — (1) tailored résumé, (2) cover letter with a word count, (3) a **checklist report** ending `GATE: PASS|BLOCKED`. With no key → a copy-paste prompt (mode `manual`).
2. **Export.** The result card carries the shared bar — Download .md / Save as PDF / **Save as DOCX** / Copy.

## §2 — Contract & security invariants

- **Generic.** The distilled `TAILOR_INSTRUCTIONS` hardcode **no** companies, roles, or career tracks — a regression asserts the prompt contains none of a specific brief's employers. All specifics come from `bundleProjectContext` (your CV + profile + two-pager) + the pasted JD.
- **Never fabricates.** Reorder / reframe / emphasise only; unquantified results are marked `NEEDS_METRIC`, never invented; no authorship claims not in `cv.md`.
- **No writes.** `POST /api/cv-studio/tailor` is generate-only, `llmRateLimit`, JD bounded 24 KB. No `js/http-to-file-access` surface.
- **CSP-safe.** `UI.el` + `addEventListener`; `UI.md()` render boundary; DOCX via same-origin Blob download.

## §3 — i18n

10 new keys (`cvs.tailor*`) present + translated in all **16** locales. Switch locale: the card title/help, JD + headline placeholders, tailor button, running/failed toasts read in-language. Arabic RTL.

## §4 — Sign-off

All §0 gates green · tailored résumé + cover letter + checklist report generate (or manual prompt with no key) · gate blocks on errors · Download .md / PDF / DOCX / Copy work · nothing written to disk · generic (no hardcoded employer) · 10 keys ×16 · never-fabricate / no-writes / CSP invariants intact.
