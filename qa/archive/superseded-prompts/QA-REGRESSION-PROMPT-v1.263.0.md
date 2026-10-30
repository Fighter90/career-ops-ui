> База: v1.262.4 → v1.263.0. Тесты: **6905** (+36). Финальный счёт релиза: **6905 / 6902 pass / 0 fail / 3 skip**.

# QA Regression Prompt — v1.263.0

§0 Ворота: `npm run test:ci` exit 0 · changelog parity ×19 · browser 176 pass / 1 opt-in skip · evals зелёные в CI · `tests/ux-motion.test.mjs` + `tests/car210-visual-sweep.test.mjs` + `tests/ux-owner-batch.test.mjs` + `tests/a11y-form-wires.test.mjs` (class-wide naming gate) зелёные.

§1 Чек-лист (в порядке риска):
1. **Акцент crimson (hue 15)**: кнопки/фокусы/чипы красные в light И dark; danger (hue 25) различим (btn-danger treatment не тронут); контраст-гейт зелёный. Пузырь чата docs-assistant читается (accent-ink).
2. **Motion**: reduced-motion — без движения (opacity остаётся); hover:hover — на таче нет залипших лифтов; модалки/поповеры/тосты анимируются 130–240 ms; route-enter только при смене маршрута (не при re-render).
3. **#/scan**: шапка таблицы под topbar при скролле страницы; поповер «Зарплата» — поля ~40px; кнопки плотности нет.
4. **Мобильный drawer (390)**: ✕ закрывает; открытие сверху списка; без HUD нет фантомного fade; пилюля «Профинансированные компании» переносится, не обрезается.
5. **docs-assistant**: ответ с длинным URL не создаёт горизонтальный скролл (390/1024/1440).
6. **A11y**: у всех input/textarea есть имя (class-wide gate); readonly-дампы named; Career-plan Save ре-армится после упавшего GET; evaluate-prefill не жжёт LLM; auto Enter с IME безопасен.
7. **Свип**: tracker empty state full-width; scan-консоль ellipsis; FAB 44px не перекрывает; stats «?» с divider; career-plan Input-таб с заметкой; help §1 без литеральных **.
8. **Регресс v1.262.x**: token-dense ta/hi/it/pl/ja (32768/480s), deploy F1–F6, CSV round-trip, import-modal — не сломаны.

§2 Регресс-классы: R-01…R-12 (см. TRACEABILITY).

§3 Осознанно не сделано: skeleton sweep (car112 контракт дословно); theme-icon crossfade (playwright-контракт); .btn:active не задублирован; stagger — инфраструктура (дашборд примет позже); help ×19 prose — следующим фан-аутом; запись демо-видео — CAR-141, владелец.
