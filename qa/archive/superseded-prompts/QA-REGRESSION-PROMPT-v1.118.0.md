# QA REGRESSION PROMPT — career-ops-ui **v1.118.0** (release delta driver)

Delta driver for the v1.118.0 release — **parent career-ops v1.18.0 parity pack**. Run on top of the definitive whole-project prompt (`qa/QA-REGRESSION-PROMPT.md`); this file covers ONLY what v1.118.0 added. Server: `npm start` → `http://127.0.0.1:4317`.

- **Version under test:** `package.json` **1.118.0** · `parentVersion` **1.18.0** · **31 route modules** · **59 adapters (54 EN + 5 RU)**.
- **Baseline:** **1817** `node --test` cases (was 1779) · CHANGELOG/README/help parity ×16 at v1.118.0.

---

## §1 — Nine new scan providers (54 EN adapters)

New: `csod` (Cornerstone OnDemand), `phenom` (Phenom People), `radancy`, `deutschebahn` (Deutsche Bahn), `echojobs`, `tkms`, `hecklerkoch` (Heckler & Koch), `rheinmetall`, `larajobs` (LaraJobs RSS). Plus **Lever EU**: the lever adapter now detects `jobs.eu.lever.co/<slug>` and builds `https://api.eu.lever.co/v0/postings/<slug>`.

1. `GET /api/scan/sources` → the EN list contains all 9 new values (plus the 45 previous). The `#/scan` source dropdown shows them.
2. Registry invariants (unit): `tests/adapter-registry.test.mjs` asserts `ALL_ADAPTERS.length === 54` with the exact sorted id list; `tests/scan-sources-endpoint.test.mjs` mirrors it.
3. Provider parity suites (no network, stubbed transport): `node --test tests/sources-parity-v1118a.test.mjs tests/sources-parity-v1118b.test.mjs tests/sources-parity-v1118c.test.mjs` — 34 tests: meta shape, host-pinning (evil/http/suffix-spoof rejected), parse happy paths, pagination stop conditions, adapter `matches()`/`buildEndpoint()` (string-or-null contract).
4. SSRF envelope: every new source pins its hostname (or URL shape for radancy — branded hosts carry no vendor token, so it is `provider:`-selected only) and rejects `http:`. Two registries rule still holds: a new EN board needs BOTH `server/lib/sources/<slug>.mjs` (meta → dropdown) AND `server/lib/portals/adapters/<slug>.mjs` + `registry.mjs` (fetch walk).

## §2 — `Hired` tracker status (states.yml parity)

1. `POST /api/tracker {status:'Hired'}` → row lands with `Hired`; any unknown status still degrades to `Evaluated` (whitelist intact). Unit: `tests/parity-routes-v1118.test.mjs`.
2. `#/tracker`: a `Hired` row renders the `badge-hired` tint and the page shows the 🎉 **job-landed banner** (`role="status"`, static markup, no timers — CSP-safe). Funnel chips include Hired between Offer and Rejected.
3. `#/stats → My pipeline`: status funnel lists Hired; conversion rates count Hired as advanced through Applied/Responded/Interview/Offer.
4. i18n: `track.hiredTitle` / `track.hiredNote` present in all 16 locales (parity gates green).

## §3 — Lifetime Statistics tab (stats.mjs + salary-gap.mjs relays)

1. `GET /api/stats/lifetime` with the parent present → `{available:true, tracker:{…}, funnel:{…}, scan:{…}, portals:{…}}` (verbatim relay of parent `stats.mjs` JSON). Without the parent script → `{available:false, reason:'script-not-found'}` (fail-soft, HTTP 200).
2. `GET /api/stats/salary-gap` → `{available:true, applications:[…], aggregates:{…}, quality:{…}}`; same fail-soft contract. Both routes are `llmRateLimit`-guarded, read-only, zero-token.
3. `#/stats` now has **five tabs**; **Lifetime** renders: tracked/active/avg-score chips, lifetime status roll-up bar chart, cumulative funnel rates (+ small-sample caveat), scanner totals + per-portal chart, portal coverage, and the compensation observations table (desired vs advertised vs actual + advertised→actual gap %). Honest empty states throughout.
4. `sanitizeDetail` still strips absolute paths from any relayed stderr (shared `parent-relay.mjs` contract).

## §4 — Docs & i18n fan-out gates

```bash
node scripts/check-changelog-parity.mjs   # "all 15 locales at v1.118.0"
node --test tests/i18n-locale-files.test.mjs tests/i18n-coverage.test.mjs   # 28 new keys ×16 + snapshot
node --test tests/help-ru-config-section.test.mjs   # 28 H2 / **103 H3** (new §26 "Lifetime & compensation")
```

- Help §14 status flow now reads `… → Offer / Hired / Rejected / Discarded / SKIP` in all 16 bundles, with the Hired sentence after it.
- README ×16: release banner at v1.118.0, tests badge 1817, breadcrumb starts with the parity items.

## §5 — Sign-off

`npm test` green (≥1817) · `npm run test:ci` green · Playwright suite green · smoke/comprehensive E2E green · CI matrix (Node 18/20/22 + CodeQL) green. CodeQL note: `js/missing-rate-limiting` on the two new stats routes would be the known categorical FP (llmRateLimit present) — dismiss with the documented rationale if raised.
