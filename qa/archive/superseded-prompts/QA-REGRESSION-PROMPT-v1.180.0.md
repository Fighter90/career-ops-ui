# QA REGRESSION PROMPT — career-ops-ui **v1.180.0** (#/reports table + score rescue)

**Fixed (MEDIUM, reports).** Two user-reported issues on `#/reports`: (1) the card grid's layout broke — a long "Score not detected" chip squeezed the report-name column to near-zero and `overflow-wrap: anywhere` then wrapped the title one character per line ("вёрстка поехала"); (2) FIND-A — a report with a real body score (`**Итоговый балл:** 1.8 / 5`) showed "Score not detected" whenever a `## Machine Summary` placeholder (`score: —`) occupied the parsed score slot.

- **Under test:** `package.json` **1.180.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2465, exit 0 (capture $? directly, never | grep)
node --test tests/reports-table.test.mjs tests/report-header-locale.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.180.0
node --test tests/i18n-locale-files.test.mjs tests/i18n-coverage.test.mjs   # rep.colReport parity ×17
```

## §1 — Change

- **`public/js/views/reports.js`** — the list view renders a `table.tbl.reports-tbl` inside a new `.reports-scroll` overflow-x container (columns: **Report · Date · Legitimacy · Score**), replacing the `.card-row` / `makeCard` 4-card grid. Each `<tr>` stays keyboard-operable (`role=link`, `tabindex=0`, Enter/Space → `Router.go('/reports/'+slug)`). The muted "Score not detected" chip is unchanged (score cell only). `overflowWrap:'anywhere'` + `minWidth:0` card hack removed.
- **`public/css/components.css`** — new `.reports-scroll` (border + radius + `overflow-x: auto`), `.reports-tbl { min-width: 520px }`, `.reports-tbl td.report-title-cell { overflow-wrap: anywhere }`. Reuses the shared `table.tbl` styling (theme-aware tokens).
- **i18n** — one new key `rep.colReport` (the Report column header) across all **17** locales + snapshot regen; Date/Legitimacy/Score headers reuse `track.col.date` / `track.col.legitimacy` / `rep.score`.
- **`server/lib/parsers.mjs`** — `parseReportHeader` step **4.5**: after `scoreNum = scoreStringToNum(score)`, if `scoreNum == null` it takes the body `boldScoreValueForm` (`**any label** X / 5`) and, if that yields a number, adopts it before `compactScore`. Fixes FIND-A without touching the Machine-Summary / bold-label precedence for reports that already parse.

## §2 — Behaviour deltas

- **Layout** — long report names and the wide "Score not detected" chip can no longer collapse the title column; the name wraps at word boundaries inside its own cell and the table scrolls horizontally on a narrow viewport instead of breaking per-character.
- **Score** — a report whose `## Machine Summary` carries a non-numeric / out-of-range `score:` but whose body has a real `X / 5` now shows that score (was "Score not detected"). A **valid** Machine Summary score still wins (the rescue only fires when `scoreNum` is null) — verified by a guard test.
- EN reports (bold `**Score:** 4.5/5`) parse byte-identically to before.

## §3 — Invariants

- Client + parser only — no route / CSP / SSRF / parent-write change; no new dependency. `stripDangerousMarkdown` / `UI.md()` boundaries untouched.
- Reports.js remains browser-only → structure asserted statically (`tests/reports-table.test.mjs`), the same approach as `reports-unparsed-chip`. Parser fix has a live-data regression case (`report-header-locale` FIND-A ×2) plus an end-to-end `/api/reports` check against a synthetic Machine-Summary-placeholder fixture.

## §4 — Sign-off

Suite **2465** green (+7: 5 table guards + 2 FIND-A) · `reports-table` 5/5 · `report-header-locale` 15/15 · i18n parity ×17 (`rep.colReport`) · CHANGELOG parity ×17 at v1.180.0 · README badges + banner ×17 at 2465 / v1.180.0.
