# Spec — Memory layer (Epic 24, v1.93.0)

## Problem

Every page in career-ops-ui starts cold — the user re-states the same preferences (remote-only, comp floor, tone) on each task. Epic 24 asks for a compact "what we've learned about you" note that is prepended to every AI request, editable in the UI, and works across all providers.

## Approach

A single user-editable note at `config/memory.md`, surfaced on a new `#/memory` view and inlined into the one place that already fans out to every LLM call.

- **Route** — `server/lib/routes/memory.mjs`: `GET /api/memory`, `PUT /api/memory` (write user layer, `normalizeMemory` bounds to 8 KB), `POST /api/memory/suggest` (mine `data/applications.md` into a behavioural-steering draft prompt for the user to review).
- **The fan-out** — add a `config/memory.md` block to `bundleProjectContext`. Because that helper is consumed by `/api/evaluate`, `/api/deep`, `/api/mode/*`, `/api/two-pager/draft`, `/api/mock-interview/turn`, and `/api/networking/plan`, the note automatically reaches **every** AI request across **all** configured providers — no per-route wiring, no new plumbing.
- **View** — `public/js/views/memory.js`: an editable textarea + Save + "Suggest from my data".

## Data contract (critical)

The memory note is **behavioural steering only** — preferences, tone, cadence, deal-breakers. Per the project DATA_CONTRACT it must **never** hold new factual claims about the user's experience; those remain exclusively in `cv.md` / `config/profile.yml` / `modes/_profile.md` / `config/two-pager.yml`. The bundle label ("preferences & steering, NOT new factual claims") and the suggest prompt ("Do NOT invent skills, employers, or achievements") encode this. Stored in the user layer; never overwritten by `update-system`.

## Security

`llmRateLimit` on `/suggest`; 8 KB note cap; 24 KB tracker-mine cap; single write on explicit Save; CSP-safe view. No path parameters (fixed `config/memory.md`), so no path-injection surface.

## Tests

`tests/memory-routes.test.mjs` — `normalizeMemory` bounds/typing, GET-empty, PUT→GET round-trip, the saved note appearing in `bundleProjectContext`, and `/suggest` seeding a behavioural prompt from the tracker (with the no-fabrication guardrail) + empty-tracker 400.

## Out of scope

Auto-writing derived claims (the suggest flow is review-then-save only), and per-provider memory tuning — one note, inlined uniformly.
