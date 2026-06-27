# Справка — career-ops-ui

Полный разбор каждой страницы — от запуска приложения до приглашения
на интервью. Каждый `##` заголовок ниже соответствует пункту бокового
меню или фазе рабочего процесса. При первом запуске читайте сверху
вниз; позже переходите к нужному разделу через оглавление в боковой
панели справки.

> **Аудитория:** все, кто только что положил этот UI внутрь
> `career-ops` checkout и запустил `bash bin/start.sh`. Предварительное
> знакомство с career-ops не требуется.

### О career-ops

[career-ops](https://career-ops.org) — open-source-система поиска
работы, которая запускается как slash-команды внутри любого AI-CLI
для разработки (Claude Code, Gemini CLI, Codex, Qwen Code, OpenCode, GitHub Copilot CLI — другие Claude-совместимые CLI работают через тот же интерфейс slash-команд). Модель-агностична. Оценивает каждую вакансию против
вашего CV по шестимерной рубрике 0.0–5.0, генерирует подогнанные
PDF-резюме и отслеживает каждую заявку локально на вашей машине.

**Канонические источники (читайте по порядку при первой установке):**

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
  — система, принципы, инвентарь концептов.
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
  — поиск вакансий; наполнение Pipeline.
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
  — полный флоу подачи с Playwright form-read.
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  — оценка 10+ JD за раз через `batch-runner.sh`.
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)
  — установка Chromium и регистрация MCP для PDF и заполнения форм.

**Определяющие принципы** (из
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

- **Open source всерьёз** — лицензия MIT, без платных тарифов, без
  вейтлистов, без телеметрии, без аккаунтов. Система работает без
  платных уровней, аккаунтов и сбора телеметрии. Изменения в коде
  проходят ревью сообщества до релиза.
- **Суверенитет данных** — `cv.md`, `config/profile.yml`, `data/`,
  `reports/`, `interview-prep/` никогда не покидают ваш ноутбук, пока
  вы сами их явно не запушите. Вы запускаете систему локально и
  сохраняете полный контроль над данными.
- **AI-agnostic-архитектура** — career-ops НЕ поставляется с
  конкретной моделью. Это набор команд внутри уже установленных
  AI-CLI для разработки. Переключайте провайдеров
  (Anthropic ↔ Gemini ↔ OpenAI) — история ваших оценок остаётся
  согласованной.
- **Подаёт человек** — career-ops составляет ответы и открывает
  форму, но **Submit нажимаете вы**. Система никогда не подаёт
  автоматически. Она даёт структуру и оценку; финальное право
  отправки остаётся за человеком.
- **Структурированный поиск** — рассчитан на активный, осознанный
  поиск с большим числом откликов. Не инструмент одной заявки и не
  рекомендательная система. Установка занимает около 15 минут и
  предполагает уверенное владение терминалом.

**Чем career-ops НЕ является** (явные не-цели):

- Не авто-аппликатор. Формы за вас он не отправит.
- Не пересборщик резюме. Подгоняет под конкретный JD; опыт не
  выдумывает.
- Не оптимизатор LinkedIn. Профиль — ваша зона ответственности.
- Не замена таблицам с SaaS-обёрткой. Данные лежат как обычный
  markdown в вашей файловой системе.

**Ключевые концепты** (полный инвентарь — каждый артефакт, к которому
career-ops прикасается):

| Концепт | Что это |
|---|---|
| **Mode** | Шаблон промпта в `modes/<slug>.md`. Встроенные: `oferta`, `deep`, `apply`, `pipeline`, `batch`, `contacto`, `followup`, `interview-prep`, `patterns`, `project`, `training`, `ofertas`, `auto-pipeline`, `pdf`, `latex`, `scan`, `tracker`. |
| **Архетип** | Профиль целевой роли в `config/profile.yml`. Рубрика взвешивает совпадения навыков относительно активного архетипа — **самое важное поле**. |
| **Pipeline** | `data/pipeline.md` — инбокс JD-URL, ожидающих оценки. |
| **Tracker** | `data/applications.md` — историческая GFM-таблица всех оценок и статусов заявок. |
| **Report** | `reports/<NNN>-<company>-<DATE>.md` — полная оценка JD по секциям A–F со score и legitimacy в заголовке. |
| **Scan history** | `data/scan-history.tsv` — append-only-журнал; предотвращает дубликаты между сканами. |
| **Proof points** | STAR+R-блоки доказательств, извлечённые из `cv.md`; переиспользуются в оценке, ответах на форму и подготовке к интервью. |
| **JD store** | `jds/jd-<date>-<ts>.txt` — описания вакансий, сохранённые при оценке для аудита. |
| **Interview-prep** | `interview-prep/<company>-<role>.md` — глубокие исследования и one-pager под раунд. |
| **Batch additions** | `batch/tracker-additions/*.tsv` — строки, поставленные в очередь скриптом `batch-runner.sh` для слияния в трекер. |

### career-ops vs career-ops-ui (это приложение)

| | career-ops (CLI) | career-ops-ui (это приложение) |
|---|---|---|
| Где работает | внутри Claude Code / Gemini CLI / Codex / Qwen Code / OpenCode / GitHub Copilot CLI | `http://127.0.0.1:4317` в браузере |
| Поверхность | slash-команды `/career-ops <mode>` | сайдбар, по одной странице на этап |
| Заполнение форм | да, через Playwright MCP | нет — выдаёт чек-лист, остальное доделывается в CLI |
| PDF | `generate-pdf.mjs` | `📄 Generate PDF` на `#/cv`, `#/reports/:slug`, `#/evaluate`, `#/deep`, `#/interview-prep` |
| Файлы данных | общие с career-ops-ui | общие с career-ops |

career-ops-ui — **чистая надстройка**. Ничто внутри `career-ops/` не
меняется. Обе поверхности используют один и тот же `cv.md`,
`config/profile.yml`, `portals.yml`, `data/`, `reports/`,
`interview-prep/`, `modes/`.

### Пороги действий по score

Как только у JD появилась оценка, score определяет следующий шаг
(каноническая таблица из
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

| Score | Следующий шаг |
|---|---|
| **≥ 4.5** | Запустите `/career-ops apply` — высокий fit, подавайтесь сразу. |
| **4.0 – 4.4** | Подавайтесь или `/career-ops contacto` для тёплого интро. |
| **3.5 – 3.9** | Запустите `/career-ops deep` — изучите компанию и роль перед решением. |
| **< 3.5** | Пропустите, если нет конкретной личной причины. |

Страницы `#/dashboard` и `#/tracker` в career-ops-ui подсвечивают
каждую строку со score ≥ 4.0, чтобы вы могли выбрать действие, не
перезапуская ничего вручную.

### Внешняя документация

Полная справка по движку career-ops (сканирование, рубрика оценки,
batch-обработка, флоу подачи, установка Playwright) лежит на
[career-ops.org/docs](https://career-ops.org/docs):

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)

---

## 1. Быстрый старт — пошаговое руководство от «создать CV» до «отклик отправлен, контакту написано»

Это канонический playbook кнопка за кнопкой. Пройдите его по порядку
при первом запуске. Каждый шаг называет точный маршрут, точную кнопку
и то, что вы увидите при успешном выполнении. Разделы 2–16 ниже —
детальное погружение в каждую фазу.

> **Запуск и инициализация одной командой.** Из терминала можно
> выполнить весь bootstrap, не открывая интерфейс:
>
> ```bash
> career-ops-ui setup      # установка зависимостей → doctor → запуск сервера
> career-ops-ui init       # выбрать LLM-провайдера + вставить его ключ (вывод скрыт)
> career-ops-ui doctor     # перепроверить в любой момент (код выхода 0 ⇔ все обязательное зелёное)
> career-ops-ui run        # просто запустить сервер на http://127.0.0.1:4317
> career-ops-ui open       # открыть + ПОДНЯТЬ вкладку дашборда в браузере
> ```
>
> После `setup`/`run` вкладка браузера открывается **и поднимается
> на передний план** автоматически (v1.43.0); `career-ops-ui open`
> делает то же по требованию, так что не придётся искать вкладку
> дашборда. `NO_OPEN=1` отключает авто-открытие для headless/CI-запусков.
>
> `setup` сам прогоняет всю цепочку целиком. `init` записывает ключ в
> родительский `career-ops/.env` через тот же проверенный путь, что
> использует вкладка API-ключей `#/config`, и задаёт `LLM_PROVIDER`
> (`auto` | `claude` | `gemini`), который учитывают живые маршруты
> evaluate / deep / mode / авто-конвейера. Форма для CI:
> `career-ops-ui init --provider claude --anthropic-key sk-ant-… --yes`.
> Предпочитаете интерфейс? Продолжайте с шагов ниже.

### A. Установка (один раз, ~5 минут)

**career-ops-ui должен располагаться по пути `career-ops/web-ui/`** (вложенно внутри родительского проекта career-ops). Он читает ваши `cv.md`, `config/` и `data/` из родительской папки через `../` и не работает автономно. Если после `git pull` команда `career-ops-ui init` не найдена, выполните `cd career-ops/web-ui && npm install && npx career-ops-ui init`.

**Шаг 1 — Откройте приложение на `http://127.0.0.1:4317`.** Если
сервер не запущен, выполните в терминале `bash bin/start.sh` из корня
репозитория. Загрузится Dashboard (`#/dashboard`).

**Шаг 2 — Кликните `❤ Health` в левом меню.** Каждая required-проверка
должна быть зелёной:

- `cv.md`, `config/profile.yml`, `portals.yml` существуют
- API-ключ задан (хотя бы один из `ANTHROPIC_API_KEY` /
  `GEMINI_API_KEY`)
- Playwright установлен (нужен только для Generate PDF)

Если что-то горит красным, страница точно покажет, какой файл или
переменную окружения нужно поправить. Не идите дальше, пока Health
не станет зелёным.

**Шаг 3 — Кликните `⚒ App settings` в меню.** Откроется вкладка
**API keys & runtime**.

- Вставьте `ANTHROPIC_API_KEY` (предпочтительный — лучше структурный
  длинный вывод для оценок) и/или `GEMINI_API_KEY`. Получите ключи
  на <https://console.anthropic.com/settings/keys> или
  <https://aistudio.google.com/apikey>.
- Нажмите **💾 Save**. Затем нажмите **▶ Test Anthropic** (или
  Gemini) — крошечный round-trip подтвердит, что ключ работает.

**Шаг 4 — Переключитесь на вкладку `Profile` на той же странице.**
Это прямой YAML-редактор для `config/profile.yml`. Как минимум
отредактируйте:

- `candidate.full_name` — замените placeholder («Jane Smith») на
  своё настоящее имя
- `candidate.email`, `linkedin`, `github` — используются в
  cover-letters
- `target.roles` — должности, на которые вы откликаетесь
- `target.comp_total_min_usd` — минимальная total comp; офферы ниже
  этой суммы помечаются красным в секции D каждой оценки
- `target.archetypes` — карьерные паттерны, которые вы принимаете
  (самое влияющее поле)

Нажмите **💾 Save**. Сервер валидирует YAML и проставляет канонический
заголовок `# Career-Ops Profile Configuration`.

### B. CV (один раз, ~10 минут)

**Шаг 5 — Кликните `✎ CV` в меню.** Две колонки: редактор слева,
живой preview справа.

**Шаг 6 — Выберите способ заполнить редактор:**

- **Загрузить готовое резюме** — нажмите **📁 Upload CV**, выберите
  любой из `.docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md`.
  Сервер конвертирует файл в markdown через pandoc или pdftotext,
  выполняет санитайзинг от XSS и кладёт результат в редактор.
  **Проверьте конверсию** — у PDF особенно может потеряться вёрстка.
- **Вставить markdown напрямую** — textarea это markdown-редактор;
  правая панель показывает то, что увидит LLM (и будущий рекрутер).
- **Советы по тону:** один буллет — одно достижение с метрикой.
  Уложитесь в 1500 слов. Порядок секций: Summary, Experience,
  Projects, Education, Skills.

**Шаг 7 — Нажмите `💾 Save` (верхний правый угол страницы CV).**
Сервер выполняет санитайзинг (`<script>` / `javascript:` /
inline-обработчики удаляются) и записывает `cv.md`. Тост: *«Saved»*.

**Шаг 8 (опционально) — Нажмите `📄 Generate PDF`.** Запустит
`generate-pdf.mjs` в родительском проекте (требуется Playwright), и
**новый PDF автоматически скачается** в браузер по завершении.
Список внизу страницы хранит все ранее сгенерированные файлы.

### C. Найти вакансии (~2 минуты на скан)

**Шаг 9 — Кликните `🌐 Scan` в меню.** Убедитесь, что `portals.yml`
перечисляет нужные вам доски (раздел 5 этой справки). Нажмите кнопку
**🌐 Scan now**. В правую панель идёт живой SSE-лог, пока сканер
обходит Greenhouse / Ashby / Lever / Workable / SmartRecruiters /
Workday (английские доски) и hh.ru / Habr Career / Trudvsem / GetMatch / GeekJob (российские доски,
если включены).

**Шаг 10 — Когда скан завершится, просмотрите результаты.** Кликните
любой тег компании, чтобы отфильтровать; кликните иконку ↗, чтобы
открыть страницу карьеры компании в новой вкладке. Каждая вакансия,
прошедшая title-фильтр, поставлена в Pipeline.

### D. Оценить офферы (~30 секунд на JD)

**Шаг 11 — Кликните `Pipeline` в меню.** Видите все URL, которые
поставил сканер. Кликните запись, чтобы развернуть inline-preview JD.

**Шаг 12 — Нажмите `▶ Evaluate` рядом с любым JD.** Перейдёте на
`#/evaluate`. С заданным API-ключом запускается live; без ключа
получаете готовый prompt для копирования в свой LLM. Live-режим
выдаёт **оценку 0–5** против вашего CV по секциям A–F. Сохранение
идёт в `reports/<date>-<slug>.md`.

**Шаг 13 — Кликните `Reports` в меню** и просмотрите свежую оценку.
Всё ниже вашего `comp_total_min_usd` помечается красным в секции D.
Всё с пометкой `Verdict: pursue` — ваш short-list.

### E. Решить и глубоко исследовать выбранную компанию (~3 минуты)

**Шаг 14 — Выберите вакансию, на которую стоит подаваться. Кликните
`Deep research` в меню.** Введите название компании и роль. Модель
выдаст бриф из семи секций (миссия, недавние новости, tech-stack,
hiring-сигналы, бенчмарки компенсации, риски, рекомендуемый угол
подхода). Сохранение идёт в `interview-prep/<company>-<role>.md`.

### F. Отклик (~5 минут на заявку)

**Шаг 15 — Кликните `Apply checklist` в меню.** Вставьте URL
вакансии и JD. Хелпер сгенерирует пошаговый чек-лист подачи:

- Cover-letter draft (используется ваш `cv.md` + `profile.yml`)
- Конкретные ключевые слова из JD
- Файлы для прикрепления (CV PDF — см. шаг 8)
- Куда подавать (канонический careers-URL, не агрегатор-редиректы)
- Напоминание: **НИКОГДА не submit'ьте автоматически** — финальный
  review и отправка всегда вручную.

**Шаг 16 — Откройте careers-страницу в новой вкладке.** Используйте
apply-checklist как todo-список. Подавайтесь через настоящую форму
компании. Прикрепите PDF, сгенерированный на шаге 8.

**Шаг 17 — Напишите живому человеку.** Откройте режим **Outreach**
(`#/contacto` в меню). Модель составит короткое сообщение для
LinkedIn / email, заточенное под бриф из шага 14. Персонализируйте
opener (одна конкретная деталь из вашего deep-research-брифа).
Отправьте.

### G. Трекинг и follow-up (постоянно)

**Шаг 18 — Кликните `Tracker` в меню** и добавьте строку заявки:
компания, роль, score, статус `Applied`, ссылка на отчёт, ссылка на
deep-research-бриф. Дата проставится автоматически.

**Шаг 19 — Через неделю откройте режим `Follow-up`**
(`#/followup`). Сгенерирует вежливое check-in-письмо со ссылкой на
исходную заявку. Отправьте. Обновите статус в Tracker на
`Followed up`.

**Шаг 20 — Когда придёт приглашение на интервью, запустите режим
`Interview prep`** (`#/interview-prep`). Сгенерирует таргетированную
подготовку под конкретную компанию и стадию (system design /
behavioral / coding). Автоматически тянет данные из deep-research-брифа.

**Шаг 21 — Получили оффер? Обновите статус в Tracker на `Offer`** и
вернитесь к секции компенсации в отчёте — минимальная сумма приёма
уже там.

### TL;DR — порядок сайдбара повторяет workflow

`Health → App settings → Profile → CV → Scan → Pipeline → Evaluate
→ Reports → Deep research → Apply checklist → Outreach → Tracker
→ Follow-up → Interview prep → Activity log`

Всё. 21 шаг, кнопка за кнопкой, от нуля до оффера.

### Auto-pipeline в один клик (`#/auto`) — короткий путь вместо 21 шага

Чтобы быстро оценить одну конкретную вакансию, пропустите ручной проход. **Сайдбар → ✨ Auto-pipeline** (или кнопка ✨ на Dashboard): вставьте URL, нажмите **Enter** или **▶ Запустить весь пайплайн** — сервер прогоняет всю цепочку за один наблюдаемый проход:

1. **Валидация URL** — SSRF-безопасная проверка (`isValidJobUrl`).
2. **Загрузка описания** — `safeGet` (DNS-pinned) скачивает + санитизирует JD.
3. **Оценка по CV** — Anthropic → Gemini → ручной промпт без ключа.
4. **Сохранение отчёта** — пишет `reports/<slug>.md` (score + достоверность).
5. **Добавление в трекер** — строка в `data/applications.md`.

Обратная связь — вертикальный **stepper** (упорядоченный список, `aria-current` на активном шаге, live-region для скринридеров). По завершении карточка ведёт к отчёту (**Открыть отчёт · N/5**) и в **трекер**. Упавший шаг помечается, кнопка снова активна — повтор без перезагрузки. **Нет API-ключа?** Ручной режим: шаги 3–5 сворачиваются, выдаётся промпт для копирования. Линкуется: `#/auto?url=<enc>&go=1` автозапуск.
> **CLI (v1.38.0).** Одна команда — вся цепочка: `career-ops-ui setup`. Verbs: `career-ops-ui doctor` (проверка env/ключей/тулинга — тот же движок, что Health; exit 1 при любом обязательном провале), `career-ops-ui run`, `career-ops-ui init` (мастер провайдер+ключ, v1.39.0).
> **Провайдеры (v1.39.0).** Во вкладке API-keys добавлены select `LLM_PROVIDER` (`auto`=Anthropic→Gemini · `claude` · `gemini`) и поле `OPENAI_API_KEY` (сторона Codex/OpenCode CLI). `career-ops-ui init` — интерактивный мастер того же.
>
> **Провайдеры (v1.57.0).** Headless live-eval теперь охватывает **Anthropic → Gemini → OpenAI → Qwen → OpenRouter** (порядок `auto`; `LLM_PROVIDER` фиксирует один). **OpenRouter** — один `OPENROUTER_API_KEY` открывает 300+ моделей; выпадающий список `OPENROUTER_MODEL` грузит живой каталог OpenRouter (серверный прокси, кураторский offline-fallback). Также исправлено: ключи, вставленные с переносом строки / пробелами, тримятся до валидации — `/#/config` больше не показывает «validation failed» ни для одного провайдера.



---

## 2. Настройки приложения и API-ключи (`#/config`)

> **Новое в v1.55 → v1.56.** Без ключа LLM красный баннер на каждом экране объясняет, что ⚡ Запуск вживую в режиме ручного промпта, и ведёт сюда; с ключом — тихий чип с активным провайдером. Перед каждой кнопкой ⚡ Запуск вживую (`#/auto`, `#/evaluate`, `#/deep`, режимы) показывается честная оценка стоимости (напр. «Оценочная стоимость: OpenAI gpt-5-codex · ~$0.04/eval», либо без затрат API в ручном режиме). `#/scan` прячет вторичные фильтры за раскрывашкой **Расширенные фильтры**; `#/tracker` добавляет кликабельные чипы воронки + опциональную серверную пагинацию; `#/pipeline` виртуализирует свыше 1000 строк.

Две вкладки:

1. **API keys & runtime** — редактирование `.env` родительского
   проекта прямо из браузера (тот же файл, который Node-скрипты
   career-ops читают на старте). Вкладка также предлагает селекторы
   модели по провайдеру — `OPENAI_MODEL` (OpenAI/Codex) рядом с
   `ANTHROPIC_MODEL` и `GEMINI_MODEL`.
2. **Profile** — прямой YAML-редактор для `config/profile.yml`.
   Сохранение проставляет канонический заголовок
   `# Career-Ops Profile Configuration`.

Сохранение в любой вкладке применяется немедленно — перезапуск
сервера не нужен.

**Настройка LLM-провайдера (пошагово).** ⚡ live-оценка веб-UI работает *headless* и использует один API-ключ. Работает через "OR" — задайте **любой один** из них, и всё заработает; при нескольких заданных `auto` предпочитает их в таком порядке: Anthropic → Gemini → OpenAI → Qwen. (сам career-ops CLI-агностичен — вы также запускаете его внутри Claude Code, Codex, Gemini, OpenCode, Qwen, Copilot или Kimi; это отдельно от этого headless-ключа.)

1. Откройте `#/config` → вкладку **API keys & runtime**.
2. Выберите провайдера в **`LLM_PROVIDER`**: `auto` (использует тот ключ, что задан) или принудительно один из `claude` / `gemini` / `openai` / `qwen`.
3. Заполните ключ + модель выбранного провайдера:
   - **Anthropic** — задайте `ANTHROPIC_API_KEY` (console.anthropic.com), опционально `ANTHROPIC_MODEL` (по умолчанию `claude-sonnet-4-6`).
   - **Gemini** — задайте `GEMINI_API_KEY` (aistudio.google.com/apikey), опционально `GEMINI_MODEL` (по умолчанию `gemini-2.0-flash`).
   - **OpenAI** — задайте `OPENAI_API_KEY` (platform.openai.com), опционально `OPENAI_MODEL` (по умолчанию `gpt-5-codex`).
   - **Qwen** — задайте `QWEN_API_KEY` (Alibaba Model Studio / DashScope, dashscope.console.aliyun.com), опционально `QWEN_MODEL` (по умолчанию `qwen-max`). Для endpoint материкового Китая задайте `QWEN_BASE_URL` в сыром `.env`.
4. Нажмите **Save**. Ключи пишутся в `.env` родительского проекта; изменение вступает в силу немедленно — перезапуск сервера не нужен.
5. Проверьте на `#/evaluate`: вставьте URL/описание вакансии и нажмите **⚡ Run live**. Заголовок результата показывает, какой провайдер сработал (`anthropic` / `gemini` / `openai` / `qwen`). Если ключ нигде не задан → вы получите ручной промпт для копирования-вставки.

Секреты маскируются после сохранения и никогда не логируются. Поля id модели (`*_MODEL`) не являются секретами.

### Вкладка Profile

> **v1.32.0 — форма по полям.** Вкладка Profile больше не textarea с сырым YAML, а форма со сворачиваемыми секциями **Кандидат / Нарратив / Компенсация**. При сохранении отправляются только 14 смоделированных скалярных путей; сервер **мёржит** в `config/profile.yml`, поэтому `archetypes`, `proof_points` и кастомные ключи **сохраняются нетронутыми**. Компромисс: сохранение по полям пересериализует YAML и **теряет `#`-комментарии** — для их сохранения или правки вложенных массивов используйте раскрывашку **Advanced: edit raw YAML** внизу вкладки.
> **v1.35.0 — редакторы массивов.** Add/remove-редакторы для **Target roles** и **Superpowers** (списки строк), **Archetypes** (name/level/fit) и **Proof points** (name/url/hero-metric). Та же гарантия merge-not-replace; очистка списка удаляет ключ начисто.
> **v1.54.3 — вкладка Modes как структурированная форма.** `modes/_profile.md` больше не посекционный редактор сырого markdown, а форма полей, выведенная из документированной схемы. Списочные секции — **Target Roles / Adaptive Framing / Comp Targets** — это повторяемые построчные поля (добавить/удалить строки); прозаические секции — **Exit Narrative / Location Policy** — это подписанные textarea; любая неизвестная или несписочная секция откатывается к подписанному дословному textarea. Сохранение **по-прежнему мёржит по секциям** — преамбула, нетронутые и кастомные секции сохраняются байт-в-байт. Раскрывашка *Advanced: raw markdown* остаётся для правки всего файла — добавления/удаления секций или редактирования преамбулы.




- Textarea показывает текущий `config/profile.yml` дословно.
- Отредактируйте и нажмите **💾 Save**. Сервер валидирует YAML
  (должен быть mapping, должен содержать `candidate`) и записывает
  файл.
- Заголовок `# Career-Ops Profile Configuration` добавляется
  автоматически, если его нет.
- Read-only-сводка на `#/profile` — визуальный компаньон.

### Распознаваемые ключи

| Ключ | Что делает | Где получить |
|---|---|---|
| `ANTHROPIC_API_KEY` | Включает live-вызовы Anthropic SDK. Предпочтителен при наличии обоих ключей — лучше структурный длинный вывод для скоринга JD и deep research. | <https://console.anthropic.com/settings/keys> |
| `ANTHROPIC_MODEL` | Переопределяет дефолтный `claude-sonnet-4-6`. Попробуйте `claude-opus-4-7` для сложных рассуждений, `claude-haiku-4-5-20251001` для дёшево-и-быстро. | — |
| `GEMINI_API_KEY` | Fallback при отсутствии Anthropic-ключа. Используется `gemini-eval.mjs` для режима `oferta`. Free tier работает для малого объёма. | <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | Переопределяет дефолтную Gemini-модель. | — |
| `(server uses default UA)` | Требуется для сканов `hh.ru` из-за пределов России (API возвращает 403 на обычные User-Agent). Зарегистрируйте приложение на <https://dev.hh.ru/admin> и используйте его UA-строку. | dev.hh.ru |
| `PORT` | Порт, на котором слушает Express. По умолчанию 4317. | — |
| `HOST` | Bind-адрес. По умолчанию `127.0.0.1`. Значение `0.0.0.0` открывает UI в локальной сети — **аутентификации пока нет**, см. Production-readiness doc. | — |

### Поведение

- **Чтение** (`GET /api/config`) возвращает все распознаваемые ключи.
  Секретные (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) **маскируются** —
  вы видите `sk-ant•••••••a1b2`, но никогда полное значение.
- **Сохранение** (`POST /api/config`) валидирует каждое значение,
  пишет в `<parent>/.env` и сразу применяет к запущенному процессу.
  Перезапуск не нужен.
- **Пустое значение удаляет** ключ. Полезно, если вы временно
  отключаете провайдера.

### Smoke-test-кнопки

После сохранения нажмите **▶ Test Anthropic** или **▶ Test Gemini** —
обе отправляют крошечный prompt (≤256 output-токенов), так что вы
почти ничего не тратите, но убеждаетесь, что ключ подключён
корректно. На успехе возвращается ~200-символьный sample.

---

## 3. Профиль (`#/profile` — также доступно как `#/settings`)

Read-only-карточка с обзором `config/profile.yml`. **Чтобы
редактировать**, перейдите в **App settings → вкладка Profile**
(`#/config` → Profile). Сохранение пишет в тот же файл; эта страница
перепарсивает его при перезагрузке.

Самые важные поля:

- `candidate.full_name` — используется в каждом prompt. **Замените
  шаблонное `Jane Smith`** перед тем, как сканировать что-либо
  всерьёз, иначе сгенерированные cover-letters уйдут под
  placeholder-именем.
- `candidate.email`, `linkedin`, `github` — упоминаются в генерации
  cover-letters и в apply-checklist.
- `target.roles` — приемлемые job titles. Positive-фильтр сканера
  неявно опирается на этот список (через `portals.yml::title_filter`).
- `target.comp_total_min_usd` — минимальная total comp. Секция D
  каждой оценки помечает офферы ниже этой суммы.
- `target.archetypes` — *самое важное поле*. Карьерные паттерны,
  которые вы принимаете (например, `Tech-Lead-Backend`,
  `Founding-Engineer`, `Data-Platform`). Каждый JD матчится против
  них, и лучший архетип попадает в заголовок отчёта.

Страница Health выводит проверку **Profile customized**, которая
проваливается, пока `full_name` совпадает с известным placeholder'ом.

---

## 4. CV (`#/cv`)

Единый источник истины для каждой оценки, deep research и cover
letter. Хранится в `cv.md` в корне родительского проекта.

### Способы редактирования

- **Вставить напрямую** — textarea слева это markdown-редактор.
  Правая панель отражает то, что увидит LLM (и будущий рекрутер).
- **📁 Upload CV** — выберите локальный файл в любом из этих
  форматов, сервер сам сконвертирует его в markdown:
  - **Текстовые форматы** — `.md`, `.markdown`, `.txt`, `.html`,
    `.htm` передаются без изменений (HTML идёт через pandoc → GFM
    markdown).
  - **Office-форматы** — `.docx`, `.doc`, `.odt`, `.rtf`
    конвертируются через **pandoc** (`brew install pandoc` на
    macOS, `apt install pandoc` на Linux).
  - **PDF** — `.pdf` извлекается через **pdftotext** из Poppler
    (`brew install poppler` / `apt install poppler-utils`).
  - Сконвертированный markdown попадает в редактор; нажмите
    **💾 Save**, чтобы сохранить. Результат проходит санитайзинг
    (тот же XSS-страйп, что и при вставке).
  - Жёсткий лимит: **10 MB** на загрузку. Файлы крупнее → 413.
- **Из LinkedIn** — самый простой путь: откройте Claude Code в
  родительском проекте, запустите `/career-ops`, вставьте URL
  своего LinkedIn-профиля и попросите
  `extract my CV from this and write it to cv.md`.

### Что подвергается санитайзингу

На серверной стороне каждый PUT на `/api/cv` проходит через
`stripDangerousMarkdown`:

- Теги `<script>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`,
  `<style>`, `<form>` — удаляются целиком.
- Inline-обработчики событий (`onclick=`, `onerror=` и так далее) —
  вырезаются.
- URI-схемы `javascript:`, `vbscript:`, `data:text/html` —
  нейтрализуются.

Ответ содержит `sanitized: true`, если что-то из перечисленного было
удалено, — так вы узнаёте, что в исходнике было что-то опасное.

Максимальный размер body: 1 MB. Больше — 413.

### Прочие кнопки

- **sync-check** — запускает `cv-sync-check.mjs` в родительском
  проекте. Помечает несоответствия: проект указан в CV, но
  отсутствует в `data/applications.md` для соответствующего
  архетипа, и тому подобное.
- **📄 Generate PDF** — стримит `generate-pdf.mjs`. Файлы появляются
  в `output/*.pdf`. Требуется Playwright (страница Health показывает,
  установлен ли он в `node_modules` родителя). По окончании генерации
  **самый свежий** PDF автоматически скачивается в дефолтную папку
  Downloads; список на странице сохраняет все ранее сгенерированные
  файлы.

### Советы по тону и формату

- Один буллет — одно достижение с метрикой.
  *«Reduced p99 latency by 38%»* лучше *«improved performance»* для
  каждой рубрики оценки.
- Порядок секций: **Summary** (3–5 строк), **Experience** (в обратном
  хронологическом порядке), **Projects** (максимум 5), **Education**,
  **Skills** (без дубликатов, без багажа buzzword'ов).
- Уложитесь в 1500 слов. Scoring-рубрика рассчитана на плотную
  информацию; раскидистое CV получает штраф за шум.

---

## 5. Порталы и источники (`portals.yml`)

Конфигурация сканера лежит в `portals.yml` в корне родителя.
Три раздела имеют значение. Три SPA-секции ниже совпадают 1:1 с
канонической схемой career-ops.org из
[scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals).

> **Шорткат:** URL `#/portals` теперь резолвится прямо в **App
> settings** и (если настроен региональный источник) прыгает к
> группе **Regional sources** — так что сохранённая в закладках или
> набранная вручную ссылка `#/portals` больше не даёт 404 (v1.42.0).

### `title_filter`

```yaml
title_filter:
  positive: [backend, engineer, senior, tech lead, golang, php]
  negative: [junior, intern, frontend, ios, android, java]
  seniority_boost: [Senior, Staff, Lead, Principal]
```

Найденная вакансия проходит, если её title содержит **хотя бы одно
positive**-слово И **ни одного из negative**-слов. Настраивайте оба
списка. Сравнение — подстрочное, регистр не учитывается.

`seniority_boost` — третий ключ title-фильтра. Слова из этого списка
ничего не отфильтровывают — они поднимают совпавшие вакансии выше в
результатах, чтобы «Senior Backend Engineer» оказывался над просто
«Engineer». По умолчанию: `["Senior", "Staff", "Lead"]`. Подстройте
под то, как формулируются ваши целевые роли.

Начните с 3–5 положительных слов для ясности; расширяйте позже.

### `location_filter` (опционально — web-ui 1.33.0, parent #570)

```yaml
location_filter:
  allow:
    - "Remote"
    - "United States"
    - "Atlanta"
  block:
    - "India"
    - "London"
    - "Germany"
```

Фильтрует отсканированные вакансии по строке **локации** (подстрока, регистронезависимо), применяется и в ATS-проходе, и в регионарном. Семантика идентична каноническому `scan.mjs` career-ops:

- Нет `location_filter` → все локации проходят (по умолчанию).
- Пустая/отсутствующая локация → проходит (отсутствие данных не штрафуется).
- Совпадение в `block` → **отклонена** (block приоритетнее allow).
- `allow` пуст → проходит (block уже отфильтровал).
- `allow` непуст → должна совпасть **хотя бы с одним** ключевым словом.

Ключ верхнего уровня в `portals.yml` (сосед `title_filter`, не вложен в `russian_portals`).

**`content_filter` (опционально — web-ui 1.75.0, parent #974).** Опциональный sibling верхнего уровня для `location_filter` с теми же списками ключевых слов `positive` / `negative`, но сопоставляемыми с текстом **описания / сниппета** вакансии, а не с её локацией:

```yaml
content_filter:
  positive: ["python", "machine learning"]
  negative: ["security clearance", "on-site only"]
```

Семантика идентична `location_filter`: нет ключа → проходит всё; вакансия с **пустым/отсутствующим** описанием проходит (отсутствие данных не штрафуется); совпадение в `negative` → отклонена; `positive` пуст → проходит; `positive` непуст → должна совпасть хотя бы с одним ключевым словом (подстрока, регистронезависимо). Применяется и в ATS-проходе, и в регионарном. Затрагиваются только источники, которые отдают описание/сниппет (например, RSS) — любая другая вакансия проходит — поэтому включение фильтра никогда не отбрасывает молча строки из источников, не несущих тело. Используйте его, чтобы отбросить прошедшую по заголовку вакансию, чьё тело вскрывает deal-breaker.

### `search_queries`

```yaml
search_queries:
  - name: "Greenhouse — Rails Engineer"
    query: 'site:job-boards.greenhouse.io "Rails Engineer" OR "Ruby on Rails" remote'
    enabled: true
  - name: "Ashby — Senior Backend"
    query: 'site:jobs.ashbyhq.com "Senior Backend" remote'
    enabled: false
```

`search_queries` запускают AI-powered Option B-скан
(`/career-ops scan` внутри Claude Code / Codex). Они НЕ выполняются
in-process `npm run scan` (который ходит только по публичным API
бордов). Используйте их, когда хотите находить роли в компаниях,
которых ещё нет в `tracked_companies`. Установите `enabled: false`,
чтобы сохранить запись, не запуская её.

### `tracked_companies`

```yaml
tracked_companies:
  - { name: Stripe,     enabled: true, careers_url: https://job-boards.greenhouse.io/stripe }
  - { name: Linear,     enabled: true, careers_url: https://jobs.ashbyhq.com/linear }
  - { name: JetBrains,  enabled: true, careers_url: https://jobs.lever.co/jetbrains }
```

Обязательные поля каждой записи: `name` и `careers_url`. Опциональные:
`api` (явный эндпоинт Greenhouse / Ashby / Lever / Workable /
SmartRecruiters / Workday), `enabled: true|false` для
включения/исключения без удаления записи. ATS-сканер определяет ATS
по паттерну URL (`job-boards.greenhouse.io/<slug>` → Greenhouse и так
далее) и обращается к публичному boards-API каждой компании напрямую.
Компании без распознаваемого ATS пропускаются (карточка **Active
Companies** на `/#/scan` показывает их серыми с `○`).

### `rss` (RSS / Atom boards)

```yaml
tracked_companies:
  - { name: LaraJobs, enabled: true, provider: rss, rss: https://larajobs.com/feed }
  - { name: WeWorkRemotely, enabled: true, provider: rss, rss: https://weworkremotely.com/remote-jobs.rss }
```

Нацельте сканер на любой джоб-борд с RSS/Atom-фидом (LaraJobs, WeWorkRemotely, RemoteOK, golangprojects, …), добавив запись с `provider: rss` и ключом `rss:` (или `feed_url:`) — **без правок кода**. RSS-адаптер парсит каждый `<item>` (CDATA + HTML-сущности, заголовки/компании очищаются от тегов), нормализует в вакансию и прогоняет тот же `title_filter` / `location_filter` + дедуп + добавление в pipeline, что и ATS-источники. После этого **RSS** появляется как выбираемый источник в выпадающем фильтре на `#/scan`. (web-ui v1.62.x)


### `russian_portals`

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]      # или только один
  area: 113                 # 1=Москва, 2=СПб, 113=Россия, 1001=удалёнка
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Тимлид PHP"
```

`queries` — подстрочные совпадения без учёта регистра против
заголовков вакансий на hh.ru и Habr Career. **Аккуратнее с
пересечениями с negative-списком** — если `"Senior PHP"` стоит в
`queries`, а `"php"` оказался в `title_filter.negative`, скан вернёт
ноль результатов и консоль предупредит о конфликте.


### Настройка русских порталов — подробное руководство

v1.29.0 поставляется с 5 русскоязычными адаптерами. Два не требуют ничего сверх дефолтного UA (`habr-career` — HTML-скрейп; `trudvsem` — государственный open-data API, без ключа и без гео-гейта). Два — HTML-скрейпы технических площадок (`getmatch`, `geekjob` — тоже без ключа). Один — каноничный hh.ru API, который может вернуть 403 с не-российских IP, если не выставить переменную `HH_USER_AGENT` через **App settings → API keys & runtime** (или не запускать сервер с российского IP / VPN-выхода).

#### Список источников

| Ключ | Метка | Тип | Auth | Гео-ограничение |
|---|---|---|---|---|
| `hh` | hh.ru | JSON API | опц. `HH_USER_AGENT` | не-RU IP могут 403 |
| `habr` | Habr Career | HTML | нет | нет |
| `trudvsem` | Trudvsem | JSON API (open-data) | нет | нет |
| `getmatch` | GetMatch | HTML | нет | нет |
| `geekjob` | GeekJob | HTML | нет | нет |

#### Шаг 1 — Открой `portals.yml`

Файл лежит в корне родительского проекта `career-ops/` (НЕ внутри `web-ui/`). Если его ещё нет, скопируй пример из родительского проекта:

```bash
# from the parent career-ops/ root (NOT web-ui/)
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

#### Шаг 2 — Включи все 5 источников

Добавь или обнови блок `russian_portals`, перечислив все источники, которые хочешь сканировать. Порядок в массиве не важен — сканер обходит их в порядке registry.

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]
  area: 113                  # 1=Moscow, 2=SPb, 113=Russia, 1001=remote
  per_page: 50               # how many vacancies per query per source
  only_remote: false         # set true to keep only remote postings
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Backend Senior"
    - "Тимлид PHP"
```

#### Шаг 3 — Настрой queries и фильтры

`queries` — это строки, по которым сканер ищет в каждом источнике. Каждый запрос исполняется по разу на источник — 4 query × 5 источников = 20 вызовов за скан. Держи список сфокусированным (3–7 запросов), чтобы скан укладывался в минуту. `area` — региональный код hh.ru (остальные источники его игнорируют). `per_page` — лимит вакансий на запрос на источник. `only_remote: true` фильтрует только remote на уровне адаптера (в таблице результатов также есть отдельный Remote-чип).

#### Типичные ошибки

**Коллизия с negative-list'ом.** Если слово из query (`"php"`, `"senior"`) также присутствует в `title_filter.negative`, все результаты вылетают на фильтре ещё до показа. Сканер на этапе скана пишет в stderr предупреждение — ищи строку `⚠ config: query "Senior PHP" contains "php" which is in the negative list`. Решение — убрать конфликтующее слово из `negative`:

```yaml
title_filter:
  positive: [backend, senior, lead, php, go, golang, python]
  negative: [junior, intern, frontend, ios, android]
russian_portals:
  queries:
    - "Senior PHP"     # OK — "php" no longer in negative list
    - "Senior Go"
```

#### Временно выключить один источник

Чтобы отключить источник без удаления данных, просто убери его ключ из `sources`:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem"]   # only 3 of 5 sources will run
```

#### Проверка конфигурации

После сохранения `portals.yml`:

```bash
# 1. Save portals.yml.
# 2. In the SPA, switch to #/scan.
# 3. Click 🌐 Scan now.
# 4. Watch the SSE log for the per-source line per query:
#       "Senior PHP"
#         hh.ru    18
#         habr     21
#         trudvsem  3
#         getmatch  0
#         geekjob   2
#    A value of 0 is normal for some queries — it just means that
#    source had no matches. A "geo-blocked" or "timeout" line means
#    the adapter reached the site but couldn't read results.
```

### CLI-bootstrap ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

Канонический setup career-ops (запустите из корня родителя один раз):

```bash
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

Это весь bootstrap. Отредактируйте три раздела (`title_filter`,
`tracked_companies`, `search_queries`, опционально `russian_portals`),
сохраните — и можно сканировать.

### Bootstrap-поведение SPA

При первом запуске сервер дописывает в `portals.yml` блок
`russian_portals:` с комментариями, если его нет, — идемпотентно
(второй старт ничего не делает, так как литерал `russian_portals:`
уже на месте). Английские секции НЕ дописываются автоматически — они
приходят из `templates/portals.example.yml`, который вы скопировали по
каноническому bootstrap выше.

---

## 6. Состояние (`#/health`)

Все шлюзы настройки в виде бейджей OK / OPTIONAL / FAIL. Прочитайте
эту страницу до того, как заводить любой «не работает» issue.

### Required-проверки (без них система не запустится)

- `Node version` ≥ 18 — сервер использует нативный `fetch` и
  `node:test`.
- `Project root` — `CAREER_OPS_ROOT` (переменная окружения или
  авто-детект) существует.
- `cv.md`, `config/profile.yml`, `portals.yml`,
  `data/applications.md`, `data/pipeline.md`, `modes/oferta.md`.

### Optional-проверки (только предупреждения)

- `Profile customized` — `candidate.full_name` не совпадает с
  шаблонным placeholder.
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` — заданы в `.env`.
- `(server uses default UA)` — имеет значение, только если вы
  сканируете hh.ru из-за пределов России.
- `Playwright (parent node_modules)` — требуется для генерации PDF
  и `check-liveness.mjs`. Установите через
  `cd $CAREER_OPS_ROOT && npm install && npx playwright install chromium`.
- `Parent project dependencies` — `cd $CAREER_OPS_ROOT && npm install`,
  если зависимости не установлены.
- Каталоги `data/`, `reports/`, `output/`, `jds/` — создаются
  автоматически при первой записи.

Когда сервер открыт за пределами loopback (`HOST=0.0.0.0`), абсолютные
пути и точная версия Node заменяются в ответе на `"hidden"`, чтобы
любопытный сосед в сети не мог снять fingerprint вашей установки.

### Run-кнопки

- **▶ Doctor** запускает `node doctor.mjs` и показывает вывод в
  модальном окне.
- **▶ Verify pipeline** запускает `node verify-pipeline.mjs`.

---

## 7. Поиск (`#/scan`)

Сканер обходит каждую включённую доску, дедуплицирует против вашей
истории и пишет хиты в `data/last-scan.json` и `data/pipeline.md`.

### One-click-скан (SPA)

**🌐 Scan** запускает каждый включённый источник одним проходом:

- Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday
  (ATS-проход) для каждой компании в `tracked_companies` с
  распознаваемым ATS-URL.
- Агрегаторы v1.75.0 для каждой записи `tracked_companies`, которая
  их включает: RemoteOK / Remotive / Working Nomads (ленты удалёнки
  на уровне доски, `provider: <slug>`) и IBM / Arbeitsagentur /
  Glints / Jobstreet · SEEK (config-driven, блок `<provider>:` на
  каждую запись).
- hh.ru API + Habr Career + Trudvsem + GetMatch + GeekJob для каждого query из `russian_portals`.

**Две фазы — один клик (v1.29.2).** Единственная кнопка 🌐 Scan запускает И ATS-проход, И регионарный — в одном SSE-стриме. В логе появятся два заголовка фаз, по очереди:

1. `▶ ATS scan (Greenhouse + Ashby + Lever)` — EN ATS-доски.
2. `▶ Regional scan (hh.ru + Habr Career)` — 5 RU-источников из registry.

Каждая фаза заканчивается итогом `✓ done · NEW=N`. Если видишь только ATS-фазу — твой стенд на сборке до v1.29.2; обнови. До v1.29.2 SSE-клиент закрывался на первом `done`, и регионарная фаза тихо терялась (`tests/scan-stream-multi-phase.test.mjs` — регрессионный гейт).

Живой SSE-лог стримится в правую панель, пока скан идёт. Нажмите
**Stop** (или просто уйдите со страницы), чтобы прервать — сервер
отменит in-flight HTTPS-запросы через `AbortController`.

### Фильтры результатов

Под логом таблица результатов рендерит строки из `data/last-scan.json`.

Фильтры:

- **Free text** — подстрочное совпадение по title / company.
- **Source** dropdown — Arbeitsagentur / Ashby / BambooHR / Breezy HR / Comeet / GeekJob / Glints / Greenhouse / GetMatch / Habr Career / hh.ru / IBM / Jobstreet · SEEK / Lever / Personio / Recruitee / RemoteOK / Remotive / RSS / SmartRecruiters / SolidJobs / Trudvsem / Workable / Workday / Working Nomads (автозаполняется из `GET /api/scan/sources`).
- **Remote / Hybrid / Onsite** dropdown.
- **Country** dropdown (v1.78.0) — гео-фильтр, заполняемый из стран, обнаруженных в текущих результатах, каждая показана со своим эмодзи флага и счётчиком (напр. `🇩🇪 Germany (12)`). Выберите одну, чтобы оставить только вакансии, привязанные к этой стране. Детектирование сопоставляет свободный текст локации вакансии (названия стран/алиасы + ~100 крупных городов рынка труда) со страной; оно консервативно и никогда не угадывает, поэтому вакансия, чью локацию не удалось определить — или чисто «Remote»-объявление — остаётся в **All countries**. Сочетайте его с выпадающим списком типа работы, чтобы находить вакансии, привязанные к стране, *и* удалённые.
- **Stack chips** (PHP / Go / Backend / Senior / …) —
  авто-определяются по строке через `Skills.detectTech` и
  `Skills.detectLevel`. Multi-select работает как пересечение:
  выбор `PHP + Senior` покажет строки, где есть ОБА признака.
- **Dynamic chips** под статичными stack-чипами — топ-25 самых
  частых capitalized-токенов из заголовков, чтобы UI адаптировался
  под роли, которые вы реально сканируете (маркетинг, дизайн,
  финансы…), а не был жёстко привязан к backend-engineer-словарю.

### Карточка Active Companies

Сворачиваемая карточка со списком каждой компании из `portals.yml` и
её статусом скана:

- ✓ зелёный тег — прямая поддержка API (Greenhouse / Ashby / Lever /
  Workable / SmartRecruiters / Workday).
- ○ серый тег — fallback на web-search-prompt (нет совпадения API).

**Клик по имени компании** → подставляет имя в фильтр результатов
выше. **Клик по иконке ↗** → открывает `careers_url` компании в
новой вкладке.

### CLI-флоу скана ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

Два способа сканировать из CLI (оба кладут URL в тот же
`data/pipeline.md`, который читает SPA):

**Option A — прямой скрипт (~30 с, ноль AI-токенов):**

```bash
npm run scan                          # все доски Greenhouse/Ashby/Lever
npm run scan -- --dry-run             # предпросмотр без сохранения
npm run scan -- --company Anthropic   # одна tracked-компания
```

Работает только для Greenhouse / Ashby / Lever / Workable /
SmartRecruiters / Workday (распознаваемые ATS-URL). AI-токены не
расходуются — скрипт стучится в публичные boards-API напрямую.

**Option B — AI-powered browser-скан:**

```
/career-ops scan
```

Внутри Claude Code / Codex / Cursor / Gemini CLI. Использует токены
модели. Заходит на каждую страницу `tracked_companies` напрямую и
умеет находить доски без API (career-страницы, кастомные ATS,
региональные порталы). Медленнее, но шире. Полезно, когда
ATS-проход ничего не находит для цели, про которую вы точно знаете,
что она нанимает.

**Output (оба пути)** — новые JD-URL добавляются в `data/pipeline.md`,
каждый посещённый URL логируется в `data/scan-history.tsv` (дедуп на
все будущие сканы), печатается сводка: companies scanned · jobs
found · filtered by title · duplicates skipped · new offers added.

**Пороги действий по score** (применяйте после
`/career-ops pipeline`, который batch-оценивает новые URL):

| Score | Рекомендуемый следующий шаг |
|---|---|
| **≥ 4.5** | `/career-ops apply` — высокий fit, подавайтесь сразу |
| **4.0 – 4.4** | подача или `/career-ops contacto` для тёплого интро |
| **3.5 – 3.9** | `/career-ops deep` — сначала изучите компанию |
| **< 3.5** | пропустите, если нет конкретной личной причины |

Страницы `#/dashboard` и `#/tracker` в SPA подсвечивают каждую строку
со score ≥ 4.0, чтобы вы могли выбрать действие, ничего не
перезапуская.

### Follow-up-команды

После оценки канонические продолжения такие:

- `/career-ops apply` — заполнить заявку с подогнанными ответами
- `/career-ops contacto` — составить LinkedIn / email-аутрич
- `/career-ops deep` — глубоко исследовать компанию / роль
- `/career-ops tracker` — посмотреть статус pipeline

---
### hh.ru — парсится с сайта (без настройки и прокси)

hh.ru сканируется через его публичный сайт поиска (`hh.ru/search/vacancy`) — так же, как Habr Career: **работает с любого IP, без ключа, прокси и настройки.** JSON-API (`api.hh.ru`) намеренно *не* используется: он теперь отдаёт `403 forbidden` любому программному клиенту независимо от IP и User-Agent (это анти-бот на периметре, а не задокументированная ошибка API), тогда как сайт отдаёт полные результаты любому браузероподобному клиенту. Поэтому hh.ru работает ровно как Habr и Trudvsem — просто оставьте его в `russian_portals.sources` и запускайте скан.

## 8. Воронка (`#/pipeline`)

Инбокс URL, ожидающих оценки. Хранится в `data/pipeline.md`.

### Добавление URL

Три способа:

- Введите или вставьте URL и нажмите **+ Add**.
- Нажмите **Ctrl+K** (или **Cmd+K**), чтобы сфокусировать глобальный
  поиск, вставьте любую ссылку `http(s)://…`, нажмите **Enter** —
  URL немедленно уходит в pipeline.
- Запустите Scan (см. выше) — свежие хиты идут в pipeline
  автоматически.

Каждый URL проходит на сервере через `isValidJobUrl()`. Loopback
(`localhost`, `127.0.0.1`), `file://`, `javascript:`, IP-литералы и
строки с template-символами (`<`, `>`, `"`) — все возвращают 400.

### Server-side preview pane

Клик по строке pipeline загружает превью справа. Большинство ATS-досок
не отдают CORS-заголовки, так что браузер не может получить их
напрямую; сервер проксирует запрос, вырезает `<script>` / `<style>` и
HTML-теги и возвращает до 8 KB plain text.

Preview-прокси проходит по редиректам вручную **с пер-хоповой
SSRF-валидацией** — каждый заголовок `Location` снова прогоняется
через `isValidJobUrl()`, поэтому враждебная доска не сможет отбросить
вас на loopback / приватный IP / `file://`. Лимит: 3 хопа, таймаут
15 секунд.

### Действия в строке

- **▶** — переход на `#/evaluate?url=…` с предзаполненным URL.
- **✕** — удаляет URL из `data/pipeline.md`.

### Кнопки в правом верхнем углу

- **⚡ Evaluate first** — открывает первый URL очереди на странице
  Evaluate, готовый к оценке.
- **Scan** — вернуться к сканеру за новыми URL.

---

## 9. Оценить (`#/evaluate`)

Оценивает одно JD против `cv.md` и `config/profile.yml`. Возвращает
структурированную оценку A–F по `modes/oferta.md` и score 0–5.

### Input

Вставьте JD в textarea или придите сюда из `#/pipeline` с
`?url=<href>` — страница получит URL через тот же SSRF-safe-прокси,
который используется для превью pipeline, и предзаполнит textarea.

Нажмите **💾 Save JD**, чтобы сохранить JD в
`jds/jd-<date>-<ts>.txt` для аудита (или передайте `save: true` в
API-вызове — эффект тот же).

### Цепочка fallback

1. **Anthropic** — предпочтительный путь при заданном
   `ANTHROPIC_API_KEY`. Сервер бандлит `cv.md`, `config/profile.yml`,
   `modes/_shared.md` и `modes/oferta.md` в блок `<project_context>`
   перед промптом (каждый файл обрезается на 16 KB, общий prompt
   soft-cap 200 KB). Возвращает grounded markdown прямо на страницу.
2. **Gemini** — при заданном только `GEMINI_API_KEY`. Сервер спавнит
   `gemini-eval.mjs` с JD как временным файлом. Free-tier-модель
   (`gemini-2.0-flash`) нормально справляется с рутинным скорингом.
3. **Manual** — ключ не задан. Страница возвращает готовый prompt,
   который можно вставить в Claude Code, ChatGPT или любой другой
   LLM.

### Output-секции (канонический A–F с career-ops.org)

> **Выравнивание v1.15.0.** Буквы блоков теперь совпадают с
> [канонической схемой career-ops.org](https://career-ops.org/docs).
> До v1.15 отчёты использовали A–G (с `C=Risks`, `F=Verdict`,
> `G=Legitimacy`); мы по-прежнему рендерим их как есть для обратной
> совместимости, но новые отчёты эмитят A–F с канонической
> семантикой ниже. Score и Legitimacy теперь живут в заголовке
> отчёта (`score: 4.2/5`, `legitimacy: High|Medium|Low`).

A. **Role Summary** — 3 буллета (риски вынесены инлайном).
B. **CV Match** — топ-3 совпавших навыка и топ-3 недостающих.
C. **Strategy** — рекомендация: apply now / contacto first /
deep first / skip. До v1.15 называлось `Risks`.
D. **Compensation** — относительно вашего
`target.comp_total_min_usd` (legacy) или
`compensation.target_range` (canonical).
E. **Personalization** — угол подачи, framing по архетипу, хуки
для cover letter / outreach. До v1.15 называлось
`Application Strategy`.
F. **STAR stories** — 1–3 готовых STAR-блока под роль. До v1.15
называлось `Verdict` (raw score); score теперь появляется в
заголовке отчёта рядом с `legitimacy`.

### Сохранение отчёта

Нажмите **💾 Save report** (или используйте флаг save в API-вызове),
чтобы сохранить markdown в `reports/<date>-<company>-<role>.md`.
Распарсенный заголовок отчёта (Score / Legitimacy / URL) появится на
странице **Reports** и на Dashboard.

### Batch-оценка при 10+ JD

Для одного JD эта страница `#/evaluate` — правильный инструмент. Для
10+ URL, стоящих в pipeline, поштучный клик-через непрактичен —
переходите к подразделу **Batch evaluate** в §14 (запуск
`./batch/batch-runner.sh` из родителя), дайте ему отработать ночью и
возвращайтесь на `#/reports` / `#/tracker` за результатами. Полный
флоу:
[batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers).

---

## 10. Отчёты (`#/reports`)

Просмотр всех сохранённых оценок. Карточки показывают title, дату,
флаг legitimacy и score (цветовая раскраска: зелёный ≥ 4.0, жёлтый
≥ 3.0, красный ниже).

Клик по карточке открывает полный markdown. Пагинация: 12 на
страницу; элементы управления внизу.

В режиме одного отчёта также есть:

- **← All reports** — назад к сетке.
- **🔗 Open JD** — открывает оригинальную вакансию в новой вкладке.

---

## 11. Трекер (`#/tracker`)

CRM. Одна строка — одна заявка; хранится в `data/applications.md`
как GFM-таблица.

### Поток статусов

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` /
`Rejected` / `Discarded` / `SKIP`.

Whitelist статусов проверяется на сервере; любое другое значение в
`POST /api/tracker` сбрасывается на `Evaluated`. Канонический переход
`Evaluated → Applied` происходит автоматически, когда вы
подтверждаете `Submitted.` в конце `/career-ops apply` (см. §14).

### Структура колонок

| Колонка | Что это |
|---|---|
| `#` | Авто-нумерация с padding нулями (`001`, `002`, …). |
| `Date` | ISO-дата (`YYYY-MM-DD`). По умолчанию — сегодня. |
| `Company` | Свободный текст. **Пайпы (`\|`) и переводы строки экранируются автоматически.** |
| `Role` | То же. |
| `Score` | Формат `N/5` (например, `4.2/5`). |
| `Status` | Whitelist enum. |
| `PDF` | ✅, если `generate-pdf.mjs` уже отработал для этой строки. |
| `Report` | Markdown-ссылка на соответствующий `reports/*.md`. |
| `Notes` | Свободный текст, до 200 символов. |

### Фильтры

- **Status** dropdown.
- **Score** dropdown — `≥ 4.0` (high), `≥ 3.0` (mid), `< 3.0` (low).
- **Search** — подстрочное совпадение по company + role.

Любой фильтр сбрасывает пагинатор на страницу 1. По 25 строк на
страницу.

### Кнопки обслуживания

- **▶ Normalize** запускает `normalize-statuses.mjs` —
  каноникализирует написание статусов (`applied` → `Applied`,
  `interview` → `Interview`).
- **▶ Dedup** запускает `dedup-tracker.mjs` — удаляет дубликаты по
  `(company, role)` без учёта регистра.
- **▶ Merge** запускает `merge-tracker.mjs` — подтягивает ожидающие
  записи из `batch/tracker-additions/*.tsv` (куда batch-флоу родителя
  кладёт заявки, отправленные через Apply-хелпер). Дедуплицирует и
  архивирует обработанные файлы в `batch/tracker-additions/merged/`.
  Восходящий batch-флоу описан в
  [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers).

### Добавление строк

`POST /api/tracker` — body `{ company, role, score?, status?, url?,
reportSlug?, notes?, date? }`. Дедуп по `(company, role)` без учёта
регистра. Из UI: страница Evaluate предлагает кнопку «Add to tracker»
после успешного скоринга.

---

## 12. Глубокий рисёрч (`#/deep`)

Генерирует структурированный бриф компании: snapshot, инженерная
культура, недавние новости, Glassdoor sentiment, процесс интервью,
точки давления при переговорах, три умных вопроса для рекрутера.

### Input

Два поля — название компании и (опционально) роль. Структуру задаёт
шаблон режима (`modes/deep.md`).

### Output-пути

Та же fallback-цепочка, что и у Evaluate:

1. **Anthropic live** (предпочтительно) — `bundleProjectContext`
   инлайнит cv + profile + `_shared.md` + `deep.md`. Output: 10–30 KB
   grounded markdown, сохраняемого в
   `interview-prep/<company>-<role>.md`.
2. **Gemini live** — вызов `gemini-eval.mjs`. То же место
   сохранения.
3. **Manual prompt** — страница выдаёт готовый prompt для Claude
   Code (у которого есть WebFetch + WebSearch, и он может сделать
   настоящий ресёрч).

### Подсказки

- Anthropic на `claude-sonnet-4-6` обычно возвращает ~13 KB полезного
  текста за 1–3 минуты на вызов.
- У Anthropic SDK нет встроенного web search. Для ролей, где нужны
  свежие новости + Glassdoor sentiment, вставьте manual prompt в
  Claude Code и дайте ему воспользоваться инструментом WebFetch.
- Live-вызовы платные; один deep-research-вызов Sonnet 4.6 стоит
  примерно $0.30–0.50.

---

## 13. Подсказки режимов (семь страниц `/#/<mode>`)

Семь prompt builders: **Project**-идеи, **Training**-планы,
**Follow-up**-письма, **Batch**-оценки, **Outreach** к рекрутерам,
one-pager **Interview prep** и **Patterns**-ретроспективы. Каждая
оборачивает конкретный шаблон `modes/<slug>.md`:

| Страница | Slug | Назначение |
|---|---|---|
| `#/project` | `project` | Подогнать портфолио-проект под целевую роль. |
| `#/training` | `training` | Анализ skill-gap → план обучения. |
| `#/followup` | `followup` | Драфт письма после интервью. |
| `#/batch` | `batch` | Prompt для batch-оценки нескольких JD. |
| `#/contacto` | `contacto` | Outreach-сообщение для рекрутера / referral. |
| `#/interview-prep` | `interview-prep` | One-pager под конкретный раунд интервью. |
| `#/patterns` | `patterns` | «Какие паттерны делали меня успешным?» — рефлексия. |

### Общая форма

У каждой страницы небольшая форма (поля специфичны для режима),
кнопка **▶ Generate prompt** (manual) и — при наличии Anthropic-
или Gemini-ключа — кнопка **⚡ Run live**, которая повышается до
основной.

Клик по **▶ Generate prompt** возвращает собранный prompt, в котором
ваши значения формы JSON-stringify'нуты в блок
`User-supplied context:`, а далее идёт дословный шаблон
`modes/<slug>.md`. Копируйте и вставляйте в свой любимый LLM.

Клик по **⚡ Run live** отправляет тот же prompt в Anthropic (или
Gemini), с `cv.md` + `profile.yml` + `_shared.md`, инлайн через
`bundleProjectContext`. Результат рендерится на странице, копируется
и скачивается как `.md`.

Семь страниц — это явный allowlist. Режимы с отдельным маршрутом
(`oferta` → Evaluate, `deep` → Deep research) и режимы, которые
родительский проект поддерживает только внутри Claude Code (`apply`,
`scan`, `pipeline`, `tracker`, `pdf`, `latex`, `ofertas`,
`auto-pipeline`), сознательно не выведены в этот UI.

---

## 14. Чек-лист отклика (`#/apply`)

Когда вы решили подаваться, эта страница Apply helper генерирует
чек-лист подачи для самого шага отправки. Она **НЕ** заполняет формы
автоматически — этот флоу остаётся в `/career-ops apply` внутри
Claude Code, который использует Playwright в родительском проекте.

### Режим чек-листа в SPA (`#/apply`)

Чек-лист SPA рассчитан на пользователей, которые предпочитают
заполнять форму вручную, без вызова Playwright. Он покрывает:

0. Запустить `/career-ops apply <url>` в Claude Code, чтобы прочитать
   форму через Playwright (пропустите этот шаг, если заполняете
   вручную).
1. Проверить, что вакансия ещё активна (`check-liveness.mjs`).
2. Убедиться, что CV актуально (`cv-sync-check.mjs`, затем PDF, если
   score ≥ 4.0).
3. Адаптировать cover letter / ответ на «Why us?» с использованием
   STAR+R proof points из `cv.md`.
4. Честно ответить на вопросы EEO / sponsorship / start-date.
5. Сохранить заполненные ответы в
   `interview-prep/{company}-{role}.md` до отправки.
6. **НИКОГДА не submit'ьте автоматически** — финальную кнопку
   нажимаете вы (человек).
7. После submit: добавить строку в `data/applications.md` (или
   записать TSV в `batch/tracker-additions/`).

### Ручное заполнение vs Playwright-assisted

Два пути до фактической отправки:

- **Вручную** — открыть careers-страницу в обычной вкладке браузера,
  пройти по SPA-чек-листу выше, копировать-вставлять ответы.
  Playwright не нужен. Подходит, когда форма короткая или у вас не
  установлен Chromium.
- **С помощью Playwright** — запустить `/career-ops apply <company>`
  в Claude Code (в родительском проекте). Playwright открывает
  собственный браузер, читает каждое поле формы и возвращает
  пронумерованные черновики ответов. Submit вы по-прежнему нажимаете
  сами. Подходит, когда форма длинная, динамическая или вам нужен
  аудит-трейл «какой вопрос — какой ответ».

### Полный CLI-флоу apply ([apply-for-a-job](https://career-ops.org/docs/introduction/guides/apply-for-a-job))

**Предусловия:**

1. Сначала запустите `/career-ops pipeline`, чтобы у JD появился
   evaluation-отчёт в `reports/`. Команда apply зависит от
   существующей оценки; если её нет, сначала прогоните pipeline.
2. Отчёт и профиль должны быть загружены.
3. **Рекомендуется:** установлен Playwright
   (`npx playwright install chromium` — см. раздел Playwright Setup
   ниже). При отсутствии происходит fallback на WebFetch (только
   текстовое превью формы, без click-fill).

**Пронумерованный флоу** (канонические 8 шагов):

1. **Запустите команду** с названием компании:

   ```
   /career-ops apply <company>
   ```

   Пример: `/career-ops apply Anthropic`. Без аргумента на следующем
   шаге передайте скриншот формы, вставленный текст формы или URL
   заявки.

2. **Локализация отчёта.** Система находит соответствующую оценку в
   `reports/` (ту, что создал `/career-ops pipeline` или
   `#/evaluate` ранее).

3. **Открытие формы.** Playwright **автоматически** запускает окно
   браузера — открывать его руками НЕ нужно.

4. **Чтение полей.** Система читает и парсит каждое поле формы
   (label, type, required, options для select-ов).

5. **Генерация ответов.** career-ops формирует подогнанные ответы
   для каждого поля на основе вашего профиля, proof points и роли.

6. **Возврат нумерованного списка.** Вы получаете ответы в порядке
   полей формы — простые поля (имя, email) первыми, свободный текст
   (cover letter, «Why us?») последним. Помеченные пункты указывают,
   что требует внимания человека: salary anchor, недостающие детали
   резюме, опциональные вопросы.

7. **Ручное заполнение.** Вы копируете и вставляете каждый ответ в
   соответствующее поле. Этот шаг ручной, не автоматизированный. Вы
   сначала проверяете каждый ответ.

8. **Пользователь нажимает Submit.** Submit нажимаете вы сами.
   career-ops **никогда** не нажимает Submit. Подтвердите завершение,
   напечатав в чате:

   ```
   Submitted.
   ```

**Автоматические обновления на `Submitted.`:**

- Статус меняется `Evaluated → Applied` в `data/applications.md`.
- Заполненные ответы остаются в секции G отчёта для будущих ссылок.

**Handoff в трекер:**

```
/career-ops tracker
```

Следите за статусом всего пайплайна, независимо от score роли.

### Batch evaluate ([batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers))

Когда у вас 10+ JD для оценки за раз (по-штучный `#/evaluate` в SPA
непрактичен для такого объёма), используйте batch-раннер из CLI.

**Файл ввода — `batch/batch-input.tsv`** (tab-separated):

| Колонка | Назначение |
|---|---|
| `id` | Уникальный последовательный номер |
| `url` | Полная ссылка на вакансию |
| `source` | Платформа-источник (LinkedIn, Greenhouse и так далее) |
| `notes` | Опциональная контекстная заметка |

Пример строки:

```
1<TAB>https://jobs.example.com/senior<TAB>LinkedIn<TAB>
```

**Флаги `./batch/batch-runner.sh`:**

- `--dry-run` — предпросмотр ожидающих офферов без оценки. Всегда
  запускайте это первым, чтобы провалидировать TSV.
- `--parallel N` — запускает N воркеров одновременно (рекомендуются
  значения 1, 2 или 3).
- `--min-score X.X` — пропускает сохранение офферов со score ниже
  порога. Полезно, когда хочется хранить отчёты только по
  high-fit-ролям.
- `--retry-failed` — повторно обрабатывает только офферы, упавшие
  в предыдущем запуске (сетевые сбои, лимит запросов).
- `--max-retries N` — пытается обработать упавшие офферы до N раз
  (по умолчанию: 2).
- `--model NAME` — модель Claude для `claude -p --model` (career-ops 1.8.0, #504). Не задано = модель по умолчанию подписки Claude Max. Для больших батчей бери дешевле, напр. `claude-sonnet-4-6`. В `#/batch` — поле **Модель** (web-ui 1.31.0).
- `--start-from N` — пропустить ID офферов меньше N (продолжить частично обработанный батч). В `#/batch` — поле **Старт с #** (web-ui 1.31.0).

**Стандартная последовательность:**

1. **Отредактируйте** `batch/batch-input.tsv` — одна строка на JD.

2. **Dry-run** (рекомендуется первым):

   ```bash
   ./batch/batch-runner.sh --dry-run
   ```

3. **Запуск** — последовательно или параллельно:

   ```bash
   ./batch/batch-runner.sh                       # по одному
   ./batch/batch-runner.sh --parallel 2          # два параллельно
   ./batch/batch-runner.sh --parallel 3          # три параллельно
   ./batch/batch-runner.sh --parallel 2 --min-score 4.0  # хранить только high-fit
   ```

4. **Повтор упавших** (сеть / rate-limit):

   ```bash
   ./batch/batch-runner.sh --retry-failed --max-retries 3
   ```

5. **Отчёты** появляются в `reports/` как
   `{id}-{company}-{YYYY-MM-DD}.md`. Сводные строки добавляются в
   `batch/tracker-additions/`.

6. **Merge в трекер:**

   ```bash
   node merge-tracker.mjs                 # применить batch additions
   node merge-tracker.mjs --dry-run       # предпросмотр merge
   ```

   Команда merge дедуплицирует записи и архивирует обработанные
   файлы в `batch/tracker-additions/merged/`.

SPA отображает получившиеся отчёты в `#/reports` (пагинация,
цветовая раскраска score-pill) и tracker-строки в `#/tracker` —
ровно так же, как если бы вы добавили каждую через `#/evaluate`.
Совмещайте с кнопкой обслуживания **▶ Merge** на `#/tracker`, если
не хочется уходить в CLI.

### Установка Playwright ([set-up-playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright))

Требуется для двух фич career-ops:

- **Form-fill** в `/career-ops apply` (шаг 3 выше — Playwright
  открывает браузер, читает label'ы полей, предлагает ответы).
- **Генерация PDF** через `/career-ops pdf` и кнопку **📄 Generate
  PDF** в SPA на `#/cv` / `#/reports/:slug` / `#/evaluate` /
  `#/deep` / `#/interview-prep`.

**Fallback при отсутствии Playwright:** apply-флоу падает на WebFetch
(только текстовое превью формы, без click-fill). Генерация PDF просто
завершается ошибкой.

**Core setup (запустите из корня career-ops-родителя):**

```bash
# Установить Chromium для Playwright
npm install
npx playwright install chromium

# Зарегистрировать Playwright MCP, чтобы Claude Code мог управлять формами
claude mcp add playwright npx @playwright/mcp@latest

# Проверить все три компонента (Chromium, библиотека Playwright, MCP)
npm run doctor
```

**Альтернативная регистрация MCP** — добавьте в
`.claude/settings.local.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

**Особенности поведения:**

- **Headless по умолчанию.** Playwright работает в фоне. Чтобы
  увидеть браузер, скажите Claude: `open up with playwright the
  browser and fill out the entire form.`
- **Три роли в одном пакете** — npm-установка Playwright даёт вам
  библиотеку браузерной автоматизации, движок рендеринга PDF для
  `/career-ops pdf` и (через MCP) workflow form-fill внутри Claude
  Code.
- **Проверьте до того, как полагаться на него** — `npm run doctor`
  подтверждает, что все три компонента работают. Страница Health в
  SPA выводит проверку `Playwright (parent node_modules)`, которая
  быстро падает, если Playwright отсутствует.

---

## 15. Подготовка к интервью

Это пост-research, пре-interview фаза. Три артефакта этого приложения
сходятся здесь:

1. **Сохранённые deep-research-файлы** в `interview-prep/`, по одному
   на пару «компания-роль», которую вы исследовали. Просматривайте
   со страницы **Deep research** или напрямую через
   `/api/interview-prep`.
2. **Режим Patterns** (`#/patterns`) — генерирует self-reflective
   prompt: «По моим последним N интервью / офферам / отказам — какие
   паттерны держатся?» Полезно, когда у вас уже накопилось 5+ строк
   в трекере.
3. **Режим Interview-prep** (`#/interview-prep`) — предзаполняет
   one-pager под конкретный предстоящий раунд (behavioral, technical,
   system design). Output идёт в ту же папку `interview-prep/`.

### Рекомендуемый workflow

Для каждого интервью, которое у вас в календаре:

1. **Перезапустите Deep** (или откройте сохранённый файл) накануне.
2. **`#/interview-prep`** — сгенерируйте one-pager под конкретный
   раунд. Вставьте в свои заметки.
3. **Раунды system design / coding** — откройте `#/training` и
   попросите 30-минутный таргетированный refresher по той подсистеме,
   на которой делается акцент в JD.
4. **Раунды по компенсации** — откройте deep-research-файл и
   перейдите к секции «Negotiation leverage points». Принесите 2–3
   конкретных data points (Glassdoor band, недавнее финансирование,
   сравнимый оффер от другой компании).
5. **Behavioral-раунды** — вытащите STAR+R-истории из вашего `cv.md`,
   которые попадают в секцию B исходного отчёта Evaluate.

Сразу после интервью:

1. Обновите строку в трекере: status → `Responded` (затем
   `Interview`, `Offer` и так далее).
2. Запустите `#/followup`, чтобы составить thank-you-письмо.
3. Если вы узнали новую информацию (диапазон компенсации, состав
   команды, неожиданная деталь tech-stack), отредактируйте
   сохранённый `interview-prep/<company>-<role>.md`, добавив
   секцию `## Post-round notes`, — будущий вы скажет спасибо.

---

## 16. Activity log и Troubleshooting

### Activity log (`#/activity`)

Аудит-трейл каждого state-changing-запроса, который попадает на
сервер. Записывает: добавления в pipeline, записи в tracker, save'ы
CV, save'ы JD, запуски evaluate, запуски deep-research, запуски
скана, изменения конфигурации, запуски mode'ов.

Секреты (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) редактируются на
входе; реальное значение ключа никогда не попадёт в
`data/activity.jsonl`.

Фильтр по префиксу действия (`pipeline.`, `cv.`, `evaluate`,
`scan.` и так далее). По 25 строк на страницу; сервер возвращает до
500 последних событий.

### Troubleshooting

| Симптом | Вероятная причина | Решение |
|---|---|---|
| Health красная по `cv.md` | Первый запуск, файла ещё нет | `touch $CAREER_OPS_ROOT/cv.md`, затем refresh. |
| Health красная по `Profile customized` | `candidate.full_name` всё ещё `Jane Smith` | Отредактируйте `config/profile.yml`. |
| `hh.ru: HTTP 403` в логе скана | Не-российский IP, нет `(server uses default UA)` | Зарегистрируйтесь на `dev.hh.ru/admin`, используйте российский IP / VPN. |
| `gemini-eval.mjs: ERR_MODULE_NOT_FOUND` | Зависимости родителя не установлены | `cd $CAREER_OPS_ROOT && npm install`. |
| Generate PDF выдаёт ошибку | Playwright не установлен в родителе | `cd $CAREER_OPS_ROOT && npx playwright install chromium`. |
| `/career-ops apply` говорит «no report found» | Pipeline ни разу не оценивал этот JD | Сначала запустите `/career-ops pipeline` (или `#/evaluate`); см. предусловия §14. |
| `batch-runner.sh: no such file` | Запуск из неверной директории | `cd $CAREER_OPS_ROOT` перед вызовом `./batch/batch-runner.sh`. |
| Сервер ругается `EADDRINUSE: 4317` | Старый инстанс ещё работает | `pkill -f 'node server/index.mjs'`, затем перезапустите. |
| Live-вызов LLM висит > 2 минут | Огромный prompt или Anthropic тормозит | Проверьте `/api/health` (флаг Anthropic); сервер делает soft-cap промптов на 200 KB и возвращает 413. |
| Pipeline-превью показывает `(unsafe redirect)` | Вакансия редиректит на приватный IP / loopback | Это защитная мера (REVIEW-B1). Целевой URL отклоняется, исходный URL не меняется. |
| Текст строки трекера ломает таблицу | Пайп в имени компании на pre-v1.9.1 | Обновитесь до v1.9.1+ — пайпы экранируются end-to-end (BF-1). |
| `npm test` падает на свежем клоне | Тесты предполагают layout родителя | Используйте `CAREER_OPS_ROOT=$(mktemp -d)` и поднимите фикстуры. |

Для более глубокой диагностики: запустите **▶ Doctor** на странице
Health, скопируйте вывод и поищите проблему в issue-трекере на
<https://github.com/Fighter90/career-ops-ui/issues>.


---

## 17. Как добавить новый источник для скана

career-ops-ui рассматривает каждый job-сайт как **adapter** — единый файл в [`server/lib/sources/<slug>.mjs`](../../server/lib/sources/), который умеет fetch'ить и нормализовать результаты одного сайта. По состоянию на v1.76.0 registry `server/lib/sources/` поставляется с **25** адаптерами — 20 английских (ATSes Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday, RSS и агрегаторы v1.75.0 RemoteOK / Remotive / Working Nomads / IBM / Arbeitsagentur / Glints / Jobstreet · SEEK, и BambooHR / Breezy HR / Comeet / Personio / Recruitee / SolidJobs) и 5 русских досок. Семь агрегаторов, добавленных в v1.75.0, — это источники уровня доски или config-driven, а не ATSes на каждую компанию: три ленты удалёнки выбираются через `provider: remoteok|remotive|workingnomads`, а четыре региональных (IBM / Arbeitsagentur / Glints / Jobstreet · SEEK) читают config-блок `<provider>:` на каждую запись — см. §5 для YAML и `docs/portals-examples.md` для готовых copy-paste-записей.

> **v1.69.0 (P-14) — авторегистрация по принципу drop-in.** Добавление 12-го источника теперь — это **просто одни файл**. Реестр
> ([`server/lib/sources/registry.mjs`](../../server/lib/sources/registry.mjs))
> больше не содержит список с ручной поддержкой — при старте он сканирует папку
> (`readdirSync` + динамический `import()`) и собирает блоки `export const meta`
> из каждого `*.mjs`. Напиши адаптер, объяви его `meta` — и он немедленно
> появится в сканере, в dropdown фильтра `#/scan` и в RU-диспетчере
> **без каких-либо правок в `registry.mjs`**. (RU-источникам по-прежнему нужна
> одна строка в `portals.yml` родительского проекта; см. Шаг 5.)

### Шаг 1 — Пишем adapter

Создай `server/lib/sources/<slug>.mjs`. Два паттерна в зависимости от того, есть ли у сайта JSON API или только HTML:

**Источник с JSON API** (самый чистый — используй его, когда у сайта есть открытый endpoint):

```js
// server/lib/sources/example.mjs
const ENDPOINT = 'https://example.com/api/v1/vacancies';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...';

// v1.69.0 (P-14) — self-describing metadata. The registry auto-discovers
// this block at boot; THIS is what registers the source (see Step 2).
export const meta = {
  value: 'example',          // ← must equal job.source written below
  label: 'Example.com',      // ← shown in the #/scan filter dropdown
  region: 'ru',              // ← 'en' (ATS sweep) | 'ru' (regional dispatcher)
  configKey: 'example',      // ← RU only; the key used in portals.yml
};

export async function searchExample(query, opts = {}) {
  const { onlyRemote = false, fetchImpl = fetch, signal } = opts;
  const res = await fetchImpl(`${ENDPOINT}?text=${encodeURIComponent(query)}`, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`Example: HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return (data.items || []).map(normalizeExample);
}

function normalizeExample(item) {
  return {
    id: `example-${item.id}`,
    title: item.title || '',
    company: item.company?.name || '',
    url: item.url || '',
    salary: item.salary || '',
    location: item.location || '',
    isRemote: !!item.remote,
    workplaceType: item.remote ? 'Remote' : 'Onsite',
    relocates: false,
    date: item.posted_at || '',
    snippet: (item.description || '').slice(0, 240),
    source: 'example',           // ← must match the registry `value` exactly
  };
}
```

**Источник с HTML-скрейпом** (когда нет API — см.
[`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) и
[`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) для полных примеров):

```js
const BASE = 'https://example.com';

export async function searchExample(query, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  const res = await fetchImpl(`${BASE}/vacancies?q=${encodeURIComponent(query)}`, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Example: HTTP ${res.status}`), { status: res.status });
  }
  return parseExampleCards(await res.text());
}

export function parseExampleCards(html) {
  // …regex-based card extraction. Return [] on parse failure (DON'T throw):
  // a healthy 200 with no parseable cards is "no results", not "error",
  // so the multi-source scanner can keep going.
}
```

Три контракта, которые ОБЯЗАН соблюдать каждый адаптер:

- **Экспортировать валидный блок `meta`** (см. Шаг 2). Без него реестр
  молча пропустит файл при старте (одно `console.warn`) — источник
  никогда не появится.
- **Принимать `{ onlyRemote, fetchImpl, signal }` в `opts`.** `fetchImpl`
  делает адаптеры тестируемыми без сети; `signal` нужен для пробрасывания
  отключения клиента (REVIEW-B3).
- **Возвращать записи единой формы** —
  `{ id, title, company, url, salary, location, isRemote, workplaceType,
  relocates, date, snippet, source }`, где `source` совпадает с
  `meta.value`.

### Шаг 2 — Объяви `meta` адаптера (авторегистрация)

Это и есть весь шаг регистрации. **`registry.mjs` редактировать не нужно.**
Просто убедись, что адаптер экспортирует блок `meta` — реестр
авто-обнаружит его при старте:

```js
// at the top of server/lib/sources/example.mjs
export const meta = {
  value: 'example',          // job.source value AND #/scan option.value
  label: 'Example.com',      // display label in the dropdown
  region: 'ru',              // 'en' | 'ru'
  configKey: 'example',      // RU only — key in portals.yml::russian_portals.sources
};
```

Правила валидации при обнаружении (файл, нарушивший любое правило, пропускается с одним
предупреждением `[sources/registry]`, поэтому частично мигрированная ветка остаётся диагностируемой):

- `value` — непустая строка. ДОЛЖНА совпадать с `job.source` из адаптера.
- `label` — непустая строка.
- `region` — строго `'en'` или `'ru'`; всё остальное отклоняется.
- `configKey` — **обязателен** для `region: 'ru'`, игнорируется для `'en'`.

`region: 'en'` подключает к ATS-свипу (авто-обнаружение по URL-паттернам `tracked_companies`);
`region: 'ru'` — к региональному диспетчеру. Публичное API
(`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`, `getRegionalSources`) пересобирается
из каждого обнаруженного `meta`, сначала `en`, затем `ru`,
в алфавитном порядке по `label` внутри каждого региона — порядок в dropdown стабилен для пользователей.

### Шаг 3 — Подключи к dispatcher'у (только RU)

EN ATS-источники авто-обнаруживаются по URL-паттернам `tracked_companies` —
никаких дополнительных настроек не нужно. Для RU-источников открой
[`server/lib/ru-scanner.mjs`](../../server/lib/ru-scanner.mjs), найди
таблицу `RU_DISPATCH` и добавь строку:

```js
import { searchExample } from './sources/example.mjs';
// …
const RU_DISPATCH = {
  // …existing…
  example: { label: 'example.com', search: searchExample },
};
```

Цикл диспетчера вызывает `entry.search(query, opts)` для каждого ключа,
присутствующего в `cfg.sources`. Больше никаких правок кода не нужно.

### Шаг 4 — Тест (моки, никакой живой сети)

Создай файл `tests/sources-<slug>.test.mjs`. Живая сеть в тестах
**запрещена** (CI-isolation contract):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchExample } from '../server/lib/sources/example.mjs';

test('searchExample normalizes one record', async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({ items: [{ id: 1, title: 'Backend Engineer' }] }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  const out = await searchExample('q', { fetchImpl });
  assert.equal(out.length, 1);
  assert.equal(out[0].source, 'example');
});
```

### Шаг 5 — Активируй в своём `portals.yml`

`portals.yml` родительского проекта — это пользовательский конфиг. Добавь
`configKey` нового источника в массив:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob", "example"]
  area: 113
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
```

Перезагрузи `#/scan` в браузере. Dropdown source-фильтра подхватит новую запись
автоматически (единый источник правды: [`GET /api/scan/sources`](../../server/lib/routes/scan.mjs) →
[`registry.mjs`](../../server/lib/sources/registry.mjs)). Кнопка
🌐 Scan теперь включает новый источник в каждый региональный свип.

### Референсные адаптеры (зеркаль их для новых источников)

| Файл адаптера | Тип | Заметки |
|---|---|---|
| [`hh.mjs`](../../server/lib/sources/hh.mjs) | JSON API | Канонический RU API-адаптер; гео-зависимый UA fallback. |
| [`trudvsem.mjs`](../../server/lib/sources/trudvsem.mjs) | JSON API | Открытые данные правительства РФ; без IP-гейта. |
| [`habr.mjs`](../../server/lib/sources/habr.mjs) | HTML scrape | Российская tech-доска; парсер карточек на регулярках. |
| [`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) | HTML scrape | Защитный парсер, `[]` при промахе парсинга. |
| [`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) | HTML scrape | Тот же защитный стиль, что и у GetMatch. |
| [`greenhouse.mjs`](../../server/lib/sources/greenhouse.mjs) | JSON API | Канонический EN ATS-адаптер; использует URL-паттерн `tracked_companies`. |

### Типичные ошибки

- **Забыт экспорт `meta`.** Начиная с v1.69.0 именно блок `meta` — это
  *единственное*, что регистрирует источник. Нет `meta` (или он некорректен) —
  файл молча пропускается при старте с единственным предупреждением
  `[sources/registry] <file> has no valid \`export const meta\` — skipped`,
  и источник никогда не появится в dropdown. Проверь лог сервера,
  если новый адаптер не отображается.
- **Рассинхрон поля `source`.** Строка, которую пишет твой адаптер, ДОЛЖНА
  точно совпадать с `meta.value`. Если они разойдутся,
  dropdown фильтра `#/scan` покажет источник, но при его выборе
  отфильтрует все строки (потому что проверка равенства — `r.source === fs`).
- **Бросок исключения при сбое парсинга.** HTML-скрейперы ДОЛЖНЫ возвращать `[]` при
  здоровом 200 без распознаваемых карточек. Бросок исключения ломает цикл
  мультиисточникового dispatcher'а — одна плохая HTML-структура убивает все остальные источники для
  того же запроса.
- **Забыть `fetchImpl` / `signal`.** Без них твой адаптер
  нельзя покрыть юнит-тестами без обращения к живой сети, и отключения
  клиента не пробрасываются (фоновый fetch остаётся живым после того, как
  пользователь закрыл вкладку).
- **Полагаться на `tracked_companies` для RU.** Этот список — только для EN ATS
  источников. RU-адаптеры приводятся в движение сами из
  `russian_portals.queries` — без записей по компаниям.

---

## 18. Уведомления (🔔 в верхней панели)

> v1.58.34 — каждый toast, появляющийся в правом нижнем углу, также записывается в in-memory журнал (лимит 50, старые вытесняются). Клик по 🔔 в шапке открывает правый drawer **Уведомления**, чтобы перечитать всё пропущенное. Журнал — per-tab, per-session — закрытие вкладки очищает его.

Drawer **открывается только по клику на колокольчик** (или Enter / Space при клавиатурном фокусе). Сам не появляется. Красный badge показывает счётчик не просмотренных с прошлого открытия; при открытии — обнуляется.

### Категории уведомлений

| Категория | Когда срабатывает | Визуальный сигнал |
|---|---|---|
| **Success** | `Сохранено`, `Скопировано`, `Обновлено`, скан завершён, CV импортирован, действия apply-checklist (`Copy unchecked`, `Reset`), профиль сохранён, URL добавлен в pipeline | зелёная левая полоса в drawer; зелёный фон toast |
| **Error** | Невалидный URL (должен начинаться с `http://` / `https://`, без script/template-символов), API-ошибки с хвостом `(METHOD /path · HTTP NNN)`, сетевые сбои (server down), pipeline-400 дубликаты, doctor / verify-pipeline ненулевой exit | красная левая полоса; красный фон toast; технический хвост спрятан в блок `Подробнее` (U-4 / v1.58.24) |
| **Info / progress** | `Running doctor.mjs…`, `Running verify-pipeline.mjs…`, `Обновление…`, `Loading…`, `Generating prompt…`, прогресс скана | серая левая полоса; стандартный фон toast |

Каждая запись в drawer показывает:

- **Время** (`HH:MM:SS` локализовано под текущий язык SPA).
- **Сообщение** (человеческая фраза; технический хвост убран из заголовка по U-4).
- **Детали** (если есть — `(METHOD /path · HTTP NNN)` API-вызова или иной технический фрагмент, monospace).

### Что НЕ является уведомлением

- Модалка результата Doctor / verify-pipeline (полный stdout/stderr) — это модальное окно, не toast, в журнал не попадает.
- SSE log-строки на `#/scan` и `#/auto` — пишутся в тело страницы, минуя toast-конвейер.
- Spinner-only состояния загрузки (через `UI.withSpinner` без toast).

### Клавиатура

- **Клик** или фокус + **Enter / Space** на колокольчике → открыть drawer.
- **Esc**, клик по **×**, или повторный клик по колокольчику → закрыть; фокус возвращается на колокольчик.
- **Tab** при открытом drawer → проходит по close-кнопке и focusable элементам внутри; drawer `aria-modal="false"`, фокус НЕ ловится — остальная страница доступна.


## 19. Локализация приложения на ваш язык

Интерфейс поставляется на 9 языках (English, Español, Français, Português, 한국어, 日本語, Русский, 简体中文, 繁體中文). Каждая надпись на экране берётся из словаря переводов, и вы можете добавить или поправить язык, не трогая логику приложения.

**Где лежат переводы.** Начиная с v1.60.0 каждый язык — это отдельный файл в `public/js/lib/locales/` — `i18n-dict.en.js`, `i18n-dict.es.js`, `i18n-dict.ru.js` и т. д. — простой список пар `'ключ': 'текст'`. Общий `i18n-dict.aliases.js` позволяет ключам, которые должны читаться одинаково (надпись в боковом меню и заголовок её страницы), указывать на один перевод. `i18n-dict.js` собирает их при загрузке; его править не нужно.

**Исправить или добавить фразу.** Откройте файл вашего языка, найдите ключ (например, `'nav.scan'`) и отредактируйте текст. Чтобы добавить новую надпись, добавьте один и тот же ключ во **все 8** языковых файлов с переводом и используйте его на странице через `t('ваш.ключ')`. Запустите `npm test` — он падает, если в каком-то языке ключа нет, поэтому ничего не выходит наполовину переведённым.

**Добавить новый язык.** Скопируйте `i18n-dict.en.js` в `i18n-dict.<код>.js`, переведите все значения, затем зарегистрируйте код в `i18n.js` (список языков + автоопределение браузера), в сборщике `i18n-dict.js` и добавьте строку `<script>` в `index.html`. Полный чек-лист — включая снимок (snapshot) для тестов и сопутствующие файлы справки / README — в `docs/LOCALIZATION.md`.

**Полезно знать.** Переключатель языка — в подвале боковой панели; выбор запоминается для каждого браузера. Диагностические сообщения сервера намеренно остаются на английском (чтобы логи читались единообразно) — переводится только экранный интерфейс.

Полное пошаговое руководство по локализации см. в файле **`docs/LOCALIZATION.md`** в репозитории.
