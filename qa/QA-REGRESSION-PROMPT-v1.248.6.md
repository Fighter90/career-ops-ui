# QA regression — v1.248.6 (Telegram line structure, header role, Rejected dedup, recon honesty)

> База: v1.248.5 → v1.248.6. Тесты: **5189 → 5191**.

## §0 — Ворота
```bash
npm run test:ci                 # 5191 pass, exit 0 (offline)
npm run test:coverage:gate      # 98.18% line / 89.42% branch
npm run test:e2e && npm run test:e2e:browser && npm run test:e2e:full
node evals/workflow/run.mjs     # 12 pass · 0 fail
node scripts/remote-qa/link-check.mjs   # No broken links (github.com 5xx = unverified)
```

## §1 — Строчная структура t.me-поста
1. Фикстура embed с `<br>` и «Компания : X» (пробел до двоеточия):
   компания = X (НЕ имя канала), роль без хэштегов.
2. Числовые сущности `&#NN;`/`&#xNN;` декодируются.
3. Роль в строке трекера: без `#`, без эмодзи, ≤80 символов,
   из шапки отчёта (`# <Роль> — <Компания>` → берётся часть роли).

## §2 — Rejected-секция
Два отказа подряд → ровно один заголовок `## Rejected`, две строки-метки
(строка URL уходит из фенса при первом отказе; второй отказ дописывает
свою строку в существующий раздел).

## §3 — Корень домена до запроса
`https://linkedin.com/` → отказ на шаге fetch с `rejected: true`,
НЕТ события `fetch: done` (проверка до скачивания страницы).

## §4 — Recon / cleanup-plan / link-check
1. Recon: `honours rejected:` вычисляется из выкаченного
   `auto-pipeline.mjs` (grep markPipelineRejected); метки печатаются
   ОДНИМ числом.
2. cleanup-plan: три числа по видам (t-role к перемещению /
   dirty-URL строки / test-row строки); на чистых данных — нули,
   не фантомная «1».
3. link-check: 5xx от github.com → «unverified», не broken.

## §5 — Регрессии (не трогать, проверить что живы)
Embed-фетч, skip-контракт, офлайн-тесты, uk-порядковые заголовки,
границы слов, cleanup-режимы.

## §6 — Sign-off
- [ ] §0 зелёный · [ ] §1–§4 · [ ] §5 без регрессий ·
- [ ] прод `1.248.6` · smoke 15/15
