# QA REGRESSION PROMPT — career-ops-ui **v1.191.0** ("What to learn next" tab)

**Added (stats).** A "What to learn next" tab in `#/stats`: a tracker-wide skill-gap roll-up — the missing skills that most often sank a low-fit match, weighted (5−fit-score across every evaluated report) and tiered Critical/High/Medium — plus the skills already covered by your CV/profile. Zero-token relay of `upskill.mjs`.

- **Under test:** `package.json` **1.191.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2504, exit 0 (capture $? directly, never | grep)
node --test tests/stats-upskill-route.test.mjs tests/help-hint.test.mjs tests/i18n-coverage.test.mjs tests/i18n-locale-files.test.mjs
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.191.0
```

## §1 — Change

- **Route:** `GET /api/stats/upskill` in `routes/stats.mjs` — zero-token read-only relay of `upskill.mjs` (JSON stdout by default). Carries an `{ error }` field when there is too little data; fail-soft `{available:false}` when the parent script is absent. `llmRateLimit`.
- **View:** `renderUpskill` — a 7th `#/stats` tab (`stats.tabUpskill` + `stats.hint.upskill`). Metadata chips + a tiered gap table (Critical=`badge-bad` / High=`badge-warn` / Medium=`badge-info`; Skill / Reports / Low-fit / Weighted) + an "already yours" excluded line. All children `String()`-wrapped. +15 `stats.up*` i18n keys ×17. `help-hint.test.mjs` bumped 6→7 tabs.

## §2 — Manual check (open `#/stats` → "What to learn next" tab)

- With ≥ `--min-reports` (5) scored reports: the tiered gap table renders, sorted by weighted score; tier badges are colour-coded. **Regression watch:** all cell values are `String()`/template children — no raw-number `appendChild` NodeError.
- With too little data → the honest `{ error }` message renders ("Not enough data: n/5 scored reports"), not a crash.
- Parent script absent → honest "unavailable" line, not a 500.

## §3 — Sign-off

Suite **2504** green (+3: gaps, error-passthrough, fail-soft) · help-hint 7 tabs · i18n coverage + parity ×17 (+15 keys) · CHANGELOG parity ×17 at v1.191.0 · README badge+banner ×17 · **tab verified via headless screenshot on a synthetic fixture** (Critical/High/Medium rows render).
