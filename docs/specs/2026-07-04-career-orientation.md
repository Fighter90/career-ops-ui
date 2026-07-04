# Spec — Career orientation (Epic 27, v1.96.0)

## Problem

The user wanted a dedicated "Профориентация" (career orientation) section — modelled on a vocational/aptitude test report (career vectors, career type, recommended professions, professional qualities, working style, development recommendations) — but produced by AI from their own CV and profile rather than a psychometric questionnaire.

## Approach

A single page + one route, mirroring the `market`/`career-plan` AI-generate pattern, but **generate-only with no writes** (like `cv-studio`).

- **Route** — `server/lib/routes/orientation.mjs`: `POST /api/orientation/generate` builds a career-orientation prompt from `bundleProjectContext` (CV + profile + two-pager + memory), runs it through the shared provider cascade (`runActiveProvider`), and falls back to a copy-paste prompt with no key. The prompt frames the output as an **AI reflection of how the CV reads, NOT a psychometric test** — it maps the user against the eight career archetypes (Functionalist, Administrator, Communicator, Specialist, Analyst, Innovator, Manager, Entrepreneur) with evidence, and produces a career-type leaning, recommended roles, professional strengths, working-style tendencies, and development recommendations. It must not invent achievements and must not fabricate measured test scores.
- **View** — `public/js/views/orientation.js`: a Generate button → renders the returned Markdown via `UI.md()`, plus the shared export bar (Markdown / PDF / copy). A note explains it's a reflection and nothing is saved.
- **Nav** — the **Growth** group (added v1.95.0) now holds Career plan 🧭 and Career orientation 🧩.

## Data contract & security

**No writes.** `orientation.mjs` never touches the filesystem — the profile is generated fresh each request and exported client-side only. `llmRateLimit` guards generate. Content is grounded strictly in the user's in-scope materials; the reflection framing prevents presenting inferred traits as measured psychometric results.

## Tests

`tests/orientation-routes.test.mjs` — CI-isolated (`mktemp` `CAREER_OPS_ROOT`, dynamic imports in `before()`): asserts the built prompt carries the reflection-not-test framing ("NOT a psychometric test"), the archetype-vectors section, the no-fabricated-scores guard, `<project_context>`, and the profile's target role; and that manual mode returns the copy-paste prompt when no provider key is set.

## Out of scope

Numeric psychometric scoring (deliberately excluded — it's a reflection, not a test); saving/versioning the profile (export-only); an interactive questionnaire (one-shot from existing materials per agreed scope).
