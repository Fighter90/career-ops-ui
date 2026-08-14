# QA REGRESSION PROMPT — career-ops-ui **v1.185.0** (Funnel & velocity stats tab)

**Added (stats).** A 6th `#/stats` tab, "Funnel & velocity", relayed read-only from `funnel-velocity.mjs`: funnel calibration vs market benchmarks + in-flight waiting list + per-stage median/p75 velocity.

- **Under test:** `package.json` **1.185.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2481, exit 0 (capture $? directly, never | grep)
node --test tests/stats-funnel-route.test.mjs tests/help-hint.test.mjs tests/i18n-coverage.test.mjs
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.185.0
```

## §1 — Change

- **Route:** `GET /api/stats/funnel` in `server/lib/routes/stats.mjs` — a byte-for-byte mirror of the `/api/stats/lifetime` relay: `existsSync` guard → `runNodeScript('funnel-velocity.mjs')` → `parseJsonStdout` → `{available:true, ...}` or fail-soft `{available:false}`.
- **View:** `renderFunnel()` + a `funnel` tab in `public/js/views/stats.js` rendering `calibration` (response/interview rate chips vs benchmark band, small-sample + selection-bias caveats), `waiting` (in-flight, window, beyond-window list), `velocity` (median/p75/n/still-waiting table). Reuses `stats.lifeResponseRate`/`stats.lifeInterviewRate`/`stats.lifeSmallSample`; +18 new `stats.funnel*` keys ×17.

## §2 — Manual check (open `#/stats` → "Funnel & velocity")

- The tab must RENDER (not error). **Regression watch:** the velocity table cells are numbers — they MUST be `String()`-wrapped before reaching `UI.el`, or the tab throws `appendChild ... not of type 'Node'`. Verify the three sections show and the numbers appear.
- Without the parent `funnel-velocity.mjs`, the tab shows an honest empty state (`available:false`), not an error.

## §3 — Invariants

- Zero-token read-only relay; no route/CSP/SSRF/parent-write change; no new dependency. The persisted-nothing contract (it only reads the tracker) holds.

## §4 — Sign-off

Suite **2481** green (+2) · funnel route 2/2 (relay + fail-soft) · help-hint 6-tab guard green · i18n coverage + parity ×17 (18 new keys) · CHANGELOG parity ×17 at v1.185.0 · README badge+banner ×17 · **populated tab verified via headless screenshot** (caught the number-child render bug).
