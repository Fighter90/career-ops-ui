# QA REGRESSION PROMPT — career-ops-ui **v1.157.0** (live evals on ANY provider — bug fix)

**User-reported bug.** A user with only `OPENROUTER_API_KEY` set was forced into manual mode ("set ANTHROPIC_API_KEY or GEMINI_API_KEY…"). Two causes: a keyless `LLM_PROVIDER` pin dead-ended server-side, and the client gated on only Anthropic/Gemini. Security-sensitive (LLM dispatch); no parent-sync. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.157.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2401, exit 0 (capture $? directly, never | grep)
node --test tests/live-provider-gating.test.mjs tests/env-config.test.mjs tests/onboarding-key-banner.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.157.0
```

## §1 — Root cause + fix

- `init` with Claude Code writes `LLM_PROVIDER=claude`. If the user later adds only, say, `OPENROUTER_API_KEY`, the forced-claude routing found no Anthropic key → **manual**, despite OpenRouter being configured + supported.
- **Fix (server):** a forced provider whose key isn't set falls back to the auto order among the CONFIGURED providers — in `env-config.mjs::selectActiveProvider` **and both** dispatch cascades (`routes/llm.mjs::_provGate`, `llm-dispatch.mjs::gate`, each with a `_hasKeyFor` guard). A pin WITH its key stays forced.
- **Fix (client):** `#/deep` + mode-page views use the new `window.ProviderStatus` (`provider-status.js` → `/api/status/providers`, all 7) instead of a stale `/api/health` Anthropic/Gemini probe. `#/dashboard` shows one **Live evals · ready/manual** badge.
- **Copy:** `deep.tipManual` / `deep.needKey` / `eval.manualMode` (× 17) point at "any provider key … in App settings"; `config.llmProviderHint` (× 17) explains the pin fallback.

## §2 — Manual pass (reproduce the user's setup)

1. **Set `LLM_PROVIDER=claude` + only an OpenRouter key** (no Anthropic). `GET /api/status/providers` → `activeProvider: "openrouter"` (was `null` before). `#/health` shows the OpenRouter row set.
2. **`#/deep`** — the **⚡ Run live** button appears (was hidden → "Copy prompt" only). A live run executes via OpenRouter, not a manual prompt.
3. **Mode pages** (`#/contacto`, `#/interview-prep`, `#/project`, `#/training`) — **▶ Run live** is the primary button.
4. **`#/evaluate`** — evaluating a JD returns a live result (not the "Manual mode (no provider key set)" card).
5. **`#/dashboard`** — the system card shows **Live evals · ready** (green), not "Anthropic unset / Gemini unset".
6. **No-key case** — with NO provider key at all, everything correctly falls back to manual, and the reworded hint names all seven providers.

## §3 — Invariants

- **No security change** — provider endpoints stay trusted config; no route, CSP, or SSRF change. The fallback only ever picks among keys the operator already configured. `HERMES_API_KEY` etc. still `SECRET_KEYS`.
- **A pin that has its key stays forced** — `LLM_PROVIDER=openai` + an OpenAI key → still exactly OpenAI.
- **CHANGELOG parity** — 17 locales at `## [1.157.0]`; snapshot 1217.

## §4 — Sign-off

Suite **2401** green · `/api/status/providers` picks a configured provider despite a keyless pin · `#/deep`/mode-pages/`#/evaluate` run live on OpenRouter · `#/dashboard` "Live evals" badge honest · a keyed pin stays forced · no-key → manual with all-provider copy · CHANGELOG parity ×17. **Closes the "OpenRouter set but forced manual" report.**
