# QA regression — v1.248.1 (location_filter tiers, CAR-60)

> Аудит-патч без родительской дельты. База: v1.248.0 → v1.248.1.
> Тесты: **5130 → 5136**.

## §0 — Ворота
```bash
npm run test:ci                                  # 5136 pass, exit 0
node --test tests/location-filter.test.mjs       # 16 (5 новых тир-тестов)
node --test tests/sources-workable.test.mjs      # 26 (+ родительская форма consumer-кейса)
node evals/workflow/run.mjs                      # 14 pass · 0 fail
```

## §1 — always_allow сильнее block
1. `portals.yml`: `location_filter: { block: [romania, poland, croatia], always_allow: [united kingdom] }`.
2. Скан с workable-бордом: merged-ячейка «London, United Kingdom · Romania ·
   Poland · Croatia» ПРОХОДИТ (домашний регион в опциях).
3. Чистаяblocked-строка «Warsaw, Poland» — отклоняется.
4. Регресс: без always_allow поведение прежнее (block отклоняет).

## §2 — block_hard сильнее always_allow
1. `{ block_hard: [russia], always_allow: [remote], allow: [remote] }`:
   «Remote (Russia)» — отклонена (block_hard непобедим).
2. «Remote (Berlin)» — проходит.

## §3 — strict учитывает block_hard
`{ block_hard: [...], strict: true }`: пустая локация → отклонена
(ограничивающий тир сконфигурирован).

## §4 — Help ×18
`docs/help/<L>.md`, секция location_filter: буллеты always_allow /
block_hard переведены и вставлены после block-буллета (порядок списка
соответствует приоритету); markdown-списки не разорваны (8 файлов имели
двухстрочный block-буллет — сиромы возвращены на место).

## §5 — Регрессии
- Тест-сьюты провайдеров (gupy/workable/radancy/smartrecruiters) не тронуты
  по поведению — 146/146.
- Workable consumer-тест теперь в родительской форме (always_allow) +
  сохранённая allow-list форма как второй вердикт.
- Прод `1.248.1`.

## §6 — Sign-off
- [ ] §0 зелёный · [ ] §1–§3 тиры · [ ] §4 help ×18 · [ ] §5 регрессий нет
