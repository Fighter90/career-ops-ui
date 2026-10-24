# QA regression — v1.255.1 (vi review round + CAR-92 r2)

> База: v1.255.0 → v1.255.1. Тесты: **5686** (+26: `eval-validate-opus-r2`, `scanner-carryover-r2`, vi-гейты).
> Два фикс-раунда из Opus-ревью: vi-локаль (9 находок) и CAR-91/92 second-pass (5 must-fix).

## §0 — Ворота
```bash
npm run test:ci                 # 5686 pass, exit 0
npm run test:coverage:gate
npm run test:e2e:browser        # 144 total / 143 pass / 0 fail
node evals/workflow/run.mjs
```

## §1.5 — фикс-раунды (главное этого релиза)
1. **vi-ревью**: `project.subtitle`/`project.roleHint` = «độ khớp tín hiệu» (Hangul-лик закрыт);
   гейт i18n-vi-locale ловит CJK/кану, которой нет в en-словаре (кроме умышленных брендов типа 方舟).
2. **vi-help-ссылки**: все 6 URL с пробелами (`what-is career-ops`, `apply for a job`, `set up playwright`…)
   заменены на дефисные слаги; гейт «no spaces in markdown URLs» зелёный.
3. **Резак заголовков (CAR-92 r2 H1)**: `## Q&A`, `## Plan B`, `## Ph.D. requirement`, `## E-commerce`
   НЕ регистрируются как блоки A/B/D/E; `## A. Название` по-прежнему парсится;
   bare-EOL терминатор принимается только после block-слова.
4. **UKR/RU-нумерация (H2)**: отчёт с блоками А Б В Г Д Є Ж и `### A.` под-секциями режется правильно
   (UKR-детектор задаёт reference level) — не обрезается на блоке Б.
5. **Carry-over rows (M1)**: штамп `carriedSince`, дроп после 30 дней или 5 переносов, порядок
   «свежие → перенесённые»; перенесённые строки не копятся бесконечно.
6. **Gemini synthesis (M2/M3)**: знаменатель и legitimacy из bold-маркеров парсятся правильно;
   subprocess body-score путь отдаёт верные скоры.

## §2 — Регрессии (не трогать)
Всё из v1.255.0: vi как 19-я локаль (switcher ×19, locale-sweep ×19, cvstart /vi/ 200), cold-load
bundle (90 script tags / 87 bundlable — drift-гейт обновлён), snapshot-safety R-12, 11 LLM-инвариантов,
SPA must-fixes, Paylocity, IPv6-SSRF + ReDoS, pipeline skip contract, wiki-banner gate.

## §3 — ta/ja (известное)
`report not in ta|ja` — warnings-колонка, не регресс. ta-зацикливание — следить (§3 v1.252.1).

## §4 — Sign-off
- [ ] §0 зелёный · [ ] §1.5 фикс-раунды · [ ] §2 регрессии (вкл. vi ×19 и bundle) ·
- [ ] прод `1.255.1` / parent `1.38.0` · smoke 15/15
