# Spec — Mock Interview 2.0 (Epic 15, v1.90.0)

## Problem

`#/interview-prep` generates a static brief. It does not let the user *rehearse* — say answers, get reactions, iterate. Epic 15 asks for a turn-by-turn conversational rehearsal driven by the JD + the user's own materials, with per-answer feedback, a gap list, a story bank, and saved session history per company/role.

## Approach

A new `#/mock-interview` SPA view backed by `server/lib/routes/interview.mjs`.

- **Turn endpoint** — `POST /api/mock-interview/turn { role, company?, jd?, history[], run? }`. Server builds an interviewer prompt (`buildInterviewPrompt`) that inlines the candidate's `cv.md`, `config/profile.yml`, `config/two-pager.yml`, and `interview-prep/story-bank.md` via `bundleProjectContext({ extraFiles })`. Behaviour:
  - empty history (or last turn is the interviewer) → ask ONE opening question;
  - last turn is a candidate answer → `### Feedback` (STAR+R strengths/gaps) + `### Score` (`N/5`) + `### Next question`.
  - `run:true` + a provider key → live via the shared cascade; otherwise `{ mode:'manual', prompt }` for copy-paste. Never a fabricated answer.
- **Persistence** — `POST /api/mock-interview/save` writes `interview-prep/mock-{company}-{role}-{date}.md` (user layer, explicit Save). `GET /api/mock-interview/sessions` lists `mock-*.md`; `GET`/`DELETE …/:name` open/remove (path-safe).
- **Shared provider cascade** — extracted to `server/lib/llm-dispatch.mjs` (`runActiveProvider`, `providerAvailable`) so this and future live-LLM routes share one honest, size-capped dispatch (Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models → manual).

## Data contract

Read: `cv.md`, `config/profile.yml`, `config/two-pager.yml`, `interview-prep/story-bank.md` (all in-scope per DATA_CONTRACT). Write: only `interview-prep/mock-*.md` on explicit Save. No parent files outside `interview-prep/` are touched.

## Security

- `sanitizeJobDescription` on any supplied JD; `sanitizePathName` + `mock-…​.md` gate on session names (traversal-safe); `normalizeHistory` bounds history (40 turns × 6000 chars); `llmRateLimit` on `/turn`; CSP-safe view (`UI.md()` XSS boundary, readonly textarea for the manual prompt).

## Tests

`tests/interview-routes.test.mjs` — `normalizeHistory`, `buildInterviewPrompt` (opening vs answered), manual-fallback grounding (story bank inlined, no fabricated answer), role/JD requirement, save→list→open→delete round-trip, traversal 400.

## Out of scope

Live audio/speech, scoring analytics across sessions, and auto-generating the story bank (the user maintains `story-bank.md`).
