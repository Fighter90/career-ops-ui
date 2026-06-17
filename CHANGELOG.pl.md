# Dziennik zmian

Wszystkie istotne zmiany w **career-ops-ui**. Format wg [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), wersjonowanie [SemVer](https://semver.org/).

Tłumaczenia: [English](CHANGELOG.md) · [Español](CHANGELOG.es.md) · [Português](CHANGELOG.pt-BR.md) · [한국어](CHANGELOG.ko-KR.md) · [日本語](CHANGELOG.ja.md) · [Русский](CHANGELOG.ru.md) · [简体中文](CHANGELOG.zh-CN.md) · [繁體中文](CHANGELOG.zh-TW.md) · [Français](CHANGELOG.fr.md) · [Українська](CHANGELOG.uk.md) · [العربية](CHANGELOG.ar.md)

> **Uwaga dot. tłumaczenia (v1.70.0)** — polski dodano jako jeden z trzech nowych języków interfejsu. Ten plik tłumaczy najnowsze wpisy; pełna historia znajduje się w [angielskim CHANGELOG](CHANGELOG.md), który jest źródłem normatywnym.

---


## [1.71.2] — 2026-06-17

**docs(i18n):** publikuje przegląd spójności dokumentacji. Blok "Translations of this guide" w każdym pliku README zawiera teraz wszystkie 11 języków siostrzanych (wcześniej niektóre pomijały English/Français lub zawierały odsyłacz do samego siebie), a pusta linia przed podziałem sekcji została przywrócona. Pełny monit regresji QA jest przemianowany na bieżącą wersję, a dokumentacja (`CLAUDE.md`, `CONVENTIONS`, `LOCALIZATION`, `PROJECT-CONTEXT`) jest zsynchronizowana z bieżącą wersją i liczbą testów (1103). Brak zmian w kodzie ani działaniu — wyłącznie dokumentacja, więc tłumaczenia pomocy/UI i wszystkie funkcje z wersji 1.70.0–1.71.1 pozostają bez zmian.

---



## [1.71.1] — 2026-06-17

**fix(i18n): wbudowany przewodnik pomocy jest teraz w pełni przetłumaczony na wszystkie 12 języków.** Dodano `docs/help/{pl,uk,ar}.md` (każdy zawiera zwalidowaną strukturę 19 H2 / 75 H3), dzięki czemu `#/help` serwuje natywny pakiet w języku polskim, ukraińskim i arabskim zamiast przełączać się na angielski — `GET /api/help/{pl,uk,ar}` zwracają teraz własne ustawienia regionalne. Podłączono do wszystkich bramek pomocy (`help-ui`, `help.test`, `help-ru-config-section`, `canonical-docs-coverage`). Uzupełniono również wszystkie listy tłumaczeń w 12 językach: blok «Translations of this guide» w README (9 plików README), nagłówki «Translations:» w zlokalizowanych plikach CHANGELOG (8 plików) oraz zaktualizowano nieaktualne liczniki dokumentacji. Suite 1100 → 1103.

---



## [1.71.0] — 2026-06-16

**feat(cover): generuj PDF listu motywacyjnego bezpośrednio z `#/cover`.** Tryb cover (dodany w v1.70.0) tworzy treść listu; wynik oferuje teraz przycisk **Generate PDF**, który renderuje go przez współdzielony potok markdown→PDF inline (`POST /api/stream/pdf/inline` → `generate-pdf.mjs`) — tę samą ścieżkę, której używa interview-prep. Możesz teraz napisać list i wygenerować PDF bez opuszczania SPA.

**test/docs: wzmocnienie przeglądu v1.70.0.** Dodano pokrycie CI-izolowane dla trybu cover (lista dozwolonych + składanie promptu), przełącznika `<select>` flag + arabskiego RTL (`dirFor`/`<html dir>`), `top.langLabel` w każdej lokalizacji, okablowania PDF listu motywacyjnego oraz dyrektywy lokalizacji `prompts.mjs` + szkieletowania dla fr/pl/uk/ar. Zaktualizowano przestarzałe odniesienia „wszystkie 8” → 12 lokalizacji w `docs/sdd/CONVENTIONS.md` i pełnym promptcie regresji QA projektu.

---




## [1.70.0] — 2026-06-16

**feat(i18n): trzy nowe języki interfejsu — polski (pl), ukraiński (uk) i arabski (ar, z pełną obsługą RTL) — rozszerzają SPA do 12 lokalizacji, odpowiadając wszystkim językom z README projektu nadrzędnego career-ops.** Każda nowa lokalizacja jest dostarczana z kompletnym słownikiem 697 kluczy (`public/js/lib/locales/i18n-dict.{pl,uk,ar}.js`), walidowanym przez istniejące zestawy testów parytetu / pokrycia / braku wycieków łacińskich / braku danych osobowych. Arabski dodaje prawdziwe wsparcie pisma od prawej do lewej: `i18n.js` ustawia `<html dir="rtl">` dla lokalizacji RTL, a blok `[dir="rtl"]` w `app.css` odzwierciedla chrome (panel boczny, szuflada powiadomień, tabele i cytaty markdown, odstępy inline) — lokalizacje LTR pozostają bez zmian co do bajtu. Nowy klucz `top.langLabel` (×12) nazwie selektor dla czytników ekranowych.

**feat(ui): selektor języka `<select>` z ikonami flag zastępuje zawijający się rząd przycisków.** Przy 12 lokalizacjach stary rząd `.lang-btn` zawijał się do trzech linii w panelu bocznym; natywny `<select>` (każda opcja poprzedzona emoji flagi) skaluje się przejrzyście, jest domyślnie przyjazny dla klawiatury i czytników ekranowych oraz bezpieczny dla CSP (obsługa zmiany przez `addEventListener`, bez inline JS). Flagi degradują się do liter regionu, gdy platforma nie obsługuje ich glifów, więc etykieta języka jest zawsze podstawowym identyfikatorem.

**feat(cover): przeniesienie trybu listu motywacyjnego z projektu nadrzędnego (career-ops v1.10.0 + powitanie z v1.11.0) do SPA.** Nowa strona `#/cover` w grupie nawigacji Aplikacje, zbudowana na ogólnym uruchamiaczu trybów: opis stanowiska + firma/rola + opcjonalne powitanie → spersonalizowany list wygenerowany z `cv.md` / `modes/_profile.md`. Dodano `cover` do serwerowego `MODE_ALLOWLIST` oraz blok i18n `cover.*` (×12 lokalizacji).

**chore(compat): śledzenie projektu nadrzędnego career-ops v1.11.0.** Zweryfikowano, że kontrakt odczytu/zapisu jest nienaruszony — `data/applications.md` pozostaje źródłem prawdy w formacie markdown (indeks trackera SQLite z v1.11.0 jest pochodną pamięcią podręczną), kolumny trackera nadal są mapowane przez nagłówek. `parentVersion` raportuje teraz 1.11.0.

**fix(i18n): usunięcie ukrytej luki, gdzie język francuski (dodany w v1.61.0) był nieobecny w `LOCALE_NAMES` i `SCAFFOLD_STRINGS` w `server/lib/prompts.mjs`** — wywołania LLM po francusku cicho powracały do anglojęzycznych danych wyjściowych i rusztowania. fr/pl/uk/ar są teraz wszystkie podłączone do ścieżki lokalizacji promptów.

> Znane dalsze działania: wbudowany przewodnik pomocy (`docs/help/`) przełącza się na angielski dla pl/uk/ar (sam chrome interfejsu jest w pełni zlokalizowany); interaktywne wprowadzenie do rozmów kwalifikacyjnych projektu nadrzędnego, odwrócone wykrywanie ATS i nowsze dostawcy skanowania nie są jeszcze dostępne w SPA.
