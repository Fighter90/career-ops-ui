# 10 — Deep research

## Goal

User enters a company + optional role on `#/deep`, clicks **Generate prompt** (manual) or **Run live** (LLM). Server returns / executes the deep-research mode template. On a successful live run, the markdown is persisted to `interview-prep/<company>-<role>.md`.

## Inputs

`POST /api/deep { company, role?, run?: bool, lang? }`.

## Expected outputs

| Path | Response |
|---|---|
| Manual (default) | `{ mode: "manual", prompt, message }` |
| `run: true` + Anthropic | `{ mode: "anthropic", prompt, markdown, saved: "<slug>.md", code: 0 }` |
| `run: true` + Gemini only | `{ mode: "gemini", ... }` |
| Locale directive when `lang !== 'en'` (PR-2) | Prompt starts with `Respond in <Language>` |

Activity log: `deep.research` event on success.

## Negative cases

| Case | Expected |
|---|---|
| Missing `company` | `400 { error: "company required" }` |
| Prompt > 256 KB | `413` |
| Anthropic error | `502 { mode: "anthropic", prompt, error }` |

## Test coverage

- `tests/anthropic.test.mjs`, `tests/api.test.mjs` (deep endpoint shape).
- `tests/critical-fixes.test.mjs` — `buildDeepPrompt` embeds locale directive.
