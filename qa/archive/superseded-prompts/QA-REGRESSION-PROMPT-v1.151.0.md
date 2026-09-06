# QA REGRESSION PROMPT — career-ops-ui **v1.151.0** (Hermes LLM provider — Phase 5)

The final roadmap item. The Phase 5 scoping spike confirmed Hermes's `hermes gateway` is an **OpenAI-compatible API Server**, so Hermes is wired as the 7th LLM provider (Shape A) — mirroring Qwen/GitHub Models. Security-sensitive (LLM dispatch); no parent-sync. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.151.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2390, exit 0 (capture $? directly, never | grep)
node --test tests/hermes-provider.test.mjs tests/provider-selector.test.mjs tests/env-config.test.mjs tests/hermes-docs.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.151.0
node tools/i18n-audit.mjs                     # dict clean; snapshot 1214 (6 new config.hermes* keys ×17)
```

## §1 — What changed (server LLM dispatch + config UI + i18n + docs)

- **`server/lib/openai.mjs`** — `runHermes` (on the shared `runOpenAICompatible`) + `hasHermesKey` + `hermesChatUrl` (normalizes a `…/v1` base or a full URL). Bearer auth, timeout, `cleanLlmMarkdown`.
- **`server/lib/env-config.mjs`** — `HERMES_API_KEY`/`HERMES_BASE_URL`/`HERMES_MODEL` in KNOWN_KEYS + KEY_GROUPS; `hermes` in LLM_PROVIDERS + the auto `providerOrder` tail + explicit pin; `HERMES_API_KEY` in SECRET_KEYS.
- **`server/lib/llm-dispatch.mjs` + `server/lib/routes/llm.mjs`** — the Hermes gate + tail branch in **both** cascades; `providerAvailable` includes it.
- **`server/lib/routes/health.mjs`** — `/api/status/providers` lists `hermes` + its model key.
- **`server/lib/llm-pricing.mjs`** — a `hermes` row ($0 — it's a local gateway; real cost is the underlying provider's).
- **`#/config`** — three Hermes fields (key/base-url/model) with 6 new i18n keys × **17 locales** (snapshot 1208 → 1214).
- **Docs** — HERMES.md, help §30 (× 17), README teaser (× 14), the `hermes-bridge` skill, and the roadmap all move planned → **wired**.

## §2 — Manual pass

1. **`#/config` → API keys** — three new fields: **HERMES_API_KEY** (masked), **HERMES_BASE_URL** (shows the `http://127.0.0.1:8642/v1` default hint), **HERMES_MODEL** (`hermes-agent`). Localized labels/hints in a non-EN locale.
2. **Provider selection** — with only `HERMES_API_KEY` set (and `hermes gateway` running), `/api/status/providers` returns `activeProvider: "hermes"`. Setting `LLM_PROVIDER=hermes` pins it.
3. **Live eval** (needs a running Hermes gateway) — a ⚡ Run-live action executes through Hermes; without a gateway you get a clear `Hermes API: …` error, not a crash.
4. **Order** — with Anthropic (or another) also set, the auto order still prefers the earlier provider; Hermes is **last**.
5. **No console errors.**

## §3 — Invariants (security-sensitive)

- **The Hermes fetch is a CONFIGURED provider endpoint** (like OpenRouter/Qwen), reached via `runOpenAICompatible` — it does **not** pass through the `isValidJobUrl`/`safeGet` SSRF guard, which is for *scanned job postings* only. No new SSRF surface, no CSP change, no sanitizer change.
- **`HERMES_API_KEY` is a `SECRET_KEY`** — never echoed by the config read path.
- **No parent write** — provider config writes only to the `.env` via the existing config route.
- **CHANGELOG parity** — 17 locales at `## [1.151.0]`; app dict snapshot 1214.

## §4 — Not in this release

- **Shape B** (a bespoke agent-runtime relay) — not needed; the API Server made Shape A sufficient.
- **Cloud-server deployment + Telegram bridge** — remain operator how-to in `HELP §30` / `HERMES.md`, not app features.

## §5 — Sign-off

Suite **2390** green · `hermes-provider` 5/5 + inverted `hermes-docs` canary + updated provider-surface tests · `#/config` shows 3 Hermes fields (localized ×17) · `/api/status/providers` selects `hermes` when keyed · Hermes last in auto order · configured-endpoint fetch (no SSRF-guard involvement) · `HERMES_API_KEY` secret · i18n snapshot 1214 · CHANGELOG parity ×17. **Closes roadmap Phase 5 (Shape A).**
