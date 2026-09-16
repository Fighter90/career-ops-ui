# QA regression — v1.235.0

Parent parity with career-ops `main` @ `68e6b94` (VERSION 1.33.0, 42 commits).
**Two mirrored fixes.** One repairs a live silent loss in web-ui (MokaHR
postings sharing a dedup key); the other is preventive hardening with one
behaviour change today. **No UI changes. Sources unchanged at 92.**

## §0 — Gates

```bash
node --test tests/url-key.test.mjs                        # 8 pass
node --test tests/parsers-pipeline-hash-route.test.mjs     # 4 pass
node --test tests/http-accept-encoding.test.mjs            # 17 pass (helpers + transport chokepoint + structural guard)
node --test tests/fetch-timeout.test.mjs                   # transport wrapper unchanged otherwise
node --test tests/en-scanner.test.mjs tests/ru-scanner.test.mjs tests/parsers.test.mjs
npm run test:ci                                            # 3066 pass, exit 0
npm run test:e2e:browser                                   # 116 pass (unchanged)
node scripts/check-changelog-parity.mjs                    # green
node -e "import('./server/lib/sources/registry.mjs').then(m=>console.log(m.SOURCES.length))"   # 92
```

**3042 → 3066.** Every new case was confirmed failing first: 4 red in the
url-key/pipeline pair, and the accept-encoding suite red at import (the pinned
constant did not exist).

## §1 — What changed

### 1. A second MokaHR job vanished instead of being added

`server/lib/url-key.mjs` reduces a posting URL to a comparison key and dropped
the fragment unconditionally. That is right for `#apply` or `#section-2`, and
wrong for the one board in our registry that puts identity there:

```
https://app.mokahr.com/social-recruitment/{tenant}/{id}#/job/{n}
                                                        ^^^^^^^^ the only unique part
```

Every job on a tenant therefore normalized to the same key. Two consequences,
both silent:

| Seam | Before |
|---|---|
| `parsers.mjs::addPipelineUrl` | paste two different MokaHR jobs → **one line**, no error |
| `en-scanner.mjs` freshness filter | once any job from that tenant is in scan-history, **every other one** is dropped as "already seen" |

`normalizeUrl` now calls `promoteKnownFragmentIdentity` *before* clearing the
hash: a `#/job/{id}` or `#/jobs/{id}` route (case-insensitive, trailing query
ignored) becomes a comparison-only query param. `app.mokahr.com` keeps
`mokahr_job_id` so previously-written keys stay comparable; any other host gets
`_career_ops_fragment_job_id`. **`append`, not `set`** — a URL already carrying
that param holds a different posting's id.

### 2. `accept-encoding` pinned on every source request

`server/lib/http-json.mjs` exports `PINNED_ACCEPT_ENCODING = 'gzip, deflate, br'`
and `withPinnedEncoding(headers)`, applied at all three helper `fetchImpl` call
sites (`fetchJson`, `fetchText`, `fetchResponse` — `fetchJsonWithRetry` routes
through `fetchJson`, so there is no fourth edit to look for) **and at
`server/lib/fetch-timeout.mjs::makeTimeoutFetch`**.

That second site is the one that matters: **25 of the 92 sources call the
injected `fetchImpl` directly** (greenhouse, lever, ashby, workday, hh, rss, …)
and never pass through the helpers, so pinning only there would have left a
third of the registry unprotected while the CHANGELOG claimed otherwise.
`makeTimeoutFetch` is the wrapper both scanners actually inject — the one
chokepoint every source shares. The parent needs no equivalent because
`providers/_http.mjs` is its only transport.

Unset, Node negotiates whatever undici offers; from **Node ≥ 23**
that includes zstd, and amazon.jobs' zstd body arrives **truncated at 1024 bytes
with a 200**, surfacing as `Unterminated string in JSON at position 1024`.

**This is preventive here, and that was checked rather than assumed** — Node
18/20/22 (CI matrix) and the server's 22.22.1 all send `gzip, deflate`, probed
directly. What changes today is that `br` is now offered.

The merge is **case-insensitive**, which is the reviewable part: `fetch` joins
two same-named headers into one comma-separated value, so a caller passing
`Accept-Encoding: identity` would have been sent `gzip, deflate, br, identity`.

## §2 — What to check

Behavioural marker (offline, works on any deployed tree):

```bash
node -e "
Promise.all([import('./server/lib/parsers.mjs'), import('./server/lib/http-json.mjs')])
  .then(([{ addPipelineUrl }, { PINNED_ACCEPT_ENCODING }]) => {
    const t = 'https://app.mokahr.com/social-recruitment/acme/123456';
    let doc = addPipelineUrl('', t + '#/job/111');
    doc = addPipelineUrl(doc, t + '#/job/222');
    const n = (doc.match(/\`\`\`([\s\S]*?)\`\`\`/)?.[1] ?? '').trim().split('\n').filter(Boolean).length;
    console.log(n === 2 ? 'OK: both MokaHR postings kept' : 'FAIL: ' + n + ' line(s)');
    console.log(PINNED_ACCEPT_ENCODING === 'gzip, deflate, br' ? 'OK: encoding pinned' : 'FAIL');
  });"
```
A pre-fix tree prints `FAIL: 1 line(s)`.

Manual browser pass (behaviour is unchanged elsewhere — sanity only):
- `#/scan` → Source filter still lists 92; run one EN board, results render.
- `#/pipeline` → add two MokaHR job URLs from one tenant; **both** rows appear.
  Re-add one of them → still one row (dedup itself must not regress).

## §3 — Invariants

- **Cosmetic fragments still collapse.** `#apply`, `#/`, `#/about`, `#/jobs`
  (no id), `#/job/` (empty id), `#section-2` must all key the same as the
  fragment-free URL. Over-merging is the worse failure, but under-merging every
  fragment would undo the dedup this module exists for.
- **Promotion appends.** `…?_career_ops_fragment_job_id=query-id#/jobs/hash-id`
  keeps **both** ids in the key.
- **MokaHR keeps `mokahr_job_id`.** Renaming it would orphan every key already
  written to scan-history / pipeline.
- **A caller's `accept-encoding` wins under any capitalization**, and exactly
  one such key reaches `fetchImpl` — two is the bug.
- **No source calls `fetch` directly.** A source takes its transport from
  `opts.fetchImpl`; anything else escapes the pin. The structural guard in
  `tests/http-accept-encoding.test.mjs` fails CI on a bare `fetch(` or
  `globalThis.fetch` in `server/lib/sources/`.
- **`headers` stays a plain object** at the `fetchImpl` boundary and the
  caller's object is never mutated. 45 source suites read
  `opts.headers['User-Agent']`; a `Headers` instance would break them all.
- **No default user-agent is injected** — each source sets its own.
- Registry: `SOURCES.length === 92`, `ALL_ADAPTERS.length === 87`.
- Fork divergences intact: Cyrillic `\p{L}` in `providers/telegram-channel.mjs`,
  own `providers/telegram.mjs`, `hermes` in `web/src/lib/clis.ts`,
  `vpFixtureEnv` ×9 in `test-all.mjs`.

## §4 — Not ported (and why)

| Parent change | Decision |
|---|---|
| default **user-agent** applied case-insensitively | no-port — web-ui injects no default UA, so nothing can collide |
| `liveness-browser.mjs` headed-page reuse guard | web-ui does not drive a headed browser |
| `check-jd-archive.mjs` (+212 lines) | no web-ui relay |
| `test-all.mjs` discovered-suite guards | parent harness; fork `vpFixtureEnv` intact |
| `web/` (report tables, facet chips, its url-key copy) | parent's own frontend, not mirrored |
| `batch/batch-runner.sh` `&`-escaping | **relayed read-only** — lands with no code change |
| `jd-skill-gap.mjs` cv.md from the data root | **relayed read-only** — improves `/api/jds/:id/skill-gap` for free |
| plugin manifests, `SIGNATURES.md`, `VERSION` | repository-only |

## §5 — Sign-off

- [ ] §0 gates green with the exact counts, `npm run test:ci` exit 0
- [ ] §2 marker prints both `OK` lines locally **and** on the server tree
- [ ] Deploy verified by sha256 on both sides (never by version string); `career-ops-scan` state unchanged before/after
- [ ] README ×17 banner + badges, CHANGELOG ×17, site mirrors ×17, wiki ×17 at v1.235.0 / 3066
- [ ] Help ×17 untouched (source count unchanged)
