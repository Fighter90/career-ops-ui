# QA Regression Prompt — v1.125.2 (external-contributor pack: deep-502 fix + Gemini defaults)

> Patch release rolling up the first two external-contributor PRs (@Alien10140),
> reviewed + locally gated before merge (fork CI does not auto-run).
> Baseline: v1.125.1 (all green).

## What changed

1. **#145 — Deep research 502 fix.** Live `/api/deep` used to inline "Use
   WebFetch / WebSearch" + "save to interview-prep/…"; headless API providers
   have no tool channel, so Gemini answered with a function call instead of
   text (`MALFORMED_FUNCTION_CALL` → empty HTTP 502). `buildDeepPrompt(company,
   role, lang, {headless})` and `bundleProjectContext({headless})` now emit a
   no-tools variant for live runs (all three provider branches in
   `routes/llm.mjs`); the `mode:'manual'` copy-paste prompt keeps the Claude
   Code tool names. +1 test in `tests/critical-fixes.test.mjs`.
2. **#144 — Gemini defaults.** `gemini-2.0-flash` (deprecated) → `gemini-3.6-flash`
   across: Config dropdown (`GEMINI_MODELS` + `defaultValue` + `hintFallback`),
   server fallback in `server/lib/gemini.mjs` (was silently `gemini-2.5-pro`,
   disagreeing with the hint), `OPENROUTER_FALLBACK_MODELS` in `openai.mjs`,
   `config.geminiModelHint` ×17 (+ snapshot), and — follow-up in this release —
   the help guide ×17 (2 literals per bundle).
3. **New drift gate** `tests/gemini-default-model.test.mjs` (+5): pins the
   server literal ↔ dropdown ↔ OpenRouter chain ↔ hints ×17 ↔ help ×17.

## Sign-off checklist

- [ ] `npm test` — ≥ **1957** green (1950 baseline +1 #145 +1 #144-side +5 gate).
- [ ] `node --test tests/gemini-default-model.test.mjs` — 5/5.
- [ ] `node --test tests/critical-fixes.test.mjs` — green (headless prompt case included).
- [ ] Live spot-check (GET-only against the deployed server): `/api/health` →
      `1.125.2`. Do NOT exercise POST `/api/deep` against the live parent.
- [ ] Unit-level prompt check: `buildDeepPrompt('X','Y','en',{headless:true})`
      contains no `WebFetch`/`WebSearch`/`Save the output`; without opts it keeps them.
- [ ] `node scripts/check-changelog-parity.mjs` — all 16 locales at 1.125.2.
- [ ] `rg -c 'gemini-2\.0-flash' docs/help/` — zero hits.
- [ ] README ×17: badge `tests-1957`, `release-v1.125.2`, 🆕 line v1.125.2.
- [ ] Contributors: cvstart.org contributors block includes Alien10140 after the
      site rebuild (build-time `facts.json` top-24 sync).
