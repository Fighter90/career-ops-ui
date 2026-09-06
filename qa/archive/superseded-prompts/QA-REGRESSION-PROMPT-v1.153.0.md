# QA REGRESSION PROMPT — career-ops-ui **v1.153.0** (Jobvite XML-feed migration — parent-sync)

The parent career-ops retired the Jobvite **JSON API** (it 302-redirects and returns zero jobs). web-ui's `sources/jobvite.mjs` used that same dead endpoint, so any tracked Jobvite company silently scanned empty. This ports the parent's fix (`#2623`): the source now reads the public per-tenant **XML feed** keyed by an opaque `companyEId`. Security-sensitive (a scanner-source URL fetch → SSRF surface). Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.153.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2396, exit 0 (capture $? directly, never | grep)
node --test tests/sources-jobvite.test.mjs  # 20/20 — stubbed transport, no network
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.153.0
```

## §1 — What changed (one scanner source + one HTTP helper + a CI-config line)

- **`server/lib/sources/jobvite.mjs`** — rewritten. OLD: `GET https://jobs.jobvite.com/api/company/{slug}/jobs` → JSON. NEW: `GET https://app.jobvite.com/CompanyJobs/Xml.aspx?c={companyEId}` → XML `<result><job>…`, parsed with an indexOf-cursor scanner (CDATA + numeric/named entity decode, `detail-url` preferred over `apply-url`, `http:`→`https:` on the **display-only** per-job URL).
- **companyEId resolution** — (1) `company_eid:` on the portal entry, (2) `c=` param of an explicit `api:` URL, (3) board-page discovery (scrape `companyEId` from inline JS).
- **`server/lib/portals/adapters/jobvite.mjs`** — `matches`/`buildEndpoint` rewritten for eId/slug; en-scanner already threads `company` so `company_eid` reaches both for free.
- **`server/lib/http-json.mjs`** — `fetchText` attaches read-only `.location`/`.retryAfter` on a non-ok error (to classify an empty board's `NoJobs.htm` redirect without following it). Backward-compatible.
- **`.github/workflows/deploy-pages.yml`** — `concurrency.cancel-in-progress: false` so a superseded Pages build no longer reds the commit-status rollup.

## §2 — Invariants (security-sensitive — the core of this release)

- **Two pinned hosts.** `assertJobviteUrl` runs before **every** outbound fetch: `hostname` must be exactly `jobs.jobvite.com` (discovery) or `app.jobvite.com` (feed) — a 3rd host, a path-spoof (`evil.example/app.jobvite.com/…`), or a subdomain (`jobs.jobvite.com.evil.example`) is rejected. **https-only.**
- **No redirect ever followed.** Discovery uses `redirect:'error'`; the feed uses `redirect:'manual'` — the 3xx is *read* (empty-board classification) but never chased, so the final hostname can't drift.
- **eId is data, not a path.** `companyEId` is only ever a `?c=` query value; feed/board URLs are rebuilt from the resolved slug/eId via `buildFeedUrl`/`buildBoardUrl`, never fetched verbatim from user input.
- **Per-job URLs are display-only.** `detail-url`/`apply-url` are written into the job object and never fetched by the scanner; the `http→https` upgrade only touches those display values.
- **Registry unchanged** — `meta.value='jobvite'` preserved; source count stays the same. **No parent write.**

## §3 — Manual pass

1. **Scan** — with a Jobvite company tracked in `portals.yml` (ideally with `company_eid:` set), a `#/scan` run returns jobs from that company (previously zero). Without a gateway/network you get a clean fail-soft, not a crash.
2. **Config resolution** — an entry with only a vanity `jobs.jobvite.com/{slug}` careers URL still resolves via board discovery; an entry with `company_eid:` skips the discovery request.
3. **No console errors.**

## §4 — Not in this release

- The other 16 parent commits since parentVersion 1.26.0 (an LLM re-ranker, `verify-cv-facts`, `liveness-core`, two `web/` fixes) have no web-ui mirror and were intentionally not ported.

## §5 — Sign-off

Suite **2396** green · `sources-jobvite` 20/20 · two-host SSRF guard (https-only, no redirect followed) · eId only a `?c=` value · per-job URLs display-only · registry source count unchanged · `http-json.fetchText` back-compat · CHANGELOG parity ×17 · Pages concurrency no longer reds the badge. **Completes the parent-sync for parentVersion 1.26.0.**
