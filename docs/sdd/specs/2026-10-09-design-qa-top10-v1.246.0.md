# SPEC — Design-QA top-10 fixes — v1.246.0

- **Status:** Done (deployed, prod-verified)
- **Release:** v1.246.0 (PR #415 code, PR #416 docs train, tag `v1.246.0`)
- **Related:** CAR-48 (the sweep: 262 screenshots, `/tmp/design-qa/`),
  CAR-49…58 (area issues); base v1.245.0
- **Owner:** design-fix agent (worktree v12460d) + orchestrator

## Goal

Close all ten top findings from the senior-design sweep — the one blocker
and the seven majors.

## Scope (finding → fix)

1. **[blocker] Apply dark invisible link** (≈1.0:1) → theme-aware
   `.callout--info` tokens; dark link ≈7.4:1 (prod-measured).
2. **RTL bidi** flips numeric compositions → directional isolation
   (`direction:ltr; unicode-bidi:isolate`) on score pills/bands; ar ranges
   rephrased in words.
3. **CV markdown RTL-mangled** → textarea + preview `dir="ltr"`, chrome
   stays RTL.
4. **Reports DATE wraps** → `.report-date-cell` nowrap + tabular-nums.
5. **Sidebar HUD clips nav** → scrollport ends above the HUD (+22px fade,
   RTL mirrored).
6. **Mobile scan @390 clips Save search** → controls wrap + compress.
7. **Map dark controls** → zoom/layers/attribution theme-aware.
8. **FAB occlusion** → `.content` padding +88px, scroll-padding 96px.
9. **Activity raw slugs** → `activity.act.*` ×18 locales, chips translated,
   unknown → raw-id fallback in `CODE.activity-raw-slug`.
10. **Assessments placeholder-only** → sentence-case labels, `for`/`id` ×18.

## Verification (real output)

- `npm run test:ci` → **5068 → 5130 pass** on the branch (new
  `tests/design-qa-v1246.test.mjs`, 15 contracts).
- Browser suites green; the CI Playwright-e2e job woke on this PR
  (tests-path filter) and exposed a **pre-existing** e2e.mjs flake
  (reproduced on main: Flow 2b's `input#dry-run` actionability never
  settles after the server down/up flow) — fixed with a hard reload
  before Flow 2b; 21/0 twice locally and on CI.
- Prod (resumecraft.ru): smoke **15/15**; targeted — apply-dark link
  contrast, RTL pill direction, FAB clearance.

## Notes

- Dark map **tiles** deliberately deferred to v1.247.0 (the tile origin is
  pinned server-side by the CSP `img-src`; client-side swapping was out of
  bounds for that agent).
- The sweep's interim `features.12.desc` narrowing was later reverted
  (#419 made the site 18 locales again — the original claim became true).
