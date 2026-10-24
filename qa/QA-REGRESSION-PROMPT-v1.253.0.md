# QA regression — v1.253.0 (10 новых источников + role-matcher #5688)

> База: v1.252.1 → v1.253.0. Тесты: **5504** (test:ci; +242: 10 source-сьютов, role-matcher, coverage-кейсы).

## §0 — Ворота
```bash
npm run test:ci                 # 5504 pass, exit 0
npm run test:coverage:gate      # ratchet зелёный (6 портов ≥95% branch)
npm run test:e2e:browser        # 129+ green
node evals/workflow/run.mjs     # 14 pass · 0 fail
node scripts/wiki-banner-check.mjs --wiki <clone> --tests 5504
```

## §1 — Новые источники (главная проверка)
1. `#/scan` Source dropdown: 120 записей, включая новые (Atlassian, BWI, Computrabajo, Dover, Google, Kalibrr, Magneto365, Platsbanken, Tech in Asia, Zoho Recruit) — и FALLBACK работает офлайн.
2. Портals-энтри: `provider: atlassian|dover|...` резолвится (`POST /api/portals/health` на тестовом энтри без ошибок).
3. Живой скан одного нового источника (например dover на реальном энтри) — строки приходят, URL https, локации читаемы.
4. Гейты счётчиков: adapter-registry 115, endpoint EN-set 115, FALLBACK 120, site SOURCE_URLS, help §17 «120 — 115+5» ×18.

## §2 — role-matcher #5688
1. «HR BP» vs «HR GP», «AWS» vs «GCP» — НЕ склеиваются (тест 10/10).
2. Ложных срабатываний на прежних парах нет (detect-reposts/levels suite 34/34).

## §3 — Регрессии (не трогать)
Спец-фильтр карты, peek, Reset, remote-qa shape≠language, мобильная карта ≥540px,
embed-фетч, дедуп «## Rejected», pipeline skip contract, счётчики дашборда.

## §4 — ta/ja дрейф (CAR-70, известно)
ta/ja `report not in <locale>` — ожидаемая находка warnings-колонки; ta-зацикливание (§3 v1.252.1) — следить.

## §5 — Sign-off
- [ ] §0 зелёный · [ ] §1 dropdown+живой скан · [ ] §2 role-matcher ·
- [ ] §3 регрессии · [ ] прод `1.253.0` / parent `1.38.0` · smoke 15/15
