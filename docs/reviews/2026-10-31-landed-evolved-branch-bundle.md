# Decision bundle — 34 remote-ветки «landed & evolved» (2026-10-31)

**Для владельца: один проход, две ветки не трогать, остальное — одна команда.**
Метод: для каждой ветки сняты `git log origin/main..<branch>` (unmerged),
`git cherry origin/main <branch>` (уникальные патчи — после squash-мержей он
врёт в сторону «+», поэтому решающий критерий — grep маркеров фичи в дереве
`origin/main`), дата последнего коммита и файловые сравнения с верхушкой main.

⚠️ `git cherry` показывает `+` даже для контента, влитого squash-мержем
(другой patch-id). Пустой diff или найденный маркер + SHA коммита влития —
единственное доказательство «landed». Все проверки ниже выполнены против
`origin/main` = `d554bf87` (v1.263.0 + харднинг-хвост; v1.264.0 ещё не влит).

## Итог

| Вердикт | Кол-во |
|---|---|
| **DELETE (safe)** | **32** |
| **KEEP** | **1** — `release/1.264.0-integration` (влитие в полёте) |
| **OWNER REVIEW** | **1** — `car136/m138` (частичное попадание + один конфликт решений) |

## Пачка удаления — paste-ready (32 ветки)

```bash
git push origin --delete \
  car136/m141 car136/t1 car136/t3a car136/t3b car136/t3c \
  car136/t3d car136/t3e car136/t3f car136/t4 \
  car137/empty car137/err car137/hints \
  changelog/1.263.0-a changelog/1.263.0-b changelog/1.263.0-c \
  changelog/1.263.0-d changelog/1.263.0-e changelog/1.263.0-f \
  docs/progress-1262 \
  fanout/1.262.0-a fanout/1.262.0-b fanout/1.262.0-c \
  feat/cv-voice-check feat/deel-provider feat/design-v3-active \
  feat/design-v3-phase3 feat/posting-guard-relay feat/tracker-csv-import \
  fix/liveness-apply-patterns fix/liveness-apply-patterns-2 \
  fix/minimax-flash-default sweep/docs-drift
```

## KEEP (1)

| Ветка | Почему |
|---|---|
| `release/1.264.0-integration` | **Активный релизный поезд.** Tip `a3ee10a5` — коммит релиза v1.264.0 поверх `origin/main`, его НЕТ на main (`qa/QA-REGRESSION-PROMPT-v1.264.0.md`, запись CHANGELOG, help §11 inline-status — всё только на ветке). Локальное рабочее дерево стоит на этой ветке; рядом в полёте локальные `changelog/1.264.0-a…f`. Удалить по стандартному правилу «ветка релиза удаляется после мержа» — когда v1.264.0 доедет до main. |

## OWNER REVIEW (1)

| Ветка | unmerged | cherry+ | Ситуация |
|---|---|---|---|
| `car136/m138` | 1 | 1 | Идея CAR-138 на main есть, но в другом месте: точные счётчики `{sources}/{en}/{ru}` из facts.json влиты через **#578 `f1523473` в `StatsBar.astro`**, а не в `Faq.astro`. Из трёх ханков ветки: (а) `{sources}`-замены в `Faq.astro` — на main **нет**; (б) перформулировка `meta.helpDesc` («command-center dashboard, kanban application tracker») — на main **нет**; (в) удаление `install.gitComment` — **противоречит** более позднему решению #602 `68c1c1cb` (комментарий не удалили, а локализовали ×19 + фикс #605 `05ce27e7`). Вливать сейчас = откатить #602. Удалять, если не нужен именно FAQ-вариант точных счётчиков (11 строк, redo поверх текущего main тривиален). |

## DELETE (safe) — 32 ветки

### CAR-136 — docs-assistant v2 (#546 `0a04f338`, «reference questions ×19 + route links»)

Строки `docs.q1…q4` свереным байт-в-байт совпадают с main (выборочно: en, es, hi); гейт `tests/car136-route-chips.test.mjs` на main.

| Ветка | unmerged | cherry+ | Последний коммит | Маркер на main |
|---|---|---|---|---|
| `car136/t1` | 1 | 1 | 2026-10-28 | en `docs.q*` идентичны; #546 |
| `car136/t3a` | 1 | 1 | 2026-10-28 | es `docs.q1` идентичен; #546 |
| `car136/t3b` | 1 | 1 | 2026-10-28 | #546 (ja/ko/zh-CN) |
| `car136/t3c` | 1 | 1 | 2026-10-28 | #546 (zh-TW/fr/de) |
| `car136/t3d` | 1 | 1 | 2026-10-28 | #546 (pl/uk/da) |
| `car136/t3e` | 1 | 1 | 2026-10-28 | #546 (ar/it/tr) |
| `car136/t3f` | 1 | 1 | 2026-10-28 | hi `docs.q1` идентичен; #546 |
| `car136/t4` | 1 | 1 | 2026-10-28 | `tests/car136-route-chips.test.mjs` на main; #546 |

### CAR-137 — error texts + empty states + HelpHint (#550 `3cb8b6fe`)

Все добавленные ветками ключи i18n присутствуют на main (проверено пофамильно):
`car137/empty` → 15 ключей `v2empty.*` — все на main; `car137/err` → 5 ключей
ошибок — все на main; `car137/hints` → 40 ключей `help.hint.*`/mode-page — все
на main, `HelpHint` подключён в 31 view, mode-page kit на месте. CHANGELOG
v1.261.1: «#550 CAR-137 (specific error texts ×5 + v2empty ×5 + HelpHint ×13
views + mode-page kit ×8)».

| Ветка | unmerged | cherry+ | Последний коммит | Маркер на main |
|---|---|---|---|---|
| `car137/empty` | 1 | 1 | 2026-10-28 | 15 ключей `v2empty.*` — все на main; #550 |
| `car137/err` | 1 | 1 | 2026-10-28 | 5 ключей ошибок — все на main; #550 |
| `car137/hints` | 4 | 3 | 2026-10-28 | 40 ключей — все на main; HelpHint ×31 view; #550 |

### CHANGELOG ×19 для v1.263.0 (#609 `440677bf`)

Все 18 локальных `CHANGELOG.<L>.md` на main содержат запись `1.263.0`;
файловые сравнения ветка↔main по `CHANGELOG.es/pt-BR/fr` и
`CHANGELOG.ar/vi/zh-TW` — **пустой diff** (влито дословно).

| Ветка | unmerged | cherry+ | Последний коммит | Маркер на main |
|---|---|---|---|---|
| `changelog/1.263.0-a` | 2 | 2 | 2026-10-30 | es/pt-BR/fr идентичны main; #609 |
| `changelog/1.263.0-b` | 2 | 2 | 2026-10-30 | ko-KR/ja/zh-CN `grep -c 1.263.0` = 1; #609 |
| `changelog/1.263.0-c` | 2 | 2 | 2026-10-30 | ru/uk/pl = 1; #609 |
| `changelog/1.263.0-d` | 2 | 2 | 2026-10-30 | da/de/it = 1; #609 |
| `changelog/1.263.0-e` | 2 | 2 | 2026-10-30 | tr/hi/ta = 1; #609 |
| `changelog/1.263.0-f` | 2 | 2 | 2026-10-30 | ar/vi/zh-TW идентичны main; #609 |

### Fan-out документации v1.262.0 (релизный поезд #590 `334bebc8`)

Каждая ветка несёт всю историю интеграции 1.262.0 (merge-коммиты фичевых
веток) + свой локальный fan-out. Все 9 фич поезда проверены маркерами на main
(см. блок feat/fix ниже), `CHANGELOG.<L>` ×18 содержат `1.262.0`, README-баннеры
веток (v1.262.0) вытеснены на main баннерами v1.263.0 — «landed & evolved».

| Ветка | unmerged | cherry+ | Последний коммит | Маркер на main |
|---|---|---|---|---|
| `fanout/1.262.0-a` | 29 | 19 | 2026-10-29 | CHANGELOG es «El minor de funciones upstream»-эпоха влита (#590), баннер вытеснен v1.263.0 |
| `fanout/1.262.0-b` | 29 | 19 | 2026-10-29 | аналогично |
| `fanout/1.262.0-c` | 29 | 19 | 2026-10-29 | аналогично |

### Фичевые ветки v1.262.0 — все влиты релизом #590 `334bebc8` + маркеры в дереве main

| Ветка | unmerged | cherry+ | Последний коммит | Маркер на main (SHA влития) |
|---|---|---|---|---|
| `feat/cv-voice-check` | 2 | 2 | 2026-10-29 | `server/lib/cv-voice.mjs` + `tests/cv-voice.test.mjs` на main — CAR-188, #590 |
| `feat/deel-provider` | 2 | 2 | 2026-10-29 | `server/lib/sources/deel.mjs` + `portals/adapters/deel.mjs` + `tests/sources-deel.test.mjs` — CAR-184, #590 |
| `feat/design-v3-active` | 9 | 8 | 2026-10-28 | `tokens-v3.css` активен: #566 `fdd35d65` → релиз #574 `7f8a3455`; эволюция: акцент crimson `f35309bd` |
| `feat/design-v3-phase3` | 10 | 8 | 2026-10-28 | density-токены в `tokens-v3.css`; **#584 `9769cbc8`** — subject ветки совпадает дословно |
| `feat/posting-guard-relay` | 2 | 2 | 2026-10-29 | `tests/posting-guard-relay.test.mjs` + `routes/runners.mjs` — CAR-182, #590 |
| `feat/tracker-csv-import` | 2 | 2 | 2026-10-29 | `import.btn` UI в `tracker.js:609` + `tests/tracker-import-csv.test.mjs` — CAR-181, #590 |
| `fix/liveness-apply-patterns` | 1 | 1 | 2026-10-29 | BG «Кандидатствай»/VI «NỘP ĐƠN» в `liveness-core.mjs:154-161` — CAR-185, #590 |
| `fix/liveness-apply-patterns-2` | 1 | 1 | 2026-10-29 | NL «Solliciteer»/ES/中文 в `liveness-core.mjs:172-184` — CAR-189, #590 |
| `fix/minimax-flash-default` | 1 | 1 | 2026-10-29 | `MiniMax-M3.1-Flash` default в `field-specs.js:297` + `openai.mjs` — CAR-187, #590 |

### Прочее

| Ветка | unmerged | cherry+ | Последний коммит | Маркер на main |
|---|---|---|---|---|
| `car136/m141` | 1 | 1 | 2026-10-28 | все три части влиты и ушли дальше: copy-feedback #555 `3df82f92`, de-YouTube → youtube-nocookie #602 `68c1c1cb`, локализованные install-комментарии #602+#605 `05ce27e7`; `VideoModal.astro`/`InstallTabs.astro` на main |
| `docs/progress-1262` | 1 | 1 | 2026-10-28 | снапшот «v1.261.2 IN FLIGHT, PR #574» — состояние отжившее: v1.261.2 влит (#574 `7f8a3455`), факты в CHANGELOG v1.261.2; PROGRESS.md переписан трижды с тех пор |
| `sweep/docs-drift` | 0 | 0 | 2026-10-30 | полностью влит: diff vs main **пустой**, cherry 0 |

## Примечания

1. **Не путать** удалаемые `changelog/1.263.0-a…f` (remote, v1.263.0 — влито)
   с локальными `changelog/1.264.0-a…f` (fan-out v1.264.0 **в полёте**) —
   вторые не трогать.
2. `release/1.264.0-integration` удалить той же командой после мержа v1.264.0.
3. Если MAIN сдвинулся с `d554bf87` после составления этого документа —
   перед удалением повторить точечные проверки для OWNER REVIEW-ветки
   (`car136/m138`): возможен доезд #578/#602-подобных фиксов.
4. Проверка выполнена только `git`-чтением; ни одна ветка этим документом
   не удалялась.
