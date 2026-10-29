> База: v1.262.0 → v1.262.1. Тесты: **6841** (6838 pass / 0 fail — патч: it → token-dense).
> Финальный счёт релиза: **6841 / 6838 pass / 0 fail**.

# QA Regression Prompt — v1.262.1

§0 Ворота: `npm run test:ci` exit 0 · `node scripts/check-changelog-parity.mjs` exit 0 · `npm run test:e2e:browser` 176 pass / 1 opt-in skip.

§1 Чек-лист (в порядке риска):
1. **it → token-dense**: `/api/evaluate` с lang=it запрашивает max_tokens=32768 и таймаут 480s (remote-QA 40928864980: it обрезался на tok ~15635 перед SCORE_SUMMARY); auto-pipeline — тот же evalMaxTokens (единый источник llm.mjs).
2. **en flake-контроль**: en-отчёт полный (remote-QA: был одиночный ответ без блоков A–G — 21091 ch; повторный точечный прогон — ✓; признан флейком генерации).
3. **Провайдер прод**: LLM_PROVIDER=openrouter (mode=provider; кредиты пополнены владельцем); откат — mode=provider -f provider=hermes.
4. **Регресс v1.262.0**: Deel/CSV-import/posting-guard/voice-check/years_min/liveness ×7/reposts/MiniMax — не сломаны.

§2 Регресс-классы: R-01…R-12 (см. TRACEABILITY).

§3 Осознанно не сделано: en не добавлен в token-dense (одиночный флейк, второй прогон ✓); ta reinforced-директива не расширяется на it (дрейфа языка у it нет); запись нового демо-видео UI v2 — CAR-141, владелец.
