# QA regression — v1.236.0

Parent parity with career-ops `main` @ `6a9c84c` (VERSION 1.33.0, 128 commits).
**Two new sources (92 → 94), three mirrored fixes, one dependency bump.** Two of
the three fixes were losing postings here silently.

## §0 — Gates

```bash
node --test tests/sources-pythonorg.test.mjs                 # 43 pass
node --test tests/sources-generalist-world.test.mjs          # 36 pass
node --test tests/sources-workday-multi-location.test.mjs    # 9 pass
node --test tests/role-matcher-levels.test.mjs               # 5 pass
node --test tests/sources-avature-facets.test.mjs            # 4 pass
node --test tests/adapter-registry.test.mjs tests/scan-sources-endpoint.test.mjs \
           tests/scan-fallback-sources.test.mjs tests/site-sources.test.mjs \
           tests/help-source-counts.test.mjs                 # the count gates
npm run test:ci                                              # 3164 pass, exit 0
npm run test:e2e:browser                                     # 116 pass (unchanged)
node scripts/check-changelog-parity.mjs                      # green
node -e "import('./server/lib/sources/registry.mjs').then(m=>{const s=m.SOURCES;console.log(s.length, s.filter(x=>x.region==='en').length, s.filter(x=>x.region==='ru').length)})"   # 94 89 5
node -e "import('./server/lib/portals/registry.mjs').then(m=>console.log(m.ALL_ADAPTERS.length))"   # 89
gh api '/repos/Fighter90/career-ops-ui/dependabot/alerts?state=open' --jq length                    # 0
```

**3066 → 3164.** Every new case was confirmed failing first.

## §1 — What changed

### 1. A Workday role open in several cities was dropped by a location filter

Workday's LIST endpoint answers a multi-location posting with a **count** where
every other posting carries a place:

```
locationsText: "53 Locations"     ← not a location
```

`buildLocationFilter` matches by case-insensitive substring, so the string
matched no `allow: [austin]` entry and the posting was discarded — while the
same role listed singly passed. Measured upstream on three tenants: **53 of 291
postings** were placeholders.

The real places exist only in the CXS **detail** document. Each placeholder now
costs one GET against it (`${cxsBase}${externalPath}`), and:

| Situation | Behaviour |
|---|---|
| detail resolves | `location` = `' · '`-joined real places, deduped; `date` = `startDate` when it is a bare `YYYY-MM-DD` |
| detail 404s / throws / has no places | posting left **exactly** as the list returned it |
| past `MAX_DETAIL_REQUESTS` (200) | placeholder left **visible**, never faked |
| `resolveMultiLocation: false` | no detail request at all |

### 2. A stated level collapsed two requisitions into one repost

`role-matcher.mjs` had **no level handling at all**. `w.length > 3` drops every
roman numeral up to VIII and every single digit, so `"Insurance Specialist"`
and `"Insurance Specialist II"` tokenized identically and the repost detector
flagged the second as a re-listing of the first. Ported whole:

- `extractLevels` folds roman and arabic onto one number — `"Nurse II"` and
  `"Nurse 2"` are the same statement, and that pair wrongly **differed** before;
- two stated levels must agree (`Nurse 2` vs `Nurse 3` → not a repost);
- a level on one side alone is a loose rewrite **unless** each title also
  carries a non-baseline word the other lacks.

### 3. An Avature board pinned to a filter walked the whole global board

`resolveSearch` rebuilt the URL as `${origin}${path}` and dropped the query
string, so a pinned facet (`?42386=[812132]`) never narrowed anything — not even
on the first page. Facets now ride every paginated request; our `jobOffset` is
applied last, so a stray same-named facet cannot hijack pagination.

### 4. Two new sources, and the dependency bump

`pythonorg` (feed; employer attribution mandatory — an unattributable row is
dropped, not backfilled) and `generalist-world` (scrape; **throws** on card
markup it cannot parse rather than reading as an empty board). `devalue`
5.8.1 → 5.9.2 via `astro`, closing the open Dependabot alert (DoS on malformed
input); site-only, no runtime code.

## §2 — What to check

Behavioural markers (offline, run against any deployed tree):

```bash
# 1. the multi-location posting survives its filter
node -e "
Promise.all([import('./server/lib/sources/workday.mjs'), import('./server/lib/location-filter.mjs')])
 .then(async ([wd, { buildLocationFilter }]) => {
   const impl = async (u, i = {}) => (i.method || 'GET') === 'POST'
     ? { ok: true, status: 200, json: async () => ({ jobPostings: [{ title: 'SE', locationsText: '53 Locations', externalPath: '/job/M/S', bulletFields: ['x','S'] }] }) }
     : { ok: true, status: 200, json: async () => ({ jobPostingInfo: { location: 'Austin, TX', additionalLocations: ['Sunnyvale, CA'] } }) };
   const [j] = await wd.fetchWorkday('https://a.wd1.myworkdayjobs.com/wday/cxs/a/c/jobs', { fetchImpl: impl });
   console.log(buildLocationFilter({ allow: ['austin'] })(j.location) ? 'OK: kept — ' + j.location : 'FAIL');
 });"

# 2. levels separate requisitions, and roman == arabic
node -e "
import('./server/lib/role-matcher.mjs').then(({ roleFuzzyMatch: m }) => {
  const ok = !m('Registered Nurse 2','Registered Nurse 3') && m('Registered Nurse II','Registered Nurse 2');
  console.log(ok ? 'OK: levels respected' : 'FAIL');
});"

# 3. both new sources are in the registry
node -e "import('./server/lib/sources/registry.mjs').then(m=>{const v=m.SOURCES.map(s=>s.value);console.log(v.includes('pythonorg')&&v.includes('generalist-world')?'OK: 94 sources incl. both new':'FAIL')})"
```
A pre-fix tree prints `FAIL` on 1 and 2.

Manual browser pass:
- `#/scan` → Source filter lists **94**, including **Python.org Jobs** and
  **Generalist World** (both offline fallback and live registry).
- `#/help` §17 → "**94** adapters — **89 English + 5 Russian**" in every locale.

## §3 — Invariants

- **An unresolved placeholder stays visible.** Past the cap, or on a failed
  detail, `"53 Locations"` must remain — a blanked location silently passes
  every filter, which is worse than an honest unresolved one.
- **A single-location posting costs no extra request.** The detail GET fires
  only for a placeholder.
- **`isMultiLocationPlaceholder` is anchored** — `"100 Locations Plaza"` is a
  real place, not a count.
- **`dateFromDetail` refuses to guess** — anything but a bare `YYYY-MM-DD`
  leaves the existing date alone.
- **Roman and arabic levels fold onto one number**, and an exact title match
  still short-circuits every level rule.
- **Avature: exactly one `jobOffset`** reaches the wire, and it is ours.
- **`generalist-world` fails loud**: unparseable cards throw; they must never
  read as an empty board.
- **`pythonorg` drops an unattributable row** rather than backfilling the
  portal entry's name as the employer.
- Registry: `SOURCES.length === 94` (89 EN + 5 RU), `ALL_ADAPTERS.length === 89`.
- Fork divergences intact: Cyrillic `\p{L}` in `providers/telegram-channel.mjs`,
  own `providers/telegram.mjs`, `hermes` in `web/src/lib/clis.ts`.

## §4 — Not ported (and why)

| Parent change | Decision |
|---|---|
| **lever** 30s / **manfred** 25s timeouts | **no-port** — web-ui's scan transport already allows **60s**, more headroom than the fix grants upstream |
| **iCIMS** doubled `careers-` prefix | cannot occur — web-ui takes the origin straight from `api`/`careers_url`, never constructs a host from a tenant name |
| **iCIMS** fallback-host walk | a feature for the parent's looser config, not a defect fix here |
| **deutschebahn** / **manfred** retry-on-abort | noted, not ported — the 60s ceiling makes it far less pressing; first thing to try if a long walk ever times out |
| `liveness-browser`, `check-jd-archive`, `verify-*`, `update-system`, `set-status`, `audit-portals`, `discover-ats`, `scaffolder`, `test-all` | CLI / verifier surface, no web-ui relay |
| `web/`, `dashboard/`, `modes/`, plugin manifests | the parent's own frontend and repo infra, not mirrored |

## §5 — Sign-off

- [ ] §0 gates green with the exact counts, `npm run test:ci` exit 0
- [ ] §2 markers print `OK` locally **and** on the server tree
- [ ] Deploy verified by sha256 on both sides; `career-ops-scan` state unchanged
- [ ] README ×17 banner + badges, CHANGELOG ×17, help ×17 (**94** / **89 EN**), site mirrors ×17, wiki ×17 at v1.236.0 / 3164 / 94
- [ ] 0 open Dependabot and code-scanning alerts
