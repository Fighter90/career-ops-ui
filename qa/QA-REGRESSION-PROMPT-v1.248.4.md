# QA regression — v1.248.4 (t.me role chain, identity gate before LLM, README translations parity)

> База: v1.248.3 → v1.248.4. Тесты: **5177 → 5181**.

## §0 — Ворота
```bash
npm run test:ci                 # 5181 pass, exit 0
npm run test:coverage:gate
npm run test:e2e && npm run test:e2e:browser && npm run test:e2e:full
node evals/workflow/run.mjs
node --test tests/auto-pipeline-jd-gate.test.mjs tests/readme-translations-parity.test.mjs
```

## §1 — Роль из кириллического t.me-поста (CAR follow-up)
1. t.me-пост с вакансией (кириллица, «Компания: X», роль по RU-ключевым
   словам) + модель с полным отчётом → отчёт сохранён с ролью в имени
   файла (`<дата>-<канал>-<роль>-…`), трекер +1.
2. Пост без вакансии + модель без SCORE → отказ на шаге evaluate, 0
   файлов, 0 строк трекера (как в v1.248.3).
3. guessCompanyRole: t.me и t.me/s/ — канал, никогда «S»/«T»;
   example.com — пусто.

## §2 — Гейт идентичности ДО LLM
Запись без компании и без ключевых слов роли → отказ на шаге fetch
(«no company/role hints»), LLM-заглушка не вызвана (счётчик = 0).

## §3 — README «Translations» блок
Каждый README: ровно 17 ссылок на другие README, своей в блоке нет.
(ar/pl/uk получили блок; дрейф сепараторов устранён; самоссылка ko-KR
заменена на bold.) Тест: tests/readme-translations-parity.test.mjs.

## §4 — deploy.yml recon (после деплоя)
`mode=recon` печатает «eval-timer … honours rejected: yes/no» — grep по
скрипту таймера, содержимое не печатается.

## §5 — Регрессии
- Валидация до сохранения (v1.248.3), cleanup по шапке, атрибуция карты,
  контраст пилюль — работают.
- Прод `1.248.4`.

## §6 — Sign-off
- [ ] §0 зелёный · [ ] §1–§3 · [ ] §4 recon · [ ] §5 регрессий нет ·
- [ ] прод `1.248.4`
