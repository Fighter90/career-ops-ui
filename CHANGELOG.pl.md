# Dziennik zmian

Wszystkie istotne zmiany w **career-ops-ui**. Format wg [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), wersjonowanie [SemVer](https://semver.org/).

Tłumaczenia: [English](CHANGELOG.md) · [Español](CHANGELOG.es.md) · [Português](CHANGELOG.pt-BR.md) · [한국어](CHANGELOG.ko-KR.md) · [日本語](CHANGELOG.ja.md) · [Русский](CHANGELOG.ru.md) · [简体中文](CHANGELOG.zh-CN.md) · [繁體中文](CHANGELOG.zh-TW.md) · [Français](CHANGELOG.fr.md) · [Українська](CHANGELOG.uk.md) · [Dansk](CHANGELOG.da.md) · [العربية](CHANGELOG.ar.md)

> **Uwaga dot. tłumaczenia (v1.70.0)** — polski dodano jako jeden z trzech nowych języków interfejsu. Ten plik tłumaczy najnowsze wpisy; pełna historia znajduje się w [angielskim CHANGELOG](CHANGELOG.md), który jest źródłem normatywnym.

---


## [1.78.2] — 2026-06-27

**Wzmocnienie i18n i UX (poprawki po v1.78.1).** Dostępna nazwa logo jest teraz zlokalizowana we wszystkich 13 językach (`nav.logoHome`). **Enter** w wyszukiwarce globalnej, gdy jesteś już na `#/scan`, wymusza ponowne renderowanie, aby nie utracić wpisanego terminu (guard tej samej trasy). `health.title` jest teraz przetłumaczony na polski (`Kondycja`) i duński (`Systemtilstand`) — wcześniej po angielsku. Testy 1235 → 1238.

## [1.78.1] — 2026-06-27

**Poprawki UX na Scan.** Tabela wyników `#/scan` odświeża się teraz automatycznie podczas skanowania i jeszcze raz po jego zakończeniu — bez przeładowania. Globalne wyszukiwanie w pasku górnym pokazuje podpowiedź **Enter** i przy zapytaniu nie-URL przechodzi do `#/scan` z wypełnionym polem (wcześniej `#/tracker`). Logo prowadzi teraz do pulpitu (strona główna).

## [1.78.0] — 2026-06-27

**Filtr geograficzny na stronie Scan — filtruj wyniki według kraju, z flagami.** Nowa lista **Kraj** w `#/scan` pokazuje każdy kraj wykryty w wynikach (emoji flagi + licznik), aby zostawić tylko role związane z danym krajem — obok filtra Remote/Hybrid/Onsite, więc można szukać pracy związanej z krajem i zdalnej. Oparte na nowym helperze `countries.js`, który mapuje lokalizację z wolnego tekstu (nazwy krajów, aliasy i ~100 głównych miast) na kraj ISO + flagę; detekcja jest konserwatywna i nigdy nie zgaduje.

## [1.77.0] — 2026-06-27

**Dodano duński (Dansk) jako 13. język interfejsu.** Pełne tłumaczenie UI, wbudowanego przewodnika Help (19 H2 / 75 H3), README i CHANGELOG. Duński dołącza do przełącznika języków z flagami; mechanika i18n (asembler, audyt, bramki parytetu, snapshot) obejmuje teraz 13 lokalizacji.

## [1.76.0] — 2026-06-26

**Zgodność z career-ops v1.13.0 — sześć nowych źródeł, wzmocnienie skanera i tabela wyników bez limitu.**

### Dodano
- **Sześć źródeł ATS per-tenant** — BambooHR, Breezy HR, Comeet, Personio, Recruitee, SolidJobs. Wykrywane z hosta `careers_url` (Comeet wymaga pełnego `api:`); każdy host przypięty kotwiczonym regexem + `redirect:'error'` (anty-SSRF). Wybieralne w liście **Source** na `#/scan` — rejestr ma teraz **25 adapterów** (20 EN + 5 RU). Dodaje helper `fetchText` dla feedu XML Personio.
- **`trust_filter`** — opcjonalna ocena zaufania (0–100, poziom high/medium/low, flagi), tylko adnotacja. Wiersze poniżej `high` dostają neutralną odznakę ⚠ w `#/scan`; nic nie jest odrzucane.
- **Arbeitsagentur `remoteMatch` + `remoteMaxPages`** — wykrywanie pracy zdalnej z konfiguracji: `title`, `filter` (`homeoffice=nv_true` po stronie serwera + paginacja) lub `off`.

### Zmieniono
- **Brak limitu wyników.** Usunięto `MAX_STORED_RESULTS` (2000) — wszystkie dopasowania są zapisywane, a tabela `#/scan` je stronicuje (200/str.).
- **Odporność filtra tytułu** — krótkie akronimy (COO, SDR…) dopasowują się po granicach słów; błędny `title_filter` nie wywala już skanu. Oba skanery.

### Testy
- +32 przypadki (1190 → **1222**): `sources-ats-providers`, `title-filter`, `arbeitsagentur-remote`, `trust-validator` i przepisany strażnik `scan-result-cap` („bez limitu”).

## [1.75.2] — 2026-06-19

**docs: pełna parytetowa dokumentacja dla agregatorów skanera z v1.75.0 we wszystkich 12 lokalizacjach.** Bez zmiany kodu — dostraja dokumentację dla użytkownika do siedmiu źródeł, które pojawiły się w v1.75.0:

- **Przewodnik pomocy (12 lokalizacji).** §5 zyskuje blok `content_filter` (bramkowanie po słowach kluczowych opisu/fragmentu, odpowiednik `location_filter`) oraz notkę o agregatorach; §7 wymienia siedem nowych źródeł w przebiegu skanowania jednym kliknięciem oraz w pełnym wyliczeniu listy rozwijanej **Source**; liczba adapterów w §17 zostaje skorygowana z przestarzałego „11 adapters” na „19 adapters — 14 English + 5 Russian”. Nie dodano żadnego nagłówka `##`/`###`, więc zablokowana struktura 19 H2 / 75 H3 pozostaje niezmieniona.
- **README (9 pełnych lokalizacji).** Nowy punkt „Aggregator boards (v1.75.0)” pod źródłami skanowania oraz odznaka wydania podniesiona do v1.75.2. (Skrócone README pl/uk/ar nie mają listy per źródło i są tam celowo nietknięte.)
- **Dokumentacja referencyjna.** `docs/portals-examples.md` zyskuje gotową do skopiowania sekcję „Aggregator boards” z dokładnymi blokami konfiguracji `provider:` / `<provider>:` dla wszystkich siedmiu; `docs/PROJECT.md` zaktualizowano do **19 adapters**; `docs/sdd/CONVENTIONS.md` dokumentuje rozróżnienie dwóch rejestrów (`sources/registry.mjs` dla listy rozwijanej kontra `portals/registry.mjs` dla pobierania), wybór agregatora oparty na `provider:` przekazywany jako `opts.company`, sanityzator zapisu skanowania (`scan-sanitize.mjs`) oraz liczbę testów z v1.75.1 (1190).
- **QA.** Dodano `qa/QA-REGRESSION-PROMPT-v1.75.2-FULL.md` — pełnopowierzchniowy sterownik bramki wydania, odświeżony pod cykl agregatorów skanowania v1.75.x.

---



## [1.75.1] — 2026-06-19

**fix(scan): dopracowanie odporności źródeł sterowanych konfiguracją z v1.75.0.** Trzy drobne poprawki wzmacniające z przeglądu poreleasowego (bez zmiany zachowania przy poprawnym skanowaniu):

- **Opóźnienia paginacji uwzględniające przerwanie.** Międzystronicowe pauzy grzecznościowe Glints (300 ms) oraz Jobstreet/SEEK (200 ms) są teraz rozwiązywane natychmiast po wyzwoleniu `AbortSignal` skanowania, dzięki nowemu pomocnikowi `delay(ms, signal)` w `server/lib/http-json.mjs`, tak aby rozłączony klient nie mógł utrzymywać paginowanego skanu otwartego przez dodatkową pauzę.
- **Opisowy błąd dla odpowiedzi nie-JSON.** `fetchJson` opakowuje teraz nie-JSON-owe ciało `2xx` (np. stronę konserwacyjną HTML serwowaną ze statusem 200) jako `non-JSON 2xx response from <url>`, zamiast ujawniać goły `SyntaxError`, tak aby dziennik błędów skanera dla danego źródła nazwał nieprawidłowo działający punkt końcowy.
- **Silniejsza normalizacja zapisu skanu.** `normalizeScanScalar` zwija teraz tabulację pionową, wysuw strony oraz uniksowe separatory wiersza/akapitu Unicode (`\v \f U+2028 U+2029`) oprócz `\r \n \t` — to ścisły nadzbiór, więc żaden separator rekordu/wiersza, który arkusz kalkulacyjny lub przeglądarka mogłyby uwzględnić, nie przetrwa do `scan-history.tsv`.

---


## [1.75.0] — 2026-06-19

**feat(scan): przenosi parytet z nadrzędnym career-ops v1.12.0 — siedem nowych źródeł ofert, filtrowanie treści oraz poprawki bezpieczeństwa/jakości.** web-ui uruchamia własne skanery w procesie (nie wywołuje shell out do nadrzędnego `scan.mjs`), więc zmiany dostawców i skanowania z nadrzędnej v1.12.0 nie przenoszą się automatycznie — to wydanie reimplementuje te mające zastosowanie zgodnie z kontraktem adapterów web-ui.

- **Siedem nowych źródeł skanera.** Trzy ogólnoportalowe agregatory pracy zdalnej — **RemoteOK**, **Remotive**, **Working Nomads** — wpasowują się w automatycznie wykrywany wzorzec `server/lib/sources/*.mjs` (wybierane przez `provider: remoteok` / `remotive` / `workingnomads`). Cztery sterowane konfiguracją agregatory regionalne — careers **IBM**, **Arbeitsagentur** (niemiecki Federalny Urząd Pracy), **Glints** (Azja Południowo-Wschodnia), **Jobstreet / SEEK** — odczytują blok konfiguracyjny `<provider>:` na wpis; en-scanner przekazuje teraz rozwiązany wpis firmy aż do każdego fetchera, aby mogły go odczytać. Wszystkie siedem pojawia się automatycznie w rozwijanej liście źródeł `#/scan`.
- **`content_filter` (nadrzędny #974).** Opcjonalny blok `portals.yml` (listy słów kluczowych `positive` / `negative`), który bramkuje ofertę na podstawie tekstu jej opisu/fragmentu — odwzorowuje semantykę `location_filter`; oferty bez opisu zawsze przechodzą. Podłączony do obu skanerów EN i RU.
- **Wzmocnienie zapisu skanowania (nadrzędny #1098).** Metadane zewnętrznych kanałów są teraz oczyszczane, zanim trafią do `data/scan-history.tsv` i `data/pipeline.md`: znaki sterujące są zwijane (znak nowej linii w nazwie firmy/tytule nie może już wstrzyknąć wiersza TSV), a wiodące `= + - @` jest neutralizowane przeciwko wstrzyknięciu formuł arkusza kalkulacyjnego.
- **`secondaryLocations` Ashby (nadrzędny #1073).** Źródło Ashby zwija teraz etykietę regionu każdej lokalizacji dodatkowej wraz z pocztowymi `addressLocality` / `addressCountry` do ciągu lokalizacji (z deduplikacją), więc stanowisko z prawem do pracy w UE, którego główna etykieta brzmi np. „Canada”, wypływa dla `location_filter`.
- **Walidacja kształtu raportu oceny (nadrzędny #819).** Dostawcy w procesie dla `/api/evaluate` (Anthropic / OpenAI / Qwen / OpenRouter / GitHub Models) flagują teraz źle sformowany raport A–G / `SCORE_SUMMARY` jako niekrytyczną tablicę `warnings`; ścieżka oceny Gemini już dziedziczy tę ochronę z nadrzędnego `gemini-eval.mjs`.
- **docs:** Antigravity CLI dodane do list wspieranych asystentów we wszystkich 12 plikach README (mapuje się na dostawcę Gemini).

Odziedziczone za darmo z `git pull` nadrzędnego (web-ui wywołuje je przez shell out): zapasowe czcionki CJK do japońskich PDF (#1053), czcionki PDF bezpieczne dla ATS (#1074), ochrona CJK dla LaTeX (#1054), poprawki tracker/merge/followup/dashboard oraz chińskie tryby `modes/zh` (web-ui wymienia tryby dynamicznie).

---


## [1.74.3] — 2026-06-18

**docs(parent-source): wskazuje nadrzędne repozytorium `career-ops` na fork [`Fighter90/career-ops`](https://github.com/Fighter90/career-ops).** web-ui odwołuje się teraz do forka opiekuna jako projektu nadrzędnego wszędzie tam, gdzie jest to rzeczywiste źródło: domyślna wartość `CAREER_OPS_REPO` w instalatorze `bin/setup.sh`, każdy link `git clone` / „zbudowane na” / onboarding we wszystkich 12 plikach README oraz dokumentacja agentów (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `docs/`). Przypisanie autorstwa santifer (oraz informacja o nieoficjalnym UI) pozostaje bez zmian — przeniesiono jedynie adresy URL źródła/klonowania. `tests/sh-files.test.mjs` weryfikuje teraz, że instalator klonuje fork.

---


## [1.74.2] — 2026-06-17

**fix(health): udostępnienie `GITHUB_MODELS_API_KEY` jako opcjonalnej kontroli na `#/health` oraz w `/api/status/providers`.** Dostawca GitHub Models z v1.74.0 był konfigurowalny w `#/config`, ale nie miał wiersza na stronie Health i brakowało go w powierzchni dostawców `keysConfigured`. Dodano opcjonalną kontrolę (z takim samym sformułowaniem "set / unset (manual mode)" jak u pozostałych pięciu dostawców oceny na żywo) oraz `github` (+ jego `GITHUB_MODELS_MODEL`) do `/api/status/providers`, dzięki czemu routing aktywnego dostawcy i strona Health odzwierciedlają teraz wszystkich sześciu. Test wiersza health w `tests/api.test.mjs` rozszerzono na wszystkich sześciu dostawców.

---



## [1.74.1] — 2026-06-17

**docs + test: sekcja README „Instalacja asystenta AI”; pełne pokrycie gałęzi dla konektora Gemini.** Do README dodano tabelę instalacji/logowania — linki instalacyjne dla Claude Code / Gemini CLI / Codex / Qwen Code / OpenCode / GitHub Copilot CLI + mapowanie dostawcy `#/config` dla każdego + „zaloguj się przed kontynuowaniem” (odzwierciedla przewodnik szybkiego startu career-ops.org/docs; wyjaśnia, że web-ui to samodzielna alternatywa niewymagająca CLI). Nowy `tests/gemini-connector.test.mjs` (8 przypadków) obejmuje każdą gałąź `runGemini` — brak klucza, sukces, błąd API, pusta/zablokowana odpowiedź, nieprawidłowe ciało odpowiedzi, przekroczenie limitu czasu, błąd sieciowy, `hasGeminiKey` — doprowadzając `server/lib/gemini.mjs` do 100% instrukcji. Całkowite pokrycie: 96% linii / 88% gałęzi / 96% funkcji. Zestaw testów 1126 → 1134.

---



## [1.74.0] — 2026-06-17

**feat(llm): GitHub Models (Copilot) jako 6. dostawca + kanoniczna zgodność 6 asystentów.** career-ops.org/docs wymienia sześciu asystentów kodowania AI — Claude Code, Gemini CLI, Codex, Qwen Code, OpenCode, GitHub Copilot CLI. Web-ui obsługuje teraz wszystkich sześciu: pięciu odpowiada istniejącym aktywnym dostawcom (Anthropic / Gemini / OpenAI / Qwen / OpenRouter), a GitHub Copilot CLI otrzymuje dedykowany łącznik GitHub Models — `runGitHubModels` (OpenAI-compatible; PAT GitHub z zakresem `models`), konfigurowalny w `#/config` (`GITHUB_MODELS_API_KEY` + `GITHUB_MODELS_MODEL`) i wybieralny przez `LLM_PROVIDER=github`; 6. w kolejności auto. Pakiety pomocy i pliki README zawierają teraz kanoniczną szóstkę (zmieniono nazwę Qwen CLI→Qwen Code; dodano Gemini CLI + GitHub Copilot CLI), a README dodaje pełną tabelę odwołań do trybów i łączy adapterów portali do career-ops.org/docs, aby każda funkcja była powiązana z projektem nadrzędnym. `tests/llm-provider-context.test.mjs` rozszerza macierz granic pobierania na wszystkich sześciu dostawców (`cv.md` + `profile.yml` wbudowane + zwrócony artefakt); nowe klucze `GITHUB_MODELS_*` dodane do wszystkich 12 słowników językowych. Pakiet testów 1125 → 1126.

---



## [1.73.0] — 2026-06-17

**feat(llm): ogólny konektor Gemini + zweryfikowany kontekst CV/profilu dla wszystkich dostawców.** Dodano `server/lib/gemini.mjs` (`runGemini`) — klient Gemini `generateContent` bez zewnętrznych zależności, zwracający tę samą strukturę `{markdown, usage, error}` co klienty kompatybilne z Anthropic / OpenAI. Poprawka: `/api/mode/:slug` i `/api/deep` poprzednio kierowały prompty przez `gemini-eval.mjs`, przeznaczony wyłącznie do oceny ofert, przez co Gemini **Run live** zwracał ocenę zamiast żądanego artefaktu (list motywacyjny, wiadomość do rekrutera, notatka). Teraz wywołują `runGemini` z `bundleProjectContext`, dzięki czemu `cv.md` + `config/profile.yml` są dołączane inline dla Gemini dokładnie tak samo jak dla każdego innego dostawcy — listy i notatki są szczegółowe i spersonalizowane. Nowy `tests/llm-provider-context.test.mjs` mockuje granicę HTTP każdego dostawcy i sprawdza, że wszyscy pięciu (Anthropic / Gemini / OpenAI / Qwen / OpenRouter) dołączają `cv.md` + `profile.yml` inline i zwracają artefakt (macierz mode + deep + evaluate, 9 przypadków). `/api/evaluate` zachowuje dostosowany do ofert `gemini-eval.mjs`. Suite 1116 → 1125.

---



## [1.72.0] — 2026-06-17

**feat(modes): **Run live** zwraca teraz finalny artefakt bezpośrednio (kontrakt wyjściowy dla pojedynczego wywołania).** Szablony nadrzędne `modes/<slug>.md` są napisane z myślą o interaktywnych sesjach Claude Code — kilka z nich (cover, contacto, …) zatrzymuje się, aby zadać pytania wyjaśniające przed wygenerowaniem wyniku, przez co **Run live** w interfejsie webowym emitował kwestionariusz zamiast artefaktu. `buildModePrompt` opakowuje teraz każdy tryb w nieinteraktywny kontrakt wyjściowy: wykonuje analizę (rozkład opisu stanowiska, notatki o firmie, słowa kluczowe ATS, luki profil↔oferta, wybór tonu/podejścia) po cichu, wybiera rozsądne wartości domyślne z `cv.md` / `config/profile.yml` dla wszystkiego, o co szablon normalnie pytałby użytkownika, i wyświetla wyłącznie końcowy artefakt — zamknięty przypomnieniem per tryb «output ONLY {the cover letter / outreach message / …}». Dzięki temu kliknięcie **Run live** na `#/cover` zwraca teraz sam list motywacyjny; ta sama poprawka dotyczy wszystkich trybów ogólnych (cover, contacto, interview-prep, project, training, followup, patterns) we wszystkich 12 lokalizacjach (artefakt jest pisany w języku interfejsu zgodnie z dyrektywą lokalizacji). Suite 1103 → 1116.

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
