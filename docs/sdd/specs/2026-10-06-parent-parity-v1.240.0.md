# SPEC — Parent parity with career-ops @ 62905981 (v1.240.0)

- **Status:** Done
- **Release:** v1.240.0 (2026-10-06)
- **Related:** [ADR-0002](../../adr/0002-defend-fork-divergences.md) (defend fork divergences), [ADR-0003](../../adr/0003-mirror-vs-relay.md) (mirror vs relay), PR #380 (@bullitt186), the `parent-sync` skill
- **Owner:** maintainer — done when the gates in *Verification* are green and resumecraft.ru reports the version

## Goal
Bring `Fighter90/career-ops` (the parent) level with upstream `career-ops-hq/career-ops` and mirror into web-ui everything the parent gained that web-ui reads or re-implements.

## Context
- The fork was **144 commits behind** upstream `main` (it was 80 ahead); upstream VERSION is 1.35.0.
- web-ui's last parent sync was `993085ce`; another session had already shipped v1.239.0–1.239.4 (parity @ `b39931e`, five sources) — a local branch built from a stale `main` collided with it and was rebuilt on `origin/main` as v1.240.0.
- Upstream reverted the fork's Cyrillic `LOCATIONISH_RE`; the merge produced **no conflict** on that file (ADR-0002).
- External PR #380 makes web-ui read/write the parent's checklist `pipeline.md`.

## Scope
1. Parent: `git merge upstream/main` into the fork, resolve 5 conflicts (`.env.example`, `docs/RUNNING_ON_A_BUDGET.md`, `tests/helpers.mjs`, `test-all.mjs`, `web/package-lock.json`), keep all four ADR-0002 divergences, push.
2. Six new sources (a source + an adapter + a CI-isolated suite each): `adp-workforcenow`, `gupy`, `jazzhr`, `startup-jobs`, `taleo`, `ultipro` → **109** sources / **104** adapters.
3. Provider fixes mirrored where web-ui lacked them: country-in-location (ashby, breezy, recruitee), mokahr `hire-r1`, avature `article--jobs`, successfactors `/go/`, deutschebahn blanked page, higheredjobs Incapsula-200.
4. Merge #380 and credit the contributor on every surface (README avatar row ×17, CHANGELOG ×17, banner lead ×17, site, wiki).
5. Docs ×17, QA prompt, site mirrors, counts.

## Out of scope
Trusted-proxy egress, `scan-history.tsv` column registry, language-aware requisition dedup, SmartRecruiters `requisitionId`/`language`, Gem `isoCountry` (needs the 249-entry alpha-3 table), every CLI-only change. Each is recorded with its reason in the CHANGELOG *Notes*.

## Acceptance criteria
1. `providers/telegram-channel.mjs` is byte-identical to its pre-merge snapshot; `grep -c 'p{L}'` = 4, `providers/telegram.mjs` present, `hermes` ×1 in `web/src/lib/clis.ts`, `vpFixtureEnv` ×9 in `test-all.mjs`. *(manual diff + grep, ADR-0002)*
2. `ALL_ADAPTERS.length === 104` and the sorted id list matches the live registry. *(`tests/adapter-registry.test.mjs`)*
3. `GET /api/scan/sources` lists the six new EN sources. *(`tests/scan-sources-endpoint.test.mjs`)*
4. The `#/scan` fallback list equals the server registry by value and label. *(`tests/scan-fallback-sources.test.mjs`)*
5. Every source has a link on cvstart.org. *(`tests/site-sources.test.mjs`)*
6. All 17 help bundles state 109 / 104+5. *(`tests/help-source-counts.test.mjs`)*
7. Each new source is host-pinned, HTTPS-only, `redirect:'error'`, and throws (never returns `[]`) on a malformed body. *(`tests/sources-<slug>.test.mjs` ×6)*
8. A checklist `pipeline.md` reads as N pending, adds under `## Pending`, never creates a fence. *(`tests/parsers-pipeline-checklist.test.mjs`)*
9. One `## [1.240.0]` per CHANGELOG ×17, parity green. *(`scripts/check-changelog-parity.mjs`)*
10. `npm run test:ci` exits 0 with 4056 pass; browser suite 116 pass. *(CI)*

## Plan
| # | Task | Parallel? | Goes green |
|---|---|---|---|
| 1 | Divergence snapshot, merge upstream into the parent, resolve conflicts, run the parent suite on Node 22 | no | criterion 1 |
| 2 | Port the six sources — one agent each, three files each, forbidden from shared files | yes ×6 | criterion 7 |
| 3 | Wire registry, regenerate both gate lists from the live registry, fallback list, site links | no | criteria 2–5 |
| 4 | Mirror the provider fixes (grouped by family) | yes ×3 | the fix suites |
| 5 | Review and test #380, merge it | no | criterion 8 |
| 6 | Rebuild on `origin/main` (collision), docs ×17 by one agent per locale, mechanical sweeps by script | partly | criteria 6, 9 |
| 7 | Gates, PR, CI, merge, tag, release, publish, wiki, deploy | no | criterion 10 |

## Risks and invariants touched
`TRACEABILITY.md` rows **R-04** (source registry contract), **R-05** (counts), **R-06** (SSRF/HTTPS envelope), **R-08** (i18n parity), **R-02** (parent read-only: the parent was written only by the authorised merge and push).
Lessons recorded in `PROGRESS.md`: two sessions can ship the same version; a port agent's claim about `meta.region` must be verified; a test that sets `CAREER_OPS_ROOT` needs `cv.md`.

## Verification
- Parent: `62905981` pushed, 0 behind upstream; `node test-all.mjs --quick` on Node 22 → 12075 pass, 1 timing flake (`latexValidate`, 0.09 s alone).
- web-ui: `npm run test:ci` → **4056 pass / 0 fail**; browser **116 / 116**; `evals/workflow` 14/14; i18n audit clean; changelog parity ×16 green.
- Full record of the release (counts, deploy, `/api/health`) is in the PR and `qa/QA-REGRESSION-PROMPT-v1.240.0.md` §5.
