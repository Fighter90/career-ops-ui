# SPEC — Tamil (தமிழ்) as the 18th UI locale — v1.245.0

- **Status:** Done (deployed, prod-verified)
- **Release:** v1.245.0 (PR #414, tag `v1.245.0`); landing follow-up PR #419
- **Related:** CAR-26, CAR-59; Phase 5 of the October roadmap; base v1.244.2
- **Owner:** ta locale agent (worktree v12450) + orchestrator

## Goal

The full application, user guide and release surfaces speak Tamil — the
first new language after the 17-locale wave, at full key parity.

## Scope

- `public/js/lib/locales/i18n-dict.ta.js`: **1449/1449 keys**, hi-style
  Indic-tech conventions (providers, model names, paths, commands stay
  Latin); `detect()` accepts `ta` / `ta-IN` / `ta-LK`; LTR locked by test.
- `docs/help/ta.md`: full translation, **33 H2 / 125 H3**, source counts
  verified against the live registry (109 = 104 EN + 5 RU), Hermes canary
  anchors, verbatim YAML.
- `README.ta.md`, `CHANGELOG.ta.md`; `prompts.mjs` additive `ta` entries;
  enumeration gates 17 → 18 (LANGS, detect probes, i18n audit, changelog
  parity, RTL guard, ci.yml `langs` — which also picked up the previously
  missing `hi`); red-first `tests/i18n-ta-locale.test.mjs`.
- Follow-up fixes at merge time: `scan.scoreNone` / `scan.scoreNoneTip` keys
  (the agent's base predated #413), i18n snapshot regenerated (1461 keys).

## Deliberate non-actions

- cvstart.org landing stays 17 locales at this release (the landing
  translation shipped separately in #419).
- `report-header.js` REPORT_LABELS stays 17 — Tamil report parsing arrives
  with parent-repo Tamil report generation.

## Verification (real output)

- Red-first confirmed: `tests/i18n-ta-locale.test.mjs` 10 failures before
  implementation → 0 after.
- `npm run test:ci` → **5076 tests / 5075 pass / 0 fail**; workflow evals
  **14 pass · 0 fail**; browser smoke green; site build green (91 pages
  after the landing PR).
- Prod (resumecraft.ru): `/api/health` = `1.245.0`; smoke **15/15**.
- Language switcher renders தமிழ் 🇮🇳; `?lang=ta` persists; RTL round-trip
  clean; docs/help/ta.md renders all 33 sections.

## Notes

- The agent's base predated #413, so its changelog bootstrap carried a
  `1.244.1` entry — replaced by the true `1.245.0` intro entry at fan-out,
  and the header note aligned ("starts at v1.245.0").
- README.ta.md image paths corrected (`dashboard-ta.png`, guard comment
  locale list); `dashboard-ta.png` captured via
  `scripts/capture-dashboard-screenshots.mjs` (+ta); the map capture is
  parked on the ~19k-place geocode (see `README.ta.md` TODO).
- The README language-switcher lines did NOT gain the ta entry at this
  release (the fan-out updated badges/changelogs only) — fixed in v1.248.1.
