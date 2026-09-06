# QA REGRESSION PROMPT — career-ops-ui **v1.156.0** (P-16 refactor: split `scan.js` + CodeQL fix)

Pure internal refactor: `public/js/views/scan.js` (906 lines, over the 800-line hard limit) split into two behavior-preserving factories → **648**, completing the P-15/P-16 view-split pair. Plus a one-line CodeQL fix. No user-facing change. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.156.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2396, exit 0 (capture $? directly, never | grep)
node --check public/js/views/scan.js && node --check public/js/views/scan/runner.js && node --check public/js/views/scan/filters.js
node --test tests/playwright-scan-filters.mjs tests/playwright-smoke.mjs   # 26 pass — kill :4317 first
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.156.0
```

## §1 — What changed (structure only)

- **`public/js/views/scan/runner.js`** (new) — `window.createScanRunner(ctx)` → `{ runScanAll, stopScan }`: run-state (Scan/Stop, `aria-busy`), the indeterminate/determinate progress bar, the persistent error banner + Retry, the SSE console stream (`streamTo`), and the per-source runners (ATS / regional / both). `activeES`/`lastRunFn` are runner-internal.
- **`public/js/views/scan/filters.js`** (new) — `window.createScanFilters(refs, deps)` → `{ applyFilters, resetFilters, getFilterState, setFilterState }`: the filter state machine backing saved searches.
- **`public/js/views/scan.js`** (648) — wires both via `ctx`/`refs` bags; the live-poll teardown timers (`__activeScanPollHandle`/`__activeScanDoneTimeout`/`__cancelActiveScanPoll` + the `hashchange` listener) stay at `scan.js` top level (shared classic-`<script>` scope). Both new scripts load before `scan.js` in `index.html`.
- **`config/tab-controller.js`** — CodeQL `js/useless-assignment-to-local` (#428) fixed: `let n = i;` → `let n;`.
- Four source-reading tests repointed (the `loadScanSrc()` helper concatenates scan.js + the two new files + `lib/scan-results.js`).

## §2 — Manual pass (verify NOTHING changed for the user)

1. **`#/scan` loads** — sources dropdown populates; the filter bar renders.
2. **Run a scan** (ATS / regional / both) — the **progress bar** fills, the **SSE console** streams, **Stop** appears and cancels, and on error the **banner + Retry** works. Navigating away mid-scan cancels the poll (no leaked timers).
3. **Filters + saved searches** — Apply/Reset filter the results; save + reload a saved search restores the whole filter set.
4. **No console errors / ReferenceErrors** — confirm `window.createScanRunner` + `window.createScanFilters` are defined before the view runs.

## §3 — Invariants

- **Zero behavior change** — moved code is byte-identical (de-indent only). No route, server, i18n, or CSS change. Suite unchanged **2396** (repointed, not added).
- **Both oversized views now < 800** — config.js 783 (P-15) + scan.js 648 (P-16).

## §4 — Sign-off

Suite **2396** green · `#/scan` runs + streams + Stop + filters + saved searches work (browser, 26/26 Playwright) · both new modules define their globals before `scan.js` · scan.js 648 lines (< 800) · CodeQL #428 cleared · CHANGELOG parity ×17. **Pure refactor; no functional surface touched.**
