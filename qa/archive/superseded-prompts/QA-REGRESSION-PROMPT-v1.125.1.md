# QA Regression Prompt — v1.125.1 (SuccessFactors multi-brand RMK fix, parent #2099)

> One-fix patch. Baseline: v1.125.0 (all green).

## What changed

`server/lib/sources/successfactors.mjs` gained the exported `resolveTenantBase(company)`
— origin **plus any brand/tenant path** from `api:`/`careers_url`, stripping only a
trailing `/search/` or `/tile-search-results/` segment (never doubles). The adapter's
`buildEndpoint` now uses it, so multi-brand RMK holdings
(`careers.nemetschek.com/Bluebeam/` vs `…/Vectorworks/`) scan THEIR brand instead of
silently getting the parent brand's postings. Single-domain tenants byte-for-byte
unchanged. +1 ported test block (8 assertions) in `tests/sources-successfactors.test.mjs`;
one pre-#2099 assertion updated to the new path-preserving semantics.

## Sign-off checklist

- [ ] `npm test` — ≥ **1950** green.
- [ ] `node --test tests/sources-successfactors.test.mjs` — 9/9.
- [ ] Behaviour spot-check (unit-level): `buildEndpoint({careers_url:'https://careers.nemetschek.com/Bluebeam/'})`
      → `https://careers.nemetschek.com/Bluebeam/tile-search-results/`;
      `{careers_url:'https://jobs.zf.com'}` → `https://jobs.zf.com/tile-search-results/`.
- [ ] `node scripts/check-changelog-parity.mjs` — all 16 at 1.125.1.
- [ ] No other surfaces changed: `/api/health` 1.125.1; site untouched (badges feed
      facts → dispatch Pages deploy after merge).
