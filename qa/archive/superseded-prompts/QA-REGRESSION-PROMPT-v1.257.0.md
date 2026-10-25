# QA regression — v1.257.0 (CAR-103 help tokenizer + CAR-106 Hermes usage cost)

> База: v1.256.0 → v1.257.0. Тесты: **5713** (+8: docs-assistant ×3, usage ×5).

## §0 — Ворота
```bash
npm run test:ci                 # 5713 pass, exit 0
npm run test:coverage:gate
npm run test:e2e:browser        # 144 total / 143 pass / 1 skip
node evals/workflow/run.mjs
```

## §1.5 — фиксы релиза
1. **Справка hi/ta (CAR-103)**: помощник по справке на хинди («मैं स्कैन कैसे चलाऊं?») и
   тамильском («ஸ்கேன் எப்படி இயக்குவது?») находит релевантные разделы; матры/типовые знаки
   не рвут слова. Гейты: docs-assistant-routes ×3.
2. **Hermes в #/usage (CAR-106)**: после живого вызова Hermes запись usage несёт cost
   провайдера — $ не 0.0000; токены без cost считаются по таблице цен как раньше.
   Гейты: usage-routes ×5.

## §2 — Регрессии (не трогать)
Всё из v1.256.0/1.255.x: tracker identity (CAR-127/128), backfill-эндпоинт, score sort,
CAR-99 dense-array gate, vi ×19, cold-load bundle, snapshot-safety R-12.

## §3 — Live (после деплоя)
prod-llm ×19: 19/19 200. Один живой вызов через Hermes → в `#/usage` стоимость за 24h
не нулевая (если провайдер отдаёт cost).

## §4 — Sign-off
См. qa/README.md; вердикт — в комментарии релизного PR.
