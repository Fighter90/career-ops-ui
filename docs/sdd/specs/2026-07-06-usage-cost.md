# LLM usage & cost page (v1.105.0)

**Status:** Shipped · **Version:** 1.105.0 · **Date:** 2026-07-06

## Problem

Parent-web parity: show token usage + USD per provider over time windows. The
routes already returned per-call `usage`, but nothing persisted it and there was
no price table. The user chose: **persist to a log file** + a **bundled, editable
price table** showing "tokens + estimated USD".

## Solution

### Server

- **`server/lib/llm-usage.mjs`** — `recordUsage(provider, usage)` normalizes the
  three provider usage shapes (Anthropic `input/output_tokens`, OpenAI
  `prompt/completion_tokens`, Gemini `prompt/candidatesTokenCount`) and appends
  `{ts, provider, in, out}` to `data/llm-usage.jsonl`. **Best-effort** — a failed
  write never breaks the response; zero-token calls aren't recorded. `readUsage`
  (bounded) + `aggregate` roll up per **24h / 7d / 30d / all** window × provider.
- **`server/lib/llm-pricing.mjs`** — an editable per-provider `$/1M`-token table;
  `priceFor(provider, inTok, outTok)` → estimated USD. Documented as approximate.
- **`server/lib/routes/usage.mjs`** (30th route module) — `GET /api/usage`,
  read-only, returns the rollups + the price table + total call count.
- **Recording hooks** at the dispatch chokepoints so all live calls are captured:
  `runActiveProvider` (3 branches — covers docs-assistant, market, career-plan,
  orientation, two-pager, cv-studio, networking, interview) and `routes/llm.mjs`
  (evaluate + deep, 5 sites — covers the eval/apply/deep flow). The write is a
  side effect of a user-initiated live generation → fits the "writes only on
  explicit user action" contract, like the tracker.

### Client

- **`public/js/views/usage.js`** (`#/usage`, nav next to Health) — window tabs +
  a per-provider table (calls / input / output tokens / est. cost) with a total
  row and an "estimate, not billed; edit the price table" note. Empty state when
  nothing is recorded yet.

## Invariants held

- **Local only.** The usage log stays in the parent user layer; nothing is sent
  anywhere. USD is an estimate, never billed.
- **Best-effort telemetry.** Recording never breaks an LLM response.
- **No new user-data surface / read-only route / CSP-safe view.**

## Tests

`tests/usage-routes.test.mjs` (5): `normalizeUsage` across all three shapes,
`priceFor`, the record→read round-trip (skips zero-token; truncates the log first
to honor PATHS-resolves-once), `aggregate` window/provider rollups with estimated
USD, and the `GET /api/usage` shape. 17 new i18n keys ×16 (`usage.*` +
`nav.usage`). Help §6 extended in place (no new H2/H3).
