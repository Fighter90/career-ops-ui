# PROGRESS.md — working state

State and direction of in-flight work. Git shows what changed; this file says where
the work stands, what was already tried and rejected, and what to do next. Read it at
session start; update it after each meaningful step, in the same commit.

Release history belongs in [CHANGELOG.md](CHANGELOG.md), decisions in
[docs/adr/](docs/adr/), vocabulary in [CONTEXT.md](CONTEXT.md). Anything already
recoverable from those does **not** belong here.

_Last updated: 2026-10-27 (вечер) · **v1.261.0 IN FLIGHT — волна собрана в main** (36 коммитов после v1.260.0). Сели: #518–#524 (R4-тесты, FULL-R1, M2, M3, M4, M5, CAR-147), #525 (safe-fetch crash), #526 (FULL-M1), #527 (R3 токены), #528/#529 (docs+спеки), #530 (CAR-148/149 A–G), #531 (M6 сервер), #532 (CAR-133 лендинг v2), #533 (CAR-135 help EN), #534 (язык-свитч скан-фикс — владельческий баг), #535 (4 спеки SDD/OpenSpec), #536 (M6 клиент), #537 (CAR-150 undo comp), #538 (R4 скелетоны; squash-заголовок косметически испорчен — контент верный), #539 (M1 хэндоффы). **Тесты ~6450+/0.** Ждут GLM-квоты (до 04:45): help ×18 fan-out (18 веток fix/help-* созданы, агенты переигрываются тройками), CHANGELOG ×18, ревью-долг #534/#538 (ред-first доказательства полные). Затем: релизный поезд v1.261.0 → деплой → полный регресс → Linear Done. Оператору: dismiss CodeQL js/missing-rate-limiting алертов на main (нужен security_events токен)._

