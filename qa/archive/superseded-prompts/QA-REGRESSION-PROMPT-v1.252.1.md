# QA regression — v1.252.1 (wiki-banner gate + locale-directive override)

> База: v1.252.0 → v1.252.1. По FIX-промпту регресса v1.252.0.
> Тесты: **5262** (test:ci; +8: wiki-banner-check ×5, locale-directive ×4).

## §0 — Ворота

```bash
npm run test:ci                 # 5262 pass, exit 0 (offline)
npm run test:coverage:gate
npm run test:e2e && npm run test:e2e:browser
node evals/workflow/run.mjs     # 12 pass · 0 fail
node scripts/remote-qa/link-check.mjs   # зелёный
node scripts/wiki-banner-check.mjs --wiki <wiki-clone> --tests 5262   # НОВЫЙ гейт → OK
```

## §1 — Wiki-баннер (FIX §1)

1. `grep -L "v1.252.1" Home*.md` в клоне wiki → **пусто** (18/18).
2. Баннер ×18: `**v1.252.1**` + `105 scanner adapters/adapters сканера/…` + `39` + `18` + `5262` — счётчики из реестра (ALL_ADAPTERS.length, files in server/lib/routes), не руками; слова локализованы, числа едины.
3. Гейт красный при подделке: баннер v1.251.0 → exit 1 с постраничным списком (проверено на текущем wiki).

## §2 — Директива языка (FIX §2)

1. `buildLocaleDirective('ru')` содержит «This UI locale overrides the profile's language.output setting and the job posting's own language» — тест на ТЕКСТ ×17 не-EN + пустой EN (`tests/locale-directive-language-output.test.mjs`).
2. Живая проверка: `remote-qa -f live=true -f scan=false` × 18 → A–G **18/18**, язык **17/18** (ta — §3).
3. Родителя не трогать (read-only).

## §3 — ta: форма vs язык (наблюдение)

Первый живой прогон v1.252.0: ta evaluate = 48 336 символов, БЕЗ Block G и
SCORE_SUMMARY — похоже на **зацикливание** (ФОРМА, не язык; CAR-70 — язык).
Если повторится в этом прогоне — завести в Linear отдельно от CAR-70.

## §4 — Регрессии (не трогать)

Поиск с персистом, peek по тапу, спец-фильтр карты, Reset, remote-qa shape≠language
(warnings-колонка), высота мобильной карты ≥540px, embed-фетч, дедуп «## Rejected».

## §5 — Sign-off

- [ ] §0 зелёный (включая НОВЫЙ wiki-gate) · [ ] §1 баннер ×18 ·
- [ ] §2 директива ×18, A–G 18/18, язык 17/18 · [ ] §3 наблюдение записано ·
- [ ] прод `1.252.1` · smoke 16/16
