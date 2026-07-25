# Changelog (Deutsch)

> Dieses Changelog beginnt bei v1.85.0 — der Version, in der die deutsche Lokalisierung hinzugefügt wurde. Für frühere Versionen siehe [🇬🇧 CHANGELOG.md](CHANGELOG.md).

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
- **LICENSE nennt den Autor** — die Copyright-Zeile lautet jetzt: *Sergey Emelyanov (Fighter90) <https://sergey-cv.com> and career-ops-ui contributors* (kanonischer MIT-Text unangetastet). Eine neue **NOTICE.md** schlüsselt die Lizenzierung im Detail auf: wer das Copyright hält, was der MIT-Grant genau abdeckt (Code, Doku, Übersetzungen, Landing, Wiki), was NICHT abgedeckt ist (deine Laufzeitdaten, das Elternprojekt, Jobbörsen-Inhalte, Marken), die Tabelle der Drittkomponenten (express/js-yaml — MIT; Astro/Tailwind — MIT; die Schriften Figtree und JetBrains Mono — SIL OFL 1.1; sharp — Apache-2.0) und eine optionale Attributionszeile.

## [1.119.3] — 2026-07-13

### Hinzugefügt
- **SECURITY.md** — die Security-Policy, auf die CONTRIBUTING verwies, existiert jetzt: unterstützte Versionen, privater Meldeprozess (GitHubs **private vulnerability reporting** ist im Repo jetzt **aktiviert** — Security-Tab → „Report a vulnerability"), das Bedrohungsmodell einer localhost-gebundenen Einzelnutzer-App (im Scope: XSS über feindliche Stellenanzeigen / SSRF / Path Traversal / Secret-Leaks / CSP-Schwächung; außerhalb: DoS gegen den eigenen localhost und Probleme des Elternprojekts) und die Hardening-Baseline für Reviewer.

## [1.119.2] — 2026-07-13

### Hinzugefügt
- **CONTRIBUTING.md** — der Contributor-Guide, auf den Landing und README schon immer verlinkt haben, existiert jetzt: Setup, Projektkarte, die harten Security-/No-Build-Regeln, Test-Ebenen, der Zwei-Registries-Walkthrough zum Hinzufügen einer Scan-Quelle, der ×16-i18n-Vertrag, Commit-/PR-Konventionen und der Release-Prozess.
- **Sprachflaggen auf der Landing** — der Sprachumschalter von cvstart.org, das Sprachraster im Footer und das „In deiner Sprache lesen"-Banner zeigen jetzt die Flagge jeder Locale neben ihrem Endonym (dasselbe Regionalindikator-Set wie das Sprach-`<select>` der App; degradiert zu Regionsbuchstaben, wo Flaggen-Glyphen fehlen).
- **Landing-Footer-Fixes** — der tote Discussions-Link (Feature im Repo nicht aktiviert) zeigt jetzt auf das Projekt-**Wiki**, und der Footer nennt den Autor: **Sergey Emelyanov** ([sergey-cv.com](https://sergey-cv.com/) · [LinkedIn](https://www.linkedin.com/in/sergey-emelyanov-in-job/)).

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
