# QA regression — v1.255.2 (CAR-99 scan crash + CAR-97 vi check + CAR-98 zh-TW)

> База: v1.255.1 → v1.255.2. Тесты: **5695** (+9: car99-fallback-holes ×4, car97-vi-lang-check ×4, CAR-98 prompt ×1).

## §0 — Ворота
```bash
npm run test:ci                 # 5695 pass, exit 0
npm run test:coverage:gate
npm run test:e2e:browser        # 144 total / 143 pass / 1 skip (opt-in layout-capture)
node evals/workflow/run.mjs
```

## §1.5 — фиксы релиза
1. **#/scan рендерится без краша (CAR-99)**: `#/scan` открыть в каждой локали — нет
   `TypeError … reading 'length' at isApiBackedCompany` в консоли; чипы Direct-API/Web-search
   считаются; Active-companies знаменатель корректен. Гейт car99-fallback-holes красный на `,,`.
2. **vi-языковой чек (CAR-97)**: у vi своя таблица стоп-слов — describe() показывает
   `vi stop words ≥5`; английский отчёт по-прежнему фейлится.
3. **zh-TW SCORE_SUMMARY (CAR-98)**: closing-reminder требует блок (MUST END / mandatory);
   live-проверка zh-TW evaluate после деплоя — блок на месте.

## §2 — Регрессии (не трогать)
Всё из v1.255.1/1.255.0: vi ×19, cold-load bundle, snapshot-safety R-12, 11 LLM-инвариантов,
heading-cutter r2, UKR-последовательности, carry-over lifecycle, pipeline skip contract.

## §3 — Live (после деплоя)
prod-llm ×19: 19/19 200; следить vi (CAR-97 — чекер теперь честный: если отчёт реально
не на vi — это дрифт модели, класс CAR-70) и zh-TW (CAR-98 — должен пройти).

## §4 — Sign-off
- [ ] §0 зелёный · [ ] §1.5 · [ ] §2 · [ ] §3 live re-check · [ ] прод `1.255.2` / parent `1.38.0`
