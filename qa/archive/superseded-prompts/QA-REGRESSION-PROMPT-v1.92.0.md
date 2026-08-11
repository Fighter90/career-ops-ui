# QA REGRESSION PROMPT — career-ops-ui **v1.92.0** (Epic 21: CV Studio)

Delta-focused regression for CV Studio. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.92.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                        # full suite (≥1634 cases; new: cv-diagnostics + cv-studio-routes)
node --test tests/cv-diagnostics.test.mjs       # CvDiagnostics.analyze + CvPrivacy.mask (deterministic)
node --test tests/cv-studio-routes.test.mjs     # humanize prompt grounding + no-fabrication guardrails
node --test tests/i18n-coverage.test.mjs        # 29 new keys ×16 locales, zero missing
node tools/i18n-audit.mjs                         # clean
node scripts/check-changelog-parity.mjs           # all 15 locales at v1.92.0
```

## §1 — What changed

New `#/cv-studio` page (nav: Setup → CV Studio 🎨), three tools over `cv.md`:

1. **Résumé diagnostics** — `window.CvDiagnostics.analyze(markdown)` → `{score, words, bullets, checks[]}`. Deterministic, client-side, no LLM. Six checks (length, quantified impact, weak verbs, buzzwords, sections, contact). A blank/near-empty CV (<20 words) short-circuits to score 0 with a single honest failure (it does NOT inflate via "no weak verbs" passes).
2. **Privacy mask** — `window.CvPrivacy.mask(markdown, opts)` → `{markdown, counts}`. Redacts email/phone/links/handles/address, and name→initials when opted in. In-browser only; toggles + copy. Short numeric runs (years, versions) are NOT masked as phones.
3. **Make it human** — paste ≥20 chars → `POST /api/cv-studio/humanize`. Prompt inlines `voice-dna.md` + up to 3 `writing-samples/*.md` and carries a hard "**Do NOT add any fact/metric/achievement**" guardrail. Live via the shared cascade, or a copy-paste prompt with no key (never a fabricated rewrite).

## §2 — Contract & security invariants

- **No file writes.** CV Studio never writes — diagnostics/mask are client-side; humanize returns text the user pastes into the existing `PUT /api/cv`. Voice files are read-only.
- **No fabrication.** The humanize prompt forbids introducing any new fact; diagnostics/mask are deterministic. Verified by `tests/cv-studio-routes.test.mjs`.
- **CSP-safe view.** `cv-studio.js` uses `addEventListener` + `UI.el`; rewrite output via `UI.md()` (XSS boundary), manual prompt via a `readonly` textarea. The two libs load before the view in `index.html`.
- **CodeQL** `js/missing-rate-limiting` on `/humanize` (which has `llmRateLimit`) is the known false positive if flagged — dismiss post-merge.

## §3 — i18n

29 new keys (`nav.cvStudio`, `cvs.*`) present + translated in all **16** locales. Switch locale: nav item, section titles, check labels, mask toggles, buttons read in-language. Arabic RTL.

## §4 — Sign-off

All §0 gates green · diagnostics score + explanations render · mask redacts + reports counts + copies · humanize rewrites live or shows an honest prompt with no fabricated facts · 29 keys ×16 locales · no-write / CSP invariants intact. (Template gallery, Word export, posting-PDF archive are follow-up scope — not in this release.)
