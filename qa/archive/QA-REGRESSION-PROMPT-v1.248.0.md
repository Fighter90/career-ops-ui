# QA regression — v1.248.0 (parent parity: gupy/workable/liveness/radancy/smartrecruiters)

> Детальный прогон. База: v1.247.0 → v1.248.0 (parent 6290598 → fbdf7004).
> Пять апстрим-фиксов провайдеров/liveness перенесены; счёт источников не
> изменился (109 = 104 EN + 5 RU). Тесты: **5090 → 5130**.

## §0 — Автоматические ворота
```bash
npm run test:ci                                    # 5130 pass, exit 0
node --test tests/sources-gupy.test.mjs            # 46 (API-хост, фильтры, confidencial, cap)
node --test tests/sources-workable.test.mjs        # 25 (multi-country fold)
node --test tests/liveness-core.test.mjs tests/liveness-core-future-closure.test.mjs tests/liveness-core-soft-expiry.test.mjs
node --test tests/sources-radancy.test.mjs tests/sources-smartrecruiters.test.mjs tests/smartrecruiters-pagination.test.mjs
node evals/workflow/run.mjs                        # 14 pass · 0 fail
```

## §1 — Gupy (API переехал на portal.gupy.io)
1. Добавить/проверить запись gupy в `portals.yml` (без `api:` override) →
   скан ходит на `https://portal.gupy.io/api/job-search/jobs` (лог/девтулз).
2. Запрос содержит `workplaceType=`/`type=` (имена API), НЕ
   `workplace_types=`/`job_types=`; параметры comma-joined.
3. Сконфигурированный `gupy.country` НЕ уходит в запрос; появляется warning
   с именем записи портала.
4. Конфиденциальные работодатели: «Confidencial» / «Empresa Confidencial» /
   «CONFIDENCIAL» дропаются; «Confidencial Seguros» ОСТАЁТСЯ.
5. `max_pages: 500` в конфиге → ровно 100 запросов, последний offset 9900,
   warning без «raise max_pages» (советует сузить ключевые слова).
6. Старая запись с `api: <выбывший хост>` резолвится на нового провайдера
   и ходит на новый API_BASE (адаптерный маппинг).

## §2 — Workable (мультистрана)
1. Вакансия, опубликованная в нескольких странах (один job URL): одна
   строка с локацией «City, Country · Country2 · Country3» — ни одна
   страна не потеряна, первая не «побеждает».
2. Повторные сиблинги схлопываются; сиблинг без локации ничего не портит.
3. Порядок локаций — по первому появлению; одиночная локация ре-джойнится
   в точности в прежнюю строку (регресс).
4. location_filter: merged-ячейка проходит allow-list страны из списка
   (EU allow-list) и отклоняется блок-правилом вне списка (потребительский
   вердикт; полный tier always_allow — отдельный follow-up).

## §3 — Liveness (баннер на своей строке)
1. Постинг с Apply-кнопкой и баннером «Sign in if you want to apply» на
   своей строке → `expired / expired_body`.
2. «Get notified when this position is filled» / «before you apply» на
   своей строке → closed.
3. Баннер, РАЗБИТЫЙ на две строки, всё равно ловится.
4. Регрессы: «until…filled» между строками → active; «when…filled» под
   заголовком → active; Apply-кнопка без баннера → active.

## §4 — Radancy (sibling job-location)
1. Legacy-карточка с локацией ПОСЛЕ `</a>` (div.barclays-стиль): локация
   читается из сиблинг-элемента (`span`/`p`/`div` c `job-location`).
2. Строка без собственной локации остаётся пустой — не borrowing.
3. Современный парсер не трогает Barclays-разметку; UHG/Kaiser
   (локация внутри якоря) работают как прежде.

## §5 — SmartRecruiters (slug в fallback-ссылках)
1. Вакансия без `ref`/с некорректным/недоверенным `ref`:
   public URL = `https://jobs.smartrecruiters.com/<НАСТРОЕННЫЙ slug>/…`
   (не slugify(отображаемое имя)).
2. Доверенный `ref` сохраняет приоритет; без slug-формы пути — старое
   поведение (soft-fallback).
3. Display name остаётся лейблом строки, никогда не попадает в URL.

## §6 — No-port регрессии
- `http-json`: 49/49 (DNS-гвард, pinned encoding, keep-alive) — _http-fix
  осознанно не портирован (нет прокси-ветки).
- Все 109 источников на месте; `/api/scan/sources` не изменился;
  adapter-registry 18/18.
- Проверить AR/hi/ta changelog-записи 1.248.0 (переведены, не en-копии).

## §7 — Sign-off
- [ ] §0 зелёный · [ ] §1 gupy · [ ] §2 workable · [ ] §3 liveness ·
- [ ] §4 radancy · [ ] §5 smartrecruiters · [ ] §6 no-port регрессий нет ·
- [ ] прод `1.248.0`
