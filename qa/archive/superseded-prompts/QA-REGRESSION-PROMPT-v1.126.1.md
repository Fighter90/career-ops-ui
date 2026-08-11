# QA Regression Prompt — v1.126.1 (CLI-roster drift patch)

> Patch release. Fixes two CLI-roster drift spots the v1.126.0 sweep's
> slash/middot patterns didn't cover (user-reported FIND-1 / FIND-2).
> Baseline: v1.126.0 (all green, 1969).

## What changed

1. **FIND-1 — `#/config` API-keys tab intro.** The i18n key
   `config.providerModelNote` (×17 locale dicts) listed only 7 CLIs
   (Claude Code · Codex · Gemini · OpenCode · Qwen · Copilot · Kimi).
   **Antigravity** and **Grok Build** are now inserted after OpenCode.
   The i18n snapshot (`tests/fixtures/i18n-dict.snapshot.json`) was
   regenerated (17 values changed).
2. **FIND-2 — help comparison-table row.** A second table row read
   `Inside Claude Code / Codex / Cursor / Gemini CLI` in the help guide
   (×17) and the CI-built site help — the pre-v1.28 stale set with
   **Cursor**. Now the full `Claude Code / Codex / OpenCode /
   Antigravity CLI / Grok Build CLI / Qwen Code / Kimi / GitHub Copilot
   CLI (Gemini CLI legacy)` roster. (The v1.126.0 sweep only matched the
   other slash row `Claude Code / Gemini CLI / Codex / …`.)

No code/behavior change — UI text + docs only.

## Sign-off checklist

- [ ] `npm test` — **1969** green (i18n snapshot test passes with the
      regenerated fixture; canonical-docs gate green).
- [ ] `node --test tests/i18n-locale-files.test.mjs` — snapshot deepEqual OK.
- [ ] Manual: `#/config` → **API keys** tab intro paragraph names
      Antigravity + Grok Build (check EN + one RTL locale, e.g. ar).
- [ ] `grep -l "Cursor / Gemini CLI" docs/help/*.md` — **0 files**.
- [ ] `node scripts/check-changelog-parity.mjs` — all 16 locales at 1.126.1.
- [ ] Help H2/H3 gate — 29 H2 / 105 H3 unchanged.
- [ ] `/api/health` → `version 1.126.1`, `parentVersion 1.22.0`.
