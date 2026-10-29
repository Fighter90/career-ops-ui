> База: v1.261.3 → v1.262.0. Тесты: **<COUNT>** (<PASS> pass / 6 opt-in skip / 0 fail — волна 10 фичевых веток поверх v1.261.3).
> Финальный счёт релиза: **<COUNT> / <PASS> pass / 6 opt-in skip / 0 fail**.

# QA Regression Prompt — v1.262.0

§0 Ворота: `npm run test:ci` exit 0 (после фан-аута) · `node scripts/check-changelog-parity.mjs` exit 0 · `npm run test:e2e:browser` 176 pass / 1 opt-in skip.

§1 Чек-лист проверяемого (в порядке риска):
1. **Deel источник** (registry 123 = 118 EN + 5 RU · 118 adapters): `#/scan` дропдаун содержит Deel; `help` §17 во всех локалях называет 123/118; `https://jobs.deel.com/<slug>` отдаёт борд одним запросом; тенант вне Deel отвечает отказом по имени (redirect).
2. **Tracker CSV import**: `#/tracker` → Import CSV → preview (company/role/status/date + причины) → commit; дедуп по URL; неизвестный статус → Evaluated + note; >512KB → 413.
3. **Posting guard** (`#/reports/:slug`): кнопка «Posting guard» → fail-soft `{available:false, reason:"script-not-found"}` (форк пока без posting-guard.mjs — см. §3); с скриптом — findings-карточка.
4. **CV voice check** (`#/cv-studio`): карточка подсвечивает штампы (`passionate about`, `leveraged`…); `2022–2024` НЕ подсвечен; `20–30%` подсвечен; Tailor = 6 инвариантов.
5. **years_min фильтр**: portals `years_min: N` → `skipped_experience` в scan-history (observational, URL не пинится); без цифры в JD — вакансия проходит.
6. **liveness Apply ×7**: VN `Nộp đơn ứng tuyển`, BG `Кандидатствай`/`Външно кандидатстване`, NL `Solliciteer`, ES `¡Apúntame!`/`Postularse`, ZH `申请职位`/`投递` → `active`; негативы («¿Puedo aplicar…», «писмо за кандидатстване»-хвост, «投递记录») → не Apply.
7. **Reposts same-source**: роль на linkedin + greenhouse ОДНОЙ компании = не репост; `de.`≡`www.` linkedin = репост; greenhouse-алиасы = один источник.
8. **MiniMax**: дефолт `MiniMax-M3.1-Flash` (io) / `MiniMax-M3` (cn); не-vendor BASE_URL отказывается; hint ×19 называет новые дефолты.
9. **ta evaluate**: reinforced-директива в хвосте промпта (после JD, перед reminder); отчёт на тамильском (remote-QA).
10. **Регресс v1.261.3**: host-pool скан, дизайн v3 плотность, map 4.68:1, CV Studio undo, палитра blue/danger — не сломаны.

§2 Регресс-классы: R-01…R-12 (см. TRACEABILITY) — прогон стандартный.

§3 Осознанно не сделано: posting-guard.mjs в форке (upstream #6146 открыт — релей fail-soft); `yearsMin` UI-чип (поле в снапшоте, фильтр только через portals); upstream Machine Summary modes/reports (#6161/#6160/#6157 — приходят с деплоем родителя); компенсации в Deel (нет pay interval — не гадаем).
