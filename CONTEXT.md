# CONTEXT.md — domain dictionary

One accepted name per concept. Variants are listed as **do not use**, because a
session that picks a different name for an existing concept will rename working
code or duplicate it. Terms only — implementation detail belongs in
[docs/sdd/CONVENTIONS.md](docs/sdd/CONVENTIONS.md), decisions in [docs/adr/](docs/adr/).

Keep this file current in the same commit that introduces or renames a concept.
A term agreed in conversation but not written here will be re-invented next session.

---

## The two registries — the single most confused pair in this project

**source** — an entry in the **source meta registry**: `server/lib/sources/<slug>.mjs`
exporting `meta = { value, label, region, configKey? }`. `server/lib/sources/registry.mjs`
scans the folder at boot and imports every `*.mjs`, so dropping in a valid file
registers it with no registry edit. Drives `GET /api/scan/sources` and the `#/scan`
Source dropdown. **Count: 94 (89 `region: 'en'` + 5 `region: 'ru'`).**

**adapter** — an entry in the **fetch-walk registry**: `server/lib/portals/adapters/<slug>.mjs`
plus an explicit row in `server/lib/portals/registry.mjs::ALL_ADAPTERS`. Implements
`matches(company)` and `buildEndpoint(company)` (**string or null, never an object**)
and performs the HTTP fetch/parse walk over `tracked_companies:`. **Count: 89 — EN only.**

**The counts differ on purpose and both are correct.** Exactly five sources have no
adapter: `geekjob`, `getmatch`, `habr-career`, `hh.ru`, `trudvsem` — the RU five, which
are dispatched by `RU_DISPATCH` in `server/lib/ru-scanner.mjs` instead of walking
company boards. So:

> **94 sources = 89 EN + 5 RU · 89 adapters = the EN sources only · every adapter has a source, five sources have no adapter.**

- **Do not use** "provider" for either of these when writing web-ui code — in this
  repo `provider` means an LLM provider (`server/lib/llm-dispatch.mjs`,
  `GET /api/status/providers`). The **parent** project calls its scrapers
  `providers/*.mjs`; when porting, a parent *provider* becomes a web-ui *source*
  **and**, for EN boards, also an *adapter*.
- **Do not use** "94 adapters" — that number is sources. The public "N adapters"
  phrasing in README badges and the wiki is the **sources** total kept for historical
  continuity; inside the code, `ALL_ADAPTERS.length === 89`.
- **Do not use** "portal" and "board" interchangeably in new prose: a **job board**
  is the third-party site; a **portal entry** is our row in `tracked_companies:`.

## Parent and fork

**parent** — the `career-ops` CLI project, checked out at `CAREER_OPS_ROOT` (resolved
by `server/lib/paths.mjs`). web-ui is a sibling directory inside it and treats it as
**read-only**.

**fork** — `Fighter90/career-ops`, our copy of the parent. **upstream** is
`career-ops-hq/career-ops`. The fork carries fixes upstream does not have; see
[ADR-0002](docs/adr/0002-defend-fork-divergences.md).

**mirror** — parent logic re-implemented inside `server/lib/` so the web API does not
shell out (`role-matcher.mjs`, `detect-reposts.mjs`, `trust-validator.mjs`,
`liveness-core.mjs`, `url-key.mjs`, every `sources/*.mjs`). A parent fix to mirrored
logic **must be ported**.

**relay** — a parent script web-ui shells out to and whose JSON it forwards
(`server/lib/parent-relay.mjs`, used by `routes/stats.mjs`, `routes/jds.mjs`,
`routes/followup.mjs` and others). A parent fix to a relayed script needs **no**
web-ui change — it arrives with the deployed parent. Deciding mirror-vs-relay for an
incoming parent change is the first question of every parity release.

## Scanning

**scan** — a run over configured sources producing job rows; `#/scan`, `GET /api/stream/scan`.

**portals.yml** — the user's scan configuration. Top-level blocks: `tracked_companies:`
(per-employer boards, walked by adapters), `job_boards:` (board-wide sources),
`search_queries:`, `title_filter:`.

**configKey** — optional `meta` field naming the `portals.yml` key a source reads its
per-user settings from. Only the RU five declare one.

**quarantine** — `server/lib/scan-quarantine.mjs`. Skips an EN source that returned a
*permanent* failure, so one dead board does not cost every later scan. Temporary
failures are not quarantined. **Do not use** "blacklist".

**trust score** — `server/lib/trust-validator.mjs` annotates each job with a score
(0–100), `flags[]` and a level (`high`/`medium`/`low`). It **never drops a job** — it
only annotates. **Do not use** "trust filter".

**dedup key** — the canonical posting-URL key from `server/lib/url-key.mjs`
(`normalizeUrl`, `promoteKnownFragmentIdentity`). Two URLs for the same posting must
collapse to one key so a re-listing is recognised rather than recorded as a new job.

**repost** — the same job listed again, detected by `server/lib/detect-reposts.mjs`
over scan history. Distinct from a **duplicate**, which is the same posting reached by
two URLs and is the dedup key's job. A stated seniority level makes two requisitions
*different roles*, not reposts — `role-matcher.mjs` (`extractLevels`, `roleFuzzyMatch`).

**telegram** vs **telegram-channel** — **two deliberately different sources over the
same `t.me/s/` pages**, not duplicates. `telegram` is the recall-leaning reader;
`telegram-channel` is the strict one (a post becomes a row only when it names an
employer *and* links to a vacancy page). Upstream consolidated onto one and deleted
the other; we keep both — [ADR-0001](docs/adr/0001-keep-both-telegram-sources.md).

## Liveness

**liveness check** — the `#/tracker` "Still live?" action; `server/lib/liveness-core.mjs`
classifies a fetched posting page. Returns `{ result, code, reason }`.

**hard expired** (`HARD_EXPIRED_PATTERNS`, code `expired_body`) — checked **before** the
apply-control test, so it beats a visible Apply button. Only unambiguous copy belongs here.

**soft expired** (`SOFT_EXPIRED_PATTERNS`, code `expired_body_soft`) — checked **after**
the apply control, so a live posting wins. For phrases that legitimately appear as page
chrome on a live page ("Job Expired" in a similar-jobs carousel or a filter chip).

The asymmetry is the design: a false `expired` is written to scan history as
`skipped_expired` and then dedup-filters a real job out of **every later scan**,
indefinitely, unless `scan_history.recheck_after_days` is set. A false "still live"
costs one wasted re-check. See [ADR-0004](docs/adr/0004-liveness-hard-vs-soft-tiers.md).

## Release vocabulary

**parity release** — a release whose content is a parent delta, produced by the
`parent-sync` skill.

**count gates** — the five tests that pin registry counts: `adapter-registry`,
`scan-sources-endpoint`, `scan-fallback-sources`, `site-sources`, `help-source-counts`.
Regenerate their lists from the live registry; never hand-edit the sorted literals.

**FALLBACK_SOURCES** — the static source list painted into the `#/scan` dropdown before
the live registry answers (`public/js/lib/scan-results.js`). Kept in exact parity with
the registry by the `scan-fallback-sources` drift gate.

**QA prompt** — `qa/QA-REGRESSION-PROMPT-v<version>.md`, the per-release human sign-off
checklist. Mandatory for every release including patches; superseded ones move to
`qa/archive/superseded-prompts/`.
