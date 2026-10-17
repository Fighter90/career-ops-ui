# QA regression — v1.251.1 (specialization tokens + remote-qa shape/language split)

> База: v1.251.0 → v1.251.1. Тесты: **5245** (test:ci; browser 129/0 + tokens 5/0).

## §0 — Ворота
```bash
npm run test:ci                 # 5245 pass, exit 0 (offline)
npm run test:coverage:gate      # 98.23% line / 89.46% branch
npm run test:e2e && npm run test:e2e:browser && npm run test:e2e:full
node evals/workflow/run.mjs     # 12 pass · 0 fail
node --test tests/map-specialization-tokens.test.mjs   # 5/0 — таблица ролей
```

## §1 — Спец-фильтр: общие слова не матчатся сами по себе
Таблица (8 вакансий, 4 роли в настройках):
| Роль | Оставляет |
|---|---|
| Senior PHP Developer | Senior PHP Developer, Ведущий PHP-разработчик (2) |
| Go Developer | Go Engineer (1; Golang/Java не матчатся) |
| Platform Engineer | Platform Engineer (1; Data/Go Engineer не матчатся) |
| Software Engineer | Software Engineer (1; фолбэк на всю фразу) |
Reset → 8/8.

## §2 — ta: известное ограничение (ЯВНО)
ta-оценка на hermes флакует по языку (проза 2–26 % тамильского, 2/2–5 прогонов,
v1.248.6+). Скелет A)–G) держит форму; зацикливания нет. Это ЗАДАокументированное
ограничение бэкенда (CAR-70), а не регресс кода:
- в remote-qa находка `report not in ta` для ta — ОЖИДАЕМА и не считается
  регрессом, пока владелец не решит вопрос бэкенда;
- ja ✓, остальные локали ✓ (полный ×18: 16/18 чистых, флаки — см. CAR-70).

## §3 — remote-qa: shape vs language раздельно
1. A–G ✓/✗ считается ТОЛЬКО по block/SCORE_SUMMARY/looping-кодам
   (splitWarnings); `report not in <locale>` не краснит A–G.
2. Колонка warnings в таблице заполнена кодами (не «—»).
3. Заголовок таблицы: 4 колонки (locale | docs | evaluate | warnings).

## §4 — Мелочи
- Мёртвый CSS .job-map-job-select удалён; тулбар 390px = true 50/50.
- CodeQL 552 (unused OVERLAYS в design-qa тесте) закрыт.

## §5 — Регрессии (не трогать)
Поиск с персистом, peek по тапу, атрибуция, высота мобильной карты ≥540px,
Reset, embed-фетч, дедуп «## Rejected», recon, cleanup-режимы.

## §6 — Sign-off
- [ ] §0 зелёный · [ ] §1 таблица · [ ] §2 ограничение записано ·
- [ ] §3 колонка warnings · [ ] §4–§5 · [ ] прод `1.251.1` · smoke 15/15
