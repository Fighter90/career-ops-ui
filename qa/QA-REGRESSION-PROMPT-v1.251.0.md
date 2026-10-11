# QA regression — v1.251.0 (map: specialization filter from the settings)

> База: v1.250.0 → v1.251.0. Тесты: **5245** (test:ci; browser 129/0).

## §0 — Ворота
```bash
npm run test:ci                 # 5245 pass, exit 0 (offline)
npm run test:coverage:gate      # 98.17% line / 89.43% branch
npm run test:e2e && npm run test:e2e:browser && npm run test:e2e:full
node evals/workflow/run.mjs     # 12 pass · 0 fail
```

## §1 — Фильтр по специализации (из настроек)
1. `.job-map-spec-select` перечисляет специализации из
   `config/profile.yml → target_roles.primary` (+ «All specializations»).
2. Выбор специализации → на карте остаются только вакансии, чей тайтл
   несёт одно из слов роли (word-bounded, без регистра);
   чип = «N / total mapped».
3. Reset (в панели) возвращает все специализации.

## §2 — Локатор списком вакансий удалён
`.job-map-job-select` не существует; v1.250.0-локатор заменён фильтром
(правка владельца: «не список вакансий, а специализации»).

## §3 — Регрессии карты
Поиск (персист), peek по маркеру (tap на таче), атрибуция без FAB,
высота мобильной карты ≥ 540px, слои/скор/commute-фильтры.

## §4 — Sign-off
- [ ] §0 зелёный · [ ] §1–§2 · [ ] §3 без регрессий ·
- [ ] прод `1.251.0` · smoke 15/15
