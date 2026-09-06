# QA REGRESSION PROMPT — career-ops-ui **v1.152.0** (Hermes provider completion + docs actualization)

A detailed code review of the v1.151.0 Hermes integration surfaced two real gaps and four completeness items; all are fixed here, and the whole app's LLM-provider roster is normalized to the full **seven** (Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models → Hermes) across every doc surface and all 17 locales. No new route; no SSRF/CSP/sanitizer change; no parent-sync. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.152.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2392, exit 0 (capture $? directly, never | grep)
node --test tests/provider-selector.test.mjs tests/env-config.test.mjs tests/hermes-provider.test.mjs tests/health-doctor-unify.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.152.0
node tools/i18n-audit.mjs                    # dict clean; snapshot 1214
```

## §1 — What changed (review fixes + roster actualization)

- **`public/js/views/config.js`** — the `LLM_PROVIDER` dropdown gains **`hermes`** as the 8th option (`auto` + 7 providers); it was previously unforceable from the UI even though the key field existed. The JS `hintFallback` names the full seven-provider order.
- **`server/lib/env-config.mjs`** — `isUsableKey(raw, minLen = 20)` gains a `minLen` param.
- **`server/lib/openai.mjs`** — `hasHermesKey` now calls `isUsableKey(key, 8)` (a self-hosted `API_SERVER_KEY` may be short — the Hermes docs' own `change-me-local-dev` is 19 chars); `hermesChatUrl` completes a **bare host** (`http://127.0.0.1:8642` → `…/v1/chat/completions`) instead of a `/v1`-less 404.
- **`server/lib/routes/llm.mjs`** — the manual-fallback copy ("execute via …") now names Hermes.
- **`server/lib/routes/health.mjs`** — carries a `HERMES_API_KEY` health/doctor row (was omitted in v1.151.0).
- **Docs** — the six-provider chain/force-list strings normalized to the full seven across README ×17, help ×17, `config.llmProviderHint` ×17, and `docs/sdd`; `CONVENTIONS.md` says "all 16 non-EN locales"; snapshot regenerated (1214).

## §2 — Manual pass

1. **`#/config` → LLM_PROVIDER** — the dropdown lists **8** values: `auto, claude, gemini, openai, qwen, openrouter, github, hermes`. Selecting `hermes` and saving pins it (verify `/api/status/providers` → `activeProvider: "hermes"` when the key is set).
2. **Short local key** — set `HERMES_API_KEY` to a short-but-real value (e.g. `change-me-local-dev`, 19 chars). `#/health` shows the `HERMES_API_KEY` row as **set**, and (with a running gateway) live eval routes through Hermes rather than falling silently to manual mode.
3. **Bare base URL** — set `HERMES_BASE_URL=http://127.0.0.1:8642` (no `/v1`). A live eval still hits `…/v1/chat/completions` (not a 404).
4. **`#/health` / `career-ops-ui doctor`** — both list all seven provider-key rows including `HERMES_API_KEY`.
5. **Provider-order hint** — the `LLM_PROVIDER` field hint (in a non-EN locale) names the full seven-provider order.
6. **No console errors.**

## §3 — Invariants (security-sensitive)

- **The Hermes fetch is a CONFIGURED provider endpoint** (like OpenRouter/Qwen) — it does **not** pass through the `isValidJobUrl`/`safeGet` SSRF guard (scanned job postings only). The relaxed 8-char key floor affects only the local-loopback gateway key; no new SSRF surface, no CSP change, no sanitizer change.
- **`HERMES_API_KEY` is a `SECRET_KEY`** — never echoed by the config read path.
- **No parent write** — provider config writes only to the `.env` via the existing config route.
- **CHANGELOG parity** — 17 locales at `## [1.152.0]`; app dict snapshot 1214.

## §4 — Not in this release

- **Cloud-server deployment + Telegram bridge** — remain operator how-to in `HELP §30` / `HERMES.md` (a dedicated end-to-end cloud-deployment guide is slated for v1.153.0).

## §5 — Sign-off

Suite **2392** green · new `isUsableKey` minLen guard + dropdown-vs-`LLM_PROVIDERS` parity guard · `#/config` dropdown offers `hermes` (8 options) · short self-hosted key accepted (≥8) · bare-host `HERMES_BASE_URL` completes to `/v1/chat/completions` · `#/health`/`doctor` list `HERMES_API_KEY` · provider roster = full seven across README ×17 / help ×17 / dict ×17 / docs-sdd · i18n snapshot 1214 · CHANGELOG parity ×17. **Completes the Hermes integration.**
