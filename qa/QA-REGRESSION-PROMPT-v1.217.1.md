# QA REGRESSION PROMPT — career-ops-ui **v1.217.1** (test hardening)

**Test-only patch. No behavior change.** Adds a parametrized `run<Provider>` endpoint/default-model/Bearer assertion for the remaining OpenAI-compatible wrappers so every provider has a direct endpoint check.

- **Under test:** `package.json` **1.217.1**. Sources **82** (unchanged). Providers **18** (unchanged). Help **32 H2 / 121 H3** ×17 (untouched).

## §0 — Gates

```bash
npm test                                                   # 2756, exit 0
node --test tests/openai.test.mjs                          # incl. the new parametrized wrapper test
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.217.1
```

## §1 — What changed

- `tests/openai.test.mjs` — one parametrized test asserting endpoint, default model, and Bearer auth for **Kimi** (`api.moonshot.ai/v1`), **MiniMax** (`api.minimax.io/v1`), **Mistral** (`api.mistral.ai/v1`), and **Fireworks** (`api.fireworks.ai/inference/v1`). Previously these four wrappers had only structural coverage (provider-selector / provider-logo); now each has a direct endpoint check like DeepSeek/Grok/Together/Ark.
- Docs: version bump + test-count badge/banner ×17, CHANGELOG ×17, CONVENTIONS/PROJECT-CONTEXT.

## §2 — Invariants

- No `server/` or `public/` code change — this only adds a test. All security invariants (CSP/SSRF/sanitizers, parent read-only) untouched.

## §3 — Sign-off

Suite **2756** green · changelog parity ×17 at v1.217.1 · README banner+badges ×17 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed. No app-code change → local + resumecraft need no restart (Pages picks up the new facts/version).
