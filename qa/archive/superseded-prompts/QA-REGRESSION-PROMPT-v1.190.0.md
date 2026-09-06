# QA REGRESSION PROMPT — career-ops-ui **v1.190.0** (Company history panel)

**Added (tracker).** A "Company history" card on `#/tracker`: pick a company and get read-only evidence — how responsive it has been to you (silent-on-you / mixed / responded-before / no-history) and whether the same role keeps getting reposted — joined from your tracker, follow-ups, and scan history. Zero-token relay of `company-history.mjs` (JSON stdout by default).

- **Under test:** `package.json` **1.190.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2501, exit 0 (capture $? directly, never | grep)
node --test tests/stats-company-history-route.test.mjs tests/i18n-coverage.test.mjs tests/i18n-locale-files.test.mjs
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.190.0
```

## §1 — Change

- **Route:** `GET /api/stats/company-history[?company=]` in `routes/stats.mjs`. Bare → full result JSON; `?company=X` → single card. `company` is length-capped (200) and passed as a `runNodeScript` **array arg** (no shell interpolation). Fail-soft `{available:false}` (`script-not-found` / `timeout` / `empty-tracker` / `script-error`). `llmRateLimit`.
- **View:** `companyHistoryCard` / `companyHistoryEvidence` in `views/tracker.js` — a company picker (distinct tracked companies, `localeCompare`-sorted) + "Look up" → responsiveness badge + silent-application list + posting-churn badge + cluster list. All children are `String()`-wrapped (no raw-number NodeError). Returns null on an empty tracker. +18 `track.hist*` i18n keys ×17 (reused `scan.col.company`, inlined `×`).

## §2 — Manual check (open `#/tracker`, "Company history" card under the filters)

- Pick a company → **Look up** → a card renders: company name + a responsiveness badge + a churn badge, plus lists when there are silent applications / reposts.
- Empty tracker → the card does not render at all (no picker, no crash).
- Parent script absent (standalone install) → honest "unavailable" line, not a 500.
- **Regression watch:** badge/label values are all `String()`/template children — no `appendChild` NodeError (the funnel-tab class of bug).

## §3 — Sign-off

Suite **2501** green (+3: single-card, full-result, fail-soft) · i18n coverage + parity ×17 (+18 keys) · CHANGELOG parity ×17 at v1.190.0 · README badge+banner ×17 · **populated card verified via headless screenshot**. **Note:** parent analytics CLIs emit JSON by default (`--summary` = text) — no parent change needed; upskill/rejection-latency are the same clean relay pattern.
