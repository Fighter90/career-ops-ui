# QA regression — v1.258.0 (agent fleet: CAR-100/110/130/112/111)

> База: v1.257.0 → v1.258.0. Тесты: **5749** (+36: car100 ×5, car110 ×7, car130 ×7, car112 ×7, evaluate-prompt-caching ×8, +2 прочих).

## §0 — Ворота
```bash
npm run test:ci                 # 5749 pass, exit 0
npm run test:coverage:gate
npm run test:e2e:browser        # 144 total / 143 pass / 1 skip
node evals/workflow/run.mjs
```

## §1.5 — фиксы релиза
1. **#/scan счётчик (CAR-100)**: «Активные компании» — числитель и знаменатель из одной
   вселенной (API-backed tracked); hh.ru/telegram-работодатели не раздувают числитель.
   На проде после прогона скана цифры согласованы с тултипом.
2. **Deep research (CAR-110)**: отчёт требует `[source: domain.com]` у фактов, пишет
   `unknown` вместо догадок, заканчивается `## Data freshness`; `POST /api/deep`
   принимает `url` (не-строка → 400).
3. **Формы (CAR-130)**: неуспешный POST подсвечивает первое поле (`aria-invalid` +
   `.is-error` + фокус); на loopback подсказка — dev-команда, на проде — «сервер не
   отвечает»; баннер соединения больше не советует `bash web-ui/bin/start.sh`.
4. **Загрузка (CAR-112)**: #/map и #/tracker показывают h1 мгновенно (до данных);
   скелетон-ряды вместо текста «Загрузка…» на tracker/scan/map;
   prefers-reduced-motion отключает пульс.
5. **Prompt caching (CAR-111)**: второй подряд evaluate по тому же CV+профилю идёт с
   `cache_read_input_tokens` > 0 (кэш-тариф); JD не внутри кэшируемого блока; при
   отсутствии префикса — fail-open к старому запросу.

## §2 — Регрессии (не трогать)
Всё из v1.257.0/1.256.x: tracker identity (CAR-127/128), backfill-эндпоинт, score sort,
CAR-103 tokenizer `\p{M}`, CAR-106 usage cost, CAR-99 dense-array gate, vi ×19,
cold-load bundle, snapshot-safety R-12.

## §3 — Live (после деплоя)
prod-llm ×19: 19/19 200 (ta-дрифт = CAR-70, документирован).
Проверить на проде: deep-отчёт содержит `[source: …]` и `## Data freshness`;
форма с невалидным URL подсвечивает поле; второй evaluate дешевле первого
(cache_read в usage).

## §4 — Sign-off
См. qa/README.md; вердикт — в комментарии релизного PR.
