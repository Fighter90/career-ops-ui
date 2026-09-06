# QA REGRESSION PROMPT — career-ops-ui **v1.176.0** (FIND-5 — score under an unlisted bold label)

**User audit (FIND-5, MEDIUM).** Two RU reports still read "Score not detected" even though the score was in a correct bold form — under labels `REPORT_LABELS.ru` doesn't enumerate: `**Итоговый балл:** 1.8 / 5` and `**Скор:** 1.8 / 5`. The reviewer's recommendation (adopted): don't grow the synonym list — match on the **value form** (`X.X / 5`) in any bold label.

- **Under test:** `package.json` **1.176.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2453, exit 0 (capture $? directly, never | grep)
node --test tests/report-header-locale.test.mjs   # 13 cases incl. the 2 FIND-5 repros
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.176.0
```

## §1 — Fix

- `server/lib/parsers.mjs::boldScoreValueForm` — a new fallback (precedence step 2.6, after the localized bold-label pass, before prose): matches `\*\*<any label>\*\* … (\d+[.,]?\d* / 5)` — a score fraction over the **/5 rubric denominator** under ANY bold label. Language-independent, so `**Итоговый балл:**` / `**Скор:**` (and any future localized label) parse without a table entry.
- **Heading-immune** — requires `**` and a `/5` value; a plain H1 (`# Оценка вакансии: …`) has neither.
- **Date-immune** — a negative lookahead `(?![\d/])` after the denominator rejects `5/5/2026` (the second `/` fails the guard), so a `**Дедлайн:** 5/5/2026` line is not read as a score.

## §2 — Manual pass (`#/reports`, RU data)

1. The two reports that read "Score not detected" (score written as `**Итоговый балл:**` / `**Скор:**`) now show a real coloured score pill (1.8 / 5).
2. A report whose only `/5`-shaped text is a date does NOT show a spurious score.
3. Reports that use the listed `**Оценка:**` label are unaffected (the localized pass still wins first).

## §3 — Invariants

- **Fallback only** — runs after EN bold → Machine Summary → localized bold label; the value-form pass fires only when those found nothing, so existing reports are unchanged. EN reports byte-identical.
- Server parser only — no route / CSP / SSRF / parent-write change; no new dependency.

## §4 — Sign-off

Suite **2453** green · `report-header-locale` 13/13 · the two RU labels parse · date not mistaken for a score · listed-label reports unaffected · parity ×17. **Closes FIND-5.**
