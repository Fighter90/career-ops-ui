# QA regression — v1.240.0

Parent parity with career-ops `main` @ `62905981` (VERSION 1.35.0, 177 upstream commits
since `b39931e`). **Counts move: 103 → 109 sources (104 EN + 5 RU), 98 → 104 EN adapters.**
Six new sources, fixes mirrored into eight providers, and the checklist `pipeline.md`
format contributed by @bullitt186 (#380).

## §0 — Gates

```bash
node --test tests/sources-adp-workforcenow.test.mjs   # 38 pass
node --test tests/sources-gupy.test.mjs               # 43 pass
node --test tests/sources-jazzhr.test.mjs             # 46 pass
node --test tests/sources-startup-jobs.test.mjs       # 25 pass
node --test tests/sources-taleo.test.mjs              # 39 pass
node --test tests/sources-ultipro.test.mjs            # 51 pass
node --test tests/parsers-pipeline-checklist.test.mjs # 10 pass  (#380)
node --test tests/sources-location-country-fold.test.mjs tests/sources-deutschebahn-blanked-page.test.mjs \
           tests/sources-higheredjobs-challenge-page.test.mjs tests/sources-mokahr.test.mjs \
           tests/sources-avature.test.mjs tests/sources-successfactors.test.mjs tests/sources-parity-v1118b.test.mjs
node --test tests/reports-list-cache.test.mjs         # 3 pass — must pass on a dev machine too
node --test tests/adapter-registry.test.mjs tests/scan-sources-endpoint.test.mjs \
           tests/scan-fallback-sources.test.mjs tests/site-sources.test.mjs \
           tests/help-source-counts.test.mjs                      # count gates: 104 adapters / 109 sources
npm run test:ci                                              # 4056 pass, exit 0
npm run test:e2e:browser                                     # 116 pass
node scripts/check-changelog-parity.mjs                      # green at 1.240.0 ×16
node tools/i18n-audit.mjs                                    # clean
node evals/workflow/run.mjs                                  # green
```

**3782 → 4056.** A whole-suite failure at once is environment (a missing Playwright browser);
a scattered failure is code.

## §1 — What changed

1. **New sources:** `adp-workforcenow` (`workforcenow.adp.com` + `cid`/`ccId`), `gupy` (board-wide
   keyword sweep), `jazzhr` (`*.applytojob.com`), `startup-jobs` (RSS), `taleo`, `ultipro`.
2. **Mirrored fixes:** country folded into location (ashby, breezy, recruitee); mokahr `hire-r1`
   host + in-band `success:false` throws; avature `article--jobs` cards; successfactors
   `/go/<Category>/<id>/` URL; deutschebahn blanked-page walk; higheredjobs Incapsula-200 throws.
3. **Pipeline checklist format (#380):** `parsePipeline` / `addPipelineUrl` / `removePipelineUrl`
   read and write `## Pending` / `## Processed` `- [ ]` rows; the fenced format is unchanged.
4. **Test isolation:** `reports-list-cache` now writes `cv.md` into its temp root.
5. **Parent** brought to upstream (0 behind); ADR-0002 divergences intact.

## §2 — Manual browser pass

1. `#/scan` → Source dropdown lists the six new names (**109** entries).
2. With a project whose `data/pipeline.md` is in the parent's checklist format (`## Pending`
   with `- [ ] url | company | …`): the **Pipeline** page shows those rows as pending, not 0;
   adding a URL from the UI appends a `- [ ]` row under `## Pending` (no code fence appears).
3. `#/config` → Portals: a `tracked_companies` entry with `provider: taleo` and a Taleo
   `careers_url`, and one with a `*.applytojob.com` URL, resolve (no "no adapter" warning).
4. `/api/health` reports `version: 1.240.0`, `parentVersion: 1.35.0`.

## §3 — Contract / security invariants

- No source calls `fetch(` directly; every new source is host-pinned, HTTPS-only, `redirect:'error'`.
- A malformed / HTML / truncated feed throws (startup-jobs, higheredjobs, adp, ultipro, taleo) —
  never an empty board.
- `region` is `en` or `ru` only — an unknown region makes the registry skip the source silently.
- Telegram-channel Cyrillic `LOCATIONISH_RE` intact (`grep -c 'p{L}'` = 4).

## §4 — Not ported / not applicable

Trusted-proxy egress (`_http.mjs`/`_ip-guard.mjs`/`_dns-cache.mjs`), `scan-history.tsv` column
registry and language-aware requisition dedup, SmartRecruiters `requisitionId`/`language`, Gem
`isoCountry` (needs the 249-entry alpha-3 table), and every CLI-only change (modes, updater,
doctor, ATS payload, tracker scripts, Go dashboard, `sg` mode).

## §5 — Sign-off

- [ ] §0 gates green with the counts above
- [ ] §2 steps 1–4 in a real browser
- [ ] `/api/health` on resumecraft.ru reports 1.240.0 and `parentVersion` 1.35.0
