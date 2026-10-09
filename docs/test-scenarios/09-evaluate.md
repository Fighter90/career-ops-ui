# 09 — Evaluate

## Goal

User pastes a JD, optionally toggles **Manual mode**, clicks **Evaluate**. With an LLM key set, the server calls Anthropic (preferred) or Gemini and returns a structured A–G evaluation. In manual mode, the server returns the assembled prompt without any LLM call so the user can paste it elsewhere.

## Inputs

`POST /api/evaluate { jd: "<text>", save?: bool, mode?: "manual", lang?, locale? }`.

## Expected outputs

| Path | Response |
|---|---|
| `mode === "manual"` (v1.10.1 fix for F-009) | `{ mode: "manual", prompt, message, saved? }` — even when keys are set |
| Anthropic key set | `{ mode: "anthropic", prompt, markdown, usage, saved? }` |
| Gemini key set, no Anthropic | `{ mode: "gemini", ... }` |
| No keys | Falls back to manual response |

- `save: true` writes the JD to `jds/jd-<DATE>-<TS>.txt`.
- `evaluate` event recorded in `/api/activity` on success.
- The prompt embeds a `# Output language` directive when `lang !== 'en'` (PR-2 / F-012).

## Negative cases

| Case | Expected |
|---|---|
| JD shorter than 50 chars after sanitization | `400 { error: "JD text required (min 50 chars after sanitization)" }` |
| Assembled prompt > 256 KB soft cap | `413 { error: "prompt too large", details }` |
| Anthropic call fails | `502 { mode: "anthropic", prompt, error, saved? }` |

## Test coverage

- `tests/anthropic.test.mjs`, `tests/gemini-smoke.test.mjs` — provider routes.
- `tests/critical-fixes.test.mjs`:
  - `POST /api/evaluate { mode:'manual', lang:'ru' }` returns under 5s and has `Respond in Russian` in the prompt — proves the F-009 short-circuit works even with `ANTHROPIC_API_KEY` set.
  - `Accept-Language: pt-BR` propagates without `body.lang`.
