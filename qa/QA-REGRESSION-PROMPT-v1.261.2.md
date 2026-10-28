# QA regression — v1.261.2 (CAR-173 geocode cache + UI.md list continuation + help key leaks + map framing)

> База: v1.261.1 → v1.261.2. Тесты: **6651** (6645 pass / 6 skip / 0 fail — полный
> прогон `node --test tests/*.test.mjs` на ветке релиза; все 3 fail — гейты
> CHANGELOG-фан-аута, красные ДО фан-аута ×19 по плану, см. §0). Браузер: см. §0.
> Источник фиксов: репорт владельца (torn geocode-кэш, кадр job-map), remote-QA v1.261.1
> (85 raw-ключей в help, ctrl-k), CAR-173.
> Примечание: PR #561 (help spans ×17 + remote-qa ctrl-k asserts) и агенты (#534 skeleton
> Финальный счёт релиза (после фан-аута ×18 и мержа main): **6651 / 6645 pass / 0 fail**;
> (tests/help-rendered-keys.test.mjs + tests/remote-qa-ctrl-k.test.mjs из #561) ≈ 6622.

## §0 — Ворота
```bash
node --test tests/*.test.mjs    # 6609 tests / 6600 pass / 6 skip; 3 fail = строго
                                # гейты CHANGELOG ×19 (locale-parity, CAR-131 count)
                                # — красные до фан-аута, НЕ считаются дефектом ветки
npm run test:ci                 # зелёный ПОСЛЕ фан-аута CHANGELOG ×19 (оркестратор)
npm run test:e2e:browser        # см. README-бейдж текущего релиза
node tests/playwright-mobile-390.mjs   # 39 маршрутов @390px — 0 overflow, 0 covered CTA
node evals/workflow/run.mjs
npm run test:coverage:gate      # ≥ baseline (exempt: habr, states, …)
```

## §1 — ГЛАВНОЕ: чек-лист проверки исправленного

### Geocode-кэш (CAR-173, #562)
1. **Вставка → файл растёт без рестарта**: сделать поиск с геокодированием
   (`#/map` с новым адресом/городом) → в течение ~секунд после вставки
   `data/.cache/geocode.json` (или путь из `PATHS`) **содержит новую запись** —
   дебаунс-флaш (CAR-142) срабатывает на insert, ждать рестарта не нужно.
2. **Рестарт → кэш жив**: перезапустить сервер → кэш **парсится**, все записи
   на месте (не пустой, не «unexpected token» в логе). До фикса крэш посреди
   `writeFileSync` оставлял torn-файл — следующий старт молча выкидывал ВЕСЬ
   persistent-кэш. Регресс-гейт: `tests/geocode-flush.test.mjs` — (a) вставка
   доходит до файла в окно `GEOCODE_SAVE_MS`, (b) файл валидный JSON,
   (c) оба flush-пути не оставляют temp-мусора.
3. **Механика**: атомарная запись через `file-lock.mjs::atomicWrite`
   (temp в той же директории → rename → unlink при неудаче) на ОБОИХ
   flush-путях — тот же контракт, что pipeline.md/cv.md/profile.yml.

### Help ×19 — нет сырых ключей (#561)
4. **Скролл §8 (Pipeline) и §10 (Reports)** в `#/help` на нескольких локалях
   (en, ru, ja — минимум): **ни одного сырого i18n-ключа** в тексте
   (вида `pipe.*`, `rep2.*`, бэктики вокруг ключей). До фикса перенесённые
   строки после буллета эмитились как raw text — 85 ключей было видно в
   рендере. Гейт: `tests/help-rendered-keys.test.mjs` (из #561) рендерит
   каждый бандл реальной цепочкой и валится на любом из 1 711 ключей в тексте.

### UI.md — продолжения буллетов (#563)
5. **Любое место с многострочным буллетом** (help, отчёты, README-подобный
   markdown через `UI.md`): перенесённая строка **дорисовывается в тот же
   `<li>`** (`<br/>`-разделитель), без литеральных `**`/бэктиков-маркеров.
   До фикса ~95 «хвостов» на локаль. Регресс-гейт:
   `tests/uimd-list-continuation.test.mjs` (12 кейсов, red на старом хендлере).
   Известный остаток (не регрессия): вложенные `  - ` списки, нумерованные
   списки, фенсы внутри списков — отдельный пробел, задокументирован.

### Карта cvstart.org / captures (#560)
6. **`images/job-map-*.png` ×19**: кадр — **без хрома** (нет половины topbar-поиска,
   нет обрезанного h1 сверху, нет серой полоски сайдлиста справа), **маркеры
   не резаны** краем карты (кластер у Лондона не пополам), **нет белой
   горизонтальной линии** (~2/3 высоты — артефакт captureBeyondViewport).
   Регенерация: `node scripts/capture-map-screenshots.mjs` — теперь ждёт
   drain гео-очереди (located + noLoc === total), клип по `.job-map-page`,
   zoom-out два шага, plain viewport screenshot, целочисленный контейнер.

### Ctrl+K — RU-раскладка (CAR-122, повтор релиза)
7. **Ctrl+K на русской раскладке** (физическая клавиша K, `key='л'`
   `code='KeyK'`) → **командная палитра** открывается; Escape закрывает;
   ↑↓ навигация, Enter открывает пункт. На EN-раскладке — то же.
   Remote-QA прод-регрессия теперь ассертит палитру явно (#561):
   `.nav-v2-palette[role=dialog]` + фокус в `nav-v2-input` (или legacy
   search-focus как fallback); юнит `tests/remote-qa-ctrl-k.test.mjs` —
   6 сценариев.

## §2 — CAR-122: контракт Ctrl+K (без изменений)
**Ctrl+K открывает КОМАНДНУЮ ПАЛИТРУ — а НЕ фокусит поиск напрямую.**
Поиск фокусится ИЗ палитры. Строка QA-промпта v1.261.0 «Ctrl+K фокусит
поиск» устарела; v1.261.1/v1.261.2 несут актуальный контракт, и #561
закрепил его ассертом в прод-регрессии.

## §3 — регресс-классы прошлых релизов (не сломать)
- two-pager TDZ (CAR-170), docs-assistant @390, map-чипы @390 (v1.261.1).
- CAR-137: hints «?» ×13 view + mode-страницы, v2empty ×5, специфические
  ошибки ×5 потоков.
- Скелетоны CAR-112, empty states CAR-124/137, pipeline undo с comp (CAR-150),
  grouped view + bulk discard (CAR-116).
- Язык-свитч `#/scan` — синхронная перекраска (v1.261.0 #534) + skeleton
  re-arm (агент в полёте — проверить после мерджа).
- Security-волна v1.261.0: CSRF acting-GET gate, safeGet timeout/signal,
  atomic writes (теперь и geocode-кэш — тот же контракт).
- CAR-142 flush-механика geocode (insert-flush/exit-flush/bounded shutdown)
  не деградировала — фикс #562 менял только способ записи.
- A–G карта отчётов (CAR-148/149), ta/hi eval-таймаут 480 с (CAR-147).

## §4 — что осознанно НЕ сделано
- Вложенные списки / нумерованные списки / фенсы в списках в `UI.md` —
  отдельный пробел (задокументирован в #563), следующая docs-волна.
- CAR-138 — в работе агентом, влетает до тега (помечено в CHANGELOG).
- CodeQL FP-dismiss ×5 (`js/missing-rate-limiting`) — ждёт security_events
  токен (оператор), не код.
- CHANGELOG ×19 фан-аут — отдельный шаг оркестратора; до него
  `check-changelog-parity` красный (ожидаемо).
- Милы-дисплей на карте, cluster view (CAR-125) — по-прежнему в очереди.
- Connect-time DNS pinning (undici — вне зависимостей, residual задокументирован).
