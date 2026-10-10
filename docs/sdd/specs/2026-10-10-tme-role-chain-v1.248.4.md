# SPEC — t.me role chain + identity gate + README translations parity — v1.248.4

- **Status:** Done (deployed, prod-verified)
- **Release:** v1.248.4 (PR, tag `v1.248.4`)
- **Related:** CAR-61 (continuation — the v1.248.3 verdict items); base
  v1.248.3
- **Owner:** orchestrator

## Goal

Telegram entries with a real vacancy must yield named reports (not
`unknown-role` rejections), the LLM call must only fire for entries worth
evaluating, and the README «Translations» block must be generated, not
hand-maintained.

## Scope

1. **Role chain** for t.me entries: (a) the model's report header via
   `parseReportHeader` (the H1 title); (b) RU+EN role keywords
   (разработчик…директор, DevOps/SRE, QA, data scientist) matched against
   the entry text; (c) the first meaningful line as last resort.
   `guessCompanyRole` keeps the channel-name company for Telegram hosts and
   honours «Компания: X» self-labels plus mid-sentence «…в компании X».
2. **Identity gate BEFORE the LLM call**: `guessRoleHint()` (keyword or
   t.me channel presence) — an entry with neither fails at the fetch step
   with `rejected: true`; the provider stub is never called (asserted by a
   call counter).
3. **`t.me/s/<channel>/<id>`**: the preview segment is skipped — both link
   forms resolve to the channel («S» bug).
4. **README «Translations» block regenerated ×18** from one canonical
   locale list (canonical order, `·` separator, own never linked;
   ar/pl/uk gained the block) + `tests/readme-translations-parity.test.mjs`
   (17 links per file, no self, ≥17 flags).
5. **deploy.yml recon**: prints «eval-timer … honours rejected: yes/no»
   (grep of the timer's ExecStart script; contents stay off the public log).
6. **Wiki**: Home-(தமிழ்).md created, sidebar link added, all Home banners
   → v1.248.4 from live data.

## Deliberate no-ports

- The parent's word-boundary location compiler and USPS state table
  (documented since v1.248.1) — unchanged.

## Verification (real output)

- `npm run test:ci` → **5184 tests / 5181 pass / 0 fail** (new: RU-keyword
  unit, /s/ form unit, no-hints-before-LLM flow with a provider call
  counter, Cyrillic t.me full-flow save; updated: llm-routes fixtures →
  FULL_REPORT, UX-D-J ETA key, P4-ETA stats.marketEta contract).
- Red-without-fix verified for the pre-LLM gate (provider counter > 0
  without the gate), the role chain (filename without the role), and the
  /s/ form («S» company).
- Full gates: coverage gate 98.16/89.38, e2e 21/0, browser green,
  e2e:full green, evals 12 pass · 0 fail, changelog parity ×18, i18n audit
  clean, site build 91 pages.
- Prod after deploy: `/api/health` = `1.248.3`→`1.248.4`; smoke 15/15;
  the next scheduled eval-timer run verified via the activity feed —
  rejected entries carry `rejected: true` and no t-role report is written.
