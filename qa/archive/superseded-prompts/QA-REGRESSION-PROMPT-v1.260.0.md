# QA regression — v1.260.0 (review-hardening train: #491–#498)

> База: v1.259.0 → v1.260.0. Тесты: **5988** (+165). Браузер: **152 pass / 0 fail / 1 opt-in skip**.

## §0 — Ворота
```bash
npm run test:ci                 # 5988 pass, exit 0
npm run test:e2e:browser        # 153 total / 152 pass / 1 opt-in skip
node evals/workflow/run.mjs
npm run test:coverage:gate
```

## §1 — фиксы релиза
1. **Зарплаты (CAR-143 r2)**: «6 month contract, $120k» → 120 000/год (не ×12);
   «$100k» без явного ISO-кода → caveat, не USD; «Founded 2019, yearly bonus» → пусто;
   minimum/target_range не склеиваются в диапазон.
2. **Даты (CAR-144 r2)**: корректируется только преамбула до первого `## `;
   два кандидата в преамбуле → no-op; H2-заголовок в начале → byte-identical no-op.
3. **Habr/геокод (CAR-142 r2)**: «Возможна релокация» — не локация; рестарт сервиса
   не теряет последние записи кэша; исчерпанный бюджет → 503 + Retry-After.
4. **Бандл (CAR-145 r2+r3)**: shell ссылается `/js/bundle.js?v=<hash>`;
   совпал `?v=` → immutable, не совпал → no-store; недочитанный хеш → null;
   прерванная сборка не публикует полубайт и не отдаёт temp-файл.
5. **#/deep (CAR-146)**: карточка с длинным именем файла не растягивает
   страницу за 390px (узкий viewport, en).
6. **#/pipeline v2 (CAR-116)**: карточки, группировка, bulk discard с undo;
   удаление требует подтверждения; undo честный; повторный bulk не запускается.
7. **#/reports v2 (CAR-118)**: поиск/фильтры/сортировка/карточки; aria-sort;
   prefs сохраняются после перезагрузки; «Company — Role» + «x.x/5».
