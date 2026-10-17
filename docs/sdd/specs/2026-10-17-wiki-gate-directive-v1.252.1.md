# Spec — v1.252.1: wiki-banner gate + locale-directive override

**Дата:** 2026-10-17 · **Источник:** FIX-PROMPT v1.252.1 (регресс v1.252.0, qa/v1.252.0/regression-verdict.md)

## Проблема 1 (§1, обязательно)
Свип wiki при v1.252.0 менял бейджи и ссылки, но НЕ строку баннера
«Current release:» в Home ×18 — осталась v1.251.0 / 5245. Регресс поймал
это только вручную (bd2f7b3 баннеры не тронул).

## Решение 1
1. Баннеры ×18 → текущая версия + ЖИВЫЕ счётчики реестра: 105 scanner
   adapters (ALL_ADAPTERS.length; протухшие «109»), 39 route modules
   (server/lib/routes), 18 locales, 5262 unit tests (живой test:ci).
2. Гейт `scripts/wiki-banner-check.mjs`: баннер vs package.json + реестр.
   Regex языко-независим по ФОРМЕ (метка/слова переведены в локалях:
   «Текущий релиз», «Aktuel udgivelse», «адаптеров сканера» — и их числа
   уехали дальше EN: 5177). `--tests N`, `--check-only`, exit 1 при расхождении.
3. Офлайн-контракт: `tests/wiki-banner-check.test.mjs` (EN/RU/DA формы;
   протухшие версия/счётчики; пустой клон).
4. Проверка: `grep -L "v1.252.1" Home*.md` → пусто.

## Проблема 2 (§2, рекомендация)
`buildLocaleDirective` = «Respond in <locale>», а правило 6 родителя (1.37.0)
велит писать в `language.output` из профиля — модели разрешали конфликт
непоследовательно (разброс языковой колонки v1.252.0).

## Решение 2
Фраза в директиве: «This UI locale overrides the profile's language.output
setting and the job posting's own language.» Тест на ТЕКСТ ×17 не-EN +
пустой EN. Родитель — read-only.

## Наблюдение (§3)
ta evaluate, первый живой прогон v1.252.0: 48 336 символов, нет Block G,
нет SCORE_SUMMARY — похоже на зацикливание (ФОРМА, не язык; CAR-70 — язык).
Записано в QA-промпт §3; повторится — отдельная Linear-задача.

## Инварианты
- Поведенческих изменений SPA нет: новый скрипт + фраза в директиве + тесты.
- Wiki пушится при деплое (баннер == released package.json, гейт зеленеет).

## Проверка
- test:ci 5262/0, evals 12/0, link-check, wiki-banner-check OK.
- remote-qa live ×18: A–G 18/18, язык 17/18 (ta §3).
