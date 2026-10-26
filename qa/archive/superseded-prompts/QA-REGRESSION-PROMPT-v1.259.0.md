# QA regression — v1.259.0 (agent fleet: CAR-101/105/107/108/109/104)

> База: v1.258.0 → v1.259.0. Тесты: **5823** (+74: car101 ×13, car105 ×26, car107 ×1, car109 ×30, car112-fix ×2…).

## §0 — Ворота
```bash
npm run test:ci                 # 5823 pass, exit 0
npm run test:coverage:gate      # comp-compare branch ≥ 86
npm run test:e2e:browser        # 144 total / 143 pass / 1 skip
node evals/workflow/run.mjs
```

## §1.5 — фиксы релиза
1. **Даты отчётов (CAR-101)**: evaluate/deep — **Date:** в отчёте равен сегодня;
   придуманная дата переписывается с warning'ом (activity: date-corrected).
2. **Геокодинг (CAR-105)**: повторная загрузка #/map — из кэша (0 запросов к
   провайдеру); hh.ru-строки с городом геокодируются; бюджет на запрос.
3. **Help ×18 (CAR-107)**: подписи кнопок в справке совпадают с UI
   («Run live» → локальная; FIX-5 резолвит label из словаря локали, ko→ko-KR alias).
4. **Язык UI (CAR-108)**: «все matching»/«только remote»/«Открыть Scan» — кириллицей;
   i18n-no-latin-leaks ловит фрагменты и funnel-слова.
5. **Валюты (CAR-109)**: COMPENSATION COMPARISON в промпте — годовые фигуры,
   raw-эхо, ≈-референс только по static-table; kr → caveat без выдуманного курса.
6. **Бандл (CAR-104)**: /js/bundle.js с Accept-Encoding: br → 598 KB, ETag/304;
   без AE — identity; прямые /bundle.js.br → 404.

## §2 — Регрессии (не трогать)
Всё из v1.258.0/1.257.x/1.256.x: tracker identity, backfill, score sort, CAR-103
tokenizer, CAR-106 usage cost, CAR-99 dense-array gate, vi ×19, snapshot R-12.

## §3 — Live (после деплоя)
prod-llm ×19: 19/19 200 (ta = CAR-70, документирован). #/map: доля вакансий без
локации падает (было 92%); повторная загрузка из кэша. Cold load: bundle.js
~598 KB (br), повторный визит — 304.

## §4 — Sign-off
См. qa/README.md; вердикт — в комментарии релизного PR.
