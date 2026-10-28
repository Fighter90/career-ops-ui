# QA regression — v1.261.0 (full-review wave complete + language-switch fix)

> База: v1.260.0 → v1.261.0. Тесты: **6531** (+543). Браузер: **171–172 pass / 0 fail / 1 opt-in skip**.

## §0 — Ворота
```bash
npm run test:ci                 # 6531 pass, exit 0
npm run test:e2e:browser        # 172 total / 171 pass / 1 opt-in skip
node evals/workflow/run.mjs
npm run test:coverage:gate      # 98.28/89.85 ≥ baseline 96/86
```

## §1 — фиксы релиза

### Security (full-review wave)
1. **FULL-R1 (#519)**: кросс-сайтовый GET на `/api/stream/scan` → 403; легальный same-origin SSE работает;
   одновременные POST /api/pipeline + скан-финал не теряют строки (race-сьют);
   прерванная запись не оставляет `*.tmp`.
2. **FULL-R2 (#514) + M2 (#520/#525)**: rss без https/приватных IP; safeGet с
   caller-signal + timeout → отклонение по таймауту (не висит); DNS-фейл гварда →
   `ECAREEROPS_BLOCKED_DNS` (fail-closed); кросс-origin редирект не несёт
   Authorization/Cookie; pre-aborted signal → чистый reject без крэша.
3. **FULL-R4 (#513/#518)**: «JavaScript: React, Node» выживает; «R&amp;D» байт-в-байт.
4. **FULL-M4 (#523)**: SVG с лежачим `image/png` header → 404, оригинал не тронут,
   негативный кэш; batch второй запуск → BATCH_BUSY; `--parallel 500` → кламп 8;
   `--min-score abc` → 400.
5. **M6 (#531/#536/#525)**: dotenv с `__proto__` ключом → отказ; `64:ff9b::7f00:1`
   классифицируется приватным; клиентский disconnect во время evaluate →
   провайдер получает abort; GET /api/followup релеит cadence (импорт цел).

### Качество
6. **CAR-147 (#524)**: evaluate с `lang=ta` — таймаут 480 с (не 300); en — 300 с.
7. **CAR-148/149 (#530)**: ru-отчёт содержит `## G) Posting Legitimacy` последним
   буквенным блоком; skeleton-drift гейт ловит рассинхрон с oferta.md.
8. **CAR-150 (#537)**: DELETE /api/pipeline возвращает `comp`; undo через fallback
   сохраняет `| comp`; POST comp с `\n` → санитизация.
9. **Язык-свитч (#534)**: `#/scan` en→ru — результаты не исчезают (Playwright:
   seeded corpus + 4 s delay, ru-фасеты рисуются из module state).

### Клиент/сайт
10. **M6 клиент (#536)**: ручной EventSource вне api.js отсутствует; dashboard
    Hired-tint; clipboard await в evaluate/mode-page; один cost-hint observer.
11. **R3 (#527)**: `--accent` определён (map focus-rings живые); css-token-drift
    гейт зелёный.
12. **R4 (#538)**: assessments/mode-page/pipeline-preview — Skeleton-блоки.
13. **CAR-133 (#532)**: cvstart.org — параллакс под reduced-motion, SIMULATED
    demo-лейбл, 6 CAR-140 слотов.
14. **CAR-135 (#533/#540/#541/#542)**: все 19 help-файлов — v2-контент, H2=33/H3=125,
    «121 источников» из живого реестра.

### M1/M3
15. **FULL-M1 (#526/#539)**: outcome/followup спавнят через runTrackedScript;
    tracker.mjs пишет через atomicWrite; гейт запрещает bare-const бэкслайд.
16. **FULL-M3 (#522)**: malformed 200 от getro → throw (не «healthy, 0 jobs»);
    pinnedOverride отклоняет кросс-хост `company.api`.

## §2 — регресс-классы прошлых релизов (не сломать)
- Скелетоны, empty states, kanban drag, pipeline undo (CAR-112…117, 151).
- Language sweep ×19 без латинских протечек; help ×19 паритет 33/125.
- Узкий viewport 390px (CAR-146 регресс); /#/deep оверфлоу.

## §3 — что осознанно НЕ сделано
- Connect-time DNS pinning (undici — вне зависимостей, residual задокументирован).
- CAR-140 скриншоты (нужен задеплоенный v2 UI) · CAR-137/138/141 (следующая docs-волна).
- CodeQL `js/missing-rate-limiting` — документированный FP (кастомный лимитер не кредитуется).
