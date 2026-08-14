# Changelog (Deutsch)

> Dieses Changelog beginnt bei v1.85.0 — der Version, in der die deutsche Lokalisierung hinzugefügt wurde. Für frühere Versionen siehe [🇬🇧 CHANGELOG.md](CHANGELOG.md).

## [1.185.0] — 2026-08-14

**Hinzugefügt (Statistik) — ein Tab "Funnel & Tempo": wie sich dein Funnel mit dem Markt vergleicht und wie schnell du zwischen Stufen vorankommst.**

### Hinzugefügt
- Ein neuer Tab **Funnel & Tempo** in **Statistik** zeigt deine **Antwort**- und **Interview**-Raten neben Markt-Benchmark-Bereichen (mit den Hinweisen zu kleiner Stichprobe und Selektionsbias), eine **Warteliste** laufender Bewerbungen jenseits des typischen Erst-Antwort-Fensters und **Median-Tage pro Stufe** (Beworben → Geantwortet → Interview → Angebot) — langsame Zeilen werden rechtszensiert, damit sie die Mediane nicht verzerren. Schreibgeschützt und ohne Tokens; liest nur deinen eigenen Tracker.

### Hinweise
- Neuer `GET /api/stats/funnel` (weicher Fallback auf `{available:false}` ohne das Skript). +18 i18n-Schlüssel ×17. Tests: `tests/stats-funnel-route.test.mjs` (+2). Suite: **2481**.

## [1.184.0] — 2026-08-14

**Behoben (UI) — die Schnellaktions-Kacheln im Dashboard richten sich jetzt in einem gleichmäßigen Raster aus.**

### Behoben
- Im Dashboard (Kommandozentrale) wurde eine Gruppe aus 3 Kacheln breiter dargestellt als eine aus 4, sodass die Abschnitte eine unregelmäßige rechte Kante hatten. Jede Gruppe verwendet jetzt gleich breite Spalten (4 auf breitem Bildschirm, herunter auf 3 / 2 / 1, wenn das Fenster schmaler wird), sodass alle Kacheln gleich groß sind und ihre rechten Kanten fluchten.

### Hinweise
- Nur CSS (`.qa-grid`: festes `repeat(N, minmax(0,1fr))` statt `auto-fill`). Abgesichert durch `tests/dashboard-grid-align.test.mjs` (+2). Suite: **2479**.

## [1.183.0] — 2026-08-14

**Hinzugefügt (Scanner) — schlauere Dublettenerkennung: dieselbe Stelle, mit einem Tracking-Link neu eingestellt, erscheint nicht mehr doppelt.**

### Hinzugefügt
- Der Scanner erkennt eine Stelle jetzt an einem **kanonischen URL-Schlüssel**, sodass dieselbe Stelle, neu eingestellt mit einem Tracking-Parameter (`?utm_…`, `gclid`, …), über `http` vs `https` oder mit abschließendem Schrägstrich / `#Fragment`, als die eine Stelle behandelt wird, die sie ist — keine doppelte Zeile in Scan-Ergebnissen oder Pipeline und keine verschwendete Bewertung einer bereits gesehenen Stelle. Wirklich unterschiedliche Stellen (eine erhaltene funktionale id wie `gh_jid`) zählen weiterhin getrennt.

### Hinweise
- Neues `server/lib/url-key.mjs`, eingebunden in die Dedup beider Scanner und den Pipeline-Writer. Normalisiert bewusst zurückhaltend — führt nie zwei verschiedene Stellen zusammen. Tests: `tests/url-key.test.mjs` (+5), `tests/parsers.test.mjs` (+1). Suite: **2477** (+6).

## [1.182.0] — 2026-08-14

**Behoben (Scanner) — Gehaltsspannen werden jetzt in jeder Sprache gleich angezeigt.**

### Behoben
- Gehaltsangaben in Scan- und Tracker-Zeilen verwenden die sprachneutralen Symbole **≥** und **≤** (z. B. `≥ 120000 EUR`, `≤ 90000`) statt der englischen Wörter „from" / „up to", die unübersetzt in nicht-englische Oberflächen durchsickerten. Gilt für jedes Board mit einseitiger Spanne (Getro, Remotli, Manfred, Agentic Jobs, JustJoin, Jobicy); zweiseitige Spannen (`100000–150000 USD`) waren schon neutral.

### Hinweise
- Nur Anzeige — der Gehaltsfilter des Clients parst die Zahlen unabhängig vom Präfix, das Filtern bleibt unverändert. Suite: **2471**.

## [1.181.0] — 2026-08-14

**Hinzugefügt (Scanner) — Getro-Jobboards zeigen jetzt Gehalt, alle Standorte und Remote-Stellen.**

### Hinzugefügt
- Der **Getro**-Scanner (Talent-Netzwerk-Boards von Fonds) zeigt jetzt bei jeder Stelle ein **Gehalt** (Jahresspanne + Währung), listet **alle** Standorte statt nur des ersten und markiert **Remote**-Stellen. Eine Getro-Stelle in Scan und Tracker trägt nun dieselben Gehalts- + Standortdetails wie die übrigen Boards.

### Hinweise
- Nur Scanner; keine neue Abhängigkeit, keine Änderung an Route / CSP / SSRF. Tests: `tests/sources-getro.test.mjs` (+5). Suite: **2470** (+5).

## [1.180.0] — 2026-08-14

**Behoben (MITTEL, Berichte) — die `#/reports`-Liste ist jetzt eine Tabelle, und eine echte Bewertung, die ein Machine-Summary-Platzhalter verdeckte, wird wiederhergestellt.**

### Behoben
- **Die `#/reports`-Liste ist eine Tabelle (Bericht · Datum · Legitimität · Bewertung), kein 4-Karten-Raster.** Ein langer Chip „Bewertung nicht erkannt" drückte die Titelspalte fast auf null, und das `overflow-wrap: anywhere` des Kartentitels brach den Berichtsnamen Zeichen für Zeichen um. Jetzt hat jedes Feld eine eigene Spalte, die Namenszelle bricht an Wortgrenzen um, und die Tabelle scrollt auf schmalen Viewports horizontal (neuer `.reports-scroll`-Container). Neuer i18n-Schlüssel `rep.colReport` ×17.
- **Eine echte Bewertung im Text (`**Итоговый балл:** 1.8 / 5`) wird nicht mehr durch einen Machine-Summary-Platzhalter (`score: —`) verdeckt.** Trug der `## Machine Summary`-Block eine nicht-numerische oder außerhalb des Bereichs liegende Bewertung, belegte sie den geparsten Bewertungsplatz und blockierte den Fett-Wertform-Fallback, sodass der Bericht „Bewertung nicht erkannt" zeigte, obwohl im Text ein echtes `X / 5` stand. `parseReportHeader` stellt nun die Wertform aus dem Text wieder her, wenn keine brauchbare Zahl übrig blieb (Schritt 4.5).

### Hinweise
- Nur Client + Parser; keine Änderung an Route / CSP / SSRF / Eltern-Schreibzugriff. Tests: `tests/reports-table.test.mjs` (+5), `tests/report-header-locale.test.mjs` (+2). Suite: **2465** (+7).

## [1.179.0] — 2026-08-13

**Geändert (LOW, Scanner) — 20 duplizierte HTML-Entitäten-Decoder auf das gemeinsame Modul zusammengeführt (Paritäts-Nachlauf, schließt die Worklist).**

### Geändert
- 20 Scraping-Scan-Quellen trugen je einen eigenen `decodeEntities`/`decodeXmlEntities` (+ einen `fromCodePoint`-Helfer) — Kopien, die auseinandergedriftet waren (drei konnten einen `RangeError` werfen, in v1.172.0 behoben; andere ließen NUL/C0 zu oder parsten `&#1a2;` falsch). Alle laufen nun über das eine `server/lib/html-entities.mjs` (XML-1.0-Char-sicherer Decoder), was ~237 Zeilen Duplizierung entfernt. Die 8 RSS-artigen Quellen erhielten die `&nbsp;`-Dekodierung (zuvor nur 5 Entitäten); das absichtliche Doppel-Dekodieren von cryptocurrencyjobs bleibt per Alias erhalten. `hh` behält seinen Decoder (behandelt `&mdash;`/`&ndash;`, außerhalb der gemeinsamen 6). Ein neuer Wächter-Test schlägt fehl, wenn eine Quelle wieder einen lokalen Decoder anlegt.

### Hinweise
- Verhaltenserhaltende Refaktorierung; keine Änderung an Route / CSP / SSRF / Eltern-Schreibzugriff. Tests: `tests/decoder-consolidation.test.mjs` (+2). Suite: **2458** (+2).

## [1.178.0] — 2026-08-13

**Behoben (LOW, Eltern-Parität) — zwei veraltete Konstanten an das Elternprojekt angeglichen (PARENT-SYNC GAP #4 + #5).**

### Behoben
- **Browser-User-Agent (GAP #4)** — `BROWSER_LIKE_USER_AGENT` (von workable/workday/oraclecloud/a16z/eightfold gesendet, um WAF/Bot-Gates zu passieren) von Chrome 131 auf **151** angehoben, passend zum `user-agent.mjs` des Elternprojekts; ein veralteter Build wird häufiger blockiert. Durch einen `Chrome major ≥ 151`-Test abgesichert.
- **Tracker-Status-FALLBACK (GAP #5)** — der Notfall-`FALLBACK` in `states.mjs` (nur genutzt, wenn die Live-`templates/states.yml` unlesbar ist — frischer Klon / CI-isolierte Wurzel) erhielt die türkischen Status-Aliase des Elternprojekts (#2615): değerlendirildi, başvuruldu, yanıt verildi, mülakat, teklif, reddedildi, iptal edildi, uygun değil, kabul edildi/işe alındı. In Produktion lieferte die Live-Datei sie bereits.

### Hinweise
- Nur zwei Konstanten; keine Änderung an Route / CSP / SSRF / Eltern-Schreibzugriff. Tests: `tests/http-json.test.mjs` (+1) + `tests/states.test.mjs` (+1). Suite: **2456** (+2).

## [1.177.0] — 2026-08-13

**Behoben (MEDIUM, Scanner) — csod (Cornerstone) lieferte 0 Jobs bei Tenants, die die Such-API hinter Session-Cookies sperren (parent #2769, PARENT-SYNC GAP #1).**

### Behoben
- Manche Cornerstone-Tenants setzen Session-Cookies auf der Bootstrap-Startseite der Karriereseite und antworten der Such-API mit `401 CSOD Unauthorized`, sofern diese Cookies nicht zusammen mit dem anonymen Bearer-Token zurückkommen. `sources/csod.mjs` liest den Bootstrap nun über einen neuen `fetchResponse`-Helfer, baut aus dessen `Set-Cookie`-Werten einen `Cookie`-Header (`cookieHeaderFrom` — nur name=value, Jar-Semantik) und spielt ihn auf dem Such-POST erneut ein. Nur gleicher Origin (Host angeheftet + `redirect:'error'`), sodass Session-Cookies nie zu Dritten gelangen; ein Tenant ohne Cookies verhält sich wie zuvor.

### Hinweise
- Neu `server/lib/http-json.mjs::fetchResponse` (additiv; bestehende Quellen unberührt). Keine Änderung an Route / CSP / SSRF / Eltern-Schreibzugriff. Tests: `tests/sources-parity-v1118a.test.mjs` (+1). Suite: **2454** (+1).

## [1.176.0] — 2026-08-13

**Behoben (MEDIUM, Berichte) — ein Score unter einem fetten Label, das die RU-Tabelle nicht listet, zeigte weiter "Score not detected" (FIND-5).**

### Behoben
- Zwei RU-Berichte schrieben den Score als `**Итоговый балл:** 1.8 / 5` / `**Скор:** 1.8 / 5` — fette Labels, die `REPORT_LABELS.ru` nicht aufführt (kennt nur „Оценка"/„Балл"), sodass der Score ungeparst blieb. Statt die Synonymliste zu erweitern, greift `parseReportHeader` nun auf die **Wertform** zurück: ein Bruch über das /5-Raster unter EINEM BELIEBIGEN fetten Label. Sie ist sprachunabhängig, immun gegen eine Überschrift (kein `**`, kein `/5`-Wert) und weist ein Datum wie `5/5/2026` ab (negativer Lookahead auf den Nenner).

### Hinweise
- Nur Server-Parser; keine Änderung an Route / CSP / SSRF / Eltern-Schreibzugriff. Tests: `tests/report-header-locale.test.mjs` (+2). Suite: **2453** (+2).

## [1.175.0] — 2026-08-13

**Behoben (LOW, Härtung) — ein Regressionswächter für die FIND-3-SEO-Beschreibung + ein nullsicheres Seriositäts-Strip (AI-Review-Nachbereitung).**

### Behoben
- **Paritätswächter der SEO-Beschreibung** — der v1.174.0-Fix, der ein fest codiertes "~55" im `meta.desc` jeder Sprache durch einen registry-abgeleiteten `{adapters}`-Platzhalter ersetzte, hatte keinen Test und konnte bei der nächsten Locale-Bearbeitung still regredieren. Der neue CI-isolierte `tests/site-meta-desc-parity.test.mjs` schlägt fehl, wenn eine der 17 `site/src/i18n/*.json` den Platzhalter verliert oder eine Zahl erneut fest codiert, oder wenn `Landing.astro` ihn nicht mehr in alle drei Beschreibungs-Metas interpoliert.
- **Nullsicheres Seriositäts-Strip** — `stripEmphasis` liefert `''` für einen nullish-Eingang statt der Zeichenkette "undefined" (die Felder sind string-initialisiert, also Verteidigung in der Tiefe).

### Hinweise
- Test + ein einzeiliger Wächter im Parser; keine Änderung an Route / CSP / SSRF / Eltern-Schreibzugriff. Tests: `tests/site-meta-desc-parity.test.mjs` (+3). Suite: **2451** (+3).

## [1.174.0] — 2026-08-13

**Behoben (HIGH, Berichte) — lokalisierte Berichte zeigten „Score not detected"; die SEO-Beschreibung war veraltet.**

### Behoben
- **Score-Parsing (FIND-1)** — ein nicht-englischer Bericht, dessen H1 das Score-Label-Wort enthält (`# Оценка вакансии: <Titel>`), verwechselt diesen Titel nicht mehr mit dem Score. `parseReportHeader` verankert nun am lokalisierten **fetten** Label (`**Оценка:** 1.5 / 5`), überspringt Überschriftszeilen und verlangt das Label direkt vor seinem Doppelpunkt — so zeigen RU-Berichte, die „Score not detected" anzeigten, ihren echten Score.
- **Seriositäts-Chip (FIND-2)** — Markdown-Hervorhebung wird aus dem Wert entfernt, der Chip zeigt „High Confidence" statt „** High Confidence".
- **Score-Überlauf** — eine Score-Zeile mit angehängtem Statustext („1.8, Status: Evaluated, …") wird auf den reinen Score komprimiert; `.score-pill` erhält eine Kein-Umbruch-/Overflow-Grenze und die Titelspalte kann schrumpfen, sodass ein farbiger Chip nie über den Kartenrand hinausläuft.
- **SEO-Beschreibung (FIND-3)** — die meta / OG / Twitter-Beschreibungen von cvstart.org (alle 17 Sprachen) codierten „Scan ~55 job boards" fest, während der Fließtext das echte Registry zählte („~75"). Die Beschreibung fügt nun die Registry-abgeleitete Zahl ein und driftet nicht mehr.

### Hinweise
- Server-Parser + Client-Render/CSS + Site-i18n; keine Änderung an Route / CSP / SSRF / Eltern-Schreibzugriff. Tests: `tests/report-header-locale.test.mjs` (+4). Suite: **2448** (+4).

## [1.173.0] — 2026-08-13

**Hinzugefügt (LOW, Konfiguration) — Hermes wird in die erkannte KI-CLI-Liste aufgenommen (career-ops-Parität).**

### Hinzugefügt
- Der Tab `#/config` → „KI-CLI-Werkzeuge" erkennt nun **Hermes** (Nous Research), die neu unterstützte Agent-Laufzeit des Elternprojekts (Binärdatei `hermes`). Die feste Allowlist in `server/lib/routes/cli-detect.mjs` wächst von 10 auf 11 Werkzeuge; die Erkennung bleibt ein schreibgeschützter PATH-Scan (es wird nie eine Binärdatei ausgeführt).

### Hinweise
- Keine Änderung an i18n / Route / CSP / SSRF / Eltern-Schreibzugriff; die Liste ist fest, niemals Eingabe. Suite: **2444** (der cli-detect-Canary von 10 auf 11 aktualisiert).

## [1.172.0] — 2026-08-13

**Behoben (MEDIUM, Scanner) — eine fehlerhafte HTML-Entität konnte eine Scan-Quelle zum Absturz bringen (career-ops #2150-Parität).**

### Behoben
- Die Quellen `oraclecloud`, `gem` und `dassault` dekodierten numerische HTML-Entitäten mit einer schwachen `Number.isFinite`-Prüfung vor `String.fromCodePoint` — eine Referenz über `0x10FFFF` (z. B. `&#99999999;` aus einem fehlerhaften oder feindlichen Feed) warf einen nicht abgefangenen `RangeError` und brach das gesamte Parsen dieser Quelle ab. Ein gemeinsames Modul `server/lib/html-entities.mjs` (spiegelt das `_html-entities.mjs` des Elternprojekts) beschränkt numerische Referenzen nun auf die XML-1.0-§2.2-Char-Menge, sodass `String.fromCodePoint` niemals werfen kann, und trennt Hex- und Dezimalabgleich, sodass `&#1a2;` nicht mehr falsch geparst wird. Die drei Quellen importieren es.

### Hinweise
- Keine Änderung für gültige Feeds; keine Änderung an JS / i18n / Route / CSP / SSRF / Eltern-Schreibzugriff. Die Konsolidierung der ~20 verbliebenen Decoder-Kopien in den Quellen wird in `qa/PARENT-SYNC-WORKLIST-v1.26.0.md` verfolgt.
- Tests: `tests/html-entities.test.mjs` (+7). Suite: **2444** (+7).

## [1.171.0] — 2026-08-13

**Geändert (NIEDRIG, Design-System) — Typo-Skala + z-index-Layer-Tokens (D-4, erster Schritt).** Größen und Stapelung waren pro Komponente literal.

### Geändert
- **z-index-Layer** — `--z-*`-Tokens (`--z-topbar` … `--z-skiplink`) eingeführt und **jedes z-index-Literal migriert**. Werte erhalten, Stapelung identisch; ein neuer Canary verbietet neue Magic Numbers.
- **Typo-Skala** — `--font-size-*`-Rampe (`xs 11` … `2xl 28`, Basis = Inter 15px); die Kern-Größen migriert (keine visuelle Änderung). Werte außerhalb der Rampe migrieren schrittweise (`docs/UX-ROADMAP.md`).

### Hinweise
- Nur CSS-Token; keine Änderung an Verhalten/JS/i18n/Route/CSP/SSRF/Schreibzugriff. Keine Pixel-Änderung. `tests/design-tokens-scale.test.mjs` (+3). Suite: **2437** (+3).

## [1.170.0] — 2026-08-13

**Hinzugefügt (NIEDRIG) — ehrliche ETA-Hinweise bei langen KI-Generierungen (P4-ETA).** Aufwändige Generierungen (Karriereplan ~40 s, Orientierung / Markt / Networking ~30 s, Two-Pager ~20 s) zeigten nur „Generiere…" ohne Dauer-Gefühl.

### Hinzugefügt
- Neben jedem Button für lange Generierung steht jetzt ein gedämpfter **`⏱ ~Ns`**-Hinweis (wie die ETA auf `#/auto`). Gemeinsamer `.eta-hint`-Stil + zwei generische Schlüssel (`common.eta` `~{n}s`, `common.etaTitle`).

### Hinweise
- Nur Client; keine Änderung an Route/CSP/SSRF/Schreibzugriff. +2 i18n-Schlüssel ×17 (Snapshot 1219 → 1221). `tests/generation-eta-hint.test.mjs` (+2). Suite: **2434** (+2).

## [1.169.0] — 2026-08-13

**Hinzugefügt (NIEDRIG) — Inline-PDF-Vorschau (D-5).** `GET /api/output/pdfs/:name` erzwang `Content-Disposition: attachment`, sodass selbst der „Öffnen"-Link auf `#/cv` herunterlud statt anzuzeigen.

### Hinzugefügt
- **`?inline=1`** liefert dieselbe bereinigte Datei mit `Content-Disposition: inline`, für eine **👁 Vorschau** in einem neuen Tab; Standard bleibt Download. Keine neue Route; dieselben Namens-Guards.
- Der erste Button der PDF-Liste auf `#/cv` ist jetzt **👁 Vorschau** neben **⬇ Herunterladen**. `cv.openPdf` „Öffnen" → „Vorschau" ×17.

### Hinweise
- Keine CSP/SSRF-Änderung — dasselbe `sanitizePathName`. Ein bestehender i18n-Schlüssel neu formuliert ×17 (Snapshot 1219). `tests/output-pdfs.test.mjs` (+3). Suite: **2432** (+3).

## [1.168.0] — 2026-08-13

**Behoben (NIEDRIG, a11y) — Checkbox-Zeilen erfüllen jetzt das 24×24-Minimum von WCAG 2.5.8 (D-2).** Checkbox-/Radio-Labels auf `#/scan`, `#/config`, `#/evaluate` und `#/cv-studio` lagen in einem ~22-px-Band.

### Behoben
- Eine begrenzte Regel `label:has(> input[type="checkbox"/"radio"]) { min-height: 24px }` garantiert ein ≥24-px-Band. Nur `min-height` — die Labels sind bereits flex, nichts verschiebt sich; `.apply-checklist` (32 px) war bereits konform.

### Hinweise
- Nur CSS; keine Änderung an Verhalten/JS/i18n/Route/CSP/SSRF/Schreibzugriff. `tests/checkbox-target-size.test.mjs` (+1). Suite: **2429** (+1).

## [1.167.0] — 2026-08-13

**Behoben (NIEDRIG, Design-System) — erhöhte Flächen heben sich jetzt von Haarlinien ab (D-3).** Die Tokens `--panel-2` / `--surface-elev1` lösten zu `--slate` auf — demselben Wert wie die Haarlinien `--line` / `--border` — ohne visuelle Trennung.

### Behoben
- Ein dediziertes, themenbewusstes Token **`--elev`** (`#eef1f6` hell / `#1e232e` dunkel, in beiden Themes von `--slate` verschieden) trägt jetzt die erhöhten Flächen; die Haarlinien bleiben auf `--slate`. Die übrigen Befunde (D-2, D-4, D-5, P4-ETA) stehen als Backlog in `docs/UX-ROADMAP.md`.

### Hinweise
- Nur CSS-Token; keine Änderung an Verhalten/JS/i18n/Route/CSP/SSRF/Schreibzugriff. `tests/elevation-token.test.mjs` (+2). Suite: **2428** (+2).

## [1.166.0] — 2026-08-13

**Behoben (NIEDRIG) — die Rubrik-Terminologie spiegelt jetzt die kanonischen Docs.** career-ops.org/docs beschreibt „fünf Dimensionen plus eine ganzheitliche Gesamtbewertung", aber Web-UI, cvstart.org und das Wiki sagten alle „Rubrik mit sechs Dimensionen" (5 + 1 = 6, aber der Wortlaut wich ab).

### Behoben
- Die Docs-Formulierung — **„fünf Dimensionen plus eine ganzheitliche Gesamtbewertung"** — konsistent in README ×17, der cvstart.org-Site ×17, dem Hilfe-Guide ×17, `docs/career-ops-canonical.md` und dem Wiki (Home ×17 + Features) übernommen.

### Hinweise
- Nur Docs/Marketing; keine Änderung an Code/i18n-Schlüssel/Route/CSP/SSRF/Schreibzugriff. `tests/rubric-terminology.test.mjs` (+2). Suite: **2426** (+2).

## [1.165.0] — 2026-08-13

**Behoben (NIEDRIG) — der Begriff "Two-pager" ist jetzt innerhalb jeder Sprache konsistent.** Im Arabischen zeigte die Seitenleiste das lateinische "Two-pager", während der `<h1>` vollständig lokalisiert war — die einzige lateinische Zeichenkette in einer ansonsten gespiegelten RTL-Navigation.

### Behoben
- **Entscheidung durchgesetzt:** pro Sprache stimmen `nav.twoPager` und `twoPager.title` beim Begriff überein (beide Latein oder beide lokalisiert). Nur Arabisch war getrennt; sein Navi-Label ist jetzt lokalisiert ("الصفحتان"). Ein neuer Canary schlägt fehl, wenn eine Sprache sie wieder trennt.

### Hinweise
- Nur Text; keine Änderung an Route/CSP/SSRF/Schreibzugriff. Ein i18n-Wert geändert (ar); keine neuen Schlüssel (Snapshot 1219). `tests/two-pager-term-consistency.test.mjs` (+2). Suite: **2424** (+2).

## [1.164.0] — 2026-08-13

**Behoben (NIEDRIG) — der Suchleisten-Platzhalter läuft in keiner Sprache mehr über.** "Find a company, role or URL…" wurde abgeschnitten (nowrap), wenn die Suchleiste schrumpfte; die "…or URL"-Hälfte war nie sichtbar.

### Behoben
- `top.search` (×17) ist jetzt das kurze **"Suchen oder URL einfügen"** (≤24 Zeichen in jeder Sprache), passt auch in eine schmale Leiste und behält den URL-Hinweis. Der Fallback in `index.html` passt; das `aria-label` behält das volle Detail.

### Hinweise
- Nur Text; keine Änderung an Route/CSP/SSRF/Schreibzugriff. Ein bestehender i18n-Schlüssel neu formuliert ×17 (keine neuen; Snapshot 1219). `tests/search-placeholder-fit.test.mjs` (+2). Suite: **2422** (+2).

## [1.163.0] — 2026-08-13

**Behoben (NIEDRIG) — der In-App-Assistent "Frag die Docs" deckt jetzt den PDF-Export eines Berichts ab.** Er antwortete, der Leitfaden decke das nicht ab, obwohl `#/reports/:slug` einen funktionierenden 📄 Generate PDF-Button hat.

### Behoben
- Ein H3 **"Einen Bericht als PDF exportieren"** unter §10 Berichte in **allen 17 Hilfe-Bundles** hinzugefügt (wo der Button ist, dass die Datei nach `output/*.pdf` geht, Playwright nötig, vor dem Senden prüfen). Die Assistenten-Suche zeigt jetzt die Berichte-Sektion.

### Hinweise
- Nur Docs/Hilfe; keine Änderung an Code/Route/CSP/SSRF/Schreibzugriff. Hilfe-Gate **112 → 113 H3** (31 H2 unverändert). `tests/help-reports-pdf-section.test.mjs` (+2). Suite: **2420** (+2).

## [1.162.0] — 2026-08-13

**Behoben (MITTEL) — das Hilfe-"?" ist jetzt ein ≥24×24-Zeigeziel (WCAG 2.5.8).** `.help-hint` maß 18×18 px mit `padding:0`, unter dem Minimum, auf jeder Überschrift.

### Behoben
- Die `.help-hint`-Box ist jetzt **24×24** (das messbare Ziel), während der **sichtbare Ring 18px bleibt** — von einem zentrierten `::before` gezeichnet, sodass Glyph und `<h1>`-Grundlinie unverändert sind. Hover/aktiv/Fokus folgen dem Ring; Rand 6→3px erhält den Abstand.

### Hinweise
- Nur CSS; keine Änderung an JS/i18n/Route/CSP/SSRF/Schreibzugriff. `tests/help-hint-target-size.test.mjs` (+2). Suite: **2418** (+2).

## [1.161.0] — 2026-08-13

**Behoben (MITTEL) — `#/reports` zeigt einen "Score nicht erkannt"-Chip statt Leerraum.** Nach dem sprachbewussten Parser aus v1.159.0 zeigte ein Bericht ohne lesbaren Score einen leeren Bereich — nicht von einem Fehlschlag zu unterscheiden.

### Behoben
- Die Score-Zelle verzweigt jetzt: Score vorhanden → Ton-Pille; kein Score → gedämpfter **`.score-muted`**-Chip ("Score nicht erkannt", ×17) mit Tooltip "Öffne den Bericht…". Die Karte bleibt ein tastaturbedienbares `role="link"`, und das Datum wird angezeigt.
- Nutzt den vorhandenen neutralen Token; keine neue Farbe.

### Hinweise
- Nur Client; keine Änderung an Route/CSP/SSRF/Schreibzugriff. +2 i18n-Schlüssel ×17 (Snapshot 1217 → 1219). Suite: **2416** (+3).

## [1.160.0] — 2026-08-13

**Behoben (HOCH) — der Anbieter-Text widerspricht nicht mehr dem 7-Anbieter-Versprechen.** `#/config` sagte, die Live-Bewertung "nutzt deinen Anthropic- oder Gemini-Schlüssel" und der OpenAI-Schlüssel werde "nicht von der Web-UI selbst genutzt"; das Dashboard zeigte "Anthropic-first-Scoring" — falsch seit der 7-Anbieter-Kaskade (v1.157.0).

### Behoben
- `config.providerModelNote` (×17): sagt jetzt, dass die ⚡ Live-Bewertung headless mit einem beliebigen deiner sieben Schlüssel (Anthropic · Gemini · OpenAI · Qwen · OpenRouter · GitHub Models · Hermes) läuft, automatisch geordnet mit Fallback. Der falsche OpenAI-Satz ist entfernt.
- `dash.quick.evaluateSub` (×17): anbieterneutral ("0–5 Eignungs-Score"). `Keys: N / 5` → `N / 7`.

### Hinweise
- Nur Text; keine Änderung an Route/CSP/SSRF/Schreibzugriff. Keine neuen i18n-Schlüssel (Snapshot 1217). Suite: **2413** (+3).

## [1.159.0] — 2026-08-13

**Behoben (HOCH) — Berichts-Metadaten sind nicht mehr sprachgekoppelt.** In einer anderen Sprache als Englisch erzeugte Berichte zeigten auf `#/reports` einen leeren Metadatenstreifen, weil `parseReportHeader` nur englische Fettschrift-Labels erkannte.

### Behoben
- `parseReportHeader` parst jetzt den sprachinvarianten `## Machine Summary`-YAML-Block (`score:` / `legitimacy:` / `date:` — dieselbe Quelle, die `auto-pipeline` bereits liest): englische Labels → Machine Summary → lokalisierte Labels (`REPORT_LABELS`, 17 Sprachen). Englische Berichte bleiben Byte für Byte identisch.
- Toleranter Zahl-Parse (`1.5/5`, `1,5/5`, `1.5 из 5`, `4.5 out of 5`); das Datum fällt auf die Datei-mtime zurück, wenn der Text keines hat.

### Hinweise
- Nur Lesen/Parsen; keine Änderung an Route, CSP, SSRF oder Eltern-Schreibzugriff. Keine neuen i18n-Schlüssel. Suite: **2410** (+8).

## [1.158.0] — 2026-08-12

**Behoben — zwei kosmetische Anzeigefehler (ein in den Tab-Titel durchgesickertes «?» und eine falsche Anbieterzahl auf der Landingpage).** Nur Anzeige; keine Änderung an Verhalten, Sicherheit oder Datenfluss.

### Behoben
- Das «?» von HelpHint sickert nicht mehr in `document.title`. Der Router leitete den Tab-Titel aus dem rohen `h1.textContent` ab, sodass der Tab «Vacancy search?» statt «Vacancy search» zeigte. `router.js::focusNewView` klont die Überschrift nun, entfernt `.help-hint` und liest dann den Text; das sichtbare «?» bleibt unberührt.
- cvstart.org zeigte «17 AI providers» statt «7». Der `sub()`-Helper in `Features.astro` ersetzte alle `{n}` durch die Sprachanzahl (17) vor der kartenweisen Ersetzung; `{n}` wird jetzt pro Karte aufgelöst (Anbieter → 7, Sprachen → 17).

### Hinweise
- Keine Änderung an Server, Route, CSP, SSRF oder i18n-Schlüsseln; `facts.json`-Form unverändert. Suite: **2402** Tests (+1).

## [1.157.0] — 2026-08-12

**Behoben — Live-Evals laufen jetzt mit JEDEM konfigurierten Provider, nicht nur Anthropic/Gemini.** Ein Nutzer mit nur `OPENROUTER_API_KEY` wurde fälschlich in den manuellen Modus gezwungen.

### Behoben
- **Ursache:** ein `LLM_PROVIDER`-Pin ohne Schlüssel (z. B. `LLM_PROVIDER=claude` aus `init`) lief ins Leere; nun wird auf die Auto-Reihenfolge unter den konfigurierten Providern zurückgegriffen (in `selectActiveProvider` + beiden Dispatch-Kaskaden).
- Das Client-Gating (`#/deep` + mode-page-Views) nutzt jetzt `window.ProviderStatus` (`/api/status/providers`, alle 7) statt der veralteten Anthropic/Gemini-Prüfung; überarbeitete Texte (deep/eval × 17) + „Live-Evals“-Badge im Dashboard + `config.llmProviderHint`.

### Hinweise
- Keine Sicherheitsänderung. Suite: **2401** Tests (+5).

## [1.156.0] — 2026-08-12

**Refactor — `scan.js` unter das Größenlimit aufteilen (P-16) + ein CodeQL-Fix.** `scan.js` hatte **906 Zeilen**; zwei verhaltensbewahrende Factories wurden herausgezogen → **648**. Vervollständigt das View-Split-Paar P-15/P-16.

### Geändert
- Neue `scan/runner.js` (Scan-Ausführungs-Engine) und `scan/filters.js` (Filter-Zustandsmaschine) über `ctx`/`refs`-Bags; `scan.js` verdrahtet beide.

### Behoben
- CodeQL `js/useless-assignment-to-local` (#428) in `config/tab-controller.js`: `let n = i;` → `let n;`.

### Hinweise
- Reiner Refactor, keine Verhaltensänderung; 4 quelllesende Tests umgeleitet. Beide großen Views jetzt unter 800 (P-15/P-16 fertig). Suite: **2396** Tests.

## [1.155.0] — 2026-08-12

**Refactor — `config.js` unter das Größenlimit aufteilen (P-15).** `config.js` hatte **1030 Zeilen** (über dem 800-Limit); zwei verhaltensbewahrende Module wurden herausgezogen, auf **783**.

### Geändert
- Neue `config/field-specs.js` (Felddaten + Modelllisten) und `config/tab-controller.js` (Tab-Leisten-Factory); `config.js` referenziert sie, die Render-Logik bleibt unverändert.

### Hinweise
- Reiner Refactor, keine Verhaltensänderung; 6 quelllesende Tests umgeleitet. `scan.js` (906) bleibt wie es ist (bereits teilweise aufgeteilt; Kern zu stark gekoppelt für eine saubere mechanische Aufteilung). Suite: **2396** Tests.

## [1.154.0] — 2026-08-12

**Neuer Leitfaden — „Den ganzen Stack in der Cloud betreiben“.** career-ops hat keine eigene Cloud/Server-Story, also fügen wir eine hinzu: eine Schritt-für-Schritt-Anleitung, um die übergeordnete **career-ops**-Pipeline, diesen **career-ops-ui**-Viewer und die KI-**Engine** (ein **Claude-Abo** über Claude Code, ein lokales **Hermes**, oder API-Schlüssel) auf einen kleinen Always-on-Server zu bringen. Als **Hilfe §31** in 17 Sprachen, ein README-Abschnitt und eine Wiki-Seite.

### Hinzugefügt
- **Hilfe §31 „Den ganzen Stack in der Cloud betreiben“** (× 17) — die drei Teile, Bereitstellen + Installieren, Engine wählen, sicher exponieren (HTTPS-Reverse-Proxy + Auth + die CSP/SSRF/XSS/keine-Secrets-Invarianten). Das Hilfe-Bundle wächst auf **31 H2 / 112 H3**.
- **README** — ein Abschnitt „Den ganzen Stack in der Cloud betreiben“ (× 17) + eine **Cloud-Deployment**-Wiki-Seite.

### Hinweise
- **Nur Docs** — keine Route, kein Server, keine Client-Änderung; kein neuer i18n-Schlüssel. Die 4 Hilfe-Tests wechseln auf den 31 H2 / 112 H3-Vertrag. Suite: **2396** Tests (unverändert).

## [1.153.0] — 2026-08-12

**Jobvite-Scanner auf den öffentlichen XML-Feed migriert (Parent-Sync).** Der Parent hat die Jobvite-JSON-API stillgelegt (liefert jetzt null Jobs); der web-ui-Source nutzte denselben toten Endpunkt, sodass jede getrackte Jobvite-Firma still leer scannte. Portiert den Parent-Fix (`#2623`): der Source liest jetzt den öffentlichen Per-Tenant-**XML-Feed**, geschlüsselt über `companyEId`.

### Behoben
- Der Source rief die stillgelegte JSON-API auf und lieferte null Jobs; er ruft nun `https://app.jobvite.com/CompanyJobs/Xml.aspx?c={companyEId}` auf und parst das XML `<result><job>…` (CDATA + Entities, `detail-url` vor `apply-url`).

### Geändert
- `companyEId`-Auflösung: (1) `company_eid:` am Portal, (2) `c=` einer expliziten `api:`-URL, (3) Board-Seiten-Discovery. `fetchText` (`http-json.mjs`) hängt `.location`/`.retryAfter` an den non-ok-Fehler (nur-lesend, rückwärtskompatibel).

### Hinweise
- **Sicherheit** — zwei Hosts (`jobs.jobvite.com`, `app.jobvite.com`) per `assertJobviteUrl` gepinnt: nur https, strikte Allowlist, **kein Redirect wird verfolgt**. `companyEId` ist nur ein `?c=`-Wert; Source-Anzahl unverändert.
- Suite: **2396** Tests (+4).

## [1.152.0] — 2026-08-12

**Hermes-Provider — Verdrahtung abgeschlossen + Doku-Aktualisierung.** Ein Code-Review der Hermes-Integration aus v1.151.0 fand zwei echte Lücken und vier Vollständigkeitspunkte; alle hier behoben, und die LLM-Provider-Liste der gesamten App ist auf die vollen sieben über alle Doku-Flächen und die 17 Sprachen gebracht.

### Behoben
- **`#/config` konnte Hermes nicht erzwingen** — das `LLM_PROVIDER`-Dropdown listete nur sechs Provider, man konnte `HERMES_API_KEY` setzen, Hermes aber nicht aus der UI erzwingen. `hermes` ist jetzt die 8. Option, und ein neuer Paritätstest verhindert erneutes Abweichen des Dropdowns von `LLM_PROVIDERS`.
- **Kurze selbstgehostete Schlüssel wurden still verworfen** — die 20-Zeichen-Grenze von `isUsableKey` war auf Cloud-Schlüssel ausgelegt; `hasHermesKey` nutzt nun eine gelockerte Grenze von 8 (das Beispiel der Hermes-Doku hat 19 Zeichen).

### Geändert
- Die Provider-Liste wurde in README (× 17), In-App-Hilfe (× 17), dem `config.llmProviderHint`-Dict (× 17) und `docs/sdd` auf die vollen sieben normalisiert; `hermesChatUrl` ergänzt einen Host ohne Pfad; der manuelle Fallback-Text nennt Hermes.

### Hinweise
- **Sicherheit unverändert** — keine neue Route, keine SSRF/CSP-Änderung; health/doctor erhält eine `HERMES_API_KEY`-Zeile.
- Suite: **2392** Tests (+2).

## [1.151.0] — 2026-08-12

**Hermes ist jetzt ein angebundener LLM-Provider (Phase 5)** — der Phase-5-Spike bestätigte, dass Nous Researchs Hermes einen **OpenAI-kompatiblen API Server** mitbringt (`hermes gateway` → `POST /v1/chat/completions`), sodass career-ops-ui Live-Auswertungen nun über ein lokales Hermes genau wie OpenAI/Qwen ausführt. Setzen Sie `HERMES_API_KEY` in den **App-Einstellungen**, und es reiht sich in die auto-Reihenfolge ein (zuletzt). Schließt den letzten offenen Roadmap-Punkt — **Phase 5, Shape A**.

### Hinzugefügt
- **Hermes-LLM-Provider (Shape A)** — `runHermes` auf dem gemeinsamen `runOpenAICompatible`-Client (`server/lib/openai.mjs`), in **beiden** Kaskaden (`llm-dispatch.mjs` + `routes/llm.mjs`), am Ende der auto-Reihenfolge + `LLM_PROVIDER=hermes`-Pin, `/api/status/providers` und `llm-pricing.mjs`. Er erreicht eine konfigurierbare lokale Basis-URL (Standard `http://127.0.0.1:8642/v1`) mit Bearer-Auth — ein KONFIGURIERTER Provider-Endpoint (wie OpenRouter/Qwen), keine nutzergelieferte Job-URL, also ohne SSRF-Guard.
- **`#/config`-Felder** — `HERMES_API_KEY` (geheim) + `HERMES_BASE_URL` + `HERMES_MODEL` (Standard `hermes-agent`), mit 6 neuen i18n-Schlüsseln × **17 Sprachen** (Snapshot 1208 → 1214).

### Geändert
- Der Scoping-Spike ist gelöst: `docs/integrations/HERMES.md`, die In-App-Hilfe §30 (× 17), der README-Teaser (× 14), die `hermes-bridge`-Skill und die Roadmap gehen von „geplant / noch nicht angebunden" zu **angebunden (Shape A)**. Shape B (ein maßgeschneidertes Agent-Runtime-Relay) war nicht nötig.

### Hinweise
- **Sicherheit:** der Provider-Fetch ist ein konfigurierter Endpoint, derselben Kategorie wie die anderen OpenAI-kompatiblen Provider — keine neue SSRF-Fläche, keine CSP-/Sanitizer-Änderung. `HERMES_API_KEY` ist ein `SECRET_KEY` (wird nie ausgegeben).
- Tests (CI-isoliert, Transport-Stub): `tests/hermes-provider.test.mjs` (+5); der v1.146.0-Canary „kein Hermes-Zweig" ist **invertiert**, um zu bestätigen, dass er DA ist; Provider-Flächen-Tests auf die 7-Provider-Reihenfolge aktualisiert.
- Suite: **2390** Tests (+5).

## [1.150.0] — 2026-08-12

**Konsistente Leerzustände (Phase-4-Feinschliff)** — jedes „noch nichts hier"-Panel wird jetzt über den einen gemeinsamen `.empty`-Stil gerendert, statt dass einige Ansichten das Aussehen inline mit einem magischen `40px` erneut deklarieren. Kleine visuelle Konsistenzkorrektur; die Leerzustände auf `#/activity`, `#/cv-studio`, `#/stats` und `#/usage` passen jetzt zu allen anderen (tokenisiertes 48px-Padding + gestrichelter Rahmen).

### Geändert
- **`#/activity`, `#/cv-studio`, `#/stats`, `#/usage`** entfernten ihr Inline-`style: { padding: '40px', textAlign: 'center', color: 'var(--foggy)' }` auf Leer-Panels — alle drei Eigenschaften liefert bereits die gemeinsame `.empty`-Klasse (`--space-7` = 48px, zentriert, gedämpft, gestrichelter Rahmen). So rendern diese vier identisch zu den ~25 anderen `.empty`-Panels.
- Berechtigte Überschreibungen pro Ansicht (`#/dashboard` `width:100%`, `#/pipeline` `border:none`) bleiben unangetastet — nur die rein redundanten Re-Deklarationen wurden entfernt.

### Hinweise
- **Nur Bereinigung der CSS-Nutzung im Client** — keine Änderung an Route, Server, i18n-Schlüssel oder CSS-Regeln (die `.empty`-Klasse ist unverändert); Wörterbuch-Snapshot 1208. Im Browser verifiziert (das leere `#/usage`-Panel berechnet 48px Padding + gestrichelten Rahmen, 0 Konsolenfehler).
- Der neue Canary `tests/empty-state-consistency.test.mjs` hält `.empty` als einzige Quelle der Wahrheit. Phase 5 (Hermes-Provider) bleibt blockiert.
- Suite: **2385** Tests (+2: `tests/empty-state-consistency.test.mjs`).

## [1.149.0] — 2026-08-12

**Portale in die Einstellungen verschoben (Phase 4)** — `#/portals` liegt jetzt in der Navigationsgruppe **Setup** neben den *App-Einstellungen*, statt unter *Sourcing*. Seit v1.144.0 ist es eine Einstellungsfläche (verfolgte Firmen aktivieren/deaktivieren + ein ATS-Health-Probe), keine Sourcing-Aktion — also gehört es dorthin. Nur eine Navigationsänderung; die Seite und ihre Route bleiben unverändert.

### Geändert
- **`#/portals`-Navigationselement → Setup-Gruppe** (in `public/index.html`), direkt nach den *App-Einstellungen* platziert. Aus der *Sourcing*-Gruppe entfernt (die Scan / Pipeline / Auto-pipeline / Finanzierte Firmen behält). Die Route `#/portals`, die Ansicht und das Label `nav.portals` sind unverändert — nur die Position in der Seitenleiste hat sich bewegt.

### Hinweise
- **Nur Navigations-Markup** — keine Änderung an Route, Ansicht, i18n-Schlüssel oder Server. Im Browser verifiziert (0 Konsolenfehler); abgesichert durch `tests/portals-nav-placement.test.mjs`.
- Suite: **2383** Tests (+2: `tests/portals-nav-placement.test.mjs`).

## [1.148.0] — 2026-08-12

**Übersichtlichere Scan-Filter (Phase 4) — das Filterpanel ist jetzt ein aufgeräumtes Raster** — das Filterpanel von `#/scan` wechselte von einem ungleichmäßigen Flex-Wrap aus starren Boxen unterschiedlicher Breite zu einem responsiven Raster, und die Aktionen Anwenden / Zurücksetzen liegen nun in ihrer eigenen abgetrennten, rechtsbündigen Zeile. Gleiche Filter, gleiches Verhalten — nur besser lesbar. Eine Design-Feinpolitur (ohne parent-sync).

### Geändert
- **`#/scan`-Filterpanel → responsives Raster** — `.scan-filters` ist jetzt `display: grid` mit `repeat(auto-fill, minmax(180px, 1fr))`-Spalten und gleichmäßigen Abständen, sodass sich die 11 beschrifteten Filter bei jeder Breite in ordentliche Spalten einreihen, statt in eine ungleichmäßige Zeile umzubrechen.
- **Aktionen Anwenden / Zurücksetzen** erstrecken sich über das ganze Raster in einer eigenen Zeile, durch eine Haarlinie getrennt und rechtsbündig. Der alte Trick mit verstecktem Label + der innere Flex-Wrapper in `scan.js` wurden entfernt.

### Hinweise
- **Nur CSS + eine kleine DOM-Bereinigung** — jede Filter-id (`#scan-filter-*`, `#scan-apply`) und die `SR.render()`-Verdrahtung sind unverändert, der Playwright-Ablauf bleibt also unberührt. Keine neuen i18n-Schlüssel.
- Im Browser verifiziert (0 Konsolenfehler); abgesichert durch `tests/scan-filters-grid.test.mjs`.
- Suite: **2381** Tests (+3: `tests/scan-filters-grid.test.mjs`).

## [1.147.0] — 2026-08-12

**Hermes & Telegram — der In-App-Hilfeabschnitt + die cvstart.org-Fläche (Phase 5b, Teil 2)** — der zweite und letzte Teil der Hermes-Dokumentationsarbeit: die Anleitung lebt jetzt im eigenen Hilfeleitfaden der App, in allen 17 Sprachen, und der eingebaute Dokumentations-Assistent beantwortet Hermes-Fragen daraus. Weiterhin nur Dokumentation — der Hermes-LLM-Provider-Pfad bleibt **geplant / noch nicht angebunden** (Phase 5).

### Hinzugefügt
- **In-App-Hilfe §30 „Hermes & Telegram" × 17 Sprachen** — ein neuer Leitfaden-Abschnitt (was Hermes ist + die zwei Integrationsformen; Betrieb auf einem Cloud-Server; Telegram via Hermes + die Regel „was NICHT exponiert werden darf"), erreichbar über `#/help`. Das Grounding von `docs-assistant` / `DocsFab` greift ihn automatisch auf, da beide `docs/help/<lang>.md` lesen.
- **cvstart.org — ein Link zum Hermes-Leitfaden**, der auf das Dokument auf GitHub zeigt.

### Geändert
- Hilfe-Bundle-Gate angehoben **29 → 30 H2 / 105 → 108 H3** (`canonical-docs-coverage`, `help-ui`, `help-ru-config-section`); §30 fügt 3 H3 hinzu.

### Hinweise
- **Noch ruft nichts Hermes auf.** Der neue Canary `tests/help-hermes-section.test.mjs` stellt sicher, dass jede Sprache die §30 mit ihren sprachunabhängigen Ankern enthält (`docs/integrations/HERMES.md`, `hermes-bridge`, `#/help`, `127.0.0.1`, Telegram). Der Provider bleibt bis zum API-Vertrag aus Phase 5 blockiert.
- Das schließt das **Dokumentations- + Skill**-Ergebnis von Phase 5b ab; die Provider-Integration (Phase 5) bleibt ein separater, blockierter Punkt.
- Suite: **2378** Tests (+2: `tests/help-hermes-section.test.mjs`).

## [1.146.0] — 2026-08-12

**Hermes-Agent + Telegram — der Integrationsleitfaden + eine Skill (Phase 5b, Teil 1)** — Sie können career-ops-ui auf einem Cloud-Server betreiben und dessen Events (ein abgeschlossener Scan, ein neuer Report, ein dringender Follow-up) über einen Hermes-Agent von Nous Research zu Telegram überbrücken. Diese Version liefert die Design- + Deployment-Dokumentation und eine hermes-bridge-Skill; der Hermes-LLM-Provider-Pfad bleibt geplant / noch nicht angebunden (blockiert durch den API-Vertrags-Spike der Phase 5). Dokumentation bewusst vor dem Code.

### Hinzugefügt
- **`docs/integrations/HERMES.md`** — die Tiefenanalyse: die zwei Integrationsformen (OpenAI-kompatibler Endpoint vs. Agent-Runtime), Cloud-Server-Deployment (Reverse Proxy + HTTPS + systemd, der Read-only-Vertrag mit dem Parent auf einer Headless-Maschine), Telegram via Hermes, und eine Bedrohungsmodell-Liste „was NICHT exponiert werden darf" (kein Lebenslauf / Gehalt / Report-Inhalt / Keys in den Kanal).
- **`## Hermes agent + Telegram`**-Teaser im README — ein kurzer Hinweis + Link, im englischen README und in allen vollständig übersetzten lokalisierten READMEs gespiegelt.
- Eine **`hermes-bridge`-Skill** (`.claude/skills/hermes-bridge/`), die den Leitfaden operationalisiert — Prüfungen von Voraussetzungen und Geltungsbereich (Node ≥ 18, Keys vorhanden, Erreichbarkeit des Endpoints über den SSRF-sicheren Pfad), schreibt niemals Secrets auf Disk/in Logs und verweigert das Erfinden eines Hermes-Endpoints oder die Behauptung, der Provider sei angebunden.
- Ein **Integrations**-Abschnitt in `docs/architecture/OVERVIEW.md` verlinkt den Leitfaden.

### Hinweise
- **Noch ruft nichts Hermes auf.** Ein Canary-Test (`tests/hermes-docs.test.mjs`) prüft die Ehrlichkeits-Marker „geplant / noch nicht angebunden" sowie, dass `llm-dispatch.mjs` keinen Hermes/Nous-Zweig hat — das spätere Anbinden des Providers muss also Dokumentation + Roadmap in derselben Änderung aktualisieren.
- **Verschoben auf v1.147.0** (Phase 5b, Teil 2): der In-App-Hilfeabschnitt „Hermes & Telegram" H2 × 17 Sprachen und die Marketing-Fläche von cvstart.org.
- Suite: **2376** Tests (+4: `tests/hermes-docs.test.mjs`).

## [1.145.0] — 2026-08-12

**Aufschlussreiche Statistiken (Forts.): ein neu baubares Diagramm** — der Tab „Zielrollen-Trend" auf `#/stats` hat jetzt ein **Diagramm erstellen**-Widget: eine Metrik × Dimension wählen und es zeichnet sich live neu. Ein nutzergewünschtes UX-Feature (ohne parent-sync).

### Hinzugefügt
- **Neu baubares Metrik × Dimension-Diagramm** — wählen Sie eine **Metrik** (Stellen / Median-Gehalt / Durchschnittsgehalt) und eine **Dimension** (Nach Land / Nach Rolle), und das Balkendiagramm zeichnet sich sofort neu. Gehalts-Metriken beachten Währung + Pro-Jahr ⇄ Pro-Monat-Umschalter; Stellen sind eine einfache Zählung.
- 8 neue i18n-Schlüssel × **17 Sprachen**; Snapshot 1200 → 1208.

### Hinweise
- Im Browser verifiziert (0 Konsolenfehler). Suite: **2372** Tests (+2).

## [1.144.0] — 2026-08-12

**Einstellungen & Filter (Phase 4, Teil 1): verfolgte Portale aktivieren/deaktivieren** — Sie können ein beobachtetes Unternehmen jetzt auf `#/portals` ein- oder ausschalten, und der Scanner beachtet das. Ein nutzergewünschtes UX-Feature (ohne parent-sync).

### Hinzugefügt
- **Aktivieren/Deaktivieren-Schalter pro Unternehmen auf `#/portals`** — ein Klick schaltet ein Portal aus (der EN-Scanner überspringt bereits Unternehmen mit `enabled: false`, sodass ein deaktiviertes Portal aus allen künftigen Scans fällt) oder wieder ein, mit einem optimistischen Toast.
- **`POST /api/portals/toggle`** — ein expliziter Nutzer-Write, der das `enabled`-Flag eines Unternehmens in `portals.yml` chirurgisch und parse-validiert umschaltet (Kommentare, Reihenfolge und übrige Felder bleiben erhalten). 5 neue i18n-Schlüssel × **17 Sprachen**; Snapshot 1195 → 1200.

### Hinweise
- Die Scanner-Änderung war **null** — `en-scanner.mjs` filtert bereits `enabled !== false`. Suite: **2370** Tests (+3).

## [1.143.0] — 2026-08-12

**Verständlich (Forts.): `?`-Hinweise auf den zentralen Arbeitsansichten** — das Hilfe-`?` deckt jetzt die neun wichtigsten Aktionsseiten ab, in allen Sprachen. Eine nutzergemeldete UX-Anpassung (ohne parent-sync).

### Hinzugefügt
- **`?`-Hilfehinweis auf 9 weiteren Ansichtstiteln** — `#/scan`, `#/evaluate`, `#/cv-studio`, `#/tracker`, `#/config`, `#/deep`, `#/batch`, `#/auto`, `#/apply` erhalten ein Inline-`?` (via `HelpHint.title`), das ein lokalisiertes „was es tut / wie man es nutzt / was zu erwarten ist"-Popover öffnet — dieselbe CSP-sichere Komponente wie in v1.139.0.
- 9 neue i18n-Schlüssel × **17 Sprachen** (`help.hint.scan`/…/`apply`); Snapshot 1186 → 1195.

### Hinweise
- Im Browser verifiziert (0 Konsolenfehler). Suite: **2365** Tests (+1).

## [1.142.0] — 2026-08-12

**Korrektur: kein "Unknown"-Karrierearchetyp mehr** — `#/orientation` ordnet jetzt immer den acht benannten Karrierevektoren zu, statt gelegentlich "Unknown" zu antworten und zu empfehlen, darauf "zu setzen". Eine nutzergemeldete Korrektur (ohne parent-sync).

### Behoben
- **`#/orientation` — der KI-Prompt verbietet jetzt einen Archetyp außerhalb des Sets.** Das Modell MUSS die Top 3 aus genau den acht benannten Vektoren wählen und darf **nie** "Unknown"/"N/A"/"unzureichende Daten" antworten oder ein Label erfinden. Bei dünnem Lebenslauf benennt es dennoch die drei nächsten mit geringerer Sicherheit und nennt die fehlende Evidenz.

### Hinweise
- Nur Server-Prompt-Änderung (`buildOrientationPrompt`); keine i18n-/Schema-Änderung. Suite: **2364** Tests (+1).

## [1.141.0] — 2026-08-12

**Aufschlussreiche Statistiken (Forts.): Anreicherung finanzierter Unternehmen** — `#/funded` ist jetzt visueller: Firmenlogos, ein Diagramm nach Finanzierungsbetrag und Karten mit Runde / Betrag / Discovery-Score / vorgeschlagener Aktion. Eine nutzergemeldete UX-Anpassung (ohne parent-sync).

### Geändert
- **`#/funded` — flache Tabelle → Kartenraster.** Jedes kürzlich finanzierte Unternehmen ist nun eine Karte mit **Logo** (aus dem Namen via `CompanyLogo` abgeleitet, Buchstaben-Avatar als Rückfall), **Runde**- + **Betrag**-Chips, dem **Discovery-Score** und der **vorgeschlagenen Aktion** des Elternprojekts sowie Link und Datum der Finanzierungsnews.
- **Visualisierung des Finanzierungsbetrags** — ein horizontales Balkendiagramm der größten Unternehmen nach offengelegtem Betrag; Freitext-Beträge ("$120M"/"€1.5B") werden per neuem `parseAmount` in eine Größe geparst. 3 neue i18n-Schlüssel × **17 Sprachen**.

### Hinweise
- Weiterhin **nur lesend** über `GET /api/company-funded`; Beschreibung und Gehaltsspanne fehlen in der Finanzierungsquelle. Suite: **2363** Tests (+2).

## [1.140.0] — 2026-08-12

**Aufschlussreiche Statistiken: reichere Gehaltszahlen** — die Gehaltsaufschlüsselung unter „Meine Pipeline" auf `#/stats` zeigt jetzt den **Durchschnitt** (nicht nur den Median), einen **pro Jahr ⇄ pro Monat**-Umschalter und eine **Min · Ø · Median · Max**-Tabelle je Land. Erster Teil von Phase 3. Eine nutzergemeldete UX-Anpassung (ohne parent-sync).

### Hinzugefügt
- **Durchschnittsgehalt** — `RoleStats.salaryStats` liefert nun `avgUsd` neben `minUsd`/`medianUsd`/`maxUsd`. Der Median trotzt Ausreißern, der Durchschnitt zeigt die Schiefe — zusammen lesen sie sich als Verteilung.
- **Pro-Jahr ⇄ Pro-Monat-Umschalter** und eine **Min · Ø · Median · Max-Tabelle je Land** im Gehaltsbereich, gesteuert von Währungs- und Zeitraum-Auswahl. 8 neue i18n-Schlüssel × **17 Sprachen**.

### Hinweise
- Die Zahlen stammen weiterhin nur aus Anzeigen mit lesbarem Gehalt und werden auf USD normalisiert (Richtwerte). Suite: **2361** Tests (+1).

## [1.139.0] — 2026-08-12

**Verständlich: `?`-Hilfehinweise** — eine wiederverwendbare, CSP-sichere `?`-Schaltfläche, die beim Klick „was es tut / wie es funktioniert / was zu erwarten ist" in Ihrer Sprache erklärt. Eine nutzergemeldete UX-Anpassung (ohne parent-sync).

### Hinzugefügt
- **`?`-Hilfehinweis-Popover** (`window.HelpHint`) — ein rundes `?` neben einer Überschrift öffnet ein leichtes, themenbewusstes und in RTL gespiegeltes Popover, das eine lokalisierte Erklärung über `UI.md()` rendert; barrierefrei (`role="tooltip"`, `aria-expanded`, Schließen mit Escape/Klick außerhalb, Fokus wiederhergestellt) und CSP-sicher.
- **`?` auf den 5 `#/stats`-Tabs** und auf **8 KI-/Analyse-Ansichtstiteln** (career-plan, Orientierung, two-pager, Networking, Mock-Interview, Speicher, funded, Wochenzusammenfassung) — 14 neue i18n-Schlüssel × **17 Sprachen**.

### Hinweise
- Alle Ansichten hatten bereits einen einzeiligen Untertitel; das `?` ergänzt die tiefere Erklärung bei Bedarf und macht leere Zustände selbsterklärend. Suite: **2360** Tests (+4).

## [1.138.0] — 2026-08-12

**Generierung in deiner Oberflächensprache** — jede KI-Generierung antwortet nun in der im UI gewählten Sprache, plus Review-getriebene Test-Härtung. Eine nutzergemeldete UX-Anpassung (ohne parent-sync).

### Geändert
- **KI-Generierungen respektieren jetzt die UI-Sprache.** Ist die Oberfläche auf Russisch, Spanisch, Japanisch, … eingestellt, kommt der generierte Text **in dieser** Sprache zurück statt immer auf Englisch. Die Ausgabesprach-Direktive läuft durch **alle** Generierungs-Endpunkte — Karriereplan, Orientierung, Marktbericht, Mock-Interview, Networking-Plan, „Frag die Doku“, den Memory-Notiz-Vorschlag und den Two-Pager-Entwurf. Code und Bezeichner bleiben englisch (z. B. die YAML-Schlüssel des Two-Pagers); nur Prosa, Überschriften und Stichpunkte werden lokalisiert.

### Behoben
- **CSS-Farbrollen-Wächter** (`tests/css-role-tokens.test.mjs`) — ein statischer Kanarienvogel, dass die Dark-Mode-Alias-Tokens aus v1.137.0 ihre Rolle nie umkehren: Text-Rollen-Tokens (`--fg`/`--danger`/`--ok`/…) nie als `background`, Flächen-Tokens (`--card`/`--panel`/`--line`/…) nie als Text-`color`, über das gesamte CSS und die Inline-Styles der SPA.
- **`UI.md()`-XSS-Loader-Selbsttest** — der Test, der `md()` aus `api.js` lädt, prüft jetzt `md('<script>…')` direkt nach der Extraktion und wirft, wenn das Escaping fehlt, sodass ein künftiger Fehlschnitt **laut** fehlschlägt, statt die Sicherheits-Suite auf einer abgeschnittenen Funktion grün zu färben.
- **Scroll-Wächter auf `#/career-plan`** — das `scrollIntoView` nach der Generierung läuft nur, wenn die Vorschau noch mit dem Dokument verbunden ist.

### Hinweise
- `docs/UX-ROADMAP.md` aktualisiert: die `?`-Hilfe-Hinweise + Seitenbeschreibungen + Leerzustände sind nun **v1.139.0**; ein **Nous Research / Hermes**-Provider — mit Cloud-Server- + Telegram-Deployment-Guide und einem Hermes-Skill — wird als **Phase 5 / 5b** geführt.
- Suite: **2356** Tests (+5).

## [1.137.0] — 2026-08-11

**Lesbarkeits- und Rendering-Fixes** — Dark-Mode-Kontrast, Diagrammbeschriftungen und der Karriereplan. Ein nutzergemeldeter UX-Durchgang (kein Parent-Sync).

### Behoben
- **Dark-Mode Weiß-auf-Weiß / Schwarz-auf-Schwarz auf vielen Bildschirmen** — fünfzehn CSS-Custom-Properties, auf die mehrere Ansichten verwiesen (`--fg`, `--panel`, `--panel-2`, `--ok`, `--danger`, `--card`, …), waren nie deklariert und fielen daher auf hartcodierte Hell-/Schwarz-Werte zurück: im Light-Mode unproblematisch, im Dark-Mode unlesbar (die Übersichts-Chips von `#/pipeline`, der aktive Tab von `#/stats`, „Aktiv / Schlüssel“ + „✓ gesetzt“ in `#/config`, die Abschnitte von `#/two-pager`, die Fragenblase von `#/mock-interview`, Fehlertext). Sie sind jetzt auf die tatsächlichen themenfähigen Tokens aliasiert und folgen damit automatisch dem Theme — **0 WCAG-AA-Kontrastfehler über alle 29 Ansichten**, verifiziert durch einen automatisierten Prüfer; der aktive Tab von `#/config` wechselte zu einem gut lesbaren, getönten Stil. Eine Regressions-Absicherung (`tests/dark-theme-tokens.test.mjs`) hält sie aliasiert.
- **Diagrammbeschriftungen in `#/stats` wurden mitten im Wort abgeschnitten** („Senior Backend Engineer“ → „…Enginee“) — sie werden jetzt mit Auslassungspunkten gekürzt, wobei die vollständige Beschriftung als Hover-Tooltip erhalten bleibt.
- **`#/career-plan` zeigte den generierten Plan als rohes Markdown an** — er wird jetzt automatisch als formatierter, lesbarer Text gerendert (das editierbare Markdown bleibt im Textfeld; „Vorschau“ schaltet um).

### Hinweise
- `#/career-plan`, `#/two-pager`, `#/stats` und der wöchentliche Interview-Digest sind nicht defekt — sie zeigen Leerzustände an, bis Sie einen Plan generieren bzw. Daten vorliegen. Klarere Hinweise auf der Seite und `?`-Hilfe-Tooltips sind als Nächstes geplant (`docs/UX-ROADMAP.md`).

## [1.136.0] — 2026-08-11

Parität mit dem übergeordneten Projekt career-ops **v1.26.x** (nachgelagerter v1.26.0-Mainline-Stand) — eine neue Quelle ohne Authentifizierung sowie eine Welle von Qualitäts- und Robustheits-Ports für die web-ui-Spiegel. Die Registry umfasst nun **79 Quellen = 74 englische + 5 russische** (`ALL_ADAPTERS` 74).

### Hinzugefügt
- **`eightfold`** (Eightfold AI, #2684) — Talent-Acquisition-Boards über die authentifizierungsfreie `https://<tenant>.eightfold.ai/api/apply/v2/jobs`-API, host-gepinnt auf `*.eightfold.ai` (der gebrandete `careers.<company>.com`-CNAME wird absichtlich abgelehnt); paginiert mit einer Sicherheitsobergrenze, Tote-Board-Throw, URL-Dedup. Quelle + Adapter + CI-isolierte Test-Suite; erscheint im `#/scan`-Quellenfilter und auf der Landingpage.

### Behoben
- **Unicode-fähige Dedup- und Rollen-Schlüssel** (#2569 / #2587 / #2667) — ein neues gemeinsames `normalizeTextKey` (NFKC, behält Buchstaben/Diakritika/Ziffern jeder Schrift) ersetzt die rein ASCII-basierten Schlüssel: `detect-reposts` gruppiert nun Breiten-/Interpunktions-Firmenvarianten („Acme, Inc.“ ≡ „Acme Inc“) und fasst niemals unterschiedliche nicht-lateinische Arbeitgeber zusammen, während `role-matcher` Halbbreiten-/Vollbreiten-Titel zusammenführt und nicht-lateinische Rollen-Tokens beibehält, statt sie zu löschen.
- **`fetchJsonWithRetry` wiederholt einen abgelehnten Redirect nicht mehr** (#2657) — eine `redirect:'error'`-Absicherung, die auf einen 3xx trifft, ist deterministisch, daher ist dies jetzt nicht wiederholbar und schlägt sofort fehl, statt das Wiederholungsbudget zu verbrauchen.
- **`title_filter.positive`-UND-Gruppen** (#2552) — ein durch Leerzeichen begrenztes ` + ` innerhalb eines positiven Eintrags verlangt nun, dass jeder Begriff im Titel vorkommt, in beliebiger Reihenfolge.
- **`oraclecloud` akzeptiert die durchnummerierten Tenant-Apex-Domains** `oraclecloud1.com … oraclecloud99.com` (#2683) — eine begrenzte Familie (keine führende Null, ≤ 2 Ziffern), niemals eine Wildcard-Apex-Domain.
- **`workable` gehärtet** (#2675) — Wiederholungsversuche, browserähnliche Header und Anfrage-Serialisierung gegenüber dem Cloudflare-vorgeschalteten Host.
- **`personio` weicht auf ein HTML-Scraping aus**, wenn der XML-Feed deaktiviert ist, statt nichts zurückzugeben.
- **`states`-FALLBACK-Aliase erneut synchronisiert** mit dem übergeordneten Projekt (#2615).

### Hinweise
- Nicht portiert (von web-ui nicht gespiegelt, oder nur CLI-relevant): reply-matcher (#2672), jd-similarity (#2661), jd-skill-gap (#2686), das Parsen von scan env-path (#2568) / `--flag=value` (#2589) sowie Änderungen an Anschreiben/CV-Vorlage/doctor/ollama/generate-pdf. Die HIGH-Advisories für `js-yaml`/`nanoid` im Web wurden bereits in web-ui v1.135.0 gepatcht.

## [1.135.0] — 2026-08-11

Parität mit dem übergeordneten Projekt career-ops **v1.26.0** — fünf neue Scan-Quellen ohne Authentifizierung sowie Korrekturfixes für vier Boards, die web-ui bereits unterstützt. Die Registry umfasst nun **78 Quellen = 73 englische + 5 russische** (`ALL_ADAPTERS` 73).

### Hinzugefügt
- **Fünf neue Scan-Quellen** (jeweils eine Quelle + ein Adapter + eine CI-isolierte Test-Suite; sie erscheinen im `#/scan`-Quellenfilter und auf der cvstart.org-Landingpage):
  - **`join`** (JOIN) — das JOIN-Board eines Unternehmens aus den Next.js-`__NEXT_DATA__` unter `join.com/companies/<slug>` (host-gepinnt, seitenbegrenzt).
  - **`getro`** (Getro) — Portfolio-Boards von VC-„Talent-Network“-Programmen über die öffentliche `api.getro.com`-POST-API, paginiert nach neuesten zuerst; jede Stelle wird dem Portfolio-Arbeitgeber zugeordnet, nicht dem Fonds.
  - **`consider`** (Consider) — VC-Portfolio-Boards von getconsider.com über eine Same-Origin-POST-Anfrage; der konfigurationsgesteuerte Host wird durch eine strukturelle SSRF-Absicherung gepinnt (nur öffentliche HTTPS-Hosts).
  - **`joinup`** (JOINUP) — das Schweizer Board joinup.ch, liest die serverseitig gerenderte neueste Seite aus; schlägt bei einem Scraper-Bruch sicher fehl (fail-closed).
  - **`remotli`** (Remotli) — remotli.ch, Remote-Stellen bei Schweizer Unternehmen (Gehälter in CHF); gibt die eigene Bewerbungs-URL des ATS des Arbeitgebers aus, sodass Cross-Postings dedupliziert werden.

### Behoben
- **a16z Speedrun** bricht das gesamte Board nicht mehr wegen eines vorübergehenden Ausfalls ab — Seitenabrufe laufen jetzt über ein gemeinsames `fetchJsonWithRetry` (begrenzte Wiederholungsversuche nur bei vorübergehenden 429/5xx/Timeout-Fehlern, niemals bei einem dauerhaften 4xx), und das Seitenbudget wurde für die 50-Stellen-Seite neu bemessen.
- **arbeitsagentur** wurde auf die v6-Jobsuche-API (`/pc/v6/jobs`) umgestellt — der alte v4-Endpunkt liefert jetzt 404; die Antwortstruktur wurde umbenannt, und die Remote-Filterung grenzt nun serverseitig ein.
- **thehub** wurde auf die v2-`jobsandfeatured`-API umgestellt; Einträge enthalten kein Veröffentlichungsdatum und sind vom Alters-Filter ausgenommen.
- **hackernews** findet den monatlichen „Who is hiring?“-Thread jetzt zuverlässig, indem die Algolia-Abfrage auf das Konto-Tag `author_whoishiring` gefiltert wird, statt auf eine Freitextsuche.

### Hinweise
- Nicht portiert (web-ui ist bereits sicher, wird per Relay übernommen oder ist nur CLI-relevant): die Unicode-Schlüssel für Rollen-Deduplizierung/Firmen-Abgleich (die Repost-Gruppierung von web-ui verwendet für den Firmenschlüssel bereits ein einfaches Kleinschreibungs-Schema, sodass unterschiedliche nicht-lateinische Arbeitgeber niemals zusammenfallen); das Ablehnungs-Latenz-Signal für Follow-ups + die company-funded-Feinschliffe (schreibgeschützt weitergeleitet, fail-soft); über Umgebungsvariablen überschreibbare Scan-Pfade und das Parsen von `--flag=value` (web-ui führt die Scanner in-process aus); das Refactoring zur Konsolidierung des User-Agent (web-ui zentralisiert dies bereits); sowie reine CLI-Punkte (Liste nicht vertrauenswürdiger Inhalte, oferta/offer-prep, doctor, Änderungen an Anschreiben-/Lebenslauf-Vorlagen).

## [1.134.1] — 2026-08-05

Validierungs-Härtung — durch ein vollständiges Projekt-Audit aufgedeckte Fehlerbehebungen.

### Behoben
- **`successfactors` verwirft bei einem Fehlschlag mitten im Scan nicht mehr die bereits gesammelten Stellen** (Regression aus dem v1.134.0-Port des Tote-Boards-Throw) — seine Paginierungsschleife hatte kein `try/catch`, sodass ein Fehlschlag auf Seite 2 oder später (nachdem Seite 1 erfolgreich war) einen Fehler warf und alles bereits Gesammelte verwarf; und wenn dieser Fehlschlag ein `404` war (ein außerhalb des Bereichs liegendes `startrow`), quarantänierte `en-scanner` einen aktiven Tenant tagelang als tot. Spiegelt nun `phenom`/`radancy`: Ein Fehlschlag auf Seite 0 wirft weiterhin einen Fehler (totes Board), aber ein späterer Seitenfehlschlag behält die Teilergebnisse.
- **Die `#/scan`-Filter-Chips sind jetzt per Tastatur bedienbar** (WCAG 2.1.1) — die Facetten-Chips (und der „Zurücksetzen“-Chip) waren Spans mit einem Klick-Handler, aber ohne `tabindex`/Rolle, sodass Tastatur- und Screenreader-Nutzer sie weder erreichen noch umschalten konnten. Sie tragen nun `role="button"`, `tabindex="0"`, `aria-pressed` und Enter/Leertaste-Aktivierung.
- **Drei hartcodierte englische Zeichenketten sind jetzt lokalisiert** — der `#/scan`-Vertrauens-Badge-Tooltip, die `#/scan`-Umzugs-Spaltenüberschrift und die `#/dashboard`-Punktzahl-Überschrift waren literale Zeichenketten, die das i18n-Paritätsgate nicht erkennen konnte (sie waren nie Schlüssel), sodass sie in jeder nicht-englischen Sprachversion englisch blieben. Jetzt `scan.trustTip` + `scan.col.reloc` (2 neue Schlüssel) + eine Wiederverwendung von `track.col.score`, mit einer quellcode-statischen Absicherung.

## [1.134.0] — 2026-08-05

Parität mit dem übergeordneten Projekt career-ops **v1.25.0**.

### Hinzugefügt
- **Neue Scan-Quelle: getManfred** (`manfred`) — ein board-weiter Feed spanischer/EU-Tech-Stellen mit veröffentlichten Gehältern, von `www.getmanfred.com/api/v2/public/offers` (ohne Auth, host-gepinnt + nur HTTPS, vollständiger Katalog in einer einzigen Anfrage). Quelle + Adapter + eine CI-isolierte Suite (`tests/sources-manfred.test.mjs`); die Registry umfasst nun **73 Quellen = 68 englische + 5 russische** (`ALL_ADAPTERS` 68). Erscheint im `#/scan`-Quellenfilter und auf der cvstart.org-Landing.

### Behoben
- **Der a16z-Speedrun-Feed wurde stillschweigend auf 50 Stellen gekürzt** (#2404) — der Feed begrenzt eine Seite auf 50, aber die Quelle forderte `PER_PAGE = 100` an, sodass die Paginierung nach Seite 1 stoppte. Auf 50 korrigiert.
- **Tote Boards werfen jetzt einen Fehler, statt als „aktiv, aber leer“ gelesen zu werden** (#2379) — `cryptocurrencyjobs`, `phenom`, `radancy`, `successfactors`: Ein Fetch-Fehlschlag, bei dem keine einzige Anfrage jemals aufgelöst wurde, wirft nun einen Fehler (sodass die `#/portals`-Zustandsprüfung und der Scan einen echten Fehlschlag protokollieren), statt ihn stillschweigend zu einer leeren Liste zu verschlucken; ein Fehlschlag mitten im Scan nach mindestens einem Erfolg behält die Teilergebnisse.
- **workable nutzt jetzt die öffentliche Widget-API** (#5ab8425) — umgestellt auf `apply.workable.com/api/v1/widget/accounts/<slug>`, die die vollständige Stellenliste eines großen Kontos in einer einzigen Anfrage liefert, sodass große Konten nicht mehr gekürzt werden.

### Hinweise
- Nicht portiert (nur CLI oder von web-ui nicht gespiegelt): die Perf-Überarbeitung des Titel-Bucketings von `detect-reposts` #2389; die Unicode-Firmenschlüssel-Fixes (die eigene Tracker-Deduplizierung von web-ui ist bereits nicht-lateinisch-sicher); `scan --since`; `cv-facts`; der CV-Vorlagen-/PDF-Audit-Durchlauf; `doctor`; die Direktive zu nicht vertrauenswürdigen Inhalten in den Modi.

## [1.133.1] — 2026-08-02

### Behoben
- **`#/funded` (Finanzierte Unternehmen) zeigt jetzt Ergebnisse an** — zwei Fehler sorgten dafür, dass die Tabelle immer „keine finanzierten Unternehmen“ anzeigte, selbst wenn `company-funded.mjs` des Elternprojekts eine vollständige Liste zurückgab. (1) Die Ansicht las die Ergebnisse unter `res.candidates`, aber das Elternprojekt liefert sie unter `companies` (jeweils `{ company, amount, round, funding: { sources: [{ source, url, observed_date }] } }`); der Client liest nun den richtigen Schlüssel und bildet die tatsächliche Belegstruktur ab. (2) Die Ergebnistabelle übergab ihre Zellen als Varargs an `UI.el('tr', {}, …)`, aber `UI.el(tag, attrs, children)` erwartet `children` als einzelnen Knoten oder Array, sodass nur die erste Spalte (Unternehmen) gerendert wurde — Zellen werden jetzt als Array übergeben. In einem echten Browser verifiziert: 11 Unternehmen aus den vier Feeds werden mit den Spalten Unternehmen / Finanzierungssignal / Quelle / Datum sowie funktionierenden Belegs-Links gerendert, ohne Konsolenfehler. Ein leerer Durchlauf zeigt nun auch die Pro-Quelle-Diagnose an, sodass sich ein ruhiger Nachrichtentag von einem blockierten Feed unterscheiden lässt.
- Regressions-Absicherungen in `tests/parity-routes-v1133.test.mjs`: Das simulierte Skript des Elternprojekts liefert nun die tatsächliche `companies`-Ausgabeform (die ursprüngliche Fixture spiegelte fälschlich die `candidates`-Form wider — genau deshalb konnte der Fehler mit grüner Suite ausgeliefert werden), zusätzlich quellcode-statische Prüfungen, dass `funded.js` `res.companies` liest (niemals `res.candidates`) und Tabellenzeilen mit Array-Children baut (+1 → 2144).

## [1.133.0] — 2026-08-01

### Hinzugefügt
- **Erkennung frisch finanzierter Unternehmen (`#/funded`, Parent-Parität #2117)** — eine neue schreibgeschützte Ansicht, die das Skript `company-funded.mjs` des Elternprojekts career-ops über `GET /api/company-funded` weiterleitet: eine zur Durchsicht bereitgestellte Liste kürzlich finanzierter Unternehmen, ermittelt aus öffentlichen, host-gepinnten Finanzierungs-Feeds (TechCrunch, PR Newswire, The Guardian, Hacker News). Das Relay führt das Skript mit `--json --dry-run` aus (JSON auf stdout, keine Dateischreibvorgänge), leitet Benutzereingaben niemals in `--sources` weiter, unterliegt Rate-Limiting und wird ausschließlich durch den Nutzer ausgelöst (eine „Entdecken“-Schaltfläche, niemals beim Laden der Seite). Neues Routenmodul `server/lib/routes/funded.mjs` + `public/js/views/funded.js`, unter Sourcing.
- **Wöchentlicher Interview-Digest (`#/interview-digest`, Parent-Parität #2129/#2130)** — eine neue schreibgeschützte Ansicht, die das LLM-freie Skript `weekly-digest.mjs` des Elternprojekts über `GET /api/interview/weekly-digest` weiterleitet: eine mechanische Zusammenfassung der Interview-Sitzungsnotizen — mit welchen Unternehmen und in welchen Runden Sie diese Woche ein Interview hatten, wiederkehrende Kompetenzen und nach bestem Ermessen ermittelte offene Lücken. Der optionale `?from=&to=`-Zeitraum wird nur weitergeleitet, wenn BEIDE Werte gültige `YYYY-MM-DD`-Daten sind; ein leerer Zeitraum ergibt einen gültigen `available:true`-Digest. Ergänzt in `server/lib/routes/interview.mjs` + `public/js/views/interview-digest.js`, unter Analytics.
- Beide Relays folgen dem etablierten Fail-soft-`available:false`-Vertrag, wenn das Elternskript fehlt (CI, eigenständige Installationen). 26 neue i18n-Schlüssel ×17 Sprachversionen; CI-isolierte Suite `tests/parity-routes-v1133.test.mjs` (+5 → 2143).

### Hinweise
- Das Elternprojekt career-ops ist über v1.24.0 hinaus fortgeschritten — mit der Follow-up-Tracker-Seite (#1422) der Next.js-Web-App und dem Backend-PDF-Rendering (#2182) — nicht portiert: web-ui verfügt bereits über ein eigenes Follow-up-Relay und eigene PDF-Runner, und die zugrunde liegende Härtung von `followup-cadence.mjs` kommt über das Shell-out-Relay ohnehin kostenlos mit. Die Änderungen an `set-status.mjs` / `tracker-utils.mjs` sind CLI-intern und werden nicht gespiegelt.

## [1.132.0] — 2026-07-31

### Geändert
- **`#/scan`-Ergebnis-Rendering-Subsystem nach `public/js/lib/scan-results.js` extrahiert** (File-Size-Contract-Schuld — `public/js/views/scan.js` war auf ~1254 LOC angewachsen). Das Subsystem (`renderResults`, `buildChipRow`, `getRows`, die Zeilen-/Facetten-Builder, die Options-Painter und der `FALLBACK_SOURCES`-Registry-Spiegel) wurde in eine `window.ScanResults.create(ctx)`-Factory verschoben, die über ein vom View bereitgestelltes Kontextobjekt schließt. Keine Verhaltensänderung — die Funktionen wurden unverändert verschoben, die Closure-Variablen auf `ctx.*` umverdrahtet; `scan.js` umfasst nun ~906 LOC (ein zweiter Extraktionsdurchgang in Richtung des 800-LOC-Ziels ist geplant).
- Quellcode-statische Tests lesen beide Dateien über `tests/helpers/scan-src.mjs::loadScanSrc()`; `tests/scan-fallback-sources.test.mjs` liest den Registry-Spiegel nun aus `scan-results.js`.
- **Neues Regressions-Gate im Browser** — `tests/playwright-scan-filters.mjs` setzt ein vorgefertigtes `data/last-scan.json` und steuert jeden `#/scan`-Filter, wobei exakte Zeilenanzahlen geprüft werden (`npm run test:e2e:browser`); stabile Filter-IDs (`#scan-filter-*`, `#scan-apply`) wurden hinzugefügt.
- Das README-Banner „Latest release“ wurde auf eine einzeilige Zusammenfassung + einen Link zum vollständigen Changelog verschlankt (die lange, versionsübergreifende Fließtext-Wand entfällt). Angewendet in allen 17 Sprachversionen.

## [1.131.2] — 2026-07-31

### Geändert
- **`app.css` in drei geordnete Stylesheets aufgeteilt** (File-Size-Contract-Schuld — die einzelne Datei war auf ~1990 LOC angewachsen, weit über dem harten 800-LOC-Ziel). Sie ist nun `app.css` (~672 — a11y, Design-Tokens/Theme, Sidebar, Main, Buttons, Content-Shell), **`components.css`** (~595 — Karten, Grids, Paginator, Badges, Tabellen, Formulare, Log/Konsole, Markdown, Sprachumschalter, Chip-Filter, Verbindungsbanner) und **`overlays.css`** (~737 — Toast, Benachrichtigungs-Drawer, Modal, Sonstiges/Responsive, der `[dir="rtl"]`-Spiegel, docs-fab, usage-hud), jede innerhalb des harten Limits.
  - Der Schnitt ist **zusammenhängend und in Reihenfolge**, sodass die Kaskade **byte-für-byte identisch** zur Datei vor der Aufteilung ist; `index.html` lädt die drei als geordnete `<link>`s. **Keine Verhaltens-, Markup- oder i18n-Änderung.**
  - CSS-prüfende Tests lesen die Verkettung nun über einen gemeinsamen `tests/helpers/css.mjs::loadAppCss()`-Helper. Der neue `tests/css-modularization.test.mjs` fixiert die Aufteilung (Dateien existieren · jede ≤ 800 LOC · `index.html`-Link-Reihenfolge) → Suite **2138**. Im Browser verifiziert: Alle drei Stylesheets werden geparst und ihre Regeln greifen.

## [1.131.1] — 2026-07-31

### Behoben
- **Adapter-Host-Pinning-Konsistenz bei den beiden v1.130.0-Quellen** (Nachträge aus dem Code-Review, Defense-in-Depth; kein Verhaltensunterschied bei gültigen Eingaben):
  - **`a16z-speedrun-talent`-Adapter** validiert das `api:`- / `a16z-speedrun-talent:`-Override jetzt erneut in `buildEndpoint` (HTTPS + exakter Host `speedrun-talent-network.com`) und fällt bei Fehlschlag auf den kanonischen Feed zurück — Parität mit dem `cryptocurrencyjobs`-Adapter, sodass ein Host-fremder Wert nie den Fetch-Slot erreicht (zuvor verließ er sich ausschließlich auf die Fetch-Zeit-Absicherung `assertSpeedrunUrl`). Die exakte Host-Prüfung ist nun eine einzige exportierte `SPEEDRUN_TALENT_HOST_RE`, die sich Guard und Adapter teilen.
  - **`cryptocurrencyjobs`-Parser** — `cleanUrl` verwendet nun denselben exakten Host-Guard wie `assertCryptocurrencyJobsUrl` und das Adapter-Override (zuvor `endsWith`, was Subdomains akzeptierte). Der Parser ist nie großzügiger als der SSRF-Guard: Ein `sub.cryptocurrencyjobs.co`-Item-Link wird verworfen.
  - +2 Tests → Suite **2135**.

## [1.131.0] — 2026-07-31

### Hinzugefügt
- **`#/tracker`-CRM-Stage-Tab-Board** (portiert aus der `/pipeline`-Ansicht der Web-App des Elternprojekts). Die Funnel-Chip-Leiste + das Status-Dropdown des Trackers werden durch eine **Stage-Tab-Leiste** ersetzt: ein **Alle**-Tab plus ein Tab pro kanonischem Status — **Evaluated · Applied · Responded · Interview · Offer · Rejected · Discarded · SKIP · Hired** — jeweils mit einer live berechneten Gesamtverlaufs-Anzahl, **einschließlich Stufen mit null Treffern**, sodass der vollständige Funnel stets sichtbar bleibt (der CRM-Look). Der aktive Tab steuert den Filter; erneutes Klicken setzt ihn zurück auf Alle. Zeilen behalten ihren Score-Ton, Legitimitäts-, PDF- und Report-Hinweise, und die Firmen-Zelle zeigt jetzt ein Markenlogo, wenn Logos aktiviert sind (standardmäßig aus → keine zusätzlichen Anfragen).
  - Neue schreibgeschützte Route **`GET /api/tracker/stages`** liefert den kanonischen Funnel (Labels in Reihenfolge) + eine Alias-Faltungs-Map, gespeist aus `server/lib/states.mjs` (`templates/states.yml`, mit dem eingebauten Fallback) — sodass der Client **die Status-Whitelist niemals hartcodiert**. Die Legacy-Antwort von `GET /api/tracker` ohne Parameter bleibt unverändert (nur `{ rows }`).
  - Neue reine, unit-getestete Client-Lib **`public/js/lib/tracker-stages.js`** ordnet Zeilen den Stufen des Servers zu und toleriert dabei verirrte Markdown-Fettschrift sowie lokalisierte Aliase (z. B. `aplicado` → `Applied`). Die Tabs sind barrierefrei (Rolle tablist/tab, aria-selected, ≥44 px Trefferfläche, Anzahl im barrierefreien Namen jedes Tabs). Keine neuen i18n-Schlüssel. Suite **2133**.

## [1.130.0] — 2026-07-31

### Hinzugefügt
- **Zwei neue Scan-Quellen aus dem Elternprojekt career-ops v1.24.0 portiert** (in-process, keine neuen Abhängigkeiten; beide erscheinen im `#/scan`-Quellenfilter und auf der cvstart.org-Landing):
  - **a16z Speedrun** (`a16z-speedrun-talent`, #2231) — der board-weite JSON-Feed des a16z-Speedrun-*Talent-Netzwerks*. Host-gepinnt auf `speedrun-talent-network.com`, nur HTTPS, 0-indizierte Paginierung mit Seitenobergrenze, Per-Firma-`q`/Konfigurations-Threading, fail-soft.
  - **Cryptocurrency Jobs** (`cryptocurrencyjobs`) — das Web3-Jobportal `cryptocurrencyjobs.co`, eingelesen über seinen öffentlichen RSS-2.0-Feed (ohne Auth). Zweistufige XML-Entity-Dekodierung, ausschließlich Remote-Angebote, Arbeitgeber aus dem Titel-Suffix `"… at <Company>"` geparst.
  - Die Registry umfasst nun insgesamt **72 Quellen = 67 englische + 5 russische** (`ALL_ADAPTERS` = 67 englische Portal-Adapter).

### Behoben
- **`echojobs` — Hybrid-Stellen bleiben von Remote unterscheidbar** (spiegelt Parent #2258). Ein case-insensitiver `hybrid`-Marker liefert nun `"<Stadt> · Hybrid"` (oder ein bloßes `Hybrid`, wenn keine Stadt vorhanden ist) sowie `workplaceType: 'Hybrid'`, statt in `Remote` zusammengefasst zu werden.
- **`radancy` — Legacy-TalentBrew-Markup + JSON-Ergebnisfragment-Transport** (spiegelt Parent a3e6df9), abgesichert über ein injizierbares `opts.fetchJson`.

### Hinweise
- **Nicht portiert — nur CLI-seitige Funktionen des Elternprojekts.** Die umfangreiche CLI-/Modus-Fläche von career-ops v1.24.0 bleibt außerhalb von web-ui, da dieses eine Ansicht + dünner Write-Through ist, kein Modus-Host: die Compliance-/Zuständigkeits-Tabellen, das Kontakte-Telefonbuch + vCard, Interview-Transkript-Debriefing/Call-Plattform-Erkennung, Ledger-Statuswechsel, Ergebnis-Erfassung, zweistufige Triage, jd-similarity, das versionierte CV-Artefakt-Schema der Bewerbung, die Playwright-MCP-Erkennung von doctor sowie `portals/fix-slugs.mjs`. Scan-Orchestrierungsänderungen, die in `scan.mjs` des Elternprojekts leben — der Interamt.de-Playwright-Scanner, die iCIMS-Reverse-ATS-Komplettsuche, der Länder-Eligibility-Remote-Filter, das DNS-Lookup-Pacing, die StepStone-`rltr`-Deduplizierung sowie die normalisierte Firmenspalte im Scan-Verlauf — gelten nicht: web-ui führt die EN-/RU-Scanner in-process aus und ruft `scan.mjs` nicht auf.
- **Bereits abgedeckt.** Der Akzentfaltungs-Fix von `role-matcher` (#2209) wurde bereits in v1.127.0 portiert, ist hier also ein No-op.

## [1.129.1] — 2026-07-29

### Behoben
- **KI-Review-Nachträge zu den Web-Ports aus v1.128/v1.129** (alle beratend, an der Quelle behoben): Level-Präzedenz in `job-facets.js` (ein expliziter Modifikator schlägt nun ein Management-Wort — `Senior Engineering Manager` → `senior`, zuvor `lead`); der Fallback in `states.mjs` wird nicht mehr fixiert (ein erfolgreiches Lesen wird memoisiert, der Fallback ungecacht zurückgegeben — ein beim Boot kurz nicht verfügbares Elternprojekt wird beim nächsten Aufruf neu gelesen) + `console.warn` bei einer vorhandenen, aber fehlerhaften Datei; `score-tone.js` — eine Zeile ohne Score ist neutral (`muted`), nicht rot; `domainFromName()` überspringt Nicht-ASCII-Slugs vor `/api/logo`; +ein Isolations-Guard in `tests/states.test.mjs`. +4 Tests → **2073**.

## [1.129.0] — 2026-07-29

### Hinzugefügt
- **Level-Facette + Alter-Spalte auf `#/scan`** — die in v1.128.0 gelieferte `job-facets.js`-Lib ist nun an die Scan-UI angebunden (zuvor nur Logik). Ein neues **Level**-Dropdown ordnet den Titel jeder Stelle in lead/staff/senior/mid/junior/praktikant ein (`JobFacets.seniorityFromTitle`) und füllt sich aus dem, was tatsächlich in den Ergebnissen steht (wie die Land-Facette); Titel ohne Level-Wort passieren immer. Bleibt in gespeicherten Suchen, Zurücksetzen und Anwenden erhalten. Die Tabelle erhält eine **Level**-Badge-Spalte und eine token-freie **Alter**-Spalte (`heute` / `Nd`, aus `JobFacets.daysSince`). 12 i18n-Schlüssel ×17, +3 Tests → **2069**.

## [1.128.0] — 2026-07-29

### Hinzugefügt
- **Vier Lösungen aus der eigenen Web-App des Elternprojekts (`../web/`, Next.js) portiert**, in Vanilla-JS/ESM neu implementiert, ohne neue Abhängigkeiten: (1) `server/lib/states.mjs` liest `templates/states.yml` live als kanonisches Status-Vokabular des Trackers (CI-Fallback) — beseitigt die manuelle Whitelist-Resync pro Release; POST faltet Aliase (Spanisch/Legacy) auf das kanonische Label, der GET-Funnel bucketet nach kanonischem Status; (2) Firmenlogos in ATS-gehosteten Zeilen via `domainFromName()` (~90 Marke→Domain); (3) `score-tone.js` — 4-stufiger Score-Ton (≥4.2/3.8/3.0 + Buchstaben-Fallback); (4) `job-facets.js` — seniority/source/days-Facetten. +21 Tests.

### Hinweise
- Nicht portiert (nur Konzept): die agentische Aktionsschicht des Elternprojekts (`actions/registry.ts` + `api/assistant/route.ts`) — Blaupause, falls `docs-fab` vom Hilfe-Chat zum Co-Piloten wird. Keine neuen Quellen (Registry **70**), keine i18n/Help-Änderungen.

## [1.127.0] — 2026-07-29

### Hinzugefügt
- **Drei neue Scan-Quellen (career-ops v1.23.0-Parität)** — das Registry führt nun **70 Adapter (65 EN + 5 RU)**: **Flowxtra** (board-weiter Aggregator ohne Auth), **VDAB** (Keyword-API des flämischen Arbeitsdienstes) und **iCIMS** (`careers-<tenant>.icims.com`-Portale, getrennt von `jibeapply`). Zudem kehrt **Cursor** ins CLI-Roster zurück (parent #2115): `cli-detect` erkennt jetzt `cursor` (**10 Werkzeuge**), Roster in help/README/config ×17 wiederhergestellt.

### Behoben
- **agenticjobs** wechselte vom HTML-Scraping zur REST-API (#2167); **Greenhouse** holt die Stadt aus `/offices`, wenn `location.name` nur ein Arbeitsmodell ist (#2104); **role-matcher**-Parität (#1933/#2164/#2009: MTS-Präfix, `product`-Baseline, Akzentfaltung, Sub-Baseline-Uneinigkeit).

### Hinweise
- **Nicht portiert.** Der Großteil von v1.23.0 ist CLI/Dashboard-Fläche, die web-ui nicht nutzt (batch-tailor, discover-ats, NL/PT-Modi, PDF-Themes, Go-Dashboard, updater/doctor); Relay-Skripte unverändert. VERSION des Elternprojekts → **1.23.0**.

## [1.126.1] — 2026-07-25

### Behoben
- **Zwei CLI-Roster-Drift-Stellen, die der v1.126.0-Resync übersah** — (1) das Intro des **API keys**-Tabs in `#/config` (`config.providerModelNote`, i18n ×17) listete nur 7 CLIs — **Antigravity** und **Grok Build** werden nun nach OpenCode eingefügt; (2) eine zweite Vergleichstabellen-Zeile im Hilfe-Guide (×17) und das im CI gebaute Site-Help zeigten weiterhin `Inside Claude Code / Codex / Cursor / Gemini CLI` — das veraltete Set mit **Cursor** — jetzt das vollständige Roster. Beide nutzten Schrägstrich-/Mittelpunkt-Trenner, die die Muster des v1.126.0-Sweeps nicht abdeckten. i18n-Snapshot neu generiert; Suite bleibt bei **1969**.

## [1.126.0] — 2026-07-25

### Hinzugefügt
- **Der Tab „AI CLI tools" erkennt jetzt alle 8 erstklassigen career-ops-CLIs** — das `#/config`-Roster wurde mit `docs/SUPPORTED_CLIS.md` des Elternprojekts synchronisiert: `server/lib/routes/cli-detect.mjs` erhält **Grok Build CLI** (`grok`) und **Kimi CLI** (`kimi`), und Antigravity prüft nun zuerst seine kanonische Binärdatei `agy`. Der schreibgeschützte PATH-Scan meldet jetzt **9 Werkzeuge**; er führt eine gefundene Binärdatei weiterhin nie aus.

### Geändert
- **Dokumentations-Resync mit career-ops.org/docs** — jede Doku-Fläche wurde mit den Live-Seiten des Elternprojekts abgeglichen (alle 31 gelesen). Das kanonische KI-Assistenten-Roster (help ×17 + README ×17) listet nun die 8 erstklassigen CLIs — Claude Code, Codex, OpenCode, Antigravity CLI, Grok Build CLI, Qwen Code, Kimi, GitHub Copilot CLI — plus Gemini CLI (Legacy-Wrapper). Die Hilfe-Bundles behalten ihre 29 H2 / 105 H3-Struktur.

## [1.125.4] — 2026-07-23

### Geändert
- **site-Abhängigkeiten** (dependabot #151–#153) — `sharp` 0.34.5→0.35.3, `svgo` 4.0.1→4.0.2, `fast-uri` (dev) 3.1.3→3.1.4 in `site/`; Astro-Build grün, keine Auswirkung auf SPA/Server.

### Hinweise
- **Paritäts-Sweep des Elternprojekts (career-ops `37d17ec..254764a`, nach v1.22.0)** — nichts zu portieren: der Falsche-Zeile-Guard in `set-status` (#2108) ist reine CLI (in web-ui werden Tracker-Zeilen explizit in der UI ausgewählt, und keine Route ruft `set-status.mjs` auf), das Risk Summary der lokalisierten Modi (#2109) betrifft `modes/<lang>/`-Dateien, die web-ui nie liest (nur Top-Level-`modes/*.md`), die Manifest-Verifikation in `update-system` (#2111) betrifft nur den Updater, und der Rest ist Eltern-Doku (türkisches README, SIGNATURES ×4, SCRIPTS.md, es-Akzente). Das VERSION des Elternprojekts bleibt **1.22.0** — `parentVersion` unverändert.

## [1.125.3] — 2026-07-23

### Behoben
- **LLM-Prompts auf Dänisch und Hindi antworteten auf Englisch** (von Nutzern gemeldet) — `LOCALE_NAMES` und alle fünf `SCAFFOLD_STRINGS`-Blöcke in `server/lib/prompts.mjs` wurden nie um `da` und `hi` erweitert, sodass `resolveLocale()` auf `en` zurückfiel und jeder KI-Prompt — Deep Research (live und manuell), Modi, Bewertung, Interview, Networking, CV Studio — seine `# Output language`-Direktive in diesen beiden Sprachen verlor. Beide sind jetzt vollwertig: Sprachdirektive + lokalisiertes Gerüst. Das Regressions-Gate in `tests/locale-scaffold.test.mjs` durchläuft nun die kanonische Liste mit 17 Locales statt fest codierter 12, und ein neues strukturelles Paritäts-Gate lässt jeden Gerüstschlüssel durchfallen, der auf Englisch zurückfällt — eine künftige Locale, die `prompts.mjs` auslässt, kann nicht mehr ausgeliefert werden (+12 Tests, Suite jetzt **1969**).

## [1.125.2] — 2026-07-22

### Behoben
- **Deep Research über Gemini: HTTP 502 (`MALFORMED_FUNCTION_CALL`)** (#145, beigetragen von [@Alien10140](https://github.com/Alien10140)) — der Live-Prompt von `/api/deep` wies das Modell an, „Use WebFetch / WebSearch" zu nutzen und den Brief in eine Datei zu speichern, doch Headless-API-Anbieter haben keinen Tool-Kanal; Gemini antwortete mit einem Funktionsaufruf statt Text, was sich als leerer HTTP 502 zeigte. `buildDeepPrompt` und `bundleProjectContext` erhalten ein `headless`-Flag: Live-Läufe (Anthropic/Gemini/Fallback-Kaskade) bekommen einen Prompt ohne Tools, der den Brief aus dem eingebetteten Kontext schreibt, während der Copy-Paste-Prompt für Claude Code seine Tool-Anweisungen behält. +1 Test in `tests/critical-fixes.test.mjs`.

### Geändert
- **Gemini-Standards über das eingestellte `gemini-2.0-flash` hinaus angehoben** (#144, beigetragen von [@Alien10140](https://github.com/Alien10140)) — das Konfigurations-Dropdown, der Server-Fallback in `gemini.mjs` (der stillschweigend vom Hinweis abwich), die OpenRouter-Fallback-Kette, `config.geminiModelHint` ×17 und der Hilfeleitfaden ×17 nennen jetzt einheitlich **`gemini-3.6-flash`**. Das neue Drift-Gate `tests/gemini-default-model.test.mjs` (+5 Tests) pinnt alle Oberflächen auf dasselbe Literal — die Suite umfasst jetzt **1957 Tests**.

## [1.125.1] — 2026-07-21

### Behoben
- **SuccessFactors: Mehrmarken-RMK-Mandanten behalten ihren Markenpfad** (übergeordnetes Projekt #2099, nach v1.22.0) — Holdinggesellschaften, die mehrere erworbene Marken über eine gemeinsam genutzte RMK-Instanz betreiben, unterscheiden diese über ein Pfadsegment (`careers.nemetschek.com/Bluebeam/` vs. `…/Vectorworks/`); der Adapter reduzierte die konfigurierte URL bisher auf ihren Ursprung und scannte dabei stillschweigend nur die Stellenanzeigen der Hauptmarke. Der Endpunkt behält jetzt das Marken-Präfix bei und entfernt nur ein abschließendes `/search/`- oder `/tile-search-results/`-Segment, sodass sich nichts mehr verdoppelt; Mandanten mit nur einer Domain bleiben byte-für-byte unverändert. Neuer exportierter Helfer `resolveTenantBase` + ein portierter Testblock in `tests/sources-successfactors.test.mjs`.

## [1.125.0] — 2026-07-21

### Hinzugefügt
- **cvstart.org: Abschnitt „Job-Quellen" auf der Landing** — ein neuer Abschnitt zwischen den Screenshots und dem Vergleich listet **alle 67 Scanner-Quellen als anklickbare Chips** auf (62 EN-Boards/ATS + die 5 russischen Boards unter einer eigenen Unterüberschrift), jede verlinkt auf die öffentliche Seite der jeweiligen Quelle. Die Liste wird beim Build aus der Live-Adapter-Registry synchronisiert (`sync-assets.mjs` → `facts.sources`), sodass sie nie von der App abweichen kann; eine kuratierte Link-Zuordnung in `Sources.astro` wird durch die neue `tests/site-sources.test.mjs` abgesichert. Die Kopfzeilen-Navigation erhielt einen neuen **Quellen**-Anker; 4 neue Site-i18n-Schlüssel ×17. Außerdem wurde die `inLanguage`-Liste im Landing-JSON-LD behoben, der noch `hi` fehlte.

## [1.124.0] — 2026-07-21

### Hinzugefügt
- **Fünf Scan-Quellen** (Parität mit dem übergeordneten career-ops v1.22.0, #1808/#1572/#2024/#2055) — **Welcome to the Jungle** (board-weite JSON-API), **Agentic Engineering Jobs** (Board für Agentic-/KI-Engineering), **Jobvite** (authentifizierungsfreies Per-Mandant-ATS), **Gem** (Per-Mandant-ATS) und **Alibaba Group** (JSON-API der Karriereseite, Meituan-/Tencent-Muster). Jede ist ein host-fixiertes, CI-isoliertes Quelle-plus-Adapter-Paar; das Register liefert nun **67 Adapter (62 EN + 5 RU)**; der Source-Dropdown-Fallback von `#/scan` und dessen Drift-Gate sind aktualisiert; fünf neue Suiten `tests/sources-{wttj,agenticjobs,jobvite,gem,alibaba}.test.mjs`.

### Behoben
- **Arbeitsagentur: bundesweit ortsunabhängig nur, wenn `homeofficetyp` gleich `VOLLSTAENDIG` ist** (übergeordnetes Projekt #1981) — die Abfrage `homeoffice=nv_true` liefert auch Hybrid-Stellen zurück, daher bestätigt der Remote-Durchlauf nun jeden Treffer in kleinen Batches gegen den Stellendetails-Endpunkt und behandelt Fehler konservativ: Ein Lookup-Fehler behält die echte Stadt der Stelle bei, sodass Standortfilter weiterhin greifen.
- **SmartRecruiters: öffentliche Job-URLs wurden ohne `/postings/` gebildet** (übergeordnetes Projekt #2047) — Links landen jetzt auf der öffentlichen Stellenseite statt auf einem 404 bei Mandanten, deren öffentliche Seite das Segment weglässt.

### Hinweise
- Parität mit dem übergeordneten career-ops v1.22.0 brachte auch CLI-seitige Änderungen, in die die Web-UI nicht hineinshellt oder die sie bereits abdeckt: die zh-CN-CV-Vorlage + PDF-Typografie, den Modus `/expand`, Anbieter-Prompt-Cache-Anpassungen (Gemini/OpenAI/Ollama), die Token-Aufschlüsselung pro Schritt (die Web-UI hat ihre eigene Nutzungsanzeige), die Writer-Lock-Serialisierung des Trackers (die Web-UI leitet Schreibvorgänge seit v1.21 bereits über `withFileLock`), die Scan-CLI-Flags `visa_filter` sowie das absolute Veröffentlichungsdatum (die Web-UI hat ihren eigenen „Veröffentlicht innerhalb"-Altersfilter) sowie das Dedup-Seeding bereits gesehener Quellen (der Web-UI-Scanner führt sein eigenes Scan-Verlauf-Dedup).

## [1.123.0] — 2026-07-17

### Hinzugefügt
- **Oracle-Recruiting-Cloud-Scan-Quelle** (Parität mit dem übergeordneten career-ops v1.21.0, #1929) — die authentifizierungsfreie `recruitingCEJobRequisitions`-REST-API von Oracle-Fusion-/ORC-Karriereseiten (JPMorgan Chase, Oracle, BNY Mellon, American Express, Honeywell, …): host-fixiert auf `*.fa[.<region>][.ocs].oraclecloud.com`, die Site-Nummer wird aus der `careers_url` jedes verfolgten Unternehmens ermittelt, Offset-Paginierung mit einer harten Seitenobergrenze sowie WAF-bewusste, browserähnliche Header. Das Register umfasst nun **62 Adapter (57 EN + 5 RU)**; der Source-Dropdown-Fallback von `#/scan` und dessen Drift-Gate sind aktualisiert; neue CI-isolierte Suite `tests/sources-oraclecloud.test.mjs`.

### Behoben
- **Repost-Detektor: Basistitel bleiben klar von Geschwistern mit spezialisierendem Suffix unterschieden** (übergeordnetes Projekt #1922) — „Senior Analytics Engineer" wird nicht mehr mit „Senior Analytics Engineer, People Analytics" gruppiert: Wenn die Tokens eines Titels eine strikte Teilmenge der Tokens des anderen sind und das zusätzliche Token eine echte Spezialisierung (kein Grundwort) ist, gelten beide als eigenständig postbare Stellenausschreibungen. Repost-Vermerke („(Repost)", „relisted") werden nun als Bedeutungsrauschen stopwortiert. +2 Assertions in `tests/detect-reposts.test.mjs`.

### Hinweise
- Parität mit dem übergeordneten career-ops v1.21.0 brachte auch CLI-seitige Änderungen, in die die Web-UI nicht hineinshellt oder die sie bereits abdeckt: die Warnung bei erneuter Bewerbung beim selben Unternehmen (die Web-UI hat die Re-Apply-Abkühlphase bereits seit v1.84.0), die Cover-Letter-Flags `--format`/`--report`, die Interview-Prompt-Modi für Red-Flags/Panel-Intel/No-Show-E-Mails, Scan-Vertrauenssignale & Portal-Gesundheits-Persistenz (die Web-UI betreibt ihren eigenen In-Process-Scanner mit `trust-validator` und die Portale-Gesundheitsseite) sowie die Statistik-/Gehaltslücken-Erweiterungen (schreibgeschützt und fail-soft weitergereicht).

## [1.122.0] — 2026-07-16

### Hinzugefügt
- **Hindi (हिन्दी) — die 17. Sprache** — vollständiges UI-Wörterbuch (~1.110 Schlüssel), das komplette eingebettete Hilfehandbuch (29 H2 / 105 H3 in Parität), `README.hi.md`, ein neues `CHANGELOG.hi.md` (beginnt bei v1.122.0, nach dem Vorbild von de/it/tr), die cvstart.org-Landing sowie die Seiten Methodik/Lizenz/Changelog/Hilfe, der Sprachumschalter (🇮🇳), die automatische Erkennung der Browsersprache und ein lokalisierter Dashboard-Screenshot. Jedes ×16-Paritätsgate läuft jetzt ×17: i18n-Wörterbuch-Parität + Snapshot, die Hilfe-H2/H3-Gates, CHANGELOG-Parität, das `check-i18n` der Site und der Playwright-Locale-Sweep.

## [1.121.0] — 2026-07-16

### Hinzugefügt
- **cvstart.org: Seiten für Methodik, Lizenz und Changelog** — die Landing hat drei neue Bereiche in allen 16 Sprachen erhalten, neben dem bestehenden Vergleichs-Block: **/methodology/** (das Bewertungsraster mit sechs Dimensionen von 0.0–5.0, der 4.0-Bewerbungsschwellenwert und die Nie-tun-Regeln — eine lokalisierte Zusammenfassung von [career-ops.org/methodology](https://career-ops.org/methodology)), **/license/** (der kanonische MIT-Text mit Verweis auf NOTICE.md) und **/changelog/** (diese Datei, pro Locale aus den 16 übersetzten CHANGELOGs des Repositorys gerendert). Neuer Header-Eintrag **Methodik** und Footer-Links unter Ressourcen; `sync-assets.mjs` synchronisiert beim Build jetzt das CHANGELOG ×16 und die LICENSE in die Site, sodass die Seiten nie vom Repository abweichen können.
- **Methodik-Links über die gesamte Doku hinweg** — das README (alle 16 Sprachen), die kanonische Liste in §1 des eingebetteten Hilfehandbuchs (alle 16 Sprachen) und das Wiki verlinken jetzt [career-ops.org/methodology](https://career-ops.org/methodology) (sowie die FAQ und das Glossar) neben den bestehenden [career-ops.org/docs](https://career-ops.org/docs)-Anleitungen.

### Geändert
- README-Versionsbanner und Badges aktualisiert (1850 Tests, Release v1.121.0) — das Banner kündigte noch v1.119.5 an.

## [1.120.0] — 2026-07-16

### Hinzugefügt
- **Das CareerOps-Manifest** (Parität mit Eltern-Version v1.20.0) — das übergeordnete Projekt hat das CareerOps-Manifest (`MANIFESTO.md` · [career-ops.org/manifesto](https://career-ops.org/manifesto)) veröffentlicht und zeigt es jetzt in seinem README, seinem Updater und seinem Go-Dashboard. Die web-ui zieht nach: Ein neuer Link im Footer der Seitenleiste öffnet die Manifest-Seite (neuer i18n-Schlüssel `footer.manifesto` in allen 16 Locales), die eingebettete Hilfe hat in allen 16 Sprachen §29 „Das CareerOps-Manifest" erhalten, das README erklärt, was das Manifest ist und wie man es unterzeichnet, und auch der Footer der cvstart.org-Landing verlinkt darauf.

### Hinweise
- Eltern-Version v1.20.0 hat außerdem die Unterdrückung bekannter Fähigkeiten im `upskill`-Zielmodus behoben, dotenv stummgeschaltet, damit die Standardausgabe von `scan --json` parsebar bleibt, und die HTML-CV-Vorlage so korrigiert, dass eine Rollenüberschrift bei ihren Aufzählungspunkten bleibt — CLI-seitige Oberflächen, in die die web-ui nicht hineinshellt; an der web-ui war keine Codeänderung nötig.

## [1.119.5] — 2026-07-13

### Behoben
- **Der Sprachbutton der Landing bricht nicht mehr um** — mit den Flaggen aus v1.119.2 konnte das Switcher-Label im Header (z. B. «🇷🇺 Русский») bei schmalen Desktop-Breiten auf bis zu drei Zeilen umbrechen; das Switcher-Label und alle Dropdown-Optionen sind jetzt `whitespace-nowrap` — Flagge + Endonym bleiben auf einer Zeile. Die Sprachliste im Footer wechselte vom starren Zwei-Spalten-Raster zu einer umbruchfähigen Reihe einzeiliger Einträge — auch «🇧🇷 Português (Brasil)» bricht nicht mehr mitten im Namen um.

## [1.119.4] — 2026-07-13

### Geändert
- **LICENSE nennt den Autor** — die Copyright-Zeile lautet jetzt: *Sergei Emelianov (Fighter90) <https://sergey-cv.com> and career-ops-ui contributors* (kanonischer MIT-Text unangetastet). Eine neue **NOTICE.md** schlüsselt die Lizenzierung im Detail auf: wer das Copyright hält, was der MIT-Grant genau abdeckt (Code, Doku, Übersetzungen, Landing, Wiki), was NICHT abgedeckt ist (deine Laufzeitdaten, das Elternprojekt, Jobbörsen-Inhalte, Marken), die Tabelle der Drittkomponenten (express/js-yaml — MIT; Astro/Tailwind — MIT; die Schriften Figtree und JetBrains Mono — SIL OFL 1.1; sharp — Apache-2.0) und eine optionale Attributionszeile.

## [1.119.3] — 2026-07-13

### Hinzugefügt
- **SECURITY.md** — die Security-Policy, auf die CONTRIBUTING verwies, existiert jetzt: unterstützte Versionen, privater Meldeprozess (GitHubs **private vulnerability reporting** ist im Repo jetzt **aktiviert** — Security-Tab → „Report a vulnerability"), das Bedrohungsmodell einer localhost-gebundenen Einzelnutzer-App (im Scope: XSS über feindliche Stellenanzeigen / SSRF / Path Traversal / Secret-Leaks / CSP-Schwächung; außerhalb: DoS gegen den eigenen localhost und Probleme des Elternprojekts) und die Hardening-Baseline für Reviewer.

## [1.119.2] — 2026-07-13

### Hinzugefügt
- **CONTRIBUTING.md** — der Contributor-Guide, auf den Landing und README schon immer verlinkt haben, existiert jetzt: Setup, Projektkarte, die harten Security-/No-Build-Regeln, Test-Ebenen, der Zwei-Registries-Walkthrough zum Hinzufügen einer Scan-Quelle, der ×16-i18n-Vertrag, Commit-/PR-Konventionen und der Release-Prozess.
- **Sprachflaggen auf der Landing** — der Sprachumschalter von cvstart.org, das Sprachraster im Footer und das „In deiner Sprache lesen"-Banner zeigen jetzt die Flagge jeder Locale neben ihrem Endonym (dasselbe Regionalindikator-Set wie das Sprach-`<select>` der App; degradiert zu Regionsbuchstaben, wo Flaggen-Glyphen fehlen).
- **Landing-Footer-Fixes** — der tote Discussions-Link (Feature im Repo nicht aktiviert) zeigt jetzt auf das Projekt-**Wiki**, und der Footer nennt den Autor: **Sergei Emelianov** ([sergey-cv.com](https://sergey-cv.com/) · [LinkedIn](https://www.linkedin.com/in/sergey-emelyanov-in-job/)).

## [1.119.1] — 2026-07-13

### Behoben
- **Der Quellen-Filter auf `#/scan` hat die Registry eingeholt** — die statische `FALLBACK_SOURCES`-Liste hinter dem Source-Dropdown (nur genutzt, wenn `GET /api/scan/sources` unerreichbar ist) hinkte seit v1.87.0 still hinterher: 20 Provider fehlten im Offline-Fallback (Amazon, Avature, SAP SuccessFactors, Get on Board, Dassault Systèmes, beesite, HigherEdJobs, JibeApply (iCIMS), softgarden, Cornerstone, Phenom, Radancy, Deutsche Bahn, EchoJobs, TKMS, Heckler & Koch, Rheinmetall, LaraJobs und die neuen Meituan / Tencent). Auf alle **61** synchronisiert und jetzt durch einen Drift-Test abgesichert, der die CI fehlschlagen lässt, sobald die Client-Liste von der Server-Registry abweicht (Werte UND Labels). +1 Test (**1845**).

## [1.119.0] — 2026-07-13

Parität mit dem übergeordneten career-ops **v1.19.0** + Refresh der cvstart.org-Landing.

### Hinzugefügt
- **2 neue Scan-Provider** — Meituan (`zhaopin.meituan.com`) und Tencent (`careers.tencent.com`): die öffentlichen JSON-APIs der chinesischen Tech-Boards ohne Auth, per Host erkannt oder über ein explizites `provider:` gewählt, mit serverseitiger Suche pro Keyword, Paginierung und URL-Deduplizierung — jetzt **61 Adapter** (56 EN + 5 RU). +20 Tests (**1844**).
- **Mitwirkenden-Block auf der Landing** — cvstart.org zeigt die Avatare aller, die Code beigetragen haben (GitHub-API `/contributors` zur Build-Zeit, Bots gefiltert), lokalisiert in allen 16 Sprachen, mit Link auf den vollständigen Contributors-Graph.
- **Live-GitHub-Sterne-Zähler auf der Landing** — das Header-Badge aktualisiert sich jetzt clientseitig bei jedem Besuch aus der GitHub-API (der Build-Schnappschuss bleibt als Fallback), und ein wöchentlich geplanter Pages-Rebuild hält Schnappschuss + Mitwirkendenliste frisch; die API-Aufrufe in CI sind token-authentifiziert.

### Behoben
- **Workday-CXS-Anfragen tragen Browser-Header** (Parent #1813) — Cloudflare-geschützte Tenants (live gesehen: geico) antworten mit 500 auf Anfragen ohne gewöhnliche UA/`accept-language`/`origin`/`referer`; der Fetcher leitet Origin + Site-Slug jetzt aus der CXS-URL selbst ab. Glints-Anfragen erhielten denselben Browser-UA + origin/referer, beide aus der gemeinsamen Konstante `BROWSER_LIKE_USER_AGENT` in `http-json.mjs`.

## [1.118.4] — 2026-07-10

### Behoben
- **hh.ru-Scans lieferten von einer russischen IP 0 Treffer (Links auf Regional-Subdomain)** — von einer russischen Residential-IP leitet hh.ru die Suche per 302 auf eine regionale Subdomain (`sochi.hh.ru`, `spb.hh.ru`, …) um und liefert die Vakanz-Links auf dieser Subdomain. Der Parser suchte den Titel-Link am fest verdrahteten Host `https://hh.ru/vacancy/` und traf **keinen** der regionalen — ein voll funktionierender Scan verbuchte stillschweigend 0. Er akzeptiert jetzt jeden `*.hh.ru`-Host (Anzeigen auf `adsrv.hh.ru/click?…` bleiben ausgeschlossen — sie haben keinen `/vacancy/<id>`-Pfad) und kanonisiert jede Ergebnis-URL zurück auf `https://hh.ru/vacancy/<id>`. Live verifiziert: 17 echte Vakanzen werden von einer `sochi.hh.ru`-Seite geparst, die zuvor 0 ergab. +1 Test (**1824**).

## [1.118.3] — 2026-07-10

### Behoben
- **hh.ru lieferte stillschweigend 0 Treffer (VPN-Check-Interstitial)** — hh.ru leitet Netzwerke, die es als VPN/Proxy einstuft (Datacenter-IPs), jetzt per 302 auf ein Interstitial `/vpncheeck` (“VPN мешает работе сайта”) um, das **HTTP 200** ohne eine einzige Vakanz-Karte liefert — der Scan meldete daher 0 ganz ohne Fehler. Der Scanner erkennt die Umleitung nun an der finalen URL der Antwort, deaktiviert hh.ru für den Rest des Laufs und gibt einen ehrlichen Hinweis aus: Der Traffic muss wirklich über eine Residential-IP hinausgehen — ein systemweiter VPN/Proxy kann aktiv bleiben, auch wenn der Browser-Schalter aus ist. +1 Test (**1823**).

## [1.118.2] — 2026-07-10

### Wartung
- **Landing-Nacharbeit (#118)** — `site/README.md` mit Astro 7 abgeglichen (das Sicherheits-Upgrade aus #116), ungenutzten Import entfernt und **+4 ausführbare Wächter** für die Build-Skripte des Landings: das i18n-Paritäts-Gate scheitert nachweislich an einem kaputten Wörterbuch, und `sync-assets` schreibt nie außerhalb von `site/` — Suite **1822**. Zwei CodeQL-Meldungen erledigt (eine an der Quelle behoben, eine als beabsichtigtes Build-Verhalten verworfen).

## [1.118.1] — 2026-07-10

### Behoben
- **hh.ru-Scans außerhalb Russlands** — hh.ru liefert auf den öffentlichen Suchseiten jetzt **HTTP 451** (regionale rechtliche Sperre) an nicht-russische IPs. Der Scanner behandelt 451 wie 403: Nach der ersten Sperre wird hh.ru für den Rest des Laufs deaktiviert, mit einer ehrlichen Logzeile, die auf eine russische IP / einen VPN-Exit verweist — die verbleibenden Abfragen und die übrigen RU-Quellen werden nicht verschwendet. Hilfe §7 in allen 16 Sprachen aktualisiert. +1 Test (**1818**).

## [1.118.0] — 2026-07-09

Paritätspaket mit dem übergeordneten career-ops **v1.18.0**.

### Hinzugefügt
- **9 neue Scan-Provider** — Cornerstone OnDemand (`csod`), Phenom (`phenom`), Radancy (`radancy`), Deutsche Bahn (`deutschebahn`), EchoJobs (`echojobs`), TKMS (`tkms`), Heckler & Koch (`hecklerkoch`), Rheinmetall (`rheinmetall`), LaraJobs (`larajobs`) — jetzt **54 Adapter**. Der Lever-Adapter erkennt zusätzlich EU-Tenancy-Boards (`jobs.eu.lever.co`).
- **`Hired`-Status im Tracker** (Parität mit der `states.yml` des Parents): angenommene Angebote bekommen einen eigenen kanonischen Status, ein feierliches Badge und ein „Job gelandet”-Banner auf `#/tracker`; Funnel und Conversions zählen ihn als durch alle Stufen fortgeschritten.
- **Gesamt-Tab in `#/stats`** — Read-only-Relay des übergeordneten `stats.mjs` (Gesamtübersicht des Trackers, kumulierte Funnel-Quoten, Scanner-Gesamtzahlen, Portalabdeckung) plus Vergütungsbeobachtungen aus `salary-gap.mjs` (gewünscht vs. ausgeschrieben vs. tatsächlich, pro Bewerbung). Neue Routen `GET /api/stats/lifetime` und `GET /api/stats/salary-gap` — Zero-Token-Shell-outs, sichere Degradierung `{available:false}` ohne das übergeordnete Projekt.
- 28 neue i18n-Schlüssel in allen 16 Sprachen; Hilfe-Guide §14/§26 in allen Sprachen aktualisiert.

### Tests
- +38 Unit-Tests (drei Provider-Paritäts-Suiten + Relay-/Status-Routen) — insgesamt **1817**.

## [1.117.2] — 2026-07-06

**Leerer-Tracker-Fix für die Paritäts-Shell-outs.** Die Eltern-Skripte beenden sich mit Code 1 und einem strukturierten `{error}`-JSON, wenn der Tracker noch keine Bewerbungen hat; das Kadenz-Board und der Absagemuster-Tab zeigten das als „script-error". Beide Routen reichen es jetzt als gesunden Leerzustand weiter (`available:true, empty:true`), und die UI zeigt ihre ehrliche „noch nichts"-Meldung. Live gegen ein echtes Elternprojekt verifiziert.

Neu: keine.


## [1.117.1] — 2026-07-06

**Härtung von v1.117.0 (CodeQL-Triage).** Die drei Shell-out-Endpunkte (`GET /api/followup`, `POST /api/followup/seed`, `GET /api/stats/patterns`) tragen jetzt den gemeinsamen Per-IP-Limiter (sie starten pro Anfrage einen Kindprozess; no-op auf Loopback). Die URL-Textextraktion von „Zum CV hinzufügen" entfernt Tags bis zum Fixpunkt und löscht dann jedes verbleibende `<`/`>` — eine beweisbar vollständige Bereinigung für LLM-Prompt-Text. Kein Verhaltensunterschied bei gültiger Eingabe.

Neu: keine.


## [1.117.0] — 2026-07-06

**Eltern-Paritätspaket — sechs Fähigkeiten des übergeordneten career-ops in die UI geholt.** (1) **Kadenz-Board** auf `#/followup`: Dringlichkeit je Bewerbung (🔴/🟠/🟡/🔵) aus `followup-cadence.mjs`, plus **Follow-up-Termine setzen** (`followup-seed.mjs --backfill`). (2) **Absagemuster**: ein vierter Statistik-Tab führt `analyze-patterns.mjs` aus (nur lesend) — Ergebnisverteilung, Empfehlungen, Weiterkommensquote je ATS-Anbieter. (3) **Zum CV hinzufügen**: eine CV-Studio-Karte verwandelt eine URL oder eingefügten Text in ATS-Stichpunkte, die NUR auf dieser Quelle beruhen (nur Vorschläge, keine Schreibvorgänge; der URL-Abruf ist SSRF-geschützt). (4) **4 neue Scan-Anbieter** — beesite, HigherEdJobs (RSS), JibeApply (iCIMS), softgarden — das Register umfasst jetzt **50 Adapter (45 EN + 5 RU)**, alle im Scan-Dropdown. (5) **Disqualifikator-Vorab-Scan** in der Apply-Checkliste. (6) **Reconcile-Runner** (`/api/run/reconcile`). Shell-out-Routen degradieren ehrlich ohne die Eltern-Skripte.

- Neues Routenmodul `server/lib/routes/followup.mjs` (31.) + neue Routen + 8 Source/Adapter-Dateien. Tests: 6 + 7 neu; Suite 1737 → 1750. 41 neue i18n-Schlüssel ×16. Hilfe §13/§17/§24/§26 erweitert ×16.

Neu: `GET /api/followup`, `POST /api/followup/seed`, `GET /api/stats/patterns`, `POST /api/cv-studio/add-entry`, `POST /api/run/reconcile`.


## [1.116.0] — 2026-07-06

**Nutzungsanzeige überarbeitet + erster End-to-End-Widget-Test.** Die KI-Nutzungsanzeige (v1.114.0) ist korrekt fixiert: Sie ist jetzt **unten in der linken Seitenleiste angeheftet** (volle Seitenleistenbreite, gleiche Oberfläche) und reserviert unten Platz in ihrer eigenen Höhe, sodass das **Menü nie verdeckt wird** — Navigation und Versionsfußzeile scrollen stets frei darüber. Sie **aktualisiert live** (alle 15 s, bei Tab-Fokus und Routenwechsel), und jede Fensterzeile zeigt jetzt die echten **`<Tokens> · <geschätzte Kosten>`** (Balken skalieren gegen das 30-Tage-Fenster) statt eines immer-100%-„Anteils". Außerdem: eine dauerhafte `typeof`-Barriere im CV-Importer schließt den wiederkehrenden CodeQL-Type-Confusion-Fehlalarm an der Quelle, und ein neuer Playwright-**End-to-End-Test** fährt beide dauerhaften Widgets in einem echten Browser.

- `public/js/lib/usage-hud.js` + `app.css`, `server/lib/cv-import.mjs`. Tests: `tests/playwright-widgets.mjs` (2 E2E) + `tests/usage-hud.test.mjs` (10). Hilfe §6 erweitert ×16.

Neu: keine.


## [1.115.0] — 2026-07-06

**Design-Feinschliff (konservativ, Korallen-Marke beibehalten).** Ein leichter Verfeinerungsdurchgang über das gemeinsame Designsystem — keine Umstrukturierung, keine Palettenänderung. Die Metrikkarten des Dashboards heben sich jetzt beim Hover an und erhalten einen korallenen Rand (wie die Schnellaktions-Kacheln); Inhaltskarten heben sich minimal; primary / dark / danger-Buttons erhalten einen Ruheschatten und ein sanftes Hover-Anheben für Tiefe; große Zahlen richten sich per tabular-nums aus; und interaktive Steuerelemente bekommen einen weichen Korallen-Fokus-Halo hinter dem klaren 2px-Tastaturring. Alle Bewegung respektiert `prefers-reduced-motion`, und der Halo ist auf Steuerelemente beschränkt — nie ein globales `*:focus-visible`.

- Nur CSS (`public/css/app.css`); keine Änderungen an Markup, i18n, Routen oder CSP. Tests: `tests/design-polish-v1115.test.mjs` (5). Live mit Playwright verifiziert.

Neu: keine.


## [1.114.0] — 2026-07-06

**KI-Nutzungs- und Kostenanzeige in der Seitenleiste (unten links).** Ein kompakter **NUTZUNG**-Abschnitt sitzt jetzt unten in der Seitenleiste (eine feste Karte unten links, wenn keine Seitenleiste vorhanden ist; unten rechts bei RTL) auf jeder Seite. Er zeigt deine LLM-Token-Nutzung über **24h / 7T / 30T**-Fenster — jeweils als `<Tokens> · <Anteil%>` mit einem grünen Balken (Anteil an der Gesamtzeit) — plus eine Fußzeile mit den geschätzten 24h-Kosten. Die Daten sind die schreibgeschützte `GET /api/usage`-Zusammenfassung von `data/llm-usage.jsonl` (nur lokal), dieselbe Quelle wie die Seite `#/usage`; die Kosten sind eine Schätzung, und Manuell-Modus-Läufe sind kostenlos und werden nicht gezählt. Einklappbar — die Kopfzeile schaltet um und der Zustand bleibt erhalten.

- Neues Client-Widget `public/js/lib/usage-hud.js`, aus `index.html` geladen, in der Seitenleiste über der Versionsfußzeile eingehängt (Fallback: fester Eckplatz). CSP-sicher; themenbewusst + RTL-gespiegelt. Keine neue Serverroute. Tests: `tests/usage-hud.test.mjs` (8). 3 neue i18n-Schlüssel ×16.

Neu: keine.


## [1.113.0] — 2026-07-06

**Schwebender „Hilfe fragen"-Assistent auf jeder Seite.** Eine Gradient-Roboter-Chat-Schaltfläche schwebt jetzt unten rechts (unten links bei RTL) auf jeder Seite. Klicke sie an, um einen kompakten Chat zu öffnen, der Nutzungsfragen AUSSCHLIESSLICH anhand des integrierten Hilfe-Leitfadens in deiner Sprache beantwortet — derselbe Endpunkt wie die Seite `#/docs-assistant` (`POST /api/docs-assistant/ask`), er liest also nie deinen Lebenslauf, dein Profil oder deinen Tracker. Live mit einem LLM-Schlüssel; ohne Schlüssel → ein sofort ausführbarer Prompt. Der Kopf zeigt einen Roboter-Avatar + Online-Status; Chips füllen häufige Fragen; Esc oder Klick außerhalb schließt; auf der Seite `#/docs-assistant` blendet er sich aus.

- Neues Client-Widget `public/js/lib/docs-fab.js`, global aus `index.html` eingebunden; CSP-sicher; themenbewusste + RTL-gespiegelte Stile in `app.css`. Keine neue Serverroute. Tests: `tests/docs-fab.test.mjs` (8). 6 neue i18n-Schlüssel ×16. Hilfe §1 an Ort und Stelle erweitert.

Neu: keine.


## [1.112.0] — 2026-07-06

**Docs- & QA-Konsolidierung.** Keine nutzersichtbare Codeänderung. Das SDD-Konventionsdokument (`docs/sdd/CONVENTIONS.md`) wird auf die aktuellen **30 Route-Module** (vorher 24) und die aktuelle Testbasis aktualisiert; der maßgebliche projektweite QA-Prompt (`qa/QA-REGRESSION-PROMPT.md`) wird konsolidiert — Release-Mechanik entstaubt (v1.111, parentVersion 1.17.0, durch das Release-Ereignis ausgelöste Veröffentlichung), die §14-Ergänzungstabelle korrigiert (Scan-Ausschluss auf v1.109.0 umetikettiert) und um den v1.111-CodeQL-Abschluss erweitert — sodass er als einziger Regressions-Prompt für die gesamte Funktionalität allein steht. Fügt einen Abdeckungstest für den Zweig übergroßer Uploads hinzu.

Neu: keine.


## [1.111.0] — 2026-07-06

**Sicherheit — Abschluss des CodeQL-Backlogs.** Drei Defense-in-Depth-Härtungen, die die verbleibenden Befunde der statischen Analyse an der Quelle schließen, statt sie zu verwerfen. `stripDangerousMarkdown` escapt jetzt das `<` jeder *abgeschnittenen* gefährlichen Tag-Öffnung (eine Payload, die auf `<script`/`<iframe`/… endet), sodass ihre Ausgabe beweisbar kein lebendes gefährliches Tag enthält. Der CV-Import liest die Größe des hochgeladenen Puffers über eine explizite `Number()`-Konvertierung — eine Barriere gegen Typverwechslung. Modus-Rollenzeilen sind jetzt Vorlagen-**Strings**, die mit `String.replace` interpoliert werden, statt gespeicherter Funktionen, was den dynamischen Dispatch-Aufruf vollständig entfernt. Keine für Nutzer sichtbare Verhaltensänderung.

- `server/lib/security.mjs`, `server/lib/cv-import.mjs`, `server/lib/prompts.mjs`. Tests: `tests/security-hardening-v1111.test.mjs` (7) + aktualisierter v1108-Wächtertest. Keine i18n-/Hilfe-/Routen-Änderungen.

Neu: keine.


## [1.110.0] — 2026-07-06

**Docs- & QA-Auffrischung (alle Sprachen).** Keine Codeänderung. Der Gesamtprojekt-QA-Prompt ist auf v1.109.0 aktualisiert mit einem neuen §14 (v1.98→v1.109), und die immerwährenden UX-Audit- und Design-Export-Prompts haben die aktuelle Seitenfläche erhalten. Jeder in v1.100–v1.109 hinzugefügte Hilfe-Absatz ist jetzt in **alle 16 Sprachen** übersetzt.

Neu: keine.


## [1.109.0] — 2026-07-06

**Scan-Ausschlussfilter + Pipeline-Überblick (Web-Layout-Parität).** Auf `#/scan` behandelt das **Suchen**-Feld Kommas jetzt als **ODER** ("zu findende Rollen"), und ein neues **Ausschließen**-Feld blendet jede Zeile aus, deren Firma/Rolle/Ort eines der kommagetrennten Wörter enthält (z. B. `senior, staff`); beide werden von deinen gespeicherten Suchen behalten. Auf `#/pipeline` zeigt ein kompakter **Überblicksstreifen** deine Pipeline auf einen Blick — **N im Eingang**, **N verfolgt** und die **Applied / Responded / Interview / Offer**-Zahlen aus dem Tracker, jeder Chip verlinkt auf `#/tracker`.

- Nur Client (keine neue Route/Schreibvorgänge). `public/js/views/scan.js` + `public/js/views/pipeline.js`. Tests: `tests/scan-pipeline-ui-v1109.test.mjs` (2). 4 neue i18n-Schlüssel ×16. Hilfe §7 + §8 an Ort und Stelle erweitert.

Neu: keine.


## [1.108.0] — 2026-07-06

**Sicherheitshärtung (CodeQL-Triage, Runde 2).** Drei weitere Funde geringer Schwere behoben: der Prompt-Builder löst die Locale-Rollenzeile über **eigenen Schlüssel + `typeof === function`** auf, sodass eine manipulierte Locale nicht an eine Prototyp-Methode dispatchen kann (unvalidated-dynamic-method-call); der PDF-Dateinamen-Slug wird **vor dem Regex auf 200 Zeichen begrenzt**, sodass eine reine Bindestrich-Eingabe nicht backtrackt (polynomialer ReDoS); und der Dokumentimport **zwingt einen Array-`filename`** (wiederholter Header) zu einem String (type-confusion). Kein Verhaltenswechsel bei gültigem Input.

- `server/lib/prompts.mjs`, `server/lib/routes/runners.mjs`, `server/lib/cv-import.mjs` + `tests/security-hardening-v1108.test.mjs` (3). Über v1.106–v1.108 sank der Rückstand der statischen Analyse von 167 auf ~14; jeder wirklich sicherheitsrelevante Fund wurde behoben und der Rest (geschützte/bereinigte Fehlalarme + Note-Level-Lint) mit Begründung verworfen.

Neu: keine.


## [1.107.0] — 2026-07-06

**Sanitizer-Härtung (XSS-Verteidigung in der Tiefe im Ruhezustand).** `stripDangerousMarkdown` — das gefährliches HTML im gespeicherten Lebenslauf-/Stellen-Markdown neutralisiert, damit jeder Konsument, der den Escape-beim-Rendern-Client umgeht, sicher bleibt — führt sein Tag-Stripping jetzt **bis zu einem Fixpunkt** aus (bis stabil wiederholen), sodass ein Entfernen, das eine Payload *neu bildet* (z. B. `<scr<script></script>ipt>`), erfasst wird, script/style-Endtags **mit nachfolgendem Müll** (`</script foo>`) trifft und einen **ungeschlossenen** ausführbaren Opener (`<script …>`) entfernt. Verhalten für gültiges Markdown unverändert — es entfernt nur mehr.

- `server/lib/security.mjs`: Fixpunkt-Schleife (auf 8 Durchläufe begrenzt) + `[^>]*>`-Endtag-Muster + Entfernung ungeschlossener Opener. +3 Regressionsfälle in `tests/cv-xss-bypasses.test.mjs`. Die maßgebliche XSS-Grenze bleibt Ausgabe-Escaping (`UI.md`); dies stärkt die Ruhe-Garantie und schließt die entsprechenden CodeQL-Funde.

Neu: keine.


## [1.106.0] — 2026-07-06

**Sicherheitshärtung (CodeQL-Triage).** Drei echte (wenn auch geringfügige) Funde nach einem Durchgang durch den Rückstand der statischen Analyse behoben: der Fehlerpfad des Routen-Renderings **escaped jetzt die Fehlermeldung**, bevor sie das DOM erreicht (ein Serverfehler kann Nutzereingaben widerspiegeln, wird also als nicht vertrauenswürdig behandelt — XSS-Grenze), und die Profil-/Config-Eigenschaftsschreibvorgänge **weisen `__proto__` / `constructor` / `prototype`-Schlüssel ab** (Prototype-Pollution-Schutz zur Sicherheit — die Schlüssel stammen aus festen Feld-Specs, nicht aus rohem Request-Input). Der Großteil der übrigen Warnungen sind Fehlalarme auf die legitimen `data/*`-Lese-/Schreibvorgänge des Scanners und auf Routen, die bereits den eigenen Limiter tragen; mit Begründung verworfen.

- `public/js/router.js` escaped `err.message` via `UI.escapeHtml` vor `innerHTML`; `server/lib/routes/content.mjs` und `server/lib/routes/config.mjs` schützen Prototype-Schlüssel. Kein Verhaltenswechsel bei gültigem Input. Tests: `tests/security-hardening-v1106.test.mjs` (3). Keine neuen i18n-Schlüssel.

Neu: keine.


## [1.105.0] — 2026-07-06

**KI-Nutzungs- und Kostenseite.** Eine neue **KI-Nutzung**-Seite (Seitenleiste, neben Zustand) zeigt, wie viele Tokens du für **Live**-KI-Generierungen — Bewertungen, Berichte, Chats — ausgegeben hast, aufgeschlüsselt **pro Anbieter** über die letzten 24 Stunden, 7 Tage, 30 Tage und die gesamte Zeit, mit **geschätzten USD**-Kosten. Jeder Live-Aufruf hängt einen kleinen `{provider, in, out}`-Datensatz an `data/llm-usage.jsonl` an (nichts wird irgendwohin gesendet); Läufe ohne Schlüssel (manueller Modus) kosten nichts und werden nicht erfasst.

- Neues Routenmodul (das 30.) `server/lib/routes/usage.mjs` — `GET /api/usage` (schreibgeschützte Rollups) + `server/lib/llm-usage.mjs` (`recordUsage` normalisiert die Anthropic/OpenAI/Gemini-Nutzungsformen und hängt best-effort an; `readUsage`/`aggregate` rollen pro Fenster 24h/7T/30T/gesamt × Anbieter auf) + `server/lib/llm-pricing.mjs` (eine **bearbeitbare** Anbieter-Preistabelle `$/1M` Tokens — Tokens sind exakt, Dollar sind ungefähre Listenpreise, die du korrigieren kannst; nie abgerechnet). Die Erfassung ist an den Dispatch-Punkten (`runActiveProvider` + `routes/llm.mjs`) eingehängt.
- Neue Ansicht `public/js/views/usage.js` (`#/usage`, Fenster-Tabs). Tests: `tests/usage-routes.test.mjs`. 17 neue i18n-Schlüssel ×16 (`usage.*` + `nav.usage`). Hilfe §6 an Ort und Stelle erweitert.

Neu: `server/lib/routes/usage.mjs`; `server/lib/llm-usage.mjs`; `server/lib/llm-pricing.mjs`; `public/js/views/usage.js`.


## [1.104.0] — 2026-07-06

**Firmenlogos in der Scan-Tabelle (datenschutzfreundlich).** Ein neuer **Darstellung**-Schalter in den **App-Einstellungen** — **Firmenlogos in der Scan-Tabelle anzeigen** (standardmäßig aus) — zeichnet das Logo jeder Firma neben ihren Namen auf `#/scan`. Das Logo ist das **von der eigenen Domain der Firma geholte Favicon**, serverseitig weitergeleitet (`GET /api/logo`), sodass **kein Drittanbieter-Logodienst erfährt, welche Arbeitgeber du dir ansiehst**. Anzeigen auf einer gemeinsamen Jobbörse (Greenhouse, Lever, Ashby, …) zeigen ein farbiges **Buchstaben-Badge** statt des Börsen-Icons, und jedes Logo, das nicht lädt, fällt auf dasselbe Badge zurück.

- Neues Routenmodul (das 29.) `server/lib/routes/logos.mjs` — `GET /api/logo?domain=`. Es validiert die Domain (kein Schema/Pfad/Loopback), holt `/favicon.ico` über das **SSRF-sichere `safeGet`** (ein neuer `binary`-Modus liefert die rohen Bytes + content-type; DNS-Pinning, Redirect-Validierung und das Größenlimit bleiben unverändert), führt ein **Bild-Magic-Sniffing** durch, damit eine HTML-Fehlerseite nie als Bild ausgeliefert wird, cached Treffer **und** Misses in einem In-Memory-LRU und **schreibt nichts auf die Festplatte**.
- Neue Client-Lib `public/js/lib/company-logo.js` (`window.CompanyLogo`): standardmäßig aus per localStorage-Flag; überspringt gemeinsame ATS-Hosts zugunsten eines deterministischen Buchstaben-Avatars; CSP-sicherer `img.onerror`-Fallback. Tests: `tests/logo-routes.test.mjs`. 5 neue i18n-Schlüssel ×16 (`appear.*`). Hilfe §2 an Ort und Stelle erweitert.

Neu: `server/lib/routes/logos.mjs`; `public/js/lib/company-logo.js`.


## [1.103.0] — 2026-07-06

**Einstellungen: „KI-CLI-Tools" — welche installiert sind.** career-ops wird von Claude Code angetrieben, funktioniert aber mit jeder Agent-CLI nach dem offenen Skill-Standard. Ein neuer Tab **KI-CLI-Tools** in den **App-Einstellungen** (`#/config`) zeigt, welche davon — Claude Code, Codex, Gemini CLI, OpenCode, GitHub Copilot CLI, Qwen, Antigravity — auf dem Rechner installiert sind, der den Server ausführt, samt ihren Pfaden. Es ist ein **schreibgeschützter PATH-Scan**: er prüft nur, ob das jeweilige Binary existiert, und **führt es nie aus** (kein `--version`, keine Ausführung), schreibt nichts und rührt keine Nutzerdaten an.

- Neues Routenmodul (das 28.) `server/lib/routes/cli-detect.mjs` — `GET /api/cli-detect`. Die Erkennung löst den Pfad eines Binaries aus einer festen 7-Einträge-Allowlist über `process.env.PATH` auf (Windows `.cmd/.exe/.bat`-Shims; POSIX-Execute-Bit); eine feindliche Datei auf dem PATH kann von dieser Route niemals ausgeführt werden.
- Neuer Tab „KI-CLI-Tools" in `public/js/views/config.js` (lazy geladen, deep-linkbar über `#/config?tab=cli`). Tests: `tests/cli-detect-routes.test.mjs`. 8 neue i18n-Schlüssel ×16 (`cli.*` + `config.tabCli`). Hilfe §2 an Ort und Stelle erweitert.

Neu: `server/lib/routes/cli-detect.mjs`.


## [1.102.0] — 2026-07-05

**„Doku fragen" — ein fundierter Chat über den integrierten Hilfe-Leitfaden.** Eine neue Seite **Doku fragen 💬** (Seitenleiste, unter Hilfe): Stell eine Frage wie „Wie scanne ich Job-Portale?" und erhalte eine Antwort, die **nur** aus dem eigenen Hilfe-Leitfaden der App in deiner Sprache stammt — sie zeigt die verwendeten Abschnitte und **liest nie deinen Lebenslauf, dein Profil oder deine Jobsuche**. Es geht um die Nutzung der App, nicht um dich. Mit einem LLM-Schlüssel antwortet sie live; ohne Schlüssel gibt sie dir einen fertigen Prompt, bereits mit den relevanten Hilfeabschnitten gefüllt.

- Neues Routenmodul (das 27.) `server/lib/routes/docs-assistant.mjs` — `POST /api/docs-assistant/ask`. **Abhängigkeitsfreie Suche:** der Hilfe-Leitfaden deiner Sprache wird in seine `##`-Abschnitte geteilt und nach Schlüsselwort-Überlappung mit deiner Frage bewertet; die besten werden eingebettet, und das Modell muss aus ihnen antworten oder sagen, dass der Leitfaden es nicht abdeckt (keine erfundenen Funktionen/Routen). Gemeinsame Anbieter-Kaskade, manueller Fallback, ratenbegrenzt, **keine Schreibvorgänge**, liest keine Nutzerdaten.
- Neue Ansicht `public/js/views/docs-assistant.js`. Tests: `tests/docs-assistant-routes.test.mjs`. 14 neue i18n-Schlüssel ×16 (`docs.*` + `nav.docsAssistant`). Hilfe §1 an Ort und Stelle erweitert.

Neu: `server/lib/routes/docs-assistant.mjs`; `public/js/views/docs-assistant.js`.


## [1.101.0] — 2026-07-05

**CV Studio: passe deinen Lebenslauf an + schreibe ein Anschreiben für einen bestimmten Job, geprüft durch eine Recruiter-Checkliste.** Neue Karte **An einen Job anpassen** auf `#/cv-studio`: Füge eine Stellenbeschreibung ein (und optional eine Zielrolle/Überschrift), und CV Studio erstellt einen **auf diese Anzeige zugeschnittenen Lebenslauf plus ein passendes Anschreiben** und führt beide vor der Übergabe durch ein **Checklisten-Gate** — `error`s blockieren (werden behoben, bevor du das Ergebnis siehst), `warn`s raten. Die Mechanik ist aus der Karriere-Coaching-Praxis in **generische** Regeln destilliert — ein Recruiter liest in Sekunden, also kommt relevante Erfahrung nach oben, die Überschrift passt zur Rolle der Stelle, Ergebnisse tragen konkrete Zahlen, und das Anschreiben bleibt ein kurzer Teaser mit einer einzigen „Anforderung ↔ dein passender Fakt"-Brücke. Es basiert **nur** auf deinem eigenen Lebenslauf, Profil und Two-Pager und **erfindet nie** — keine hartcodierten Firmen, Rollen oder Historie.

- Neuer Endpunkt `POST /api/cv-studio/tailor` (erweitert das bestehende cv-studio-Modul — kein 27. Modul): `buildTailorPrompt` + ein generisches `TAILOR_INSTRUCTIONS`-Gate, basierend auf `bundleProjectContext`, gemeinsame Anbieter-Kaskade, manueller Fallback ohne Schlüssel, ratenbegrenzt, **keine Schreibvorgänge**. Das Ergebnis wird über die gemeinsame `report-export.js`-Leiste als Markdown / PDF / **DOCX** exportiert.
- Tests: +3 in `tests/cv-studio-routes.test.mjs`. 10 neue i18n-Schlüssel ×16 (`cvs.tailor*`). Generische Referenz `docs/prompts/resume-cover.md`. Hilfe §24 an Ort und Stelle erweitert.

Neu: `docs/prompts/resume-cover.md`.


## [1.100.0] — 2026-07-05

**Two-Pager: KI-Autofüllung aus deinem Lebenslauf + Vorschau + Export als PDF/DOCX/Markdown.** Der Two-Pager (`#/two-pager`) hält fest, was du wirklich von deiner nächsten Rolle willst, doch bisher musste jedes Feld von Hand geschrieben oder ein Prompt in ein anderes Tool kopiert werden. Jetzt läuft der **✨ KI-Ausfüllassistent** live mit deinem konfigurierten Anbieter — er liest *nur* deinen Lebenslauf + dein Profil (über `bundleProjectContext`, nichts erfunden), entwirft alle Felder (wer ich bin / was ich liebe / Must-haves / was ich hasse / Deal-Breaker / Nicht-Verhandelbares / Zielumgebung) und füllt das Formular, damit du prüfen, bearbeiten und speichern kannst. Ohne API-Schlüssel fällt er wie bisher auf das Prompt-kopieren-Modal zurück. Eine neue Schaltfläche **👁 Vorschau und Export** rendert den Two-Pager als formatiertes Dokument mit einer Leiste **.md herunterladen / Als PDF speichern / Als DOCX speichern / Kopieren**.

- **Abhängigkeitsfreier `.docx`-Export.** Neues `server/lib/docx.mjs` erzeugt ein minimales, aber gültiges Office-Open-XML-`.docx` (ein DEFLATE-ZIP der vier OOXML-Teile, CRC-32 pro Eintrag) — ohne neue Laufzeitabhängigkeit (Deps bleiben `express` + `js-yaml`). Neue Route `POST /api/export/docx` (`server/lib/routes/export.mjs`, das 26. Routenmodul; zustandslos, auf 200 KB begrenzt, keine Schreibvorgänge / kein LLM / kein URL-Fetch). In das gemeinsame `public/js/lib/report-export.js` eingebunden, sodass **der Marktbericht, der Karriereplan und die Berufsorientierung ebenfalls DOCX-Export erhalten**.
- Die Live-Autofüllung nutzt die gemeinsame Anbieter-Kaskade (`runActiveProvider` / `providerAvailable`); das zurückgegebene YAML wird geparst und in die begrenzte Two-Pager-Form zurückgezwungen (`parseYamlFields` + `normalizeTwoPager`) — unbekannte Schlüssel verworfen, Arrays/Strings gedeckelt. Manueller Modus bleibt erhalten.
- Tests: `tests/export-routes.test.mjs`. 4 neue i18n-Schlüssel ×16 (`export.saveDocx`, `twoPager.preview`, `twoPager.aiFilling`, `twoPager.aiFilled`).

Neu: `server/lib/docx.mjs`; `server/lib/routes/export.mjs`.


## [1.99.0] — 2026-07-05

**Portal-Gesundheitsseite** (`#/portals`). Der Scanner beobachtet eine Reihe von Firmen in `portals.yml`; ein ATS-Slug kann stillschweigend brechen und dieser Arbeitgeber verschwindet aus jedem künftigen Scan. Die neue **Portals**-Seite listet jede beobachtete Firma und sondiert bei **Check portal health** jede `careers_url` über das DNS-gepinnte `safeGet` (SSRF-sicher) und markiert die toten (ein 404 = still verworfen) — schreibgeschützt. Härtet außerdem den v1.98.0-Fehlermelder nach dem Review: der Fehler-Ringpuffer fängt jetzt Netzwerk-Fetch-Fehler ab, und der Scrubber schwärzt unbeschriftete Anbieterschlüssel.

Neu: `server/lib/routes/portals.mjs`; `public/js/views/portals.js`.


## [1.98.0] — 2026-07-05

**Integrierter Fehlermelder** (Parität mit dem `web-v0.2.0`-Web des Eltern-Projekts). Eine **🐞 Report a bug**-Schaltfläche im Benachrichtigungs-Drawer sammelt einen datenschutzbegrenzten Diagnose-Schnappschuss — Versionen, dein Bildschirm, Browser, eine `/api/health`-Prüfzusammenfassung und die letzten 20 Fehler aus einem neuen clientseitigen Ringpuffer — plus einen deterministischen Dedupe-Fingerabdruck (`co-web-<base36>`), lässt dich das exakte Markdown prüfen und öffnet dann ein vorausgefülltes GitHub-Issue. Nichts wird automatisch eingereicht; es trägt niemals deinen Lebenslauf, dein Profil, Antworten, Job-URLs oder Schlüssel. Neue Libs `logbuf.js` + `bug-report.js`; 11 i18n-Schlüssel ×16; `tests/bug-report.test.mjs`.

Neu: `public/js/lib/logbuf.js`; `public/js/lib/bug-report.js`.


## [1.97.1] — 2026-07-05
### Behoben
- **Review-getriebene Härtung und Dokumentationsparität (Nachtrag zu v1.97.0).** Ein Durchlauf durch die KI-Review-Logs förderte echte Korrekturen zutage:
- **`fit-score.js` (Scan-`◎`-Fit-Badge).** `salaryFloor()` befördert einen unterjährigen Satz nicht mehr zu einem falschen Jahresmindestwert — „at least 500 EUR/day", „$80/hr", „6000 monthly" liefern jetzt `null` statt eines 500k/80k-Ausschlusskriteriums. Der Länderabgleich erfolgt nun auf ganzes Wort (`\b…\b`), sodass „Germany" nicht mehr auf das Adjektiv „German" passt (noch „Nigeria" innerhalb von „Nigerian") und keine falsche Muss-anderswo-Verletzung auslöst. +3 Tests in `tests/fit-score.test.mjs`.
- **Dokumentationsparität.** Jedes lokalisierte README bewirbt nun einheitlich **16 Sprachen** — die Anzahl/Liste der Hilfe-Zeile (×13) sowie die Prosa des Lokalisierungsabschnitts plus die Notiz „füge den Schlüssel zu allen N Dateien hinzu" (×8) standen noch auf den Zählungen vor v1.85 (8/9). Die Adapter-Anzahl der integrierten Hilfe §17 ist auf **46 Adapter — 41 auf Englisch + 5 auf Russisch** über alle 16 Bündel korrigiert.
- Keine Verhaltensänderung über die Fit-Badge-Heuristik hinaus; keine neuen Routen, Schlüssel oder i18n-Ergänzungen.

## [1.97.0] — 2026-07-05
### Hinzugefügt
- **Dassault-Systèmes-Scanner-Quelle + ein Qualitätsdurchlauf an drei Fronten.**
- **Neue Scan-Quelle — Dassault Systèmes (Parität mit dem übergeordneten career-ops, #1498).** `server/lib/sources/dassault.mjs` + `server/lib/portals/adapters/dassault.mjs` spiegeln den token-kostenfreien Exalead-Provider „Kartensuche" des übergeordneten Projekts wider (der öffentliche Feed hinter `3ds.com/careers/jobs`). Es ist ein einziger globaler Endpoint, daher wird er per Provider ausgewählt (`provider: dassault`) oder aus einem `3ds.com`-Host automatisch erkannt, mit dem Host gegen SSRF auf `www.3ds.com` via `redirect:'error'` verankert. Das XML wird ohne DOM geparst (`<Meta>`-Maps pro `<Hit>`), Stadt/Land werden aus dem lokalisierten Kategorie-String gezogen, und Stellenanzeigen werden nur behalten, wenn ihre öffentliche URL auf `*.3ds.com` liegt. Das Registry führt nun **46 Adapter** (41 EN + 5 RU); die `ALL_ADAPTERS`-Zählung sowie die Assertions für sortierte IDs und das EN-Set von `/api/scan/sources` steigen von 40 → 41. Suite `tests/sources-dassault.test.mjs` (10 Fälle).
- **Vom übergeordneten Projekt portierte Robustheitskorrekturen.** Der Avature-Parser toleriert nun zwei Live-Tenant-Markup-Varianten (`article--result` mit einem Positionsindex-Suffix + ein klassenloser JobDetail-Titel-Anker, #1541); Get on Board schützt vor einem `0`/negativen `published_at` (keine unsinnigen 1970er-Daten mehr); SuccessFactors deckelt die letzte Seite, damit sie `MAX_JOBS` nicht überschreiten kann (#1528).
- **Server-Audit-Korrekturen.** `safe-fetch` bleibt bei einer Antwort über dem Limit nicht mehr hängen — der Größenlimit-Pfad löst das Promise nun direkt auf, statt auf ein `'end'`-Event zu warten, das ein zerstörter Stream nie aussendet (behebt Abrufe großer Seiten über `/api/pipeline/preview` + Auto-Pipeline). Das SSE-Aktivitätslogging `stream.*` ist wieder erreichbar (die `/api/stream/`-Prüfung wurde über die pauschale „GET überspringen"-Guard verschoben).
- **SPA-Audit-Korrekturen.** Der Tab-Umschalter von `#/stats` schützt gegen ein asynchrones Render-Race — das Ergebnis eines langsamen Tabs kann einen neueren Tab, zu dem der Nutzer bereits gewechselt hat, nicht mehr überschreiben. Die Lösch-Bestätigungen von Mock-Interview und Networking übergeben nun einen ordentlichen Titel + Text (kein Dialog mit leerem Text mehr).
- **Übersetzungskorrekturen.** Unübersetzte Wörterbuchwerte korrigiert — Ukrainisch `config.modes*` (Adaptive Framing / Exit Narrative / Location Policy), Russisch `eval.jdLbl` („Job Description"), Italienisch `dash.quick.contactoSub` („referral" → „segnalazione") — plus die Lokalisierung des englischen Standardtexts `**16 locales**` in den CHANGELOGs von ru/uk/ja/ko/zh-CN/zh-TW.
- Neu: `server/lib/sources/dassault.mjs`; `server/lib/portals/adapters/dassault.mjs`.

## [1.96.0] — 2026-07-04
### Hinzugefügt
- **Berufsorientierung (Epic 27).** Eine neue Seite **`#/orientation`** beantwortet die Frage „welche Richtungen passen wirklich zu mir?" — die Einschätzung, die dir ein Berufstest liefern würde, aber abgeleitet aus deinem eigenen Lebenslauf und Profil statt aus einem Fragebogen. Klicke auf **Profil generieren** und das Modell liefert deine **am besten passenden Karrierevektoren** (welche der acht Archetypen — Funktionalist, Administrator, Kommunikator, Spezialist, Analyst, Innovator, Manager, Unternehmer — passen, mit Belegen), eine Neigung zum Berufstyp, empfohlene Rollen, mit deinem Lebenslauf verknüpfte berufliche Stärken, Tendenzen im Arbeitsstil und Entwicklungsempfehlungen. Es ist eine **KI-Reflexion darüber, wie sich dein Lebenslauf liest — kein psychometrischer Test**: es erfindet nie Erfolge und meldet nie numerische Werte, als wären sie gemessen. Exportiere es nach Markdown oder PDF; nichts wird auf die Festplatte geschrieben.
  - Neue Route `server/lib/routes/orientation.mjs` (24. Routenmodul) — `POST /api/orientation/generate` baut den Profil-Prompt aus Lebenslauf+Profil+two-pager+Speichernotiz über die geteilte Anbieter-Kaskade, mit einem manuellen Copy-Paste-Fallback und **ohne Dateischreibvorgänge**.
  - Verwendet `report-export.js` für Markdown/PDF/Kopieren wieder, innerhalb der Navigationsgruppe **Entwicklung**.
  - Tests: `tests/orientation-routes.test.mjs` (Reflexions-Rahmung / keine erfundenen Werte, mit Lebenslauf/Profil geseedeter manueller Modus). 7 neue i18n-Schlüssel ×16 Sprachen, Hilfe **§28** ×16.
- Neu: `#/orientation`; `server/lib/routes/orientation.mjs`.

## [1.95.0] — 2026-07-04
### Hinzugefügt
- **Karriereplan (Epic 26).** Eine neue Seite **`#/career-plan`** verwandelt deinen Lebenslauf und dein Profil in einen konkreten, personalisierten Entwicklungsplan. Wähle einen **Horizont** (6/12/24 Monate) und einen optionalen **Fokus**, und das Modell — das deinen Lebenslauf, dein Profil, deinen two-pager und deine Speichernotiz liest — schreibt eine Ausgangspunkt-Momentaufnahme, eine SWOT zu Stärken/Wachstum, Ziele als SMART / OKR / WOOP, alternative Trajektorien, einen Plan für Hard-/Soft-Skills, eine **Monat-für-Monat-Roadmap**, Methoden zur Fortschrittsverfolgung, Fallstricke und unterstützende Schritte. Es plant von dem aus vorwärts, was deine Materialien tatsächlich zeigen, und erfindet nie Fakten über deine Geschichte. Bearbeite ihn inline, **Speichere** ihn in die Nutzerschicht (`config/career-plan.md`) und **exportiere** ihn nach Markdown oder PDF.
  - Neue Route `server/lib/routes/career-plan.mjs` (23. Routenmodul) — `GET`/`PUT /api/career-plan` (schreibt `config/career-plan.md`) + `POST /api/career-plan/generate` (geteilte Anbieter-Kaskade, manueller Fallback, keine Erfindung). `PATHS.careerPlan`.
  - Verwendet den geteilten `report-export.js` (v1.94.0) für Markdown/PDF/Kopieren wieder, sowie eine neue Navigationsgruppe **Wachstum**.
  - Tests: `tests/career-plan-routes.test.mjs` (Begrenzung, GET/PUT-Roundtrip, horizontbewusster, mit Lebenslauf/Profil geseedeter Prompt). 20 neue i18n-Schlüssel ×16 Sprachen, Hilfe **§27** ×16.
- Neu: `#/career-plan`; `server/lib/routes/career-plan.mjs`; `PATHS.careerPlan`.

## [1.94.0] — 2026-07-04
### Hinzugefügt
- **Statistik, überarbeitet (Epic 25).** Die Seite `#/stats` ist jetzt ein **Statistik**-Bereich mit drei Tabs, mit echten Diagrammen und deutlich mehr Daten. Ein neuer Tab **Marktbericht** bittet das Modell um eine Gehalts- und Arbeitsmarktanalyse deiner Zielrollen in einer Region und Währung deiner Wahl — Management-Zusammenfassung, Gehalt nach Stufe mit P10/P25/P75/P90-Perzentilen, Top-Arbeitgeber, eine Tabelle gefragter Fähigkeiten, Häufigkeit von Zusatzleistungen, die Aufteilung Büro/Hybrid/Remote, Trends über 12–24 Monate und Verhandlungshinweise. Jede Zahl ist als **richtungsweisende Schätzung aus dem Wissen des Modells** gekennzeichnet, nie als abgegriffene Daten dargestellt. Ein neuer Tab **Meine Pipeline** stellt deinen eigenen Tracker grafisch dar: Score-Verteilung, Status-Trichter, Top-Unternehmen und -Rollen, Bewerbungen im Zeitverlauf und Konversionsraten. Die ursprüngliche Zielrollen-Ansicht (Stellen/Gehalt nach Land + gespeicherter Snapshot-Trend) wandert unter einen dritten Tab, jetzt mit einer **Währungsauswahl** und einer Übersicht **Stellen-nach-Rolle**.
  - **Exportiere jeden Bericht** nach Markdown oder PDF, oder kopiere ihn — über den geteilten Helfer `report-export.js` (Markdown-Blob-Download; PDF über den bestehenden Inline-PDF-Runner).
  - Neue Route `server/lib/routes/market.mjs` (22. Routenmodul) — `POST /api/stats/market` baut einen Marktanalyse-Prompt aus deinem Lebenslauf/Profil (damit es deine Zielrollen kennt), Region und Währung, führt ihn durch die geteilte Anbieter-Kaskade und fällt ohne Schlüssel auf einen Kopieren-und-Einfügen-Prompt zurück. Keine Dateischreibvorgänge.
  - Tests: `tests/market-routes.test.mjs` (Region/Währungs-Begrenzung, ehrlichkeitsgekennzeichneter Prompt, mit Lebenslauf/Profil geseedeter manueller Modus). 36 neue i18n-Schlüssel ×16 Sprachen, Hilfe **§26** ×16.
- Neu: `#/stats` in Tabs überarbeitet; `server/lib/routes/market.mjs`; `public/js/lib/report-export.js`.

## [1.93.0] — 2026-07-04
### Hinzugefügt
- **Speicherschicht (Epic 24).** Eine neue Seite `#/memory` hält eine kurze, editierbare „das über mich merken"-Notiz, die der Assistent bei **jeder** Aufgabe im Blick behält:
  - **Eine Notiz, überall** — weil sie in `bundleProjectContext` eingebettet ist, erreicht die Notiz automatisch jede KI-Anfrage (Bewertung, Mock Interview, Networking, CV Studio) über **alle** Anbieter hinweg. Einmal schreiben; sie steuert alles.
  - **Steuerung, keine Fakten** — sie erfasst deine Präferenzen und wie du gern arbeitest (Ton, Format, Ausschlusskriterien, Kadenz), niemals neue Tatsachenbehauptungen über deine Erfahrung — die leben weiterhin nur in deinem Lebenslauf, deinem Profil und deinem two-pager. In der Benutzerschicht unter `config/memory.md` gespeichert, nie durch Updates überschrieben.
  - **Aus deinen Daten vorschlagen** — `POST /api/memory/suggest` durchsucht deinen eigenen Bewerbungstracker nach Verhaltensmustern und entwirft Stichpunkte, die du prüfen und bearbeiten kannst. Es liest deinen Tracker; es erfindet nie Fakten und macht keinen Live-Aufruf.
- Neu: `server/lib/routes/memory.mjs` (21. Routenmodul — `GET`/`PUT /api/memory` + `POST /api/memory/suggest`), `public/js/views/memory.js`, `PATHS.memory` und ein `config/memory.md`-Block, der zu `bundleProjectContext` hinzugefügt wurde. 11 neue i18n-Schlüssel in allen **16 Sprachen**. Tests: `tests/memory-routes.test.mjs`.

## [1.92.0] — 2026-07-04
### Hinzugefügt
- **CV Studio (Epic 21).** Eine neue Seite `#/cv-studio` gibt deinem Lebenslauf drei ehrliche, größtenteils lokale Werkzeuge:
  - **Lebenslauf-Diagnostik** — ein deterministischer 0–100-Score mit Erklärungen je Prüfung (quantifizierte Wirkung, schwache Verben, Buzzwords, Länge, Kernabschnitte, Kontaktdaten). Rein clientseitig (`window.CvDiagnostics`) — kein LLM, nichts erfunden, jeder Befund erklärt, damit *du* entscheidest, was du änderst.
  - **Datenschutz-Maske** — schwärzt PII (E-Mail, Telefon, Links/Handles, Straßenanschrift und optional deinen Namen → Initialen), bevor du deinen Lebenslauf als Muster oder Screenshot teilst. Läuft vollständig im Browser (`window.CvPrivacy`); sie meldet genau, was sie geschwärzt hat, und speichert das Original nie.
  - **Menschlich machen / Stimmabgleich** — füge eine steife Zeile oder einen Absatz ein und schreibe sie in *deiner* Stimme um, serverseitig verankert in `voice-dna.md` und `writing-samples/`. Harte Leitplanke: Sie darf umordnen, straffen und neu vertonen, aber nie eine Tatsache, Kennzahl oder Leistung einführen, die nicht bereits im Text steht. Läuft live über die geteilte Anbieter-Kaskade oder gibt einen kopierfertigen Prompt ohne Schlüssel zurück.
- Neu: `server/lib/routes/cv-studio.mjs` (20. Routenmodul — `POST /api/cv-studio/humanize`), `public/js/views/cv-studio.js`, `public/js/lib/cv-diagnostics.js`, `public/js/lib/cv-privacy.js`, `PATHS.voiceDna` + `PATHS.writingSamplesDir`. 29 neue i18n-Schlüssel in allen **16 Sprachen**. Tests: `tests/cv-diagnostics.test.mjs`, `tests/cv-studio-routes.test.mjs`. (Vorlagengalerie, Word-Export und Ausschreibungs-PDF-Archiv werden als anschließende CV-Studio-Arbeit verfolgt.)

## [1.91.0] — 2026-07-04
### Hinzugefügt
- **Networking & tiefe Unternehmensrecherche (Epic 16).** Eine neue Seite `#/networking` verwandelt ein Unternehmen in einen umsetzbaren Plan, um ein Interview zu bekommen — verankert in deinem Lebenslauf, deinem Profil und deinem two-pager:
  - **Unternehmensdossier** — ein knappes Briefing dazu, was das Unternehmen macht, zitierwürdige jüngste Signale und „warum ich passe"-Aufhänger aus deinem echten Hintergrund.
  - **Wen kontaktieren** — 3–5 Zielpersonas (Hiring Manager, interner Recruiter, ein Senior-IC im Team, eine warme/Alumni-Verbindung) mit einer konkreten LinkedIn-Suchzeichenkette, um jede zu finden. Es erfindet nie echte Namen.
  - **Der wärmste Vorstellungspfad** — die realistischste warme Einstiegsroute für *deinen* Hintergrund (gemeinsamer Arbeitgeber/Schule/Community, ein Zweitgrad-Pfad oder eine signalstarke kalte DM) und warum.
  - **Outreach-Entwürfe** — kurze, konkrete Nachrichten für die wichtigsten Personas, verankert in deinen echten Belegpunkten.
  - **Live oder manuell** — läuft live über die geteilte Anbieter-Kaskade mit einem beliebigen Schlüssel oder gibt einen kopierfertigen Prompt zurück (ehrlicher Rückfall, nichts erfunden). **Plan speichern** legt einen fertigen Plan in der Benutzerschicht ab (`networking/net-{company}-{role}-{date}.md`); die Seite listet, öffnet und löscht gespeicherte Pläne.
- Neu: `server/lib/routes/networking.mjs` (19. Routenmodul), `public/js/views/networking.js`, `PATHS.networkingDir`. Verwendet die `server/lib/llm-dispatch.mjs`-Kaskade aus v1.90.0 wieder. 24 neue i18n-Schlüssel in allen **16 Sprachen**. Tests: `tests/networking-routes.test.mjs`.

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
