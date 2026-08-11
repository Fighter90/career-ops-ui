# QA REGRESSION PROMPT — career-ops-ui **v1.119.0** (release delta driver)

Delta driver for the v1.119.0 release — **parent career-ops v1.19.0 parity + cvstart.org landing refresh**. Run on top of the definitive whole-project prompt (`qa/QA-REGRESSION-PROMPT.md`); only the deltas below need fresh eyes.

- **Version under test:** `package.json` **1.119.0** · `parentVersion` **1.19.0** · **31 route modules** · **61 adapters (56 EN + 5 RU)**.
- **Baseline:** **1844** `node --test` cases (was 1824) · CHANGELOG/README/help parity ×16 at v1.119.0.

---

## §1 — Two new scan providers (56 EN adapters)

New: `meituan` (zhaopin.meituan.com) and `tencent` (careers.tencent.com) — the Chinese tech boards' zero-auth public JSON APIs. Both are single-company boards: host-detected from `careers_url`/`api` or selected via explicit `provider:`; per-entry `keywords` (each keyword is a separate server-side query, results deduped by URL) and `max_pages` config read from the company entry (`opts.company`). Meituan POSTs a nested-pagination body and retries sporadic empty pages with backoff; Tencent GETs the `Query` API with a `pageIndex` loop.

1. `GET /api/scan/sources` → the EN list contains `meituan` and `tencent` (plus the 54 previous). The `#/scan` source dropdown shows "Meituan" and "Tencent".
2. Registry invariants (unit): `tests/adapter-registry.test.mjs` asserts `ALL_ADAPTERS.length === 56` with the exact sorted id list; `tests/scan-sources-endpoint.test.mjs` EN-set includes both.
3. Provider suites (no network, stubbed transport): `node --test tests/sources-meituan.test.mjs tests/sources-tencent.test.mjs` — parse shape, SSRF host pin, keyword fan-out + dedup, first-request-throw vs mid-run-blip-keeps-collected, `max_pages` honored (tencent), snippet cap 500.
4. SSRF envelope: `assertMeituanUrl` pins `zhaopin.meituan.com`, `assertTencentUrl` pins `careers.tencent.com` (HTTPS only, exact hostname). A spoofed `careers_url` like `https://evil.com/careers.tencent.com` must NOT match either adapter.

## §2 — Workday CXS browser-like headers (parent #1813)

1. `fetchWorkday` sends `User-Agent: Mozilla/5.0 … Chrome/…` + `Accept-Language: en-US,en;q=0.9` + `Origin`/`Referer` derived from the CXS URL itself (`https://<tenant>.wdN.myworkdayjobs.com` + `/<site>/`). Unit: the new header case in `tests/workday-fallback.test.mjs`.
2. The graceful CAPTCHA/4xx fallback contract is unchanged (403/non-JSON → `[]` + `lastWorkdayFallback`; `strict:true` throws).
3. Glints POSTs carry the same browser-like UA + `origin`/`referer: glints.com` (parent parity). Both consume the shared `BROWSER_LIKE_USER_AGENT` export from `server/lib/http-json.mjs` — one constant, no per-file Chrome-version drift.

## §3 — cvstart.org landing: live stars + contributors

1. `site/scripts/sync-assets.mjs` snapshots `facts.stars` AND `facts.contributors` (GitHub `/contributors`, bots filtered, top 24; authenticated via `GITHUB_TOKEN` in CI). Guard suite `tests/site-scripts.test.mjs` still green.
2. `GitHubButton.astro` renders the star badge with `[data-gh-stars]`; `site/src/scripts/site.js` refreshes it client-side from `api.github.com` on load (build-time value = fallback; badge hidden only when both are absent).
3. New `Contributors.astro` inside the dark OpenSource section: avatar grid → GitHub profiles + "All contributors →" link to `/graphs/contributors`. Renders nothing when the build-time fetch failed. 3 new site i18n keys (`open.contributors*`) ×16 — `node site/scripts/check-i18n.mjs` reports **16 locales × 193 keys**.
4. `deploy-pages.yml` gained a weekly `schedule:` cron (Mon 06:17 UTC) so build-time facts refresh without a push; the build step exports `GITHUB_TOKEN`.
5. Landing build gate: `astro check` 0 errors, `npm run build` 33 pages, `dist/index.html` contains `data-gh-stars` + `avatars.githubusercontent.com` images; `/ru/` shows «Контрибьюторы».

## §4 — Docs & i18n fan-out gates

```bash
node scripts/check-changelog-parity.mjs   # "all 15 locales at v1.119.0"
node --test tests/help-ru-config-section.test.mjs tests/canonical-docs-coverage.test.mjs tests/help-ui.test.mjs   # 28 H2 / 103 H3 unchanged
```

- Help §17 says **61 adapters — 56 English + 5 Russian** in all 16 bundles (counts-only edit; H2/H3 gates unchanged).
- README ×16: release banner at v1.119.0, tests badge **1844**, breadcrumb starts with the parity + landing items; baseline label `@ v1.119.0`.
- No app i18n keys were added (the 3 new keys are `site/`-scoped) — `tests/fixtures/i18n-dict.snapshot.json` untouched.

## §5 — Sign-off

`npm test` green (≥1844) · `npm run test:ci` green · Playwright suite green · smoke/comprehensive E2E green · CI matrix (Node 18/20/22) + CodeQL green · Pages deploy green and cvstart.org shows the contributors block with a live star count.

---

## §6 — v1.119.1 follow-up (same sign-off run)

- `#/scan` Source dropdown's offline fallback (`FALLBACK_SOURCES` in `public/js/views/scan.js`) synced to all **61** providers (it had silently lagged since v1.87.0 — 20 missing). New drift guard `tests/scan-fallback-sources.test.mjs` asserts exact value+label parity with `server/lib/sources/registry.mjs` — CI fails on any future divergence. Baseline **1845**.
