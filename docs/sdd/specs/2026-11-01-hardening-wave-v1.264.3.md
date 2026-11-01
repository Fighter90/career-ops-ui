# SPEC — v1.264.3 hardening wave (rate-limit fleet + review LOWs + docs hygiene)

> Date: 2026-11-01 · Wave: 6 agent branches integrated into `fix/v1.264.3-hardening-wave`
> Review source: `docs/reviews/REVIEW-2026-10-31-v1.264.1.md` LOW findings + the 2026-11-01 docs drift sweep + the CAR-141 audit.

## Goal

Close the three review LOW findings (rate-limit surface, trust-proxy coupling, `validate: false`), the CAR-141 agent-fixable remainder, and the docs drift the review fleet surfaced — in one patch release.

## Scope

1. **Rate-limit coverage**: `writeRateLimit()` on all 47 mutating endpoints (9 mis-scoped `llmRateLimit` replaced, 3 stacked before the LLM bucket, 33 wired bare, `/api/apply-helper` allowlisted bare; 16 pure-LLM routes untouched) + the completeness tripwire `tests/rate-limit-coverage.test.mjs`.
2. **Trust proxy**: `TRUST_PROXY` env = hop count (never boolean true), unset by default; targeted `writeValidateConfig()` (only `xForwardedForHeader` opted out; `trustProxy` validation re-armed); custom keyGenerator removed (library ties proxy validations to the default one).
3. **CAR-141**: copy-feedback revert 1.5 s → 2 s (site.js + test pin). Video consciously owner-deferred.
4. **Docs**: help §19/§32 say 19 languages ×19; AGENTS.md/PLAN.md/StatsBar-comment/i18n.js-header/QA-prompt hygiene; vi.md §32; BACKLOG LOWs closed + parent-sync scoping recorded.

## Out of scope

- The parent-sync port wave (fork sync past upstream `a9476866` is a prerequisite; scoping recorded in BACKLOG).
- personio language-dedup (#4789 stack) — deferred to its own release.
- CAR-141 demo video — owner-deferred (2026-11-01).

## Acceptance criteria

- Tripwire red-first evidence recorded (27 bare before wiring); all gates green on the integrated branch.
- No behavioural regression at human cadence: evaluate / auto-pipeline / CV save work; 429 only past 60/min per route×IP.

## Verification (real output, integrated branch `fix/v1.264.3-hardening-wave`)

- `npm test` → **tests 7096 · pass 7093 · fail 0 · skipped 3** (first run 15 env-fails from a wiped Playwright cache; green after `npx playwright install chromium`)
- `npm run test:ci` → exit 0 (parity + i18n audit clean)
- `npm run test:e2e:browser` → **174 / 173 pass / 0 fail / 1 opt-in skip**
- `node tests/e2e.mjs` → passed 21 / failed 0 · `node tests/e2e-comprehensive.mjs` → 23/23 steps
- `node evals/workflow/run.mjs` → **14 pass · 0 fail · 1 skip**
- `npm run test:coverage:gate` → **Mean over 341 files: line 98.46% branch 90.10%** (floor 98/89)
