# Spec — v1.253.0: 10 новых источников + role-matcher #5688 (CAR-86/87)

**Дата:** 2026-10-24 · **База:** fork 4a1537bc (upstream cf72768a, 278 коммитов, родитель 1.38.0)

## Scope
- 10 источников: sources/<slug>.mjs + portals/adapters/<slug>.mjs + CI-изолированные сьюты.
- Гейты счётчиков перегенерированы из живого реестра (120/115/5): adapter-registry,
  scan-sources-endpoint, scan-fallback-sources (FALLBACK_SOURCES), site-sources
  (SOURCE_URLS +10), help-source-counts (§17 ×18, вкл. ko/ja breakdown-форматы).
- role-matcher #5688 (short capitalised code): verbatim-семантика, Unicode-дивергенция
  web-ui не тронута (extractShortAcronyms читает raw title).
- CONTEXT.md counts → 120/115.

## Ревью
Opus 5-5 (макс. модель) по диффу первых 8 портов: 21 находка — 13 исправлено
(988d3e65): silent-empty throws, abort-семантика, XSS decode-порядок, allowlists,
ports, test-honesty. [spec]-хвост — CAR-95.

## Coverage
6 файлов подняты до ≥95% branch (27 кейсов, d15c1545); защитный dead-code
задокументирован (недостижим через тесты).

## Verification
- test:ci 5504/0 · coverage gate ✓ · browser ✓ · evals 14/0.
- Живой скан нового источника — на проде после деплоя (§1 QA-промпта).
