# QA regression prompt — v1.271.5

Swarm release (CAR-257 + CAR-265, docs completed by the orchestrator after the release manager died mid-chain).

**Story:** Two parent-sync waves shipped together. CAR-257 added the **Tes** scan source (UK & international teaching jobs, `provider: tes`, tRPC walk 50/page) — registry **138 → 139 = 134 EN + 5 RU · 134 adapters** — and stopped cryptocurrencyjobs from emitting the feed's teaser template as description-like text (the content filter would drop every posting on the board). CAR-265 ported three provider fixes: startup-jobs no longer stops at its teaser listing, hackernews fetches through the shared HTTP context, platsbanken marks truncated boards with the canonical truncated shape. The release also hardened the swarm itself: the executor's develop prompt pins the exact Linear issue identity (the CAR-258 live regression — an executor implemented another issue's body), and the orchestrator takes over a stale single-flight lock whose holder PID is dead instead of aborting every next launch.

## §0 Gates at ship time

- `npm run test:ci` — **8157 tests / 8140 pass / 0 fail / 17 skip** (local, Node 22, 2026-11-11).
- `node --test tests/site-changelog-parity.test.mjs` — green after the ×18 changelog-layout restoration (the release script had put v1.271.5 entries above the title+note preambles; restored to the canonical title→note→entries order) and the site mirror resync.
- `node tools/i18n-audit.mjs` — no hard failures.
- `node scripts/check-changelog-parity.mjs` — all 19 changelogs at `## [1.271.5]`.
- CI on main: the docs-completion commit (this tree) — see the run on GitHub.

## §1 What changed

- `server/lib/sources/tes.mjs` + `server/lib/portals/adapters/tes.mjs` + `tests/sources-tes.test.mjs` (21 specs) — NEW source; count gates regenerated (adapter-registry 134, scan-sources-endpoint ids, FALLBACK_SOURCES, Sources.astro).
- `server/lib/sources/cryptocurrencyjobs.mjs` — teaser no longer emitted as `snippet`.
- `server/lib/sources/{startup-jobs,hackernews,platsbanken}.mjs` — CAR-265 ports.
- `scripts/swarm/orchestrator.mjs` + `scripts/swarm/roles/executor.md` — identity pin + stale-lock takeover (+4 tests in `tests/swarm-orchestrator.test.mjs`).
- CHANGELOG ×19 + README ×19 (banners/badges v1.271.5, tests badge 8140) + `qa/QA-REGRESSION-PROMPT-v1.271.5.md` (this file; the v1.271.4 prompt archived).

## §2 Manual browser pass

- `#/scan`: Source dropdown lists **Tes** (139 total; offline FALLBACK_SOURCES list matches the live registry — the drift gate proves it).
- portals.yml entry: `job_boards: [{ name: Tes, provider: tes, enabled: true }]` → scan returns UK teaching jobs with dates, salaries (`31650–49084 GBP` shape), closesAt.
- cryptocurrencyjobs postings carry empty `snippet` and still surface (title filter intact).
- README ×19: one `🆕 v1.271.5` banner + one `📜` CHANGELOG line each; release badge + tests badge v1.271.5/8140.
- cvstart.org: version 1.271.5, sources 139 (after the Pages deploy).

## §3 Contract/security invariants

- tes source: HTTPS-only, exact-host pin `www.tes.com` (`assertTesUrl`), `redirect:'error'` on every request, row URLs only site-relative vacancy paths; SSRF guards untouched elsewhere.
- Registry counts agree everywhere (R-05): live registry ↔ adapters ↔ `#/scan` fallback ↔ cvstart.org ↔ help §17 ×19 ↔ CONTEXT.md.

## §4 Not-ported / not-applicable

- oraclecloud (#6690) and apple (#6452) parent fixes — verified already present since v1.271.3 (parent 298d2282).
- CAR-258 (talentlink + google max_pages), CAR-262/263/264/266/267/268 — queued for the next swarm cycles, NOT in this release.

## §5 Sign-off

Release completed by the orchestrator babysitter after the swarm's release manager was killed mid-chain (SIGKILL): docs completion commit + tag + Release/Publish/Pages + wiki + resumecraft deploy/verify + remote-qa. Linear: CAR-265 → Done with run links.
