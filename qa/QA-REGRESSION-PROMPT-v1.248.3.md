# QA regression — v1.248.3 (post-regression follow-up: t.me junk reports, cleanup safety, map attribution, chip contrast)

> База: v1.248.2 → v1.248.3. Тесты: **5170 → 5177**.

## §0 — Ворота
```bash
npm run test:ci                 # 5177 pass, exit 0
npm run test:coverage:gate      # 98.16% line / 89.38% branch
npm run test:e2e                # 21 pass · 0 fail
npm run test:e2e:browser && npm run test:e2e:full
node evals/workflow/run.mjs     # 12 pass · 0 fail
node --test tests/auto-pipeline-jd-gate.test.mjs tests/post-qa-cleanup-qa-garbage.test.mjs tests/llm-routes-coverage.test.mjs tests/llm-routes-hardening.test.mjs tests/playwright-map.mjs
```

## §1 — t.me мусорные отчёты (CAR-61a продолжение)
1. Pipeline `t.me`-запись (страница > 200 симв.) + модель без SCORE →
   **нет отчёта, нет строки трекера**; SSE `error` на шаге evaluate с
   `rejected: true`; активити: `auto-pipeline.evaluation.rejected`.
2. Настоящий отчёт (A–G + SCORE_SUMMARY) сохраняется как раньше.
3. guessCompanyRole для `t.me/<канал>/123` → компания = имя канала
   («Somechannel»), никогда «T»; для example.com — пусто → отказ.
4. Greenhouse-запись без компании в тексте → run отклоняется
   («company/role not identifiable»), никакого `unknown-role` отчёта.

## §2 — post-qa-cleanup читает шапку (безопасность удаления)
1. t-role отчёт с `**Score:** 4.2/5` без summary — **выживает**.
2. t-role без оценки нигде — удаляется.
3. Dry-run ничего не меняет (mtime и число файлов).

## §3 — Атрибуция Leaflet на #/map
1. Все 4 угла атрибуции не перекрыты (Playwright, elementFromPoint).
2. Toast не мешает проверке (гасится перед замером).

## §4 — Контраст дашборд-чипов
`dash-chip__label` и `--manual` ≥ 4.5:1 в светлой и тёмной темах
(foggy-strong; dark ≈ 6.2:1).

## §5 — Регрессии
- Гейт MIN_JD_CHARS, SCORE-парсер, lang-check ta — работают (не тронуты).
- ar/ja lang ✓ + A–G ✓ (повторный прогон v1.248.2/3).
- Прод `1.248.3`.

## §6 — Sign-off
- [ ] §0 зелёный · [ ] §1–§4 · [ ] §5 регрессий нет · [ ] прод `1.248.3`
