# Dziennik zmian

Wszystkie istotne zmiany w **career-ops-ui**. Format wg [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), wersjonowanie [SemVer](https://semver.org/).

Tłumaczenia: [🇬🇧 English](CHANGELOG.md) · [🇪🇸 Español](CHANGELOG.es.md) · [🇧🇷 Português](CHANGELOG.pt-BR.md) · [🇰🇷 한국어](CHANGELOG.ko-KR.md) · [🇯🇵 日本語](CHANGELOG.ja.md) · [🇷🇺 Русский](CHANGELOG.ru.md) · [🇨🇳 简体中文](CHANGELOG.zh-CN.md) · [🇹🇼 繁體中文](CHANGELOG.zh-TW.md) · [🇫🇷 Français](CHANGELOG.fr.md) · [🇺🇦 Українська](CHANGELOG.uk.md) · [🇩🇰 Dansk](CHANGELOG.da.md) · [🇸🇦 العربية](CHANGELOG.ar.md) · [🇩🇪 Deutsch](CHANGELOG.de.md) · [🇮🇹 Italiano](CHANGELOG.it.md) · [🇹🇷 Türkçe](CHANGELOG.tr.md) · [🇮🇳 हिन्दी](CHANGELOG.hi.md)

> **Uwaga dot. tłumaczenia (v1.70.0)** — polski dodano jako jeden z trzech nowych języków interfejsu. Ten plik tłumaczy najnowsze wpisy; pełna historia znajduje się w [🇬🇧 angielskim CHANGELOG](CHANGELOG.md), który jest źródłem normatywnym.

---


## [1.140.0] — 2026-08-12

**Wnikliwe statystyki: bogatsze dane o wynagrodzeniach** — rozbicie wynagrodzeń w „Mój pipeline" na `#/stats` pokazuje teraz **średnią** (nie tylko medianę), przełącznik **rocznie ⇄ miesięcznie** i tabelę **min · śr · mediana · maks** wg kraju. Pierwsza część Fazy 3. Poprawka UX zgłoszona przez użytkownika (bez parent-sync).

### Dodano
- **Średnie wynagrodzenie** — `RoleStats.salaryStats` zwraca teraz `avgUsd` obok `minUsd`/`medianUsd`/`maxUsd`. Mediana jest odporna na wartości odstające, średnia ujawnia skośność — razem czytają się jak rozkład.
- **Przełącznik rocznie ⇄ miesięcznie** i **tabela min · śr · mediana · maks wg kraju** w sekcji wynagrodzeń, sterowane selektorami waluty i okresu. 8 nowych kluczy i18n × **17 języków**.

### Uwagi
- Liczby wciąż pochodzą tylko z ofert z czytelnym wynagrodzeniem i są normalizowane do USD (orientacyjne). Zestaw: **2361** testów (+1).

## [1.139.0] — 2026-08-12

**Zrozumiałość: podpowiedzi `?`** — wielokrotnego użytku, bezpieczny dla CSP przycisk `?`, który po kliknięciu wyjaśnia „co to robi / jak działa / czego oczekiwać" w Twoim języku. Poprawka UX zgłoszona przez użytkownika (bez parent-sync).

### Dodano
- **Dymek podpowiedzi `?`** (`window.HelpHint`) — okrągły `?` obok nagłówka otwiera lekki, zależny od motywu i lustrzany w RTL dymek, który renderuje zlokalizowane wyjaśnienie przez `UI.md()`; dostępny (`role="tooltip"`, `aria-expanded`, zamykanie Escape/kliknięciem poza, przywracanie fokusu) i bezpieczny dla CSP.
- **`?` na 5 kartach `#/stats`** oraz na **8 tytułach widoków AI/analitycznych** (career-plan, orientacja, two-pager, networking, próbna rozmowa, pamięć, funded, tygodniowe podsumowanie) — 14 nowych kluczy i18n × **17 języków**.

### Uwagi
- Wszystkie widoki miały już jednoliniowy podtytuł; `?` dodaje głębsze wyjaśnienie na żądanie i sprawia, że puste stany same się tłumaczą. Zestaw: **2360** testów (+4).

## [1.138.0] — 2026-08-12

**Generowanie w języku interfejsu** — każda generacja AI odpowiada teraz w języku wybranym w UI, plus wzmocnienia testów z przeglądu. Poprawka UX zgłoszona przez użytkownika (bez parent-sync).

### Zmieniono
- **Generacje AI respektują teraz język interfejsu.** Gdy interfejs jest po rosyjsku, hiszpańsku, japońsku, … wygenerowany tekst wraca **w tym** języku zamiast zawsze po angielsku. Dyrektywa języka wyjścia jest przekazywana przez **wszystkie** endpointy generowania — plan kariery, orientację, raport rynkowy, próbną rozmowę, plan networkingu, „zapytaj dokumentację”, sugestię notatki pamięci i szkic two-pager. Kod i identyfikatory pozostają po angielsku (np. klucze YAML w two-pager); lokalizowane są tylko proza, nagłówki i punkty.

### Naprawiono
- **Strażnik ról kolorów CSS** (`tests/css-role-tokens.test.mjs`) — statyczny kanarek sprawdzający, że tokeny-aliasy trybu ciemnego z v1.137.0 nigdy nie odwracają roli: tokeny tekstowe (`--fg`/`--danger`/`--ok`/…) nigdy jako `background`, a tokeny powierzchni (`--card`/`--panel`/`--line`/…) nigdy jako tekstowy `color`, w całym CSS i stylach inline SPA.
- **Autosonda ładowarki XSS `UI.md()`** — test ładujący `md()` z `api.js` sonduje teraz `md('<script>…')` tuż po ekstrakcji i rzuca błąd, gdy brak escapowania, więc przyszłe błędne cięcie zawodzi **głośno**, zamiast zazieleniać zestaw bezpieczeństwa na uciętej funkcji.
- **Strażnik przewijania na `#/career-plan`** — `scrollIntoView` po generacji uruchamia się tylko, gdy podgląd jest wciąż połączony z dokumentem.

### Uwagi
- `docs/UX-ROADMAP.md` zaktualizowany: podpowiedzi `?` + opisy stron + stany puste przechodzą do **v1.139.0**; dostawca **Nous Research / Hermes** — z przewodnikiem wdrożenia na serwerze chmurowym + Telegram i skillem Hermes — jest śledzony jako **Faza 5 / 5b**.
- Zestaw: **2356** testów (+5).

## [1.137.0] — 2026-08-11

**Poprawki czytelności i renderowania** — kontrast w trybie ciemnym, etykiety wykresów oraz plan kariery. Przegląd UX zgłoszony przez użytkownika (bez synchronizacji z rodzicem).

### Naprawiono
- **Trwałe „białe na białym” / „czarne na czarnym” w trybie ciemnym na wielu ekranach** — piętnaście własnych właściwości CSS, do których odwoływało się kilka widoków (`--fg`, `--panel`, `--panel-2`, `--ok`, `--danger`, `--card`, …), nigdy nie zostało zadeklarowanych, więc spadały do zakodowanych na stałe wartości jasnych/czarnych: w porządku w trybie jasnym, nieczytelne w trybie ciemnym (chipy przeglądu na `#/pipeline`, aktywna karta na `#/stats`, „Aktywne / Klucze” + „✓ ustawiono” na `#/config`, sekcje `#/two-pager`, bąbelek pytania na `#/mock-interview`, tekst błędów). Teraz są aliasowane do rzeczywistych tokenów świadomych motywu, dzięki czemu automatycznie podążają za motywem — **0 błędów kontrastu WCAG-AA we wszystkich 29 widokach**, zweryfikowane przez automatyczny audytor; aktywna karta na `#/config` przeszła na czytelny, podbarwiony styl. Strażnik regresji (`tests/dark-theme-tokens.test.mjs`) utrzymuje ich aliasowanie.
- **Etykiety wykresów na `#/stats` były przycinane w połowie słowa** („Senior Backend Engineer” → „…Enginee”) — teraz są skracane wielokropkiem, a pełna etykieta pojawia się jako podpowiedź (tooltip) po najechaniu kursorem.
- **`#/career-plan` wyświetlał wygenerowany plan jako surowy Markdown** — teraz jest automatycznie renderowany jako sformatowany, czytelny tekst (edytowalny Markdown pozostaje w polu tekstowym; przełącznik Podgląd go przełącza).

### Uwagi
- `#/career-plan`, `#/two-pager`, `#/stats` oraz tygodniowe podsumowanie rozmów kwalifikacyjnych nie są uszkodzone — pokazują stany puste, dopóki nie wygenerujesz planu / nie będziesz mieć danych. Jaśniejsze wskazówki na stronie oraz podpowiedzi pomocy `?` są planowane jako następny krok (`docs/UX-ROADMAP.md`).

## [1.136.0] — 2026-08-11

Parytet z rodzicem career-ops **v1.26.x** (po głównej linii v1.26.0) — jedno nowe źródło bez autoryzacji oraz fala poprawek jakości i odporności dla kodu odzwierciedlanego w web-ui. Rejestr liczy teraz **79 źródeł = 74 angielskie + 5 rosyjskich** (`ALL_ADAPTERS` 74).

### Dodano
- **`eightfold`** (Eightfold AI, #2684) — tablice rekrutacyjne poprzez bezautoryzacyjne API `https://<tenant>.eightfold.ai/api/apply/v2/jobs`, przypięte do hosta `*.eightfold.ai` (markowy CNAME `careers.<company>.com` jest celowo odrzucany); stronicowane z limitem bezpieczeństwa, zgłasza błąd dla martwej tablicy, deduplikacja adresów URL. Źródło + adapter oraz izolowany dla CI zestaw testów; pojawia się w filtrze Source na `#/scan` oraz na landingu.

### Naprawiono
- **Deduplikacja i klucze ról świadome Unicode** (#2569 / #2587 / #2667) — nowa współdzielona `normalizeTextKey` (NFKC, zachowuje litery/znaki diakrytyczne/cyfry z każdego alfabetu) zastępuje klucze ograniczone do ASCII: `detect-reposts` teraz grupuje warianty firm różniące się szerokością znaków/interpunkcją ("Acme, Inc." ≡ "Acme Inc") i nigdy nie zlewa odrębnych pracodawców spoza alfabetu łacińskiego, a `role-matcher` składa tytuły o pełnej szerokości i zachowuje tokeny ról spoza alfabetu łacińskiego, zamiast je wymazywać.
- **`fetchJsonWithRetry` nie ponawia już odrzuconego przekierowania** (#2657) — zabezpieczenie `redirect:'error'` napotykające 3xx jest deterministyczne, więc jest teraz nieponawialne i zawodzi szybko, zamiast zużywać budżet ponowień.
- **Grupy AND w `title_filter.positive`** (#2552) — rozdzielony spacjami ` + ` wewnątrz wpisu pozytywnego wymaga teraz, aby każdy termin wystąpił w tytule, w dowolnym porządku.
- **`oraclecloud` akceptuje numerowane domeny najemcy** `oraclecloud1.com … oraclecloud99.com` (#2683) — ograniczona rodzina (bez wiodącego zera, ≤ 2 cyfry), nigdy dowolna domena wieloznaczna.
- **`workable` wzmocniony** (#2675) — ponowienia, nagłówki przypominające przeglądarkę oraz serializacja żądań wobec hosta osłanianego przez Cloudflare.
- **`personio` przechodzi na zeskrobywanie HTML**, gdy kanał XML jest wyłączony, zamiast zwracać brak wyników.
- **Aliasy FALLBACK dla `states` ponownie zsynchronizowane** z rodzicem (#2615).

### Uwagi
- Nieprzeniesione (nie odzwierciedlone przez web-ui lub tylko CLI): reply-matcher (#2672), jd-similarity (#2661), jd-skill-gap (#2686), parsowanie ścieżki środowiskowej skanowania (#2568) / `--flag=value` (#2589) oraz zmiany dla listu motywacyjnego / szablonu CV / doctor / ollama / generate-pdf. Zagrożenia HIGH dla webowych `js-yaml`/`nanoid` zostały już naprawione w web-ui v1.135.0.

## [1.135.0] — 2026-08-11

Parytet z rodzicem career-ops **v1.26.0** — pięć nowych źródeł skanowania bez autoryzacji oraz poprawki poprawności dla czterech tablic, które web-ui już obsługuje. Rejestr liczy teraz **78 źródeł = 73 angielskie + 5 rosyjskich** (`ALL_ADAPTERS` 73).

### Dodano
- **Pięć nowych źródeł skanowania** (każde to źródło + adapter + izolowany dla CI zestaw testów; pojawiają się w filtrze Source na `#/scan` oraz na landingu cvstart.org):
  - **`join`** (JOIN) — tablica JOIN danej firmy z Next.js `__NEXT_DATA__` na `join.com/companies/<slug>` (przypięty do hosta, z limitem stron).
  - **`getro`** (Getro) — tablice ofert portfolio VC „sieci talentów” poprzez publiczne API POST `api.getro.com`, stronicowane od najnowszych; każda oferta jest przypisana do pracodawcy z portfolio, nie do funduszu.
  - **`consider`** (Consider) — tablice ofert portfolio VC na getconsider.com poprzez żądanie POST do tego samego źródła; host sterowany konfiguracją jest przypięty przez strukturalne zabezpieczenie SSRF (tylko publiczny host HTTPS).
  - **`joinup`** (JOINUP) — szwajcarska tablica ofert joinup.ch, odczytująca renderowaną po stronie serwera najnowszą stronę; zamyka się bezpiecznie (fail-closed) przy awarii scrapera.
  - **`remotli`** (Remotli) — remotli.ch, stanowiska zdalne w szwajcarskich firmach (wynagrodzenia w CHF); emituje własny adres aplikacyjny ATS pracodawcy, dzięki czemu duplikaty ogłoszeń między portalami są deduplikowane.

### Naprawiono
- **a16z Speedrun nie przerywa już całej tablicy przy przejściowym zakłóceniu** — pobieranie stron przechodzi teraz przez współdzielone `fetchJsonWithRetry` (ograniczone ponowienia tylko przy przejściowych błędach 429/5xx/timeout, nigdy przy trwałym 4xx), a budżet stron został dostosowany do strony liczącej 50 ofert.
- **arbeitsagentur przeniesiono na API Jobsuche v6** (`/pc/v6/jobs`) — stary punkt końcowy v4 zwraca teraz 404; kształt odpowiedzi zmienił nazwę, a filtrowanie pracy zdalnej zawęża się teraz po stronie serwera.
- **thehub przeniesiono na API v2 `jobsandfeatured`** — wiersze nie mają daty publikacji i są zwolnione z filtra wieku ogłoszenia.
- **hackernews niezawodnie znajduje comiesięczny wątek „Who is hiring?”**, filtrując wyszukiwanie Algolia po tagu konta `author_whoishiring` zamiast po zapytaniu tekstowym.

### Uwagi
- Nieprzeniesione (web-ui jest już bezpieczne, pochłonięte przez przekaźnik lub dotyczy tylko CLI): klucze deduplikacji ofert/dopasowywania firm dla Unicode (grupowanie powtórzeń w web-ui już kluczuje firmę po zwykłych małych literach, więc odrębni pracodawcy spoza alfabetu łacińskiego nigdy się nie zlewają); sygnał opóźnienia odrzuceń follow-up oraz poprawki company-funded (przekazywane tylko do odczytu, fail-soft); ścieżki skanowania nadpisywalne przez zmienne środowiskowe oraz parsowanie `--flag=value` (web-ui uruchamia skanery w procesie); refaktoryzacja ujednolicająca User-Agent (web-ui już to centralizuje); oraz elementy dotyczące wyłącznie CLI (rejestr niezaufanej treści, oferta/offer-prep, doctor, zmiany szablonu CV/listu motywacyjnego).

## [1.134.1] — 2026-08-05

Wzmocnienie walidacji — poprawki wykryte podczas pełnego audytu projektu.

### Naprawiono
- **`successfactors` nie odrzuca już zebranych ofert przy błędzie w połowie skanowania** (regresja we wdrożeniu „dead-board-throw” z v1.134.0) — jego pętla paginacji nie miała `try/catch`, więc błąd na stronie 2 lub kolejnej (po sukcesie strony 1) zgłaszał wyjątek i odrzucał wszystko, co już zebrano; a jeśli tym błędem był `404` (nieprawidłowy zakres `startrow`), `en-scanner` kwarantannował aktywnego najemcę jako martwego na wiele dni. Teraz zachowuje się jak `phenom`/`radancy`: błąd na stronie 0 wciąż zgłasza wyjątek (martwa tablica), ale błąd na kolejnej stronie zachowuje częściowe wyniki.
- **Chipy filtrów na `#/scan` są teraz obsługiwane z klawiatury** (WCAG 2.1.1) — chipy fasetowe (oraz chip „wyczyść”) były elementami `<span>` z obsługą kliknięcia, ale bez `tabindex`/role, więc użytkownicy klawiatury i czytników ekranu nie mogli do nich dotrzeć ani ich przełączać. Teraz mają `role="button"`, `tabindex="0"`, `aria-pressed` oraz aktywację klawiszami Enter/Spacja.
- **Trzy zakodowane na stałe angielskie ciągi są teraz zlokalizowane** — podpowiedź (tooltip) plakietki zaufania na `#/scan`, nagłówek kolumny relokacji na `#/scan` oraz nagłówek wyniku (score) na `#/dashboard` były gołymi literałami, których nie widział mechanizm kontroli parytetu i18n (nigdy nie były kluczami), więc pozostawały w języku angielskim we wszystkich lokalizacjach innych niż angielska. Teraz to `scan.trustTip` + `scan.col.reloc` (2 nowe klucze) oraz ponowne użycie `track.col.score`, wraz ze statyczną strażą źródłową (source-static guard).

## [1.134.0] — 2026-08-05

Parytet z rodzicem career-ops **v1.25.0**.

### Dodano
- **Nowe źródło skanowania: getManfred** (`manfred`) — ogólny kanał hiszpańsko-unijnych ofert pracy w branży tech z podanymi wynagrodzeniami, z `www.getmanfred.com/api/v2/public/offers` (bez autoryzacji, przypięty do hosta + tylko HTTPS, pełny katalog w jednym żądaniu). Źródło + adapter oraz izolowany dla CI zestaw testów (`tests/sources-manfred.test.mjs`); rejestr liczy teraz 73 źródła = 68 angielskich + 5 rosyjskich (`ALL_ADAPTERS` 68). Widoczne w filtrze Source na `#/scan` oraz na landingu cvstart.org.

### Naprawiono
- **Kanał a16z Speedrun po cichu obcinał wynik do 50 ofert** (#2404) — kanał ogranicza stronę do 50 pozycji, ale źródło żądało `PER_PAGE = 100`, więc paginacja zatrzymywała się po pierwszej stronie. Poprawiono na 50.
- **Martwe portale teraz zgłaszają błąd zamiast być odczytywane jako „działające, ale puste”** (#2379) — `cryptocurrencyjobs`, `phenom`, `radancy`, `successfactors`: nieudane pobranie, w którym żadne żądanie nigdy się nie rozstrzygnęło, teraz zgłasza błąd (dzięki czemu stan `#/portals` i skan odnotowują rzeczywistą awarię), zamiast wyciszać go do pustej listy; awaria w połowie skanowania po co najmniej jednym sukcesie zachowuje wyniki częściowe.
- **workable korzysta teraz z publicznego API widżetu** (#5ab8425) — przełączono na `apply.workable.com/api/v1/widget/accounts/<slug>`, który zwraca pełną listę ofert dużego konta w jednym żądaniu, więc duże konta nie są już obcinane.

### Uwagi
- Nieprzeniesione (tylko CLI lub nie odzwierciedlone przez web-ui): przepisanie wydajnościowe grupowania tytułów w detect-reposts #2389; poprawki kluczy firm dla Unicode (własna deduplikacja trackera w web-ui jest już bezpieczna dla znaków innych niż łacińskie); `scan --since`; `cv-facts`; przegląd szablonu CV / PDF; `doctor`; dyrektywa o niezaufanej treści w trybach.

## [1.133.1] — 2026-08-02

### Naprawiono
- **`#/funded` (Sfinansowane firmy) teraz renderuje wyniki** — dwa błędy sprawiały, że tabela zawsze pokazywała „brak sfinansowanych firm”, nawet gdy skrypt rodzica `company-funded.mjs` zwracał pełną listę. (1) Widok odczytywał wyniki spod klucza `res.candidates`, podczas gdy rodzic emituje je pod `companies` (każdy element ma postać `{ company, amount, round, funding: { sources: [{ source, url, observed_date }] } }`); klient teraz odczytuje właściwy klucz i mapuje rzeczywisty kształt dowodów. (2) Tabela wyników przekazywała swoje komórki do `UI.el('tr', {}, …)` jako argumenty zmiennej długości (varargs), podczas gdy `UI.el(tag, attrs, children)` przyjmuje `children` jako pojedynczy węzeł lub tablicę, więc renderowała się tylko pierwsza kolumna (Firma) — komórki są teraz przekazywane jako tablica. Zweryfikowano w prawdziwej przeglądarce: 11 firm z czterech kanałów renderuje się z kolumnami Firma / Sygnał finansowania / Źródło / Data oraz działającymi linkami do dowodów, zero błędów w konsoli. Pusty wynik ujawnia teraz również diagnostykę per źródło, dzięki czemu spokojny dzień bez wiadomości można odróżnić od zablokowanego kanału.
- Zabezpieczenia regresji w `tests/parity-routes-v1133.test.mjs`: fałszywy skrypt rodzica emituje teraz prawdziwy kształt wyjścia `companies` (oryginalna fixtura odzwierciedlała błędny kształt `candidates` — co jest dokładnie powodem, dla którego ten błąd trafił do produkcji z zielonymi testami), a także statyczne kanarki źródłowe sprawdzające, że `funded.js` odczytuje `res.companies` (nigdy `res.candidates`) i buduje wiersze tabeli z komórkami jako tablicą (+1 → 2144).

## [1.133.0] — 2026-08-01

### Dodano
- **Wykrywanie sfinansowanych firm (`#/funded`, parytet z rodzicem #2117)** — nowy widok tylko do odczytu, przekazujący skrypt `company-funded.mjs` rodzica career-ops przez `GET /api/company-funded`: lista firm niedawno sfinansowanych, przeznaczona najpierw do przejrzenia (review-first), wykrytych z publicznych, przypiętych do hosta kanałów o finansowaniu (TechCrunch, PR Newswire, The Guardian, Hacker News). Przekaźnik uruchamia skrypt z `--json --dry-run` (JSON na stdout, bez zapisu plików), nigdy nie przekazuje danych wejściowych użytkownika do `--sources`, ma ograniczanie liczby żądań i jest wyzwalany przez użytkownika (przycisk Discover, nigdy przy montowaniu). Nowy moduł trasy `server/lib/routes/funded.mjs` + `public/js/views/funded.js`, w grupie **Pozyskiwanie**.
- **Cotygodniowe podsumowanie rozmów kwalifikacyjnych (`#/interview-digest`, parytet z rodzicem #2129/#2130)** — nowy widok tylko do odczytu, przekazujący skrypt rodzica `weekly-digest.mjs` (bez LLM) przez `GET /api/interview/weekly-digest`: mechaniczne zestawienie notatek z sesji rozmów kwalifikacyjnych — z jakimi firmami i na jakich rundach rozmawiałeś w tym tygodniu, powtarzające się kompetencje oraz szacunkowe (best-effort) otwarte luki. Opcjonalny zakres `?from=&to=` jest przekazywany tylko wtedy, gdy OBIE wartości są poprawnymi datami `YYYY-MM-DD`; pusty zakres to prawidłowe podsumowanie `available:true`. Dodano do `server/lib/routes/interview.mjs` + `public/js/views/interview-digest.js`, w grupie **Analityka**.
- Oba przekaźniki stosują się do ustalonego kontraktu fail-soft `available:false`, gdy skrypt rodzica jest niedostępny (CI, samodzielne instalacje). 26 nowych kluczy i18n ×17 lokalizacji; izolowany dla CI zestaw testów `tests/parity-routes-v1133.test.mjs` (+5 → 2143).

### Uwagi
- Rodzic career-ops posunął się dalej niż v1.24.0 dzięki stronie Follow-up Tracker w aplikacji Next.js **web/** (#1422) oraz renderowaniu PDF po stronie backendu (#2182) — nieprzeniesione: web-ui ma już własny przekaźnik follow-up oraz uruchamiacze PDF, a leżące u podstaw utwardzenie `followup-cadence.mjs` trafia tu za darmo przez przekaźnik typu shell-out. Zmiany w `set-status.mjs` / `tracker-utils.mjs` są wewnętrzne dla CLI i nie zostały odzwierciedlone.

## [1.132.0] — 2026-07-31

### Zmieniono
- **Podsystem renderowania wyników `#/scan` wyodrębniono do `public/js/lib/scan-results.js`** (dług kontraktu rozmiaru pliku — `public/js/views/scan.js` urósł do ~1254 LOC). Podsystem (`renderResults`, `buildChipRow`, `getRows`, generatory wierszy/fasetek, funkcje renderujące opcje oraz lustrzane odbicie rejestru `FALLBACK_SOURCES`) przeniesiono do fabryki `window.ScanResults.create(ctx)`, domykającej się nad obiektem kontekstu dostarczanym przez widok. Bez zmiany zachowania — funkcje przeniesiono dosłownie, a zmienne domknięcia mechanicznie przełączono na `ctx.*`; `scan.js` ma teraz ~906 LOC (planowany jest drugi etap wyodrębniania w kierunku celu 800 LOC).
- Testy statyczne źródła czytają oba pliki przez `tests/helpers/scan-src.mjs::loadScanSrc()`; `tests/scan-fallback-sources.test.mjs` czyta teraz lustrzane odbicie rejestru z `scan-results.js`.
- **Nowa bramka regresji w przeglądarce** — `tests/playwright-scan-filters.mjs` zasiewa gotowy plik `data/last-scan.json` i przechodzi przez każdy filtr `#/scan`, sprawdzając dokładne liczby wierszy (`npm run test:e2e:browser`); dodano stabilne identyfikatory kontrolek filtra (`#scan-filter-*`, `#scan-apply`).
- Baner „Najnowsze wydanie” w README uproszczono do jednowierszowego podsumowania z linkiem do pełnego dziennika zmian (długa, wielowersyjna ściana narracji została wycofana). Zastosowano we wszystkich 17 lokalizacjach.

## [1.131.2] — 2026-07-31

### Zmieniono
- **Podział `app.css` na trzy uporządkowane arkusze stylów** (dług kontraktu rozmiaru pliku — pojedynczy plik urósł do ~1990 LOC, znacznie ponad twardy cel 800 LOC). Teraz jest to `app.css` (~672 — a11y, tokeny projektowe/motyw, pasek boczny, główna treść, przyciski, powłoka treści), **`components.css`** (~595 — karty, siatki, paginator, odznaki, tabele, formularze, log/konsola, markdown, przełącznik języka, filtr chipów, baner połączenia) oraz **`overlays.css`** (~737 — toast, szuflada powiadomień, modal, różne/responsywność, lustrzane odbicie `[dir="rtl"]`, docs-fab, usage-hud), każdy w granicach twardego limitu.
  - Podział jest **ciągły i zachowuje kolejność**, więc kaskada jest **identyczna co do bajtu** z plikiem sprzed podziału; `index.html` ładuje trzy pliki jako uporządkowane `<link>`. **Bez zmiany zachowania, znaczników czy i18n.**
  - Testy odwołujące się do CSS czytają teraz połączenie plików przez współdzielony pomocnik `tests/helpers/css.mjs::loadAppCss()`. Nowy plik `tests/css-modularization.test.mjs` zabezpiecza podział (pliki istnieją · każdy ≤ 800 LOC · kolejność linków w index.html) → zestaw **2138**. Zweryfikowano w przeglądarce: wszystkie trzy arkusze stylów parsują się poprawnie, a ich reguły są stosowane.

## [1.131.1] — 2026-07-31

### Naprawiono
- **Spójność przypinania hosta adaptera dla dwóch źródeł z v1.130.0** (następstwa przeglądu kodu, obrona w głąb; brak zmiany zachowania dla poprawnych danych wejściowych):
  - Adapter **`a16z-speedrun-talent`** teraz ponownie waliduje nadpisanie `api:` / `a16z-speedrun-talent:` w `buildEndpoint` (HTTPS + dokładny host `speedrun-talent-network.com`) i wraca do kanonicznego kanału, gdy walidacja zawiedzie — parytet z adapterem `cryptocurrencyjobs`, dzięki czemu wartość spoza hosta nigdy nie trafia do gniazda pobierania (wcześniej polegał wyłącznie na strażniku `assertSpeedrunUrl` w momencie pobierania). Dokładne sprawdzenie hosta to teraz pojedynczy eksportowany `SPEEDRUN_TALENT_HOST_RE` współdzielony przez strażnika i adapter.
  - Parser **`cryptocurrencyjobs`** — `cleanUrl` używa teraz tego samego dokładnego strażnika hosta co `assertCryptocurrencyJobsUrl` i nadpisanie adaptera (było `endsWith`, które akceptowało subdomeny). Parser nigdy nie jest bardziej permisywny niż strażnik SSRF: link do pozycji z `sub.cryptocurrencyjobs.co` jest odrzucany.
  - +2 testy → zestaw **2135**.

## [1.131.0] — 2026-07-31

### Dodano
- **Tablica CRM z zakładkami etapów na `#/tracker`** (przeniesiona z widoku `/pipeline` aplikacji webowej rodzica). Pasek chipów lejka + rozwijane menu statusu w trackerze zastępuje **pasek zakładek etapów**: zakładka **Wszystkie** plus jedna zakładka na każdy kanoniczny status — **Evaluated · Applied · Responded · Interview · Offer · Rejected · Discarded · SKIP · Hired** — każda pokazuje na żywo liczbę z całej historii, **w tym etapy z zerową liczbą**, dzięki czemu cały lejek jest zawsze widoczny (wygląd CRM). Aktywna zakładka steruje filtrem; kliknięcie jej ponownie czyści z powrotem do Wszystkie. Wiersze zachowują ton oceny, legalność, funkcje PDF i raportu, a komórka firmy pokazuje teraz logo marki, jeśli włączono pokazywanie logo firm (domyślnie wyłączone → zero dodatkowych zapytań).
  - Nowa trasa tylko do odczytu **`GET /api/tracker/stages`** zwraca kanoniczny lejek (etykiety w kolejności) + mapę składania aliasów, pochodzącą z `server/lib/states.mjs` (`templates/states.yml`, z wbudowanym fallbackiem) — dzięki czemu klient **nigdy nie zakodowuje na sztywno białej listy statusów**. Odpowiedź starszego `GET /api/tracker` bez parametrów jest niezmieniona (tylko `{ rows }`).
  - Nowa czysta, pokryta testami jednostkowymi biblioteka kliencka **`public/js/lib/tracker-stages.js`** grupuje wiersze według etapów zwróconych przez serwer, tolerując przypadkowe pogrubienia markdown i zlokalizowane aliasy (np. `aplicado` → `Applied`). Zakładki są dostępne (rola tablist/tab, aria-selected, obszar dotykowy ≥44 px, liczby w dostępnej nazwie każdej zakładki). Bez nowych kluczy i18n. Zestaw testów **2133**.

## [1.130.0] — 2026-07-31

### Dodano
- **Dwa nowe źródła skanowania przeniesione z rodzica career-ops v1.24.0** (w procesie, bez nowych zależności; oba pojawiają się w filtrze Source na `#/scan` i na landingu cvstart.org):
  - **a16z Speedrun** (`a16z-speedrun-talent`, #2231) — kanał JSON całej tablicy *talent-network* a16z Speedrun. Przypięty do hosta `speedrun-talent-network.com`, tylko HTTPS, paginacja indeksowana od 0 z limitem stron, przekazywanie `q`/konfiguracji per firma, fail-soft.
  - **Cryptocurrency Jobs** (`cryptocurrencyjobs`) — portal Web3 `cryptocurrencyjobs.co`, pobierany przez jego publiczny kanał RSS 2.0 (bez autoryzacji). Dwuprzebiegowe dekodowanie encji XML, wyłącznie oferty zdalne, pracodawca odczytywany z końcówki tytułu `"… at <Company>"`.
  - Rejestr liczy teraz **72 źródła = 67 angielskich + 5 rosyjskich** (`ALL_ADAPTERS` = 67 angielskich adapterów portali).

### Naprawiono
- **`echojobs` — role hybrydowe pozostają odróżnialne od zdalnych** (odzwierciedla rodzica #2258). Znacznik `hybrid` (bez rozróżniania wielkości liter) daje teraz `"<Miasto> · Hybrydowo"` (lub samo `Hybrydowo`, gdy brak miasta) oraz `workplaceType: 'Hybrid'`, zamiast zostać zwiniętym do `Remote`.
- **`radancy` — przestarzały znacznik TalentBrew + transport fragmentu wyników JSON** (odzwierciedla rodzica a3e6df9), włączany przez wstrzykiwalny `opts.fetchJson`.

### Uwagi
- **Nie przeniesiono — funkcje rodzica tylko dla CLI.** Duża powierzchnia CLI/trybów z career-ops v1.24.0 pozostaje poza web-ui, który jest przeglądarką + cienkim zapisem, a nie hostem trybów: tabele zgodności/jurysdykcji, książka kontaktów + vCard, debrief transkryptu rozmowy kwalifikacyjnej / wykrywanie platformy rozmów, ustawianie statusu w rejestrze, zapis wyniku, dwuprzebiegowa triage, podobieństwo JD, wersjonowany schemat artefaktu CV zgłoszenia, wykrywanie Playwright-MCP przez doctor oraz `portals/fix-slugs.mjs`. Zmiany orkiestracji skanowania żyjące w rodzicielskim `scan.mjs` — skaner Interamt.de oparty na Playwright, pełne przeczesanie odwróconego ATS iCIMS, filtr zdalnej kwalifikowalności krajowej, tempo zapytań DNS, deduplikacja `rltr` StepStone oraz znormalizowana kolumna firmy w historii skanów — nie mają zastosowania: web-ui uruchamia skanery EN/RU w procesie i nie wywołuje `scan.mjs`.
- **Już pokryte.** Poprawka składania akcentów w `role-matcher` (#2209) została przeniesiona w v1.127.0, więc tutaj jest no-op.

## [1.129.1] — 2026-07-29

### Naprawiono
- **Następstwa przeglądu AI portów web z v1.128/v1.129** (wszystkie doradcze, naprawione u źródła): precedencja poziomu w `job-facets.js` (jawny modyfikator wygrywa teraz ze słowem menedżerskim — `Senior Engineering Manager` → `senior`, było `lead`); fallback w `states.mjs` nie jest już przypięty (udany odczyt jest memoizowany, fallback zwracany bez cache — chwilowo niedostępny rodzic przy starcie jest odczytany ponownie) + `console.warn` przy obecnym, lecz uszkodzonym pliku; `score-tone.js` — wiersz bez oceny jest neutralny (`muted`), nie czerwony; `domainFromName()` pomija sluggi nie-ASCII przed `/api/logo`; +strażnik izolacji w `tests/states.test.mjs`. +4 testy → **2073**.

## [1.129.0] — 2026-07-29

### Dodano
- **Faseta poziomu + kolumna wieku w `#/scan`** — biblioteka `job-facets.js` z v1.128.0 jest teraz wpięta w UI skanowania (wcześniej tylko logika). Nowa lista **Poziom** klasyfikuje tytuł każdej oferty na lead/staff/senior/mid/junior/stażysta (`JobFacets.seniorityFromTitle`) i wypełnia się tym, co faktycznie jest w wynikach (jak faseta Kraj); tytuły bez słowa poziomu zawsze przechodzą. Utrzymywana w zapisanych wyszukiwaniach, Resecie i Zastosuj. Tabela zyskuje kolumnę **Poziom** (badge) i beztokenową kolumnę **Wiek** (`dziś` / `Nd`, z `JobFacets.daysSince`). 12 kluczy i18n ×17, +3 testy → **2069**.

## [1.128.0] — 2026-07-29

### Dodano
- **Cztery rozwiązania przeniesione z własnej aplikacji web rodzica (`../web/`, Next.js)**, przepisane w czystym JS/ESM, bez nowych zależności: (1) `server/lib/states.mjs` czyta `templates/states.yml` na żywo jako kanoniczny słownik statusów trackera (fallback dla CI) — usuwa ręczny re-sync whitelisty co wydanie; POST składa aliasy (hiszpańskie/legacy) do kanonicznej etykiety, funnel w GET grupuje wg statusu kanonicznego; (2) loga firm w wierszach na hoście ATS przez `domainFromName()` (~90 marka→domena); (3) `score-tone.js` — 4-poziomowy ton oceny (≥4.2/3.8/3.0 + fallback literowy); (4) `job-facets.js` — fasety seniority/source/days. +21 testów.

### Uwagi
- Nie przeniesiono (tylko koncept): warstwa akcji agentowych rodzica (`actions/registry.ts` + `api/assistant/route.ts`) — plan na wypadek, gdy `docs-fab` stanie się copilotem. Bez nowych źródeł (rejestr **70**), bez zmian i18n/help.

## [1.127.0] — 2026-07-29

### Dodano
- **Trzy nowe źródła skanowania (parytet career-ops v1.23.0)** — rejestr ma teraz **70 adapterów (65 EN + 5 RU)**: **Flowxtra** (globalny agregator bez auth), **VDAB** (API po słowach kluczowych flamandzkiego urzędu pracy) i **iCIMS** (portale `careers-<tenant>.icims.com`, odrębnie od `jibeapply`). Ponadto **Cursor** wraca do rosteru CLI (parent #2115): `cli-detect` wykrywa teraz `cursor` (**10 narzędzi**), roster przywrócony w help/README/config ×17.

### Naprawiono
- **agenticjobs** przeszedł ze scrapingu HTML na API REST (#2167); **Greenhouse** odzyskuje miasto z `/offices`, gdy `location.name` to tylko model pracy (#2104); parytet **role-matcher** (#1933/#2164/#2009: prefiks MTS, bazowy `product`, składanie akcentów, niezgodność sub-baseline).

### Uwagi
- **Nie przeniesiono.** Większość v1.23.0 to powierzchnia CLI/dashboard nieużywana przez web-ui (batch-tailor, discover-ats, tryby NL/PT, motywy PDF, dashboard Go, updater/doctor); skrypty przekazujące bez zmian. VERSION rodzica → **1.23.0**.

## [1.126.1] — 2026-07-25

### Naprawiono
- **Dwa miejsca dryfu rosteru CLI, które resync v1.126.0 pominął** — (1) intro zakładki **API keys** w `#/config` (`config.providerModelNote`, i18n ×17) wymieniało tylko 7 CLI — teraz **Antigravity** i **Grok Build** są wstawione po OpenCode; (2) drugi wiersz tabeli porównawczej w przewodniku pomocy (×17) oraz budowany w CI help strony wciąż zawierały `Inside Claude Code / Codex / Cursor / Gemini CLI` — przestarzały zestaw z **Cursor** — teraz pełny roster. Oba używały separatorów ukośnik/kropka środkowa, których wzorce zamiatania v1.126.0 nie obejmowały. Snapshot i18n zregenerowany; zestaw pozostaje **1969**.

## [1.126.0] — 2026-07-25

### Dodano
- **Zakładka narzędzi AI CLI wykrywa teraz wszystkie 8 pierwszoklasowych CLI career-ops** — roster `#/config` zsynchronizowano z rodzicielskim `docs/SUPPORTED_CLIS.md`: `server/lib/routes/cli-detect.mjs` zyskuje **Grok Build CLI** (`grok`) i **Kimi CLI** (`kimi`), a Antigravity sonduje teraz najpierw swój kanoniczny binarny `agy`. Skan PATH tylko-do-odczytu raportuje teraz **9 narzędzi**; nadal nigdy nie uruchamia znalezionego binarnego.

### Zmieniono
- **Resynchronizacja dokumentacji z career-ops.org/docs** — każdą powierzchnię dokumentacji uzgodniono z żywymi stronami rodzica (przeczytano wszystkie 31). Kanoniczny roster asystentów AI (help ×17 + README ×17) wymienia teraz 8 pierwszoklasowych CLI — Claude Code, Codex, OpenCode, Antigravity CLI, Grok Build CLI, Qwen Code, Kimi, GitHub Copilot CLI — plus Gemini CLI (starszy wrapper). Pakiety pomocy zachowują strukturę 29 H2 / 105 H3.

## [1.125.4] — 2026-07-23

### Zmieniono
- **zależności site** (dependabot #151–#153) — `sharp` 0.34.5→0.35.3, `svgo` 4.0.1→4.0.2, `fast-uri` (dev) 3.1.3→3.1.4 w `site/`; build Astro zielony, bez wpływu na SPA/serwer.

### Uwagi
- **Przegląd parzystości z projektem nadrzędnym (career-ops `37d17ec..254764a`, po v1.22.0)** — nic do portowania: guard błędnego wiersza w `set-status` (#2108) dotyczy tylko CLI (w web-ui wiersze trackera wybiera się jawnie w UI i żadna trasa nie wywołuje `set-status.mjs`), Risk Summary zlokalizowanych trybów (#2109) dotyczy plików `modes/<lang>/`, których web-ui nigdy nie czyta (tylko `modes/*.md` najwyższego poziomu), weryfikacja manifestu `update-system` (#2111) dotyczy tylko aktualizatora, a reszta to dokumentacja rodzica (turecki README, SIGNATURES ×4, SCRIPTS.md, akcenty es). VERSION rodzica pozostaje **1.22.0** — `parentVersion` bez zmian.

## [1.125.3] — 2026-07-23

### Naprawiono
- **Prompty LLM po duńsku i w hindi odpowiadały po angielsku** (zgłoszone przez użytkownika) — `LOCALE_NAMES` i wszystkie pięć zbiorów `SCAFFOLD_STRINGS` w `server/lib/prompts.mjs` nigdy nie zostały rozszerzone o `da` i `hi`, więc `resolveLocale()` spadał do `en`, a każdy prompt AI — deep research (na żywo i ręczny), tryby, ocena, wywiad, networking, CV Studio — tracił dyrektywę `# Output language` w tych dwóch lokalizacjach. Obie są teraz pełnoprawne: dyrektywa językowa + zlokalizowany szkielet. Bramka regresji w `tests/locale-scaffold.test.mjs` przechodzi teraz kanoniczną listę 17 lokalizacji zamiast zahardkodowanych 12, a nowa bramka strukturalna odrzuca każdy klucz szkieletu spadający do angielskiego — przyszła lokalizacja, która pominie `prompts.mjs`, nie może już zostać wydana (+12 testów, zestaw liczy teraz **1969**).

## [1.125.2] — 2026-07-22

### Naprawiono
- **Deep research przez Gemini: HTTP 502 (`MALFORMED_FUNCTION_CALL`)** (#145, wkład [@Alien10140](https://github.com/Alien10140)) — prompt na żywo `/api/deep` kazał modelowi „Use WebFetch / WebSearch" i zapisać brief do pliku, ale dostawcy API bez narzędzi nie mają kanału narzędzi; Gemini odpowiadał wywołaniem funkcji zamiast tekstem, co objawiało się pustym HTTP 502. `buildDeepPrompt` i `bundleProjectContext` przyjmują teraz flagę `headless`: uruchomienia na żywo (Anthropic/Gemini/kaskada zapasowa) dostają prompt bez narzędzi, piszący brief z wstawionego kontekstu, a prompt do wklejenia w Claude Code zachowuje instrukcje narzędzi. +1 test w `tests/critical-fixes.test.mjs`.

### Zmieniono
- **Domyślne modele Gemini podniesione ponad wycofany `gemini-2.0-flash`** (#144, wkład [@Alien10140](https://github.com/Alien10140)) — lista rozwijana w Konfiguracji, serwerowy fallback w `gemini.mjs` (po cichu niezgodny z podpowiedzią), łańcuch zapasowy OpenRouter, `config.geminiModelHint` ×17 i przewodnik pomocy ×17 wskazują teraz **`gemini-3.6-flash`**. Nowa brama anty-dryfowa `tests/gemini-default-model.test.mjs` (+5 testów) przypina wszystkie powierzchnie do tego samego literału — pakiet liczy teraz **1957 testów**.

## [1.125.1] — 2026-07-21

### Naprawiono
- **SuccessFactors: wielomarkowi najemcy RMK zachowują swoją ścieżkę marki** (rodzic #2099, po v1.22.0) — spółki holdingowe prowadzące kilka przejętych marek na jednej wspólnej instancji RMK odróżniają je segmentem ścieżki (`careers.nemetschek.com/Bluebeam/` kontra `…/Vectorworks/`); adapter wcześniej zwijał skonfigurowany adres URL do jego origin, po cichu skanując oferty marki nadrzędnej. Endpoint zachowuje teraz prefiks marki, usuwając wyłącznie końcowy segment `/search/` lub `/tile-search-results/`, dzięki czemu nic nigdy się nie duplikuje; najemcy z pojedynczą domeną pozostają identyczni co do bajtu. Nowy eksportowany helper `resolveTenantBase` + 1 przeniesiony blok testowy w `tests/sources-successfactors.test.mjs`.

## [1.125.0] — 2026-07-21

### Dodano
- **cvstart.org: sekcja landingu „Źródła ofert”** — nowa sekcja między zrzutami ekranu a porównaniem, która wymienia **wszystkie 67 źródeł skanowania jako klikalne chipy** (62 anglojęzyczne tablice/ATS + 5 rosyjskich tablic pod osobnym nagłówkiem), każde z linkiem do publicznej strony źródła. Lista jest synchronizowana z aktywnym rejestrem adapterów podczas budowania (`sync-assets.mjs` → `facts.sources`), więc nigdy nie może rozjechać się z aplikacją; kuratorowana mapa linków w `Sources.astro` jest zabezpieczona nowym testem `tests/site-sources.test.mjs`. Nawigacja w nagłówku zyskała kotwicę **Sources**; dodano 4 nowe klucze i18n serwisu ×17. Naprawiono też listę `inLanguage` w JSON-LD landingu, w której wciąż brakowało `hi`.

## [1.124.0] — 2026-07-21

### Dodano
- **Pięć źródeł skanowania** (parytet z rodzicem v1.22.0, #1808/#1572/#2024/#2055) — **Welcome to the Jungle** (ogólnoplatformowe API JSON obejmujące całą tablicę ofert), **Agentic Engineering Jobs** (tablica ofert dla ról agentic/AI-engineering), **Jobvite** (bezautoryzacyjny ATS per-tenant), **Gem** (ATS per-tenant) oraz **Alibaba Group** (API JSON strony kariery, wzorzec Meituan/Tencent). Każde z nich to para źródło + adapter przypięta do hosta i izolowana dla CI; rejestr obsługuje teraz **67 adapterów (62 EN + 5 RU)**; zaktualizowano rezerwowy rozwijany wybór Źródła na `#/scan` oraz jego bramkę kontrolną; pięć nowych zestawów testów `tests/sources-{wttj,agenticjobs,jobvite,gem,alibaba}.test.mjs`.

### Naprawiono
- **Arbeitsagentur: ogólnokrajowa praca zdalna tylko gdy `homeofficetyp` to `VOLLSTAENDIG`** (rodzic #1981) — zapytanie `homeoffice=nv_true` zwraca również role hybrydowe, więc przebieg weryfikacji pracy zdalnej potwierdza teraz każde trafienie względem endpointu szczegółów oferty w małych partiach (a przy błędzie wyszukiwania zachowuje bezpieczne, ostrożne działanie — zachowuje rzeczywiste miasto oferty, więc filtry lokalizacji nadal działają).
- **SmartRecruiters: publiczne adresy URL ofert budowane bez `/postings/`** (rodzic #2047) — linki trafiają teraz na publiczną stronę oferty zamiast na błąd 404 dla najemców, których publiczna witryna pomija ten segment.

### Uwagi
- Rodzic v1.22.0 wydał też zmiany po stronie CLI, w które interfejs webowy się nie włącza lub które już pokrywa: szablon CV zh-CN + typografia PDF, tryb `/expand`, poprawki cache promptów dostawców (Gemini/OpenAI/Ollama), podział zużycia tokenów na poszczególne kroki (interfejs webowy ma własny miernik użycia), serializacja blokady zapisu trackera (interfejs webowy kieruje zapisy przez `withFileLock` od v1.21), flagi CLI skanowania `visa_filter` oraz bezwzględna data publikacji (interfejs webowy ma własny filtr wieku „Opublikowano w ciągu”) oraz seedowanie deduplikacji widzianych źródeł (skaner interfejsu webowego utrzymuje własną deduplikację historii skanowania).

## [1.123.0] — 2026-07-17

### Dodano
- **Źródło skanowania Oracle Recruiting Cloud** (parytet z rodzicem v1.21.0, #1929) — bezautoryzacyjne REST API `recruitingCEJobRequisitions` witryn kariery Oracle Fusion/ORC (JPMorgan Chase, Oracle, BNY Mellon, American Express, Honeywell, …): host przypięty do wzorca `*.fa[.<region>][.ocs].oraclecloud.com`, numer witryny wyznaczany z `careers_url` każdej śledzonej firmy, paginacja offsetowa z twardym limitem liczby stron oraz nagłówki naśladujące przeglądarkę, odporne na WAF. Rejestr obsługuje teraz **62 adaptery (57 EN + 5 RU)**; zaktualizowano rezerwowy rozwijany wybór Źródła na `#/scan` oraz jego bramkę kontrolną; nowy, izolowany dla CI zestaw testów `tests/sources-oraclecloud.test.mjs`.

### Naprawiono
- **Detektor powtórzeń ofert: tytuły bazowe pozostają odrębne od wariantów ze specjalizującym sufiksem** (rodzic #1922) — „Senior Analytics Engineer” nie jest już grupowany z „Senior Analytics Engineer, People Analytics”: gdy tokeny jednego tytułu są ścisłym podzbiorem tokenów drugiego, a dodatkowy token jest rzeczywistą specjalizacją (a nie słowem bazowym), oba ogłoszenia są traktowane jako osobno możliwe do zgłoszenia oferty. Adnotacje o ponownej publikacji („(Repost)”, „relisted”) są teraz traktowane jako szum semantyczny (stop-words). +2 asercje w `tests/detect-reposts.test.mjs`.

### Uwagi
- Rodzic v1.21.0 wydał też zmiany po stronie CLI, w które interfejs webowy się nie włącza lub które już pokrywa: ostrzeżenie o ponownym aplikowaniu do tej samej firmy (interfejs webowy ma własny cooldown ponownego aplikowania od v1.84.0), flagi `--format`/`--report` listu motywacyjnego, tryby promptu e-mail dla rozmowy kwalifikacyjnej (czerwone flagi / analiza panelu / brak stawienia się), trwałość sygnałów zaufania skanowania i kondycji portali (interfejs webowy uruchamia własny skaner in-process z `trust-validator` oraz stronę kondycji portali) oraz rozszerzenia statystyk/luki wynagrodzeniowej (przekazywane wyłącznie do odczytu i z bezpieczną degradacją).

## [1.122.0] — 2026-07-16

### Dodano
- **Hindi (हिन्दी) — 17. język** — pełny słownik interfejsu (~1110 kluczy), kompletny wbudowany przewodnik pomocy (parytet 29 H2 / 105 H3), `README.hi.md`, nowy `CHANGELOG.hi.md` (zaczynający się od v1.122.0, zgodnie z precedensem de/it/tr), strony landingu cvstart.org + Metodologia/Licencja/Dziennik zmian/Pomoc, przełącznik języka (🇮🇳), automatyczne wykrywanie języka przeglądarki oraz zlokalizowany zrzut ekranu dashboardu. Każda bramka parytetu ×16 działa teraz jako ×17: parytet słownika i18n + migawka, bramki H2/H3 pomocy, parytet dziennika zmian, `check-i18n` witryny oraz przegląd lokalizacji Playwright.

## [1.121.0] — 2026-07-16

### Dodano
- **cvstart.org: strony Metodologia, Licencja i Dziennik zmian** — landing zyskał trzy nowe sekcje we wszystkich 16 językach, obok istniejącego bloku Porównanie: **/methodology/** (sześciowymiarowa skala oceniania 0.0–5.0, próg aplikowania 4.0 oraz zasady, których system nigdy nie łamie — zlokalizowane streszczenie [career-ops.org/methodology](https://career-ops.org/methodology)), **/license/** (kanoniczny tekst licencji MIT z odniesieniem do NOTICE.md) oraz **/changelog/** (ten plik, renderowany dla każdego języka z 16 przetłumaczonych plików CHANGELOG w repozytorium). Nowa pozycja **Metodologia** w nagłówku i linki Zasoby w stopce; `sync-assets.mjs` synchronizuje teraz CHANGELOG ×16 oraz LICENSE do landingu podczas builda, dzięki czemu strony te nigdy nie mogą rozjechać się z repozytorium.
- **Linki do metodologii w całej dokumentacji** — README (wszystkie 16 języków), lista kanonicznych odniesień §1 wbudowanego przewodnika pomocy (wszystkie 16 języków) oraz wiki teraz linkują do [career-ops.org/methodology](https://career-ops.org/methodology) (a także FAQ i słownik pojęć) obok istniejących przewodników [career-ops.org/docs](https://career-ops.org/docs).

### Zmieniono
- Odświeżono baner wydania i odznaki w README (testy 1850, wydanie v1.121.0) — baner wciąż ogłaszał v1.119.5.

## [1.120.0] — 2026-07-16

### Dodano
- **Manifest CareerOps** (parytet z rodzicem v1.20.0) — projekt nadrzędny wydał Manifest CareerOps (`MANIFESTO.md` · [career-ops.org/manifesto](https://career-ops.org/manifesto)) i teraz eksponuje go w swoim README, aktualizatorze i dashboardzie w Go. Interfejs webowy idzie tym samym śladem: nowy link w stopce paska bocznego otwiera stronę manifestu (nowy klucz i18n `footer.manifesto` we wszystkich 16 lokalizacjach), wbudowany przewodnik pomocy zyskał §29 „Manifest CareerOps" we wszystkich 16 językach, README wyjaśnia, czym jest manifest i jak go podpisać, a stopka landingu cvstart.org też do niego linkuje.

### Uwagi
- Rodzic v1.20.0 naprawił też tłumienie znanych umiejętności w ukierunkowanym trybie `upskill`, wyciszył dotenv, żeby stdout `scan --json` pozostawał parsowalny, oraz poprawił szablon HTML CV, aby nagłówek roli nie odrywał się od swoich punktów — to powierzchnie po stronie CLI, w które interfejs webowy nie wchodzi przez shell; nie było potrzeby żadnej zmiany kodu web-ui.

## [1.119.5] — 2026-07-13

### Naprawiono
- **Przycisk języka na landingu już się nie zawija** — po dodaniu flag w v1.119.2 etykieta przełącznika w nagłówku (np. «🇷🇺 Русский») mogła łamać się nawet na trzy linie przy wąskich szerokościach desktopu; etykieta przełącznika i wszystkie opcje listy mają teraz `whitespace-nowrap` — flaga + endonim zawsze w jednej linii. Lista języków w stopce przeszła ze sztywnej dwukolumnowej siatki na zawijany rząd jednoliniowych pozycji — «🇧🇷 Português (Brasil)» też nie łamie się już w środku nazwy.

## [1.119.4] — 2026-07-13

### Zmieniono
- **LICENSE wskazuje autora** — linia praw autorskich brzmi teraz: *Sergei Emelianov (Fighter90) <https://sergey-cv.com> and career-ops-ui contributors* (kanoniczny tekst MIT nietknięty). Nowy **NOTICE.md** szczegółowo opisuje licencjonowanie: kto posiada prawa autorskie, co dokładnie obejmuje grant MIT (kod, dokumentację, tłumaczenia, landing, wiki), czego NIE obejmuje (twoje dane w runtime, projekt nadrzędny, treści z tablic ogłoszeń, znaki towarowe), tabelę komponentów zewnętrznych (express/js-yaml — MIT; Astro/Tailwind — MIT; fonty Figtree i JetBrains Mono — SIL OFL 1.1; sharp — Apache-2.0) oraz opcjonalną linię atrybucji.

## [1.119.3] — 2026-07-13

### Dodano
- **SECURITY.md** — polityka bezpieczeństwa, do której odsyłał CONTRIBUTING, teraz istnieje: wspierane wersje, prywatny proces zgłoszeń (w repozytorium **włączono private vulnerability reporting** GitHuba — zakładka Security → „Report a vulnerability"), model zagrożeń dla aplikacji jednego użytkownika na localhost (w zakresie: XSS przez wrogie oferty / SSRF / path traversal / wycieki sekretów / osłabianie CSP; poza zakresem: DoS własnego localhosta i problemy projektu nadrzędnego) oraz bazę hardeningową dla recenzentów.

## [1.119.2] — 2026-07-13

### Dodano
- **CONTRIBUTING.md** — przewodnik współtwórcy, do którego landing i README linkowały od początku, teraz istnieje: konfiguracja, mapa projektu, twarde reguły bezpieczeństwa/no-build, poziomy testów, walkthrough „dwóch rejestrów" przy dodawaniu źródła skanowania, kontrakt i18n ×16, konwencje commitów/PR i proces wydania.
- **Flagi języków na landingu** — przełącznik języków cvstart.org, siatka języków w stopce i baner „czytaj w swoim języku" pokazują teraz flagę każdej lokalizacji obok jej endonimu (ten sam zestaw wskaźników regionalnych co w językowym `<select>` aplikacji; degraduje do liter regionu tam, gdzie brak glifów flag).
- **Poprawki stopki landingu** — martwy link Discussions (funkcja nie jest włączona w repozytorium) prowadzi teraz do **wiki** projektu, a stopka wskazuje autora: **Sergei Emelianov** ([sergey-cv.com](https://sergey-cv.com/) · [LinkedIn](https://www.linkedin.com/in/sergey-emelyanov-in-job/)).

## [1.119.1] — 2026-07-13

### Naprawiono
- **Filtr źródeł na `#/scan` dogonił rejestr** — statyczna lista `FALLBACK_SOURCES` za rozwijanym menu Source (używana tylko gdy `GET /api/scan/sources` jest nieosiągalny) po cichu odstawała od v1.87.0: w offline'owym fallbacku brakowało 20 dostawców (Amazon, Avature, SAP SuccessFactors, Get on Board, Dassault Systèmes, beesite, HigherEdJobs, JibeApply (iCIMS), softgarden, Cornerstone, Phenom, Radancy, Deutsche Bahn, EchoJobs, TKMS, Heckler & Koch, Rheinmetall, LaraJobs oraz nowi Meituan / Tencent). Zsynchronizowana ze wszystkimi **61** i objęta testem dryfu, który wywala CI przy rozjeździe listy klienta z rejestrem serwera (wartości I etykiety). +1 test (**1845**).

## [1.119.0] — 2026-07-13

Parytet z nadrzędnym career-ops **v1.19.0** + odświeżenie landingu cvstart.org.

### Dodano
- **2 nowych dostawców skanowania** — Meituan (`zhaopin.meituan.com`) i Tencent (`careers.tencent.com`): publiczne JSON-API chińskich tablic tech bez uwierzytelniania, wykrywane po hoście lub wybierane jawnym `provider:`, z serwerowym wyszukiwaniem per słowo kluczowe, paginacją i deduplikacją po URL — teraz **61 adapterów** (56 EN + 5 RU). +20 testów (**1844**).
- **Blok współtwórców na landingu** — cvstart.org pokazuje awatary wszystkich, którzy wnieśli kod (GitHub API `/contributors` w czasie builda, boty odfiltrowane), zlokalizowany we wszystkich 16 językach, z linkiem do pełnego grafu współtwórców.
- **Żywy licznik gwiazdek GitHub na landingu** — znaczek w nagłówku odświeża się teraz po stronie klienta z GitHub API przy każdej wizycie (migawka z builda jako fallback), a cotygodniowa zaplanowana przebudowa Pages utrzymuje świeżość migawki i listy współtwórców; wywołania API w CI są uwierzytelnione tokenem.

### Naprawiono
- **Żądania Workday CXS niosą przeglądarkowe nagłówki** (rodzic #1813) — tenanty za Cloudflare (widziane na żywo: geico) odpowiadają 500 na żądania bez zwykłych UA/`accept-language`/`origin`/`referer`; fetcher wyprowadza teraz origin i slug site'u z samego URL-a CXS. Żądania Glints dostały ten sam przeglądarkowy UA + origin/referer — oba ze wspólnej stałej `BROWSER_LIKE_USER_AGENT` w `http-json.mjs`.

## [1.118.4] — 2026-07-10

### Naprawiono
- **Skany hh.ru zwracały 0 wyników z rosyjskiego IP (linki subdomeny regionalnej)** — z rosyjskiego IP rezydencjalnego hh.ru przekierowuje wyszukiwanie (302) na subdomenę regionalną (`sochi.hh.ru`, `spb.hh.ru`, …) i zwraca linki ofert na tej subdomenie. Parser szukał linku tytułu po sztywnym hoście `https://hh.ru/vacancy/` i nie trafiał w **żaden** z regionalnych, więc w pełni działający skan po cichu zapisywał 0. Teraz akceptuje dowolny host `*.hh.ru` (reklamy na `adsrv.hh.ru/click?…` nadal są wykluczane — nie mają ścieżki `/vacancy/<id>`) i kanonizuje każdy URL wyniku do `https://hh.ru/vacancy/<id>`. Zweryfikowano na żywo: 17 realnych ofert parsuje się ze strony `sochi.hh.ru`, która wcześniej dawała 0. +1 test (**1824**).

## [1.118.3] — 2026-07-10

### Naprawiono
- **hh.ru po cichu zwracał 0 wyników (strona pośrednia weryfikacji VPN)** — hh.ru przekierowuje teraz (302) sieci uznane za VPN/proxy (IP z datacenter) na stronę pośrednią `/vpncheeck` (“VPN мешает работе сайта”), która odpowiada **HTTP 200** bez ani jednej karty wakatu, więc skan raportował 0 bez żadnego błędu. Skaner wykrywa teraz przekierowanie po finalnym URL odpowiedzi, wyłącza hh.ru do końca przebiegu i wypisuje szczerą wskazówkę: ruch musi naprawdę wychodzić przez rezydencjalne IP — systemowy VPN/proxy może pozostać aktywny nawet przy wyłączonym przełączniku w przeglądarce. +1 test (**1823**).

## [1.118.2] — 2026-07-10

### Utrzymanie
- **Doszlifowanie landingu (#118)** — `site/README.md` uzgodniony z Astro 7 (aktualizacja bezpieczeństwa z #116), usunięty nieużywany import i **+4 wykonywalne strażniki** dla skryptów budowania landingu: bramka parytetu i18n dowodnie pada na zepsutym słowniku, a `sync-assets` nigdy nie pisze poza `site/` — zestaw **1822**. Rozwiązano dwa alerty CodeQL (jeden naprawiony w źródle, jeden odrzucony jako zamierzone zachowanie builda).

## [1.118.1] — 2026-07-10

### Naprawiono
- **Skanowanie hh.ru spoza Rosji** — hh.ru zwraca teraz **HTTP 451** (regionalną blokadę prawną) dla nierosyjskich IP na publicznych stronach wyszukiwania. Skaner traktuje 451 jak 403: po pierwszej blokadzie hh.ru jest wyłączany do końca przebiegu z uczciwym wpisem w logu wskazującym rosyjskie IP / wyjście VPN, dzięki czemu pozostałe zapytania i inne źródła RU nie są marnowane. Pomoc §7 zaktualizowana we wszystkich 16 językach. +1 test (**1818**).

## [1.118.0] — 2026-07-09

Pakiet parytetu z nadrzędnym career-ops **v1.18.0**.

### Dodano
- **9 nowych dostawców skanowania** — Cornerstone OnDemand (`csod`), Phenom (`phenom`), Radancy (`radancy`), Deutsche Bahn (`deutschebahn`), EchoJobs (`echojobs`), TKMS (`tkms`), Heckler & Koch (`hecklerkoch`), Rheinmetall (`rheinmetall`), LaraJobs (`larajobs`) — teraz **54 adaptery**. Adapter Levera dodatkowo wykrywa tablice tenanta EU (`jobs.eu.lever.co`).
- **Status `Hired` w trackerze** (parytet ze `states.yml` rodzica): zaakceptowane oferty mają własny kanoniczny status, świąteczną odznakę i baner „praca zdobyta” na `#/tracker`; lejek i konwersje liczą go jako przejście wszystkich etapów.
- **Zakładka Łącznie w `#/stats`** — przekaźnik tylko do odczytu `stats.mjs` rodzica (łączne zestawienie trackera, skumulowane wskaźniki lejka, wyniki skanera, pokrycie portali) plus obserwacje wynagrodzeń z `salary-gap.mjs` (oczekiwane vs ogłoszone vs rzeczywiste, per aplikacja). Nowe trasy `GET /api/stats/lifetime` i `GET /api/stats/salary-gap` — shell-outy o zerowym koszcie tokenów, bezpieczna degradacja `{available:false}` bez projektu nadrzędnego.
- 28 nowych kluczy i18n we wszystkich 16 językach; przewodnik pomocy §14/§26 zaktualizowany we wszystkich językach.

### Testy
- +38 testów jednostkowych (trzy zestawy parytetu dostawców + trasy przekaźnika/statusu) — łącznie **1817**.

## [1.117.2] — 2026-07-06

**Poprawka pustego trackera dla shell-outów parytetu.** Skrypty rodzica kończą się kodem 1 i strukturalnym JSON-em `{error}`, gdy tracker nie ma jeszcze aplikacji; tablica follow-upów i zakładka wzorców pokazywały to jako „script-error". Obie trasy przekazują to teraz jako zdrowy stan pusty (`available:true, empty:true`), a UI pokazuje uczciwy komunikat „jeszcze nic". Zweryfikowane na żywo na prawdziwym rodzicu.

Nowe: brak.


## [1.117.1] — 2026-07-06

**Utwardzenie v1.117.0 (triage CodeQL).** Trzy endpointy shell-out (`GET /api/followup`, `POST /api/followup/seed`, `GET /api/stats/patterns`) mają teraz wspólny limiter per-IP (każde żądanie tworzy proces potomny; no-op na loopbacku). Ekstrakcja tekstu z URL w Dodaj do CV usuwa znaczniki do punktu stałego, a potem kasuje wszystkie pozostałe `<`/`>` — dowodliwie pełna sanityzacja tekstu promptu LLM. Bez zmian dla poprawnych danych.

Nowe: brak.


## [1.117.0] — 2026-07-06

**Pakiet parytetu z rodzicem — sześć możliwości nadrzędnego career-ops w UI.** (1) **Tablica kadencji** na `#/followup`: pilność każdej aplikacji (🔴/🟠/🟡/🔵) z `followup-cadence.mjs`, plus przycisk **Zasiej daty** (`followup-seed.mjs --backfill`). (2) **Wzorce odrzuceń**: czwarta zakładka Statystyk uruchamia `analyze-patterns.mjs` (tylko odczyt) — rozkład wyników, rekomendacje, wskaźnik awansu wg dostawcy ATS. (3) **Dodaj do CV**: karta CV Studio zamienia URL lub wklejony tekst w punkty ATS oparte WYŁĄCZNIE na tym źródle (tylko propozycje, bez zapisów; pobranie URL chronione anty-SSRF). (4) **4 nowe źródła skanowania** — beesite, HigherEdJobs (RSS), JibeApply (iCIMS), softgarden — rejestr liczy teraz **50 adapterów (45 EN + 5 RU)**, wszystkie w liście Scan. (5) Krok **pre-skanu dyskwalifikatorów** w checkliście Apply. (6) **Runner reconcile** (`/api/run/reconcile`). Trasy shell-out uczciwie degradują bez skryptów rodzica.

- Nowy moduł `server/lib/routes/followup.mjs` (31.) + nowe trasy + 8 plików source/adapter. Testy: 6 + 7 nowych; zestaw 1737 → 1750. 41 kluczy i18n ×16. Pomoc §13/§17/§24/§26 rozszerzona ×16.

Nowe: `GET /api/followup`, `POST /api/followup/seed`, `GET /api/stats/patterns`, `POST /api/cv-studio/add-entry`, `POST /api/run/reconcile`.


## [1.116.0] — 2026-07-06

**Przeróbka miernika zużycia + pierwszy test end-to-end widżetów.** Miernik zużycia AI (v1.114.0) jest naprawiony i poprawnie przypięty: teraz jest **przypięty na dole lewego paska bocznego** (na całą szerokość, ta sama powierzchnia) i rezerwuje na dole miejsce równe swojej wysokości, aby **menu nigdy nie było zasłonięte** — nawigacja i stopka wersji zawsze przewijają się swobodnie nad nim. **Odświeża się na żywo** (co 15 s, przy fokusie karty i zmianie trasy), a każdy wiersz okna pokazuje teraz prawdziwe **`<tokeny> · <szacowany koszt>`** (paski skalują się względem okna 30-dniowego) zamiast zawsze-100% "udziału". Ponadto: trwała bariera `typeof` w importerze CV zamyka u źródła powracający fałszywy alarm type-confusion CodeQL, a nowy **test end-to-end** Playwright uruchamia oba trwałe widżety w prawdziwej przeglądarce.

- `public/js/lib/usage-hud.js` + `app.css`, `server/lib/cv-import.mjs`. Testy: `tests/playwright-widgets.mjs` (2 E2E) + `tests/usage-hud.test.mjs` (10). Pomoc §6 rozszerzona ×16.

Nowe: brak.


## [1.115.0] — 2026-07-06

**Dopracowanie designu (zachowawcze, marka koralowa zachowana).** Lekki przebieg dopracowania wspólnego systemu projektowego — bez przebudowy, bez zmiany palety. Karty metryk na pulpicie unoszą się teraz i dostają koralową ramkę po najechaniu (jak kafelki szybkich akcji); karty treści unoszą się odrobinę; przyciski primary / dark / danger zyskują cień w spoczynku i delikatne uniesienie po najechaniu dla głębi; duże liczby wyrównują się przez tabular-nums; a interaktywne kontrolki dostają miękką koralową poświatę fokusa za wyraźnym pierścieniem klawiatury 2px. Cały ruch respektuje `prefers-reduced-motion`, a poświata jest ograniczona do kontrolek — nigdy globalne `*:focus-visible`.

- Tylko CSS (`public/css/app.css`); bez zmian znaczników, i18n, tras ani CSP. Testy: `tests/design-polish-v1115.test.mjs` (5). Zweryfikowane na żywo Playwrightem.

Nowe: brak.


## [1.114.0] — 2026-07-06

**Miernik użycia i kosztu AI w pasku bocznym (lewy dolny róg).** Zwarta sekcja **ZUŻYCIE** znajduje się teraz na dole paska bocznego (stała karta w lewym dolnym rogu, gdy nie ma paska; w prawym dolnym w RTL) na każdej stronie. Pokazuje zużycie tokenów LLM w oknach **24h / 7d / 30d** — każde jako `<tokeny> · <udział%>` z zielonym paskiem (udział w całości) — plus stopkę z szacowanym kosztem 24h. Dane to tylko do odczytu podsumowanie `GET /api/usage` z `data/llm-usage.jsonl` (tylko lokalnie), to samo źródło co strona `#/usage`; koszt jest szacunkowy, a uruchomienia w trybie ręcznym są darmowe i nieliczone. Zwijane — nagłówek przełącza, a stan jest zapamiętywany.

- Nowy widget kliencki `public/js/lib/usage-hud.js` ładowany z `index.html`, montowany w pasku bocznym nad stopką wersji (rezerwowo stały róg). Bezpieczny dla CSP; zależny od motywu i lustro RTL. Bez nowej trasy serwera. Testy: `tests/usage-hud.test.mjs` (8). 3 nowe klucze i18n ×16.

Nowe: brak.


## [1.113.0] — 2026-07-06

**Pływający asystent „Zapytaj pomoc" na każdej stronie.** Gradientowy przycisk czatu z robotem unosi się teraz w prawym dolnym rogu (w lewym dolnym w RTL) każdej strony. Kliknij, aby otworzyć zwarty czat odpowiadający na pytania o użytkowanie WYŁĄCZNIE na podstawie wbudowanego przewodnika pomocy w Twoim języku — ten sam endpoint co strona `#/docs-assistant` (`POST /api/docs-assistant/ask`), więc nigdy nie czyta Twojego CV, profilu ani trackera. Na żywo z kluczem LLM; bez klucza → gotowy prompt. Nagłówek pokazuje awatar robota + status online; chipy podpowiadają częste pytania; Esc lub kliknięcie poza zamyka; ukrywa się na stronie `#/docs-assistant`.

- Nowy widget kliencki `public/js/lib/docs-fab.js` montowany globalnie z `index.html`; bezpieczny dla CSP; style zależne od motywu i lustro RTL w `app.css`. Bez nowej trasy serwera. Testy: `tests/docs-fab.test.mjs` (8). 6 nowych kluczy i18n ×16. Pomoc §1 rozszerzona w miejscu.

Nowe: brak.


## [1.112.0] — 2026-07-06

**Konsolidacja dokumentacji i QA.** Bez widocznych zmian w kodzie. Dokument konwencji SDD (`docs/sdd/CONVENTIONS.md`) zaktualizowany do obecnych **30 modułów tras** (było 24) i obecnej bazy testów; wiążący ogólnoprojektowy prompt QA (`qa/QA-REGRESSION-PROMPT.md`) skonsolidowany — mechanika wydania odświeżona (v1.111, parentVersion 1.17.0, publikacja wyzwalana zdarzeniem wydania), tabela dodatków §14 poprawiona (Wyklucz w Scan przeetykietowane na v1.109.0) i rozszerzona o domknięcie CodeQL z v1.111 — więc stanowi samodzielny, jedyny prompt regresyjny dla całej funkcjonalności. Dodaje jeden test pokrycia dla gałęzi zbyt dużego przesłania.

Nowe: brak.


## [1.111.0] — 2026-07-06

**Bezpieczeństwo — domknięcie backlogu CodeQL.** Trzy wzmocnienia obrony w głąb, które zamykają pozostałe znaleziska analizy statycznej u źródła, zamiast je odrzucać (dismiss). `stripDangerousMarkdown` eskejpuje teraz `<` w każdym *uciętym* otwarciu niebezpiecznego znacznika (ładunek kończący się na `<script`/`<iframe`/…), więc jego wyjście w sposób dowodliwy nie zawiera żadnego żywego niebezpiecznego znacznika. Import CV odczytuje rozmiar wgranego bufora przez jawną koercję `Number()` — bariera przeciw pomyleniu typów. Wiersze roli trybów są teraz szablonowymi **łańcuchami** interpolowanymi przez `String.replace`, a nie przechowywanymi funkcjami, co całkowicie usuwa wywołanie dynamicznego rozsyłania. Bez zmian widocznych dla użytkownika.

- `server/lib/security.mjs`, `server/lib/cv-import.mjs`, `server/lib/prompts.mjs`. Testy: `tests/security-hardening-v1111.test.mjs` (7) + zaktualizowany test-strażnik v1108. Bez zmian i18n/pomocy/tras.

Nowe: brak.


## [1.110.0] — 2026-07-06

**Odświeżenie dokumentacji i QA (wszystkie języki).** Bez zmian w kodzie. Prompt QA całego projektu odświeżony do v1.109.0 z nowym §14 (v1.98→v1.109), a wieczne prompty UX-audit i design-export zyskują aktualny zestaw stron. Każdy akapit pomocy dodany w v1.100–v1.109 jest teraz przetłumaczony na **wszystkie 16 języków**.

Nowe: brak.


## [1.109.0] — 2026-07-06

**Filtr Wyklucz w Scan + przegląd pipeline (parytet układu web).** Na `#/scan` pole **Szukaj** traktuje teraz przecinki jako **LUB** ("role do znalezienia"), a nowe pole **Wyklucz** ukrywa wiersze, których firma/rola/lokalizacja zawiera któreś ze słów oddzielonych przecinkami (np. `senior, staff`); oba są zapamiętywane w zapisanych wyszukiwaniach. Na `#/pipeline` zwarty **pasek przeglądu** pokazuje pipeline na pierwszy rzut oka — **N w skrzynce**, **N śledzonych** oraz liczby **Applied / Responded / Interview / Offer** z trackera, każdy chip linkuje do `#/tracker`.

- Tylko klient (bez nowej trasy/zapisów). `public/js/views/scan.js` + `public/js/views/pipeline.js`. Testy: `tests/scan-pipeline-ui-v1109.test.mjs` (2). 4 nowe klucze i18n ×16. Pomoc §7 + §8 rozszerzone w miejscu.

Nowe: brak.


## [1.108.0] — 2026-07-06

**Wzmocnienie bezpieczeństwa (triage CodeQL, runda 2).** Naprawiono trzy kolejne znaleziska niskiej wagi: konstruktor promptów rozwiązuje linię roli locale przez **własny klucz + `typeof === function`**, aby sfałszowane locale nie mogło wywołać metody prototypu (unvalidated-dynamic-method-call); slug nazwy pliku PDF jest **ograniczony do 200 znaków przed regexem**, aby wejście z samych myślników nie cofało się (wielomianowy ReDoS); a import dokumentu **konwertuje tablicowy `filename`** (powtórzony nagłówek) na string (type-confusion). Bez zmiany zachowania dla poprawnego wejścia.

- `server/lib/prompts.mjs`, `server/lib/routes/runners.mjs`, `server/lib/cv-import.mjs` + `tests/security-hardening-v1108.test.mjs` (3). W v1.106–v1.108 zaległości analizy statycznej spadły ze 167 do ~14, każde naprawdę istotne dla bezpieczeństwa znalezisko naprawiono, a resztę (zabezpieczone/oczyszczone fałszywe alarmy + lint poziomu note) odrzucono z uzasadnieniem.

Nowe: brak.


## [1.107.0] — 2026-07-06

**Wzmocnienie sanitizera (obrona w głąb przed XSS w spoczynku).** `stripDangerousMarkdown` — neutralizuje niebezpieczny HTML w zapisanym markdownie CV/oferty, aby każdy konsument omijający klienta z eskejpowaniem-przy-renderowaniu pozostał bezpieczny — teraz uruchamia czyszczenie tagów **do punktu stałego** (powtarzaj do ustabilizowania), aby usunięcie *przekształcające* ładunek (np. `<scr<script></script>ipt>`) zostało wychwycone, dopasowuje tagi zamykające script/style itp. **ze śmieciami na końcu** (`</script foo>`) i usuwa **niezamknięty** wykonywalny otwieracz (`<script …>`). Zachowanie dla poprawnego markdownu bez zmian — usuwa tylko więcej.

- `server/lib/security.mjs`: pętla punktu stałego (limit 8 przebiegów) + wzorce zamykające `[^>]*>` + usuwanie niezamkniętego otwieracza. +3 przypadki regresji w `tests/cv-xss-bypasses.test.mjs`. Autorytatywna granica XSS pozostaje eskejpowaniem na wyjściu (`UI.md`); to wzmacnia gwarancję w spoczynku i zamyka odpowiadające znaleziska CodeQL.

Nowe: brak.


## [1.106.0] — 2026-07-06

**Wzmocnienie bezpieczeństwa (triage CodeQL).** Naprawiono trzy realne (choć niskiej wagi) znaleziska po przeglądzie zaległości analizy statycznej: ścieżka błędu renderowania **teraz eskejpuje komunikat błędu** zanim trafi do DOM (błąd serwera może odbić dane użytkownika, więc traktowany jest jako niezaufany — granica XSS), a zapisy właściwości profilu/konfiguracji **odrzucają klucze `__proto__` / `constructor` / `prototype`** (zabezpieczenia przed zanieczyszczeniem prototypu na wszelki wypadek — klucze pochodzą ze stałych specyfikacji pól, nie z surowego wejścia). Większość pozostałych alertów to fałszywe alarmy dotyczące legalnych odczytów/zapisów skanera w `data/*` oraz tras już mających własny limiter; odrzucono z uzasadnieniem.

- `public/js/router.js` eskejpuje `err.message` przez `UI.escapeHtml` przed `innerHTML`; `server/lib/routes/content.mjs` i `server/lib/routes/config.mjs` chronią klucze prototypu. Bez zmiany zachowania dla poprawnego wejścia. Testy: `tests/security-hardening-v1106.test.mjs` (3). Brak nowych kluczy i18n.

Nowe: brak.


## [1.105.0] — 2026-07-06

**Strona zużycia i kosztu AI.** Nowa strona **Zużycie AI** (pasek boczny, obok Kondycji) pokazuje, ile tokenów wydałeś na **na żywo** generacje AI — oceny, raporty, czaty — w podziale **wg dostawcy** za ostatnie 24 godziny, 7 dni, 30 dni i cały czas, z **szacowanym kosztem w USD**. Każde wywołanie na żywo dopisuje mały rekord `{provider, in, out}` do `data/llm-usage.jsonl` (nic nigdzie nie jest wysyłane); uruchomienia bez klucza (tryb ręczny) nic nie kosztują i nie są rejestrowane.

- Nowy moduł trasy (30.) `server/lib/routes/usage.mjs` — `GET /api/usage` (agregaty tylko do odczytu) + `server/lib/llm-usage.mjs` (`recordUsage` normalizuje formy usage Anthropic/OpenAI/Gemini i dopisuje best-effort; `readUsage`/`aggregate` agregują wg okna 24h/7d/30d/całość × dostawca) + `server/lib/llm-pricing.mjs` (**edytowalna** tabela cen wg dostawcy `$/1M` tokenów — tokeny są dokładne, dolary to przybliżone ceny katalogowe do skorygowania; nigdy nierozliczane). Rejestracja jest podpięta w punktach dyspozytorskich (`runActiveProvider` + `routes/llm.mjs`).
- Nowy widok `public/js/views/usage.js` (`#/usage`, karty okna). Testy: `tests/usage-routes.test.mjs`. 17 nowych kluczy i18n ×16 (`usage.*` + `nav.usage`). Pomoc §6 rozszerzona w miejscu.

Nowe: `server/lib/routes/usage.mjs`; `server/lib/llm-usage.mjs`; `server/lib/llm-pricing.mjs`; `public/js/views/usage.js`.


## [1.104.0] — 2026-07-06

**Logo firm w tabeli skanowania (z poszanowaniem prywatności).** Nowy przełącznik **Wygląd** w **Ustawieniach** — **Pokazuj logo firm w tabeli skanowania** (domyślnie wyłączony) — rysuje logo każdej firmy obok jej nazwy w `#/scan`. Logo to **favicon firmy pobrany z jej własnej domeny** i przekazany przez proxy po stronie serwera (`GET /api/logo`), więc **żadna zewnętrzna usługa logo nie dowiaduje się, których pracodawców przeglądasz**. Oferty na współdzielonym portalu (Greenhouse, Lever, Ashby, …) pokazują kolorową **odznakę z literą** zamiast ikony portalu, a każde logo, które się nie załaduje, wraca do tej samej odznaki.

- Nowy moduł trasy (29.) `server/lib/routes/logos.mjs` — `GET /api/logo?domain=`. Waliduje domenę (bez schematu/ścieżki/loopback), pobiera `/favicon.ico` przez **bezpieczny wobec SSRF `safeGet`** (nowy tryb `binary` zwraca surowe bajty + content-type; przypinanie DNS, walidacja przekierowań i limit rozmiaru bez zmian), wykonuje **sniffing sygnatury obrazu**, by nigdy nie podać strony błędu HTML jako obrazu, buforuje trafienia **i** pudła w LRU w pamięci i **niczego nie zapisuje na dysku**.
- Nowa biblioteka kliencka `public/js/lib/company-logo.js` (`window.CompanyLogo`): domyślnie wyłączona przez flagę localStorage; pomija współdzielone hosty ATS na rzecz deterministycznego awatara-litery; bezpieczny dla CSP fallback `img.onerror`. Testy: `tests/logo-routes.test.mjs`. 5 nowych kluczy i18n ×16 (`appear.*`). Pomoc §2 rozszerzona w miejscu.

Nowe: `server/lib/routes/logos.mjs`; `public/js/lib/company-logo.js`.


## [1.103.0] — 2026-07-06

**Ustawienia: „Narzędzia CLI AI" — które są zainstalowane.** career-ops działa w oparciu o Claude Code, ale współpracuje z dowolnym agentowym CLI zgodnym z otwartym standardem skills. Nowa karta **Narzędzia CLI AI** w **Ustawieniach** (`#/config`) pokazuje, które z nich — Claude Code, Codex, Gemini CLI, OpenCode, GitHub Copilot CLI, Qwen, Antigravity — są zainstalowane na maszynie z serwerem, i ich ścieżki. To **skan PATH tylko do odczytu**: sprawdza jedynie, czy dany plik binarny istnieje, i **nigdy go nie uruchamia** (bez `--version`, bez wykonania), niczego nie zapisuje i nie dotyka danych użytkownika.

- Nowy moduł trasy (28.) `server/lib/routes/cli-detect.mjs` — `GET /api/cli-detect`. Wykrywanie rozwiązuje ścieżkę pliku binarnego z ustalonej 7-elementowej listy dozwolonych po `process.env.PATH` (shimy `.cmd/.exe/.bat` w Windows; bit wykonania w POSIX); wrogi plik w PATH nigdy nie zostanie uruchomiony przez tę trasę.
- Nowa karta „Narzędzia CLI AI" w `public/js/views/config.js` (leniwe ładowanie, deep-link przez `#/config?tab=cli`). Testy: `tests/cli-detect-routes.test.mjs`. 8 nowych kluczy i18n ×16 (`cli.*` + `config.tabCli`). Pomoc §2 rozszerzona w miejscu.

Nowe: `server/lib/routes/cli-detect.mjs`.


## [1.102.0] — 2026-07-05

**"Zapytaj przewodnik" — czat oparty na wbudowanym przewodniku pomocy.** Nowa strona **Zapytaj przewodnik 💬** (pasek boczny, pod Pomocą): wpisz pytanie jak "Jak skanować portale z ofertami?" i otrzymaj odpowiedź **wyłącznie** z przewodnika pomocy aplikacji w Twoim języku — pokazuje użyte sekcje i **nigdy nie czyta Twojego CV, profilu ani szukania pracy**. To o tym, jak używać aplikacji, nie o Tobie. Z kluczem LLM odpowiada na żywo; bez klucza daje gotowy prompt, już wypełniony odpowiednimi sekcjami pomocy.

- Nowy moduł trasy (27.) `server/lib/routes/docs-assistant.mjs` — `POST /api/docs-assistant/ask`. **Wyszukiwanie bez zależności:** przewodnik w Twoim języku jest dzielony na sekcje `##` i oceniany według pokrycia słów kluczowych z pytaniem; najlepsze są wstawiane, a model musi odpowiadać z nich lub powiedzieć, że przewodnik tego nie obejmuje (bez zmyślonych funkcji/tras). Współdzielona kaskada dostawców, awaryjny tryb ręczny, limit, **bez zapisów**, nie czyta danych użytkownika.
- Nowy widok `public/js/views/docs-assistant.js`. Testy: `tests/docs-assistant-routes.test.mjs`. 14 nowych kluczy i18n ×16 (`docs.*` + `nav.docsAssistant`). Pomoc §1 rozszerzona w miejscu.

Nowe: `server/lib/routes/docs-assistant.mjs`; `public/js/views/docs-assistant.js`.


## [1.101.0] — 2026-07-05

**CV Studio: dopasuj CV + napisz list motywacyjny pod konkretną ofertę, z rekruterską bramką kontrolną.** Nowa karta **Dopasuj do oferty** na `#/cv-studio`: wklej opis oferty (i opcjonalnie docelową rolę/nagłówek), a CV Studio utworzy **CV dopasowane do tej oferty oraz pasujący list motywacyjny**, a następnie przepuści oba przez **bramkę kontrolną** przed wydaniem — `error` blokuje (naprawiane, zanim zobaczysz wynik), `warn` doradza. Mechanika to destylat praktyki coachingu kariery w **ogólne** reguły — rekruter czyta w sekundy, więc istotne doświadczenie idzie na górę, nagłówek pasuje do roli z oferty, wyniki mają konkretne liczby, a list pozostaje krótkim teaserem z jednym mostem „wymóg ↔ Twój pasujący fakt". Opiera się **wyłącznie** na Twoim CV, profilu i two-pager i **nigdy nie zmyśla** — bez zaszytych firm, ról ani historii.

- Nowy endpoint `POST /api/cv-studio/tailor` (rozszerza istniejący moduł cv-studio — bez 27. modułu): `buildTailorPrompt` + ogólna bramka `TAILOR_INSTRUCTIONS`, oparta na `bundleProjectContext`, współdzielona kaskada dostawców, awaryjny prompt bez klucza, z limitem, **bez zapisów**. Wynik eksportuje się do Markdown / PDF / **DOCX** przez współdzielony pasek `report-export.js`.
- Testy: +3 w `tests/cv-studio-routes.test.mjs`. 10 nowych kluczy i18n ×16 (`cvs.tailor*`). Ogólna referencja `docs/prompts/resume-cover.md`. Pomoc §24 rozszerzona w miejscu.

Nowe: `docs/prompts/resume-cover.md`.


## [1.100.0] — 2026-07-05

**Two-pager: automatyczne wypełnianie przez AI z Twojego CV + Podgląd + eksport do PDF/DOCX/Markdown.** Two-pager (`#/two-pager`) zapisuje to, czego naprawdę chcesz od kolejnej roli, ale dotąd każde pole trzeba było pisać ręcznie albo kopiować prompt do innego narzędzia. Teraz **✨ asystent wypełniania AI** działa na żywo z Twoim skonfigurowanym dostawcą — czyta *tylko* Twoje CV + profil (przez `bundleProjectContext`, niczego nie zmyślając), tworzy wszystkie pola (kim jestem / co lubię / niezbędne / czego nie znoszę / warunki wykluczające / nienegocjowalne / docelowe środowisko) i wypełnia formularz, byś sprawdził, edytował i zapisał. Bez klucza API wraca do okna „skopiuj prompt”, jak wcześniej. Nowy przycisk **👁 Podgląd i eksport** renderuje two-pager jako sformatowany dokument z paskiem **Pobierz .md / Zapisz jako PDF / Zapisz jako DOCX / Kopiuj**.

- **Eksport `.docx` bez zależności.** Nowy `server/lib/docx.mjs` generuje minimalny, ale poprawny `.docx` Office Open XML (ZIP DEFLATE czterech części OOXML, CRC-32 na wpis) — bez nowej zależności runtime (zależności to nadal `express` + `js-yaml`). Nowa trasa `POST /api/export/docx` (`server/lib/routes/export.mjs`, 26. moduł tras; bezstanowa, limit 200 KB, bez zapisów / bez LLM / bez fetch URL). Wpięta w współdzielony `public/js/lib/report-export.js`, więc **raport rynkowy, plan kariery i orientacja zawodowa też zyskują eksport DOCX**.
- Wypełnianie na żywo używa współdzielonej kaskady dostawców (`runActiveProvider` / `providerAvailable`); zwrócony YAML jest parsowany i sprowadzany z powrotem do ograniczonego kształtu two-pager (`parseYamlFields` + `normalizeTwoPager`) — nieznane klucze odrzucane, tablice/łańcuchy ograniczane. Tryb ręczny zachowany.
- Testy: `tests/export-routes.test.mjs`. 4 nowe klucze i18n ×16 (`export.saveDocx`, `twoPager.preview`, `twoPager.aiFilling`, `twoPager.aiFilled`).

Nowe: `server/lib/docx.mjs`; `server/lib/routes/export.mjs`.


## [1.99.0] — 2026-07-05

**Strona kondycji portali** (`#/portals`). Skaner obserwuje zestaw firm w `portals.yml`; slug ATS może po cichu się zepsuć, a ten pracodawca znika ze wszystkich przyszłych skanów. Nowa strona **Portals** wymienia każdą obserwowaną firmę i po kliknięciu **Check portal health** sonduje każdy `careers_url` przez `safeGet` z przypiętym DNS (odporność na SSRF), oznaczając martwe (404 = po cichu odrzucona) — tylko do odczytu. Wzmacnia też zgłaszacz błędów z v1.98.0 po recenzji: bufor błędów wychwytuje teraz sieciowe błędy fetch, a czyszczarka ukrywa nieoznaczone klucze dostawców.

Nowe: `server/lib/routes/portals.mjs`; `public/js/views/portals.js`.


## [1.98.0] — 2026-07-05

**Wbudowany zgłaszacz błędów** (parytet z web `web-v0.2.0` projektu nadrzędnego). Przycisk **🐞 Report a bug** w szufladzie powiadomień zbiera migawkę diagnostyczną z progiem prywatności — wersje, twój ekran, przeglądarkę, podsumowanie kontroli `/api/health` oraz ostatnie 20 błędów z nowego bufora cyklicznego po stronie klienta — plus deterministyczny odcisk deduplikacji (`co-web-<base36>`), pozwala przejrzeć dokładny Markdown, a następnie otwiera wstępnie wypełnione zgłoszenie GitHub. Nic nie jest wysyłane automatycznie; nigdy nie przenosi twojego CV, profilu, odpowiedzi, adresów URL ofert ani kluczy. Nowe biblioteki `logbuf.js` + `bug-report.js`; 11 kluczy i18n ×16; `tests/bug-report.test.mjs`.

Nowe: `public/js/lib/logbuf.js`; `public/js/lib/bug-report.js`.


## [1.97.1] — 2026-07-05

**Wzmocnienia po przeglądzie i parytet dokumentacji (kontynuacja v1.97.0).** Przegląd logów AI-review ujawnił realne poprawki:

- **`fit-score.js` (odznaka dopasowania `◎` przy skanowaniu).** `salaryFloor()` nie przekształca już stawki poniżej rocznej w fałszywy roczny próg — „at least 500 EUR/day", „$80/hr", „6000 monthly" zwracają teraz `null` zamiast dealbreakera 500k/80k. Dopasowanie krajów odbywa się teraz na całe słowo (`\b…\b`), więc „Germany" nie pasuje już do przymiotnika „German" (ani „Nigeria" wewnątrz „Nigerian") i nie wyzwala fałszywego naruszenia „wymagane-gdzie-indziej". +3 testy w `tests/fit-score.test.mjs`.
- **Parytet dokumentacji.** Każdy zlokalizowany README zgodnie ogłasza teraz **16 lokalizacji** — licznik/lista w wierszu Help (×13) oraz tekst sekcji lokalizacji plus notka „dodaj klucz do wszystkich N plików" (×8) wciąż tkwiły na licznikach sprzed v1.85 (8/9). Licznik adapterów §17 we wbudowanej pomocy poprawiono na **46 adapterów — 41 angielskich + 5 rosyjskich** we wszystkich 16 pakietach.

Brak zmian zachowania poza heurystyką odznaki dopasowania; żadnych nowych tras, kluczy ani dodatków i18n.


## [1.97.0] — 2026-07-05

**Źródło skanera Dassault Systèmes + trójfrontowy przegląd jakości.**

- **Nowe źródło skanowania — Dassault Systèmes (parytet z nadrzędnym career-ops, #1498).** `server/lib/sources/dassault.mjs` + `server/lib/portals/adapters/dassault.mjs` odwzorowują zero-tokenowego dostawcę „card search" Exalead z projektu nadrzędnego (publiczny kanał za `3ds.com/careers/jobs`). To pojedynczy globalny punkt końcowy, więc jest wybierany przez dostawcę (`provider: dassault`) lub automatycznie wykrywany z hosta `3ds.com`, z ochroną przed SSRF, przypięciem hosta do `www.3ds.com` oraz `redirect:'error'`. XML jest parsowany bez DOM (mapy `<Meta>` dla każdego `<Hit>`), miasto/kraj pobierane są ze zlokalizowanego ciągu kategorii, a oferty zachowywane są tylko wtedy, gdy ich publiczny URL znajduje się na `*.3ds.com`. Rejestr dostarcza teraz **46 adapterów** (41 EN + 5 RU); licznik `ALL_ADAPTERS`, asercje posortowanych id oraz EN-zestawu `/api/scan/sources` podniesione z 40 → 41. Zestaw `tests/sources-dassault.test.mjs` (10 przypadków).
- **Przeniesione poprawki odporności z projektu nadrzędnego.** Parser Avature toleruje teraz dwa żywe warianty znaczników najemców (`article--result` z sufiksem indeksu pozycji + bezklasowa kotwica tytułu JobDetail, #1541); Get on Board zabezpiecza `0`/ujemne `published_at` (koniec z błędnymi datami z 1970 roku); SuccessFactors ogranicza ostatnią stronę, by nie mogła przekroczyć `MAX_JOBS` (#1528).
- **Poprawki audytu serwera.** `safe-fetch` nie zawiesza się już przy odpowiedzi przekraczającej limit rozmiaru — ścieżka limitu rozmiaru bezpośrednio rozstrzyga teraz obietnicę zamiast czekać na zdarzenie `'end'`, którego zniszczony strumień nigdy nie wyemituje (naprawia pobrania `/api/pipeline/preview` i auto-pipeline dla dużych stron). Logowanie aktywności SSE `stream.*` jest znów osiągalne (sprawdzenie `/api/stream/` przeniesione ponad zbiorczą ochronę „pomiń GET").
- **Poprawki audytu SPA.** Przełącznik zakładek `#/stats` chroni przed wyścigiem podczas asynchronicznego renderowania — wynik wolnej zakładki nie może już nadpisać nowszej zakładki, na którą użytkownik już się przełączył. Potwierdzenia usunięcia w mock interview i networkingu przekazują teraz właściwy tytuł + treść (koniec z dialogami o pustej treści).
- **Poprawki tłumaczeń.** Poprawiono nieprzetłumaczone wartości słownika — ukraińskie `config.modes*` (Adaptive Framing / Exit Narrative / Location Policy), rosyjskie `eval.jdLbl` („Job Description"), włoskie `dash.quick.contactoSub` („referral" → „segnalazione") — plus angielski szablon **16 lokalizacji** zlokalizowany w CHANGELOG-ach ru/uk/ja/ko/zh-CN/zh-TW.

Nowe: `server/lib/sources/dassault.mjs`; `server/lib/portals/adapters/dassault.mjs`.


## [1.96.0] — 2026-07-04

**Orientacja zawodowa (Epic 27).** Nowa strona **`#/orientation`** odpowiada na pytanie „które kierunki naprawdę do mnie pasują?" — taki odczyt, jaki dałby test predyspozycji zawodowych, ale wywnioskowany z Twojego własnego CV i profilu, a nie z kwestionariusza. Kliknij **Generuj profil**, a model zwróci Twoje **najlepiej dopasowane wektory kariery** (który z ośmiu archetypów — Funkcjonalista, Administrator, Komunikator, Specjalista, Analityk, Innowator, Menedżer, Przedsiębiorca — pasuje, wraz z dowodami), skłonność do typu kariery, rekomendowane role, mocne strony zawodowe powiązane z Twoim CV, tendencje w stylu pracy oraz rekomendacje rozwojowe. To **refleksja AI nad tym, jak czyta się Twoje CV — nie test psychometryczny**: nigdy nie zmyśla osiągnięć i nigdy nie podaje liczbowych wyników tak, jakby były zmierzone. Wyeksportuj profil do Markdown lub PDF; nic nie jest zapisywane na dysku.

- Nowa trasa `server/lib/routes/orientation.mjs` (24. moduł tras) — `POST /api/orientation/generate` buduje prompt profilu z CV+profilu+two-pagera+pamięci poprzez współdzieloną kaskadę dostawców, z ręcznym fallbackiem do skopiowania i wklejenia oraz **bez zapisów na dysku**.
- Ponownie wykorzystuje `report-export.js` do Markdown/PDF/kopiowania, w grupie nawigacyjnej **Wzrost**.
- Testy: `tests/orientation-routes.test.mjs` (ramka refleksji / brak fabrykowanych wyników, tryb ręczny wypełniony z CV/profilu). 7 nowych kluczy i18n ×16 locales, pomoc **§28** ×16.

Nowe: `#/orientation`; `server/lib/routes/orientation.mjs`.


## [1.95.0] — 2026-07-04

**Plan kariery (Epic 26).** Nowa strona **`#/career-plan`** zamienia Twoje CV i profil w konkretny, spersonalizowany plan rozwoju. Wybierz **horyzont** (6/12/24 miesiące) oraz opcjonalny **fokus**, a model — czytając Twoje CV, profil, two-pager i notatkę pamięci — pisze migawkę punktu wyjścia, SWOT mocnych stron i wzrostu, cele w formacie SMART / OKR / WOOP, alternatywne trajektorie, plan umiejętności hard/soft, **mapę drogową miesiąc po miesiącu**, metody śledzenia postępów, pułapki oraz kroki wspierające. Planuje do przodu na podstawie tego, co faktycznie pokazują Twoje materiały, i nigdy nie zmyśla faktów o Twojej historii. Edytuj go w miejscu, **Zapisz** go do warstwy użytkownika (`config/career-plan.md`) i **wyeksportuj** go do Markdown lub PDF.

- Nowa trasa `server/lib/routes/career-plan.mjs` (23. moduł tras) — `GET`/`PUT /api/career-plan` (pisze `config/career-plan.md`) + `POST /api/career-plan/generate` (współdzielona kaskada dostawców, ręczny fallback, bez fabrykowania). `PATHS.careerPlan`.
- Ponownie wykorzystuje współdzielony `report-export.js` (v1.94.0) do Markdown/PDF/kopiowania oraz nową grupę nawigacyjną **Wzrost**.
- Testy: `tests/career-plan-routes.test.mjs` (ograniczanie, round-trip GET/PUT, prompt uwzględniający horyzont, wypełniony z CV/profilu). 20 nowych kluczy i18n we wszystkich **16 locales**, pomoc **§27** ×16.

Nowe: `#/career-plan`; `server/lib/routes/career-plan.mjs`; `PATHS.careerPlan`.

## [1.94.0] — 2026-07-04

**Statystyki na nowo (Epic 25).** Strona `#/stats` to teraz trzyzakładkowa sekcja **Statystyki** z prawdziwymi wykresami i znacznie większą ilością danych. Nowa zakładka **Raport rynkowy** prosi model o analizę wynagrodzeń i rynku pracy dla Twoich docelowych stanowisk w wybranym regionie i walucie — streszczenie zarządcze, wynagrodzenia wg poziomu z percentylami P10/P25/P75/P90, czołowi pracodawcy, tabela poszukiwanych umiejętności, częstość benefitów, podział na biuro/hybryda/zdalnie, trendy na 12–24 miesiące oraz wskazówki negocjacyjne. Każda liczba jest oznaczona jako **orientacyjne oszacowanie z wiedzy modelu**, nigdy nie prezentowana jako dane zescrapowane. Nowa zakładka **Mój pipeline** wykreśla Twój własny tracker: rozkład ocen, lejek statusów, czołowe firmy i stanowiska, aplikacje w czasie oraz współczynniki konwersji. Pierwotny widok docelowych stanowisk (oferty/wynagrodzenia wg kraju + trend zapisanych migawek) trafia pod trzecią zakładkę, teraz z **selektorem waluty** i przeglądem **ofert wg stanowiska**.

- **Wyeksportuj dowolny raport** do Markdown lub PDF albo skopiuj go — przez współdzielony helper `report-export.js` (pobranie bloba Markdown; PDF przez istniejący inline'owy generator PDF).
- Nowa trasa `server/lib/routes/market.mjs` (22. moduł tras) — `POST /api/stats/market` buduje prompt analizy rynku na podstawie Twojego CV/profilu (dzięki czemu zna Twoje docelowe stanowiska), regionu i waluty, uruchamia go przez współdzieloną kaskadę dostawców i wraca do promptu do skopiowania, gdy brak klucza. Bez zapisu plików.
- Testy: `tests/market-routes.test.mjs` (ograniczanie regionu/waluty, prompt z uczciwym oznaczeniem, tryb ręczny wypełniony z CV/profilu). 36 nowych kluczy i18n we wszystkich **16 locales**, pomoc **§26** ×16.

Nowe: `#/stats` przebudowane w zakładki; `server/lib/routes/market.mjs`; `public/js/lib/report-export.js`.

## [1.93.0] — 2026-07-04

**Warstwa pamięci (Epic 24).** Nowa strona `#/memory` przechowuje krótką, edytowalną notatkę „zapamiętaj to o mnie", którą asystent uwzględnia przy **każdym** zadaniu:

- **Jedna notatka, wszędzie** — ponieważ jest wstawiana do `bundleProjectContext`, notatka automatycznie trafia do każdego żądania AI (ocena, próbna rozmowa, networking, CV Studio) u **wszystkich** dostawców. Napisz ją raz; kieruje wszystkim.
- **Sterowanie, nie fakty** — zapisuje Twoje preferencje i sposób, w jaki lubisz pracować (ton, format, granice nie do przekroczenia, kadencję), nigdy nowych faktycznych stwierdzeń o Twoim doświadczeniu — te nadal żyją tylko w Twoim CV, profilu i two-pager. Zapisana w warstwie użytkownika w `config/memory.md`, nigdy nie nadpisywana przez aktualizacje.
- **Sugeruj na podstawie Twoich danych** — `POST /api/memory/suggest` przekopuje Twój własny tracker aplikacji w poszukiwaniu wzorców behawioralnych i szkicuje punkty do przejrzenia i edycji. Czyta Twój tracker; nigdy nie wymyśla faktów i nie wykonuje żadnego wywołania na żywo.

Nowe: `server/lib/routes/memory.mjs` (21. moduł tras — `GET`/`PUT /api/memory` + `POST /api/memory/suggest`), `public/js/views/memory.js`, `PATHS.memory` oraz blok `config/memory.md` dodany do `bundleProjectContext`. 11 nowych kluczy i18n we wszystkich **16 locales**. Testy: `tests/memory-routes.test.mjs`.

## [1.92.0] — 2026-07-04

**CV Studio (Epic 21).** Nowa strona `#/cv-studio` daje Twojemu CV trzy uczciwe, w większości lokalne narzędzia:

- **Diagnostyka CV** — deterministyczny wynik 0–100 z wyjaśnieniami dla każdej kontroli (skwantyfikowany wpływ, słabe czasowniki, modne słowa-wytrychy, długość, kluczowe sekcje, dane kontaktowe). W pełni po stronie klienta (`window.CvDiagnostics`) — bez LLM, nic zmyślonego, każde ustalenie wyjaśnione, byś to *ty* decydował, co zmienić.
- **Maska prywatności** — zamaskuj dane osobowe (e-mail, telefon, linki/nicki, adres oraz opcjonalnie Twoje imię i nazwisko → inicjały) przed udostępnieniem CV jako próbki lub zrzutu ekranu. Działa w całości w przeglądarce (`window.CvPrivacy`); zgłasza dokładnie, co zamaskowała, i nigdy nie przechowuje oryginału.
- **Uczłowiecz to / dopasowanie głosu** — wklej sztywną linijkę lub akapit i przepisz ją w *swoim* głosie, osadzoną po stronie serwera w `voice-dna.md` i `writing-samples/`. Twarda bariera: może przestawiać, zagęszczać i zmieniać ton, ale nigdy nie wprowadza faktu, metryki ani osiągnięcia, którego nie ma już w tekście. Działa na żywo przez współdzieloną kaskadę dostawców albo zwraca gotowy do skopiowania prompt bez klucza.

Nowe: `server/lib/routes/cv-studio.mjs` (20. moduł tras — `POST /api/cv-studio/humanize`), `public/js/views/cv-studio.js`, `public/js/lib/cv-diagnostics.js`, `public/js/lib/cv-privacy.js`, `PATHS.voiceDna` + `PATHS.writingSamplesDir`. 29 nowych kluczy i18n we wszystkich **16 locales**. Testy: `tests/cv-diagnostics.test.mjs`, `tests/cv-studio-routes.test.mjs`. (Galeria szablonów, eksport do Worda oraz archiwum PDF ogłoszeń są śledzone jako dalsze prace nad CV Studio.)

## [1.91.0] — 2026-07-04

**Networking i pogłębiony research firm (Epic 16).** Nowa strona `#/networking` zamienia firmę w wykonalny plan zdobycia rozmowy kwalifikacyjnej, oparty na Twoim CV, profilu i two-pager:

- **Dossier firmy** — zwięzły brief o tym, czym firma się zajmuje, warte zacytowania najnowsze sygnały oraz haczyki „dlaczego pasuję” wyciągnięte z Twojego rzeczywistego doświadczenia.
- **Do kogo się odezwać** — 3–5 docelowych person (hiring manager, wewnętrzny rekruter, starszy IC z zespołu, ciepły kontakt/absolwent tej samej uczelni) z konkretnym ciągiem wyszukiwania LinkedIn, by znaleźć każdą z nich. Nigdy nie zmyśla prawdziwych nazwisk.
- **Najcieplejsza ścieżka wprowadzenia** — najbardziej realistyczna ciepła droga wejścia dla *Twojego* profilu (wspólny pracodawca/uczelnia/społeczność, ścieżka drugiego stopnia lub mocny sygnałowo zimny DM) i dlaczego.
- **Szkice wiadomości** — krótkie, konkretne wiadomości do najważniejszych person, oparte na Twoich rzeczywistych punktach dowodowych.
- **Na żywo lub ręcznie** — działa na żywo przez współdzieloną kaskadę dostawców z dowolnym kluczem albo zwraca gotowy do skopiowania prompt (uczciwy fallback, nic zmyślonego). **Zapisz plan** utrwala ukończony plan w warstwie użytkownika (`networking/net-{company}-{role}-{date}.md`); strona wyświetla, otwiera i usuwa zapisane plany.

Nowe: `server/lib/routes/networking.mjs` (19. moduł tras), `public/js/views/networking.js`, `PATHS.networkingDir`. Wykorzystuje ponownie kaskadę `server/lib/llm-dispatch.mjs` z v1.90.0. 24 nowe klucze i18n we wszystkich **16 locales**. Testy: `tests/networking-routes.test.mjs`.

## [1.90.0] — 2026-07-04

**Mock Interview 2.0 (Epic 15).** Nowa strona `#/mock-interview` zamienia Twoje CV, profil, two-pager i bank historii w turową próbę rozmowy kwalifikacyjnej:

- **Ćwiczenie konwersacyjne** — ustaw docelowe stanowisko (+ opcjonalnie firma / JD), a osoba prowadząca rozmowę otwiera skupionym pytaniem. Każda wysłana przez Ciebie odpowiedź otrzymuje ustrukturyzowaną replikę: **Feedback** (mocne strony + luka STAR+R), **Score** (`N/5`) oraz **Next question**, które bada najsłabszą część Twojej ostatniej odpowiedzi. Osadzone po stronie serwera w Twoich rzeczywistych materiałach — nigdy nie zmyśla doświadczenia, którego nie masz.
- **Świadome banku historii** — `interview-prep/story-bank.md` jest wstawiany do promptu (ten sam poziom zaufania co `cv.md`), dzięki czemu informacja zwrotna może wskazać Ci Twoje własne najlepsze historie.
- **Na żywo lub ręcznie** — z kluczem dostawcy tura przebiega na żywo przez współdzieloną kaskadę dostawców (Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models); bez klucza otrzymujesz gotowy do uruchomienia prompt do skopiowania i wklejenia (uczciwy fallback, bez zmyślonych odpowiedzi).
- **Zapisane sesje** — kliknij **Save transcript**, aby utrwalić zakończoną rozmowę w warstwie użytkownika (`interview-prep/mock-{company}-{role}-{date}.md`); strona wyświetla, otwiera i usuwa zapisane sesje.

Nowe: `server/lib/routes/interview.mjs` (18. moduł tras), `public/js/views/mock-interview.js`, `server/lib/llm-dispatch.mjs` (współdzielona kaskada dostawców), `PATHS.storyBank`, `bundleProjectContext({ extraFiles })`. 30 nowych kluczy i18n we wszystkich **16 locales**. Testy: `tests/interview-routes.test.mjs`.

## [1.89.0] — 2026-07-04

**Dopasowanie kandydat-rynek — two-pager (Epic 14).** Nowa strona `#/two-pager` pozwala uchwycić to, czego *ty* naprawdę chcesz od kolejnej roli, wzorowana na „Mnookin two-pager" z *Never Search Alone*:

- **Kreator z prowadzeniem** — narracja w pierwszej osobie „Kim jestem", notatka „Docelowe środowisko" oraz pięć edytorów list chipów: **loves**, **must-haves**, **hates**, **deal-breakers** i **non-negotiables**. Zapisywane w **warstwie użytkownika** projektu nadrzędnego (`config/two-pager.yml`) przez `PUT /api/two-pager` — nigdy nienadpisywane przez aktualizacje systemu.
- **Asystent uzupełniania AI** (`POST /api/two-pager/draft`) — buduje gotowy do uruchomienia prompt Mnookina z wbudowanym twoim CV + profilem, do uruchomienia w dowolnym LLM i wklejenia wyniku z powrotem. Korzysta wyłącznie z twoich własnych materiałów; nic nie jest zmyślane.
- **Odznaka dopasowania-do-tego-czego-chcesz** — każda oferta na `#/scan` pokazuje teraz wynik dopasowania `◎ N` (po stronie klienta, przez `window.FitScore`), zestawiający typ pracy, kraj, dolny próg wynagrodzenia i relokację oferty z twoim two-pagerem. Uczciwa z założenia: gdy oferta nie daje porównywalnego sygnału, **odznaka nie jest wyświetlana** (nigdy zmyślona liczba). Naruszenia deal-breakerów ważą więcej niż lekkie niechęci.
- **Zasila każdą ocenę** — zapisany two-pager jest wbudowywany w `bundleProjectContext`, więc wszystkie dalsze oceny LLM łączą twoje zadeklarowane preferencje z dopasowaniem CV-vs-JD.

Nowe: `server/lib/routes/two-pager.mjs`, `public/js/views/two-pager.js`, `public/js/lib/fit-score.js`, `PATHS.twoPager`. 27 nowych kluczy i18n we wszystkich **16 locale**. Testy: `tests/two-pager-routes.test.mjs`, `tests/fit-score.test.mjs`.

## [1.88.0] — 2026-07-04

**Dopracowanie issue #29 — luki i18n w Skanowaniu + higiena API.**

- **Zlokalizowano ostatnie zakodowane na sztywno ciągi Skanowania** (mapa drogowa v1.69.4): pigułki podsumowania źródła (`N nowych / M pasujących`), toasty `N nowych ofert` oraz odznaka `reloc` przechodzą teraz przez `t()` — 4 nowe klucze (`scan.pillNew`, `scan.pillMatching`, `scan.newOffers`, `scan.relocBadge`) we wszystkich **16 locale**. Użytkownicy nieanglojęzyczni nie widzą już błąkającego się angielskiego w głównym przepływie skanowania.
- **Wyłączono nagłówek `X-Powered-By`** (mapa drogowa v1.69.5): `app.disable('x-powered-by')` w `createApp()` — serwer nie ogłasza już Express. (Reszta tego epiku została już dostarczona: `parentVersion` usuwa swój komentarz release-please, przełącznik motywu w trybie jasnym, zamykanie okien modalnych przy zmianie trasy oraz lokalizacja „Score” (`rep.score`) w Raportach.)

Testy: `tests/scan-i18n-gaps.test.mjs` + asercja braku `X-Powered-By` w `tests/security-headers.test.mjs`.

## [1.87.0] — 2026-07-04

**4 nowi dostawcy skanowania bez uwierzytelniania (parytet z nadrzędnym career-ops v1.16.0).** Rejestr skanera rośnie z **41 → 45 adapterów** (40 EN + 5 RU) — wszystkie publiczne, bez uwierzytelniania, z przypiętym hostem, `redirect:'error'` (bezpieczne wobec SSRF), każdy z izolowanym testem dla CI:

- **Get on Board** (`getonbrd`) — publiczny JSON:API całego portalu (technologia LATAM/zdalna), wybierany po dostawcy, stronicowany. `server/lib/sources/getonbrd.mjs`.
- **Amazon** (`amazon`) — publiczny JSON wyszukiwania `amazon.jobs`, wykrywany po hoście lub `provider: amazon`, stronicowany przesunięciem. `server/lib/sources/amazon.mjs`.
- **Avature** (`avature`) — ATS `*.avature.net` per-najemca, parsowany z HTML, wykrywany po hoście lub `provider: avature`. `server/lib/sources/avature.mjs`.
- **SAP SuccessFactors** (`successfactors`) — lista kafelków RMK per-najemca (`*.successfactors.eu/.com`, `jobs2web.com`), parsowana z HTML. `server/lib/sources/successfactors.mjs`.

Każdy dostarcza `sources/<slug>.mjs` (auto-wykrywany `meta` → lista rozwijana `#/scan`) **oraz** `portals/adapters/<slug>.mjs` w `ALL_ADAPTERS` (reguła dwóch rejestrów) + `tests/sources-<slug>.test.mjs`. Licznik `ALL_ADAPTERS` oraz asercje posortowanego id i zbioru EN `/api/scan/sources` wzrosły z 36→40; `GET /api/scan/sources` wymienia teraz 45.

## [1.86.0] — 2026-07-03

**Statystyki wg ról docelowych (`#/stats`) — rynkowe statystyki ofert i wynagrodzeń dla TWOICH ról docelowych.** Nowa strona Analityki odczytuje Twoje **role docelowe z profilu** (`config/profile.yml` → nie na sztywno) oraz oferty z ostatniego skanowania, a następnie pokazuje, dla każdej roli i kraju:

- **Oferty według krajów** i **medianę wynagrodzenia według krajów (USD)** — agregowane po stronie klienta (`public/js/lib/role-stats.js`, wykorzystując ponownie `window.Countries`) z rzadkich danych, które skanery już zbierają. Wynagrodzenia w dowolnej walucie są normalizowane do USD za pomocą jawnie przybliżonej tabeli FX, z zastrzeżeniem o wielkości próby — nigdy nie zmyślane.
- **Filtry roli i kraju** oraz ręcznie napisane wbudowane wykresy słupkowe i trendu w SVG (bez nowych zależności, bezpieczne dla CSP — tylko `addEventListener`).
- **Zapisz migawkę** (`POST /api/stats/snapshot`) utrwala bieżący agregat w `data/role-stats.jsonl`; **wykres trendu** (`GET /api/stats/trend`) śledzi liczbę ofert w czasie — widok „dynamiki”. Uczciwa hybryda: migawki pochodzą z lokalnych danych skanowania, odświeżane na żądanie.
- W pełni zlokalizowane we wszystkich **16 locale** (26 nowych kluczy i18n).

Nowe: `server/lib/routes/stats.mjs` (16. moduł tras), `public/js/lib/role-stats.js`, `public/js/views/stats.js`, `PATHS.roleStats`; testy `role-stats.test.mjs` (7) + `stats-routes.test.mjs` (5).

## [1.85.0] — 2026-07-03

**Locale niemiecki, włoski i turecki (parytet locale z nadrzędnym career-ops v1.16.0).** Interfejs jest teraz dostarczany w **16 językach** — `de` 🇩🇪, `it` 🇮🇹 i `tr` 🇹🇷 dołączają do istniejących 13.

- **Pełne tłumaczenie interfejsu** — wszystkie 730 kluczy i18n przetłumaczone w `public/js/lib/locales/i18n-dict.{de,it,tr}.js`; przełącznik języka wymienia Deutsch / Italiano / Türkçe, a automatyczne wykrywanie języka przeglądarki rozpoznaje `de`/`it`/`tr` (`public/js/lib/i18n.js`).
- **Wbudowany przewodnik pomocy** — `docs/help/{de,it,tr}.md` przetłumaczone (pełna struktura 19 H2 / 75 H3), serwowane przez `GET /api/help/:lang`.
- **Dokumentacja** — dodano `README.{de,it,tr}.md` i `CHANGELOG.{de,it,tr}.md`; brama parytetu locale CHANGELOG obejmuje teraz 15 locale innych niż EN.
- **Rusztowanie promptów** — `server/lib/prompts.mjs` (`LOCALE_NAMES` + `SCAFFOLD_STRINGS`) zlokalizowane dla trzech nowych locale, dzięki czemu wyjście LLM podąża za językiem interfejsu.

Wszystkie bramy parytetu (`i18n-locale-files`, `i18n-coverage`, `check-changelog-parity`, `lang-switcher-rtl`) rozszerzone do zestawu 16 locale.

## [1.84.0] — 2026-06-30

**Cooldown ponownego aplikowania + wynagrodzenie w pipeline.md (parytet z nadrzędnym career-ops v1.15.0).** Dwa usprawnienia skanera:

- **Cooldown ponownego aplikowania** (#1201): skan EN pomija teraz role w firmach, do których niedawno aplikowałeś/aś, dzięki czemu wyniki koncentrują się na NOWYCH ofertach. Skonfiguruj okna per firma w `config/profile.yml` pod kluczem `re_apply_windows:` (`last_apply_date`, `same_role_days`, `applied_to: [roles]`, opcjonalnie `cross_role_bucket`); dopasowanie firm jest nieczułe na interpunkcję + oparte na granicach słów (`server/lib/cooldown.mjs`). Wyłączone gdy klucz jest nieobecny; log skanu pokazuje `Cooldown skipped: N`.
- **Wynagrodzenie w pipeline.md** (#1017): skanowane oferty zapisują teraz swoje wynagrodzenie jako opcjonalną kolumnę końcową (`url | <salary>`) w `data/pipeline.md`. URL pozostaje kluczem deduplikacji (kolumna `| comp` jest pomijana przy odczycie), zawartość komórki jest sanityzowana (bez wstrzyknięcia wiersza/kolumny, formuły wiodące są neutralizowane), a istniejące pliki pipeline z samymi URL-ami pozostają kompatybilne wstecz.
Dostarcza `tests/cooldown.test.mjs` + testy kompensacji w pipeline. Liczba źródeł bez zmian: 41 (oba to usprawnienia logiki skanowania, nie nowe tablice).

## [1.83.0] — 2026-06-30

**Detektor ponownych publikacji / ofert-widm (parytet z nadrzędnym career-ops v1.15.0).** Nowy panel **🔁 Ponownie opublikowane / oferty-widma** na `#/scan` oznacza klastry firma+stanowisko, które zostały ponownie opublikowane pod różnymi adresami URL w ruchomym oknie 90 dni — sygnał przestarzałych potoków i ofert-widm. Oparty na rozmytym dopasowywaczu tytułów stanowisk (`server/lib/role-matcher.mjs`) i detektorze tylko do odczytu (`server/lib/detect-reposts.mjs`) operującym na `data/scan-history.tsv`, dostępnym przez `GET /api/scan/reposts`. Ponadto: `parentVersion` w `/api/health` podaje teraz sam semver (komentarz release-please `# x-release-please-version` jest usuwany). Dostarcza `tests/detect-reposts.test.mjs`. Liczba źródeł bez zmian: 41 — wykrywanie ponownych publikacji to funkcja analityczna, nie nowa tablica.

## [1.82.0] — 2026-06-30

**Źródło skanowania NoDesk (parytet z nadrzędnym career-ops v1.15.0).** Ogólnoportalowy kanał RSS pracy zdalnej NoDesk jest teraz pełnoprawnym źródłem skanowania — dodaj wpis `provider: nodesk`, a pojawi się na liście **Source** w `#/scan` (łącznie 41 adapterów: 36 EN + 5 RU). Host przypięty do `nodesk.co` z `redirect:'error'` (ochrona przed SSRF); tytuły dzielone po `Role at Company` (NoDesk nie ma tagu lokalizacji, więc lokalizacja pozostaje pusta); wszystkie wiersze zdalne. Dostarcza izolowany zestawy testów CI `tests/sources-nodesk.test.mjs`; pełny zestaw jednostkowy na zielono przy 1523.

## [1.81.0] — 2026-06-29

**Parytet z nadrzędnym career-ops — 13 nowych źródeł skanowania.** Przenosi najnowszą partię dostawców z `main` projektu Fighter90/career-ops do skanera działającego w procesie. Ogólnoportalowe publiczne API (wybrane przez dostawcę): Arbeitnow, Himalayas, Jobicy, Landing.jobs, 4 Day Week, The Muse, The Hub, Jobspresso (RSS) oraz Hacker News „Who is hiring?" (dwuetapowe Algolia). Portale polskie (wykrywane przez hosta lub `provider:`): JustJoin.it i NoFluffJobs (wyszukiwanie POST). ATS per-tenant (autowykrywane z `careers_url`): Pinpoint (`<slug>.pinpointhq.com/postings.json`) i Rippling (`ats.rippling.com/<slug>` → `api.rippling.com` board). Każde źródło jest przypięte do hosta z `redirect:'error'` (ochrona przed SSRF) i wybieralne na liście **Source** w `#/scan` — rejestr ma teraz **40 adapterów skanera** (35 EN + 5 RU). Dodaje 13 izolowanych zestawów testów CI na źródło; pełny zestaw jednostkowy na zielono przy 1513.

## [1.80.0] — 2026-06-28

**Pięć usprawnień skanera (pomysły z job-crawler, zaimplementowane od nowa).** (1) Źródło **Teamtailor** — witryny `<slug>.teamtailor.com` przez publiczny kanał `/jobs.rss`, autowykrywane z `careers_url` (host przypięty + `redirect:'error'`); rejestr ma teraz **27 adapterów**. (2) **Kwarantanna źródeł** — źródło ze stałym 404/410 jest zapisywane w `data/scan-quarantine.json` i pomijane w kolejnych skanach (samonaprawa: ponów po 14 dniach). (3) **Maks. na źródło** — opcjonalne pole na `#/scan` ograniczające liczbę ofert z boardu (∞ domyślnie). (4) **Opublikowano w** — filtr wieku po stronie klienta (24 h / 7 dni / 30 dni). (5) **Zapisane wyszukiwania + ★ ulubione** — nazywaj i używaj zestawów filtrów oraz oznaczaj oferty, w `localStorage` z defensywną walidacją (uszkodzony cache resetuje się czysto); cache wyników jest resetowany przed skanem i wypełniany na żywo.

## [1.79.0] — 2026-06-28

**Źródło skanowania WeWorkRemotely (zgodność z career-ops v1.14.0).** Ogólnotablicowy kanał RSS pracy zdalnej [We Work Remotely](https://weworkremotely.com) jest teraz pełnoprawnym źródłem — dodaj wpis `provider: weworkremotely`, a pojawi się na liście **Source** w `#/scan` (**26 adapterów** łącznie). Host przypięty do weworkremotely.com z `redirect:'error'` (anty-SSRF); tytuły dzielone po `Company: Role`. Ponadto: słowa kluczowe `title_filter` są teraz **przycinane przed** sprawdzeniem długości (parent #1261).

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
