# QA Regression Prompt — v1.126.0 (docs & CLI-roster resync with career-ops.org/docs)

> Minor release. Reconciles every doc surface against the live career-ops.org/docs
> (all 31 pages read) and teaches the AI-CLI-tools scan the two CLIs it was missing.
> Baseline: v1.125.4 (all green, 1969).

## What changed

1. **`cli-detect.mjs` roster → 8 first-class CLIs.** Added **Grok Build CLI**
   (`grok`) and **Kimi CLI** (`kimi`); Antigravity now probes its canonical
   `agy` binary first, falling back to `antigravity`. `GET /api/cli-detect`
   now returns **9 tools** (8 first-class + Gemini CLI). Still a pure read-only
   PATH scan — it NEVER executes a found binary (no `--version`, no spawn).
2. **Docs resync ×17.** The canonical AI-assistant roster was widened across
   help (intro + comparison table + provider-setup list + AI-CLI-tools tab)
   and README (intro + CLI→provider mapping) to the 8 first-class CLIs plus
   Gemini CLI (legacy wrapper transitioned into Antigravity), matching the
   parent's `docs/SUPPORTED_CLIS.md`.
3. **Gates updated.** `tests/cli-detect-routes.test.mjs` length assertions
   7→9; `tests/canonical-docs-coverage.test.mjs` CANON list widened to
   Claude Code, Gemini CLI, Codex, Qwen Code, OpenCode, GitHub Copilot CLI,
   Antigravity CLI, Grok Build CLI, Kimi. wiki `Features.md` line updated.

## Sign-off checklist

- [ ] `npm test` — **1969** green (no net delta; assertions widened in place).
- [ ] `node --test tests/cli-detect-routes.test.mjs` — detects 9 tools.
- [ ] `node --test tests/canonical-docs-coverage.test.mjs` — CANON present in
      all 17 help bundles + all 17 READMEs.
- [ ] Manual: `#/config` → **AI CLI tools** tab lists 9 entries incl. Grok
      Build CLI + Kimi CLI; installed ones resolve their path, others show
      "not found"; nothing is ever executed.
- [ ] Help H2/H3 gate — 29 H2 / 105 H3 in every bundle (unchanged).
- [ ] `node scripts/check-changelog-parity.mjs` — all 16 locales at 1.126.0.
- [ ] `/api/health` → `version 1.126.0`, `parentVersion 1.22.0`.
