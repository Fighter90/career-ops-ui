# QA regression — v1.256.0 (CAR-127/128 identity + CAR-129 sort/backfill)

> База: v1.255.2 → v1.256.0. Тесты: **5705** (+10: identity в auto-pipeline-jd-gate ×5+2, car129 sort gate ×1, backfill ×4 — минус заменённые v1.248.x кейсы).

## §0 — Ворота
```bash
npm run test:ci                 # 5705 pass, exit 0
npm run test:coverage:gate
npm run test:e2e:browser        # 144 total / 143 pass / 1 skip (opt-in layout-capture)
node evals/workflow/run.mjs
```

## §1.5 — фиксы релиза
1. **Идентичность трекера (CAR-127/128)**: прогнать auto-pipeline на (а) Lever-вакансии с
   заголовком «Senior X - Company» → в строке трекера Company = правая часть, Role = «Senior X»
   (не наоборот); (б) hh.ru-вакансию → Company никогда не «hh»: либо работодатель из текста
   («В компании X ищут…»), либо отказ с `company/role not identifiable` (пустое лучше выдуманного).
   Гейты: `auto-pipeline-jd-gate.test.mjs` — 5 новых CAR-127-кейсов + 2 CAR-128 красные на старом коде.
2. **Сортировка трекера (CAR-129)**: `#/tracker` → сортировка по Score — пустые строки В КОНЦЕ
   и при asc, и при desc; score-фильтр «4+» по-прежнему не пропускает бесскорые. Гейт в
   `tracker-a11y-sort.test.mjs`.
3. **Бэкфилл score (CAR-129)**: `POST /api/tracker/backfill-scores` — заполняет ТОЛЬКО пустые
   Score-ячейки строк, чей отчёт содержит парсимый score; N/A-сентинелы, строки без отчёта и
   отчёты без score не трогает; второй вызов → `updated: 0`. UI-кнопки нет (оператор вызывает
   curl-ом) — это сознательно, решение о прогоне на проде за владельцем данных.

## §2 — Регрессии (не трогать)
Всё из v1.255.2/1.255.1/1.255.0: CAR-99 dense-array gate, vi ×19, cold-load bundle,
snapshot-safety R-12, 11 LLM-инвариантов, heading-cutter r2, UKR-последовательности,
carry-over lifecycle, pipeline skip contract.

## §3 — Live (после деплоя)
- prod-llm ×19: 19/19 200.
- Прогнать бэкфилл на проде — ТОЛЬКО после явного «да» владельца (пишет в data/applications.md);
  до прогона проверить `updated`/`missingReport`/`reportScoreless` на dry-читке списка.
- CAR-100 пере-скоупнут (labelN), CAR-102 отменён с пруфами — не регрессить их в этот релиз.

## §4 — Sign-off
См. чек-лист в qa/README.md; вердикт — таблицей в комментарий релизного PR.
