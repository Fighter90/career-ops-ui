# QA regression — v1.255.0 (Vietnamese vi — the 19th UI locale, CAR-88)

> База: v1.254.0 → v1.255.0. Тесты: **5642** (+8: i18n-vi-locale ×8; словарь 1525 = EN, gates ×19).
> Замечание: qa/QA-REGRESSION-PROMPT-v1.254.0.md ушёл в архив ПУСТЫМ — дефект поезда v1.254.0;
> этот промпт собран заново на базе шаблона v1.253.1.

## §0 — Ворота
```bash
npm run test:ci                 # 5642 pass (1 skipped — opt-in layout-capture), exit 0
npm run test:coverage:gate
npm run test:e2e:browser        # 144 total / 143 pass / 0 fail
node evals/workflow/run.mjs
```

## §1.5 — vi (главное этого релиза)
1. Language switcher: **19 позиций**, 🇻🇳 Tiếng Việt на месте, переключение сохраняется в localStorage; LTR (в `RTL_LANGS` не попадает).
2. locale-sweep **×19**: каждая страница рендерится и локализуется в vi (per-locale split load).
3. vi dict parity: 1525/1525 ключей = `en`, detect(vi, vi-VN); снапшот словаря пересобран.
4. Справка: docs/help/vi.md — 33 H2 / 125 H3, якоря на месте; help-source-counts зелёный.
5. «Pipeline» остаётся «Pipeline» — техническая калька, whitelisted; НЕ считать утечкой Latin.

## §2 — Регрессии (не трогать)
Всё из v1.254.0: snapshot-safety (R-12: пустой скан не затирает снапшот, carry-over
через ТЕКУЩИЕ фильтры), 11 LLM-инвариантов, SPA must-fixes, Paylocity source,
IPv6-SSRF и ReDoS фиксы (v1.253.1), wiki-banner gate, pipeline skip contract.

## §3 — ta/ja (известное)
`report not in ta|ja` — warnings-колонка, не регресс. ta-зацикливание — следить (§3 v1.252.1).

## §4 — Sign-off
- [ ] §0 зелёный · [ ] §1.5 switcher ×19 + dict parity + help vi · [ ] §2 регрессии ·
- [ ] прод `1.255.0` / parent `1.38.0` · smoke 15/15
