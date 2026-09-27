# QA regression — v1.238.0

Parent parity with career-ops `main` @ `993085ce` (VERSION 1.34.0, 182 commits since
`de2224a9`). **Counts move: 94 → 98 sources (93 EN + 5 RU), 89 → 93 EN adapters.**
One scanner-wide security fix (DNS-rebinding guard), four new sources, ten mirrored
provider fixes, and a title-fit chip on `#/scan`.

## §0 — Gates

```bash
node --test tests/sources-eploy.test.mjs                     # 44 pass
node --test tests/sources-hiringroom.test.mjs                # 24 pass
node --test tests/sources-peoplesoft.test.mjs                # 68 pass
node --test tests/sources-prevueaps.test.mjs                 # 22 pass
node --test tests/fetch-timeout-dns-guard.test.mjs           # 4 pass — red on v1.237.1
node --test tests/title-fit.test.mjs                         # 24 pass
node --test tests/cooldown-company-match-unicode.test.mjs tests/liveness-api-more-rungs.test.mjs \
           tests/ru-scanner-title-accent-fold.test.mjs tests/sources-rippling.test.mjs \
           tests/sources-recruitee.test.mjs tests/sources-telegram-channel.test.mjs \
           tests/workday-fallback.test.mjs tests/critical-fixes.test.mjs
node --test tests/adapter-registry.test.mjs tests/scan-sources-endpoint.test.mjs \
           tests/scan-fallback-sources.test.mjs tests/site-sources.test.mjs \
           tests/help-source-counts.test.mjs tests/http-accept-encoding.test.mjs  # count + transport gates
npm run test:ci                                              # 3481 pass (3478 + 3 skipped), exit 0
npm run test:e2e:browser                                     # 116 pass
npm run test:e2e && npm run test:e2e:full                    # smoke + 23/23 comprehensive
node scripts/check-changelog-parity.mjs                      # green at 1.238.0 ×16
node tools/i18n-audit.mjs                                    # clean
node evals/workflow/run.mjs                                  # green
```

**3210 → 3481.** Local note: in a sandbox whose egress uses a private CA, Chromium must
trust that CA or ~44 browser tests fail at once on `ERR_CERT_AUTHORITY_INVALID` (an
external font). That is environment, not code — CI is unaffected.

## §1 — What changed

1. **DNS-rebinding guard now runs on real scans.** `guardResolvedHost` fired only when a
   helper got the bare global `fetch`; both scanners inject `makeTimeoutFetch()`, so it was
   skipped on every scan. It now runs inside `makeTimeoutFetch`, raced against the scan
   timeout (a stalled resolver cannot hang a scan), and a timeout during the fetch never
   surfaces as an unhandled rejection.
2. **IPv4-embedded IPv6** (`::ffff:a.b.c.d`, `::a.b.c.d`, dotted and hex) is private when the
   embedded address is.
3. **New sources:** `eploy` (explicit `provider:`; `/live-jobs.xml`), `hiringroom`
   (`*.hiringroom.com`), `peoplesoft` (Candidate Gateway path on a branded host; manual
   same-origin redirects, cookie jar, load-more replay, `peoplesoftIncomplete` marker),
   `prevueaps` (`*.prevueaps.ca`).
4. **Mirrored fixes:** rippling v2 board API + slug validation; recruitee multi-location,
   `(Sample)`/demo and title-less rows; pinpoint demo postings; telegram-channel multi-pipe
   first line; workday dead-board probe + redirects refused; bamboohr embed-feed triage;
   hecklerkoch/rheinmetall bare-domain rewrite; ashby redirect refusal; beesite cancellable
   pacing; accent-folded title filters (EN + RU); Unicode `companyMatch` in cooldown;
   `location_filter.strict`; liveness rungs (greenhouse embed, arbeitsagentur, wwr,
   smartrecruiters `active`).
5. **Title-fit chip** on each `#/scan` row — `strong` / `related` / `weak fit` vs
   `config/profile.yml` target roles. Annotation only.

## §2 — Manual browser pass

1. `#/scan` → Source dropdown lists **Eploy, HiringRoom, PeopleSoft Candidate Gateway,
   PrevueAPS** (98 entries total).
2. With `config/profile.yml` carrying `target_roles.primary: [Platform Engineer]` and a last
   scan containing "Senior Platform Engineer" and "Accountant": the first row shows a green
   **strong fit** chip, the second **weak fit** or none; hover shows the "not an evaluation"
   tooltip. Row order and the total are unchanged. Switch locale to ru/ja/ar — chip localizes.
3. Delete or break `profile.yml` → no chips, no console error.
4. `/api/health` reports `version: 1.238.0`.

## §3 — Contract / security invariants

- No source calls `fetch(` / `globalThis.fetch` directly (guard in `http-accept-encoding`).
- PeopleSoft never leaves the tenant origin: off-origin `Location`, `http:`, private
  literal/resolved host, off-origin form action — each refused before a request.
- `redirect:'error'` stays the default transport posture.
- Title-fit never mutates `data/last-scan.json` and never changes counts or order.
- Telegram-channel Cyrillic `LOCATIONISH_RE` intact (`grep -c 'p{L}'` = 4).

## §4 — Not ported / not applicable

Location-filter Unicode word edges (web-ui filter is substring-based), requisition-aware
dedup (URL-only dedup here), aggregator repost warnings, blacklist domain scope,
unverified-zero receipts, `scan-runs.tsv` migration, workday facet-split / truncation tags,
bamboohr `enrichDate`, the parent `_http.mjs` sleep refactor, updater / doctor / PDF /
tracker / `validate-profile` / `discover-new-companies` / `web/` Next.js / GitHub bots.
Deliberate divergences: HTTPS-only for hecklerkoch/rheinmetall; dead Workday board in a
normal scan returns `[]`.

## §5 — Sign-off

- [ ] §0 gates green with the counts above
- [ ] §2 steps 1–4 in a real browser
- [x] `/api/health` on resumecraft.ru reports 1.238.0 and `parentVersion` 1.34.0 (deploy + verify runs, 2026-09-27)
