# QA regression prompt — v1.271.7

Batched swarm release (CAR-267 + CAR-268 + CAR-264, plus CI-infra fixes; docs completed by the orchestrator babysitter after the release manager's detached-HEAD push didn't land and the ×18 changelog preambles needed re-restoring — the 3rd occurrence of that release-script bug).

**Story:** Three swarm waves shipped together. CAR-267: IBM rejects an impossible dcdate (#6802) and the tracker-addition score summary reads bulleted (`•`) keys (#6754). CAR-268: CryptocurrencyJobs carries the feed teaser's eligibility clause as `eligibilityText` (#6765+#6747) and Apple walks its full careers board (#6634 — older-but-open roles surface; the walk clamps `max_pages` to its own 300 ceiling). CAR-264: Greenhouse fetches bodies for title-matched postings on oversized boards (#6673), JibeApply reports an accurate truncation warning with opt-in `page_size` (#6692), and http-json maxBytes applies with the fetch-method receiver preserved. CI-infra: runner pins (ubuntu-24.04 for code-quality + Playwright), `playwright@1.64.1` install pin, and a DNS-flake retry loop in the install step.

## §0 Gates at ship time

- `npm run test:ci` — **8237 tests / 8220 pass / 0 fail / 17 skip** (local, Node 22, 2026-11-11).
- `node --test tests/site-changelog-parity.test.mjs` — 23/23 after the ×18 changelog-preamble layout restore (the release script re-introduced entries-above-preamble — 3rd occurrence; the release-manager role needs the fix) + site mirror resync.
- `node tools/i18n-audit.mjs` — no hard failures.
- `node scripts/check-changelog-parity.mjs` — all 19 changelogs at `## [1.271.7]`.
- CI on main: the docs-completion commit (this tree) — see the run on GitHub.

## §1 What changed

- `server/lib/sources/apple.mjs` (full_board walk), `cryptocurrencyjobs.mjs` (eligibilityText), `ibm.mjs` (dcdate guard), `greenhouse.mjs` (oversized-board bodies), `jibeapply.mjs` (page-cap/page_size), `server/lib/parsers.mjs` (bulleted summary keys), `server/lib/http-json.mjs` (maxBytes receiver).
- CI: `.github/workflows/ci.yml` — code-quality + Playwright jobs pinned to ubuntu-24.04, `playwright@1.64.1` install pin, apt-DNS retry loop.
- Swarm: `scripts/swarm/orchestrator.mjs` (executor issue-identity pin, stale-lock takeover) + `scripts/swarm/roles/executor.md`.
- CHANGELOG ×19 (preamble-first layout restored ×18) + README ×19 (banners/badges v1.271.7, tests badge 8220) + `qa/QA-REGRESSION-PROMPT-v1.271.7.md` (this file; v1.271.6's archived).

## §2 Manual browser pass

- Apple postings older than the first pages appear in scans (full_board walk); `max_pages` on an apple entry caps at 300 in full_board mode.
- CryptocurrencyJobs postings carry eligibility text without polluting the description/snippet fields.
- IBM postings with impossible dates are dropped, not corrupted.
- README ×19: one `🆕 v1.271.7` banner + one `📜` CHANGELOG line each; release badge + tests badge v1.271.7/8220.
- cvstart.org: version 1.271.7, sources 139 (after the Pages deploy).

## §3 Contract/security invariants

- SSRF guards untouched; the WHATWG entity table is data-only.
- Registry counts agree everywhere (R-05): 139 = 134 EN + 5 RU · 134 adapters.
- CI runner pins: coverage ratchet baselines stay valid (ubuntu-24.04); un-pin only after re-measuring on the new runner image.

## §4 Not-ported / not-applicable

- CAR-258 (talentlink + google max_pages), CAR-259 (liveness/scanner wave — Norwegian banner half already landed), CAR-262 (JD/evaluate wave), CAR-266 (oracle_host) — queued for the next swarm cycles.
- The ×18 locale changelog bodies carry EN-identical text for this release — covered by the preambles' translation-pending notes; a translation sweep is follow-up work.

## §5 Sign-off

Release completed by the orchestrator babysitter (the release manager's detached-HEAD push didn't land and its changelog layout re-broke ×18): docs completion commit + tag + Release/Publish/Pages + wiki + resumecraft deploy/verify + remote-qa. Linear: CAR-268 → Done with run links.
