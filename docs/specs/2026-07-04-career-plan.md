# Spec — Career plan (Epic 26, v1.95.0)

## Problem

The user wanted a dedicated section that generates a personalized career development plan via AI — modelled on a real 12-section career plan (self-diagnosis, market fit, SMART/OKR/WOOP goals, a month-by-month roadmap, skill plan, pitfalls) — from their own CV and profile, editable and exportable.

## Approach

A single page + one route, mirroring the memory/two-pager (GET/PUT save-to-user-layer) and market (AI generate) patterns.

- **Route** — `server/lib/routes/career-plan.mjs`: `GET`/`PUT /api/career-plan` read/write the user-layer `config/career-plan.md`; `POST /api/career-plan/generate` builds a coaching prompt from `bundleProjectContext` (CV + profile + two-pager + memory), a **horizon** (6/12/24 months), and an optional **focus**, runs it through the shared provider cascade, and falls back to a copy-paste prompt with no key. The plan is forward-looking guidance grounded in the user's materials; the prompt forbids fabricating employers/titles/achievements.
- **View** — `public/js/views/career-plan.js`: horizon + focus controls, Generate, an editable textarea, Save, Preview, and the shared export bar (Markdown / PDF / copy). Loads any saved plan on mount.
- **Nav** — a new **Growth** group holds Career plan (and, next, Профориентация).

## Data contract & security

Only `PUT /api/career-plan` writes (to the user layer, survives updates). `normalizePlan` (128 KB), `normalizeHorizon` (6/12/24), and a 400-char focus cap bound input; `llmRateLimit` guards generate. The plan is a plan — recommendations, not new factual claims about the user's past.

## Tests

`tests/career-plan-routes.test.mjs` — bounding, GET-empty + PUT/GET round-trip into `config/career-plan.md`, and a horizon-aware prompt seeded from the profile's target role with the no-fabrication instruction.

## Out of scope

Multiple saved plans / versioning (single canonical file); an interactive questionnaire (generation is one-shot from existing materials per the agreed scope); auto-saving generated output (user edits then Saves).
