# Regression suite — v1.247.0 (design sweep tail — 21 пункт + тёмная карта)

> Детальный ручной прогон хвоста свипа CAR-49…58. База: v1.246.0 → v1.247.0.
> Каждый пункт: находка → шаг → ожидание. Скриншоты «после»:
> /tmp/v12470-shots/ (историч., 115 штук).

## §0 — Автоматические ворота
```bash
node --test tests/design-qa-v1247.test.mjs   # 27 контрактов
npm run test:e2e                             # 21 pass (Flow 2b reload-фикс)
npm run test:e2e:browser
```

## §1 — [MAJOR] Тёмная карта (полная)
1. `#/map`, тёмная тема: **тайлы инвертированы** — инспектор на
   `.leaflet-tile`: `filter: invert(1) hue-rotate(180deg) brightness(.87)
   contrast(.88) saturate(.55)`; светлая тема → `filter: none`.
2. Переключить тему НА ЛЕТУ (кнопка в топбаре): слой перемонтируется без
   перезагрузки страницы; тайлы меняют вид туда-обратно.
3. Системная dark (без явной темы): инверсия применяется (трёхчастный guard).
4. Контролы (зум/слои/аттрибуция) тёмные — как в v1.246.0, вместе с тайлами
   теперь один виджет.
5. **Keyed preset**: с env `MAP_TILE_DARK_URL=https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
   (и CSP уже разрешает cartocdn) — рендерится Carto dark; атрибуция
   «© OpenStreetMap contributors © CARTO». Без env — дефолт (CSS-инверсия),
   ошибок в консоли нет.
6. CSP: `img-src` содержит и OSM-хост, и `basemaps.cartocdn.com` (проверить
   заголовок ответа или тест design-qa-v1247).
7. Ни одного нового console-error при флипах темы на карте.

## §2 — Жёлтые callout'ы: тёмные варианты
1. `#/config`: сохранить с предупреждающим жёлтым callout'ом → в dark
   callout имеет тёмную поверхность (`.callout--warn` токены), текст читаем.
2. `#/batch`: то же для batch-предупреждений.
3. Hero-banner warning на дашборде (если показан): тёмный вариант.
4. Регресс: **primary-кнопка внутри callout'а** сохраняет primary-стиль
   (регресс `.callout a` vs `.btn-primary` исправлен — `:not(.btn)`).

## §3 — Apply URL не обрезается
`#/apply`: длинный URL документации в инфо-карточке переносится по целым
словам (`overflow-wrap: anywhere`), не «…/set-up-playwrigh…».

## §4 — CV header: одна иконочная система
`#/cv`: кнопки заголовка текстовые (📁/📄/💾 отсутствуют); стиль единый с
остальными тулбарами.

## §5 — Tracker tabs: sentence case
1. `#/tracker`: «All statuses» с заглавной (не «all statuses») — en/ru/de/
   es/pt-BR/fr/pl/uk/da/it/tr.
2. CJK/ar/hi/ta: без регистра — строка непустая, локализована.
3. Локали с родовыми формами: формулировка корректна («Alle Status» в de).

## §6 — Топбар: stroke-SVG вместо эмодзи
1. index.html не содержит 🔔/🌙/🩺 (тест-контракт + визуально).
2. Bell/theme/doctor — SVG-иконки единого стиля; кнопка темы рисует
   sun/moon через CSS (приложение не переписывает textContent кнопки —
   флип темы работает без перерисовки текста).
3. Мобильный топбар: doctor-иконка в том же стиле.

## §7 — Dashboard Pipeline: без розового highlight
Карточка Pipeline quick-action: кольцо появляется ТОЛЬКО на hover/focus;
в покое — как остальные карточки.

## §8 — Saved-search Delete: деструктивный вид
`#/scan` → saved searches: кнопка Delete — `.btn-danger` (красная
аффорданс), не нейтральный ghost рядом с Save search.

## §9 — Pipeline preview: пустое состояние
`#/pipeline` без данных: title + hint + CTA (паттерн трекера), не одно
предложение в большой коробке. Ключи локализованы ×18.

## §10 — UI.pageMeta: единая мета-строка
evaluate / deep / auto / mode-page / orientation: ⏱ + cost ОДНОЙ строкой
под заголовком вью (не сирота-«⏱ ~30s» сбоку, не снизу, не рядом с
кнопкой). Локализовано ×18.

## §11 — Auto h1 без ✨
`#/auto`: заголовок без ✨, левый край совпадает с остальными 31 вьюхой;
`.page-icon` CSS удалён.

## §12 — Batch docs URL: инлайн-ссылка
`#/batch`: ссылка на документацию — инлайн в подзаголовке, стилизована,
не переносится одна на строку без стиля.

## §13 — interview-digest / orientation: пустые состояния
До первого запуска: title + hint + CTA (не пустая страница под кнопкой).
Ключи ×18.

## §14 — Career-plan export guard
Без содержимого плана: Export disabled; действия в одну строку (не две
стопки). После добавления контента — Enable.

## §15 — stats: дубликат заголовка + placeholder
1. Нет h3 «Market report» (дублирует активный таб).
2. Плейсхолдер региона виден целиком (короткий текст ×18, width 340px).

## §16 — Config: никаких абсолютных путей
1. Сохранить файл в config → сабтайтл «Saved to .env» (или `~/…`) — НИКОГДА
   `/Users/sergejemelanov/…`.
2. Проверить на сервер-рендеренном значении (displayPath — серверная правка).

## §17 — LLM_PROVIDER helper: три строки
`#/config`: helper-текст провайдер-цепочки — 3 короткие строки (`pre-line`),
не 150-символьная простыня. ×18.

## §18 — EMAIL card: одна строка
`#/profile`: адрес не рвётся («gmail.co / m» исчезло); ellipsis; перенос
только ≤480px.

## §19 — Health: «Run buttons» целиком
Текст с кнопкой-в-тексте не ломается посреди слова (overflow-wrap anywhere
вместо break-all).

## §20 — Help RTL: inline code
Локаль ar, `#/help`: `career-ops` в код-токенах не рвётся («career-» /
«.ops» исчезло); LTR-isolate + nowrap + горизонтальный скролл блока.
`docs/help/ar.md`: токен закодирован как `` `career-ops` ``.

## §21 — Hero pill: без коллизии
ru/ar: «Live evals» pill — иконка провайдера + ⚡ не наезжают на текст
(flex-wrap, non-shrink иконки).

## §22 — Регрессии
- v1.246.0 top-10: apply-dark ссылка (7.4:1), RTL-числа, CV LTR, DATE nowrap,
  HUD-резерв, мобильный перенос, FAB-клиренс, activity слаги, assessments
  лейблы — всё на месте.
- e2e Flow 2b: полный `npm run test:e2e` — 21 pass (reload после
  kill/revive сервера).
- CodeQL: в design-qa-v1246 тесте удалён неиспользуемый CSS-импорт; в
  v1247-тесте comment-strip доведён до фикспоинта (#421).

## §23 — Sign-off
- [ ] §0 зелёный · [ ] §1 карта (инверсия + флип + preset + CSP) ·
- [ ] §2–§21 все пункты · [ ] §22 регрессий нет · [ ] прод `1.247.0`
