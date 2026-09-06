# QA REGRESSION PROMPT — career-ops-ui **v1.160.0** (FIX-2: honest provider copy)

**Audit finding (HIGH, `FIX-PROMPT-post-v1.158.0.md` SHIP 2).** Two screens told the user the web-ui scores with Anthropic/Gemini only, while the app was demonstrably running live evals on OpenRouter and the field help listed seven providers — self-contradicted on the same screen. Copy-only fix; no parent-sync. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.160.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2413, exit 0 (capture $? directly, never | grep)
node --test tests/provider-copy-honesty.test.mjs
node tools/i18n-audit.mjs                    # no hard failures
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.160.0
```

## §1 — Root cause + fix

- `config.providerModelNote` (×17) claimed "uses your Anthropic or Gemini API key" and "the OpenAI key … not used by the web UI itself" — both false since the OpenRouter/7-provider cascade (v1.157.0). Now: the ⚡ live eval runs headless on **any one of your seven provider keys** (Anthropic · Gemini · OpenAI · Qwen · OpenRouter · GitHub Models · Hermes), auto-ordered with fallback.
- `dash.quick.evaluateSub` (×17) + its `dashboard.js` fallback: "Anthropic-first scoring" → vendor-neutral "0–5 fit scoring".
- `config.js` `Keys: N / 5` → `N / 7` — the denominator matches the seven `SECRET_KEYS` provider slots enumerated by `/api/status/providers`.

## §2 — Manual pass (reproduce the user's setup)

1. **`LLM_PROVIDER=claude` + only `OPENROUTER_API_KEY`** — `#/config` intro names all seven providers and makes NO Anthropic/Gemini-exclusive claim; there is no "not used by the web UI" sentence. Header chip `Active: OpenRouter` and the intro now agree.
2. **`#/dashboard`** — the Evaluate quick-action subtitle reads "0–5 fit scoring" (localized), NOT "Anthropic-first scoring".
3. **`Keys: N / 7`** — with one key set it reads `Keys: 1 / 7`.
4. **Locale spot-check** — repeat in `ru` / `ja` / `ar`: the provider names (Latin) appear, no exclusivity claim, subtitle vendor-neutral.

## §3 — Invariants

- **Copy-only** — no route, CSP, SSRF, or parent-write change. Two existing i18n keys reworded ×17; no new keys (snapshot **1217** unchanged, parity ×17).
- **No vendor literal** in the Evaluate subtitle in any locale (`/anthropic|openai|gemini|qwen|openrouter|hermes/i` must not match).

## §4 — Sign-off

Suite **2413** green · `#/config` intro names 7 providers with no Anthropic/Gemini exclusivity in every locale · Evaluate subtitle vendor-neutral ×17 · `Keys: N / 7` · i18n-audit clean · parity ×17. **Closes SHIP 2 (FIX-2, HIGH).**
