# QA regression — v1.261.1 (prod-QA client fixes + CAR-137 completion + CAR-140 screenshots)

> База: v1.261.0 → v1.261.1. Тесты: **6594** (+63). Браузер: **171–172 pass / 0 fail / 1 opt-in skip**
> + mobile-390 harness (39 маршрутов, отдельный запуск). Источник фиксов: remote-QA прода v1.261.0
> (run 40602310441; Linear CAR-170/172) + CAR-137/140 доволка.
> Примечание: PR #554 (two-pager TDZ, Ctrl+K e.code, docs-assistant shrink) после мерджа добавит
> Финальный счёт релиза: **6594 теста / 6588 pass / 6 skip** (по факту мерджа #554/#555/#556/#548).

## §0 — Ворота
```bash
npm run test:ci                 # 6594 tests / 6588 pass, exit 0
npm run test:e2e:browser        # 172 total / 171 pass / 1 opt-in skip
node tests/playwright-mobile-390.mjs   # 39 маршрутов @390px — 0 overflow, 0 covered CTA
node evals/workflow/run.mjs
npm run test:coverage:gate      # ≥ baseline 96/86
```

## §1 — ГЛАВНОЕ: чек-лист проверки исправленного

### Клиентские фиксы прода (P1)
1. **two-pager TDZ (CAR-170, #554)**: открыть `#/two-pager` при сохранённых тегах —
   h1 рендерится, теги восстанавливаются чипами, live-preview рисуется,
   **в консоли НЕТ** `Cannot access 'previewTimer' before initialization`.
   Минимум en + ru (краш был локале-независимый, ×19). Behavioural-тест:
   `tests/prodqa-client-fixes.test.mjs` исполняет реальный view-модуль.
2. **Ctrl+K на RU-раскладке (CAR-172, #554)**: переключить раскладку на русскую,
   нажать Ctrl+K (физическая клавиша K) → **командная палитра открывается**;
   Escape закрывает; ↑↓ навигация, Enter открывает пункт. На EN-раскладке — то же.
   Воспроизведение бага: аккорд приходил как `key='л' code='KeyK'` и молчал.
3. **docs-assistant @390 (CAR-172, #554)**: `#/docs-assistant` на 390px —
   горизонтального overflow НЕТ (стартовые чипы CAR-136 давали +56px,
   неразрывный 418px item); чипы сжимаются/переносятся.
   Регресс-гейт: `node tests/playwright-mobile-390.mjs` (39 маршрутов).

### Мобильная волна 390
4. **map @390 (#552)**: `#/map` на 390px — мета-чипы **не перекрывают** CTA-строку
   (проверяется и автоматически: CTA-hit чек в mobile-390 harness).
5. **#/scan язык-свитч (#534, v1.261.0)**: en→ru на `#/scan` — перекраска
   **синхронная**, результаты и фасеты не исчезают (просмотр не мигает пустым).

### CAR-137 — ошибки, пустые состояния, подсказки
6. **Hints «?» на 13 view (#550)**: на каждой из страниц — pipeline, reports,
   dashboard, cv, portals, usage, activity, assessments, map, health,
   docs-assistant, settings — у H1 есть «?», поповер открывается, текст
   локализован (не «English fallback»). Плюс 8 mode-страниц
   (project/training/followup/batch/contacto/cover/interview-prep/patterns) —
   hint через mode-page kit.
7. **Пустые состояния v2empty ×5 (#550)**: при пустых данных каждая из страниц
   даёт заголовок + пояснение + пример (aria-hidden) + рабочее действие:
   `#/reports` → действие ведёт в `#/evaluate`; `#/usage` → «Add a provider key»
   ведёт в `#/config`; `#/portals` → кнопка скроллит к СВОЕМУ Discover-блоку
   (не дублирует UI, один вызов discover-эндпоинта); `#/activity` → `#/scan`;
   `#/dashboard` (recent/pipeline тайлы) → `#/scan` и `#/pipeline`.
8. **Специфические тексты ошибок (#550)**: вместо общего «Error» —
   конкретные ключи в 5 потоках: упавший POST evaluate, auto-pipeline stream
   без терминального события, scan→pipeline add, загрузка репостов, undo в
   pipeline (ключ `err.pipeline.undo`, toast-окно 950 мс).

### Сайт / CAR-140
9. **cvstart.org (#553)**: реальные скриншоты v2, **0 плейсхолдеров**
   (ScreenshotSlot удалён); job-map showcase показывает настоящие capture ×19
   локалей лендинга; `images/README.md` соответствует содержимому.
10. **Fresh captures ×48 (#551)**: dashboard ×19 + job-map ×19 +
    scan/pipeline/tracker/reports × en/ru — на README/help/лендинге нет
    устаревших v1-скриншотов (dashboard-ar…zh-TW перезаписаны).

## §2 — CAR-122: контракт Ctrl+K (ОБНОВЛЁН)

**Ctrl+K открывает КОМАНДНУЮ ПАЛИТРУ — а НЕ фокусит поиск напрямую.**
Поиск фокусится ИЗ палитры (палитра перехватывает аккорд первой — это
документированный контракт CAR-122, не регрессия). Строка QA-промпта
v1.261.0 «Ctrl+K фокусит поиск» **устарела и заменена этим блоком**.

Чек:
- Ctrl/Cmd+K (обе раскладки, физический `e.code === 'KeyK'`) → палитра;
- Esc / клик по оверлею / выбор пункта → палитра закрывается;
- из палитры доступен пункт поиска; сам аккорд поиск не фокусирует;
- «?»-подсказка палитры: `↑↓ navigate · Enter open · Esc close` (локализована).

## §3 — регресс-классы прошлых релизов (не сломать)
- Скелетоны CAR-112 (assessments/mode-page/pipeline preview), empty states CAR-124/137.
- Pipeline undo с comp-метаданными (CAR-150), grouped view + bulk discard (CAR-116).
- Узкие viewport'ы: CAR-146 (`#/deep` @390), 320px формы (v1.227.2), mobile-390 ×39.
- Язык-свитч ×19 без латинских протечек; help ×19 паритет 33/125.
- Security-волна v1.261.0 не деградировала: CSRF acting-GET gate, safeGet
  timeout/signal, atomic pipeline writes.
- A–G карта отчётов (CAR-148/149), ta/hi eval-таймаут 480 с (CAR-147).

## §4 — что осознанно НЕ сделано
- CAR-138/141 — следующая docs-волна (CAR-137 закрыт этим релизом, CAR-139 идёт
  параллельным PR).
- Connect-time DNS pinning (undici — вне зависимостей, residual задокументирован).
- CodeQL `js/missing-rate-limiting` — документированный FP (кастомный лимитер не
  кредитуется); реальные 4 алерта закрыты #547.
- Милы-дисплей на карте, cluster view (CAR-125) — по-прежнему в очереди.
