# SPEC — Help ×18 fan-out + docs-assistant reindex (CAR-135 second half, CAR-136)

- **Status:** Draft
- **Release:** v1.261.0
- **Related:** #533 (CAR-135 EN rewrite, merged `a79f9491`), CAR-136, `2026-10-27-oct27-wave-two.md`
- **Owner:** orchestrator

## Goal
The 18 localized help bundles describe the v2 UI with the same fidelity as `en.md`, and the in-app docs assistant answers reference questions correctly in every locale with a "go to screen" link.

## Context
#533 rewrote `docs/help/en.md` against the v2 UI (33 H2 / 125 H3 skeleton preserved byte-count-wise; 99 i18n keys cited, grep-verified). The ×18 locale bundles still describe the v1 UI; the H2/H3 parity gates keep them green but factually stale. The docs assistant (`routes/docs-assistant.mjs`) retrieves over `docs/help/<lang>.md` at request time — once the bundles are translated, retrieval follows automatically; what is missing is the reference-question contract (CAR-136) and "go to screen" route links.

## Scope
1. `docs/help/<locale>.md` for the 18 non-EN locales: mirror the prose deltas of #533 section-by-section (intro v2-shell note, §1 auto-pipeline stepper + superseded guard + example URL, §7 scan v2 chrome + live-registry source count, §8 grouped pipeline + lossless undo + palette, §10 reports v2 + 20-per-page pagination, §11 kanban, §14 empty states, §17 "121 sources" wording).
2. i18n key citations: the dotted keys inside backticks are locale-INVARIANT — copy verbatim; the human-readable labels around them translate.
3. `tests/help-reference-questions.test.mjs` (new): per locale, ≥3 canonical questions ("how do I run a scan", "how does the pipeline undo work", "where do I configure providers") must retrieve the correct H2 section through the docs-assistant's real keyword retrieval (imports the route's section-splitter, no LLM) — plus each answer's section must map to a route slug (`/#/scan`, `/#/pipeline`, `/#/config`) asserted present in the retrieved excerpt.
4. `docs/help/` route-link lines: each locale's §-intro gains one "Open the screen: `/#/<route>`" line per major section (en first in a follow-up commit to this spec's branch, then mirrored).

## Out of scope
- New H2/H3 sections (structure is locked; a structural change requires re-running the whole fan-out — deliberately deferred).
- CAR-137 context hints, CAR-139 README/wiki sync, CAR-140 screenshots.
- Machine-translating any locale without review — each locale file lands as a full-prose translation pass (executed per-locale, GLM-5.3-Flash, one agent per locale).

## Acceptance criteria
1. All 19 `docs/help/*.md` pass `tests/canonical-docs-coverage.test.mjs`, `tests/help-ui.test.mjs`, `tests/help-ru-config-section.test.mjs`, `tests/locales-de-it-tr.test.mjs` (H2=33, H3=125 parity).
2. `tests/i18n-no-latin-leaks.test.mjs` stays green for non-Latin locales (no EN prose leaking into ru/ja/zh/ar/… bundles; key names inside backticks exempt by the test's own rules).
3. `tests/help-reference-questions.test.mjs` green ×19 (≥3 questions per locale retrieving the right section + route link present).
4. `tests/docs-assistant-routes.test.mjs` green (corpus still parses per locale).
5. Every locale diff touches ONLY `docs/help/<locale>.md` (no code, no dict files).

## Plan
- T-1 [flash ×18, parallel]: one agent per locale; packet = the #533 diff (`git show a79f9491 -- docs/help/en.md`), the locale file, the gates. Verification: locale's gates + the leaks gate.
- T-2 [flash]: route-link lines in en.md (follow-up commit on the same branch set) + mirror in fan-out packets.
- T-3 [flash]: reference-questions test (en first, then ×19 matrix via the same per-locale agents' final step).
- T-4 [orchestrator]: single PR carrying all 19 files (parity gates require them together), CI, merge.

## Risks and invariants touched
- R-08 (i18n/help parity): the fan-out is the risk — all 19 files travel in ONE PR so the parity gates cannot go red mid-wave.
- Docs-assistant grounding: a mistranslated section degrades retrieval for that locale only; the reference-question test locks the minimum.

## Verification
Fill with real output before the fan-out PR merges: gates (1)–(4) outputs appended here by the orchestrator; per-locale agent reports archived in the PR description.
