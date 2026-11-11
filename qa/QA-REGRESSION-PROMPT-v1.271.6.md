# QA regression prompt — v1.271.6

Swarm release (CAR-263, docs completed by the orchestrator babysitter after the release manager's detached-HEAD push didn't land and the ×18 changelog preambles needed re-restoring).

**Story:** The scanner wave (CAR-263): repost detection folds regional title variants (#6190 — a repost is one listing re-posted, not a regional duplicate), scans re-admit seen postings after a `recheck_after_days` window in the admission gate (#5905 — ghosts come back instead of being pinned forever), reverse-pipeline writes gain a shared lock (#6022), and HTML entities decode in attribute mode via a new shared WHATWG entity table (`server/lib/html-entity-table.mjs` — C1/windows-1252 mapping, semicolon-free legacy names, prototype names kept as written, NUL/surrogate/out-of-range → U+FFFD).

## §0 Gates at ship time

- `npm run test:ci` — **8198 tests / 8181 pass / 0 fail / 17 skip** (local, Node 22, 2026-11-11).
- `node --test tests/site-changelog-parity.test.mjs` — 23/23 after the ×18 changelog-preamble layout restore (the release script re-introduced entries-above-preamble; mechanically re-fixed) + site mirror resync.
- `node tools/i18n-audit.mjs` — no hard failures.
- `node scripts/check-changelog-parity.mjs` — all 19 changelogs at `## [1.271.6]`.
- CI on main: the docs-completion commit (this tree) — see the run on GitHub.

## §1 What changed

- `server/lib/sources/*` scanner internals (recheck window, seen-set recheck, repost regional fold), `server/lib/parsers.mjs` (reverse-pipeline lock), `server/lib/html-entities.mjs` + NEW `server/lib/html-entity-table.mjs` (attribute mode).
- CHANGELOG ×19 (premble-first layout restored ×18) + README ×19 (banners/badges v1.271.6, tests badge 8181) + `qa/QA-REGRESSION-PROMPT-v1.271.6.md` (this file; v1.271.5's archived).

## §2 Manual browser pass

- Repost detection: a regional title variant of a seen posting does not create a fresh repost cluster.
- scan_history with `recheck_after_days`: a seen posting re-appears after the window; inside the window it stays deduped.
- Entities in attribute contexts decode per WHATWG rules; `&amp=1` / `&notit;` stay as written; `&#151;`-class C1 refs map to windows-1252.

## §3 Contract/security invariants

- SSRF guards untouched; the new entity table is data-only (no I/O, no network).
- scan_history write shape unchanged (closes_at cell intact); dedup keys (url-key) untouched.

## §4 Not-ported / not-applicable

- CAR-258 (talentlink + google max_pages) — queued, next swarm cycles. CAR-262/264/266/267/268 — queued.
- The ×18 locale v1.271.6 changelog bodies carry EN-identical text in some locales — covered by the preambles' translation-pending notes; a translation sweep is follow-up work.

## §5 Sign-off

Release completed by the orchestrator babysitter: docs completion commit + tag + Release/Publish/Pages + wiki + resumecraft deploy/verify + remote-qa. Linear: CAR-263 → Done with run links.
