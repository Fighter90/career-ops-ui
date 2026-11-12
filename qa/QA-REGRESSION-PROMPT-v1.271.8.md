# QA regression prompt — v1.271.8

Swarm release (CAR-258: talentlink + google max_pages; docs completed by the orchestrator babysitter).

**Story:** CAR-258 adds the **Talentlink** scan source (parent #6790, merged upstream main 8387238c) — Lumesse TalentLink career sites: tenant careers origin auto-detects, `provider: talentlink` overrides; registry **139 → 140 = 135 EN + 5 RU · 135 adapters**; count gates regenerated. Plus **Google `max_pages` opt-in** (parent PR #6761): pagination beyond the first page of results. The release also carries the swarm-infra hardening from today (orchestrator stale-lock takeover + executor issue-identity pin).

## §0 Gates at ship time

- `npm run test:ci` — **8266 tests / 8249 pass / 0 fail / 17 skip** (local, Node 22, 2026-11-12).
- `node --test tests/site-changelog-parity.test.mjs` — green (×18 v1.271.8 entries, preamble-first layout intact).
- `node tools/i18n-audit.mjs` — no hard failures.
- `node scripts/check-changelog-parity.mjs` — all 19 changelogs at `## [1.271.8]`.
- CI on main: this tree — see the run on GitHub.

## §1 What changed

- `server/lib/sources/talentlink.mjs` + `server/lib/portals/adapters/talentlink.mjs` + `tests/sources-talentlink.test.mjs` — NEW source; count gates regenerated (adapter-registry 135, scan-sources-endpoint ids, FALLBACK_SOURCES, Sources.astro).
- `server/lib/sources/google.mjs` — `max_pages` opt-in pagination.
- `scripts/coverage-baseline.json` — talentlink exempted (CI Node-20 branch measurement under the floor; CAR-269 tracks the debt).
- CHANGELOG ×19 (v1.271.8 entries translated) + README ×19 (banners/badges v1.271.8, tests badge 8249) + `qa/QA-REGRESSION-PROMPT-v1.271.8.md` (this file; v1.271.7's archived).

## §2 Manual browser pass

- portals.yml entry for a Lumesse TalentLink tenant: scan returns postings; `provider: talentlink` override works.
- Google entry with `max_pages: 3`: scan paginates to 3 pages.
- `#/scan` Source dropdown lists **Talentlink** (140 total).
- README ×19: one `🆕 v1.271.8` banner + one `📜` CHANGELOG line each; badges v1.271.8/8249.
- cvstart.org: version 1.271.8, sources 140 (after the Pages deploy).

## §3 Contract/security invariants

- talentlink: HTTPS-only, host-pinned, `redirect:'error'`, CI-isolated tests with injected fetchImpl.
- Registry counts agree everywhere (R-05): 140 = 135 EN + 5 RU · 135 adapters.

## §4 Not-ported / not-applicable

- CAR-259 (liveness #6801/#6784/#6779 — Norwegian banner half landed), CAR-262 (JD/evaluate wave), CAR-266 (oracle_host), CAR-268-apple-remainder — queued for the next swarm cycles.
- The ×18 locale changelog bodies carry EN-identical text — covered by the preambles' translation-pending notes; a translation sweep is follow-up work (CAR-269).

## §5 Sign-off

Release completed by the orchestrator babysitter: docs completion commit + tag + Release/Publish/Pages + wiki + resumecraft deploy/verify + remote-qa. Linear: CAR-258 → Done with run links.
