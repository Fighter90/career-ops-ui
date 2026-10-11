# QA regression — v1.250.0 (map: job locator + text search)

> База: v1.249.0 → v1.250.0. Тесты: **5245** (test:ci; browser 129/0).

## §0 — Ворота
```bash
npm run test:ci                 # 5245 pass, exit 0 (offline)
npm run test:coverage:gate      # 98.18% line / 89.44% branch
npm run test:e2e && npm run test:e2e:browser && npm run test:e2e:full
node evals/workflow/run.mjs     # 12 pass · 0 fail
node scripts/remote-qa/link-check.mjs   # No broken links
```

## §1 — Локатор вакансии (тулбар над картой)
1. `.job-map-job-select` виден над картой (desktop + mobile), options =
   видимые (прошедшие фильтры) вакансии, отсортированы по company+title.
2. Выбор вакансии → flyTo к кружку (zoom ≥ SPREAD_ZOOM — кластеры
   расходятся) → peek-карточка открывается И НА ДЕСКТОПЕ (locator always
   peeks), карточка = «Компания · Тайтл».
3. Выбор сохраняется при перерисовках (syncJobSelect держит значение,
   пока вакансия видима).

## §2 — Поиск
1. `.job-map-search`: ввод «Acme» → чип «1 / 2 mapped», опции селекта
   сужаются до 2 (placeholder + Acme).
2. Персистентность: reload → input = «Acme» (как набрано, регистр
   сохраняется), чип «1 / 2».
3. Очистка → «2 / 2 mapped», селект снова 3 опции.
4. Reset (в панели) очищает поиск.

## §3 — Регрессии карты
- peek по тапу/клику маркера (тач: tap, не force-click);
- атрибуция Лифлета: 4 угла не перекрыты (docs-fab скрыт на #/map на
  всех ширинах);
- слои/скор-фильтр/commute-фильтры/Reset — v1.249.0 поведение;
- высота мобильной карты ≥ 540px (тулбар законно съедает ~90px).

## §4 — i18n
4 новых ключа (map.filter.job / jobAny / search / searchPlaceholder)
во всех 18 словарях; snapshot перегенерирован; i18n-audit зелёный.

## §5 — Sign-off
- [ ] §0 зелёный · [ ] §1–§2 · [ ] §3 без регрессий · [ ] §4 ·
- [ ] прод `1.250.0` · smoke 15/15
