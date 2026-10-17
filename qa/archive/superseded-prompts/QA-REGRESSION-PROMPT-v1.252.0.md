# QA regression — v1.252.0 (parent parity: fork ← career-ops-hq, parent 1.37.0)

> База: v1.251.1 → v1.252.0. Кода SPA не менялся — это док-поезд + переустановка родителя.
> Тесты: **5253** (test:ci) · browser 129/0 · evals 12/0 · coverage 98.2/89.5.

## §0 — Ворота

```bash
npm run test:ci                 # 5253 pass, exit 0 (offline)
npm run test:coverage:gate      # 98.23% line / 89.4x% branch
npm run test:e2e && npm run test:e2e:browser
node evals/workflow/run.mjs     # 12 pass · 0 fail
node scripts/remote-qa/link-check.mjs   # зелёный (github 5xx = unverified)
```

## §1 — Родитель 1.37.0 (главная проверка релиза)

1. `curl -s http://127.0.0.1:4317/api/health` → `"parentVersion": "1.37.0"` (локально родитель в `~/My_diary/career-ops` на 139efe1b).
2. Прод: `https://resumecraft.ru/api/health` → `"version": "1.252.0"`, `"parentVersion": "1.37.0"`.
3. Трекер рендерится (статусы канонические, states.yml родителя не менялся в дельте).
4. Отчёты открываются, дашборд рисует счётчики.

## §2 — Регрессии (не трогать)

Поиск с персистом, peek по тапу, спец-фильтр карты (отличительные токены),
Reset, высота мобильной карты ≥540px, embed-фетч, дедуп «## Rejected», recon,
cleanup-режимы, remote-qa shape≠language (warnings-колонка).

## §3 — ta/ja дрейф (известное ограничение, CAR-70)

ta-оценка на hermes флакует по языку (проза 2–26 % тамильского) — задокументированное
ограничение бэкенда. В remote-qa `report not in ta` для ta — ожидаемая находка
(warnings-колонка), НЕ регресс. A–G судится только по block/SCORE_SUMMARY/looping.

## §4 — Дивергенции форка (проверка родителя после мержа)

```bash
cd ~/My_diary/career-ops
ls providers/telegram.mjs                       # жив (ADR-0001, только в форке)
grep -c "LOCATIONISH_RE = /(?<!\[" providers/telegram-channel.mjs   # 1 (ADR-0002)
node --test tests/walk-tree.test.mjs            # walkTree-версия copyDirSync
```

## §5 — Sign-off

- [ ] §0 зелёный · [ ] §1 parentVersion 1.37.0 на локале и проде ·
- [ ] §2 регрессии · [ ] §3 ta-дрейф как ожидаемая находка ·
- [ ] §4 дивергенции живы · smoke 15/15 · wiki ×18 → v1.252.0
