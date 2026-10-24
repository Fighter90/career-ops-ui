# QA regression — v1.253.1 (security patch: IPv6-SSRF + ReDoS, CAR-90)

> База: v1.253.0 → v1.253.1. Тесты: **5511** (+7: IPv6-гард ×4, ReDoS ×3).

## §0 — Ворота
```bash
npm run test:ci                 # 5511 pass, exit 0
npm run test:coverage:gate
npm run test:e2e:browser
node evals/workflow/run.mjs
```

## §1 — Безопасность (главное)
1. IPv6-литералы: `[::1]`, `[::ffff:169.254.169.254]`, `[fd00:ec2::254]` — БЛОКИРУЮТСЯ транспортом сканера (тесты http-json-dns-guard ×4). Публичный литерал проходит без DNS.
2. ReDoS: `<` + 100k пробелов в stripDangerousMarkdown — ~1 мс (было ~16 с), семантика экранирования не сужена (cv-xss-bypasses 17/17).
3. Живой скан одного источника на проде — строки приходят (транспорт не сломан фикс-ом).

## §2 — Регрессии (не трогать)
Всё из §3–§4 v1.253.0: спец-фильтр карты, 10 новых источников в dropdown,
role-matcher, remote-qa shape≠language, pipeline skip contract.

## §3 — ta/ja (известное)
`report not in ta|ja` — warnings-колонка, не регресс. ta-зацикливание — следить (§3 v1.252.1).

## §4 — Sign-off
- [ ] §0 зелёный · [ ] §1 IPv6/ReDoS · [ ] §2 регрессии ·
- [ ] прод `1.253.1` / parent `1.38.0` · smoke 15/15
