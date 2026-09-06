# QA REGRESSION PROMPT — career-ops-ui **v1.218.0** (provider tiles + correct labels everywhere)

**Client-only feature + bug-fix release.** Extends the brand monograms to the last three provider-display surfaces and fixes three stale ≤5-provider name maps that mislabeled the newer providers. No server change.

- **Under test:** `package.json` **1.218.0**. Sources **82** (unchanged). Providers **18** (unchanged). Help gates untouched.

## §0 — Gates

```bash
npm test                                                   # 2758, exit 0
node --test tests/provider-logo.test.mjs tests/qa-report-fixes.test.mjs tests/live-provider-gating.test.mjs
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.218.0
```

## §1 — What changed (client-only)

- **`views/dashboard.js`** — the "live evals" chip now renders the active provider's monogram (`ProviderLogo.el`) and resolves its name via `ProviderStatus.label` (was a 5-entry `NAME` map → raw slug for the newer 13).
- **`views/config.js`** — the API-keys "Active" summary gains the monogram + `ProviderStatus.label`; the key count "/ 7" → derived total (`ProviderStatus.LABELS` length, 18).
- **`views/evaluate.js`** — the ⚡ result badge gains the monogram + `ProviderStatus.label`. **Bug fixed:** it previously did `r.mode === 'anthropic' ? 'Anthropic' : 'Gemini'`, mislabeling every non-Anthropic provider (16 of 18) as "Gemini".
- **i18n** — `config.llmProviderHint`'s **slug** pin-list (`… / ollama`) gained `ark` / `arkcn` in all 17 locale dicts (the arrow list already had them); snapshot regenerated.

## §2 — Manual browser pass

1. With a **new** provider configured (e.g. `DEEPSEEK_API_KEY` or `XAI_API_KEY`): `#/dashboard` chip shows the **DeepSeek/Grok monogram + correct name** (not a raw slug); `#/config` "Active" summary shows the tile + name and "Keys: N / 18".
2. `#/evaluate` → ⚡ Run live via that provider: the result badge shows the **correct provider name + its monogram** (not "Gemini").
3. `#/config` `LLM_PROVIDER` hint lists `… / ollama / ark / arkcn` in every locale.

## §3 — Invariants

- CSP-safe: monograms are the same inline-SVG `ProviderLogo` tiles (createElementNS/textContent, no innerHTML, no remote assets). No server route or security-envelope change. All guards intact.

## §4 — Sign-off

Suite **2758** green · monograms on all provider surfaces (Settings fields · Usage rows · dashboard chip · Settings "Active" · eval result) · three stale-label bugs fixed · slug pin-list ×17 · changelog parity ×17 at v1.218.0 · README banner+badges ×17 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed · snapshot regenerated. Deploy: Pages (facts/version), local + resumecraft restart (client + i18n changed).
