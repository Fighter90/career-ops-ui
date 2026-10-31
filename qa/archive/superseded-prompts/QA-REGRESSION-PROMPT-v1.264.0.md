> База: v1.263.0 → v1.264.0. Тесты: **7041** (+136). Финальный счёт релиза: **7041 / 7038 pass / 0 fail / 3 skip**.

# QA Regression Prompt — v1.264.0

§0 Ворота: `npm run test:ci` exit 0 · changelog parity ×19 · browser 176 pass / 1 opt-in skip · evals зелёные в CI · `tests/tracker-inline-status.test.mjs` + `tests/cov-*-routes.test.mjs` + `tests/sources-trudvsem.test.mjs` + `tests/cv-upload-hints.test.mjs` + `tests/llm-warnings-ui.test.mjs` зелёные.

§1 Чек-лист (в порядке риска):
1. **Inline-статус трекера**: select в строке; смена → POST → строка обновляется in place (тон + счётчики табов); ошибка → откат + тост; неизвестный статус и sentinel-строка `#` → read-only бейдж; dry-run-режим маршрута отвечает echo.
2. **Anthropic default = claude-sonnet-5-5**: evaluate живьём уходит в 5-5 (если ключ не задан — каскад не менялся); хинты ×19 называют 5-5/opus-5-5.
3. **Warnings-бэнд**: оборви вывод (или замокай truncated) → бэнд на evaluate/deep/auto (страница и модалка)/career-plan/market/cv-studio.
4. **Trudvsem**: скан не падает на пустой странице; порталы с нулевым матчем → 0 строк; offset ходит по записям (дедуп не растёт).
5. **habr**: title с `&lt;…&gt;` не даёт живых тегов; `Changellenge >> Lead & QA` читается.
6. **Profile raw**: `candidate:` без `full_name` → 400; с ним → 200 + header-stamp.
7. **Upload**: `.doc` отклоняется, `.docx/.pdf/.txt/.md` работают; хинты ×19 без .doc; openaiModelHint = gpt-5.
8. **Регресс v1.263.0**: crimson-акцент, motion (reduce/тач), scan sticky/поповер, drawer, a11y-гейт, help ×19 (33 H2/129 H3, 0 литеральных `**`).

§2 Регресс-классы: R-01…R-12 (см. TRACEABILITY).

§3 Осознанно не сделано: movesReady-деградация inline-select (честный тост — выбранное поведение); code:'timeout' ветка (пин контрактного фейк-писателя); CAR-141 видео (владелец).
