# QA regression — v1.248.2 (regression fixes: eval-timer junk, SCORE parser, tracker i18n, a11y)

> База: v1.248.1 → v1.248.2. Тесты: **5136 → 5170**.

## §0 — Ворота
```bash
npm run test:ci                 # 5170 pass, exit 0
npm run test:coverage:gate      # 98.17% line / 89.42% branch
npm run test:e2e                # 21 pass · 0 fail
npm run test:e2e:browser && npm run test:e2e:full
node evals/workflow/run.mjs     # 12-14 pass · 0 fail
node --test tests/auto-pipeline-jd-gate.test.mjs tests/post-qa-cleanup-qa-garbage.test.mjs tests/remote-qa-lang-check.test.mjs tests/eval-validate.test.mjs
```

## §1 — Пустые JD-отчёты (CAR-61a)
1. Добавить в pipeline `https://example.com/qa-v167-…` → запустить
   auto-pipeline: SSE-ошибка на шаге fetch, warn в консоли с URL,
   **файл отчёта НЕ создаётся**, строка трекера не появляется.
2. Нормальная вакансия (JD ≥ 200 симв.) проходит гейт как прежде.

## §2 — post-qa-cleanup (CAR-61b/1c)
1. `node scripts/post-qa-cleanup.mjs` (без флагов) — DRY-RUN: печатает план
   (ZZ-QA-TEST строки, `*-t-role-*` без валидного SCORE, example.com),
   НЕ меняет ни одного файла.
2. `--apply`: бэкапы `*.bak-<ts>` / `qa/cleanup-backup-<ts>/` созданы ДО
   изменений; удаляется ровно целевое; отчёт с валидным SCORE выживает.
3. **Прод**: только после явного «да» пользователя.

## §3 — lang-check ta (CAR-62)
Тамильский текст → `languageOk === true`; английский → false.

## §4 — SCORE-парсер (CAR-64)
Формы «4,2/5», «4.2 / 5», «**4.2**», «SCORE :» — валидны; «4,200» — тысячи
(не 4.2); при провале в логе только строка `SCORE:`.

## §5 — Статусы трекера ×18 (CAR-65)
Табы и бейджи на каждом языке — локализованные подписи; фильтры/URL —
канонические английские значения (проверить: фильтр по статусу работает,
URL не изменился). Скриншот ar.

## §6 — ETA и A–G (CAR-66)
evaluate/deep/mode-page/stats: ETA «~2–4 мин» ×18 (нигде не «~30s»);
подзаголовок evaluate — «A–G».

## §7 — Доступность (CAR-67)
Контраст api-keys__count и pipeline-счётчика ≥ 4.5:1 (расчёт); пустой чип
фасета не рендерится.

## §8 — Мелкий UI (CAR-68)
Delete красный только при выборе; EMAIL не обрезан на 1440; отступ в
пилюле live-evals (и RTL); docs-FAB не перекрывает атрибуцию Leaflet;
«?» не переносится; воздух на usage; health = «career-ops-ui v1.248.2».

## §9 — remote-qa (прод)
- live=true: ta зелёный (lang ✓), ar/ja lang ✓ + A–G ✓ (дрейф не повторился).
- Тексты отчётов в логи CI не попадают.

## §10 — Sign-off
- [ ] §0 зелёный · [ ] §1–§8 · [ ] §9 прод · [ ] версия `1.248.2`
