> База: v1.262.2 → v1.262.3. Тесты: **6868** (одна цель — pl → token-dense).
> Финальный счёт релиза: **6868 / 6865 pass / 0 fail / 3 skip**.

# QA Regression Prompt — v1.262.3

§0 Ворота: `npm run test:ci` exit 0 · changelog parity ×19 · browser 176 pass / 1 opt-in skip · `node evals/workflow/run.mjs` зелёный в CI (site-грейдер SKIP без сгенерированных зеркал).

§1 Чек-лист:
1. **pl → token-dense**: `/api/evaluate` с lang=pl запрашивает max_tokens=32768 и таймаут 480s (red-first пин в evaluate-truncation: evalMaxTokens('pl')=32768, evalTimeoutMs('pl')=480_000). Доказательство на проде: remote-QA locales=pl после деплоя — зелёный, A–G ✓ (до фикса: 502 · 300s · 0ch дважды — 40960568766 и 40968958062).
2. **Регресс token-dense**: ta/hi/it остаются (32768/480s), en остаётся 16384/300s.
3. **Регресс v1.262.2**: 7 L-фиксов, deploy F1–F6, import-modal хвост — не сломаны.

§2 Регресс-классы: R-01…R-12 (см. TRACEABILITY).

§3 Осознанно не сделано: одноцелевой патч — больше ничего не везёт; запись демо-видео UI v2 — CAR-141, владелец.
