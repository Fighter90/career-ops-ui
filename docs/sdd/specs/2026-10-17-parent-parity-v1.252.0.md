# Spec — v1.252.0: parent parity (fork ← career-ops-hq, parent 1.37.0)

**Дата:** 2026-10-17 · **Тип:** parent-sync, docs-train release (SPA-код не менялся)

## Проблема
Форк Fighter90/career-ops отстал от career-ops-hq/career-ops на 264 коммита
(последний синк — v1.248.x, база db11bee7 / upstream 1db6517a). Родитель
двигался: новые борды, режимы, сигналы Block G, укрепления fact-gate.

## Решение
1. **Мерж апстрима в форк** (139efe1b): два конфликта решены вручную —
   - `docs/SUPPORTED_JOB_BOARDS.md`: Tech in Asia + улучшенный telegram-channel
     апстрима + форк-единственный `telegram` (ADR-0001) + Tencent max_pages 100;
   - `test-all.mjs`: walkTree-версия `copyDirSync` апстрима (субсумирует форковский
     ручной `.git`-guard — walk-tree.mjs пропускает вложенные чекауты по построению);
     импорт — объединение (форковский `runBash` сохранён).
   Дивергенции проверены: `providers/telegram.mjs` жив; Unicode `LOCATIONISH_RE` в
   `telegram-channel.mjs` цел (ADR-0002).
2. **Релиз web-ui v1.252.0** — док-поезд: CHANGELOG ×18, README ×18, QA-промпт
   v1.252.0 (v1.251.1 в архив), спека, PROJECT-CONTEXT/CONVENTIONS, site mirrors.
3. **Деплой** local + resumecraft.ru с `parent_ref=139efe1b` → health
   `parentVersion: 1.37.0`.

## Инварианты
- `states.yml` родителя не менялся в дельте → канонические статусы SPA без правок.
- Никаких клиентских JS/CSS изменений — тестовая база остаётся 5253/129.
- Дивергенции ADR-0001/0002 выживают мерж (проверяется §4 QA-промпта).

## Проверка
- test:ci 5253/0, browser 129/0, evals 12/0, coverage gate, link-check.
- Локальный health: version 1.252.0 / parentVersion 1.37.0.
- Прод health: то же; smoke 15/15.
