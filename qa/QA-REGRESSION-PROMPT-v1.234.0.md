# QA regression — v1.234.0

Parent parity with career-ops `main` @ `56cce8f` (VERSION still 1.32.0; 58
commits past the 1.32.0 tag). One mirrored fix across **15 sources**, one
decode guard, one registry convention, and a guard test so the fix cannot
regress. **No UI changes. Source count unchanged at 92.**

## §0 — Gates

```bash
node --test tests/sources-url-encoding-surrogate.test.mjs       # 20 pass (helper 1 + per-source 16 + guard 3)
node --test tests/sources-registry-discovery.test.mjs           # 14 pass
node --test tests/sources-alibaba.test.mjs tests/sources-arbeitsagentur.test.mjs tests/sources-bamboohr.test.mjs \
  tests/sources-feishu-jobs.test.mjs tests/sources-garena.test.mjs tests/sources-jibeapply.test.mjs \
  tests/sources-manfred.test.mjs tests/sources-meituan.test.mjs tests/sources-mokahr.test.mjs \
  tests/sources-phenom.test.mjs tests/sources-thehub.test.mjs tests/sources-tkms.test.mjs \
  tests/sources-vdab.test.mjs tests/sources-jobstreet.test.mjs tests/sources-rheinmetall.test.mjs \
  tests/sources-trudvsem.test.mjs                                # 129 pass — every touched source's own suite
npm run test:ci                                                 # 3042 pass, exit 0
npm run test:e2e:browser                                        # 116 pass (unchanged)
node scripts/check-changelog-parity.mjs                         # green
cd site && npm run build && cd ..                               # exit 0; facts.json version 1.234.0 / tests 3042 / adapters 92
node -e "import('./server/lib/sources/registry.mjs').then(m=>console.log(m.SOURCES.length))"   # 92, and NO
                                                                # "[sources/registry] _safe-url.mjs has no valid export const meta" line
```

**3022 → 3042.** All 16 per-source cases were confirmed failing before the port
(15 with `URIError: URI malformed`, thehub via its fetcher); the guard test was
confirmed failing on the unconverted tree with the full offender list; the
registry test was confirmed failing with the old filter restored.

## §1 — What changed

### The defect

`encodeURIComponent` throws `URIError` on a lone UTF-16 surrogate. A JSON
payload can carry one — `JSON.parse('"\uD800x"')` succeeds and keeps it — so a
board that emits one malformed id (a truncated emoji in a slug, a bad
transcode upstream) hands the source a string it cannot encode.

Fifteen sources built each posting's URL from that host-controlled id or slug
**inside** the parse loop:

```js
for (const p of list) {
  …
  jobs.push({ url: DETAIL + encodeURIComponent(id), … });   // throws → loop dies → page lost
}
```

One bad posting unwound the loop and lost every job on the page. Nothing was
logged as a *source* failure, because the throw escaped before the per-company
catch had a page to report on — the board simply showed fewer jobs.

### The fix (mirror of parent `d76bea0`, `7bee848`, `fd3966a`, `6efda1c`)

`server/lib/sources/_safe-url.mjs` — `safeEncodeURIComponent(value)`:
coerces with `String()` **outside** the try (so a throwing `toString` is the
caller's bug and propagates), returns `null` on `URIError`, rethrows anything
else. Each converted loop:

```js
const encodedId = safeEncodeURIComponent(id);
if (encodedId === null) continue;        // or `return null` in a per-item normalizer
```

| Source | Value routed | On null |
|---|---|---|
| alibaba, meituan, feishu-jobs, mokahr | `id` | `continue` |
| bamboohr | `id` | `return null` + trailing `.filter(Boolean)` |
| jibeapply | `slug` | `continue` |
| manfred | `slug` | `return null` (normalizer) |
| arbeitsagentur, vdab | `refnr` / `rawId` — also used in the `id:` field, now the same encoded value | `return null` |
| phenom, tkms | `id` (tkms also `cfg.locale`, shared for one consistent call) | `continue` |
| thehub | `id` | `return null` (normalizer) |
| garena | API `id` via new `idUrlSegment` (null on `.`/`..` or surrogate); config `office` **stays** on the throwing `urlSegment` | `continue` |
| **jobstreet** (web-ui-only) | `item.id` — a bad id leaves `url` empty so the posting falls through to its own `jobUrl` or is dropped | falls through |
| **trudvsem** (web-ui-only) | `v.id` — a bad id without a `vac_url` drops the posting; with one, the posting keeps it | `return null` |

**rheinmetall** — the other side of the same shape: its title fallback runs
`decodeURIComponent` on the scraped href's slug, which throws on a malformed
percent-sequence. Now `try { decode } catch { raw slug }`.

**registry.mjs** — `_`-prefixed files are neither imported nor warned about
(parent convention). Before this, the helper produced
`[sources/registry] _safe-url.mjs has no valid export const meta — skipped` on
every boot.

**site/scripts/sync-assets.mjs** — its on-disk adapter count (the guard that
catches a source silently dropped by a failed import, v1.212.0) now applies
the same `_` rule; without it the site build failed with `93 adapter files on
disk but the registry enumerated only 92`.

### The guard

`tests/sources-url-encoding-surrogate.test.mjs` §3 reads every source file:
1. each of the 15 CONVERTED files must import `./_safe-url.mjs` **and** call
   `safeEncodeURIComponent` — dropping either fails with the file name;
2. no file may reference the helper without importing it;
3. no file outside ALLOWLIST may have a line matching
   `/\burl\s*[:=][^\n]*\bencodeURIComponent\s*\(/`. The allowlist is two entries,
   each with its reason: `4dayweek.mjs` (slug validated against `SLUG_RE`,
   ASCII-only, before encoding) and `csod.mjs` (`corpName` from `portals.yml`
   — a config bug should fail loud).

jobstreet and trudvsem are in CONVERTED **because** the guard found them: they
are web-ui-only, so the parent's suite could not have.

## §2 — What to check

Behavioural marker (works on any deployed tree, no network):

```bash
node -e "
import('./server/lib/sources/alibaba.mjs').then(({ parseAlibabaResponse }) => {
  const r = parseAlibabaResponse({ content: { datas: [
    { name: 'Bad',  id: '\uD800bad' },
    { name: 'Good', id: 'g-1' } ], totalCount: 2 } }, 'Acme');
  console.log(r.jobs.length === 1 && r.jobs[0].url.endsWith('g-1') ? 'OK: bad posting dropped, page kept' : 'FAIL');
});"
```
Pre-fix trees print `URIError: URI malformed`. Repeat with any converted source
if a specific board is in question — the fixtures are all in §2 of the test.

Manual browser pass (unchanged behaviour, sanity only):
- `#/scan` → Source filter still lists 92 sources; run one EN board (e.g.
  **bamboohr** or **thehub**) — results render, no console error.
- `#/health` → no registry warning in the server log at boot.

## §3 — Invariants

- **Scope of the null path is API data only.** A config-derived value that
  cannot be encoded must still throw: `garena.urlSegment('office', '..')`
  throws; `csod` and `4dayweek` are allowlisted, not converted. Do not "fix" a
  future guard hit by allowlisting an API id.
- **A paired surrogate is not an error.** `safeEncodeURIComponent('😀')` →
  `%F0%9F%98%80`. Only a *lone* half returns null.
- **`String()` coercion happens before the try.** An object whose `toString`
  throws propagates a `TypeError` — the helper must not swallow caller bugs.
- **Dedup keys follow the encoded value** where the id doubles as the key
  (arbeitsagentur `byRef`, vdab `byId`, thehub, phenom, tkms): a dropped
  posting must not leave a phantom key.
- Sources registry: `SOURCES.length === 92`; `ALL_ADAPTERS` unchanged; the
  `scan-fallback-sources` drift gate untouched.
- Fork divergences intact after the pull: Cyrillic `\p{L}` in
  `providers/telegram-channel.mjs`, own `providers/telegram.mjs`, `hermes` in
  `web/src/lib/clis.ts`, `vpFixtureEnv` ×9 in `test-all.mjs`.

## §4 — Not ported (and why)

| Parent change | Decision |
|---|---|
| `batch/batch-runner.sh --cli` flag | CLI-only; web-ui does not shell into the batch runner |
| `invite-match.mjs` resolves `set-status.mjs` from the code root | web-ui does not relay invite-match |
| `company-funded.mjs` safe-url change | internal; `--json` shape parsed by `/api/company-funded` unchanged — relay absorbs it |
| `test-all.mjs` timeout budget | parent test harness; fork divergence (`vpFixtureEnv`) intact |
| `web/` | parent's own frontend, not mirrored |
| `AGENTS.md`, `SIGNATURES.md` | repository-only |

## §5 — Sign-off

- [ ] §0 gates green with the exact counts above, `npm run test:ci` exit 0
- [ ] §2 behavioural marker prints `OK` on local **and** on the server tree
- [ ] Deploy verified by sha256 on both sides (not by version string), `career-ops-scan` state unchanged before/after
- [ ] README ×17 banner + badges, CHANGELOG ×17, site changelog mirrors ×17, wiki ×17 carry v1.234.0 / 3042
- [ ] Help ×17 untouched (source count unchanged)
