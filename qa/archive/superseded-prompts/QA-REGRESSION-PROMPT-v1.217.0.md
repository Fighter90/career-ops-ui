# QA REGRESSION PROMPT — career-ops-ui **v1.217.0** (Ark pair — 18 LLM providers)

**Feature release.** Adds **BytePlus Ark** + **Volcengine Ark** (ByteDance Doubao) as OpenAI-compatible ⚡ live-eval providers — the roster is now **18**. No new dependency, no CSP/SSRF relaxation, parent read-only contract intact.

- **Under test:** `package.json` **1.217.0**. Sources **82** (unchanged). Help **32 H2 / 121 H3** ×17. Providers **16 → 18**.

## §0 — Gates

```bash
npm test                                                   # 2755, exit 0
node --test tests/provider-selector.test.mjs tests/env-config.test.mjs tests/live-provider-gating.test.mjs tests/openai.test.mjs tests/provider-logo.test.mjs
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.217.0
```

## §1 — What changed

- **Server:** `openai.mjs` adds `runArk`/`hasArkKey` (BytePlus, `ARK_API_KEY`, base `https://ark.ap-southeast.bytepluses.com/api/v3`) + `runArkCn`/`hasArkCnKey` (Volcengine, `ARK_CN_API_KEY`, base `https://ark.cn-beijing.volces.com/api/v3`), each an ~8-line `runOpenAICompatible()` wrapper with a `compatChatUrl` region override (`ARK_BASE_URL` / `ARK_CN_BASE_URL`). `env-config.mjs` `AUTO_ORDER` / `LLM_PROVIDERS` / `KNOWN_KEYS` / `SECRET_KEYS` → 18. Map-driven gate/tail (`HAS_KEY` / `TAIL_RUN`) in `llm-dispatch.mjs` + `routes/llm.mjs` pick them up. `routes/health.mjs` + `llm-pricing.mjs` list `ark`/`arkcn`.
- **Client:** `provider-logo.js` MARKS + KEY_SLUG (`ARK` tiles), `provider-status.js` LABELS ("BytePlus Ark" / "Volcengine Ark"), `config/field-specs.js` (Doubao model lists, `LLM_PROVIDER` options, key/model/base-URL descriptors).
- **i18n/docs:** `config.llmProviderHint` auto-order + help/README arrow-list extended to 18 ×17 (snapshot regenerated); `facts.json` providers recount from `AUTO_ORDER` (18).

## §2 — Manual browser pass

1. `#/config` → **API keys & runtime**: BytePlus Ark and Volcengine Ark show key/model/base-URL fields, each with an **ARK** monogram; `LLM_PROVIDER` dropdown lists 19 options (auto + 18).
2. Set `ARK_API_KEY` → `#/evaluate` ⚡ Run live routes through it (result header names `ark`). Endpoint smoke: `runArk` posts to `…/api/v3/chat/completions`, `runArkCn` to the Volcengine host.
3. `#/health`: `ARK_API_KEY` + `ARK_CN_API_KEY` rows present (18 provider rows total). `GET /api/status/providers` lists `ark`/`arkcn` when configured.

## §3 — Invariants / security

- Ark base URLs are **trusted config** reaching fetch through `runOpenAICompatible()` with the same **http(s) scheme guard** (`compatChatUrl`) as the rest of the roster — **not** `isValidJobUrl`, and it is not weakened. Model ids may be a Doubao name or an `ep-…` endpoint id. Keys never logged; `*_MODEL`/`*_BASE_URL` are not secret. CSP unchanged. Parent read-only contract intact.

## §4 — Not changed / next

- **Design note:** the plan anticipated Ark needing the OpenAI **Responses API**; verified that Ark's OpenAI-compatible surface is **Chat Completions**, so both ride the existing core (no `runOpenAIResponses()` needed).
- Parent `career-ops` provider documentation (base URLs + convenience scripts) ships as a **separate PR** to `Fighter90/career-ops`.

## §5 — Sign-off

Suite **2755** green · provider roster **18** (status/health/pricing/field-specs/provider-status/provider-logo in lockstep) · help **32 H2 / 121 H3** ×17 · changelog parity ×17 at v1.217.0 · README banner+badges ×17 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed · i18n snapshot regenerated. Deploy: Pages (help/facts changed), local + resumecraft restart.
