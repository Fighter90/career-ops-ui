# Changelog (Deutsch)

> Dieses Changelog beginnt bei v1.85.0 — der Version, in der die deutsche Lokalisierung hinzugefügt wurde. Für frühere Versionen siehe [CHANGELOG.md](CHANGELOG.md).

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
