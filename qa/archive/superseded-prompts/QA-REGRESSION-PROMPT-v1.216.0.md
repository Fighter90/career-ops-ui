# QA REGRESSION PROMPT — career-ops-ui **v1.216.0** (nine more LLM providers + provider monograms)

**Feature release.** Adds nine OpenAI-compatible LLM providers to the ⚡ live-eval roster (16 total) and a CSP-safe brand-monogram tile for every provider, shown in Settings and on the Usage page. No new dependency, no CSP/SSRF relaxation, parent read-only contract intact.

- **Under test:** `package.json` **1.216.0**. Sources **82** (unchanged). Help **32 H2 / 121 H3** ×17. Providers **7 → 16**.

## §0 — Gates

```bash
npm test                                                   # 2752, exit 0
node --test tests/provider-selector.test.mjs tests/env-config.test.mjs tests/live-provider-gating.test.mjs tests/openai.test.mjs tests/provider-logo.test.mjs tests/hermes-docs.test.mjs tests/openrouter-model-selector.test.mjs
node --test tests/help-ui.test.mjs tests/canonical-docs-coverage.test.mjs tests/help-ru-config-section.test.mjs tests/locales-de-it-tr.test.mjs   # H2 32 / H3 121 ×17
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.216.0
```

## §1 — What changed

- **Server:** `server/lib/openai.mjs` adds `run<Provider>()` + `has<Provider>Key()` for deepseek, zai (GLM), kimi (Moonshot), minimax, mistral, grok (xAI), together, fireworks, ollama — each an ~8-line wrapper over the shared `runOpenAICompatible()`; plus `compatChatUrl(base, fallback)` (a scheme-guarded base-URL resolver, generalized from `hermesChatUrl`) for the GLM/Kimi/Ollama base overrides. `env-config.mjs` grows `KNOWN_KEYS` / `SECRET_KEYS` / `AUTO_ORDER` (exported) / `LLM_PROVIDERS` / `providerOrder` / `selectActiveProvider`. `llm-dispatch.mjs` + `routes/llm.mjs` gate/tail became map-driven (`HAS_KEY` / `TAIL_RUN`) so a provider is added in one place. `routes/health.mjs` (`/api/status/providers` + `/api/health` rows) and `llm-pricing.mjs` list all 16.
- **Client:** new `public/js/lib/provider-logo.js` (`window.ProviderLogo`) — CSP-safe inline-SVG monogram tiles (createElementNS/textContent, no innerHTML, no remote assets), loaded after provider-status.js; rendered in `config.js` field labels and `usage.js` rows. `provider-status.js` LABELS + `config/field-specs.js` (model lists, `LLM_PROVIDER` options, key/model/base-URL field descriptors) cover all 16. `.provider-logo` CSS in `overlays.css`.
- **i18n:** the language-neutral auto-order list inside `config.llmProviderHint` extended to 16 in all 17 locale dicts (snapshot regenerated).
- **Docs:** help §2 provider prose ×17 (auto-order list; EN adds a per-provider setup bullet — no new H2/H3, gates unchanged); README ×17 (auto-order list + banner/badges); `facts.json` `providers` recount sourced from `AUTO_ORDER` (16).

## §2 — Manual browser pass

1. `#/config` → **API keys & runtime**: each of the 16 providers shows its key/model fields **with a brand monogram tile** beside the field label; GLM/Kimi show a China base-URL field; Ollama shows `OLLAMA_BASE_URL` + model (no key). `LLM_PROVIDER` dropdown lists all 17 options (auto + 16).
2. Set one new provider's key (e.g. `DEEPSEEK_API_KEY`) → `#/evaluate` ⚡ Run live routes through it; the result header names the provider. With no key → manual-prompt fallback.
3. `#/usage`: per-provider rows show the monogram + friendly label.
4. `#/health`: 16 optional provider rows (`DEEPSEEK_API_KEY` … `OLLAMA_BASE_URL`).
5. `GET /api/status/providers` lists configured new slugs; `activeProvider` honors the auto order + `LLM_PROVIDER` pin.

## §3 — Invariants / security

- Provider base URLs are **trusted config** reaching `fetch` through `runOpenAICompatible()` with an **http(s) scheme guard** (`compatChatUrl`) — Ollama's loopback is allowed; the SSRF job-URL validator (`isValidJobUrl`) is **not** used and **not** weakened. Keys never logged; `*_MODEL`/`*_BASE_URL` are not secret. CSP unchanged (monograms are inline SVG, no external assets). Parent read-only contract intact — no new writes.

## §4 — Not changed / next

- **Ark pair deferred to v1.217.0** — BytePlus Ark + Volcengine Ark Agent Plan use the OpenAI **Responses API**, not Chat Completions; they need a `runOpenAIResponses()` sibling and ship in the next batch.
- Parent `career-ops` provider documentation ships as a separate PR (its generic `openai-eval.mjs` already reaches these vendors via `OPENAI_BASE_URL`).

## §5 — Sign-off

Suite **2752** green · provider roster **16** (`/api/status/providers`, `/api/health`, pricing, field-specs, provider-status, provider-logo all in lockstep) · help **32 H2 / 121 H3** ×17 · changelog parity ×17 at v1.216.0 · README banner+badges ×17 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed · i18n snapshot regenerated. Deploy: Pages (site + help + facts changed), local + resumecraft server restart to serve the new roster.
