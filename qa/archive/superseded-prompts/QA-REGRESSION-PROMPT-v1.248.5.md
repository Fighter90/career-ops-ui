# QA regression — v1.248.5 (post-regression: t.me embed fetch, pipeline skip contract, uk ordinals, offline tests)

> База: v1.248.4 → v1.248.5. Тесты: **5181 → 5189**.

## §0 — Ворота
```bash
npm run test:ci                 # 5189 pass, exit 0 (offline — без живой сети)
npm run test:coverage:gate      # 98.15% line / 89.40% branch
npm run test:e2e && npm run test:e2e:browser && npm run test:e2e:full
node evals/workflow/run.mjs     # 12 pass · 0 fail
node --test tests/auto-pipeline-jd-gate.test.mjs tests/eval-validate.test.mjs tests/readme-translations-parity.test.mjs
```

## §1 — t.me embed fetch (CAR-61 финал)
1. t.me-запись (канал + id) фетчится как embed (`?embed=1&mode=tme`);
   текст поста извлекается из `.tgme_widget_message_text` (fallback:
   og:description).
2. Пост с вакансией (кириллица) → отчёт сохранён, трекер +1.
3. Embed без `.tgme_widget_message_text` и без og:description → отказ на
   шаге fetch (`telegram post has no text`, `rejected: true`), 0 вызовов LLM.
4. `t.me/s/<канал>/<id>` фетчится как embed одного поста, а не как лента.

## §2 — Pipeline skip contract (CAR-61c серверная часть)
1. Отклонённая запись помечается в `data/pipeline.md` — строка удаляется
   из код-фенса, URL добавляется в `## Rejected` с короткой причиной.
2. Повторный вызов auto-pipeline для той же записи: 0 вызовов LLM
   (счётчик заглушки = 0), пометка ровно одна.
3. deploy.yml recon печатает `pipeline rejected marks: N` +
   `honours rejected: yes (server-side)`.

## §3 — Офлайн-тесты (CAR: тест ходит в сеть)
1. `tests/auto-pipeline-jd-gate.test.mjs` проходит БЕЗ живой сети
   (_setLookup заглушка вместо реального DNS).
2. Офлайн-проверка: `node --test tests/auto-pipeline-jd-gate.test.mjs`
   даёт 10/10 при недоступном DNS.

## §4 — UK-порядковая нумерация блоков (CAR: uk оценка)
1. uk-оценка с заголовками `## А) …` — `## Ж) …` валидируется без ошибок
   (последовательность А Б В Г Д Є Ж = позиционно A..G).
2. Частичная последовательность отклоняется.
3. Промпт требует латинские буквы A–G явно (для всех локалей).

## §5 — Word-boundary ключевые слова (CAR: роль срабатывает на подстроку)
1. linkedin.com и x.com корни → 0 вызовов LLM.
2. «Senior Data Engineer» и «Ведущий разработчик» проходят гейт.

## §6 — deploy.yml cleanup modes (CAR-61c)
`mode=cleanup-plan` (dry run, только числа) и `mode=cleanup-apply`
(бэкапы + перемещение). Verify не запускается для cleanup-режимов.

## §7 — Регрессии
- Валидация до сохранения, cleanup по шапке, атрибуция карты, контраст
  пилюль — работают.
- Прод `1.248.5`.

## §8 — Sign-off
- [ ] §0 зелёный · [ ] §1–§5 · [ ] §6 cleanup · [ ] §7 регрессий нет ·
- [ ] прод `1.248.5`
