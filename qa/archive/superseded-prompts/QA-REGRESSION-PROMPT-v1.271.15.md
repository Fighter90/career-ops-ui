# QA regression prompt — v1.271.15

**CAR-269 closed: the coverage debt paid down, the exemptions removed.** The wave is tests + three `node:coverage ignore` markers — no source-file logic changed, so the product behaves exactly as v1.271.14; what changed is that the per-file coverage floor now has no career-ops-written source in its exempt list.

## §0 Gates

- `npm run test:ci` — **8467 tests / 8450 pass / 0 fail** (local Node 22, 2026-11-12). evals 0 ✗. CI green on the release commit.
- `npm run test:coverage:gate` — green with **zero** product-source exemptions.

## §1 What changed

- 8 test files extended (+39 tests): jd-parse (24), sources-tkms (20), sources-talentlink (37), sources-salary-text (16), posting-close (24), states (13), plus the swarm false-Done guard test.
- `server/lib/sources/_salary-text.mjs`, `posting-close.mjs`, `states.mjs`, `sources/talentlink.mjs` — three `/* node:coverage ignore next */` markers on structurally dead defensive branches (with justifications), nothing else.
- `scripts/coverage-baseline.json` — 7 product-source paths removed from `exempt[]` (179 → 175 entries; the remainder is vendor/fixture data).
- CHANGELOG ×19 + README ×19 (banners v1.271.15, badges 8450) + baselines + this prompt (v1.271.14's archived).

## §2 Acceptance

- Coverage gate green without exemptions on Node 22 (local) and Node 20 (CI).
- No product behavior change: registry 140, endpoints, scan flows identical to v1.271.14.
