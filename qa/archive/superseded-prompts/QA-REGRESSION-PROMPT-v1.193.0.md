# QA REGRESSION PROMPT — career-ops-ui **v1.193.0** ("Silent after interview" tab)

**Added (stats).** A "Silent after interview" tab in `#/stats`: interviews that have gone quiet past a courtesy window (default 30 days), joining your active interviews and tracker — with how long each has been silent, the last interview date, and the reason. Suggestion-only. Zero-token relay of `rejection-latency.mjs`.

- **Under test:** `package.json` **1.193.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2510, exit 0 (capture $? directly, never | grep)
node --test tests/stats-rejection-latency-route.test.mjs tests/help-hint.test.mjs tests/i18n-coverage.test.mjs tests/i18n-locale-files.test.mjs
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.193.0
```

## §1 — Change

- **Route:** `GET /api/stats/rejection-latency` in `routes/stats.mjs` — zero-token read-only relay of `rejection-latency.mjs` (JSON stdout by default; exits 0 in JSON mode). Fail-soft `{available:false}`. `llmRateLimit`.
- **View:** `renderRejection` — an 8th `#/stats` tab (`stats.tabRejection` + `stats.hint.rejection`). Metadata chips + a flag list (company + role + `Nd silent` `badge-warn` + last-interview date + reason) + disclaimer + data-quality warnings. All children `String()`-wrapped. +10 `stats.rej*` i18n keys ×17. `help-hint.test.mjs` bumped 7→8 tabs.

## §2 — Manual check (open `#/stats` → "Silent after interview" tab)

- With interviews past the courtesy window: each flagged interview shows company, role, a `Nd silent` badge, the last-interview date, and the reason; the disclaimer ("a silence is not a rejection") and any data-quality warnings render below. **Regression watch:** all values are `String()`/template children — no raw-number `appendChild` NodeError.
- No flagged interviews → an honest "nothing to chase" empty state.
- Parent script absent → honest "unavailable" line, not a 500.

## §3 — Sign-off

Suite **2510** green (+2: relay + fail-soft) · help-hint 8 tabs · i18n coverage + parity ×17 (+10 keys) · CHANGELOG parity ×17 at v1.193.0 · README badge+banner ×17 · **tab verified via headless screenshot on a synthetic fixture** (two flagged interviews render with silent-day badges + reasons).
