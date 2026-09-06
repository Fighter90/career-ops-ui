# QA REGRESSION PROMPT — career-ops-ui **v1.224.0** (real brand logos on the provider tiles)

**Client-only, cosmetic.** The LLM provider tiles now render the real brand logo for the 11 providers that publish an open-source icon; the other 7 keep the brand-colored monogram. No route/behaviour change; the `ProviderLogo.el(slug)` API is unchanged.

- **Under test:** `package.json` **1.224.0**. Sources **83** (unchanged). One file changed (`provider-logo.js`) + one test assertion.

## §0 — Gates

```bash
npm test                                                   # 2784 (±2 flaky live scan-stream), exit 0
node --test tests/provider-logo.test.mjs                   # 7 (incl. the real-logo/monogram split + CSP-safety)
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.224.0
```

## §1 — What changed

- **`public/js/lib/provider-logo.js`** gains a `LOGOS` map: real single-path SVG glyphs (from [simple-icons](https://simpleicons.org), CC0) for **anthropic (+claude), gemini, openai, qwen, openrouter, github, deepseek, kimi, minimax, mistral, ollama**. `el(slug)` renders the white logo path on the brand-colored rounded tile (`translate(7 7) scale(0.75)` → the 24×24 glyph centered at ~18px) via `path.setAttribute('d', LOGOS[slug])`. The 7 providers without a published icon (**hermes, zai/GLM, grok, together, fireworks, ark, arkcn**) fall through to the monogram `<text>` exactly as before.
- **CSP-safe by construction, unchanged:** the path `d` is a static constant — no remote asset, no `innerHTML`. The CSP-safety test still passes (it strips comments so the "no innerHTML" prose and the simpleicons.org attribution URL don't false-positive).
- All 5 consumer views (`config.js`, `usage.js`, `dashboard.js`, `evaluate.js`, `app.js`) are untouched — same `ProviderLogo.el(slug)` call sites.

## §2 — Manual browser pass

Open `#/config` → **API keys**: the Anthropic / Gemini / OpenAI / Qwen / OpenRouter / GitHub / DeepSeek / Kimi / MiniMax / Mistral / Ollama fields show the **real brand logo** (white glyph on the brand color). Hermes / GLM / Grok / Together / Fireworks / BytePlus Ark / Volcengine Ark show the monogram. Check the same tiles on `#/usage`, the dashboard provider chip, the Settings "Active" summary, and a live ⚡ eval result — all render the tile via the shared `ProviderLogo.el`.

## §3 — Contract / invariants

- No route/CSP/server change; no i18n key change. `provider-logo.js` is larger (inlined logo paths) but self-contained.
- Logos are nominative brand identifiers (simple-icons, CC0) — no remote fetch.

## §4 — Not in scope

- The 7 monogram providers: they publish no open-source brand icon, so a real logo would have to be invented (inaccurate) — monogram is deliberate.
- The cvstart.org landing shows a provider **count**, not per-provider logos (no logo showcase exists there); prose docs/help/README/wiki list providers by name.

## §5 — Sign-off

Suite **2784** green · real logos render for 11 providers, monogram for 7, CSP-safe path verified at runtime (`svg>rect>g>path` vs `svg>rect>text`) · parity ×17 · README banner+badges ×17 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed. Deploy: Pages (facts/version), local + resumecraft restart.
