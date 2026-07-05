# Docs assistant — grounded "ask the help guide" chat (v1.102.0)

**Status:** Shipped · **Version:** 1.102.0 · **Date:** 2026-07-05

## Problem

The user pointed at their portfolio site's AI assistant (`fighter90.github.io`)
and asked for the analogue in career-ops-ui: **an assistant over the HELP
documentation** ("Ассистент по документации HELP"). The app already ships a
28-section help guide translated into all 16 locales (`docs/help/<lang>.md`), but
finding the right section means scrolling or filtering — there was no way to just
*ask* "how do I do X?" and get a grounded answer.

## Solution

A chat that answers how-to questions **grounded only in the app's own help guide**
— never the user's CV/profile/tracker. It is about *how to use the app*, not about
the user.

### Server — `server/lib/routes/docs-assistant.mjs` (27th route module)

- `POST /api/docs-assistant/ask {question, run?}` → `{mode, answer|prompt, sections}`.
- Loads the help doc for the resolved locale (same cascade as `help.mjs`, from
  `WEB_UI_ROOT/docs/help`, path-traversal-safe).
- **Dependency-free retrieval:** `splitSections` cuts the doc into its `##`
  sections (each `###` stays with its `##` parent); `topSections` scores each by
  keyword overlap with the question (title hits weighted ×5, body occurrences
  capped so one section can't dominate) and returns the top 5.
- `buildAskPrompt` inlines those excerpts (capped 14 KB) with a hard instruction:
  answer **only** from the excerpts; if not covered, say so and point to the
  nearest section; **never invent** features/routes/settings. Answers in the
  user's language.
- Shared provider cascade (`runActiveProvider`); no key → the manual prompt
  (already filled with the retrieved sections). `llmRateLimit`; **no writes**;
  reads no user data.

### Client — `public/js/views/docs-assistant.js`

A `#/docs-assistant` chat under the **Help** nav (💬 Ask the docs): question input
+ starter chips, Q/A bubbles, and a footnote listing which help sections each
answer drew from. Enter-to-send. Manual-prompt modal when no key.

## Invariants held

- **No user data.** Only `docs/help/<lang>.md` + the question are read — no CV,
  profile, tracker, or reports.
- **Grounded, no invention.** The model must answer from the excerpts or admit the
  guide doesn't cover it; a test asserts the "do NOT invent" instruction.
- **No writes / bounded / rate-limited / CSP-safe** (`UI.el` + `addEventListener`,
  `UI.md()` render boundary).

## Tests

`tests/docs-assistant-routes.test.mjs` (6): `resolveHelpFile` fallback +
traversal-safe, `splitSections` keeps `###` under `##`, `topSections` ranks the
matching section, `buildAskPrompt` grounding + no-invention, manual-mode seeded
with real sections, empty question → 400. 14 new i18n keys ×16 (`docs.*` +
`nav.docsAssistant`). Help §1 extended in place (no new H2/H3).
