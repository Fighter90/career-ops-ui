# Pomoc — career-ops-ui

Kompletny przewodnik po każdej stronie — od momentu uruchomienia
aplikacji aż do zdobycia zaproszenia na rozmowę kwalifikacyjną. Każdy
nagłówek `##` odpowiada pozycji na pasku bocznym lub fazie workflow.
Przy pierwszym uruchomieniu czytaj od góry do dołu; później przeskakuj
do konkretnej sekcji za pomocą spisu treści w pasku bocznym pomocy.

> **Odbiorcy:** każdy, kto właśnie umieścił ten interfejs w katalogu
> `career-ops` i uruchomił `bash bin/start.sh`. Nie zakładamy żadnej
> wcześniejszej znajomości career-ops.

### O career-ops

[career-ops](https://career-ops.org) to system poszukiwania pracy o otwartym kodzie źródłowym,
działający jako polecenia slash w dowolnym CLI do kodowania AI (Claude Code, Gemini CLI, Codex, Qwen Code, OpenCode, GitHub Copilot CLI — inne CLI kompatybilne z Claude też działają przez tę samą powierzchnię poleceń slash). Niezależny od modelu. Ocenia każde ogłoszenie względem Twojego CV według sześciowymiarowej skali 0,0–5,0, generuje dopasowane CV w formacie PDF i śledzi każdą aplikację lokalnie na Twoim komputerze.

**Kanoniczne odniesienia (czytaj w tej kolejności przy pierwszej instalacji):**

- [Co to jest career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
  — system, zasady i inwentarz pojęć.
- [Skanowanie portali pracy](https://career-ops.org/docs/introduction/guides/scan-job-portals)
  — odkrywaj oferty pracy; wypełniaj Pipeline.
- [Aplikowanie na pracę](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
  — pełny przepływ składania aplikacji z odczytem formularzy przez Playwright.
- [Wsadowe ocenianie ofert](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  — oceniaj 10+ JD naraz za pomocą `batch-runner.sh`.
- [Konfiguracja Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)
  — zainstaluj Chromium i zarejestruj MCP do generowania PDF i wypełniania formularzy.

**Definiujące zasady** (z
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

- **Prawdziwy open source** — MIT, bez płatnych planów, bez listy oczekujących, bez
  telemetrii, bez kont. System działa bez płatnych planów,
  kont ani telemetrii. Wkłady w kod przechodzą przegląd społeczności
  przed wydaniem.
- **Suwerenność danych** — `cv.md`, `config/profile.yml`, `data/`,
  `reports/`, `interview-prep/` nigdy nie opuszczają Twojego laptopa, chyba że
  sam je wypchniesz. Uruchamiasz go lokalnie na swoim komputerze, zachowując
  pełną suwerenność danych.
- **Architektura niezależna od AI** — career-ops NIE dołącza modelu.
  Działa jako polecenia w istniejących CLI do kodowania AI. Zmień
  dostawcę (Anthropic ↔ Gemini ↔ OpenAI), a historia ocen
  pozostaje spójna.
- **Submisja pod kontrolą człowieka** — career-ops przygotowuje odpowiedzi i
  otwiera formularz, ale **to Ty klikasz Wyślij**. System nigdy
  nie aplikuje automatycznie. System zapewnia strukturę i ocenę; ostateczna decyzja
  o złożeniu aplikacji należy do człowieka.
- **Ustrukturyzowane poszukiwanie** — zbudowany do aktywnego, przemyślanego poszukiwania pracy
  z wieloma aplikacjami; nie jest narzędziem do jednorazowego wysłania, nie jest
  silnikiem rekomendacji. Konfiguracja zajmuje ~15 minut i zakłada komfort pracy z terminalem.

**Czym career-ops NIE jest** (jawne cele negatywne):

- Nie jest auto-aplikantem. Nie będzie za Ciebie wysyłał formularzy.
- Nie jest narzędziem do przebudowy CV. Dopasowuje CV do JD; nie wymyśla
  doświadczenia.
- Nie jest optymalizatorem LinkedIn. Twój profil to Twoja sprawa.
- Nie jest zamiennikiem arkusza kalkulacyjnego ukrytym za interfejsem SaaS. Dane
  to zwykły Markdown na Twoim systemie plików.

**Kluczowe pojęcia** (pełny inwentarz — każdy artefakt dotykany przez career-ops):

| Pojęcie | Co to jest |
|---|---|
| **Mode** | Szablon prompta w `modes/<slug>.md`. Wbudowane: `oferta`, `deep`, `apply`, `pipeline`, `batch`, `contacto`, `followup`, `interview-prep`, `patterns`, `project`, `training`, `ofertas`, `auto-pipeline`, `pdf`, `latex`, `scan`, `tracker`. |
| **Archetype** | Profil docelowej roli w `config/profile.yml`. Skala ocen waży dopasowanie umiejętności do aktywnego archetypu — **najważniejsze pole**. |
| **Pipeline** | `data/pipeline.md` — skrzynka odbiorcza adresów URL JD oczekujących na ocenę. |
| **Tracker** | `data/applications.md` — historyczna tabela GFM każdej oceny i statusu aplikacji. |
| **Report** | `reports/<NNN>-<company>-<DATE>.md` — pełna ocena A–F dla każdego JD, z wynikiem i wiarygodnością w nagłówku. |
| **Scan history** | `data/scan-history.tsv` — dziennik tylko do dopisywania; zapobiega duplikatom między skanowaniami. |
| **Proof points** | Bloki dowodów STAR+R wyekstrahowane z `cv.md`, ponownie używane przy ocenianiu, odpowiedziach przy aplikowaniu i przygotowaniu do rozmów. |
| **JD store** | `jds/jd-<date>-<ts>.txt` — dosłowne opisy stanowisk zapisywane podczas oceniania dla celów audytu. |
| **Interview-prep** | `interview-prep/<company>-<role>.md` — obszerne briefy badawcze i jednostronicowe materiały na każdą rundę. |
| **Batch additions** | `batch/tracker-additions/*.tsv` — oczekujące wiersze kolejkowane przez `batch-runner.sh` do scalenia z trackerem. |

### career-ops vs career-ops-ui (ta aplikacja)

| | career-ops (CLI) | career-ops-ui (ta aplikacja) |
|---|---|---|
| Gdzie działa | wewnątrz Claude Code / Gemini CLI / Codex / Qwen Code / OpenCode / GitHub Copilot CLI | `http://127.0.0.1:4317` w Twojej przeglądarce |
| Powierzchnia | polecenia slash `/career-ops <mode>` | pasek boczny z jedną stroną na workflow |
| Wypełnianie formularzy | tak, przez Playwright MCP | nie — generuje listę kontrolną, resztę kończysz w CLI |
| PDF | `generate-pdf.mjs` | `📄 Generate PDF` na `#/cv`, `#/reports/:slug`, `#/evaluate`, `#/deep`, `#/interview-prep` |
| Pliki danych | współdzielone z career-ops-ui | współdzielone z career-ops |

career-ops-ui to **czyste rozszerzenie**. Nic wewnątrz `career-ops/`
nie ulega zmianie. Obie powierzchnie korzystają z tych samych plików `cv.md`, `config/profile.yml`,
`portals.yml`, `data/`, `reports/`, `interview-prep/`, `modes/`.

### Progi działania według wyniku

Gdy JD ma już ocenę, wynik określa kolejny krok
(tabela kanoniczna z
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

| Wynik | Następny krok |
|---|---|
| **≥ 4.5** | Uruchom `/career-ops apply` — wysokie dopasowanie, aplikuj natychmiast. |
| **4.0 – 4.4** | Aplikuj lub użyj `/career-ops contacto` dla ciepłego wprowadzenia. |
| **3.5 – 3.9** | Uruchom `/career-ops deep` — zbadaj firmę/rolę przed podjęciem decyzji. |
| **< 3.5** | Pomiń, chyba że masz konkretny osobisty powód. |

`#/dashboard` i `#/tracker` w career-ops-ui podświetlają każdy wiersz
o wartości 4.0 lub wyższej, dzięki czemu możesz podjąć działanie bez ponownego uruchamiania czegokolwiek.

### Zewnętrzna dokumentacja

Pełna dokumentacja silnika career-ops
(skanowanie, skala ocen, przetwarzanie wsadowe, przepływ aplikowania,
konfiguracja Playwright) znajduje się pod adresem
[career-ops.org/docs](https://career-ops.org/docs):

- [Co to jest career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
- [Skanowanie portali pracy](https://career-ops.org/docs/introduction/guides/scan-job-portals)
- [Aplikowanie na pracę](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
- [Wsadowe ocenianie ofert](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
- [Konfiguracja Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)

---

## 1. Szybki start — krok po kroku od „utwórz CV" do „aplikacja złożona i wiadomość wysłana"

To kanoniczny, krok po kroku opis działań. Wykonuj go w kolejności
przy pierwszym uruchomieniu. Każdy krok podaje dokładną trasę, dokładny przycisk
i to, co zobaczysz po sukcesie. Sekcje 2–16 poniżej szczegółowo opisują
każdą fazę.

> **Uruchomienie i inicjalizacja jednym poleceniem.** Z terminala możesz przeprowadzić cały
> bootstrap bez dotykania interfejsu:
>
> ```bash
> career-ops-ui setup      # install deps → doctor → run the server
> career-ops-ui init       # pick LLM provider + paste its key (echo suppressed)
> career-ops-ui doctor     # re-verify any time (exit 0 ⇔ all required green)
> career-ops-ui run        # just launch the server at http://127.0.0.1:4317
> career-ops-ui open       # open + RAISE the dashboard tab in your browser
> ```
>
> Po `setup`/`run` zakładka przeglądarki jest otwierana **i wysuwana na
> wierzch** automatycznie (v1.43.0); `career-ops-ui open` robi to samo na
> żądanie, żebyś nigdy nie musiał szukać zakładki dashboardu. `NO_OPEN=1`
> wyłącza auto-otwieranie dla uruchomień headless/CI.
>
> `setup` sam uruchamia cały łańcuch. `init` zapisuje klucz do
> `career-ops/.env` w katalogu nadrzędnym przez tę samą zwalidowaną ścieżkę,
> z której korzysta zakładka kluczy API w `#/config`, i ustawia `LLM_PROVIDER`
> (`auto` | `claude` | `gemini`), który jest respektowany przez trasy live evaluate / deep / mode /
> auto-pipeline. Forma CI:
> `career-ops-ui init --provider claude --anthropic-key sk-ant-… --yes`.
> Wolisz interfejs? Kontynuuj z krokami poniżej.

### A. Konfiguracja (jednorazowo, ~5 minut)

**career-ops-ui musi znajdować się w `career-ops/web-ui/`** (zagnieżdżony w nadrzędnym projekcie career-ops). Odczytuje Twoje `cv.md`, `config/` i `data/` z katalogu nadrzędnego przez `../` i nie działa samodzielnie. Jeśli po pull `career-ops-ui init` nie jest znalezione, uruchom `cd career-ops/web-ui && npm install && npx career-ops-ui init`.

**Krok 1 — Otwórz aplikację pod adresem `http://127.0.0.1:4317`.** Jeśli nie działa,
w terminalu uruchom `bash bin/start.sh` z katalogu głównego repozytorium.
Ładuje się Dashboard (`#/dashboard`).

**Krok 2 — Kliknij `❤ Health` w lewym pasku bocznym.** Każde wymagane
sprawdzenie musi być zielone:

- `cv.md`, `config/profile.yml`, `portals.yml` istnieją
- Klucz API ustawiony (co najmniej jeden z `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`)
- Playwright zainstalowany (wymagany tylko jeśli będziesz używać Generate PDF)

Jeśli coś jest czerwone, strona podaje dokładny plik lub zmienną środowiskową do
naprawienia. Nie kontynuuj, dopóki Health nie jest zielone.

**Krok 3 — Kliknij `⚒ App settings` w pasku bocznym.** Trafiasz na zakładkę
**API keys & runtime**.
- Wklej `ANTHROPIC_API_KEY` (preferowany — lepsza długa ocena)
  i/lub `GEMINI_API_KEY`. Uzyskaj klucze z
  <https://console.anthropic.com/settings/keys> lub
  <https://aistudio.google.com/apikey>.
- Kliknij **💾 Save**. Następnie kliknij **▶ Test Anthropic** (lub Gemini) —
  mały round-trip potwierdza, że klucz działa.

**Krok 4 — Przejdź do zakładki `Profile` na tej samej stronie.** To jest
bezpośredni edytor YAML dla `config/profile.yml`. Edytuj co najmniej:
- `candidate.full_name` — zastąp dowolny placeholder („Jane Smith") swoim
  prawdziwym imieniem i nazwiskiem
- `candidate.email`, `linkedin`, `github` — używane w listach motywacyjnych
- `target.roles` — stanowiska, na które będziesz aplikował
- `target.comp_total_min_usd` — minimalne całkowite wynagrodzenie; oferty poniżej tego
  są oznaczane w sekcji D każdej oceny
- `target.archetypes` — wzorce kariery, które akceptujesz (pojedyncze
  najważniejsze pole)

Kliknij **💾 Save**. Serwer waliduje YAML i dodaje kanoniczny
nagłówek `# Career-Ops Profile Configuration`.

### B. CV (jednorazowo, ~10 minut)

**Krok 5 — Kliknij `✎ CV` w pasku bocznym.** Dwie kolumny: edytor po
lewej, podgląd na żywo po prawej.

**Krok 6 — Wybierz jedną ścieżkę do wypełnienia edytora:**
- **Prześlij istniejące CV** — kliknij **📁 Upload CV**, wybierz dowolny z
  formatów `.docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md`. Serwer
  konwertuje do Markdown przez pandoc lub pdftotext, usuwa XSS
  i umieszcza wynik w edytorze. **Sprawdź konwersję** —
  pliki PDF szczególnie mogą tracić wierność układu.
- **Wklej Markdown bezpośrednio** — textarea to edytor Markdown;
  prawy panel pokazuje to, co zobaczy LLM (i Twój przyszły rekruter).
- **Wskazówki co do tonu:** jeden punktor = jedno osiągnięcie z metryką. Nie przekraczaj
  1500 słów. Sekcje w tej kolejności: Summary, Experience,
  Projects, Education, Skills.

**Krok 7 — Kliknij `💾 Save` (górny prawy róg strony CV).** Serwer
usuwa niebezpieczne elementy (`<script>` / `javascript:` / inline handlery) i
zapisuje `cv.md`. Toast: *„Saved"*.

**Krok 8 (opcjonalny) — Kliknij `📄 Generate PDF`.** Uruchamia
`generate-pdf.mjs` w projekcie nadrzędnym (wymagany Playwright) i **nowe
PDF auto-pobiera się** do Twojej przeglądarki po zakończeniu. Lista na dole
strony przechowuje każdy wcześniej wygenerowany plik.

### C. Znajdowanie ofert (~2 minuty na skan)

**Krok 9 — Kliknij `🌐 Scan` w pasku bocznym.** Potwierdź, że `portals.yml`
zawiera portale, którymi jesteś zainteresowany (sekcja 5 tej pomocy). Naciśnij przycisk
**🌐 Scan now**. Na żywo streamuje log SSE, gdy skaner
przechodzi przez Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (angielskie portale) i hh.ru / Habr
Career (rosyjskie portale, jeśli włączone).

**Krok 10 — Po zakończeniu skanowania przejrzyj wyniki.** Kliknij dowolny
tag firmy, aby filtrować; kliknij ikonę ↗, aby otworzyć stronę z ofertami
firmy w nowej zakładce. Każda oferta, która przeszła filtr tytułu, jest kolejkowana
w Pipeline.

### D. Ocenianie ofert (~30 sekund na JD)

**Krok 11 — Kliknij `Pipeline` w pasku bocznym.** Widzisz każdy URL
kolejkowany przez skaner. Kliknij wpis, aby wyświetlić JD w podglądzie.

**Krok 12 — Kliknij `▶ Evaluate` obok dowolnego JD.** Skacze to do
`#/evaluate`. Z ustawionym kluczem API działa na żywo; bez niego dostajesz
ręczny prompt do wklejenia do swojego LLM. Tryb na żywo produkuje
**wynik 0–5** względem Twojego CV przez sekcje A–G (Rola / Firma /
Wynagrodzenie / Ryzyko / Stretch / Dopasowanie kulturowe / Werdykt). Zapis trafia
do `reports/<date>-<slug>.md`.

**Krok 13 — Kliknij `Reports` w pasku bocznym** i przejrzyj najnowszą
ocenę. Wszystko poniżej Twojego `comp_total_min_usd` jest zaznaczone na czerwono
w sekcji D. Wszystko z `Verdict: pursue` to Twoja lista shortlistowych.

### E. Decyzja i pogłębiony research wybranej firmy (~3 minuty)

**Krok 14 — Wybierz ofertę wartą rozważenia. Kliknij `Deep research`
w pasku bocznym.** Wpisz nazwę firmy i rolę. Model
generuje 7-sekcyjny brief o firmie (misja, ostatnie wiadomości, stos technologiczny,
sygnały rekrutacyjne, benchmarki wynagrodzeń, ryzyka, zalecany kąt). Zapis trafia do
`interview-prep/<company>-<role>.md`.

### F. Aplikowanie (~5 minut na aplikację)

**Krok 15 — Kliknij `Apply checklist` w pasku bocznym.** Wklej
URL oferty i JD. Pomocnik generuje krokową listę kontrolną zgłoszenia:
- Szkic spersonalizowanego listu motywacyjnego (używa Twojego `cv.md` + `profile.yml`)
- Konkretne słowa kluczowe do odzwierciedlenia z JD
- Pliki do załączenia (PDF CV — patrz krok 8)
- Gdzie aplikować (kanoniczny URL kariery, nie przekierowania agregatora)
- Przypomnienie: **NIGDY nie wysyłaj automatycznie** — końcowa recenzja i złożenie
  wniosku są zawsze ręczne.

**Krok 16 — Otwórz stronę kariery w nowej zakładce.** Użyj listy kontrolnej
jako listy todo. Złóż aplikację przez rzeczywisty formularz firmy. Dołącz PDF
wygenerowany w kroku 8.

**Krok 17 — Skontaktuj się z prawdziwym człowiekiem.** Otwórz tryb **Outreach**
(`#/contacto` w pasku bocznym). Model przygotowuje krótką wiadomość na LinkedIn /
email dostosowaną do briefu firmy z kroku 14. Spersonalizuj
wstęp (jeden konkretny szczegół z briefu z pogłębionego researchu).
Wyślij.

### G. Śledzenie i follow-up (ciągłe)

**Krok 18 — Kliknij `Tracker` w pasku bocznym** i dodaj wiersz dla
aplikacji: firma, rola, wynik, status `Applied`, link do
raportu, link do briefu z pogłębionego researchu. Data jest wypełniana automatycznie.

**Krok 19 — Tydzień później: otwórz tryb `Follow-up`** (`#/followup`).
Przygotowuje uprzejmy e-mail z zapytaniem nawiązujący do pierwotnej aplikacji.
Wyślij. Zaktualizuj status w trackerze do `Followed up`.

**Krok 20 — Kiedy otrzymasz zaproszenie na rozmowę, uruchom tryb `Interview prep`**
(`#/interview-prep`). Generuje ukierunkowane przygotowanie do konkretnej firmy i
etapu (projektowanie systemu / behawioralne / kodowanie). Automatycznie pobiera dane
z briefu z pogłębionego researchu.

**Krok 21 — Masz ofertę? Zaktualizuj status w Trackerze do `Offer`** i
ponownie odwiedź sekcję wynagrodzenia w raporcie oceny — Twój minimalny
numer akceptacji jest tam podany.

### TL;DR — kolejność w pasku bocznym odpowiada workflow

`Health → App settings → Profile → CV → Scan → Pipeline → Evaluate
→ Reports → Deep research → Apply checklist → Outreach → Tracker
→ Follow-up → Interview prep → Activity log`

Tyle. 21 kroków, przycisk po przycisku, od zera do oferty.

### Automatyczny pipeline jednym kliknięciem (`#/auto`) — skrót 21 kroków

Jeśli chcesz szybko ocenić jedną konkretną ofertę, pomiń ręczny
przewodnik. **Pasek boczny → ✨ Auto-pipeline** (lub przycisk ✨ na
Dashboardzie) otwiera dedykowany ekran: wklej URL oferty, naciśnij **Enter**
lub kliknij **▶ Run full pipeline**, a serwer uruchamia cały łańcuch
w jednym obserwowalnym przebiegu:

1. **Walidacja URL** — bezpieczne sprawdzenie SSRF (`isValidJobUrl`); odrzuca
   loopback / `file:` / prywatne IP / znaki skryptowe.
2. **Pobieranie opisu stanowiska** — `safeGet` (DNS-pinned, redirect-
   revalidated) pobiera i usuwa niebezpieczne elementy z JD.
3. **Ocena względem Twojego CV** — Anthropic (preferowany) → Gemini
   fallback → ręczny prompt jeśli brak klucza.
4. **Zapisywanie raportu** — zapisuje `reports/<slug>.md` z wynikiem +
   wiarygodnością w nagłówku.
5. **Dodawanie do trackera** — dopisuje wiersz do `data/applications.md`.

Informacja zwrotna na żywo to pionowy **stepper** (każdy krok świeci
running → done / failed). Jest to lista uporządkowana z `aria-current`
na aktywnym kroku i grzecznym regionem na żywo dla czytników ekranu ogłaszającym
każde przejście. Po sukcesie karta wynikowa prowadzi bezpośrednio do
zapisanego raportu (**View report · N/5**) i **trackera**. Nieudany
krok jest oznaczony na czerwono z wiadomością, a przycisk ponownie się aktywuje, żebyś
mógł poprawić URL i spróbować ponownie bez przeładowania.

**Brak klucza API?** Pipeline działa w **trybie ręcznym**: kroki 3–5
zwijają się i dostajesz gotową kartę z promptem do skopiowania (wklej do Claude
Code / Anthropic / Gemini). Brak wywołania LLM, brak kosztów.

`#/auto` jest linkowany: `#/auto?url=<encoded>&go=1` otwiera ekran i
auto-startuje. Przycisk ✨ dashboardu i ten wpis w pasku bocznym oba prowadzą
tutaj (jeden spójny przepływ — tymczasowy modal sprzed v1.34 został awansowany
do tej strony).
> **CLI (v1.38.0).** Jedno polecenie wykonuje łańcuch: `career-ops-ui setup` (bootstrap → install → start). Samodzielne czasowniki: `career-ops-ui doctor` (sprawdzenie env/kluczy/narzędzi — ten sam silnik co strona Health; exit 1 przy każdym wymaganym błędzie), `career-ops-ui run`, `career-ops-ui init` (kreator dostawcy+klucza, v1.39.0).
> **Dostawcy (v1.39.0).** Zakładka API-keys dodaje pole wyboru `LLM_PROVIDER` (`auto` = Anthropic→Gemini domyślnie · `claude` · `gemini`) i pole `OPENAI_API_KEY` (dla CLI Codex/OpenCode). `career-ops-ui init` to interaktywny kreator dla tej samej konfiguracji.
>
> **Dostawcy (v1.57.0).** Headless live-eval obejmuje teraz **Anthropic → Gemini → OpenAI → Qwen → OpenRouter** (kolejność `auto`; `LLM_PROVIDER` wymusza jeden). **OpenRouter** — jeden `OPENROUTER_API_KEY` obsługuje 300+ modeli; menu rozwijane `OPENROUTER_MODEL` ładuje aktualny katalog OpenRouter (proxy po stronie serwera, skrócony offline fallback). Naprawiono też: klucze wklejone z końcowym znakiem nowej linii / otaczającymi spacjami są teraz przycinane przed walidacją, więc `/#/config` nie wyświetla już „validation failed" dla żadnego dostawcy.

---

## 2. Ustawienia aplikacji i klucze API (`#/config`)

> **Nowość w v1.55 → v1.56.** Przy **braku** ustawionego klucza LLM, czerwony baner na każdym ekranie wyjaśnia, że ⚡ Run-live jest w trybie ręcznego promptu i zawiera link tutaj; gdy klucz jest ustawiony, staje się spokojnym chipem z nazwą aktywnego dostawcy. Przed każdym przyciskiem ⚡ Run-live (`#/auto`, `#/evaluate`, `#/deep`, tryby) wyświetlane jest uczciwe przybliżenie kosztów (np. „Szacowany koszt: OpenAI gpt-5-codex · ~$0.04/eval", lub notatka bez kosztów API w trybie ręcznym). `#/scan` chowa filtry drugorzędne za ujawnieniem **Advanced filters**; `#/tracker` dodaje klikalne chipy lejka + opcjonalne stronicowanie po stronie serwera; `#/pipeline` wirtualizuje powyżej 1000 wierszy.

Trzy zakładki:

1. **API keys & runtime** — formularz pól strukturalnych nad plikiem `.env`
   projektu nadrzędnego (ten sam plik, który skrypty Node career-ops odczytują przy
   starcie). Zgrupowane: API keys / Runtime / Regional sources. Zakładka
   udostępnia również selektory modeli na dostawcę — `OPENAI_MODEL`
   (OpenAI/Codex) obok `ANTHROPIC_MODEL` i `GEMINI_MODEL`.
2. **Profile** — **formularz pole po polu** nad `config/profile.yml`
   (web-ui 1.32.0). Zapis **scala** z plikiem — Twoje archetypy,
   proof points i wszelkie niestandardowe klucze są zachowywane bez zmian.
3. **Modes** — **formularz pól strukturalnych** dla `modes/_profile.md`
   (web-ui 1.54.3), oparty na udokumentowanym schemacie. Sekcje listowe —
   **Target Roles / Adaptive Framing / Comp Targets** —
   renderowane jako powtarzalne wejścia liniowe (dodaj/usuń wiersze); sekcje prozą
   — **Exit Narrative / Location Policy** — renderowane jako
   oznaczone textareas; każda nieznana lub nie-listowa sekcja wraca do
   oznaczonego verbatim textarea. Zapis nadal **scala według sekcji** —
   preambuła, niezmienione sekcje i wszelkie niestandardowe sekcje są
   zachowywane bajt po bajcie. Ujawnienie *Advanced: raw markdown*
   pozostaje do edycji całego pliku — dodawania/usuwania sekcji lub edycji
   preambuły.

Zapis w dowolnej zakładce propaguje natychmiast — bez restartu serwera.

**Konfigurowanie dostawcy LLM (krok po kroku).** ⚡ Ocena na żywo w interfejsie webowym działa *headless* i używa jednego klucza API. Działa przez „OR" — ustaw **którykolwiek jeden** z nich i po prostu działa; przy kilku ustawionych, `auto` preferuje je w tej kolejności: Anthropic → Gemini → OpenAI → Qwen. (sam career-ops jest agnostyczny co do CLI — uruchamiasz go również wewnątrz Claude Code, Codex, Gemini, OpenCode, Qwen, Copilot lub Kimi; to jest oddzielne od tego klucza headless.)

1. Otwórz `#/config` → zakładkę **API keys & runtime**.
2. Wybierz dostawcę w **`LLM_PROVIDER`**: `auto` (użyj dowolnego ustawionego klucza) lub wymuś jeden z `claude` / `gemini` / `openai` / `qwen`.
3. Wypełnij klucz + model dla wybranego dostawcy:
   - **Anthropic** — ustaw `ANTHROPIC_API_KEY` (console.anthropic.com), opcjonalnie `ANTHROPIC_MODEL` (domyślnie `claude-sonnet-4-6`).
   - **Gemini** — ustaw `GEMINI_API_KEY` (aistudio.google.com/apikey), opcjonalnie `GEMINI_MODEL` (domyślnie `gemini-2.0-flash`).
   - **OpenAI** — ustaw `OPENAI_API_KEY` (platform.openai.com), opcjonalnie `OPENAI_MODEL` (domyślnie `gpt-5-codex`).
   - **Qwen** — ustaw `QWEN_API_KEY` (Alibaba Model Studio / DashScope, dashscope.console.aliyun.com), opcjonalnie `QWEN_MODEL` (domyślnie `qwen-max`). Dla punktu końcowego mainland-CN ustaw `QWEN_BASE_URL` w surowym `.env`.
4. Kliknij **Save**. Klucze są zapisywane do `.env` projektu nadrzędnego; zmiana wchodzi w życie natychmiast — restart serwera nie jest potrzebny.
5. Zweryfikuj na `#/evaluate`: wklej URL/opis stanowiska i naciśnij **⚡ Run live**. Nagłówek wynikowy pokazuje, który dostawca działał (`anthropic` / `gemini` / `openai` / `qwen`). Brak ustawionego klucza gdziekolwiek → dostajesz zamiast tego ręczny prompt do skopiowania.

Sekrety są maskowane po zapisaniu i nigdy nie są logowane. Pola ID modelu (`*_MODEL`) nie są sekretne.

### Zakładka Profil (formularz pól — v1.32.0)

Przed v1.32.0 ta zakładka była pojedynczą surową textarea YAML, gdzie każde
ustawienie żyło w jednym niezróżnicowanym bloku. Jest teraz formularzem strukturalnym,
z polami zgrupowanymi w trzy składane sekcje:

- **Candidate** — Pełne imię i nazwisko (wymagane), Email, Telefon, Lokalizacja,
  LinkedIn, GitHub, URL portfolio, X / Twitter.
- **Narrative** — Nagłówek, Historia wyjścia.
- **Compensation** — Docelowy zakres, Waluta, Minimum do zaakceptowania,
  Elastyczność lokalizacji.
- **Edytory tablic strukturalnych** (web-ui 1.35.0) — edytory dodaj/usuń wiersz
  dla pól w formie listy, więc nawet te nie wymagają już
  surowego YAML: **Target roles** + **Superpowers** (listy ciągów);
  **Archetypes** (wiersze nazwa / poziom / dopasowanie); **Proof points** (wiersze nazwa /
  url / hero-metric). Puste wiersze są pomijane; opróżniona lista
  czyści klucz. Ta sama gwarancja scalania-nie-zastępowania — każda
  tablica, której nie dotkniesz, przeżywa nietkniętą.

Jak zapis jest bezpieczny:

- Formularz wysyła tylko 14 modelowanych skalarnych ścieżek jako
  `{ fields: { "candidate.full_name": … } }`. Serwer **odczytuje istniejący
  `config/profile.yml`, ustawia/czyści tylko te liście, i
  ponownie serializuje cały obiekt** — więc zagnieżdżone tablice, których formularz
  nie modeluje (`target_roles.archetypes`, `narrative.proof_points`,
  `narrative.superpowers`) i wszelkie niestandardowe klucze dodane ręcznie
  **przeżywają round-trip bez zmian**. Wyczyszczenie pola usuwa ten
  klucz bez pozostawiania `phone: ""`.
- Walidacja nadal wymaga pełnego imienia i nazwiska; nagłówek `# Career-Ops Profile
  Configuration` jest automatycznie dodawany.
- Jeden kompromis: zapis z formularza pól **ponownie serializuje YAML, więc inline
  komentarze `#` są tracone**. Aby zachować komentarze lub edytować zagnieżdżone
  tablice, użyj ujawnienia **Advanced: edit raw YAML** na
  dole zakładki — to jest pełny edytor pliku sprzed v1.32, niezmieniony
  (zastępuje cały plik przy zapisie).
- Widok podsumowania tylko do odczytu na `#/profile` jest wizualnym towarzyszem.

### Rozpoznawane klucze

| Klucz | Co robi | Skąd go uzyskać |
|---|---|---|
| `ANTHROPIC_API_KEY` | Włącza wywołania Anthropic SDK na żywo. Preferowany gdy są ustawione zarówno Anthropic jak i Gemini — lepsza długa, strukturalna odpowiedź do oceniania JD i pogłębionego researchu. | <https://console.anthropic.com/settings/keys> |
| `ANTHROPIC_MODEL` | Nadpisuje domyślny `claude-sonnet-4-6`. Spróbuj `claude-opus-4-7` dla trudniejszego rozumowania, `claude-haiku-4-5-20251001` dla taniego i szybkiego. | — |
| `GEMINI_API_KEY` | Fallback gdy brak klucza Anthropic. Używany przez `gemini-eval.mjs` dla trybu `oferta`. Darmowy plan działa dla małej liczby zapytań. | <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | Nadpisuje domyślny model Gemini. | — |
| `(server uses default UA)` | Wymagany przy uruchamianiu skanów `hh.ru` spoza Rosji (API zwraca 403 dla zwykłych User-Agentów). Zarejestruj aplikację na <https://dev.hh.ru/admin> i użyj jej ciągu UA. | dev.hh.ru |
| `PORT` | Port bind Express. Domyślnie 4317. | — |
| `HOST` | Adres bind. Domyślnie `127.0.0.1`. Ustawienie `0.0.0.0` eksponuje interfejs w sieci LAN — **brak bramy autoryzacyjnej**, patrz dokument o gotowości produkcyjnej. | — |

### Zachowanie

- **Odczyt** (`GET /api/config`) zwraca każdy rozpoznany klucz. Klucze sekretne
  (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) są **maskowane** — widzisz
  `sk-ant•••••••a1b2`, nigdy pełną wartość.
- **Zapis** (`POST /api/config`) waliduje każdą wartość, zapisuje do
  `<parent>/.env` i natychmiast aplikuje do działającego procesu.
  Restart nie jest potrzebny.
- **Pusta wartość usuwa** klucz. Przydatne jeśli chcesz przestać używać rosyjskiego IP / VPN.

### Przyciski testu dymnego

Po zapisaniu kliknij **▶ Test Anthropic** lub **▶ Test Gemini** — oba
wykonują mały prompt (≤256 tokenów wyjściowych), więc wydajesz zasadniczo
nic, potwierdzając, że klucz jest poprawnie podłączony. Zwraca
~200-znakową próbkę po sukcesie.

---

## 3. Profil (`#/profile` — dostępny też jako `#/settings`)

Widok karty podsumowania tylko do odczytu dla `config/profile.yml`. **Aby edytować**,
przejdź do **App settings → zakładka Profile** (`#/config` → Profile) — od
web-ui 1.32.0 to jest formularz pole po polu (Candidate / Narrative /
Compensation), nie surowy blob YAML. Zapisy scalają się z tym samym plikiem;
ta strona ponownie parsuje po przeładowaniu.

Najważniejsze pola:

- `candidate.full_name` — używane w każdym prompcie. **Zastąp
  szablonowe `Jane Smith`** przed skanowaniem czegokolwiek na poważnie, bo Twoje
  wygenerowane listy motywacyjne wyjdą pod imieniem placeholder.
- `candidate.email`, `linkedin`, `github` — przywoływane przy generowaniu listów
  motywacyjnych i liście kontrolnej aplikowania.
- `target.roles` — akceptowane stanowiska. Filtr pozytywny skanera
  używa tego implicite (przez `portals.yml::title_filter`).
- `target.comp_total_min_usd` — minimalne całkowite wynagrodzenie. Sekcja D każdej
  oceny oznacza oferty poniżej tego.
- `target.archetypes` — *najważniejsze pole*. To wzorce kariery, które
  akceptujesz (np. `Tech-Lead-Backend`,
  `Founding-Engineer`, `Data-Platform`). Każdy JD jest dopasowywany do nich,
  a najlepiej pasujący archetype trafia do nagłówka raportu.

Strona Health pokazuje sprawdzenie **Profile customized**, które jest błędem, dopóki
`full_name` pasuje do znanych imion placeholder.
## 4. CV (`#/cv`)

Pojedyncze źródło prawdy dla każdej oceny, pogłębionego researchu i listu
motywacyjnego. Przechowywane w `cv.md` w katalogu głównym projektu nadrzędnego.

**Opcje edycji**

- **Wklej bezpośrednio** — textarea po lewej stronie to edytor Markdown.
  Prawy panel odzwierciedla to, co zobaczy LLM (i Twój przyszły rekruter).
- **📁 Upload CV** — wybierz lokalny plik w dowolnym z tych formatów, a
  serwer konwertuje go do Markdown:
  - **Formaty tekstowe** — `.md`, `.markdown`, `.txt`, `.html`, `.htm`
    są przepuszczane (HTML przechodzi przez pandoc → GFM Markdown).
  - **Formaty biurowe** — `.docx`, `.doc`, `.odt`, `.rtf` są
    konwertowane przez **pandoc** (`brew install pandoc` na macOS,
    `apt install pandoc` na Linux).
  - **PDF** — `.pdf` jest ekstrahowany przez **pdftotext** z Poppler
    (`brew install poppler` / `apt install poppler-utils`).
  - Skonwertowany Markdown trafia do edytora; kliknij **💾 Save**
    aby zapisać. Wynik jest sanityzowany (to samo usuwanie XSS co przy wklejaniu).
  - Twarde ograniczenie: **10 MB** na przesłanie. Większe pliki → 413.
- **Z LinkedIn** — najłatwiejsza ścieżka: otwórz Claude Code w projekcie
  nadrzędnym, uruchom `/career-ops`, wklej swój URL LinkedIn i zapytaj
  `extract my CV from this and write it to cv.md`.

### Co jest sanityzowane

Po stronie serwera, każdy PUT do `/api/cv` przechodzi przez `stripDangerousMarkdown`:

- Tagi `<script>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`, `<style>`,
  `<form>` — usuwane całkowicie.
- Inline event handlery (`onclick=`, `onerror=`, itp.) — usuwane.
- Schematy URI `javascript:`, `vbscript:`, `data:text/html` — neutralizowane.

Odpowiedź zawiera `sanitized: true` za każdym razem gdy cokolwiek z powyższych zostało
usunięte, abyś wiedział czy źródło zawierało coś niebezpiecznego.

Maksymalny rozmiar treści: 1 MB. Większe zwraca 413.

### Inne przyciski

- **sync-check** — uruchamia `cv-sync-check.mjs` w projekcie nadrzędnym.
  Oznacza niespójności: projekt wymieniony w Twoim CV, ale nie w
  archetype'ach `data/applications.md`, itp.
- **📄 Generate PDF** — streamuje `generate-pdf.mjs`. Wynik trafia do
  `output/*.pdf`. Wymaga Playwright (strona Health pokazuje, czy jest
  zainstalowany w `node_modules` projektu nadrzędnego). Po zakończeniu generowania,
  **najnowszy** PDF jest automatycznie pobierany do Twojego domyślnego folderu Pobrane;
  lista na stronie przechowuje każdy wcześniej wygenerowany plik.

### Wskazówki dotyczące tonu i formatu

- Jeden punktor = jedno osiągnięcie z metryką.
  *„Reduced p99 latency by 38%"* bije *„improved performance"* w
  każdej skali ocen.
- Sekcje w tej kolejności: **Summary** (3–5 linii), **Experience**
  (odwrotna chronologia), **Projects** (maks. 5), **Education**,
  **Skills** (bez duplikatów, bez zupy z buzzwordów).
- Nie przekraczaj 1500 słów. Skala ocen używa gęstej informacji;
  rozbudowane CV jest karane za szum.

---

## 5. Portale i źródła (`portals.yml`)

Konfiguracja skanera mieści się w `portals.yml` w katalogu głównym projektu nadrzędnego.
Trzy sekcje mają znaczenie. Trzy sekcje SPA (poniżej) odpowiadają kanonicznemu
schematowi career-ops.org z
[scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
1:1.

> **Skrót:** URL `#/portals` teraz rozwiązuje się bezpośrednio do **App
> settings** i (gdy skonfigurowane jest regionalne źródło) skacze do
> grupy **Regional sources** — więc zakładkowy lub wpisany link `#/portals`
> nie daje już 404 (v1.42.0).

### `title_filter`

```yaml
title_filter:
  positive: [backend, engineer, senior, tech lead, golang, php]
  negative: [junior, intern, frontend, ios, android, java]
  seniority_boost: [Senior, Staff, Lead, Principal]
```

Skanowana oferta przechodzi, gdy jej tytuł zawiera **co najmniej jedno
pozytywne** słowo kluczowe I **żadnego negatywnego**. Dostosuj oba.
Słowa kluczowe to podciągi bez rozróżnienia wielkości liter.

`seniority_boost` to trzeci klucz filtra tytułów. Słowa kluczowe wymienione
tutaj nie odfiltrują niczego — wypychają pasujące oferty wyżej w
wynikach, żeby „Senior Backend Engineer" znalazł się powyżej „Engineer".
Domyślnie: `["Senior", "Staff", "Lead"]`. Dostosuj, aby pasowało do sposobu,
w jaki nazywane są Twoje docelowe role.

Zacznij od 3–5 pozytywnych słów kluczowych dla jasności; później poszerzaj.

### `location_filter` (opcjonalnie — web-ui 1.33.0, parent #570)

```yaml
location_filter:
  allow:
    - "Remote"
    - "United States"
    - "Atlanta"
  block:
    - "India"
    - "London"
    - "Germany"
```

Filtruje skanowane oferty według ciągu **lokalizacji** (podciąg bez rozróżnienia
wielkości liter), stosowany zarówno przez sweep ATS jak i sweep regionalny.
Semantyka identyczna z kanonicznym `scan.mjs` career-ops:

- Brak klucza `location_filter` → każda lokalizacja przechodzi (domyślnie).
- Oferta z **pustą/brakującą** lokalizacją → przechodzi (brakujące dane
  nie są karane).
- Dopasowanie słowa kluczowego `block` → **odrzucona** (blok ma pierwszeństwo przed
  allow).
- `allow` puste → przechodzi (blok ją już oczyścił).
- `allow` niepuste → musi pasować **do co najmniej jednego** słowa kluczowego.

Klucz najwyższego poziomu w `portals.yml` (rodzeństwo `title_filter`, nie zagnieżdżone
pod `russian_portals`). Użyj go, aby usunąć oferty, które przeżyły filtr
tytułu, ale są w regionie, do którego nie możesz dojechać.

Zacznij od 3–5 pozytywnych słów kluczowych dla jasności; później poszerzaj.

**`content_filter` (opcjonalnie — web-ui 1.75.0, parent #974).** Klucz najwyższego
poziomu, rodzeństwo `location_filter`, z tymi samymi listami słów kluczowych
`positive` / `negative`, ale dopasowywany do tekstu **opisu / fragmentu** oferty
zamiast jej lokalizacji:

```yaml
content_filter:
  positive: ["python", "machine learning"]
  negative: ["security clearance", "on-site only"]
```

Semantyka identyczna z `location_filter`: brak klucza → wszystko przechodzi; oferta
z **pustym/brakującym** opisem przechodzi (brakujące dane nie są karane);
dopasowanie `negative` → odrzucona; `positive` puste → przechodzi; `positive`
niepuste → musi pasować do co najmniej jednego słowa kluczowego (podciąg bez
rozróżnienia wielkości liter). Stosowany zarówno przez sweep ATS, jak i regionalny.
Dotyczy tylko źródeł, które dostarczają opis/fragment (np. RSS) — każda inna oferta
przechodzi — więc włączenie go nigdy po cichu nie usuwa wierszy ze źródeł, które nie
przenoszą treści. Użyj go, aby usunąć ofertę przechodzącą filtr tytułu, której treść
ujawnia czynnik dyskwalifikujący.

### `search_queries`

```yaml
search_queries:
  - name: "Greenhouse — Rails Engineer"
    query: 'site:job-boards.greenhouse.io "Rails Engineer" OR "Ruby on Rails" remote'
    enabled: true
  - name: "Ashby — Senior Backend"
    query: 'site:jobs.ashbyhq.com "Senior Backend" remote'
    enabled: false
```

`search_queries` napędzają skan Opcji B oparty na AI (`/career-ops scan`
wewnątrz Claude Code / Codex). NIE są wykonywane przez `npm run scan`
w procesie (który trafia tylko do publicznych API portali). Używaj ich, gdy
chcesz odkrywać role w firmach, których nie ma jeszcze w
`tracked_companies`. Ustaw `enabled: false`, aby zachować wpis bez
uruchamiania go.

### `tracked_companies`

```yaml
tracked_companies:
  - { name: Stripe,     enabled: true, careers_url: https://job-boards.greenhouse.io/stripe }
  - { name: Linear,     enabled: true, careers_url: https://jobs.ashbyhq.com/linear }
  - { name: JetBrains,  enabled: true, careers_url: https://jobs.lever.co/jetbrains }
```

Wymagane pola na wpis: `name` i `careers_url`. Opcjonalne:
`api` (jawny punkt końcowy Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday),
`enabled: true|false` aby włączyć/wykluczyć bez usuwania
wpisu. Skaner ATS wykrywa ATS na podstawie wzorca URL
(`job-boards.greenhouse.io/<slug>` → Greenhouse, itp.) i pobiera
publiczne API portalu każdej firmy bezpośrednio. Firmy bez rozpoznawalnego
ATS są pomijane (karta **Active Companies** na `/#/scan` pokazuje je
na szaro z `○`).

### `rss` (kanały RSS / Atom)

```yaml
tracked_companies:
  - { name: LaraJobs, enabled: true, provider: rss, rss: https://larajobs.com/feed }
  - { name: WeWorkRemotely, enabled: true, provider: rss, rss: https://weworkremotely.com/remote-jobs.rss }
```

Skieruj skaner na dowolny portal pracy publikujący kanał RSS/Atom (LaraJobs, WeWorkRemotely, RemoteOK, golangprojects, …) dodając wpis z `provider: rss` plus kluczem `rss:` (lub `feed_url:`) — **bez zmian kodu**. Adapter RSS parsuje każdy `<item>` (CDATA + encje HTML, tytuły/firmy z usuniętymi tagami), normalizuje go do oferty pracy i uruchamia ten sam przepływ `title_filter` / `location_filter` + dedup + pipeline-append co źródła ATS. **RSS** pojawia się wtedy jako wybieralne źródło w menu rozwijanym filtrów `#/scan`. (web-ui v1.62.x)


### `russian_portals`

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]      # or just one
  area: 113                 # 1=Moscow, 2=SPb, 113=Russia, 1001=remote
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Тимлид PHP"
```

`queries` to dopasowania podciągów bez rozróżnienia wielkości liter względem tytułów ofert
na hh.ru i Habr Career. **Uważaj na nakładanie się z listą negatywną**
— jeśli `"Senior PHP"` jest w `queries`, ale `"php"` skończy na liście
`title_filter.negative`, skan zwróci zero wyników i konsola
ostrzeże Cię o konflikcie.


### Konfiguracja rosyjskich portali — szczegółowy przewodnik

v1.29.0 dostarcza 5 adapterów w języku rosyjskim. Dwa nie potrzebują niczego poza domyślnym UA (`habr-career`, scraping HTML; `trudvsem`, rządowe API open-data — bez klucza, bez blokady IP). Dwa to scrapery HTML portali technicznych (`getmatch`, `geekjob` — też bez klucza). Jeden to kanoniczne API hh.ru, które może zwracać 403 z nie-rosyjskich IP, chyba że ustawisz zmienną środowiskową `HH_USER_AGENT` przez **App settings → API keys & runtime** (lub uruchomisz serwer z rosyjskiego IP / węzła wyjściowego VPN).

#### Inwentarz źródeł

| Klucz źródła | Etykieta wyświetlana | Typ | Auth | Ograniczenie geograficzne |
|---|---|---|---|---|
| `hh` | hh.ru | JSON API | opcjonalny `HH_USER_AGENT` | nie-rosyjskie IP mogą zwrócić 403 |
| `habr` | Habr Career | HTML | brak | brak |
| `trudvsem` | Trudvsem | JSON API (open-data) | brak | brak |
| `getmatch` | GetMatch | HTML | brak | brak |
| `geekjob` | GeekJob | HTML | brak | brak |

#### Krok 1 — Otwórz `portals.yml`

Plik mieszka w katalogu głównym nadrzędnego `career-ops/` (NIE wewnątrz `web-ui/`). Jeśli jeszcze nie istnieje, skopiuj przykładowy plik dostarczony z projektem nadrzędnym:

```bash
# from the parent career-ops/ root (NOT web-ui/)
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

#### Krok 2 — Włącz wszystkie 5 źródeł

Dodaj lub zaktualizuj blok `russian_portals`, aby wylistować każde źródło, które chcesz skanować. Kolejność w tablicy jest nieistotna; skaner przechodzi przez nie w kolejności rejestru.

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]
  area: 113                  # 1=Moscow, 2=SPb, 113=Russia, 1001=remote
  per_page: 50               # how many vacancies per query per source
  only_remote: false         # set true to keep only remote postings
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Backend Senior"
    - "Тимлид PHP"
```

#### Krok 3 — Dostosuj zapytania i filtry

`queries` to ciągi, których skaner używa do przeszukiwania każdego źródła. Każde zapytanie jest uruchamiane raz na każdym źródle — więc 4 zapytania × 5 źródeł = 20 wywołań na skan. Utrzymuj listę skoncentrowaną (3–7 zapytań), aby czas skanowania był poniżej minuty. `area` to kod regionu hh.ru (inne źródła go ignorują). `per_page` ogranicza liczbę ofert, które każde źródło zwraca na zapytanie. `only_remote: true` filtruje każdy wynik do tylko zdalnych na poziomie adaptera (tabela wyników nadal ma oddzielny chip Remote).

#### Typowe pułapki

**Kolizja z listą negatywną.** Jeśli słowo z zapytania (`"php"`, `"senior"`) pojawia się też w `title_filter.negative`, każdy wynik jest filtrowany zanim go zobaczysz. Skaner emituje ostrzeżenie o kolizji na stderr przy skanowaniu — szukaj linii `⚠ config: query "Senior PHP" contains "php" which is in the negative list`. Napraw usuwając kolidujące słowo z `negative`:

```yaml
title_filter:
  positive: [backend, senior, lead, php, go, golang, python]
  negative: [junior, intern, frontend, ios, android]
russian_portals:
  queries:
    - "Senior PHP"     # OK — "php" no longer in negative list
    - "Senior Go"
```

#### Tymczasowe wyłączenie jednego źródła

Aby wyłączyć źródło bez usuwania jego danych, po prostu usuń jego klucz z `sources`:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem"]   # only 3 of 5 sources will run
```

#### Weryfikacja konfiguracji

Po zapisaniu `portals.yml`:

```bash
# 1. Save portals.yml.
# 2. In the SPA, switch to #/scan.
# 3. Click 🌐 Scan now.
# 4. Watch the SSE log for the per-source line per query:
#       "Senior PHP"
#         hh.ru    18
#         habr     21
#         trudvsem  3
#         getmatch  0
#         geekjob   2
#    A value of 0 is normal for some queries — it just means that
#    source had no matches. A "geo-blocked" or "timeout" line means
#    the adapter reached the site but couldn't read results.
```

### Przepływ CLI bootstrap ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

Kanoniczne ustawienie career-ops (uruchamiane z katalogu nadrzędnego raz):

```bash
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

To cały bootstrap. Edytuj trzy sekcje (`title_filter`,
`tracked_companies`, `search_queries`, opcjonalne `russian_portals`),
zapisz i jesteś gotowy do skanowania.

### Zachowanie SPA podczas bootstrap

Przy pierwszym uruchomieniu serwer dopisuje udokumentowany blok `russian_portals:`
do `portals.yml`, jeśli go brakuje — idempotentnie (drugie uruchomienie jest no-op,
bo literalna linia `russian_portals:` jest już tam). Angielskie
sekcje NIE są automatycznie wstrzykiwane; pochodzą z
`templates/portals.example.yml`, który skopiowałeś zgodnie z kanonicznym bootstrapem
powyżej.

---

## 6. Diagnostyka (`#/health`)

Każda brama konfiguracyjna, w odznakach OK / OPTIONAL / FAIL. Przeczytaj to przed
zgłaszaniem jakiegokolwiek problemu „nie działa".

### Wymagane sprawdzenia (system nie może działać bez tych elementów)

- `Node version` ≥ 18 — serwer używa natywnego `fetch` i
  `node:test`.
- `Project root` — że `CAREER_OPS_ROOT` (env lub auto-wykryty)
  istnieje.
- `cv.md`, `config/profile.yml`, `portals.yml`,
  `data/applications.md`, `data/pipeline.md`, `modes/oferta.md`.

### Opcjonalne sprawdzenia (tylko ostrzeżenia)

- `Profile customized` — `candidate.full_name` to nie jest placeholder
  szablonowy.
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` — ustawione w `.env`.
- `(server uses default UA)` — ma znaczenie tylko jeśli skanujesz hh.ru spoza Rosji.
- `Playwright (parent node_modules)` — wymagany do generowania PDF
  i `check-liveness.mjs`. Zainstaluj przez
  `cd $CAREER_OPS_ROOT && npm install && npx playwright install chromium`.
- `Parent project dependencies` — `cd $CAREER_OPS_ROOT && npm install`
  jeśli brakuje.
- Katalogi `data/`, `reports/`, `output/`, `jds/` — tworzone automatycznie przy
  pierwszym zapisie.

Gdy serwer jest eksponowany poza pętlą zwrotną (`HOST=0.0.0.0`) absolutne
ścieżki i dokładna wersja Node są zastępowane przez `"hidden"` w
odpowiedzi, żeby ciekawski sąsiad nie mógł sfingerprintować Twojej instalacji.

### Przyciski uruchamiania

- **▶ Doctor** uruchamia `node doctor.mjs` i pokazuje wyniki w modalu.
- **▶ Verify pipeline** uruchamia `node verify-pipeline.mjs`.

---

## 7. Skaner (`#/scan`)

Skaner przeszukuje każdy włączony portal, deduplikuje względem Twojej
historii i zapisuje trafienia do `data/last-scan.json` i
`data/pipeline.md`.

### Skan jednym kliknięciem (SPA)

**🌐 Scan** uruchamia każde włączone źródło w jednym przebiegu:

- Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (sweep ATS) dla każdej firmy w
  `tracked_companies` z rozpoznawalnym URL ATS.
- Agregatory z v1.75.0 dla każdego wpisu `tracked_companies`, który się na nie zdecyduje: RemoteOK / Remotive / Working Nomads (ogólnoportalowe kanały zdalne, `provider: <slug>`) oraz IBM / Arbeitsagentur / Glints / Jobstreet · SEEK (sterowane konfiguracją, blok `<provider>:` na wpis).
- hh.ru API + Habr Career + Trudvsem + GetMatch + GeekJob dla każdego zapytania w `russian_portals`.

**Dwie fazy, jedno kliknięcie (v1.29.2).** Pojedynczy przycisk 🌐 Scan napędza OBIE sweep ATS i sweep regionalny w jednym strumieniu SSE. W logu zobaczysz dwa nagłówki faz, w kolejności:

1. `▶ ATS scan (Greenhouse + Ashby + Lever)` — portale ATS EN.
2. `▶ Regional scan (hh.ru + Habr Career)` — 5 źródeł RU z rejestru.

Każda faza kończy się podsumowaniem `✓ done · NEW=N`. Jeśli widzisz tylko fazę ATS, Twoja instalacja jest na kompilacji sprzed v1.29.2 — zaktualizuj. Przed v1.29.2 klient SSE zamykał się przy pierwszym zdarzeniu `done` i faza regionalna była po cichu pomijana (`tests/scan-stream-multi-phase.test.mjs` to sieć regresji).

Log SSE na żywo streamuje do prawego panelu podczas skanowania. Kliknij
**Stop** (lub po prostu przejdź do innej strony), aby przerwać — serwer anuluje
żądania HTTPS w trakcie przez `AbortController`.

### Filtrowanie wyników

Poniżej logu tabela wyników renderuje wiersze z `data/last-scan.json`.

> **v1.78.1 — odświeżanie na żywo.** Tabela wyników aktualizuje się teraz automatycznie podczas trwania skanowania i jeszcze raz tuż po jego zakończeniu — bez ręcznego przeładowania ani przełączania strony.

Filtry:

- **Tekst wolny** — dopasowanie podciągu względem tytułu / firmy.
- Menu rozwijane **Source** — Arbeitsagentur / Ashby / BambooHR / Breezy HR / Comeet / GeekJob / Glints / Greenhouse / GetMatch / Habr Career / hh.ru / IBM / Jobstreet · SEEK / Lever / Personio / Recruitee / RemoteOK / Remotive / RSS / SmartRecruiters / SolidJobs / Trudvsem / We Work Remotely / Workable / Workday / Working Nomads (auto-wypełniane z `GET /api/scan/sources`).
- Menu rozwijane **Remote / Hybrid / Onsite**.
- Menu rozwijane **Country** (v1.78.0) — filtr geograficzny zasilany krajami wykrytymi w bieżących wynikach, każdy pokazany z emoji flagi i licznikiem (np. `🇩🇪 Germany (12)`). Wybierz jeden, aby zachować tylko role powiązane z tym krajem. Wykrywanie mapuje swobodny tekst lokalizacji oferty (nazwy krajów/aliasy + ~100 dużych miast rynku pracy) na kraj; jest zachowawcze i nigdy nie zgaduje, więc oferta, której lokalizacji nie da się rozwiązać — lub czysto „Remote” — pozostaje pod **All countries**. Połącz go z menu rozwijanym typu pracy, aby znaleźć role powiązane z krajem *oraz* zdalne.
- **Chipy stack** (PHP / Go / Backend / Senior / …) — auto-wykrywane
  na wiersz przez `Skills.detectTech` i `Skills.detectLevel`. Wielokrotny wybór
  z przecięciem — wybranie `PHP + Senior` pokazuje wiersze mające OBA.
- **Dynamiczne chipy** poniżej statycznych chipów stack — 25 najczęstszych
  dużymi literami tokenów z tytułów, więc interfejs adaptuje się do
  ról, które faktycznie skanujesz (marketing, design, finanse…)
  zamiast być zablokowany na słowniku inżyniera backendu.

### Karta aktywnych firm

Składana karta listująca każdą firmę w `portals.yml` z jej
statusem skanowania:

- ✓ zielony tag — bezpośrednie wsparcie API (Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday).
- ○ szary tag — fallback do promptu wyszukiwania webowego (brak dopasowania API).

**Kliknij nazwę firmy** → wypełnia filtr wyników powyżej tą
nazwą. **Kliknij ikonę ↗** → otwiera `careers_url` firmy w nowej zakładce.

### Przepływ skanowania z CLI ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

Dwa sposoby skanowania ze strony CLI (oba odkładają URL-e do tego samego
`data/pipeline.md`, które czyta SPA):

**Opcja A — bezpośredni skrypt (~30 s, zero tokenów AI):**

```bash
npm run scan                          # all Greenhouse/Ashby/Lever boards
npm run scan -- --dry-run             # preview without persisting
npm run scan -- --company Anthropic   # narrow to one tracked company
```

Działa tylko dla Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (rozpoznawalne URL-e ATS).
Bez tokenów AI — trafia bezpośrednio do publicznych API portali.

**Opcja B — skan przeglądarki oparty na AI:**

```
/career-ops scan
```

Wewnątrz Claude Code / Codex / Cursor / Gemini CLI. Używa tokenów modelu.
Odwiedza każdą stronę `tracked_companies` bezpośrednio i może odkrywać portale
bez API (strony kariery, niestandardowy ATS, portale regionalne). Wolniejszy, ale
szerszy. Przydatny gdy sweep ATS nie zwraca nic dla celu, o którym
wiesz, że rekrutuje.

**Wyniki (obie ścieżki)** — nowe URL-e JD dopisane do `data/pipeline.md`,
każdy odwiedzony URL zalogowany do `data/scan-history.tsv` (dedup przez wszystkie
przyszłe skany), podsumowanie wydrukowane: firmy przeskanowane · oferty znalezione ·
przefiltrowane przez tytuł · pominięte duplikaty · nowe oferty dodane.

**Progi działania według wyniku** (stosowane po tym, jak `/career-ops pipeline`
wsadowo oceni nowe URL-e):

| Wynik | Zalecany następny krok |
|---|---|
| **≥ 4.5** | `/career-ops apply` — wysokie dopasowanie, aplikuj natychmiast |
| **4.0 – 4.4** | aplikuj lub `/career-ops contacto` dla ciepłego wprowadzenia |
| **3.5 – 3.9** | `/career-ops deep` — najpierw zbadaj |
| **< 3.5** | pomiń, chyba że masz konkretny osobisty powód |

`#/dashboard` i `#/tracker` w SPA podświetlają każdy wiersz o wartości
4.0 lub wyższej, żebyś mógł podjąć działanie bez ponownego uruchamiania czegokolwiek.

### Polecenia uzupełniające

Po ocenianiu, kanoniczne follow-upy to:

- `/career-ops apply` — Wypełnij aplikację spersonalizowanymi odpowiedziami
- `/career-ops contacto` — Przygotuj wiadomość na LinkedIn / email
- `/career-ops deep` — Dogłębnie zbadaj firmę / rolę
- `/career-ops tracker` — Zobacz status pipeline

---
### hh.ru — skanowanie ze strony internetowej (bez konfiguracji, bez proxy)

hh.ru jest skanowany przez odczyt jego publicznej witryny wyszukiwania (`hh.ru/search/vacancy`), tak samo jak Habr Career — **działa z każdego IP, bez klucza, proxy ani konfiguracji.** JSON API (`api.hh.ru`) jest celowo *nieużywane*: teraz zwraca `403 forbidden` dla każdego klienta programistycznego niezależnie od IP lub User-Agent (blokada anty-bot na krawędzi, nie udokumentowany błąd API), podczas gdy strona internetowa serwuje pełne wyniki każdemu klientowi podobnemu do przeglądarki. Dlatego hh.ru działa dokładnie jak Habr i Trudvsem — po prostu utrzymuj go w `russian_portals.sources` i skanuj.

## 8. Pipeline (`#/pipeline`)

Skrzynka odbiorcza adresów URL oczekujących na ocenę. Przechowywana w `data/pipeline.md`.

### Dodawanie adresów URL

Trzy sposoby:

- Wpisz / wklej URL do inputu + kliknij **+ Add**.
- Użyj **globalnego wyszukiwania na górnym pasku** (jego plakietka pokazuje **Enter**): wklej dowolny link `http(s)://…` i naciśnij **Enter**, aby otworzyć auto-pipeline; wpisz dowolny inny tekst, a **Enter** przeniesie do `#/scan` ze wstępnie wypełnionym tym hasłem (v1.78.1). Ctrl/Cmd+K nadal ustawia fokus na polu tam, gdzie pozwala na to przeglądarka. Logo marki wraca do pulpitu.
- Uruchom Scan (patrz wyżej) — nowe trafienia trafiają do pipeline
  automatycznie.

Każdy URL przechodzi przez `isValidJobUrl()` po stronie serwera. Loopback
(`localhost`, `127.0.0.1`), `file://`, `javascript:`, literały IP i
ciągi ze znakami szablonów (`<`, `>`, `"`) — wszystkie zwracają 400.

### Panel podglądu po stronie serwera

Kliknij dowolny wiersz pipeline, aby załadować podgląd po prawej. Większość portali ATS
nie wysyła nagłówków CORS, więc przeglądarka nie może ich bezpośrednio pobrać;
serwer proxy-uje żądanie, usuwa `<script>` / `<style>` / tagi HTML
i zwraca do 8 KB czystego tekstu.

Proxy podglądu ręcznie przechodzi przez przekierowania z **walidacją SSRF
na każdym przeskoku** — każdy nagłówek `Location` przechodzi przez `isValidJobUrl()`
ponownie, więc wrogie forum nie może odbić Cię do loopbacku / prywatnego IP
/ `file://`. Ograniczone do 3 przeskoków, limit czasu 15 sekund.

### Akcje wierszy

- **▶** — skacze do `#/evaluate?url=…` z URL wstępnie wypełnionym.
- **✕** — usuwa URL z `data/pipeline.md`.

### Przyciski w prawym górnym rogu

- **⚡ Evaluate first** — otwiera pierwszy kolejkowany URL na stronie Evaluate,
  gotowy do oceniania.
- **Scan** — powrót do skanera jeśli chcesz więcej URL-i.

---

## 9. Ocena oferty (`#/evaluate`)

Ocenia pojedynczy opis stanowiska względem `cv.md` i
`config/profile.yml`. Zwraca strukturalną ocenę A–G zgodnie z
`modes/oferta.md` plus wynik 0–5.

### Dane wejściowe

Wklej JD do textarea lub przyjedź tutaj z `#/pipeline` z
`?url=<href>` — strona pobiera URL przez ten sam proxy bezpieczny dla SSRF
używany dla podglądów pipeline i wstępnie wypełnia textarea.

Kliknij **💾 Save JD**, aby zapisać JD do `jds/jd-<date>-<ts>.txt`
dla śladu audytu (lub przekaż `save: true` w wywołaniu API — ten sam
efekt).

### Łańcuch awaryjny

1. **Anthropic** — preferowany gdy ustawiony `ANTHROPIC_API_KEY`. Serwer
   pakuje `cv.md`, `config/profile.yml`, `modes/_shared.md`
   i `modes/oferta.md` do bloku `<project_context>` przed
   promptem (każdy plik ograniczony do 16 KB, cały prompt miękko ograniczony do
   200 KB). Zwraca ugruntowany Markdown bezpośrednio do strony.
2. **Gemini** — gdy ustawiony tylko `GEMINI_API_KEY`. Serwer tworzy
   `gemini-eval.mjs` z JD jako plikiem tymczasowym. Model darmowego planu
   (`gemini-2.0-flash`) jest odpowiedni do rutynowego oceniania.
3. **Ręczny** — brak klucza. Strona zwraca w pełni uformowany prompt,
   który możesz wkleić do Claude Code, ChatGPT lub dowolnego innego LLM.

### Sekcje wyjściowe (kanoniczne career-ops.org A-F)

> **Realignment v1.15.0.** Litery bloków teraz pasują do
> [kanonicznego schematu career-ops.org](https://career-ops.org/docs).
> Raporty sprzed v1.15 używały A–G (z `C=Risks`, `F=Verdict`,
> `G=Legitimacy`); nadal renderujemy je tak jak są dla wstecznej
> kompatybilności, ale nowe raporty emitują A–F z kanonicznymi
> znaczeniami poniżej. Wynik i Wiarygodność teraz mieszkają w nagłówku raportu
> (`score: 4.2/5`, `legitimacy: High|Medium|Low`).

A. **Role Summary** — podsumowanie w 3 punktach (ryzyka wymienione inline).
B. **CV Match** — top 3 trafione umiejętności + top 3 brakujące.
C. **Strategy** — rekomendacja: aplikuj teraz / najpierw contacto /
najpierw deep / pomiń. Było `Risks` przed v1.15.
D. **Compensation** — względem Twojego
`target.comp_total_min_usd` (legacy) lub `compensation.target_range`
(kanoniczne).
E. **Personalization** — kąt wiodący, framing per archetype,
haczyki do wspomnienia w liście motywacyjnym / outreachu. Było `Application
Strategy` przed v1.15.
F. **STAR stories** — 1–3 gotowe do wklejenia bloki S-T-A-R dopasowane
do roli. Było `Verdict` (surowy wynik) przed v1.15; wynik teraz
pojawia się w nagłówku raportu obok `legitimacy`.

### Zapisywanie raportu

Kliknij **💾 Save report** (lub użyj przełącznika zapisu w wywołaniu API), aby
zapisać Markdown do `reports/<date>-<company>-<role>.md`. Sparsowany
nagłówek raportu (Wynik / Wiarygodność / URL) pojawia się na stronie
**Reports** i **Dashboard**.

### Ocena wsadowa przy 10+ JD

Dla jednego JD ta strona `#/evaluate` to odpowiednie narzędzie. Dla 10+
URL-i kolejkowanych w pipeline klikanie przez jeden JD jest niepraktyczne
— przeskocz do sekcji §14 **Batch evaluate** (uruchomienie
`./batch/batch-runner.sh` z projektu nadrzędnego), zostaw to na noc, a
potem wróć do `#/reports` / `#/tracker` po wyniki. Pełny przepływ:
[batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers).

---

## 10. Raporty (`#/reports`)

Przeglądaj każdą zapisaną ocenę. Karty pokazują tytuł, datę, flagę
wiarygodności i wynik (kolorowany: zielony ≥ 4.0, żółty ≥ 3.0, czerwony poniżej).

Kliknij kartę, aby przeczytać pełny Markdown. Paginacja: 12 na stronę;
kontrolki na dole.

Widok jednego raportu zawiera też:

- **← All reports** — powrót do siatki.
- **🔗 Open JD** — otwiera oryginalne ogłoszenie o pracę w nowej zakładce.

---

## 11. Tracker (`#/tracker`)

CRM. Jeden wiersz na aplikację; przechowywany w `data/applications.md` jako
tabela GitHub-Flavored Markdown.

### Przepływ statusu

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` /
`Rejected` / `Discarded` / `SKIP`.

Biała lista statusów jest egzekwowana po stronie serwera; wysłanie czegokolwiek innego w
`POST /api/tracker` domyślnie ustawia `Evaluated`. Kanoniczne
przejście `Evaluated → Applied` jest automatyczne, gdy potwierdzisz
`Submitted.` na końcu `/career-ops apply` (patrz §14).

### Układ kolumn

| Kolumna | Co to jest |
|---|---|
| `#` | Auto-numerowany, uzupełniany zerami (`001`, `002`, …). |
| `Date` | Data ISO (`YYYY-MM-DD`). Domyślnie dzisiaj. |
| `Company` | Dowolny tekst. **Potoki (`\|`) i znaki nowej linii są escapowane automatycznie.** |
| `Role` | To samo. |
| `Score` | Format `N/5` (np. `4.2/5`). |
| `Status` | Wyliczenie z białą listą. |
| `PDF` | ✅ gdy `generate-pdf.mjs` powiodło się dla tego wiersza. |
| `Report` | Link Markdown do pasującego `reports/*.md`. |
| `Notes` | Dowolny tekst, ograniczony do 200 znaków. |

### Filtry

- Menu rozwijane **Status**.
- Menu rozwijane **Score** — `≥ 4.0` (wysoki), `≥ 3.0` (średni), `< 3.0` (niski).
- **Search** — dopasowanie podciągu po firmie + roli.

Każdy filtr resetuje paginator do strony 1. 25 wierszy na stronę.

### Przyciski konserwacyjne

- **▶ Normalize** uruchamia `normalize-statuses.mjs` — ponownie kanonizuje
  pisownię statusów (`applied` → `Applied`, `interview` → `Interview`).
- **▶ Dedup** uruchamia `dedup-tracker.mjs` — usuwa duplikaty bez rozróżnienia
  wielkości liter według `(company, role)`.
- **▶ Merge** uruchamia `merge-tracker.mjs` — pobiera oczekujące wpisy z
  `batch/tracker-additions/*.tsv` (gdzie przepływ wsadowy projektu nadrzędnego odkłada
  aplikacje złożone przez pomocnika Apply). Deduplikuje i
  archiwizuje przetworzone pliki do `batch/tracker-additions/merged/`. Patrz
  [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  dla upstream przepływu wsadowego.

### Dodawanie wierszy

`POST /api/tracker` — treść `{ company, role, score?, status?, url?,
reportSlug?, notes?, date? }`. Dedup według `(company, role)`
bez rozróżnienia wielkości liter. Z interfejsu, strona Evaluate oferuje przycisk „Add to
tracker" po pomyślnym ocenieniu.
---

## 12. Pogłębiony research (`#/deep`)

Generuj strukturalny brief o firmie: snapshot, kultura inżynieryjska,
ostatnie wiadomości, sentyment Glassdoor, proces rekrutacyjny, punkty dźwigni
negocjacyjnej, trzy mądre pytania do zadania rekruterowi.

### Dane wejściowe (deep)

Dwa pola — nazwa firmy i (opcjonalnie) rola. Szablon trybu
(`modes/deep.md`) kształtuje strukturę.

### Ścieżki wyjściowe

Ten sam łańcuch awaryjny co Evaluate:

1. **Anthropic na żywo** (preferowany) — `bundleProjectContext` inlinuje
   cv + profil + `_shared.md` + `deep.md`. Wynik: 10–30 KB
   ugruntowanego Markdown zapisanego do
   `interview-prep/<company>-<role>.md`.
2. **Gemini na żywo** — wywołanie `gemini-eval.mjs`. Ten sam cel zapisu.
3. **Ręczny prompt** — strona przekazuje Ci gotowy prompt dla
   Claude Code (który ma WebFetch + WebSearch i może przeprowadzić prawdziwy research).

### Wskazówki

- Anthropic na `claude-sonnet-4-6` typowo zwraca ~13 KB użytecznego
  tekstu w 1–3 minuty na wywołanie.
- Anthropic SDK nie ma wbudowanego wyszukiwania webowego. Dla ról, gdzie
  potrzebujesz świeżych wiadomości + sentymentu Glassdoor, wklej ręczny prompt do
  Claude Code i pozwól mu użyć narzędzia WebFetch.
- Wywołania na żywo są płatne; jedno wywołanie deep-research z Sonnet 4.6 kosztuje ≈
  $0.30–0.50.

---

## 13. Tryby promptów (siedem stron `/#/<mode>`)

Siedem kreatorów promptów: idee **Project**, plany **Training**,
e-maile **Follow-up**, oceny **Batch**, **Outreach** do
rekruterów, jednostronicowe materiały **Interview prep** i
retrospekcje **Patterns**. Każdy opakowuje konkretny szablon `modes/<slug>.md`:

| Strona | Slug | Cel |
|---|---|---|
| `#/project` | `project` | Dopasuj projekt portfolio do docelowej roli. |
| `#/training` | `training` | Analiza luk umiejętności → curriculum. |
| `#/followup` | `followup` | Szkic e-maila po rozmowie kwalifikacyjnej. |
| `#/batch` | `batch` | Prompt do wsadowej oceny wielu JD. |
| `#/contacto` | `contacto` | Wiadomość do rekrutera / osoby polecającej. |
| `#/interview-prep` | `interview-prep` | Jednostronicowe przygotowanie do konkretnej rundy rozmowy. |
| `#/patterns` | `patterns` | „Jakie wzorce sprawiły, że odniósłem sukces?" — analiza refleksyjna. |

### Wspólna struktura

Każda strona ma mały formularz (pola są specyficzne dla trybu), przycisk **▶
Generate prompt** (ręczny) i — gdy obecny jest klucz Anthropic lub Gemini —
przycisk **⚡ Run live**, który awansuje do podstawowego.

Kliknięcie **▶ Generate prompt** zwraca zmontowany prompt z Twoimi
wartościami formularza JSON-ifikowanymi do bloku `User-supplied context:`,
po którym następuje verbatim szablon `modes/<slug>.md`. Kopiuj i wklej
do wybranego przez Ciebie LLM.

Kliknięcie **⚡ Run live** wysyła ten sam prompt do Anthropic (lub
Gemini), z `cv.md` + `profile.yml` + `_shared.md` inlinowanymi przez
`bundleProjectContext`. Wynik jest renderowany na stronie, możliwy do skopiowania i
pobierania jako `.md`.

Siedem stron to jawna lista dozwolona — tryby mające
dedykowaną trasę (`oferta` → Evaluate, `deep` → Deep research) i
tryby, które projekt nadrzędny obsługuje tylko wewnątrz Claude Code (`apply`,
`scan`, `pipeline`, `tracker`, `pdf`, `latex`, `ofertas`,
`auto-pipeline`) celowo pozostają poza tym interfejsem.

---

## 14. Lista kontrolna aplikacji (`#/apply`)

Po podjęciu decyzji o aplikowaniu, ta strona pomocnika Apply generuje
listę kontrolną zgłoszenia dla rzeczywistego kroku aplikowania. NIE **auto-wypełnia**
formularzy — ten przepływ pozostaje w `/career-ops apply` wewnątrz Claude Code,
który używa Playwright w projekcie nadrzędnym.

### Tryb listy kontrolnej SPA (`#/apply`)

Lista kontrolna SPA jest dla użytkowników, którzy wolą wypełniać formularz ręcznie
bez wywoływania Playwright. Obejmuje:

0. Uruchom `/career-ops apply <url>` w Claude Code, aby odczytać formularz przez
   Playwright (pomiń ten krok jeśli wypełniasz ręcznie).
1. Zweryfikuj, że ogłoszenie jest nadal aktywne (`check-liveness.mjs`).
2. Potwierdź, że CV jest najnowsze (`cv-sync-check.mjs`, potem PDF jeśli wynik ≥ 4.0).
3. Dopasuj list motywacyjny / odpowiedź „Dlaczego my?" używając bloków dowodów STAR+R
   z `cv.md`.
4. Odpowiedz na pytania EEO / sponsorship / data-startu zgodnie z prawdą.
5. Zapisz wypełnione odpowiedzi do
   `interview-prep/{company}-{role}.md` przed złożeniem.
6. **NIGDY nie wysyłaj automatycznie** — to Ty (człowiek) klikasz ostatni przycisk.
7. Po złożeniu: dodaj wiersz do `data/applications.md` (lub zapisz TSV do
   `batch/tracker-additions/`).

### Wypełnianie ręczne vs wspomagane Playwright

Dwie drogi do rzeczywistego złożenia:

- **Ręczne** — otwórz stronę kariery w normalnej zakładce przeglądarki, postępuj
  zgodnie z powyższą listą kontrolną SPA, kopiuj/wklejaj odpowiedzi. Playwright nie jest potrzebny.
  Używaj, gdy formularz jest krótki lub nie masz zainstalowanego Chromium.
- **Wspomagane Playwright** — uruchom `/career-ops apply <company>` w
  Claude Code (projekt nadrzędny). Playwright otwiera własną przeglądarkę,
  odczytuje każde pole formularza, zwraca ponumerowane szkice odpowiedzi. Ty nadal
  klikasz Wyślij. Używaj, gdy formularz jest długi, dynamiczny lub chcesz
  śladu audytu, które pytania miały które odpowiedzi.

### Pełny przepływ CLI apply ([apply-for-a-job](https://career-ops.org/docs/introduction/guides/apply-for-a-job))

**Wymagania wstępne:**

1. Najpierw uruchom `/career-ops pipeline`, aby JD miał raport oceny
   w `reports/`. Polecenie apply zależy od istniejącej
   oceny; bez niej najpierw uruchom pipeline.
2. Miej załadowany raport i profil.
3. **Zalecane:** Playwright zainstalowany
   (`npx playwright install chromium` — patrz Playwright Setup poniżej).
   Wraca do WebFetch (tylko tekstowy podgląd formularza, bez click-fill) gdy
   brakuje.

**Numerowany przepływ** (kanoniczne 8 kroków):

1. **Uruchom polecenie** z nazwą firmy:

   ```
   /career-ops apply <company>
   ```

   Przykład: `/career-ops apply Anthropic`. Bez argumentu, podaj
   zrzut ekranu formularza, wklejony tekst formularza lub URL aplikacji
   w następnej turze.

2. **Znajdź raport.** System wyszukuje pasującą ocenę w
   `reports/` (tę utworzoną wcześniej przez `/career-ops pipeline` lub
   `#/evaluate`).

3. **Otwórz formularz.** Playwright uruchamia okno przeglądarki
   **automatycznie** — NIE otwierasz go sam.

4. **Odczytaj pola.** System odczytuje i parsuje każde pole formularza
   (etykieta, typ, wymagane, opcje dla selectów).

5. **Generuj odpowiedzi.** career-ops tworzy spersonalizowane odpowiedzi dla każdego
   pola na podstawie Twojego profilu, proof points i roli.

6. **Zwróć numerowaną listę.** Otrzymujesz odpowiedzi uporządkowane zgodnie z
   układem formularza — proste pola (imię, e-mail) pierwsze, pola tekstowe
   (list motywacyjny, „Dlaczego my?") ostatnie. Oznaczone elementy wskazują na rzeczy
   wymagające ludzkiej uwagi — zakotwiczenie wynagrodzenia, brakujące szczegóły CV,
   pytania opcjonalne.

7. **Ręczne wypełnianie.** Kopiujesz i wklejasz każdą odpowiedź do
   odpowiedniego pola. Ten krok jest ręczny, nie zautomatyzowany. Ty
   najpierw przeglądasz każdą odpowiedź.

8. **Użytkownik składa.** Ty klikasz Wyślij sam. career-ops **nigdy**
   nie klika Wyślij. Potwierdź zakończenie wpisując na czacie:

   ```
   Submitted.
   ```

**Automatyczne aktualizacje po `Submitted.`:**

- Status zmienia się z `Evaluated → Applied` w `data/applications.md`.
- Wypełnione odpowiedzi są zapisywane w Sekcji G raportu dla przyszłego
  odniesienia.

**Przekazanie do trackera:**

```
/career-ops tracker
```

Monitoruj status całego swojego pipeline, niezależnie od wyniku roli.

### Ocena wsadowa ([batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers))

Gdy masz 10+ JD do oceniania naraz (`#/evaluate` w SPA jeden po jednym
jest niepraktyczne przy takiej liczbie), użyj batch runnera z CLI.

**Plik wejściowy — `batch/batch-input.tsv`** (rozdzielony tabulatorami):

| Kolumna | Cel |
|---|---|
| `id` | Unikalny numer sekwencyjny |
| `url` | Pełny link do ogłoszenia o pracę |
| `source` | Platforma źródłowa (LinkedIn, Greenhouse, itp.) |
| `notes` | Opcjonalny kontekst |

Przykładowy wiersz:

```
1<TAB>https://jobs.example.com/senior<TAB>LinkedIn<TAB>
```

**Flagi `./batch/batch-runner.sh`:**

- `--dry-run` — Podgląd oczekujących ofert bez oceniania. Zawsze uruchamiaj
  to najpierw, żeby zwalidować TSV.
- `--parallel N` — Uruchom N równoległych workerów (1, 2 lub 3
  zalecane).
- `--min-score X.X` — Pomiń zapisywanie ofert ocenionych poniżej
  progu. Przydatne, żeby przechowywać raporty tylko dla ról o wysokim dopasowaniu.
- `--retry-failed` — Ponownie przetwarzaj tylko oferty, które miały błędy w
  poprzednim uruchomieniu (błędy sieci, limity prędkości).
- `--max-retries N` — Próbuj nieudane oferty do N razy (domyślnie: 2).
- `--model NAME` — Model Claude przekazany do `claude -p --model` (parent career-ops 1.8.0, #504). Nieustawione = Twój domyślny model subskrypcji Claude Max. Użyj tańszego modelu do dużych partii, np. `claude-sonnet-4-6`. Widoczny w `#/batch` jako input **Model** (web-ui 1.31.0).
- `--start-from N` — Pomiń ID ofert poniżej N (wznów częściowo przetworzone partie). Widoczny w `#/batch` jako input **Start from #** (web-ui 1.31.0).

**Standardowa sekwencja:**

1. **Edytuj** `batch/batch-input.tsv` — jeden wiersz na JD.

2. **Dry-run** (zalecane najpierw):

   ```bash
   ./batch/batch-runner.sh --dry-run
   ```

3. **Uruchom** — sekwencyjnie lub równolegle:

   ```bash
   ./batch/batch-runner.sh                       # one at a time
   ./batch/batch-runner.sh --parallel 2          # two concurrent
   ./batch/batch-runner.sh --parallel 3          # three concurrent
   ./batch/batch-runner.sh --parallel 2 --min-score 4.0  # only persist high-fit
   ```

4. **Ponów nieudane** (sieć / limit prędkości):

   ```bash
   ./batch/batch-runner.sh --retry-failed --max-retries 3
   ```

5. **Raporty** trafiają do `reports/` jako
   `{id}-{company}-{YYYY-MM-DD}.md`. Wiersze podsumowania są dopisywane do
   `batch/tracker-additions/`.

6. **Scal z trackerem:**

   ```bash
   node merge-tracker.mjs                 # apply the batch additions
   node merge-tracker.mjs --dry-run       # preview the merge
   ```

   Polecenie scalania deduplikuje wpisy i archiwizuje przetworzone pliki
   do `batch/tracker-additions/merged/`.

SPA pokazuje wynikowe raporty pod `#/reports` (paginowane,
z kolorowymi pigułkami wyników) i wiersze trackera pod `#/tracker` — dokładnie
tak samo, jakbyś dodał każdy przez `#/evaluate`. Połącz z przyciskiem
konserwacyjnym **▶ Merge** na `#/tracker` jeśli wolisz nie schodzić do CLI.

### Konfiguracja Playwright ([set-up-playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright))

Wymagana dla dwóch funkcji career-ops:

- **Wypełnianie formularzy** w `/career-ops apply` (krok 3 powyżej — Playwright
  otwiera przeglądarkę, odczytuje etykiety pól, sugeruje odpowiedzi).
- **Generowanie PDF** przez `/career-ops pdf` i przycisk SPA
  **📄 Generate PDF** na `#/cv` / `#/reports/:slug` /
  `#/evaluate` / `#/deep` / `#/interview-prep`.

**Fallback gdy brakuje Playwright:** przepływ apply wraca do
WebFetch (tylko tekstowy podgląd formularza, bez click-fill). Generowanie PDF
po prostu zwraca błąd.

**Podstawowa konfiguracja (uruchom z katalogu głównego nadrzędnego career-ops):**

```bash
# Install Chromium for Playwright
npm install
npx playwright install chromium

# Register the Playwright MCP so Claude Code can drive forms
claude mcp add playwright npx @playwright/mcp@latest

# Verify all three components (Chromium, Playwright lib, MCP)
npm run doctor
```

**Alternatywna rejestracja MCP** — dodaj do
`.claude/settings.local.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

**Uwagi dotyczące zachowania:**

- **Headless domyślnie.** Playwright działa cicho. Aby obserwować
  przeglądarkę w akcji, powiedz Claude `open up with playwright the browser
  and fill out the entire form.`
- **Trzy role w jednym pakiecie** — instalacja npm Playwright daje
  Ci bibliotekę automatyzacji przeglądarki, silnik renderowania PDF dla
  `/career-ops pdf` i (przez MCP) przepływ wypełniania formularzy wewnątrz
  Claude Code.
- **Zweryfikuj przed poleganiem na nim** — `npm run doctor` potwierdza wszystkie
  trzy są operacyjne. Strona Health SPA pokazuje sprawdzenie
  `Playwright (parent node_modules)`, które szybko kończy się błędem jeśli brakuje.

---

## 15. Przygotowanie do rozmowy kwalifikacyjnej

To jest faza po researchu, przed rozmową. Trzy artefakty w
tej aplikacji się zbiegają:

1. **Zapisane pliki z pogłębionego researchu** w `interview-prep/`, po jednym na
   parę firma-rola, którą uruchomiłeś. Przeglądaj ze strony **Deep research**
   lub bezpośrednio przez `/api/interview-prep`.
2. **Tryb Patterns** (`#/patterns`) — generuje samorefleksyjny
   prompt: „w moich ostatnich N rozmowach / ofertach / odrzuceniach, jakie
   wzorce się utrzymują?" Przydatne gdy nagromadziłeś 5+ wierszy w trackerze.
3. **Tryb Interview-prep** (`#/interview-prep`) — wstępnie wypełnia
   jednostronicowy materiał dla konkretnej nadchodzącej rundy (behawioralnej, technicznej,
   projektowania systemu). Wynik trafia do tego samego folderu `interview-prep/`.

### Zalecany workflow

Dla każdej rozmowy kwalifikacyjnej, którą masz zaplanowaną:

1. **Ponownie uruchom Deep** (lub otwórz zapisany plik) dzień wcześniej.
2. **`#/interview-prep`** — wygeneruj jednostronicowy materiał dla konkretnej
   rundy. Wklej do swoich notatek.
3. **Rundy projektowania systemu / kodowania** — otwórz `#/training` i poproś o
   30-minutowe ukierunkowane przypomnienie o konkretnym podsystemie podkreślanym przez JD.
4. **Rundy dotyczące wynagrodzenia** — otwórz plik z pogłębionego researchu, przeskocz do
   „Negotiation leverage points." Przynieś 2–3 konkretne punkty danych
   (przedział Glassdoor, ostatnie finansowanie, porównywalna oferta w innej
   firmie).
5. **Rundy behawioralne** — wyciągnij historyjki STAR+R ze swojego `cv.md`, które
   trafiają do sekcji B oryginalnego raportu Evaluate.

Po rozmowie, natychmiast:

1. Zaktualizuj wiersz trackera: status → `Responded` (potem `Interview`,
   `Offer`, itp.).
2. Uruchom `#/followup`, aby przygotować e-mail z podziękowaniem.
3. Jeśli uzyskałeś nowe informacje (przedział wynagrodzeń, skład zespołu, niespodziewany stos technologiczny
   ), edytuj zapisany `interview-prep/<company>-<role>.md`
   z `## Post-round notes` żeby przyszły Ty miał to.

---

## 16. Dziennik aktywności i rozwiązywanie problemów

### Dziennik aktywności (`#/activity`)

Ślad audytu każdego żądania zmieniającego stan trafiającego na serwer.
Rejestruje: dodania do pipeline, zapisy trackera, zapisy CV, zapisy JD, uruchomienia evaluate,
uruchomienia deep-research, uruchomienia scan, zmiany konfiguracji, uruchomienia trybów.

Sekrety (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) są redagowane na
wejściu; nigdy nie zobaczysz prawdziwej wartości klucza w `data/activity.jsonl`.

Filtruj według prefiksu akcji (`pipeline.`, `cv.`, `evaluate`, `scan.`,
itp.). 25 wierszy na stronę; serwer zwraca do 500 najnowszych
zdarzeń.

### Rozwiązywanie problemów

| Objaw | Prawdopodobna przyczyna | Rozwiązanie |
|---|---|---|
| Strona Health czerwona na `cv.md` | Pierwsze uruchomienie, plik jeszcze nie istnieje | `touch $CAREER_OPS_ROOT/cv.md` i odśwież. |
| Health czerwona na `Profile customized` | `candidate.full_name` nadal mówi `Jane Smith` | Edytuj `config/profile.yml`. |
| `hh.ru: HTTP 403` w logu skanowania | Nie-rosyjskie IP, brak `(server uses default UA)` | Zarejestruj się na `dev.hh.ru/admin`, ustaw rosyjskie IP / VPN. |
| `gemini-eval.mjs: ERR_MODULE_NOT_FOUND` | Zależności projektu nadrzędnego nie zainstalowane | `cd $CAREER_OPS_ROOT && npm install`. |
| Błędy Generate PDF | Playwright nie zainstalowany w projekcie nadrzędnym | `cd $CAREER_OPS_ROOT && npx playwright install chromium`. |
| `/career-ops apply` mówi „no report found" | Pipeline nigdy nie ocenił tego JD | Najpierw uruchom `/career-ops pipeline` (lub `#/evaluate`); patrz wymagania wstępne §14. |
| `batch-runner.sh: no such file` | Uruchamianie z niewłaściwego katalogu | `cd $CAREER_OPS_ROOT` przed wywołaniem `./batch/batch-runner.sh`. |
| Serwer zgłasza `EADDRINUSE: 4317` | Stara instancja nadal działa | `pkill -f 'node server/index.mjs'` i uruchom ponownie. |
| Wywołanie LLM na żywo wisi > 2 min | Ogromny prompt lub wolne Anthropic | Sprawdź flagę Anthropic `/api/health`; serwer miękko ogranicza prompty do 200 KB i zwraca 413. |
| Podgląd pipeline pokazuje `(unsafe redirect)` | Ogłoszenie przekierowało do prywatnego IP / loopback | To jest funkcja bezpieczeństwa (REVIEW-B1). Cel przekierowania jest odrzucany, a oryginalny URL pozostaje bez zmian. |
| Tekst wiersza trackera psuje tabelę | Potok w nazwie firmy przed v1.9.1 | Zaktualizuj do v1.9.1+ — potoki są escapowane end-to-end (BF-1). |
| `npm test` nie udaje się na świeżym klonie | Testy zakładają układ projektu nadrzędnego | Użyj `CAREER_OPS_ROOT=$(mktemp -d)` i bootstrap fixtures. |

Dla głębszej diagnostyki: uruchom **▶ Doctor** na stronie Health, skopiuj
wynik i przeszukaj tracker problemów na
<https://github.com/Fighter90/career-ops-ui/issues>.


---

## 17. Jak dodać nowe źródło ofert pracy

career-ops-ui traktuje każdy portal pracy jako **adapter** — pojedynczy plik w
[`server/lib/sources/<slug>.mjs`](../../server/lib/sources/), który wie
jak pobrać i znormalizować wyniki jednego portalu. Od v1.79.0 rejestr
`server/lib/sources/` dostarcza **26** adapterów — 21 angielskich (ATS-y
Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday, RSS oraz
agregatory z v1.75.0 RemoteOK / Remotive / Working Nomads / IBM /
Arbeitsagentur / Glints / Jobstreet · SEEK, oraz BambooHR / Breezy HR / Comeet / Personio / Recruitee / SolidJobs, i We Work Remotely) i 5 rosyjskich portali. Siedem
agregatorów dodanych w v1.75.0 to źródła ogólnoportalowe lub sterowane
konfiguracją, a nie ATS-y per-firma: trzy kanały zdalne wybierane są przez
`provider: remoteok|remotive|workingnomads`, a cztery regionalne
(IBM / Arbeitsagentur / Glints / Jobstreet · SEEK) czytają blok konfiguracyjny
`<provider>:` na wpis — patrz §5 po YAML oraz `docs/portals-examples.md`
po gotowe wpisy do skopiowania.

> **v1.69.0 (P-14) — plug-in z auto-odkrywaniem.** Dodanie 12. źródła to teraz
> **czyste wrzucenie pliku**. Rejestr
> ([`server/lib/sources/registry.mjs`](../../server/lib/sources/registry.mjs))
> nie przechowuje już ręcznie utrzymywanej listy — przy uruchomieniu skanuje ten folder
> (`readdirSync` + dynamiczny `import()`) i zbiera blok `export const meta`
> z każdego `*.mjs`. Napisz adapter, zadeklaruj jego `meta` i jest
> natychmiast widoczny dla skanera, menu rozwijanego filtrów `#/scan` i
> dispatchera RU — **bez edycji `registry.mjs`**. (Źródła RU nadal potrzebują
> jednej linii w `portals.yml` projektu nadrzędnego; patrz Krok 5.)

### Krok 1 — Napisz adapter

Utwórz `server/lib/sources/<slug>.mjs`. Dwa wzorce działają w zależności od
tego, czy źródło ma JSON API czy tylko renderuje HTML:

**Źródło oparte na API** (najczystsze — używaj gdy strona ma otwarty
endpoint danych):

```js
// server/lib/sources/example.mjs
const ENDPOINT = 'https://example.com/api/v1/vacancies';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...';

// v1.69.0 (P-14) — self-describing metadata. The registry auto-discovers
// this block at boot; THIS is what registers the source (see Step 2).
export const meta = {
  value: 'example',          // ← must equal job.source written below
  label: 'Example.com',      // ← shown in the #/scan filter dropdown
  region: 'ru',              // ← 'en' (ATS sweep) | 'ru' (regional dispatcher)
  configKey: 'example',      // ← RU only; the key used in portals.yml
};

export async function searchExample(query, opts = {}) {
  const { onlyRemote = false, fetchImpl = fetch, signal } = opts;
  const res = await fetchImpl(`${ENDPOINT}?text=${encodeURIComponent(query)}`, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`Example: HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return (data.items || []).map(normalizeExample);
}

function normalizeExample(item) {
  return {
    id: `example-${item.id}`,
    title: item.title || '',
    company: item.company?.name || '',
    url: item.url || '',
    salary: item.salary || '',
    location: item.location || '',
    isRemote: !!item.remote,
    workplaceType: item.remote ? 'Remote' : 'Onsite',
    relocates: false,
    date: item.posted_at || '',
    snippet: (item.description || '').slice(0, 240),
    source: 'example',           // ← must match the registry `value` exactly
  };
}
```

**Źródło z scrapingiem HTML** (gdy nie ma API — patrz
[`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) i
[`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) dla pełnych przykładów):

```js
const BASE = 'https://example.com';

export async function searchExample(query, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  const res = await fetchImpl(`${BASE}/vacancies?q=${encodeURIComponent(query)}`, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Example: HTTP ${res.status}`), { status: res.status });
  }
  return parseExampleCards(await res.text());
}

export function parseExampleCards(html) {
  // …regex-based card extraction. Return [] on parse failure (DON'T throw):
  // a healthy 200 with no parseable cards is "no results", not "error",
  // so the multi-source scanner can keep going.
}
```

Trzy kontrakty, które każdy adapter MUSI honorować:

- **Eksportuj prawidłowy blok `meta`** (patrz Krok 2). Bez niego rejestr
  cicho pomija plik (jedno `console.warn` przy uruchomieniu) i źródło
  nigdy się nie pojawia.
- **Akceptuj `{ onlyRemote, fetchImpl, signal }` w `opts`.** `fetchImpl`
  jest tym, co sprawia, że adaptery są testowalne bez sieci; `signal` jest wymagany
  do propagacji rozłączenia klienta (REVIEW-B3).
- **Zwracaj rekordy z wspólnym kształtem** —
  `{ id, title, company, url, salary, location, isRemote, workplaceType,
  relocates, date, snippet, source }`, gdzie `source` pasuje do
  `meta.value`.

### Krok 2 — Zadeklaruj `meta` adaptera (automatyczna rejestracja)

To jest cały krok rejestracji. **Nie edytujesz `registry.mjs`.**
Po prostu upewnij się, że adapter eksportuje blok `meta` — rejestr
auto-odkrywa go przy uruchomieniu:

```js
// at the top of server/lib/sources/example.mjs
export const meta = {
  value: 'example',          // job.source value AND #/scan option.value
  label: 'Example.com',      // display label in the dropdown
  region: 'ru',              // 'en' | 'ru'
  configKey: 'example',      // RU only — key in portals.yml::russian_portals.sources
};
```

Jak odkrywanie waliduje (plik nie spełniający żadnej reguły jest pomijany z jednym
ostrzeżeniem `[sources/registry]`, więc gałąź w połowie zmigrowana pozostaje diagnozowalna):

- `value` — niepusty ciąg. MUSI pasować do `job.source` z Twojego adaptera.
- `label` — niepusty ciąg.
- `region` — dokładnie `'en'` lub `'ru'`; cokolwiek innego jest odrzucane.
- `configKey` — **wymagany** dla `region: 'ru'`, ignorowany dla `'en'`.

`region: 'en'` dołącza do sweepowania ATS (auto-odkrywa z wzorców URL `tracked_companies`);
`region: 'ru'` dołącza do dispatchera regionalnego. Publiczne API
(`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`, `getRegionalSources`) jest
przebudowywane z każdego odkrytego `meta`, uporządkowanego `en` najpierw potem `ru`,
alfabetycznie według etykiety w każdym regionie — więc kolejność w menu rozwijanym pozostaje
stabilna dla użytkowników.

### Krok 3 — Podłącz do dispatchera (tylko RU)

Źródła ATS EN auto-odkrywają z wzorców URL `tracked_companies` —
nie potrzeba dalszego okablowania. Dla źródeł RU, otwórz
[`server/lib/ru-scanner.mjs`](../../server/lib/ru-scanner.mjs), znajdź
tabelę `RU_DISPATCH` i dodaj wiersz:

```js
import { searchExample } from './sources/example.mjs';
// …
const RU_DISPATCH = {
  // …existing…
  example: { label: 'example.com', search: searchExample },
};
```

Pętla dispatchera wywołuje `entry.search(query, opts)` dla każdego klucza
obecnego w `cfg.sources`. Nie potrzeba dalszych zmian kodu.

### Krok 4 — Testuj (z mockiem, nigdy na żywo)

Wrzuć plik do `tests/sources-<slug>.test.mjs`. Prawdziwa sieć jest
**zakazana** w testach (kontrakt izolacji CI):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchExample } from '../server/lib/sources/example.mjs';

test('searchExample normalizes one record', async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({ items: [{ id: 1, title: 'Backend Engineer' }] }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  const out = await searchExample('q', { fetchImpl });
  assert.equal(out.length, 1);
  assert.equal(out[0].source, 'example');
});
```

### Krok 5 — Włącz w swoim `portals.yml`

`portals.yml` projektu nadrzędnego to konfiguracja należąca do użytkownika. Dodaj
`configKey` nowego źródła do tablicy:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob", "example"]
  area: 113
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
```

Przeładuj `#/scan` w przeglądarce. Menu rozwijane filtra źródeł automatycznie
pobiera nowy wpis (jeden punkt prawdy przez
[`GET /api/scan/sources`](../../server/lib/routes/scan.mjs) →
[`registry.mjs`](../../server/lib/sources/registry.mjs)). Przycisk
🌐 Scan teraz uwzględnia nowe źródło w każdym sweepie regionalnym.

### Adaptery referencyjne (wzoruj się na nich dla nowych źródeł)

| Plik adaptera | Typ | Uwagi |
|---|---|---|
| [`hh.mjs`](../../server/lib/sources/hh.mjs) | JSON API | Kanoniczny adapter API RU; geo-aware UA fallback. |
| [`trudvsem.mjs`](../../server/lib/sources/trudvsem.mjs) | JSON API | Rosyjski rząd open-data; brak blokady IP. |
| [`habr.mjs`](../../server/lib/sources/habr.mjs) | HTML scrape | Rosyjski portal techniczny; parser kart oparty na regex. |
| [`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) | HTML scrape | Defensywny parser, `[]` przy nieudanym parsowaniu. |
| [`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) | HTML scrape | Ten sam defensywny styl co GetMatch. |
| [`greenhouse.mjs`](../../server/lib/sources/greenhouse.mjs) | JSON API | Kanoniczny adapter ATS EN; używa wzorca URL `tracked_companies`. |

### Typowe pułapki

- **Zapomnienie eksportu `meta`.** Od v1.69.0 blok `meta` jest
  *jedyną* rzeczą, która rejestruje źródło. Brak `meta` (lub wadliwy) =
  plik jest cicho pomijany przy uruchomieniu z jednym
  ostrzeżeniem `[sources/registry] <file> has no valid \`export const meta\` — skipped`,
  a źródło nigdy nie trafia do menu rozwijanego. Sprawdź log serwera
  jeśli nowy adapter się nie pojawia.
- **Niezgodność pola `source`.** Ciąg zapisywany przez Twój adapter MUSI
  dokładnie pasować do `meta.value`. Jeśli się rozejdą, menu rozwijane
  filtrów `#/scan` pokaże źródło, ale wybranie go przefiltruje
  każdy wiersz (bo sprawdzenie równości to `r.source === fs`).
- **Rzucanie wyjątku przy nieudanym parsowaniu.** Scrapery HTML MUSZĄ zwracać `[]` przy
  zdrowym 200 bez parsowalnych kart. Rzucanie psuje pętlę dispatchera
  z wieloma źródłami — jedna zła struktura HTML zabija każde inne źródło
  dla tego samego zapytania.
- **Zapomnienie `fetchImpl` / `signal`.** Bez nich Twój adapter
  nie może być testowany jednostkowo bez trafiania w żywą sieć, a rozłączenia klientów
  nie propagują się (pobieranie w tle pozostaje aktywne po zamknięciu zakładki przez użytkownika).
- **Ufanie `tracked_companies` dla RU.** Ta lista jest tylko dla źródeł ATS EN.
  Adaptery RU napędzają się z
  `russian_portals.queries` zamiast — bez wpisów per-firma.

---

## 18. Powiadomienia (🔔 na górnym pasku)

> v1.58.34 — każdy toast pojawiający się w prawym dolnym rogu jest też przechwytywany
> do dziennika w pamięci (ograniczony do 50, najstarsze usuwane). Kliknij dzwonek 🔔 na
> górnym pasku, aby otworzyć **Szufladę Powiadomień** wysuwaną z prawej i ponownie przeczytać cokolwiek
> co przegapiłeś. Dziennik jest per-zakładka, per-sesja — zamknięcie zakładki go czyści.

Szuflada **otwiera się tylko gdy klikniesz dzwonek** (lub aktywujesz go przez Enter /
Space gdy jest skupiony z klawiatury). Nigdy nie pojawia się sama z siebie. Czerwona odznaka na
dzwonku liczy wpisy, które nie były widoczne od ostatniego otwarcia; otwarcie szuflady
czyści odznakę.

### Kategorie powiadomień

| Kategoria | Kiedy jest wyzwalana | Wskazówka wizualna |
|---|---|---|
| **Sukces** | `Saved`, `Copied`, `Refreshed`, ukończone skanowanie, zaimportowane CV, akcje listy kontrolnej apply („Copied unchecked", „Reset"), zapisany profil, dodany URL do pipeline | zielona lewa ramka w szufladzie; zielone tło toastu |
| **Błąd** | Nieudana walidacja URL (musi zaczynać się od `http://` / `https://`, bez znaków skryptowych/szablonowych), błędy API z postfiksem `(METHOD /path · HTTP NNN)`, błędy sieci (serwer wyłączony), duplikaty pipeline-400, niezerowe wyjście doctor / verify-pipeline | czerwona lewa ramka; czerwone tło toastu; postfiks techniczny schowany w bloku `Details` `<details>` (U-4 / v1.58.24) |
| **Info / postęp** | `Running doctor.mjs…`, `Running verify-pipeline.mjs…`, `Refreshing…`, `Loading…`, `Generating prompt…`, linie postępu skanowania | szara lewa ramka; domyślne tło toastu |

Każdy wpis szuflady pokazuje:

- **Znacznik czasu** (`HH:MM:SS` zlokalizowany do aktywnego języka SPA).
- **Wiadomość** (zdanie ludzkie, z postfiksem technicznym usuniętym z nagłówka zgodnie z U-4).
- **Szczegóły** (gdy obecne — postfiks `(METHOD /path · HTTP NNN)` wywołania API lub jakikolwiek inny techniczny dodatek, monospace).

### Co NIE jest powiadomieniem

- **Modal wynikowy** Doctor / verify-pipeline (pełny stdout / stderr) — to jest modal, nie toast, i nie jest rejestrowany w dzienniku.
- Linie logu SSE na `#/scan` i `#/auto` — te streamują do treści strony, nie do pipeline toastów.
- Stany ładowania tylko ze spinnerem (te używają `UI.withSpinner` bez toastu).

### Klawiatura

- **Kliknięcie** lub skupienie + **Enter / Space** na dzwonku → otwiera szufladę.
- **Esc**, kliknięcie przycisku zamknięcia **×**, lub ponowne kliknięcie dzwonka → zamyka szufladę; skupienie wraca do dzwonka.
- **Tab** gdy szuflada jest otwarta → przesuwa się przez przycisk zamknięcia i każdy skupialny element wewnątrz; szuflada ma `aria-modal="false"`, więc Tab nie pułapkuje (nadal możesz dosięgnąć reszty strony).


## 19. Lokalizacja aplikacji

Interfejs jest dostępny w 9 językach (English, Español, Français, Português, 한국어, 日本語, Русский, 简体中文, 繁體中文). Każda etykieta na ekranie pochodzi ze słownika tłumaczeń i możesz dodać lub poprawić język bez dotykania logiki aplikacji.

**Gdzie mieszkają tłumaczenia.** Od v1.60.0 każdy język to własny plik w `public/js/lib/locales/` — `i18n-dict.en.js`, `i18n-dict.es.js`, `i18n-dict.ru.js` itd. — prosta lista par `'klucz': 'tekst'`. Wspólny `i18n-dict.aliases.js` pozwala kluczom, które muszą zawsze brzmieć identycznie (etykieta paska bocznego i tytuł jej strony), wskazywać na jedno tłumaczenie. `i18n-dict.js` scala je wszystkie przy ładowaniu strony; nigdy go nie edytujesz.

**Popraw lub dodaj frazę.** Otwórz plik dla swojego języka, znajdź klucz (np. `'nav.scan'`) i edytuj tekst. Aby dodać zupełnie nową etykietę, dodaj ten sam klucz do **wszystkich 8** plików językowych z przetłumaczoną wartością, a następnie odwołaj się do niego na stronie przez `t('your.key')`. Uruchom `npm test` — nie powiedzie się jeśli jakikolwiek język nie ma klucza, więc nic nie jest wysyłane w połowie przetłumaczone.

**Dodaj zupełnie nowy język.** Skopiuj `i18n-dict.en.js` do `i18n-dict.<code>.js`, przetłumacz każdą wartość, a następnie zarejestruj kod w `i18n.js` (lista języków + auto-wykrywanie przeglądarki), w assemblerze `i18n-dict.js` i dodaj linię `<script>` w `index.html`. Pełna lista kontrolna — w tym snapshot testowy i pliki towarzyszące pomocy / README — znajduje się w `docs/LOCALIZATION.md`.

**Warto wiedzieć.** Przełącznik języków jest w stopce paska bocznego; Twój wybór jest zapamiętywany per przeglądarka. Diagnostyczne wiadomości serwera celowo pozostają po angielsku (żeby logi były spójne) — tylko interfejs na ekranie jest tłumaczony.

Zobacz **`docs/LOCALIZATION.md`** w repozytorium, aby zapoznać się z kompletnym, krok po kroku przewodnikiem lokalizacji.

### Zakładka Modes (formularz strukturalny — v1.54.3)

Przed v1.54.3 zakładka Modes była pojedynczą surową textarea Markdown dla `modes/_profile.md`. Jest teraz formularzem strukturalnym opartym na udokumentowanym schemacie:

- **Sekcje listowe** (Target Roles, Adaptive Framing, Comp Targets) — renderowane jako powtarzalne wejścia liniowe; użyj przycisków + / − do dodawania i usuwania wierszy.
- **Sekcje prozą** (Exit Narrative, Location Policy) — renderowane jako oznaczone textareas.
- **Nieznane lub niestandardowe sekcje** — każda sekcja, której formularz nie rozpoznaje, wraca do oznaczonego verbatim textarea, więc niestandardowe sekcje przeżywają edycję bez utraty.

Zapis **scala według sekcji**: preambuła, niezmienione sekcje i wszelkie niestandardowe sekcje są zachowywane bajt po bajcie. Tylko pola, które edytowałeś, są zmieniane.

Ujawnienie *Advanced: raw markdown* pozostaje na dole zakładki do pełnych edycji pliku — dodawania/usuwania sekcji lub edycji preambuły — bez zmiany zachowania scalania.
