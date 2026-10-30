> База: v1.262.3 → v1.262.4. Тесты: **6869** (+1). Одна цель: ja → token-dense.
> Финальный счёт релиза: **6869 / 6866 pass / 0 fail / 3 skip**.

# QA Regression Prompt — v1.262.4

§0 Ворота: `npm run test:ci` exit 0 · changelog parity ×19 · browser 176 pass / 1 opt-in skip · evals зелёные в CI.

§1 Чек-лист:
1. **ja → token-dense**: `/api/evaluate` с lang=ja → max_tokens=32768 + таймаут 480s (red-first пин в evaluate-truncation). Доказательство на проде: remote-QA locales=ja после деплоя — зелёный, A–G ✓ (до фикса: 502/300s/0ch дважды — 40981578549 и 41012725839).
2. **Регресс token-dense**: ta/hi/it/pl/ja — все (32768/480s); остальные 14 локалей — 16384/300s.
3. **Регресс v1.262.2–3**: 7 L-фиксов, deploy F1–F6, import-modal хвост, pl — не сломаны.

§2 Регресс-классы: R-01…R-12 (см. TRACEABILITY).

§3 Осознанно не сделано: ar/ko/zh-CN НЕ переведены в token-dense — их ночные 502 были транзиентом загрузки провайдера (точечный перезапуск 41012725839: 250/291/259 s ✓); ru-дрейф — одиночный флейк генерации (не повторился); запись демо-видео UI v2 — CAR-141, владелец.
