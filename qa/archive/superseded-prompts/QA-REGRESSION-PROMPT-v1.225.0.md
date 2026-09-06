# QA REGRESSION PROMPT — career-ops-ui **v1.225.0** (provider-logo banner in README + help)

**Docs-only.** Adds a single self-contained `images/providers.svg` banner (the 18 LLM providers — real brand logos for 11, monogram for 7) to the top of the README ×17 and the in-app help ×17. No code or test change.

- **Under test:** `package.json` **1.225.0**. Sources **83** (unchanged). Test count unchanged **2784**.

## §0 — Gates

```bash
npm test                                                   # 2784 (±2 flaky live scan-stream), exit 0
node --test tests/canonical-docs-coverage.test.mjs tests/help-ui.test.mjs   # help parity intact (banner is a non-heading line)
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.225.0
```

## §1 — What changed

- **`images/providers.svg`** (new): a composed, self-contained SVG — 18 brand tiles on a white card, the **real brand logo** ([simple-icons](https://simpleicons.org), CC0) for anthropic/gemini/openai/qwen/openrouter/github/deepseek/kimi/minimax/mistral/ollama and a brand-colored monogram for hermes/zai/grok/together/fireworks/ark/arkcn, each with its name. Pure paths — no scripts, no remote refs (passes GitHub's SVG sanitizer).
- **README ×17**: a centered `<img src="images/providers.svg">` banner right after the 🆕 line.
- **In-app help ×17** (`docs/help/*.md`): the same banner as a raw `<p align="center"><img src="../../images/providers.svg">` after the H1. **GitHub renders it; the app's XSS-safe `UI.md()` renderer has no image support, so it is stripped in-app** — where the real logo tiles already appear (`provider-logo.js`, v1.224.0). Non-heading line → help H2/H3 parity unchanged.

## §2 — Manual pass

- On GitHub, the README and any `docs/help/<lang>.md` show the provider banner at the top.
- In the app (`#/help`), the banner does not appear (stripped) and nothing is broken — the real logos are on the provider tiles (`#/config`, `#/usage`, dashboard chip, ⚡ eval).
- cvstart.org landing: the `#providers` showcase (from v1.224.0 follow-up) shows the same logos.

## §3 — Contract / invariants

- No server/route/CSP/i18n-key change; no new dependency. Banner SVG is inline in the repo (no remote asset).
- The 18-provider roster is a web-ui feature; the coworker/OpenWorker docs are intentionally NOT given this banner (they use OpenWorker's own model, not this eval roster).

## §4 — Sign-off

Suite **2784** green · banner renders on GitHub (README ×17 + help ×17), stripped cleanly in-app · help parity intact · parity ×17 at v1.225.0 · README banner+badges ×17 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed. Deploy: Pages (facts/version), local + resumecraft restart.
