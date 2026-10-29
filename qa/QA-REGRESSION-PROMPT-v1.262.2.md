> База: v1.262.1 → v1.262.2. Тесты: **6867** (6864 pass / 0 fail / 3 skip — патч: review-tail, +26 тестов).
> Финальный счёт релиза: **6867 / 6864 pass / 0 fail**.

# QA Regression Prompt — v1.262.2

§0 Ворота: `npm run test:ci` exit 0 · `node scripts/check-changelog-parity.mjs` exit 0 · `npm run test:e2e:browser` 176 pass / 1 opt-in skip · coverage ratchet 98.42 % line / 89.94 % branch (пол 98/89) · `node evals/workflow/run.mjs` зелёный (site-build-after-fanout — после фан-аута и `site && npm run build`).

§1 Чек-лист (в порядке риска):
1. **Deploy-guard F1–F6**: mode=provider с `provider`-значением вне `^[A-Za-z0-9_-]+$` падает ДО ssh-сплайса; hermes-шаг маскирует значения (`s/(=[^ ]{4})[^ ]*/\1…/g`, case-insensitive фильтр KEY/token/secret) на всех трёх стоках; `?token=` в HERMES_BASE_URL маскируется; APP_DIR уважается в hermes; public check требует https. Гейт: `node --test tests/ci-workflows.test.mjs` (17 тестов).
2. **CSV-import round-trip**: ячейка с `\` (C:\Users) пишется и читается обратно без удвоения; повторный импорт того же CSV дедуплицируется (не создаёт дубль) — `tests/parsers.test.mjs` + `tests/tracker-import-csv.test.mjs`.
3. **Import-modal хвост (SPA)**: навигация закрывает модалку (тот же nav-guard, что outcome-модалка); отмена файлового диалога не оставляет orphan-input; превью читает `(plan.duplicates || []).length` — `tests/tracker-import-client-guard.test.mjs` (6 тестов).
4. **Производительность скана**: `statedYearsMin` не считается, когда `years_min` не задан (`tests/en-scanner-years-lazy.test.mjs`); cv-voice head-strip линеен (4827→13 ms на 64KB).
5. **Регресс v1.262.0–1**: it/ta/hi token-dense (32768/480s), mode=hermes/mode=provider, Deel/CSV-import/posting-guard/voice-check/years_min/liveness ×7/reposts/MiniMax — не сломаны.
6. **Провайдер прод**: LLM_PROVIDER=openrouter; полный remote-QA 18/19 A–G ✓ (pl — одиночный 502/300s/0ch таймаут провайдера, не token-dense кейс; точечный перезапуск pl прикладывается к релизу).

§2 Регресс-классы: R-01…R-12 (см. TRACEABILITY).

§3 Осознанно не сделано: cv-studio нативный `window.confirm` (эра CAR-179) остаётся — перевод на `UI.confirm` отдельный follow-up; `<mark title>` остаётся tooltip-only (приемлемый a11y-пол); `remote-qa.yml` сохраняет `cancel-in-progress: true` (повторный dispatch сознательно отменяет идущий регресс); запись нового демо-видео UI v2 — CAR-141, владелец.
