# Changelog (Deutsch)

> Dieses Changelog beginnt bei v1.85.0 — der Version, in der die deutsche Lokalisierung hinzugefügt wurde. Für frühere Versionen siehe [CHANGELOG.md](CHANGELOG.md).

## [1.90.0] — 2026-07-04
### Hinzugefügt
- **Mock Interview 2.0 (Epic 15).** Eine neue Seite `#/mock-interview` verwandelt deinen Lebenslauf, dein Profil, dein two-pager und deine Story-Bank in eine Interview-Probe Zug um Zug:
  - **Konversationsübung** — gib eine Zielrolle an (+ optional Unternehmen / Stellenbeschreibung) und der Interviewer eröffnet mit einer gezielten Frage. Jede gesendete Antwort erhält eine strukturierte Rückmeldung: **Feedback** (Stärken + die STAR+R-Lücke), einen **Score** (`N/5`) und eine **Nächste Frage**, die den schwächsten Teil deiner letzten Antwort sondiert. Serverseitig in deinen echten Unterlagen verankert — es erfindet nie Erfahrung, die du nicht hast.
  - **Story-Bank-bewusst** — `interview-prep/story-bank.md` wird in den Prompt eingebettet (gleiche Vertrauensstufe wie `cv.md`), damit das Feedback auf deine besten Geschichten verweisen kann.
  - **Live oder manuell** — mit einem Anbieter-Schlüssel läuft der Zug live über die geteilte Kaskade (Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models); ohne Schlüssel erhältst du einen kopierfertigen Prompt (ehrlicher Rückfall, keine erfundenen Antworten).
  - **Gespeicherte Sitzungen** — klicke auf **Transkript speichern**, um ein beendetes Interview in der Benutzerschicht abzulegen (`interview-prep/mock-{company}-{role}-{date}.md`); die Seite listet, öffnet und löscht gespeicherte Sitzungen.
- Neu: `server/lib/routes/interview.mjs` (18. Routenmodul), `public/js/views/mock-interview.js`, `server/lib/llm-dispatch.mjs` (geteilte Anbieter-Kaskade), `PATHS.storyBank`, `bundleProjectContext({ extraFiles })`. 30 neue i18n-Schlüssel in allen **16 Sprachen**. Tests: `tests/interview-routes.test.mjs`.

## [1.89.0] — 2026-07-04
### Hinzugefügt
- **Kandidat-Markt-Fit — das two-pager (Epic 14).** Eine neue Seite `#/two-pager` lässt dich festhalten, was *du* wirklich von deiner nächsten Rolle willst, nach dem Vorbild des „Mnookin two-pager" aus *Never Search Alone*:
- **Geführter Builder** — eine Ich-Erzählung „Wer ich bin", eine Notiz „Zielumgebung" und fünf Chip-Listen-Editoren: **loves**, **must-haves**, **hates**, **deal-breakers** und **non-negotiables**. Wird über `PUT /api/two-pager` in die **Benutzerschicht** des Elternprojekts (`config/two-pager.yml`) gespeichert — niemals von Systemaktualisierungen überschrieben.
- **KI-Ausfüllassistent** (`POST /api/two-pager/draft`) — baut einen sofort ausführbaren Mnookin-Prompt mit deinem eingebetteten CV + Profil, den du in einem beliebigen LLM ausführst und das Ergebnis zurückkopierst. Er verwendet ausschließlich deine eigenen Materialien; nichts wird erfunden.
- **Fit-zu-dem-was-du-willst-Badge** — jede Ausschreibung auf `#/scan` zeigt jetzt einen `◎ N`-Fit-Score (clientseitig, über `window.FitScore`), der Arbeitstyp, Land, Gehaltsuntergrenze und Umzug der Stelle mit deinem two-pager abgleicht. Ehrlich per Design: Liefert eine Ausschreibung kein abgleichbares Signal, **wird kein Badge angezeigt** (niemals eine erfundene Zahl). Deal-Breaker-Verstöße wiegen schwerer als leichte Abneigungen.
- **Speist jede Bewertung** — der gespeicherte two-pager wird in `bundleProjectContext` eingebettet, sodass alle nachgelagerten LLM-Bewertungen deine erklärten Präferenzen mit dem CV-vs-JD-Match verbinden.
- Neu: `server/lib/routes/two-pager.mjs`, `public/js/views/two-pager.js`, `public/js/lib/fit-score.js`, `PATHS.twoPager`. 27 neue i18n-Schlüssel über alle **16 Locales**. Tests: `tests/two-pager-routes.test.mjs`, `tests/fit-score.test.mjs`.

## [1.88.0] — 2026-07-04
### Geändert
- **Feinschliff zu Issue #29 — i18n-Lücken im Scan + API-Hygiene.**
- **Lokalisierung der letzten fest verdrahteten Scan-Strings** (Roadmap v1.69.4): die Quellen-Zusammenfassungs-Pillen (`N neu / M passend`), die `N neue Stellen`-Toasts und das `reloc`-Badge laufen jetzt durch `t()` — 4 neue Schlüssel (`scan.pillNew`, `scan.pillMatching`, `scan.newOffers`, `scan.relocBadge`) über alle **16 Locales**. Nicht-englische Nutzer sehen im zentralen Scan-Ablauf kein verstreutes Englisch mehr.
- **Deaktivierung des `X-Powered-By`-Headers** (Roadmap v1.69.5): `app.disable('x-powered-by')` in `createApp()` — der Server wirbt nicht mehr mit Express. (Der Rest dieses Epics war bereits ausgeliefert: `parentVersion` entfernt seinen release-please-Kommentar, der Theme-Umschalter im hellen Modus, das Schließen von Modals bei Routenwechsel und die Lokalisierung von „Score" (`rep.score`) in den Berichten.)
- Tests: `tests/scan-i18n-gaps.test.mjs` + eine Assertion zur Abwesenheit von `X-Powered-By` in `tests/security-headers.test.mjs`.

## [1.87.0] — 2026-07-04
### Hinzugefügt
- **4 neue Scan-Anbieter ohne Authentifizierung (Parität mit dem Eltern-career-ops v1.16.0).** Das Scanner-Register wächst von **41 → 45 Adaptern** (40 EN + 5 RU) — alle öffentlich, ohne Authentifizierung, host-fixiert, `redirect:'error'` (SSRF-sicher), jeder mit einem CI-isolierten Test:
  - **Get on Board** (`getonbrd`) — portalweites öffentliches JSON:API (LATAM/Remote-Tech), anbieterbasiert ausgewählt, paginiert. `server/lib/sources/getonbrd.mjs`.
  - **Amazon** (`amazon`) — öffentliches Such-JSON von `amazon.jobs`, host-erkannt oder `provider: amazon`, offset-paginiert. `server/lib/sources/amazon.mjs`.
  - **Avature** (`avature`) — mandantenspezifisches `*.avature.net`-ATS, aus HTML geparst, host-erkannt oder `provider: avature`. `server/lib/sources/avature.mjs`.
  - **SAP SuccessFactors** (`successfactors`) — mandantenspezifische RMK-Kachelliste (`*.successfactors.eu/.com`, `jobs2web.com`), aus HTML geparst. `server/lib/sources/successfactors.mjs`.
- Jeder liefert ein `sources/<slug>.mjs` (auto-erkanntes `meta` → `#/scan`-Dropdown) **und** ein `portals/adapters/<slug>.mjs` in `ALL_ADAPTERS` (die Zwei-Register-Regel) + `tests/sources-<slug>.test.mjs`. Der `ALL_ADAPTERS`-Zähler sowie die Assertions für sortierte id und das EN-Set von `/api/scan/sources` stiegen von 36→40; `GET /api/scan/sources` listet jetzt 45.

## [1.86.0] — 2026-07-03
### Hinzugefügt
- **Statistik nach Zielrollen (`#/stats`) — Markt­statistik zu Stellen und Gehältern für DEINE Zielrollen.** Eine neue Analyse-Seite liest deine **Zielrollen aus dem Profil** (`config/profile.yml` → nicht fest verdrahtet) sowie die Stellen des letzten Scans und zeigt dann je Rolle und Land: **Stellen pro Land** und **Median­gehalt pro Land (USD)** — clientseitig aggregiert (`public/js/lib/role-stats.js`, wiederverwendet `window.Countries`) aus den spärlichen Daten, die die Scanner ohnehin sammeln.
- Gehälter in beliebiger Währung werden über eine ausdrücklich als grobe Näherung gekennzeichnete FX-Tabelle nach USD normalisiert, mit einem Hinweis zur Stichprobengröße — niemals erfunden. Dazu **Rollen- und Länderfilter** sowie handgeschriebene Inline-SVG-Balken- und Trenddiagramme (keine neuen Abhängigkeiten, CSP-sicher — nur `addEventListener`).
- **Snapshot speichern** (`POST /api/stats/snapshot`) persistiert das aktuelle Aggregat in `data/role-stats.jsonl`; das **Trenddiagramm** (`GET /api/stats/trend`) verfolgt die Stellenzahlen über die Zeit — die „Dynamik“-Ansicht. Ehrlicher Hybrid: Snapshots stammen aus lokalen Scan-Daten und werden bei Bedarf aktualisiert.
- Vollständig lokalisiert in allen **16 Locales** (26 neue i18n-Schlüssel). Neu: `server/lib/routes/stats.mjs` (16. Routenmodul), `public/js/lib/role-stats.js`, `public/js/views/stats.js`, `PATHS.roleStats`; Tests `role-stats.test.mjs` (7) + `stats-routes.test.mjs` (5).

## [1.85.0] - 2026-07-03
### Hinzugefügt
- **Deutsche (`de`), italienische (`it`) und türkische (`tr`) Lokalisierung** — die Benutzeroberfläche, der integrierte Hilfe-Guide, README und CHANGELOG sind jetzt auch in diesen drei Sprachen verfügbar (portiert aus dem Locale-Satz von career-ops 1.16.0). Damit unterstützt die UI 16 Sprachen.
- Die Sprachauswahl listet nun Deutsch 🇩🇪, Italiano 🇮🇹 und Türkçe 🇹🇷; die Browsersprach-Erkennung erkennt `de`, `it`, `tr`.
- Die Prompt-Gerüste (`server/lib/prompts.mjs`) wurden für die drei neuen Sprachen lokalisiert.
