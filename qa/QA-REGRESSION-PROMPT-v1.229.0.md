# QA REGRESSION PROMPT — career-ops-ui **v1.229.0** (four sources from parent v1.31.0)

Parity release against parent career-ops **v1.31.0**. Registry: **86 → 90 sources** (85 EN + 5 RU), `ALL_ADAPTERS` **81 → 85**.

## §0 — Gates
```bash
npm test                                       # 2956 (was 2909), exit 0
node --test tests/sources-builtin.test.mjs     # 14 — new
node --test tests/sources-feishu-jobs.test.mjs # 11 — new
node --test tests/sources-garena.test.mjs      # 10 — new
node --test tests/sources-mokahr.test.mjs      # 12 — new
node --test tests/adapter-registry.test.mjs    # ALL_ADAPTERS === 85, sorted ids regenerated from the live registry
npm run test:ci                                # exit 0
npm run test:e2e / :full / :e2e:browser        # 21/21 · 23/23 · 101/101
node scripts/check-changelog-parity.mjs        # 16 non-EN at v1.229.0
```

## §1 — What each source is, and the one thing that decides it
- **Built In** (`provider: builtin`) — board-wide across nine US markets. **No default query**: an entry with neither `queries:` nor `categories:` scans nothing and says so, because a shared source must never carry one user's search terms. An unlisted market host is **refused**, not silently replaced by the national board — a typo must not widen the scan. Bare market hosts (`builtinseattle.com`) resolve to their canonical `www.` form because the bare ones 301 and the fetch uses `redirect: 'error'`.
- **Feishu Jobs** (`provider: feishu-jobs`) — two host shapes only: `jobs.bytedance.com` exactly, or `*.jobs.feishu.cn` (the leading dot is what stops `jobs.feishu.cn.evil.test`). **The two use different job-page paths**, so a single URL template would produce dead links for half the tenants. The WAF 403s the Windows UA, hence `MACOS_BROWSER_LIKE_USER_AGENT`.
- **Garena** (`provider: garena`) — single company. `office` shapes the job **link**, never the listing; a wrong office breaks links, not results.
- **MokaHR** (`provider: mokahr`) — the response is an **AES-128-CBC envelope with the key alongside it**. Obfuscation, not security, but a plain JSON parse sees nothing. Two tenants are refused at config time because robots.txt excludes their careers path.

**Check:** all four appear in the `#/scan` Source dropdown (live registry *and* `FALLBACK_SOURCES`, whose parity the drift gate proves) and on cvstart.org's source list.

## §2 — Security invariants to re-check
Every source pins its host by **equality or an explicit allowlist**, never `endsWith` on a bare domain; all are HTTPS-only with `redirect: 'error'`. Garena additionally refuses `.`/`..` as URL segments outright — `encodeURIComponent` leaves them intact, so escaping alone would still hand the URL a traversal segment. MokaHR's `siteId` reaches a request **body**, which is why its tenant parse is strict about a positive integer.

## §3 — `htmlToText` hardening
`safe &lt;img src=x onerror=1` used to come out as `safe <img src=x onerror=1`: the opener has no closing `>` for the tag strip to consume, so it survived. Each decode is now followed by a strip, and a trailing opener loses its angle bracket.

**Known and unchanged:** `plain &lt; 5 and &gt; 3` still yields `plain 3` — the strip treats `< 5 and >` as a tag. That behaviour predates this release and is identical in the parent, so it was left alone rather than diverging. It is the same class as the Telegram prose-eating bug fixed in v1.228.2, and worth raising upstream.

## §4 — Not ported, and why
- **The parent's Workday facet-split.** It recovers tenants whose CXS backend clamps pagination at offset 2000; web-ui does not paginate Workday at all (one POST at `offset: 0`, 100 rows), so there is no clamp to route around. web-ui's own 100-row ceiling is a separate, blunter limit — worth its own work, not this release's.
- **`verify-cv-facts` and `merge-tracker` fixes.** web-ui runs those scripts from the parent checkout (`cv-studio.mjs`, `runners.mjs`) rather than mirroring their logic, so they arrive with the parent.
- **The parent's `web/` Next.js app (31 files) and `plugins/` (13).** Not mirrored here.

## §5 — Two places the port did not match the parent
Both were caught by tests, not by review:
- `parseSalary` returns `{ min, max }` for the parent's own filters; web-ui's job contract carries `salary` as a **display string**, so a formatter was added. Letting the object through would have put `[object Object]` in the tracker.
- `composeLocation('Hybrid', [])` returns `''`, not `'Hybrid'`. A bare workplace mode is not a location: it would read as a city in the results table and pass a `location_filter` it was never meant to.
