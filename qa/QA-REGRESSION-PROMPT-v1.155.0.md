# QA REGRESSION PROMPT — career-ops-ui **v1.155.0** (P-15 refactor: split `config.js`)

Pure internal refactor: `public/js/views/config.js` (1030 lines, over the 800-line hard limit) split into two behavior-preserving modules → **783**. No user-facing change. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.155.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2396, exit 0 (capture $? directly, never | grep)
node --check public/js/views/config/field-specs.js && node --check public/js/views/config/tab-controller.js && node --check public/js/views/config.js
node --test tests/config-tabs-aria.test.mjs tests/provider-selector.test.mjs tests/openrouter-model-selector.test.mjs tests/openai-model-selector.test.mjs tests/gemini-default-model.test.mjs tests/config-validation-detail.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.155.0
```

## §1 — What changed (structure only)

- **`public/js/views/config/field-specs.js`** (new) — `window.ConfigFieldSpecs = { FIELDS }`: the curated per-provider model lists + the read-only `FIELDS` descriptor table (API keys / runtime / regional). Loaded before `config.js`.
- **`public/js/views/config/tab-controller.js`** (new) — `window.createConfigTabController(c, panelHost)` → `{ tabBtn, activate }`: the ARIA tablist + keyboard-nav + panel swap, extracted verbatim.
- **`public/js/views/config.js`** — references both; render logic (fieldRow, profile/section editors, save flow, appearance) unchanged. Both new scripts wired into `index.html` before `config.js`.
- Six source-reading tests repointed to the new files (assertions otherwise identical).

## §2 — Manual pass (verify NOTHING changed for the user)

1. **`#/config` loads** — the four tabs (API keys & runtime / Profile / Modes / AI CLI tools) render; clicking + arrow-key nav switches tabs (ARIA `aria-selected`/roving tabindex intact).
2. **API-keys tab** — every provider field renders with its model dropdown (Anthropic/Gemini/OpenAI/Qwen/OpenRouter/GitHub/Hermes), including the LLM_PROVIDER selector (8 options) and PORT/HOST defaults (4317 / 127.0.0.1).
3. **Save** — editing a value + Save writes through; secrets stay masked. Deep-link `#/config?tab=modes` opens the Modes tab.
4. **No console errors** (confirm `window.ConfigFieldSpecs` + `window.createConfigTabController` are defined before the view runs).

## §3 — Invariants

- **Zero behavior change** — no route, no server, no i18n key, no CSS. The moved data/markup is byte-identical (de-indented). Suite count unchanged **2396** (tests repointed, not added).
- **`scan.js` unchanged** — intentionally not force-split (see CHANGELOG rationale).

## §4 — Sign-off

Suite **2396** green · `#/config` renders + tabs switch + save works (browser) · both new modules define their globals before `config.js` · config.js now 783 lines (< 800) · CHANGELOG parity ×17. **Pure refactor; no functional surface touched.**
