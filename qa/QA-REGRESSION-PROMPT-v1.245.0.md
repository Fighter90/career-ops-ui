# QA regression — v1.245.0

Feature release on v1.244.2: **Tamil (தமிழ்) as the 18th UI locale** — 1449-key
dict with full parity to `en` (Indic-tech conventions; providers, model names,
paths and commands stay Latin), `detect()` accepts `ta`/`ta-IN`/`ta-LK`, Tamil
is LTR (locked by test), full `docs/help/ta.md` (33 H2 / 125 H3),
README.ta.md + CHANGELOG.ta.md mirrors, enumeration gates 17 → 18 (incl. the
previously missing CI `hi`), `prompts.mjs` additive scaffold strings. Counts:
**5068 → 5075** unit.

## §0 — Gates
```bash
npm run test:ci                      # 5075 pass, exit 0
node --test tests/i18n-ta-locale.test.mjs tests/i18n-coverage.test.mjs tests/i18n-locale-files.test.mjs
node evals/workflow/run.mjs          # 14 pass · 0 fail
```

## §1 — Verify (in the SPA)
1. Language switcher lists **தமிழ் 🇮🇳**; selecting it re-renders the chrome,
   nav, dashboard, tracker and scan view in Tamil (no Latin UI leftovers
   beyond tech tokens: provider names, paths, `CV`).
2. `?lang=ta` and `Accept-Language: ta-IN` / `ta-LK` both resolve to ta;
   reload keeps the choice (localStorage).
3. Toggle to ar (RTL) and back — Tamil layout stays LTR, no direction leak.
4. docs help: the in-app help renders `docs/help/ta.md` with all 33 sections,
   working §-anchors and verbatim YAML blocks.
5. Report generation in ta: the evaluation prompt carries the Tamil language
   directive (last line) and the scaffold strings; block letters A–G and
   SCORE_SUMMARY markers stay Latin.
6. Everything else from the v1.244.2 QA prompt §1 holds (scan chrome, salary
   one-line, muted ◎, CAR-36 modal).

## §2 — Deploy
`/api/health`: `version: 1.245.0`. Public check **401**.

## §3 — Sign-off
- [ ] §0 green · [ ] §1 1–6 · [ ] §2 prod verify passed
