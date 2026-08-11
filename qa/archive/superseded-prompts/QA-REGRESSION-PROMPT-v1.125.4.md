# QA Regression Prompt — v1.125.4 (maintenance sync: site deps + parent parity sweep)

> Maintenance release. Rolls up the three dependabot site bumps and records the
> parent parity sweep (career-ops `37d17ec..254764a`, post-v1.22.0) — nothing
> ported. Also covers v1.125.3 (same-day fix release: da/hi prompt-locale),
> which shipped without its own QA prompt.
> Baseline: v1.125.2 (all green).

## What changed

1. **v1.125.3 — da/hi prompt-locale fix** (user-reported, reproduced twice).
   `LOCALE_NAMES` + all five `SCAFFOLD_STRINGS` bags in `server/lib/prompts.mjs`
   were never extended for `da`/`hi`, so `resolveLocale()` normalized both to
   `en` and every AI prompt (deep research live+manual, mode runs, evaluate,
   interview, networking, CV Studio) lost its `# Output language` directive.
   Both locales are now first-class; `tests/locale-scaffold.test.mjs` sweeps
   the canonical 17-locale `I18N_LANGS` list and a structural parity gate
   fails any scaffold key that falls back to English (+12 tests → **1969**).
2. **v1.125.4 — site deps** (dependabot #151–#153): `sharp` 0.34.5→0.35.3,
   `svgo` 4.0.1→4.0.2, `fast-uri` (dev) 3.1.3→3.1.4 in `site/` only.
3. **v1.125.4 — parent parity sweep** (`37d17ec..254764a`): set-status
   wrong-row guard #2108 (CLI-only — no web-ui route shells `set-status.mjs`),
   localized-mode Risk Summary #2109 (`modes/<lang>/` never read by web-ui),
   update-system manifest check #2111 (updater-only), parent docs. **No code
   ported**; parent VERSION stays 1.22.0.

## Sign-off checklist

- [ ] `npm test` — **1969** green (1957 baseline +12 locale-scaffold).
- [ ] `node --test tests/locale-scaffold.test.mjs` — 36/36.
- [ ] Manual: switch UI to **Dansk**, `#/deep-research` manual prompt starts
      with `# Output language` / `Respond in Danish (locale: da)`.
- [ ] Manual: same in **हिन्दी** — `Respond in Hindi (locale: hi)`.
- [ ] `node scripts/check-changelog-parity.mjs` — all 16 locales at 1.125.4.
- [ ] Site build green (`cd site && npm run build`, Node ≥ 22) — sharp/svgo
      bumps are build-time only; spot-check cvstart.org renders after deploy.
- [ ] `/api/health` → `version 1.125.4`, `parentVersion 1.22.0`.
