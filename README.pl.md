# career-ops-ui

> Przejrzysty interfejs webowy w stylu dokumentacji technicznej dla potoku wyszukiwania pracy opartego na AI — [career-ops](https://github.com/Fighter90/career-ops).
> Przeglądaj oferty, oceniaj je, analizuj szczegółowo, aplikuj i śledź każdą ofertę z jednej karty przeglądarki — zamiast przeskakiwać między Claude Code, terminalem a plikami markdown.

[🇬🇧 English](README.md) | [🇪🇸 Español](README.es.md) | [🇧🇷 Português (Brasil)](README.pt-BR.md) | [🇰🇷 한국어](README.ko-KR.md) | [🇯🇵 日本語](README.ja.md) | [🇷🇺 Русский](README.ru.md) | [🇨🇳 简体中文](README.zh-CN.md) | [🇹🇼 繁體中文](README.zh-TW.md) | [🇫🇷 Français](README.fr.md) | **🇵🇱 Polski** | [🇺🇦 Українська](README.uk.md) | [🇩🇰 Dansk](README.da.md) | [🇸🇦 العربية](README.ar.md) | [🇩🇪 Deutsch](README.de.md) | [🇮🇹 Italiano](README.it.md) | [🇹🇷 Türkçe](README.tr.md) | [🇮🇳 हिन्दी](README.hi.md)

_Nieoficjalny interfejs — niepowiązany z career-ops / santifer ani przez nich nieautoryzowany._

[![tests](https://img.shields.io/badge/tests-2073%20passed-brightgreen)](#testy)
[![e2e](https://img.shields.io/badge/e2e-23%2F23%20%2B%2020%2F20-brightgreen)](#testy)
[![playwright](https://img.shields.io/badge/playwright-CI%20green-brightgreen)](#testy)
[![node](https://img.shields.io/badge/node-%E2%89%A518-blue)](#wymagania)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![release](https://img.shields.io/badge/release-v1.129.1-blue)](https://github.com/Fighter90/career-ops-ui/releases/tag/v1.129.1)

> **🆕 Najnowsze wydanie — v1.129.1**
>
> **Następstwa przeglądu AI (poprawka).** v1.129.1 naprawia doradcze uwagi z portów web v1.128/v1.129: precedencja poziomu w job-facets (`Senior Engineering Manager` → `senior`, nie `lead`), `states.mjs` nie przypina już fallbacku przy problemie rodzica na starcie (+ostrzeżenie o uszkodzonym pliku), ton pokazuje wiersz bez oceny neutralnie (nie czerwono), a `domainFromName` pomija sluggi nie-ASCII. **Faseta poziomu + kolumna wieku w skanowaniu.** v1.129.0 wpina bibliotekę `job-facets.js` z v1.128.0 w `#/scan`: nowy filtr **Poziom** (lead/staff/senior/mid/junior/stażysta, wypełniany z wyników jak faseta Kraj), kolumna badge Poziom i beztokenowa kolumna **Wiek** (`dziś` / `Nd`). **Cztery porty z aplikacji web rodzica.** v1.128.0 przepisuje w czystym JS cztery rozwiązania z aplikacji Next.js career-ops: tracker czyta kanoniczne statusy na żywo z `templates/states.yml` (koniec z zakodowaną whitelistą), loga marek na wierszach na hoście ATS przez mapę nazwa→domena, dokładniejszy 4-poziomowy ton oceny i bibliotekę faset bez tokenów. **2066 testów**. **Parytet rodzica v1.23.0.** v1.127.0 przenosi trzy nowe źródła skanowania — **Flowxtra**, **VDAB**, **iCIMS** (rejestr teraz **70 adapterów**, 65 EN + 5 RU) —, odwzorowuje zmianę HTML→REST agenticjobs, odzysk miasta Greenhouse i poprawki role-matcher, oraz przywraca **Cursor** do rosteru CLI (parent #2115 — `cli-detect` zgłasza 10 narzędzi). **Łatka dryfu rosteru CLI.** v1.126.1 naprawia dwa miejsca pominięte przez zamiatanie v1.126.0: intro zakładki API keys w `#/config` (i18n ×17) wymienia teraz Antigravity + Grok Build, a przestarzały wiersz `Cursor / Gemini CLI` w przewodniku pomocy ×17 (i help strony) ma teraz pełny roster 8 CLI. **Resync dokumentacji i rosteru CLI.** v1.126.0 uzgadnia każdą powierzchnię dokumentacji (help ×17, README ×17, wiki) z żywą career-ops.org/docs (przeczytano wszystkie 31 stron) i uczy skan AI CLI tools w `#/config` wykrywać wszystkie 8 pierwszoklasowych CLI — **Grok Build CLI** i **Kimi CLI** dołączają do Claude Code, Cursor, Codex, OpenCode, Antigravity, Qwen i Copilot (teraz **9 narzędzi**, wciąż nigdy nieuruchamianych). **Sync serwisowy.** v1.125.4 zbiera bumpy dependabota w site (`sharp` 0.35.3, `svgo` 4.0.2, `fast-uri` 3.1.4) i odnotowuje przegląd parzystości z rodzicem (po v1.22.0, #2108–#2168): guard błędnego wiersza w set-status, Risk Summary zlokalizowanych trybów i weryfikacja manifestu aktualizatora są po stronie CLI — nic do portowania (**1969 testów** bez zmian). **Poprawka locale promptów.** v1.125.3 czyni duński i hindi pełnoprawnymi w każdym prompcie AI — deep research (na żywo i ręczny), tryby, ocena, wywiad, networking i CV Studio emitują teraz dyrektywę `# Output language` w tych dwóch lokalizacjach (odpowiedzi przychodziły po angielsku), a bramka locale przechodzi teraz wszystkie 17 (**1969 testów**). **Pakiet wkładu zewnętrznego.** v1.125.2 scala pierwsze PR-y społeczności od [@Alien10140](https://github.com/Alien10140) — poprawkę HTTP 502 w Deep research na żywo (promptami headless bez narzędzi dla dostawców API) i domyślne modele Gemini podniesione z wycofanego `gemini-2.0-flash` na `gemini-3.6-flash`, przypięte nową bramą anty-dryfową z 5 testów (**1957 testów**). v1.125.1 zachowuje wielomarkowym tenantom SuccessFactors RMK ich ścieżkę marki (rodzic #2099). **Źródła ofert na landingu.** v1.125.0 dodaje do cvstart.org sekcję z listą wszystkich **70 źródeł skanowania** jako klikalnych chipów — zsynchronizowaną z rejestrem podczas budowania i zabezpieczoną przed rozjazdem. Przed tym v1.124.0 przenosi **pięć źródeł skanowania** — Welcome to the Jungle, Agentic Engineering Jobs, Jobvite, Gem oraz Alibaba Group (**70 adapterów** teraz) — a także weryfikację pełnej pracy zdalnej Arbeitsagentur (`homeofficetyp=VOLLSTAENDIG`) oraz poprawkę publicznych adresów URL SmartRecruiters.
>
> _poprawka przeglądu AI · precedencja poziomu · fallback states · neutralny ton · faseta poziomu · kolumna wieku · job-facets wpięta · 4 porty web/ · states.yml na żywo · loga nazwa→domena · ton · fasety · parytet rodzica v1.23 · +3 źródła · 70 adapterów · Cursor · łatka dryfu rosteru CLI · resync dokumentacji i rosteru CLI · sync serwisowy · poprawka locale promptów da/hi · pakiet wkładu zewnętrznego · poprawka 502 deep research · domyślne Gemini 3.6 · poprawka ścieżki marki SF · sekcja źródeł na landingu · 5 źródeł · 67 adapterów · parzystość z rodzicem v1.22 · Oracle Cloud · 62 adaptery · parzystość z rodzicem v1.21 · Hindi · 17 języków · manifest · strony methodology/license/changelog na cvstart.org · parytet z rodzicem v1.19 · 61 adapterów · żywe gwiazdki + współtwórcy na landingu · parytet z rodzicem v1.18 · 54 adaptery · status Hired · statystyki łączne · pakiet parytetu · 50 adapterów · przeróbka miernika zużycia · dopracowanie designu · miernik użycia · pływający asystent pomocy · konsolidacja dokumentacji i QA · domknięcie backlogu bezpieczeństwa · dokum. i QA ×16 · Wyklucz Scan · przegląd pipeline · wzmocnienie bezpieczeństwa 2 · wzmocnienie sanitizera · wzmocnienie bezpieczeństwa · zużycie i koszt AI · logo firm · narzędzia CLI AI · zapytaj przewodnik · dopasowanie CV + list · auto-wypełnianie two-pager · eksport DOCX · kondycja portali · wbudowany zgłaszacz błędów · 16 lokalizacji · 6 dostawców LLM · 46 adapterów skanera · orientacja zawodowa · plan kariery · przebudowa statystyk · warstwa pamięci · CV Studio · planer networkingu · próbna rozmowa · dopasowanie do rynku przez two-pager · parytet z nadrzędnym career-ops v1.16.0._

![career-ops-ui](./images/dashboard-pl.png)

## O projekcie career-ops

[career-ops](https://career-ops.org) to system wyszukiwania pracy o otwartym kodzie źródłowym działający jako zestaw poleceń slash wewnątrz dowolnego CLI dla programistów korzystającego z AI (Claude Code, Cursor, Codex, OpenCode, Antigravity CLI, Grok Build CLI, Qwen Code, Kimi, GitHub Copilot CLI, Gemini CLI (legacy) — inne CLI kompatybilne z Claude również działają). Niezależny od modelu. Ocenia każdą ofertę pracy względem Twojego CV w sześciowymiarowej skali 0,0–5,0, generuje dopasowane pliki PDF z CV i śledzi każde zgłoszenie lokalnie — bez kont w chmurze, telemetrii ani automatycznego składania aplikacji.

**Ten repozytoria (career-ops-ui)** to dopracowany interfejs webowy zbudowany na jego bazie. CLI nadal obsługuje wypełnianie formularzy (przez Playwright MCP) i tryby poleceń slash; SPA oferuje powierzchnię w stylu CRM w przeglądarce opartą na tych samych plikach `cv.md` / `data/applications.md` / `reports/`. Oba współdzielą te same dane.

**Progi działania według wyniku** (z [career-ops.org/docs](https://career-ops.org/docs)):

| Wynik | Następny krok |
|---|---|
| **≥ 4,5** | `/career-ops apply` — wysokie dopasowanie, aplikuj od razu |
| **4,0 – 4,4** | aplikuj lub `/career-ops contacto` dla ciepłego wprowadzenia |
| **3,5 – 3,9** | `/career-ops deep` — najpierw zbadaj firmę |
| **< 3,5** | pomiń, chyba że masz konkretny powód |

**Przewodniki kanoniczne** na [career-ops.org/docs](https://career-ops.org/docs):

- [Czym jest career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
- [Skanowanie portali pracy](https://career-ops.org/docs/introduction/guides/scan-job-portals)
- [Składanie aplikacji](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
- [Masowa ocena ofert](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
- [Konfiguracja Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)
- [Jak career-ops ocenia oferty pracy — metodologia](https://career-ops.org/methodology)

## Manifest CareerOps

career-ops to pierwsza referencyjna implementacja [Manifestu CareerOps](https://career-ops.org/manifesto) — praktyki prowadzenia poszukiwań pracy z dowodami, dyscypliną i narzędziami po stronie kandydata. Przeczytaj go. Jeśli mówi to, w co wierzysz, podpisz go — Twój podpis staje się commitem. Aplikacja linkuje do niego ze stopki paska bocznego.

## Kluczowe funkcje

| Strona | Opis |
|---|---|
| **Panel główny** | Liczniki zbiorcze, średni wynik, ostatnie aplikacje i raporty |
| **Skanowanie** | Przycisk 🌐 Scan uruchamia wszystkie skonfigurowane źródła (Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday + hh.ru / Habr Career) jednym kliknięciem; wyniki w czasie rzeczywistym przez SSE |
| **Pipeline** | Zarządzanie `data/pipeline.md`; bezpieczny podgląd URL (ochrona przed SSRF) |
| **Ocena** | Wklej opis stanowiska → wynik 0–5 przez Anthropic lub Gemini; fallback na gotowy prompt |
| **Głęboka analiza** | Badanie firmy przez Anthropic SDK; wyniki zapisywane w `interview-prep/` |
| **Tracker** | Filtrowana tabela aplikacji nad `data/applications.md` |
| **CV** | Edytor markdown na żywo z podglądem bocznym i ochroną XSS |
| **Zdrowie systemu** | Odznaki stanu konfiguracji; uruchamianie `doctor.mjs` jednym kliknięciem |
| **Pomoc** | Wbudowana dokumentacja w 12 językach (włącznie z polskim) |

## Szybki start

> **Ważne — career-ops-ui to panel *nadbudowany na* [`Fighter90/career-ops`](https://github.com/Fighter90/career-ops).** Działa **wewnątrz** projektu career-ops jako `career-ops/web-ui/` i odczytuje pliki `cv.md`, `config/`, `data/` z folderu nadrzędnego przez `../`. **Nie działa samodzielnie** — potrzebujesz również nadrzędnego repozytorium career-ops.

### Opcja 1 — jedno polecenie curl (zalecane)

```bash
curl -fsSL https://raw.githubusercontent.com/Fighter90/career-ops-ui/main/bin/setup.sh | bash
```

Klonuje **oba** repozytoria, organizuje strukturę `career-ops/web-ui/`, instaluje zależności, uruchamia diagnostykę i startuje serwer pod adresem http://127.0.0.1:4317.

### Opcja 2 — dodaj UI do istniejącego projektu career-ops

```bash
cd career-ops
git clone https://github.com/Fighter90/career-ops-ui.git web-ui
cd web-ui
npm install
npm start
```

Otwórz http://127.0.0.1:4317 w przeglądarce.

### Polecenia CLI

```bash
career-ops-ui setup    # bootstrap: instalacja zależności → diagnostyka → uruchomienie
career-ops-ui init     # wybór dostawcy LLM i wklejenie klucza API (interaktywne)
career-ops-ui doctor   # weryfikacja Node / projektu / kluczy / Playwright
career-ops-ui run      # uruchomienie serwera na http://127.0.0.1:4317
career-ops-ui open     # otwarcie i wyeksponowanie karty panelu w przeglądarce
career-ops-ui help     # lista wszystkich poleceń
```

### Wybór dostawcy LLM

`init` to kreator konfiguracji dostawcy — wybierz **Claude / Claude Code** (`ANTHROPIC_API_KEY`), **Codex / OpenCode** (`OPENAI_API_KEY`), **Qwen Code** (`QWEN_API_KEY`) lub **Auto** (Anthropic → fallback Gemini). Klucze można też ustawić ręcznie:

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." >> career-ops/.env
```

Lub przez zakładkę **Ustawienia aplikacji** (`#/config`) w interfejsie — bez restartu serwera.

## Wymagania

| | |
|---|---|
| **Node.js** | ≥ 18 (natywne `fetch` i `node:test`) |
| **career-ops** | sklonowane i skonfigurowane (patrz wyżej) |
| **Opcjonalnie** | `ANTHROPIC_API_KEY` lub `GEMINI_API_KEY` w `.env` projektu nadrzędnego dla oceny JD jednym kliknięciem |

## Architektura w skrócie

```
career-ops/
├─ cv.md
├─ portals.yml
├─ config/
├─ data/
└─ web-ui/          ← to repozytorium
   ├─ server/       # Express + 15 modułów tras
   ├─ public/       # vanilla JS SPA, bez bundlera
   └─ tests/        # 1856 testów jednostkowych + 90 Playwright + 43 e2e
```

Serwer ma dwie zależności produkcyjne: `express` i `js-yaml`. Brak transpilacji, brak bundlera — cały interfejs to mniej niż 30 KB zminifikowanego kodu.

## Pełna dokumentacja

Kompletna dokumentacja jest dostępna wyłącznie w wersji angielskiej: **[🇬🇧 README.md](README.md)**

Zawiera szczegółowe opisy:
- Pełnego API REST (wszystkie endpointy `/api/*`)
- Konfiguracji skanera portali (Greenhouse, Ashby, Lever, Workable, hh.ru, Habr Career, RSS)
- Wszystkich zmiennych środowiskowych
- Zasad bezpieczeństwa (SSRF, XSS, rate limiting)
- Przewodnika po architekturze (SDD, konwencje)

Oficjalna strona: [career-ops.org](https://career-ops.org) · Dokumentacja: [career-ops.org/docs](https://career-ops.org/docs)

## Testy

```bash
npm test                    # 1856 testów jednostkowych/integracyjnych
npm run test:e2e            # 20 smoke e2e
npm run test:e2e:full       # 23 comprehensive e2e
npm run test:e2e:browser    # 70 testów Playwright
npm run test:coverage       # jak npm test + pokrycie V8
```

## Licencja

MIT. Szczegóły: [LICENSE](LICENSE).

Zbudowane na bazie [career-ops](https://github.com/Fighter90/career-ops) autorstwa [santifer](https://santifer.io).

<p>
  <a href="https://github.com/Fighter90" title="Fighter90"><img src="https://wsrv.nl/?url=avatars.githubusercontent.com/u/6834634%3Fv%3D4&w=160&h=160&fit=cover&mask=circle&output=png" width="80" height="80" alt="Fighter90"/></a>
  <a href="https://github.com/Alien10140" title="Alien10140"><img src="https://wsrv.nl/?url=avatars.githubusercontent.com/u/4649783%3Fv%3D4&w=160&h=160&fit=cover&mask=circle&output=png" width="80" height="80" alt="Alien10140"/></a>
  <a href="https://github.com/vignyl" title="vignyl"><img src="https://wsrv.nl/?url=avatars.githubusercontent.com/u/26774609%3Fv%3D4&w=160&h=160&fit=cover&mask=circle&output=png" width="80" height="80" alt="vignyl"/></a>
  <a href="https://github.com/bracketouverte" title="bracketouverte"><img src="https://wsrv.nl/?url=avatars.githubusercontent.com/u/5484265%3Fv%3D4&w=160&h=160&fit=cover&mask=circle&output=png" width="80" height="80" alt="bracketouverte"/></a>
</p>

**[Wszyscy współtwórcy →](https://github.com/Fighter90/career-ops-ui/graphs/contributors)**
