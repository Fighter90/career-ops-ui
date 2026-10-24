# Spec — v1.254.0: hardening round (CAR-91…94 + Paylocity + Opus fix-round)

**Дата:** 2026-10-24 · **Источник:** ревью Opus 5-5 (5 поверхностей, ~950k токенов) → CAR-90…95

## Scope
- CAR-91: R-12 — пустой скан хранит снапшот; failed-источники переносятся через текущие фильтры (EN по _entry, RU по source).
- CAR-92: 11 LLM-инвариантов (язык deep/mode, Gemini-subprocess, spend tier, disconnect-abort, валидация).
- CAR-93/94: 23 SPA must-fix (sourcing + assist views).
- Paylocity: sources + adapter + 25 тестов; registry 121 = 116 EN + 5 RU · 116 adapters.
- Opus fix-round на самих фиксированиях: 8 must-fix (мультибуквенный резак, терминаторы, gemini abort, carry-over атрибуция, фильтры переносимых строк, reference-level).

## Verification
- test:ci 5634/0 (+372) · browser 142/0 · coverage gate ✓ · evals ✓ · link-check ✓.
