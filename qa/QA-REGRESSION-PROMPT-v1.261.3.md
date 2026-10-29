> База: v1.261.2 → v1.261.3. Тесты: **6734** (6728 pass / 6 opt-in skip / 0 fail — счёт после мержа main: Trakstar + host-pool + P3 тест-хвосты).
> Финальный счёт релиза: **6734 / 6728 pass / 6 opt-in skip / 0 fail**.

# QA Regression Prompt — v1.261.3

§0 Ворота: `npm run test:ci` exit 0 (после фан-аута) · `node scripts/check-changelog-parity.mjs` exit 0 · `npm run test:e2e:browser` 176 pass / 1 opt-in skip.

§1 Чек-лист проверяемого (в порядке риска):
1. **Скан host-pool**: скан проходит, снапшот `data/last-scan.json` в порядке portals.yml; никакого дублирования/потерь строк.
2. **Провайдер-локации ×5**: workday `Fully Remote` → ` · Remote` суффикс; workable telecommuting переносится; successfactors без trailing comma; lever remote word-boundary; icims `Location`-лейблы.
3. **Trakstar Hire** (registry 122): доска `client.hire.trakstar.com` отдаёт вакансии.
4. **Дизайн v3 фаза 3**: строки таблиц ≈32px, кнопки 30px, чипы 24px; ни одного кораллового rgba в chrome; `.tab-btn.is-active` — акцентная пара; `--ease-out` на анимациях.
5. **Map**: метка «related» ≥4.5:1 в light (тёмный 4.98 не менялся); нет обрезок.
6. **CV Studio**: Undo (кнопка + Cmd/Ctrl+Z на RU-раскладке — Cmd+Я) возвращает предыдущий результат; уход с несохранённым спрашивает confirm; decline возвращает работу.
7. **Палитра**: primary-кнопки синие, danger красный, skip-link ring синий.
8. **Site**: `stats.note`/`changelog.lead` подставляют 122/19 из facts; `faq.a8` содержит Vietnamese.

§2 Регресс-классы: R-01…R-12 (см. TRACEABILITY) — прогон стандартный.

§3 Осознанно не сделано: density для `.tab-btn` (44px контракт отдельный); logo-PNG остался коралловым (решение владельца); upstream #6154 (years-of-experience) и #6170 (CSV import) — в Linear (CAR-180/181).
