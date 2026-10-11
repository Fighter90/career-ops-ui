# QA regression — v1.248.8 (parent parity 115 commits + ta/ja language work)

> База: v1.248.7 → v1.248.8. Тесты: **5196 → 5219**. Родитель: fbdf7004 → 1db6517a (форк db11bee7).

## §0 — Ворота
```bash
npm run test:ci                 # 5219 pass, exit 0 (offline)
npm run test:coverage:gate      # 98.17% line / 89.43% branch
npm run test:e2e && npm run test:e2e:browser && npm run test:e2e:full
node evals/workflow/run.mjs     # 12 pass · 0 fail
node scripts/remote-qa/link-check.mjs   # No broken links
node --test tests/sources-pageup.test.mjs tests/parsers-url-cell.test.mjs
```

## §1 — Parent parity
1. pageup: `#/scan` Source filter содержит PageUp (FALLBACK + live registry);
   detect по careers_url на vendor-host; брендированный домен не клеймится.
2. Трекер: URL-ячейка `[ashby](https://…)` парсится — dedup по href
   (extractCellUrl); bare-URL и «—» проходят дословно.
3. Tracker-стейты: `Assessment` между Responded и Interview (live read
   states.yml родителя).
4. ADR-0001/0002 на форке родителя: telegram.mjs жив, Unicode
   LOCATIONISH_RE сохранён (db11bee7).

## §2 — ta/ja язык и формат (CAR-74/75)
1. Промпт оценки открывается языковой строкой + СКЕЛЕТОМ заголовков
   `## A) … ## G)` для не-EN локалей.
2. Зацикливание: повтор блока → срез + предупреждение
   `report looping: block X repeated` + отказ валидации (не тихое сохранение).
3. lang-check: доля письма по ПРОЗЕ (без таблиц, SCORE_SUMMARY, code, URL);
   ja-отчёт с латинскими таблицами → lang ✓.

## §3 — remote-qa warnings (CAR-76)
Колонка warnings в таблице live-прогона: коды сервера
(`report not in <locale>`, shape-коды) видны на проде.

## §4 — Регрессии (не трогать, проверить что живы)
Роль из шапки, срез преамбулы, cleanup-plan-суммы, embed-фетч,
дедуп «## Rejected», отказ корня до fetch, recon, link-check,
cleanup-режимы.

## §5 — Sign-off
- [ ] §0 зелёный · [ ] §1–§4 · [ ] прод `1.248.8` · smoke 15/15 ·
- [ ] live ja/ta ×2: lang ✓ · A–G ✓ · warnings-колонка видна
