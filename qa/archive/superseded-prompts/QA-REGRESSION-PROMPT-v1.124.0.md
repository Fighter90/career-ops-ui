# QA Regression Prompt — v1.124.0 (parent v1.22.0 parity: 5 sources + Arbeitsagentur/SmartRecruiters fixes)

> Delta-focused sign-off for v1.124.0. Baseline: v1.123.0 (all green).
> Scope: five new scan sources (registry 62 → **67**, 62 EN + 5 RU), two mirror-provider
> fixes, the ×17 docs fan-out. No new routes, no SPA behaviour change beyond the Source list.

## What changed

1. **Five sources** — `server/lib/sources/{wttj,agenticjobs,jobvite,gem,alibaba}.mjs`
   + their `portals/adapters/*` in `ALL_ADAPTERS` (62 EN portal adapters):
   Welcome to the Jungle (board JSON API), Agentic Engineering Jobs (board),
   Jobvite (zero-auth per-tenant), Gem (per-tenant), Alibaba Group
   (careers JSON API, Meituan/Tencent pattern). All host-pinned, HTTPS-only,
   capped, fail-soft; five CI-isolated suites `tests/sources-*.test.mjs`.
2. **Registry gates**: `adapter-registry` (62 + sorted ids), `scan-sources-endpoint`
   (62 EN), `FALLBACK_SOURCES` in `public/js/views/scan.js` + drift gate.
3. **Arbeitsagentur #1981** — the `filter` remote pass now verifies each hit via the
   job-details endpoint in batches of 5 and only tags nationwide-remote on
   `homeofficetyp === 'VOLLSTAENDIG'`; lookup errors fail closed (job keeps its city).
4. **SmartRecruiters #2047** — public job URLs built without `/postings/`.
5. **Docs ×17** — README banner v1.124.0 + counts 62→67 / 57→62, help §17 counts,
   CHANGELOG entry (parity gate), wiki Scanner-Providers rows ×5 + banners.

## Sign-off checklist

- [ ] `npm test` — full suite green (≥ 1874 + the five new suites).
- [ ] `node --test tests/sources-{wttj,agenticjobs,jobvite,gem,alibaba}.test.mjs tests/adapter-registry.test.mjs tests/scan-sources-endpoint.test.mjs tests/scan-fallback-sources.test.mjs tests/arbeitsagentur-remote.test.mjs` — all green.
- [ ] `node scripts/check-changelog-parity.mjs` — all 16 translated changelogs at 1.124.0.
- [ ] Help gates unchanged: 29 H2 / 105 H3 ×17; §17 says **67 (62 EN + 5 RU)** everywhere.
- [ ] SPA smoke: `#/scan` Source dropdown lists the five new entries with labels matching
      the source `meta` exactly.
- [ ] Arbeitsagentur behavioural check: with `remoteMatch: filter`, hybrid
      (NACH_VEREINBARUNG) hits keep their city; only VOLLSTAENDIG hits are tagged remote.
- [ ] SmartRecruiters: a scanned job's public URL has no `/postings/` segment.
- [ ] `/api/health` reports 1.124.0; parent `1.22.0`; `/api/scan/sources` returns 67.
