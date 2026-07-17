# QA Regression Prompt — v1.123.0 (parent v1.21.0 parity: Oracle Recruiting Cloud + repost-detector fix)

> Delta-focused sign-off for v1.123.0. Baseline: v1.122.0 (all green).
> Scope: one new scan source (registry 61 → **62**, 57 EN + 5 RU), one detector fix,
> the ×17 docs fan-out. No new routes, no SPA behaviour change beyond the Source list.

## What changed

1. **Oracle Recruiting Cloud source** — `server/lib/sources/oraclecloud.mjs`
   (zero-auth `recruitingCEJobRequisitions` REST API; host-pinned to
   `*.fa[.<region>][.ocs].oraclecloud.com`; siteNumber resolved from the tracked
   `careers_url`, default CX_1; offset pagination + page cap; browser-like UA) +
   `server/lib/portals/adapters/oraclecloud.mjs` in `ALL_ADAPTERS`.
2. **Registry gates bumped**: `tests/adapter-registry.test.mjs` (62 + sorted ids),
   `tests/scan-sources-endpoint.test.mjs` (57 EN), `FALLBACK_SOURCES` in
   `public/js/views/scan.js` (+ drift gate green). New suite
   `tests/sources-oraclecloud.test.mjs` (host regex, siteNumber resolve, API URL,
   parse, pagination — CI-isolated, fake fetch).
3. **role-matcher #1922** — proper-subset titles with a non-baseline extra token stay
   distinct ("Senior Analytics Engineer" ≠ "…, People Analytics"); repost annotations
   stopworded. +2 assertions in `tests/detect-reposts.test.mjs`.
4. **Docs ×17** — README banner v1.123.0 + adapter counts 61→62/56→57, help §17 counts,
   CHANGELOG entry (parity gate), wiki Scanner-Providers row + banners.

## Sign-off checklist

- [ ] `npm test` — full suite green (≥ 1856 + the new oraclecloud suite).
- [ ] `node --test tests/sources-oraclecloud.test.mjs tests/adapter-registry.test.mjs tests/scan-sources-endpoint.test.mjs tests/scan-fallback-sources.test.mjs tests/detect-reposts.test.mjs` — all green.
- [ ] `node scripts/check-changelog-parity.mjs` — all 16 translated changelogs at 1.123.0.
- [ ] Help gates unchanged: 29 H2 / 105 H3 ×17; §17 says **62 (57 EN + 5 RU)** in every language.
- [ ] SPA smoke: `#/scan` Source dropdown lists **Oracle Cloud (ORC)**; scanning a portals.yml
      company with an `*.oraclecloud.com` careers_url hits the ORC API (WAF 403 from
      datacenter IPs is a known environment limitation, not a bug).
- [ ] Repost check: `GET /api/scan/reposts` no longer clusters base titles with their
      specialized-suffix siblings.
- [ ] `/api/health` reports 1.123.0; parent `1.21.0`.
