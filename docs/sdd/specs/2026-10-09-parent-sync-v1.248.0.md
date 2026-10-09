# SPEC — Parent parity (6290598 → fbdf7004) — v1.248.0

- **Status:** Done (deployed, prod-verified)
- **Release:** v1.248.0 (PR #423, tag `v1.248.0`); red-main fix #422 preceded
  it
- **Related:** CAR-60 follow-up; parent 44 commits; base v1.247.0
- **Owner:** five port agents (disjoint file ownership) + orchestrator

## Goal

Carry the parent's five provider/liveness fixes so boards that moved their
APIs keep working and liveness stops mis-reading closing banners.

## Scope (parent commit → web-ui port)

| Parent | Fix | Port | Suite |
|---|---|---|---|
| b5ba43f3 | gupy: API → `portal.gupy.io`, real filter names, exact-match confidencial drop, `max_pages` 100 | `sources/gupy.mjs` + adapter endpoint mapping | `sources-gupy` 46/46 |
| b07171d1 | workable: multi-country postings fold by URL (all countries kept) | `sources/workable.mjs` `byUrl` fold | `sources-workable` 25/25 |
| 880a1cb4 | liveness: banner on its own line = the closing clause | `liveness-core.mjs` line-aware `normalizeForMatch` + `TIME_OR_CONDITION_CLAUSE` + `firstStatedMatch` | 25/25 (+76 lines of parent cases) |
| cf31a939 | radancy: sibling `job-location` in legacy markup | `sources/radancy.mjs` `LEGACY_LOCATION_RE` + between-anchors fallback | 50/50 (with smartrecruiters) |
| 28776926 | smartrecruiters: fallback links keep the configured slug | `sources/smartrecruiters.mjs` `buildPublicUrl(j, companySlug)` | ↑ |

## No-ports (documented ×18)

- `_http` proxy `fetchImpl` — web-ui has **no proxy branch**; porting would
  defeat the DNS-rebinding guard's identity check and add an undici
  dependency the repo deliberately avoids (49/49 http suites green).
- `verify-ats` (+226 lines) and `cv-facts` — web-ui implements its own ATS
  scoring and CV parsing.
- Parent dashboard Go TUI + CLI scripts; teamtailor import reorder.

## Red-main incident (before this release)

#419 (site ta landing) added `ta` to `check-i18n.mjs` CODES but skipped the
unit job via path filters — `tests/site-scripts.test.mjs`'s fixture still
built 16 locales and every main CI run went red. Fixed in #422 (fixture 18,
9/9 checks).

## Verification (real output)

- Per-port suites: **146/146** combined before wiring.
- `npm run test:ci` → **5138 tests / 5130 pass / 0 fail**.
- e2e 21/0 · browser green · site build 91 pages · evals 12 pass · 0 fail
  (2 worktree env-skips).
- Prod: `/api/health` = `1.248.0`, `parentVersion` = `1.35.0` (parent
  `fbdf7004`); smoke **15/15**; Pages success (facts 1.248.0).

## Follow-up filed

CAR-60: the parent's location-filter `always_allow` tier (shipped next
release, v1.248.1).
