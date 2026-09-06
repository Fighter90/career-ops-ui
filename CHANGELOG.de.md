# Changelog (Deutsch)

> Dieses Changelog beginnt bei v1.85.0 — der Version, in der die deutsche Lokalisierung hinzugefügt wurde. Für frühere Versionen siehe [🇬🇧 CHANGELOG.md](CHANGELOG.md).

## [1.231.0] — 2026-09-05

**Hinzugefügt — zwei Scan-Quellen aus dem Eltern-career-ops v1.32.0 (Collage, Telegram streng), Gems REST-Modus und ein Defekt, den die Portierung im Code des Elternprojekts selbst zutage förderte.**

### Hinzugefügt
- **Zwei neue Quellen, 90 → 92** (87 EN + 5 RU), `ALL_ADAPTERS` **85 → 87**. Beide ohne Token.
  - **Collage** (`provider: collage`) — die öffentliche Job-Site-API von Collage HR. Das Pfadsegment ist **die Adresse, die der Mandant selbst gewählt hat**, kein Slug aus dem Firmennamen: Sie wird aus `api:` oder aus einer `secure.collage.co/jobs/<Adresse>`-URL gelesen und **nie geraten** — eine geratene Adresse würde das Board eines anderen scannen.
  - **Telegram (streng)** (`provider: telegram-channel`) — liest dieselben `t.me/s/<Kanal>`-Vorschauen wie die vorhandene Quelle `telegram`, geht aber den **umgekehrten Handel** ein: Ein Beitrag wird **nur dann zur Zeile, wenn er einen Arbeitgeber nennt UND auf eine Stellenseite verlinkt**. Digests, Beiträge mit verborgenem Arbeitgeber und reine Kontaktbeiträge fallen weg. Geringe Abdeckung mit Absicht — stromaufwärts gemessen passieren 32-77% der Beiträge — aber jede Zeile trägt einen echten Arbeitgeber und einen echten Link. Beide werden ausgeliefert, wie beim Elternprojekt.
- **Gem erhielt einen optionalen REST-Modus** neben dem GraphQL-Pfad (`api: https://api.gem.com/job_board/v0/<board>/job_posts`). Er wird nie aus einer Board-ID abgeleitet, und der GraphQL-Pfad bleibt die Vorgabe. Portiert aus #3783.

### Behoben
- **Der Ortsfilter von `telegram-channel` sah kein Kyrillisch und nannte Städte als Arbeitgeber.** Das `LOCATIONISH_RE` des Elternprojekts nutzte `\b`, eine reine ASCII-Wortgrenze, die neben Kyrillisch nie greift: Alle russischen Alternativen darin waren unerreichbar, und `Senior Engineer | Москва` lieferte **„Москва“ als Arbeitgeber**. Genau die Feldverwechslung, die die ganze Zuordnungsregel verhindern soll — und sie traf die Hauptzielgruppe des Providers: Ein russischsprachiger Kanal schreibt den Ort kyrillisch. Die web-ui-Portierung nutzt Unicode-Prüfungen (`\p{L}` / `\p{N}`), dasselbe, was das Elternprojekt eine Konstante tiefer in `ROLE_WORD_RE` bereits tut. Durch einen Test festgehalten, der an der ASCII-Form scheitert. **Stromaufwärts noch nicht behoben.**

### Hinweise
- **Die Workday-Facetten-Wiederherstellung des Elternprojekts (#3851, #3874) brauchte keine Portierung** — web-ui paginiert Workday überhaupt nicht, ein einziger POST bei `offset: 0`.
- **`providers/_types.js`** änderte sich nur in der Dokumentation.
- Tests: **2962 → 3009** (+47).

## [1.230.0] — 2026-09-05

**Geändert — drei Provider-Korrekturen aus dem Eltern-career-ops v1.32.0 sowie ein Defekt, den die Portierung selbst zutage gefördert hat.**

### Hinzugefügt
- **Welcome to the Jungle nimmt einen serverseitigen Algolia-`filters`-Ausdruck entgegen** (`wttj: { filters: "offices.country_code:FR AND contract_type:full_time" }`). Ein Stichwort allein grenzt ein globales Board nicht ein: Welche `max_hits` Treffer zurückkommen, entscheidet Algolias Relevanzranking und nicht die Filter des Scanners — unsere greifen erst danach, auf dem bereits Eingetroffenen, sodass alles jenseits der Obergrenze unsichtbar bleibt, wie gut es auch passt. Ein Filter verkleinert die **Menge**, statt sie neu zu sortieren, und die Obergrenze je Abfrage steigt deshalb von 200 auf 1000. Mit einem Filter wird `queries` optional: Die leere Abfrage bedeutet „alles, was den Filter passiert“. Portiert aus dem Elternprojekt #3757.

### Behoben
- **Radancy warnt nicht mehr „truncated“, wenn ein Mandant schlicht weniger Stellen ausliefert, als sein eigenes Banner behauptet.** Das Elternprojekt hat `data-total-results` gegen neun reale Mandanten geprüft: Fünf stimmten überein, doch vier — ein kleiner und ein sehr großer — lieferten 10 bis 56 % weniger eindeutige Stellen als angekündigt, ohne eine einzige doppelte Zeile. Das Banner überzeichnet, was der Suchindex des Mandanten tatsächlich ausliefert; der Abgleich mit dem gesammelten Zähler war deshalb bei der Mehrzahl der Boards ein Fehlalarm. Die Warnung erscheint nur noch, wenn **unser eigenes** `max_jobs`/`max_pages` den Durchlauf gestoppt hat — der einzige Fall, auf den der Aufrufer reagieren kann; `totalResults` bleibt als Kontext in der Meldung und entscheidet nie. Portiert aus #3839.
- **Radancy umgeht den Cache bei jeder JSON-Fragment-Anfrage.** Eine Cache-Schicht vor dieser Route wiederholt bei manchen Mandanten veraltete Antworten: Dieselbe Stelle taucht Seiten später erneut auf, während eine andere nie ausgeliefert wird — stromaufwärts neun von neun Läufen reproduziert. `Cache-Control`/`Pragma`-Header änderten nichts; ein zufälliger Parameter je Anfrage behob es. Er muss je **Aufruf** eindeutig sein, niemals aus der Seitenzahl abgeleitet: Ein deterministischer Parameter gäbe dem Cache weiterhin einen stabilen Schlüssel und damit dieselbe stabile, falsche Zuordnung. Portiert aus #3839.
- **Greenhouse-Bürolisten sind deterministisch sortiert.** Greenhouse sichert die Reihenfolge von `offices[]` zwischen Antworten nicht zu, und die aus dem `/offices`-Baum gewonnene Menge folgt ihrer Durchlaufreihenfolge. Beide landen im Feld `location` der Stelle, sodass ein Board, das seine Büros umordnet, diese Zeichenkette neu schrieb — und eine unveränderte Stelle als neu gelesen wurde. Das Elternprojekt korrigierte die Menge (#3839); **web-ui hatte eine zweite Ausprägung desselben Defekts, die es dort nicht gibt** — den `offices[0]`-Rückfall, der greift, wenn eine Stelle keine eigene Ortsangabe trägt — und beide sind nun sortiert.

### Hinweise
- **Die iCIMS-Korrektur des Elternprojekts (#3728) brauchte keine Portierung.** Sie liest alle `jobLocation`-Einträge aus dem JSON-LD einer Detailseite, weil manche Mandanten einen komplett `UNAVAILABLE`-Eintrag vor die echte Adresse setzen. web-uis iCIMS nimmt den Ort aus dem HTML der **Listenseite** und öffnet nie eine Detailseite.
- **Die Änderung an `_http.mjs` brauchte keine Portierung.** Sie zieht `isRefusedRedirectError` für einen zweiten Konsumenten heraus, den web-ui nicht hat; das Verhalten von `isRetryableError` bleibt gleich.
- **Die ortsbewusste Deduplizierung (#3751) wird nicht gespiegelt** — sie liegt in der `scan.mjs`-Pipeline der Eltern-CLI.
- Registry unverändert: **90 Quellen** (85 EN + 5 RU). Tests: **2956 → 2962** (+6).

## [1.229.0] — 2026-09-03

**Hinzugefügt — vier Scan-Quellen aus dem Eltern-career-ops v1.31.0: Built In, Feishu Jobs, Garena und MokaHR.**

### Hinzugefügt
- **Vier neue Quellen, 86 → 90** (85 EN + 5 RU), `ALL_ADAPTERS` **81 → 85**, alle ohne Token. **Built In** deckt alle neun Märkte des US-Tech-Boards ab und bringt **keine Standardabfrage** mit: ein Eintrag ohne `queries:` und `categories:` scannt nichts und sagt es — eine geteilte Quelle darf niemandes Suchbegriffe tragen; ein nicht gelisteter Markt wird **abgelehnt**, nie stillschweigend durch das nationale Board ersetzt. **Feishu Jobs** akzeptiert genau zwei Hostformen, die **unterschiedliche Pfade** zur Stellenseite verwenden. **Garena** ist Einzelunternehmen: `office` formt den **Link**, nicht die Liste. **MokaHR** liefert eine **verschlüsselte Antwort** (AES-128-CBC-Umschlag, Schlüssel reist mit) — Obfuskation, keine Sicherheit, aber ohne Entschlüsselung liest man nichts.

### Behoben
- **`htmlToText` konnte einen unvollständigen Tag-Öffner in den Text durchlassen.** `safe &lt;img src=x onerror=1` kam als `safe <img src=x onerror=1` heraus. Jetzt folgt auf jede Dekodierung ein Strip, und der abschließende Öffner verliert seine spitze Klammer. Vom Elternprojekt portiert (#3491).

### Hinweise
- **Aus dem Workday-Fix des Elternprojekts wurde nichts portiert.** Er rettet Tenants, deren CXS-Backend die Paginierung bei Offset 2000 deckelt — web-ui paginiert Workday gar nicht (ein POST bei `offset: 0`, 100 Zeilen).
- **Die Fixes an `verify-cv-facts` und `merge-tracker` brauchten keinen Port**: web-ui führt diese Skripte aus dem Eltern-Checkout aus.
- Tests: **2909 → 2956** (+47).


## [1.228.5] — 2026-08-30

**Behoben — die gemeldete Version beschrieb die Datei auf der Festplatte, nicht den laufenden Code.**

### Behoben
- **`/api/health` las `package.json` bei jeder Anfrage neu, sodass ein veralteter Prozess eine Version meldete, die er nicht ausführte.** Die QA fand eine lokale Instanz, die `version: 1.228.4` antwortete und zugleich 404 für `/api/ping` lieferte — eine in 1.228.3 hinzugefügte Route: vor dem Deployment gestartet, den alten Code ausliefernd und die Version der neuen Datei meldend. Genau so sieht ein Deployment aus, das Dateien kopiert und nie neu startet: die eine Zeichenkette, die eine Betreiberin prüft, ist die, die das Problem nicht sehen kann. Dieselbe Klasse wie der Symlink aus v1.228.1, bei dem rsync mitten im Transfer abbrach und dennoch Erfolg meldete.

  Die Version wird jetzt beim Laden des Moduls erfasst und beschreibt damit den laufenden Code. Ein veralteter Prozess meldet die **alte** Version — die Wahrheit, sofort sichtbar. `parentVersion` bleibt pro Anfrage: Es beschreibt den Checkout des Elternprojekts, den dieser Prozess nicht lädt und der sich unter einem laufenden Server legitim ändern kann.

## [1.228.4] — 2026-08-30

**Behoben — die nicht authentifizierte Lebendigkeitssonde arbeitete bei jeder Anfrage auf der Festplatte.**

### Behoben
- **`GET /api/ping` las und parste `package.json` bei jedem Aufruf.** Es ist der einzige ohne Anmeldedaten erreichbare Endpunkt, also ist ein Festplattenzugriff plus JSON-Parsing pro Anfrage ein Denial-of-Service-Hebel, den man jedem in die Hand gibt — CodeQL meldete fehlende Ratenbegrenzung. Die Version wird jetzt einmal bei der Routenregistrierung gelesen; sie kann sich ohne Neustart ohnehin nicht ändern, also macht der Handler gar keine E/A. Ratenbegrenzung hätte den Schaden gedeckelt; die Arbeit zu entfernen entfernt den Hebel.
- **Die Maskierung des echten Namens der Profilinhaberin oder des Profilinhabers außerhalb von Loopback ist jetzt durch einen Test festgehalten.** `/api/health` ersetzte ihn bereits durch `hidden` — aber nur, weil diese Zeile die `hidden ?? value`-Wache mit dem Projektstamm teilt. Nichts prüfte das, also hätte eine Änderung mit eigenem Wert den Namen einer realen Person unbemerkt ins LAN gegeben.

## [1.228.3] — 2026-08-30

**Fixed — the docs assistant could not answer in English, Telegram company names arrived truncated, and a monitor had no way to see the service was up.**

### Fixed
- **The docs assistant answered "no matching help sections were found" in English while the same question worked in Russian.** Retrieval was fine; the context builder was not. `buildAskPrompt` did `if (ctx.length + sec.body.length > MAX_CONTEXT) break` — a `break`, so one oversized section ended the loop and left the context **empty**, and the assistant truthfully reported it had nothing. The English §5 had grown to **16 081 bytes against a 14 336-byte budget** (partly because v1.228.0 added `telegram_channels` to it); the Russian §5 was 13 009 and fit. Same ranking in both languages — §5 was first — only the size differed.

  Two changes: a section past 6 KB is now split at its `###` boundaries, so `telegram_channels` is its own retrievable chunk (1 340 bytes) that ranks **first** in both languages; and an oversized section is skipped or truncated rather than ending the loop. The guide went from 32 chunks to 75.
- **A Telegram company label yielded the sentence after it, not the name.** `Компания: FinCore Technology (продуктовая разработка, высоконагруженные системы)` became `FinCore Technology (продуктовая разработка, высоконагруженны` — capped at 60 characters, cut mid-word. Three of 141 rows. The name now ends at the first separator that introduces a description — a **spaced** dash (so `Coca-Cola` survives), a comma, semicolon, pipe or opening parenthesis — and any remaining cap falls on a word boundary. This source attributes a company as fact; a truncated sentence is as wrong as a guessed name, only less obviously so.

### Added
- **`GET /api/ping` — a liveness probe that leaks nothing.** `{ ok, version }` and no more. `/api/health` reports absolute paths, the profile owner's real name and which API keys are set: legitimate for an authenticated operator, never for the public internet. A monitor behind a Basic-auth gate previously had no way to see the service was up at all.

## [1.228.2] — 2026-08-30

**Fixed — a two-word search in `/api/scan-results` matched the phrase, not the words, and under-reported badly.**

### Fixed
- **`?q=` now matches every term independently instead of the literal phrase.** The query was a single `includes(q)` over title + company + location, so `продакт менеджер` found only rows carrying those two words in that exact adjacency — **32 of the 162** that carry both. `Менеджер продукта` and `Менеджер по развитию продукта` were invisible to it: the same words, reordered or with filler between them.

  This is how a narrow match becomes a **wrong answer**. The Telegram assistant asked for all Продуктовый менеджер reported 9 — faithfully, because 9 was what the endpoint said. The count it quoted was honest; the endpoint's was not. Word order and the words between are not something a person typing two words intended to pin.

  Matching is AND across terms, so widening precision costs nothing: a row must still carry every term. `менеджер разработчик` returns zero rather than the union.

## [1.228.1] — 2026-08-29

**Fixed — a dangling symlink in the repo that silently truncated deploys.**

### Fixed
- **`.claude/skills/refero-design` was a tracked symlink to a path that has never existed here.** It pointed at `../../.agents/skills/refero-design`, which resolves to `.agents/` at the repo root; there is no such directory, and the link arrived in the v1.118.0 parity pack from a machine where the surrounding folders nested differently. Anyone cloning the repo has been getting a broken link ever since.

  It was not inert. **rsync aborts on it mid-transfer** — a deploy today reported success while the server kept running the previous version, and the mismatch only surfaced because the version was checked afterwards. The parent project's `node test-all.mjs` also crashes outright when a web-ui checkout sits inside its tree, because its fixture copy walks the working directory and cannot stat the link. Nothing referenced it: the only `refero` matches in the repo are the Polish word *preferowany*.

## [1.228.0] — 2026-08-29

**Hinzugefügt — Telegram-Kanäle als Scan-Quelle und ein paginierter Abfragemodus für `/api/scan-results`.**

### Hinzugefügt
- **Telegram-Kanäle sind jetzt eine scannbare Quelle.** Ein `telegram_channels:`-Block in `portals.yml` listet sie; jeder wird über die öffentliche Vorschau `https://t.me/s/<Kanal>` gelesen. Registry: **85 → 86 Quellen** (81 EN + 5 RU), `ALL_ADAPTERS` **80 → 81**.

  Telegram veröffentlicht kein RSS, und die Bot-API kann keinen Kanal lesen, den der Bot nicht administriert — beide naheliegenden Wege scheiden aus. Die `/s/`-Vorschau ist schlichtes servergerendertes HTML: ohne Anmeldung, ohne JS, ohne Cookie. An 16 Kanälen geprüft: 15 lieferten je 20 Beiträge auf ein blankes GET.

  `channel:` akzeptiert jede Schreibweise. Der Parser verankert sich an den drei Dingen, die ein Telegram-Redesign zuletzt verschieben würde: `data-post`, den Textcontainer und das ISO-Datum `<time datetime>`.
- **`GET /api/scan-results` erhält einen paginierten Abfragemodus.** `?q=<Text>&limit=50[&region=ru|en][&set=filtered|fresh][&offset=N]` liefert `{ total, returned, offset, limit, set, rows }`, wobei **`total` die Zahl VOR der Paginierung ist**. Ohne Parameter gibt die Route weiterhin den vollen Snapshot zurück — die `#/scan`-Tabelle hängt an dieser Form.

### Behoben
- **Der Telegram-Assistent antwortete aus einem Bruchteil der Daten.** Sein Skill zeigte bereits auf `/api/scan-results`, doch die Route konnte nur den ganzen Snapshot liefern — rund 2 MB — was nicht in den Kontext eines Agenten passt. Auf „finde alle Product Manager“ meldete er **9** Treffer, wo der Snapshot Hunderte hielt, und sagte, er „arbeite mit einem begrenzten lokalen Index“. Das stimmte: Er sah den Endpunkt, konnte ihn aber nicht verarbeiten. Mit dem paginierten Modus kostet dieselbe Frage 2 KB und liefert ein ehrliches `total`. Der Skill wurde ebenfalls neu geschrieben: Er verlangte, die *neuen* Beiträge zusammenzufassen, zeigte also auf `fresh` statt auf `filtered`.

### Hinweise
- **Ein Kanalbeitrag ist Prosa, kein Stellendatensatz.** Es gibt keine strukturierten Felder: Der Titel kommt aus der ersten inhaltlichen Zeile, Firma/Ort/Gehalt aus ausdrücklichen Labels. **Echte Stellen von Werbung und Digests zu trennen bleibt dem vorhandenen `title_filter` überlassen** — demselben, der für andere Quellen bereits eingestellt ist. Das sind Hinweise, keine Liste.
- **Die Firma wird nie geraten.** Ohne Label wird die Zeile dem Kanal zugeschrieben (`@rabotaphp`): Ein falscher Arbeitgeber landet im Tracker als Tatsache.
- **Ein leeres Parse-Ergebnis ist ein Fehler, kein „keine Stellen“.** t.me antwortet bei einem privaten oder fehlenden Kanal mit einer Weiterleitung; null Zeilen zurückzugeben läse sich als ruhiger Tag und verstecke einen Tippfehler in der Konfiguration für immer. `jobGeeks` tut genau das (HTTP 302) und ist bewusst **nicht** konfiguriert.
- Die Remote-Erkennung nutzt eine Unicode-Wortgrenze statt `\b`, das nur ASCII kennt — dieselbe Falle wie beim Titelfilter in v1.227.3, hier vor der Auslieferung von einem Test gefangen.
- 15 Kanäle konfiguriert und live geprüft: **299 Beiträge, 15/15 Kanäle**. 30 neue Tests. Tests: **2865 → 2895**.
- **The README test counts jumped by hundreds, and no, this release did not add them.** The localized READMEs carried unit-test totals frozen at 1856 / 1945 / 1955 / 549 / 419 / 284 / 2527 depending on the file — each stale since a different release, and several contradicting the badge at the top of the same page. They now all read **2895**, verified by running the suite rather than by copying a badge. Playwright (70 / 90 / 12 → **101**), e2e smoke (20 → **21**), route modules (12 / 32 → **37**), smoke flows (12 → **22**) and the test-file count (218 → **329**) were stale in the same way. The `Total` row also repeated the unit count, so it under-summed the three suites below it; it now reads the real sum (**3040**).

## [1.227.5] — 2026-08-29

**Behoben — der regionale Scan trieb den Server in den Speicherüberlauf, und eine Playwright-Suite flackerte an ihrem eigenen Abbau.**

### Behoben
- **Der regionale Scan riss den Server per OOM um.** `ru-scanner` sammelte **jeden Rohtreffer aus jeder Abfrage** und dedupliziert und filterte erst ganz am Ende. Die Abfrageliste besteht bewusst aus Beinahe-Synonymen (`Golang`, `Go разработчик`, `Golang разработчик`, `Senior Go`…), also kommt dieselbe Stelle einmal pro Abfrage zurück und das Array hielt ein Vielfaches der eindeutigen Zahl — samt Beschreibungen, die den Großteil eines Job-Objekts ausmachen und von den Filtern ohnehin fast vollständig verworfen werden. Gemessen: **742 MB** Heap bei einem echten Lauf mit 21 Abfragen. Der Server deckelt Nodes Heap bei **490 MB** (V8 bemisst ihn an den 956 MB RAM der Maschine), also riss der Scan den Dienst mit `FATAL ERROR: Reached heap limit` um — **viermal an einem Tag**. Deduplizierung und Filterung laufen jetzt pro Abfrage, was denselben Lauf auf **177 MB** brachte, minus 76 %. Die ausgewiesenen Zahlen bleiben gleich: die eindeutige Gesamtzahl trägt ein `Set` aus URL-Strings.
- **`net::ERR_SOCKET_NOT_CONNECTED` ließ die CI zufällig scheitern.** Drei Playwright-Suites rufen `window.stop()` auf, um laufende Requests abzubrechen, bevor sie prüfen, dass keine Konsolenfehler auftraten. Chromium meldet diesen einen Vorgang unter **drei** Namen, je nach Zustand des Sockets: `ERR_ABORTED` beim Abbruch, `ERR_EMPTY_RESPONSE` unterwegs, `ERR_SOCKET_NOT_CONNECTED`, wenn der Socket schon weg war. Der gemeinsame Filter kannte nur die ersten beiden. Aufgetaucht im Locale-Durchlauf bei `tr`, während `playwright-forms` und `playwright-smoke` einen unglücklichen Lauf vom selben Fehler entfernt waren.

### Hinweise
- **Warum erst jetzt.** Die Abfrageliste wuchs von 14 auf 21, als Product-Manager-Suchen hinzukamen. Der Speicherbedarf der alten Implementierung skalierte mit der Gesamttrefferzahl, also sprengten +50 % Abfragen die Obergrenze der Maschine.
- **Die Dedup-Änderung erhält das Verhalten, und das ist getestet.** `tests/ru-scanner-dedup-order.test.mjs` nagelt die heikle Richtung fest — ein späteres Duplikat, das die Filter NICHT besteht, muss ein früheres verdrängen, das bestanden hatte — und fährt 200 randomisierte Äquivalenzprüfungen gegen die alte Implementierung.
- **Der Konsolenfilter bleibt eng.** Nur die Familie abgebrochener Requests ist harmlos; abgelehnte Verbindung, DNS-Fehler, Reset, 5xx und JS-Ausnahmen lassen die Zusicherung weiterhin scheitern.
- Zwei Hypothesen wurden geprüft und verworfen statt ausgeliefert: ein Caddy-Timeout (Konfiguration sauber, `flush_interval -1` für SSE korrekt) und Nodes voreingestelltes 5-Minuten-`requestTimeout` (eine verkleinerte Reproduktion zeigte, dass es eine lange Streaming-Antwort nicht abbricht). Der eigentliche Beleg war `Reached heap limit` im Journal. Tests: **2860 → 2865**.

## [1.227.4] — 2026-08-29

**Behoben — `word:` / `stem:` wurden von `content_filter` weiterhin ignoriert; v1.227.3 hatte nur den Titelfilter behoben.**

### Behoben
- **`content_filter` beachtete die Präfixe nicht.** v1.227.3 brachte `title_filter` die `word:` / `stem:`-Präfixe des übergeordneten Projekts bei, ließ `content_filter` aber bei seinem eigenen rohen `lower.includes(k)` — ein präfigierter Eintrag wurde dort weiterhin mit dem wörtlichen Text `"word:java"` verglichen: derselbe stille No-op, einen Filter weiter. `content_filter` liest die BESCHREIBUNG, und sein Standard war immer ein einfacher Teilstring; deshalb verwirft ein blankes negatives `java` alles, was „JavaScript“ auch nur erwähnt. Das Präfix ist der Ausstieg für einen einzelnen Eintrag. Portiert wurde `compileContentKeyword` des übergeordneten Projekts: dieselbe Präfix-Maschinerie, aber bewusst **ohne** automatische Verankerung kurzer Schlüsselwörter — der Titelfilter verankert 2–3-Buchstaben-Abkürzungen, weil „COO“ in „Coordinator“ immer falsch ist, während eine kurze Folge in einem Fließtext regelmäßig gemeint ist (`aws`, `gcp`, `sql`, `go`).

### Hinweise
- **Im KI-Review der v1.227.3-PR gefunden**, das bemerkte, dass der Code nicht abdeckte, was sein eigener Kommentar behauptete: dort stand „`title_filter` / `content_filter`“, verdrahtet war nur der Titelpfad. Der Kommentar trennt das jetzt ausdrücklich: beide Filter beachten die Präfixe, nur der Titelfilter verankert Abkürzungen.
- **Ebenfalls aus jenem Review geprüft und unverändert:** der Wechsel der 2–3-Buchstaben-Regel von `\b` zur Unicode-Grenze verhält sich für ASCII identisch und ist nur dort strenger, wo er es sein soll — `COO_lead` und `coo1` bleiben erhalten (Unterstrich und Ziffer sind in beiden Fällen Wortzeichen), `Coordinator` bleibt, „Директор COO“ und „VP «Продукт»“ werden korrekt verworfen. 14 Grenzfälle geprüft.
- Unpräfigierte `content_filter`-Einträge behalten ihr bisheriges Matching Byte für Byte, eine leere oder fehlende Beschreibung passiert weiterhin, und ein leeres `word:` / `stem:` trifft nichts statt alles. 6 neue Fälle in `tests/content-filter.test.mjs`. Tests: **2852 → 2858**.

## [1.227.3] — 2026-08-29

**Behoben — die Titelfilter-Präfixe `word:` / `stem:` wurden stillschweigend ignoriert, wodurch diese Filterzeilen wirkungslos blieben.**

### Behoben
- **web-ui implementierte die `word:` / `stem:`-Präfixe des übergeordneten Projekts nicht.** `title_filter` (und `content_filter`) vergleichen standardmäßig **Teilstrings** ohne Groß-/Kleinschreibung — deshalb verwirft ein blankes negatives `intern` auch „International Product Manager“ und „Internal Tools Engineer“. Statt diesen Standard umzudrehen — ein Bruch für jede konfigurierte Installation — machte das übergeordnete Projekt Genauigkeit pro Eintrag optional: `word:intern` trifft nur das ganze Wort, `stem:agent` muss ein Wort beginnen und darf weiterlaufen (trennt „Agentforce“ von „Reagents“). web-ui hatte keines von beiden und verglich den Eintrag mit dem **wörtlichen Text** `"word:intern"`, der in keinem Stellentitel vorkommt. Die Zeile wurde zum stillen No-op: dieselbe `portals.yml` filterte über die CLI korrekt und hier gar nicht, sodass jede ausgeschlossene Praktikumsanzeige weiterhin in der `#/scan`-Tabelle landete. Aus dem `title-keywords.mjs` des übergeordneten Projekts portiert, samt der Unicode-fähigen Wortgrenze (`\p{L}\p{M}\p{N}_`) statt `\b`, das nur ASCII kennt und in akzentuierten oder kyrillischen Titeln mitten im Wort traf.

### Hinweise
- **Gefunden beim Prüfen einer echten `portals.yml`**, die `word:intern` gerade **genau deshalb** übernommen hatte, damit ein blankes `intern` „International Product Manager“ nicht mehr verwirft. In der CLI wirkte das Präfix; web-ui behielt still jede Praktikumsanzeige. Das Verhalten ist jetzt identisch.
- **Die Standards bleiben unverändert.** Ein Schlüsselwort ohne Präfix behält sein bisheriges Matching: Teilstring für Phrasen und alles mit Nicht-Buchstaben (`.NET`, `SAP `, `L&D`), Wortgrenzen-Anker für 2–3-Buchstaben-Abkürzungen. Ein leeres `word:` / `stem:` gilt als Tippfehler und trifft **nichts** — als Negativ träfe ein leeres Muster jeden Titel und würde einen ganzen Scan wegen eines verirrten Doppelpunkts kippen.
- Die Abkürzungsregel nutzt nun dieselbe Unicode-Grenze: zuvor `\b`, weshalb `coo` und `word:coo` bei Nicht-ASCII-Titeln auseinanderliefen — zwei Schreibweisen einer Regel.
- 6 neue Fälle in `tests/title-filter.test.mjs`. Tests: **2846 → 2852**.

## [1.227.2] — 2026-08-29

**Behoben — `#/config` scrollte auf schmalen Telefonen seitwärts.**

### Behoben
- **MOBILE-1: `#/config` lief auf Viewports ≤ 352 px horizontal über.** Jedes Select-Feld trug ein **Inline**-`min-width: 300px`. Ein Inline-Stil schlägt das Stylesheet, also konnte das Control nicht mit seinem Container schrumpfen: Bei 320 px Viewport lag die rechte Kante des Selects bei 353 px, die Seite bekam eine horizontale Scrollleiste und Controls wanderten über den rechten Rand hinaus. Betroffen waren alle 18 Provider-/Modell-Selects (`cfg-llm-provider` und sämtliche `cfg-*-model`). Jetzt `min-width: min(300px, 100%)` + `max-width: 100%`, sodass die komfortablen 300 px nur greifen, wenn Platz ist. Geräte an oder unter der Schwelle: iPhone SE (1. Gen., 320 px), ältere Android-Geräte, Außendisplay des Galaxy Fold.

### Hinweise
- **Warum alle früheren Mobil-Durchläufe das übersahen.** 360 px und 375 px haben gerade genug Spielraum, den Überlauf zu verbergen, und die Playwright-Suites laufen in einem 1280 px breiten Fenster. Nichts in der CI hatte je einen Viewport schmaler als 375 px vermessen. Das neue `tests/playwright-narrow-viewport.mjs` läuft die formulartragenden Routen bei **320 px** ab und schlägt bei jedem horizontalen Überlauf fehl — mit dem breitesten Störenfried in der Meldung; ein zweiter Fall pinnt fest, dass kein `#/config`-Select über den Viewport hinausragt. Zuerst wurde verifiziert, dass er den Fehler reproduziert (`scrollWidth 353 > clientWidth 320`, 18 Selects mit rechter Kante 353). Playwright: **99 → 101**.
- **Bekannt und bewusst noch nicht abgesichert: 280 px** (Außendisplay des Galaxy Fold) läuft weiterhin um ~5 px über, aus anderer Ursache — langer Inhalt in den `<details>`-Blöcken der Konfigurationskarte und die 256 px breite Sidebar gegen einen 280-px-Viewport, nicht das Inline-`min-width`, das dieses Release behebt. Ein Umbruch auf eine Breite, die kein verbreitetes Telefon meldet, ist eigene Arbeit; die `WIDTHS`-Liste der Suite ist dafür vorbereitet.
- Ebenfalls korrigiert: der QA-Prompt von v1.227.1 nannte die Follow-up-Route `#/modes/followup`. Mode-Seiten registrieren den nackten Slug (`Router.register(cfg.slug)`), die Route heißt also `#/followup`; `#/modes/followup` liefert korrekt 404. Nur Dokumentation.
- Unit-Suite unverändert bei **2846** (die neue Abdeckung liegt auf Browser-Ebene).

## [1.227.1] — 2026-08-29

**Behoben — die Quellen-Aufschlüsselung in der Hilfe ging nicht auf, und das GitHub-Banner wurde in der App als rohes Markup ausgegeben.**

### Behoben
- **§17 nannte eine Summe und eine Aufschlüsselung, die nicht zusammenpassten.** Alle Hilfe-Bundles sagten „die `server/lib/sources/`-Registry liefert **85** Adapter — **78 englische + 5 russische**“. 78 + 5 = 83, nicht 85; in ja/ko war die Abweichung schon bei 77 (= 82). Jede neue Quelle erhöhte die Summe und ließ den Summanden stehen, sodass beide Zahlen seit mehreren Releases auseinanderliefen. Die Aufschlüsselung lautet jetzt **80 EN + 5 RU** in allen 17 Locales. Das ist mehr als Kosmetik: `docs/help/<lang>.md` ist der EINZIGE Korpus, auf dem „Ask the docs“ gründet — wer nach der Zahl der Quellen fragte, bekam zwei widersprüchliche Zahlen aus einem Satz.
- **Derselbe Satz nagelte einen veralteten Versionsanker fest.** „Seit **v1.213.0** liefert die Registry …“ überlebte in 16 Locales, während der Zähler zweimal wanderte (83 in v1.219.0, 85 in v1.226.0). Der Anker war in v1.210.1 schon einmal von Hand repariert worden und driftete einfach erneut. Er entfällt zugunsten versionsfreier Formulierung: Der Zähler wird gegen die lebende Registry geprüft, die nicht veralten kann.
- **Das Provider-Banner erschien als escapetes Markup am Kopf von `#/help`.** v1.225.0/v1.225.1 hielten fest, es werde „in der App von `UI.md()` entfernt (keine Bildunterstützung)“. Das vermengt zwei Dinge: `UI.md()` escapet zuerst — jedes Quellbyte wird vor jeder Markdown-Transformation escapet, was die richtige XSS-Grenze ist, aber das Gegenteil von Entfernen. Niemand entfernte das Banner, weil es niemand versuchte, und alle 17 Locales öffneten `#/help` mit 268 Zeichen wörtlichem `<p align="center"><img src="https://…`. Ein neuer gemeinsamer Eingang (`server/lib/help-markdown.mjs::stripGithubOnlyBlocks`) verwirft beim Lesen alleinstehende HTML-Bildblöcke — für `GET /api/help/:lang` wie für den Korpus des docs-assistant. Die Dateien behalten das Banner, GitHub zeigt die Vitrine also weiterhin.
- **Die Spalte „#“ des Kadenz-Boards war seit v1.117.0 leer.** Sie las `entry.appNum`, während `followup-cadence.mjs` `num` liefert — `appNum` gab es nie im Payload. Beide werden nun gelesen. Die „Next up“-Zeile aus v1.227.0 hatte denselben Fehler geerbt und wird mit behoben.

### Hinweise
- **Alle vier blieben unentdeckt, weil nichts sie absicherte.** Die Hilfe-Gates (`canonical-docs-coverage`, `help-ui`, `help-ru-config-section`) zählen ÜBERSCHRIFTEN — 32 H2 / 121 H3 — und kein Test hatte je eine Zahl innerhalb eines Absatzes gelesen oder geprüft, was der Hilfe-Eingang tatsächlich ausliefert. Zwei neue Suites schließen das: `tests/help-source-counts.test.mjs` (die genannte Summe entspricht `SOURCES.length`; die Summanden entsprechen der lebenden EN/RU-Aufteilung und ergeben die Summe; der Absatz nagelt keine Version fest) und `tests/help-banner-strip.test.mjs` (das Banner bleibt für GitHub auf der Platte, übersteht das Strippen nie, die erste gerenderte Zeile jedes Bundles ist seine Überschrift, das Strippen bleibt eng, und beide Konsumenten laufen darüber). Beide wurden vor dem Commit gegen genau diese Fehler auf Rot geprüft. Testsuite: **2837 → 2846**.
- Keine Änderung an Registry, Scanner oder Route-Verträgen; Quellen bleiben bei **85** (80 EN + 5 RU), `ALL_ADAPTERS` **80**.

## [1.227.0] — 2026-08-28

**Hinzugefügt — SEEK Hongkong (JobsDB), ein Nur-fällige-Filter für Follow-ups, und vertrauliche Arbeitgeber zeigen jetzt die vermittelnde Agentur.**

### Hinzugefügt
- **JobsDB Hongkong über die bestehende Jobstreet/SEEK-Quelle.** Hongkong läuft unter der Marke JobsDB, steht aber auf derselben SEEK-Plattform hinter demselben v5-Endpunkt und braucht daher keine eigene Quelle — nur `hk.jobsdb.com` in der Host-Allowlist und `siteKey: HK-Main`. Die Registry bleibt unverändert: **85 Quellen** (80 EN + 5 RU) und `ALL_ADAPTERS` **80** — das ist ein neuer MARKT auf einem bestehenden Adapter, kein neuer Adapter.
- **Nur-fällige-Filter auf dem Kadenz-Board** (`#/modes/followup`). Eine neue Checkbox verengt das Board auf das, was *jetzt* zu tun ist. Die Fälligkeit wird aus der `urgency` gelesen, die das `followup-cadence.mjs` des übergeordneten Projekts bereits berechnet hat (`urgent` / `overdue`) — nie aus dem Tracker-`status`, der `applied`/`responded`/`interview` lautet und auf nichts passen würde. Ist nichts fällig, benennt das Board das nächste geplante Follow-up statt einen leeren Zustand zu zeigen. Die Logik liegt im reinen Modul `public/js/lib/followup-view.js`, Spiegel des übergeordneten `followup-view.mjs`.
- **Vertrauliche Arbeitgeber werden der vermittelnden Agentur zugeschrieben.** Eine Ausschreibung mit zurückgehaltenem Arbeitgeber wird im Tracker als `?` erfasst, der Recruiter steht in der Spalte `Via`. `#/tracker` zeigte ein blankes `?`, sodass mehrere vertrauliche Zeilen ununterscheidbar waren und der Logo-Resolver nichts zum Abgleichen hatte. Eine solche Zeile liest sich nun **„Vertraulich · über \<Agentur\>“**, löst ihr Logo über den Agenturnamen auf und ist über diesen Namen im Suchfeld auffindbar. Nur Darstellung — das kanonische Feld `company` wird nie mit dem Recruiter überschrieben. Neues reines Modul `public/js/lib/company-presentation.js`, Spiegel des übergeordneten `company-presentation.mjs`.

### Behoben
- **Jobstreet/SEEK rief einen abgekündigten Endpunkt auf.** Die Quelle zeigte weiterhin auf chalice-search v4 (`/api/chalice-search/v4/search`), das SEEK abgeschaltet hat; das übergeordnete Projekt migrierte auf `/api/jobsearch/v5/search`, web-ui folgte nie. Jetzt fragt jeder Jobstreet/SEEK-Eintrag v5 ab. Die v5-Item-Form wird nativ gelesen (Job-URL aus `id` gebaut, `locations[0].label`, `advertiser.description`, `salaryLabel`), der v4-eigene Projektionsparameter `solrFields` entfällt, und ein Eintrag, dessen `portals.yml` noch den toten v4-Pfad festnagelt, behält seinen Markt-Hostnamen, während der Pfad auf v5 neu gebaut wird — ohne Zutun der Nutzenden.

### Hinweise
- career-ops-1.30.0-Parität (HEAD des übergeordneten Projekts `8d64f65` → `6cc46a4`; dessen `VERSION` steht noch auf 1.30.0 — release-please hinkt seiner `main` hinterher). Nicht portiert, mit Gründen: **iCIMS-JSON-LD-Ortsergänzung** — die iCIMS-Quelle von web-ui hat überhaupt keinen `enrichDate()`-Hook (nur Listenseiten), es gibt also keinen Codepfad zu reparieren; **nicht-fataler CLI-stderr (#1974)** — der Runner von web-ui entscheidet den Fehlschlag allein am Exit-Code und hatte diese Heuristik nie; **Turbopack-Pfad-Tracing** — web-ui hat keinen Bundler; **`cv-sync-check`-Fixes** — schreibgeschützt und fail-soft weitergereicht; **Playwright-Sequenzierung in `scan.mjs`, Block-H-Antworten, updater/doctor/`update-system`-Guards, die rekursive Syntaxprüfung, das Go-Dashboard und die ergänzten `jd-skill-gap`/`verify-cv-facts`-Selbsttests** — reine CLI-Flächen, die web-ui nicht aufruft, oder Selbsttests ohne Verhaltensänderung. Testsuite: **2818 → 2837**.

## [1.226.0] — 2026-08-27

**Hinzugefügt — zwei vietnamesische Jobquellen: ITviec und CareerViet.**

### Hinzugefügt
- **ITviec + CareerViet (Vietnam).** Zwei host-fixierte vietnamesische Boards treten dem Scanner über `provider: itviec` / `provider: careerviet`-Einträge bei: **ITviec** (itviec.com, Tech) und **CareerViet** (careerviet.vn, breite Abdeckung). Beide sind token-freie HTML-Scraper mit SSRF-Host-Pinning, Nur-HTTPS, Fail-soft pro Firma und Seitenlimits. Das Registry führt nun **85 Quellen** (80 EN + 5 RU), `ALL_ADAPTERS` **80** — beide erscheinen im `#/scan`-Quellenfilter.

### Hinweise
- Parität mit career-ops 1.30.0 (parentVersion 1.29.0 → 1.30.0). Nicht portiert (nur CLI/Community oder bereits abgedeckt): die Hired Wall, `/calibrate`, clean-markers, Template-Packs, doctor, pdf/LaTeX und die eval/tracker/scan-CLIs, die web-ui nicht aufruft; der `_html-to-text`-Fix und `roleFuzzyMatch` waren bereits da; das `title-filter stem:`-Präfix ist zurückgestellt. Testsuite: **2818**.

## [1.225.1] — 2026-08-27

**Behoben — das Anbieterlogo-Banner wird jetzt im README und in der Hilfe angezeigt.**

### Behoben
- Das Banner aus v1.225.0 wurde auf GitHub nicht angezeigt: die eigenständige `images/providers.svg` hatte ein ungültiges `font-family` (verschachtelte doppelte Anführungszeichen), das GitHub ablehnt, das `<img>` nutzte einen repo-relativen `src` (rohes HTML `<img>` löst relative Pfade auf GitHub nicht auf), und dem `<p>`-Block fehlte eine abschließende Leerzeile. Es verweist jetzt über eine absolute URL auf ein gerendertes `images/providers.png`, mit Leerzeilen-Trennung; das SVG ist zudem auf gültiges XML korrigiert.

### Hinweise
- Nur Docs; keine Code- oder Teständerung. Die cvstart.org-Showcase und die Kacheln der App waren bereits korrekt (Inline-SVG, nicht diese Datei).  **2784**

## [1.225.0] — 2026-08-27

**Hinzugefügt — ein Anbieterlogo-Banner in README und Hilfe-Guide.**

### Hinzugefügt
- **Anbieterlogo-Banner.** Ein einzelnes, in sich geschlossenes `images/providers.svg` — die **18 LLM-Anbieter**, mit dem **echten Markenlogo** ([simple-icons](https://simpleicons.org), CC0) für die 11, die eins veröffentlichen, und einem Monogramm in der Markenfarbe für die 7 übrigen — steht jetzt am Kopf des README (×17) und des In-App-Hilfe-Guides. (Die App zeichnet die Kacheln mit dem echten Logo selbst; das Banner wird auf GitHub gerendert und in der App vom XSS-sicheren Renderer entfernt.)

### Hinweise
- Nur Docs — keine Code- oder Teständerung; das SVG ist inline (keine Remote-Ressource). Scan-Quellen unverändert: **83**. Testsuite: **2784**.

## [1.224.0] — 2026-08-26

**Geändert — die LLM-Anbieterkacheln zeigen jetzt echte Markenlogos.**

### Geändert
- **Echte Anbieterlogos.** Die Anbieterkacheln — API-Schlüssel-Felder in den Einstellungen, die Nutzungs-Zeilen, der Dashboard-Chip, die „Aktiv"-Zusammenfassung der Einstellungen, das ⚡ Eval-Ergebnis und das Onboarding-Banner — zeigen jetzt das **echte Markenlogo** für die 11 Anbieter, die ein Open-Source-Icon veröffentlichen (Anthropic · Gemini · OpenAI · Qwen · OpenRouter · GitHub · DeepSeek · Kimi · MiniMax · Mistral · Ollama; Ein-Pfad-SVGs von [simple-icons](https://simpleicons.org), CC0). Die 7 ohne veröffentlichtes Icon (Hermes · GLM/Z.ai · Grok · Together · Fireworks · BytePlus Ark · Volcengine Ark) behalten das Monogramm in der Markenfarbe. Weiterhin **CSP-sicher per Konstruktion**: der Logo-Pfad ist eine eingebettete statische Konstante — keine Remote-Ressource, kein `innerHTML`.

### Hinweise
- Keine Routen- oder Verhaltensänderung; dieselbe `ProviderLogo.el(slug)`-API. `provider-logo.js` ist gewachsen (die eingebetteten Logo-Pfade). Scan-Quellen unverändert: **83**. Testsuite: **2784**.

## [1.223.0] — 2026-08-26

**Behoben — eine erfolgreiche ⚡ Live-Bewertung wurde als Fehler eingefärbt; außerdem den OpenWorker-Coworker direkt aus seiner GitHub-URL oder .zip installieren.**

### Behoben
- **Farbton des ⚡ Bewertungs-Badges.** Eine erfolgreiche Live-Bewertung wird nicht mehr als Fehlschlag eingefärbt. Die In-Process-Anbieter (OpenRouter, DeepSeek, …) liefern keinen Subprozess-`code`, also war das strikte `code === 0` falsch und jeder Erfolg erschien **rot** (bei gleichzeitig "exit 0"). Der Farbton folgt jetzt dem Ergebnis — nur ein Subprozess, der ungleich 0 endet, färbt rot; ein Live-Ergebnis ohne Code ist `badge-ok`, und das "· exit N"-Suffix erscheint nur bei einem echten Exit-Code.

### Geändert
- **Installiere den [OpenWorker-Coworker](https://github.com/Fighter90/career-ops-coworker) aus seiner GitHub-URL / .zip.** Die Coworker-Doku beschreibt jetzt den Ein-Befehl-Installer (`curl … | bash`, idempotent — nutzt ein vorhandenes career-ops / web-ui weiter) und die drei OpenWorker-Installationswege (GitHub-URL · `.zip` · Einzeldatei-Import) in `docs/integrations/openworker.md`, der In-App-Hilfe §32 (×17) und der README.

### Hinweise
- Eine langjährige Abdeckungslücke geschlossen: die Recruitee-Quelle hat jetzt einen End-to-End-Test für den Quoted-Angle-Fix aus v1.214.2 (ein `>` in einem Tag-Attribut darf nicht in die Beschreibung lecken). Scan-Quellen unverändert: **83**. Testsuite: **2783**.

## [1.222.0] — 2026-08-26

**Geändert — die Feldhinweise der erweiterten Anbieter (DeepSeek … Volcengine Ark) sind jetzt in allen 17 Sprachen lokalisiert.**

### Geändert
- **Lokalisierte Anbieter-Feldhinweise.** Jeder `config.<slug>Hint` der 11 in v1.216.0–v1.217.0 hinzugefügten OpenAI-kompatiblen Anbieter (DeepSeek · GLM/Z.ai · Kimi · MiniMax · Mistral · Grok · Together · Fireworks · Ollama · BytePlus Ark · Volcengine Ark) — die API-Schlüssel-, Modell- und Basis-URL-Hinweise unter **Einstellungen → API-Schlüssel** — ist jetzt in alle 17 Sprachen übersetzt, statt auf Englisch zurückzufallen. Anmelde-URLs, Modell-ids und der ⚡ Live-Eval-Marker bleiben wortgetreu erhalten.

### Hinweise
- Keine Verhaltensänderung — der englische `hintFallback` in `field-specs.js` schützt weiterhin einen fehlenden Schlüssel, und ein neuer Vertragstest prüft, dass jeder `hintKey` der Feldbeschreibungen in allen 17 Sprachen auflösbar ist. Scan-Quellen unverändert: **83**. Testsuite: **2779**.

## [1.221.0] — 2026-08-26

**Sicherheit — Verteidigung in der Tiefe gegen DNS-Rebinding auf dem Scanner-Fetch-Pfad.**

### Sicherheit
- Der HTTP-Kern des Scanners (`fetchJson` / `fetchText` in `server/lib/http-json.mjs`) löst nun den Host jeder Quelle auf dem realen Netzwerkpfad auf und **verweigert die Verbindung, wenn er auf eine private, Loopback-, Link-Local-, CGNAT- oder Cloud-Metadaten-Adresse auflöst** — und schließt einen DNS-Rebinding-Vektor. Scanner-Hosts sind bereits an öffentliche Domains gepinnt, also Verteidigung in der Tiefe; der Benutzer-URL-Pfad hatte bereits stärkeres Verbindungs-Pinning (`safe-fetch.mjs`). Der Guard läuft **nur** auf dem echten `fetch`-Transport — ein injizierter Test-`fetchImpl` wird nie aufgelöst.

### Hinweise
- Keine Verhaltensänderung bei einem gesunden Scan. Scan-Quellen unverändert: **83**. Tests: **2775**.

## [1.220.0] — 2026-08-26

**Hinzugefügt — mehrere Get-on-Board-Kategorien aus einem Eintrag scannen.**

### Hinzugefügt
- Ein `getonbrd`-Eintrag kann nun `categories: [programming, operations-management, machine-learning-ai]` (oder ein einzelnes `category:`) statt nur des `programming`-Feeds setzen; Stellen werden über Kategorien hinweg nach URL dedupliziert, begrenzt auf 12. Bestehende Einträge bleiben identisch (Standard weiterhin `programming`).

### Hinweise
- Nur serverseitig; das SSRF-Host-Pinning (www.getonbrd.com) und `redirect:'error'` sind unverändert, und ein ungültiger Kategorie-Slug wird vor jeder Anfrage abgelehnt. Scan-Quellen unverändert: **83**. Tests: **2771**.

## [1.219.0] — 2026-08-26

**Hinzugefügt — Torre kommt zum Scanner, und jedes Anbieter-Label ist jetzt korrekt.**

### Hinzugefügt
- **Torre** (`provider: torre`) — der pan-lateinamerikanische Talentmarktplatz von torre.ai, eine öffentliche Suche ohne Authentifizierung mit Remote-Stellen, die es nicht bis Greenhouse/Lever/Ashby schaffen; eine begrenzte Anfrage pro Eintrag. Das Registry umfasst nun **83** Quellen (78 englische + 5 russische). Außerdem ein Monogramm des aktiven Anbieters im Onboarding-Banner.

### Behoben
- Der a16z-Speedrun-Scan brach auf einem rotierenden Board zu früh ab (eine kurze Seite mitten im Durchlauf galt als letzte und kürzte auf 149 von ~300); er vertraut jetzt dem `total_pages` des Feeds. Und das Onboarding-Banner löste den Anbieter aus einer 4-Einträge-Map auf (und zeigte den rohen Slug für die übrigen 14) — es nutzt jetzt Label+Monogramm der 18; der Anbieter-Hinweis in den Einstellungen geht von 7 auf 18.

### Hinweise
- Die neue Mehr-Kategorien-pro-Eintrag-Option von Get on Board ist hier noch nicht verdrahtet (erfordert einen Refactor auf Quellebene). Tests: **2768**.

## [1.218.0] — 2026-08-26

**Hinzugefügt — Anbieter-Badges (und korrekte Namen) überall, wo ein Anbieter angezeigt wird.**

### Hinzugefügt
- Anbieter-Monogramme auf dem Dashboard-Chip, der „Aktiv"-Übersicht in den Einstellungen und der Kopfzeile des ⚡ Bewertungsergebnisses.

### Behoben
- Veraltete Labels: Drei Ansichten lösten den Namen aus einer 5-Einträge-Map auf (das Bewertungsergebnis kennzeichnete jeden Nicht-Anthropic-Anbieter als „Gemini"); sie nutzen nun `ProviderStatus.label` (18). Die Schlüsselanzahl zeigte „/ 7" → 18. Die Slug-Liste des `LLM_PROVIDER`-Hinweises erhielt `ark` / `arkcn` in allen 17 Sprachen.

### Hinweise
- Nur clientseitig, CSP-sicher. Keine Serveränderung. Scan-Quellen: **82**. Tests: **2758**.

## [1.217.1] — 2026-08-26

**Test-Härtung — Endpunkt-Abdeckung für das gesamte Anbieterverzeichnis.**

### Hinzugefügt
- Ein parametrisierter `run<Provider>`-Test, der Endpunkt, Standardmodell und Bearer-Authentifizierung für **Kimi, MiniMax, Mistral und Fireworks** prüft.

## [1.217.0] — 2026-08-26

**Hinzugefügt — Ark kommt zur LLM-Liste dazu (18 Anbieter).** BytePlus Ark und Volcengine Ark — ByteDances Doubao-Modelle — sind jetzt ⚡ Live-Anbieter über denselben OpenAI-kompatiblen Kern und eine Basis-URL pro Region.

### Hinzugefügt
- **BytePlus Ark** (`ARK_API_KEY`, international) und **Volcengine Ark** (`ARK_CN_API_KEY`, China) — OpenAI-kompatible Chat Completions über `runOpenAICompatible()`. Setze `ARK_MODEL` / `ARK_CN_MODEL` (ein Doubao-Modellname oder deine `ep-…`-Endpunkt-id); `ARK_BASE_URL` / `ARK_CN_BASE_URL` wechseln die Region. Beide reihen sich in die `auto`-Reihenfolge (zuletzt) ein, mit ihrem Monogramm in Einstellungen und Nutzung. Die Web-Oberfläche umfasst nun **18 Anbieter** live.

### Hinweise
- Gleicher Pfad aus vertrauenswürdiger Konfiguration + http(s)-Schema-Prüfung wie beim Rest (nie der SSRF-Validator für Job-URLs). Scan-Quellen unverändert: **82**. Tests: **2755**.

## [1.216.0] — 2026-08-26

**Hinzugefügt — neun weitere LLM-Anbieter, jeder mit eigener Markenkachel.** Deine ⚡ Live-Bewertungen können jetzt über DeepSeek, GLM (Z.ai), Kimi (Moonshot), MiniMax, Mistral, Grok (xAI), Together, Fireworks oder ein vollständig lokales Ollama laufen — nur einen Schlüssel entfernt, jeder mit einem Monogramm neben seinem Feld in den Einstellungen.

### Hinzugefügt
- **Neun OpenAI-kompatible Anbieter.** DeepSeek, GLM (Z.ai), Kimi (Moonshot), MiniMax, Mistral, Grok (xAI), Together AI, Fireworks AI und **Ollama** (vollständig lokal, kein Schlüssel). Setze einen Schlüssel — oder `OLLAMA_BASE_URL` für Ollama — in den **Einstellungen**, und er reiht sich nach Hermes in die `auto`-Reihenfolge ein; einen beliebigen mit `LLM_PROVIDER` festpinnen. Together hostet auch Thinking Machines’ **Inkling** (`thinkingmachines/Inkling`). Die Web-Oberfläche umfasst nun **16 Anbieter** live.
- **Anbieter-Monogramme.** Eine CSP-sichere Initial-Kachel in der Markenfarbe kennzeichnet jeden Anbieter neben seinem Schlüsselfeld in den Einstellungen und in seiner Zeile auf der Nutzungsseite — Inline-SVG, keine externen Logos, nichts verlässt deinen Rechner.

### Hinweise
- Die Basis-URLs der Anbieter sind vertrauenswürdige Konfiguration, die über `runOpenAICompatible()` mit einer http(s)-Schema-Prüfung läuft (Ollamas Loopback ist erlaubt), nie über den SSRF-Validator für Job-URLs. Scan-Quellen unverändert: **82**. Tests: **2752**.

## [1.215.0] — 2026-08-26

**Hinzugefügt — führe deine ganze Jobsuche aus OpenWorker aus.** Ein neuer Coworker steuert diese Pipeline aus Andrew Ngs quelloffener KI-Coworker-App, und die In-App-Hilfe deckt ihn nun ab, sodass der Frag-die-Docs-Assistent dich durchführen kann.

### Hinzugefügt
- **OpenWorker-Coworker.** Ein code-freier [OpenWorker](https://github.com/andrewyng/openworker)-Coworker — [Fighter90/career-ops-coworker](https://github.com/Fighter90/career-ops-coworker) — führt die gesamte Jobsuche aus (Scan, Bewertung, Zuschnitt, Tracking, Follow-up) und kann **dieses Dashboard starten**, alles auf deinem Desktop. Es ist eine Ein-Datei-Persona in 17 Sprachen, deren Installierbarkeit mit OpenWorkers eigenem Loader verifiziert ist.
- **Hilfe §32 „Run it from OpenWorker"** (alle 17 Sprachen) dokumentiert ihn, damit der In-App-Assistent **Frag die Docs** und die schwebende Hilfe-Schaltfläche Fragen dazu beantworten. Auch verlinkt aus der Landing-Fußzeile, dem README, dem Wiki und `docs/integrations/openworker.md`.

### Hinweise
- Nur Docs + Site — keine App-Code-Änderung. Scan-Quellen unverändert bei **82**. Test-Suite: **2742**.



## [1.214.2] — 2026-08-25

**Behoben — die geteilte HTML→Text-Pipeline (Greenhouse- / Recruitee-Beschreibungen) leckt keine Tag-Attribute mehr in die Beschreibung, wenn ein Attributwert ein `>`-Zeichen enthält.**

### Behoben
- **HTML-Beschreibungen mit `>` in einem Attribut werden sauber entfernt.** Der Tag-Entferner hinter den Greenhouse- und Recruitee-Beschreibungen nutzte ein naives Match, das beim ersten `>` stoppte, sodass ein Tag wie `<a title="salary > 100k">` den nachfolgenden Attributtext (`100k">`) in der Beschreibung ließ. Er respektiert nun in Anführungszeichen gesetzte Attributwerte (einfach oder doppelt), entfernt Markup *vor* dem Dekodieren von Entities (damit ein kodiertes Anführungszeichen in einem Attribut kein falscher Trenner wird) und bewahrt weiterhin ein literales `<>` in Klartext.

### Hinweise
- Test-Suite: **2742**. Scan-Quellen unverändert bei **82**. Sonst nichts Neues vom Eltern-Repo diese Runde: die übrigen Änderungen werden schreibgeschützt weitergereicht (follow-up / weekly-digest / rejection-latency / salary-gap-Fixes brauchen keine web-ui-Änderung) oder sind keine web-ui-Flächen (ein externes X/Xquik-BYO-Key-Plugin, CLI/verify-Fixes). Die optionalen Punkte — SmartRecruiters-Detailbeschreibungen, detect-reposts-Aggregator-Überspringen, `stem:` / `word:`-Titelpräfixe, DNS-Rebinding-Härtung — bleiben eingereiht.



## [1.214.1] — 2026-08-25

**Behoben — Ashby-Beschreibungen werden nun auf dieselbe Länge wie Greenhouse und Recruitee begrenzt, sodass ein Inhaltsfilter auf allen drei Boards gleich wirkt und ein Board den Scan-Cache nicht aufblähen kann.**

### Behoben
- **Ashby-Beschreibungen halten nun dieselbe Längengrenze wie die anderen Boards ein.** v1.214.0 speiste Ashbys Stellentext in den Inhaltsfilter, aber — anders als Greenhouse und Recruitee, die auf 4000 Zeichen kappen — wurde Ashbys direkt ohne Grenze durchgereicht (manche 4× länger). So konnte dasselbe `content_filter`-Wort auf Ashby treffen, auf Greenhouse aber nicht — allein je nach Position im Text, und ein Board konnte dem Scan-Cache, den `#/scan` lädt, hunderte KB hinzufügen. Ashby wird nun auf dieselben 4000 Zeichen gekappt (sein Text ist bereits Klartext, wird also abgeschnitten, nie von Tags befreit).

### Hinweise
- Test-Suite: **2738**. Scan-Quellen unverändert bei **82**.



## [1.214.0] — 2026-08-25

**Behoben — Stellenbeschreibungen von Greenhouse, Ashby und Recruitee speisen jetzt den Inhaltsfilter, sodass Wort- / Land- / Visum-Filter diese Boards tatsächlich treffen; und "Associate <Senior-Titel>" (inkl. akademischer Ränge) wird nicht mehr als Entry-Level fehleinsortiert.**

### Behoben
- **Inhaltsfilter greifen jetzt bei Greenhouse, Ashby und Recruitee.** Diese Boards tragen nun den vollen Text jeder Stelle als Beschreibung, sodass ein `content_filter` (oder ein Land- / Visum-Wortfilter) den Stellentext trifft, statt das Board blind durchzulassen. Ashby und Recruitee liefern den Text in ihrer Listen-Payload kostenlos; Greenhouse tat es bereits. Alle drei laufen durch eine gemeinsame HTML→Text-Pipeline.
- **"Associate Director" / "Associate Professor" ist senior, nicht Entry-Level.** Der Senioritäts-Klassifizierer (von `skip_tiers:` genutzt) behandelte das Wort "associate" als Entry-Level-Marker, selbst als Präfix eines Senior-Titels. Er liest nun "Associate <Senior-Nomen>" — inkl. akademischer Ränge (Associate Professor, Associate Dean) — als senior, behält echte Junior-Varianten (Associate Attorney, Associate Editor) als Entry-Level und ordnet ein führendes "Intern, Associate Dean" weiterhin als Praktikum ein.

### Hinweise
- Test-Suite: **2736**. Scan-Quellen unverändert bei **82**. Für später eingereiht: optionale SmartRecruiters-Beschreibungsanreicherung (ein Detail-Abruf pro Stelle), das Überspringen von `aggregator: true`-Boards in detect-reposts und die verankerten Schlüsselwort-Titelpräfixe `stem:` / `word:` — je eine optionale Konfiguration, keine Änderung des Standardverhaltens. Die DNS-Rebinding-Härtung bleibt für ihre eigene Sicherheitsversion eingeplant.



## [1.213.0] — 2026-08-22

**Hinzugefügt — MyCareersFuture, Singapurs nationale Jobbank, als Scan-Quelle. Behoben — Greenhouse-Stellen tragen nun ihren vollen Text, damit Inhaltsfilter greifen, und Remote-Ashby-Stellen verstecken sich nicht mehr hinter einem reinen Stadt-Standort.**

### Hinzugefügt
- **MyCareersFuture (Singapur)** (mycareersfuture.gov.sg) — eine neue token-freie Scan-Quelle für Singapurs nationale öffentliche Jobbank, betrieben von Workforce Singapore. Wähle sie im **Quelle**-Filter auf `#/scan`, oder füge ein Unternehmen mit `provider: mycareersfuture` und einer optionalen `keywords`-Liste hinzu (fällt sonst auf die Zielrollen deines Profils zurück, wie Job Bank). Liest die öffentliche Such-API, host-gepinnt, ohne Schlüssel.

### Behoben
- **Greenhouse-Stellen sind jetzt inhaltsfilterbar.** Greenhouse-Boards werden mit dem vollen Stellentext geholt, als Beschreibung in Klartext dekodiert — so trifft ein `content_filter` (oder ein Land-/Visum-Wortfilter), der die Beschreibung liest, jetzt tatsächlich Greenhouse-Stellen, statt sie blind durchzulassen.
- **Remote-Ashby-Stellen werden nicht mehr von einem Stadtfilter verworfen.** Ashby hält das Arbeitsmodell (Remote/Hybrid/Onsite) getrennt von der Bürostadt, sodass eine voll remote Stelle weiterhin z. B. „San Francisco“ las — und ein Standortfilter, der diese Stadt blockt, verbarg eine annehmbare Stelle. „Remote“ wird nun an den Standort angehängt, wenn die Stelle remote ist, und `workplaceType` gewinnt über ein veraltetes `isRemote`-Flag, damit eine büro-verankerte Hybrid-Stelle nicht falsch etikettiert wird.

### Hinweise
- Scan-Quellen: **82** (77 englische + 5 russische). Test-Suite: **2724**. Eine DNS-Rebinding-Härtung (die aufgelöste Adresse eines Hosts vor dem Verbinden prüfen) ist für eine eigene Version eingeplant — sie braucht ein web-ui-spezifisches Design statt eines direkten Ports.



## [1.212.1] — 2026-08-21

**Behoben — die cvstart.org-Landingpage zählte die Job-Quellen des Scanners zu niedrig (sie zeigte 80 und ließ Job Bank (Kanada) aus); sie stimmt nun wieder mit den 81 der App überein, und der Site-Build schlägt laut fehl, falls beide je auseinanderlaufen.**

### Behoben
- **Der „Job-Quellen"-Zähler der Landingpage ist wieder mit der App synchron.** Nach v1.212.0 zeigte cvstart.org **80** Boards und der neue **Job Bank (Kanada)**-Chip fehlte, während App, Scan-Dropdown und Hilfe-Guide alle **81** auflisteten. Die Landingpage baut ihre Liste, indem sie das Live-Scanner-Register lädt, und eine Quelle ließ sich in diesem Build nicht laden — wegen der Art, wie sie eine YAML-Abhängigkeit einband — und wurde still verworfen. Job Bank lädt diese Abhängigkeit nun verzögert, genau wie der Rest der App zur Scan-Zeit, sodass sie immer erscheint.
- **Der Site-Build weigert sich nun, eine nicht übereinstimmende Quellenzahl auszuliefern.** Zählt das Register je weniger Quellen auf, als auf der Platte existieren (die Signatur einer nicht geladenen Quelle), schlägt der Build mit einer klaren Meldung fehl, statt still die falsche Zahl zu veröffentlichen.

### Hinweise
- Das App-Verhalten ist unverändert — der Scanner hatte stets alle 81 Quellen; nur die Landingpage war betroffen. Scan-Quellen: **81** (76 englische + 5 russische) — unverändert. Test-Suite: **2687**.



## [1.212.0] — 2026-08-21

**Hinzugefügt — Job Bank (Kanada), das föderale nationale Job-Board. Entfernt — EchoJobs (sein Feed ist nun bot-blockiert). Behoben — Consider-Boards liefern wieder Ergebnisse, und Lever-Stellen mit mehreren Standorten verbergen nicht mehr die Hälfte ihrer Standorte.**

### Hinzugefügt
- **Job Bank (Kanada)** (jobbank.gc.ca) — eine neue token-freie Scan-Quelle für Kanadas föderalen nationalen Arbeitsvermittlungsdienst, ein Board mit hohem Volumen, das kein Aggregator gut abdeckt. Wähle sie im **Quelle**-Filter auf `#/scan`, oder füge ein Unternehmen mit `provider: jobbankca` und einer optionalen `keywords`-Liste hinzu (fällt sonst auf die Zielrollen deines Profils zurück). Liest den öffentlichen ATOM-Feed, host-gepinnt, ohne Schlüssel.

### Entfernt
- **EchoJobs** — stillgelegt. Sein öffentlicher Feed liegt nun hinter Bot-Schutz und liefert nichts, sodass ihn zu behalten nur einen Scan-Slot verschwendete.

### Behoben
- **Consider-Boards liefern wieder Ergebnisse.** Consider verlangt jetzt einen anonymen Handshake (ein GET, der ein Session-Cookie + CSRF-Token setzt), bevor es die Suche annimmt; ohne ihn wurde die Anfrage still abgelehnt und das Board wirkte leer.
- **Lever-Stellen mit mehreren Standorten verbergen nicht mehr die Hälfte ihrer Standorte.** Lever legt eine primäre Stadt in `location` und den Rest in `allLocations`; nur die primäre zu lesen ließ eine in Barcelona UND Montevideo offene Stelle Barcelona-only erscheinen (und wurde von einem Standortfilter fälschlich verworfen). Beide werden nun zusammengeführt.

### Hinweise
- Sanfteres Tempo zwischen Seiten (250 ms statt 150) auf den paginierten Boards, aus Höflichkeit gegenüber Single-Host-Karriereseiten. Scan-Quellen: **81** (76 englische + 5 russische) — unverändert (Job Bank rein, EchoJobs raus). Test-Suite: **2685**.



## [1.211.0] — 2026-08-19

**Hinzugefügt — Yourator, ein taiwanisches Tech-Job-Board. Behoben — akzentuierte Titel-/Firmennamen-Entities werden nun überall dekodiert, und ein Unternehmen mit einem Akzent im Namen wird nicht mehr fälschlich markiert.**

### Hinzugefügt
- **Yourator** (yourator.co) — eine neue token-freie Scan-Quelle für den taiwanischen Tech- und Digital-Arbeitsmarkt. Wähle sie im **Quelle**-Filter auf `#/scan`, oder füge ein Unternehmen mit `provider: yourator` hinzu. Sie liest die öffentliche JSON-API (kein Schlüssel, kein Browser), durchläuft jede Seite des Boards und gibt den echten Arbeitgeber-Link jeder Anzeige (dessen eigenes ATS) mit entfernten Tracking-Parametern aus.

### Behoben
- **Akzentuierte benannte Entities werden nun überall dekodiert.** Der geteilte HTML-Decoder erhielt die Latin-1-Buchstaben (`&eacute;` → é, `&ccedil;` → ç, …), sodass ein europäisches Board, das `D&eacute;veloppeur` oder `Fran&ccedil;ais` schreibt, diesen Literal nicht mehr in einem Titel, dem Tracker oder einem generierten Dokument hinterlässt. (Großbuchstaben bleiben groß — `&Eacute;` ist É, nicht é — und eine Suche wie `&constructor;` löst sich nun auf sich selbst auf.)
- **Ein Unternehmen mit einem Akzent im Namen wird nicht mehr fälschlich markiert**, weil es auf seiner eigenen Domain liegt. „Işık" faltet sich nun zu „isik" und passt zu isik.com.tr; „Société Générale" passt zu societegenerale.com. Die alte Prüfung löschte akzentuierte Buchstaben, statt sie auf ihre ASCII-Basis zu falten.

### Hinweise
- Scan-Quellen: **81** (76 englische + 5 russische). Test-Suite: **2667**.



## [1.210.1] — 2026-08-19

**Behoben — Habr-Career-Stellentitel und Firmennamen mit „&" oder Anführungszeichen kommen nicht mehr verstümmelt an.**

### Behoben
- Die Habr-Career-Quelle dekodiert nun HTML-Entities im **Titel** und im **Firmennamen**, bevor sie weiterlaufen. Die serverseitig gerenderten Karten kommen escaped an („Changellenge &gt;&gt;", „Demand Forecasting &amp; Inventory Optimization", „ООО &quot;М-ТЕХ&quot;"), sodass ein nicht dekodiertes „&" still an deinem eigenen „&"-Titelfilter scheiterte — genau das Symptom, das die vorige Version auf fünf anderen Boards geschlossen hat — und Firmennamen verstümmelt im Tracker und in Berichten ankamen. Die Entity-Dekodierung ist nun über alle sechs betroffenen Quellen vollständig.

### Hinweise
- Test-Suite: **2644**.



## [1.210.0] — 2026-08-19

**Hinzugefügt — Senjob, das erste afrikanische Job-Board des Scanners (Senegal); präziserer Titelabgleich auf fünf weiteren Boards.**

### Hinzugefügt
- **Senjob** (senjob.com) — eine neue token-freie Scan-Quelle für den Senegal, das erste afrikanische Board des Scanners. Wähle sie im **Quelle**-Filter auf `#/scan`, oder füge ein Unternehmen mit `provider: senjob` hinzu. Sie liest die öffentliche Liste über einfaches HTTP (kein Schlüssel, kein Browser), pinnt jede Anfrage an senjob.com und behandelt — da sie HTML parst — eine Liste, die plötzlich nichts mehr liefert, als kaputtes Board (ein sichtbarer Fehler) statt als Land ohne Jobs.

### Behoben
- **Titel mit „&" lassen auf fünf Boards keine Jobs mehr fallen** — auf beesite, Cornerstone (csod), Hacker News „Who is hiring", Phenom und TKMS kommen Titel HTML-escaped an, sodass ein escaptes „&" in einer Rolle wie "R&D Engineer" an deinem eigenen Stichwort "r&d" scheiterte und die Anzeige still verschwand (ein "sales & marketing"-Veto löste ebenfalls nie aus). Titel — und Phenom-Standorte — werden nun vor dem Filtern dekodiert.

### Hinweise
- Scan-Quellen: **80** (75 englische + 5 russische). Test-Suite: **2643**.



## [1.209.0] — 2026-08-17

**Hinzugefügt — die In-App-Hilfe deckt jetzt das Festhalten des Ergebnisses einer Bewerbung ab, und „Frag die Doku" kann dich dorthin führen.**

### Hinzugefügt
- Die Tracker-Hilfe (§11) erhielt in allen 17 Sprachen einen Abschnitt „Ein Ergebnis festhalten", der die Schaltfläche **Ergebnis** durchgeht: Wähle, was passiert ist (abgelehnt / Angebot / eingestellt / abgelehnt / geghostet / zum Interview vorgerückt), sieh in der Vorschau, was sie tun wird, und halte es fest — das notiert das Ergebnis, archiviert den eingereichten Lebenslauf und das Anschreiben und synchronisiert den Status der Zeile für dich. Der schwebende „Frag die Doku"-Assistent liest den Leitfaden, also führt er dich jetzt zu dieser Schaltfläche, statt nur vorzuschlagen, den Status von Hand zu bearbeiten.

### Hinweise
- Jedes Hilfe-Bundle ist jetzt 31 H2 / 119 H3 (vorher 118); die Paritäts-Wächter wurden angehoben. Nur Dokumentation — keine Code- oder Verhaltensänderung. Suite: **2625**.



## [1.208.2] — 2026-08-16

**Behoben — auf dem Handy liegen die Benachrichtigungs- und Design-Buttons nicht mehr über dem Suchfeld.**

### Behoben
- v1.208.1 sorgte dafür, dass die Buttons der oberen Leiste die Seitenüberschrift nicht mehr überlappen, aber auf einem schmalen — wenn auch nicht schmalsten — Handy, besonders in Sprachen mit längeren Button-Texten, quetschte sich die ganze Leiste weiter in eine Zeile, sodass die Buttons 🔔 und 🌙 über dem Suchfeld landen konnten. Die Aktions-Buttons (Benachrichtigungen, Design, Diagnose, Scan öffnen) rücken auf dem Handy nun stets in ihre eigene, volle Breite einnehmende zweite Zeile, sodass das Suchfeld voll lesbar bleibt und nichts überlappt.

### Hinweise
- Auf dem Handy wandern die Aktions-Buttons der Leiste in eine zweite Zeile über die volle Breite und beseitigen das fragile Band der „fast vollen Zeile“, in dem das Layout den übrigen negativen Raum als Überlappung verteilte. Ein Playwright-Wächter reproduziert nun den genauen Auslöser — eine Sprache mit langen Texten über das Band 565–640px — und stellt sicher, dass sich die Bedienelemente der Leiste nie Pixel teilen. Suite: **2621**.



## [1.208.1] — 2026-08-16

**Behoben — auf dem Handy überlappen die Buttons der oberen Leiste die Seite nicht mehr.**

### Behoben
- v1.208.0 brach die Buttons der oberen Leiste (Diagnose, Scan öffnen, Benachrichtigungen, Design) auf schmalen Bildschirmen in eine zweite Zeile um, aber die Leiste behielt eine feste Höhe, sodass die umgebrochene Zeile herausquoll und über der Seitenüberschrift lag. Die Leiste **wächst** nun, um ihre Zeilen aufzunehmen, und der Inhalt fließt darunter.

### Hinweise
- Die feste `height` der Leiste wurde zu `min-height`, sodass sie bei jeder Breite mit ihrem Inhalt wächst (Desktop unverändert). Ein Playwright-Wächter prüft nun auch, dass die Leiste nicht über die Seite quillt. Suite: **2621**.



## [1.208.0] — 2026-08-16

**Behoben — die App passt jetzt auf einen Handy-Bildschirm: kein seitliches Scrollen mehr.**

### Behoben
- Auf einem schmalen Bildschirm rutschte die ganze App zur Seite — die obere Leiste, Tabellen, Hilfeartikel und Einstellungs-Tabs liefen über den rechten Rand hinaus. Jetzt passt jede Seite in jede Breite: die Buttons der oberen Leiste brechen in eine zweite Zeile um, breite Tabellen und Codeblöcke scrollen in ihrer eigenen Box, die Hilfe stapelt das Inhaltsverzeichnis über dem Artikel, Button-/Tab-Reihen brechen um, und lange Pfade oder URLs brechen um, statt die Seite zu strecken.

### Hinweise
- Ursache war die klassische Flex/Grid-**min-width: auto**-Falle plus ein paar nicht umschlossene breite Elemente; behoben mit `min-width: 0` auf Grid-Items, `overflow-wrap` auf Markdown/Titeln, einer scrollbaren Markdown-Tabelle und dem Stapeln des Hilfe-Grids am Mobile-Breakpoint. Ein Playwright-Wächter prüft **0 horizontalen Überlauf bei 375 px** auf den Hauptrouten. `tests/playwright-smoke.mjs`. Suite: **2621**.



## [1.207.2] — 2026-08-16

**Behoben — KI-Pläne und Karriere-Orientierungsprofile werden nicht mehr als roher Code-Dump dargestellt.**

### Behoben
- Manche Modelle packen ihre ganze Antwort in einen ```markdown … ``` Code-Zaun. Wenn das passierte, erschienen der **Entwicklungsplan** und das **Orientierungsprofil** als Monospace-Codeblock statt als Dokument mit Überschriften und Listen. Der umschließende Zaun wird jetzt entfernt — nur wenn er die gesamte Antwort umschließt und die Sprache ausdrücklich `markdown`/`md` ist, sodass eine echte `python`/`js`/``` -ohne-Sprache-Codeantwort unangetastet bleibt.

### Hinweise
- Einmalig im gemeinsamen LLM-Aufräumschritt (`cleanLlmMarkdown`) behandelt, sodass alle KI-Routen profitieren und innere Codeblöcke in der umschlossenen Antwort erhalten bleiben. `tests/llm-output.test.mjs` (+3). Suite: **2621**.



## [1.207.1] — 2026-08-16

**Behoben — die Landingpage läuft auf kleinen Handys nicht mehr seitlich über.**

### Behoben
- Auf einem schmalen Handy konnte der Hero-Bereich — die Überschrift, die Einleitungszeile und das Installations-Terminal — am rechten Rand abgeschnitten werden, weil ein langer Installationsbefehl und die Layout-Spalten nicht auf den Bildschirm schrumpften. Sie passen jetzt in jede Breite; der Installationsbefehl scrollt in seinem eigenen Terminal-Kasten.

### Hinweise
- Außerdem wurde ein instabiler E2E-Smoke-Check gehärtet, der an einem vorübergehenden Ressourcen-404 scheitern konnte: er ignoriert nun harmloses Netzwerkrauschen (Favicon / Verbindung / fehlgeschlagene Ressource) wie die Nachbar-Checks, fängt aber weiterhin echte Skriptfehler. Kein geändertes App-Verhalten. Suite: **2618**.



## [1.207.0] — 2026-08-15

**Hinzugefügt — halte das Ergebnis einer Bewerbung direkt im Tracker fest.**

### Hinzugefügt
- Jede Tracker-Zeile erhält eine **Ergebnis**-Aktion: wähle, was passiert ist (abgelehnt, Angebot erhalten, eingestellt, Angebot abgelehnt, keine Antwort, ins Interview vorgerückt), füge eine optionale Notiz hinzu, **sieh dir den resultierenden Status als Vorschau an** und erfasse ihn. Das Erfassen archiviert die eingereichten CV- und Anschreiben-Artefakte und synchronisiert den Tracker auf den kanonischen Status — eine deterministische Aktion statt manuellem Bearbeiten.

### Hinweise
- Neue `POST /api/outcome` leitet die Ergebnis-CLI weiter: `dryRun:true` ist eine schreibgeschützte Vorschau (findet die Zeile, meldet den resultierenden Status, schreibt nichts); ein echter Aufruf erfasst ihn. Schreibsicherheit: der Ergebnistyp ist auf die bekannte Menge beschränkt und jedes Textfeld wird bei Steuerzeichen vor dem Aufruf abgelehnt (Array-Argumente, spawn — keine Shell). `tests/outcome-route.test.mjs`. Suite: **2618**.



## [1.206.0] — 2026-08-15

**Dokumentation — der integrierte Hilfe-Guide deckt jetzt die fünf neuesten Funktionen in allen 17 Sprachen ab.**

### Hinzugefügt
- Der integrierte Hilfe-Guide — und der «Hilfe fragen»-Assistent, der daraus antwortet — dokumentiert jetzt fünf kürzlich ergänzte Funktionen: **Setup-Doktor** (Einstellungen — prüft dein CV und Profil auf Lücken und übrig gebliebene Beispieldaten), **ATS-Boards finden** (Portale — findet automatisch das Karriere-Board eines Unternehmens), die **«noch offen?»-Prüfung** (Tracker — ob eine Stelle noch offen ist), den **«früheres CV wiederverwenden?»-Hinweis** (CV Studio — meldet, wenn ein bereits angepasstes CV zu einer neuen Stelle passt) und das **Skill-Log** (Analyse — Selbsteinschätzungs-Scores erfassen). Fünf neue Unterabschnitte, übersetzt in alle 17 Sprachen.

### Hinweise
- Die Guide-Struktur wächst auf 31 H2 / 118 H3, Parität in jeder Sprache garantiert. Referenzdokumentation aktualisiert: `docs/architecture/API.md` dokumentiert die fünf Routen dieser Funktionen, und die Routen-/Versionszähler in `CLAUDE.md` und `docs/sdd/CONVENTIONS.md` sind aktuell (36 Routenmodule). Suite: **2610**.



## [1.205.0] — 2026-08-15

**Hinzugefügt — ein Skill-Log zum Festhalten von Test-/Assessment-Ergebnissen.**

### Hinzugefügt
- Ein neues **Skill-Log** (Analyse → Skill-Log) lässt dich eine Selbsteinschätzung festhalten — Firma, Plattform, Skill, Score % und eine optionale Notiz — angehängt an `data/assessments.tsv`, mit einer Liste früherer Einträge (neueste zuerst). Tokenfrei, deterministisch; das Dateiformat verwaltet die CLI des Elternprojekts.

### Hinweise
- Neue `GET /api/assessments` (leitet die Standard-JSON-Liste von `assessment-log.mjs` weiter; weiches Scheitern `{available:false}`) + `POST /api/assessments` (explizites Schreiben: Felder als **Array-Argumente** an `assessment-log.mjs add`). Schreibsicherheit: jedes Textfeld mit einem Steuerzeichen wird abgewiesen (ein TAB würde eine Spalte zerstören, ein Zeilenumbruch eine Zeile einschleusen) → 400 vor dem Schreiben; Score/Schwelle auf 0–100 begrenzt, Längen beschränkt. `tests/assessments-route.test.mjs`. Suite: **2610**.


## [1.204.0] — 2026-08-15

**Hinzugefügt — ein "Einrichtungs-Doktor"-Panel in den Einstellungen, das einen unvollständigen oder Beispieldaten-CV/Profil meldet.**

### Hinzugefügt
- **Einstellungen → Einrichtungs-Doktor** prüft jetzt tokenfrei dein `cv.md` und `config/profile.yml` und listet **blockierende Probleme** (fehlende Dateien/Felder) und **Warnungen** (übrig gebliebene Beispiel-/Platzhalterdaten, hartkodierte Kennzahlen) — damit du eine unvollständige Einrichtung erkennst, bevor sie deine Scans und Zuschnitte schwächt. Nur lesend; per Klick neu ausführbar.

### Hinweise
- Neue nur lesende `GET /api/cv-sync-check` leitet das `cv-sync-check.mjs` des Elternprojekts weiter, das Text + einen Exit-Code ausgibt (kein `--json`); die Route parst dessen stabile `ERROR:` / `WARN:`-Zeilen leicht zu `{ok, errors[], warnings[]}` — das Banner, nicht der Exit-Code, entscheidet über den Erfolg. Weiches Scheitern `{available:false}` bei eigenständigen Installationen. `tests/cv-sync-check-route.test.mjs`. Suite: **2602**.


## [1.203.0] — 2026-08-15

**Hinzugefügt — ein "früheren Lebenslauf wiederverwenden?"-Hinweis im CV Studio.**

### Hinzugefügt
- Wenn du im **CV Studio** eine gespeicherte Stellenanzeige öffnest, vergleicht die App sie jetzt mit deinen anderen gespeicherten Anzeigen (deterministische Wortüberlappung, **null Tokens**) und sagt dir, ob die nächste ähnlich genug ist, um den zugeschnittenen Lebenslauf **wiederzuverwenden**, ihn **mit Änderungen** wiederzuverwenden oder **einen neuen zuzuschneiden** — damit du für eine bereits anvisierte Rolle nicht von vorn beginnst.

### Hinweise
- Neue nur lesende `GET /api/jds/:name/reuse` leitet das `jd-similarity.mjs` des Elternprojekts weiter (Jaccard-Überlappung + Senioritäts-Guard; JSON `{decision, score, reason}`) einmal pro früherer Anzeige (Fan-out auf 25 begrenzt, bester Treffer gewinnt); weiches Scheitern `{available:false}`, wenn Skript oder frühere Anzeigen fehlen. `tests/jd-similarity-reuse-route.test.mjs`. Suite: **2594**.


## [1.202.0] — 2026-08-15

**Hinzugefügt — finde das ATS-Jobboard eines Unternehmens von #/portals aus und verfolge es.**

### Hinzugefügt
- Auf **#/portals** gibst du einen Firmennamen ein, und die App prüft **Greenhouse, Ashby und Lever** auf dessen öffentliches Board — **null LLM, kein Browser** — und zeigt die Boards, die existieren und aktuell ≥1 Job listen. Ein Klick fügt das gewählte Board den Firmen hinzu, die dein Scanner beobachtet. Das Prüfen ist schreibgeschützt; die Schreibaktion in `portals.yml` erfolgt nur beim Klick auf **Hinzufügen**.

### Hinweise
- Neue `server/lib/discover-ats.mjs` (Slug-Probe mit festem Host und charset-validiert über das DNS-gepinnte `safeGet`, ≤12 Proben/Anfrage) + `POST /api/portals/discover` (nur lesen) und `POST /api/portals/track` (explizites Schreiben: `withFileLock` + chirurgisches Text-Splicing + Re-Parse-Guard + atomares Umbenennen; nur bekannte ATS-Hosts, idempotent). Verwendet die Adapter-Registry des Scanners wieder. i18n ×17. `tests/discover-ats-resolver.test.mjs` + `tests/discover-ats-route.test.mjs`. Suite: **2588**.


## [1.201.0] — 2026-08-15

**Behoben — ein Tracker mit lokalisierten oder abweichenden Spaltenüberschriften wird nicht mehr leer angezeigt.**

### Behoben
- Wenn deine `data/applications.md` nicht-englische oder abweichende Überschriften nutzt — spanisch `empresa` / `puesto` / `estado` / `fecha` / `enlace` oder `position` / `stage` / `link` — las der Tracker sie unter den falschen Schlüsseln und zeigte **leere Spalten Firma / Rolle / Status / Datum / Link**. Diese Überschriften werden nun auf die kanonischen Feldnamen gefaltet, sodass der Tracker korrekt anzeigt. Ein rein englischer Tracker wird wie zuvor geparst.

### Hinweise
- Neue `HEADER_ALIASES`-Tabelle + eine Normalisierungsfaltung in `parseApplications` (`server/lib/parsers.mjs`); unbekannte oder bereits kanonische Überschriften passieren unverändert. `tests/tracker-header-aliases.test.mjs`. Suite: **2563**.


## [1.200.0] — 2026-08-15

**Hinzugefügt — ein "Noch aktiv?"-Check mit einem Klick für ATS-gehostete Jobs in deinem Tracker.**

### Hinzugefügt
- Auf **#/tracker** zeigt eine Bewerbung, deren URL ein Greenhouse- / Lever- / Ashby- / Workday- / SmartRecruiters-Posting ist, jetzt einen **"Noch aktiv?"**-Button. Ein Klick fragt das öffentliche JSON des ATS selbst ab — **null Tokens, kein Browser** — und zeigt **Aktiv / Abgelaufen / Unbekannt**, damit du tote Ausschreibungen findest, ohne jede zu öffnen. Konservativ ausgelegt: nur ein eindeutiges 404/410 gilt als *Abgelaufen*; alles Mehrdeutige bleibt *Unbekannt* (nie ein falsches *Abgelaufen*).

### Hinweise
- Neue `server/lib/liveness-core.mjs` + `liveness-api.mjs` und eine nur lesende `GET /api/liveness?url=` (keine Schreibvorgänge, kein LLM). SSRF-sicher: Die URL läuft durch `isValidJobUrl`, dann wird die ATS-API nur über das DNS-gepinnte `safeGet` mit festem Host und charset-validierten Pfadsegmenten erreicht. `tests/liveness-core.test.mjs` + `tests/liveness-route.test.mjs`. Suite: **2557**.


## [1.199.0] — 2026-08-15

**Behoben — breite Tabellen scrollen jetzt seitwärts, statt abgeschnitten zu werden.**

### Behoben
- Auf der **Scan**-Seite (und in allen anderen Tabellen — Tracker, Statistik, Nutzung, Dashboard) wurde eine Tabelle, die breiter als das Fenster war, **ohne Bildlaufleiste abgeschnitten**, sodass die rechten Spalten unerreichbar waren. Breite Tabellen zeigen jetzt bei Bedarf eine **horizontale Bildlaufleiste**, sodass jede Spalte in jeder Breite erreichbar bleibt.

### Hinweise
- `.table-wrap` in `public/css/components.css` wechselte von `overflow: hidden` zu `overflow-x: auto` (wie der bestehende `.reports-scroll`-Container); der abgerundete Rahmen bleibt erhalten. `tests/table-wrap-scroll.test.mjs`. Suite: **2540**.


## [1.198.0] — 2026-08-15

**Hinzugefügt — Scan-Wiederholungen nutzen jetzt exponentielles Backoff, Jitter und respektieren das `Retry-After` eines Rate-Limiters.**

### Hinzugefügt
- Wenn ein Jobboard mitten im Scan kurz drosselt oder fehlschlägt (HTTP 429 / 5xx), wartet die Wiederholung jetzt mit **exponentiellem Backoff + Jitter** statt einer festen kurzen Verzögerung — ein ausgelastetes Board wird nicht im gleichen Takt weiter gehämmert, und gleichzeitige Wiederholungen kollidieren nicht erneut im Gleichschritt. Ein `Retry-After` vom Board wird **respektiert** (aber geklemmt, damit ein feindseliges `Retry-After: 86400` nicht den ganzen Scan blockiert). Permanente Fehler (404, abgelehnte Weiterleitungen) schlagen weiterhin sofort fehl — unverändert.

### Hinweise
- Neue `parseRetryAfterMs()` und die reine `computeRetryDelayMs()` in `server/lib/http-json.mjs`; `fetchJson` erfasst jetzt `.retryAfter` bei einer nicht-ok-Antwort, und `fetchJsonWithRetry` nimmt ein optionales `maxDelayMs` (Standard 8000). `tests/http-json.test.mjs` (+9). Suite: **2536**.


## [1.197.0] — 2026-08-14

**Hinzugefügt — verfolge ein Getro-VC-Jobboard allein über seine `careers_url`; die Collection-ID löst sich automatisch auf.**

### Hinzugefügt
- Ein verfolgtes Getro-Board (b2venture, Earlybird, Point Nine, …) braucht keine von Hand herausgesuchte numerische `getro_collection` mehr. Gib die eigene `careers_url` des Boards an, und die ID **löst sich** beim ersten Scan **automatisch** aus dieser Seite auf — ein einziges SSRF-sicheres GET liest die numerische `network.id` direkt aus den eingebetteten Seitendaten. Eine explizite `getro_collection` gewinnt weiterhin und überspringt den Abruf vollständig.

### Hinweise
- Neue `httpsCareersUrl()`, `extractCollectionId()` und das asynchrone `resolveCollectionId()` in `server/lib/sources/getro.mjs`; die Board-Seite wird über `safeGet` (DNS-fixiert, größenbegrenzt) abgerufen, und die aufgelöste ID bleibt per `assertGetroUrl` an den Host `api.getro.com` gebunden. Der Adapter passt jetzt auf einen `provider: getro`-Eintrag mit einer https-`careers_url`, auch ohne ID. `tests/sources-getro.test.mjs` (+8). Suite: **2527**.


## [1.196.0] — 2026-08-14

**Behoben (Sicherheit) — der Workday-Adapter validiert einen `api`-Endpunkt über seinen Hostnamen, nicht über eine Teilzeichenfolge.**

### Behoben
- Ein Workday-`api:`-Wert in `portals.yml` wird jetzt nur akzeptiert, wenn sein **Hostname** `myworkdayjobs.com` (oder eine `.myworkdayjobs.com`-Subdomain) ist. Die alte Prüfung war ein Teilzeichenfolgen-Match, sodass jede URL, die die Zeichenfolge nur enthielt — z. B. `https://example.com/?x=myworkdayjobs.com` — durchkam und als Endpunkt verwendet worden wäre. Echte Workday-Endpunkte sind nicht betroffen. (Von CodeQL gemeldet, #443.)

### Hinweise
- Neues `isWorkdayApi()` parst die URL und prüft den Host (`server/lib/portals/adapters/workday.mjs`). `tests/workday-adapter-endpoint.test.mjs` (+1). Suite: **2522**.


## [1.195.0] — 2026-08-14

**Performance (Scanner) — die Repost-Erkennung bleibt bei großen Scan-Historien schnell.**

### Performance
- Die Duplikat-Erkennung entartet auf einer großen `scan-history.tsv` nicht mehr zu O(N²). Die Titel-Gruppierung pro Firma war eine verschachtelte Schleife, die pro Paar ein volles `roleFuzzyMatch` zahlte; jetzt ist es ein invertierter Index — Zeilen in einem Durchgang nach exaktem Titel bucketen, dann Fuzzy-Match nur zwischen VERSCHIEDENEN Buckets, die einen unterscheidenden (Nicht-Baseline-)Token teilen. **Die Ausgabe ist identisch** — dieselben Repost-Cluster — bewiesen durch einen Differenztest gegen den alten Algorithmus über 200+ zufällige Historien.

### Hinweise
- `groupRowsByTitle` in `server/lib/detect-reposts.mjs` (für den Differenztest exportiert). `tests/detect-reposts-grouping.test.mjs` (+2). Suite: **2521**.


## [1.194.0] — 2026-08-14

**Behoben (Scanner) — Workday-Karriereseiten mit einer Ein-Segment-URL werden jetzt korrekt gescannt.**

### Behoben
- Der Workday-Adapter parst nun Karriere-URLs, deren Pfad ein einzelnes Segment ist — z. B. `https://parsons.wd5.myworkdayjobs.com/Search`, `.../KBR_Careers`, `.../Careers`. Zuvor fiel die Site auf `External` zurück, der Adapter traf den falschen CXS-Endpunkt, und eine Probe konnte gesund aussehen, ohne etwas zurückzugeben. Er nimmt jetzt das erste nicht-leere Pfadsegment als Site (und lässt ein Sprachpräfix wie `en-US` weg); der dokumentierte Fall `/en-US/External` bleibt unverändert. (Gemeldet in #255.)

### Hinweise
- Strukturelles Pfad-Parsing in `server/lib/portals/adapters/workday.mjs`. `tests/workday-adapter-endpoint.test.mjs` (+7). Suite: **2519**.


## [1.193.0] — 2026-08-14

**Hinzugefügt (Statistik) — ein "Stille nach dem Gespräch"-Tab, der Gespräche zum Nachfassen zeigt.**

### Hinzugefügt
- Ein **Stille nach dem Gespräch**-Tab in `#/stats`: Gespräche, die nach einem Kulanzfenster (Standard 30 Tage) verstummt sind, verbindet deine aktiven Gespräche und den Tracker — mit der Stille-Dauer, dem letzten Gesprächsdatum und dem Grund. Eine sanfte Erinnerungs-/Abschlussliste; nur Vorschläge, nie eine Absage-Behauptung. Ohne Token.

### Hinweise
- Neue Route `GET /api/stats/rejection-latency` (fail-soft `{available:false}`). `tests/stats-rejection-latency-route.test.mjs` (+2). +10 i18n-Schlüssel ×17; `#/stats` help-hint von 7→8 Tabs. Suite: **2510**.


## [1.192.0] — 2026-08-14

**Hinzugefügt (cv-studio) — ein "Fakten im Lebenslauf prüfen"-Wächter, der Zahlen findet, die du nie hattest.**

### Hinzugefügt
- Eine **Fakten im Lebenslauf prüfen**-Karte in `#/cv-studio`: füge einen angepassten Lebenslauf oder ein Anschreiben ein und prüfe jede behauptete Kennzahl und Tatsache gegen deinen echten Lebenslauf, dein Profil und den Two-Pager. Du bekommst ein **pass / warn / block**-Urteil plus die genauen erfundenen Kennzahlen, unbelegten Fakten und verbotenen / hinweisenden Phrasen. Kein LLM; nichts wird geschrieben.

### Hinweise
- Neue Route `POST /api/cv-studio/verify-facts`: schreibt den Text in eine Einweg-Temp-Datei und führt `verify-cv-facts.mjs` aus, wobei sie dem JSON-Urteil vertraut, auch wenn das Skript bei block mit 1 endet. `tests/cv-studio-verify-facts-route.test.mjs` (+4). +15 i18n-Schlüssel ×17. Suite: **2508**.


## [1.191.0] — 2026-08-14

**Hinzugefügt (Statistik) — ein "Was als Nächstes lernen"-Tab, der die zuerst zu lernenden Fähigkeiten rankt.**

### Hinzugefügt
- Ein **Was als Nächstes lernen**-Tab in `#/stats`: eine tracker-weite Auswertung — die fehlenden Fähigkeiten, die am häufigsten eine schwache Passung versenkt haben, gewichtet (nach 5−Passungswert je Bericht) und gestuft **Critical / High / Medium** — plus die von deinem CV/Profil bereits abgedeckten. Schreibgeschützt, nur Vorschläge, ohne Token.

### Hinweise
- Neue Route `GET /api/stats/upskill` (`{ error }`-Feld bei zu wenig Daten; fail-soft `{available:false}`). `tests/stats-upskill-route.test.mjs` (+3). +15 i18n-Schlüssel ×17. Suite: **2504**.


## [1.190.0] — 2026-08-14

**Hinzugefügt (Tracker) — ein "Firmenhistorie"-Panel, das zeigt, welche Firmen dir tatsächlich antworten.**

### Hinzugefügt
- Eine **Firmenhistorie**-Karte auf `#/tracker`: wähle eine Firma und erhalte schreibgeschützte Belege — wie sehr sie dir geantwortet hat (**schweigt dir gegenüber** / **gemischt** / **hat schon geantwortet**) und ob dieselbe Stelle immer wieder **neu ausgeschrieben** wird — verbunden aus Tracker, Follow-ups und Scan-Historie. Ohne Token; der Scanner wird nie aufgerufen.

### Hinweise
- Neue Route `GET /api/stats/company-history[?company=]` (fail-soft `{available:false}`). `tests/stats-company-history-route.test.mjs` (+3). +18 i18n-Schlüssel ×17. Suite: **2501**.


## [1.189.0] — 2026-08-14

**Behoben (Scanner) — als römische Ziffern geschriebene Senioritätsstufen zählen jetzt auch bei nicht-lateinischen Titeln.**

### Behoben
- Der Tier-Klassifikator hinter `skip_tiers` liest jetzt ein Stufensuffix in römischen Ziffern (I / II / III / IV / V) nach dem Berufswort in **jeder Schrift** — „Инженер III", „エンジニア I", „Ingénieur IV" — nicht nur nach ASCII-Wörtern. Zuvor wurde eine Stufenzahl nach einem nicht-lateinischen Wort ignoriert und die Stelle fiel auf **mid**, sodass `skip_tiers: [senior]` oder `[entry]` sie verpasste.

### Hinweise
- Schriftunabhängiges Lookbehind in `server/lib/classify-tier.mjs`; toter doppelter `Sr.`-Matcher entfernt. `tests/classify-tier.test.mjs` (+1). Suite: **2498**.


## [1.188.0] — 2026-08-14

**Behoben (UI) — die primären Aktionsschaltflächen kleben nicht mehr am Seitentitel-Untertitel.**

### Behoben
- Die primäre Aktions-/Steuerzeile auf **Wöchentliches Interview-Digest**, **Finanzierte Unternehmen**, **Portale**, **Karriereplan** und **Berufsorientierung** hat jetzt einen passenden oberen Abstand, sodass die Schaltfläche unter dem Untertitel Luft bekommt, statt daran zu stoßen.

### Hinweise
- Regressions-Guard `tests/lead-row-top-margin.test.mjs` (+5). Suite: **2497**.

## [1.187.0] — 2026-08-14

**Behoben (Scanner) — die `skip_tiers`-Einstellung greift wieder: Stellen, die du nach Seniorität überspringen wolltest, werden verworfen.**

### Behoben
- Eine `skip_tiers:`-Liste in `portals.yml` (z. B. `skip_tiers: [intern, entry]`) wird jetzt beim Scan beachtet. Der Titel jeder Stelle wird in eine Senioritätsstufe (intern / entry / mid / senior) eingeordnet und verworfen, wenn die Stufe auf deiner Liste steht. Zuvor liefen die Titel- / Standort- / Inhalts- / Trust-Filter, aber kein Stufenfilter, sodass `skip_tiers` still ignoriert wurde. Titel ohne Level-Wort fallen auf **mid** (also verwirft `skip_tiers: [mid]` auch die meisten gewöhnlichen Stellen), und der Klassifizierer liest das LINKESTE Level-Wort.

### Hinweise
- Neues reines Modul `server/lib/classify-tier.mjs` (`classifyTier` + `buildTierFilter`), eingebunden in die Filterketten des EN- und RU-Scanners. `tests/classify-tier.test.mjs` (+7). Suite: **2492**.

## [1.186.0] — 2026-08-14

**Hinzugefügt (CV Studio) — ein "Skill-Gap"-Panel: welche der geforderten Fähigkeiten einer Stelle dein CV nennt, andeutet oder fehlt.**

### Hinzugefügt
- Ein neues **Skill-Gap**-Panel in **CV Studio**. Wähle eine gespeicherte Stellenbeschreibung, und es sortiert jede geforderte Fähigkeit in **im CV genannt**, **im CV angedeutet** oder **fehlend** — Wortvergleich ohne LLM, nichts wird geschrieben. Ein Hinweis auf geringe Zuverlässigkeit erscheint, wenn die Stelle keinen klaren Anforderungsabschnitt hatte.

### Hinweise
- Neuer `GET /api/jds/:name/skill-gap` (der Stellenname wird pfad-bereinigt und unter `jds/` bestätigt, bevor er ein Argument wird; weicher Fallback auf `{available:false}` ohne das Skript). +13 i18n-Schlüssel ×17. Tests: `tests/jds-skill-gap-route.test.mjs` (+4, inkl. Path-Traversal-Ablehnung). Suite: **2485**.

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
