# QA regression — v1.248.7 (H1 role per the parent's convention, language warning, chatter strip)

> База: v1.248.6 → v1.248.7. Тесты: **5191 → 5196**.

## §0 — Ворота
```bash
npm run test:ci                 # 5196 pass, exit 0 (offline)
npm run test:coverage:gate      # 98.17% line / 89.42% branch
npm run test:e2e && npm run test:e2e:browser && npm run test:e2e:full
node evals/workflow/run.mjs     # 12 pass · 0 fail
node scripts/remote-qa/link-check.mjs   # No broken links
```

## §1 — Роль из шапки (формат родителя)
1. `# Evaluation: Sveak — PHP-разработчик (senior)` → роль
   «PHP-разработчик (senior)»; в slug нет `evaluation`.
2. `# Оценка вакансии: Acme — Backend Engineer` → «Backend Engineer».
3. `# Backend Engineer — Acme` (без метки) → «Backend Engineer».
4. `# Evaluation: Acme` (без роли) → запасной вариант из поста
   (чистый: без `#` и эмодзи).
5. В строках трекера нет ролей с префиксом `Evaluation:`/`Оценка:`.

## §2 — cleanup-plan: строки, а не файлы
`— N dirty-URL line(s)` суммируются (N), не считаются по одной.
Файл с 5 мусорными URL → 5, не 1. То же для test-row.

## §3 — Язык отчёта
1. Промпт оценки открывается И закрывается обязательной языковой
   инструкцией (весь отчёт, включая таблицы).
2. Ответ не на запрошенном языке → предупреждение
   `report not in <locale>` в done-событии и в детале шага,
   отчёт СОХРАНЯЕТСЯ (не отказ).
3. Прод: `remote-qa live=true locales=ja,ta` два прогона подряд —
   оба lang ✓.

## §4 — Без болтовни до H1
Сохранный отчёт начинается со строки `# …` — преамбула модели
(«I'll evaluate…», «**Reading files...**») срезана.

## §5 — Регрессии (не трогать, проверить что живы)
Embed-фетч, «Компания : X», дедуп `## Rejected`, отказ корня до fetch,
recon (метки одним числом, honours вычислен), link-check, cleanup-режимы.

## §6 — Sign-off
- [ ] §0 зелёный · [ ] §1–§4 · [ ] §5 без регрессий ·
- [ ] прод `1.248.7` · smoke 15/15 · live ja/ta ×2 lang ✓
