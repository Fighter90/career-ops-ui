# QA regression — v1.239.0

Parent parity with Fighter90/career-ops @ `b39931e`. Five new sources for K-12,
public-sector and Mexican boards, and three mirrored provider fixes.
**Counts:** 103 sources (98 EN + 5 RU) / 98 adapters (was 98 / 93).
**Tests 3500 → 3774.**

## §0 — Gates

```bash
node --test tests/sources-applitrack.test.mjs          # 43 pass
node --test tests/sources-neogov.test.mjs              # 61 pass
node --test tests/sources-occ.test.mjs                 # 48 pass
node --test tests/sources-redrover.test.mjs            # 45 pass
node --test tests/sources-schoolspring.test.mjs        # 55 pass
node --test tests/greenhouse-embed-slug.test.mjs       # 7 pass — `?for=` only on Greenhouse hosts, no `.`/`..` slug
node --test tests/workday-myworkdaysite.test.mjs       # 6 pass
node --test tests/report-link-parens.test.mjs          # 4 pass
node --test tests/adapter-registry.test.mjs tests/scan-sources-endpoint.test.mjs  # lists = live registry
npm run test:ci                                        # 3774 (3771 + 3 skipped), exit 0
npm run test:e2e:browser                               # 116 pass
node evals/workflow/run.mjs                            # 0 fail
```

## §1 — What changed

1. **New sources** (each: `server/lib/sources/<id>.mjs` + EN adapter + suite):
   `applitrack` (Frontline AppliTrack), `neogov` (SchoolJobs / GovernmentJobs),
   `occ` (OCC Mundial — explicit `provider: occ` only), `redrover` (Red Rover),
   `schoolspring`. All go through the injected `fetchImpl` (DNS-rebinding guard,
   pinned encoding).
2. **Greenhouse embed.** `?for=<slug>` is read only on real Greenhouse hosts; a
   slug must start with a letter or digit (`.`/`..` would normalise the API path).
3. **Workday myworkdaysite.** `wd*.myworkdaysite.com/recruiting/<tenant>/<site>`
   boards resolve to the CXS endpoint; job links and Referer follow the host.
4. **Report links.** A tracker row whose report name contains parentheses keeps
   the whole path.

Not ported (CLI-only in the parent): PDF/CV templates, scaffolder, batch,
career-profile, ATS keyword coverage, interview-mode translations, `pi` CLI host.

## §2 — Manual pass

1. `#/scan` source dropdown lists 103 entries, the five new ones included, in
   every locale; `/api/scan/sources` returns 103.
2. `/help` ×17 states 103 sources / 98 EN adapters.
3. cvstart.org sources section shows the five new logos/links.

## §3 — Invariants

- ADR-0002 divergences intact (`p{L}`×4, `providers/telegram.mjs`, `hermes`, `vpFixtureEnv`×9).
- The reports route still refuses parentheses in a name (known follow-up, unchanged).
- No finding, summary or step log of `remote-qa.yml` contains the prod hostname.

## §5 — Sign-off

- [ ] §0 gates green with the counts above
- [ ] deploy parent `b39931e` + v1.239.0, `verify`: 103 sources served == registry, NRestarts 0, no new 502s
- [ ] remote QA green on prod, including `live: true`
