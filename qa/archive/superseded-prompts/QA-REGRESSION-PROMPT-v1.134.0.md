# QA REGRESSION PROMPT — career-ops-ui **v1.134.0** (parent career-ops v1.25.0 parity)

Delta regression for the new **getManfred** scan source + provider correctness fixes. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.134.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                         # full suite — 2184, exit 0 (capture $? directly, never | grep)
node --test tests/sources-manfred.test.mjs       # new source: parse/dedupe/salary/dead-board-throw
node --test tests/adapter-registry.test.mjs      # ALL_ADAPTERS.length === 68, sorted ids incl. 'manfred'
node --test tests/scan-sources-endpoint.test.mjs # EN set incl. 'manfred'
node --test tests/scan-fallback-sources.test.mjs # FALLBACK_SOURCES value+label parity (manfred → getManfred)
node --test tests/site-sources.test.mjs          # SOURCE_URLS covers every registry value (incl. manfred)
node --test tests/sources-cryptocurrencyjobs.test.mjs tests/sources-radancy.test.mjs tests/sources-successfactors.test.mjs tests/sources-workable.test.mjs tests/sources-a16z-speedrun-talent.test.mjs
node scripts/check-changelog-parity.mjs          # all 16 locales at v1.134.0
```

## §1 — What changed

Parent **v1.25.0** parity — one new source + four provider fixes. Registry now **73 sources = 68 EN + 5 RU** (`ALL_ADAPTERS` 68).

1. **New source: getManfred** (`manfred`) — board-wide Spanish/EU tech feed with published salaries (`www.getmanfred.com/api/v2/public/offers`, zero-auth, host-pinned, single-request full catalogue).
2. **a16z Speedrun** — `PER_PAGE` 100→50 (feed caps a page at 50; was truncating to 50 jobs after page 1).
3. **Dead-board-throw** on `cryptocurrencyjobs` / `phenom` / `radancy` / `successfactors` — a total outage (no request ever resolved) now **throws** instead of `return []`, so `#/portals` health + the scan record a real failure; a mid-scan failure keeps partials.
4. **workable** — public widget API (`apply.workable.com/api/v1/widget/accounts/<slug>`) so large accounts scan fully.

## §2 — Manual browser pass

1. **`#/scan` Source filter** — open the Source dropdown; **getManfred** appears (both offline FALLBACK and the live registry list). Selecting it and scanning (VPN off if needed) returns Spanish/EU roles, many with a salary.
2. **`#/portals` health** — a company whose board is genuinely down now shows a **failure** state (not a false "reachable, 0 roles").
3. **cvstart.org landing** (after Pages redeploy) — the Job-sources section chip count reads **73** and includes a **getManfred** chip linking to `getmanfred.com`.
4. No new UI strings/i18n keys this release — nothing else in the chrome changes.

## §3 — Contract & security invariants

- **SSRF:** manfred + workable widget hosts are host-pinned (exact host, HTTPS-only, `redirect:'error'`); no user input reaches an off-host fetch.
- **Read-only / scanners in-process:** no new writes; the EN/RU scanners still run in-process (no shell into `scan.mjs`).
- **Dead-board contract:** a source THROWS only when nothing resolved; a partial scan is preserved (proof-of-life). Verified by the per-source suites.
- **Registry parity:** the four gate lists (adapter-registry ids, scan-sources EN set, `FALLBACK_SOURCES`, `SOURCE_URLS`) all include `manfred`; the drift gates prove FALLBACK value+label parity.

## §4 — Not ported (parent parity note)

detect-reposts #2389 title-bucketing (perf-only over web-ui's small in-process history); the Unicode company-key fixes (`company-history` / `fingerprint-core` / `tracker-utils` — not mirrored; web-ui's tracker dedup is already non-Latin-safe); `scan --since`; `cv-facts` / `verify-cv-facts`; the CV Awards/Honors template + hiring-manager audit PDF pass; `doctor`; the modes untrusted-content directive.

## §5 — Sign-off

All §0 gates green (2184, exit 0) · getManfred in the `#/scan` Source filter + on the landing (73 sources) · dead boards surface a real failure on `#/portals` · registry gates + drift gates green · SSRF host-pinning intact · no new i18n keys · CHANGELOG parity ×17.
