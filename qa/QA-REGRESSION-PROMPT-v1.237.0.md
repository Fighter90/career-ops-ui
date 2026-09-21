# QA regression — v1.237.0

Parent parity with career-ops `main` @ `93c4302b` (VERSION 1.33.0, 75 commits pulled from `career-ops-hq/main`).
**No new sources.** Four mirrored fixes; two of them were losing postings here silently, and one of those was
asserted-as-correct by two of our own tests.

## §0 — Gates

```bash
node --test tests/sources-jobstreet-market-path.test.mjs      # 13 pass
node --test tests/sources-oraclecloud-short-page.test.mjs     # 7 pass
node --test tests/liveness-core-soft-expiry.test.mjs          # 9 pass
node --test tests/adapters-personio-tenant-pin.test.mjs       # 8 pass
node --test tests/sources-config-providers.test.mjs \
           tests/sources-url-encoding-surrogate.test.mjs      # the two repaired assertions
node --test tests/adapter-registry.test.mjs tests/scan-sources-endpoint.test.mjs \
           tests/scan-fallback-sources.test.mjs tests/site-sources.test.mjs \
           tests/help-source-counts.test.mjs                  # count gates — must be UNCHANGED
npm run test:ci                                               # 3201 pass, exit 0
npm run test:e2e:browser                                      # 116 pass (unchanged)
node scripts/check-changelog-parity.mjs                       # green
node -e "import('./server/lib/sources/registry.mjs').then(m=>{const s=m.SOURCES;console.log(s.length, s.filter(x=>x.region==='en').length, s.filter(x=>x.region==='ru').length)})"   # 94 89 5
node -e "import('./server/lib/portals/registry.mjs').then(m=>console.log(m.ALL_ADAPTERS.length))"   # 89
gh api '/repos/Fighter90/career-ops-ui/dependabot/alerts?state=open' --jq length                    # 0
```

**3164 → 3201** (+13 jobstreet, +7 Oracle Cloud, +9 liveness, +8 Personio). Every new case was confirmed failing first.
Counts must NOT move: 94 sources, 89 EN, 5 RU, 89 adapters.

## §1 — What changed

### 1. Jobstreet / SEEK built a dead link for every non-Indonesian market

`parseJobstreetItem` produced `${baseUrl}/id/job/${id}` for every host. `/id/` is the **Indonesian locale prefix**,
not part of the path. `www.seek.com.au`, `www.seek.co.nz`, `sg.jobstreet.com`, `my.jobstreet.com` and `hk.jobsdb.com`
were already in `ALLOWED_JOBSTREET_HOSTS`, so those postings passed validation and were returned to the user —
each pointing at a **404**. Now keyed on the host via `ID_LOCALE_HOSTS` + `jobDetailPath()`; an unparseable origin
falls through to `/job/` instead of throwing.

**Two of our own tests had encoded the bug** and were corrected, not worked around:
`tests/sources-config-providers.test.mjs` (`hk.jobsdb.com/id/job/92996157`) and
`tests/sources-url-encoding-surrogate.test.mjs` (`www.jobstreet.com/id/job/g-1`).

### 2. Oracle Cloud stopped at the first short page and dropped the tail

Old rule: `listLen === 0 || listLen < PAGE_SIZE` ends the walk. ORC filters rows server-side, so a short page
appears **mid-list**. Measured upstream on American Express: `TotalJobsCount` 454, pages of 200 / 199 / 54 — the
199 ended the walk and the last **54 postings (12% of the board)** were never fetched. New rule: empty page always
ends; with a reported total, page until `offset + PAGE_SIZE >= total`; only a tenant reporting no total ends on a
short page. `hasMore` stays ignored. `MAX_PAGES` is now the sole backstop against a bogus total.

### 3. Liveness missed "This role is closed"

`/this job (listing )?is closed/i` → `/this (?:job|role|position)(?: listing)? is closed\b(?!-)/i`.
One board upstream: **111 of 111** uncertain postings used "role". The `\b(?!-)` is a compound-adjective guard —
`\b` alone rejects `closedown` but still matches *"This role is closed-loop control of the platform"*.

### 4. `job expired` moved to a soft tier

`HARD_EXPIRED_PATTERNS` is checked **before** the apply-control test, so anything there beats a live posting.
`/\bjob expired\b/i` false-fires on similar-jobs carousels, "Hide job expired" filter chips and footer FAQs.
It now lives in `SOFT_EXPIRED_PATTERNS`, checked after the apply control and before the listing-page heuristic,
returning `expired_body_soft`. A bare "JOB EXPIRED" page with no apply control still expires.
**Why this direction matters:** a false `expired` is written to scan history as `skipped_expired` and then
dedup-filters a real job out of *every later scan*, indefinitely, unless `scan_history.recheck_after_days` is set.

### 5. Added — Personio tenant pin, Jobstreet `appendWorkType`

`personio: <slug>` pins an iframe-embedded board to `<slug>.jobs.personio.de`. Anchored slug allowlist, still
gated by `PERSONIO_HOST_RE`; normalised through `new URL()` because web-ui's host regex is case-sensitive.
`appendWorkType` (off by default) suffixes titles with `[Part time]` etc.

## §2 — What to check in the browser

1. `#/scan` — Source filter still lists **94** sources; `jobstreet`, `oraclecloud`, `personio`, `telegram`
   and `telegram-channel` all present. Nothing added, nothing missing.
2. Run a scan against a **Jobstreet AU/NZ** entry (siteKey `AU-Main`, api `https://www.seek.com.au/api/jobsearch/v5/search`).
   Open a result: the URL must be `https://www.seek.com.au/job/<id>` and must **load a real posting, not a 404**.
3. Run a scan against an **Indonesian** entry: URLs must still carry `/id/job/<id>` and still load.
4. With `appendWorkType: true` on a Jobstreet entry, titles show `… [Part time]`; without it, titles are untouched.
5. **Oracle Cloud** — scan a large tenant (400+ postings). The result count must exceed the old first-page-ish
   ceiling; spot-check that postings from the final page are present.
6. **Personio** — an entry with `personio: <slug>` and a `careers_url` on the company's own domain must scan the
   Personio board. A slug containing a dot/slash/@ must fall back, never reach another host.
7. `#/tracker` → **Still live?** — a posting reading "This role is closed" reports expired; a live posting whose
   page merely contains "Job Expired" in a carousel or filter chip while showing an Apply button reports **active**.

## §3 — Invariants

- Counts frozen: 94 / 89 EN / 5 RU / 89 adapters. Any movement is a regression this release.
- `hasMore` is still never read in Oracle Cloud code (comments only).
- Jobstreet lone-surrogate guard intact: a bad id leaves `url` empty and falls through to `item.jobUrl`, never throws.
- Personio: host allowlist and HTTPS check remain the only gate; `redirect:'error'` untouched.
- Liveness guard order unchanged: hard expired → existing guards → apply control → **soft expired** → listing page.
- All new suites are CI-isolated: fake transport, no network, no `CAREER_OPS_ROOT`.
- URL assertions use extraction + strict `===` (no `String.includes`, no unanchored regex).

## §4 — Not ported (and why)

- **`providers/telegram.mjs` deletion — deliberately NOT followed.** web-ui registers both `telegram` and
  `telegram-channel` as user-facing sources; following the parent would drop the registry 94 → 93 and break
  anyone with `telegram` configured. Revisit only as an announced removal.
- `jd-skill-gap.mjs` — web-ui **relays** it; the parent fix arrives with the deployed parent.
- `lib/latex-escape.mjs`, `browser-extract.mjs`, `openai-eval.mjs`, `update-system.mjs`, scaffolder — not mirrored.
- Go dashboard TUI, `web/` config form — separate surfaces.
- `doctor.mjs`, `analyze-patterns.mjs` — read-only relays; fail-soft absorbs the change.

## §5 — Sign-off

- [ ] §0 gates all green, `test:ci` exit 0 at 3201
- [ ] AU/NZ Jobstreet link opens a real posting (was a 404 before)
- [ ] Indonesian Jobstreet link still opens
- [ ] Oracle Cloud large tenant returns the full board
- [ ] Personio pin resolves; hostile slug falls back
- [ ] "This role is closed" expires; carousel "Job Expired" + Apply button stays active
- [ ] Counts unmoved at 94 / 89 / 5 / 89
- [ ] docs ×17, site ×17, wiki ×17 carry v1.237.0
