# QA Regression Prompt — v1.127.0 (parent career-ops v1.23.0 parity)

> Minor release. Three new scan sources, three mirrored provider/logic fixes,
> and Cursor re-added to the CLI roster. Baseline: v1.126.1 (all green, 1969).

## What changed

1. **3 new sources → registry 70 (65 EN + 5 RU), ALL_ADAPTERS 65.**
   - **Flowxtra** — board-wide aggregator (`app.flowxtra.com/api/central/jobs`).
   - **VDAB** — Flanders `vindeenjob` keyword JSON API (`www.vdab.be`).
   - **iCIMS** — `careers-<tenant>.icims.com` hosted-portal search (distinct
     from `jibeapply`; enrichDate hook omitted, jobs undated).
2. **Cursor re-added (parent #2115).** `cli-detect` now probes `cursor` → 10
   tools; roster restored across help ×17, README ×17, `config.providerModelNote`
   (i18n ×17), `docs/career-ops-canonical.md`, `canonical-docs-coverage` CANON.
3. **agenticjobs HTML→REST (#2167).** Reads `…/api/v1/jobs`; same job shape,
   salary min/max/currency surfaced.
4. **Greenhouse office-city (#2104).** Recovers the city from `/offices` when
   `location.name` is a bare work model; fail-soft, paid only when needed.
5. **role-matcher parity (#1933/#2164/#2009).** MTS-prefix strip, `product`
   baseline, accent fold, sub-baseline disagreement.

## Sign-off checklist

- [ ] `npm test` — **2045** green (+76: sources ×3 +60, greenhouse +6,
      role-matcher +4, misc).
- [ ] `node --test tests/adapter-registry.test.mjs` — 65 ids, flowxtra/icims/vdab present.
- [ ] `node --test tests/scan-sources-endpoint.test.mjs` — EN set includes the 3.
- [ ] `node --test tests/scan-fallback-sources.test.mjs` — FALLBACK parity.
- [ ] Manual: `#/scan` Source dropdown lists Flowxtra, iCIMS, VDAB.
- [ ] Manual: `#/config` → AI CLI tools tab shows **10** entries incl. Cursor.
- [ ] `node --test tests/sources-greenhouse-offices.test.mjs` — enrichment 6/6.
- [ ] `node --test tests/detect-reposts.test.mjs` — role-matcher parity green.
- [ ] `node scripts/check-changelog-parity.mjs` — all 16 locales at 1.127.0.
- [ ] Help H2/H3 gate — 29 H2 / 105 H3 unchanged.
- [ ] Site build green (source count 70 in facts + Sources.astro links).
- [ ] `/api/health` → `version 1.127.0`, `parentVersion 1.23.0`.
