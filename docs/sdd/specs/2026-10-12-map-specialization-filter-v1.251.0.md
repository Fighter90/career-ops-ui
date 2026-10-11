# SPEC — Map: specialization filter from the settings — v1.251.0

- **Status:** Done (deployed, prod-verified)
- **Release:** v1.251.0 (PR, tag `v1.251.0`)
- **Related:** the owner's correction to v1.250.0 («not a list of vacancies —
  specializations from the settings»)

## Goal

The v1.250.0 select listed individual vacancies — the wrong lens. The map's
select must FILTER by the specializations configured in the settings.

## Scope

1. **Specialization select** — the map's select lists
   `config/profile.yml → target_roles.primary` (fetched via /api/profile →
   summary.target_roles; live from the user's own settings) plus
   «All specializations».
2. **Matching** — a chosen specialization keeps only the postings whose
   TITLE carries one of the role's own tokens (tokenized from the role
   string, length ≥ 2 so «Go» survives, word-bounded via Unicode
   lookarounds so «Go» never matches «Google»; Cyrillic works the same).
   The match is deliberately TITLE-ONLY with the settings' own words.
3. **The v1.250.0 locator is removed** — syncJobSelect/focusPoint/the
   __job back-reference and the vacancy-list select are gone; the peek,
   marker clicks and the text search stay.
4. **i18n** — map.filter.job/jobAny renamed to map.filter.spec/specAny
   with per-locale values ×18; snapshot regenerated.

## Verification (real output)

- `npm run test:ci` → **5245 tests / 5242 pass / 0 fail**.
- `npm run test:e2e:browser` → **129 pass / 0 fail** (the locator spec
  replaced by a specialization-filter spec: option list from the settings,
  filter narrows 2/2 → 1/2, Reset restores 2/2).
- coverage gate green · e2e 21/21 · evals 12/0 · link-check green.
