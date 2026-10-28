# Changelog (Italiano)

> Questo changelog contiene ora la cronologia completa delle versioni. Le voci pubblicate prima della localizzazione italiana (v1.85.0) compaiono sotto nell'originale inglese — traduzione in attesa; il riferimento resta [🇬🇧 CHANGELOG.md](CHANGELOG.md).

## [1.261.1] — 2026-10-28

**La patch client del QA di produzione: un fix di crash P1 per `#/two-pager`, Ctrl+K funzionante sui layout non-QWERTY, l'onda mobile da 390px (overflow del docs-assistant, sovrapposizione dei chip della mappa, un harness da 39 rotte), il completamento di CAR-137 (errori specifici, v2empty ×5, hint ×13 + mode-page) e CAR-140 che fa atterrare screenshot v2 reali ovunque.**

### Corretto

- **TDZ del two-pager (CAR-170, P1, #554)**: `Cannot access 'previewTimer' before initialization` — l'editor dei tag salvati sparava `onChange` durante la costruzione per ogni chip ripristinata mentre il loop di costruzione si trovava lessicalmente sopra `let previewTimer`, così l'intero render di `#/two-pager` andava in crash (nessun h1, ×19 locale). Scheduler e binding ora vivono sopra il loop; un test comportamentale esegue il modulo reale della vista — l'esatto errore di produzione prima del fix, una pagina renderizzata dopo — più un gate di deriva sull'ordine lessicale.
- **Ctrl+K sui layout non-QWERTY (CAR-172, #554)**: entrambi gli handler dei chord combaciavano solo su `e.key` — su un layout russo il chord arriva come `key='л' code='KeyK'` e non faceva nulla. Il match ora avviene su `e.code === 'KeyK'` in nav-v2.js e app.js; riprodotto in un browser reale con un chord sintetico 'л'/KeyK. Il contratto di CAR-122 è riformulato (vedi Note).
- **Overflow del docs-assistant a 390px (CAR-172, #554)**: i chip iniziali di CAR-136 erano `.btn` (nowrap, `flex-shrink: 0`) — un elemento infrangibile da 418px spingeva `#/docs-assistant` 56px oltre un viewport di 390px; il pattern di shrink di CAR-146 (in v2-llm.css, i gate CSS sugli 800-LOC intatti) lo riporta a 0.
- **Sovrapposizione dei chip della mappa @390 (#552)**: su un viewport di 390px i chip meta della mappa si sovrapponevano alla riga CTA (map.css).
- **CAR-137 — errori specifici + v2empty ×5 (#550)**: cinque fallback di errore generici ('Error' / 'failed') sono diventati chiavi specifiche e azionabili — fallimento del POST di evaluate, stream dell'auto-pipeline senza un evento terminale, aggiunta a pipeline dalla scan, caricamento dei cluster di repost, undo della pipeline; gli ultimi cinque empty state piatti (`#/reports`, `#/usage`, `#/portals`, `#/activity`, `#/dashboard`) si uniscono al pattern v2empty di CAR-124 (spiegazione + esempio taggato aria-hidden + azione pre-cablata; 15 nuove chiavi `v2empty.*`, quattro chiavi morte di una sola riga rimosse) — tutto ×19 dizionari, snapshot rigenerato.
- **CAR-137 — HelpHint ×13 + kit delle mode-page (#550)**: l'hint contestuale «?» ora siede sull'H1 di ogni pagina rimanente (pipeline, reports, dashboard, cv, portals, usage, activity, assessments, map, health, docs-assistant, settings) e sulle 8 mode-page tramite il kit (ogni cfg MODES porta una `hintKey`, renderizzata tramite `HelpHint.title`).

### Aggiunto

- **Harness mobile-390 (#552)**: uno sweep Playwright di ogni rotta SPA (31 canoniche + 8 mode-page = 39 hash) a 390×844 con un corpus seminato — controllo dell'overflow orizzontale per rotta (scrollWidth vs clientWidth, tolleranza di 1px, nomina il reo più largo) più un controllo di hit della CTA (nessuna barra sticky/drawer/FAB copre una CTA primaria); opt-in, skip pulito senza binario del browser, senza rete.
- **Nuovi screenshot v2 ×48 (CAR-140 fase A, #551)**: screenshot reali della UI v2 da un fixture CI-isolato e seminato — dashboard ×19 + job-map ×19 (job-map-ta alla prima comparsa, job-map-vi nuovo) + scan/pipeline/tracker/reports × en/ru — che alimentano README, guida e landing.
- **Screenshot reali su cvstart.org (CAR-140 fase B, #553)**: gli slot segnaposto di CAR-140 sono spariti — la landing mostra i veri screenshot v2 (showcase del job-map + righe di screenshot, ×19 locale della landing).
- **Hint di CAR-137 (#550)**: 21 nuove chiavi tradotte ×19 (`help.hint.*` ×20 + le `hintKey` delle mode-page) — ogni pagina ora si spiega sul posto.

### Note

- **Contratto Ctrl+K (CAR-122)**: il chord apre la **palette dei comandi** — NON mette a fuoco direttamente il box di ricerca; la ricerca viene messa a fuoco dalla palette. La riga della checklist QA della v1.261.0 «Ctrl+K фокусит поиск» è superata; il prompt QA della v1.261.1 porta il controllo aggiornato.
- **Fix reali di CodeQL (#547)**: 4 alert chiusi (l'iterazione a chiavi letterali di content.mjs resa strutturale, sweep di lint) — atterrati post-release sul main della v1.261.0 prima di questa patch; elencati qui per completezza.
- Test 6582 (+51); suite browser 171–172 pass / 0 falliti / 1 skip opt-in; l'harness mobile-390 gira in autonomia (`node tests/playwright-mobile-390.mjs`). Nessuna fonte scanner toccata (registro 121 = 116 EN + 5 RU · 116 adattatori).

## [1.261.0] — 2026-10-28

**L'onda della revisione completa della v1.261.0 è chiusa (tutti i finding HIGH + MEDIUM atterrati), il fix del cambio lingua segnalato dal proprietario, fix di qualità delle valutazioni, fan-out della guida ×18, la landing v2 di cvstart.org — più 4 specifiche SDD/OpenSpec che documentano l'onda. Ogni fix è atterrato tramite un fix-forward rosso→verde e una revisione GLM-5.3-Flash a contesto fresco.**

### Sicurezza

- **FULL-R1 — gate CSRF sugli acting-GET + scritture della pipeline atomiche e sotto lock (#519)**: gate `Sec-Fetch-Site`/Origin/Referer su `/api/stream/*`, `/api/run/*`, `/api/geocode` (`ACTING_GET` esportato, gate statico di copertura); ogni lettura-modifica-scrittura di `data/pipeline.md` / `data/last-scan.json` sotto `withFileLock` + il nuovo `atomicWrite` (temporaneo nella stessa directory → rename → unlink al fallimento).
- **FULL-R2 — cluster SSRF nelle fonti (#514)**: rss.mjs https+private-reject; ~25 fonti con `fetchImpl` nudo → transport protetti; mirror fissati sull'host; validazione dei redirect per habr/hh/geekjob/getmatch; `delay(ms, signal)` condiviso.
- **FULL-R4 — corruzione della prosa in stripDangerousMarkdown (#513/#518)**: la rimozione degli scheme avviene solo nei contesti di link/attributo; le entità vengono decodificate in una copia usata solo per il rilevamento («JavaScript: React, Node» e «R&amp;D» sopravvivono).
- **FULL-M2 — irrobustimento dei transport (#520)**: `safeGet` onora `timeoutMs` insieme al signal del chiamante (bridge controller); `guardResolvedHost` fallisce CLOSED su errore DNS. #525 aggiunge la rimozione degli header di credenziali sui redirect cross-origin, il distacco dei listener dei transport su ogni percorso di conclusione e la correzione di un crash con signal pre-abortito.
- **FULL-M4 — logo/batch (#523)**: il logo fissa i magic bytes su OGNI percorso (un `image/png` bugiardo non può trasportare SVG), limita il content-type a `image/*` al momento dello store, cache privata + nosniff; batch: `--parallel` limitato a 1–8, `--min-score` validato, BATCH_BUSY single-flight, `llmRateLimit` sulle mutazioni di config/batch.

### Aggiunto

- **CAR-147 — tetto di valutazione consapevole della locale (#524)**: `evalTimeoutMs(lang)` — ta/hi ricevono 480 s invece di 300 s (le scritture indiche tokenizzano più token per sillaba; il vecchio limite produceva 502 + report vuoto); il client remote-QA attende 540 s.
- **CAR-133 — landing v2 di cvstart.org (#532)**: hero a parallasse vincolato a reduced-motion, una demo SIMULATA chiaramente etichettata del flusso scan→evaluate→tracker, sezioni a reveal allo scroll con conteggi verificati sul vivo, slot segnaposto per gli screenshot di CAR-140.
- **CAR-135 — guida riscritta per la UI v2, fan-out ×18 completo (#533, #540, #541, #542)**: tutti i 19 file di guida descrivono la shell v2 (nav richiudibile, palette Cmd/Ctrl+K, skeleton, empty state di esempio+azione, chrome della scan v2, pipeline raggruppata+undo, reports v2, kanban); le etichette della UI citano le loro chiavi i18n; la frase delle 121 fonti vive dal registro.
- **Specifiche (SDD/OpenSpec) (#535)**: backfill della wave-two dell'oct27 + tre specifiche in avanti che documentano l'onda v1.261.0 (fan-out della guida, hand-off delle scritture, invarianti del cambio lingua).

### Corretto

- **Il cambio lingua non svuota più #/scan (#534)** — segnalato dal proprietario: lo stato di scansione locale alla vista (risultati, chip dei facet) ora è a livello di modulo; harness Playwright comportamentale con un refetch ritardato di 4 s (rosso sulla vecchia forma).
- **CAR-148/149 — report ru «Block G mancante» (#530)**: il prompt insegnava tre mappe A–G incoerenti; skeleton + elenco + esempio ora concordano con oferta.md (G = Posting Legitimacy); gate di deriva comportamentale.
- **CAR-150 — l'undo della pipeline conserva i metadati comp (#537)**: DELETE risponde con `comp`, POST accetta un `comp` opzionale con gate, la vista trasporta `{token, comp}` attraverso tutti i rami di fallback.
- **FULL-M3 — le fonti morte riferiscono bacheche oneste (#522)**: getro/mycareersfuture/meituan/mokahr/glints lanciano un'eccezione su una pagina-1 malformata (un'API morta non si legge più come «sana, 0 offerte»); `pinnedOverride` fissa gli override `company.api` di 18 adattatori.
- **FULL-M5 — un'unica cascata di provider (#521)**: routes/llm.mjs passa per `runActiveProvider` (+`cachePrefix`, signal); intercettazione del subprocess Gemini; contratti di risposta identici al byte.
- **FULL-M1 — scritture dei file condivisi sotto lock (#526, #539)**: `runTrackedScript` + roster `TRACKER_MUTATING`; gli spawn di outcome/followup tengono il lock; tracker.mjs scrive via `atomicWrite`; i salvataggi PUT sono locked+atomic.
- **FULL-M6 — consolidamento server + client (#531, #536, #525)**: dotenv con prototipo nullo + rifiuto di `__proto__`; isPrivateOrLoopback copre NAT64/6to4/benchmark/reserved; cache mtime di env-config; GC reale degli slot di file-lock; safeGet timeout+signal; guardia DNS fail-closed; SSE ×4 → `API.postStream`; librerie focus/label/status; clipboard attesa; tinta Hired nella dashboard.
- **R3 — deriva dei token CSS (#527)**: `--accent` risolto (i focus ring della mappa erano silenziosamente morti); 11 durate fuori dai token ripiegate; gate di deriva.
- **R4 — ritardatari del caricamento (#538)**: assessments/mode-page/pipeline preview rendono gli skeleton di CAR-112.
- **Batch CodeQL + CI (#517, fix #539)**: import inutilizzati, il gate ACTING_GET importa la regex vera, slice del lifecycle ri-ancorata.

### Note

- Non fatto deliberatamente: il pinning DNS al connect (richiede undici — fuori dalle dipendenze, residuo documentato); gli screenshot di CAR-140 (richiedono la UI v2 distribuita); CAR-137/138/141 (prossima passata di docs); la classe CodeQL `js/missing-rate-limiting` è un falso positivo documentato (il limiter custom non viene accreditato).
- Fan-out della guida ×18: la wave-1 di es/de ha saltato la nota d'introduzione e il delta della card Active Companies (de ha fatto atterrare la sua introduzione; es riceve un follow-up di una riga).

## [1.260.0] — 2026-10-26

**Il treno di irrobustimento delle revisioni — otto merge (#491–#498) dai giri di revisione opus-5-5 e AI sopra la flotta della v1.259.0: normalizzazione dei confronti salariali, perimetro delle date dei report, robustezza della geocodifica, cache-busting del bundle r2+r3, la correzione dell'overflow della deep research — più due UI v2 (pipeline, report). Ogni fix è atterrato tramite un fix-forward rosso→verde.**

### Corretto

- **Normalizzazione del confronto salariale (CAR-143 rev-2)**: i marcatori di periodo vengono riconosciuti solo vicino alla cifra a cui appartengono — «6 month contract, $120k» non viene più annualizzato ×12, e le forme di periodo RU/ES attaccate al numero («за месяц» accanto alla cifra) prevalgono sulle parole incidentali; la famiglia di simboli `$`/`¥` viene riconosciuta ma resta non mappata a meno che un codice ISO esplicito non compaia sulla stessa riga (i dollari AUD/CA/SG non vengono più conteggiati come USD, e una forma ¥ RMB riceve un avvertimento esplicito invece di una conversione JPY sbagliata di ~20×); i numeri isolati 19xx/20xx sono sempre anni; le cifre di un intervallo ereditano il periodo dell'altro estremo; il `minimum` e il `target_range` del profilo non vengono mai incollati in un unico intervallo.
- **Perimetro di fixReportDate (CAR-144 rev-2)**: la correzione della data fissata lato server si applica solo al preambolo prima della prima intestazione `## ` (un report con titolo H2 riceve un no-op conservativo — una data non aggiornata è accettabile, una fabbricata no); nel preambolo: un candidato unico viene corretto, altrimenti un unico `**Date:**` in grassetto, altrimenti nulla (due candidati in grassetto o due in chiaro non riscrivono nessuno). Il gate FIX-5 delle etichette PDF ora legge il dizionario assemblato reale — una locale mancante solleva un'eccezione invece di passare silenziosamente su un fallback inglese.
- **Chip di località di Habr + robustezza della geocodifica (CAR-142 rev-2)**: un meta chip di Habr diventa una città solo con un'evidenza strutturale (un link di filtro per città o un'icona di località) — gli avvisi di relocation («Возможна релокация») e i tipi di impiego non si mascherano mai da località; la cache della geocodifica ora sopravvive a un riavvio (flush su `beforeExit`/`exit`/SIGTERM+SIGINT con re-raise, il flag dirty azzerato solo dopo che la scrittura è atterrata), l'arresto è delimitato (latch del loop d'uscita, contatore di generazione, LRU per recency), e un budget di geocodifica esaurito risponde 503 + Retry-After invece di un generico 502.
- **Cache-busting del bundle (CAR-145 r2+r3)**: la shell cita `/js/bundle.js?v=<content-hash>` — immutabile al combaciamento, no-store al mismatch — eliminando la finestra di deploy di 5 minuti in cui una shell fresca poteva abbinarsi a un bundle vecchio in cache. L'hash e lo stream condividono un unico file descriptor (nessuna lettura parziale); una lettura corta risponde null invece di un hash di ripiego da stat che potrebbe avvelenare un intero deploy; `make-bundle` scrive l'identity e le compagne .br/.gz tramite un temporaneo col prefisso punto + rename, così una build uccisa non può né servire byte scritti a metà né lasciare in giro il suo file temporaneo.
- **Overflow della deep research (CAR-146)**: un brief di ricerca salvato il cui solo nome file supera il viewport di un telefono non può più spingere `#/deep` oltre i 390px — la card si limita alla sua riga, il titolo va a capo, la data resta su una sola riga; il sweep dei viewport stretti ora percorre `#/deep` con un fixture seminato eccessivamente lungo (l'unico finding dei due run remote-QA, chiuso).
- **Irrobustimento della pipeline v2 (revisione CAR-116)**: le eliminazioni chiedono conferma e si possono annullare (con un messaggio di undo onesto), nessuna azienda inventata dall'host nelle card, id di riga FNV-1a, conteggi bulk veri, e una guardia di rientranza sulle operazioni bulk.

### Aggiunto

- **Pipeline v2 (CAR-116)**: card arricchite, una vista raggruppata e scarto in blocco con undo; 17 nuove chiavi `pipe.*` spedite tradotte in tutti i 19 dizionari.
- **Reports v2 (CAR-118)**: ricerca dal vivo con filtri per fascia di punteggio/legittimità/azienda/data, intestazioni ordinabili (`aria-sort`), una vista a card persistente con pulsanti d'azione per fascia, un istogramma dei punteggi che filtra al clic, e il rendering unificato «Azienda — Ruolo» / «x.x/5» (`window.ReportOps`); 31 chiavi `rep2.*` spedite tradotte in tutti i 19 dizionari.

### Note

- Ogni fix è passato per un giro di revisione con evidenza rosso→verde; i due finding HIGH delle revisioni AI sul primo bundle r2 (hash da lettura corta, atomicità delle compagne) sono chiusi dal r3, e i giri CAR-143/CAR-144/CAR-142 hanno ciascuno riverificato i finding aperti del loro predecessore.
- Non fatto deliberatamente: la vista a cluster della mappa resta CAR-125 (in coda); il ripristino lato server dei metadati della pipeline è un ticket separato; nessuna correzione retroattiva per i contenuti salvati negli stati pre-rev-2 della v1.259.0.
- Test 5988 (+165); suite browser 152 pass / 0 falliti / 1 skip opt-in. Nessuna fonte scanner toccata (registro 121 = 116 EN + 5 RU · 116 adattatori); le 48 nuove chiavi i18n sono atterrate con il loro fan-out ×19 dentro le stesse PR delle feature.

## [1.259.0] — 2026-10-25

**Il secondo treno della flotta di agenti, sei fix: le date dei report sono fissate lato server, il geocoder della mappa mette in cache e legge le città RU, la guida ×18 cita le etichette dei pulsanti localizzate, le frasi della UI smettono di mescolare lingue, i confronti salariali sono calcolati lato server — e il bundle JS viene distribuito precompresso (caricamento a freddo 3.1 MB → 598 KB).**

### Corretto

- **Date dei report inventate (CAR-101)**: il prompt di valutazione ora fissa la data odierna lato server («il campo **Date:** DEVE essere esattamente <date> — copialo alla lettera; non inventare mai»), e `fixReportDate` riscrive una data deviata a oggi in ogni punto di accettazione (ramo Anthropic, subprocess Gemini, coda OpenAI-compatibile, /api/deep, auto-pipeline) con un warning + un record nell'activity log — una correzione, mai un rifiuto. 349/789 report in produzione portavano date inventate; quelle nuove non possono più.
- **Geocodifica della mappa (CAR-105)**: le stringhe di città in cirillico delle righe hh.ru/Habr ora arrivano al geocoder; una cache persistente e limitata (`data/geocode-cache.json`, withFileLock) fa sì che una città già risolta non interroghi mai due volte il provider; le chiamate di geocodifica hanno un budget per richiesta, così la mappa si riempie progressivamente invece di bloccarsi per 13.9 s.
- **UI in lingua mista (CAR-108)**: 23 perdite con chiave corrette su 17 dei 19 dizionari (85 valori) — «все matching», «только remote», «Открыть Scan», il funnel «Evaluated → Applied…» e altre voci sono diventate frasi localizzate complete che riusano il vocabolario di prodotto di ciascuna locale. `i18n-no-latin-leaks` esteso con la tabella dei frammenti + la sonda del funnel (rosso→verde).
- **Capovolgimento del verdetto sulle valute (CAR-109)**: il confronto salariale è calcolato lato server in `comp-compare.mjs` e incorporato in forma canonica (`Candidate minimum: … per YEAR (raw: …)` vs `JD offer: …`); le forme mensili ×12, k/к/тыс/萬 e con virgola decimale si normalizzano prima del confronto; una conversione incerta non può mai da sola capovolgere il verdetto (il caso zh-TW «€80–100k ниже минимума» è morto). Il modello non moltiplica mai.
- **Etichette dei pulsanti nella guida ×18 (CAR-107)**: i bundle di guida localizzati citavano etichette inglesi («⚡ Run live», «Save», «Scan now») che la UI non mostra più — 263 sostituzioni su 18 locale, mappate dai sorgenti delle viste; il docs-assistant eredita la correzione.

### Aggiunto

- **Bundle precompresso + caricamento a freddo cacheabile (CAR-104)**: `make-bundle.mjs` emette `bundle.js.br` (brotli q11) + `.gz` al momento della release; un middleware limitato al bundle negozia br > gz con `Vary: Accept-Encoding`, `public, max-age=300, must-revalidate` + ETag/304; con guardia di freschezza (le varianti compagne non vengono mai servite più vecchie del bundle identity), le richieste dirette degli artefatti rispondono 404, CSP byte-identico. Caricamento a freddo: 3.1 MB → ~0.6 MB in transito (−80%); le visite ripetute entro 5 min trasferiscono ≈0 byte.

### Note

- Tutti i fix arrivano dalla flotta di agenti con evidenza rosso→verde (13 + 28 + 1 + 30 + 7 nuovi casi nelle loro suite) e sono stati rifiniti in giri di revisione (CodeQL #579/#580/#584 corretti nel codice — gli URL degli stub parsati via `new URL().host`, una stringa morta del prompt eliminata).
- I numeri del backfill dei punteggi della v1.258.0 sono ora annotati in CAR-129 (`updated: 22`, `reportScoreless: 159`).
- Non fatto deliberatamente: nessuna correzione retroattiva delle date per i 349 report storici (un backfill sarebbe un'operazione da approvazione del proprietario), nessuna vista a cluster della mappa (CAR-125 resta in coda dietro questa correzione della geocodifica).
- Test 5823 (+74). Nessuna fonte scanner toccata (registro 121 = 116 EN + 5 RU · 116 adattatori); nessuna chiave i18n (CAR-108 modifica solo i valori delle chiavi esistenti).

## [1.258.0] — 2026-10-25

**Sei fix dalla flotta di agenti, un solo treno: il contatore aziende di #/scan smette di mescolare universi, la deep research esige fonti, gli errori dei moduli illuminano il campo, gli stati di caricamento ricevono skeleton e un h1 immediato, e le valutazioni mettono in cache il prefisso del prompt da 37k token.**

### Corretto

- **Contatore «Aziende attive» di #/scan (CAR-100)**: il numeratore contava le aziende distinte su TUTTE le righe di risultato (1554 in produzione — il solo hh.ru ne contribuisce a centinaia) mentre il denominatore contava le aziende tracciate con supporto API (~90) — due universi in una frazione. Abbinamento (a): il numeratore ora conta le aziende tra le righe che la scansione tracciata con supporto API ha recuperato lei stessa (corrispondenza via `_entry ?? company`; le righe datore di lavoro di hh.ru/telegram escono); il fallback pre-scansione è entrato nello stesso universo (poteva leggere «104/90»).
- **Fabbricazione nella deep research (CAR-110)**: il prompt deep ora porta un contratto rigoroso — ogni affermazione fattuale termina con `[source: domain.com]` (se non si può nominare la fonte → non si afferma; inventare un marcatore è peggio che scrivere "unknown"), i fatti sconosciuti si scrivono `unknown`, e il report DEVE terminare con una sezione `## Data freshness`. Ancore di freschezza: la data UTC di oggi + un'opzionale `url` dell'azienda su `POST /api/deep` (limitato, mai recuperato lato server).
- **Gli errori dei moduli evidenziano il campo (CAR-130)**: un POST fallito marca il primo campo del modulo con `aria-invalid` + `.is-error` e lo mette a fuoco (WCAG 3.3.1); si ripristina alla modifica. L'hint di errore di rete è consapevole del deployment — il loopback mantiene l'hint del comando dev, un'origine distribuita riceve «server is not responding» invece del consiglio `bash web-ui/bin/start.md` (il banner di connessione aveva lo stesso hardcode).
- **Stati di caricamento (CAR-112)**: #/map e #/tracker mostrano il loro h1 all'istante (il bersaglio del focus del router esisteva solo dopo l'arrivo dei dati) e un helper skeleton condiviso (`Skeleton.rows`, righe shimmer aria-hidden dentro una regione `role="status"` che riusa `common.loading`) sostituisce il nudo testo «Loading…» su tracker, risultati della scansione e shell della mappa; `prefers-reduced-motion` ferma il pulso.
- **Caching del prompt di evaluate (CAR-111)**: `buildEvaluationPromptParts` divide il prompt da ~37k token in un prefisso stabile al byte (CV + profilo + file mode + istruzioni) e la coda JD; il percorso Anthropic invia `[prefisso + cache_control: ephemeral] + [JD]` — il prefisso viene fatturato alla tariffa di lettura della cache (≈10× più economico) a ogni chiamata dopo la prima. Un prefisso mancante o non combaciante ricade in modo aperto alla vecchia richiesta identica al byte; la cascata dei provider compatibile con OpenAI resta intoccata (lì il caching è lato server).

### Note

- Tutti e sei i fix arrivano dalla flotta di agenti con evidenza rosso→verde (5 + 7 + 7 + 7 + 8 nuovi casi) e giri di revisione; i primi alert CodeQL di CAR-111 (#579/#580) sono stati corretti nel codice — lo stub del test parsa l'host dell'URL invece di un matching per sottostringa, e una stringa morta del prompt completo è stata eliminata.
- **Il backfill dei punteggi è girato in produzione** (endpoint v1.256.0, approvato dal proprietario): `updated: 22`, `missingReport: 0`, `reportScoreless: 159` — 159 righe senza punteggio puntano a report le cui intestazioni precedono il blocco macchina o portano formati di punteggio non interpretabili; recuperabili solo con una rivalutazione o una passata di parser più ampia (annotato in CAR-129).
- Non fatto deliberatamente: nessuna modifica nulls-last per la colonna commute (quirk preesistente `Infinity`-on-desc), nessun re-pricing retroattivo delle vecchie righe di usage, nessuna evidenziazione in stile `.is-error` per i moduli di filtro della scansione (CAR-130 delimitato all'helper condiviso di submit della mode-page + l'hint di api.js).
- Test 5749 (+36). Nessuna fonte scanner toccata (registro 121 = 116 EN + 5 RU · 116 adattatori); nessuna chiave i18n (l'hint di CAR-130 riusa `conn.down`; la regione skeleton riusa `common.loading`).

## [1.257.0] — 2026-10-25

**Due fix della flotta di agenti: l'assistente della guida in-app capisce devanagari e tamil, e la pagina usage mostra quanto costa davvero Hermes.**

### Corretto

- **Recupero dell'assistente della guida per hi/ta (CAR-103)**: la classe di caratteri di parola del tokenizer a keyword del docs-assistant era `[\p{L}\p{N}\u30fc]+` — senza segni combinanti. Ogni matra devanagari (ा ै ्…) e ogni segno vocalico tamil (ே ை ்…) spezzava una parola in frammenti; la regola sulla lunghezza scartava i frammenti corti (una query in hindi combaciava con 0 sezioni) e le parole più lunghe venivano decapitate in spazzatura che collimava con sezioni non correlate. La classe ora mantiene `\p{M}`; il percorso dei bigram CJK resta intatto. hi «मैं स्कैन कैसे चलाऊं?» e ta «ஸ்கேன் எப்படி இயக்குவது?» recuperano le sezioni giuste dai bundle distribuiti.
- **Costo dell'uso per Hermes (CAR-106)**: `normalizeUsage()` collassava l'usage del provider a `{in, out}` e scartava silenziosamente il `cost` riportato dal gateway — `#/usage` mostrava $0.0000 su 9.5 M di token Hermes (la sua riga nella tabella dei prezzi è 0/0). La forma del record di usage guadagna un `cost?` opzionale e retrocompatibile; l'aggregatore preferisce, per ogni record, il costo riportato dal provider e ricade alla stima della tabella dei prezzi solo in sua assenza; i valori spazzatura/negativi vengono scartati, mai fabbricati.

### Note

- Entrambi i fix arrivano dalla flotta di agenti con evidenza test rosso→verde (3 + 5 nuovi casi; 14/14 e 10/10 verdi; i vicini 78/78 e 61/61). Le prime PR (#470/#471) portavano una base di worktree obsoleta che confliggeva con la v1.256.0 unita in squash — sostituite da cherry-pick puliti (#472/#473).
- Non fatto deliberatamente: nessun re-pricing retroattivo delle righe storiche di `data/llm-usage.jsonl` (non portano un campo cost; ne beneficiano solo i nuovi record).
- Test 5713 (+8: docs-assistant ×3, usage ×5). Nessuna fonte scanner toccata (registro 121 = 116 EN + 5 RU · 116 adattatori); nessuna chiave i18n.

## [1.256.0] — 2026-10-25

**Qualità dei dati del tracker: il ruolo non viene mai registrato come azienda, un job board non viene mai registrato come datore di lavoro, le righe senza punteggio smettono di emergere per prime — e un endpoint one-shot recupera i punteggi mancanti direttamente dai report stessi.**

### Aggiunto

- **Backfill dei punteggi (CAR-129)**: `POST /api/tracker/backfill-scores` riempie la cella Score delle righe il cui report collegato porta un punteggio interpretabile (181 righe valutate avevano un report ma nessun punteggio). Le righe con punteggio, le sentinelle esplicite (`N/A`), le righe senza report e i report senza punteggio non vengono mai toccati; viene riscritta solo la cella Score, sotto file lock; la forma del punteggio è validata nel punto di scrittura e normalizzata alla convenzione `X.X/5` del tracker; l'esecuzione è idempotente e restituisce `{ok, updated, missingReport, reportScoreless}`.

### Corretto

- **Il ruolo non è mai l'azienda (CAR-128)**: `guessCompanyRole` trattava il lato SINISTRO di una riga di intestazione col trattino come l'azienda, ma i board scrivono entrambi gli ordini — «Senior Frontend Engineer - Grafana Labs» registrava il ruolo COME azienda (13 righe: Grafana, CircleCI…). Un'euristica sulle keyword di ruolo con confine di parola ora sceglie il lato del ruolo, e un tipo di impiego non diventa mai il datore di lavoro («Senior Engineer - Remote (EU)» non registra nulla invece di registrare «Remote (EU)»).
- **Un job board non è mai il datore di lavoro (CAR-127)**: il fallback sullo slug di dominio registrava le righe hh.ru come «hh» (120 righe). Gli slug `hh`/`habr` entrano nell'elenco dei non-datori di lavoro; l'inferenza del datore di lavoro a metà frase («в компании X», «X ищет») ora gira anche per gli host dei job board (hh.ru/kz/uz/by, habr.com) — dove il testo della pagina nomina il vero datore di lavoro. Causa radice scoperta lungo la strada: i `\b`/`\w` ASCII di quei pattern di inferenza non hanno mai combaciato con il cirillico — silenziosamente morti dalla v1.248.4; lookbehind Unicode e classi `\p{L}` li sostituiscono.
- **Le righe senza punteggio si ordinano per ultime (CAR-129)**: l'ordinamento per punteggio del tracker usava un valore sentinella `-1`, così con l'ordinamento ascendente predefinito ogni riga senza punteggio emergeva prima di ogni riga con punteggio. I null ora si ordinano per ultimi in entrambe le direzioni (il FILTRO sul punteggio mantiene il suo `-1` — «senza punteggio fallisce un filtro ≥4» è la semantica corretta in quel caso).

### Note

- Le righe storiche NON vengono migrate da questa release: le correzioni del parser si applicano alle nuove valutazioni; i punteggi sono recuperabili tramite l'endpoint di backfill, mentre le 120 celle del datore di lavoro «hh» richiedono una rivalutazione, non una riscrittura.
- Un giro di revisione opus-5-5 è incorporato: il pattern non ancorato «X ищет» è stato scartato prima della spedizione (qualsiasi sequenza con iniziale maiuscola prima del verbo sarebbe stata registrata come datore di lavoro — l'invariante no-fabrication), aggiunti gli ancoraggi «В…» a inizio frase, e il writer del backfill ricontrolla la cella bersaglio (esistono righe `#` duplicate dopo modifiche manuali), mantiene il numero di colonne di una riga corta malformata a mano e si ferma alla prima riga non-tabella. Il punto dentro un nome puntato («Сбер. IT») è indistinguibile da un punto di frase per l'ancoraggio «в компании» — viene registrato il prefisso conservativo («Сбер»); il pattern ancorato al verbo cattura la forma completa.
- Non fatto deliberatamente: nessuna estrazione del comparatore da `tracker.js` in una lib testabile con unit test (il gate source-static resta; annotato in CAR-129 come follow-up), nessuna modifica nulls-last per la colonna commute (quirk preesistente `Infinity`-on-desc), nessuna migrazione dati per le righe «hh».
- Test 5705 (+10: 5 identity in `auto-pipeline-jd-gate`, 2 CAR-128, il gate dell'ordinamento CAR-129, 4 di backfill incluso il pin del percorso ostile — meno i casi v1.248.x sostituiti). Nessuna fonte scanner toccata (registro 121 = 116 EN + 5 RU · 116 adattatori); nessuna chiave i18n.

## [1.255.2] — 2026-10-24

**Tre fix visibili all'utente dalla regressione live e da una segnalazione di crash in produzione: il crash del render di #/scan, il controllo linguistico cieco per il vietnamita e la perdita ricorrente del blocco summary in zh-TW.**

### Corretto

- **Crash di #/scan (CAR-99)**: dalla v1.253.0 la rigenerazione dei count-gate ha scritto il letterale `FALLBACK_SOURCES` con una virgola doppia finale su ogni voce — 120 buchi di elisione nell'array. `new Set(FALLBACK_SOURCES.map((s) => s.value))` nella vista scan conteneva allora `undefined`, e l'`id.length` del classificatore di aziende lanciava `TypeError: Cannot read properties of undefined (reading 'length')` a ogni render di pagina (colto da logbuf in produzione). I buchi sono rimossi e un nuovo gate (4 specifiche, verificato in rosso) esegue il file e fallisce su qualunque buco, voce inutilizzabile o `undefined` nel Set degli id adattatore — il gate di deriva solo-testuale non poteva vedere questa classe.
- **Controllo linguistico cieco per il vi (CAR-97)**: il vietnamita è in alfabeto latino e non aveva voce nella tabella delle stop-word della QA live, quindi le «vi stop words» contavano le occorrenze inglesi e una risposta vietnamita risultava `report not in vi` (regressione live: vi 2, en 2). Il vietnamita ora ha la sua tabella di dieci parole funzionali — un report puro in vi passa, uno in inglese fallisce ancora.
- **zh-TW ha perso il blocco SCORE_SUMMARY (CAR-98)**: il promemoria linguistico di chiusura diceva solo che il formato macchina non va tradotto, mai che il blocco summary deve esistere — un report zh-TW corto (5.983 caratteri) portava i blocchi A–G ma ometteva il blocco del tutto (una ricorrenza della classe v1.239.2). La direttiva di apertura e il promemoria di chiusura ora dichiarano che il blocco è obbligatorio e che il report senza è invalido.

### Note

- Questa release non cambia deliberatamente alcuna fonte scanner, né il conteggio del registro (121 = 116 EN + 5 RU · 116 adattatori), né il cablaggio dei provider — sono solo fix, quindi i count-gate restano intatti.
- Test 5695 (+9: `car99-fallback-holes` ×4, `car97-vi-lang-check` ×4, l'invariante del prompt CAR-98 ×1). Browser 143/143. Il ri-controllo live vi/zh-TW viaggia con la regressione post-deploy.

## [1.255.1] — 2026-10-24

**Due giri di correzioni dalle revisioni: la revisione Opus della localizzazione vietnamita (9 reperti) e la revisione di seconda passata dei fix CAR-91/92 (5 imperativi) — entrambi chiusi con test rosso→verde.**

### Corretto

- **Giro di revisione della locale vi (follow-up di CAR-88)**: il glifo Hangul (`신`) che era filtrato in `project.subtitle` / `project.roleHint` è corretto (`độ khớp tín hiệu`), con un gate che fallisce su qualunque glifo CJK/Kana in un valore vi che il dizionario EN non porta; i sei URL markdown con spazi in docs/help/vi.md (`what-is career-ops`, `apply for a job`, `set up playwright` e altri tre) sono riportati col trattino agli slug reali delle guide, con un gate che vieta gli spazi negli URL.
- **Confini delle intestazioni di valutazione (CAR-92 r2 H1)**: `&`, `.`, `/`, `'` sono ora caratteri di parola nel confine sinistro della lettera-blocco — `## Q&A`, `## Plan B`, `## Ph.D. requirement`, `## E-commerce` non si registrano più come blocchi A/B/D/E; il terminatore nudo a fine riga è accettato solo dopo un token parola-blocco (Block/блок/블록/…); l'ASCII `-` è uscito dalle classi dei terminatori scritti per esteso, così le intestazioni `E-commerce`/`ई-मेल` sopravvivono.
- **Report numerati in ucraino/russo (CAR-92 r2 H2)**: il rilevatore della sequenza А Б В Г Д Є Ж è ora un helper condiviso; quando trova 3+ lettere della sequenza a un livello di intestazione, quel livello diventa il livello di riferimento del cutter — le sottosezioni `### A.` con lettera non troncano più il report al blocco Б.
- **Ciclo di vita delle righe riportate (CAR-92 r2 M1)**: le righe che una fonte fallita riporta nella scansione successiva vengono timbrate `carriedSince`, scartate dopo 30 giorni o 5 riporti consecutivi, e accodate dopo le righe fresche invece di ri-accumularsi in silenzio per sempre.
- **Denominatore della gemini-synthesis + legitimacy (CAR-92 r2 M2) e il percorso subprocess del body-score (M3)**: letti dal file dei reperti, corretti con test rossi.
- **Gate di deriva del bundle a caricamento a freddo aggiornato per il dizionario vi** (90 tag script / 87 bundleizzabili) e rimossa la sua associazione di test inutilizzata (CodeQL 572).

### Note

- La formulazione del conteggio adattatori nel banner «Ultima» del README.vi segnalata dalla revisione sta nel banner **Precedente** e rispecchia già il README EN byte per byte — lasciata intatta per mantenere la parità EN↔vi (documentata nel corpo del commit).
- Test 5686 (+26: `eval-validate-opus-r2`, `scanner-carryover-r2`, asserzioni dei gate vi). Registro invariato a **121 fonti (116 EN + 5 RU) · 116 adattatori**.

## [1.255.0] — 2026-10-24

**Il vietnamita (Tiếng Việt) entra come 19ª lingua dell'interfaccia — un dizionario di 1525 chiavi in piena parità con l'EN, rilevamento di vi/vi-VN, il pacchetto guida completo, i mirror README e CHANGELOG, l'integrazione nella landing di cvstart.org e il 🇻🇳 nel selettore lingua.**

### Aggiunto

- **Vietnamita (`vi`) — 1525/1525 chiavi** in piena parità con `en`; `detect()` accetta `vi` e `vi-VN`; il vietnamita è LTR (mai aggiunto a `RTL_LANGS`). 'Pipeline' resta 'Pipeline' — prestito tecnico standard, in whitelist.
- **docs/help/vi.md completo** (33 H2 / 125 H3), più i mirror README.vi.md e CHANGELOG.vi.md e le stringhe-scaffold in vietnamita in `prompts.mjs` (`LOCALE_NAMES` + `SCAFFOLD_STRINGS`) — l'output LLM in vietnamita funziona fin da subito.
- **Landing di cvstart.org in vietnamita** — `site/src/i18n/vi.json`, la voce locale della sitemap e uno screenshot `dashboard-vi.png`; il selettore lingua guadagna il 🇻🇳 (19 posizioni).
- **Cancelli di enumerazione 18 → 19** — LANGS, sonde detect, audit i18n, parità del changelog, blocco traduzioni README, spazzata locale — più il `tests/i18n-vi-locale.test.mjs` red-first (139 righe).

### Note

- La landing di cvstart.org guadagna il vi — una deviazione deliberata dal precedente ta (quel rilascio teneva la landing a 17 di proposito); documentato nella specifica del rilascio.
- vi è in scrittura latina, quindi il cancello no-latin-leaks non si applica (custodisce le lingue non latine); il lessico tecnico latino qui è la norma.
- Pavimento dei test: 5634 → **5642** (1 saltata = il test browser opt-in di cattura del layout, invariato).

## [1.254.0] — 2026-10-24

**Una versione di indurimento dal giro di revisione col modello massimo: lo snapshot dello scanner non perde più righe, undici violazioni d'invariante del layer LLM sono corrette, ventitré must-fix SPA atterrano, e l'ATS Paylocity si unisce allo scanner — il registro ora fornisce 121 fonti (115 EN + 5 RU) con 116 adattatori.**

### Aggiunto

- **ATS Paylocity** (parent #5687): board per tenant `recruiting.paylocity.com`, board morto 302 → JobNotFound mappato a 404 così la quarantena va in pensione la voce, cap `max_jobs` con flag di troncamento. Registro: **121 fonti = 116 EN + 5 RU · 116 adattatori**; i gate di conteggio rigenerati.

### Corretto

- **Sicurezza dello snapshot dello scanner (R-12)**: una scansione che non tenta nulla CONSERVA ora lo snapshot (`nothing scanned`); un replace completo riporta le vecchie righe delle fonti fallite — timbrate per voce — ripassate nei filtri ATTUALI, atterrando solo in `filtered`.
- **Undici violazioni d'invariante del layer LLM**: la direttiva di lingua apre E chiude i prompt deep/mode; il subprocess Gemini inoltra `--lang`, exit non-zero → 502, non fa più filtrare il stderr al client, rispetta i 300 s e registra l'usage; il fallback manual porta l'URL dell'annuncio; truncation e warning del bundle emergono in `/api/mode`; il spend tier non è più sovrascrivibile dal client; la disconnessione del client abortisce la chiamata al provider in volo; il cutter delle intestazioni ripetute non distrugge più report validi; gli estrattori score/legitimacy concordano col validatore; la sequenza ucraina e il wa arabo sono stretti.
- **Un giro di revisione Opus 5-5 SUI fix stessi** (8 imperativi): la registrazione multi-lettera del cutter, terminatori di intestazione più larghi, il cablaggio di abort del subprocess Gemini, l'attribuzione timbrata del riporto, le righe riportate ripassano i filtri attuali, il livello di riferimento per lettere distinte.
- **Ventitré must-fix SPA** nelle viste di sourcing (l'append del pager a pagina singola, la tastiera delle righe pipeline, il ripristino dei filtri saved-search, i reset del select source, il ritorno al default in config, le fughe di listener, la chiusura SSE al terminale, il teardown del runner di scansione, un fetch nudo, i caricamenti falliti che sembravano vuoti, una collisione globale, la conservazione del focus) e nelle viste di assistenza (il deep-link morto dell'help, le fughe di listener dell'help, il riarmo del blank-overwrite del two-pager, il single-flight delle esecuzioni a pagamento batch/deep/mode, le fini silenziose di stream, i percorsi d'errore a spinner eterno, le righe fantasma dei filtri falliti, i duplicati docs-fab + la lingua).

### Note

- L'intero giro è stato rivisto da Opus 5-5 al massimo rigore — i port pre-merge (21 reperti, 13 corretti) e i fix stessi post-hoc (8 imperativi, tutti qui con test rosso→verde).
- Pavimento dei test: 5262 → **5634** (372 nuove specifiche su fonti, scanner, layer LLM e SPA).

## [1.253.1] — 2026-10-24

**Due riscontri HIGH di sicurezza dalla revisione col modello massimo sono corretti: gli URL letterali IPv6 non aggirano più il guardia SSRF dello scanner, e la regex di escape del markdown CV non fa più backtracking quadratico.**

### Corretto

- **I letterali IPv6 aggiravano la guardia SSRF** (`http-json.mjs`): un letterale IPv6 tra parentesi faceva lanciare `dns.lookup` e la guardia fail-open. Ora le parentesi si tolgono e il letterale si classifica via `isIP` — senza DNS, senza fail-open.
- **ReDoS nell'escape del markdown CV** (`security.mjs`): il pattern faceva backtracking quadratico — `<` + ~100k spazi costavano ~16 s; ora ~1 ms con una classe piatta limitata. Tutto ciò che si escapeva prima si escape ancora.

### Note

- Entrambe le correzioni portano test rosso→verde (3 nuovi casi IPv6 + ReDoS con limite temporale; 5511 test, +7).
- I file sorgente dello scanner non sono toccati — la guardia vive nel trasporto condiviso.

## [1.253.0] — 2026-10-24

**Dieci nuove fonti di offerte entrano nello scanner — Atlassian, BWI, Computrabajo, Dover, Google, Kalibrr, Magneto365, Platsbanken, Tech in Asia e Zoho Recruit — il registro ora fornisce 120 fonti (115 EN + 5 RU) con 115 adattatori, e il role matcher tiene separati i titoli che differiscono solo per un breve codice in maiuscolo.**

### Aggiunto

- **10 fonti portate dal parent 1.38.0**, ciascuna con il suo adattatore fetch-walk e una suite isolata CI (fetchImpl finto, zero rete): **Atlassian** (singolo feed JSON senza auth, URL iCIMS, allowlist https+icims.com), **BWI** (ItemList JSON-LD, JSON.parse prima), **Computrabajo** (LATAM, decodifica entità, «remoto» spagnolo letto remote), **Dover** (paginazione DRF per tenant, rendering `Remote (International)`, board validati UUID), **Google Careers** (prime pagine per frase, il datore della carta vince, dedup tra query), **Kalibrr** (aggregatore SEA, id del feed come id di riga), **Magneto365** (LATAM, ritmo inter-pagina fisso), **Platsbanken** (API JobTech svedese, finestre per parola chiave), **Tech in Asia** (chiavi Algolia scoperte dal build del sito), **Zoho Recruit** (board hidden-input, arricchimento dettaglio limitato, valuta solo ISO-4217).
- Conteggio registro: **120 fonti = 115 EN + 5 RU · 115 adattatori**; i cinque gate di conteggio rigenerati dal registro vivo; il fallback del dropdown `#/scan`, i link cvstart.org e help §17 ×18 seguono.

### Corretto

- **role-matcher (port #5688)**: i titoli che differiscono solo per un breve codice in maiuscolo («HR BP» vs «HR GP», «AWS» vs «GCP», anche in scritture miste) non vengono più accostati per fuzzy come la stessa posizione; i codici si leggono dal titolo grezzo con esclusione delle parole-rumore, e il guard sta subito prima del rapporto di Jaccard.
- **I port sono sopravvissuti a una revisione Opus 5-5 di rigore massimo** (21 reperti): throw sui board silenziosamente vuoti per deriva di markup (google/bwi), una scansione pre-abortita lancia invece di restituire `[]`, l'ordine decode-then-strip sugli scraper LATAM (la forma XSS strip-then-decode), https+allowlist sugli URL di riga atlassian, assert di host che rifiutano porte, parse delle pagine tardive dentro il try (i parziali sopravvivono) e onestà dei test (budget contati esattamente, contratti di coercizione conficcati veritieri). 13 reperti corretti; la coda [spec] tracciata a parte.

### Note

- I cinque RU restano web-ui-only (nessun adattatore upstream — di proposito); ogni fonte EN ha il suo adattatore.
- Ratchet di copertura: i sei port maggiori alzati a ≥95 % branch (27 nuovi casi); il resto del codice morto difensivo è documentato per file.
- Le nuove fonti si selezionano con `provider: <slug>` in portals.yml — nulla cambia per le configurazioni esistenti.

## [1.252.1] — 2026-10-17

**Il banner di versione della wiki ora è verificato da uno script invece che da una passata manuale — la regressione v1.252.0 l'ha colto solo a mano — e la direttiva locale prevale esplicitamente sul language.output del profilo e sulla lingua dell'annuncio.**

### Aggiunto

- **`scripts/wiki-banner-check.mjs`** — il gate richiesto dalla regressione: legge ogni `Home*.md` in un clone della wiki e confronta il banner con `package.json` e con i contatori VIVI del registro (scanner adapters dal registro dei portali — 105, non i 109 scaduti del banner; route modules da `server/lib/routes/`; UI locales dall'insieme CHANGELOG). La regex del banner è language-agnostic per FORMA: le pagine Home localizzate traducono etichetta e contatori («Текущий релиз», «Aktuel udgivelse», «адаптеров сканера», «enhedstests») e i loro numeri erano derivati più (5177) della pagina EN (5245). `--tests N` prende il numero che il `test:ci` appena eseguito ha stampato; `--check-only` vieta il clone implicito per l'uso offline. Test di fixture offline in `tests/wiki-banner-check.test.mjs`.

### Corretto

- **Il banner wiki Home ×18 torna in sincrono** (spinto con questa release): la passata v1.252.0 cambiava badge e link ma mai la riga del banner, e nulla di meccanico lo segnalava. Il gate sopra lo rende controllo bloccante della release.
- **La direttiva locale fissa la priorità della lingua** (`buildLocaleDirective`): «This UI locale overrides the profile's `language.output` setting and the job posting's own language». La stessa regola 6 del padre comanda di scrivere in `language.output` — senza la frase di priorità il modello risolveva le due istruzioni contraddittorie in modo incoerente per locale, che era la dispersione della colonna lingua in v1.252.0. Conficcato da `tests/locale-directive-language-output.test.mjs` sul testo della direttiva (17 locale non-EN + EN vuoto).

### Note

- **Osservazione sulla FORMA del ta evaluate (§3, tenere d'occhio)**: la prima esecuzione live della v1.252.0 ha prodotto un evaluate di 48 336 caratteri senza Block G e senza SCORE_SUMMARY — a forma di loop, non di lingua (CAR-70 è lingua). Se si ripete al prossimo release, avrà un suo issue Linear, separato da CAR-70.
- Secondo il FIX-PROMPT: il parent resta in sola lettura; l'override vive interamente nella direttiva della UI.

## [1.252.0] — 2026-10-17

**Il fork del parent è sincronizzato con career-ops-hq/career-ops — 264 commit upstream, parent 1.36.0 → 1.37.0 — entrambe le divergenze del fork difese, e il deploy riaggancia il parent in esecuzione a quella base.**

### Aggiunto

- **Modalità di mercato vietnamita (vi)** dall'upstream (`modes/vi/`, `tuyen-dung` / `ung-tuyen`): BHXH/BHYT/BHTN, thử việc, lương tháng 13, trợ cấp thôi việc — il 21° mercato nella tabella delle modalità del parent.
- **Provider della board Tech in Asia** (upstream): legge l'indice Algolia pubblico `job_postings` che la UI lavori di techinasia.com interroga essa stessa — una board SEA di startup, ~300 posizioni vive al campionamento, 273 indonesiane. Le chiavi vengono riscoperte a ogni run dal build del sito, il link di candidatura del datore di lavoro batte la pagina della board, e lo stipendio resta volutamente non allegato (i campi stipendio dell'indice sono flag, non denaro).
- Otto nuovi documenti sui segnali di legittimità Block G (`modes/oferta-signals/08–17`): paese nella terminologia dei benefit, tag di localizzazione di piattaforma terza, licenze delle agenzie, eccesso di requisiti migratori, contenuti vietati dalla giurisdizione, ampiezza della forbice pay-transparency, domanda dell'avvocato sul salario minimo, divulgazione dello screening AI, divulgazione del contratto a termine, potere d'acquisto alla ricollocazione.

### Cambiato

- **Irrobustimenti lato parent che viaggiano con la base**: il controllo story-provenance lavora per unità e frase e tiene le cifre `user-cannot-confirm` fuori da negoziazione, ATS e output di intervista; il fact-gate del CV gira su ogni renderer e legge affermazioni riformulate e strutturate; LaTeX rifiuta gli slot estratti scaduti prima di scrivere; la scansione launchd dei follow-ups viene saltata quando i follow-ups sono spenti; update-system mantiene la sua scansione delle modifiche locali entro il limite argv.
- **Le divergenze del fork sono sopravvissute al merge**: `providers/telegram.mjs` (parser esclusivo del fork, ADR-0001) e il `LOCATIONISH_RE` in lookaround Unicode in `telegram-channel.mjs` (ADR-0002). Il documento delle board ora elenca la riga `telegram-channel` migliorata dell'upstream, la riga `telegram` esclusiva del fork, Tech in Asia e il `max_pages` predefinito di Tencent alzato 20 → 100.

### Note

- **Nessun cambio di comportamento dello SPA in questa versione**: è il treno di documentazione più il riaggancio del parent. Il deploy ora gira sul parent 1.37.0; la tabella degli stati canonici non è toccata dal delta del parent — gli stati del tracker si rendono esattamente come prima.
- Il merge upstream ha risolto due conflitti: `docs/SUPPORTED_JOB_BOARDS.md` (entrambe le righe telegram conservate) e `test-all.mjs` (il `copyDirSync` basato su walkTree dell'upstream subsume il guard manuale `.git` per i checkout annidati del fork; la lista degli import è l'unione).

## [1.251.1] — 2026-10-12

**Il filtro di specializzazione ora matcha solo le parole DISTINTIVE del ruolo — anzianità e sostantivi generici non matchano più una posizione da soli — e remote-qa separa forma da lingua così che una deriva non segni mai A–G in rosso.**

### Corretto

- **Il filtro di specializzazione elimina anzianità e sostantivi generici dal suo matcher**: «Senior PHP Developer» matchava «Senior Java Developer» tramite il Senior/Developer condiviso. Il matcher mantiene solo token distintivi (PHP, Go, Platform, SRE, Backend…); un ruolo senza token distintivi («Software Engineer») ripiega sulla corrispondenza dell'intera frase. I confini di parola restano: «Go» non matcha mai «Golang» né «Google».
- **remote-qa separa forma da lingua**: il flag A–G è giudicato solo dai codici blocchi/SCORE_SUMMARY/looping; una deriva `report not in <locale>` va al proprio flag e alla colonna warnings (la tabella guadagna la 4a colonna mancante; i codici sono salvati per riga).
- **La barra della mappa è un vero 50/50 a 390 px** (la divisione 58/42 lasciava la ricerca a 124 px e ne troncava il placeholder), e la regola CSS morta `.job-map-job-select` è rimossa.
- **CodeQL 552** — la variabile inutilizzata `OVERLAYS` nel test design-qa rimossa.

### Note

- Le miglia restano rinviate dal proprietario. La deriva linguistica ta rimane una limitazione DOCUMENTATA del backend hermes (2–26 % di prosa tra le esecuzioni; A–G regge): remote-qa la segnala come reperto atteso. La lista dei token generici è volutamente minimale — estenderla costa una riga per lingua.
## [1.251.0] — 2026-10-12

**Il select della mappa ora filtra per SPECIALIZZAZIONE dalle impostazioni (config/profile.yml → target_roles.primary): scegli «Product Manager» o «Backend Engineer (Go / PHP)» e la mappa mantiene solo le posizioni il cui titolo porta le parole di quel ruolo. Il localizzatore a lista di v1.250.0 è rimosso — era lo strumento sbagliato (correzione del proprietario).**

### Aggiunto

- **Filtro per specializzazione**: il select elenca le specializzazioni dalle impostazioni (target_roles.primary); sceglierne una mantiene solo le posizioni il cui titolo porta uno dei token distintivi del ruolo (ai confini di parola, senza maiuscole — «Go» non matcha mai «Google»); il Reset ripristina tutto.
- **Il localizzatore a lista di v1.250.0 è rimosso** — la sostituzione: filtro per specializzazione, non lista di posizioni (correzione del proprietario).
### Cambiato

- Two mobile-map height specs: the floor moves 600 -> 540 px (the toolbar takes ~90 px of the viewport).
### Note

- Le miglia restano rinviate dal proprietario. Il matching è deliberatamente SOLO TITOLO con le parole delle impostazioni: aziende o descrizioni trarrebbero posizioni non correlate nella specializzazione. Una posizione fuori da tutti i ruoli configurati resta visibile sotto «All».


## [1.250.0] — 2026-10-12

**La pagina della mappa diventa operativa: un selettore di posizioni sopra la mappa vola verso qualsiasi posizione visibile e apre la sua scheda (desktop incluso), e una ricerca testuale restringe la mappa per azienda o titolo — entrambe sopravvivono al ricaricamento.**

### Aggiunto

- **Selettore di posizioni**: un select sopra la mappa elenca le posizioni visibili ordinate per azienda+titolo; sceglierne una vola al cerchio e apre la scheda — anche su desktop.
- **Ricerca testuale**: restringe la mappa per azienda+titolo, persiste in map-prefs, Reset la cancella.
- **Il FAB non copre l'attribuzione su `#/map`** a tutte le larghezze.
### Corretto

- Due specifiche di altezza mobile: il minimo va a 540 px (la barra occupa ~90 px del viewport).
### Note

- Le miglia sono rimandate dal proprietario al prossimo rilascio. Le 4 nuove chiavi i18n entrano in tutti i 18 dizionari e lo snapshot assemblato viene rigenerato. Il selettore apre sempre l'anteprima (navigarne via ne vanificherebbe lo scopo); il cerchio si trova tramite un riferimento inverso __job — NON _point, che L.Circle possiede già.

## [1.249.0] — 2026-10-11

**La mappa delle offerte ora privilegia la pertinenza: una scala calma dal verde petrolio al grigio evidenzia le offerte migliori, i filtri per punteggio e tragitto restano memorizzati, il telefono usa una mappa a tutta altezza con anteprima al tocco e il tracker condivide filtro e ordinamento del tragitto.**

## [1.248.8] — 2026-10-11

**Parità con il genitore: il fork e web-ui si sincronizzano con il delta di 115 commit dell’upstream — una nuova fonte PageUp, le celle URL del tracker analizzate come link markdown, lo stato Assessment — più il lavoro linguistico ta/ja: i report in loop vengono tagliati e nominati, lo scheletro dei titoli mantiene A–G stabile, e la quota di scrittura legge solo la prosa.**

### Aggiunto

### Corretto

- **Nuova fonte PageUp** (105 adattatori EN / 110 fonti); le celle URL del tracker vengono analizzate come link markdown (l'href è la chiave di dedup); lo stato Assessment arriva via states.yml.
- **Un report in loop viene tagliato e nominato** (`report looping (block B repeated)`), scheletro di titoli `## A) … ## G)` per il non-inglese.
- **La quota di scrittura legge solo la prosa** (tabelle, SCORE_SUMMARY, codice e URL esclusi) — un report giapponese con tabelle latine non fluttua più.
- **/api/evaluate avvisa `report not in <locale>`** e remote-qa stampa i codici in una colonna.
### -

## [1.248.7] — 2026-10-11

**Il ruolo dall'intestazione del report ora legge la vera convenzione del genitore — `# Evaluation: {Company} — {Role}` — invece di assumere `# <Ruolo> — <Azienda>`, quindi il tracker non porta più «Evaluation: <Azienda>» come ruolo; un report nella lingua sbagliata avvisa invece di salvare in silenzio; e lo chiacchiericcio del modello prima dell'H1 viene rimosso dai report salvati.**

### Corretto

- **L'etichetta localizzata viene rimossa per prima** (`Evaluation:`, `Оценка вакансии:` e altre 16 varianti); dopo l'etichetta `Company — Role` → il ruolo è il lato destro; senza etichetta `Role — Company` → il sinistro; la parte che nomina l'azienda decide; il ruolo non è mai l'azienda né una parola di etichetta — il ripiego è la riga del post pulita.
- **cleanup-plan somma gli N delle righe** (`— N dirty-URL line(s)`), non conta i file — un file con 5 URL sporchi dava 1, non 5.
- **Un report nella lingua sbagliata avvisa**: il prompt apre E chiude con l'istruzione obbligatoria di lingua (tutto il report, tabelle incluse), e la pipeline valida la lingua del report salvato — la deriva appare come avviso `report not in <locale>`.
- **Niente chiacchiericcio del modello prima dell'H1** — il report inizia alla sua riga di intestazione.
### Note

- Non portato e intoccato (verificato nella regressione v1.248.6): l'embed-fetch, la struttura a righe del post («Компания : X»), la deduplicazione «## Rejected», il rifiuto della radice di dominio prima del fetch, l'onestà di recon/link-check e le modalità cleanup. La validazione della lingua è un avviso — il report (contenuto già validato A–G + punteggio) viene salvato; l'operatore vede la deriva e può ripetere la valutazione.

## [1.248.6] — 2026-10-10

**Lucidatura post-regressione della catena Telegram: un post reale mantiene la sua struttura di righe (l'etichetta «Компания : X» e la riga del ruolo vengono trovate dove realmente sono), il ruolo del tracker arriva dall'intestazione del report invece che da una riga grezza del post, e le superfici operative (recon, cleanup-plan, link-check) riportano ciò che dichiarano di riportare.**

### Corretto

- **Un post t.me non si incolla più in una riga**: `<br>` diventa un a-capo prima della rimozione dei tag e le entità HTML numeriche vengono decodificate; il pattern dell'etichetta azienda accetta la forma con spazio prima dei due punti.
- **Il ruolo del tracker viene dall'intestazione del report** (H1 `# <Ruolo> — <Azienda>`)； la riga di fallback viene pulita — senza hashtag, senza emoji, ≤80 caratteri.
- **`## Rejected` non si duplica più**: la sezione viene creata una volta; ogni rifiuto vi aggiunge la propria riga.
- **La radice di dominio viene rifiutata prima della richiesta** — un URL spazzatura non costa più nulla.
- **Recon calcola il segnale del contratto invece di asserirlo** (`honours rejected:` verifica `markPipelineRejected` nel codice deployato); il contatore dei marchi non stampa più «0» due volte.
- **cleanup-plan riporta numeri per categoria** (t-role da spostare, righe dirty-URL, righe test-row) invece di un singolo `grep -c` che contava la propria riga di successo.
- **link-check tratta i 5xx di github.com come non verificati** — dietro il muro dei bot, non come link rotti.
### Note

- Non portato e intoccato (verificato nella regressione v1.248.5): l'embed-fetch stesso, il contratto di salto in pipeline, i test offline _setLookup, l'accettazione degli ordinali uk, i confini di parola nel filtro del ruolo e la modalità cleanup-apply. Il conteggio per categorie di cleanup-plan legge le etichette di output dello script stesso — rinominarle romperebbe silenziosamente i contatori.

## [1.248.5] — 2026-10-10

**Indurimento post-regressione: le voci di post singolo t.me ora recuperano il testo stesso del post (forma embed), una voce rifiutata lascia il pool del timer di valutazione lato server, e la numerazione nativa dei blocchi in un report ucraino viene accettata — inoltre un test che usava segretamente la rete live è offline per sempre.**

### Corretto

- **Le voci t.me finalmente vengono valutate**: la pagina di un singolo post serve solo l'intestazione del canale in HTML puro (~0,2 KB — «View in Telegram» e nient'altro), il modello riceveva una descrizione vuota e ogni voce Telegram moriva in valutazione. Il fetch ora riscrive `t.me/<canale>/<id>` (e la forma feed `t.me/s/…`) nella forma embed (`?embed=1&mode=tme`) — stesso host, validazione SSRF invariata — e legge il post da `.tgme_widget_message_text` (fallback: `og:description`). Nessun testo del widget → rifiuto al passaggio fetch (`telegram post has no text`, `rejected: true`) prima di spendere token LLM.
- **Il timer di valutazione smette di pagare di nuovo per le voci rifiutate (contratto lato server)**: una voce rifiutata ora viene contrassegnata in `data/pipeline.md` — la sua riga lascia la recinzione degli URL e atterra in una sezione `## Rejected` con un motivo breve (idempotente, mai duplicato). Il timer prende URL nudi dalla recinuzione, quindi una voce contrassegnata viene saltata naturalmente — senza dipendere dalle viscere dello script del timer. Recon stampa `pipeline rejected marks: N` + `honours rejected: yes (server-side)` invece di setacciare lo script.
- **I report ucraini superano di nuovo la validazione A–G**: un modello uk numera i blocchi secondo l'ordine del proprio alfabeto (А Б В Г Д Є Ж), e il passaggio dei lookalike contava solo А/В/Е — esattamente i blocchi C, D, F, G mancavano in produzione (2/2 riproduzioni). Il validatore ora accetta la sequenza ordinale ucraina quando i titoli appaiono in ordine (la stessa disciplina di abjad per ar e devanagari per hi), e il prompt di valutazione per ogni locale ora richiede esplicitamente `A`–`G` latine.
- **Il cancello delle parole chiave di ruolo scatta su parole, non sottostringhe**: le radici `linkedin.com/` e `x.com/` passavano il cancello perché `lead`/`it` vivevano nel testo dell'interfaccia della pagina. Le parole chiave ora corrispondono ai confini di parole Unicode, e una radice di dominio (URL senza percorso) viene rifiutata prima della chiamata LLM.
- **Un test unitario non ha più bisogno della rete live**: il test no-hints (`tests/auto-pipeline-jd-gate.test.mjs`) sostituiva il trasporto HTTP ma eseguiva comunque una vera query DNS — verde in CI solo perché il runner aveva connettività. safe-fetch ha guadagnato un hook `_setLookup()` (il risolutore stesso è sostituibile nei test; il codice di produzione non lo sovrascrive mai), e il test risolve offline.

### Aggiunto

- **Modalità workflow `cleanup-plan` / `cleanup-apply` in deploy.yml**: la pulizia dei rifiuti QA in produzione (post-qa-cleanup) gira lato server senza SSH da un laptop. Il log riporta solo numeri — nessun nome di file o anteprime di righe, perché il log è pubblico e i nomi dei file contengono nomi di aziende. Il passaggio Verify viene saltato per le modalità di pulizia.

### Note

- Non portato: il compilatore di localizzazioni a confini di parola e la tabella degli stati USPS del genitore (documentato da v1.248.1). Il contratto di salto delle voci rifiutate vive lato server (contrassegno in data/pipeline.md), non nello script del timer — è fuori dal repository e volutamente non modificato.


## [1.248.4] — 2026-10-10

**Il proseguimento del round di regressione: la catena di risoluzione del ruolo per le voci Telegram — un post cirillico con una vera offerta ora produce un report nominato invece di un file `unknown-role` rifiutato — e la chiamata LLM si attiva solo per le voci che vale la pena valutare.**

### Corretto

- **La catena del ruolo funziona per i post cirillici**: l’elenco di parole chiave ha guadagnato разработчик/программист/инженер/аналитик/менеджер/руководитель/тимлид/лид/дизайнер/тестировщик/QA/архитектор/специалист/директор/DevOps/SRE (il vecchio era solo EN: 0 post reali su 40 ottenevano un ruolo), l’intestazione del report è consultata (`parseReportHeader` — il modello scrive il ruolo nell’H1), e la prima riga sensata del post è l’ultima risorsa.
- **Il gate d’identità si è spostato PRIMA della chiamata LLM**: una voce senza società e senza traccia di ruolo fallisce al passo fetch (`rejected: true`) — niente token bruciati per una valutazione che sarebbe stata rifiutata comunque.
- **`t.me/s/<canale>/<id>` non nomina più la società «S»** — il segmento di anteprima è saltato; entrambe le forme di link risolvono al canale.
- **Le auto-etichette «Компания: X» nei post Telegram** sono onorate (e «…в компании X» a metà frase per gli host di messaggistica).

### Aggiunto

- **I fallimenti dell’auto-pipeline portano `rejected: true` nell’errore SSE** — il timer di valutazione lato server usa il flag per saltare la voce del pipeline invece di riprovarla ogni 2 ore.

### Note

- Non portato: il compilatore di parole chiave di localizzazione a confini di parola del padre e la tabella USPS (documentato dal v1.248.1).
- Il blocco «Translations» del README è generato da un’unica lista canonica, con un test di parità in CI (17 link per file, il proprio mai linkato) — ar/pl/uk hanno ottenuto il blocco; la deriva dei separatori `|`/`·` è eliminata.

## [1.248.3] — 2026-10-10

**Proseguimento del round di regressione: il timer di valutazione non può più in nessun caso archiviare spazzatura Telegram senza nome come report, la pulizia QA non cancella più vere offerte Telegram, l’attribuzione della mappa è di nuovo visibile e le chip della dashboard leggono ≥ 4.5:1.**

### Corretto

- **L’auto-pipeline valida PRIMA di salvare**: un report senza punteggio 0–5 o senza blocchi A–G termina la corsa al passo evaluate (`rejected: true` nel payload SSE) — nessun file di report, nessuna riga tracker. Le voci t.me che passavano la porta di lunghezza v1.248.2 hanno prodotto altri due rifiuti dopo quella versione; ora le voci senza nome sono rifiutate con `company/role not identifiable`.
- **`guessCompanyRole` non inventa più una società dagli host di messaggistica** — `t.me`, `telegram.me`, `vk.com`, `linkedin.com` e affini sono in EMPTY_DOMAINS: un post Telegram retrocede sul nome del canale, e una voce senza nome viene rifiutata invece di essere archiviata come `unknown-role`.
- **`post-qa-cleanup` legge prima il punteggio dall’intestazione**: l’auto-pipeline rimuove il blocco SCORE_SUMMARY prima di salvare, così la vecchia verifica solo-summary segnava ogni offerta Telegram salvata come spazzatura — in produzione 8 su 41 portano un punteggio nell’intestazione e `--apply` le avrebbe cancellate. Il punteggio d’intestazione (via `parseReportHeader`) è ora il segnale primario; il blocco è la riserva. Il dry-run stampa il motivo per ogni file.
- **L’attribuzione Leaflet è visibile su #/map** — il FAB docs la copriva (violazione della licenza OSM); l’angolo è sollevato di 96px.
- **Le chip della dashboard superano 4.5:1** — le etichette `dash-chip` e la variante `--manual` passano a `--foggy-strong` (prima 4.31:1).

### Aggiunto

- **I fallimenti dell’auto-pipeline portano `rejected: true` nell’errore SSE** — il timer di valutazione lato server usa il flag per saltare la voce del pipeline invece di riprovarla ogni 2 ore.

### Note

- La deriva ar/ja **non si è ripetuta** alla re-esecuzione (vedi v1.248.2).
- **La pulizia della produzione attende ancora un sì esplicito dell’utente** (CAR-61c); con questa correzione la pulizia non può più cancellare le vere offerte Telegram.

## [1.248.2] — 2026-10-10

**Round di regressione: il timer di valutazione non trasforma più spazzatura del pipeline in «Last evaluation», il parsing di SCORE sopravvive ai formati reali e il tracker parla finalmente la tua lingua.**

### Corretto

- **I report con JD vuoto non vengono più scritti.** Il gate JD dell’auto-pipeline è salito da 50 a 200 caratteri prima della chiamata LLM — le pagine segnaposto (`example.com/qa-v167-…`) finiscono in errore SSE + avviso in console invece di un report `…-t-role-<ts>.md` che la dashboard mostrava come «Last evaluation» (42 file in produzione).
- **Il parsing di SCORE_SUMMARY sopravvive ai formati reali**: «4,2/5», «4.2 / 5», «**4.2**», «SCORE :» validano tutti; una virgola con 1–2 cifre è decimale, con 3 è migliaia (il vecchio codice leggeva «4,200» come 4.2 e passava il gate 0–5). Un fallimento registra solo la riga `SCORE:` — mai il contenuto del report (i log CI sono pubblici).

### Aggiunto

- **`scripts/post-qa-cleanup.mjs`**: dry-run per impostazione predefinita, `--apply` con backup automatici (`*.bak-<ts>`, report spostati in `qa/cleanup-backup-<ts>/`): righe ZZ-QA-TEST del tracker, report `*-t-role-*` senza SCORE valido, voci `example.com` del pipeline.

### Note

- La deriva ar/ja del round di regressione **non si è ripetuta** alla re-esecuzione (entrambi: lang ✓ + A–G ✓) — la voce ta del language-check e il parsing SCORE irrobustito vanno come defense-in-depth.
- **La pulizia della produzione attende un sì esplicito dell’utente**: prima il piano in dry-run, poi `--apply`.

## [1.248.1] — 2026-10-09

**`location_filter` ottiene i livelli `always_allow` e `block_hard` del padre (CAR-60) — una stringa di localizzazione multipaese sopravvive a un elenco di blocco dei fratelli, e un blocco duro esplicito non può più essere salvato.**

### Corretto

- `always_allow` batte `block`: con `block: [romania, poland, croatia]` e `always_allow: [united kingdom]`, la cella fusa di workable «London, United Kingdom · Romania · Poland · Croatia» passa — la regione d’origine è un’opzione (il caso consumatore di workable #4806, ora in forma padre).
- `block_hard` batte `always_allow`: termini di livello paese che non devono mai essere salvati da un hit always_allow altrove nella stringa.
- `strict: true` ora conta `block_hard` come livello restrittivo; la sezione `location_filter` di docs/help documenta entrambi i livelli ×18.

### Note

- Non portato questa volta di proposito: il compilatore di parole chiave di localizzazione a confini di parola del padre e la sua tabella degli stati USPS (web-ui mantiene la corrispondenza per sottostringa; la tabella serve configurazioni centrate sugli USA — archiviare sotto CAR-60 se serve). La forma allow-list del test consumatore di workable resta un secondo verdetto accanto alla nuova forma padre.

## [1.248.0] — 2026-10-09

**Parità col padre: cinque correzioni a monte di provider/liveness portate — le board che hanno spostato l’API continuano a funzionare e un banner di chiusura su riga propria non viene più perso.**

### Corretto

- **Gupy segue l’API verso `portal.gupy.io`** e invia i nomi dei filtri che l’API legge davvero (`workplaceType`/`type`) — i vecchi nomi plurali venivano ignorati in silenzio; `country` non viene più inviato (un paese configurato disegna un avviso con il nome della voce). I datori confidenciali cadono per corrispondenza esatta dell’etichetta («Confidencial Seguros» sopravvive) e `max_pages` ha un tetto di 100 — l’API risponde 400 oltre l’offset 10.000, e l’avviso di troncamento ora suggerisce di restringere le parole chiave.
- **Workable conserva tutti i paesi di una offerta multipaese**: i fratelli sotto lo stesso URL di offerta si ripiegano in una riga («London, United Kingdom · Romania · Poland · Croatia») invece di lasciar vincere il primo paese.
- **Liveness: un banner su riga propria non fa parte della riga sopra** — «Sign in if you want to apply» / «Get notified when this position is filled» sotto un’offerta si legge come la clausola di chiusura che è, mentre un genuino «until filled» a cavallo di righe si legge ancora attivo.
- **Radancy legge un elemento fratello `job-location`** nel markup legacy delle card (i layout della famiglia Barclays mettono la localizzazione dopo `</a>`) — le righe senza localizzazione propria restano vuote invece di prendere in prestito quella del vicino.
- **I link di fallback di SmartRecruiters conservano lo slug configurato** — un’offerta senza `ref` affidabile sintetizza il suo URL pubblico dallo slug del tenant, mai dal nome visualizzato.

### Aggiunto

- No-port documentati: la correzione a monte `_http` proxy `fetchImpl` (web-ui non ha un ramo proxy — portarla annullerebbe il controllo d’identità della guardia DNS-rebinding e aggiungerebbe una dipendenza undici che il repo evita di proposito); `verify-ats` a monte (+226 righe) e `cv-facts` (web-ui implementa il proprio scoring ATS e il parsing CV); la dashboard Go TUI del padre e i suoi script CLI; un riordino degli import in Teamtailor (cosmetico).

### Note

- Lacuna nota come follow-up: il tier `always_allow` del filtro di localizzazione del padre (il test consumatore di workable sopravvive a un blocco UK grazie a esso) non esiste in web-ui; il port ha espresso lo stesso verdetto consumatore tramite un test allow-list. Archiviato come modifica separata.

## [1.247.0] — 2026-10-09

**La coda della scansione design CAR-49…58 è chiusa — tutti i reperti minori e di polish rimanenti, più la mappa scura che la versione precedente aveva rimandato di proposito.**

### Corretto

- **La mappa renderizza un vero tema scuro.** Zoom/livelli/attribuzione sono diventati scuri in v1.246.0; ora seguono anche le tessere: il modo scuro disegna il layer OSM con un’inversione CSS (senza chiavi di fornitore) e un preset Carto-dark con chiave è disponibile via `MAP_TILE_DARK_URL` (il suo host è ammesso nel CSP `img-src`). Il layer si rimonta in diretta al cambio tema.
- **I callout gialli hanno varianti scure** (`config`, `batch`, avviso hero) con la meccanica a token di v1.246.0 — e in corsa è stata colta una regressione: `.callout a` soffocava `.btn-primary`; ora con ambito `:not(.btn)`.
- **L’URL della scheda info di Apply non si tronca più** a metà parola.
- **I pulsanti d’intestazione del CV usano un unico sistema di icone** (testo; fuori il miscuglio 📁/📄/💾).
- **Le tab di stato del tracker hanno un’unica cassa** — caratteri da frase, con adattamenti per locale (CJK/ar/hi/ta senza forme di genere).
- **Le icone della barra superiore sono un solo set SVG a tratto** — fuori il miscuglio 🔔/🌙/🩺; il pulsante tema disegna sole/luna via CSS.
- **La card Pipeline della dashboard perde il suo evidenziato rosa** (anello solo hover/focus).
- **Eliminare le ricerche salvate appare davvero distruttivo** (`.btn-danger`, non un ghost neutro).
- **L’anteprima di pipeline ha un vero stato vuoto** (titolo + suggerimento + CTA, schema tracker).
- **Il meta tempo/costo segue un unico schema**: `UI.pageMeta` disegna ⏱ + costo su una riga sotto il titolo della vista (evaluate/deep/auto/mode-page/orientation).
- **Auto-pipeline perde il suo ✨** — l’unico h1 decorato dell’app torna sul bordo sinistro condiviso.
- **L’URL dei docs di batch è un link in linea**.
- **interview-digest / orientation hanno stati vuoti disegnati** (titolo + suggerimento + CTA).
- **L’export di career-plan è disabilitato senza piano**, azioni su una sola riga.
- **stats: via il titolo duplicato «Market report»** e il placeholder di regione sta in riga (testo più corto ×18, larghezza fissa).
- **Config non perde più percorsi assoluti** — il `displayPath()` lato server mostra `~/…` o il nome nudo del file.
- **L’helper di LLM_PROVIDER sono tre righe brevi** (×18 + `pre-line`), non un muro mono di 150 caratteri.
- **La card EMAIL del profilo tiene l’indirizzo su una riga** (ellipsis; a capo solo ≤480px).
- **Il testo di Health non spezza più le parole** («Run buttons» intero; overflow-wrap anywhere).
- **Il codice inline del help sopravvive all’RTL** (isolato LTR, nowrap, scorrevole).
- **La pill «Live evals» dell’hero non collide più** in ru/ar (flex-wrap, icone non riducibili).

### Aggiunto

- **Preset di tessere scure** (`MAP_TILE_DARK_URL` + attribuzione) documentato nel codice; l’ampliamento del CSP `img-src` copre l’host Carto.

### Note

- Il default delle tessere scure è un’inversione CSS di OSM — Carto senza chiave ha chiuso le basemaps dietro una API key (verificato con richiesta); il preset con chiave è un opt-in, non il default.

## [1.246.0] — 2026-10-09

**Tutti i dieci reperti principali della scansione senior-design CAR-48 sono corretti — bloccante e tutti e sette i major inclusi.**

### Corretto

- **Apply scuro: il link della scheda info è di nuovo visibile.** La scheda conservava la superficie chiara in modalità scura; il link «Need Playwright? See …» era a ≈1.0:1. Il `.callout--info` a token di tema (surface/border/text/link) porta il link scuro a ≈7.3:1.
- **RTL non ribalta più le composizioni numeriche.** Le pillole di punteggio («1.5 / 5»), le fasce dei report («≥ 4.5», «< 3.5») e il «/ 5.0» della dashboard ricevono isolamento direzionale (span LTR); il dizionario ar riformula in parole gli intervalli dove la prosa lo chiede.
- **Il markdown del CV resta LTR.** Textarea e anteprima si rendono con `dir="ltr"` in arabo; il telaio attorno resta RTL.
- **La colonna DATE dei report non spezza mai più** una data ISO (nowrap + cifre tabulari).
- **La sidebar termina sopra l’HUD di utilizzo** (riserva dello scrollport + dissolvenza) — l’ultima voce di navigazione non scorre più sotto il pannello; specchiato per RTL.
- **Scan mobile @390: «Save search» interamente visibile** — la riga di controlli va a capo e si comprime invece di tagliarsi al bordo.
- **I controlli della mappa seguono il tema scuro** (zoom, livelli, attribuzione). Le tessere restano volutamente invariate: la loro origine è fissata lato server dal CSP `img-src`.
- **Il FAB della chat non copre più contenuto interattivo** — il padding di scorrimento lo libera (pulsanti Disable di Portals, pill di punteggio di Reports, input del two-pager, attribuzione Leaflet).
- **Il log attività parla la lingua dell’UI**: 22 slug d’azione localizzati ×18 locale (fallback sull’id grezzo per gli sconosciuti) e le chip di filtro tradotte; la colonna TARGET resta — la riempie auto-pipeline.
- **I form di assessments hanno etichette vere** (caratteri da frase, legame `htmlFor`/`id`) invece di soli segnaposto.

### Note

- Non in questa release: tessere mappa scure (richiede un ampliamento del CSP `img-src` — lato server, volutamente non lato client); varianti scure dei callout gialli (`config`, `batch`) — la meccanica a token è pronta per un seguito.

## [1.245.0] — 2026-10-09

**Il tamil (தமிழ்) entra come 18ª lingua dell’interfaccia — la prima nuova lingua dall’ondata delle 17, con parità completa delle chiavi.**

### Aggiunto

- **Tamil (`ta`): 1449/1449 chiavi** in piena parità con `en`, nessun segnaposto perso, convenzioni indic-tech in stile hi (provider, nomi di modello, percorsi e comandi restano in caratteri latini). `detect()` accetta `ta`, `ta-IN`, `ta-LK`; il tamil è LTR (bloccato da test).
- **docs/help/ta.md completo** (33 H2 / 125 H3, conteggi sorgenti verificati contro il registro attivo, ancore canary Hermes, YAML letterale), più i specchi README.ta.md e CHANGELOG.ta.md.
- **Gate di enumerazione 17 → 18**: LANGS, sonde detect, audit i18n, parità dei changelog, guardia RTL, `langs` del CI — che recupera anche `hi`, finora assente dall’elenco CI.

### Note

- La landing di cvstart.org resta per ora a 17 lingue — tradurla è un’attività a parte; la sincronizzazione dei contenuti del sito pubblica già docs/help/ta.md e il changelog ta.
- REPORT_LABELS di `report-header.js` resta a 17 — il parsing dei rapporti tamil arriverà con la generazione dei rapporti tamil nel repo padre.

## [1.244.2] — 2026-10-08

**La rifinitura della pagina di scansione: launcher, barra di stato, pannello repost e filtri ridisegnati come un chrome coerente — e la tabella dei risultati non può più essere allungata dai dati dei board.**

### Corretto

- **Le celle dello stipendio mostrano solo la forbice monetaria.** Alcuni board mettono tutta la descrizione dei benefit nel campo stipendio — la cella visibile ora mostra solo la parte economica e sposta il testo nel tooltip (prima: una cella di 6 righe che stirava ogni riga).
- **Le righe con titolo vuoto mostrano l'azienda** (poi un trattino neutro) invece di una cella gigante vuota.
- **Il badge di seniority non va mai a capo** nella sua colonna a larghezza fissa.
- **Le righe senza punteggio mostrano un «◎ —» attenuato** con tooltip che spiega che il confronto two-pager non ha trovato corrispondenze (prima: nulla, sembrava rotto accanto alle righe con punteggio).

### Aggiunto

- **Refonte du chrome: card launcher (riga di controlli allineata, pulsante primario dominante), barra di stato del terminale con punto di stato (idle/running/done/errore) rispetta reduced-motion, pannello dei repost con tetto di altezza e header sticky (un dataset di 1,560 cluster renderizzava un pannello da 155,000 px), e il blocco filtri come griglia responsiva uniforme con footer allineato.**

### Note

- Tutto il resto di #/scan è identico a v1.244.1 — sono cambiati solo la rifinitura del chrome e le quattro correzioni sopra. Test 5045 → 5068 unit.

## [1.244.1] — 2026-10-08

### Corretto

- **Scan icons announce real values.** The boost/fit/score icons' accessible names leaked the raw dict templates ("Fit: {band}", "Boosted by {by}") — `{band}`/`{by}`/`{score}` are now substituted (band word, booster keyword, numeric score). [HIGH a11y, caught live in the v1.244.0 regression round]
- **Title pipes split correctly.** A 4-segment title like «C++ | Rust | Go Developer | Onsite» no longer lifts "Go Developer" out as a "country" — the split demands the segment resolves to a real country (conservative `Countries.detectCountry`).
- **Meta dates render for every row.** `daysSince` accepted date-only ISO, but the API serves full timestamps for ~83% of dated rows — those rows showed no date segment.

### Note

- Tutto il resto di #/scan è identico a v1.244.0 — sono cambiati solo i tre fix sopra.
- Deliberatamente non fatto: stato dei filtri nell'hash URL, navigazione delle righe da tastiera e il parsing di `5 lakhs INR` (follow-up esistenti).

## [1.244.0] — 2026-10-08

**I risultati della scansione si leggono come un elenco, non come un muro: un annuncio = due righe, i segnali sono icone e una scansione da 700 righe è una tabella impaginata invece di una pagina da 37,000 px.**

### Corretto

- **Anatomia della riga.** Ogni annuncio viene reso come una riga delimitata a due linee: linea 1 il titolo, linea 2 `company · location · source · date · work-type`. Il badge di potenziamento, la fascia di title-fit e il punteggio di corrispondenza sono diventati icone con nomi accessibili localizzati e tooltip (i lettori di schermo leggono «Соответствие: сильное» / "Fit: strong", non un muro di parole); i badge di affidabilità e di trasferta si sono fusi nella stessa barra. Seniority e stipendio restano colonne ausiliarie solo desktop.
- **Igiene del titolo.** Un segmento finale `| Germany | Remote` viene separato dal titolo e portato nella riga meta — consapevole di Unicode, e solo quando la coda è un vero marcatore di tipo di lavoro e il segmento centrale ha la forma di un luogo (le barre legittime come "C++ | Rust | Go Developer" non vengono mai separate).
- **Niente più allargamento orizzontale.** Layout di tabella fisso, `min-width: 0`, titolo e meta ellissizzati su una riga con il testo completo nel tooltip: zero overflow della pagina e zero scorrimento interno della tabella a 1440 px e 390 px (la vecchia pagina traboccava di 675 px alla larghezza del telefono).
- **Impaginazione.** I risultati vengono resi 50 per pagina (25/50/100/200 selezionabili) — una scansione da 700 righe ora è alta ~4,600 px invece di ~37,000 px, e il DOM contiene ~1,000 nodi invece di 5,500+.

### Aggiunto

- Test contrattuali di layout: la riga a due linee, i nomi accessibili delle icone (en + ru), il budget di nodi dell'impaginazione e la guardia su conteggio/ordine del title-fit girano nella suite browser — il redesign non può regredire in silenzio.

### Note

- Test **5036 → 5045** unitari (la suite browser ha guadagnato i contratti di layout), media di copertura **98.14 % righe / 89.34 % rami** (soglia 96/86).
- Ciò che lo scanner trova, le formule di punteggio e `last-scan.json` restano intatti — il title-fit resta un'annotazione.
- Non incluso in questa versione: lo stato dei filtri nell'URL-hash e la navigazione da tastiera tra le righe (follow-up); l'analisi di `5 lakhs INR` (preesistente).

## [1.243.2] — 2026-10-08

### Corretto

- **Versione deployabile ritagliata come v1.243.2.** Il tag git v1.243.1 è stato ri-puntato dopo la pubblicazione, e il `git fetch --tags` del server rifiuta correttamente di sovrascrivere un tag esistente — quindi v1.243.1 non è mai stato deployabile. Questo tag porta l'albero identico (il fix del window-listener della modale su base v1.243.0) più questo incremento di versione. Null'altro è cambiato; il tarball npm 1.243.1 conteneva già il fix.
### Note

- Il codice dell'app è identico a v1.243.1 — nuovo è solo il tag deployabile (il `git fetch --tags` del server ha rifiutato la v1.243.1 ri-puntata).
- Deliberatamente non fatto: forzare l'aggiornamento del tag lato server (i tag pubblicati non si spostano mai).

## [1.243.1] — 2026-10-08

### Corretto

- **La modale «Registra esito» ora si chiude davvero alla navigazione.** La guardia v1.243.0 ascoltava `hashchange` su `document`, dove quell'evento non scatta mai — la correzione è arrivata morta e la modale continuava a bloccare la vista successiva (trovata dal vivo in produzione nel round di regressione v1.243.1). La guardia ascolta su `window`; il test dispatcha anche lì ed è stato verificato rosso contro il codice rotto.

## [1.243.0] — 2026-10-08

**Lo strato del browser tiene al sicuro il tuo lavoro e parla la tua lingua: nessuna perdita di modifiche non salvate, nessun fallimento silenzioso, nessun inglese silenzioso in un'interfaccia tradotta, contrasto AA ovunque.**

### Corretto

- **Le modifiche non salvate sopravvivono ai re-render.** L'editor del CV mantiene un buffer sporco e lo ripristina a ogni render — Annulla, un cambio di lingua o navigare verso CV Studio ora chiedono conferma invece di scartare; il piano di carriera conserva il proprio testo generato allo stesso modo. I fallimenti di caricamento in Config/CV Studio/career-plan/memory/two-pager mostrano un errore e disabilitano Salva invece di sovrascrivere in silenzio il file con campi vuoti.
- **La modale "Registra esito" non sopravvive più alla navigazione.** Aprirla su `#/tracker` e cliccare un'altra vista la lasciava bloccare l'intera pagina (emersa nella regressione a due banchi di test della v1.242.1) — ora si chiude al cambio di rotta; anche le viste sorelle della scansione fermano i loro flussi SSE e staccano i listener alla navigazione.
- **L'analisi di stipendi e parole chiave legge ogni sistema di scrittura.** I chip delle parole chiave usano confini di parola Unicode (cirillico, `c++`, `.net` filtrano correttamente invece di azzerare le righe); un unico parser degli stipendi condiviso corregge `$182.9K - $240K`, `от 100 000 руб`, `100 тыс. руб.`, `50 000 Kč` (prima 50M USD) e la semantica degli intervalli (`$100-150K`); un must-have "Germania o Paesi Bassi" non conta più sia come soddisfatto sia come violato.
- **I flussi si assestano esattamente una volta.** Una connessione SSE caduta consegnava l'errore due volte e poteva lasciare Genera disabilitato per sempre; ogni stato terminale (done/error/close/throw, incluso un processo figlio ucciso) si assesta su un unico percorso e riabilita il pulsante. L'auto-pipeline scarica l'ultimo frame bufferizzato invece di buttarlo via.
- **Privacy e correttezza nei percorsi minori.** Il corpo del bug report non porta più l'URL dell'offerta valutata né gli slug dei report; la privacy del CV maschera i link nudi `linkedin.com/in/…`, i nomi in tutte maiuscole e smette di alterare le date UE; la risoluzione del paese prende la corrispondenza più lunga e si rifiuta di indovinare quando sono citati due paesi ("Cambridge, MA" non finisce più → Regno Unito); i download dei file conservano i nomi in cirillico.
- **Router e a11y.** Il link di salto al contenuto non finisce più in 404 su `ontent`; la voce di navigazione attiva porta `aria-current="page"`; un solo `<main>`/un solo `<nav>`; Escape chiude il cassetto mobile (che ora è davvero fuori dall'ordine di tabulazione quando è chiuso); `scroll-padding-top` tiene il focus visibile oltre le barre sticky; il banner sticky non copre più la topbar.
- **Il contrasto è AA in entrambi i temi** — i toast scuri erano bianco su bianco (1.10:1): toast, pulsanti, banner e link su `--rausch` ora passano per token invarianti rispetto al tema, sotto la guardia di test contrattuali WCAG calcolati (≥ 4.5:1).
- **Tutto il resto del giro**: evaluate mostra l'avviso di troncamento; memory/config/two-pager si rifiutano di salvare sopra un caricamento fallito; scan smette di lasciare orfano il suo SSE; i risultati della scansione classificano i board basati su API dal registro del server invece che da una regex fuori sincrono; il "Procedi con cautela" del tracker è un avviso, non un badge-red; le statistiche aggregano gli stati localizzati; i grafici a barre si leggono correttamente in RTL; il FAB della documentazione non copre più il contenuto sui telefoni; `GET /app.js` risponde 404 invece della shell dell'indice; `GET /api/runners` elenca le sue azioni.

### Aggiunto

- **Il danese entra nell'auto-rilevamento** — un browser `da-DK` riceve ora l'interfaccia danese (il dizionario era completo, era il rilevamento a non vederlo); `zh-Hant*` mappa sul cinese tradizionale. `cv-diagnostics` — la checklist del curriculum — è completamente localizzata (28 chiavi `diag.*` × 17). Aggiunte 26 etichette di field-spec; rimosse 31 chiavi morte; gli elenchi dei provider non affermano più che Hermes sia "ultimo nell'ordine automatico"; le aria-label del docs-fab/del menu sono localizzate.

### Note

- Test **4812 → 5036** unitari, browser **118 + nuovi contratti di navigazione/contrasto**, media di copertura **98.15 % righe / 89.34 % rami** (soglia 96/86).
- Non incluso in questa versione: il redesign di `#/scan` (Fase 4 — v1.244.0, spec redatta); una chiave di dizionario dedicata `export.docxFailed` (il fallimento riusa `common.error`); `5 lakhs INR` si analizza ancora come 5 (preesistente).

## [1.242.1] — 2026-10-08

### Corretto

- **L'archivio di release non contiene più i symlink `node_modules`.** Il tag git v1.242.0 portava un symlink `node_modules` nella radice e `site/node_modules` (un `git add -A` generico li ha fatti passare oltre i pattern di ignore con barra finale), facendo fallire l'estrazione tar del deploy sul server — il deploy è tornato indietro in sicurezza e la produzione è rimasta su 1.241.1. Entrambi i symlink sono fuori dal tracciamento e i pattern di ignore ampliati; il tarball npm non è mai stato interessato (npm esclude `node_modules` al packing).

### Note

- Il codice dell'app è identico a v1.242.0 — solo packaging. I contenuti sulla correttezza delle fonti vanno in produzione con questo deploy (v1.242.0 non è mai arrivato in produzione: il deploy server è tornato indietro dopo il fallimento tar).
- Deliberatamente non fatto: ri-taggare v1.242.0 (npm ha già pubblicato 1.242.0; il tarball del registro è pulito — npm esclude `node_modules` al packing).

## [1.242.0] — 2026-10-07

**Lo strato dati dello scanner è di nuovo affidabile: le fonti morte tornano vive, una risposta malformata non può più fingersi un board vuoto e un URL ostile di un board non può più reindirizzare una scansione.**

### Corretto

- **Le fonti morte tornano vive.** justjoin (l'inviluppo dell'API è cambiato in `{data, meta.next.cursor}`) legge l'intero catalogo con un percorso per cursore e i nuovi campi salariali; nofluffjobs risponde 400 senza `salaryCurrency` — viene inviata la query richiesta dal genitore e i risultati vengono paginati (`pageTo`). himalayas e jobicy vedevano solo le ~20 offerte più recenti di oltre 100k — ora entrambe percorrono l'intero catalogo (paginazione per offset / cursore con tetti di pagine).
- **Un 200 con la forma sbagliata genera un errore già alla pagina 1.** ~40 fonti leggevano risposte malformate o challenge come "0 offerte" e la scansione "riusciva" in silenzio. Le nuove guardie di `server/lib/sources/_shape.mjs` (`requireArray` / `requireContainer` / `requireObject`) rendono il fallimento rumoroso in ogni famiglia; un fallimento a una pagina successiva conserva le pagine già raccolte; la paginazione si ferma sulla lunghezza grezza della pagina, non sul conteggio filtrato.
- **SSRF: i controlli dei fornitori per sottostringa sostituiti da pin di host esatti analizzati.** lever (`clever.com` contiene `lever.co`), greenhouse (5 host + i legacy host path-slug `boards[.eu].greenhouse.io`), ashby, smartrecruiters, workable, gem REST, ibm, arbeitsagentur, hecklerkoch (solo www), workingnomads (`http://169.254.169.254` era raggiungibile oltre la guardia DNS), remoteok, remotive, rss, successfactors. `redirect:'error'` ovunque; gli URL delle offerte devono essere `https:` sull'host fissato (`javascript:` / `data:` / fuori host scartati).
- **Una singola voce errata in `portals.yml` non può più interrompere un'intera scansione.** `resolveAdapter` intercetta le eccezioni degli adattatori, `detectApi` è incapsulato per azienda, gli adattatori che lanciano restituiscono `null`; gli errori di fetch di comeet oscurano `?token=` prima che finiscano nei log o nei record di quarantena.
- **Paginazione e freschezza.** workday percorre i tenant oltre le 100 offerte (pagine per offset, `MAX_PAGES`); telegram conserva i post più RECENTI e pagina con `?before=` invece di tenere in silenzio i più vecchi; tencent prosegue quando manca `Count`; taleo analizza le tabelle con intestazioni francesi; avature si ferma sulla lunghezza grezza della pagina; date in UTC (amazon con lo scarto di un giorno a est di UTC, torre, workingnomads, trudvsem); entità HTML decodificate (geekjob, getmatch, hh); mycareersfuture emette la forma completa dell'offerta a 12 campi.
- **Rilevamento del remoto inasprito.** arbeitsagentur, vdab, rippling, teamtailor: la percentuale di contratto ("Verpleegkundige (100%)", `bundesweit`) e la parola "distributed" ("Distributed Systems Engineer") non etichettano più Remote ruoli in sede.

### Aggiunto

- `tests/adapters-pin-coverage.test.mjs` completa la copertura dei rami dei pin di host introdotta dai pin.

### Note

- Test **4419 → 4812** unitari, browser **118**. Media di copertura **98.15 % righe / 89.36 % rami** (soglia 96 / 86).
- Non incluso in questa versione: i risultati lato client dello stesso giro di revisione (Fase 3 — viste, librerie, CSS/a11y, i18n); `sources/habr.mjs` non ha ancora un file di test dedicato (esenzione dal cricchetto).

## [1.241.1] — 2026-10-07

**Le valutazioni dal vivo funzionano end to end in ogni lingua, la mappa delle offerte posiziona gli annunci lunghi con più sedi e un deploy non interrompe più una scansione in corso.**

### Corretto

- **Le valutazioni vedono tutto il metodo.** Il budget di contesto (144 KB) tagliava ancora la fine di `modes/oferta.md` una volta inseriti CV e profilo, quindi ogni valutazione dal vivo perdeva gli ultimi blocchi. Il budget ora è 192 KB e il limite morbido del prompt 256 KB, definiti una sola volta in `llm-dispatch.mjs`.
- **Report nella lingua scelta.** L'istruzione sulla lingua ora apre il prompt oltre a chiuderlo, e le parole comuni (ruolo, team, design…) sono scritte nella lingua del report; restano in inglese solo nomi, tecnologie e citazioni testuali. Risolve i report in hindi e giapponese che erano in gran parte in inglese.
- **Le valutazioni lente non finiscono più in HTTP 502.** Il timeout della valutazione è 300 s (prima era quello predefinito del provider, 180 s).
- **Lettere dei blocchi in hindi.** Un report che scrive le lettere A–G in devanagari (`## ए)`, `## बी)` … `## जी)`) viene riconosciuto, e `SCORE:` accetta cifre locali (`३.८`, `٣٫٨`, `３．８`) e la virgola decimale.
- **Mappa delle offerte: sedi lunghe.** Una cella come "Berlin Office · Berlin · Germany · Bosnia · …" (oltre 300 caratteri) veniva rifiutata con HTTP 400 e l'annuncio restava senza marcatore. Ora si usa il primo luogo reale (`·`, `;`, `|`, ` / `, a capo; i segmenti "Remote …", "(HQ)" e "Office" vengono saltati); solo una query oltre i 2000 caratteri viene rifiutata.
- **Deploy e scansione oraria.** Il deploy sospende i timer di scansione e di valutazione automatica, attende la fine di una scansione in corso (fino a 15 min), riavvia e riattiva sempre i timer — anche in caso di rollback.

### Aggiunto

- **Mappa delle offerte su [cvstart.org](https://cvstart.org/#job-map)** in tutte le 17 lingue, e nei README in inglese e russo.
- **Screenshot della mappa in tutte le lingue**: uno per lingua (`scripts/capture-map-screenshots.mjs`), in tutti i 17 README, su cvstart.org e in una nuova sottosezione della guida, «Come usare la mappa» (§33, ×17).

### Note

- Test **4404 → 4419**, browser **118**. QA remota (tutte le route, sito, link e LLM dal vivo × 17 lingue) verde in produzione.
- Non incluso in questa versione: valutazioni in streaming; il timeout di 300 s resta un limite rigido (un modello locale lento può ancora raggiungerlo) e il ponte Hermes mantiene la chiamata senza streaming.

## [1.241.0] — 2026-10-07

**Release di consolidamento nata da una revisione del codice con 28 agenti (~190 problemi verificati): chiuse le classi sicurezza, crash del processo e perdita di dati, più una mappa delle offerte contribuita da @bullitt186.**

### Aggiunto

- **Mappa delle offerte (`#/map`)** — le offerte della pipeline, dell'ultima scansione e del tracker su una mappa OpenStreetMap, geocodificate tramite Nominatim con uno User-Agent identificativo, una coda da 1 richiesta/s, back-off e una cache su disco. Leaflet è servito da questo server (nessuna CDN); la CSP aggiunge soltanto l'origine dei tile in `img-src`. Contributo di **@bullitt186** (#381).
- **Protezione delle richieste** — il server rifiuta un `Host` che non serve (DNS rebinding), le scritture cross-site e i GET con effetti collaterali (`/api/stream/*`, `/api/run/*`, `/api/geocode`). Un reverse proxy che inoltra un nome pubblico lo elenca in `ALLOWED_HOSTS`; il workflow di deploy scrive quel drop-in di systemd a partire dall'URL pubblico.
- **Soglia di copertura** — `npm run test:coverage:gate` (`scripts/coverage-report.mjs`) stampa la copertura di righe/rami per file e fallisce sotto una baseline a cricchetto.

### Corretto

- **Una richiesta malformata non ferma più il server.** Express 4 ignorava gli handler asincroni rifiutati, quindi un campo di tipo errato in `/api/deep`, `/api/auto-pipeline`, `/api/career-plan`, `/api/tracker` o un byte NUL in `/api/stats` terminava il processo; ora sono errori JSON 400 e qualsiasi altro rifiuto diventa un 500.
- **Una scansione interrotta o fallita non cancella più gli ultimi risultati.** `last-scan.json` viene conservato quando una scansione viene fermata o tutte le fonti falliscono, e una scansione di una sola azienda unisce i risultati invece di sostituirli. Una singola voce errata in `portals.yml` non interrompe più l'intera scansione.
- **Le valutazioni vedono tutto il metodo.** I file di modalità venivano tagliati a 16 KB, quindi `oferta.md` (92 KB) perdeva i blocchi C–G; i limiti per file ora sono 128 KB per le modalità e 64 KB per il CV, e un taglio viene segnalato. Le risposte vuote o troncate falliscono invece di scrivere un report vuoto.
- **SSRF:** i salti di reindirizzamento vengono ricontrollati per destinazioni private, ogni risposta DNS viene verificata, la scadenza della scansione copre il corpo, le chiavi `*_BASE_URL` vanno solo all'host del fornitore (Hermes/Ollama: loopback o LAN), pandoc viene eseguito con `--sandbox`.
- **Blocchi dell'event loop:** due regex quadratiche (rimozione dell'HTML, sanificazione del markdown) sostituite da scanner lineari.
- **Perdita di dati:** l'eliminazione di una riga della pipeline conservava la retribuzione delle altre righe; `$&` in un URL corrompeva `pipeline.md`; i salvataggi di mock-interview, networking e deep-research sovrascrivevano file precedenti; la cronologia dei colloqui conservava i primi 40 turni invece degli ultimi.
- **Livello LLM:** auto-pipeline e deep research rispettano `LLM_PROVIDER` e ogni provider tramite il dispatch condiviso, registrano l'utilizzo e segnalano il troncamento; evaluate/test di Gemini non salvano più un report; OpenAI usa `max_completion_tokens` e un `OPENAI_MODEL` solo Codex viene inviato come `gpt-5`; la descrizione dell'offerta è racchiusa come dato non attendibile.
- **PDF di report, deep e inline** passano `--skip-fact-check` (la verifica dei fatti del CV bloccava qualsiasi report con numeri); il formato di pagina del profilo non viene più sovrascritto.
- **Scanner:** la quarantena è indicizzata per URL (correggere un URL lo fa riprovare), la deduplicazione nella stessa esecuzione per URL canonico, le voci vuote delle liste non corrispondono più a tutto, scritture atomiche, le righe di cronologia `skipped_*` non sono «già viste».
- **Controllo dei processi:** l'escalation a SIGKILL non scattava mai; le esecuzioni batch terminano l'intero gruppo di processi alla disconnessione.
- **CI e release:** la CI ora esegue le soglie di parità del changelog, dei workflow e dell'i18n; permessi dei workflow con privilegi minimi; segreti di produzione solo nell'ambiente `production`; il pacchetto npm ora include `docs/help/`.
- **Test:** nessun test tocca più la rete né il vero progetto genitore (un `CAREER_OPS_ROOT` esplicito viene sempre rispettato); gli algoritmi copiati sono stati sostituiti dal codice di produzione.

### Note

- Test **4056 → 4404**, browser **118**. Baseline di copertura del server: righe 96,7 %, rami 86,3 % (`scripts/coverage-baseline.json`).
- Le specifiche ora si trovano in un'unica cartella, `docs/sdd/specs/`; il piano del programma è `docs/sdd/PLAN.md`, la matrice invariante→soglia `docs/sdd/TRACEABILITY.md`.
- **Nota per l'operatore:** dietro un reverse proxy imposta `ALLOWED_HOSTS=<host pubblico>`; un URL base di Ollama/Hermes su un host pubblico ora viene rifiutato.

## [1.240.0] — 2026-10-06

**Parità con il genitore — career-ops `main` @ `62905981` (VERSION 1.35.0, 177 commit upstream da `b39931e`). Sei nuove fonti — 103 → 109 (104 EN + 5 RU) —, correzioni rispecchiate in otto provider esistenti e il formato checklist della pipeline, contributo di @bullitt186.**

### Aggiunto

- **Sei nuove fonti — 103 → 109 (104 EN + 5 RU), 98 → 104 adattatori EN.**
  - **ADP Workforce Now** (`workforcenow.adp.com` con `cid` + `ccId`) — paginazione `$skip` in base alle righe effettivamente restituite; una risposta senza né `jobRequisitions` né `meta` genera un errore invece di passare per un board vuoto; arricchimento dei dettagli opt-in (`adpWorkforcenow.fetchDetails`, default 25, massimo 100).
  - **Gupy** (`employability-portal.gupy.io`) — scansione per parole chiave sull'intero board, dalla più recente con arresto anticipato su `since_days`; `workplaceType` viene letto come la stringa singolare in pt-BR, così le offerte ibride non si perdono; le pagine carriera riservate vengono scartate.
  - **JazzHR** (`*.applytojob.com`) — parser delle card con ripiego su ancore nude, così un restyling parziale produce comunque offerte; link di annunci con zero card analizzate generano un errore, un board davvero vuoto restituisce `[]`.
  - **Startup Jobs** (`startup.jobs/feeds/jobs`) — RSS, una sola richiesta; un corpo malformato, HTML o troncato genera un errore invece di restituire `[]` (la correzione del genitore dopo la revisione post-merge, `08fe5d06`); CDATA e commenti vengono mascherati prima dell'associazione delle voci.
  - **Taleo** (`<tenant>.taleo.net`, `tre.taleo.net` rifiutato) — GET della shell, poi POST `searchjobs`; una shell senza id del portale genera un errore come board privato; colonne riconosciute dall'intestazione.
  - **UKG Pro / UltiPro** (`recruiting[N].ultipro.{com,ca}`) — `Top=50` + `Skip`, `totalCount` mai considerato come condizione di arresto, tetto di 100 pagine (limitato a 1500), pagine di dettaglio opt-in analizzate con una scansione delle parentesi graffe attenta alle stringhe.

### Corretto

- **Pipeline nel formato checklist del genitore** — il career-ops upstream scrive `data/pipeline.md` come sezioni `## Pending` / `## Processed` di righe `- [ ] url | …`, che la UI leggeva come **0 in sospeso** e a cui scriveva aggiungendo un blocco di codice delimitato in fondo al file, dove il genitore non guarda mai. `parsePipeline`, `addPipelineUrl` e `removePipelineUrl` ora leggono e scrivono quella forma (deduplica anche rispetto alle righe già elaborate; compenso come segmento etichettato `note: comp …`); il formato a blocco delimitato è invariato. Contributo di **@bullitt186** (#380).
- **Paese integrato nella località** — Ashby (principale `address.postalAddress`), Breezy (`country.name`) e Recruitee (`location` piatto) aggiungono il paese a meno che il nome non lo contenga già come parola intera, così un ruolo remoto con sede principale nel Regno Unito e secondaria negli Stati Uniti non viene più scartato da un filtro di località.
- **MokaHR** — l'host regionale `hire-r1.mokahr.com` è accettato (la lista di consentiti è esattamente `app.mokahr.com` + `hire-r1.mokahr.com`), il POST all'API e i link delle offerte usano l'host proprio del board, e un `success:false` in-band ora genera un errore invece di passare per un board vuoto.
- **Avature** — le card `article--jobs` vengono analizzate (titolo dall'ancora dell'intestazione, località dallo span `icon-address`).
- **SAP SuccessFactors** — un URL di ricerca salvata `/go/<Category>/<id>[/<offset>]/` viene risolto alla radice del tenant; prima raggiungeva `…/tile-search-results/`, che risponde 200 con zero tile.
- **Deutsche Bahn** — db.jobs svuota qualsiasi pagina di risultati che contiene un'offerta che non sa rendere; la scansione ora ordina per `pubExternalDate_tdt` con 1000 per pagina (massimo 5 pagine), si ferma sul conteggio grezzo delle ancore dei risultati e genera un errore se manca l'intestazione dei risultati o ci sono link di offerte non analizzati, invece di restituire un board troncato.
- **HigherEdJobs** — una pagina di verifica Incapsula servita con HTTP 200 veniva analizzata come zero voci e passava per un board vuoto; ora genera un errore.
- **Un test leggeva il vero progetto genitore su una macchina di sviluppo** — `tests/reports-list-cache.test.mjs` impostava `CAREER_OPS_ROOT` su una cartella temporanea senza `cv.md`/`portals.yml`, che `paths.mjs` ignora, quindi in locale contava i report del genitore (6 invece di 3) mentre la CI, senza il genitore accanto, passava.

### Note

- Test **3782 → 4056**. Nuove suite: `sources-adp-workforcenow`, `sources-gupy`, `sources-jazzhr`, `sources-startup-jobs`, `sources-taleo`, `sources-ultipro`, `sources-location-country-fold`, `sources-deutschebahn-blanked-page`, `sources-higheredjobs-challenge-page`, più `parsers-pipeline-checklist` dalla #380.
- **Genitore:** il fork è stato portato all'`main` upstream (144 → 0 commit indietro) con le quattro divergenze dell'ADR-0002 verificate intatte; il ripristino upstream del `LOCATIONISH_RE` cirillico non è arrivato.
- **Già rilasciati nella v1.239.0, non ripetuti:** AppliTrack, NEOGOV, Red Rover, SchoolSpring, OCC Mundial, board embed di Greenhouse, Workday `myworkdaysite.com`.
- **Non portato**, con le relative motivazioni: egress con proxy fidato (`CAREER_OPS_TRUST_PROXY_EGRESS`, `_http.mjs` / `_ip-guard.mjs` / `_dns-cache.mjs`) — web-ui scansiona tramite il proprio trasporto `http-json.mjs`; il registro delle colonne di `scan-history.tsv` e la deduplica delle richieste sensibile alla lingua — web-ui legge le posizioni 1–12, che non si sono spostate, e deduplica per URL; SmartRecruiters `requisitionId` / `language` — nessun consumatore nella forma delle offerte di web-ui; **Gem** `isoCountry` → nome del paese — richiede la tabella alpha-3 da 249 voci del genitore, rimandato; modifiche solo CLI (modalità, updater, doctor, payload PDF/ATS, script del tracker, dashboard Go, modalità Singapore).

## [1.239.4] — 2026-09-29

**Patch dalla regressione dal vivo della v1.239.3.**

### Corretto

- **Le valutazioni in coreano e cinese tradizionale segnalavano la mancanza del riepilogo del punteggio.** Quei report arrivano a 10–11 mila caratteri e il riepilogo viene per ultimo, quindi finiva oltre il limite di 8192 token di output. Le valutazioni (e la pipeline automatica) ora consentono 16384 token e, se un fornitore taglia comunque la risposta, il primo avviso lo dice invece di elencare i blocchi mancanti.
- **Il controllo dal vivo considerava non tedesca una breve risposta in tedesco** (3 parole vuote tedesche, nessuna inglese). Una risposta a elenco può contenerne poche; senza alcuna parola inglese, ora ne bastano tre.
- Test 3778 → 3782.

### Note

- Le route di ricerca approfondita e delle modalità mantengono il limite di 8192 token: le loro risposte **non** lo raggiungono nelle esecuzioni dal vivo.

## [1.239.3] — 2026-09-29

**Patch dalla regressione dal vivo della v1.239.2.**

### Corretto

- **Le valutazioni in arabo fallivano ancora il controllo A–G** dopo che la v1.239.2 aveva corretto giapponese e hindi. Uno scheletro mascherato dei titoli (nessun testo del report nel log) ha mostrato il motivo: il report arabo scrive la lettera di blocco in arabo, in ordine abjad, qualunque cosa chieda il prompt. Il controllo ora accetta أ ب ج د هـ و ز come A–G quando la lettera è isolata all'inizio di un titolo, come già accettava i sosia cirillici; le stesse lettere dentro una parola araba non contano.
- Il controllo dal vivo stampa questo scheletro mascherato quando il controllo A–G fallisce, così il prossimo caso si diagnostica dal log.
- Test 3776 → 3778.

### Note

- La nota della v1.239.2 diceva che il controllo **non** sarebbe stato allentato; per l'arabo ora lo è, perché tre esecuzioni dal vivo hanno mostrato che il solo prompt non mantiene la lettera latina.

## [1.239.2] — 2026-09-29

**Patch dalla regressione dal vivo della v1.239.1.**

### Corretto

- **Una valutazione in arabo traduceva le lettere di blocco e una in giapponese ometteva il riepilogo del punteggio.** La v1.239.1 ripeteva solo la lingua nell'ultima riga del prompt. Ora quella riga dice anche che la lettera latina A–G di ogni titolo e il blocco `---SCORE_SUMMARY---` (marcatori e chiavi in inglese) non si traducono, e chiede la scrittura propria della lingua.
- Test 3775 → 3776.

### Note

- Il controllo del report **non** viene allentato per accettare lettere o marcatori tradotti: è il prompt a mantenere stabile il formato.

## [1.239.1] — 2026-09-29

**Patch dalla regressione dal vivo della v1.239.0.**

### Corretto

- **Le valutazioni in giapponese e ucraino arrivavano quasi tutte in inglese.** L'istruzione sulla lingua era in cima al prompt, prima di decine di kilobyte di file di progetto e annuncio in inglese. Ora il prompt ripete la lingua nell'ultima riga.
- **Il controllo dal vivo segnalava una scansione fallita quando il server ne stava già eseguendo un'altra** (la scansione oraria, ripetuta subito dopo il deploy). Che il server rifiuti una seconda scansione è corretto; il controllo ora attende e riprova, fino a 30 minuti.
- Test 3774 → 3775.

### Note

- La scansione singola del server **non** viene allentata: una seconda scansione è ancora rifiutata con `SCAN_BUSY`. È cambiato solo il controllo.

## [1.239.0] — 2026-09-29

**Parità con career-ops @ b39931e: cinque nuove fonti e tre correzioni replicate.**

### Aggiunto

- **Cinque nuove fonti (98 → 103; adattatori in inglese 93 → 98):** AppliTrack (`applitrack.com/<distretto>`), NEOGOV (SchoolJobs / GovernmentJobs), Red Rover (`jobs.redroverk12.com/org/<id>`) e SchoolSpring (`<distretto>.schoolspring.com`) per le assunzioni nelle scuole e nel settore pubblico, più OCC Mundial, il più grande sito di lavoro del Messico (`provider: occ` esplicito con query di ricerca). Ognuna è vincolata al proprio host, solo HTTPS, e rifiuta i reindirizzamenti.
- Test 3500 → 3774.

### Corretto

- **Le bacheche Greenhouse incorporate** (`job-boards.greenhouse.io/embed/job_board?for=<bacheca>`) puntavano a una bacheca chiamata "embed" e fallivano; ora la bacheca viene da `?for=`, e solo su un vero host Greenhouse.
- **Le bacheche Workday su `myworkdaysite.com`** (`/recruiting/<tenant>/<sito>`) non venivano riconosciute; ora vengono scansionate, con i link degli annunci sullo stesso host.
- **Un nome di report con parentesi** (`042-acme-(berlin)-….md`) veniva tagliato alla prima `)` nel tracker; ora il nome resta intero.

### Note

- Le modifiche del padre solo per la CLI **non** vengono portate — modelli PDF e CV, lo scaffolder, l'esecutore batch, l'importazione di career-profile, la copertura delle parole chiave ATS, le traduzioni delle modalità colloquio, l'host CLI `pi`: web-ui non li esegue.
- Aprire un report del genere dal tracker richiede ancora che la route dei report accetti le parentesi nel nome del file; quella route **non** cambia in questa release.

## [1.238.3] — 2026-09-27

**Le pagine restano reattive durante una scansione e i log della QA remota non rivelano più l'host di produzione.**

### Corretto

- **Dashboard e report impiegavano secondi a caricare e andavano in timeout durante una scansione.** `/api/reports` e `/api/dashboard` leggevano e analizzavano tutti i report a ogni richiesta — circa 3,7 s sul server di produzione, bloccando ogni altra richiesta; con una scansione in corso, i caricamenti arrivavano al timeout di 30 s. Ora le intestazioni analizzate sono in cache per file e si aggiornano quando il file cambia, quindi elencare costa un controllo per report (500 report: 430 ms → 3 ms in locale).
- **Un rilievo della QA remota poteva stampare parte dell'host di produzione in un log pubblico.** GitHub oscura un segreto solo quando compare per intero, e un messaggio tagliato a 180 caratteri finiva a metà dell'host. Ora rilievi e report interi vengono oscurati prima del taglio.
- **Ogni valutazione con l'IA veniva segnalata come malformata.** Il prompt non chiedeva mai il blocco `---SCORE_SUMMARY---` richiesto dal controllo del report (gli script di valutazione del progetto padre lo chiedono), e un report tradotto traduceva anche la parola "Block", così il controllo non trovava le sezioni. Ora il prompt chiede il riepilogo e la lettera del blocco in ogni titolo, il controllo accetta una parola tradotta prima della lettera e il blocco di riepilogo viene rimosso prima che il report venga mostrato o salvato.

### Aggiunto

- Test 3488 → 3500.

### Note

- Lo scanner gira ancora **dentro** il processo del server; questa release rimuove l'altro grande blocco ma **non** sposta la scansione in un worker.

## [1.238.2] — 2026-09-27

**Correzione dei 502 che il server di produzione mostrava ancora durante la scansione oraria.**

### Corretto

- **Pagine e risorse restituivano 502 durante una scansione.** Node chiude una connessione keep-alive inattiva dopo 5 s; Caddy riusa le connessioni inattive fino a 2 minuti. Mentre una scansione nel processo teneva occupato il server, Node chiudeva socket su cui Caddy aveva appena inviato una richiesta, e Caddy rispondeva 502 *connection reset by peer* (62 volte in una scansione, con il server sano). Ora il server mantiene le connessioni inattive per 125 s — più del proxy — quindi chiude sempre prima il proxy.

### Aggiunto

- `deploy.yml` → `verify` mostra perché il proxy ha risposto 502 (tipi di errore, indirizzi mascherati), i 502 al minuto dall'ultimo riavvio e l'esito della scansione oraria.
- `release.yml` può creare un tag mancante quando viene avviato a mano, così si può pubblicare una release dove i tag non possono essere inviati.
- Test 3486 → 3488.

### Note

- La scansione gira ancora **dentro** il processo del server e può tenerlo occupato per secondi; spostarla in un worker **non** fa parte di questa patch.

## [1.238.1] — 2026-09-27

**Patch di stabilità dopo la prima regressione dal vivo del server di produzione: una scansione alla volta e correzioni del sito.**

### Corretto

- **Due scansioni insieme mandavano in crash il server.** Ogni `GET /api/stream/scan` eseguiva lo scanner completo nel processo del server senza protezione; una scansione avviata dalla UI si è sovrapposta al timer orario e il processo è morto con *JavaScript heap out of memory* (due volte, con errori 502 nel frattempo). Ora una scansione alla volta: una seconda richiesta riceve un `error` SSE con codice `SCAN_BUSY` e non parte nulla. Il workflow di deploy alza anche il limite di memoria del server (`heap_mb`, predefinito 448 MB).
- **`/help` e `/changelog` di cvstart.org scorrevano di lato sui telefoni** (e `/changelog` ja/zh anche su desktop): il codice lungo e l'indice ora vanno a capo.
- **Mancava l'hindi nelle alternative di lingua della sitemap**; il controllo i18n del sito ora confronta la sitemap con il registro delle lingue.
- **La Guida §19 chiedeva di aggiungere una chiave a «tutti e 8» i file di lingua** — sono 17.

### Aggiunto

- **Regressione remota** (`.github/workflows/remote-qa.yml`): ogni percorso × ogni lingua dell'app distribuita (sola lettura), ogni pagina × lingua × telefono/desktop di cvstart.org, ogni link dei README e della wiki e, su richiesta, una scansione reale e chiamate IA dal vivo in ogni lingua.
- **Workflow di deploy del server** (`.github/workflows/deploy.yml`): `recon`, `deploy` (con rollback esatto) e `verify` (smoke test e report di stabilità).
- Test 3481 → 3486.

### Note

- Il consumo di memoria dello scanner in sé **non** viene ridotto in questa versione: la protezione impedisce due scansioni insieme e il drop-in alza il tetto. Profilare una vera scansione di 98 fonti richiede la rete di produzione.
- Il timer orario `career-ops-scan` **non** viene modificato; `recon` ora mostra quali comandi esegue.

## [1.238.0] — 2026-09-27

**Parità con il genitore — career-ops `main` @ `993085ce` (VERSION 1.34.0, 182 commit da `de2224a9`). Quattro nuove fonti, dieci correzioni di provider rispecchiate, una falla SSRF a livello di scanner chiusa, e un suggerimento gratuito di aderenza del titolo sui risultati di scan.**

### Aggiunto

- **Quattro nuove fonti — 94 → 98 (93 EN + 5 RU), 89 → 93 adattatori EN.**
  - **Eploy** (`provider: eploy`) — legge la sitemap `/live-jobs.xml` del tenant su qualsiasi host brandizzato (solo HTTPS; letterali IP, `localhost`, `*.local`, `*.internal` e host a etichetta singola vengono rifiutati). Una risposta che non è una sitemap (una pagina di login) genera un errore invece di passare come zero offerte. Le pagine di dettaglio sono opt-in (`eploy: { fetchDetails, detailLimit }`).
  - **HiringRoom** (`*.hiringroom.com`) — prima JSON-LD `/portal/jobs`, poi le card legacy di `/jobs` come fallback; gli URL di annuncio in `http://` nel payload vengono ricostruiti in HTTPS.
  - **PeopleSoft Candidate Gateway** — rilevato dal percorso `/psc/{site}/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL` su qualsiasi host brandizzato. Segue da sé i redirect di sessione same-origin di PeopleSoft (massimo 10 hop, ogni hop riancorato all'origine del tenant e controllato contro indirizzi privati), riproduce il modulo "carica altro" e marca una scansione parziale (`peoplesoftIncomplete`) invece di segnalarla come completa.
  - **PrevueAPS** (`*.prevueaps.ca`) — risolve l'id del sito dalla pagina delle offerte, poi legge l'API JSON.
- **Suggerimento di aderenza del titolo sulle righe di `#/scan`.** Ogni risultato porta un chip approssimativo di aderenza **forte / correlata / debole** che confronta il titolo dell'annuncio con i ruoli target in `config/profile.yml` (`target_roles.primary` + nomi di archetipo). È una stima gratuita basata su parole chiave: non filtra, non riordina né cambia mai i conteggi, e il tooltip lo dichiara. Calcolato quando i risultati vengono serviti, quindi una modifica al profilo si riflette al refresh successivo. Tradotto ×17. Rispecchia la #3261 del genitore.

### Corretto

- **Sicurezza — la protezione contro il DNS-rebinding non veniva mai eseguita in una scansione reale.** `http-json.mjs` controllava gli indirizzi risolti solo quando riceveva il `fetch` globale nudo, ma entrambi gli scanner iniettano `makeTimeoutFetch()`, quindi ogni scansione saltava la protezione. Una fonte puntata su un hostname che risolveva a `10.x` o `127.0.0.1` veniva effettivamente recuperata. La protezione ora viene eseguita all'interno dello stesso `makeTimeoutFetch`, messa in gara con il timeout della scansione così che un resolver bloccato non possa bloccare una scansione. Trovato nella revisione di questa release.
- **Sicurezza — gli indirizzi IPv6 che incorporano un indirizzo IPv4 non venivano trattati come privati.** `http://[::ffff:127.0.0.1]/` (che il parser di URL riscrive come `[::ffff:7f00:1]`) superava `isValidJobUrl`. Sia la forma puntata che quella esadecimale di `::ffff:a.b.c.d` / `::a.b.c.d` ora vengono classificate in base all'indirizzo incorporato. Dal `_ip-guard.mjs` del genitore.
- **Rippling è passato all'API board v2** (`ats.rippling.com/api/v2/board/<slug>/jobs`), con paginazione (10 pagine di default, massimo 50), un blocco host sui link degli annunci e validazione dello slug. Un URL API incollato ora produce il suo slug reale invece di `api`.
- **Recruitee** — le offerte multi-sede elencano ogni sede (`A · B`), gli annunci demo `(Sample)` e le righe senza titolo vengono scartati, e un'offerta viene mantenuta quando almeno uno dei suoi due URL è valido.
- **Pinpoint** — gli annunci demo seminati (il video demo duplicato) vengono scartati.
- **Canali Telegram** — una prima riga con più `|` non viene più letta come `Titolo | Azienda`, e vengono riconosciute più parole di ruolo. Il `LOCATIONISH_RE` del fork con supporto cirillico resta intatto (ADR-0002).
- **Workday** — un 422/401/403 sulla prima pagina viene sondato una volta; la pagina di manutenzione o il redirect di outage di Workday marca il board come morto (messo in quarantena in modalità strict). Le richieste CXS e di dettaglio ora rifiutano i redirect.
- **BambooHR** — un `/careers/list` reindirizzato viene smistato tramite il feed embed pubblico: vuoto significa un board attivo senza posizioni aperte, qualsiasi altra cosa è un board morto.
- **Heckler & Koch / Rheinmetall** — un `heckler-koch.com` / `rheinmetall.com` nudo viene riscritto in `www.` così che il trasporto senza redirect lo raggiunga comunque. **Ashby** rifiuta i redirect. **beesite** scandisce le pagine con il `delay()` annullabile.
- **I filtri sui titoli appiattiscono gli accenti su entrambi i lati** (scanner EN e RU), quindi `Développeur` viene intercettato da un negativo `developpeur`.
- **Il matching aziendale del cooldown comprende nomi non latini e forme societarie** (marcatori CJK/coreani, İ turca puntata). I nomi CJK prima collassavano in una chiave vuota e non facevano mai match.
- **`location_filter.strict: true`** fallisce in modo chiuso su una posizione vuota quando è impostata una lista di permessi o blocchi.
- **Liveness** — nuovi controlli tramite API pubblica per gli embed Greenhouse (`gh_jid`), Arbeitsagentur e We Work Remotely; SmartRecruiters ora decide in base al flag `active` dell'annuncio.
- **PeopleSoft** — un'azione di form relativa "carica altro" viene risolta accanto alla pagina di ricerca, non alla radice dell'origine.

### Note

- Test **3210 → 3481**. Nuove suite: `sources-eploy`, `sources-hiringroom`, `sources-peoplesoft`, `sources-prevueaps`, `title-fit`, `fetch-timeout-dns-guard`, `cooldown-company-match-unicode`, `liveness-api-more-rungs`, `ru-scanner-title-accent-fold`.
- **Non portato**, con le relative motivazioni: bordi di parola Unicode nel filtro di localizzazione (il filtro di web-ui è basato su sottostringa, quindi non c'è un bordo da correggere — un port completo e deliberato del filtro di localizzazione del genitore resta lavoro futuro); dedup delle richieste per stesso titolo (web-ui dedup solo per URL); avvisi di ripubblicazione degli aggregatori, ambito dei domini in blacklist, ricevute zero-non-verificato e la migrazione di `scan-runs.tsv` (web-ui non ha nessuna di queste superfici); lo split per faccette e i tag di troncamento di Workday (web-ui recupera una pagina per board); `enrichDate` di BambooHR (nessun hook di arricchimento data); il refactoring dello sleep di `_http.mjs` del genitore su ~20 provider (web-ui usa già un `delay` annullabile condiviso); updater, doctor, PDF, tracker/merge-tracker, `validate-profile`, `discover-new-companies`, l'app Next.js in `web/`, i bot GitHub — esclusivi della CLI o inoltrati altrove.
- Mantenuto deliberatamente diverso dal genitore: Heckler & Koch / Rheinmetall restano solo HTTPS (nessun upgrade `http→https`); un board Workday morto in una scansione normale restituisce comunque `[]` invece di far fallire la scansione.

## [1.237.1] — 2026-09-22

**Patch da una verifica QA esterna su v1.237.0.** La correzione di Jobstreet è stata confermata dall'esterno per la prima volta: sugli host AU, NZ, HK e MY la vecchia forma `/id/job/<id>` restituisce un 404 pulito e la nuova `/job/<id>` raggiunge una rotta reale protetta da Cloudflare; su `id.jobstreet.com` vale il contrario. I link persi erano reali. Sono stati trovati due difetti, entrambi in ciò che v1.237.0 stesso aveva aggiunto.

### Corretto

- **L'etichetta del link al libro era localizzata, ma la sua destinazione no.** Tutti i 17 locale della SPA e tutti i 17 locale di cvstart.org puntavano il link nel footer di *Agentic Coding Design Patterns* all'edizione inglese, mentre l'unica etichetta tradotta — russa, «Паттерны агентного кодинга» — prometteva un libro russo. Un nuovo applicatore `data-i18n-href` (stessa forma di `data-i18n-title`, limitato a valori assoluti `https://`) e una chiave `footer.patternsUrl` inviano `ru` all'edizione russa e ogni altro locale a quella inglese. Il test di regressione verifica l'invariante in entrambe le direzioni: un titolo tradotto implica un URL localizzato.
- **SEEK sta migrando gli host, e il trasporto rifiuta i redirect.** `www.seek.com.au` → `au.seek.com` e `www.seek.co.nz` → `nz.seek.com`: le pagine di dettaglio fanno già 301, ed entrambe le coppie di host servono oggi l'API di ricerca v5 con 200. Poiché `http-json.mjs` imposta `redirect:'error'` (una difesa SSRF che vale la pena mantenere), il giorno in cui il percorso dell'API iniziasse a reindirizzare, una voce AU/NZ sull'host vecchio fallirebbe — e con solo gli host `www.` in allowlist nessuno potrebbe migrare. `au.seek.com` e `nz.seek.com` sono ora in `ALLOWED_JOBSTREET_HOSTS`; gli host vecchi restano, quindi la configurazione esistente e i link già costruiti continuano a funzionare. I sosia (`au.seek.com.evil.com`, `au-seek.com`) sono ancora rifiutati.
- **Wiki:** la riga *Agentic Practices* nella mappa della documentazione della Home era l'unica su dodici a non fare l'escape di `|` dentro `[[…|…]]`, quindi GitHub ha tagliato la cella — link morto, descrizione nascosta. Un solo carattere.

### Note

- Conteggi invariati a **94** sorgenti (89 EN + 5 RU), 89 adattatori. Test **3201 → 3210** (+5 locale del link nel footer, +4 host SEEK).
- Non chiudibile dall'esterno, registrato invece che dichiarato: Oracle Cloud (Akamai ha bloccato entrambe le sonde REST), il pin Personio e `appendWorkType` (serve una voce in `portals.yml`, e l'interfaccia non ha un modo per eliminarne una), e i casi di stringa di liveness (nessuna pagina controllabile; 40 sonde live hanno dato 12 live, 28 inconcludenti, **0 scadenze false**).
- Help ×17 ora elenca entrambe le forme di host per `AU-Main` e `NZ-Main`. Struttura dei titoli invariata a 32 H2 / 122 H3.

## [1.237.0] — 2026-09-21

**Parità con il padre — career-ops `main` @ `93c4302b` (`VERSION` 1.33.0, 75 commit tratti da `career-ops-hq/main`). Nessuna sorgente nuova questa volta: quattro correzioni replicate, e due di esse qui perdevano silenziosamente le offerte.**

### Corretto
**Jobstreet / SEEK — ogni offerta australiana, neozelandese, singaporiana, malese e di Hong Kong puntava a una pagina morta.** `parseJobstreetItem` costruiva l'URL di dettaglio come `${baseUrl}/id/job/${id}` in modo incondizionato. Il segmento `/id/` non è un percorso — è il **prefisso di locale indonesiano**, ed esiste solo sugli host indonesiani. Ogni altro host della piattaforma SEEK risponde **404** su `/id/job/<id>`. web-ui aveva già aggiunto `www.seek.com.au`, `www.seek.co.nz`, `sg.jobstreet.com`, `my.jobstreet.com` e `hk.jobsdb.com` a `ALLOWED_JOBSTREET_HOSTS`, quindi la scansione restituiva volentieri quelle offerte — ciascuna puntando a un 404. Il percorso ora è determinato dall'host: `ID_LOCALE_HOSTS` (`id.jobstreet.com`, `www.jobstreet.co.id`, `jobstreet.co.id`) mantiene `/id/job/`, tutto il resto ottiene `/job/`, e un origin non interpretabile ricade sul percorso comune invece di sollevare un'eccezione. Due dei nostri stessi test avevano **codificato il difetto** — asserivano `hk.jobsdb.com/id/job/…` e `www.jobstreet.com/id/job/…` — e sono stati corretti.
**Oracle Cloud — una pagina corta a metà elenco terminava la scansione e lasciava cadere la coda della bacheca.** La condizione di arresto era `listLen === 0 || listLen < PAGE_SIZE`, ma ORC restituisce meno righe del limite *a metà elenco* perché alcune righe vengono filtrate lato server. Misurato a monte su American Express: `TotalJobsCount` **454**, pagine da **200 / 199 / 54** — il 199 veniva letto come la fine e le ultime **54 offerte, il 12% della bacheca**, non venivano mai recuperate. Ora una pagina vuota termina sempre la scansione; quando il tenant riporta un totale, la paginazione continua finché `offset + PAGE_SIZE >= total`; solo un tenant senza un totale con cui verificare termina su una pagina corta. Questo è coerente con la convenzione più ampia secondo cui un'API «può restituire meno risultati del numero richiesto … anche se non alla fine della collezione» (Google AIP-158). `hasMore` resta deliberatamente ignorato — alcuni tenant restituiscono `hasMore:false` su ogni pagina di una bacheca da 7000 offerte. Con le pagine corte che non terminano più la scansione, `MAX_PAGES` è ora l'unico argine contro un tenant che riporta un totale fasullo, quindi è coperto da un proprio test.
**Liveness — «This role is closed» non veniva riconosciuto, e una scadenza falsa è permanente.** Il pattern era `/this job (listing )?is closed/i`, che non intercetta le formulazioni altrettanto comuni con `role` e `position`; su una bacheca a monte è stato misurato che **111 su 111** offerte incerte usavano «role». Ampliato a `/this (?:job|role|position)(?: listing)? is closed\b(?!-)/i`. Il finale `\b(?!-)` è una guardia per gli aggettivi composti: `\b` da solo respinge `closedown` ma corrisponde comunque a una prosa reale come *"This role is closed-loop control of the platform"*, ed è il lookahead a fermarlo.
**Liveness — `job expired` ora si trova in un livello debole che non può prevalere su un pulsante Candidati visibile.** `HARD_EXPIRED_PATTERNS` viene verificato *prima* del test sul controllo di candidatura, quindi qualsiasi cosa vi sia collocata prevale su un'offerta viva. `/\bjob expired\b/i` scattava per errore su quattro forme reali di pagine vive — una voce di un carosello «Similar jobs», un chip di filtro «Hide job expired», una FAQ nel footer, e la prosa closed-loop di cui sopra — perché il classificatore riceve il testo dell'intera pagina. Ora vive in `SOFT_EXPIRED_PATTERNS`, verificato dopo il controllo di candidatura e prima dell'euristica di pagina-elenco, restituendo `expired_body_soft`; un semplice banner «JOB EXPIRED» senza controllo di candidatura scade comunque. Questa direzione conta perché un `expired` falso viene scritto nella cronologia delle scansioni come `skipped_expired` e poi **filtra via per deduplicazione un'offerta reale da ogni scansione successiva, indefinitamente**, a meno che `scan_history.recheck_after_days` non sia impostato.

### Aggiunto
**Personio — un `personio: <slug>` esplicito fissa il tenant.** Molte aziende incorporano la propria bacheca Personio come **iframe** su una pagina carriere personalizzata, quindi `careers_url` punta al dominio proprio dell'azienda mentre il feed vive su `<slug>.jobs.personio.de`; senza un pin quelle bacheche non risolvono a nulla. Lo slug è limitato nel set di caratteri da un'allowlist ancorata (`/^[a-z0-9][a-z0-9-]{0,62}$/i`) e l'URL risultante viene comunque instradato attraverso il parsing `new URL()` esistente, il controllo HTTPS e il filtro host `PERSONIO_HOST_RE` — il pin non è mai un modo per raggiungere un altro host. Uno slug che porta `.`, `/`, `@`, `:`, `..`, spazi, un `-` iniziale, o che supera il limite di 63 caratteri per etichetta DNS, ricade sul comportamento odierno di `api`/`careers_url`. A differenza del padre, la regex host di web-ui distingue tra maiuscole e minuscole, quindi il pin viene normalizzato tramite `new URL()` — `AcmeGroup` risolve in `acmegroup.jobs.personio.de` invece di costruire un host che la propria allowlist respingerebbe poi.
**Jobstreet — `appendWorkType` opzionale** aggiunge come suffisso al titolo i tipi di impiego dell'offerta, ad es. `Strategy Consultant [Part time]`, così i filtri sul titolo e il triage possono vedere il tipo di impiego al momento della scansione. Disattivato di default; un `workTypes` mancante o vuoto non ha effetto.

### Note
I conteggi di sorgenti e adattatori restano invariati: **94** sorgenti (89 EN + 5 RU), 89 adattatori EN. Questa release sposta solo il conteggio dei test, **3164 → 3201** (+13 jobstreet, +7 Oracle Cloud, +9 liveness, +8 Personio).
Il padre ha **eliminato `providers/telegram.mjs`**, consolidando su `telegram-channel`. web-ui registra entrambi come sorgenti visibili all'utente, quindi l'eliminazione **non** viene seguita: farebbe scendere il registro da 94 a 93 e romperebbe silenziosamente chiunque abbia configurato `telegram`. Da rivedere solo come una rimozione deliberata e annunciata.
`jd-skill-gap.mjs` ha ricevuto una forma non contratta dell'intestazione «what we are looking for» e una rimozione dei marcatori in grassetto. web-ui **inoltra** quello script invece di rispecchiarlo, quindi la correzione arriva con il padre distribuito e non richiede alcuna modifica qui.
Non portato, con le motivazioni: `lib/latex-escape.mjs`, `browser-extract.mjs`, `openai-eval.mjs`, `update-system.mjs` e lo scaffolder (web-ui non li rispecchia né li esegue in shell); la TUI della dashboard Go e il form di configurazione di `web/` (superfici separate); `doctor.mjs` e `analyze-patterns.mjs` (relay in sola lettura il cui fail-soft assorbe la modifica).
La divergenza cirillica `\p{L}` del fork in `providers/telegram-channel.mjs` è sopravvissuta intatta al merge upstream ed è stata verificata byte per byte contro una copia pre-merge.

## [1.236.0] — 2026-09-18

**Parità con il padre — career-ops `main` @ `6a9c84c` (`VERSION` 1.33.0, 128 commit). Due nuove sorgenti, e tre correzioni replicate — due delle quali qui perdevano silenziosamente le offerte.**

### Aggiunto
**Due sorgenti per lo scanner, 92 → 94 (89 EN + 5 RU).** **Python.org Jobs** (`pythonorg`) legge il feed pubblico della bacheca; l'attribuzione del datore di lavoro è obbligatoria, quindi una riga il cui titolo non nomina alcun datore di lavoro viene scartata invece di essere completata con il nome della voce del portale. **Generalist World** (`generalist-world`) esegue lo scraping delle schede della bacheca e **fallisce rumorosamente su un markup che non riesce a interpretare** — una scheda la cui forma è cambiata solleva un'eccezione invece di leggersi come una bacheca vuota, che è la modalità di fallimento che rende inaffidabile una sorgente ottenuta tramite scraping. Entrambe compaiono nel filtro Sorgente di `#/scan`, entrambe hanno l'host fissato (regex ancorata, solo HTTPS), ed entrambe sono guidate end-to-end da suite a trasporto fittizio (43 e 36 casi).

### Corretto
**Un ruolo Workday aperto in più città veniva scartato da un filtro sede.** L'endpoint delle liste di Workday risponde a un'offerta multi-sede con un **conteggio** dove ogni altra offerta porta una sede: `"53 Locations"`. Non è una sede, e `buildLocationFilter` confronta per sottostringa senza distinzione tra maiuscole e minuscole — quindi un ruolo aperto ad Austin *e* in altre 52 città non corrispondeva a nessuna voce `allow: [austin]` e veniva scartato, mentre lo stesso ruolo elencato singolarmente passava. Misurato a monte su tre tenant: **53 su 291** offerte erano segnaposto, quindi questo è il caso ordinario, non uno marginale. Le sedi reali dell'offerta esistono solo nel documento CXS di **dettaglio**, quindi ogni segnaposto ora costa una GET aggiuntiva verso di esso, con un tetto di **200** per annuncio — oltre il tetto il segnaposto viene lasciato visibile invece che falsificato, perché un'offerta non risolta non deve mai leggersi come risolta. Un dettaglio fallito o senza sede lascia l'offerta esattamente come restituita dalla lista: una `"53 Locations"` visibile è onesta su ciò che non si è potuto risolvere, mentre una sede svuotata passerebbe silenziosamente ogni filtro. La stessa GET porta anche `startDate`, quindi un'offerta arricchita viene datata **esattamente** invece che con la prosa relativa dell'endpoint delle liste (`"Posted 30+ Days Ago"` → `undefined`); tutto ciò che non è un semplice `YYYY-MM-DD` viene lasciato invariato invece di essere passato a `Date.parse`, il cui fallback non-ISO dipende dall'implementazione.
**Un livello dichiarato non fa più collassare due requisizioni in un unico repost.** `"Insurance Specialist II"` è la dichiarazione stessa del datore di lavoro che questa requisizione non è sorella dell'altra — una fascia retributiva, un ambito e un numero di requisizione diversi sotto un unico titolo di base. Il tokenizzatore non riusciva a vederlo: `w.length > 3` scarta ogni numero romano fino a VIII e ogni cifra singola, quindi `"Insurance Specialist"` e `"Insurance Specialist II"` venivano tokenizzati in modo identico, ottenevano un rapporto di Jaccard perfetto, e il rilevatore di repost segnalava il secondo come una ripubblicazione del primo. `role-matcher.mjs` di web-ui non aveva **alcuna** gestione dei livelli, quindi questo porta l'intero meccanismo del padre: i livelli vengono estratti ripiegando romano e arabo su un unico numero (`"Nurse II"` e `"Nurse 2"` sono la stessa dichiarazione — e *quella* coppia prima differiva erroneamente), due livelli dichiarati devono concordare, e un livello presente solo su un lato è trattato come una riscrittura libera **a meno che** ciascun titolo non porti anche una parola che manca all'altro, il che costituisce due disaccordi e non una decorazione.
**Una bacheca Avature fissata a un filtro percorreva comunque l'intera bacheca globale.** L'interfaccia di ricerca di Avature genera parametri di faccetta opachi (`?42386=[812132]` è un filtro paese), e un operatore che fissa una bacheca ristretta in `portals.yml` si aspetta che la scansione percorra *quella*. `resolveSearch` ricostruiva l'URL come `${origin}${path}` e scartava del tutto la query string — quindi ogni richiesta, prima inclusa, percorreva l'intera bacheca del tenant: più pagine, più richieste, e offerte che l'operatore aveva deliberatamente filtrato via. Le faccette ora accompagnano ogni richiesta paginata, con il nostro `jobOffset` applicato per ultimo, così che una faccetta omonima vagante non possa mai dirottare la paginazione.

### Sicurezza
**`devalue` 5.8.1 → 5.9.2** (in modo transitivo tramite `astro`), che chiude l'unico avviso Dependabot aperto — una denial of service su input malformato. Dipendenza solo del sito; nessun codice a runtime modificato.

### Note
**Non portato, ciascuno con la propria motivazione.** Il padre ha dato a **lever** un timeout di 30s e a **manfred** un timeout di 25s contro il suo default condiviso di 10s — un **no-port**: il trasporto di scansione di web-ui consente già **60s** (`DEFAULT_SCAN_TIMEOUT_MS`), quindi entrambe le bacheche hanno qui più margine di quanto la correzione conceda là. Anche il prefisso `careers-` raddoppiato di **iCIMS** non può verificarsi qui: web-ui prende l'origin del tenant direttamente da `api`/`careers_url` e non costruisce mai un host a partire da un nome di tenant; il suo nuovo percorso di fallback-host è una funzionalità per la configurazione più permissiva del padre, non la correzione di un difetto. **deutschebahn** e **manfred** hanno ottenuto il retry-on-transient-abort, che il tetto di 60s di web-ui rende molto meno urgente — annotato invece che portato, così un futuro timeout su una scansione lunga ha già una prima cosa nota da provare. Tutto il resto del delta di 128 commit è CLI, verificatore, dashboard o `web/` (il frontend proprio del padre): `liveness-browser`, `check-jd-archive`, `verify-ats`/`verify-portals`/`verify-cv-facts`, `update-system`, `set-status`, `audit-portals`, `discover-ats`, `scaffolder`, `test-all`, manifest dei plugin.
Divergenze del fork riverificate dopo il pull: la correzione cirillica `\p{L}` in `providers/telegram-channel.mjs`, il `providers/telegram.mjs` proprio del fork, `hermes` in `web/src/lib/clis.ts`. L'upstream `career-ops-hq/main` è completamente unito (0 commit mancanti). **3066 → 3164 test**; la guida ora dichiara **94** adattatori (**89 EN + 5 RU**) in tutte e 17 le lingue, e la struttura dei titoli resta invariata a 32 H2 / 122 H3.

## [1.235.0] — 2026-09-16

**Parità con il padre — career-ops `main` @ `68e6b94` (`VERSION` 1.33.0, 42 commit). Due correzioni replicate; una delle quali qui perdeva silenziosamente le offerte MokaHR.**

### Corretto
**Una seconda offerta dalla stessa bacheca MokaHR spariva invece di essere aggiunta.** `url-key.mjs` riduce l'URL di un annuncio a una chiave di confronto, e scartava il frammento in modo incondizionato — ragionevole, dato che quasi ogni frammento è solo presentazionale (`#apply`, `#section-2`). MokaHR è l'eccezione nel nostro stesso registro: i suoi annunci sono `…/social-recruitment/{tenant}/{id}#/job/{n}`, dove ogni offerta di un tenant condivide lo stesso percorso e l'id dell'annuncio esiste **solo** nel frammento. Quindi tutte si normalizzavano sulla stessa chiave. Misurato prima della correzione: incollando due offerte MokaHR diverse nella pipeline si otteneva **una sola riga** — nessun errore, nessun avviso, nulla da notare; il filtro di freschezza dello scanner (`en-scanner.mjs`) legge la stessa chiave, quindi una volta che un'offerta di quel tenant era nella cronologia delle scansioni, ogni altra veniva scartata come «già vista». `normalizeUrl` ora promuove una rotta riconosciuta `#/job/{id}` o `#/jobs/{id}` a una chiave di query solo di confronto prima che il frammento venga scartato — MokaHR mantiene il suo nome consolidato `mokahr_job_id` così le chiavi già scritte restano confrontabili, qualsiasi altro host riceve un `_career_ops_fragment_job_id` interno. L'id promosso viene **aggiunto, non impostato**: un URL che porta già quel parametro contiene l'id di un'altra offerta, e sovrascriverlo fonderebbe esattamente le due cose che la chiave esiste per tenere separate. Ogni frammento non riconosciuto continua a collassare, che è la metà che era già corretta.
**`accept-encoding` è ora fissato su ogni richiesta verso le sorgenti.** Se non impostato, Node negozia qualunque cosa offra la sua build di undici; da **Node ≥ 23** questo include `zstd`, e la risposta zstd di amazon.jobs torna **troncata a esattamente 1024 byte con stato 200** — quindi il fallimento si legge come `Unterminated string in JSON at position 1024`, come un'API malformata piuttosto che un bug di trasporto. Ogni richiesta ora invia `gzip, deflate, br`. Sui nostri runtime questo è **preventivo, non una riparazione**: Node 18/20/22 — la matrice CI e il server (22.22.1) — inviano `gzip, deflate`, verificato direttamente e non presunto, quindi qui nulla era troncato; ciò che cambia oggi è che viene offerto `br`, che quelle versioni non richiedono di default ma decodificano correttamente. Il default viene applicato **senza distinzione tra maiuscole e minuscole**, che è la parte che vale la pena rivedere: i nomi degli header non distinguono maiuscole/minuscole e `fetch` unisce due voci con lo stesso nome in un unico valore separato da virgole, quindi un chiamante che passava `Accept-Encoding: identity` altrimenti si sarebbe visto inviare `gzip, deflate, br, identity`.

### Note
Gli header restano un **oggetto semplice** al confine di `fetchImpl`, dove il padre passa a `fetch` un'istanza `Headers`. È una divergenza deliberata, non una svista: gli helper fetch di web-ui accettano un `fetchImpl` iniettabile, e 45 suite delle sorgenti leggono `opts.headers['User-Agent']` da ciò che catturano — un'istanza `Headers` non ha accesso tramite parentesi quadre, quindi il port fedele è quello del *comportamento* (override senza distinzione tra maiuscole/minuscole, vince il chiamante) e non dell'implementazione. L'oggetto del chiamante viene copiato, mai mutato, poiché diverse sorgenti condividono un'unica costante di header. La correzione gemella del padre — applicare uno **user-agent predefinito** senza distinzione tra maiuscole e minuscole — è un **non-port**: web-ui non inietta alcuno UA predefinito, ogni sorgente imposta quello richiesto dalla propria bacheca, quindi non esiste un default con cui lo `User-Agent` di un chiamante possa entrare in collisione.
Due nuove suite e tre nuovi casi fissano la coppia: `tests/http-accept-encoding.test.mjs` (il valore fissato esatto, ciascuno dei quattro helper fetch, e un override del chiamante in tre capitalizzazioni — verificando che sopravviva una *singola* chiave `accept-encoding`, che è ciò di cui il bug di merge ne produceva due) e `tests/parsers-pipeline-hash-route.test.mjs`, che lavora sulla giuntura visibile all'utente piuttosto che sulla chiave: due offerte MokaHR devono entrambe raggiungere la pipeline, un reincollaggio della stessa offerta in quattro grafie diverse deve comunque collassare in una riga, e un frammento cosmetico non deve diventare un'identità. Tutti sono stati confermati falliti per primi. Il pin vive nel **trasporto**, non solo in quegli helper: 25 delle 92 sorgenti chiamano direttamente il `fetchImpl` iniettato e non ci passano mai, quindi lo applica `makeTimeoutFetch` — il wrapper che entrambi gli scanner iniettano davvero — ed è l'unico punto di passaggio comune a tutte le sorgenti. (Il progetto padre non ha bisogno di un equivalente: `providers/_http.mjs` è il suo unico trasporto.) Una guardia strutturale ora fa fallire la CI se una nuova sorgente chiama `fetch` direttamente invece di usare il trasporto che le è stato consegnato, e un caso comportamentale porta greenhouse — una delle 25 — attraverso il wrapper per dimostrare che l'header arriva davvero sul filo.
Non portati, con la motivazione: `liveness-browser.mjs` (guardia di riutilizzo di Playwright headed — web-ui non guida un browser headed), `check-jd-archive.mjs` (nessun relay in web-ui), `test-all.mjs` (l'harness del padre; la divergenza del fork su `vpFixtureEnv` resta intatta), `web/` (il frontend proprio del padre, non rispecchiato), i manifest dei plugin e `SIGNATURES.md` (solo di repository). `batch/batch-runner.sh` (le e commerciali vengono sottoposte a escape prima dell'interpolazione `sed`) e `jd-skill-gap.mjs` (risolve `cv.md` rispetto alla radice dei dati) sono **inoltrati in sola lettura** — web-ui esegue in shell le copie del padre, quindi entrambi arrivano senza alcuna modifica al codice qui, e quello di `jd-skill-gap` rende più corretto il relay di `/api/jds/:id/skill-gap`: `cv.md` ora si risolve dalla radice dei dati invece che dalla directory da cui il processo era stato avviato. Divergenze del fork riverificate dopo il pull: la correzione cirillica `\p{L}` in `providers/telegram-channel.mjs`, il `providers/telegram.mjs` proprio del fork, `hermes` in `web/src/lib/clis.ts`. Il conteggio delle sorgenti resta invariato a **92** (87 EN + 5 RU), quindi la guida non è toccata. **3042 → 3066 test.**

## [1.234.0] — 2026-09-15

**Parità con il padre — career-ops `main` @ `56cce8f` (`VERSION` ancora 1.32.0, 58 commit oltre la 1.32.0). Una correzione replicata su 15 sorgenti, più una guardia perché non possa più tornare.**

### Corretto
**Un singolo id di offerta malformato non svuota più l'intera pagina.** `encodeURIComponent` solleva un `URIError` su un singolo surrogato UTF-16 isolato, e un payload JSON può portarne uno — `JSON.parse('"\\uD800"')` lo conserva. Quindici sorgenti costruivano l'URL di ogni annuncio a partire da un id o slug controllato dall'host *dentro* il ciclo di parsing, quindi un singolo annuncio malformato interrompeva il ciclo e perdeva tutte le offerte di quella pagina; nulla veniva registrato come fallimento della sorgente perché l'eccezione risaliva lo stack prima che il catch per-azienda avesse qualcosa da segnalare. Il padre l'ha corretto in `providers/_safe-url.mjs` (`safeEncodeURIComponent` → `null` su `URIError`, rilancia qualsiasi altra eccezione) instradandovi l'id di ogni ciclo, scartando solo l'annuncio in questione quando torna `null`. Quell'helper ora è `server/lib/sources/_safe-url.mjs`, e la stessa modifica è applicata alle tredici sorgenti replicate — alibaba, arbeitsagentur, bamboohr, feishu-jobs, garena, jibeapply, manfred, meituan, mokahr, phenom, thehub, tkms, vdab — e a **due sorgenti solo di web-ui che la nuova guardia ha fatto emergere alla prima esecuzione, jobstreet e trudvsem**, che avevano la stessa forma di ciclo e lo stesso throw latente. L'ambito è deliberato: solo gli id di provenienza API passano per l'helper. I valori derivati dalla configurazione mantengono la codifica rigorosa e falliscono rumorosamente — l'`office` di garena (un segmento di `portals.yml`) resta sull'`urlSegment` che solleva eccezioni, mentre il suo `id` da API riceve un `idUrlSegment` che restituisce `null`; il `corpName` di csod e lo slug di 4dayweek validato da `SLUG_RE` sono in allowlist per nome, con la relativa motivazione.
**Il fallback del titolo di rheinmetall poteva sollevare un'eccezione su un `href` malformato.** Quando una scheda non ha un titolo, questo viene ricostruito dallo slug dell'URL tramite `decodeURIComponent`, che solleva un'eccezione su una sequenza percentuale non valida nell'`href` estratto — la stessa forma "una riga malformata uccide la pagina", questa volta sul lato della decodifica. Ora decodifica in modo difensivo e ripiega sullo slug grezzo.
**Il registro delle sorgenti salta i file con prefisso `_`.** L'auto-discovery importava ogni `.mjs` in `server/lib/sources/` tranne se stesso e avvisava per qualsiasi file privo di `export const meta` — quindi l'helper produceva un avviso all'avvio. Viene adottata la convenzione del padre: un underscore iniziale significa *non è una sorgente*; questi file non vengono né importati né segnalati. Un file non dichiarato e privo di `meta` continua a generare un avviso, e il test di discovery ora verifica entrambe le metà (confermato rosso contro il vecchio filtro). Lo script di build del sito `sync-assets.mjs` conta i file degli adapter su disco con la stessa regola, quindi l'helper non fa più scattare la sua guardia contro le perdite silenziose.

### Note
`tests/sources-url-encoding-surrogate.test.mjs` rispecchia la suite del padre in tre parti: il contratto dell'helper (un surrogato in coppia — una normale emoji — viene comunque codificato; un'eccezione sollevata dal `toString` stesso del valore è un bug del chiamante e si propaga), il comportamento per-sorgente per tutte e quindici (un id malformato + un id valido → nessuna eccezione, il valido mantenuto, il malformato scartato, ciascuno guidato attraverso il parser puro esportato dalla sorgente o, per thehub, il suo fetcher con un trasporto fittizio), e una **guardia a livello di sorgente**: ogni file convertito deve importare l'helper *e* invocarlo, nessun file può referenziarlo senza importarlo, e nessun file non revisionato può costruire un URL di offerta con un `encodeURIComponent` nudo — una nuova sorgente con la vecchia forma fallisce la CI indicando il numero di riga incriminato. Tutti e quindici i casi per-sorgente sono stati confermati falliti prima del port.
Tutto il resto del delta del padre non è portato, con la motivazione: `batch/batch-runner.sh --cli` è un flag solo-CLI (web-ui non invoca il batch runner via shell); `invite-match.mjs` ora risolve `set-status.mjs` dalla radice del codice — web-ui non lo inoltra; `company-funded.mjs` ha ricevuto internamente la stessa modifica safe-url e la forma del suo output `--json`, che `/api/company-funded` analizza, è invariata; `test-all.mjs` ha solo spostato un budget di timeout (la divergenza del fork su `vpFixtureEnv` resta intatta); `web/` è il frontend proprio del padre e non è rispecchiato; `AGENTS.md`/`SIGNATURES.md` sono solo di repository. Divergenze del fork riverificate dopo il pull: la correzione cirillica `\p{L}` in `providers/telegram-channel.mjs`, il `providers/telegram.mjs` proprio del fork, `hermes` in `web/src/lib/clis.ts`. Il conteggio delle sorgenti resta invariato a **92** (87 EN + 5 RU), quindi la guida non è toccata. **3022 → 3042 test.**

## [1.233.2] — 2026-09-10

**Corretto — due avvisi CodeQL `js/remote-property-injection` ad alta severità.**

### Corretto
Il ciclo che copia i valori salvati in `process.env` scorreva `Object.entries(safe)` — un oggetto costruito dal corpo della richiesta — con una guardia esplicita contro le chiavi di prototipo. Il codice era sicuro, perché `safe` viene riempito solo da `KNOWN_KEYS`, ma l'analizzatore non può seguire quel vincolo attraverso due cicli. Ora scorre l'array costante, quindi il nome della proprietà è dimostrabilmente un letterale di modulo. **Il comportamento è identico.**

### Note
Il test che fissava la guardia era un grep del testo sorgente. È stato sostituito da uno strutturale e uno comportamentale che invia `__proto__` come **JSON grezzo** — un letterale di oggetto avrebbe impostato il prototipo invece di creare la proprietà. **3021 → 3022 test.**

## [1.233.1] — 2026-09-10

**Corretto — la guida non descriveva il controllo aggiunto dalla v1.233.0, e la stessa sezione portava ancora istruzioni non più vere da 200 release.**

### Corretto
**DOC-1** — la voce «Usa il valore predefinito (…)» esprime lo stato «la chiave non è impostata»; la differenza dallo scegliere lo stesso valore dall'elenco è invisibile e rilevante. Tre punti nel `### Behavior` esistente ×17.
**DOC-2** — una riga della tabella non nominava alcuna chiave: la cella conteneva `(server uses default UA)`, che descriveva `HH_USER_AGENT`, rimosso nella **v1.19.0**, e invitava a registrarsi su dev.hh.ru — inutile dalla **v1.65.0**. Le tre menzioni obsolete spariscono; la riga di risoluzione problemi è **riscritta**, non cancellata: da luglio 2026 hh.ru restituisce HTTP 451 agli IP non russi.
**La tabella delle chiavi** ne elenca 6 su 45 mentre il titolo promette un registro. Una frase ×17 la dichiara una selezione e rimanda a `#/config`.

### Note
Il nuovo `help-recognized-keys.test.mjs` confronta la prima colonna delle tabelle di chiavi con il `KNOWN_KEYS` vivo. **3018 → 3021 test**; la guida resta a 32 H2 / 122 H3.

## [1.233.0] — 2026-09-10

**Corretto — tre riscontri nel percorso di salvataggio di `#/config`; CONFIG-3 è stato causato dalla correzione stessa della v1.232.1.**

### Corretto
**CONFIG-3** — una scelta deliberata che coincideva con il valore seminato veniva scartata come «non toccata». `initial` confonde due origini: seminato da `.env` e seminato da `defaultValue`, e nel secondo caso l'uguaglianza è **ambigua**. Corretto registrando **`seededFromFile`** accanto a `initial`; dove il seme viene dal file nulla cambia, dove viene dal default `dirty` diventa un *secondo* segnale valido.
**Rimuovere una chiave riportava «· 0»** perché il server restituiva solo ciò che aveva scritto. Ora risponde anche con `removed`, e il messaggio conta entrambi.
**Un menù a tendina poteva essere impostato ma mai svuotato**: nessuno dei 18 aveva un'opzione vuota. Ora ognuno inizia con «Usa il valore predefinito (…)». Una nuova chiave i18n ×17.

### Note
Base unitaria invariata (**3018**); browser **111 → 116**.

## [1.232.1] — 2026-09-10

**Corretto — Salva su `#/config` scriveva campi che l'utente non aveva mai toccato.**

### Corretto
**CONFIG-2.** La v1.57.1 semina un controllo non impostato con il suo `defaultValue` perché il campo mostri ciò che il server usa davvero, mentre `save()` consultava `dirty` **solo per i segreti** e inviava sempre tutti gli altri campi. Il valore messo lì per la VISUALIZZAZIONE partiva quindi come scelta dell'utente: cambiare un menù a tendina inviava **28 chiavi e ne fissava 18** mai aperte. Ciò che cambia è lo stato di ogni impostazione: da «non impostata, segui il default del progetto» a «fissata nel `.env`».

### Note
Confrontare con `cfg.values` non basta: un select non impostato mostra il suo `defaultValue` mentre il valore salvato è `''`. Ora si confronta con **ciò con cui ogni controllo è stato seminato**. Il numero di chiavi scritte torna nel messaggio. **105 → 111** test browser.

## [1.232.0] — 2026-09-09

**Corretto — due difetti da una passata di QA nel browser; nessuno dei due viene dalla v1.231.5.**

### Corretto
**PROFILE-1 — `#/profile` faceva scorrere lateralmente l'intera pagina.** Il valore era un `<div>` anonimo con soli stili di carattere inline, quindi il suo `overflow-wrap` restava `normal`. Un URL LinkedIn non offre al CSS alcun punto di interruzione: la **larghezza min-content è l'intera stringa**, e `min-width: auto` sugli elementi di griglia rifiuta di restringersi oltre — la scheda ha fatto scoppiare la traccia, poi la riga e il documento (**23 px di scorrimento reale a 1280 px**). Corretto con la classe condivisa `.card-value` e `overflow-wrap: anywhere`, più `.card-row > * { min-width: 0 }`. `anywhere`, non `break-word`: solo `anywhere` conta nel calcolo del min-content.
**CONFIG-1 — `POST /api/config` accettava qualunque valore per un campo select.** `{"LLM_PROVIDER":"not-a-provider"}` restituiva **200** e finiva nel `.env`; poi nulla falliva, perché il resolver ripiegava in silenzio. `LLM_PROVIDERS` era già esportato da `env-config.mjs` — il validatore non lo consultava.

### Note
Solo `LLM_PROVIDER` è validato: il dominio reale dei modelli appartiene al fornitore e cambia tra le nostre release. Un valore già salvato viene tollerato, perché il form rispedisce ogni campo non segreto a ogni salvataggio. Aggiunto anche il descrittore di `OLLAMA_API_KEY`. **3013 → 3018 test.**

## [1.231.5] — 2026-09-09

**Sicurezza — sette avvisi chiusi, uno dei quali un'esecuzione di codice remoto critica.** Nessun file sorgente è cambiato.

### Sicurezza
**Unito da Dependabot:** `multer` 2.2.0 → 2.3.0 (**alta** — denial of service per perdita di descrittori di file all'interruzione) e `svgo` 4.0.2 → 4.1.0 nel sito (**alta** e media — `removeScripts` lasciava passare link eseguibili).
**Poi altri cinque, emersi dalla riscansione innescata da quelle unioni.** Ogni intervallo interessato era già coperto dallo `^` esistente, quindi serviva un aggiornamento, non una modifica al manifesto: **`astro` 7.1.0 → 7.3.2** — **critica**, esecuzione di codice remoto tramite l'ottimizzazione delle immagini AVIF (corretta in 7.2.8), e un bypass di autorizzazione (7.2.4); **`sharp` 0.35.3 → 0.35.4** — **alta**, vulnerabilità di libheif; e **`js-yaml` 4.3.1 → 4.3.2** in **entrambi** i manifesti — **alta**.

### Note
"Solo dipendenze" qui non equivale a "senza rischio". `js-yaml` analizza ogni configurazione che l'app legge, `multer` accetta ogni caricamento, e Astro è avanzato di una versione **minore**. Verificato: `test:ci` **3013/3013**, suite browser 4/4, e una ricostruzione completa del sito con le stesse **86 pagine** e i **17** mirror. `npm audit`: **0** vulnerabilità.

## [1.231.4] — 2026-09-07

**Corretto — la v1.231.3 ha sistemato le conseguenze del clic su Doctor, non il momento. Segnalato di nuovo, da mobile e da desktop.**

### Corretto
**`withSpinner` riscriveva ancora il pulsante mentre la richiesta era in volo.** La v1.231.3 gli ha fatto catturare i nodi figli e ripristinarli nel `finally`, e tornavano davvero — ma il segnale di occupato eseguiva comunque `replaceChildren` con il testo `'⏳ ' + original`. Per tutta la durata di `doctor.mjs` il quadrato da 36 px conteneva quindi `⏳ 🩺Doctor` e diventava una pillola larga che rompeva la riga; su desktop appariva come un `⏳🩺Doctor` ammassato. **Un pulsante con figli elemento non viene più riscritto**: il suo segnale è la classe `.is-loading`, che ora scambia l'icona con una clessidra in CSS, così la geometria non può cambiare: **36 px a riposo, 36 px in volo, 36 px dopo**.

### Note
La lezione riguarda l'asserzione, non il codice. Il gate della v1.231.3 attendeva che `aria-busy` sparisse e solo allora misurava: per costruzione vedeva solo lo stato già riparato dal `finally`. Il nuovo controllo **tiene aperta la promessa da sé** e campiona a metà volo. **3012 → 3013 test.**

## [1.231.3] — 2026-09-07

**Corretto — cliccare Doctor rompeva la barra superiore su mobile. Segnalato da un telefono il giorno stesso in cui è uscita la v1.231.2.**

### Corretto
**`UI.withSpinner` appiattiva i figli del pulsante che decorava.** Il suo segnale di occupato passava per `textContent`: salvare `button.textContent`, scrivere `'⏳ ' + original`, riscriverlo. Assegnare `textContent` sostituisce **tutti** i figli con un unico nodo di testo — e la v1.231.2 aveva appena diviso ogni azione della barra in `.btn-ico` + `.btn-label`, con l'etichetta nascosta sotto `max-width: 900px`. Così il primo tocco su Doctor distruggeva entrambi gli `<span>` per sempre: le regole mobile non avevano più nulla da agganciare, l'etichetta tornava come testo nudo e il quadrato da 36 px cresceva in una pillola `🩺Doctor` che si sovrapponeva all'interruttore del tema. Non guariva da solo — solo un ricaricamento ripristinava il markup. La correzione cattura i **nodi** figli e li ripristina con `replaceChildren`; i pulsanti di solo testo, cioè la maggior parte dei 24 punti di chiamata, si comportano esattamente come prima.
- **FIND-3 — il campo di ricerca si era ridotto a 8 px su un telefono da 320 px.** Portando la barra su una riga sola, il searchbar è rimasto l'unico elemento flessibile, e il changelog precedente lo diceva: *«può ridursi a nulla»*. E si è ridotto a nulla: **8 px di campo a 320 px, 28 px a 340 px**, un carattere di un segnaposto da 21. Cliccabile e digitabile, ma illeggibile come campo. Nessun `min-width` lo risolve: a 320 px la barra tiene 32 px di padding, un menu da 40 px e 162 px di azioni, senza 120 px da cedere. Perciò sotto i **420 px** — la larghezza in cui il campo supera finalmente i 100 px da solo — si nasconde dietro una lente e si espande su tutta la barra al tocco: **182 px a 320 px, 222 px a 360 px, 252 px a 390 px**, senza overflow ad alcuna larghezza. Il pulsante conserva un unico nome accessibile e comunica lo stato con `aria-expanded`, e lo scambio 🔍/✕ è CSS puro. Sopra i 420 px non cambia nulla. Trovato da una passata di regressione in browser sulla build live.

### Note
È la stessa classe di difetto della trappola `applyI18n()` annotata nella v1.231.2 — codice che assegna `textContent` a un elemento che ora ha figli elemento — raggiunta da un chiamante diverso. La lezione si generalizza: **dividere il contenuto di un elemento in `<span>` figli rende ogni scrittore di `textContent` già esistente su quell'elemento un bug latente**.
Bloccato due volte: `node:vm` sul vero `withSpinner` e un clic in un browser reale a 320 px. Entrambi confermati fallire sul codice precedente. **3009 → 3012 test**.

## [1.231.2] — 2026-09-06

**Corretto — la barra superiore mobile andava a capo su due righe, il server eseguiva un padre più vecchio e il redirect di cvstart.ru dava 404 su qualsiasi percorso che già nominasse una lingua.**

### Corretto
- **La barra superiore mobile torna su una sola riga, azioni a sole icone.** I pulsanti venivano forzati su una seconda riga a tutta larghezza: un telefono mostrava `[☰ · ricerca]` sopra `[🔔 🌙 Doctor Apri Scan]` — due pillole larghe su una riga propria. Ora sono quadrati da 36 px (🩺 / ⚡) accanto alla campanella e all’interruttore del tema, e tutto sta su una riga a 320 px. Misurato, non stimato a occhio: la larghezza del documento eguaglia il viewport a 320, 360, 390 e 430 px e su tutta la fascia 560–760 px, dove prima i pulsanti si sovrapponevano alla barra di ricerca. **La lingua non incide più sul layout mobile**, perché l’etichetta è nascosta e il pulsante è un quadrato fisso; sopra i 900 px le etichette tornano invariate.
- **Il server eseguiva il padre 1.31.0 benché la versione fosse costruita su 1.32.0.** `/api/health` sul server di produzione riportava `parentVersion: 1.31.0`. Sincronizzati 95 file di runtime, due rimossi. Rilevato da QA da browser sulla superficie in produzione.
- **`cvstart.ru` anteponeva `/ru/` a qualsiasi percorso, senza guardare cosa ci fosse già.** `/ru/help` diventava `/ru/ru/help` e `/en/help` diventava `/ru/en/help`; entrambi 404. Il primo è ciò che si ottiene copiando un URL dal sito principale; il secondo escludeva del tutto il visitatore anglofono dalla versione inglese. Ora un percorso che nomina già uno dei 16 prefissi passa così com’è, `en` viene rimosso (l’inglese sta nella radice) e il resto riceve ancora `/ru/`.

### Modificato
- **98 prompt QA superati spostati in `qa/archive/superseded-prompts/`.** `qa/README.md` documenta dalla v1.137.0 che al livello superiore resta solo il prompt della versione corrente — la regola non è stata applicata per 95 versioni.
- **Altri cinque prompt hanno lasciato il livello superiore: si dichiaravano attuali senza esserlo.** `REGRESSION-FINAL.md` si definiva «l'unico prompt di regressione autorevole e indipendente dalla versione», ma i suoi §§11–15 sono cinque registri di cicli chiusi (v1.55.x → v1.59.7) e la baseline dell'aiuto dichiarata era **28 H2 / 103 H3 su 16 lingue** contro 32 / 122 e 17 oggi: un agente QA che lo seguisse sarebbe caduto al §9 al primo passo. `QA-REGRESSION-PROMPT.md` aveva un nome senza versione e contenuti di v1.226.0. `QA-REGRESSION-PROMPT-v1.76.0-FULL.md` era fissato 155 release indietro, `REGRESSION-PROMPT-FINAL.md` chiude il ciclo v1.58.52 → v1.59.10 e `QA-FULL-REGRESSION.md` li duplicava tutti su base v1.131.1. Con loro è andato `PARENT-SYNC-WORKLIST-v1.26.0.md` (il progetto padre è ormai a 1.32.0) e il datato `UX-AUDIT-2026-07-06.md` è passato in `reports/`. Restano quattro driver, con le proprie baseline aggiornate ai valori reali di v1.231.2. `qa/README.md` è riscritto per descrivere la cartella che esiste.

### Note
- Due trappole di specificità ora commentate in `app.css`: le regole desktop sono dichiarate **più in basso** del blocco `max-width: 900px`, quindi a parità di specificità vincono.
- `applyI18n()` assegna `el.textContent`, perciò la chiave i18n è passata a uno `<span>` interno; sul pulsante avrebbe cancellato l’icona a ogni cambio lingua.
- Il primo rsync del padre **si è interrotto a metà** su un file non più presente in locale, lasciando un deploy parziale che riportava successo. I deploy del padre si verificano per checksum, mai per codice di uscita.

## [1.231.1] — 2026-09-06

**Corretto — la scansione dei contatori della v1.231.0 ha riscritto il nome dell’account in tutti i link.**

### Corretto
- **Ogni link `Fighter90` è diventato `Fighter92`.** La scansione del contatore di sorgenti in v1.231.0 sostituiva `90` con `92` sotto una guardia di confine numerico, che scarta correttamente `290` e `901` ma corrisponde al `90` dentro **`Fighter90`**. **562 link nei 17 README, nei 17 pacchetti di aiuto e nei mirror di aiuto del sito**, più **138 nel wiki**, puntavano a un account inesistente. Segnalato da un utente, per l’immagine mancante.
- **Cinque riferimenti storici a versioni sono slittati.** La scansione `85 → 87` ha trasformato `v1.85.0` in `v1.87.0`, inventando una versione mai rilasciata.

### Note
- Un confine numerico non basta: protegge un numero dalle **cifre** vicine, non dall’essere parte di un **identificatore** o di una **stringa di versione**. I contatori sono corretti: 92 sorgenti, 87 adattatori EN, 3009 test.
- Il repository padre non è stato toccato.

## [1.231.0] — 2026-09-05

**Aggiunto — due sorgenti di scansione dal career-ops padre v1.32.0 (Collage, Telegram rigoroso), la modalità REST di Gem e un difetto che il port ha portato alla luce nel codice del padre stesso.**

### Aggiunto
- **Due nuove sorgenti, 90 → 92** (87 EN + 5 RU), `ALL_ADAPTERS` **85 → 87**. Entrambe senza token.
  - **Collage** (`provider: collage`) — l’API pubblica dei siti annunci di Collage HR. Il segmento di percorso è **l’indirizzo del sito che il tenant ha scelto**, non uno slug del nome azienda: viene quindi letto da `api:` o da un URL `secure.collage.co/jobs/<indirizzo>` e **mai indovinato** — un indirizzo indovinato scansionerebbe la bacheca di qualcun altro.
  - **Telegram (rigoroso)** (`provider: telegram-channel`) — legge le stesse anteprime `t.me/s/<canale>` della sorgente `telegram` esistente, con lo **scambio opposto**: un post diventa una riga **solo se nomina un datore di lavoro E rimanda a una pagina di annuncio**. Digest, post con datore nascosto e post di solo contatto vengono scartati. Bassa copertura per scelta — a monte è stato misurato il 32-77% dei post che passano — ma ogni riga porta un datore reale e un link reale. Entrambe vengono distribuite, come nel padre.
- **Gem ha guadagnato una modalità REST opzionale** accanto al percorso GraphQL (`api: https://api.gem.com/job_board/v0/<board>/job_posts`). Non viene mai derivata da un id di bacheca, e il percorso GraphQL resta il predefinito. Portato dal padre #3783.

### Corretto
- **Il filtro di luogo di `telegram-channel` non vedeva il cirillico e nominava città come datori di lavoro.** Il `LOCATIONISH_RE` del padre usava `\b`, un confine solo ASCII che non scatta mai accanto al cirillico: tutte le sue alternative russe erano irraggiungibili e `Senior Engineer | Москва` restituiva **«Москва» come datore di lavoro**. È esattamente la sostituzione di campo che l’intera politica di attribuzione esiste per impedire, e colpiva il pubblico principale del provider. Il port di web-ui usa controlli Unicode, gli stessi che il padre già applica una costante più sotto in `ROLE_WORD_RE`. Fissato da un test che fallisce sulla forma ASCII. **Non ancora corretto a monte.**

### Note
- **Il recupero per faccette di Workday nel padre (#3851, #3874) non richiedeva port** — web-ui non pagina Workday affatto, un solo POST a `offset: 0`.
- **`providers/_types.js`** è cambiato solo nella documentazione.
- Test: **2962 → 3009** (+47).

## [1.230.0] — 2026-09-05

**Modificato — tre correzioni ai provider dal career-ops padre v1.32.0, e un difetto che il port stesso ha portato alla luce.**

### Aggiunto
- **Welcome to the Jungle accetta un’espressione `filters` di Algolia applicata lato server** (`wttj: { filters: "offices.country_code:FR AND contract_type:full_time" }`). Una parola chiave da sola non restringe una bacheca globale: a decidere quali `max_hits` risultati arrivano è il ranking di pertinenza di Algolia, non i filtri dello scanner — i nostri agiscono dopo, su ciò che è già arrivato, quindi tutto oltre il tetto è invisibile per quanto bene corrisponda. Un filtro riduce l’**insieme** invece di riordinarlo, perciò il tetto per query sale da 200 a 1000. Con un filtro, `queries` diventa facoltativo: la query vuota significa «tutto ciò che passa il filtro». Portato dal padre #3757.

### Corretto
- **Radancy non avvisa più «truncated» quando un tenant serve semplicemente meno annunci di quanti ne dichiari il suo stesso banner.** Il padre ha confrontato `data-total-results` con nove tenant reali: cinque coincidevano, ma quattro — uno piccolo e uno enorme — hanno consegnato dal 10% al 56% di annunci unici in meno del dichiarato, senza una sola riga duplicata. Il banner sovrastima ciò che l’indice di ricerca del tenant serve davvero, quindi confrontarci il conteggio accumulato dava falsi positivi sulla maggioranza delle bacheche. L’avviso ora compare solo quando il percorso è stato fermato dal **nostro** `max_jobs`/`max_pages`, l’unico caso su cui il chiamante possa agire; `totalResults` resta nel messaggio come contesto e non decide mai. Portato dal padre #3839.
- **Radancy aggira la cache a ogni richiesta di frammento JSON.** Uno strato di cache davanti a quella rotta ripete risposte obsolete su alcuni tenant: lo stesso annuncio ricompare pagine dopo mentre un altro non viene mai servito — riprodotto nove volte su nove a monte. Le intestazioni `Cache-Control`/`Pragma` non hanno cambiato nulla; un parametro casuale per richiesta sì. Deve essere unico per **chiamata**, mai derivato dal numero di pagina: un parametro deterministico darebbe comunque alla cache una chiave stabile, e con essa la stessa corrispondenza stabile e sbagliata. Portato dal padre #3839.
- **Gli elenchi di uffici di Greenhouse hanno ordine deterministico.** Greenhouse non promette l’ordine di `offices[]` tra una risposta e l’altra, e l’insieme ricostruito dall’albero `/offices` segue il suo ordine di visita. Entrambi finiscono nel campo `location` dell’annuncio, quindi una bacheca che riordinasse i propri uffici riscriveva quella stringa — e un annuncio immutato veniva letto come nuovo. Il padre ha corretto l’insieme (#3839); **web-ui aveva una seconda istanza dello stesso difetto, assente nel padre** — il ripiego `offices[0]`, usato quando l’annuncio non porta una localizzazione propria — e ora sono ordinati entrambi.

### Note
- **La correzione iCIMS del padre (#3728) non richiede port.** Legge tutte le voci `jobLocation` dal JSON-LD della pagina di dettaglio, perché alcuni tenant emettono una voce interamente `UNAVAILABLE` prima dell’indirizzo reale. L’iCIMS di web-ui prende la localizzazione dall’HTML della **pagina di elenco** e non apre mai una pagina di dettaglio.
- **La modifica a `_http.mjs` non richiede port.** Estrae `isRefusedRedirectError` per un secondo consumatore che web-ui non ha; il comportamento di `isRetryableError` è invariato.
- **La deduplicazione per localizzazione (#3751) non è rispecchiata** — vive nella pipeline `scan.mjs` della CLI del padre.
- Registro invariato: **90 fonti** (85 EN + 5 RU). Test: **2956 → 2962** (+6).

## [1.229.0] — 2026-09-03

**Aggiunto — quattro fonti di scansione dal career-ops padre v1.31.0: Built In, Feishu Jobs, Garena e MokaHR.**

### Aggiunto
- **Quattro nuove fonti, 86 → 90** (85 EN + 5 RU), `ALL_ADAPTERS` **81 → 85**, tutte senza token. **Built In** copre i nove mercati della bacheca tech statunitense e **non porta query predefinite**: una voce senza `queries:` né `categories:` non scansiona nulla e lo dice, perché una fonte condivisa non deve portare i termini di ricerca di qualcuno; un mercato fuori elenco viene **rifiutato**, mai sostituito in silenzio dalla bacheca nazionale. **Feishu Jobs** accetta due sole forme di host, che usano **percorsi diversi** per la pagina dell'offerta. **Garena** è mono-azienda: `office` modella il **link**, non l'elenco. **MokaHR** restituisce una **risposta cifrata** (busta AES-128-CBC con la chiave accanto) — offuscamento, non sicurezza, ma senza decifrare non si legge nulla.

### Corretto
- **`htmlToText` poteva lasciar passare nel testo un apri-tag incompleto.** `safe &lt;img src=x onerror=1` usciva come `safe <img src=x onerror=1`. Ora ogni decodifica è seguita da una ripulitura e l'apri-tag finale perde la parentesi angolare. Portato dal padre (#3491).

### Note
- **Dal fix Workday del padre non è stato portato nulla.** Recupera i tenant il cui backend blocca la paginazione all'offset 2000 — web-ui non pagina Workday (un POST a `offset: 0`, 100 righe).
- **I fix a `verify-cv-facts` e `merge-tracker` non hanno richiesto port**: web-ui esegue quegli script dal checkout del padre.
- Test: **2909 → 2956** (+47).


## [1.228.5] — 2026-08-30

**Corretto — la versione riportata descriveva il file su disco, non il codice in esecuzione.**

### Corretto
- **`/api/health` rileggeva `package.json` a ogni richiesta, quindi un processo obsoleto riportava una versione che non stava eseguendo.** Il QA ha trovato un'istanza locale che rispondeva `version: 1.228.4` mentre restituiva 404 per `/api/ping`, una rotta aggiunta in 1.228.3: avviata prima del deploy, serviva il codice vecchio e riportava la versione del file nuovo. È esattamente così che un deploy che copia i file senza mai riavviare sembra riuscito: l'unica stringa che un operatore controlla è quella che non può vedere il problema. Stessa classe del symlink di v1.228.1, dove rsync si interrompeva a metà trasferimento e riportava comunque successo.

  La versione ora viene catturata al caricamento del modulo, quindi descrive il codice in esecuzione. Un processo obsoleto riporta la versione **vecchia** — la verità, visibile subito. `parentVersion` resta per richiesta: descrive il checkout del progetto padre, che questo processo non carica e che può legittimamente cambiare sotto un server in esecuzione.

## [1.228.4] — 2026-08-30

**Corretto — la sonda di liveness non autenticata faceva lavoro su disco a ogni richiesta.**

### Corretto
- **`GET /api/ping` leggeva e analizzava `package.json` a ogni chiamata.** È l'unico endpoint raggiungibile senza credenziali, quindi una lettura da disco più un parsing JSON per richiesta è una leva di denial of service consegnata a chiunque — CodeQL l'ha segnalata come mancanza di limitazione di frequenza. La versione ora si legge una sola volta alla registrazione della rotta; non può cambiare senza riavvio, quindi il gestore non fa alcun I/O. Limitare la frequenza avrebbe contenuto il danno; togliere il lavoro toglie la leva.
- **Il mascheramento del nome reale del titolare del profilo fuori dal loopback è ora fissato da un test.** `/api/health` lo sostituiva già con `hidden`, ma solo perché quella riga condivide la guardia `hidden ?? value` con la radice del progetto. Nulla lo verificava: una modifica che le desse un valore proprio avrebbe fatto trapelare il nome di una persona reale sulla LAN senza che nulla se ne accorgesse.

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

**Aggiunto — i canali Telegram come fonte di scansione e una modalità di query paginata su `/api/scan-results`.**

### Aggiunto
- **I canali Telegram sono ora una fonte scansionabile.** Un blocco `telegram_channels:` in `portals.yml` li elenca; ognuno viene letto dall'anteprima pubblica `https://t.me/s/<canale>`. Registro: **85 → 86 fonti** (81 EN + 5 RU), `ALL_ADAPTERS` **80 → 81**.

  Telegram non pubblica RSS e la Bot API non può leggere un canale che il bot non amministra: nessuna delle due vie ovvie funziona. L'anteprima `/s/` è semplice HTML reso dal server: senza autenticazione, senza JS, senza cookie. Verificato su 16 canali: 15 hanno restituito 20 post ciascuno con una GET nuda.

  `channel:` accetta qualsiasi forma di scrittura. Il parser si ancora alle tre cose che un redesign di Telegram sposterebbe per ultime: `data-post`, il contenitore del testo e la data ISO `<time datetime>`.
- **`GET /api/scan-results` guadagna una modalità di query paginata.** `?q=<testo>&limit=50[&region=ru|en][&set=filtered|fresh][&offset=N]` restituisce `{ total, returned, offset, limit, set, rows }`, dove **`total` è il conteggio PRIMA della paginazione**. Senza parametri la rotta restituisce ancora lo snapshot intero: la tabella `#/scan` dipende da quella forma.

### Corretto
- **L'assistente Telegram rispondeva da una frazione dei dati.** Il suo skill puntava già a `/api/scan-results`, ma la rotta sapeva restituire solo lo snapshot intero — circa 2 MB — che non entra nel contesto di un agente. Alla richiesta «trova tutti i Product Manager» ha riportato **9** corrispondenze dove lo snapshot ne aveva centinaia, dicendo di «lavorare con un indice locale limitato». Era vero: vedeva l'endpoint ma non poteva consumarlo. Con la modalità paginata la stessa domanda costa 2 KB e restituisce un `total` onesto. Anche lo skill è stato riscritto: chiedeva di riassumere i post *nuovi*, cioè puntava a `fresh` invece che a `filtered`.

### Note
- **Un post di canale è prosa, non una scheda di lavoro.** Non ci sono campi strutturati: il titolo viene dalla prima riga sostanziale, azienda/luogo/retribuzione da etichette esplicite. **Separare le offerte vere da pubblicità e digest resta al `title_filter` esistente**, lo stesso già tarato per le altre fonti. Sono spunti, non un elenco.
- **L'azienda non viene mai indovinata.** Senza etichetta la riga è attribuita al canale (`@rabotaphp`): un datore di lavoro sbagliato entra nel tracker come un fatto.
- **Un parse vuoto è un errore, non «nessuna offerta».** t.me risponde con un redirect per un canale privato o inesistente; restituire zero righe si leggerebbe come una giornata tranquilla e nasconderebbe per sempre un refuso nella configurazione. `jobGeeks` fa esattamente questo (HTTP 302) e deliberatamente **non** è configurato.
- Il rilevamento del remoto usa una frontiera di parola Unicode anziché `\b`, che è solo ASCII — la stessa trappola del filtro sui titoli in v1.227.3, qui colta da un test prima del rilascio.
- 15 canali configurati e verificati dal vivo: **299 post, 15/15 canali**. 30 nuovi test. Test: **2865 → 2895**.
- **The README test counts jumped by hundreds, and no, this release did not add them.** The localized READMEs carried unit-test totals frozen at 1856 / 1945 / 1955 / 549 / 419 / 284 / 2527 depending on the file — each stale since a different release, and several contradicting the badge at the top of the same page. They now all read **2895**, verified by running the suite rather than by copying a badge. Playwright (70 / 90 / 12 → **101**), e2e smoke (20 → **21**), route modules (12 / 32 → **37**), smoke flows (12 → **22**) and the test-file count (218 → **329**) were stale in the same way. The `Total` row also repeated the unit count, so it under-summed the three suites below it; it now reads the real sum (**3040**).

## [1.227.5] — 2026-08-29

**Corretto — la scansione regionale esauriva la memoria del server e una suite Playwright falliva sul proprio smontaggio.**

### Corretto
- **La scansione regionale uccideva il server per OOM.** `ru-scanner` accumulava **ogni risultato grezzo di ogni query** e deduplicava e filtrava solo alla fine. L'elenco di query è volutamente pieno di quasi sinonimi (`Golang`, `Go разработчик`, `Golang разработчик`, `Senior Go`…), quindi la stessa offerta torna una volta per query e l'array tratteneva un multiplo del conteggio univoco — descrizioni comprese, che sono il grosso dell'oggetto e che i filtri scartano quasi del tutto. Misurato: **742 MB** di heap su un'esecuzione reale da 21 query. Il server limita l'heap di Node a **490 MB** (V8 lo dimensiona dai 956 MB di RAM della macchina), perciò la scansione abbatteva il servizio con `FATAL ERROR: Reached heap limit` — **quattro volte in un giorno**. Ora deduplicazione e filtraggio avvengono per query, portando la stessa esecuzione a **177 MB**, il 76% in meno. I conteggi riportati non cambiano: il totale univoco è portato da un `Set` di stringhe URL.
- **`net::ERR_SOCKET_NOT_CONNECTED` faceva fallire la CI a caso.** Tre suite Playwright chiamano `window.stop()` per fermare le richieste in volo prima di affermare che non ci sono stati errori di console. Chromium riporta quell'unico atto con **tre** nomi a seconda dello stato del socket: `ERR_ABORTED` all'annullamento, `ERR_EMPTY_RESPONSE` in volo, `ERR_SOCKET_NOT_CONNECTED` quando il socket era già sparito. Il filtro condiviso ne elencava solo due. È emerso nella scansione dei locale su `tr`, mentre `playwright-forms` e `playwright-smoke` erano a un'esecuzione dallo stesso guasto.

### Note
- **Perché solo ora.** L'elenco è passato da 14 a 21 query con l'aggiunta delle ricerche product manager. La memoria della vecchia implementazione scalava col totale dei risultati: +50% di query ha superato il tetto della macchina.
- **La modifica alla deduplicazione preserva il comportamento, ed è testato.** `tests/ru-scanner-dedup-order.test.mjs` fissa la direzione scomoda — un duplicato successivo che NON passa i filtri deve sfrattare uno precedente che era passato — ed esegue 200 verifiche randomizzate di equivalenza contro la vecchia implementazione.
- **Il filtro della console resta stretto.** Solo la famiglia delle richieste annullate è benigna; connessione rifiutata, errore DNS, reset, 5xx ed eccezioni JS continuano a far fallire l'asserzione.
- Due ipotesi sono state testate e scartate anziché spedite: un timeout di Caddy (configurazione pulita, `flush_interval -1` corretto per SSE) e il `requestTimeout` predefinito di 5 minuti di Node (una riproduzione in scala ha mostrato che non interrompe una lunga risposta in streaming). La prova vera è stata `Reached heap limit` nel journal. Test: **2860 → 2865**.

## [1.227.4] — 2026-08-29

**Corretto — `word:` / `stem:` erano ancora ignorati da `content_filter`; la v1.227.3 aveva sistemato solo il filtro sui titoli.**

### Corretto
- **`content_filter` non rispettava i prefissi.** La v1.227.3 ha insegnato a `title_filter` i prefissi `word:` / `stem:` del progetto padre, ma ha lasciato `content_filter` al suo `lower.includes(k)` grezzo: lì una voce con prefisso veniva ancora confrontata con il testo letterale `"word:java"` — lo stesso no-op silenzioso, un filtro più in là. `content_filter` legge la DESCRIZIONE dell'offerta e il suo default è sempre stata una semplice sottostringa: per questo un negativo nudo `java` scarta tutto ciò che si limita a menzionare «JavaScript»; il prefisso è il modo di sottrarre una singola voce a quella regola. Portato il `compileContentKeyword` del padre, che condivide la macchina dei prefissi ma deliberatamente **non** ancora le parole corte: il filtro sui titoli ancora le sigle di 2–3 lettere perché «COO» dentro «Coordinator» è sempre sbagliato, mentre una sequenza breve dentro un paragrafo di prosa è spesso voluta (`aws`, `gcp`, `sql`, `go`).

### Note
- **Individuato nella revisione IA della PR v1.227.3**, che ha notato come il codice non coprisse ciò che il suo stesso commento affermava: diceva «`title_filter` / `content_filter`» mentre era collegato solo il percorso dei titoli. Ora il commento distingue esplicitamente: entrambi i filtri rispettano i prefissi, solo quello sui titoli ancora le sigle.
- **Verificato anch'esso da quella revisione e invariato:** passare la regola delle sigle di 2–3 lettere da `\b` alla frontiera Unicode è identico per l'ASCII e più severo solo dove serve — `COO_lead` e `coo1` restano mantenuti (trattino basso e cifra sono caratteri di parola in entrambi), `Coordinator` mantenuto, «Директор COO» e «VP «Продукт»» correttamente scartati. Verificati 14 casi limite.
- Le voci di `content_filter` senza prefisso mantengono la corrispondenza precedente byte per byte, una descrizione vuota o assente passa ancora, e un `word:` / `stem:` vuoto non corrisponde a nulla anziché a tutto. 6 nuovi casi in `tests/content-filter.test.mjs`. Test: **2852 → 2858**.

## [1.227.3] — 2026-08-29

**Corretto — i prefissi `word:` / `stem:` del filtro sui titoli venivano ignorati in silenzio, rendendo quelle righe di filtro inefficaci.**

### Corretto
- **web-ui non implementava i prefissi `word:` / `stem:` del progetto padre.** `title_filter` (e `content_filter`) confrontano per impostazione predefinita **sottostringhe** senza distinzione di maiuscole: per questo un negativo nudo `intern` scarta anche «International Product Manager» e «Internal Tools Engineer». Anziché ribaltare quel default — una rottura per ogni installazione già configurata — il padre ha reso la precisione opzionale per singola voce: `word:intern` corrisponde solo alla parola intera e `stem:agent` deve iniziare una parola potendo proseguire (separando «Agentforce» da «Reagents»). web-ui non aveva né l'uno né l'altro, quindi confrontava la voce con il **testo letterale** `"word:intern"`, che non compare in nessun titolo di offerta. La riga diventava un no-op silenzioso: lo stesso `portals.yml` filtrava correttamente dalla CLI e per niente qui, così ogni annuncio di stage escluso raggiungeva comunque la tabella `#/scan`. Portato dal `title-keywords.mjs` del padre, inclusa la frontiera di parola compatibile con Unicode (`\p{L}\p{M}\p{N}_`) al posto di `\b`, che è solo ASCII e corrispondeva a metà parola nei titoli accentati o cirillici.

### Note
- **Trovato controllando un `portals.yml` reale** che aveva appena adottato `word:intern` **proprio** perché un `intern` nudo smettesse di scartare «International Product Manager». Il prefisso funzionava nella CLI; web-ui teneva silenziosamente tutti gli stage. Ora il comportamento è identico.
- **I default non cambiano.** Una parola chiave senza prefisso mantiene il confronto precedente: sottostringa per le frasi e per tutto ciò che contiene caratteri non alfabetici (`.NET`, `SAP `, `L&D`), ancoraggio ai confini di parola per le sigle di 2–3 lettere. Un `word:` / `stem:` vuoto è considerato un refuso e non corrisponde a **nulla**: come negativo, uno schema vuoto corrisponderebbe a ogni titolo e annullerebbe un'intera scansione per via di due punti sfuggiti.
- La regola delle sigle di 2–3 lettere usa ora la stessa frontiera Unicode: prima usava `\b`, quindi `coo` e `word:coo` divergevano sui titoli non ASCII — due grafie della stessa regola.
- 6 nuovi casi in `tests/title-filter.test.mjs`. Test: **2846 → 2852**.

## [1.227.2] — 2026-08-29

**Corretto — `#/config` scorreva lateralmente sui telefoni stretti.**

### Corretto
- **MOBILE-1: `#/config` andava in overflow orizzontale su viewport ≤ 352 px.** Ogni campo di tipo select portava un `min-width: 300px` **inline**. Uno stile inline batte il foglio di stile, quindi il controllo non poteva restringersi insieme al contenitore: con un viewport da 320 px il bordo destro del select finiva a 353 px, la pagina otteneva una barra di scorrimento orizzontale e i controlli uscivano a destra. Interessati tutti e 18 i select di provider/modello (`cfg-llm-provider` e ogni `cfg-*-model`). Ora `min-width: min(300px, 100%)` + `max-width: 100%`, così i comodi 300 px valgono solo quando c'è spazio. Dispositivi alla soglia o sotto: iPhone SE (1ª gen., 320 px), Android datati, schermo esterno del Galaxy Fold.

### Note
- **Perché tutte le passate mobili precedenti l'hanno mancato.** 360 px e 375 px hanno giusto il margine per nascondere l'overflow, e le suite Playwright girano in una finestra da 1280 px. Nulla in CI aveva mai misurato un viewport più stretto di 375 px. Il nuovo `tests/playwright-narrow-viewport.mjs` percorre le rotte con form a **320 px** e fallisce su qualsiasi overflow orizzontale, nominando nel messaggio l'elemento più largo; un secondo caso fissa che nessun select di `#/config` supera il viewport. È stato prima verificato che riproducesse il bug (`scrollWidth 353 > clientWidth 320`, 18 select con bordo destro 353). Playwright: **99 → 101**.
- **Noto e volutamente non ancora sotto gate: 280 px** (schermo esterno del Galaxy Fold) va ancora in overflow di ~5 px, per una causa diversa — contenuto lungo dentro i blocchi `<details>` della card di configurazione e la sidebar da 256 px contro un viewport da 280 px, non il `min-width` inline che questa release corregge. Rifluire a una larghezza che nessun telefono diffuso dichiara è lavoro a parte; la lista `WIDTHS` della suite è già pronta.
- Corretto anche il prompt QA della v1.227.1, che chiamava la rotta di follow-up `#/modes/followup`. Le mode-page registrano lo slug nudo (`Router.register(cfg.slug)`), quindi la rotta è `#/followup` e `#/modes/followup` restituisce correttamente 404. Solo documentazione.
- Suite unitaria invariata a **2846** (la nuova copertura è a livello browser).

## [1.227.1] — 2026-08-29

**Corretto — la ripartizione delle fonti nella guida non tornava con sé stessa e il banner GitHub veniva stampato come markup grezzo nell'app.**

### Corretto
- **§17 dava un totale e una ripartizione che non sommavano.** Tutti i bundle della guida dicevano «il registro `server/lib/sources/` include **85** adapter — **78 inglesi + 5 russi**». 78 + 5 = 83, non 85; in ja/ko la deriva arrivava a 77 (= 82). Ogni nuova fonte alzava il totale lasciando intatto l'addendo, e i due numeri divergevano da diverse release. Ora la ripartizione è **80 EN + 5 RU** in tutte e 17 le lingue. Conta più dell'estetica: `docs/help/<lang>.md` è l'UNICO corpus su cui si fonda «Ask the docs», quindi chi chiedeva quante fonti fossero supportate riceveva due numeri contraddittori dalla stessa frase.
- **La stessa frase fissava un'ancora di versione obsoleta.** «A partire da **v1.213.0** il registro …» è sopravvissuta in 16 lingue mentre il contatore si muoveva due volte (83 in v1.219.0, 85 in v1.226.0). L'ancora era già stata riparata a mano in v1.210.1 ed è semplicemente derivata di nuovo. Viene rimossa a favore di una formulazione senza versione: il contatore è verificato contro il registro vivo, che non può invecchiare.
- **Il banner dei provider veniva stampato come markup escapato in cima a `#/help`.** v1.225.0/v1.225.1 lo davano per «rimosso nell'app da `UI.md()` (nessun supporto immagini)». Questo confonde due cose: `UI.md()` fa escape per primo — esegue l'escape di ogni byte della sorgente prima di qualsiasi trasformazione markdown, che è il confine XSS corretto ma l'opposto della rimozione. Nessuno rimuoveva il banner perché nessuno ci provava, e tutte e 17 le lingue aprivano `#/help` con 268 caratteri di `<p align="center"><img src="https://…` letterale. Un nuovo ingresso condiviso (`server/lib/help-markdown.mjs::stripGithubOnlyBlocks`) scarta in lettura i blocchi HTML immagine isolati, sia per `GET /api/help/:lang` sia per il corpus del docs-assistant. I file mantengono il banner, quindi GitHub continua a mostrare la vetrina.
- **La colonna «#» della bacheca della cadenza era vuota dalla v1.117.0.** Leggeva `entry.appNum`, mentre `followup-cadence.mjs` emette `num` — `appNum` non è mai esistito nel payload. Ora vengono letti entrambi. La riga «Next up» della v1.227.0 aveva ereditato lo stesso errore ed è corretta insieme.

### Note
- **Tutti e quattro sono passati inosservati perché nulla li presidiava.** I gate della guida (`canonical-docs-coverage`, `help-ui`, `help-ru-config-section`) contano le INTESTAZIONI — 32 H2 / 121 H3 — e nessun test aveva mai letto un numero dentro un paragrafo né guardato cosa serve davvero l'ingresso della guida. Due nuove suite chiudono la falla: `tests/help-source-counts.test.mjs` (il totale dichiarato è pari a `SOURCES.length`; gli addendi corrispondono alla divisione EN/RU viva e sommano al totale; il paragrafo non fissa versioni) e `tests/help-banner-strip.test.mjs` (il banner resta su disco per GitHub, non sopravvive mai allo strip, la prima riga renderizzata di ogni bundle è la sua intestazione, lo strip resta stretto ed entrambi i consumatori vi passano). Entrambe verificate in rosso contro esattamente questi bug prima del commit. Suite di test: **2837 → 2846**.
- Nessuna modifica a registro, scanner o contratti di route; le fonti restano **85** (80 EN + 5 RU) e `ALL_ADAPTERS` **80**.

## [1.227.0] — 2026-08-28

**Aggiunto — SEEK Hong Kong (JobsDB), un filtro solo-in-scadenza sui follow-up e i datori di lavoro riservati mostrano l'agenzia che li ha presentati.**

### Aggiunto
- **JobsDB Hong Kong tramite la sorgente Jobstreet/SEEK esistente.** Hong Kong opera con il marchio JobsDB ma poggia sulla stessa piattaforma SEEK dietro lo stesso endpoint v5, quindi non serve una sorgente separata — bastano `hk.jobsdb.com` nella allowlist degli host e `siteKey: HK-Main`. Il registro resta invariato: **85 sorgenti** (80 EN + 5 RU) e `ALL_ADAPTERS` **80** — è un nuovo MERCATO su un adapter esistente, non un adapter nuovo.
- **Filtro solo-in-scadenza sulla bacheca della cadenza** (`#/modes/followup`). Una nuova casella restringe la bacheca a ciò su cui agire *adesso*. La scadenza si legge dall'`urgency` già calcolata dal `followup-cadence.mjs` del progetto padre (`urgent` / `overdue`), mai dallo `status` del tracker, che vale `applied`/`responded`/`interview` e non combacerebbe con nulla. Quando non c'è nulla in scadenza, la bacheca indica il follow-up programmato più vicino invece di mostrare un vuoto. La logica vive nel modulo puro `public/js/lib/followup-view.js`, specchio del `followup-view.mjs` del padre.
- **I datori di lavoro riservati vengono attribuiti all'agenzia che li ha presentati.** Un annuncio con datore di lavoro celato viene registrato come `?` nel tracker, con il recruiter nella colonna `Via`. `#/tracker` mostrava un `?` nudo, così più righe riservate erano indistinguibili e il risolutore dei loghi non aveva nulla su cui agganciarsi. Ora una riga simile si legge **«Riservato · tramite \<agenzia\>»**, risolve il logo dal nome dell'agenzia ed è rintracciabile con quel nome nella ricerca. Solo presentazione — il campo canonico `company` non viene mai sovrascritto con il recruiter. Nuovo modulo puro `public/js/lib/company-presentation.js`, specchio del `company-presentation.mjs` del padre.

### Corretto
- **Jobstreet/SEEK chiamava un endpoint deprecato.** La sorgente puntava ancora a chalice-search v4 (`/api/chalice-search/v4/search`), che SEEK ha ritirato; il padre è migrato a `/api/jobsearch/v5/search` e web-ui non ha mai seguito. Ora ogni voce Jobstreet/SEEK interroga v5. La forma dell'item v5 è letta nativamente (URL costruita da `id`, `locations[0].label`, `advertiser.description`, `salaryLabel`), il parametro di proiezione `solrFields` proprio della v4 sparisce, e una voce il cui `portals.yml` fissi ancora il percorso v4 morto conserva l'hostname del suo mercato mentre il percorso viene ricostruito su v5 — senza modifiche da parte dell'utente.

### Note
- Parità con career-ops 1.30.0 (HEAD del padre `8d64f65` → `6cc46a4`; il suo `VERSION` segna ancora 1.30.0 — release-please è indietro rispetto a `main`). Non portato, con motivazioni: **riempimento della località da JSON-LD in iCIMS** — la sorgente iCIMS di web-ui non ha alcun hook `enrichDate()` (solo pagine di elenco), quindi non c'è alcun percorso da correggere; **stderr CLI non fatale (#1974)** — il runner di web-ui decide il fallimento solo dal codice di uscita e non ha mai avuto quell'euristica; **tracciamento dei percorsi Turbopack** — web-ui non ha bundler; **correzioni `cv-sync-check`** — rilanciate in sola lettura e fail-soft; **sequenzializzazione di Playwright in `scan.mjs`, risposte Block H, guardie updater/doctor/`update-system`, il controllo di sintassi ricorsivo, la dashboard in Go e le auto-verifiche aggiunte a `jd-skill-gap`/`verify-cv-facts`** — superfici solo-CLI che web-ui non invoca, o auto-test senza cambi di comportamento. Suite di test: **2818 → 2837**.

## [1.226.0] — 2026-08-27

**Aggiunto — due sorgenti di lavoro vietnamite: ITviec e CareerViet.**

### Aggiunto
- **ITviec + CareerViet (Vietnam).** Due board vietnamite con host fissato si uniscono allo scanner tramite voci `provider: itviec` / `provider: careerviet`: **ITviec** (itviec.com, tech) e **CareerViet** (careerviet.vn, ampia copertura). Entrambi sono scraper HTML senza token, con host-pin anti-SSRF, solo-HTTPS, fail-soft per azienda e limiti di pagina. Il registro ora conta **85 sorgenti** (80 EN + 5 RU), `ALL_ADAPTERS` **80** — entrambi compaiono nel filtro Sorgente di `#/scan`.

### Note
- Parità con career-ops 1.30.0 (parentVersion 1.29.0 → 1.30.0). Non portato (solo CLI/community o già coperto): la Hired Wall, `/calibrate`, clean-markers, pacchetti di template, doctor, pdf/LaTeX e le CLI eval/tracker/scan che web-ui non invoca; il fix `_html-to-text` e `roleFuzzyMatch` c'erano già; il prefisso `title-filter stem:` è rimandato. Suite di test: **2818**.

## [1.225.1] — 2026-08-27

**Corretto — il banner dei loghi dei provider ora compare nel README e nella guida.**

### Corretto
- Il banner della v1.225.0 non compariva su GitHub: il file `images/providers.svg` autonomo aveva un `font-family` non valido (virgolette doppie annidate) che GitHub rifiuta, l'`<img>` usava un `src` relativo (l'HTML `<img>` non risolve percorsi relativi su GitHub) e al blocco `<p>` mancava una riga vuota finale. Ora punta a un `images/providers.png` renderizzato tramite URL assoluto, con separazione a righe vuote; anche l'SVG è corretto in XML valido.

### Note
- Solo docs; nessun cambiamento di codice o test. La vetrina di cvstart.org e i riquadri dell'app erano già corretti (SVG inline, non questo file).  **2784**

## [1.225.0] — 2026-08-27

**Aggiunto — un banner dei loghi dei provider nel README e nella guida.**

### Aggiunto
- **Banner dei loghi dei provider.** Un unico `images/providers.svg` autonomo — i **18 provider LLM**, con il **logo reale del brand** ([simple-icons](https://simpleicons.org), CC0) per gli 11 che ne pubblicano uno e un monogramma con il colore del brand per i 7 restanti — apre ora il README (×17) e la guida in-app. (L'app disegna da sé i riquadri con il logo reale; il banner è reso su GitHub e rimosso nell'app dal renderer sicuro per l'XSS.)

### Note
- Solo docs — nessun cambiamento di codice o test; l'SVG è inline (nessuna risorsa remota). Sorgenti di scansione invariate: **83**. Suite di test: **2784**.

## [1.224.0] — 2026-08-26

**Modificato — i riquadri dei provider LLM ora mostrano i loghi reali dei brand.**

### Modificato
- **Loghi reali dei provider.** I riquadri del provider — campi chiave API nelle Impostazioni, le righe di Utilizzo, il chip della dashboard, il riepilogo "Attivo" delle Impostazioni, il risultato della ⚡ eval e il banner di benvenuto — ora mostrano il **logo reale del brand** per gli 11 provider che pubblicano un'icona open source (Anthropic · Gemini · OpenAI · Qwen · OpenRouter · GitHub · DeepSeek · Kimi · MiniMax · Mistral · Ollama; SVG a percorso singolo da [simple-icons](https://simpleicons.org), CC0). I 7 senza icona pubblicata (Hermes · GLM/Z.ai · Grok · Together · Fireworks · BytePlus Ark · Volcengine Ark) mantengono il monogramma con il colore del brand. Sempre **sicuro per la CSP per costruzione**: il percorso del logo è una costante statica incorporata — nessuna risorsa remota, nessun `innerHTML`.

### Note
- Nessun cambiamento di rotta o comportamento; la stessa API `ProviderLogo.el(slug)`. `provider-logo.js` è cresciuto (i percorsi dei loghi incorporati). Sorgenti di scansione invariate: **83**. Suite di test: **2784**.

## [1.223.0] — 2026-08-26

**Corretto — una valutazione ⚡ live riuscita veniva colorata come errore; inoltre installa il coworker OpenWorker direttamente dal suo URL GitHub o .zip.**

### Corretto
- **Tinta del badge di risultato della ⚡ eval.** Una valutazione live riuscita non è più colorata come fallimento. I provider in-process (OpenRouter, DeepSeek, …) non restituiscono un `code` di sottoprocesso, quindi lo stretto `code === 0` era falso e ogni successo appariva **rosso** (pur mostrando "exit 0"). La tinta ora segue l'esito — solo un sottoprocesso che esce con codice diverso da 0 lo colora di rosso; un risultato live senza codice è `badge-ok`, e il suffisso "· exit N" appare solo con un vero codice di uscita.

### Modificato
- **Installa il [coworker OpenWorker](https://github.com/Fighter90/career-ops-coworker) dal suo URL GitHub / .zip.** La documentazione del coworker ora descrive l'installer a un comando (`curl … | bash`, idempotente — riusa un career-ops / web-ui esistente) e i tre percorsi di installazione in OpenWorker (URL GitHub · `.zip` · import di un singolo file) in `docs/integrations/openworker.md`, la guida in-app §32 (×17) e il README.

### Note
- Chiusa una vecchia lacuna di copertura: la sorgente Recruitee ora ha un test end-to-end del fix dell'angolo tra virgolette di v1.214.2 (un `>` dentro un attributo di tag non deve trapelare nella descrizione). Sorgenti di scansione invariate: **83**. Suite di test: **2783**.

## [1.222.0] — 2026-08-26

**Modificato — i suggerimenti dei campi dei provider estesi (DeepSeek … Volcengine Ark) sono ora localizzati in tutte le 17 lingue.**

### Modificato
- **Suggerimenti dei campi dei provider localizzati.** Ogni `config.<slug>Hint` degli 11 provider compatibili con OpenAI aggiunti in v1.216.0–v1.217.0 (DeepSeek · GLM/Z.ai · Kimi · MiniMax · Mistral · Grok · Together · Fireworks · Ollama · BytePlus Ark · Volcengine Ark) — i suggerimenti di chiave API, modello e URL base in **Impostazioni → Chiavi API** — è ora tradotto in tutte le 17 lingue anziché ripiegare sull'inglese. URL di registrazione, id dei modelli e il marcatore ⚡ della valutazione live sono conservati alla lettera.

### Note
- Nessun cambiamento di comportamento — il `hintFallback` inglese in `field-specs.js` protegge ancora una chiave mancante, e un nuovo test di contratto verifica che ogni `hintKey` dei descrittori di campo si risolva in tutte le 17 lingue. Fonti di scansione invariate: **83**. Suite di test: **2779**.

## [1.221.0] — 2026-08-26

**Sicurezza — difesa in profondità contro il DNS-rebinding sul percorso di fetch dello scanner.**

### Sicurezza
- Il core HTTP dello scanner (`fetchJson` / `fetchText` in `server/lib/http-json.mjs`) ora risolve l’host di ogni sorgente sul percorso di rete reale e **rifiuta di connettersi se si risolve a un indirizzo privato, loopback, link-local, CGNAT o di metadati cloud** — chiudendo un vettore di DNS-rebinding. Gli host dello scanner sono già ancorati a domini pubblici, quindi è difesa in profondità; il percorso degli URL utente aveva già un ancoraggio di connessione più forte (`safe-fetch.mjs`). La guardia gira **solo** sul trasporto `fetch` reale — un `fetchImpl` di test iniettato non viene mai risolto.

### Note
- Nessun cambio di comportamento per una scansione sana. Fonti di scansione invariate: **83**. Test: **2775**.

## [1.220.0] — 2026-08-26

**Aggiunto — scansiona più categorie di Get on Board da una sola voce.**

### Aggiunto
- Una voce `getonbrd` può ora impostare `categories: [programming, operations-management, machine-learning-ai]` (o un singolo `category:`) invece del solo feed `programming`; gli annunci sono deduplicati per URL tra le categorie, con un limite di 12. Le voci esistenti restano identiche (il default resta `programming`).

### Note
- Solo server; l’host-pin SSRF (www.getonbrd.com) e `redirect:'error'` sono invariati, e uno slug di categoria non valido viene rifiutato prima di qualsiasi richiesta. Fonti di scansione invariate: **83**. Test: **2771**.

## [1.219.0] — 2026-08-26

**Aggiunto — Torre entra nello scanner e ora ogni etichetta di provider è corretta.**

### Aggiunto
- **Torre** (`provider: torre`) — il marketplace di talenti pan-latinoamericano di torre.ai, una ricerca pubblica senza autenticazione con ruoli remoti che non arrivano a Greenhouse/Lever/Ashby; una richiesta limitata per voce. Il registro conta ora **83** sorgenti (78 inglesi + 5 russe). Inoltre, monogramma del provider attivo nel banner di benvenuto.

### Corretto
- La scansione a16z Speedrun si fermava troppo presto su una board che ruota (una pagina corta a metà passata veniva presa per l’ultima, troncando a 149 di ~300); ora si fida del `total_pages` del feed. E il banner di benvenuto risolveva il provider da una mappa di 4 voci (mostrando lo slug grezzo per gli altri 14) — ora usa etichetta+monogramma dei 18; la nota provider nelle Impostazioni passa da 7 a 18.

### Note
- La nuova opzione multi-categoria per voce di Get on Board non è ancora collegata qui (richiede un refactor a livello di sorgente). Test: **2768**.

## [1.218.0] — 2026-08-26

**Aggiunto — badge dei provider (e nomi corretti) ovunque venga mostrato un provider.**

### Aggiunto
- Monogrammi dei provider sul chip della dashboard, nel riepilogo "Attivo" delle Impostazioni e nell’intestazione del risultato della ⚡ valutazione.

### Corretto
- Etichette obsolete: tre schermate risolvevano il nome da una mappa di 5 voci (il risultato della valutazione etichettava come "Gemini" ogni provider non-Anthropic); ora usano `ProviderStatus.label` (18). Il conteggio delle chiavi mostrava "/ 7" → 18. L’elenco di slug del suggerimento `LLM_PROVIDER` ha aggiunto `ark` / `arkcn` in tutte le 17 lingue.

### Note
- Solo client, sicuro per la CSP. Nessuna modifica al server. Fonti di scansione: **82**. Test: **2758**.

## [1.217.1] — 2026-08-26

**Rafforzamento dei test — copertura degli endpoint per l’intero catalogo di provider.**

### Aggiunto
- Un test `run<Provider>` parametrizzato che verifica endpoint, modello predefinito e autenticazione Bearer per **Kimi, MiniMax, Mistral e Fireworks**.

## [1.217.0] — 2026-08-26

**Aggiunto — Ark si aggiunge all’elenco LLM (18 provider).** BytePlus Ark e Volcengine Ark — i modelli Doubao di ByteDance — sono ora provider ⚡ dal vivo, con lo stesso core compatibile con OpenAI e un URL di base per regione.

### Aggiunto
- **BytePlus Ark** (`ARK_API_KEY`, internazionale) e **Volcengine Ark** (`ARK_CN_API_KEY`, Cina) — Chat Completions compatibile con OpenAI via `runOpenAICompatible()`. Imposta `ARK_MODEL` / `ARK_CN_MODEL` (un nome di modello Doubao o il tuo id endpoint `ep-…`); `ARK_BASE_URL` / `ARK_CN_BASE_URL` cambiano regione. Entrambi si uniscono all’ordine `auto` (per ultimi), con il monogramma nelle Impostazioni e in Utilizzo. L’interfaccia web copre ora **18 provider** dal vivo.

### Note
- Stesso percorso di configurazione attendibile + controllo schema http(s) del resto (mai il validatore SSRF degli URL di lavoro). Fonti di scansione invariate: **82**. Test: **2755**.

## [1.216.0] — 2026-08-26

**Aggiunto — altri nove provider LLM, ciascuno con la propria targhetta di marca.** Le tue valutazioni ⚡ dal vivo possono ora usare DeepSeek, GLM (Z.ai), Kimi (Moonshot), MiniMax, Mistral, Grok (xAI), Together, Fireworks o un Ollama completamente locale — a una chiave di distanza, ciascuno segnato da un monogramma accanto al suo campo nelle Impostazioni.

### Aggiunto
- **Nove provider compatibili con OpenAI.** DeepSeek, GLM (Z.ai), Kimi (Moonshot), MiniMax, Mistral, Grok (xAI), Together AI, Fireworks AI e **Ollama** (completamente locale, senza chiave). Imposta una chiave — o `OLLAMA_BASE_URL` per Ollama — nelle **Impostazioni** e si unisce all’ordine `auto` dopo Hermes; fissane uno con `LLM_PROVIDER`. Together ospita anche **Inkling** di Thinking Machines (`thinkingmachines/Inkling`). L’interfaccia web copre ora **16 provider** dal vivo.
- **Monogrammi dei provider.** Una piastrella con l’iniziale nel colore del marchio, sicura per la CSP, segna ogni provider accanto al suo campo chiave nelle Impostazioni e nella sua riga della pagina Utilizzo — SVG inline, nessun logo esterno, nulla lascia il tuo dispositivo.

### Note
- Gli URL di base dei provider sono configurazione attendibile che passa per `runOpenAICompatible()` con un controllo dello schema http(s) (il loopback di Ollama è consentito), mai il validatore SSRF degli URL di lavoro. Fonti di scansione invariate: **82**. Test: **2752**.

## [1.215.0] — 2026-08-26

**Aggiunto — esegui tutta la tua ricerca di lavoro da OpenWorker.** Un nuovo coworker guida questa pipeline dall'app di coworker IA open source di Andrew Ng, e la guida in-app ora lo copre così l'assistente Chiedi ai docs può accompagnarti.

### Aggiunto
- **Coworker OpenWorker.** Un coworker senza codice di [OpenWorker](https://github.com/andrewyng/openworker) — [Fighter90/career-ops-coworker](https://github.com/Fighter90/career-ops-coworker) — esegue tutta la ricerca di lavoro (scansione, punteggio, adattamento, tracciamento, follow-up) e può **avviare questa dashboard**, tutto dal tuo desktop. È una persona in un solo file distribuita in 17 lingue, verificata installabile con il loader di OpenWorker stesso.
- **Guida §32 "Run it from OpenWorker"** (tutte le 17 lingue) lo documenta, così l'assistente in-app **Chiedi ai docs** e il pulsante di aiuto fluttuante possono rispondere. Collegato anche dal footer della landing, dal README, dalla wiki e da `docs/integrations/openworker.md`.

### Note
- Solo docs + sito — nessuna modifica al codice dell'app. Fonti di scansione invariate a **82**. Suite di test: **2742**.



## [1.214.2] — 2026-08-25

**Corretto — la pipeline HTML→testo condivisa (descrizioni Greenhouse / Recruitee) non fa più trapelare attributi di tag nella descrizione quando un valore di attributo contiene un carattere `>`.**

### Corretto
- **Le descrizioni HTML con `>` dentro un attributo vengono ripulite correttamente.** Il rimuovi-tag dietro le descrizioni Greenhouse e Recruitee usava un match ingenuo che si fermava al primo `>`, così un tag come `<a title="salary > 100k">` lasciava il testo di attributo finale (`100k">`) nella descrizione. Ora rispetta i valori di attributo tra virgolette (singole o doppie), rimuove il markup *prima* di decodificare le entità (così una virgoletta codificata dentro un attributo non diventa un falso delimitatore), e preserva ancora un `<>` letterale in testo semplice.

### Note
- Suite di test: **2742**. Fonti di scansione invariate a **82**. Nient'altro di nuovo dal padre stavolta: le altre modifiche sono ritrasmesse in sola lettura (i fix follow-up / weekly-digest / rejection-latency / salary-gap non richiedono modifiche a web-ui) o non sono superfici web-ui (un plugin esterno X/Xquik BYO-key, fix CLI/verify). Le voci opzionali — descrizioni di dettaglio SmartRecruiters, salto aggregatori in detect-reposts, prefissi di titolo `stem:` / `word:`, irrobustimento anti-DNS-rebinding — restano in coda.



## [1.214.1] — 2026-08-25

**Corretto — le descrizioni Ashby sono ora limitate alla stessa lunghezza di Greenhouse e Recruitee, così un filtro di contenuto si comporta identico sulle tre board e una board non può gonfiare la cache di scansione.**

### Corretto
- **Le descrizioni Ashby ora rispettano lo stesso limite di lunghezza delle altre board.** La v1.214.0 alimentava il corpo dell'annuncio Ashby al filtro di contenuto, ma — a differenza di Greenhouse e Recruitee, che limitano a 4000 caratteri — quello di Ashby era mappato diretto senza limite (alcuni 4× più lunghi). Così la stessa parola di `content_filter` poteva corrispondere su Ashby ma non su Greenhouse solo in base a dove cadeva nel testo, e una board poteva aggiungere centinaia di KB alla cache di scansione caricata da `#/scan`. Ashby è ora limitato agli stessi 4000 caratteri (il suo testo è già in chiaro, quindi viene troncato, mai ripulito dai tag).

### Note
- Suite di test: **2738**. Fonti di scansione invariate a **82**.



## [1.214.0] — 2026-08-25

**Corretto — le descrizioni di Greenhouse, Ashby e Recruitee ora alimentano il filtro di contenuto, così i filtri parole / paese / visto corrispondono davvero a quelle board; e "Associate <titolo senior>" (inclusi i ranghi accademici) non è più classificato erroneamente come entry-level.**

### Corretto
- **I filtri di contenuto ora funzionano su Greenhouse, Ashby e Recruitee.** Queste board portano ora il testo completo di ogni annuncio come sua descrizione, così un `content_filter` (o un filtro parole paese / visto) corrisponde al corpo dell'offerta invece di lasciar passare la board alla cieca. Ashby e Recruitee forniscono il corpo nel payload di lista gratis; Greenhouse lo faceva già. Tutte e tre passano per un'unica pipeline HTML→testo condivisa.
- **"Associate Director" / "Associate Professor" è senior, non entry-level.** Il classificatore di seniority (usato da `skip_tiers:`) trattava la parola "associate" come marcatore entry-level anche quando prefissa un titolo senior. Ora legge "Associate <sostantivo senior>" — inclusi i ranghi accademici (Associate Professor, Associate Dean) — come senior, mantenendo le vere varianti junior (Associate Attorney, Associate Editor) come entry-level, e classifica ancora un "Intern, Associate Dean" iniziale come tirocinio.

### Note
- Suite di test: **2736**. Fonti di scansione invariate a **82**. In coda per dopo: arricchimento opzionale delle descrizioni SmartRecruiters (una richiesta di dettaglio per annuncio), il salto delle board `aggregator: true` di detect-reposts e i prefissi di titolo a parola ancorata `stem:` / `word:` — ciascuno una configurazione opzionale, non un cambio di comportamento predefinito. L'irrobustimento anti-DNS-rebinding resta in coda per la sua release di sicurezza dedicata.



## [1.213.0] — 2026-08-22

**Aggiunto — MyCareersFuture, la banca del lavoro nazionale di Singapore, come fonte di scansione. Corretto — le offerte Greenhouse ora portano il testo completo perché i filtri di contenuto funzionino, e le offerte Ashby da remoto non restano più nascoste dietro una sede solo-città.**

### Aggiunto
- **MyCareersFuture (Singapore)** (mycareersfuture.gov.sg) — una nuova fonte di scansione senza token per la banca del lavoro pubblica nazionale di Singapore, gestita da Workforce Singapore. Selezionala nel filtro **Fonte** in `#/scan`, o aggiungi un'azienda con `provider: mycareersfuture` e una lista `keywords` facoltativa (altrimenti usa i ruoli target del tuo profilo, come Job Bank). Legge l'API di ricerca pubblica, con host fissato, senza chiave.

### Corretto
- **Le offerte Greenhouse ora sono filtrabili per contenuto.** Le board Greenhouse vengono recuperate con il corpo completo dell'annuncio, decodificato in testo semplice come descrizione — così un `content_filter` (o un filtro per parole paese/visto) che legge la descrizione ora corrisponde davvero alle offerte Greenhouse invece di lasciarle passare alla cieca.
- **Le offerte Ashby da remoto non vengono più scartate da un filtro città.** Ashby tiene il modello di lavoro (Remote/Hybrid/Onsite) separato dalla città dell'ufficio, quindi un ruolo totalmente da remoto si leggeva ancora come es. "San Francisco" — e un filtro sede che blocca quella città nascondeva un ruolo accettabile. Ora "Remote" viene aggiunto alla sede quando il ruolo è da remoto, e `workplaceType` vince su un `isRemote` obsoleto per non etichettare male un ruolo ibrido ancorato all'ufficio.

### Note
- Fonti di scansione: **82** (77 inglesi + 5 russe). Suite di test: **2724**. Un irrobustimento anti-DNS-rebinding (validare l'indirizzo risolto di un host prima di connettersi) è in coda per una release dedicata — richiede un design proprio di web-ui, non un port diretto.



## [1.212.1] — 2026-08-21

**Corretto — la landing di cvstart.org contava per difetto le fonti di lavoro dello scanner (mostrava 80 e ometteva Job Bank (Canada)); ora torna a combaciare con le 81 dell'app, e la build del sito fallisce rumorosamente se le due divergono.**

### Corretto
- **Il conteggio "Fonti di lavoro" della landing è di nuovo sincronizzato con l'app.** Dopo la v1.212.0, cvstart.org mostrava **80** board e mancava il nuovo chip **Job Bank (Canada)**, mentre app, menu a tendina di scansione e guida elencavano tutti **81**. La landing costruisce l'elenco caricando il registro live dello scanner, e una fonte non si è caricata in quella build per come importava una dipendenza YAML — quindi è stata scartata in silenzio. Ora Job Bank carica quella dipendenza in modo pigro, come fa il resto dell'app al momento della scansione, così compare sempre.
- **La build del sito ora rifiuta di pubblicare un conteggio di fonti incoerente.** Se il registro enumera meno fonti di quante esistano su disco (la firma di una fonte non caricata), la build fallisce con un messaggio chiaro invece di pubblicare in silenzio il numero sbagliato.

### Note
- Il comportamento dell'app è invariato — lo scanner ha sempre avuto tutte le 81 fonti; solo la landing era interessata. Fonti di scansione: **81** (76 inglesi + 5 russe) — invariato. Suite di test: **2687**.



## [1.212.0] — 2026-08-21

**Aggiunto — Job Bank (Canada), la job board nazionale federale. Rimosso — EchoJobs (il suo feed è ora bloccato da anti-bot). Corretto — le board Consider restituiscono di nuovo risultati e le offerte Lever multi-sede non nascondono più metà delle loro sedi.**

### Aggiunto
- **Job Bank (Canada)** (jobbank.gc.ca) — una nuova fonte di scansione senza token per il servizio nazionale federale per l'impiego del Canada, una board ad alto volume che nessun aggregatore copre bene. Selezionala nel filtro **Fonte** in `#/scan`, o aggiungi un'azienda con `provider: jobbankca` e una lista `keywords` facoltativa (altrimenti usa i ruoli target del tuo profilo). Legge il feed ATOM pubblico, con host fissato, senza chiave.

### Rimosso
- **EchoJobs** — ritirata. Il suo feed pubblico è ora dietro protezione anti-bot e non restituisce nulla, quindi tenerla sprecava solo uno slot di scansione.

### Corretto
- **Le board Consider restituiscono di nuovo risultati.** Consider ora richiede un handshake anonimo (una GET che semina un cookie di sessione + token CSRF) prima di accettare la ricerca; senza, la richiesta veniva rifiutata in silenzio e la board sembrava vuota.
- **Le offerte Lever multi-sede non nascondono più metà delle loro sedi.** Lever mette una città primaria in `location` e il resto in `allLocations`; leggere solo la primaria faceva sembrare un'offerta aperta a Barcellona E Montevideo come solo-Barcellona (e la faceva scartare per errore da un filtro di sede). Ora entrambe vengono unite.

### Note
- Ritmo tra pagine più delicato (250 ms, da 150) sulle board paginate, per cortesia verso i siti carriera single-host. Fonti di scansione: **81** (76 inglesi + 5 russe) — invariato (Job Bank entra, EchoJobs esce). Suite di test: **2685**.



## [1.211.0] — 2026-08-19

**Aggiunto — Yourator, job board tech taiwanese. Corretto — le entità accentate di titolo/azienda ora si decodificano ovunque, e un'azienda con un accento nel nome non viene più segnalata per errore.**

### Aggiunto
- **Yourator** (yourator.co) — una nuova fonte di scansione senza token per il mercato del lavoro tech e digitale di Taiwan. Selezionala nel filtro **Fonte** in `#/scan`, o aggiungi un'azienda con `provider: yourator`. Legge l'API JSON pubblica (nessuna chiave, nessun browser), percorre ogni pagina della board ed emette il vero link del datore di lavoro di ogni annuncio (il suo ATS) con i parametri di tracciamento rimossi.

### Corretto
- **Le entità con nome accentato ora si decodificano ovunque.** Il decoder HTML condiviso ha acquisito le lettere Latin-1 (`&eacute;` → é, `&ccedil;` → ç, …), quindi una board europea che scrive `D&eacute;veloppeur` o `Fran&ccedil;ais` non lascia più quel letterale in un titolo, nel tracker o in un documento generato. (Le maiuscole restano maiuscole — `&Eacute;` è É, non é — e una ricerca come `&constructor;` ora si risolve in se stessa.)
- **Un'azienda con un accento nel nome non viene più segnalata per errore** per essere sul proprio dominio. "Işık" ora si ripiega in "isik" e corrisponde a isik.com.tr; "Société Générale" corrisponde a societegenerale.com. Il vecchio controllo cancellava le lettere accentate invece di ripiegarle sulla loro base ASCII.

### Note
- Fonti di scansione: **81** (76 inglesi + 5 russe). Suite di test: **2667**.



## [1.210.1] — 2026-08-19

**Corretto — i titoli degli annunci e i nomi azienda di Habr Career con "&" o virgolette non arrivano più corrotti.**

### Corretto
- La fonte Habr Career ora decodifica le entità HTML nel **titolo** e nel **nome azienda** prima che proseguano. Le card renderizzate lato server arrivano con entità ("Changellenge &gt;&gt;", "Demand Forecasting &amp; Inventory Optimization", "ООО &quot;М-ТЕХ&quot;"), quindi una "&" non decodificata falliva in silenzio il tuo stesso filtro del titolo con "&" — lo stesso sintomo che la release precedente ha chiuso su altre cinque board — e i nomi azienda arrivavano corrotti al tracker e ai report. La decodifica delle entità è ora completa su tutte e sei le fonti interessate.

### Note
- Suite di test: **2644**.



## [1.210.0] — 2026-08-19

**Aggiunto — Senjob, la prima job board africana dello scanner (Senegal); corrispondenza dei titoli più precisa su altre cinque board.**

### Aggiunto
- **Senjob** (senjob.com) — una nuova fonte di scansione senza token per il Senegal, la prima board africana dello scanner. Selezionala nel filtro **Fonte** in `#/scan`, o aggiungi un'azienda con `provider: senjob`. Legge l'elenco pubblico via HTTP semplice (nessuna chiave, nessun browser), fissa ogni richiesta a senjob.com e — analizzando HTML — tratta un elenco che di colpo non restituisce nulla come una board rotta (un errore visibile) anziché un paese senza offerte.

### Corretto
- **I titoli con "&" non fanno più cadere offerte su cinque board** — su beesite, Cornerstone (csod), Hacker News "Who is hiring", Phenom e TKMS i titoli arrivano con entità HTML, quindi una "&" con escape in un ruolo come "R&D Engineer" falliva la tua stessa parola chiave "r&d" e l'offerta spariva in silenzio (nemmeno un veto "sales & marketing" scattava). Ora i titoli — e le località di Phenom — vengono decodificati prima del filtro.

### Note
- Fonti di scansione: **80** (75 inglesi + 5 russe). Suite di test: **2643**.



## [1.209.0] — 2026-08-17

**Aggiunto — la guida nell'app ora copre come registrare l'esito di una candidatura, e «Chiedi alla guida» può portarti lì.**

### Aggiunto
- La guida del Tracker (§11) ha guadagnato una sezione «Registrare un esito» in tutte le 17 lingue, che illustra il pulsante **Esito**: scegli cos'è successo (rifiutato / offerta / assunto / rifiutata / ghostato / passato al colloquio), visualizza l'anteprima di cosa farà, poi registra — il che annota il risultato, archivia il CV e la lettera che hai inviato e sincronizza lo Stato della riga per te. L'assistente fluttuante «Chiedi alla guida» legge la guida, quindi ora ti indirizza a quel pulsante invece di suggerirti solo di modificare lo Stato a mano.

### Note
- Ogni bundle della guida ora è 31 H2 / 119 H3 (era 118); le guardie di parità sono state alzate. Solo documentazione — nessuna modifica al codice o al comportamento. Suite: **2625**.



## [1.208.2] — 2026-08-16

**Corretto — su un telefono i pulsanti di notifiche e tema non stanno più sopra il campo di ricerca.**

### Corretto
- La v1.208.1 ha impedito ai pulsanti della barra superiore di sovrapporsi al titolo della pagina, ma su un telefono stretto — pur non essendo il più stretto — e soprattutto nelle lingue con etichette più lunghe, l'intera barra si stipava ancora in una sola riga, così i pulsanti 🔔 e 🌙 potevano finire sopra il campo di ricerca. Ora i pulsanti d'azione (notifiche, tema, Diagnostica, Apri Scan) scendono sempre su una loro seconda riga a tutta larghezza sul telefono, così il campo di ricerca resta pienamente leggibile e niente si sovrappone.

### Note
- Sul telefono i pulsanti d'azione della barra passano a una seconda riga a tutta larghezza, eliminando la fragile fascia di "riga quasi piena" in cui il layout distribuiva lo spazio negativo residuo come sovrapposizione. Un guard di Playwright riproduce ora il trigger esatto — una lingua con etichette lunghe nella fascia 565–640px — e verifica che i controlli della barra non condividano mai pixel. Suite: **2621**.



## [1.208.1] — 2026-08-16

**Corretto — su un telefono i pulsanti della barra superiore non si sovrappongono più alla pagina.**

### Corretto
- La v1.208.0 mandava i pulsanti della barra superiore (Diagnostica, Apri Scan, notifiche, tema) su una seconda riga sugli schermi stretti, ma la barra manteneva un'altezza fissa, così la riga a capo debordava e si posava sul titolo della pagina. Ora la barra **cresce** per accogliere le sue righe e il contenuto scorre sotto.

### Note
- L'`height` fissa della barra è diventata una `min-height`, così cresce con il contenuto a qualsiasi larghezza (il desktop è invariato). Un guard di Playwright verifica ora anche che la barra non debordi sulla pagina. Suite: **2621**.



## [1.208.0] — 2026-08-16

**Corretto — l'app ora sta nello schermo di un telefono: niente più scorrimento laterale.**

### Corretto
- Su uno schermo stretto l'intera app scivolava di lato — la barra superiore, le tabelle, gli articoli di aiuto e le schede delle impostazioni sforavano il bordo destro. Ora ogni pagina sta in qualsiasi larghezza: i pulsanti della barra superiore vanno a capo su una seconda riga, tabelle e blocchi di codice larghi scorrono nel proprio riquadro, l'aiuto impila l'indice sopra l'articolo, le righe di pulsanti/schede vanno a capo, e percorsi o URL lunghi si spezzano invece di allungare la pagina.

### Note
- La causa era la classica trappola **min-width: auto** di flex/grid più un paio di elementi larghi non incapsulati; risolto con `min-width: 0` sugli elementi della griglia, `overflow-wrap` su markdown/titoli, una tabella markdown scorrevole e l'impilamento della griglia di aiuto al breakpoint mobile. Un guard Playwright verifica **0 overflow orizzontale a 375 px** sulle rotte principali. `tests/playwright-smoke.mjs`. Suite: **2621**.



## [1.207.2] — 2026-08-16

**Corretto — i piani IA e i profili di orientamento non vengono più mostrati come un dump di codice grezzo.**

### Corretto
- Alcuni modelli avvolgono l'intera risposta in un recinto di codice ```markdown … ```. Quando accadeva, il **piano di sviluppo** e il **profilo di orientamento** apparivano come un blocco di codice a spaziatura fissa invece di un documento con titoli ed elenchi. Ora il recinto avvolgente viene rimosso — solo quando avvolge l'intera risposta e il linguaggio è esplicitamente `markdown`/`md`, così una vera risposta in `python`/`js`/``` senza linguaggio resta intatta.

### Note
- Gestito una volta sola nel passo condiviso di pulizia LLM (`cleanLlmMarkdown`), così ne beneficiano tutte le route IA e i blocchi di codice interni alla risposta avvolta sopravvivono. `tests/llm-output.test.mjs` (+3). Suite: **2621**.



## [1.207.1] — 2026-08-16

**Corretto — la landing page non deborda più di lato sui telefoni piccoli.**

### Corretto
- Su un telefono stretto l'hero — il titolo, la riga introduttiva e il terminale di installazione — poteva essere tagliato sul bordo destro perché un comando di installazione lungo e le colonne del layout non si restringevano allo schermo. Ora stanno in qualsiasi larghezza; il comando di installazione scorre dentro il proprio terminale.

### Note
- È stato inoltre irrobustito un controllo E2E instabile che poteva fallire per un 404 transitorio di una risorsa: ora ignora il rumore di rete benigno (favicon / connessione / risorsa fallita) come i controlli vicini, pur continuando a rilevare veri errori di script. Nessun cambiamento nel comportamento dell’app. Suite: **2618**.



## [1.207.0] — 2026-08-15

**Aggiunto — registra l'esito di una candidatura direttamente dal tracker.**

### Aggiunto
- Ogni riga del tracker ottiene un'azione **Esito**: scegli cosa è successo (rifiutato, offerta ricevuta, assunto, offerta rifiutata, nessuna risposta, passato al colloquio), aggiungi una nota facoltativa, **visualizza in anteprima** lo stato risultante e registralo. La registrazione archivia gli artefatti del CV e della lettera inviati e sincronizza il tracker allo stato canonico — un'azione deterministica invece della modifica manuale.

### Note
- Nuova `POST /api/outcome` che inoltra la CLI degli esiti: `dryRun:true` è un'anteprima in sola lettura (individua la riga, riporta lo stato risultante, non scrive nulla); una chiamata reale lo registra. Sicurezza in scrittura: il tipo di esito è limitato all'insieme noto e ogni campo di testo viene rifiutato se contiene caratteri di controllo prima della chiamata (argomenti come array, spawn — nessuna shell). `tests/outcome-route.test.mjs`. Suite: **2618**.



## [1.206.0] — 2026-08-15

**Documentazione — la guida in-app ora copre le cinque funzionalità più recenti, in tutte e 17 le lingue.**

### Aggiunto
- La guida in-app — e l'assistente «Chiedi alla guida» che risponde basandosi su di essa — ora documenta cinque funzionalità aggiunte di recente: **Doctor di configurazione** (Impostazioni — controlla CV e profilo per lacune e dati di esempio rimasti), **Scopri board ATS** (Portali — trova automaticamente il portale carriere di un'azienda), il controllo **«ancora aperta?»** (Tracciamento — se un annuncio è ancora aperto), il suggerimento **«riusare un CV precedente?»** (CV Studio — segnala quando un CV già adattato va bene per un nuovo annuncio) e il **Registro competenze** (Analisi — registrare punteggi di autovalutazione). Cinque nuove sottosezioni, tradotte in tutte e 17 le lingue.

### Note
- La struttura della guida cresce a 31 H2 / 118 H3, con parità garantita in ogni lingua. Documentazione di riferimento aggiornata: `docs/architecture/API.md` documenta le cinque route di queste funzionalità, e i contatori di route/versione in `CLAUDE.md` e `docs/sdd/CONVENTIONS.md` sono aggiornati (36 moduli di route). Suite: **2610**.



## [1.205.0] — 2026-08-15

**Aggiunto — un Registro competenze per annotare i risultati di test/valutazioni.**

### Aggiunto
- Un nuovo **Registro competenze** (Analisi → Registro competenze) permette di annotare un'autovalutazione — azienda, piattaforma, competenza, punteggio % e una nota facoltativa — aggiunta a `data/assessments.tsv`, con un elenco delle voci precedenti (più recenti prima). Zero token, deterministico; il formato del file è gestito dalla CLI del progetto padre.

### Note
- Nuova `GET /api/assessments` (inoltra la lista JSON predefinita di `assessment-log.mjs`; fallimento morbido `{available:false}`) + `POST /api/assessments` (scrittura esplicita: campi passati come **argomenti array** a `assessment-log.mjs add`). Sicurezza in scrittura: ogni campo testo con un carattere di controllo viene rifiutato (un TAB romperebbe una colonna, un a-capo inietterebbe una riga) → 400 prima di scrivere; punteggio/soglia limitati a 0–100, lunghezze limitate. `tests/assessments-route.test.mjs`. Suite: **2610**.


## [1.204.0] — 2026-08-15

**Aggiunto — un pannello "Dottore di configurazione" nelle Impostazioni che segnala un CV/profilo incompleto o con dati di esempio.**

### Aggiunto
- **Impostazioni → Dottore di configurazione** ora esegue un controllo a zero token del tuo `cv.md` e `config/profile.yml` ed elenca i **problemi bloccanti** (file/campi mancanti) e gli **avvisi** (dati di esempio residui, metriche fisse) — così cogli una configurazione incompleta prima che indebolisca scansioni e adattamenti. Sola lettura; ri-esegui con un clic.

### Note
- Nuova rotta di sola lettura `GET /api/cv-sync-check` che inoltra `cv-sync-check.mjs` del progetto padre, che stampa testo + un codice di uscita (nessun `--json`); la rotta effettua un parsing leggero delle sue righe stabili `ERROR:` / `WARN:` in `{ok, errors[], warnings[]}` — a decidere il successo è il banner, non il codice di uscita. Fallimento morbido `{available:false}` sulle installazioni autonome. `tests/cv-sync-check-route.test.mjs`. Suite: **2602**.


## [1.203.0] — 2026-08-15

**Aggiunto — un suggerimento "riutilizzare un CV precedente?" in CV Studio.**

### Aggiunto
- Quando apri un annuncio salvato in **CV Studio**, l'app ora lo confronta con i tuoi altri annunci salvati (sovrapposizione di parole deterministica, **zero token**) e ti dice se il più simile basta per **riutilizzare** quel CV su misura, riutilizzarlo **con modifiche** o **prepararne uno nuovo** — così non riparti da zero per un ruolo già mirato.

### Note
- Nuova rotta di sola lettura `GET /api/jds/:name/reuse` che inoltra `jd-similarity.mjs` del progetto padre (sovrapposizione Jaccard + guardia di seniority; JSON `{decision, score, reason}`) una volta per annuncio precedente (fan-out limitato a 25, vince il migliore); fallimento morbido `{available:false}` se mancano lo script o gli annunci precedenti. `tests/jd-similarity-reuse-route.test.mjs`. Suite: **2594**.


## [1.202.0] — 2026-08-15

**Aggiunto — scopri la bacheca ATS di un'azienda da #/portals e inizia a seguirla.**

### Aggiunto
- Su **#/portals**, digita il nome di un'azienda e l'app sonda **Greenhouse, Ashby e Lever** per la sua bacheca pubblica — **zero LLM, nessun browser** — e mostra le bacheche che esistono e listano ≥1 offerta. Un clic aggiunge la bacheca scelta alle aziende monitorate dallo scanner. Il sondaggio è di sola lettura; la scrittura su `portals.yml` avviene solo al clic su **Aggiungi**.

### Note
- Nuovo `server/lib/discover-ats.mjs` (sonda di slug con host fisso e charset validato tramite `safeGet` con DNS fissato, ≤12 sonde/richiesta) + `POST /api/portals/discover` (sola lettura) e `POST /api/portals/track` (scrittura esplicita: `withFileLock` + innesto testuale + guardia di ri-parsing + rinomina atomica; solo host ATS noti, idempotente). Riusa il registro di adattatori dello scanner. i18n ×17. `tests/discover-ats-resolver.test.mjs` + `tests/discover-ats-route.test.mjs`. Suite: **2588**.


## [1.201.0] — 2026-08-15

**Corretto — un tracker con intestazioni di colonna localizzate o varianti non appare più vuoto.**

### Corretto
- Se il tuo `data/applications.md` usa intestazioni non inglesi o varianti — spagnolo `empresa` / `puesto` / `estado` / `fecha` / `enlace`, o `position` / `stage` / `link` — il tracker le leggeva con le chiavi sbagliate e mostrava **colonne Azienda / Ruolo / Stato / Data / Link vuote**. Ora queste intestazioni vengono ripiegate sui nomi di campo canonici e il tracker si visualizza correttamente. Un tracker tutto in inglese viene elaborato come prima.

### Note
- Nuova mappa `HEADER_ALIASES` + una piegatura di normalizzazione in `parseApplications` (`server/lib/parsers.mjs`); intestazioni sconosciute o già canoniche passano invariate. `tests/tracker-header-aliases.test.mjs`. Suite: **2563**.


## [1.200.0] — 2026-08-15

**Aggiunto — un controllo "ancora attiva?" con un clic per gli annunci su ATS nel tuo tracker.**

### Aggiunto
- Su **#/tracker**, una candidatura il cui URL è un annuncio Greenhouse / Lever / Ashby / Workday / SmartRecruiters mostra ora un pulsante **"Ancora attiva?"**. Un clic interroga il JSON pubblico dell'ATS stesso — **zero token, nessun browser** — e mostra **Attiva / Scaduta / Sconosciuta**, per scovare annunci morti senza aprirli uno a uno. Conservativo per scelta: solo un 404/410 netto vale *Scaduta*; ogni ambiguità resta *Sconosciuta* (mai una falsa *Scaduta*).

### Note
- Nuovi `server/lib/liveness-core.mjs` + `liveness-api.mjs` e una rotta di sola lettura `GET /api/liveness?url=` (nessuna scrittura, nessun LLM). Sicuro rispetto a SSRF: l'URL passa per `isValidJobUrl`, poi l'API dell'ATS è raggiunta solo via `safeGet` (DNS fissato) con host fisso e segmenti validati. `tests/liveness-core.test.mjs` + `tests/liveness-route.test.mjs`. Suite: **2557**.


## [1.199.0] — 2026-08-15

**Corretto — le tabelle larghe ora scorrono lateralmente invece di essere tagliate.**

### Corretto
- Nella pagina **Scan** (e in tutte le altre tabelle — Tracker, Statistiche, Utilizzo, Dashboard) una tabella più larga della finestra veniva **tagliata senza barra di scorrimento**, lasciando irraggiungibili le ultime colonne. Ora le tabelle larghe mostrano una **barra di scorrimento orizzontale** quando serve, così ogni colonna resta raggiungibile a qualsiasi larghezza.

### Note
- `.table-wrap` in `public/css/components.css` è passato da `overflow: hidden` a `overflow-x: auto` (come il contenitore `.reports-scroll` esistente); il bordo arrotondato è preservato. `tests/table-wrap-scroll.test.mjs`. Suite: **2540**.


## [1.198.0] — 2026-08-15

**Aggiunto — i ritentativi di scansione ora usano backoff esponenziale, jitter e rispettano il `Retry-After` di un limitatore di frequenza.**

### Aggiunto
- Quando una bacheca di annunci limita la frequenza o fallisce brevemente (HTTP 429 / 5xx) durante una scansione, il ritentativo ora attende con **backoff esponenziale + jitter** invece di un ritardo breve fisso — una bacheca occupata non viene martellata alla stessa cadenza e i ritentativi concorrenti non si ri-scontrano all'unisono. Un `Retry-After` della bacheca viene **rispettato** (ma limitato, così un `Retry-After: 86400` ostile non può bloccare l'intera scansione). Gli errori permanenti (404, redirect rifiutati) falliscono ancora subito — invariato.

### Note
- Nuove `parseRetryAfterMs()` e la pura `computeRetryDelayMs()` in `server/lib/http-json.mjs`; `fetchJson` ora cattura `.retryAfter` su una risposta non-ok e `fetchJsonWithRetry` accetta un `maxDelayMs` opzionale (predefinito 8000). `tests/http-json.test.mjs` (+9). Suite: **2536**.


## [1.197.0] — 2026-08-14

**Aggiunto — segui una bacheca di annunci di un fondo Getro con la sola `careers_url`; l'id della collezione si risolve da solo.**

### Aggiunto
- Una bacheca Getro seguita (b2venture, Earlybird, Point Nine, …) non ha più bisogno di un `getro_collection` numerico cercato a mano. Fornisci la `careers_url` della bacheca stessa e l'id **si risolve automaticamente** da quella pagina alla prima scansione — un'unica GET sicura contro l'SSRF legge il `network.id` numerico direttamente dai dati incorporati nella pagina. Un `getro_collection` esplicito ha ancora la precedenza e salta del tutto il recupero.

### Note
- Nuove `httpsCareersUrl()`, `extractCollectionId()` e la `resolveCollectionId()` asincrona in `server/lib/sources/getro.mjs`; la pagina della bacheca viene recuperata tramite `safeGet` (DNS fissato, dimensione limitata), e l'id risolto resta ancorato all'host `api.getro.com` da `assertGetroUrl`. L'adattatore ora corrisponde a una voce `provider: getro` che porta una `careers_url` https anche senza id. `tests/sources-getro.test.mjs` (+8). Suite: **2527**.


## [1.196.0] — 2026-08-14

**Corretto (sicurezza) — l'adapter Workday valida un endpoint `api` in base al suo hostname, non a una sottostringa.**

### Corretto
- Un valore `api:` Workday in `portals.yml` ora è accettato solo quando il suo **hostname** è `myworkdayjobs.com` (o un sottodominio `.myworkdayjobs.com`). Il vecchio controllo era una corrispondenza di sottostringa, quindi qualsiasi URL che contenesse soltanto la stringa — es. `https://example.com/?x=myworkdayjobs.com` — passava e sarebbe stato usato come endpoint. Gli endpoint Workday reali non sono interessati. (Segnalato da CodeQL, #443.)

### Note
- Il nuovo `isWorkdayApi()` analizza l'URL e verifica l'host (`server/lib/portals/adapters/workday.mjs`). `tests/workday-adapter-endpoint.test.mjs` (+1). Suite: **2522**.


## [1.195.0] — 2026-08-14

**Prestazioni (scanner) — il rilevamento dei repost resta veloce su cronologie di scansione grandi.**

### Prestazioni
- Il rilevamento di annunci duplicati non degrada più a O(N²) su un grande `scan-history.tsv`. Il raggruppamento dei titoli per azienda era un ciclo annidato che pagava un `roleFuzzyMatch` completo per ogni coppia; ora è un indice invertito — raggruppa le righe per titolo esatto in una passata, poi fa il match fuzzy solo tra bucket DISTINTI che condividono un token discriminante (non di base). **L'output è identico** — gli stessi cluster di repost — dimostrato da un test differenziale contro il vecchio algoritmo su 200+ cronologie casuali.

### Note
- `groupRowsByTitle` in `server/lib/detect-reposts.mjs` (esportato per il test differenziale). `tests/detect-reposts-grouping.test.mjs` (+2). Suite: **2521**.


## [1.194.0] — 2026-08-14

**Corretto (scanner) — le pagine carriere Workday con URL a segmento singolo ora vengono scansionate correttamente.**

### Corretto
- L'adapter Workday ora analizza gli URL carriere il cui percorso è un singolo segmento — es. `https://parsons.wd5.myworkdayjobs.com/Search`, `.../KBR_Careers`, `.../Careers`. Prima il sito ripiegava su `External`, l'adapter colpiva l'endpoint CXS sbagliato e una sonda poteva sembrare sana senza restituire nulla. Ora prende il primo segmento non vuoto del percorso come sito (scartando un prefisso di lingua come `en-US`); il caso documentato `/en-US/External` è invariato. (Segnalato in #255.)

### Note
- Analisi strutturale del percorso in `server/lib/portals/adapters/workday.mjs`. `tests/workday-adapter-endpoint.test.mjs` (+7). Suite: **2519**.


## [1.193.0] — 2026-08-14

**Aggiunto (statistiche) — una scheda "Silenzio dopo il colloquio" che fa emergere i colloqui da sollecitare.**

### Aggiunto
- Una scheda **Silenzio dopo il colloquio** in `#/stats`: colloqui rimasti in silenzio oltre una finestra di cortesia (30 giorni di default), unendo i tuoi colloqui attivi e il tracker — con da quanto ciascuno è in silenzio, la data dell'ultimo colloquio e il motivo. Un elenco gentile di sollecito/chiusura; solo suggerimenti, mai un'affermazione di rifiuto. Senza token.

### Note
- Nuova rotta `GET /api/stats/rejection-latency` (fail-soft `{available:false}`). `tests/stats-rejection-latency-route.test.mjs` (+2). +10 chiavi i18n ×17; help-hint di `#/stats` da 7→8 schede. Suite: **2510**.


## [1.192.0] — 2026-08-14

**Aggiunto (cv-studio) — un controllo "Verifica i fatti del tuo CV" che scova numeri che non hai mai avuto.**

### Aggiunto
- Una scheda **Verifica i fatti del tuo CV** in `#/cv-studio`: incolla un CV o una lettera su misura e verifica ogni metrica e fatto rispetto al tuo CV, profilo e two-pager reali. Ottieni un verdetto **pass / warn / block** più le metriche inventate, i fatti non supportati e le frasi vietate / di avviso esatte. Senza LLM; non viene scritto nulla.

### Note
- Nuova rotta `POST /api/cv-studio/verify-facts`: scrive il testo in un file temporaneo usa-e-getta ed esegue `verify-cv-facts.mjs`, fidandosi del verdetto JSON anche se lo script esce con 1 su un block. `tests/cv-studio-verify-facts-route.test.mjs` (+4). +15 chiavi i18n ×17. Suite: **2508**.


## [1.191.0] — 2026-08-14

**Aggiunto (statistiche) — una scheda "Cosa imparare dopo" che ordina le competenze da imparare prima.**

### Aggiunto
- Una scheda **Cosa imparare dopo** in `#/stats`: un riepilogo su tutto il tracker — le competenze mancanti che più spesso hanno affondato una bassa compatibilità, pesate (per 5−punteggio di compatibilità su ogni report) e in livelli **Critical / High / Medium** — più quelle già coperte dal tuo CV/profilo. Sola lettura, solo suggerimenti, senza token.

### Note
- Nuova rotta `GET /api/stats/upskill` (campo `{ error }` quando i dati sono pochi; fail-soft `{available:false}`). `tests/stats-upskill-route.test.mjs` (+3). +15 chiavi i18n ×17. Suite: **2504**.


## [1.190.0] — 2026-08-14

**Aggiunto (tracker) — un pannello "Cronologia azienda" che ti dice quali aziende ti rispondono davvero.**

### Aggiunto
- Una scheda **Cronologia azienda** su `#/tracker`: scegli un'azienda e ottieni prove in sola lettura — quanto è stata reattiva con te (**in silenzio con te** / **misto** / **ha già risposto**) e se lo stesso ruolo viene **ripubblicato** — unendo tracker, follow-up e cronologia di scansione. Nessun token; lo scanner non viene mai chiamato.

### Note
- Nuova rotta `GET /api/stats/company-history[?company=]` (fail-soft `{available:false}`). `tests/stats-company-history-route.test.mjs` (+3). +18 chiavi i18n ×17. Suite: **2501**.


## [1.189.0] — 2026-08-14

**Corretto (scanner) — i livelli di anzianità scritti in numeri romani ora contano anche nei titoli non latini.**

### Corretto
- Il classificatore di livello dietro `skip_tiers` ora legge un suffisso di livello in numeri romani (I / II / III / IV / V) dopo la parola del ruolo in **qualsiasi scrittura** — "Инженер III", "エンジニア I", "Ingénieur IV" — non solo dopo parole ASCII. Prima, un numero di livello dopo una parola non latina veniva ignorato e l'offerta cadeva su **mid**, quindi `skip_tiers: [senior]` o `[entry]` le mancava.

### Note
- Lookbehind indipendente dalla scrittura in `server/lib/classify-tier.mjs`; rimosso un matcher `Sr.` duplicato morto. `tests/classify-tier.test.mjs` (+1). Suite: **2498**.


## [1.188.0] — 2026-08-14

**Corretto (UI) — i pulsanti d'azione principali non sono più attaccati al sottotitolo della pagina.**

### Corretto
- La riga di azione / controllo principale in **Riepilogo settimanale dei colloqui**, **Aziende finanziate**, **Portali**, **Piano di carriera** e **Orientamento professionale** ora ha un margine superiore adeguato, così il pulsante respira sotto il sottotitolo invece di appoggiarvisi.

### Note
- Guardia di regressione `tests/lead-row-top-margin.test.mjs` (+5). Suite: **2497**.

## [1.187.0] — 2026-08-14

**Corretto (scanner) — l'impostazione `skip_tiers` funziona di nuovo: le offerte che hai chiesto di saltare per seniority vengono scartate.**

### Corretto
- Un elenco `skip_tiers:` in `portals.yml` (es. `skip_tiers: [intern, entry]`) è ora rispettato dalla scansione. Il titolo di ogni offerta è classificato in un livello (intern / entry / mid / senior) e scartato se il livello è nel tuo elenco. Prima la scansione applicava i filtri titolo / località / contenuto / affidabilità ma senza filtro di livello, quindi `skip_tiers` veniva ignorato in silenzio. I titoli senza parola di livello ricadono su **mid** (quindi `skip_tiers: [mid]` scarta anche la maggior parte delle offerte comuni), e il classificatore legge la parola di livello PIÙ A SINISTRA.

### Note
- Nuovo modulo puro `server/lib/classify-tier.mjs` (`classifyTier` + `buildTierFilter`), collegato alle catene di filtri degli scanner EN e RU. `tests/classify-tier.test.mjs` (+7). Suite: **2492**.

## [1.186.0] — 2026-08-14

**Aggiunto (CV Studio) — un pannello "Divario di competenze": quali competenze richieste da un'offerta il tuo CV nomina, implica o gli mancano.**

### Aggiunto
- Un nuovo pannello **Divario di competenze** in **CV Studio**. Scegli una descrizione di lavoro salvata e classifica ogni competenza richiesta in **nominata nel tuo CV**, **implicita nel tuo CV** o **mancante** — confronto di parole senza LLM, nulla viene scritto. Una nota di bassa affidabilità appare quando l'offerta non aveva una sezione requisiti chiara.

### Note
- Nuovo `GET /api/jds/:name/skill-gap` (il nome dell'offerta è sanificato e confermato sotto `jds/` prima di diventare un argomento; fallback morbido a `{available:false}` senza lo script). +13 chiavi i18n ×17. Test: `tests/jds-skill-gap-route.test.mjs` (+4, incl. rifiuto del path-traversal). Suite: **2485**.

## [1.185.0] — 2026-08-14

**Aggiunto (statistiche) — una scheda "Imbuto e velocità": come il tuo imbuto si confronta col mercato e quanto velocemente avanzi tra le fasi.**

### Aggiunto
- Una nuova scheda **Imbuto e velocità** in **Statistiche** mostra i tuoi tassi di **risposta** e **colloquio** accanto agli intervalli di riferimento di mercato (con le avvertenze su campione piccolo e bias di selezione), una **lista d'attesa** delle candidature in corso oltre la finestra tipica di prima risposta, e i **giorni mediani per fase** (Candidato → Risposto → Colloquio → Offerta) — le righe lente sono censurate a destra per non distorcere le mediane. Sola lettura e zero token; legge solo il tuo tracker.

### Note
- Nuovo `GET /api/stats/funnel` (fallback morbido a `{available:false}` senza lo script). +18 chiavi i18n ×17. Test: `tests/stats-funnel-route.test.mjs` (+2). Suite: **2481**.

## [1.184.0] — 2026-08-14

**Corretto (UI) — le tessere di azione rapida della Dashboard ora si allineano in una griglia uniforme.**

### Corretto
- Nella Dashboard (Centro di comando) un gruppo di 3 tessere veniva reso più largo di uno da 4, lasciando le sezioni con un bordo destro irregolare. Ogni gruppo usa ora colonne di uguale larghezza (4 su schermo ampio, fino a 3 / 2 / 1 al restringersi della finestra), così tutte le tessere hanno la stessa dimensione e i loro bordi destri si allineano.

### Note
- Solo CSS (`.qa-grid`: `repeat(N, minmax(0,1fr))` fisso invece di `auto-fill`). Protetto da `tests/dashboard-grid-align.test.mjs` (+2). Suite: **2479**.

## [1.183.0] — 2026-08-14

**Aggiunto (scanner) — rilevamento duplicati più intelligente: la stessa offerta ripubblicata con un link di tracciamento non compare più due volte.**

### Aggiunto
- Lo scanner ora riconosce un'offerta tramite una **chiave URL canonica**, così la stessa offerta ripubblicata con un parametro di tracciamento (`?utm_…`, `gclid`, …), su `http` vs `https`, o con una barra finale / `#frammento` è trattata come l'unica offerta che è — nessuna riga duplicata nei risultati o nel pipeline e nessuna valutazione sprecata su un'offerta già vista. Offerte davvero diverse (un id funzionale mantenuto come `gh_jid`) contano ancora separatamente.

### Note
- Nuovo `server/lib/url-key.mjs`, collegato al dedup di entrambi gli scanner e allo scrittore del pipeline. Normalizza volutamente poco — non fonde mai due offerte distinte. Test: `tests/url-key.test.mjs` (+5), `tests/parsers.test.mjs` (+1). Suite: **2477** (+6).

## [1.182.0] — 2026-08-14

**Corretto (scanner) — le fasce salariali ora si leggono uguali in ogni lingua.**

### Corretto
- Gli importi salariali nelle righe di scan e tracker usano i simboli neutri **≥** e **≤** (es. `≥ 120000 EUR`, `≤ 90000`) invece delle parole inglesi "from" / "up to", che trapelavano non tradotte nelle interfacce non inglesi. Vale per ogni bacheca con fascia a un solo lato (Getro, Remotli, Manfred, Agentic Jobs, JustJoin, Jobicy); le fasce a due lati (`100000–150000 USD`) erano già neutre.

### Note
- Solo visualizzazione — il filtro salari del client analizza i numeri a prescindere dal prefisso, quindi il filtraggio non cambia. Suite: **2471**.

## [1.181.0] — 2026-08-14

**Aggiunto (scanner) — le bacheche Getro ora mostrano stipendio, tutte le località e posizioni da remoto.**

### Aggiunto
- Lo scanner **Getro** (bacheche delle reti di talenti dei fondi) ora mostra uno **stipendio** su ogni posizione (fascia annuale + valuta), elenca **tutte** le località invece della sola prima e contrassegna le posizioni **da remoto**. Una posizione Getro nel tuo scan e tracker porta ora lo stesso dettaglio di stipendio + località delle altre bacheche.

### Note
- Solo scanner; nessuna nuova dipendenza, nessun cambiamento a route / CSP / SSRF. Test: `tests/sources-getro.test.mjs` (+5). Suite: **2470** (+5).

## [1.180.0] — 2026-08-14

**Corretto (MEDIO, report) — l'elenco `#/reports` è ora una tabella e viene recuperato un punteggio reale che un segnaposto di Machine Summary nascondeva.**

### Corretto
- **L'elenco `#/reports` è una tabella (Report · Data · Legittimità · Punteggio), non una griglia di 4 schede.** Un lungo chip "Punteggio non rilevato" comprimeva la colonna del titolo quasi a zero, e l'`overflow-wrap: anywhere` del titolo della scheda spezzava il nome del report un carattere alla volta. Ora ogni campo ha la propria colonna, la cella del nome va a capo per parole e la tabella scorre orizzontalmente su viewport stretti (nuovo contenitore `.reports-scroll`). Nuova chiave i18n `rep.colReport` ×17.
- **Un punteggio reale nel corpo (`**Итоговый балл:** 1.8 / 5`) non è più nascosto da un segnaposto di Machine Summary (`score: —`).** Quando il blocco `## Machine Summary` portava un punteggio non numerico o fuori intervallo, occupava lo slot del punteggio analizzato e bloccava il fallback forma-valore in grassetto, così il report mostrava "Punteggio non rilevato" nonostante un `X / 5` reale nel corpo. `parseReportHeader` ora recupera la forma-valore dal corpo quando non sopravvive alcun numero utilizzabile (passo 4.5).

### Note
- Solo client + parser; nessun cambiamento a route / CSP / SSRF / scrittura sul padre. Test: `tests/reports-table.test.mjs` (+5), `tests/report-header-locale.test.mjs` (+2). Suite: **2465** (+7).

## [1.179.0] — 2026-08-13

**Modificato (LOW, scanner) — 20 decoder di entità HTML duplicati consolidati sul modulo condiviso (follow-up di parità, chiude la worklist).**

### Modificato
- 20 sorgenti di scansione avevano ciascuna il proprio `decodeEntities`/`decodeXmlEntities` (+ un helper `fromCodePoint`) — copie che erano derivate (tre potevano sollevare un `RangeError`, corretto in v1.172.0; altre ammettevano NUL/C0 o interpretavano male `&#1a2;`). Ora passano tutte per l'unico `server/lib/html-entities.mjs` (decoder sicuro secondo Char di XML 1.0), rimuovendo ~237 righe di duplicazione. Le 8 sorgenti in stile RSS hanno guadagnato la decodifica di `&nbsp;` (prima gestivano solo 5 entità); la doppia decodifica voluta di cryptocurrencyjobs è preservata tramite un alias. `hh` mantiene il proprio decoder (gestisce `&mdash;`/`&ndash;`, fuori dalle 6 condivise). Un nuovo test di guardia fallisce se una sorgente ricrea un decoder locale.

### Note
- Refactoring che preserva il comportamento; nessun cambiamento a route / CSP / SSRF / scrittura sul padre. Test: `tests/decoder-consolidation.test.mjs` (+2). Suite: **2458** (+2).

## [1.178.0] — 2026-08-13

**Corretto (LOW, parità col padre) — due costanti obsolete allineate al padre (PARENT-SYNC GAP #4 + #5).**

### Corretto
- **User-Agent del browser (GAP #4)** — `BROWSER_LIKE_USER_AGENT` (inviato da workable/workday/oraclecloud/a16z/eightfold per superare i gate WAF/bot) portato da Chrome 131 a **151**, allineando il `user-agent.mjs` del padre; una versione vecchia è più spesso bloccata. Protetto da un test `Chrome major ≥ 151`.
- **FALLBACK degli stati del tracker (GAP #5)** — il `FALLBACK` di ultima istanza in `states.mjs` (usato solo quando il `templates/states.yml` live è illeggibile — clone nuovo / root isolata in CI) ha guadagnato gli alias di stato turchi del padre (#2615): değerlendirildi, başvuruldu, yanıt verildi, mülakat, teklif, reddedildi, iptal edildi, uygun değil, kabul edildi/işe alındı. In produzione il file live li forniva già.

### Note
- Solo due costanti; nessun cambiamento a route / CSP / SSRF / scrittura sul padre. Test: `tests/http-json.test.mjs` (+1) + `tests/states.test.mjs` (+1). Suite: **2456** (+2).

## [1.177.0] — 2026-08-13

**Corretto (MEDIUM, scanner) — csod (Cornerstone) restituiva 0 offerte sui tenant che proteggono l'API di ricerca con cookie di sessione (parent #2769, PARENT-SYNC GAP #1).**

### Corretto
- Alcuni tenant Cornerstone impostano cookie di sessione sulla home del sito carriere e rispondono `401 CSOD Unauthorized` all'API di ricerca se quei cookie non tornano insieme al token bearer anonimo. `sources/csod.mjs` ora legge il bootstrap tramite un nuovo helper `fetchResponse`, costruisce un header `Cookie` dai suoi valori `Set-Cookie` (`cookieHeaderFrom` — solo nome=valore, semantica jar) e lo ripete sul POST di ricerca. Solo stessa origine (host fissato + `redirect:'error'`), quindi i cookie di sessione non raggiungono mai terze parti; un tenant senza cookie si comporta come prima.

### Note
- Nuovo `server/lib/http-json.mjs::fetchResponse` (additivo; sorgenti esistenti intatte). Nessun cambiamento a route / CSP / SSRF / scrittura sul padre. Test: `tests/sources-parity-v1118a.test.mjs` (+1). Suite: **2454** (+1).

## [1.176.0] — 2026-08-13

**Corretto (MEDIUM, report) — un punteggio sotto un'etichetta in grassetto che la tabella RU non elenca mostrava ancora "Score not detected" (FIND-5).**

### Corretto
- Due report RU scrivevano il punteggio come `**Итоговый балл:** 1.8 / 5` / `**Скор:** 1.8 / 5` — etichette in grassetto che `REPORT_LABELS.ru` non enumera (conosce solo "Оценка"/"Балл"), quindi il punteggio restava non analizzato. Invece di ampliare l'elenco di sinonimi, `parseReportHeader` ora ripiega sulla **forma del valore**: una frazione sulla rubrica /5 sotto QUALSIASI etichetta in grassetto. È indipendente dalla lingua, immune a un'intestazione (niente `**`, niente valore `/5`) e rifiuta una data come `5/5/2026` (lookahead negativo sul denominatore).

### Note
- Solo parser del server; nessun cambiamento a route / CSP / SSRF / scrittura sul padre. Test: `tests/report-header-locale.test.mjs` (+2). Suite: **2453** (+2).

## [1.175.0] — 2026-08-13

**Corretto (LOW, irrobustimento) — una guardia di regressione per la descrizione SEO di FIND-3 + uno strip di legittimità sicuro ai valori nulli (follow-up dell'AI-review).**

### Corretto
- **Guardia di parità della descrizione SEO** — la correzione di v1.174.0 che ha sostituito un "~55" fisso nel `meta.desc` di ogni lingua con un placeholder `{adapters}` derivato dal registro non aveva test, quindi poteva regredire in silenzio alla prossima modifica di una locale. Il nuovo `tests/site-meta-desc-parity.test.mjs` (isolato in CI) fallisce se uno dei 17 `site/src/i18n/*.json` perde il placeholder o rifissa un conteggio, o se `Landing.astro` smette di interpolarlo nelle tre metadescrizioni.
- **Strip di legittimità sicuro ai nulli** — `stripEmphasis` restituisce `''` per un input nullish invece della stringa "undefined" (i campi sono inizializzati a stringa, quindi è difesa in profondità).

### Note
- Test + una guardia di una riga nel parser; nessun cambiamento a route / CSP / SSRF / scrittura sul padre. Test: `tests/site-meta-desc-parity.test.mjs` (+3). Suite: **2451** (+3).

## [1.174.0] — 2026-08-13

**Corretto (HIGH, report) — i report localizzati mostravano "Score not detected"; la descrizione SEO era obsoleta.**

### Corretto
- **Parsing del punteggio (FIND-1)** — un report non inglese il cui H1 contiene la parola dell'etichetta del punteggio (`# Оценка вакансии: <titolo>`) non scambia più quel titolo per il punteggio. `parseReportHeader` ora si ancora all'etichetta **in grassetto** localizzata (`**Оценка:** 1.5 / 5`), salta le righe di intestazione e richiede l'etichetta adiacente ai due punti — così i report RU che mostravano "Score not detected" espongono il punteggio reale.
- **Chip di legittimità (FIND-2)** — l'enfasi Markdown viene rimossa dal valore, così il chip mostra "High Confidence" invece di "** High Confidence".
- **Overflow del punteggio** — una riga di punteggio con testo di stato in coda ("1.8, Status: Evaluated, …") viene compattata al solo punteggio; `.score-pill` ottiene un limite no-wrap/overflow e la colonna del titolo può restringersi, così un chip colorato non esce mai dal bordo della card.
- **Descrizione SEO (FIND-3)** — le descrizioni meta / OG / Twitter di cvstart.org (tutte le 17 lingue) fissavano "Scan ~55 job boards" mentre il corpo contava il registro reale ("~75"). Ora la descrizione interpola il conteggio derivato dal registro, così non deriva più.

### Note
- Parser del server + render/CSS del client + i18n del sito; nessun cambiamento a route / CSP / SSRF / scrittura sul padre. Test: `tests/report-header-locale.test.mjs` (+4). Suite: **2448** (+4).

## [1.173.0] — 2026-08-13

**Aggiunto (LOW, configurazione) — Hermes entra nell'elenco delle CLI di IA rilevate (parità con career-ops).**

### Aggiunto
- La scheda `#/config` → "Strumenti CLI di IA" ora rileva **Hermes** (Nous Research), il runtime di agente appena supportato dal progetto padre (binario `hermes`). L'elenco fisso in `server/lib/routes/cli-detect.mjs` cresce da 10 a 11 strumenti; il rilevamento resta una scansione di PATH in sola lettura (nessun binario viene mai eseguito).

### Note
- Nessun cambiamento a i18n / route / CSP / SSRF / scrittura sul padre; l'elenco è fisso, mai un input. Suite: **2444** (il canary di cli-detect aggiornato da 10 a 11).

## [1.172.0] — 2026-08-13

**Corretto (MEDIUM, scanner) — un'entità HTML malformata poteva mandare in crash una sorgente di scansione (parità con career-ops #2150).**

### Corretto
- Le sorgenti `oraclecloud`, `gem` e `dassault` decodificavano le entità HTML numeriche con un debole controllo `Number.isFinite` prima di `String.fromCodePoint` — un riferimento superiore a `0x10FFFF` (es. `&#99999999;` da un feed malformato o ostile) sollevava un `RangeError` non catturato e interrompeva l'intero parsing di quella sorgente. Un modulo condiviso `server/lib/html-entities.mjs` (che rispecchia il `_html-entities.mjs` del progetto padre) ora limita i riferimenti numerici all'insieme Char di XML 1.0 §2.2, così `String.fromCodePoint` non può mai sollevare eccezioni, e distingue esadecimale e decimale separatamente affinché `&#1a2;` non venga più interpretato male. Le tre sorgenti lo importano.

### Note
- Nessun cambiamento per i feed validi; nessun cambiamento a JS / i18n / route / CSP / SSRF / scrittura sul padre. Il consolidamento delle ~20 copie del decoder rimaste nelle sorgenti è tracciato in `qa/PARENT-SYNC-WORKLIST-v1.26.0.md`.
- Test: `tests/html-entities.test.mjs` (+7). Suite: **2444** (+7).

## [1.171.0] — 2026-08-13

**Modificato (BASSA, design-system) — token di scala tipografica + livelli z-index (D-4, primo passo).** Dimensioni e impilamento erano letterali per componente.

### Modificato
- **Livelli z-index** — introdotti token `--z-*` (`--z-topbar` … `--z-skiplink`) e **migrato ogni letterale z-index**. Valori preservati, impilamento identico; un nuovo canarino vieta nuovi numeri magici.
- **Scala tipografica** — rampa `--font-size-*` (`xs 11` … `2xl 28`, base = Inter 15px); migrate le dimensioni centrali (nessun cambiamento visivo). I valori fuori rampa migrano in modo incrementale (`docs/UX-ROADMAP.md`).

### Note
- Solo token CSS; nessuna modifica a comportamento/JS/i18n/route/CSP/SSRF/scrittura. Nessun cambiamento di pixel. `tests/design-tokens-scale.test.mjs` (+3). Suite: **2437** (+3).

## [1.170.0] — 2026-08-13

**Aggiunto (BASSA) — suggerimenti ETA onesti sulle lunghe generazioni IA (P4-ETA).** Le generazioni pesanti (piano di carriera ~40 s, orientamento / mercato / networking ~30 s, two-pager ~20 s) mostravano solo "Generazione…" senza percezione della durata.

### Aggiunto
- Accanto a ogni pulsante di generazione lunga compare ora un suggerimento attenuato **`⏱ ~Ns`** (come l'ETA di `#/auto`). Stile `.eta-hint` condiviso + due chiavi generiche (`common.eta` `~{n}s`, `common.etaTitle`).

### Note
- Solo client; nessuna modifica a route/CSP/SSRF/scrittura. +2 chiavi i18n ×17 (snapshot 1219 → 1221). `tests/generation-eta-hint.test.mjs` (+2). Suite: **2434** (+2).

## [1.169.0] — 2026-08-13

**Aggiunto (BASSA) — anteprima PDF inline (D-5).** `GET /api/output/pdfs/:name` forzava `Content-Disposition: attachment`, quindi anche il pulsante "Apri" su `#/cv` scaricava invece di mostrare.

### Aggiunto
- **`?inline=1`** serve lo STESSO file sanificato con `Content-Disposition: inline`, per un'**👁 Anteprima** in una nuova scheda; il default resta il download. Nessuna nuova route; stesse protezioni sul nome.
- Il primo pulsante della lista PDF su `#/cv` è ora **👁 Anteprima** accanto a **⬇ Scarica**. `cv.openPdf` "Apri" → "Anteprima" ×17.

### Note
- Nessuna modifica CSP/SSRF — stesso `sanitizePathName`. Una chiave i18n riformulata ×17 (snapshot 1219). `tests/output-pdfs.test.mjs` (+3). Suite: **2432** (+3).

## [1.168.0] — 2026-08-13

**Corretto (BASSA, a11y) — le righe delle checkbox rispettano ora il minimo 24×24 di WCAG 2.5.8 (D-2).** Le etichette di checkbox/radio su `#/scan`, `#/config`, `#/evaluate` e `#/cv-studio` stavano in una banda di ~22 px.

### Corretto
- Una regola circoscritta `label:has(> input[type="checkbox"/"radio"]) { min-height: 24px }` garantisce una banda ≥24 px. Solo `min-height` — le etichette sono già flex, nulla si sposta; `.apply-checklist` (32 px) era già conforme.

### Note
- Solo CSS; nessuna modifica a comportamento/JS/i18n/route/CSP/SSRF/scrittura. `tests/checkbox-target-size.test.mjs` (+1). Suite: **2429** (+1).

## [1.167.0] — 2026-08-13

**Corretto (BASSA, design-system) — le superfici rialzate ora si distinguono dai filetti (D-3).** I token `--panel-2` / `--surface-elev1` si risolvevano in `--slate`, lo stesso valore dei filetti `--line` / `--border`, senza separazione visiva.

### Corretto
- Un token dedicato e consapevole del tema **`--elev`** (`#eef1f6` chiaro / `#1e232e` scuro, distinto da `--slate` in entrambi i temi) sostiene ora le superfici rialzate; i filetti restano su `--slate`. Gli altri rilievi (D-2, D-4, D-5, P4-ETA) sono backlog in `docs/UX-ROADMAP.md`.

### Note
- Solo token CSS; nessuna modifica a comportamento/JS/i18n/route/CSP/SSRF/scrittura. `tests/elevation-token.test.mjs` (+2). Suite: **2428** (+2).

## [1.166.0] — 2026-08-13

**Corretto (BASSA) — la terminologia della rubrica ora rispecchia i docs canonici.** career-ops.org/docs descrive "cinque dimensioni più un punteggio globale olistico", ma il web-ui, cvstart.org e il wiki dicevano "rubrica a sei dimensioni" (5 + 1 = 6, ma il lessico divergeva).

### Corretto
- Adottata la formulazione dei docs — **"cinque dimensioni più un punteggio globale olistico"** — in modo coerente in README ×17, nel sito cvstart.org ×17, nella guida ×17, in `docs/career-ops-canonical.md` e nel wiki (Home ×17 + Features).

### Note
- Solo docs/marketing; nessuna modifica a codice/chiave i18n/route/CSP/SSRF/scrittura. `tests/rubric-terminology.test.mjs` (+2). Suite: **2426** (+2).

## [1.165.0] — 2026-08-13

**Corretto (BASSA) — il termine "Two-pager" è ora coerente all'interno di ogni lingua.** In arabo la barra laterale mostrava il latino "Two-pager" mentre l'`<h1>` era completamente localizzato — l'unica stringa latina in una navigazione RTL altrimenti speculare.

### Corretto
- **Decisione applicata:** per lingua, `nav.twoPager` e `twoPager.title` concordano sul termine (entrambi in latino o entrambi localizzati). Solo l'arabo era diviso; la sua etichetta di navigazione è ora localizzata ("الصفحتان"). Un nuovo canarino fallisce se una lingua li separa di nuovo.

### Note
- Solo testo; nessuna modifica a route/CSP/SSRF/scrittura. Un valore i18n modificato (ar); nessuna nuova chiave (snapshot 1219). `tests/two-pager-term-consistency.test.mjs` (+2). Suite: **2424** (+2).

## [1.164.0] — 2026-08-13

**Corretto (BASSA) — il placeholder della ricerca non trabocca più in nessuna lingua.** "Find a company, role or URL…" veniva troncato (nowrap) quando la barra si restringeva; la metà "…or URL" non era mai visibile.

### Corretto
- `top.search` (×17) è ora il breve **"Cerca o incolla una URL"** (≤24 caratteri in ogni lingua), sta anche in una barra stretta e mantiene il riferimento all'URL. Il fallback in `index.html` corrisponde; l'`aria-label` conserva il dettaglio completo.

### Note
- Solo testo; nessuna modifica a route/CSP/SSRF/scrittura. Una chiave i18n riformulata ×17 (nessuna nuova; snapshot 1219). `tests/search-placeholder-fit.test.mjs` (+2). Suite: **2422** (+2).

## [1.163.0] — 2026-08-13

**Corretto (BASSA) — l'assistente in-app "Chiedi ai docs" ora copre l'esportazione di un report in PDF.** Rispondeva che la guida non lo copriva, benché `#/reports/:slug` abbia un pulsante 📄 Generate PDF funzionante.

### Corretto
- Aggiunto un H3 **"Esportare un report in PDF"** sotto §10 Report in **tutti i 17 bundle di aiuto** (dov'è il pulsante, il file finisce in `output/*.pdf`, richiede Playwright, rivedere prima di inviare). Il recupero dell'assistente ora mostra la sezione Report.

### Note
- Solo docs/aiuto; nessuna modifica a codice/route/CSP/SSRF/scrittura. Soglia aiuto **112 → 113 H3** (31 H2 invariato). `tests/help-reports-pdf-section.test.mjs` (+2). Suite: **2420** (+2).

## [1.162.0] — 2026-08-13

**Corretto (MEDIA) — il "?" di aiuto è ora un bersaglio di ≥24×24 (WCAG 2.5.8).** `.help-hint` misurava 18×18 px con `padding:0`, sotto il minimo, su ogni intestazione.

### Corretto
- Il box `.help-hint` è ora **24×24** (il bersaglio misurabile) mentre l'**anello visibile resta a 18px** — disegnato da un `::before` centrato, quindi il glifo e la linea di base dell'`<h1>` sono invariati. Gli stati hover/attivo/focus seguono l'anello; margine 6→3px per mantenere lo spazio.

### Note
- Solo CSS; nessuna modifica a JS/i18n/route/CSP/SSRF/scrittura. `tests/help-hint-target-size.test.mjs` (+2). Suite: **2418** (+2).

## [1.161.0] — 2026-08-13

**Corretto (MEDIA) — `#/reports` mostra un chip "Punteggio non rilevato" invece di spazio vuoto.** Dopo il parser multilingua di v1.159.0, un report senza punteggio analizzabile mostrava un'area vuota, indistinguibile da un errore.

### Corretto
- La cella del punteggio ora si ramifica: con punteggio → pillola di tono; senza → chip **`.score-muted`** attenuato ("Punteggio non rilevato", ×17) con tooltip "Apri il report…". La card resta un `role="link"` operabile da tastiera e la data si mostra.
- Riusa il token neutro esistente; nessun colore nuovo.

### Note
- Solo client; nessuna modifica a route/CSP/SSRF/scrittura. +2 chiavi i18n ×17 (snapshot 1217 → 1219). Suite: **2416** (+3).

## [1.160.0] — 2026-08-13

**Corretto (ALTA) — il testo sui provider non contraddice più la promessa dei 7 provider.** `#/config` diceva che la valutazione live "usa la tua chiave Anthropic o Gemini" e che quella OpenAI "non è usata dal web UI"; la dashboard diceva "Score Anthropic-first" — falso dalla cascata a 7 provider (v1.157.0).

### Corretto
- `config.providerModelNote` (×17): ora dice che la ⚡ valutazione live gira headless con una qualsiasi delle tue sette chiavi (Anthropic · Gemini · OpenAI · Qwen · OpenRouter · GitHub Models · Hermes), ordinate automaticamente con fallback. Rimossa la frase falsa su OpenAI.
- `dash.quick.evaluateSub` (×17): neutro ("Punteggio di idoneità 0–5"). `Keys: N / 5` → `N / 7`.

### Note
- Solo testo; nessuna modifica a route/CSP/SSRF/scrittura. Nessuna nuova chiave i18n (snapshot 1217). Suite: **2413** (+3).

## [1.159.0] — 2026-08-13

**Corretto (ALTA) — i metadati del report non dipendono più dalla lingua.** I report generati in una lingua diversa dall'inglese mostravano una striscia di metadati vuota su `#/reports`, perché `parseReportHeader` riconosceva solo le etichette in grassetto in inglese.

### Corretto
- `parseReportHeader` ora analizza il blocco YAML invariante `## Machine Summary` (`score:` / `legitimacy:` / `date:` — la stessa fonte che `auto-pipeline` già legge): etichette inglesi → blocco Machine Summary → etichette localizzate (`REPORT_LABELS`, 17 lingue). I report in inglese restano identici byte per byte.
- Analisi numerica tollerante (`1.5/5`, `1,5/5`, `1.5 из 5`, `4.5 out of 5`); la data ripiega sul mtime del file quando manca.

### Note
- Solo lettura/analisi; nessuna modifica a route, CSP, SSRF o scrittura sul padre. Nessuna nuova chiave i18n. Suite: **2410** (+8).

## [1.158.0] — 2026-08-12

**Corretto — due bug cosmetici di visualizzazione (un «?» che trapelava nel titolo della scheda e un conteggio dei provider errato nella landing).** Solo visualizzazione; nessuna modifica a comportamento, sicurezza o flusso dei dati.

### Corretto
- Il «?» di HelpHint non trapela più in `document.title`. Il router derivava il titolo della scheda dal `h1.textContent` grezzo, mostrando «Vacancy search?» invece di «Vacancy search». `router.js::focusNewView` ora clona l'intestazione, rimuove `.help-hint` e poi legge il testo; il «?» visibile resta intatto.
- cvstart.org mostrava «17 AI providers» invece di «7». L'helper `sub()` in `Features.astro` riscriveva ogni `{n}` con il numero di lingue (17) prima della sostituzione per scheda; ora `{n}` è risolto per scheda (provider → 7, lingue → 17).

### Note
- Nessuna modifica a server, route, CSP, SSRF o chiavi i18n; forma di `facts.json` invariata. Suite: **2402** test (+1).

## [1.157.0] — 2026-08-12

**Corretto — le valutazioni live ora girano con QUALSIASI provider configurato, non solo Anthropic/Gemini.** Un utente con solo `OPENROUTER_API_KEY` veniva forzato erroneamente in modalità manuale.

### Corretto
- **Causa radice:** un pin `LLM_PROVIDER` senza chiave (es. `LLM_PROVIDER=claude` da `init`) finiva in un vicolo cieco; ora ripiega sull’ordine auto tra i provider configurati (in `selectActiveProvider` + entrambe le cascate di dispatch).
- Il gating lato client (`#/deep` + viste mode-page) usa ora `window.ProviderStatus` (`/api/status/providers`, tutti e 7) invece del probe obsoleto Anthropic/Gemini; testi riscritti (deep/eval × 17) + badge «Valutazioni live» della dashboard + `config.llmProviderHint`.

### Note
- Nessun cambiamento di sicurezza. Suite: **2401** test (+5).

## [1.156.0] — 2026-08-12

**Refactor — dividere `scan.js` sotto il limite di dimensione (P-16) + un fix CodeQL.** `scan.js` era di **906 righe**; estratte due factory che preservano il comportamento → **648**. Completa la coppia di divisioni delle view P-15/P-16.

### Modificato
- Nuovi `scan/runner.js` (motore di esecuzione dello scan) e `scan/filters.js` (macchina a stati dei filtri) tramite bag `ctx`/`refs`; `scan.js` collega entrambi.

### Corretto
- CodeQL `js/useless-assignment-to-local` (#428) in `config/tab-controller.js`: `let n = i;` → `let n;`.

### Note
- Refactor puro, nessun cambio di comportamento; 4 test che leggono il sorgente ripuntati. Entrambe le view grandi ora sotto 800 (P-15/P-16 fatto). Suite: **2396** test.

## [1.155.0] — 2026-08-12

**Refactor — dividere `config.js` sotto il limite di dimensione (P-15).** `config.js` era di **1030 righe** (oltre il limite di 800); estratti due moduli che preservano il comportamento, portandolo a **783**.

### Modificato
- Nuovi `config/field-specs.js` (dati dei campi + liste di modelli) e `config/tab-controller.js` (factory della barra delle schede); `config.js` li referenzia, la logica di render è invariata.

### Note
- Refactor puro, nessun cambio di comportamento; 6 test che leggono il sorgente sono stati ripuntati. `scan.js` (906) resta com’è (già parzialmente diviso; nucleo troppo accoppiato per una divisione meccanica pulita). Suite: **2396** test.

## [1.154.0] — 2026-08-12

**Nuova guida — "Esegui l’intero stack nel cloud."** career-ops non ha una propria storia cloud/server, quindi ne aggiungiamo una: una ricetta passo passo per mettere la pipeline padre **career-ops**, questo visualizzatore **career-ops-ui** e il **motore** IA (un **abbonamento Claude** via Claude Code, un **Hermes** locale, o chiavi API) su un piccolo server sempre attivo. Arriva come **Aiuto §31** in 17 lingue, una sezione del README e una pagina wiki.

### Aggiunto
- **Aiuto §31 "Esegui l’intero stack nel cloud"** (× 17) — le tre parti, provisioning + installazione, scelta del motore, esposizione sicura (reverse proxy HTTPS + auth + le invarianti CSP/SSRF/XSS/nessun-segreto). Il bundle di aiuto cresce a **31 H2 / 112 H3**.
- **README** — una sezione "Esegui l’intero stack nel cloud" (× 17) + una pagina **Cloud-Deployment** nel wiki.

### Note
- **Solo docs** — nessuna rotta, server o modifica client; nessuna nuova chiave i18n. I 4 test di aiuto passano al contratto 31 H2 / 112 H3. Suite: **2396** test (invariata).

## [1.153.0] — 2026-08-12

**Scanner Jobvite migrato al feed XML pubblico (sync con il parent).** Il parent ha ritirato l’API JSON di Jobvite (ora restituisce zero offerte); il source di web-ui usava lo stesso endpoint morto, quindi ogni azienda Jobvite tracciata scansionava vuota in silenzio. Porta il fix del parent (`#2623`): il source ora legge il **feed XML** pubblico per-tenant, con chiave `companyEId`.

### Corretto
- Il source chiamava l’API JSON ritirata e restituiva zero offerte; ora chiama `https://app.jobvite.com/CompanyJobs/Xml.aspx?c={companyEId}` e fa il parse dell’XML `<result><job>…` (CDATA + entità, `detail-url` prima di `apply-url`).

### Modificato
- Risoluzione di `companyEId`: (1) `company_eid:` sul portale, (2) il `c=` di un `api:` esplicito, (3) discovery dalla pagina del board. `fetchText` (`http-json.mjs`) allega `.location`/`.retryAfter` all’errore non-ok (sola lettura, retrocompatibile).

### Note
- **Sicurezza** — due host (`jobs.jobvite.com`, `app.jobvite.com`) fissati da `assertJobviteUrl`: solo https, allowlist stretta, **nessun redirect seguito**. Il `companyEId` è solo un valore `?c=`; conteggio dei source invariato.
- Suite: **2396** test (+4).

## [1.152.0] — 2026-08-12

**Provider Hermes — cablaggio completato + allineamento docs.** Una revisione del codice dell’integrazione Hermes di v1.151.0 ha trovato due lacune reali e quattro punti di completezza; tutti corretti qui, e il roster dei provider LLM dell’intera app è portato ai sette completi su tutte le superfici di docs e le 17 lingue.

### Corretto
- **`#/config` non poteva forzare Hermes** — il menu `LLM_PROVIDER` elencava solo sei provider, quindi si poteva impostare `HERMES_API_KEY` ma non forzare Hermes dalla UI. Ora `hermes` è l’8ª opzione, e un nuovo test di parità impedisce al menu di divergere di nuovo da `LLM_PROVIDERS`.
- **Le chiavi locali corte venivano rifiutate in silenzio** — la soglia di 20 caratteri di `isUsableKey` era tarata per chiavi cloud; `hasHermesKey` usa ora una soglia allentata di 8 (l’esempio dei docs Hermes è di 19 caratteri).

### Modificato
- Il roster dei provider è stato normalizzato ai sette completi in README (× 17), guida in-app (× 17), dict `config.llmProviderHint` (× 17) e `docs/sdd`; `hermesChatUrl` completa un host senza percorso; il testo di fallback manuale cita Hermes.

### Note
- **Sicurezza invariata** — nessuna nuova rotta né modifica SSRF/CSP; health/doctor guadagna una riga `HERMES_API_KEY`.
- Suite: **2392** test (+2).

## [1.151.0] — 2026-08-12

**Hermes è ora un provider LLM collegato (Phase 5)** — lo spike di analisi della Phase 5 ha confermato che il Hermes di Nous Research include un **API Server compatibile con OpenAI** (`hermes gateway` → `POST /v1/chat/completions`), quindi career-ops-ui ora esegue valutazioni live tramite un Hermes locale esattamente come OpenAI/Qwen. Imposta `HERMES_API_KEY` in **Impostazioni app** ed entra nell’ordine auto (ultimo). Chiude l’ultimo punto aperto della roadmap — **Phase 5, Shape A**.

### Aggiunto
- **Provider LLM Hermes (Shape A)** — `runHermes` sul client condiviso `runOpenAICompatible` (`server/lib/openai.mjs`), in **entrambe** le cascate (`llm-dispatch.mjs` + `routes/llm.mjs`), in coda all’ordine auto + il pin `LLM_PROVIDER=hermes`, `/api/status/providers` e `llm-pricing.mjs`. Raggiunge una base URL locale configurabile (default `http://127.0.0.1:8642/v1`) con auth Bearer — è un endpoint di provider CONFIGURATO (come OpenRouter/Qwen), non un URL di offerta dell’utente, quindi non tocca il guard SSRF.
- **Campi `#/config`** — `HERMES_API_KEY` (segreto) + `HERMES_BASE_URL` + `HERMES_MODEL` (default `hermes-agent`), con 6 nuove chiavi i18n × **17 lingue** (snapshot 1208 → 1214).

### Modificato
- Lo spike di analisi è risolto: `docs/integrations/HERMES.md`, l’aiuto in-app §30 (× 17), il teaser del README (× 14), la skill `hermes-bridge` e la roadmap passano da "pianificato / non ancora collegato" a **collegato (Shape A)**. Shape B (un relay su misura del runtime di agente) non è stato necessario.

### Note
- **Sicurezza:** il fetch del provider è un endpoint configurato, della stessa categoria degli altri provider compatibili con OpenAI — nessuna nuova superficie SSRF, nessuna modifica a CSP/sanitizer. `HERMES_API_KEY` è una `SECRET_KEY` (mai mostrata).
- Test (isolati in CI, trasporto simulato): `tests/hermes-provider.test.mjs` (+5); il canarino "nessun ramo Hermes" di v1.146.0 è **invertito** per affermare che C’È; i test di superficie dei provider aggiornati all’ordine a 7 provider.
- Suite: **2390** test (+5).

## [1.150.0] — 2026-08-12

**Stati vuoti coerenti (rifinitura Phase 4)** — ogni pannello "ancora niente qui" ora si renderizza tramite l'unico stile condiviso `.empty`, invece che alcune viste ridichiarino l'aspetto inline con un `40px` magico. Piccola correzione di coerenza visiva; gli stati vuoti di `#/activity`, `#/cv-studio`, `#/stats` e `#/usage` ora combaciano con tutti gli altri (padding di 48px tokenizzato + bordo tratteggiato).

### Modificato
- **`#/activity`, `#/cv-studio`, `#/stats`, `#/usage`** hanno rimosso il loro `style: { padding: '40px', textAlign: 'center', color: 'var(--foggy)' }` inline sui pannelli vuoti — tutte e tre le proprietà sono già fornite dalla classe condivisa `.empty` (`--space-7` = 48px, centrato, attenuato, bordo tratteggiato). Così questi quattro si renderizzano identici agli altri ~25 pannelli `.empty`.
- Gli override legittimi per vista (`#/dashboard` `width:100%`, `#/pipeline` `border:none`) non sono toccati — rimosse solo le ridichiarazioni puramente ridondanti.

### Note
- **Solo pulizia dell'uso di CSS lato client** — nessuna modifica a rotta, server, chiave i18n o regole CSS (la classe `.empty` è invariata); snapshot del dizionario 1208. Verificato nel browser (il pannello vuoto di `#/usage` calcola 48px di padding + bordo tratteggiato, 0 errori di console).
- Il nuovo canarino `tests/empty-state-consistency.test.mjs` mantiene `.empty` come unica fonte di verità. La Phase 5 (provider Hermes) resta bloccata.
- Suite: **2385** test (+2: `tests/empty-state-consistency.test.mjs`).

## [1.149.0] — 2026-08-12

**Portali spostati nelle Impostazioni (Phase 4)** — `#/portals` ora si trova nel gruppo di navigazione **Setup**, accanto a *Impostazioni app*, invece che sotto *Sourcing*. Dalla v1.144.0 è una superficie di configurazione (abilita/disabilita le aziende monitorate + una sonda di salute dell'ATS), non un'azione di sourcing — quindi è lì che deve stare. Solo modifica di navigazione; la pagina e la sua rotta non cambiano.

### Modificato
- **Elemento di navigazione `#/portals` → gruppo Setup** (in `public/index.html`), collocato subito dopo *Impostazioni app*. Rimosso dal gruppo *Sourcing* (che conserva Scan / Pipeline / Auto-pipeline / Aziende finanziate). La rotta `#/portals`, la vista e l'etichetta `nav.portals` non cambiano — si è spostata solo la posizione nella barra laterale.

### Note
- **Solo markup di navigazione** — nessuna modifica a rotta, vista, chiave i18n o server. Verificato nel browser (0 errori di console); protetto da `tests/portals-nav-placement.test.mjs`.
- Suite: **2383** test (+2: `tests/portals-nav-placement.test.mjs`).

## [1.148.0] — 2026-08-12

**Filtri di ricerca più chiari (Phase 4) — il pannello dei filtri è ora una griglia ordinata** — il pannello dei filtri di `#/scan` è passato da un flex-wrap irregolare di riquadri rigidi di larghezza variabile a una griglia responsiva, e le azioni Applica / Reimposta ora occupano una loro riga separata e allineata a destra. Stessi filtri, stesso comportamento — solo più leggibili. Una rifinitura di design (senza parent-sync).

### Modificato
- **Pannello dei filtri di `#/scan` → griglia responsiva** — `.scan-filters` è ora `display: grid` con colonne `repeat(auto-fill, minmax(180px, 1fr))` e spaziature uniformi, così gli 11 filtri etichettati si allineano in colonne ordinate a qualsiasi larghezza invece di andare a capo in una riga irregolare.
- **Azioni Applica / Reimposta** occupano l'intera griglia su una loro riga, separate da una sottile linea e allineate a destra. Rimosso il vecchio trucco dell'etichetta nascosta + il wrapper flex interno in `scan.js`.

### Note
- **Solo CSS + una piccola pulizia del DOM** — ogni id di filtro (`#scan-filter-*`, `#scan-apply`) e il cablaggio di `SR.render()` sono invariati, quindi il flusso Playwright non è toccato. Nessuna nuova chiave i18n.
- Verificato nel browser (0 errori di console); protetto da `tests/scan-filters-grid.test.mjs`.
- Suite: **2381** test (+3: `tests/scan-filters-grid.test.mjs`).

## [1.147.0] — 2026-08-12

**Hermes & Telegram — la sezione di aiuto in-app + la superficie su cvstart.org (Phase 5b, parte 2)** — la seconda e ultima parte del lavoro di documentazione di Hermes: la guida pratica ora vive dentro la guida di aiuto dell'app stessa, in tutte le 17 lingue, e l'assistente di documentazione integrato risponde alle domande su Hermes a partire da essa. Resta solo documentazione — il percorso del provider LLM Hermes rimane **pianificato / non ancora collegato** (Phase 5).

### Aggiunto
- **Aiuto in-app §30 "Hermes & Telegram" × 17 lingue** — una nuova sezione della guida (cos'è Hermes + le due forme di integrazione; esecuzione su un server cloud; Telegram tramite Hermes + la regola "cosa NON esporre"), raggiungibile da `#/help`. Il grounding di `docs-assistant` / `DocsFab` la recupera automaticamente, dato che entrambi leggono `docs/help/<lang>.md`.
- **cvstart.org — un link alla guida di Hermes** che punta al documento su GitHub.

### Modificato
- Soglia del bundle di aiuto alzata **29 → 30 H2 / 105 → 108 H3** (`canonical-docs-coverage`, `help-ui`, `help-ru-config-section`); §30 aggiunge 3 H3.

### Note
- **Ancora nulla chiama Hermes.** Il nuovo canarino `tests/help-hermes-section.test.mjs` verifica che ogni lingua contenga la §30 con le sue àncore indipendenti dalla lingua (`docs/integrations/HERMES.md`, `hermes-bridge`, `#/help`, `127.0.0.1`, Telegram). Il provider resta bloccato in attesa del contratto API della Phase 5.
- Questo chiude il deliverable **documentazione + skill** della Phase 5b; l'integrazione del provider (Phase 5) resta un elemento separato e bloccato.
- Suite: **2378** test (+2: `tests/help-hermes-section.test.mjs`).

## [1.146.0] — 2026-08-12

**Agente Hermes + Telegram — la guida di integrazione + una skill (Phase 5b, parte 1)** — puoi eseguire career-ops-ui su un server cloud e collegare i suoi eventi (una scansione completata, un nuovo report, un follow-up urgente) a Telegram tramite un agente Hermes di Nous Research. Questa versione porta la documentazione di design + deployment e una skill hermes-bridge; il percorso del provider LLM Hermes resta pianificato / non ancora collegato (bloccato dallo spike sul contratto API della Phase 5). Documentazione intenzionalmente davanti al codice.

### Aggiunto
- **`docs/integrations/HERMES.md`** — l'analisi approfondita: le due forme di integrazione (endpoint compatibile con OpenAI vs. runtime dell'agente), il deployment su server cloud (reverse proxy + HTTPS + systemd, il contratto di sola lettura con il parent su una macchina headless), Telegram tramite Hermes, e un elenco da modello di minaccia «cosa NON esporre» (niente CV / stipendio / corpo dei report / chiavi verso il canale).
- Il teaser **`## Hermes agent + Telegram`** nel README — un breve rimando + link, nel README in inglese e replicato nei README tradotti di ogni lingua.
- Una **skill `hermes-bridge`** (`.claude/skills/hermes-bridge/`) che rende operativa la guida — controlli di prerequisiti e di ambito (Node ≥ 18, chiavi presenti, raggiungibilità dell'endpoint tramite il percorso sicuro da SSRF), non scrive mai segreti su disco/log, e si rifiuta di inventare un endpoint Hermes o di affermare che il provider sia collegato.
- Una sezione **Integrations** in `docs/architecture/OVERVIEW.md` collega alla guida.

### Note
- **Per ora nulla chiama Hermes.** Un test canarino (`tests/hermes-docs.test.mjs`) verifica i marcatori di onestà «pianificato / non ancora collegato» e che `llm-dispatch.mjs` non abbia alcun ramo Hermes/Nous — quindi collegare il provider in futuro dovrà aggiornare documentazione + roadmap nella stessa modifica.
- **Rinviato a v1.147.0** (Phase 5b, parte 2): la sezione di aiuto in-app «Hermes & Telegram» H2 × 17 lingue e la superficie di marketing di cvstart.org.
- Suite: **2376** test (+4: `tests/hermes-docs.test.mjs`).

## [1.145.0] — 2026-08-12

**Statistiche perspicaci (segue): un grafico ricostruibile** — la scheda "Tendenza ruoli target" su `#/stats` ha ora un widget **Crea un grafico**: scegli una metrica × dimensione e si ridisegna in tempo reale. Richiesta UX dell'utente (senza parent-sync).

### Aggiunto
- **Grafico ricostruibile metrica × dimensione** — scegli una **metrica** (Offerte / Stipendio mediano / Stipendio medio) e una **dimensione** (Per paese / Per ruolo), e il grafico a barre si ridisegna all'istante. Le metriche salariali rispettano la valuta + l'interruttore all'anno ⇄ al mese; le offerte sono un semplice conteggio.
- 8 nuove chiavi i18n × **17 lingue**; snapshot 1200 → 1208.

### Note
- Verificato nel browser (0 errori console). Suite: **2372** test (+2).

## [1.144.0] — 2026-08-12

**Impostazioni e filtri (Fase 4, parte 1): abilita/disabilita i portali seguiti** — ora puoi accendere o spegnere un'azienda monitorata da `#/portals`, e lo scanner lo rispetta. Richiesta UX dell'utente (senza parent-sync).

### Aggiunto
- **Interruttore Abilita/Disabilita per azienda su `#/portals`** — un clic spegne un portale (lo scanner EN salta già le aziende con `enabled: false`, quindi un portale disabilitato esce da tutte le scansioni future) o lo riaccende, con un avviso ottimistico.
- **`POST /api/portals/toggle`** — una scrittura esplicita dell'utente che commuta chirurgicamente e con validazione di parsing il flag `enabled` di un'azienda in `portals.yml` (commenti, ordine e altri campi preservati). 5 nuove chiavi i18n × **17 lingue**; snapshot 1195 → 1200.

### Note
- La modifica allo scanner è stata **zero** — `en-scanner.mjs` filtra già `enabled !== false`. Suite: **2370** test (+3).

## [1.143.0] — 2026-08-12

**Comprensibile (segue): suggerimenti `?` sulle viste di lavoro principali** — il `?` di aiuto copre ora le nove pagine d'azione principali, in tutte le lingue. Aggiustamento UX segnalato dall'utente (senza parent-sync).

### Aggiunto
- **Suggerimento `?` su altri 9 titoli di viste** — `#/scan`, `#/evaluate`, `#/cv-studio`, `#/tracker`, `#/config`, `#/deep`, `#/batch`, `#/auto`, `#/apply` ricevono un `?` inline (via `HelpHint.title`) che apre un popover localizzato «cosa fa / come usarlo / cosa aspettarsi» — lo stesso componente sicuro per la CSP di v1.139.0.
- 9 nuove chiavi i18n × **17 lingue** (`help.hint.scan`/…/`apply`); snapshot 1186 → 1195.

### Note
- Verificato nel browser (0 errori console). Suite: **2365** test (+1).

## [1.142.0] — 2026-08-12

**Correzione: basta con l'archetipo di carriera "Unknown"** — `#/orientation` ora classifica sempre tra gli otto vettori di carriera nominati invece di rispondere talvolta "Unknown" e consigliarti di "puntarci di più". Correzione segnalata dall'utente (senza parent-sync).

### Corretto
- **`#/orientation` — il prompt IA vieta ora un archetipo fuori insieme.** Il modello DEVE classificare i primi tre tra esattamente gli otto vettori nominati e non **mai** rispondere "Unknown"/"N/A"/"dati insufficienti" né inventare un'etichetta. Con un CV scarno nomina comunque i tre più vicini con minore fiducia e dice quali prove mancano.

### Note
- Solo modifica del prompt server (`buildOrientationPrompt`); nessuna modifica i18n/schema. Suite: **2364** test (+1).

## [1.141.0] — 2026-08-12

**Statistiche perspicaci (segue): arricchimento delle aziende finanziate** — `#/funded` è ora più visivo: loghi aziendali, un grafico per importo di finanziamento e schede con round / importo / punteggio di scoperta / azione suggerita. Aggiustamento UX segnalato dall'utente (senza parent-sync).

### Modificato
- **`#/funded` — tabella piatta → griglia di schede.** Ogni azienda finanziata di recente è ora una scheda con **logo** (derivato dal nome via `CompanyLogo`, avatar a lettera come ripiego), chip di **round** + **importo**, il **punteggio di scoperta** e l'**azione suggerita** del progetto principale, oltre a link e data della notizia.
- **Visualizzazione dell'importo di finanziamento** — un grafico a barre delle maggiori aziende per importo divulgato; gli importi in testo libero ("$120M"/"€1.5B") vengono convertiti in grandezza da un nuovo `parseAmount`. 3 nuove chiavi i18n × **17 lingue**.

### Note
- Ancora **sola lettura** su `GET /api/company-funded`; descrizione e fascia salariale non sono nella fonte di finanziamento. Suite: **2363** test (+2).

## [1.140.0] — 2026-08-12

**Statistiche perspicaci: cifre salariali più ricche** — la ripartizione salariale di "La mia pipeline" su `#/stats` mostra ora la **media** (non solo la mediana), un interruttore **all'anno ⇄ al mese** e una tabella **min · media · mediana · max** per paese. Prima parte della Fase 3. Aggiustamento UX segnalato dall'utente (senza parent-sync).

### Aggiunto
- **Salario medio** — `RoleStats.salaryStats` ora restituisce `avgUsd` accanto a `minUsd`/`medianUsd`/`maxUsd`. La mediana resiste agli outlier, la media rivela l'asimmetria — insieme si leggono come una distribuzione.
- **Interruttore all'anno ⇄ al mese** e una **tabella min · media · mediana · max per paese** nella sezione salari, guidati dai selettori di valuta e periodo. 8 nuove chiavi i18n × **17 lingue**.

### Note
- Le cifre derivano ancora solo da annunci con salario leggibile e sono normalizzate in USD (indicative). Suite: **2361** test (+1).

## [1.139.0] — 2026-08-12

**Comprensibile: suggerimenti `?`** — un pulsante `?` riutilizzabile e sicuro per la CSP che, al clic, spiega «cosa fa / come funziona / cosa aspettarsi» nella tua lingua. Aggiustamento UX segnalato dall'utente (senza parent-sync).

### Aggiunto
- **Popover di suggerimento `?`** (`window.HelpHint`) — un `?` rotondo accanto a un titolo apre un popover leggero, adattato al tema e speculare in RTL, che mostra una spiegazione localizzata tramite `UI.md()`; accessibile (`role="tooltip"`, `aria-expanded`, chiusura con Esc/clic esterno, focus ripristinato) e sicuro per la CSP.
- **`?` sulle 5 schede di `#/stats`** e su **8 titoli di viste IA/analitiche** (career-plan, orientamento, two-pager, networking, colloquio simulato, memoria, funded, riepilogo settimanale) — 14 nuove chiavi i18n × **17 lingue**.

### Note
- Tutte le viste avevano già un sottotitolo di una riga; il `?` aggiunge la spiegazione più approfondita su richiesta e rende gli stati vuoti autoesplicativi. Suite: **2360** test (+4).

## [1.138.0] — 2026-08-12

**Generazione nella lingua della tua interfaccia** — ogni generazione IA ora risponde nella lingua scelta nell'UI, più rafforzamenti dei test emersi dalla revisione. Un aggiustamento UX segnalato dall'utente (senza parent-sync).

### Modificato
- **Le generazioni IA ora rispettano la lingua dell'interfaccia.** Con l'interfaccia in russo, spagnolo, giapponese, … il testo generato torna in **quella** lingua invece che sempre in inglese. La direttiva di lingua di output attraversa **tutti** gli endpoint di generazione — piano di carriera, orientamento, report di mercato, colloquio simulato, piano di networking, «chiedi alla documentazione», il suggerimento della nota di memoria e la bozza del two-pager. Codice e identificatori restano in inglese (es. le chiavi YAML del two-pager); solo prosa, titoli e punti vengono localizzati.

### Corretto
- **Guardia dei ruoli di colore CSS** (`tests/css-role-tokens.test.mjs`) — un canarino statico che i token alias della modalità scura di v1.137.0 non invertano mai il ruolo: i token di testo (`--fg`/`--danger`/`--ok`/…) mai come `background`, e quelli di superficie (`--card`/`--panel`/`--line`/…) mai come `color` di testo, in tutto il CSS e negli stili inline della SPA.
- **Auto-sonda del loader XSS di `UI.md()`** — il test che carica `md()` da `api.js` ora sonda `md('<script>…')` subito dopo l'estrazione e solleva un errore se manca l'escape, così un futuro taglio errato fallisce **rumorosamente** invece di lasciare verde la suite di sicurezza su una funzione troncata.
- **Guardia di scroll su `#/career-plan`** — lo `scrollIntoView` dopo la generazione viene eseguito solo se l'anteprima è ancora connessa al documento.

### Note
- `docs/UX-ROADMAP.md` aggiornato: i suggerimenti `?` + descrizioni di pagina + stati vuoti passano a **v1.139.0**; un provider **Nous Research / Hermes** — con una guida al deploy su server cloud + Telegram e uno skill Hermes — è tracciato come **Fase 5 / 5b**.
- Suite: **2356** test (+5).

## [1.137.0] — 2026-08-11

**Correzioni di leggibilità e rendering** — contrasto in modalità scura, etichette dei grafici e il piano di carriera. Un intervento UX segnalato da un utente (nessun parent-sync).

### Corretto
- **Bianco su bianco / nero su nero in modalità scura su molte schermate** — quindici proprietà CSS personalizzate referenziate da diverse viste (`--fg`, `--panel`, `--panel-2`, `--ok`, `--danger`, `--card`, …) non erano mai state dichiarate, quindi ricadevano su valori chiaro/nero hardcoded: corretto in modalità chiara, illeggibile in modalità scura (i chip di panoramica di `#/pipeline`, la tab attiva di `#/stats`, "Attivo / Chiavi" + "✓ impostato" di `#/config`, le sezioni di `#/two-pager`, il fumetto della domanda di `#/mock-interview`, il testo di errore). Ora sono aliasate ai veri token theme-aware, quindi seguono automaticamente il tema — **0 violazioni di contrasto WCAG-AA su tutte le 29 viste**, verificato da un revisore automatico; la tab attiva di `#/config` è passata a uno stile con tinta più leggibile. Una guardia di regressione (`tests/dark-theme-tokens.test.mjs`) mantiene l'aliasing.
- **Le etichette dei grafici di `#/stats` venivano troncate a metà parola** ("Senior Backend Engineer" → "…Enginee") — ora vengono troncate con ellissi, mantenendo l'etichetta completa come tooltip al passaggio del mouse.
- **`#/career-plan` mostrava il piano generato come Markdown non elaborato** — ora viene renderizzato automaticamente come testo formattato e leggibile (il Markdown modificabile resta nella textarea; il pulsante Anteprima lo attiva/disattiva).

### Note
- `#/career-plan`, `#/two-pager`, `#/stats` e il digest settimanale dei colloqui non sono rotti — mostrano stati vuoti finché non generi un piano o non hai dati. Indicazioni più chiare in pagina e suggerimenti di aiuto `?` sono previsti come prossimo passo (`docs/UX-ROADMAP.md`).

## [1.136.0] — 2026-08-11

Parità con il career-ops padre **v1.26.x** (mainline post-v1.26.0) — una nuova sorgente a zero autenticazione più un'ondata di port di qualità e robustezza ai mirror di web-ui. Il registro ora conta **79 sorgenti = 74 EN + 5 RU** (`ALL_ADAPTERS` 74).

### Aggiunto
- **`eightfold`** (Eightfold AI, #2684) — bacheche di talent-acquisition tramite l'API a zero autenticazione `https://<tenant>.eightfold.ai/api/apply/v2/jobs`, fissata sull'host `*.eightfold.ai` (il CNAME brandizzato `careers.<company>.com` è deliberatamente rifiutato); paginata con un tetto di sicurezza, errore su bacheca morta, deduplica degli URL. Sorgente + adattatore + suite CI-isolata; compare nel filtro Sorgente di `#/scan` e sulla landing.

### Corretto
- **Deduplica e chiavi di ruolo sensibili a Unicode** (#2569 / #2587 / #2667) — una nuova `normalizeTextKey` condivisa (NFKC, mantiene lettere/segni/cifre di qualsiasi script) sostituisce le chiavi solo-ASCII: `detect-reposts` ora raggruppa le varianti di larghezza/punteggiatura dell'azienda ("Acme, Inc." ≡ "Acme Inc") e non collassa mai datori di lavoro distinti non latini, mentre `role-matcher` unifica i titoli a larghezza piena e mantiene i token di ruolo non latini invece di eliminarli.
- **`fetchJsonWithRetry` non ripete più un reindirizzamento rifiutato** (#2657) — una guardia `redirect:'error'` che incontra un 3xx è deterministica, quindi ora non è ripetibile e fallisce rapidamente invece di consumare il budget di retry.
- **Gruppi AND con ` + ` in `title_filter.positive`** (#2552) — un ` + ` delimitato da spazi all'interno di una voce positiva ora richiede che ogni termine appaia nel titolo, in qualsiasi ordine.
- **`oraclecloud` accetta gli apici tenant numerati** `oraclecloud1.com … oraclecloud99.com` (#2683) — una famiglia limitata (nessuno zero iniziale, ≤ 2 cifre), mai un apice wildcard.
- **`workable` irrobustita** (#2675) — retry, header simil-browser e serializzazione delle richieste contro l'host dietro Cloudflare.
- **`personio` ricorre a uno scraping HTML** quando il feed XML è disabilitato, invece di non restituire nulla.
- **Alias FALLBACK di `states` risincronizzati** con il padre (#2615).

### Note
- Non portato (non specchiato da web-ui, o solo CLI): reply-matcher (#2672), jd-similarity (#2661), jd-skill-gap (#2686), il parsing di scan env-path (#2568) / `--flag=value` (#2589), e le modifiche a cover-letter / template CV / doctor / ollama / generate-pdf. Gli avvisi HIGH web `js-yaml`/`nanoid` erano già stati corretti in web-ui v1.135.0.

## [1.135.0] — 2026-08-11

Parità con career-ops padre **v1.26.0** — cinque nuove sorgenti di scansione a zero autenticazione più correzioni di correttezza a quattro bacheche già presenti in web-ui. Il registro ora conta **78 sorgenti = 73 EN + 5 RU** (`ALL_ADAPTERS` 73).

### Aggiunto
- **Cinque nuove sorgenti di scansione** (ciascuna con una sorgente + adattatore + suite CI-isolata; compaiono nel filtro Sorgente di `#/scan` e sulla landing di cvstart.org):
  - **`join`** (JOIN) — la bacheca JOIN di un'azienda ricavata dal `__NEXT_DATA__` di Next.js in `join.com/companies/<slug>` (host fissato, pagine limitate).
  - **`getro`** (Getro) — bacheche di portfolio "talent-network" dei VC tramite l'API pubblica POST `api.getro.com`, paginata dal più recente; ogni lavoro è attribuito all'azienda del portfolio, non al fondo.
  - **`consider`** (Consider) — bacheche di portfolio VC di getconsider.com tramite una POST same-origin; l'host configurabile è fissato da una guardia SSRF strutturale (solo host HTTPS pubblico).
  - **`joinup`** (JOINUP) — la bacheca svizzera joinup.ch, che legge la pagina più recente renderizzata lato server; si blocca (fail-closed) in caso di rottura dello scraper.
  - **`remotli`** (Remotli) — remotli.ch, ruoli da remoto presso aziende svizzere (stipendi in CHF); emette l'URL di candidatura ATS proprio del datore di lavoro, così le inserzioni incrociate vengono deduplicate.

### Corretto
- **a16z Speedrun non interrompe più l'intera bacheca per un intoppo transitorio** — i fetch delle pagine ora passano attraverso un `fetchJsonWithRetry` condiviso (tentativi limitati solo su 429/5xx/timeout transitori, mai su un 4xx permanente), e il budget di pagina è stato ridimensionato per la pagina da 50 lavori.
- **arbeitsagentur è passata alla API Jobsuche v6** (`/pc/v6/jobs`) — il vecchio endpoint v4 restituisce 404; la forma della risposta è stata rinominata e il filtraggio remoto ora si restringe lato server.
- **thehub è passata alla API v2 `jobsandfeatured`** — le righe non portano una data di pubblicazione e sono esenti dal filtro per età.
- **hackernews trova ora in modo affidabile il thread mensile "Who is hiring?"** filtrando la ricerca Algolia sul tag account `author_whoishiring` invece che su una query in testo libero.

### Note
- Non portato (web-ui è già sicuro, assorbito dall'inoltro, o solo CLI): le chiavi di deduplicazione ruoli / corrispondenza aziende Unicode (il raggruppamento dei ripescaggi di web-ui fa già chiave sull'azienda in minuscolo semplice, quindi datori di lavoro distinti non latini non collassano mai); il segnale di latenza di rifiuto del follow-up + le rifiniture di company-funded (inoltrati in sola lettura, fail-soft); i percorsi di scansione sovrascrivibili da variabili d'ambiente e il parsing `--flag=value` (web-ui esegue gli scanner in-process); il refactoring di consolidamento dello User-Agent (web-ui lo centralizza già); e le voci solo CLI (elenco contenuti non attendibili, oferta/offer-prep, doctor, modifiche ai template CV/lettera di presentazione).

## [1.134.1] — 2026-08-05

Irrobustimento della validazione — correzioni emerse da un audit a livello di intero progetto.

### Corretto
- **`successfactors` non scarta più i lavori raccolti in caso di fallimento a metà scansione** (regressione nel port v1.134.0 dell'errore su bacheca morta) — il suo ciclo di paginazione non aveva alcun `try/catch`, quindi un fallimento a pagina 2 o successiva (dopo il successo della pagina 1) generava un errore e scartava tutto ciò che era già stato raccolto; e se quel fallimento era un `404` (uno `startrow` fuori intervallo), `en-scanner` metteva in quarantena per giorni un tenant in realtà attivo. Ora rispecchia `phenom`/`radancy`: un fallimento a pagina 0 genera ancora un errore (bacheca morta), ma un fallimento su una pagina successiva mantiene i risultati parziali.
- **Le chip dei filtri di `#/scan` sono ora azionabili da tastiera** (WCAG 2.1.1) — le chip delle facet (e la chip "pulisci") erano span con un gestore di click ma senza `tabindex`/ruolo, quindi gli utenti che usano la tastiera o uno screen reader non potevano raggiungerle né attivarle. Ora portano `role="button"`, `tabindex="0"`, `aria-pressed` e l'attivazione con Invio/Spazio.
- **Tre stringhe inglesi hardcoded sono ora localizzate** — il tooltip del badge di affidabilità di `#/scan`, l'intestazione della colonna di trasferimento di `#/scan` e l'intestazione del punteggio di `#/dashboard` erano letterali nudi che il gate di parità i18n non poteva rilevare (non erano mai state chiavi), quindi restavano in inglese in ogni localizzazione non inglese. Ora `scan.trustTip` + `scan.col.reloc` (2 nuove chiavi) più un riuso di `track.col.score`, con una guardia source-static.

## [1.134.0] — 2026-08-05

Parità con career-ops padre v1.25.0.

### Aggiunto
- **Nuova sorgente di scansione: getManfred** (`manfred`) — un feed a livello di board di ruoli tech spagnoli/UE con stipendi pubblicati, da `www.getmanfred.com/api/v2/public/offers` (zero autenticazione, host fissato + solo HTTPS, catalogo completo in una singola richiesta). Sorgente + adattatore + una suite CI-isolata (`tests/sources-manfred.test.mjs`); il registro ora conta **73** sorgenti = 68 inglesi + 5 russe (`ALL_ADAPTERS` 68). Compare nel filtro Sorgente di `#/scan` e sulla landing di cvstart.org.

### Corretto
- **Il feed a16z Speedrun si troncava silenziosamente a 50 lavori** (#2404) — il feed limita una pagina a 50, ma la sorgente richiedeva `PER_PAGE = 100`, quindi la paginazione si fermava dopo la pagina 1. Corretto a 50.
- **Le bacheche morte ora generano un errore invece di leggersi come "attive ma vuote"** (#2379) — `cryptocurrencyjobs`, `phenom`, `radancy`, `successfactors`: un fallimento di fetch in cui nessuna richiesta si risolve mai ora genera un errore (così `#/portals` health e la scansione registrano un vero fallimento), invece di ridurlo silenziosamente a un elenco vuoto; un fallimento a metà scansione dopo almeno un successo mantiene i risultati parziali.
- **workable ora usa l'API pubblica del widget** (#5ab8425) — passato a `apply.workable.com/api/v1/widget/accounts/<slug>`, che restituisce in un'unica richiesta l'elenco completo degli annunci di un account grande, così gli account grandi non vengono più troncati.

### Note
- Non portato (solo CLI o non replicato da web-ui): la riscrittura delle prestazioni con bucket per titolo di detect-reposts #2389; le correzioni per chiavi aziendali Unicode (la deduplicazione del tracker di web-ui è già sicura per caratteri non latini); `scan --since`; `cv-facts`; il passaggio di audit su template CV / PDF; `doctor`; la direttiva sui contenuti non attendibili delle modalità.

## [1.133.1] — 2026-08-02

### Corretto
- **`#/funded` (Aziende finanziate) ora mostra i risultati** — due bug facevano sì che la tabella mostrasse sempre "nessuna azienda finanziata" anche quando `company-funded.mjs` del padre restituiva un elenco completo. (1) La vista leggeva i risultati sotto `res.candidates`, ma il padre li emette sotto `companies` (ciascuna `{ company, amount, round, funding: { sources: [{ source, url, observed_date }] } }`); il client ora legge la chiave corretta e mappa la forma reale delle prove. (2) La tabella dei risultati passava le proprie celle a `UI.el('tr', {}, …)` come argomenti variadici, ma `UI.el(tag, attrs, children)` si aspetta `children` come un singolo nodo o un array, quindi veniva renderizzata solo la prima colonna (Azienda) — ora le celle vengono passate come array. Verificato in un browser reale: 11 aziende dai quattro feed vengono renderizzate con le colonne Azienda / Segnale di finanziamento / Fonte / Data e link alle prove funzionanti, zero errori console. Un passaggio vuoto ora mostra anche la diagnostica per fonte, così un giorno di notizie tranquillo si distingue da un feed bloccato.
- Guardie di regressione in `tests/parity-routes-v1133.test.mjs`: lo script fittizio del padre ora emette la forma reale di output `companies` (il fixture originale rispecchiava erroneamente la forma `candidates` — proprio il motivo per cui il bug è stato pubblicato con la suite verde), oltre a canarini source-statici che verificano che `funded.js` legga `res.companies` (mai `res.candidates`) e costruisca le righe della tabella con figli in forma di array (+1 → 2144).

## [1.133.0] — 2026-08-01

### Aggiunto
- **Scoperta aziende finanziate (`#/funded`, parità col padre #2117)** — una nuova vista di sola lettura che inoltra lo script `company-funded.mjs` del career-ops padre tramite `GET /api/company-funded`: un elenco a revisione preventiva di aziende recentemente finanziate, scoperte da feed pubblici di finanziamento con host fissato (TechCrunch, PR Newswire, The Guardian, Hacker News). L'inoltro esegue lo script con `--json --dry-run` (JSON su stdout, nessuna scrittura su file), non passa mai l'input dell'utente in `--sources`, applica un limite di frequenza ed è attivato dall'utente (un pulsante Scopri, mai al montaggio). Nuovo modulo di rotta `server/lib/routes/funded.mjs` + `public/js/views/funded.js`, sotto Sourcing.
- **Digest settimanale dei colloqui (`#/interview-digest`, parità col padre #2129/#2130)** — una nuova vista di sola lettura che inoltra lo script zero-LLM `weekly-digest.mjs` del padre tramite `GET /api/interview/weekly-digest`: un riepilogo meccanico delle note di sessione dei colloqui — con quali aziende e in quali fasi hai fatto colloqui questa settimana, competenze ricorrenti e lacune aperte stimate al meglio. L'intervallo opzionale `?from=&to=` viene passato solo quando ENTRAMBI sono `YYYY-MM-DD` validi; un intervallo vuoto è un digest `available:true` valido. Aggiunto a `server/lib/routes/interview.mjs` + `public/js/views/interview-digest.js`, sotto Analytics.
- Entrambi gli inoltri seguono il contratto consolidato fail-soft `available:false` quando lo script del padre è assente (CI, installazioni standalone). 26 nuove chiavi i18n ×17 locale; suite CI-isolata `tests/parity-routes-v1133.test.mjs` (+5 → 2143).

### Note
- Il career-ops padre è avanzato oltre la v1.24.0 con la pagina Follow-up Tracker dell'app web/ Next.js (#1422) e il rendering PDF lato backend (#2182) — non portati: web-ui ha già un proprio inoltro follow-up e i propri runner PDF, e l'irrobustimento sottostante di `followup-cadence.mjs` arriva gratis tramite l'inoltro con shell-out. Le modifiche a `set-status.mjs` / `tracker-utils.mjs` sono interne alla CLI e non vengono replicate.

## [1.132.0] — 2026-07-31

### Modificato
- **Il sottosistema di rendering dei risultati di `#/scan` è stato estratto in `public/js/lib/scan-results.js`** (debito da contratto sulla dimensione dei file — `public/js/views/scan.js` era cresciuto a ~1254 LOC). Il sottosistema — `renderResults`, `buildChipRow`, `getRows`, i builder di righe/faccette, i pittori delle opzioni e lo specchio del registro `FALLBACK_SOURCES` — si è spostato in una factory `window.ScanResults.create(ctx)` che chiude su un oggetto di contesto fornito dalla vista. **Nessuna modifica di comportamento** — le funzioni sono state spostate testualmente, le variabili di chiusura ricollegate meccanicamente a `ctx.*`; `scan.js` è ora ~906 LOC (è pianificato un secondo passaggio di estrazione verso l'obiettivo di 800 LOC).
- I test source-static leggono entrambi i file tramite `tests/helpers/scan-src.mjs::loadScanSrc()`; `tests/scan-fallback-sources.test.mjs` ora legge lo specchio del registro da `scan-results.js`.
- **Nuovo gate di regressione in-browser** — `tests/playwright-scan-filters.mjs` semina un `data/last-scan.json` predefinito e guida ogni filtro di `#/scan`, verificando i conteggi esatti delle righe (`npm run test:e2e:browser`); sono stati aggiunti id stabili per i controlli dei filtri (`#scan-filter-*`, `#scan-apply`).
- Il banner "Ultima release" del README è stato snellito a un riepilogo di una riga + un link al changelog completo (il lungo muro narrativo multi-versione è stato ritirato). Applicato in tutte le 17 localizzazioni.

## [1.131.2] — 2026-07-31

### Modificato
- **`app.css` diviso in tre fogli di stile ordinati** (debito da contratto sulla dimensione dei file — il singolo file era cresciuto a ~1990 LOC, ben oltre il limite rigido di 800 LOC). Ora è `app.css` (~672 — accessibilità, token di design/tema, sidebar, main, pulsanti, content-shell), **`components.css`** (~595 — card, griglie, paginatore, badge, tabelle, form, log/console, markdown, selettore lingua, filtro a chip, banner di connessione) e **`overlays.css`** (~737 — toast, cassetto notifiche, modale, varie/responsive, lo specchio `[dir="rtl"]`, docs-fab, usage-hud), ciascuno entro il limite rigido.
  - Il taglio è **contiguo e in ordine**, quindi la cascata è **identica byte per byte** al file pre-divisione; `index.html` carica i tre come `<link>` ordinati. **Nessuna modifica di comportamento, markup o i18n.**
  - I test che verificano il CSS ora leggono la concatenazione tramite un helper condiviso `tests/helpers/css.mjs::loadAppCss()`. Il nuovo `tests/css-modularization.test.mjs` blocca la divisione (i file esistono · ciascuno ≤ 800 LOC · ordine dei link in index.html) → suite **2138**. Verificato nel browser: tutti e tre i fogli di stile vengono analizzati e le loro regole vengono applicate.

## [1.131.1] — 2026-07-31

### Corretto
- **Coerenza del pinning dell'host degli adattatori sulle due sorgenti v1.130.0** (follow-up di code review, difesa in profondità; nessuna modifica di comportamento per input validi):
  - L'adattatore **`a16z-speedrun-talent`** ora rivalida l'override `api:` / `a16z-speedrun-talent:` in `buildEndpoint` (HTTPS + host esatto `speedrun-talent-network.com`) e torna al feed canonico quando la validazione fallisce — parità con l'adattatore `cryptocurrencyjobs`, così un valore fuori host non raggiunge mai lo slot di fetch (in precedenza si basava solo sulla guardia a tempo di fetch `assertSpeedrunUrl`). Il controllo dell'host esatto è ora una singola `SPEEDRUN_TALENT_HOST_RE` esportata, condivisa dalla guardia e dall'adattatore.
  - Il **parser `cryptocurrencyjobs`** — `cleanUrl` ora usa la stessa guardia dell'host a corrispondenza esatta di `assertCryptocurrencyJobsUrl` e dell'override dell'adattatore (era `endsWith`, che accettava sottodomini). Il parser non è mai più permissivo della guardia SSRF: un link di elemento `sub.cryptocurrencyjobs.co` viene scartato.
  - +2 test → suite **2135**.

## [1.131.0] — 2026-07-31

### Aggiunto
- **Bacheca a schede di stadio (CRM) per `#/tracker`** (portata dalla vista `/pipeline` dell'app web del padre). La barra a chip del funnel + il menu a tendina di stato del tracker sono sostituiti da una **striscia di schede di stadio**: una scheda **Tutti** più una scheda per ogni stato canonico — **Evaluated · Applied · Responded · Interview · Offer · Rejected · Discarded · SKIP · Hired** — ciascuna con un conteggio live sull'intera cronologia, **incluse le fasi a conteggio zero** così l'intero funnel è sempre visibile (l'aspetto CRM). La scheda attiva guida il filtro; un secondo clic la deseleziona tornando a Tutti. Le righe mantengono la tonalità del punteggio, la legittimità e le funzioni PDF e report, e la cella dell'azienda ora mostra un logo del brand quando i loghi sono abilitati (disattivati di default → zero richieste extra).
  - Nuova rotta di sola lettura **`GET /api/tracker/stages`** restituisce il funnel canonico (etichette in ordine) + una mappa di fusione degli alias, presa da `server/lib/states.mjs` (`templates/states.yml`, con il fallback integrato) — così il client **non codifica mai staticamente la whitelist di stato**. La risposta legacy senza parametri di `GET /api/tracker` è invariata (solo `{ rows }`).
  - Nuova libreria client pura e testata a livello di unità **`public/js/lib/tracker-stages.js`** raggruppa le righe secondo gli stadi del server, tollerando grassetto markdown residuo e alias localizzati (es. `aplicado` → `Applied`). Le schede sono accessibili (role tablist/tab, aria-selected, area di tocco ≥44 px, conteggi nel nome accessibile di ciascuna scheda). Nessuna nuova chiave i18n. Suite **2133**.

## [1.130.0] — 2026-07-31

### Aggiunto
- **Due nuove sorgenti di scansione portate dal career-ops del padre v1.24.0** (in-process, senza nuove dipendenze; entrambe compaiono nel filtro Sorgente di `#/scan` e sulla landing di cvstart.org):
  - **a16z Speedrun** (`a16z-speedrun-talent`, #2231) — il feed JSON dell'intera bacheca della *talent-network* a16z Speedrun. Fissato all'host `speedrun-talent-network.com`, solo HTTPS, paginazione a indice 0 con un tetto di pagine, threading di `q`/config per azienda, fail-soft.
  - **Cryptocurrency Jobs** (`cryptocurrencyjobs`) — il job board Web3 `cryptocurrencyjobs.co`, acquisito tramite il suo feed pubblico RSS 2.0 (zero autenticazione). Decodifica delle entità XML in due passaggi, annunci solo remoti, datore di lavoro estratto dalla coda del titolo `"… at <Azienda>"`.
  - Il totale del registro è ora **72 sorgenti = 67 inglesi + 5 russe** (`ALL_ADAPTERS` = 67 adattatori di portali inglesi).

### Corretto
- **`echojobs` — i ruoli ibridi restano distinguibili dal remoto** (rispecchia il #2258 del padre). Un marcatore `hybrid` case-insensitive ora produce `"<Città> · Ibrido"` (o un semplice `Ibrido` in assenza di città) e `workplaceType: 'Hybrid'`, invece di essere collassato in `Remoto`.
- **`radancy` — markup legacy TalentBrew + trasporto del frammento di risultati JSON** (rispecchia il commit del padre a3e6df9), condizionato da un `opts.fetchJson` iniettabile.

### Note
- **Non portato — funzionalità del padre solo CLI.** L'ampia superficie CLI/modalità di career-ops v1.24.0 resta fuori da web-ui, che è un visualizzatore + scrittura passante sottile, non un host di modalità: le tabelle di conformità/giurisdizione, la rubrica contatti + vCard, il debrief da trascrizione colloquio / rilevamento piattaforma di chiamata, l'impostazione stato del ledger, la registrazione degli esiti, il triage a due passaggi, la similarità delle JD, lo schema versionato degli artefatti CV di candidatura, il rilevamento doctor di Playwright-MCP e `portals/fix-slugs.mjs`. Le modifiche di orchestrazione della scansione che vivono nello `scan.mjs` del padre — lo scanner Playwright per Interamt.de, lo sweep completo iCIMS reverse-ATS, il filtro di idoneità paese per il remoto, il pacing delle ricerche DNS, la deduplica `rltr` di StepStone e la colonna azienda normalizzata nella cronologia scansioni — non si applicano: web-ui esegue gli scanner EN/RU in-process e non passa per `scan.mjs`.
- **Già coperto.** La correzione di accent-folding di `role-matcher` (#2209) è stata portata in v1.127.0, quindi qui è un no-op.

## [1.129.1] — 2026-07-29

### Corretto
- **Follow-up della revisione IA sui port web di v1.128/v1.129** (tutti consultivi, corretti all'origine): precedenza di livello in `job-facets.js` (un modificatore esplicito ora batte una parola di gestione — `Senior Engineering Manager` → `senior`, prima `lead`); il fallback in `states.mjs` non è più bloccato (una lettura riuscita è memoizzata, il fallback è restituito senza cache — un padre momentaneamente non disponibile al boot viene riletto alla chiamata successiva) + `console.warn` su un file presente ma malformato; `score-tone.js` — una riga senza punteggio è neutra (`muted`), non rossa; `domainFromName()` salta gli slug non-ASCII prima di `/api/logo`; +una guardia di isolamento in `tests/states.test.mjs`. +4 test → **2073**.

## [1.129.0] — 2026-07-29

### Aggiunto
- **Faccetta Livello + colonna Età su `#/scan`** — la libreria `job-facets.js` rilasciata in v1.128.0 è ora collegata alla UI di scansione (prima solo logica). Un nuovo menu **Livello** classifica il titolo di ogni offerta in lead/staff/senior/intermedio/junior/stagista (`JobFacets.seniorityFromTitle`) e si autopopola da ciò che c'è nei risultati (come la faccetta Paese); i titoli senza parola di livello passano sempre. Mantenuta in ricerche salvate, Reimposta e Applica. La tabella guadagna una colonna **Livello** (badge) e una colonna **Età** senza token (`oggi` / `Ng`, da `JobFacets.daysSince`). 12 chiavi i18n ×17, +3 test → **2069**.

## [1.128.0] — 2026-07-29

### Aggiunto
- **Quattro soluzioni portate dalla web app propria del padre (`../web/`, Next.js)**, reimplementate in JS vanilla/ESM, senza nuove dipendenze: (1) `server/lib/states.mjs` legge `templates/states.yml` dal vivo come vocabolario canonico degli stati del tracker (fallback CI) — elimina il re-sync manuale della whitelist a ogni release; POST ripiega gli alias (spagnolo/legacy) sull'etichetta canonica, il funnel di GET raggruppa per stato canonico; (2) loghi aziendali sulle righe con host ATS via `domainFromName()` (~90 brand→dominio); (3) `score-tone.js` — tono di punteggio a 4 livelli (≥4.2/3.8/3.0 + fallback a lettera); (4) `job-facets.js` — facet seniority/source/days. +21 test.

### Note
- Non portato (solo concetto): il livello di azioni agentiche del padre (`actions/registry.ts` + `api/assistant/route.ts`) — progetto per quando `docs-fab` diventerà un copilota. Nessuna nuova sorgente (registro **70**), nessuna modifica i18n/help.

## [1.127.0] — 2026-07-29

### Aggiunto
- **Tre nuove sorgenti di scansione (parità career-ops v1.23.0)** — il registro conta ora **70 adattatori (65 EN + 5 RU)**: **Flowxtra** (aggregatore globale senza auth), **VDAB** (API per parola chiave del servizio pubblico per l'impiego fiammingo) e **iCIMS** (portali `careers-<tenant>.icims.com`, distinto da `jibeapply`). Inoltre **Cursor** torna nel roster delle CLI (parent #2115): `cli-detect` ora rileva `cursor` (**10 strumenti**), roster ripristinato in help/README/config ×17.

### Corretto
- **agenticjobs** è passato dallo scraping HTML all'API REST (#2167); **Greenhouse** recupera la città da `/offices` quando `location.name` è solo un modello di lavoro (#2104); parità **role-matcher** (#1933/#2164/#2009: prefisso MTS, baseline `product`, ripiegamento accenti, disaccordo sub-baseline).

### Note
- **Non portato.** Gran parte di v1.23.0 è superficie CLI/dashboard che web-ui non usa (batch-tailor, discover-ats, modi NL/PT, temi PDF, dashboard Go, updater/doctor); gli script relayati non cambiano. VERSION del padre → **1.23.0**.

## [1.126.1] — 2026-07-25

### Corretto
- **Due punti di deriva del roster CLI che il resync di v1.126.0 ha mancato** — (1) l'intro della scheda **API keys** di `#/config` (`config.providerModelNote`, i18n ×17) elencava solo 7 CLI — ora **Antigravity** e **Grok Build** sono inseriti dopo OpenCode; (2) una seconda riga della tabella comparativa nella guida di aiuto (×17) e l'help del sito (costruito in CI) riportavano ancora `Inside Claude Code / Codex / Cursor / Gemini CLI` — il set obsoleto con **Cursor** — ora il roster completo. Entrambi usavano separatori slash/punto medio che i pattern dello sweep v1.126.0 non coprivano. Snapshot i18n rigenerato; la suite resta a **1969**.

## [1.126.0] — 2026-07-25

### Aggiunto
- **La scheda strumenti AI CLI ora rileva tutte le 8 CLI di prima classe di career-ops** — il roster di `#/config` è stato sincronizzato con il `docs/SUPPORTED_CLIS.md` del padre: `server/lib/routes/cli-detect.mjs` guadagna **Grok Build CLI** (`grok`) e **Kimi CLI** (`kimi`), e Antigravity ora sonda per primo il suo binario canonico `agy`. La scansione PATH in sola lettura ora riporta **9 strumenti**; continua a non eseguire mai un binario trovato.

### Modificato
- **Risincronizzazione della documentazione con career-ops.org/docs** — ogni superficie di docs è stata riconciliata con le pagine live del padre (lette tutte e 31). Il roster canonico di assistenti IA (help ×17 + README ×17) elenca ora le 8 CLI di prima classe — Claude Code, Codex, OpenCode, Antigravity CLI, Grok Build CLI, Qwen Code, Kimi, GitHub Copilot CLI — più Gemini CLI (wrapper legacy). I bundle di aiuto mantengono la struttura 29 H2 / 105 H3.

## [1.125.4] — 2026-07-23

### Modificato
- **dipendenze di site** (dependabot #151–#153) — `sharp` 0.34.5→0.35.3, `svgo` 4.0.1→4.0.2, `fast-uri` (dev) 3.1.3→3.1.4 in `site/`; build Astro verde, nessun impatto su SPA/server.

### Note
- **Sweep di parità col progetto padre (career-ops `37d17ec..254764a`, post-v1.22.0)** — niente da portare: il guard della riga sbagliata di `set-status` (#2108) è solo CLI (in web-ui le righe del tracker si selezionano esplicitamente nella UI e nessuna route invoca `set-status.mjs`), il Risk Summary dei modi localizzati (#2109) tocca file `modes/<lang>/` che web-ui non legge mai (solo `modes/*.md` di primo livello), la verifica del manifest di `update-system` (#2111) riguarda solo l'updater, e il resto è documentazione del padre (README turco, SIGNATURES ×4, SCRIPTS.md, accenti es). Il VERSION del padre resta **1.22.0** — `parentVersion` invariato.

## [1.125.3] — 2026-07-23

### Corretto
- **I prompt LLM in danese e hindi rispondevano in inglese** (segnalato da un utente) — `LOCALE_NAMES` e i cinque blocchi `SCAFFOLD_STRINGS` in `server/lib/prompts.mjs` non erano mai stati estesi a `da` e `hi`, quindi `resolveLocale()` ricadeva su `en` e ogni prompt AI — deep research (live e manuale), modalità, valutazione, colloquio, networking, CV Studio — perdeva la direttiva `# Output language` in quelle due lingue. Entrambe sono ora di prima classe: direttiva di lingua + impalcatura localizzata. Il gate di regressione in `tests/locale-scaffold.test.mjs` ora scorre l'elenco canonico di 17 locale invece di 12 hardcoded, e un nuovo gate strutturale fa fallire qualsiasi chiave dell'impalcatura che ricade sull'inglese — una futura locale che dimentichi `prompts.mjs` non può più essere pubblicata (+12 test, la suite è ora **1969**).

## [1.125.2] — 2026-07-22

### Corretto
- **Deep research via Gemini: HTTP 502 (`MALFORMED_FUNCTION_CALL`)** (#145, contributo di [@Alien10140](https://github.com/Alien10140)) — il prompt live di `/api/deep` chiedeva al modello di «Use WebFetch / WebSearch» e di salvare il brief su file, ma i provider API headless non hanno un canale strumenti; Gemini rispondeva con una chiamata di funzione invece che con testo, manifestandosi come un 502 vuoto. `buildDeepPrompt` e `bundleProjectContext` accettano ora un flag `headless`: le esecuzioni live (Anthropic/Gemini/cascata di fallback) ricevono un prompt senza strumenti che scrive il brief dal contesto inlineato, mentre il prompt copia-incolla per Claude Code mantiene le istruzioni sugli strumenti. +1 test in `tests/critical-fixes.test.mjs`.

### Modificato
- **Modelli Gemini predefiniti aggiornati oltre il deprecato `gemini-2.0-flash`** (#144, contributo di [@Alien10140](https://github.com/Alien10140)) — il menu a tendina della Configurazione, il fallback server in `gemini.mjs` (che divergeva in silenzio dal suggerimento), la catena di fallback OpenRouter, `config.geminiModelHint` ×17 e la guida ×17 ora indicano tutti **`gemini-3.6-flash`**. Il nuovo gate anti-deriva `tests/gemini-default-model.test.mjs` (+5 test) fissa tutte le superfici sullo stesso letterale — la suite arriva a **1957 test**.

## [1.125.1] — 2026-07-21

### Corretto
- **SuccessFactors: i tenant RMK multi-brand mantengono il proprio percorso di brand** (parent #2099, post-v1.22.0) — le holding che gestiscono più brand acquisiti da un'unica istanza RMK condivisa li distinguono tramite un segmento di percorso (`careers.nemetschek.com/Bluebeam/` contro `…/Vectorworks/`); l'adattatore in precedenza collassava l'URL configurato alla sua origine, scansionando silenziosamente gli annunci del brand principale. L'endpoint ora preserva il prefisso di brand, rimuovendo solo un segmento finale `/search/` o `/tile-search-results/` così che nulla si duplichi mai su se stesso; i tenant a dominio singolo restano invariati byte per byte. Nuovo helper esportato `resolveTenantBase` + 1 blocco di test portato in `tests/sources-successfactors.test.mjs`.

## [1.125.0] — 2026-07-21

### Aggiunto
- **cvstart.org: sezione "Fonti di lavoro" nella landing** — una nuova sezione tra gli screenshot e il confronto elenca **tutte le 67 sorgenti di scansione come chip cliccabili** (62 board/ATS in inglese + le 5 board russe sotto un proprio sottotitolo), ciascuna con link al sito pubblico della sorgente. L'elenco è sincronizzato con il registro degli adattatori dal vivo in fase di build (`sync-assets.mjs` → `facts.sources`), così non può mai disallinearsi dall'app; una mappa di link curata in `Sources.astro` è protetta dalla nuova `tests/site-sources.test.mjs`. La navigazione dell'header ha guadagnato un'ancora **Fonti**; 4 nuove chiavi i18n del sito ×17. È stato corretto anche l'elenco `inLanguage` del JSON-LD della landing, a cui mancava ancora `hi`.

## [1.124.0] — 2026-07-21

### Aggiunto
- **Cinque sorgenti di scansione** (parità con il parent v1.22.0, #1808/#1572/#2024/#2055) — **Welcome to the Jungle** (API JSON per l'intero board), **Agentic Engineering Jobs** (board di ingegneria agentica/IA), **Jobvite** (ATS per-tenant a zero autenticazione), **Gem** (ATS per-tenant) e **Alibaba Group** (API JSON delle pagine carriere, pattern Meituan/Tencent). Ognuna è una coppia sorgente + adattatore ancorata all'host e isolata per la CI; il registro ora conta **67 adattatori (62 inglesi + 5 russi)**; il fallback del menu a tendina Source di `#/scan` e il relativo gate di deriva sono aggiornati; cinque nuove suite `tests/sources-{wttj,agenticjobs,jobvite,gem,alibaba}.test.mjs`.

### Corretto
- **Arbeitsagentur: full-remote a livello nazionale solo quando `homeofficetyp` è `VOLLSTAENDIG`** (parent #1981) — la query `homeoffice=nv_true` restituisce anche ruoli ibridi, quindi il passaggio remoto ora conferma ogni risultato rispetto all'endpoint di dettaglio dell'offerta in piccoli batch e fallisce in modo sicuro (un errore di lookup mantiene la città reale dell'offerta, così i filtri di località continuano ad applicarsi).
- **SmartRecruiters: gli URL pubblici delle offerte venivano costruiti senza `/postings/`** (parent #2047) — i link ora atterrano sulla pagina pubblica dell'offerta invece di un 404 per i tenant il cui sito pubblico omette il segmento.

### Note
- La v1.22.0 del parent ha anche introdotto modifiche lato CLI che la web UI non richiama via shell o che già copre: il template CV zh-CN + la tipografia del PDF, la modalità `/expand`, le ottimizzazioni della cache dei prompt dei provider (Gemini/OpenAI/Ollama), la ripartizione dei token per singolo passo (la web UI ha il proprio contatore di utilizzo), la serializzazione con writer-lock del tracker (la web UI instrada le scritture tramite `withFileLock` dalla v1.21), i flag CLI `visa_filter` e data di pubblicazione assoluta per lo scan (la web UI ha il proprio filtro "Pubblicato entro"), e il seeding di deduplica delle sorgenti già viste (lo scanner della web UI mantiene la propria deduplica dello storico delle scansioni).

## [1.123.0] — 2026-07-17

### Aggiunto
- **Sorgente di scansione Oracle Recruiting Cloud** (parità con il parent v1.21.0, #1929) — l'API REST a zero autenticazione `recruitingCEJobRequisitions` dei siti carriere Oracle Fusion/ORC (JPMorgan Chase, Oracle, BNY Mellon, American Express, Honeywell, …): host ancorato a `*.fa[.<region>][.ocs].oraclecloud.com`, il numero di sito risolto dal `careers_url` di ciascuna azienda tracciata, paginazione a offset con un limite massimo di pagine, e header simil-browser consapevoli del WAF. Il registro ora conta **62 adattatori (57 inglesi + 5 russi)**; il fallback del menu a tendina Source di `#/scan` e il relativo gate di deriva sono aggiornati; nuova suite isolata per CI `tests/sources-oraclecloud.test.mjs`.

### Corretto
- **Rilevatore di repost: i titoli base restano distinti dai fratelli con suffisso specializzato** (parent #1922) — "Senior Analytics Engineer" non si raggruppa più con "Senior Analytics Engineer, People Analytics": quando i token di un titolo sono un sottoinsieme stretto di quelli dell'altro e il token in più è una specializzazione reale (non una parola di base), le due offerte sono trattate come annunci pubblicabili separatamente. Le annotazioni di repost ("(Repost)", "relisted") sono ora trattate come stopword di rumore meta. +2 asserzioni in `tests/detect-reposts.test.mjs`.

### Note
- La v1.21.0 del parent ha anche introdotto modifiche lato CLI che la web UI non richiama via shell o che già copre: l'avviso di ricandidatura per azienda ripetuta (la web UI ha il cooldown di ricandidatura dalla v1.84.0), i flag `--format`/`--report` della lettera di presentazione, le modalità del prompt e-mail per red-flag del colloquio / intelligence sul panel / mancata presentazione, la persistenza dei segnali di fiducia della scansione e della salute dei portali (la web UI esegue il proprio scanner in-process con `trust-validator` e la pagina di salute dei Portali), e le estensioni di statistiche/salary-gap (inoltrate in sola lettura e fail-soft).

## [1.122.0] — 2026-07-16

### Aggiunto
- **Hindi (हिन्दी) — la 17ª lingua** — dizionario completo dell'interfaccia (~1.110 chiavi), la guida in-app completa (parità 29 H2 / 105 H3), `README.hi.md`, un nuovo `CHANGELOG.hi.md` (a partire dalla v1.122.0, seguendo il precedente di de/it/tr), le pagine landing di cvstart.org + Metodologia/Licenza/Changelog/Guida, lo switcher lingua (🇮🇳), il rilevamento automatico della lingua del browser e uno screenshot della dashboard localizzato. Ogni gate di parità ×16 ora gira ×17: parità del dizionario i18n + snapshot, i gate H2/H3 della guida, la parità del changelog, `check-i18n` della site e lo spazzolamento delle lingue con Playwright.

## [1.121.0] — 2026-07-16

### Aggiunto
- **cvstart.org: pagine Metodologia, Licenza e Changelog** — la landing ha guadagnato tre nuove sezioni in tutte le 16 lingue, accanto al blocco Confronto già esistente: **/methodology/** (la griglia di punteggio a sei dimensioni da 0.0–5.0, la soglia di candidatura a 4.0 e le regole del "mai fare" — un riassunto localizzato di [career-ops.org/methodology](https://career-ops.org/methodology)), **/license/** (il testo canonico MIT con il rimando a NOTICE.md) e **/changelog/** (questo file, reso per singola lingua a partire dai 16 CHANGELOG tradotti del repository). Nuova voce **Metodologia** nell'header e link Risorse nel footer; `sync-assets.mjs` ora sincronizza anche il CHANGELOG ×16 e la LICENSE nella site in fase di build, così le pagine non possono mai disallinearsi dal repository.
- **Link alla metodologia in tutta la documentazione** — il README (tutte le 16 lingue), l'elenco canonico del §1 della guida in-app (tutte le 16 lingue) e il wiki ora rimandano a [career-ops.org/methodology](https://career-ops.org/methodology) (oltre a FAQ e glossario) accanto alle guide già esistenti su [career-ops.org/docs](https://career-ops.org/docs).

### Modificato
- Banner e badge di release del README aggiornati (1850 test, release v1.121.0) — il banner annunciava ancora la v1.119.5.

## [1.120.0] — 2026-07-16

### Aggiunto
- **Il Manifesto CareerOps** (parità con il padre v1.20.0) — il progetto padre ha pubblicato il Manifesto CareerOps (`MANIFESTO.md` · [career-ops.org/manifesto](https://career-ops.org/manifesto)) e ora lo mette in evidenza dal proprio README, dall'updater e dalla dashboard Go. La web-ui fa lo stesso: un nuovo link nel footer della barra laterale apre la pagina del manifesto (nuova chiave i18n `footer.manifesto` in tutte le 16 lingue), la guida in-app ha guadagnato il §29 «Il Manifesto CareerOps» in tutte le 16 lingue, il README spiega cos'è il manifesto e come firmarlo, e anche il footer della landing cvstart.org vi rimanda.

### Note
- Il padre v1.20.0 ha anche corretto la soppressione delle competenze già note nella modalità mirata `upskill`, ha reso silenzioso dotenv così che lo stdout di `scan --json` resti analizzabile, e ha corretto il template HTML del CV in modo che l'intestazione di un ruolo resti insieme ai suoi punti elenco — superfici lato CLI in cui la web-ui non entra tramite shell; non è stata necessaria alcuna modifica al codice della web-ui.

## [1.119.5] — 2026-07-13

### Corretto
- **Il pulsante lingua della landing non va più a capo** — con le bandiere della v1.119.2 l'etichetta dello switcher nell'header (es. «🇷🇺 Русский») poteva spezzarsi fino a tre righe alle larghezze desktop strette; l'etichetta dello switcher e tutte le opzioni del menu ora usano `whitespace-nowrap` — bandiera + endonimo sempre su una riga. L'elenco delle lingue nel footer è passato da una griglia rigida a due colonne a una riga avvolgente di voci su una riga — anche «🇧🇷 Português (Brasil)» non si spezza più a metà nome.

## [1.119.4] — 2026-07-13

### Modificato
- **LICENSE nomina l'autore** — la riga di copyright ora recita: *Sergei Emelianov (Fighter90) <https://sergey-cv.com> and career-ops-ui contributors* (testo MIT canonico intatto). Un nuovo **NOTICE.md** dettaglia il licenziamento: chi detiene il copyright, cosa copre esattamente la concessione MIT (codice, doc, traduzioni, la landing, la wiki), cosa NON copre (i tuoi dati a runtime, il progetto padre, i contenuti delle job board, i marchi), la tabella dei componenti di terze parti (express/js-yaml — MIT; Astro/Tailwind — MIT; i font Figtree e JetBrains Mono — SIL OFL 1.1; sharp — Apache-2.0) e una riga di attribuzione facoltativa.

## [1.119.3] — 2026-07-13

### Aggiunto
- **SECURITY.md** — la security policy a cui puntava CONTRIBUTING ora esiste: versioni supportate, flusso di segnalazione privata (il **private vulnerability reporting** di GitHub è ora **abilitato** sul repo — scheda Security → «Report a vulnerability»), il modello di minaccia per un'app mono-utente su localhost (in scope: XSS via annunci ostili / SSRF / path traversal / fuga di segreti / indebolimento della CSP; fuori scope: DoS del proprio localhost e problemi del progetto padre) e la baseline di hardening per i reviewer.

## [1.119.2] — 2026-07-13

### Aggiunto
- **CONTRIBUTING.md** — la guida del contributore a cui landing e README puntavano da sempre ora esiste: installazione, mappa del progetto, le regole dure sicurezza/no-build, i livelli di test, il walkthrough dei «due registri» per aggiungere una sorgente di scansione, il contratto i18n ×16, le convenzioni di commit/PR e il processo di release.
- **Bandiere delle lingue sulla landing** — il selettore di lingue di cvstart.org, la griglia delle lingue nel footer e il banner «leggi nella tua lingua» ora mostrano la bandiera di ogni locale accanto al suo endonimo (lo stesso set di indicatori regionali del `<select>` di lingua dell'app; degrada a lettere di regione dove mancano i glifi delle bandiere).
- **Correzioni del footer della landing** — il link morto a Discussions (funzione non abilitata sul repo) ora punta alla **wiki** del progetto, e il footer accredita l'autore: **Sergei Emelianov** ([sergey-cv.com](https://sergey-cv.com/) · [LinkedIn](https://www.linkedin.com/in/sergey-emelyanov-in-job/)).

## [1.119.1] — 2026-07-13

### Corretto
- **Il filtro sorgenti di `#/scan` ha raggiunto il registro** — la lista statica `FALLBACK_SOURCES` dietro il menu a tendina Source (usata solo quando `GET /api/scan/sources` è irraggiungibile) era silenziosamente indietro dalla v1.87.0: mancavano 20 provider nel fallback offline (Amazon, Avature, SAP SuccessFactors, Get on Board, Dassault Systèmes, beesite, HigherEdJobs, JibeApply (iCIMS), softgarden, Cornerstone, Phenom, Radancy, Deutsche Bahn, EchoJobs, TKMS, Heckler & Koch, Rheinmetall, LaraJobs e i nuovi Meituan / Tencent). Sincronizzata con tutti i **61** e ora protetta da un test di deriva che fa fallire la CI quando la lista client diverge dal registro server (valori E etichette). +1 test (**1845**).

## [1.119.0] — 2026-07-13

Parità con il career-ops padre **v1.19.0** + aggiornamento della landing cvstart.org.

### Aggiunto
- **2 nuovi provider di scansione** — Meituan (`zhaopin.meituan.com`) e Tencent (`careers.tencent.com`): le API JSON pubbliche senza autenticazione delle board tech cinesi, rilevate dall'host o selezionate con un `provider:` esplicito, con ricerca server-side per parola chiave, paginazione e deduplicazione per URL — ora **61 adapter** (56 EN + 5 RU). +20 test (**1844**).
- **Blocco dei contributori sulla landing** — cvstart.org mostra gli avatar di tutti coloro che hanno contribuito con codice (API GitHub `/contributors` in fase di build, bot filtrati), localizzato nelle 16 lingue, con link al grafo completo dei contributori.
- **Contatore di stelle GitHub live sulla landing** — il badge nell'header ora si aggiorna lato client dall'API GitHub a ogni visita (lo snapshot di build resta come fallback), e una ricostruzione settimanale pianificata di Pages mantiene freschi snapshot e lista dei contributori; le chiamate API in CI sono autenticate con token.

### Corretto
- **Le richieste Workday CXS portano header da browser** (padre #1813) — i tenant dietro Cloudflare (visto dal vivo: geico) rispondono 500 alle richieste prive dei normali UA/`accept-language`/`origin`/`referer`; il fetcher ora deriva origin e slug del site dall'URL CXS stesso. Le richieste Glints hanno guadagnato lo stesso UA da browser + origin/referer, entrambi dalla costante condivisa `BROWSER_LIKE_USER_AGENT` di `http-json.mjs`.

## [1.118.4] — 2026-07-10

### Corretto
- **Le scansioni di hh.ru restituivano 0 risultati da un IP russo (link a sottodominio regionale)** — da un IP residenziale russo, hh.ru reindirizza la ricerca (302) verso un sottodominio regionale (`sochi.hh.ru`, `spb.hh.ru`, …) e restituisce i link delle offerte su quel sottodominio. Il parser cercava il link del titolo sull'host fisso `https://hh.ru/vacancy/` e non ne trovava **nessuno** tra quelli regionali, quindi una scansione perfettamente funzionante registrava 0 in silenzio. Ora accetta qualsiasi host `*.hh.ru` (gli annunci su `adsrv.hh.ru/click?…` restano esclusi — non hanno il percorso `/vacancy/<id>`) e canonicalizza ogni URL di risultato in `https://hh.ru/vacancy/<id>`. Verificato dal vivo: 17 offerte reali vengono analizzate da una pagina `sochi.hh.ru` che prima dava 0. +1 test (**1824**).

## [1.118.3] — 2026-07-10

### Corretto
- **hh.ru restituiva silenziosamente 0 risultati (interstitial di verifica VPN)** — hh.ru ora reindirizza con 302 le reti che considera VPN/proxy (IP di datacenter) verso un interstitial `/vpncheeck` (“VPN мешает работе сайта”) che risponde **HTTP 200** senza alcuna scheda di vacancy, quindi la scansione riportava 0 senza alcun errore. Lo scanner ora rileva il redirect tramite l'URL finale della risposta, disabilita hh.ru per il resto dell'esecuzione e stampa un suggerimento onesto: il traffico deve davvero uscire da un IP residenziale — un VPN/proxy di sistema può restare attivo anche con l'interruttore del browser spento. +1 test (**1823**).

## [1.118.2] — 2026-07-10

### Manutenzione
- **Rifinitura della landing (#118)** — `site/README.md` riconciliato con Astro 7 (l'upgrade di sicurezza di #116), import inutilizzato rimosso e **+4 guardie eseguibili** per gli script di build della landing: il gate di parità i18n fallisce dimostrabilmente con un dizionario rotto e `sync-assets` non scrive mai fuori da `site/` — suite **1822**. Risolti due avvisi CodeQL (uno corretto alla fonte, uno respinto come comportamento di build voluto).

## [1.118.1] — 2026-07-10

### Corretto
- **Scansione di hh.ru fuori dalla Russia** — hh.ru ora restituisce **HTTP 451** (blocco legale regionale) agli IP non russi sulle pagine pubbliche di ricerca. Lo scanner tratta il 451 come il 403: dopo il primo blocco hh.ru viene disattivato per il resto dell'esecuzione con una riga onesta nel log che indica un IP russo / uscita VPN, senza sprecare le query rimanenti né le altre fonti RU. Guida §7 aggiornata in tutte le 16 lingue. +1 test (**1818**).

## [1.118.0] — 2026-07-09

Pacchetto di parità con il career-ops padre **v1.18.0**.

### Aggiunto
- **9 nuovi provider di scansione** — Cornerstone OnDemand (`csod`), Phenom (`phenom`), Radancy (`radancy`), Deutsche Bahn (`deutschebahn`), EchoJobs (`echojobs`), TKMS (`tkms`), Heckler & Koch (`hecklerkoch`), Rheinmetall (`rheinmetall`), LaraJobs (`larajobs`) — ora **54 adapter**. L'adapter di Lever rileva inoltre le board del tenant EU (`jobs.eu.lever.co`).
- **Stato `Hired` nel tracker** (parità con lo `states.yml` del padre): le offerte accettate hanno uno stato canonico proprio, un badge celebrativo e un banner «lavoro ottenuto» su `#/tracker`; funnel e conversioni lo contano come avanzato attraverso tutte le fasi.
- **Scheda Totale in `#/stats`** — relay in sola lettura dello `stats.mjs` del padre (riepilogo complessivo del tracker, tassi cumulati del funnel, totali dello scanner, copertura dei portali) più le osservazioni sulla retribuzione da `salary-gap.mjs` (desiderata vs pubblicizzata vs effettiva, per candidatura). Nuove rotte `GET /api/stats/lifetime` e `GET /api/stats/salary-gap` — shell-out a zero token, degradazione sicura `{available:false}` senza il progetto padre.
- 28 nuove chiavi i18n in tutte le 16 lingue; guida in-app §14/§26 aggiornata in ogni lingua.

### Test
- +38 test unitari (tre suite di parità provider + rotte relay/stato) — **1817** in totale.

## [1.117.2] — 2026-07-06

**Correzione tracker vuoto per gli shell-out di parità.** Gli script del padre escono con codice 1 e un JSON `{error}` strutturato quando il tracker non ha ancora candidature; la bacheca di follow-up e la scheda pattern lo mostravano come «script-error». Entrambe le rotte ora lo inoltrano come uno stato vuoto sano (`available:true, empty:true`) e la UI mostra il suo onesto messaggio «ancora niente». Verificato dal vivo contro un padre reale.

Nuovo: nessuno.


## [1.117.1] — 2026-07-06

**Indurimento di v1.117.0 (triage CodeQL).** I tre endpoint shell-out (`GET /api/followup`, `POST /api/followup/seed`, `GET /api/stats/patterns`) portano ora il limitatore per-IP condiviso (creano un processo figlio per richiesta; no-op su loopback). L'estrazione del testo da URL di Aggiungi al CV rimuove i tag fino al punto fisso e poi cancella ogni `<`/`>` residuo — una sanificazione dimostrabilmente completa per testo di prompt LLM. Nessun cambiamento per input validi.

Nuovo: nessuno.


## [1.117.0] — 2026-07-06

**Pacchetto di parità col padre — sei capacità del career-ops padre portate nella UI.** (1) **Bacheca di cadenza** su `#/followup`: urgenza per candidatura (🔴/🟠/🟡/🔵) da `followup-cadence.mjs`, più il pulsante **Semina date** (`followup-seed.mjs --backfill`). (2) **Pattern di rifiuto**: una quarta scheda Statistiche esegue `analyze-patterns.mjs` (sola lettura) — distribuzione degli esiti, raccomandazioni, tasso di avanzamento per fornitore ATS. (3) **Aggiungi al CV**: una scheda di CV Studio trasforma un URL o testo incollato in punti ATS basati SOLO su quella fonte (solo suggerimenti, nessuna scrittura; il fetch dell'URL è protetto anti-SSRF). (4) **4 nuovi provider di scansione** — beesite, HigherEdJobs (RSS), JibeApply (iCIMS), softgarden — il registro conta ora **50 adattatori (45 EN + 5 RU)**, tutti nel menu del Scan. (5) Passo di **pre-scansione dei disqualificatori** nella checklist Apply. (6) **Runner reconcile** (`/api/run/reconcile`). Le rotte shell-out degradano onestamente senza gli script del padre.

- Nuovo modulo `server/lib/routes/followup.mjs` (31º) + nuove rotte + 8 file source/adapter. Test: 6 + 7 nuovi; suite 1737 → 1750. 41 chiavi i18n ×16. Aiuto §13/§17/§24/§26 esteso ×16.

Nuovo: `GET /api/followup`, `POST /api/followup/seed`, `GET /api/stats/patterns`, `POST /api/cv-studio/add-entry`, `POST /api/run/reconcile`.


## [1.116.0] — 2026-07-06

**Contatore di utilizzo rifatto + primo test end-to-end dei widget.** Il contatore di utilizzo IA (v1.114.0) è corretto e ancorato correttamente: ora è **fissato in fondo alla barra laterale sinistra** (larghezza piena, stessa superficie) e riserva in basso uno spazio pari alla propria altezza così che il **menu non venga mai coperto** — la navigazione e il piè di versione scorrono sempre liberi sopra di esso. Si **aggiorna dal vivo** (ogni 15 s, al focus della scheda e al cambio di rotta), e ogni riga di finestra mostra ora i **`<token> · <costo stimato>`** reali (le barre si scalano rispetto alla finestra di 30 giorni) invece di una "quota" sempre al 100%. Inoltre: una barriera `typeof` durevole nell'importatore del CV chiude alla fonte il falso positivo ricorrente di type-confusion di CodeQL, e un nuovo **test end-to-end** Playwright guida entrambi i widget persistenti in un browser reale.

- `public/js/lib/usage-hud.js` + `app.css`, `server/lib/cv-import.mjs`. Test: `tests/playwright-widgets.mjs` (2 E2E) + `tests/usage-hud.test.mjs` (10). Aiuto §6 esteso ×16.

Nuovo: nessuno.


## [1.115.0] — 2026-07-06

**Rifinitura del design (conservativa, brand corallo mantenuto).** Un passaggio leggero di rifinitura sul sistema di design condiviso — nessuna ristrutturazione, nessun cambio di palette. Le schede metriche della dashboard ora si sollevano e prendono un bordo corallo al passaggio del mouse (come i riquadri di azione rapida); le schede di contenuto si sollevano di poco; i pulsanti primary / dark / danger guadagnano un'ombra a riposo e un lieve sollevamento all'hover per profondità; i numeri grandi si allineano con tabular-nums; e i controlli interattivi ricevono un alone corallo morbido dietro il nitido anello da tastiera di 2px. Tutto il movimento rispetta `prefers-reduced-motion`, e l'alone è limitato ai controlli — mai un `*:focus-visible` globale.

- Solo CSS (`public/css/app.css`); nessuna modifica a markup, i18n, rotte o CSP. Test: `tests/design-polish-v1115.test.mjs` (5). Verificato dal vivo con Playwright.

Nuovo: nessuno.


## [1.114.0] — 2026-07-06

**Contatore di utilizzo e costo dell'IA nella barra laterale (in basso a sinistra).** Una sezione **UTILIZZO** compatta ora si trova in fondo alla barra laterale (una scheda fissa in basso a sinistra se non c'è barra laterale; in basso a destra in RTL) su ogni pagina. Mostra l'uso di token LLM su finestre **24h / 7g / 30g** — ciascuna come `<token> · <quota%>` con una barra verde (quota sul totale) — più un piè di pagina con il costo stimato delle 24h. I dati sono il riepilogo di sola lettura `GET /api/usage` di `data/llm-usage.jsonl` (solo locale), la stessa fonte della pagina `#/usage`; il costo è una stima e le esecuzioni in modalità manuale sono gratuite e non conteggiate. Comprimibile — l'intestazione commuta e lo stato persiste.

- Nuovo widget client `public/js/lib/usage-hud.js` caricato da `index.html`, montato nella barra laterale sopra il piè di versione (fallback ad angolo fisso). Sicuro per la CSP; adattivo al tema e speculare RTL. Nessuna nuova rotta server. Test: `tests/usage-hud.test.mjs` (8). 3 nuove chiavi i18n ×16.

Nuovo: nessuno.


## [1.113.0] — 2026-07-06

**Assistente fluttuante "Chiedi alla guida" su ogni pagina.** Un pulsante di chat con un robot in gradiente ora fluttua nell'angolo in basso a destra (in basso a sinistra in RTL) di ogni pagina. Toccalo per aprire una chat compatta che risponde a domande d'uso basandosi SOLO sulla guida di aiuto integrata nella tua lingua — lo stesso endpoint della pagina `#/docs-assistant` (`POST /api/docs-assistant/ask`), quindi non legge mai il tuo CV, profilo o tracker. Dal vivo con una chiave LLM; senza chiave → un prompt pronto all'uso. L'intestazione mostra un avatar robot + stato online; i chip avviano domande comuni; Esc o clic esterno chiude; si nasconde sulla pagina `#/docs-assistant`.

- Nuovo widget client `public/js/lib/docs-fab.js` montato globalmente da `index.html`; sicuro per la CSP; stili adattivi al tema e speculari RTL in `app.css`. Nessuna nuova rotta server. Test: `tests/docs-fab.test.mjs` (8). 6 nuove chiavi i18n ×16. Aiuto §1 esteso sul posto.

Nuovo: nessuno.


## [1.112.0] — 2026-07-06

**Consolidamento docs & QA.** Nessuna modifica di codice visibile. Il documento di convenzioni SDD (`docs/sdd/CONVENTIONS.md`) è aggiornato agli attuali **30 moduli di rotta** (erano 24) e alla baseline di test attuale; il prompt QA definitivo dell'intero progetto (`qa/QA-REGRESSION-PROMPT.md`) è consolidato — meccanica di release ripulita (v1.111, parentVersion 1.17.0, pubblicazione attivata dall'evento di release), la tabella delle aggiunte §14 corretta (Escludi di Scan rietichettato v1.109.0) ed estesa con la chiusura CodeQL di v1.111 — così da bastare da solo come unico prompt di regressione per tutte le funzionalità. Aggiunge un test di copertura per il ramo di caricamento sovradimensionato.

Nuovo: nessuno.


## [1.111.0] — 2026-07-06

**Sicurezza — chiusura del backlog CodeQL.** Tre rafforzamenti difesa-in-profondità che chiudono i restanti rilievi dell'analisi statica alla fonte invece di scartarli. `stripDangerousMarkdown` ora fa l'escape del `<` di qualsiasi apertura di tag pericoloso *troncata* (un payload che termina con `<script`/`<iframe`/…), così che il suo output non contenga in modo dimostrabile alcun tag pericoloso vivo. L'import del CV legge la dimensione del buffer caricato tramite una coercizione esplicita `Number()` — una barriera contro la confusione di tipi. Le righe di ruolo delle modalità ora sono **stringhe** template interpolate con `String.replace` invece di funzioni memorizzate, rimuovendo del tutto la chiamata a dispatch dinamico. Nessun cambiamento di comportamento visibile all'utente.

- `server/lib/security.mjs`, `server/lib/cv-import.mjs`, `server/lib/prompts.mjs`. Test: `tests/security-hardening-v1111.test.mjs` (7) + test di guardia v1108 aggiornato. Nessun cambiamento i18n/aiuto/rotte.

Nuovo: nessuno.


## [1.110.0] — 2026-07-06

**Aggiornamento docs & QA (tutte le lingue).** Nessuna modifica al codice. Il prompt QA dell'intero progetto è aggiornato a v1.109.0 con un nuovo §14 (v1.98→v1.109), e i prompt perenni UX-audit e design-export hanno la superficie di pagine attuale. Ogni paragrafo di aiuto aggiunto in v1.100–v1.109 è ora tradotto in **tutte le 16 lingue**.

Nuovo: nessuno.


## [1.109.0] — 2026-07-06

**Filtro Escludi in Scan + panoramica pipeline (parità layout web).** Su `#/scan`, la casella **Cerca** ora tratta le virgole come **OR** ("ruoli da trovare") e un nuovo campo **Escludi** nasconde ogni riga la cui azienda/ruolo/luogo contiene una delle parole separate da virgole (es. `senior, staff`); entrambi sono ricordati dalle ricerche salvate. Su `#/pipeline`, una **striscia di panoramica** compatta mostra la pipeline a colpo d'occhio — **N in arrivo**, **N tracciati** e i conteggi **Applied / Responded / Interview / Offer** dal tracker, ogni chip collega a `#/tracker`.

- Solo client (nessuna nuova rotta/scrittura). `public/js/views/scan.js` + `public/js/views/pipeline.js`. Test: `tests/scan-pipeline-ui-v1109.test.mjs` (2). 4 nuove chiavi i18n ×16. Aiuto §7 + §8 estesi sul posto.

Nuovo: nessuno.


## [1.108.0] — 2026-07-06

**Rafforzamento della sicurezza (triage CodeQL, round 2).** Corrette altre tre vulnerabilità di bassa gravità: il costruttore di prompt risolve la riga di ruolo della locale per **chiave propria + `typeof === function`** così che una locale manomessa non possa invocare un metodo del prototipo (unvalidated-dynamic-method-call); lo slug del nome file PDF è **limitato a 200 caratteri prima del regex** così che un input di soli trattini non torni indietro (ReDoS polinomiale); e l'importazione documenti **forza un `filename` array** (header ripetuto) a stringa (type-confusion). Nessun cambiamento di comportamento per input valido.

- `server/lib/prompts.mjs`, `server/lib/routes/runners.mjs`, `server/lib/cv-import.mjs` + `tests/security-hardening-v1108.test.mjs` (3). Su v1.106–v1.108 l'arretrato dell'analisi statica è passato da 167 a ~14, con ogni risultato realmente rilevante per la sicurezza corretto e il resto (falsi positivi protetti/sanificati + lint di livello nota) respinto con motivazione.

Nuovo: nessuno.


## [1.107.0] — 2026-07-06

**Rafforzamento del sanitizzatore (difesa in profondità XSS a riposo).** `stripDangerousMarkdown` — che neutralizza l'HTML pericoloso nel markdown di CV/annuncio memorizzato affinché qualsiasi consumatore che aggiri il client con escape-al-rendering resti sicuro — ora esegue la pulizia dei tag **fino a un punto fisso** (ripeti fino a stabilizzarsi) così che una rimozione che *riforma* un payload (es. `<scr<script></script>ipt>`) venga intercettata, corrisponde ai tag di chiusura script/style ecc. **con residui finali** (`</script foo>`) e rimuove un apertore eseguibile **non chiuso** (`<script …>`). Il comportamento per markdown valido è invariato — rimuove solo di più.

- `server/lib/security.mjs`: ciclo a punto fisso (limitato a 8 passaggi) + pattern di chiusura `[^>]*>` + rimozione dell'apertore non chiuso. +3 casi di regressione in `tests/cv-xss-bypasses.test.mjs`. Il confine XSS autorevole resta l'escape in output (`UI.md`); questo rafforza la garanzia a riposo e chiude i risultati CodeQL corrispondenti.

Nuovo: nessuno.


## [1.106.0] — 2026-07-06

**Rafforzamento della sicurezza (triage CodeQL).** Corrette tre vulnerabilità reali (seppur di bassa gravità) dopo una passata sull'arretrato dell'analisi statica: il percorso di errore del rendering **ora effettua l'escape del messaggio di errore** prima che raggiunga il DOM (un errore del server può riflettere input dell'utente, quindi trattato come non attendibile — confine XSS), e le scritture di proprietà di profilo/config **rifiutano le chiavi `__proto__` / `constructor` / `prototype`** (protezioni anti prototype-pollution per sicurezza — le chiavi provengono da specifiche di campo fisse, non da input grezzo). La maggior parte degli avvisi rimanenti sono falsi positivi sulle letture/scritture legittime dello scanner in `data/*` e su rotte che già portano il limiter interno; respinti con motivazione.

- `public/js/router.js` effettua l'escape di `err.message` via `UI.escapeHtml` prima di `innerHTML`; `server/lib/routes/content.mjs` e `server/lib/routes/config.mjs` proteggono le chiavi di prototipo. Nessun cambiamento di comportamento per input valido. Test: `tests/security-hardening-v1106.test.mjs` (3). Nessuna nuova chiave i18n.

Nuovo: nessuno.


## [1.105.0] — 2026-07-06

**Pagina uso e costo IA.** Una nuova pagina **Uso IA** (barra laterale, accanto a Salute) mostra quanti token hai speso in generazioni IA **live** — valutazioni, report, chat — suddivisi **per provider** nelle ultime 24 ore, 7 giorni, 30 giorni e sempre, con un **costo stimato in USD**. Ogni chiamata live aggiunge un piccolo record `{provider, in, out}` a `data/llm-usage.jsonl` (nulla viene inviato da nessuna parte); le esecuzioni senza chiave (modalità manuale) non costano nulla e non vengono registrate.

- Nuovo modulo di rotta (il 30°) `server/lib/routes/usage.mjs` — `GET /api/usage` (aggregati in sola lettura) + `server/lib/llm-usage.mjs` (`recordUsage` normalizza le forme d'uso di Anthropic/OpenAI/Gemini e aggiunge in best-effort; `readUsage`/`aggregate` aggregano per finestra 24h/7g/30g/tutto × provider) + `server/lib/llm-pricing.mjs` (una tabella prezzi **modificabile** per provider `$/1M` token — i token sono esatti, i dollari sono prezzi di listino approssimativi che puoi correggere; mai fatturati). La registrazione è agganciata ai punti di dispatch (`runActiveProvider` + `routes/llm.mjs`).
- Nuova vista `public/js/views/usage.js` (`#/usage`, schede finestra). Test: `tests/usage-routes.test.mjs`. 17 nuove chiavi i18n ×16 (`usage.*` + `nav.usage`). Aiuto §6 esteso sul posto.

Nuovo: `server/lib/routes/usage.mjs`; `server/lib/llm-usage.mjs`; `server/lib/llm-pricing.mjs`; `public/js/views/usage.js`.


## [1.104.0] — 2026-07-06

**Logo aziendali nella tabella di scansione (rispettosi della privacy).** Un nuovo interruttore **Aspetto** nelle **Impostazioni app** — **Mostra i logo delle aziende nella tabella di scansione** (disattivato per impostazione predefinita) — disegna il logo di ogni azienda accanto al nome su `#/scan`. Il logo è la **favicon dell'azienda recuperata dal suo dominio** e messa in proxy lato server (`GET /api/logo`), così **nessun servizio di logo di terze parti scopre quali datori di lavoro stai guardando**. Gli annunci su un portale di lavoro condiviso (Greenhouse, Lever, Ashby, …) mostrano un **badge con una lettera** colorato invece dell'icona del portale, e qualsiasi logo che non si carica ricade sullo stesso badge.

- Nuovo modulo di rotta (il 29°) `server/lib/routes/logos.mjs` — `GET /api/logo?domain=`. Valida il dominio (senza schema/percorso/loopback), recupera `/favicon.ico` tramite il **`safeGet` sicuro contro l'SSRF** (una nuova modalità `binary` restituisce i byte grezzi + content-type; DNS-pinning, validazione dei redirect e limite di dimensione invariati), esegue uno **sniffing della firma dell'immagine** per non servire mai una pagina HTML di errore come immagine, mette in cache successi **e** fallimenti in un LRU in memoria e **non scrive nulla su disco**.
- Nuova lib client `public/js/lib/company-logo.js` (`window.CompanyLogo`): disattivata per impostazione predefinita tramite flag in localStorage; salta gli host ATS condivisi a favore di un avatar-lettera deterministico; ripiego `img.onerror` sicuro per la CSP. Test: `tests/logo-routes.test.mjs`. 5 nuove chiavi i18n ×16 (`appear.*`). Aiuto §2 esteso sul posto.

Nuovo: `server/lib/routes/logos.mjs`; `public/js/lib/company-logo.js`.


## [1.103.0] — 2026-07-06

**Impostazioni: "Strumenti CLI IA" — quali sono installati.** career-ops è basato su Claude Code ma funziona con qualsiasi CLI di agente conforme allo standard aperto di skills. Una nuova scheda **Strumenti CLI IA** nelle **Impostazioni app** (`#/config`) mostra quali — Claude Code, Codex, Gemini CLI, OpenCode, GitHub Copilot CLI, Qwen, Antigravity — sono installati sulla macchina che esegue il server, e i loro percorsi. È una **scansione del PATH in sola lettura**: verifica solo se ogni binario esiste e **non lo esegue mai** (nessun `--version`, nessuna esecuzione), non scrive nulla e non tocca dati utente.

- Nuovo modulo di rotta (il 28°) `server/lib/routes/cli-detect.mjs` — `GET /api/cli-detect`. Il rilevamento risolve il percorso di un binario da una allowlist fissa di 7 voci tramite `process.env.PATH` (shim `.cmd/.exe/.bat` su Windows; bit di esecuzione su POSIX); un file ostile sul PATH non può mai essere eseguito da questa rotta.
- Nuova scheda "Strumenti CLI IA" in `public/js/views/config.js` (caricamento lazy, deep-link via `#/config?tab=cli`). Test: `tests/cli-detect-routes.test.mjs`. 8 nuove chiavi i18n ×16 (`cli.*` + `config.tabCli`). Aiuto §2 esteso sul posto.

Nuovo: `server/lib/routes/cli-detect.mjs`.


## [1.102.0] — 2026-07-05

**"Chiedi alla guida" — una chat fondata sulla guida di aiuto integrata.** Una nuova pagina **Chiedi alla guida 💬** (barra laterale, sotto Aiuto): scrivi una domanda come "Come faccio a scansionare i portali di lavoro?" e ottieni una risposta tratta **solo** dalla guida di aiuto dell'app nella tua lingua — mostra quali sezioni ha usato e **non legge mai il tuo CV, profilo o la tua ricerca di lavoro**. Riguarda come usare l'app, non te. Con una chiave LLM risponde in tempo reale; senza chiave ti consegna un prompt pronto, già riempito con le sezioni di aiuto pertinenti.

- Nuovo modulo di rotta (il 27°) `server/lib/routes/docs-assistant.mjs` — `POST /api/docs-assistant/ask`. **Recupero senza dipendenze:** la guida nella tua lingua è divisa nelle sue sezioni `##` e valutata per sovrapposizione di parole chiave con la domanda; le migliori vengono incluse e il modello deve rispondere da esse o dire che la guida non lo copre (nessuna funzione/rotta inventata). Cascata di provider condivisa, ripiego manuale, con limite di frequenza, **senza scritture**, non legge dati utente.
- Nuova vista `public/js/views/docs-assistant.js`. Test: `tests/docs-assistant-routes.test.mjs`. 14 nuove chiavi i18n ×16 (`docs.*` + `nav.docsAssistant`). Aiuto §1 esteso sul posto.

Nuovo: `server/lib/routes/docs-assistant.mjs`; `public/js/views/docs-assistant.js`.


## [1.101.0] — 2026-07-05

**CV Studio: adatta il tuo CV + scrivi una lettera di presentazione per un lavoro specifico, con un controllo in stile recruiter.** Nuova scheda **Adatta a un lavoro** su `#/cv-studio`: incolla una descrizione di lavoro (e, facoltativamente, un ruolo/titolo target) e CV Studio produce un **CV adattato a quell'annuncio più una lettera di presentazione coerente**, poi li passa attraverso un **controllo** prima di consegnarli — gli `error` bloccano (corretti prima che tu veda il risultato), i `warn` consigliano. La meccanica è distillata dalla pratica del career coaching in regole **generiche** — un recruiter legge in secondi, quindi l'esperienza rilevante va in alto, il titolo corrisponde al ruolo dell'annuncio, i risultati portano numeri specifici e la lettera resta un teaser breve con un unico ponte "requisito ↔ il tuo fatto corrispondente". Si basa **solo** sul tuo CV, profilo e two-pager e **non inventa mai** — nessuna azienda, ruolo o storia hardcoded.

- Nuovo endpoint `POST /api/cv-studio/tailor` (estende il modulo cv-studio esistente — nessun 27° modulo): `buildTailorPrompt` + un controllo generico `TAILOR_INSTRUCTIONS`, basato su `bundleProjectContext`, cascata di provider condivisa, ripiego manuale senza chiave, con limite di frequenza, **senza scritture**. Il risultato si esporta in Markdown / PDF / **DOCX** tramite la barra condivisa `report-export.js`.
- Test: +3 in `tests/cv-studio-routes.test.mjs`. 10 nuove chiavi i18n ×16 (`cvs.tailor*`). Riferimento generico `docs/prompts/resume-cover.md`. Aiuto §24 esteso sul posto.

Nuovo: `docs/prompts/resume-cover.md`.


## [1.100.0] — 2026-07-05

**Two-pager: compilazione automatica con IA dal tuo CV + Anteprima + esportazione in PDF/DOCX/Markdown.** Il two-pager (`#/two-pager`) raccoglie ciò che vuoi davvero dal prossimo ruolo, ma finora ogni campo andava scritto a mano o copiando un prompt in un altro strumento. Ora l'**✨ assistente di compilazione IA** viene eseguito in tempo reale con il provider configurato — legge *solo* il tuo CV + profilo (tramite `bundleProjectContext`, senza inventare nulla), redige tutti i campi (chi sono / cosa amo / irrinunciabili / cosa detesto / deal-breaker / non negoziabili / ambiente target) e compila il modulo perché tu lo riveda, modifichi e salvi. Senza chiave API torna alla finestra copia-il-prompt come prima. Un nuovo pulsante **👁 Anteprima ed esporta** rende il two-pager come documento formattato con una barra **Scarica .md / Salva come PDF / Salva come DOCX / Copia**.

- **Esportazione `.docx` senza dipendenze.** Nuovo `server/lib/docx.mjs` che produce un `.docx` Office Open XML minimo ma valido (uno ZIP DEFLATE delle quattro parti OOXML, con CRC-32 per voce) — senza nuova dipendenza runtime (le deps restano `express` + `js-yaml`). Nuova rotta `POST /api/export/docx` (`server/lib/routes/export.mjs`, il 26° modulo di rotte; stateless, limitato a 200 KB, senza scritture / senza LLM / senza fetch di URL). Integrato nel condiviso `public/js/lib/report-export.js`, quindi **il report di mercato, il piano di carriera e l'orientamento professionale ottengono anch'essi l'esportazione DOCX**.
- La compilazione automatica in tempo reale usa la cascata di provider condivisa (`runActiveProvider` / `providerAvailable`); lo YAML restituito viene analizzato e ricondotto alla forma limitata del two-pager (`parseYamlFields` + `normalizeTwoPager`) — chiavi sconosciute scartate, array/stringhe limitati. Modalità manuale preservata.
- Test: `tests/export-routes.test.mjs`. 4 nuove chiavi i18n ×16 (`export.saveDocx`, `twoPager.preview`, `twoPager.aiFilling`, `twoPager.aiFilled`).

Nuovo: `server/lib/docx.mjs`; `server/lib/routes/export.mjs`.


## [1.99.0] — 2026-07-05

**Pagina salute dei portali** (`#/portals`). Lo scanner sorveglia un insieme di aziende in `portals.yml`; uno slug ATS può rompersi silenziosamente e quel datore di lavoro sparisce da ogni scansione futura. La nuova pagina **Portals** elenca ogni azienda sorvegliata e, con **Check portal health**, sonda ogni `careers_url` tramite il `safeGet` con DNS ancorato (anti-SSRF) e segnala quelle morte (un 404 = scartata in silenzio) — sola lettura. Rafforza anche il segnalatore di bug della v1.98.0 dopo la revisione: il buffer degli errori ora cattura i fallimenti di rete del fetch e lo scrubber oscura le chiavi provider senza etichetta.

Nuovo: `server/lib/routes/portals.mjs`; `public/js/views/portals.js`.


## [1.98.0] — 2026-07-05

**Segnalatore di bug integrato** (parità con il web `web-v0.2.0` del progetto padre). Un pulsante **🐞 Report a bug** nel cassetto delle notifiche raccoglie un’istantanea diagnostica con soglia di privacy — versioni, il tuo schermo, browser, un riepilogo dei controlli di `/api/health` e gli ultimi 20 errori da un nuovo buffer circolare lato client — più un’impronta di deduplicazione deterministica (`co-web-<base36>`), ti fa rivedere il Markdown esatto e poi apre una issue GitHub precompilata. Nulla viene inviato automaticamente; non trasporta mai il tuo CV, profilo, risposte, URL di lavoro o chiavi. Nuove lib `logbuf.js` + `bug-report.js`; 11 chiavi i18n ×16; `tests/bug-report.test.mjs`.

Nuovo: `public/js/lib/logbuf.js`; `public/js/lib/bug-report.js`.


## [1.97.1] — 2026-07-05
### Corretto
- **Consolidamento guidato dalla revisione e parità della documentazione (seguito della v1.97.0).** Un passaggio sui log di revisione dell'IA ha fatto emergere correzioni reali:
- **`fit-score.js` (badge di fit `◎` della scansione).** `salaryFloor()` non promuove più una tariffa infra-annuale a un falso minimo annuale — «at least 500 EUR/day», «$80/hr», «6000 monthly» ora restituiscono `null` invece di un fattore eliminatorio da 500k/80k. La corrispondenza dei paesi è ora a parola intera (`\b…\b`), così «Germany» non corrisponde più all'aggettivo «German» (né «Nigeria» dentro «Nigerian») e non scatena una falsa violazione di indispensabile-altrove. +3 test in `tests/fit-score.test.mjs`.
- **Parità della documentazione.** Ogni README localizzato ora pubblicizza **16 lingue** in modo coerente — il conteggio/l'elenco della riga Aiuto (×13) e la prosa della sezione Localizzazione più la nota «aggiungi la chiave a tutti gli N file» (×8) erano ancora sui conteggi precedenti alla v1.85 (8/9). Il conteggio degli adattatori dell'aiuto integrato §17 è corretto a **46 adattatori — 41 in inglese + 5 in russo** in tutti i 16 pacchetti.
- Nessun cambiamento di comportamento oltre all'euristica del badge di fit; nessuna nuova route, chiave o aggiunta i18n.

## [1.97.0] — 2026-07-05
### Aggiunto
- **Sorgente di scansione Dassault Systèmes + una revisione della qualità su tre fronti.**
- **Nuova sorgente di scansione — Dassault Systèmes (parità con il career-ops principale, #1498).** `server/lib/sources/dassault.mjs` + `server/lib/portals/adapters/dassault.mjs` rispecchiano il provider Exalead di «ricerca a schede» a costo zero in token del progetto principale (il feed pubblico dietro `3ds.com/careers/jobs`). È un unico endpoint globale, quindi è selezionato per provider (`provider: dassault`) oppure rilevato automaticamente da un host `3ds.com`, con l'host ancorato contro l'SSRF a `www.3ds.com` tramite `redirect:'error'`. L'XML viene analizzato senza DOM (mappe `<Meta>` per ogni `<Hit>`), città/paese vengono estratti dalla stringa di categoria localizzata, e le offerte vengono mantenute solo quando il loro URL pubblico è su `*.3ds.com`. Il registro ora include **46 adattatori** (41 EN + 5 RU); il conteggio di `ALL_ADAPTERS`, le asserzioni di id ordinato e dell'insieme EN di `/api/scan/sources` passano da 40 → 41. Suite `tests/sources-dassault.test.mjs` (10 casi).
- **Correzioni di robustezza portate dal progetto principale.** Il parser di Avature ora tollera due varianti di markup dei tenant in produzione (`article--result` con un suffisso di indice di posizione + un'ancora di titolo JobDetail senza classe, #1541); Get on Board si protegge da un `published_at` `0`/negativo (niente più date fasulle del 1970); SuccessFactors limita l'ultima pagina in modo che non possa superare `MAX_JOBS` (#1528).
- **Correzioni dell'audit del server.** `safe-fetch` non si blocca più su una risposta oltre il limite — il percorso del limite di dimensione ora risolve la promise direttamente invece di attendere un evento `'end'` che uno stream distrutto non emette mai (corregge i recuperi di pagine grandi su `/api/pipeline/preview` + auto-pipeline). Il logging di attività SSE `stream.*` è di nuovo raggiungibile (il controllo di `/api/stream/` è stato spostato sopra la guardia generale «salta GET»).
- **Correzioni dell'audit della SPA.** Il selettore di schede di `#/stats` si protegge da una corsa di rendering asincrona — il risultato di una scheda lenta non può più sovrascrivere una scheda più recente a cui l'utente è già passato. Le conferme di eliminazione del colloquio simulato e del networking ora passano un titolo + corpo adeguati (niente più finestra di dialogo con corpo vuoto).
- **Correzioni di traduzione.** Corretti valori del dizionario non tradotti — ucraino `config.modes*` (Adaptive Framing / Exit Narrative / Location Policy), russo `eval.jdLbl` («Job Description»), italiano `dash.quick.contactoSub` («referral» → «segnalazione») — oltre alla localizzazione del testo fisso inglese `**16 locales**` nei CHANGELOG di ru/uk/ja/ko/zh-CN/zh-TW.
- Nuovo: `server/lib/sources/dassault.mjs`; `server/lib/portals/adapters/dassault.mjs`.

## [1.96.0] — 2026-07-04
### Aggiunto
- **Orientamento professionale (Epic 27).** Una nuova pagina **`#/orientation`** risponde alla domanda «quali direzioni fanno davvero per me?» — la lettura che otterresti da un test di orientamento, ma dedotta dal tuo stesso CV e profilo anziché da un questionario. Fai clic su **Genera profilo** e il modello restituisce i tuoi **vettori di carriera più adatti** (quali degli otto archetipi — Funzionalista, Amministratore, Comunicatore, Specialista, Analista, Innovatore, Manager, Imprenditore — si adattano, con evidenze), una inclinazione di tipo professionale, ruoli consigliati, punti di forza professionali legati al tuo CV, tendenze di stile di lavoro e raccomandazioni di sviluppo. È una **riflessione dell'IA su come si legge il tuo CV — non un test psicometrico**: non inventa mai risultati e non riporta mai punteggi numerici come se fossero misurati. Esportalo in Markdown o PDF; nulla viene scritto sul disco.
  - Nuova route `server/lib/routes/orientation.mjs` (24° modulo di route) — `POST /api/orientation/generate` costruisce il prompt del profilo da CV+profilo+two-pager+memoria tramite la cascata di provider condivisa, con un fallback manuale da copiare e incollare e **nessuna scrittura di file**.
  - Riutilizza `report-export.js` per Markdown/PDF/copia, all'interno del gruppo di navigazione **Sviluppo**.
  - Test: `tests/orientation-routes.test.mjs` (delimitazione a riflessione / nessun punteggio inventato, modo manuale con seed da CV/profilo). 7 nuove chiavi i18n ×16 lingue, Aiuto **§28** ×16.
- Nuovo: `#/orientation`; `server/lib/routes/orientation.mjs`.

## [1.95.0] — 2026-07-04
### Aggiunto
- **Piano di carriera (Epic 26).** Una nuova pagina **`#/career-plan`** trasforma il tuo CV e il tuo profilo in un piano di sviluppo concreto e personalizzato. Scegli un **orizzonte** (6/12/24 mesi) e un **focus** opzionale, e il modello — leggendo il tuo CV, il profilo, il two-pager e la nota di memoria — scrive un'istantanea del punto di partenza, una SWOT di punti di forza/crescita, obiettivi come SMART / OKR / WOOP, traiettorie alternative, un piano di competenze hard/soft, una **roadmap mese per mese**, metodi di monitoraggio dei progressi, insidie e mosse di supporto. Pianifica in avanti a partire da ciò che i tuoi materiali mostrano davvero e non inventa mai fatti sulla tua storia. Modificalo inline, **Salvalo** nel livello utente (`config/career-plan.md`) ed **esportalo** in Markdown o PDF.
  - Nuova route `server/lib/routes/career-plan.mjs` (23° modulo di route) — `GET`/`PUT /api/career-plan` (scrive `config/career-plan.md`) + `POST /api/career-plan/generate` (cascata di provider condivisa, fallback manuale, nessuna invenzione). `PATHS.careerPlan`.
  - Riutilizza l'helper condiviso `report-export.js` (v1.94.0) per Markdown/PDF/copia, e un nuovo gruppo di navigazione **Crescita**.
  - Test: `tests/career-plan-routes.test.mjs` (delimitazione, round-trip GET/PUT, prompt consapevole dell'orizzonte e con seed da CV/profilo). 20 nuove chiavi i18n ×16 lingue, Aiuto **§27** ×16.
- Nuovo: `#/career-plan`; `server/lib/routes/career-plan.mjs`; `PATHS.careerPlan`.

## [1.94.0] — 2026-07-04
### Aggiunto
- **Statistiche, rielaborate (Epic 25).** La pagina `#/stats` è ora una sezione **Statistiche** a tre schede, con grafici veri e molti più dati. Una nuova scheda **Report di mercato** chiede al modello un'analisi delle retribuzioni e del mercato del lavoro per i tuoi ruoli target in una regione e valuta che scegli — sintesi esecutiva, retribuzione per livello con percentili P10/P25/P75/P90, principali datori di lavoro, una tabella delle competenze richieste, frequenza dei benefit, la ripartizione ufficio/ibrido/remoto, tendenze a 12–24 mesi e indicazioni per la negoziazione. Ogni cifra è etichettata come una **stima orientativa dalla conoscenza del modello**, mai presentata come dati estratti. Una nuova scheda **La mia pipeline** rappresenta il tuo tracker: distribuzione dei punteggi, imbuto degli stati, principali aziende e ruoli, candidature nel tempo e tassi di conversione. La vista originale dei ruoli target (posti vacanti/retribuzione per paese + tendenza degli snapshot salvati) si sposta in una terza scheda, ora con un **selettore di valuta** e una panoramica **annunci-per-ruolo**.
  - **Esporta qualsiasi report** in Markdown o PDF, oppure copialo — tramite l'helper condiviso `report-export.js` (download del blob Markdown; PDF tramite l'esistente runner inline-PDF).
  - Nuova route `server/lib/routes/market.mjs` (22° modulo di route) — `POST /api/stats/market` costruisce un prompt di analisi di mercato dal tuo CV/profilo (così conosce i tuoi ruoli target), regione e valuta, lo esegue attraverso la cascata di provider condivisa e ripiega su un prompt copia-e-incolla senza chiave. Nessuna scrittura di file.
  - Test: `tests/market-routes.test.mjs` (delimitazione regione/valuta, prompt etichettato per onestà, modalità manuale con seed da CV/profilo). 36 nuove chiavi i18n ×16 lingue, Aiuto **§26** ×16.
- Nuovo: `#/stats` rielaborata in schede; `server/lib/routes/market.mjs`; `public/js/lib/report-export.js`.

## [1.93.0] — 2026-07-04
### Aggiunto
- **Livello di memoria (Epic 24).** Una nuova pagina `#/memory` conserva una breve nota modificabile «ricorda questo su di me» che l'assistente tiene a mente in **ogni** attività:
  - **Una nota, ovunque** — poiché è inserita in `bundleProjectContext`, la nota raggiunge automaticamente ogni richiesta AI (valutazione, colloquio simulato, networking, CV Studio) su **tutti** i provider. Scrivila una volta; orienta tutto.
  - **Orientamento, non fatti** — cattura le tue preferenze e il modo in cui ti piace lavorare (tono, formato, deal-breaker, cadenza), mai nuove affermazioni fattuali sulla tua esperienza — quelle vivono ancora solo nel tuo CV, nel tuo profilo e nel tuo two-pager. Salvata nel livello utente in `config/memory.md`, mai sovrascritta dagli aggiornamenti.
  - **Suggerisci dai tuoi dati** — `POST /api/memory/suggest` esamina il tuo tracker delle candidature alla ricerca di schemi comportamentali e abbozza punti elenco che puoi rivedere e modificare. Legge il tuo tracker; non inventa mai fatti e non effettua alcuna chiamata live.
- Nuovo: `server/lib/routes/memory.mjs` (21° modulo di route — `GET`/`PUT /api/memory` + `POST /api/memory/suggest`), `public/js/views/memory.js`, `PATHS.memory` e un blocco `config/memory.md` aggiunto a `bundleProjectContext`. 11 nuove chiavi i18n in tutte le **16 lingue**. Test: `tests/memory-routes.test.mjs`.

## [1.92.0] — 2026-07-04
### Aggiunto
- **CV Studio (Epic 21).** Una nuova pagina `#/cv-studio` offre al tuo CV tre strumenti onesti e per lo più locali:
  - **Diagnostica del curriculum** — un punteggio deterministico da 0 a 100 con spiegazioni per ogni controllo (impatto quantificato, verbi deboli, buzzword, lunghezza, sezioni fondamentali, informazioni di contatto). Puramente lato client (`window.CvDiagnostics`) — nessun LLM, nulla di inventato, ogni riscontro spiegato così che *tu* decida cosa cambiare.
  - **Maschera privacy** — oscura i PII (email, telefono, link/handle, indirizzo civico e facoltativamente il tuo nome → iniziali) prima di condividere il tuo CV come campione o screenshot. Gira interamente nel browser (`window.CvPrivacy`); segnala esattamente cosa ha oscurato e non conserva mai l'originale.
  - **Rendilo umano / abbina la voce** — incolla una riga o un paragrafo rigido e riscrivilo nella *tua* voce, ancorato lato server a `voice-dna.md` e `writing-samples/`. Guardrail rigido: può riordinare, snellire e rimodulare la voce, ma non introduce mai un fatto, una metrica o un risultato non già presente nel testo. Gira live tramite la cascata condivisa dei provider, oppure restituisce un prompt da copiare-incollare senza chiave.
- Nuovo: `server/lib/routes/cv-studio.mjs` (20° modulo di route — `POST /api/cv-studio/humanize`), `public/js/views/cv-studio.js`, `public/js/lib/cv-diagnostics.js`, `public/js/lib/cv-privacy.js`, `PATHS.voiceDna` + `PATHS.writingSamplesDir`. 29 nuove chiavi i18n in tutte le **16 lingue**. Test: `tests/cv-diagnostics.test.mjs`, `tests/cv-studio-routes.test.mjs`. (La galleria di modelli, l'esportazione Word e l'archivio PDF degli annunci sono tracciati come lavoro successivo di CV Studio.)

## [1.91.0] — 2026-07-04
### Aggiunto
- **Networking e ricerca approfondita sulle aziende (Epic 16).** Una nuova pagina `#/networking` trasforma un'azienda in un piano attuabile per ottenere un colloquio, ancorato al tuo CV, al profilo e al two-pager:
  - **Dossier aziendale** — un brief conciso su cosa fa l'azienda, i segnali recenti degni di citazione e gli agganci "perché sono adatto" tratti dal tuo percorso reale.
  - **Chi contattare** — 3–5 persona target (hiring manager, recruiter interno, un IC senior del team, un contatto caldo/ex compagno di studi) con una stringa di ricerca LinkedIn concreta per trovare ciascuno. Non inventa mai nomi reali.
  - **La via di presentazione più calda** — il percorso caldo più realistico per il *tuo* profilo (datore di lavoro/scuola/community in comune, un percorso di secondo grado o un DM a freddo ad alto segnale) e il perché.
  - **Bozze di contatto** — messaggi brevi e specifici per le persona principali, ancorati ai tuoi punti di prova reali.
  - **Live o manuale** — gira live tramite la cascata condivisa dei provider con una chiave qualsiasi, oppure restituisce un prompt pronto da copiare-incollare (ripiego onesto, nulla di inventato). **Salva piano** conserva un piano concluso nel livello utente (`networking/net-{company}-{role}-{date}.md`); la pagina elenca, apre ed elimina i piani salvati.
- Nuovo: `server/lib/routes/networking.mjs` (19° modulo di route), `public/js/views/networking.js`, `PATHS.networkingDir`. Riutilizza la cascata `server/lib/llm-dispatch.mjs` della v1.90.0. 24 nuove chiavi i18n in tutte le **16 lingue**. Test: `tests/networking-routes.test.mjs`.

## [1.90.0] — 2026-07-04
### Aggiunto
- **Mock Interview 2.0 (Epic 15).** Una nuova pagina `#/mock-interview` trasforma il tuo CV, il profilo, il two-pager e la story bank in una simulazione di colloquio turno per turno:
  - **Pratica conversazionale** — indica un ruolo target (+ azienda / descrizione dell'annuncio opzionali) e l'intervistatore apre con una domanda mirata. Ogni risposta inviata riceve una replica strutturata: **Feedback** (punti di forza + la lacuna STAR+R), un **Score** (`N/5`) e una **Prossima domanda** che sonda la parte più debole della tua ultima risposta. Ancorato lato server ai tuoi materiali reali — non inventa mai esperienze che non hai.
  - **Consapevole della story bank** — `interview-prep/story-bank.md` è integrato nel prompt (stesso livello di fiducia di `cv.md`), così il feedback può indirizzarti verso le tue storie migliori.
  - **Live o manuale** — con una chiave del provider il turno gira live tramite la cascata condivisa (Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models); senza chiave ottieni un prompt pronto da copiare-incollare (ripiego onesto, nessuna risposta inventata).
  - **Sessioni salvate** — clicca **Salva trascrizione** per conservare un colloquio concluso nel livello utente (`interview-prep/mock-{company}-{role}-{date}.md`); la pagina elenca, apre ed elimina le sessioni salvate.
- Nuovo: `server/lib/routes/interview.mjs` (18° modulo di route), `public/js/views/mock-interview.js`, `server/lib/llm-dispatch.mjs` (cascata di provider condivisa), `PATHS.storyBank`, `bundleProjectContext({ extraFiles })`. 30 nuove chiavi i18n in tutte le **16 lingue**. Test: `tests/interview-routes.test.mjs`.

## [1.89.0] — 2026-07-04
### Aggiunto
- **Fit di mercato del candidato — il two-pager (Epic 14).** Una nuova pagina `#/two-pager` ti permette di catturare ciò che *tu* vuoi davvero dal tuo prossimo ruolo, modellata sul "two-pager di Mnookin" da *Never Search Alone*:
  - **Builder guidato** — una narrazione in prima persona "Chi sono", una nota "Ambiente di destinazione" e cinque editor a chip: **cosa amo**, **must-have**, **cosa detesto**, **deal-breaker** e **non negoziabili**. Salvato nel **livello utente** del progetto padre (`config/two-pager.yml`) via `PUT /api/two-pager` — mai sovrascritto dagli aggiornamenti di sistema.
  - **Assistente di compilazione AI** (`POST /api/two-pager/draft`) — costruisce un prompt Mnookin pronto all'uso con il tuo CV + profilo inline, da eseguire in qualsiasi LLM e reincollare. Usa solo i tuoi materiali; nulla è inventato.
  - **Badge di fit** — ogni annuncio su `#/scan` mostra ora un punteggio di fit `◎ N` (lato client, via `window.FitScore`) che confronta tipo di lavoro, paese, soglia salariale e trasferimento dell'annuncio con il tuo two-pager. Onesto per progetto: quando un annuncio non offre alcun segnale confrontabile, **nessun badge viene mostrato** (mai un numero inventato). Le violazioni dei deal-breaker pesano più delle semplici avversioni.
  - **Alimenta ogni valutazione** — il two-pager salvato è inline in `bundleProjectContext`, così tutte le valutazioni LLM a valle fondono le tue preferenze dichiarate con il match CV-vs-JD.
- Nuovo: `server/lib/routes/two-pager.mjs`, `public/js/views/two-pager.js`, `public/js/lib/fit-score.js`, `PATHS.twoPager`. 27 nuove chiavi i18n su tutti i **16 locale**. Test: `tests/two-pager-routes.test.mjs`, `tests/fit-score.test.mjs`.

## [1.88.0] — 2026-07-04
### Modificato
- **Rifinitura dell'issue #29 — lacune i18n nella Scansione + igiene dell'API.**
- **Localizzate le ultime stringhe di Scansione hardcoded** (roadmap v1.69.4): le pillole di riepilogo per fonte (`N nuove / M corrispondenti`), i toast `N nuove offerte` e il badge `reloc` ora passano per `t()` — 4 nuove chiavi (`scan.pillNew`, `scan.pillMatching`, `scan.newOffers`, `scan.relocBadge`) su tutti i **16 locale**. Gli utenti non anglofoni non vedono più inglese sparso nel flusso di scansione principale.
- **Disabilitato l'header `X-Powered-By`** (roadmap v1.69.5): `app.disable('x-powered-by')` in `createApp()` — il server non pubblicizza più Express. (Il resto di quell'epica era già stato consegnato: `parentVersion` rimuove il suo commento release-please, l'interruttore del tema in modalità chiara, la chiusura delle modali al cambio di rotta e la localizzazione di «Score» (`rep.score`) nei Report.)
- Test: `tests/scan-i18n-gaps.test.mjs` + un'asserzione di assenza di `X-Powered-By` in `tests/security-headers.test.mjs`.

## [1.87.0] — 2026-07-04
### Aggiunto
- **4 nuovi provider di scansione senza autenticazione (parità con il career-ops padre v1.16.0).** Il registro dello scanner cresce da **41 → 45 adattatori** (40 EN + 5 RU) — tutti pubblici, senza autenticazione, con host fissato, `redirect:'error'` (sicuri da SSRF), ciascuno con un test isolato per la CI:
  - **Get on Board** (`getonbrd`) — JSON:API pubblico dell'intero portale (tecnologia LATAM/remoto), selezionato per provider, paginato. `server/lib/sources/getonbrd.mjs`.
  - **Amazon** (`amazon`) — JSON di ricerca pubblico di `amazon.jobs`, rilevato per host o `provider: amazon`, paginato per offset. `server/lib/sources/amazon.mjs`.
  - **Avature** (`avature`) — ATS `*.avature.net` per tenant, analizzato da HTML, rilevato per host o `provider: avature`. `server/lib/sources/avature.mjs`.
  - **SAP SuccessFactors** (`successfactors`) — elenco di riquadri RMK per tenant (`*.successfactors.eu/.com`, `jobs2web.com`), analizzato da HTML. `server/lib/sources/successfactors.mjs`.
- Ciascuno fornisce un `sources/<slug>.mjs` (con `meta` auto-rilevato → menu a discesa `#/scan`) **e** un `portals/adapters/<slug>.mjs` in `ALL_ADAPTERS` (la regola dei due registri) + `tests/sources-<slug>.test.mjs`. Il conteggio di `ALL_ADAPTERS` e le asserzioni di id ordinato e dell'insieme EN di `/api/scan/sources` sono saliti da 36→40; `GET /api/scan/sources` ora elenca 45.

## [1.86.0] — 2026-07-03
### Aggiunto
- **Statistiche per ruoli target (`#/stats`) — statistiche di mercato su offerte e retribuzioni per i TUOI ruoli target.** Una nuova pagina Analytics legge i tuoi **ruoli target dal profilo** (`config/profile.yml` → non hardcoded) e le offerte dell'ultima scansione, quindi mostra, per ruolo e paese: **offerte per paese** e **retribuzione mediana per paese (USD)** — aggregate lato client (`public/js/lib/role-stats.js`, riutilizzando `window.Countries`) a partire dai dati sparsi che gli scanner già raccolgono.
- Le retribuzioni in qualsiasi valuta vengono normalizzate in USD tramite una tabella FX esplicitamente approssimativa, con un avviso sulla dimensione del campione — mai inventate. Inoltre **filtri per ruolo e paese** e grafici a barre e di tendenza in SVG inline scritti a mano (nessuna nuova dipendenza, sicuri per la CSP — solo `addEventListener`).
- **Salva snapshot** (`POST /api/stats/snapshot`) persiste l'aggregato corrente in `data/role-stats.jsonl`; il **grafico di tendenza** (`GET /api/stats/trend`) traccia il numero di offerte nel tempo — la vista «dinamica». Ibrido onesto: gli snapshot provengono da dati di scansione locali, aggiornati su richiesta.
- Completamente localizzato in tutti i **16 locale** (26 nuove chiavi i18n). Novità: `server/lib/routes/stats.mjs` (16° modulo di rotte), `public/js/lib/role-stats.js`, `public/js/views/stats.js`, `PATHS.roleStats`; test `role-stats.test.mjs` (7) + `stats-routes.test.mjs` (5).

## [1.85.0] - 2026-07-03
### Aggiunto
- **Localizzazione tedesca (`de`), italiana (`it`) e turca (`tr`)** — l'interfaccia, la guida integrata, il README e il CHANGELOG sono ora disponibili anche in queste tre lingue (portate dal set di locale di career-ops 1.16.0). L'interfaccia supporta ora 16 lingue.
- Il selettore della lingua ora elenca Deutsch 🇩🇪, Italiano 🇮🇹 e Türkçe 🇹🇷; il rilevamento automatico della lingua del browser riconosce `de`, `it`, `tr`.
- Le impalcature dei prompt (`server/lib/prompts.mjs`) sono state localizzate per le tre nuove lingue.
## [1.84.0] — 2026-06-30

**Re-apply cooldown + compensation in pipeline.md (parent career-ops v1.15.0 parity).** Two scanner upgrades:

- **Re-apply cooldown** (#1201): the EN scan now skips roles at companies you applied to recently, so results stay focused on NEW openings. Configure per-company windows in `config/profile.yml` under `re_apply_windows:` (`last_apply_date`, `same_role_days`, `applied_to: [roles]`, optional `cross_role_bucket`); company matching is punctuation-insensitive + word-boundary (`server/lib/cooldown.mjs`). Off when the key is absent; the scan log shows `Cooldown skipped: N`.
- **Compensation in pipeline.md** (#1017): scanned offers now persist their salary as an optional trailing column (`url | <salary>`) in `data/pipeline.md`. The URL stays the dedup key (the `| comp` column is stripped on read), the cell is sanitized (no row/column injection, formula-leading neutralized), and bare-URL pipelines stay backward-compatible.

Ships `tests/cooldown.test.mjs` + pipeline compensation tests. Source count unchanged at **41** (both are scan-logic upgrades, not new boards).

## [1.83.0] — 2026-06-30

**Repost / ghost-posting detector (parent career-ops v1.15.0 parity).** A new **🔁 Reposted / ghost roles** panel on `#/scan` flags company+role clusters that were re-listed under *different* URLs within a rolling 90-day window — a signal of stale pipelines and ghost postings. Backed by a fuzzy role-title matcher (`server/lib/role-matcher.mjs`) and a read-only detector (`server/lib/detect-reposts.mjs`) over `data/scan-history.tsv`, surfaced via `GET /api/scan/reposts` (window clamped 7–365 days; fail-soft on a malformed history). Also: `/api/health` `parentVersion` now reports just the semver — the release-please `# x-release-please-version` comment is stripped. Ships `tests/detect-reposts.test.mjs`. (Source count unchanged at **41** — reposts is an analysis feature, not a new board.)

## [1.82.0] — 2026-06-30

**NoDesk scan source (parent career-ops v1.15.0 parity).** The board-wide [NoDesk](https://nodesk.co) remote-jobs RSS feed is now a first-class scan source — add a `provider: nodesk` entry and it appears in the `#/scan` **Source** dropdown (**41 adapters** total: 36 EN + 5 RU). Host-pinned to `nodesk.co` with `redirect:'error'` (SSRF-safe); titles split on `Role at Company` (NoDesk has no location tag, so location stays empty); all rows remote. Ships a CI-isolated `tests/sources-nodesk.test.mjs` suite; full unit suite green at 1523.

## [1.81.0] — 2026-06-29

**Parent career-ops parity — 13 new job-board scan sources.** Ports the latest provider batch from [`Fighter90/career-ops`](https://github.com/Fighter90/career-ops) `main` into the in-process scanner. **Board-wide public APIs** (provider-selected): **Arbeitnow**, **Himalayas**, **Jobicy**, **Landing.jobs**, **4 Day Week**, **The Muse**, **The Hub**, **Jobspresso** (RSS), and **Hacker News “Who is hiring?”** (Algolia two-step). **Poland boards** (host- or `provider:`-detected): **JustJoin.it** and **NoFluffJobs** (POST search). **Per-tenant ATS** (auto-detected from `careers_url`): **Pinpoint** (`<slug>.pinpointhq.com/postings.json`) and **Rippling** (`ats.rippling.com/<slug>` → `api.rippling.com` board). Every source is host-pinned with `redirect:'error'` (SSRF-safe) and selectable in the `#/scan` **Source** dropdown — the registry now ships **40 scanner adapters** (35 EN + 5 RU). Adds 13 CI-isolated per-source test suites; full unit suite green at 1513.

## [1.80.0] — 2026-06-28

**Five scan upgrades (ideas from [bracketouverte/job-crawler](https://github.com/bracketouverte/job-crawler), reimplemented).** (1) **Teamtailor** source — per-tenant `<slug>.teamtailor.com` career sites via their public `/jobs.rss` feed, auto-detected from `careers_url` (host-pinned + `redirect:'error'`); the registry now ships **27 adapters**. (2) **Source quarantine** — a source that returns a permanent 404/410 is recorded in `data/scan-quarantine.json` and skipped on later scans (self-healing: retried after 14 days), killing the recurring dead-slug noise. (3) **Max per source** — an optional `#/scan` field caps how many jobs each board contributes (∞ by default). (4) **Posted within** — a client-side age filter (24h / 7d / 30d) on the results table. (5) **Saved searches + ★ favorites** — name & reuse filter sets and star jobs, persisted in `localStorage` with defensive validation (a corrupt cache resets cleanly); the results cache is reset before each scan and refilled live.

## [1.79.0] — 2026-06-28

**WeWorkRemotely scan source (parent career-ops v1.14.0 parity).** The board-wide [We Work Remotely](https://weworkremotely.com) remote-jobs RSS feed is now a first-class scan source — add a `provider: weworkremotely` entry and it appears in the `#/scan` **Source** dropdown (**26 adapters** total). Host-pinned to weworkremotely.com with `redirect:'error'` (SSRF-safe); titles split on `Company: Role`. Also: `title_filter` keywords are now **trimmed before** the length check, so a whitespace-only keyword can't compile into a match-everything filter (parent #1261).

## [1.78.2] — 2026-06-27

**i18n + UX hardening (follow-ups to v1.78.1).** The brand logo's accessible name is now localized in all 13 languages (`nav.logoHome`). Global-search **Enter** while already on `#/scan` force-re-renders so the pre-filled term is never lost (same-route guard). `health.title` is now translated in Polish (`Kondycja`) and Danish (`Systemtilstand`) — previously left in English. Tests 1235 → 1238.

## [1.78.1] — 2026-06-27

**Scan UX fixes.** The `#/scan` results table now auto-refreshes live during a scan and once more after it finishes — no manual reload. The top-bar global search shows an **Enter** hint and, on a non-URL query, jumps to `#/scan` with the search box pre-filled (was `#/tracker`). The brand logo now links to the dashboard (home).

## [1.78.0] — 2026-06-27

**Geography filter on the Scan page — filter job results by country, with flags.** A new **Country** dropdown in `#/scan` lists every country detected across your scanned results (flag emoji + count), so you can keep only roles tied to a specific country — alongside the Remote/Hybrid/Onsite work-type filter, so you can search both country-bound and remote work. Backed by a new `countries.js` helper that maps a posting’s free-text location (country names, aliases, and ~100 major job-market cities) to an ISO country + flag; detection is conservative and never guesses (unmapped/remote locations stay under “All countries”).

## [1.77.0] — 2026-06-27

**Danish (Dansk) added as the 13th interface language.** Full Danish UI translation, in-app Help guide (19 H2 / 75 H3), README, and CHANGELOG. Danish joins the flag language picker; the i18n machinery (assembler, audit, parity gates, snapshot) now spans 13 locales.

## [1.76.0] — 2026-06-26

**Parent career-ops v1.13.0 parity — six new job sources, scanner hardening, and an uncapped results table.**

### Added
- **Six per-tenant ATS sources** — BambooHR, Breezy HR, Comeet, Personio, Recruitee, SolidJobs. They auto-detect from the `careers_url` host (Comeet needs the full `api:` careers-api URL) and each pins its host with an anchored regex + `redirect:'error'` (SSRF-safe). All selectable in the `#/scan` **Source** dropdown — the registry now ships **25 adapters** (20 EN + 5 RU). Adds a `fetchText` helper for Personio's XML feed.
- **`trust_filter`** — optional, annotate-only trust scoring (0–100, level high/medium/low, flags) for each scanned posting. Sub-`high` rows get a language-neutral ⚠ badge in `#/scan`; nothing is ever dropped.
- **Arbeitsagentur `remoteMatch` + `remoteMaxPages`** — config-driven remote detection: `title` (regex), `filter` (server-side `homeoffice=nv_true` + pagination), or `off`.

### Changed
- **No scan result cap.** The `MAX_STORED_RESULTS` display cap (2000) was removed — every matched posting is stored and the `#/scan` table pages through them (200/page). Large sweeps no longer lose their tail.
- **Title-filter robustness** — short all-letter acronyms (COO, SDR…) now match on word boundaries (no more “COO” in “Coordinator”); malformed `title_filter` config can no longer crash a scan. Both the ATS and regional scanners.

### Tests
- +32 cases (1190 → **1222**): `sources-ats-providers`, `title-filter`, `arbeitsagentur-remote`, `trust-validator`, and a rewritten `scan-result-cap` “no cap” guard.

## [1.75.2] — 2026-06-19

**docs: full documentation parity for the v1.75.0 scanner aggregators across all 12 locales.** No code change — brings the user-facing docs in line with the seven sources that landed in v1.75.0:

- **Help guide (12 locales).** §5 gains a `content_filter` block (description/snippet keyword gating, sibling of `location_filter`) and an aggregators note; §7 lists the seven new sources in the one-click-scan sweep and the full **Source** dropdown enumeration; §17's adapter count is corrected from the stale "11 adapters" to "19 adapters — 14 English + 5 Russian". No `##`/`###` heading was added, so the gated 19 H2 / 75 H3 structure is unchanged.
- **README (9 full locales).** New "Aggregator boards (v1.75.0)" bullet under the scan sources, plus the release badge bumped to v1.75.2. (The abbreviated pl/uk/ar READMEs have no per-source list and are intentionally untouched there.)
- **Reference docs.** `docs/portals-examples.md` gains a copy-paste "Aggregator boards" section with accurate `provider:` / `<provider>:` config blocks for all seven; `docs/PROJECT.md` updated to **19 adapters**; `docs/sdd/CONVENTIONS.md` documents the two-registry distinction (`sources/registry.mjs` for the dropdown vs `portals/registry.mjs` for fetching), the `provider:`-based aggregator selection threaded as `opts.company`, the scan-write sanitizer (`scan-sanitize.mjs`), and the v1.75.1 test count (1190).
- **QA.** Added `qa/QA-REGRESSION-PROMPT-v1.75.2-FULL.md` — the full-surface release-gate driver, refreshed for the v1.75.x scan-aggregator cycle.

---



## [1.75.1] — 2026-06-19

**fix(scan): robustness polish on the v1.75.0 config-driven sources.** Three small hardening fixes from the post-release review (no behavior change for a healthy scan):

- **Abort-aware pagination delays.** The Glints (300 ms) and Jobstreet/SEEK (200 ms) inter-page courtesy pauses now resolve immediately when the scan's `AbortSignal` fires, via a new `delay(ms, signal)` helper in `server/lib/http-json.mjs`, so a disconnected client can't hold a paginating scan open for an extra pause.
- **Descriptive non-JSON error.** `fetchJson` now wraps a non-JSON `2xx` body (e.g. an HTML maintenance page served with status 200) as `non-JSON 2xx response from <url>` instead of surfacing a bare `SyntaxError`, so the scanner's per-source error log names the misbehaving endpoint.
- **Stronger scan-write normalization.** `normalizeScanScalar` now collapses the vertical tab, form feed, and the Unicode line/paragraph separators (`\v \f U+2028 U+2029`) in addition to `\r \n \t` — a strict superset, so no record/line separator a spreadsheet or viewer might honor survives into `scan-history.tsv`.

---


## [1.75.0] — 2026-06-19

**feat(scan): port parent career-ops v1.12.0 — seven new job sources, content filtering, and security/quality fixes.** The web-ui runs its own in-process scanners (it does not shell out to the parent's `scan.mjs`), so parent v1.12.0's provider and scan changes do not flow through automatically — this release reimplements the applicable ones in the web-ui's adapter contract.

- **Seven new scanner sources.** Three board-wide remote aggregators — **RemoteOK**, **Remotive**, **Working Nomads** — drop into the auto-discovered `server/lib/sources/*.mjs` pattern (select with `provider: remoteok` / `remotive` / `workingnomads`). Four config-driven regional aggregators — **IBM** careers, **Arbeitsagentur** (German Federal Labor Agency), **Glints** (SE Asia), **Jobstreet / SEEK** — read a per-entry `<provider>:` config block; en-scanner now threads the resolved company entry through to every fetcher so they can read it. All seven appear in the `#/scan` source dropdown automatically.
- **`content_filter` (parent #974).** Optional `portals.yml` block (`positive` / `negative` keyword lists) that gates a posting on its description/snippet text — mirrors `location_filter` semantics; postings without a description always pass. Wired into both EN and RU scanners.
- **Scan-write hardening (parent #1098).** External feed metadata is now sanitized before it lands in `data/scan-history.tsv` and `data/pipeline.md`: control characters are collapsed (a company/title newline can no longer inject a TSV row) and a leading `= + - @` is neutralized against spreadsheet formula injection.
- **Ashby `secondaryLocations` (parent #1073).** The Ashby source now folds each secondary location's region label plus postal `addressLocality` / `addressCountry` into the location string (deduped), so an EU-eligible role whose primary label reads e.g. "Canada" surfaces for the `location_filter`.
- **Evaluation report-shape validation (parent #819).** `/api/evaluate`'s in-process providers (Anthropic / OpenAI / Qwen / OpenRouter / GitHub Models) now flag a malformed A–G / `SCORE_SUMMARY` report as a non-fatal `warnings` array; the Gemini eval path already inherits the guard from the parent's `gemini-eval.mjs`.
- **docs:** Antigravity CLI added to the supported-assistant lists across all 12 READMEs (maps to the Gemini provider).

Inherited for free from the `git pull` of the parent (web-ui shells out to these): Japanese CJK PDF font fallback (#1053), ATS-safe PDF fonts (#1074), LaTeX CJK guard (#1054), tracker/merge/followup/dashboard fixes, and the `modes/zh` Chinese modes (the web-ui lists modes dynamically).

---


## [1.74.3] — 2026-06-18

**docs(parent-source): point the parent `career-ops` repo at the [`Fighter90/career-ops`](https://github.com/Fighter90/career-ops) fork.** The web-ui now references the maintainer's fork as the parent project everywhere it is a live source: the `bin/setup.sh` installer's `CAREER_OPS_REPO` clone default, every `git clone` / "sits on top of" / onboarding link across all 12 READMEs, and the agent docs (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `docs/`). Author credit to santifer (and the unofficial-UI disclaimer) is unchanged — only the source/clone URLs moved. `tests/sh-files.test.mjs` now asserts the installer clones the fork.

---


## [1.74.2] — 2026-06-17

**fix(health): surface `GITHUB_MODELS_API_KEY` as an optional check on `#/health` and in `/api/status/providers`.** The v1.74.0 GitHub Models provider was configurable in `#/config` but had no row on the Health page and was missing from the `keysConfigured` provider surface. Added the optional check (same "set / unset (manual mode)" wording as the other five live-eval providers) and `github` (+ its `GITHUB_MODELS_MODEL`) to `/api/status/providers`, so the active-provider routing and Health page now reflect all six. `tests/api.test.mjs` health-row test extended to all six providers.

---



## [1.74.1] — 2026-06-17

**docs + test: README "Install an AI assistant" section; full branch coverage for the Gemini connector.** Added an install/login table to the README — install links for **Claude Code / Gemini CLI / Codex / Qwen Code / OpenCode / GitHub Copilot CLI** + each one's `#/config` provider mapping + "log in before continuing" (mirrors the career-ops.org/docs Quick Start; clarifies the web-ui is the standalone, no-CLI-needed alternative). New `tests/gemini-connector.test.mjs` (8 cases) covers every `runGemini` branch — no-key, success, API error, empty/blocked completion, malformed body, timeout, network error, `hasGeminiKey` — taking `server/lib/gemini.mjs` to **100% statements**. Overall coverage **96% lines / 88% branch / 96% funcs**. Suite 1126 → 1134.

---



## [1.74.0] — 2026-06-17

**feat(llm): GitHub Models (Copilot) as the 6th provider + canonical 6-assistant alignment.** [career-ops.org/docs](https://career-ops.org/docs) lists six AI coding assistants — Claude Code, Gemini CLI, Codex, Qwen Code, OpenCode, GitHub Copilot CLI. The web-ui now supports all six: five map to existing live providers (Anthropic / Gemini / OpenAI / Qwen / OpenRouter), and **GitHub Copilot CLI** gains a dedicated **GitHub Models** connector — `runGitHubModels` (OpenAI-compatible; a GitHub PAT with the `models` scope), configurable in `#/config` (`GITHUB_MODELS_API_KEY` + `GITHUB_MODELS_MODEL`) and selectable via `LLM_PROVIDER=github`; 6th in the `auto` order. Help bundles + READMEs now list the canonical six (renamed Qwen CLI→Qwen Code; added Gemini CLI + GitHub Copilot CLI), and the README adds a full **mode-reference + portal-adapter link table** to career-ops.org/docs so every feature traces back to the parent. `tests/llm-provider-context.test.mjs` extends the fetch-boundary matrix to all six providers (cv.md + profile.yml inlined + artifact returned); new `GITHUB_MODELS_*` keys added to all 12 locale dictionaries. Suite 1125 → 1126.

---



## [1.73.0] — 2026-06-17

**feat(llm): generic Gemini connector + verified CV/profile context across all providers.** Added `server/lib/gemini.mjs` (`runGemini`) — a zero-dependency Gemini `generateContent` client returning the same `{markdown, usage, error}` shape as the Anthropic / OpenAI-compatible clients. **Fix:** `/api/mode/:slug` and `/api/deep` previously piped their prompts through the oferta-only `gemini-eval.mjs`, so Gemini **Run live** returned an *evaluation* instead of the requested artifact (cover letter, outreach, brief). They now call `runGemini` with `bundleProjectContext`, so `cv.md` + `config/profile.yml` are inlined for Gemini exactly like every other provider — letters/briefs are detailed and personalized. New `tests/llm-provider-context.test.mjs` mocks each provider's HTTP boundary and asserts all five (Anthropic / Gemini / OpenAI / Qwen / OpenRouter) inline `cv.md` + `profile.yml` and return the artifact (mode + deep + evaluate matrix, 9 cases). `/api/evaluate` keeps its oferta-tuned `gemini-eval.mjs`. Suite 1116 → 1125.

---



## [1.72.0] — 2026-06-17

**feat(modes): "Run live" now returns the final artifact directly (single-shot output contract).** The parent `modes/<slug>.md` templates are written for interactive Claude Code sessions — several (cover, contacto, …) pause to ask clarifying questions before producing the result, which made the web-ui's single-shot **Run live** emit a questionnaire instead of the artifact. `buildModePrompt` now wraps every mode in a non-interactive **output contract**: do the analysis (JD breakdown, company notes, ATS keywords, profile↔JD gaps, tone/angle choices) **silently**, pick sensible defaults from `cv.md` / `config/profile.yml` for anything the template would normally ask, and output **only the final artifact** — closed with a per-mode "output ONLY {the cover letter / outreach message / …}" reminder. So clicking **Run live** on `#/cover` now returns the cover letter itself; the same fix applies to every generic mode (cover, contacto, interview-prep, project, training, followup, patterns) in all 12 locales (the artifact is written in the UI language via the locale directive). Suite 1103 → 1116.

---



## [1.71.2] — 2026-06-17

**docs(i18n): publish the documentation-consistency pass.** Every README "Translations of this guide" block now lists all 11 sibling languages (previously some omitted English/Français and self-linked), with the blank line before the section break restored. The full QA regression prompt is renamed to the current version, and the docs (CLAUDE.md, CONVENTIONS, LOCALIZATION, PROJECT-CONTEXT) are synced to the current version and test count (1103). No code or behavior change — docs only, so the help/UI translations and all features from 1.70.0–1.71.1 are unchanged.

---



## [1.71.1] — 2026-06-17

**fix(i18n): the in-app help guide is now fully translated in all 12 languages.** Added `docs/help/{pl,uk,ar}.md` (each holding the gated 19 H2 / 75 H3 structure) so `#/help` serves a native bundle for Polish, Ukrainian, and Arabic instead of falling back to English — `GET /api/help/{pl,uk,ar}` now return their own locale. Wired into every help gate (`help-ui`, `help.test`, `help-ru-config-section`, `canonical-docs-coverage`). Also completed every 12-language translation list: the README "Translations of this guide" block (9 READMEs), the localized CHANGELOG "Translations:" headers (8 files), and refreshed stale doc counts (CONVENTIONS test count → 1100; help "fall back" notes → 12 translated bundles). Suite 1100 → 1103.

---



## [1.71.0] — 2026-06-16

**feat(cover): generate a cover-letter PDF straight from `#/cover`.** The cover mode (added in v1.70.0) produces the letter text; the result now offers a **Generate PDF** button that renders it through the shared inline markdown→PDF pipeline (`POST /api/stream/pdf/inline` → `generate-pdf.mjs`), the same path interview-prep uses. You can now produce the letter and ship a PDF without leaving the SPA.

**test/docs: v1.70.0 review hardening.** Added CI-isolated coverage for the cover mode (allowlist + prompt assembly, via `modes-endpoints.test.mjs`), the flag `<select>` switcher + Arabic RTL (`dirFor`/`<html dir>`, new `tests/lang-switcher-rtl.test.mjs`), `top.langLabel` in every locale, the cover-letter PDF wiring (`tests/cover-letter-pdf.test.mjs`), and the `prompts.mjs` locale directive + scaffolding for fr/pl/uk/ar (`tests/locale-scaffold.test.mjs` — locking the latent French gap closed in v1.70.0). Refreshed three stale "all 8" → 12-locale / 9-help-bundle references in `docs/sdd/CONVENTIONS.md`. Refreshed the full-project QA regression prompt (`qa/QA-REGRESSION-PROMPT-v1.71.0-FULL.md`).

---



## [1.70.0] — 2026-06-16

**feat(i18n): three new UI languages — Polish (pl), Ukrainian (uk), and Arabic (ar, with full RTL) — bringing the SPA to 12 locales, matching every language in the parent career-ops README.** Each new locale ships a complete 697-key dictionary (`public/js/lib/locales/i18n-dict.{pl,uk,ar}.js`), gated by the existing parity / coverage / no-latin-leak / no-personal-data suites. Arabic adds genuine right-to-left support: `i18n.js` sets `<html dir="rtl">` for RTL locales and a scoped `[dir="rtl"]` block in `app.css` mirrors the chrome (sidebar, notifications drawer, markdown tables/blockquotes, inline spacing) — LTR locales are byte-for-byte unchanged. New `top.langLabel` key (×12) names the picker for screen readers.

**feat(ui): flag-icon `<select>` language switcher replaces the wrapping button row.** With 12 locales the old `.lang-btn` row wrapped to three lines in the sidebar; a native `<select>` (each option prefixed with a flag emoji) scales cleanly, is keyboard- and screen-reader-friendly out of the box, and stays CSP-safe (change handler via `addEventListener`, no inline JS). Flags degrade to region letters where the platform lacks flag glyphs, so the language label is always the load-bearing identifier.

**feat(cover): port the parent's cover-letter mode (career-ops v1.10.0 + v1.11.0 greeting) into the SPA.** New `#/cover` page under the Application nav group, built on the generic mode runner: Job description + Company/Role + an optional salutation → a tailored letter generated from `cv.md` / `modes/_profile.md`. Added `cover` to the server `MODE_ALLOWLIST` and a `cover.*` i18n block (×12 locales).

**chore(compat): track parent career-ops v1.11.0.** Verified the read/write contract is intact — `data/applications.md` stays the markdown source of truth (the v1.11.0 SQLite tracker index is a derived cache), tracker columns are still header-mapped. `parentVersion` now reports 1.11.0.

**fix(i18n): close a latent gap where French (added v1.61.0) was missing from `server/lib/prompts.mjs` `LOCALE_NAMES` and `SCAFFOLD_STRINGS`** — French LLM calls silently defaulted to English output and English scaffolding. fr/pl/uk/ar are now all wired into the prompt-locale path.

> Known follow-ups (tracked in `qa/v1.70-regression/`): the in-app **help guide** (`docs/help/`) falls back to English for pl/uk/ar (the UI chrome itself is fully localized); the parent's interactive **interview onboarding**, **reverse-ATS discovery**, and newer **scan providers** are not yet surfaced in the SPA.

---



## [1.69.2] — 2026-06-12

**fix(test): close a test-isolation leak that let `npm test` overwrite the user's real `config/profile.yml` and `data/scan-history.tsv`.** `tests/critical-fixes.test.mjs` statically imported `prompts.mjs` at the top of the file; `prompts.mjs` transitively imports `paths.mjs`, which resolves `PROJECT_ROOT` eagerly at module load (PATHS resolves once per process). Because that import ran **before** the `before()` hook set `CAREER_OPS_ROOT` to a temp dir, PATHS pinned the **real** parent — so the F-008 `PUT /api/profile` wrote the "Acceptance Test" fixture into the user's real profile on every run (and similar writes escaped the temp root). Fix: load `prompts.mjs` via **dynamic `import()`** inside `before()`, after the env is set (the server was already loaded that way). New `tests/test-root-isolation.test.mjs` (2 cases) guards every isolation-needing test against statically importing a `paths.mjs` carrier (`server/index.mjs`, `prompts.mjs`, `store.mjs`, `en-scanner.mjs`, `ru-scanner.mjs`, `paths.mjs`). **No production-code change.** Suite 1084 → 1086.

---



## [1.69.1] — 2026-06-12

**fix(scan): raise the `#/scan` result display cap 500 → 2000 per region so large regional sweeps are no longer silently truncated.** A real RU scan produced **1352** matching jobs, but only the first **500** were stored in `data/last-scan.json` and rendered in the results table — **852 relevant jobs were hidden** (the `2000 scanned → ~600 shown` symptom: 139 EN + 500 RU). Both `server/lib/en-scanner.mjs` and `server/lib/ru-scanner.mjs` now cap the stored `filtered` set at a shared, env-overridable constant `MAX_STORED_RESULTS` (default **2000**, override via `SCAN_MAX_RESULTS`). This is **display-only** — appending to `pipeline.md` and `scan-history.tsv` already used the uncapped `fresh` (new-since-last-scan) set and was never truncated. New `tests/scan-result-cap.test.mjs` (3 cases) locks the default, the env override, and that neither scanner hard-codes `slice(0, 500)`.

**fix(health/ui): `#/health` check cards no longer overflow.** A long check name/value (e.g. `PROFILE CUSTOMIZED · still on template …`, `PLAYWRIGHT (PARENT NODE_MODULES)`) collided with the right-hand **Fix →** button + status badge and spilled out of the card, because the generic `.flex-between` flex children default to `min-width: auto` and never shrink. The row is now tagged `.health-check-row` with scoped CSS: the left text shrinks + wraps (`min-width: 0`), the action group keeps its size (`flex: 0 0 auto`) and wraps below on narrow cards. New `tests/health-card-overflow.test.mjs` (2 cases). Suite 1079 → 1084.

---



## [1.69.0] — 2026-06-12

**feat(scan): P-14 plug-in scanner auto-discovery — drop a `.mjs` in `server/lib/sources/` to register a new source.** Pre-v1.69 the source list in `server/lib/sources/registry.mjs` was a static hand-maintained array — adding a new adapter required editing both `<id>.mjs` AND `registry.mjs`. Closes the `partial` half of the roadmap item P-14 (`docs/ROADMAP.md`). Now every `*.mjs` in `server/lib/sources/` is auto-loaded at module boot; each adapter contributes its identity via a self-describing `export const meta = { value, label, region, configKey? }` block. The 12 shipped adapters (ashby / greenhouse / lever / rss / smartrecruiters / workable / workday + geekjob / getmatch / habr / hh / trudvsem) each grew a `meta` export; `registry.mjs` now uses `readdirSync` + dynamic `import()` resolved at module-eval via top-level await (Node 18+ ESM standard). The public API (`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`, `getRegionalSources`) is unchanged — every existing import keeps working. Validation rejects malformed `meta` (missing `value`/`label`/`region`, RU without `configKey`, region outside `'en'|'ru'`) and logs a single `console.warn` per offending file so half-migrated branches stay diagnostic-friendly. The bundled `registry.mjs` is excluded from self-import. New `tests/sources-registry-discovery.test.mjs` adds 14 cases covering shipped-adapter coverage, drop-in adapter discovery, helper-module skip, malformed-meta rejection, self-import exclusion, missing-directory tolerance, and deterministic ordering. Suite 1065 → 1079.

---



## [1.68.2] — 2026-06-07

**fix(bin): `npx` / `npm link` CLI verbs were broken — resolve the bin path through symlinks.** npm and npx expose `career-ops-ui` as a symlink under `node_modules/.bin/`, where the old `dirname "${BASH_SOURCE[0]}"` resolved to `.bin` instead of the package root — so `npx career-ops-ui init` ran `node node_modules/scripts/init.mjs` and crashed with `MODULE_NOT_FOUND` (local runs after `npm install` were unaffected, which hid the bug). Both `bin/career-ops-ui.sh` and `bin/start.sh` now canonicalize `SCRIPT_DIR` through the symlink chain (`readlink` loop + `cd -P`), so every verb works from the repo, via `npm link`, and via `npx`. Adds a regression lock in `tests/sh-files.test.mjs` that runs a verb through a `.bin`-style symlink. Suite 1065/1065.

---



## [1.68.1] — 2026-05-29

**fix(scan): per-source fetch timeout 10s → 60s.** v1.67.1's 10s fail-fast also cut off slow-but-alive Ashby boards that just needed more time. Raise the default to one minute so those return. Trade-off: a genuinely dead/hung source now holds a concurrency slot for the full 60s (slower worst-case scan), and the chronic hangers (Perplexity, Supabase, Resend, …) likely still time out — a per-source / lower-Ashby-concurrency fix would address those properly. Override with `SCAN_FETCH_TIMEOUT_MS`. Suite 1063/1063.

---



## [1.68.0] — 2026-05-29

**feat(scan): reworked the result-filter panel — labelled fields, an Apply button, an On-site option, and a working salary filter.** Every filter on `#/scan` is now a labelled field (label **above** the control, not a placeholder): Search · Work type · Salary from · Salary to · Source · Scope. An explicit **Apply** button (plus **Reset**, and Enter in any field) re-runs the filter; an on-page hint explains how it works. **The salary range now actually filters** — once you set a *from*/*to* value, jobs whose listed pay falls outside the range **and jobs with no listed salary at all** are dropped (overlapping-range match; currency ignored). The Work type filter gains an **On-site** option alongside Remote / Hybrid / Relocation. New i18n keys ×9; `salaryInRange` made strict; suite 1063/1063.

---



## [1.67.1] — 2026-05-29

**fix(scan): per-source fetch timeout 30s → 10s (fail-fast).** v1.67.0's 30s raise recovered only ~half the slow Ashby boards; the rest (Perplexity, Supabase, Resend, DeepL, Ramp, …) hang regardless of the deadline, so a longer timeout just stalled every scan waiting on dead slots. 10s fails fast on the chronic hangers and keeps scans responsive. Override with `SCAN_FETCH_TIMEOUT_MS`. Suite 1060/1060.

---



## [1.67.0] — 2026-05-29

**feat(scan): salary range filter (from / to) on `#/scan`, plus a longer per-source fetch timeout.** The results table gains two numeric inputs — salary **from** / **to** — beside the text and remote filters. Each row's free-text salary (`от 100 000 до 200 000 ₽`, `120000-150000 USD`, `$120K–$150K`, …) is parsed to a numeric range and matched with overlapping-range semantics; rows with no published salary are kept, so the filter narrows the list instead of gutting it (comparison is currency-agnostic — no FX conversion). Also **raises the per-source scan fetch timeout 15s → 30s** (override: `SCAN_FETCH_TIMEOUT_MS`) — Ashby's `includeCompensation` payloads routinely took >15s under 8-way concurrency, so ~30 Ashby boards were timing out every scan. New `window.Skills.parseSalaryRange`/`salaryInRange` + i18n ×9; 13 new tests; suite 1060/1060.

---



## [1.66.0] — 2026-05-28

**feat(scan): RU sources now walk ALL result pages, not just the first.** hh.ru, Habr Career and Trudvsem each only paged the first ~50 hits per query; they now follow pagination to the end — `&page=N` for hh.ru/Habr, `offset`/`meta.total` for Trudvsem — deduping across pages and stopping when a page adds nothing new (or at a 50-page safety cap). A query like "Backend разработчик" now returns the full result set instead of one page (e.g. hh.ru PHP 17 → 55+ across 3 pages; Trudvsem returns all 72). Per-page fetches keep the existing timeout + AbortSignal. 4 new tests; suite 1045/1045.

---



## [1.65.0] — 2026-05-28

**feat(scan): hh.ru is now scraped from its public website instead of the JSON API — works from any IP, no proxy.** `api.hh.ru` started returning a bare `403 forbidden` to every programmatic client regardless of IP (US, RU datacenter, RU residential, RU mobile) or User-Agent — an edge anti-bot block, not a documented API error. The website (`hh.ru/search/vacancy`) still serves full server-rendered results to any browser-like client, so the adapter now parses that HTML (like Habr Career). **Removes the `HH_PROXY` env added in 1.64.0 and the `undici` dependency** — no proxy, key, or User-Agent setup needed. Tests rewritten for the HTML parser; suite 1041/1041.

---



## [1.64.0] — 2026-05-27

**feat(scan): route the hh.ru request through a Russian proxy via `HH_PROXY`.** hh.ru geo-blocks its API by **IP**, not User-Agent — so `HH_USER_AGENT` alone never lifted a 403 from a non-RU exit node. Set `HH_PROXY` to a Russian HTTP/HTTPS proxy URL (e.g. `http://user:pass@ru-host:port`) and **only** the hh.ru request is routed through it; every other source keeps its direct connection. Built on `undici`'s `ProxyAgent` (new runtime dep); the dispatcher is omitted entirely when `HH_PROXY` is unset, and a changed value is picked up on restart. 3 new tests; suite 1041/1041.

---



## [1.63.2] — 2026-05-27

**feat(scan): live % progress + per-source detail in the `#/scan` console.** The progress bar is now **determinate** — scanners emit progress events (EN: per company; RU: per query) forwarded over SSE, and the bar fills with a live **"Scanning… NN%"** label (animated indeterminate stripe only until the first event). Each source's first failure (timeout / 403 / network) is now logged to the console in detail (e.g. `⚠ hh timed out: …`), then repeats are suppressed. 1 new test; suite 1040/1040.

---



## [1.63.1] — 2026-05-27

**style(scan): make the `#/scan` progress bar more prominent.** Wrapped the in-flight indicator with a visible **"Scanning…"** caption and bumped the bar to **8px** (was a thin 4px) so it's clearly noticeable while a scan runs. No behavior change.

---



## [1.63.0] — 2026-05-27

**feat(scan): per-request fetch timeout + `#/scan` progress bar.** Scanner source requests had no deadline, so a stalled upstream (e.g. `api.hh.ru` from a blocked IP) could **hang the whole scan**. A new `server/lib/fetch-timeout.mjs` wraps the scanners' `fetchImpl` (`makeTimeoutFetch`, default **15s**, override via `SCAN_FETCH_TIMEOUT_MS`) so every source request has a hard deadline — a timed-out source is recorded as a non-fatal error and the scan continues (Habr keeps working even when hh.ru is unreachable). The `#/scan` page also shows an indeterminate progress bar while a scan is in flight (localized `scan.progress` across all 9 locales). 7 new tests; suite 1039/1039.

---



## [1.62.3] — 2026-05-27

**docs: clarify install (career-ops-ui runs inside `career-ops/web-ui/`) + `init` troubleshooting, across all 9 locales.** Rewrote the install section into **Option 1** (one curl) / **Option 2** (clone the UI *inside* an existing career-ops project as `web-ui`) + CLI verbs + provider setup + a **Troubleshooting `init`** block — addressing the common confusion of cloning career-ops-ui standalone and running `init` without the parent project. Also added the nested-layout note to the `/help` §1 Setup section and summarized the whole v1.62.* line in the README highlight. Docs-only; no code change.

---



## [1.62.2] — 2026-05-27

**fix(help): `#/help` filter is now full-text (finds H3 subsections like RSS).** The help-page search/TOC filter previously matched only H2 section titles, so the v1.62.x RSS docs (an H3 under §5 Portals & sources) weren't findable. Each section's body text is now indexed into the filter, so searching e.g. "RSS" surfaces §5. Pure client-side; no API change.

---



## [1.62.1] — 2026-05-27

**feat(scan): RSS in the source filter + RSS location fix.** The `#/scan` source-filter dropdown now lists **RSS** (added to `server/lib/sources/registry.mjs` + the SPA fallback list), so RSS-board results (LaraJobs, WeWorkRemotely, …) are filterable like any ATS source. The RSS adapter no longer maps the feed `<category>` tag onto `location` — non-location tags there made `location_filter` wrongly drop remote roles; `location` is now empty so feeds pass location filtering. Scan-button tooltips/labels and the source-list i18n string (`dash.quick.scanSub`) updated across all 9 locales to include Workable / SmartRecruiters / Workday / RSS. i18n snapshot + scan-sources endpoint test (6 → 7 EN sources) updated.

---



## [1.62.0] — 2026-05-27

**feat(scan): generic RSS adapter for non-ATS job boards.** A new `rss` portal adapter (`server/lib/portals/adapters/rss.mjs` + `server/lib/sources/rss.mjs`) lets the scanner pull jobs from any RSS feed — LaraJobs, WeWorkRemotely, RemoteOK, golangprojects and other boards outside Greenhouse/Ashby/Lever. Zero new dependencies: feed parsing is regex-based with CDATA + HTML-entity support (titles/companies are tag-stripped, astral code points decoded safely). Activated per-company via `provider: rss` / `rss:` / `feed_url:` in `portals.yml`, so it never intercepts ATS-matched companies. `ALL_ADAPTERS` grows 6 → 7. 29 new tests; documented across all 9 README locales.

---



## [1.61.1] — 2026-05-22

**fix(i18n): localize the theme-toggle title + aria-label across all 9 locales (MINOR-001).** The dark/light theme button (`#theme-toggle`) hardcoded `title="Toggle theme"` and `aria-label="Toggle theme"` in `index.html` — the tooltip and screen-reader text never translated, on any locale. A new `top.themeToggle` key + a `data-i18n-title` handler in `applyI18n()` (mirroring the v1.58.15 search-aria-label fix) localize both attributes on boot and on every language switch. Locked by `tests/playwright-theme-toggle-i18n.mjs` (9 locales + runtime-switch) and two static guards in `tests/qa-report-fixes.test.mjs`. The lone LOW finding from the v1.61.0 French sign-off. (MINOR-001)

---



## [1.61.0] — 2026-05-22

**feat(i18n): add French as the 9th UI language.** New per-locale dictionary `public/js/lib/locales/i18n-dict.fr.js` (`window.__I18N_DICT_FR`), at full **668-key** parity with English; new help bundle `docs/help/fr.md` (**19 H2 / 73 H3**, exact structural parity with `en`). `fr` is registered in the language switcher and browser auto-detect (`i18n.js`), the assembler (`i18n-dict.js`), `index.html` (a `<script>` tag before the assembler), the test snapshot, and every test locale list. The initial translation table came from **PR #9** (community contribution). No logic change: `t()` and every view are unchanged. **1001 / 1001** unit tests; the Playwright locale-sweep grows to 9 subtests. (FR-LOCALE)

---



## [1.60.0] — 2026-05-22

**refactor(i18n): split the 8-column megafile into per-locale files (I18N-SPLIT).** The translation dictionary lived in one 849-line `public/js/lib/i18n-dict.js` (key → { en, es, … } across 8 locales). It is now **one file per locale** — `public/js/lib/locales/i18n-dict.{en,es,pt-BR,ko,ja,ru,zh-CN,zh-TW}.js` (each assigns `window.__I18N_DICT_<LANG> = { key: string }`) plus a shared `i18n-dict.aliases.js` — so a translator edits a single language in isolation (the i18next / OpenWA layout). `i18n-dict.js` is now a small **assembler** that merges the per-locale tables back into the exact same `window.__I18N_DICT` shape, so `t()`, every view, and every call-site are byte-for-byte unchanged. Everything loads synchronously via `<script src>` — **no build step, no runtime fetch** (both hard rules preserved). A captured snapshot proves the migration is lossless (assembled dict ≡ pre-split dict, 678 keys). Tooling + tests made split-aware via a shared `tests/helpers/i18n-vm.mjs`: `tools/i18n-audit.mjs`, the CI inline coverage check (which had silently become a no-op against the post-v1.23 split — it now actually loads the dictionary), and ~25 dictionary tests. New `tests/i18n-locale-files.test.mjs` (snapshot equality · per-locale key parity · alias integrity · index.html load order) and `tests/playwright-locale-sweep.mjs` (every page × 8 locales renders + localizes in real Chromium). 994 → **1000** unit · 62 → **70** Playwright. No user-facing behaviour change. (I18N-SPLIT)

---



## [1.59.13] — 2026-05-21

**fix(i18n): collapse TRUE duplicate keys via @alias + final personal-data purge (pre-fr, follow-up to v1.59.12).** Two parts. **(1) Personal data:** swept the WHOLE repo, not just the dict — the maintainer's real name was used as incidental test-fixture data (`tests/health-doctor-unify.test.mjs`, `tests/llm-output.test.mjs`) and in archived QA reports; all replaced with neutral examples (`Jane Doe`). `LICENSE` copyright + `package.json` author switched from the real legal name to the public `Fighter90` handle. Repo now greps clean for the real name/email everywhere. **(2) Duplicate keys (I18N-CL3, properly):** added an `@alias` mechanism to `i18n.t()` — a key `{ '@alias': 'x.y' }` resolves to a canonical key. Collapsed the 10 keys that are byte-identical across all 8 locales (`nav.help`/`dash.quick.helpCta` → `help.title`; `nav.cv` → `cv.title`; `nav.health`/`dash.quick.healthCta` → `health.title`; `nav.reports`/`dash.reports`/`dash.quick.reportsCta` → `rep.title`; `nav.apply` → `apply.title`; `nav.interviewPrep` → `interviewPrep.title`). The contributor's own `nav.config`/`config.title` example is deliberately NOT aliased — they diverge in Spanish (short sidebar `Configuración` vs full title `Configuración de la aplicación`); aliasing would change a rendered label. Coverage test, CI inline check, and `tools/i18n-audit.mjs` are all alias-aware (skip alias keys for parity, enforce every target exists, resolve before dup-counting). New `tests/i18n-alias.test.mjs` (3 cases) locks integrity + behaviour. 991 → **994** unit. Reduces the French translator's surface — true dupes are now translated once. (I18N-CL3, personal-data-sweep)

---



## [1.59.12] — 2026-05-21

**fix(i18n): i18n-dict.js cleanup — pre-fr ship (I18N-CL1, I18N-CL2, I18N-CL4).** External French-locale contributor audit. **I18N-CL1 (privacy):** `training.coursePh` carried a vendor-specific cert name across all 8 locales — replaced with a neutral generic placeholder (`Cloud architecture certification` + native equivalents). **I18N-CL2 (hygiene):** the `followup.lastPh` dict fallback was a frozen `2026-04-21` literal — replaced with a localized format hint (`YYYY-MM-DD` / `AAAA-MM-DD` / `ГГГГ-ММ-ДД`); the live dynamic `today − 14d` placeholder (U-3, v1.58.23) in `mode-page.js` was already working and is now lock-tested. **I18N-CL4 (audit):** new `tools/i18n-audit.mjs` + `npm run audit:i18n`, wired into CI — hard-fails on personal data, locale-parity gaps, empty values, and bare-calendar-date placeholders. **I18N-CL3 (decision):** the ~50 duplicate-value key groups (e.g. `nav.scan` / `scan.btnRun` / `scan.col.company`) are intentional — distinct UI roles that non-English locales translate differently; deduping them would remove i18n flexibility, so they are reported as informational warnings, not failures (documented in the dict header). 3 new tests (988 → **991** unit). Unblocks the upcoming French locale PR. (I18N-CL1, I18N-CL2, I18N-CL4)

---



## [1.59.11] — 2026-05-21

**fix(test): v1.59.11 — e2e-comprehensive 12-case CI failure root-caused and closed.** Twelve cases (Pipeline · Activity · Health · 7 Mode pages · 404 · Profile) had been failing on every CI run going back to v1.58.x because `page.goto(baseUrl + '/#/X')` is a no-op for hash-only URL changes in Playwright. Once the CV-save step set the hash to `#/cv`, every subsequent `goto` to a hash route silently kept the page on `#/cv` — Activity/Health/Mode/Profile selectors never matched, and the 4 'pass' results in between were vacuous (their assertions found CV's elements). Fix in [tests/e2e-comprehensive.mjs](tests/e2e-comprehensive.mjs): new `goRoute(hash)` helper that bounces through `about:blank` before each `goto`, forcing a real navigation and SPA re-bootstrap. All 17 `page.goto(`${baseUrl}/#/...`)` call sites replaced. Diagnostic instrumentation (`E2E_DUMP_ON_FAIL=1` env var) added for future investigations. Result: **23 / 23 cases green** locally · 988 / 988 unit · 20 / 20 smoke e2e. (e2e-harness-r1)

---



## [1.59.10] — 2026-05-21

**fix(api): NEW-F1-sub-r1 (v1.59.10) — un-encoded `../` traversal guard hoisted above all /api route registrations.** v1.59.8 added a `req.originalUrl.includes('..')` middleware, but it was placed AFTER `app.all('/api/*', JSON-404)` AND AFTER all route handlers — by which time Express had already normalised the URL (collapsing `..` segments). `/api/jds/../../../etc/passwd` was rewritten to `/etc/passwd` and fell through to the SPA static handler (200 OK on `index.html`). v1.59.10 hoists the guard to the TOP of [server/index.mjs](server/index.mjs) `createApp()` (above every `register*Routes(app)` call) so it inspects the verbatim request URL before any normalisation. Pattern: `/^\/api(\/|$)/.test(req.originalUrl) && /\.\.\//.test(req.originalUrl)`. New [tests/api-path-traversal.test.mjs](tests/api-path-traversal.test.mjs) — 6 cases driving the real http module (Node's fetch normalises `..` client-side, so we drop to `http.request` with a verbatim path). Unknown `/api/*` paths still return `{error: 'unknown api'}` from the existing `app.all` fallback. 982 → **988** unit. (NEW-F1-sub-r1)

---



## [1.59.9] — 2026-05-21

**fix(ux): UX-A5-r4 (v1.59.9) — Help TOC scroll-spy debug marker + behavioural lock-test.** Sixth-cycle closure: previous five attempts (v1.58.45 / v1.58.52 / v1.59.0 / v1.59.3 / v1.59.8) all shipped with passing static tests but the bug stayed open because the tests asserted source-shape, not behaviour. v1.59.9 fixes the gap: (1) `<body data-toc-spy="active">` debug marker — single selector any tester can use to answer "is the spy alive?" without needing to scroll; (2) synchronous initial paint at mount tail covers the router-pre-paints-view case; (3) double-rAF re-compute covers the route-handler-returns-before-router-appends case; (4) resize listener subscribed so viewport-flip mid-scroll re-paints; (5) cleanup removes BOTH listeners and the marker on hashchange. [public/js/views/help.js](public/js/views/help.js) algorithm: linear scan with `else break;` short-circuit (O(active-index) per scroll event). New [tests/help-toc-spy-behavior.test.mjs](tests/help-toc-spy-behavior.test.mjs) runs the algorithm against 6 synthetic-geometry scenarios + 1 algorithm-parity check against help.js source — the test fails if the algorithm regresses, before any browser run. 973 → **982** unit. (UX-A5-r4)

---



## [1.59.8] — 2026-05-21

**fix(ux+api): v1.59.8 — UX-A5-r3 + NEW-F1-sub (HIGH + LOW bundled per FIX-PROMPT-FINAL-CONSOLIDATED).** Doctrine-exception release: the 2026-05-20 FINAL REGRESSION-v1.59.7 report explicitly recommended bundling these two. UX-A5-r3 (HIGH) — after 4 ship attempts with IntersectionObserver all failed live verification, [public/js/views/help.js](public/js/views/help.js) replaces the IO entirely with a plain scroll listener. Root cause: with rootMargin -20%/-55% the trigger band ended at 45% of viewport, but scrollIntoView({block:'center'}) lands the target at 50% — JUST below the band end. The new scroll listener probes absolute heading positions every rAF, computes the heading whose top is at-or-above 30% of viewport, applies `.toc-current` — no band, no race, no mount-order gotcha. NEW-F1-sub (LOW) — [server/index.mjs](server/index.mjs) adds a late middleware that inspects `req.originalUrl` (not normalised `req.url`) and bounces any `/api`-prefixed request whose raw URL contains `..` as 404 JSON `{error: 'invalid path'}`. New `UX-A5-r3` lock-test + `NEW-F1-sub` static + behavioural guards in tests/. 971 → **973** unit. (UX-A5-r3 · NEW-F1-sub)

---



## [1.59.7] — 2026-05-20

**fix(api): NEW-D3-cache (v1.59.7) — `GET /api/cv` sends `Cache-Control: no-store`.** Matches the SPA-shell policy (W-001 / v1.54.7). `cv.md` is the user-edited primary artifact; a stale browser cache or intermediary proxy could surface yesterday's text and trick the editor into saving over the live version. No ETag dance — the file is small and the GET is rare. New test in [tests/api-404-json.test.mjs](tests/api-404-json.test.mjs) (the suite is the in-process server harness; named for its first test). 970 → **971** unit. (NEW-D3-cache)

---



## [1.59.6] — 2026-05-20

**feat(a11y): NEW-D2-motion (v1.59.6) — honour `prefers-reduced-motion: reduce`.** New `@media (prefers-reduced-motion: reduce)` block in [public/css/app.css](public/css/app.css) neutralizes `animation-duration` + `transition-duration` to 0.01 ms and forces `scroll-behavior: auto` (so the Help TOC click-to-scroll lands instantly). WCAG 2.3.3 (AAA) — users with vestibular disorders, motion sensitivity, or simply OS-level reduced-motion preference now get an animation-free UI. Static guard in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs). 969 → **970** unit. (NEW-D2-motion)

---



## [1.59.5] — 2026-05-20

**fix(api): NEW-F1 (v1.59.5) — unknown `/api/*` returns JSON 404 on every verb.** Pre-fix `app.get("/api/*", …)` was GET-only; POST / PUT / DELETE to an unknown api path fell through to the SPA catch-all and returned an HTML 404, breaking SPA clients that do `try { res.json() } catch {}`. Changed to `app.all("/api/*", …)` in [server/index.mjs](server/index.mjs). New test suite [tests/api-404-json.test.mjs](tests/api-404-json.test.mjs) probes GET / POST / PUT / DELETE on `/api/no-such-endpoint` plus an unknown `:name` under a real handler — 5 new tests, all green. 964 → **969** unit. (NEW-F1)

---



## [1.59.4] — 2026-05-20

**fix(ui): NEW-OR1 (v1.59.4) — `#/config` API-keys summary chip is race-safe.** User-reported transient `Keys: 0 / 5` flash during Save flows. The previous `refreshApiSummary()` cleared `<span>` children before awaiting the network fetch; a concurrent `providers-changed` event could observe the empty state. New implementation in [public/js/views/config.js](public/js/views/config.js):\n\n1. Build new `<span>` nodes **before** any DOM mutation.\n2. Atomic swap via `apiSummary.replaceChildren(newActive, newCount)` — chip never blanks mid-update.\n3. `inFlight` token counter drops stale resolves when a newer refresh starts.\n4. `lastGoodSt` cache preserves the last known state when fetch returns null (network blip, server reload), so the chip never collapses to `0 / 5` on a transient empty response.\n\nLock-test in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs) asserts all four invariants. 963 → **964** unit. (NEW-OR1)

---



## [1.59.3] — 2026-05-20

**fix(ux): UX-A5-r2 (v1.59.3) — Help TOC scroll-spy harden (third-pass fix).** Two real issues persisted after v1.58.52: (1) `rootMargin: "-30% 0% -60% 0%"` left only a 10% visible band so fast scroll could skip the trigger zone entirely and no IntersectionObserver entry ever fired; (2) no initial-state computation, so a freshly-loaded `#/help` with zero scroll showed zero highlights even though section 1 was visibly active. [public/js/views/help.js](public/js/views/help.js): widened `rootMargin` to `-20% 0% -55% 0%` (25% band), made `root: null` explicit, extracted `applyCurrent(id)` so the same code path serves both observer callbacks and the initial-state pass, and on mount picks the heading closest to 20% from top of viewport. 962 → **963** unit. (UX-A5-r2)

---



## [1.59.2] — 2026-05-20

**fix(ui): v1.59.2 — UX-A9 / UX-A3 chip count + overlap (post-v1.59.1 hotfix).** Three real bugs in the v1.58.62 / v1.58.55 chips, user-reported on the staging surface:\n\n1. **Always `Keys: 0 / 5`.** `/api/status/providers` returns `keysConfigured` as an **array** of provider names; pre-fix `typeof === number` was always false. Now uses `Array.isArray(st.keysConfigured) ? st.keysConfigured.length : 0`.\n2. **Lowercase provider name.** Server returns `anthropic` (not `claude` — `LLM_PROVIDER` env value vs resolved provider name); the NAME map was keyed by `claude:` so it always fell through to the lowercase fallback. Re-keyed `{anthropic, gemini, openai, qwen, openrouter}` in both [public/js/views/config.js](public/js/views/config.js) and [public/js/views/dashboard.js](public/js/views/dashboard.js).\n3. **Sticky chip overlapped other elements.** `.api-keys__summary` had `position: sticky` + `z-index: 5` and created a stacking context that floated above the tablist + page header on scroll. Dropped sticky — the chip is at the top of a short panel already. Lock-test updated to forbid the sticky position. (No version bump alone — counts on existing UX-A3 / UX-A9 lock-tests.) (post-cycle hotfix)

---



## [1.59.1] — 2026-05-20

**fix(test): v1.59.1 — NEW-D1 i18n-no-latin-leaks guard accepts UX-A11 polished ES copy.** During final verification of the v1.59.0 ship I caught a regression: the v1.58.37 NEW-D1 static guard asserted `pipe.title[es]` must match `/vacant|vaca/i` (locking the old `Pipeline de vacantes`). UX-A11 (v1.58.64) refined that to `Pipeline de candidaturas` (candidate-side perspective). Fix: relax the regex to `/vacant|vaca|candidatur/i` so either contextualizing noun passes. No production-code change. 962 unit tests, 0 fail.

---



## [1.59.0] — 2026-05-20

**feat(ui): UX-A14 (v1.59.0) — Mobile (≤ 420 px) media-query pass.** Closes the long-standing mobile audit. Five focused fixes inside a single `@media (max-width: 420px)` block in [public/css/app.css](public/css/app.css):\n\n1. `.card-row` (4 dashboard metric cards) collapses to 1-up below 420 px (was a 900+ px horizontal scroll).\n2. `.dash-hero-cta` stacks vertically with full-width buttons (was side-by-side wrap-mid-label on iPhone SE).\n3. `.page-header` stacks H1+subtitle above the action buttons row (was right-side overflow on 360 px).\n4. `.qa-grid` minmax floor drops from 220 px to 160 px so tiles fit two-up on 360–390 px viewports.\n5. `.api-keys__summary` chips tighten horizontal padding for breathing room.\n\nRegression-lock test in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs). 961 → **962** unit. (UX-A14)

---



## [1.58.65] — 2026-05-20

**test(ui): UX-A2 (v1.58.65) — lock-test on Modes structured field-form.** The 5-field structured form for `#/config → Modes` was already shipped in v1.54.3 (canonical Target Roles / Adaptive Framing / Exit Narrative / Comp Targets / Location Policy + repeatable line-inputs for list-kind fields + × remove + add-row affordance + tagged `{mode: sections|markdown}` collect()). The UX-A2 audit assumed it was missing because all 5 sections initially appeared as `<textarea>` (an artifact of the field-form scaffolding pass before file load). This regression-lock test in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs) prevents a future PR from collapsing the field-form back to raw markdown. No code change. 960 → **961** unit. (UX-A2)

---



## [1.58.64] — 2026-05-20

**fix(i18n): UX-A11 (v1.58.64) — es / pt-BR copy polish: English loanwords replaced.** `eval.subtitle` (es) now uses ajuste del CV / Puntaje / cabecera / informe; pt-BR uses aderência do CV / Pontuação / cabeçalho / relatório. `pipe.title` (es) refined to Pipeline de candidaturas (candidate-side perspective). pt-BR vagas retained. 959 → **960** unit. (UX-A11)

---



## [1.58.63] — 2026-05-20

**fix(ui): UX-A15 (v1.58.63) — Dashboard Pipeline tile gets visual primary weight.** The Quick-actions grid previously gave every tile equal weight; the highest-frequency action (Pipeline) didn't draw the eye. The `qa()` helper in [public/js/views/dashboard.js](public/js/views/dashboard.js) now accepts a 7th `primary` flag; the Pipeline tile is the only one passing `true` so it gets a subtle accent border + larger icon + bolder label via `.qa-tile--primary` ([public/css/app.css](public/css/app.css)). Tile order, copy, click target, and accessibility name are unchanged. Lock-test in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs). 958 → **959** unit. (UX-A15)

---



## [1.58.62] — 2026-05-20

**feat(ui): UX-A9 (v1.58.62) — #/config → API keys panel sticky summary chip.** Before this release, with 5 provider key sections stacked vertically on the API-keys tab, the user had to scroll to know which provider the OR-fallback resolves to or how many keys were configured. [public/js/views/config.js](public/js/views/config.js) now renders a `position: sticky` `.api-keys__summary` at the top of the apiPanel showing `Active: <provider>` + `Keys: <count>/5`. Reuses `/api/status/providers` (no new API surface). Refreshes on `providers-changed` (after Save). Two new i18n keys (`config.activeProvider`, `config.keysConfiguredPrefix`) × 8 locales; one CSS rule (`.api-keys__summary`); static guard in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs). 957 → **958** unit. (UX-A9)

---



## [1.58.61] — 2026-05-20

**docs(readme): UX-A8 (v1.58.61) — first-run cleanup section added across all 8 READMEs.** Fresh clones of career-ops include two QA fixture URLs (`example.com/qa-fixture-*`) in `data/pipeline.md` so the test suite can run hermetically; the README never documented this so first-time users mistook them for real jobs. New `## First run — clean state` section (mirrored in es / pt-BR / ko / ja / ru / zh-CN / zh-TW) instructs `make clean-test-fixtures && npm start` before the first scan. Lock-test in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs) verifies all 8 READMEs reference `make clean-test-fixtures` and `qa-fixture-*`. 956 → **957** unit. (UX-A8)

---



## [1.58.60] — 2026-05-20

**feat(ui): UX-A12 (v1.58.60) — Notifications drawer Clear all + per-entry dismiss.** The v1.58.34 notifications journal capped at 50 entries but offered no manual purge. New `UI.clearToastHistory()` and `UI.dismissToastHistory(ts)` in [public/js/api.js](public/js/api.js) mutate `toastHistory` in place and notify subscribers with sentinel events (`{cleared: true}` / `{dismissed: ts}`); the drawer subscriber in [public/js/app.js](public/js/app.js) detects them, re-renders, and — critically — does NOT bump the unread counter on purges. Drawer head now carries a `Clear all` button (auto-hidden when the journal is empty); every `.notif-item` carries a `×` dismiss button. Three new i18n keys (`notif.clearAll`, `notif.clearAllAria`, `notif.dismiss`) × 8 locales; CSS for both controls; lock-test in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs). 955 → **956** unit. (UX-A12)

---



## [1.58.59] — 2026-05-20

**feat(ui): UX-A13 (v1.58.59) — actionable "Fix →" CTA on failing #/health rows.** Pre-fix the 21 health rows showed status only; a user with `Profile customized: FAIL` had to guess where to go. [public/js/views/health.js](public/js/views/health.js) now renders a small ghost-button `Fix →` next to the badge on failing/optional rows. Mapped targets: `Profile customized` → `#/config?tab=profile`, `cv.md non-empty` → `#/cv`, `portals.yml present` → `#/config?tab=portals`, `data/applications.md` → `#/tracker`. Any `*_API_KEY` or `LLM_PROVIDER*` row routes to `#/config?tab=api-keys` via regex fallback. Unmapped failures stay action-less (no dead-end CTAs). Two new i18n keys (`health.fix`, `health.fixAria`) × 8 locales. 954 → **955** unit. (UX-A13)

---



## [1.58.58] — 2026-05-20

**fix(ux): UX-A10 (v1.58.58) — guard #/cv against leaving with unsaved buffer.** Pre-fix, navigating away from #/cv with unsaved edits silently dropped the buffer. [public/js/views/cv.js](public/js/views/cv.js) now registers a `beforeunload` listener (browser-close confirm — generic dialog per modern browser policy) **and** a `hashchange` listener (SPA-internal nav prompts via localized `window.confirm()` and rewinds the hash if the user cancels). `cvDirty` lives in the save-button IIFE closure; cleanup self-detaches when the hash leaves `#/cv` (M-1 discipline). One new i18n key (`cv.unsavedConfirm`) × 8 locales. 953 → **954** unit. (UX-A10)

---



## [1.58.57] — 2026-05-20

**test(ui): UX-A7 (v1.58.57) — lock-test on the cost-line auto-refresh contract.** v1.58.41 (UX-D-I) wired `UI.providerCostHint` to refresh when the user changes `LLM_PROVIDER` mid-session, but the contract had no static guard — any of the three pieces (config.js dispatch, api.js subscribe, advisor-view call site) could regress silently and the cost line would lie. New regression test in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs) locks all three: (1) `config.js` Save handler dispatches `providers-changed`, (2) `UI.providerCostHint` subscribes via `document.addEventListener`, (3) all 4 advisor views (`#/deep`, `#/evaluate`, `#/auto`, `#/<mode>`) call `UI.providerCostHint(t)`. 952 → **953** unit. (UX-A7)

---



## [1.58.56] — 2026-05-20

**fix(a11y): UX-A4 (v1.58.56) — `.lang-btn` meets WCAG 2.5.8 minimum touch-target.** Pre-fix the language buttons in the sidebar footer measured 23–25 px tall × 47–72 px wide (below the 24×24 WCAG 2.5.8 / WCAG 2.2 AA floor). [public/css/app.css](public/css/app.css) now declares `min-height: 28px` + `min-width: 28px` + `padding: 6px 10px` on `.lang-btn` — every locale label clears the floor with comfortable margin. Sidebar grows by 6 px total (negligible). Lock-test in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs). 951 → **952** unit. (UX-A4)

---



## [1.58.55] — 2026-05-20

**feat(ui): UX-A3 (v1.58.55) — Dashboard active-provider chip.** Above-the-fold chip in [public/js/views/dashboard.js](public/js/views/dashboard.js) hero now surfaces whether the OR-model fell through to a live provider (e.g. `⚡ Live evals: Anthropic claude-sonnet-4-6`) or whether the user is in `📋 Manual prompt mode (no API key set)`. Re-fetches on `providers-changed` (dispatched by [#/config](public/js/views/config.js) save) and on `visibilitychange` (cross-tab refocus). Reuses the existing `/api/status/providers` endpoint (no new API surface). Two i18n keys × 8 locales (`dash.provider.live`, `dash.provider.manual`); one CSS rule (`.dash-chip--provider`). Lifecycle cleanup on `hashchange` away from `#/dashboard` so listeners don't stack across navigation (M-1 discipline). 950 → **951** unit. (UX-A3)

---



## [1.58.54] — 2026-05-20

**fix(ux): UX-A1 (v1.58.54) — defensive Deep-brief structure warning.** The canonical Deep-research brief promised in [career-ops.org/docs](https://career-ops.org/docs/introduction/guides/scan-job-portals) has six H2 sections (Company snapshot / Engineering culture / Recent news / Glassdoor / Interview process / Negotiation leverage). When the upstream prompt drifts and the saved brief is meta-narration instead of the final form, [public/js/views/deep.js](public/js/views/deep.js) now detects the regression (≥3 of the six H2s missing) and prepends a non-blocking `.brief-warning` card explaining what the brief should look like and linking to the canonical reference. The root prompt-layer fix lives in the parent project (`modes/deep.md`, blocked from here); this UI guardrail surfaces the drift instead of silently rendering a degenerate brief. CSS rule added to [public/css/app.css](public/css/app.css); three new i18n keys (`deep.briefUnstructured.title` / `.body` / `deep.docsLink`) cover all 8 locales. New static guard in [tests/qa-report-fixes.test.mjs](tests/qa-report-fixes.test.mjs). 949 → **950** unit. (UX-A1)

---



## [1.58.53] — 2026-05-20

**fix(ux): UX-A6 (NEW-M4-r1) — every saved-research card flows through a single `renderSavedCard()` helper.** v1.58.51 verification regression observed: one card rendered with no structural children (title+date as a single concatenated text node — `software-engineer-generalyesterday`) while another rendered with the proper `<span>` + `<time>` shape — depending on whether the card was page-load-rendered or runtime-inserted. Fix in [public/js/views/deep.js](public/js/views/deep.js#L26-L75): extracted `renderSavedCard(f)` that always emits `.saved-card__title` + `.saved-card__date datetime=…`. Whatever render path inserts a card (page-load `renderArchive`, post-`Run live`, or future code paths) routes through this single helper — the M-4 v1.58.11 flex-gap layout only works with the structural children present. 948 → **949** unit. (UX-A6)

---

## [1.58.52] — 2026-05-20

**fix(ux): UX-A5 (NEW-K1) — `#/help` TOC scroll-spy actually fires now (regression from v1.58.45).** v1.58.51 verification regression caught: 18 H2 elements with ids, 18 TOC `<a>` links, but **0** links ever received `.toc-current` after scroll. Root cause: v1.58.45 wired the observer inside a `setTimeout(0)` that fired BEFORE the router appended the view to `#content`; `document.querySelectorAll(".help-article h2[id]")` matched nothing. Fix in [public/js/views/help.js](public/js/views/help.js#L155-L200): new `mountTocSpy()` observes the **synchronously-built `headings` refs** we already hold (no document re-query); deferred via **double `requestAnimationFrame`** so it fires after the first paint that includes the mounted view. 947 → **948** unit. (UX-A5)

---

## [1.58.51] — 2026-05-20

**chore(docs): v1.58.51 — final housekeeping wrap of the v1.58.37 → v1.58.50 cycle (14 single-fix releases).** No code or behavior changes; consolidation of the qa/ tree, doc currency, and the two lessons learned from this cycle. **(1) qa/ reorg:** all the version-locked source documents — `FIX-PROMPT-CONSOLIDATED.md`, `FIX-PROMPT-FINAL-EXHAUSTIVE.md`, `FIX-PROMPT-v1.58.37_and_beyond.md`, plus 6 root-level session snapshots (`MASTER-REGRESSION.md`, `2026-05-19-*.md`, `career-ops_*.md`, `FIX-PROMPT-v1.58.3.md`, `FIX-PROMPT-v1.58.4_and_beyond.md`) — moved into `qa/archive/v158-cycle/`. `qa/` root now contains exactly the **6 canonical perennial** documents: `README.md`, `REGRESSION-FINAL.md`, `UX-AUDIT-PROMPT.md`, `FUNCTIONALITY-CHECK.md`, `DESIGNER-EXPORT-PROMPT.md`, `G-005-closure-kit.md`. **(2) `qa/REGRESSION-FINAL.md` §13** documents every v1.58.37 → v1.58.50 invariant with its lock-test, organized by class (i18n / a11y / UX feedback / orientation / content fidelity / labels / tooling / docs) + 2 new "lessons captured" entries (markdown-bolded regex pitfall; Publish-runs-tests-against-tagged-ref pitfall). **(3) `qa/UX-AUDIT-PROMPT.md`** baseline table extended with the 14 new closed-in rows. **(4) `CLAUDE.md`** currency lifted (1.58.51, baseline 947/947). **(5) `.claude/PROJECT-CONTEXT.md`** repo-state + test baseline lifted. **(6) `docs/ROADMAP.md`** chain end now at v1.58.51 / Net 947. **(7) `README ×8`** badges and content sync. Test baseline at v1.58.51: **947** unit (unchanged structurally) · 62 Playwright · 20 smoke · 23 comprehensive E2E. Also fixes the v1.58.48 / v1.58.50 Publish-failure pattern — by tagging at the same commit where ALL tests pass (instead of follow-up patches landing only on `main`). (housekeeping)

---

## [1.58.50] — 2026-05-20

**docs: DOC-1 — qa/REGRESSION-FINAL.md gets §5a documenting server error bodies as English-by-policy.** v1.58.36 audit raised NEW-D4: every server 4xx body is English on every locale. Two paths: (A) confirm by-design, document the contract; (B) read `Accept-Language` and localize. The spec recommended A — closing NEW-D4 as `not-a-finding` is least disruption and keeps tests stable. New [qa/REGRESSION-FINAL.md](qa/REGRESSION-FINAL.md) §5a section explains: server JSON error bodies stay English (debuggability boundary — bug reports paste cleanly, CI fixtures stay stable, server tests don't need parallel locale strings). The SPA wraps responses with localized chrome (toast colour, U-4 `Details` summary). `Accept-Language` is intentionally not read; the SPA-side `lang` is stripped before `validateConfig` per the v1.57.2 invariant. v1.59 option B (localized server errors with `{ error, error_en, code }`) is the future gate. 946 → **947** unit. **Closes the v1.58.37 → v1.58.50 queue from FIX-PROMPT-FINAL-EXHAUSTIVE.md** — 14 single-fix releases shipped, every one CI-green + AI-review LGTM. (DOC-1)

---

## [1.58.49] — 2026-05-20

**chore(tooling): TOOL-1 — `make clean-test-fixtures` + `scripts/clean-test-fixtures.mjs`.** v1.58.36 audit: `${CAREER_OPS_ROOT}/data/pipeline.md` had accumulated 1252+ `example.com/job/<n>` lines from regression runs. Manual cleanup was tedious. New [scripts/clean-test-fixtures.mjs](scripts/clean-test-fixtures.mjs) reads `${CAREER_OPS_ROOT or ..}/data/pipeline.md`, drops every line containing `example.com` (case-insensitive), preserves real ATS URLs verbatim, prints the count, and exits 0. `--dry-run` flag prints the would-be result to stdout without touching the file. New [Makefile](Makefile) with `make clean-test-fixtures` and `make clean-test-fixtures-dry-run` targets. 4 new CI-isolated tests in [tests/clean-test-fixtures.test.mjs](tests/clean-test-fixtures.test.mjs) (uses `mkdtempSync` for a synthetic parent — no real-file writes). 942 → **946** unit (4 new TOOL-1 cases). (TOOL-1)

---

## [1.58.48] — 2026-05-20

**fix(ux/onboarding): UX-D-B — `#/dashboard` shows a global warning banner when the user is still on the default fixture profile.** v1.58.36 audit: `/api/health` already includes a `{ name: "Profile customized", ok: false }` row (server checks for `Acceptance Test` / `Jane Smith` / other template names in `server/lib/store.mjs`), but the user only saw it after navigating to `#/health`. Meanwhile every advisor output (Apply / Followup / Contacto / Deep) was addressed to the fixture name — broken first impression. New `profileFixtureBanner()` in [public/js/views/dashboard.js](public/js/views/dashboard.js) renders a `.hero-banner.hero-banner--warning` at the top of the route when the check fails, with localized message (`onboarding.fixtureWarning` × 8) + a CTA button linking to `#/config` (`onboarding.fixProfile` × 8). When the user replaces the fixture, /api/health flips `ok: true` and the next dashboard mount silently omits the banner. New CSS `.hero-banner` + `.hero-banner--warning` rules. 941 → **942** unit. (UX-D-B)

---

## [1.58.47] — 2026-05-20

**fix(ux/naming): UX-D-C — top-bar `Quick scan` renamed to `Open Scan` so the label matches the actual behavior.** v1.58.36 audit: "Quick scan" implied an instant scan with sensible defaults, but the click handler at [public/js/app.js](public/js/app.js#L140) only navigates to `#/scan` — no scan starts. Renamed via the `top.quickscan` i18n key in all 8 locales (en `Open Scan` / es `Abrir Scan` / pt-BR `Abrir Scan` / ko `Scan 열기` / ja `Scan を開く` / ru `Открыть Scan` / zh-CN `打开 Scan` / zh-TW `開啟 Scan`). HTML default text in `index.html` updated to match. Behavior unchanged; only the label honesty improved. 940 → **941** unit. (UX-D-C)

---

## [1.58.46] — 2026-05-20

**fix(ux): UX-D-D — `#/apply` checklist substitutes `{company}-{role}` with slugs derived from the URL/JD.** v1.58.36 audit: the generated checklist's item 5 read `Save filled answers to interview-prep/{company}-{role}.md before submitting.` — the literal `{company}-{role}` placeholders were displayed verbatim and the user had to mentally substitute (or, worse, paste them as-is). New `extractSlugs(url, jd)` + `substitutePlaceholders(text, url, jd)` in [public/js/views/apply.js](public/js/views/apply.js#L36-L93): the host whitelist (`greenhouse / lever / ashby / workable / smartrecruiters / workday`) picks `company` out of the URL path or subdomain, then derives `role` from the trailing path slug (stripped of trailing numeric IDs) — or, as fallback, from the JD's first line. If extraction fails (unknown host / no JD), placeholders become `[company]` / `[role]` (square-bracket convention for "fill in"). Substitution runs once before `parseChecklist`, so the live checklist + Copy-unchecked output stay coherent. 939 → **940** unit. (UX-D-D)

---

## [1.58.45] — 2026-05-20

**fix(ux): UX-D-K — `#/help` TOC scroll-spy highlights the current section.** v1.58.36 audit: as the user scrolled the help body, the TOC sidebar (sticky, ~92 H2 sections) didn't indicate which section they were reading — they had to mentally scan the H2 above the fold against the TOC. New `IntersectionObserver` in [public/js/views/help.js](public/js/views/help.js#L155-L185) observes every `.help-article h2[id]` and applies `.toc-current` to the matching TOC `<a>` link when the H2 enters the upper-third reading band (`rootMargin: "-30% 0% -60% 0%"`). CSS [public/css/app.css](public/css/app.css) gives `.toc-current` a brand-red left-border + `var(--rausch)` color + `font-weight: 600` so the active item reads at a glance. The observer is torn down on hashchange next to the existing scroll listener, so no observer leaks when the user leaves `#/help`. 938 → **939** unit. (UX-D-K)

---

## [1.58.44] — 2026-05-20

**fix(ux): UX-D-L — `#/deep` opened Saved-research brief now has an inline × close button.** v1.58.36 audit: clicking a saved-research card on `#/deep` rendered the brief body inline (Copy / Download / Open in tab / Generate PDF buttons in the header) but the user had no way to **close** the brief without scrolling away or navigating. New `×` button in [public/js/views/deep.js](public/js/views/deep.js) `showResult()` header — clears `out.innerHTML`, mirrors the modal-close pattern (api.js UI.modal × button), keyboard-reachable, aria-label + title from new `deep.closeBrief` i18n key × 8. 937 → **938** unit. (UX-D-L)

---

## [1.58.43] — 2026-05-20

**fix(ux): UX-D-F — `#/evaluate` empty-JD submit now shows a distinct localized error toast (was "JD too short").** Before the fix, clicking Evaluate with an empty textarea fell through to the existing `<50 chars` check and yielded `JD too short (min 50 chars)` — accurate but unhelpful: the real problem is "you typed nothing", not "you typed too little". [public/js/views/evaluate.js](public/js/views/evaluate.js#L28-L45) now checks `!jd` first and surfaces a new `eval.emptyJd` error toast (`"JD is required — paste the full job description"`, localized × 8) + focuses the textarea so the user can start typing immediately. The pre-existing `eval.shortJd` toast still fires for 1–49 char input. 936 → **937** unit. (UX-D-F)

---

## [1.58.42] — 2026-05-20

**fix(ux): UX-D-J — per-advisor ETA chip parity with `#/auto` (UX-6 v1.55.4).** v1.58.36 audit: only `#/auto` showed an honest "⏱ ~1–2 min" chip next to its Run button; the other 7 LLM-driven advisor pages (`#/evaluate`, `#/deep`, plus the 5 mode pages — project / training / followup / contacto / interview-prep / patterns) ran a similar 10-60s call but gave no time hint. Adds a `<span class="advisor-eta">⏱ ~30s</span>` (localized via new `advisor.eta` key × 8) next to `UI.providerCostHint(t)` in [evaluate.js](public/js/views/evaluate.js), [deep.js](public/js/views/deep.js), and [mode-page.js](public/js/views/mode-page.js). CSS extends `.auto-eta` to cover `.advisor-eta` with the same styling. The original `auto.eta` chip stays at `~1–2 min` (it's the only multi-step SSE pipeline). 935 → **936** unit. (UX-D-J)

---

## [1.58.41] — 2026-05-20

**fix(ux/truthfulness): UX-D-I — cost-hint now re-fetches on tab focus + on `providers-changed` event (M-7 v1.58.12 follow-up).** v1.58.12 wired `UI.providerCostHint(t)` to `/api/status/providers` but only fetched ONCE at node creation. If the user opened `#/config` in another tab, picked a different provider, and switched back, the cost line would silently lie until they navigated away and back. Fix in [public/js/api.js](public/js/api.js#L676-L740): extract a named `refreshCostLine()` function and bind it to `document.visibilitychange` (tab regains focus) + a new `providers-changed` `CustomEvent`. The `#/config` Save handler in [public/js/views/config.js](public/js/views/config.js) dispatches the event after a successful POST, so in-page cost lines (`#/auto`, `#/deep`, `#/evaluate`, mode pages) refresh **without** a page reload or route re-mount. 934 → **935** unit. (UX-D-I)

---

## [1.58.40] — 2026-05-20

**fix(ux/docs): UX-D-H — regression-lock: every visible `career-ops.org/docs/...` deep-link must be clickable.** v1.58.36 audit verified live: every existing such URL in `public/js/views/*.js` is already inside `c("a", { href, target: "_blank", rel: "noopener noreferrer" }, …)` (apply.js / batch.js / config.js / reports.js), and every `docs/help/*.md` reference uses markdown `[text](url)`. So this release ships only the **regression lock**: new [tests/external-doc-links.test.mjs](tests/external-doc-links.test.mjs) parses every `views/*.js` and `docs/help/*.md` file and fails if a `career-ops.org/docs/<path>` URL is rendered as plain child text (not inside an `<a>` create, attribute slot, or markdown link). Bare brand mentions of `career-ops.org` without `/docs/` path are tolerated (e.g. "career-ops.org schema" in prose). 2 new test cases added to the suite. 932 → **934** unit. (UX-D-H)

---

## [1.58.39] — 2026-05-20

**fix(ux): NEW-D2 — Dashboard header gets a Refresh button with explicit toast feedback (distinct from connection-banner Refresh of M-9 / v1.58.14).** v1.58.36 audit: there was no in-place refresh on `#/dashboard` — the user had to use the connection-banner Refresh (which does a full `location.reload()` and loses scroll position) just to update the four metric counters. New `↻ Refresh` button in the header in [public/js/views/dashboard.js](public/js/views/dashboard.js) re-fetches `/api/dashboard` and re-renders the view in place via `Router.go("/dashboard")` — no page reload, no scroll loss. Toast pipeline: `Refreshing…` (in-flight) → `Dashboard refreshed` (success) or localized error. Two new i18n keys × 8 locales: `dash.refreshAria` (button aria-label) + `dash.refreshed` (success toast). 931 → **932** unit. (NEW-D2)

---

## [1.58.38] — 2026-05-20

**fix(a11y): NEW-D3 (WCAG 4.1.2) — `#/tracker` search input gets a localized `aria-label` distinct from its placeholder.** v1.58.36 audit: the search input had only `placeholder="Search by company / role…"` and no `aria-label` — screen-reader users heard only the generic role "edit text" with no description of the purpose. Per WCAG 4.1.2 (Name, Role, Value) a standalone search input without an associated `<label>` MUST have an explicit accessible name. Fix in [public/js/views/tracker.js](public/js/views/tracker.js): the `filterText` input now declares `type="search"` + `aria-label: t(track.searchAria, …)`. New `track.searchAria` i18n key in all 8 locales — values explicitly different from the placeholder ("Search applications by company name or role title" vs "Search by company / role…") so the SR doesn't hear the same string twice. 930 → **931** unit. (NEW-D3)

---

## [1.58.37] — 2026-05-20

**fix(i18n): NEW-D1 — `#/pipeline` H1 localized on `es` / `pt-BR` / `ru` + 2 stray RU title leaks fixed (`contacto.title`, `health.title`).** v1.58.36 audit caught the H1 of `#/pipeline` rendering the literal `Pipeline` on `es`/`pt-BR`/`ru` while their sidebar items (`Vacantes` / `Vagas` / `Воронка`) were properly localized — promise-fidelity gap with the closed v1.58.18 I18N-011 doctrine (page H1 must match the sidebar term). Updated `pipe.title` in [public/js/lib/i18n-dict.js](public/js/lib/i18n-dict.js): es → `Pipeline de vacantes`, pt-BR → `Pipeline de vagas`, ru → `Воронка вакансий`. New static guard `tests/i18n-no-latin-leaks.test.mjs` (parses the consolidated DICT, asserts no Latin-only `*.title` value on `ru/ja/ko/zh-CN/zh-TW` outside a small whitelist of proper nouns / acronyms / product names). The guard immediately caught two additional stray RU leaks beyond NEW-D1: `contacto.title` (was `LinkedIn outreach` → `Касания через LinkedIn`) and `health.title` (was `Health` → `Состояние`) — both shipped under the same fix. 928 → **930** unit. (NEW-D1)

---

## [1.58.36] — 2026-05-20

**chore(docs): v1.58.36 — full housekeeping sweep at the close of the v1.58.x cycle.** No code or behavior changes — documentation + qa structure + test baselines synced to reality after 32 single-fix releases. **(1) qa/ reorganization:** the three version-locked end-to-end regression snapshots (`REGRESSION-END-TO-END-v1.58.16/33/35.md`) moved into the new `qa/archive/v158-cycle/` directory alongside the pre-cycle MASTER regression and the `FIX-PROMPT-v1.58.3.md` snapshot — `qa/v158-regression/` now contains only the active `FIX-PROMPT-v1.58.4_and_beyond.md` (post-MASTER fix specification, every row marked ✅). **(2) qa/REGRESSION-FINAL.md** gains **§12** documenting every v1.58.x cycle invariant (CSP unconditional, 5 provider rows, `:focus-visible` ring, drawer behavior, help §18, etc.) with its `tests/qa-report-fixes.test.mjs` lock per row. **(3) qa/UX-AUDIT-PROMPT.md** baseline table extended with 30 closed-in v1.58.x rows. **(4) docs/architecture/:** FRONTEND.md gains the notifications-drawer section + v1.58.24 toast-postfix + v1.58.10 modal-drain notes; OVERVIEW.md links to the drawer; TESTING.md totals lifted to **928 unit / 117 files / 62 Playwright / 20 smoke / 23 comprehensive E2E**. **(5) CLAUDE.md** gains a "Hard-won lessons (v1.58.x cycle)" section with 10 captured traps (the `[hidden]` cascade trap, the `npm test | grep` exit-code mask, the `cleanLlmMarkdown ≠ sanitizer` doctrine, etc.). **(6) .github/copilot-instructions.md** baseline lifted to **928 unit / 62 Playwright**. **(7) README ×8 locales:** new "Notifications 🔔" row in every page-table + `tests/` stale count fixed from `284 unit + 12 Playwright + 23 e2e:full` → `928 + 62 + 23 + 20` (baseline @ v1.58.35). Test baseline unchanged: **928** unit · **62** Playwright · **20** smoke · **23** comprehensive E2E. (housekeeping)

---

## [1.58.35] — 2026-05-20

**fix(ui): v1.58.35 — Notifications drawer no longer auto-opens at page load + new help §18 catalogues all notification categories (user-reported).** Two bugs in one. (1) **Auto-open / never-close:** `.notif-drawer { display: flex }` and `.notif-badge { display: inline-flex }` (v1.58.34) had the same author-level specificity as the UA `[hidden] { display: none }` rule, so the explicit `display` value won and the `hidden` attribute was a no-op — the drawer was visible on every page load and clicking close did nothing. Fix in [public/css/app.css](public/css/app.css): explicit `.notif-drawer[hidden] { display: none }` + `.notif-badge[hidden] { display: none }` overrides. The drawer is now ONLY opened by clicking the bell (or Enter/Space when keyboard-focused); a static-guard test asserts there is exactly one `open()` call site in app.js (the bell click ternary), so future edits can't silently introduce another auto-open path. (2) **Undocumented categories:** new **§18 Notifications** section in all 8 help bundles (docs/help/{en,es,ja,ko-KR,pt-BR,ru,zh-CN,zh-TW}.md) — 3 H3 subsections per bundle (Notification categories / What is NOT a notification / Keyboard) catalogue every toast source (Success / Error / Info-progress), what each visual cue means, what's explicitly NOT a notification (Doctor/verify modals, SSE log lines, spinner-only states), and the keyboard contract. Help-section parity baseline lifted 17 → 18; H3 baseline 70 → 73. 927 → **928** unit. (user-reported)

---

## [1.58.34] — 2026-05-20

**feat(ui): v1.58.34 — Notifications drawer ships on top of the v1.58.33 toast-journal capture (closes U-13 completely).** v1.58.33 shipped the data shape (in-memory `toastHistory` cap 50 + `UI.getToastHistory()`) and explicitly deferred the drawer chrome. This release adds the chrome. **`UI.onToast(fn)`** pub/sub layered on top of the capture in [public/js/api.js](public/js/api.js#L222-L233) — subscribers receive the entry just appended; the implementation guards every subscriber callback in try/catch so a drawer bug can never break the toast pipeline. **Bell button** in the top-bar (`🔔` + red unread badge), `aria-haspopup="dialog"` + `aria-controls="notif-drawer"` + `aria-expanded` flipping on open/close. **Right-slide `<aside role="dialog">`** with localized title (`notif.title`), empty-state (`notif.empty`), and per-entry items showing localized `toLocaleTimeString` + message + (when present) the technical postfix from U-4 (v1.58.24). Newest first; oldest dropped as the U-13 cap bites. Esc + Close button + clicking the bell again all close the drawer; focus restores to the bell (WAI-ARIA APG drawer pattern). 4 new i18n keys (`notif.title`, `notif.empty`, `notif.bellAria`, `notif.closeAria`) × 8 locales. CSS: `.notif-bell`, `.notif-badge`, `.notif-drawer`, `.notif-drawer__head`, `.notif-item` rules. 926 → **927** unit; Playwright 61/61 unchanged. (U-13 follow-up)

---

## [1.58.33] — 2026-05-20

**fix(ux): U-13 + U-14 + U-15 — toast journal capture + page-header spacing safety net + CV editor dirty-state indicator (3 closing UX items batched).** Final v1.58.x release. **U-13 (toast journal):** [public/js/api.js](public/js/api.js#L215-L235) — every `UI.toast()` call pushes `{ ts, type, message, detail }` into an in-memory `toastHistory` capped at 50; exposed via the new `UI.getToastHistory()` API. Toasts dwell 3.5-20 s and then vanish; the journal lets future drawer / panel UIs (deferred to a follow-up release) re-surface any missed message. **U-14 (page-header spacing safety net):** new `.page-header h1 + p { margin-block-start: var(--space-2); color: var(--foggy); }` rule in [public/css/app.css](public/css/app.css#L604-L612) so any page that uses raw `<h1>+<p>` (without the `.page-subtitle` class) still gets the canonical spacing. **U-15 (CV dirty-state):** [public/js/views/cv.js](public/js/views/cv.js#L208-L240) — Save button gets `.btn-dirty` class + localized `cv.unsaved` tooltip whenever the textarea diverges from the last saved baseline; clicking Save re-baselines and clears the flag. Upload path dispatches a synthetic `input` event so programmatic `ta.value = …` assignments still trigger the dirty toggle. CSS `.btn.btn-dirty` paints a `var(--rausch-dark)` ring + `● ` prefix. 925 → **926** unit. (U-13 + U-14 + U-15)

---

## [1.58.32] — 2026-05-20

**fix(ux): U-12 — `#/help` TOC filter input gets a 16ch `min-width` so KO/JA placeholders never clip.** Korean `섹션 필터` and Japanese `セクションをフィルター` are 5-10% wider than the EN `Filter sections`. The input already used `width: 100%` of its `.help-toc` card; we add a `.help-toc__filter` class with `min-width: 16ch` so even if the card narrows, the placeholder still fits in any of the 8 locales. 924 → **925** unit. (U-12)

---

## [1.58.31] — 2026-05-20

**fix(ux): U-11 — Tracker `Legitimacy` column header now carries a localized info chip + tooltip explaining the High/Caution/Suspicious scale.** v1.58.3 QA: the badge in each row read `High` / `Caution` / `Suspicious` with no header affordance to learn what they meant. [public/js/views/tracker.js](public/js/views/tracker.js#L228-L246) `<th>` now renders the column label + `<span class="th-info" tabindex="0" role="img">ⓘ</span>` whose `title` + `aria-label` come from a new `track.col.legitimacy.help` i18n key × 8 locales: *"Confidence that the posting is real (High / Caution / Suspicious)."* CSS `.th-info:focus-visible` adds the brand ring so the chip is keyboard-reachable per WCAG 2.4.7. Also repairs the v1.58.30 (U-10) regression where the existing `#25 destructive buttons have a title hint` lock test only checked for `track.fixHint` but the U-10 branch now uses both `track.fixHint` and `track.fixEmpty`. 923 → **924** unit. (U-11 + U-10 follow-up)

---

## [1.58.30] — 2026-05-20

**fix(ux): U-10 — Tracker Normalize / Dedup / Merge buttons disabled when `data/applications.md` is empty.** v1.58.3 QA: clicking these buttons on an empty tracker still hit the parent project rewrite endpoints — a no-op the user could not tell was futile. Now [public/js/views/tracker.js](public/js/views/tracker.js#L187-L210) sets `disabled` + `aria-disabled` + a localized tooltip (`track.fixEmpty` × 8 locales) explaining why ("Add a row to the tracker first — this rewrites data/applications.md and there is nothing to rewrite yet."). When rows exist, the buttons re-enable and show the existing `track.fixHint` tooltip. 922 → **923** unit. (U-10)

---

## [1.58.29] — 2026-05-20

**fix(ux): U-9 — `#/pipeline` counter ↔ filter row stacks vertically on narrow viewports.** v1.58.3 QA: at ≤ 720 px the `In queue: N` chip and the filter input fought for horizontal space and pushed the input to a cramped column. New `.pipeline-controls` class in [public/js/views/pipeline.js](public/js/views/pipeline.js#L377-L385); CSS rule under `@media (max-width: 720px)` sets `flex-direction: column` + stretches `#pipe-filter` to 100% width. Desktop unchanged. 921 → **922** unit. (U-9)

---

## [1.58.28] — 2026-05-20

**fix(ux): U-8 — Generate-prompt block is collapsed by default on the 7 mode pages.** The inline `<pre>` previously ran 1200+ px after the user clicked Generate prompt, pushing Copy + Run-live below the fold. [public/js/views/mode-page.js](public/js/views/mode-page.js#L272-L300) `showPrompt()` now wraps the `<pre>` in `<details class="prompt-block">` collapsed by default; summary shows `Show prompt (N lines)` localized via the new `prompt.show` / `prompt.lines` keys × 8 locales. Copy / Run-live remain immediately visible. Also fixed a pre-existing v1.58.27 regression where the BUG-007/008 contract test rejected the U-7 reformat (intermediate `const stripped` between dismissToast/modal); loosened the adjacency regex from `
s*` to `[sS]{0,1200}?` while still asserting `UI.dismissToast()` runs before `UI.modal(t(…))`. 920 → **921** unit. (U-8)

---

## [1.58.27] — 2026-05-20

**fix(ux): U-7 — `verify-pipeline.mjs` ASCII `===` dividers stripped from the result modal.** The script prints `=========`-runs (≥ 50 chars) between sections; in the 14 px monospace modal the run pushed the body wider than the rest of the SPA needs. Strip in [public/js/views/health.js](public/js/views/health.js#L23-L38) via `.replace(/^={10,}$/gm, "")` before rendering; whitespace already separates sections. 919 → **920** unit. (U-7)

---

## [1.58.26] — 2026-05-20

**fix(ux): U-6 — `#/scan` "Active companies N/M" chip now explains N vs M via tooltip + aria-label.** v1.58.3 QA: the chip read `▸ Active companies 96/80` with no affordance to learn what 96/80 means. Toggle button in [public/js/views/scan.js](public/js/views/scan.js#L700-L719) now carries `title=` (hover tooltip) and `aria-label=` (screen-reader fallback) sourced from a new `scan.activeCo.help` i18n key in all 8 locales: *"Active: companies currently surfacing results. Total: configured in portals.yml."* 918 → **919** unit. (U-6)

---

## [1.58.25] — 2026-05-20

**fix(ux/ia): U-5 — Dashboard CTA dedupe (removed duplicate Open-Pipeline header button + duplicate Scan-all-sources Quick-action tile).** v1.58.3 QA flagged 4× Pipeline / 4× Scan entry-points on Dashboard. v1.55.5 promoted the two P0 hero CTAs (`✨ Auto-pipeline a URL` + `🌐 Scan now`); the header `📋 Open Pipeline` button and the Quick-action `🌐 Scan all sources` tile were then strict duplicates (sidebar already routes to /pipeline; hero already routes to /scan). Removed both in [public/js/views/dashboard.js](public/js/views/dashboard.js). Hero pair + sidebar remain canonical entry-points. 917 → **918** unit. (U-5)

---

## [1.58.24] — 2026-05-20

**fix(ux): U-4 — toast error messages now tuck the "(METHOD /path · HTTP NNN)" postfix into a collapsed `<details>`.** v1.57.1 appended a what/where/why postfix to every API error so opaque "validation failed" became "validation failed — … (POST /api/config · HTTP 400)". The technical part is required (BUG-006 invariant — must remain reachable in the DOM), but on the toast headline it competes with the human sentence. `UI.toast()` in [public/js/api.js](public/js/api.js#L215-L266) now parses the trailing postfix with `TOAST_ENDPOINT_RE` and renders it inside a `<details class="toast-detail">` with a localized `<summary>` (`toast.details` key × 8 locales). Headline stays clean; the technical detail is one click away. New `.toast .toast-msg` / `.toast .toast-detail` CSS rules. BUG-006 invariant preserved (postfix still in DOM). 916 → **917** unit. (U-4)

---

## [1.58.23] — 2026-05-20

**fix(ux): U-3 — `#/followup` `lastContact` placeholder now adapts to today − 14 days (was the frozen ISO `2026-04-21`).** Static placeholders rot — readers parse them as both a format hint AND a plausible recent example, and the latter drifts into the distant past as time passes. Compute the placeholder at render time in [public/js/views/mode-page.js](public/js/views/mode-page.js#L165-L181): `new Date(); d.setDate(d.getDate() - 14); d.toISOString().slice(0, 10)`. Special-cased only for `cfg.slug === 'followup' && spec.name === 'lastContact'`; every other field still pulls its placeholder from i18n. 915 → **916** unit. (U-3)

---

## [1.58.22] — 2026-05-20

**fix(ux): U-2 — `#/auto` H1 no longer wraps to 2 lines because of the leading `✨`.** Pre-fix the `auto.title` i18n value was `✨ Auto-pipeline a URL`; the emoji participated in line-wrap and pushed the title to a second row at 1280-1600 px widths. Split into separate elements in [public/js/views/auto.js](public/js/views/auto.js#L240-L252): `.page-header.page-header--icon` (CSS grid, `auto 1fr` columns) + `<span class="page-icon" aria-hidden="true">✨</span>` + `<h1 class="page-title">{t(auto.title)}</h1>` + `<p class="page-subtitle">`. The emoji now sits on its own column and never participates in line wrap; the H1 wraps freely if needed. `auto.title` i18n value stripped of its leading `✨` in all 8 locales. 914 → **915** unit. (U-2)

---

## [1.58.21] — 2026-05-20

**fix(ux): U-1 — `#/cv` H1 + subtitle now match every other page (supersedes v1.56.0 UX-9 chip by design).** v1.56.0 UX-9 demoted the page title to a `.cv-breadcrumb` chip (lowercase grey `cv`) so the user's name in the preview "owned" visual space. v1.58.3 QA confirmed it just reads as a layout bug — the page header looks broken next to `#/dashboard`/`#/help`/etc. U-1 promotes [public/js/views/cv.js](public/js/views/cv.js) back to `<h1 class="page-title">` + visible `<p class="page-subtitle">` like every other page; `.cv-breadcrumb` CSS rule removed. **Single-`<h1>` invariant unchanged** (F-V54-A still shifts user `# Name` h1→h2 in the preview, so this stays the page's only H1). Lock test `tests/cv-breadcrumb.test.mjs` (which encoded the now-reversed UX-9 contract) is removed; `tests/cv-single-h1.test.mjs` updated to assert the new `.page-title`-only shape. 913 → **914** unit. (U-1)

---

## [1.58.20] — 2026-05-20

**fix(i18n/platform): I-6 — footer hotkey hint now shows ⌘K on Mac, Ctrl+K elsewhere (localized verb).** Pre-fix the sidebar footer hint was the literal `CTRL+K — search` on every platform and locale. The top-bar `<kbd>` badge already adapted via `data-mac`/`data-other` (v1.56.4 UX-N2); now the footer hint does too. `top.langhint` i18n values embed a `{hotkey}` placeholder (e.g., `{hotkey} — поиск`); new `applyFooterHotkey()` in [public/js/app.js](public/js/app.js#L196-L214) runs on boot + every `I18n.onChange` and replaces `{hotkey}` with `⌘K` or `Ctrl+K` based on `navigator.platform`. The localized verb (`search` / `buscar` / `поиск` / `搜索` / …) stays. 915 → **916** unit (static guard locks the `{hotkey}` shape in all 8 locales, the platform branch, and the `I18n.onChange` re-apply). (I-6)

---

## [1.58.19] — 2026-05-20

**fix(i18n): I-4 — RU `#/followup` H1 + hints no longer leak Latin `cadence` / `follow-up` / `scope` / `timeline`.** v1.58.3 RU regression: H1 `Советник по cadence follow-up`; hint `ISO-дата (YYYY-MM-DD) — основа для cadence.`; notesHint `timeline, internal hold, …`. All replaced with native Russian: `Советник по ритму касаний`, `ISO-дата (ГГГГ-ММ-ДД) — основа для расчёта ритма касаний.`, `сроки, внутренняя пауза, праздники`. companyHint `scope` → `область`. 914 → **915** unit (negative-match guard: no `cadence` / `follow-up` in any RU followup.* string). (I-4)

---

## [1.58.18] — 2026-05-20

**fix(i18n): I-3 — help TOC items 2/5/13/14 free of English bleed in non-Latin locales.** Pre-fix several locale help bundles still showed `## 2. App settings & API keys`, `## 5. Portals & Sources`, `## 13. Mode prompts`, `## 14. Apply checklist` (ru/ja/ko/zh-CN/zh-TW). Now fully localized in all 8 locales (RU `Подсказки режимов` / `Чек-лист отклика`, JA `応募チェックリスト`, KO `앱 설정 및 API 키` / `포털 및 소스` / `지원 체크리스트`, zh-CN `应用设置与 API 密钥` / `模式提示` / `申请清单`, zh-TW `應用設定與 API 金鑰` / `招聘版面與來源` / `模式提示` / `申請清單`). 913 → **914** unit (negative-match guard: items 2/5/13/14 contain none of `App|settings|Apply|checklist|Portals|Sources|Mode|prompts` for the 5 non-Latin locales). (I-3)

---

## [1.58.17] — 2026-05-20

**fix(i18n): I-2 — saved-research dates now use `Intl.RelativeTimeFormat` per locale.** The `formatRelative()` helper in [public/js/views/deep.js](public/js/views/deep.js#L57-L82) returned hardcoded English `today` / `1d ago` / `Nd ago` regardless of UI language. Replaced with `Intl.RelativeTimeFormat(I18n.getLang(), { numeric: 'auto' })` — the browser-native localized "today/yesterday/N days ago" string (сегодня/вчера, 今日/昨日, etc.). Dates older than 7 days fall back to `Intl.DateTimeFormat(locale, { dateStyle: 'medium' })`. Defensive try/catch keeps the old English fallback for ancient browsers without Intl. 912 → **913** unit. (I-2)

---

## [1.58.16] — 2026-05-20

**fix(ui): brand-button hover-flicker — pink/red primary & danger buttons no longer flash on hover (user-reported).** Root cause in [public/css/app.css](public/css/app.css): the default `.btn-primary` / `.btn-danger` background was a `linear-gradient(135deg, var(--rausch) 0%, var(--rausch-dark) 100%)`; the `:hover` rule replaced it with a solid `var(--rausch-dark)`. CSS cannot interpolate between a gradient and a solid colour, so the 180 ms `transition: background` on `.btn` snapped — the gradient briefly resolved to one of its stops on hover entry/exit, producing the visible white/pink flicker the user reported. Fix: keep the gradient on hover and dim via `filter: brightness(0.92)` instead — `filter` interpolates cleanly in every browser, so the dim/un-dim now animates symmetrically over the existing 180 ms duration. The `.btn` transition list is extended with `filter var(--transition)` so the hover dim actually animates. Mouse pointer-focus state stays clean (uses `:focus`, not `:focus-visible`, per the v1.58.9 M-1 contract). 911 → **912** unit (`tests/qa-report-fixes.test.mjs` asserts the gradient-stays/filter-dims contract on both `.btn-primary:hover` and `.btn-danger:hover`, plus that the pre-fix `background: var(--rausch-dark)` is gone and that `filter` is in the `.btn` transition list). (user-reported)

---

## [1.58.15] — 2026-05-20

**fix(a11y/i18n): I-1 — top-bar search `aria-label` and visually-hidden label now localized.** v1.58.3 verified the global search input shipped `aria-label="Global search — Cmd+K to focus, paste a URL and Enter for auto-pipeline"` regardless of UI language. Screen-reader users on RU/JA/zh-CN/etc. were stuck with English. New generic `data-i18n-aria-label` hook in [public/js/app.js](public/js/app.js#L4-L29) mirrors the existing `data-i18n` / `data-i18n-placeholder` pattern — `applyI18n()` iterates every `[data-i18n-aria-label]` element and calls `el.setAttribute('aria-label', I18n.t(key, …))` on each language change. The top-bar input now declares `data-i18n-aria-label="top.search.aria"`; the visually-hidden `<label>` declares `data-i18n="top.search.label"`. Two new i18n keys (`top.search.aria`, `top.search.label`) added across all 8 locales. The hook is reusable — any future control just adds the attribute. 910 → **911** unit (`tests/qa-report-fixes.test.mjs` asserts the HTML markup wiring, the app.js handler shape, the 8-locale i18n parity, and a sanity check that RU ≠ EN so a copy-paste-English regression can't slip through). (I-1)

---

## [1.58.14] — 2026-05-20

**fix(ux): M-9 — connection-banner `Refresh` now gives feedback (was silent reload).** v1.58.3 verified the global Refresh button called `location.reload()` synchronously — user sees a brief flash but no explicit signal that anything happened. Fix in [public/js/app.js](public/js/app.js#L131-L161): the click handler now (1) emits a transient `Refreshing…` toast, (2) sets `sessionStorage['refreshedToast']` so the *next* page boot can surface a success toast (the in-flight one is destroyed by navigation), (3) disables the button to swallow rapid double-clicks (no stacking), and (4) defers `location.reload()` by 200 ms so the in-flight toast paints first. On boot, app.js checks the sessionStorage flag, clears it, and emits a success `Refreshed` toast (deferred so it lands after the SPA settles). Two new i18n keys (`common.refreshing`, `common.refreshed`) added across all 8 locales. 909 → **910** unit (`tests/qa-report-fixes.test.mjs` asserts the synchronous progress toast, deferred reload, disabled-guard, sessionStorage handoff, success toast on next boot, and 8-locale i18n parity). (M-9)

---

## [1.58.13] — 2026-05-20

**fix(ux): M-8 — `#/apply` checklist becomes interactive (delivers the page's promise).** v1.58.3 verified: `▶ Generate checklist` rendered a monospace `<pre>` block listing items 0…7 — read-only text the user couldn't tick. The page is titled "Apply checklist" but didn't actually behave like one. Fix in [public/js/views/apply.js](public/js/views/apply.js#L9-L98) — after the API returns, the raw `r.checklist` text is parsed into items (lines, trimmed, leading `-`/`*`/`1.`/`[ ]` markers stripped) and rendered as a `<ul class="apply-checklist">` of real `<input type="checkbox">` rows. Each row is wrapped in `<label>` so the full row is the click target (WCAG 2.5.5; works with v1.58.9 M-1 focus rings). State is persisted in `localStorage['applyChecklist:' + slug]` (slug = URL stripped of protocol + query, alphanum/`._/:-` only, ≤240 char) — tick three items, reload, three still ticked. Two action buttons: **Copy unchecked** (clipboard the still-open items as `- markdown` bullets) and **Reset** (clear all ticks for this URL). Defensive fallback: if the parser finds zero items, render the raw text as before so the user isn't shown an empty card. New CSS in [public/css/app.css](public/css/app.css) (`.apply-checklist`, `.apply-checklist__actions`, line-through on checked spans). Five new i18n keys (`apply.checklist.copyUnchecked`, `resetBtn`, `copied`, `copyFailed`, `reset`) across all 8 locales. 908 → **909** unit (`tests/qa-report-fixes.test.mjs` asserts the checkbox + data-item-index render, the `<label>` wrap, the `applyChecklist:` localStorage prefix, the load/save state functions, the two action buttons, the no-raw-`<pre>` regression-lock, the CSS row sizing, and 8-locale i18n parity for all five new keys). (M-8)

---

## [1.58.12] — 2026-05-20

**fix(ux): M-7 — cost hint now tracks the active provider (OpenRouter no longer falls through to a fabricated number).** `UI.providerCostHint()` already routed via `/api/status/providers` so the line was provider-aware in spirit, but the per-provider maps in [public/js/api.js](public/js/api.js#L623-L676) only listed `anthropic`/`gemini`/`openai`/`qwen`. With v1.57.0's 5th provider live, OpenRouter fell through to the generic 0.03 fallback **and** rendered the literal `openrouter` (lowercase) as the provider name — both wrong. Per the fix-prompt's intent ("be honest, never quote a fixed number that might be wrong"), the EST map now lists `openrouter: null` (router picks the underlying model — cost varies per request), and the render path branches on `null` to emit a localized `cost varies (router picks)` instead of a fabricated `~$0.03/eval`. NAME map adds `openrouter: 'OpenRouter'` so the user-visible name matches the docs. New i18n key `cost.varies` added across all 8 locales (`cost varies (router picks)` / `coste variable (lo elige el router)` / `coste variable` / etc.). 907 → **908** unit (`tests/qa-report-fixes.test.mjs` asserts `EST openrouter: null`, `NAME openrouter: 'OpenRouter'`, the `=== null` branch + `t('cost.varies', …)` call site, and 8-locale i18n parity). (M-7)

---

## [1.58.11] — 2026-05-20

**fix(ux): M-4 — saved-research card title↔date gap now structural CSS (was inline margin).** v1.58.3 verified: some saved-research card entries displayed `software-engineer-generaltoday` (no space between title and date), while others were fine — the pre-fix relied on `style="margin-left: 8px"` between two raw `<span>` children, which collapsed on certain entries. The fix in [public/js/views/deep.js:34-55](public/js/views/deep.js#L34-L55) replaces the two anonymous `<span>`s with `.saved-card__title` + a semantic `<time class="saved-card__date" datetime="…">`, wrapped in a `.saved-card` flex container. Spacing is now driven by CSS `gap: var(--space-2, 8px)` so it can't collapse (and you get a11y/SEO `<time>` semantics for free). New CSS in [public/css/app.css](public/css/app.css) defines `.saved-card { display: inline-flex; align-items: baseline; gap: var(--space-2, 8px); white-space: nowrap }`, `.saved-card__title { font-weight: 500 }`, `.saved-card__date { color: var(--foggy); font-size: 0.85em; white-space: nowrap }`. 906 → **907** unit (`tests/qa-report-fixes.test.mjs` asserts the new classes, the semantic `<time datetime=…>`, the no-inline-`marginLeft: '8px'` regression-lock, and the CSS gap declaration). (M-4)

---

## [1.58.10] — 2026-05-20

**fix(ux): M-2 — drain the progress toast before any result modal opens.** Clicking `sync-check` on `#/cv` left the "Running cv-sync-check.mjs…" toast bottom-right while the result modal opened — both fighting for attention, and on narrow screens visually overlapping. The Health-page Doctor / verify-pipeline buttons already called `UI.dismissToast()` explicitly before `UI.modal()`; cv.js's sync-check (and any future call site) was the odd one out. Fix in [public/js/api.js](public/js/api.js#L272) — `UI.modal()` now calls `dismissToast()` as its first executable statement so every present and future call site gets the drain for free (defence-in-depth at the boundary). Also localized [public/js/views/cv.js](public/js/views/cv.js#L190-L201) — the previously-hardcoded English `UI.toast('sync-check…')` and `UI.modal('sync-check', …)` now use `t('cv.syncCheckRunning')` and `t('cv.syncCheck')` respectively, satisfying the BUG-008 invariant (modal title == localized button label) for the cv-view path too. Two new i18n keys (`cv.syncCheck`, `cv.syncCheckRunning`) added across all 8 locales. 905 → **906** unit (`tests/qa-report-fixes.test.mjs` static guard for the dismissToast() boundary, the localized cv.js call site, the no-hardcoded-`'sync-check…'`-literal, and 8-locale i18n parity). (M-2)

---

## [1.58.9] — 2026-05-20

**fix(a11y): M-1 — re-establish a visible `:focus-visible` ring on form fields (WCAG 2.4.7 Level AA).** The v1.58.3 MASTER regression confirmed `getComputedStyle(focusedInput)` returned `outline: rgb(255,255,255) none 1.5px` — i.e. the `none` keyword collapsed the ring to 0 px on every form field. Root cause: the base `.input, .textarea, .select { outline: none }` rule (intentional, to suppress the mouse-focus halo) had higher specificity than the global `*:focus-visible` rule and silently nuked the keyboard-focus ring on 88 focusable elements per page. Same issue on `.searchbar input { outline: none }` for the global ⌘K/Ctrl K search. Fix in [public/css/app.css](public/css/app.css) — add explicit `.input:focus-visible, .textarea:focus-visible, .select:focus-visible` and `.searchbar input:focus-visible` rules with `outline: 2px solid var(--rausch)` + a translucent box-shadow so keyboard-only focus paints a visible ring while mouse focus stays clean (uses `:focus`, not `:focus-visible`). 904 → **905** unit (`tests/qa-report-fixes.test.mjs` static CSS contract guard for all three new rules + the regression-lock for the pre-existing global `*:focus-visible`); Playwright **60 → 61** (`tests/playwright-smoke.mjs` Tab-traversal test asserts the computed outline on a `#/config` form field is ≥1.5 px wide and not `none`). (M-1)

---

## [1.58.8] — 2026-05-20

**feat(health): surface `OPENAI_API_KEY`, `QWEN_API_KEY`, `OPENROUTER_API_KEY` on `#/health` (analogous to `GEMINI_API_KEY`).** v1.57.0 added OpenRouter as the 5th headless live-eval provider; v1.55.3 (UX-2) added on-screen onboarding for the 4-provider mix. The `#/health` page however only reported `GEMINI_API_KEY` and `ANTHROPIC_API_KEY` — the other three providers' key state was invisible there even though `/api/status/providers` already routed evals to them. User request: extend the same "set / unset (manual mode)" row pattern to every headless provider. [server/lib/routes/health.mjs](server/lib/routes/health.mjs#L57-L71) now pushes three additional optional check rows (`OPENAI_API_KEY`, `QWEN_API_KEY`, `OPENROUTER_API_KEY`) wired to the same `isUsableKey` gate as `/api/status/providers` (`hasOpenAIKey()`, `hasQwenKey()`, `hasOpenRouterKey()` were already imported but unused). "manual mode" wording is identical to the GEMINI row across the SPA's 8 locales — the Health view iterates over `body.checks` so no per-locale string change was needed. 903 → **904** unit (`tests/api.test.mjs` extended to assert all three new optional rows; `ok=true` still holds since they're not required). (NEW user-requested feature)

---

## [1.58.7] — 2026-05-20

**fix(security): NEW-2 — `isValidJobUrl` now rejects paired template-placeholder syntaxes (`${…}`, `{{…}}`) to match the error message.** The route-level 400 returned by `POST /api/pipeline` advertises *"contain no script or template characters"*, but the v1.58.3 MASTER regression confirmed only ASP/EJS-style `<%…%>` was actually blocked (free side effect of the `[<>"'`\\\s]` bracket-char gate). JS template literals (`${TEST}`) and Mustache/Handlebars (`{{TEST}}`) both passed validation — a regex↔message semantic gap. Option A from the fix-prompt (tighten regex to match message; slight hardening against URL-templating injection): a new `TEMPLATE_PATTERNS` array in [server/lib/security.mjs](server/lib/security.mjs) (`/\$\{[^}]*\}/`, `/\{\{[^}]*\}\}/`) is consulted via `hasTemplatePlaceholder(url)` before `new URL(…)`. Only **paired** placeholders are rejected — a bare `{normal}` ATS-style path token survives (`https://boards.greenhouse.io/anthropic/jobs/4567` and `https://example.com/job/{normal}` both still accepted). 901 → **903** unit (`tests/url-validation.test.mjs` extended with 2 NEW-2 tests covering both rejected forms and the no-false-positive ATS case). The `<%…%>` regression-lock is also explicit now. (NEW-2)

---

## [1.58.6] — 2026-05-20

**fix(a11y/i18n): BUG-008-tb — top-bar `Doctor` modal title now matches the localized button label.** The ledger row BUG-008 fixed in v1.58.0 ("modal title == localized button label") closed the **Health page** entry-point. The v1.58.3 MASTER regression then found the **top-bar** entry-point still violated the invariant: regardless of UI locale, clicking the top-bar `Doctor` button opened a modal titled `doctor` (hardcoded English, lowercase). Repro: EN top-bar `Doctor` → modal title `doctor`; RU top-bar `Диагностика` → modal title `doctor`. Two entry paths, one invariant, one passing. Fix in [public/js/app.js:118](public/js/app.js#L118) — replace the literal `'doctor'` with `I18n.t('top.doctor', 'Doctor')`. The `top.doctor` i18n key (already present in all 8 locales: EN `Doctor` · ES/pt-BR `Diagnóstico` · KO `진단` · JA `診断` · RU `Диагностика` · zh-CN `诊断` · zh-TW `診斷`) is the same key the button declares via `data-i18n="top.doctor"`, so the modal title is now textually identical to the visible button label across all locales. Static contract guard added in `tests/qa-report-fixes.test.mjs` (BUG-008-tb): asserts the `I18n.t('top.doctor', 'Doctor')` form in `app.js`, the no-hardcoded-`UI.modal('doctor',`-literal, the 8-locale presence of `top.doctor` in `i18n-dict.js`, and the button↔key wiring in `index.html`. 900 → **901** unit; Playwright 60/60. (BUG-008-tb)

---

## [1.58.5] — 2026-05-20

**fix(ui): NEW-3 — `#/followup` Run-live double-POST triaged *not-reproducible*; locked with Playwright regression guard.** The v1.58.3 MASTER regression observed (via monkey-patched `window.fetch`) two identical POSTs to `/api/mode/followup` within ~2 s after a single click on `#/followup` Run live (company/role/notes filled, date intentionally empty). Per the fix-prompt's "repro first" doctrine, source inspection of `public/js/views/mode-page.js::submit()` shows: (a) the Run-live and Generate-prompt buttons are plain `<button>` elements with a single `onClick` each — there is no parent `<form>` and no `addEventListener('submit')` to double-fire, and (b) `UI.withSpinner()` (FIX-L1) sets `button.disabled = true` for the duration of the in-flight request, so a second physical click during the request is blocked at the source. A new Playwright test in `tests/playwright-smoke.mjs` (`NEW-3 — single click on #/followup submits exactly one POST`) walks the **exact** regression recipe — fills company/role/notes, leaves the date blank, clicks the manual-prompt button (which shares the `submit()` function with Run live), and asserts **exactly one** `POST /api/mode/followup` over a 3 s window. Locale-stable selector (the `▶` glyph is the same in all 8 locales), and `addInitScript` seeds `career-ops-ui:lang=en` so a prior language test in the same browser context can't perturb the field selectors. Playwright **59 → 60**. Original QA observation is filed as recipe-only; no shipped code change required. (NEW-3)

---

## [1.58.4] — 2026-05-19

**fix(security): NEW-1 — emit `Content-Security-Policy` on every response (was loopback-gated).** Before v1.58.4 the CSP header was layered on only when `isPubliclyExposed()` was true (HOST bound beyond loopback); over `127.0.0.1` both `/` and `/api/health` returned **no** CSP, leaving `UI.md()`'s escape-first contract as the only XSS defence. The v1.58.3 MASTER regression (§5) flagged this as a stop-ship invariant gap. CSP is now **unconditional** and identical on every response regardless of bind address: `default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`. `script-src` never allows `'unsafe-inline'`/`'unsafe-eval'`. The directive set is unchanged from the prior exposed-only policy (already SPA-correct — Google Fonts allowlisted for Inter), so no visual or functional regression. `tests/security-headers.test.mjs` was rewritten to lock CSP-present-on-loopback; a Playwright route-walk (en/ru/ja/zh-TW × 7 routes) asserts **0 CSP violations**. 900 unit · Playwright 58→59 · e2e 20/20+23/23. Next fix-prompt items (NEW-3, BUG-008-tb, NEW-2, M-1…) ship as subsequent one-fix releases per project doctrine. See `qa/v158-regression/FIX-PROMPT-v1.58.4_and_beyond.md`. (NEW-1)

---

## [1.58.3] — 2026-05-19

**fix(deep): R-2 / FIX-C1 — strip ORPHAN / unbalanced agent-scaffolding tags from research output.** v1.58.0 added `cleanLlmMarkdown` but it only removed *paired* `<tool_call>…</tool_call>` blocks and a *dangling open* tag. A deep regression of v1.58.2 found a model that emitted a **lopsided trace** — an orphan closing `</tool_response>` (and `</thinking>`) with no opener — which survived and rendered literally in the saved `#/deep` brief. A final conservative sweep now removes **any** standalone scaffold token (open or close, balanced or not): `tool_call|tool_response|tool_use|function_call|function_results|thinking`, the Anthropic tool XML (`<invoke …>`/`</invoke>`/`<parameter …>`/`<function_calls>` and `antml:`-namespaced forms), and fenced ```tool_* blocks. Pure + idempotent; real `<https://…>` autolinks and `` `<code>` `` spans are preserved (only the named agent tokens match). **FIX-C2** (`<html lang>` not updating) was triaged **not-reproducible** — `i18n.js` already sets `document.documentElement.lang` on `setLang` AND at boot and detects `navigator.language`; the QA repro was a stale `localStorage`/pre-redeploy artifact. Locked both with regression guards. 896 → **900** unit · Playwright 58/58 · e2e 20/20+23/23. The remaining v1.58.3 fix-prompt items (M-1 focus-ring, M-4..M-9, I-1..I-6, U-1..U-15) are queued as subsequent one-fix ships per project doctrine (never batched). See `qa/v158-regression/`.

---

## [1.58.2] — 2026-05-19

**fix(i18n): I18N-011 — localize the `#/help` table-of-contents in all 7 non-EN locales.** The `#/help` "On this page" TOC is built from the `##` section headings of `docs/help/<lang>.md`. Sections 3/4/6/7/8/9/10/11/12 (Profile, CV, Health, Scan, Pipeline, Evaluate, Reports, Tracker, Deep research) still carried their **English** titles in es/pt-BR/ko/ja/ru/zh-CN/zh-TW, so the TOC showed English while the sidebar nav was translated. Each affected heading is now localized to the **exact same term as the sidebar `nav.*` key** (single source of truth — TOC ↔ sidebar match), preserving the section number and the `(#/route …)` parenthetical verbatim. EN unchanged (canonical). 7–9 headings per locale. Closes the sole open i18n backlog item from the v1.58 QA sweep. Docs-only; 896/896 unit · 33/33 help tests · Playwright 58/58. See `qa/v158-regression/`.

---

## [1.58.1] — 2026-05-19

**fix(test): CI-isolated `checkProfileCustomized` guard (patch over v1.58.0).** v1.58.0 shipped green on the advisory pre-commit but red on `ci.yml` (Node 18/20/22): the new BUG-002/UX-032 test used a cache-bust dynamic import + `PATHS` rewrite, but `server/lib/paths.mjs` resolves the project root **once per process**, so the temp root never took effect under the shared `npm test` runner (it coincidentally passed locally). Replaced with a robust **static guard** that asserts the `store.mjs` allow-list contains the fixture names AND that the regex is `^(…)$/i` exact-anchored (so a real name merely containing "test" — e.g. `María Testanova` — is provably never false-flagged). No production code changed; this also unblocks `publish-package.yml` (it runs the suite before publishing). 896/896 unit · Playwright 58/58. See `qa/v158-regression/`.

---

## [1.58.0] — 2026-05-19

**fix(qa): external QA-report bug sweep + clean, formatted research output.**

### 🐛 Fixes (QA report)

- **BUG-001 (Critical)** — `#/followup` now validates the optional *Last contact* field client-side as an ISO date (`YYYY-MM-DD`); junk no longer reaches the LLM (and burns a credit). Generic `pattern` support added to the mode-page form factory.
- **BUG-003 (Major, every help page)** — `**bold**`, `` `code` ``, *italic* and `[links]` now render **inside block-quotes** in `UI.md()` (the `> **Audience:**` cards showed literal `**`). Safe-by-construction (content is already HTML-escaped before `inline()` runs).
- **BUG-005 (Major)** — adding a URL already in the pipeline now shows an honest *“Already in the queue — skipped”* info toast instead of a misleading green “Added”.
- **BUG-006 (Major)** — the invalid-URL message is humanized/sentence-cased (“That doesn't look like a valid job posting URL — …”). The `(POST /api/pipeline · HTTP 400)` where/why context stays by design.
- **BUG-007/008 (Major/Minor)** — the “Running doctor.mjs…” progress toast is dismissed before the result modal opens (new `UI.dismissToast()`), and the modal title reuses the localized button label so its casing always matches.
- **BUG-010** — the `#/reports` empty state now has the descriptive page-subtitle every other page has.
- **BUG-002 / UX-032 (code-side)** — `checkProfileCustomized()` now flags QA/test-fixture names (`Acceptance Test`, `Real Person`, `QA`, …) as *not customized*, so the Health card and prompts stop treating a test profile as the real candidate. The parent project's `config/profile.yml` / `cv.md` are **not** touched (hard rule #1) — the data cleanup is the user's; this is the heuristic fix.
- **I18N-012/013** — Russian `deep.title`, `deep.subtitle` (“smart questions”), and `dash.quick.deepCta` are now actually translated.

### ✨ Features / UX

- **Clean, formatted research output.** New `server/lib/llm-output.mjs::cleanLlmMarkdown()` strips agent/tool scaffolding the model sometimes echoes (`<tool_call>{…}</tool_call>`, `<tool_response>`, `<tool_use>`, `<function_call>`, `<thinking>`, `[TOOL_CALL]…`) from `#/deep` and **Saved research**. Applied at every chokepoint — Anthropic / OpenAI / Qwen / OpenRouter clients, the Gemini subprocess path, **and** on serving an already-saved brief (older files render clean too). The SPA already renders these via the XSS-safe `UI.md()`, so the result is a properly formatted document.
- **`#/outreach` alias** → `#/contacto` (BUG-004) for a consistent, bookmarkable English URL; canonical slug stays `contacto` (parent mode filename).
- **AI-review rule 3** — the client-owned network-error sentence is localized via `I18n.t()` (`api.netError` / `api.netHint`, 8 locales). Documented decision: server-emitted validation `details` are intentionally English diagnostics (consistent with every other server error; the SPA surfaces them verbatim and localizes its own chrome).

### 🧪 Tests

- New `tests/qa-report-fixes.test.mjs` (10) and `tests/llm-output.test.mjs` (5, incl. idempotency + “don't eat real code blocks”). `checkProfileCustomized` exercised directly (real name containing “test” is **not** false-flagged). Updated `url-validation` + `config-validation-detail` assertions for the new messages; `e2e-comprehensive` now date-aware. 881 → 896 unit; Playwright 58/58; e2e 20/20 + 23/23.

### Triaged, not changed (with rationale)

- **BUG-009** (`#/cv` H1 is a quiet breadcrumb chip) — *by design*: the single-`<h1>` WCAG 1.3.1 decision (F-V54-A); changing it risks an a11y regression.
- **BUG-002 data, UX-022** (parent `profile.yml`/`cv.md`/`portals.yml` content) — *parent-owned*; hard rule #1 forbids the repo editing parent files. Code-side detection hardened instead.
- Long-tail minor i18n/UX (I18N-011 help-TOC localization, I18N-014..019, UX-020/021/023/024/025/026/027/028/029/030/031) — tracked backlog; deferred to avoid a large unreviewed change set in a patch line.

---

## [1.57.2] — 2026-05-19

**fix(config): the ACTUAL root cause of `/#/config` "validation failed" — the SPA-injected `lang` field.**

### 🐛 Fixes

- **Saving anything on `/#/config` from the browser always returned `validation failed`.** `public/js/api.js` auto-attaches a `lang` field to *every* JSON POST body (so LLM routes pick up the UI locale). `/api/config` is not an LLM route and `lang` is not a config key, so `validateConfig`'s (correct, security-relevant) unknown-key rejection 400'd **every Save** with `validation failed — lang: not a known config key`. This was browser-only: curl/in-process repros never sent `lang`, which is why v1.57.0/.1 (whitespace-trim, descriptive errors) improved the *message* but didn't fix the *cause*. The config route now strips the transport-only `lang` before validating; the `KNOWN_KEYS` write-filter still drops any genuinely-unknown key, so the attacker-injection guard is unchanged.
- Found by a new Playwright form sweep that drives the real save button — not the synthetic fetch repros that masked it.

### 🧪 Tests

- New **`tests/playwright-forms.mjs`** (26, wired into `npm run test:e2e:browser`): drives a real Chromium over **every form-bearing route** — asserts no console errors site-wide, the invalid-save toast shows field+reason+request-context, secret fields never echo the typed value, valid saves succeed, and PORT/HOST show their prefilled defaults.
- `tests/config-endpoint.test.mjs`: browser-parity cases — POST with `lang` succeeds (and `lang` never lands in `.env`), while a real unknown key with `lang` present is still rejected. 879 → 881 unit; Playwright 32 → 58.

---

## [1.57.1] — 2026-05-19

**fix(ux): every API error now says WHAT failed, WHERE, and WHY — and the input-error text is maximally descriptive.**

### 🐛 Fixes

- **"validation failed" was opaque.** The server already returned `{ error, details: ["FIELD: reason", …] }`, but every form's `catch (e) { UI.toast(e.message) }` showed only the top line, so on `/#/config` (and everywhere) the user couldn't tell *which* field was wrong. `api.js` now folds the per-field `details` into the thrown message **site-wide** (one change, every form benefits), appends the request context `(METHOD /path · HTTP NNN)` so the toast says *where* it failed, falls back to a trimmed raw-body snippet for non-JSON errors, and includes the verb+path on network errors. `err.details` is also exposed for inline rendering.
- **Input-error messages are now maximally descriptive.** `validateConfig` explains what's wrong and how to fix it — e.g. `PORT: must be 1-65535 — a whole number, digits only (the default is 4317); you entered "abc"`; `HOST: invalid hostname/ip — only letters, digits and . : - _ are allowed (e.g. 127.0.0.1 …)`; the Anthropic message now points to console.anthropic.com and tells you to use the right provider's field. **Secret keys never echo the entered value** (only its character length), so a mistyped real key can't leak into a toast or log.
- **PORT range is now actually enforced** — a 5-digit value above 65535 (e.g. `99999`) was previously accepted; it's now rejected with a clear reason.

### ✨ UX

- **`/#/config` PORT and HOST are pre-filled with their real defaults** (`4317` / `127.0.0.1`) instead of looking empty/unconfigured.
- **Error toasts stay on screen long enough to read** — dwell time scales with message length (9–20 s for errors; success/info keep the snappy 3.5 s) and the toast wraps + scrolls instead of clipping a detailed message to one line.

### 🧪 Tests

- New `tests/config-validation-detail.test.mjs` (12): api.js detail-folding + WHERE/WHY context + toast dwell (static guards); config.js PORT/HOST defaults; server contract that every error is a field-prefixed string; descriptive-message assertions; **secret-no-echo leak guard**; the 1–65535 range fix. 874 → 879.

---

## [1.57.0] — 2026-05-19

**feat(provider): OpenRouter as a 5th headless live-eval provider + fix(config): "validation failed" when saving any API key.**

### 🐛 Fixes

- **`/#/config` no longer rejects valid API keys with "validation failed".** Pasted keys routinely arrive with a trailing newline or surrounding spaces (OS clipboard, the "copy" buttons on provider consoles). Pre-1.57 that tripped the newline guard for **every** provider, and the `$`-anchored `ANTHROPIC_API_KEY` charset regex (`/^sk-ant-[A-Za-z0-9_-]{20,}$/`) false-rejected genuine Anthropic keys whose base64url tail / future prefix didn't fit the class. `validateConfig` now normalizes (trims) every value **before** validating, the route persists the trimmed value (so it authenticates at runtime — no stray-newline `.env` quoting), and the Anthropic check is a resilient `sk-ant-` prefix + length sanity check (the shared `isUsableKey()` 20-char floor remains the real "is it real?" gate). Internal newlines are still rejected — that `.env`-injection guard is intact.

### ✨ Features

- **OpenRouter is now a first-class provider.** Add `OPENROUTER_API_KEY` on `/#/config` and one key fronts 300+ models (Anthropic, OpenAI, Google, Meta, Qwen, DeepSeek …). It's the **last** entry of the `auto` order (Anthropic → Gemini → OpenAI → Qwen → **OpenRouter**), so an existing setup is never silently re-routed; `LLM_PROVIDER=openrouter` pins it. Wired into the same `_tailProvider()` path as OpenAI/Qwen across `/api/evaluate`, `/api/deep`, `/api/mode/:slug`, and surfaced by `/api/status/providers` + the Health dashboard. OpenAI-compatible client (zero new deps — direct `fetch`, `AbortController` timeout, key never logged) with the recommended `HTTP-Referer`/`X-Title` attribution headers.
- **The OpenRouter model dropdown is live.** `OPENROUTER_MODEL` is a dynamic select fed by **`GET /api/openrouter/models`** — a server-side proxy of OpenRouter's public catalogue (keeps the CSP `connect-src 'self'` envelope intact; no browser→third-party fetch). It degrades to a curated namespaced fallback list when the catalogue is unreachable (offline / rate-limited / 5xx), so the dropdown is never empty, and a 10-minute in-memory cache keeps repeat `/#/config` visits from re-hitting OpenRouter. New i18n keys (`config.openrouter*`) across all 8 locales; `config.llmProviderHint` updated.

### 🧪 Tests

- New CI-isolated suites: **`tests/openrouter-route.test.mjs`** (proxy answers 200 with a non-empty namespaced list even offline; leaks no secret) and **`tests/openrouter-model-selector.test.mjs`** (env-config contract + config.js wiring + 8-locale i18n parity). Extended `env-config`, `openai`, and `provider-selector` suites: trim/relax validation, `runOpenRouter`/`hasOpenRouterKey`/`fetchOpenRouterModels`, the appended `auto` tail, and the OpenRouter gate. Two previously-weak `validateConfig` cases (used the no-longer-known `HH_USER_AGENT`, so they passed for the wrong reason) now assert against a real key. 831 → 855.

---

## [1.56.4] — 2026-05-19

**feat(ui): UX-N2 — visible, platform-aware ⌘K / Ctrl K hint on the global search input.**

### ✨ Features

- **The Cmd/Ctrl+K "focus search" shortcut is now discoverable on screen.** It lived only in the input's `aria-label` / source, so sighted users never found it and the app felt slower than it is. A muted `<kbd class="kbd-shortcut">` now sits at the end of the search pill, filled at boot from `data-mac` / `data-other` by a platform check (`navigator.platform`/`userAgent`): **⌘K** on macOS/iOS, **Ctrl K** elsewhere. It is `aria-hidden="true"` (the existing `aria-label` already announces the shortcut to screen readers — the badge must not double-announce) and `pointer-events:none` (decorative). The existing Cmd/Ctrl+K keybinding is unchanged. No new i18n keys (the glyphs are universal); the badge is a flex child of the existing `.searchbar` (no wrapper / absolute positioning — the input is already `flex:1`).

### 🧪 Tests

- New CI-isolated source-static suite **`tests/cmdk-hint-visible.test.mjs`** (5): the `.kbd-shortcut` `<kbd>` lives inside the `.searchbar` pill; it is `aria-hidden="true"` with both `data-mac`/`data-other` variants; `app.js` fills it via a `navigator` platform check from the dataset; the existing `(e.ctrlKey||e.metaKey)&&e.key==='k'` → `search.focus()` keybinding is intact (regression guard); `app.css` styles `.kbd-shortcut` and never `display:none`. index.html/app.js/app.css are browser-only → asserted statically. 826 → 831.

---

## [1.56.3] — 2026-05-19

**fix(reliability): provider key detection rejects placeholder / too-short values, not only the empty string.**

### 🐛 Fixes

- **A placeholder `GEMINI_API_KEY` in a parent `.env` was reported "✓ set" AND mis-selected as the active provider over a valid `ANTHROPIC_API_KEY`.** `effectiveEnv()` only rejected `undefined`/`''`, so a 10-char placeholder counted as a real key: the onboarding banner showed *GEMINI ✓ set*, `GET /api/status/providers` returned `activeProvider: "gemini"`, and every live ⚡ eval would have silently failed against a dead key while a working 108-char Anthropic key was ignored. New pure `isUsableKey()` (`env-config.mjs`) treats a secret as configured only when it is ≥ 20 chars (no supported provider's key is shorter — Gemini `AIza…` ≈ 39, Anthropic `sk-ant-…` ≈ 100+, OpenAI ≥ 40, Qwen ≈ 35 — so a real key is never false-negatived) and not a known placeholder (`your_*_here`, `changeme`, `placeholder`, `<…>`, all-one-char, …). Applied uniformly to `hasAnthropicKey()`/`hasGeminiKey()` (`anthropic.mjs`), `hasOpenAIKey()`/`hasQwenKey()` (`openai.mjs`), and the `GEMINI_API_KEY`/`ANTHROPIC_API_KEY` rows of `GET /api/health` — which also moved off raw `process.env` onto the same effective+plausible view, so the health page, the providers endpoint, and the OR-router now always agree. `selectActiveProvider()` is unchanged; it just receives a correct `keysConfigured`.

### 🧪 Tests

- New CI-isolated suite **`tests/key-detection-rejects-placeholder.test.mjs`** (5): `isUsableKey` unit cases (empty/non-string, too-short incl. the 10-char repro, long-but-placeholder, realistic keys accepted) + an in-process `createApp()` reproduction of the exact reported scenario (10-char `GEMINI_API_KEY` + real `ANTHROPIC_API_KEY` in a temp parent `.env`, the 4 keys stripped from `process.env`) asserting `gemini` is NOT in `keysConfigured`, `activeProvider === "anthropic"`, and the `/api/health` rows agree. Four existing `anthropic`/`openai` effective-env layering tests had trivially-short stub keys (`sk-x`, `AIzaTEST`, `sk-o`, …) lengthened to realistic values — the layering contract they assert is unchanged; only the stubs had to clear the new floor. 821 → 826.

---

## [1.56.2] — 2026-05-19

**feat(a11y): UX-N1 — per-route, locale-aware `document.title` (multi-tab orientation + screen-reader page-change announcement).**

### ✨ Features

- **Every SPA route now sets a distinct, localized `document.title`.** Pre-fix all 24 routes kept the static `index.html` `<title>` ("career-ops — command center"), so multi-tab browsers showed identical tab labels, bookmarks were generic, and the screen-reader "page changed" announcement read the same on every navigation. `public/js/router.js` `focusNewView()` now derives the title from the view's own localized `<h1 class="page-title">` — `"<View> — career-ops"` — so titles are automatically translated (no new i18n keys) and distinct per route. Set **before** the first-paint guard so the initial tab is titled too (the same ordering rule the v1.56.0 UX-12 `tabindex` set follows). Falls back to `career-ops — command center` when a view has no heading.

### 🧪 Tests

- New CI-isolated source-static suite **`tests/document-title-per-route.test.mjs`** (4): `focusNewView` assigns `document.title`; the title is derived from the view `<h1>` textContent (per-route + localized, not one hardcoded literal); the assignment precedes the `!firstPaintDone` early-return; a sane product default is present. router.js is browser-only → asserted statically (same approach as `dashboard-initial-focus.test.mjs`). 817 → 821.

---

## [1.56.1] — 2026-05-19

**fix(a11y): suppress the spurious brand focus ring on router-managed `tabindex="-1"` heading focus.**

### 🐛 Fixes

- **A red box framed every view's `<h1>` (regression surfaced by v1.56.0 UX-12, rooted in the v1.41.0 SPA focus-management pattern).** `public/js/router.js` gives each destination view's heading `tabindex="-1"` and `.focus()`'s it on every client-side navigation so screen readers announce the new page. A `tabindex="-1"` element is never keyboard-reachable, yet Chromium's `:focus-visible` modality heuristic still painted the global brand ring (`*:focus-visible { outline: 2px solid var(--rausch) }`) around it — a **red rectangle around the page heading** (e.g. "Command Center" on `#/dashboard`) on every navigation, which had also been baked into the `images/dashboard-*.png` hero screenshots. The fix is one scoped rule — `[tabindex="-1"]:focus, [tabindex="-1"]:focus-visible { outline: none }` — the WAI-ARIA APG managed-focus pattern. Genuine keyboard focus on real interactive controls keeps the global `*:focus-visible` ring (WCAG 2.4.7 intact); the skip-link's ring is unaffected (it is an `<a>`, not `tabindex="-1"`, with a higher-specificity rule).
- All 8 `images/dashboard-*.png` regenerated against the fixed UI — the README hero screenshots no longer show the red box.

### 🧪 Tests

- New CI-isolated source-static suite **`tests/managed-focus-no-ring.test.mjs`** (4): the global `*:focus-visible` brand ring is still defined (WCAG 2.4.7 not regressed); `[tabindex="-1"]:focus, :focus-visible` resolves to `outline: none`; the suppression rule follows the global rule (cascade safety); the fix stays scoped (no blanket `*:focus { outline: none }`). Pairs with the existing `tests/dashboard-initial-focus.test.mjs` (router still sets tabindex + focuses on navigation). 813 → 817.

---

## [1.56.0] — 2026-05-19

**feat(ux): LOW-priority polish bundle — UX-9 / UX-10 / UX-11 / UX-12 (one grouped minor release).**

### ✨ Features

- **UX-9 — `#/cv` breadcrumb (visual hierarchy):** the page title is demoted to a quiet uppercase `.cv-breadcrumb` chip and the loud page-subtitle paragraph moves to the `<h1>` `title` tooltip, so the user's CV (their name, rendered in the preview) owns the visual space. The F-V54-A invariant is intact — still **exactly one `<h1>`**, still `.page-title` (the router focus target); only its weight changed.
- **UX-10 — honest cost ballpark (trust/feedback):** a new shared `UI.providerCostHint(t)` helper renders next to ⚡ Run live on `#/auto`, `#/evaluate`, `#/deep` and every `#/<mode>`. It reuses `GET /api/status/providers` (v1.55.3): with a key it shows *"Estimated cost: OpenAI gpt-5-codex · ~$0.04/eval"* (order-of-magnitude, deliberately "~"); with no key it states plainly that ⚡ Run live copies a manual prompt at no API cost. Fail-soft (hidden when offline).
- **UX-11 — `#/help` TOC auto-jump (aesthetic/flow):** when the TOC filter narrows to **exactly one** section, the page smooth-scrolls there after a 300ms idle (debounced — mid-typing keystrokes never yank the page; never fires for 0 or >1 matches), reusing the same scroll+focus path as a TOC click.
- **UX-12 — `#/dashboard` first-paint a11y (accessibility):** on the very first SPA paint the landing view's `<h1>` is now made programmatically focusable (`tabindex="-1"`) so screen-reader / heading navigation lands on it, and `#content` stays `aria-live="polite"` so the heading is announced on boot — **without** stealing focus (that would fight the skip-link, the deliberate v1.41.0 behaviour). Only subsequent route changes move focus. *(Note: UX-12 as originally specified — "call focusNewView() on boot" — conflicted with the v1.41.0 skip-link decision; resolved conservatively to satisfy the a11y intent without the regression.)*
- New i18n keys `cost.estimate`, `cost.manual` ×8 locales; new token-based `.cv-breadcrumb` / `.cost-hint` CSS.

### 🧪 Tests

- 4 new CI-isolated source-static suites — **`tests/cv-breadcrumb.test.mjs`** (3), **`tests/run-cost-line.test.mjs`** (4), **`tests/help-toc-autoscroll.test.mjs`** (4), **`tests/dashboard-initial-focus.test.mjs`** (3): single-h1 + breadcrumb class; shared helper exported + fail-soft + present in all 4 views + `cost.*` ×8; debounced exactly-1-match jump gated; tabindex-before-guard ordering + focus-after-guard + `#content` aria-live. The pre-existing `cv-single-h1` and `help-nav-a11y` locks were updated for the new (invariant-preserving) code. 800 → 813. Live Playwright probe of all four (no-key fixture): single h1 13px breadcrumb, cost hint manual note, TOC→1 narrow, h1 tabindex=-1 + aria-live polite, 0 console errors.

---

## [1.55.8] — 2026-05-19

**feat(tracker): server-side pagination + clickable funnel chips (UX-8).**

### ✨ Features

- **Server:** `GET /api/tracker` gains **optional** `?page` / `?pageSize` / `?status` query params. With none, the response is byte-for-byte the legacy `{ rows: [...] }` (every existing caller/test untouched). With them, it returns `{ rows: slice, total, page, pageSize, funnel }` — `pageSize` clamped to `[1,500]`, `page` clamped to `≥1`, `status` filters `rows`+`total`, and `funnel` is the **whole-history** status→count breakdown (independent of the page or status filter, so the UI chips are always accurate).
- **`#/tracker`:** a new clickable **funnel summary chip bar** at the top — *"all statuses · N · Applied · N · Interview · N · Offer · N · Rejected · N …"* (ordered Applied → Responded → Interview → Offer → Rejected → Discarded → Evaluated → SKIP). Clicking a chip sets the Status filter (clicking the active chip clears it); the active chip is `aria-pressed` and visually highlighted. The pipeline state is now legible at a glance instead of buried behind a dropdown. Feedback/forms lens.
- New i18n key `track.funnelAria` ×8 locales; new token-based `.tracker-funnel` / `.tracker-chip` / `.tracker-chip--active` CSS.

### 🧪 Tests

- **`test: tests/tracker-server-paged.test.mjs`** (new, 7 cases, CI-isolated, in-process Express on an ephemeral port + temp `CAREER_OPS_ROOT` applications.md fixture — CLAUDE.md #2/#8): back-compat (no params ⇒ exactly `{rows}`, no envelope leak); `?page&pageSize` slice + `total`+`page`+`pageSize`+full `funnel` summing to N; last partial page with no overlap; out-of-range page ⇒ empty rows + valid total; `?status=` filters total/rows while funnel stays whole-history; `pageSize` cap; plus a source-static lock on the `.tracker-funnel` chip bar (toggle-on-reclick, `aria-pressed`, `track.funnelAria` ×8, CSS). 793 → 800.

---

## [1.55.7] — 2026-05-19

**feat(pipeline): vanilla-JS row virtualization at >1000 rows (UX-7).**

### ✨ Features

- `#/pipeline` rendered **every** row (`filtered.forEach(list.appendChild(urlRow))`) — a real scan fills the queue with thousands of URLs, so thousands of row nodes (each a flex div + `<a>` + two buttons) were built synchronously on every filter keystroke, flooding the DOM and the accessibility tree. New **vanilla-JS virtualization** (a react-window equivalent, no deps): above `VIRTUALIZE_THRESHOLD = 1000`, `#/pipeline` becomes a fixed-height (`70vh`) scroll viewport with a non-shrinkable spacer (`flex:0 0 auto`, `height = rows × 56px`) that preserves the **real scrollbar for the full list**, and an rAF-throttled scroll listener renders only the viewport ± a 5-row buffer (~16–19 nodes at a time instead of N). At/below the threshold the original simple full render is kept **byte-for-byte**, so typical pipelines and all existing pipeline tests/e2e are unaffected. Each virtualized row keeps its URL-disambiguated ▶/✕ `aria-label` (F-V54-B regression-locked). Window math is a pure `computeWindow()` helper.

### 🧪 Tests

- **`test: tests/pipeline-virtualize.test.mjs`** (new, 5 cases, CI-isolated, source-static): a numeric ~1000 threshold gates the path; the ≤threshold branch keeps the simple `forEach`→`appendChild`; the >threshold branch renders `slice(start,end)` with a rAF-throttled scroll listener + a scrollbar-preserving spacer; `computeWindow()` clamps `[0,total]` with a ± buffer; rows keep the disambiguated ▶/✕ aria-labels. 788 → 793. Live Playwright probe (1200-URL fixture): `scrollHeight≈67248` (full range), only ~16–19 row nodes in the DOM, window tracks scroll end-to-end (row 0 → 595 → 1199), 0 console errors.

---

## [1.55.6] — 2026-05-19

**feat(scan): tuck secondary filters behind an "Advanced filters" disclosure (UX-4).**

### ✨ Features

- `#/scan` stacked every filter — free-text, remote/hybrid/onsite, scope, source, and the post-scan stack/level/dynamic facet chips — at equal weight, a wall of controls. Now the **everyday filters stay visible** (free-text + Remote/Hybrid/Onsite; the 🌐 Scan button is already separate in the controls card) and the **secondary ones collapse behind a `<details class="scan-advanced"><summary>Advanced filters</summary>`**: the Scope + Source selects, and — separately — the stack/level/dynamic facet-chip cluster (which now leads the fresh result set with the table, not a wall of chips, and only renders when at least one chip row exists). Cognitive-load lens.
- New i18n key `scan.advancedFilters` across all 8 locales; new token-based `.scan-advanced` summary styling (quiet ⚙ affordance, marker-less, bold when open).

### 🧪 Tests

- **`test: tests/scan-advanced-disclosure.test.mjs`** (new, 6 cases, CI-isolated, source-static): an Advanced-filters `<details>`/`<summary>` exists with the `.scan-advanced` hook and `scan.advancedFilters` label; free-text + remote stay in the always-visible group; scope + source live inside the disclosure; `chipsContainer` is a `<details>`; `.scan-advanced summary` is styled; `scan.advancedFilters` ×8 locales. 782 → 788.

---

## [1.55.5] — 2026-05-19

**feat(dashboard): hero-promote the 2 P0 CTAs + a focal recent-activity hint (UX-3).**

### ✨ Features

- `#/dashboard` opened with ~30 equal-weight nodes — no clear "what next". A new `.dash-hero` block now sits directly under the page header: the two P0 journeys — **✨ Auto-pipeline a URL** and **🌐 Scan now** — are promoted to large `.btn-hero` buttons, and a single **focal recent-activity hint** ("Last evaluation: `<score>` — `<title>`", linked to the report; a guiding empty-state on cold start via `dash.heroNoEval`) tells a returning user where they left off and a new user the one action that matters. The two primary buttons were removed from the header (only the secondary "📋 Open pipeline" stays there) so the action isn't duplicated.
- The application-status buckets were demoted from prominent `.badge`s to quiet `.dash-chip` pills so they no longer compete with the hero (Information-scent / cognitive-load lens).
- New i18n keys `dash.lastEval`, `dash.heroNoEval` across all 8 locales; new token-based `.dash-hero` / `.btn-hero` / `.dash-chip` CSS.

### 🧪 Tests

- **`test: tests/dashboard-hero.test.mjs`** (new, 5 cases, CI-isolated, source-static): a `.dash-hero` block exists and precedes the Quick-actions grid; both P0 CTAs are `.btn-hero` with the `/auto` + `/scan` routes; a focal `dash.lastEval` hint + `dash.heroNoEval` empty-state; status buckets use `.dash-chip`; `.dash-hero`/`.btn-hero`/`.dash-chip` CSS exists; `dash.lastEval` + `dash.heroNoEval` ×8 locales. 777 → 782.

---

## [1.55.4] — 2026-05-19

**feat(ux): honest auto-pipeline ETA next to Run + prominent Stop during a scan (UX-6).**

### ✨ Features

- `#/auto`: a new `.auto-eta` hint — *"⏱ ~1–2 min"* (key `auto.eta`, `title` via `auto.etaTitle`) — now sits directly next to the Run button, so the one-click promise is honest about duration *before* the user commits. The wording matches career-ops.org/docs ("paste a URL → full report in 1–2 minutes"). Feedback & system-status lens.
- `#/scan`: while the multi-minute crawl is running (`aria-busy`), the **Stop** control is promoted from a low-contrast ghost button to a prominent destructive button (new `.btn-danger` — filled, high-contrast white-on-coral, weight 600). `setScanRunning(running)` flips `scan-stop-btn` between `btn-danger` (running) and `btn-ghost` (idle, when it is hidden anyway), so the user can find and trust Stop under load. Error-recovery lens.
- New i18n keys `auto.eta`, `auto.etaTitle` across all 8 locales; new token-based `.btn-danger` / `.auto-eta` CSS.

### 🧪 Tests

- **`test: tests/auto-eta-stop.test.mjs`** (new, 4 cases, CI-isolated, source-static): `#/auto` renders `t('auto.eta')` with the `.auto-eta` class adjacent to `runBtn`; `auto.eta` ×8 locales; `setScanRunning(running)` promotes Stop to `btn-danger`; `.btn-danger` exists with high-contrast white text. 773 → 777.

---

## [1.55.3] — 2026-05-19

**feat(onboarding): on-screen 4-provider OR status — cold-start banner + active-provider chip (UX-2, HIGH).**

### ✨ Features

- New read-only endpoint **`GET /api/status/providers`** → `{ activeProvider, activeModel, keysConfigured }`. `keysConfigured` uses the same effective-env view as the `llm.mjs` gate sites (process.env ∨ parent `.env`, via `hasAnthropicKey/hasGeminiKey/hasOpenAIKey/hasQwenKey`); `activeProvider` is what the OR-router would actually pick — `selectActiveProvider()`, a new pure helper in `env-config.mjs` that walks `providerOrder()` (so an `LLM_PROVIDER` pin with no matching key correctly yields `null`). No secrets are returned — only provider names + the model id.
- The SPA shell now renders a global onboarding region (`#onboarding-banner`, populated by `app.js` from that endpoint, CSP-safe DOM only): **0 keys → a red banner** "No LLM key set — '⚡ Run live' is in manual-prompt mode…" with a CTA deep-linking to `#/config?tab=api-keys`; **≥1 key → a subtle chip** naming the active provider + model (e.g. *Live eval: OpenAI (gpt-5-codex)*). It re-evaluates on locale change and when the user navigates away from the config tab (keys may have just been saved). This makes the product's headline differentiator — "one of Anthropic / Gemini / OpenAI / Qwen works, auto-ordered" — discoverable on screen instead of learned by trial.
- New i18n keys `onboarding.noKey.title`, `onboarding.noKey.cta`, `onboarding.activeProvider` across all 8 locales; new `.onboarding-warn` / `.onboarding-ok` CSS (token-based, mirrors `.conn-banner`).

### 🧪 Tests

- **`test: tests/onboarding-key-banner.test.mjs`** (new, 9 cases, CI-isolated): `selectActiveProvider` auto-order / none / `LLM_PROVIDER`-pin semantics; `GET /api/status/providers` in-process (ephemeral port + temp `CAREER_OPS_ROOT` `.env` so the real parent key is never read — CLAUDE.md #2/#8) for 0-key, 1-key+model, and Anthropic-over-Gemini auto order; static SPA wiring (banner host, endpoint fetch, `#/config?tab=api-keys` CTA) + `onboarding.*` ×8 locale coverage. 764 → 773.

---

## [1.55.2] — 2026-05-18

**fix(cv): give the `#/cv` markdown editor a descriptive, self-contained accessible name (F-V55-H / UX-5).**

### 🐛 Bug Fixes

- The `#/cv` primary editor `<textarea id="cv-editor">` now carries a descriptive `aria-label` via the new `cv.editorAria` key — *"CV markdown editor — your professional resume in markdown format"* — instead of the terse name it inherited from the visible "Markdown" section heading. Note: contrary to the F-V55-H symptom (which only inspected `aria-label`/`labels`), the field was **not** nameless — v1.47.0 (WS2 #16) had already bound it via `aria-labelledby` → the `<h3 id="cv-md-heading">Markdown</h3>`, so a screen reader announced "Markdown, edit, multiline". v1.55.2 upgrades that terse "Markdown" to a self-contained label so a screen-reader user lands and immediately knows what the field is. The redundant `aria-labelledby` is removed (a leftover would be dead markup — `aria-label` wins per ARIA precedence); the visible `<h3>Markdown</h3>` stays on screen for sighted users. WCAG 1.3.1 + 4.1.2; parallels the v1.54.5 batch-tsv fix (F-V54-C).

### 🧪 Tests

- **`test: tests/cv-editor-a11y.test.mjs`** (new, 3 cases, CI-isolated, source-static like `auto-stepper-prerender.test.mjs`): `#cv-editor` names itself via `t('cv.editorAria', …)` with a non-empty fallback; `cv.editorAria` is present and non-empty in all 8 locales; no redundant `aria-labelledby` remains on the element. 761 → 764.

---

## [1.55.1] — 2026-05-18

**fix(auto): pre-render the 5-stage pipeline stepper on `#/auto` mount (F-V55-E / UX-1, senior obs S-4 reopened).**

### 🐛 Bug Fixes

- `#/auto` now shows the documented five-stage outline — **validate → fetch → evaluate → save report → add tracker** — the moment the screen mounts, instead of staying blank until the first SSE event. Previously `<ol class="auto-stepper">` was created `display:none` and `renderStepper()` was only reached from `setStep()` / `run()`, so a cold-start user never saw the pipeline the docs promise before clicking Run. The stepper is now visible on mount with all five steps in the `pending` state, and carries an `aria-label` (`auto.stepperAria`) so assistive tech announces the region. Closes F-V55-E (a11y/static-guarantee lens) and UX-1 (promise-fidelity lens) — same fix, both lenses.

### 🧪 Tests

- **`test: tests/auto-stepper-prerender.test.mjs`** (new, 4 cases, CI-isolated, source-static like `router.test.mjs`): the `STEPS` array is exactly the 5 canonical stages in order; `stepperEl` is not `display:none` on mount and carries `auto.stepperAria`; a mount-scope `renderStepper()` call precedes `function setStep(`; `auto.stepperAria` is present in all 8 locales. 757 → 761.

---

## [1.55.0] — 2026-05-18

**feat(llm): headless live-eval runs via "OR" — Anthropic | Gemini | OpenAI | Qwen, auto-selected by whichever key is set.**

### ✨ Features

- Per user request, the web-ui ⚡ live eval now works with **whichever API key is set**, not just Anthropic/Gemini. `LLM_PROVIDER` gains `openai` and `qwen`; `auto` (default) uses the first provider whose key is present, preferring **Anthropic → Gemini → OpenAI → Qwen**. An explicit value pins one; a forced provider with no key still falls through to the manual-prompt path.
- New `server/lib/openai.mjs` — a zero-dependency OpenAI-compatible Chat Completions client (same secure direct-HTTPS pattern as `anthropic.mjs`: `AbortController` timeout, key never logged, `effectiveEnv()` key resolution so a parent-`.env` key works without a restart). One core (`runOpenAICompatible`) backs **`runOpenAI`** (api.openai.com) and **`runQwen`** (Alibaba DashScope OpenAI-compatible mode; override the endpoint with `QWEN_BASE_URL` in the raw `.env` for the mainland-CN host). No SDKs, **no arbitrary CLI execution** — the parent project stays CLI-agnostic (Claude Code · Codex · Gemini · OpenCode · Qwen · Copilot · Kimi); this only extends the *headless* API-key path.
- The OpenAI/Qwen tail is wired into all eval surfaces: `/api/evaluate`, `/api/deep`, `/api/mode/:slug`, and the `/api/auto-pipeline` SSE — consulted after the existing Anthropic (inline) + Gemini (subprocess) branches so the auto preference is preserved, with the same bundled-context inlining Anthropic uses.
- `env-config.mjs`: `QWEN_API_KEY` (secret) + `QWEN_MODEL` (not secret) added to `KNOWN_KEYS`/`KEY_GROUPS.core`; `LLM_PROVIDERS` and `providerOrder()` extended; `OPENAI_API_KEY` is now a first-class headless provider key (was stored-only).
- `#/config` API-keys tab: `LLM_PROVIDER` select gains `openai`/`qwen`; new `QWEN_API_KEY` + `QWEN_MODEL` fields (curated `qwen-max`/`qwen-plus`/`qwen-turbo`/`qwen2.5-*` list); a new top-of-tab note explains the CLI-agnostic parent vs the headless web-ui eval and the OR order. Updated OpenAI/provider hint copy. New i18n keys (`config.providerModelNote`, `config.qwen*`) + 3 updated hints, across all 8 locales.

### 🧪 Tests

- **`test: tests/openai.test.mjs`** (new, 9 cases, CI-isolated): OpenAI/Qwen success + block-array content, Bearer auth, default + `QWEN_BASE_URL`-overridden endpoints, 4xx/5xx/malformed, `max_tokens` clamp, timeout, `effectiveEnv` key detection, no-key-leak canary. **`tests/provider-selector.test.mjs`** updated for the v1.55.0 `providerOrder`/`LLM_PROVIDERS`/SECRET surface + the OpenAI/Qwen tail wiring. 748 → 757.

---

## [1.54.10] — 2026-05-18

**fix(auto-pipeline): SSE client-disconnect hygiene — kill the flaky Playwright e2e job.**

### 🐛 Fixes

- The Playwright e2e job intermittently went red (32/32 individual tests pass, but `not ok 2 - tests/playwright-smoke.mjs`): closing a page while the `#/auto` SSE stream was mid-flight made the server's next `res.write()` reject with `EPIPE`/`"aborted"`, and — with no `'error'` listener on the response — Node escalated it to an uncaughtException that node:test reported as "asynchronous activity after the test ended". `openSse()` in `auto-pipeline.mjs` now registers a no-op `res.on('error')` and guards `send()` on `res.writableEnded || res.destroyed` (wrapped in try/catch) — a vanished client is expected, not exceptional. This is correct production SSE hygiene, not just a test fix.
- `tests/playwright-smoke.mjs`: the Cmd+K test used a real outbound URL (`https://example.com/jobs/123`) but only waited for the modal to appear, so `closePage()` aborted the server's in-flight `safeGet()` after the test ended. It now waits for the pipeline to reach a terminal state (so the fetch resolves normally before close). A shared `closePage()` helper (`window.stop()` then close) and the `after`-hook `server.closeAllConnections()` remain as defence-in-depth. Verified: 8/8 consecutive green runs (6× `node --test` + 2× browser-smoke), previously ~1-in-2 red.

### 🧪 Tests

- **`test: tests/auto-pipeline.test.mjs`** +1 static case locking the `openSse` disconnect-hygiene contract (`res.on('error')` listener + `writableEnded||destroyed` guard + try-wrapped writes). 747 → 748.

---

## [1.54.9] — 2026-05-18

**fix(llm): honour the parent `.env` LLM keys at request time — stop mis-routing to a stale/invalid provider.**

### 🐛 Fixes

- Live evaluation could fail with *"Gemini API error: API key not valid"* even when `ANTHROPIC_API_KEY` was the configured provider. Root cause: `hasAnthropicKey()` / `hasGeminiKey()` (and `runAnthropic`'s key/model lookup) read **only the boot-time `process.env` snapshot**. If the Anthropic key was added to the parent `.env` after the server started, the running process never saw it → Anthropic detection was false, and evaluation fell through to whatever stale key *was* in `process.env` (often an old, invalid `GEMINI_API_KEY`). The Gemini exec path (a parent Node subprocess) already read the live parent `.env`, so the two providers resolved keys inconsistently.
- New `effectiveEnv(key, envFilePath)` in `env-config.mjs`: a non-empty `process.env` value wins (covers shell exports and the live-apply in `POST /api/config`); otherwise the **current parent `.env` file** is consulted. `anthropic.mjs` now resolves `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, and the Gemini-key check through it, so a key set in the parent `.env` is honoured **without a server restart** and key DETECTION always matches the key the request actually SENDS. Provider order is unchanged (`auto` → Anthropic-then-Gemini); this only fixes detection. Keys are never logged or returned (the REVIEW-B4 no-leak test still passes).

### 🧪 Tests

- **`test: tests/anthropic.test.mjs`** rewritten to be CI-isolated (temp `CAREER_OPS_ROOT`, dynamic import) with 2 new cases reproducing the exact bug (key only in parent `.env` → detected; `runAnthropic` sends the parent-`.env` key + model when `process.env` is unset). **`test: tests/env-config.test.mjs`** +3 `effectiveEnv` cases (process.env precedence, `.env` fallback incl. empty-string-as-unset, missing-file / absent-key / no-path → undefined) — 100% of the new branch. 742 → 747.

---

## [1.54.8] — 2026-05-18

**feat(config): Modes field-form always renders the canonical schema (even on an empty/stub file) with career-ops.org field guidance.**

### ✨ Features

- The v1.54.3 Modes field-form only rendered fields for `##` sections that already existed — so on a fresh, empty, or non-schema `modes/_profile.md` (e.g. the common 1-line stub) it fell back to *"No ## sections found — use the raw editor below."* and the user never got fields. Per user request (*"разбей по полям … описание полей возьми из career-ops.org/docs"*), the form now **always renders the 5 canonical fields in documented order** (Target Roles, Adaptive Framing, Exit Narrative, Comp Targets, Location Policy), pre-filled from the file when present and empty-but-editable when not — so a brand-new profile can be filled in entirely through the form.
- Each field shows a **description sourced from the canonical career-ops.org Quick Start §Step-5** (what to put in Target Roles / Adaptive Framing / Exit Narrative / Comp Targets / Location Policy), wired via `aria-describedby` for screen readers.
- Heading-variant tolerant: the template's `## Your Target Roles` (etc.) maps to the same canonical field as `## Target Roles`, so neither the template nor the server-scaffold convention breaks the form.
- `collect()` is now a tagged payload: a non-destructive **`{ sections }` merge** when the rendered headings exactly match the file's existing ones (preamble + untouched + custom sections survive byte-stable), or a **`{ markdown }` full-file rebuild** that bootstraps/normalises a schema-conformant document when the file lacked the schema. The rebuild path is **confirm-gated** in `config.js` (it replaces the parent file — WS2 #4 destructive-save invariant), preserves the existing preamble (or a documented default), and keeps non-canonical sections verbatim.
- 6 new i18n keys (`config.modesDescTargetRoles` … `config.modesDescLocationPolicy` + `config.modesFormRebuildBody`) across all 8 locales.

### 🧪 Tests

- **`test: tests/modes-form.test.mjs`** — rewritten for the v1.54.8 contract: schema + canonical order, config.js payload/confirm wiring, every field's doc-sourced description present in all 8 locales, `canonicalKey` "Your X" tolerance, list round-trip stability, the bootstrap-always-renders guarantee, and the tagged sections-vs-markdown collect() with data-safety. Verified live against the real parent stub file (5 fields + descriptions appear, 0 console errors) and an isolated stub fixture (fill → confirm-gated save → all 5 canonical sections persisted). 742 unchanged (7 cases, replaced).

---

## [1.54.7] — 2026-05-18

**fix: W-001 — code/style assets + SPA shell served `Cache-Control: no-store` (deploy-hygiene).**

### 🐛 Fixes

- The SPA loads `api.js` / `router.js` / every view via plain `<script src>` with no version query string, and there is no build step (no content hashing), so after a deploy a browser could keep serving a **cached old bundle for hours** → stale-cache 404s on query-string routes (observed live during the v1.29.2 regression; regression run W-001). `server/index.mjs` now sets `Cache-Control: no-store` on `.js` / `.mjs` / `.css` / `.html` via the `express.static` `setHeaders` hook, and explicitly on the SPA-shell catch-all (which uses `sendFile` and bypasses `setHeaders`), so the browser always revalidates the code that drives routing. Non-code static assets keep `express.static`'s default caching. Security headers (CSP / nosniff / frame-deny / referrer-policy) are unchanged — verified by the existing `security-headers` suite (8 cases) running green alongside the new test.

### 🧪 Tests

- **`test: tests/asset-cache-control.test.mjs`** — 4 cases (JS assets `no-store`, CSS `no-store`, static `index.html` `no-store`, SPA catch-all deep-route shell `no-store`), booting the real app against an isolated `CAREER_OPS_ROOT`. Plus a flaky-teardown fix in `tests/playwright-smoke.mjs` (separate `test(e2e)` commit): the auto-pipeline SSE smoke test now cancels the reader + aborts the fetch in a `finally` and the `after` hook force-closes lingering sockets, eliminating the post-teardown "Error: aborted" that reddened the v1.54.6 Playwright e2e job. 738 → 742.

---

## [1.54.6] — 2026-05-18

**fix(a11y): S-7 — `#/help` back-to-top button carries the canonical `back-to-top` selector class.**

### 🐛 Fixes

- The `#/help` floating back-to-top button worked correctly (verified live) but its class list (`btn btn-primary help-back-top`) sat outside the `.back-to-top` selector convention the spec §2 #28 test targets — a tightened selector would have flaked (regression run S-7, "easy win"). The button now also carries the canonical `back-to-top` class. Purely additive and a CSS-no-op: `help-back-top` (the existing CSS hook) is unchanged and `back-to-top` has no CSS rule — it's a stable test/automation handle only. Verified live: `document.querySelector('.back-to-top')` resolves the button, `aria-label` intact, 0 console errors.

### 🧪 Tests

- **`test: tests/help-nav-a11y.test.mjs`** — extended the existing #12 case with an assertion that the back-to-top button's class list includes the canonical `back-to-top` selector (no new file; 738 unchanged).

---

## [1.54.5] — 2026-05-18

**fix(a11y): F-V54-C — `#/batch` TSV editor has an accessible name.**

### 🐛 Fixes

- The `#/batch` TSV textarea had a hint wired via `aria-describedby` but **no accessible name** — no `<label htmlFor>`, no `aria-label`/`aria-labelledby` (regression run F-V54-C; WCAG 1.3.1 Info & Relationships / 4.1.2 Name, Role, Value). `aria-describedby` supplies a *description*, not a *name*, so a screen reader announced an unlabelled "edit text". The textarea now carries an `aria-label` via the new i18n key `batch.tsvAria`, consistent with the sibling run-control inputs that already use `*Aria` keys; the existing describedby hint is preserved. Verified live: `aria-label` present + localized, `aria-describedby` intact, 0 console errors.
- New i18n key `batch.tsvAria` across all 8 locales.

### 🧪 Tests

- **`test: tests/batch-tsv-accessible-name.test.mjs`** — 2 cases (the `batch-tsv` block has an `aria-label` via `t(batch.tsvAria)` while keeping its describedby hint; `batch.tsvAria` defined in all 8 locales). 736 → 738.

---

## [1.54.4] — 2026-05-18

**fix(a11y): F-V54-B — `#/pipeline` row-action buttons have accessible names.**

### 🐛 Fixes

- The per-row `▶` (evaluate) and `✕` (delete) buttons on `#/pipeline` were icon-only with only a `title` attribute (regression run F-V54-B; WCAG 4.1.2 Name, Role, Value). `title` is not a reliable accessible name, so a screen-reader user heard a long run of indistinct "button"s and could not tell which row a delete would hit. Both buttons now carry an explicit `aria-label` disambiguated by a compact URL via a new `shortUrl()` helper (`host` + `…/` + last 2 path segments; trailing-slice fallback for unparseable input), so the a11y tree reads e.g. *"Delete: hh.ru/…/vacancy/12345"*. No new i18n keys — reuses `common.delete` / `pipe.evaluateBtn` + the URL. Verified live: 1385 rows, each button name unique per row, 0 console errors.

### 🧪 Tests

- **`test: tests/pipeline-row-action-names.test.mjs`** — 4 cases (both buttons wired with `shortUrl(url)` + exactly two such labels, `shortUrl` declared before use, same-host different-job URLs don't collapse, bare-host / unparseable / empty fallbacks). 732 → 736.

---

## [1.54.3] — 2026-05-18

**feat(config): structured field-form for the `#/config` "Modes" tab (no more raw markdown).**

### ✨ Features

- The "Modes" tab edited `modes/_profile.md` as one raw `<textarea>` per `##` section (v1.36.0 section-level granularity). Per user request — *"собери данные по полям, разбей из документации, определи набор полей и реализуй поля именно, а не сырой"* — it now renders a **structured field-form derived from the documented schema** (career-ops.org Quick Start §Step-5):
  - `Target Roles` / `Adaptive Framing` / `Comp Targets` → **repeatable add/remove labelled line-inputs** (one role/angle/comp line per field, `＋ Add line` / per-row `✕` with `aria-label`).
  - `Exit Narrative` / `Location Policy` → **single labelled prose `<textarea>`**.
  - Each field is a real `<label htmlFor>`-bound control with an i18n section name.
- New `public/js/lib/modes-form.js` (`window.ModesForm`) owns the parse → render → `collect()` logic; it feeds the **existing** `PUT /api/modes/_profile { sections }` merge path, so the preamble, ordering, and any section the form doesn't touch survive byte-stable (merge-not-replace, server-enforced).
- **Data-safety:** a canonical list section whose body isn't a pure bullet list (user put prose there) and any non-canonical `##` section fall back to a labelled verbatim `<textarea>` with an explanatory note — arbitrary content round-trips untouched, never silently reshaped or lost. Round-trip stability proven: `serialise(parse(body))` re-parses identically.
- The raw full-file markdown editor remains as the confirm-gated **Advanced** disclosure for add/remove-section and preamble edits (WS2 #4 destructive-save gate unchanged).
- 10 new i18n keys (`config.modesTargetRoles` … `config.modesUnknownNote`) across all 8 locales.

### 🧪 Tests

- **`test: tests/modes-form.test.mjs`** — 7 cases (documented schema present, config.js wires `ModesForm.build/collect` + drops the stale `modesSectionInputs` map, list classification incl. scaffold/prose/mixed, list & prose round-trip stability, empty-list → empty section, custom-section verbatim data-safety). 725 → 732. Verified live against an isolated `CAREER_OPS_ROOT` fixture: 5 canonical sections rendered as fields + 1 custom section as a labelled fallback, edit-and-save round-trip preserved the preamble + custom section, 0 console errors.

---

## [1.54.2] — 2026-05-18

**feat(config): OpenAI / Codex model selector in `#/config`.**

### ✨ Features

- `#/config` had no way to pick the OpenAI / Codex model — only `ANTHROPIC_MODEL` and `GEMINI_MODEL` had dropdowns, even though `OPENAI_API_KEY` was already exposed for the parent multi-CLI (Codex / OpenCode) flow. `OPENAI_MODEL` is now a first-class env key: added to `env-config.mjs` `KNOWN_KEYS` (ordered right after `OPENAI_API_KEY`) and the `core` key group, and **deliberately not** in `SECRET_KEYS` — it's a model id, not a credential, so it's never masked. `config.js` gains a curated `OPENAI_MODELS` list (`gpt-5-codex` default, then `gpt-5` / `gpt-5-mini` / `gpt-4.1` / `o4-mini` / `o3`) and an `OPENAI_MODEL` `<select>` field rendered immediately after the OpenAI key, mirroring the Anthropic/Gemini model fields exactly (same `kind: 'select'`, `aria-describedby` hint wiring, label = env-var name). Read by the parent Codex / OpenCode CLI flow — web-ui live-eval still uses Anthropic|Gemini. Verified live: `#/config` → `OPENAI_MODEL` select with 6 options, default `gpt-5-codex`, label-bound, 0 console errors.
- New i18n keys `config.openaiModel` + `config.openaiModelHint` across all 8 locales.

### 🧪 Tests

- **`test: tests/openai-model-selector.test.mjs`** — 4 cases (env-config core/non-secret contract + key ordering, `OPENAI_MODELS` list with `gpt-5-codex` default, the `OPENAI_MODEL` select field wired after `OPENAI_API_KEY`, both i18n keys across all 8 locales). 721 → 725.

---

## [1.54.1] — 2026-05-18

**fix(a11y): F-V54-A — `#/cv` single `<h1>`.**

### 🐛 Fixes

- The CV markdown's own `# Name` rendered as a **second** top-level `<h1>` next to the page-title `<h1>CV</h1>` (regression run F-V54-A; WCAG 1.3.1 Info & Relationships / 2.4.6 Headings). `cv.js` now feeds every preview-injection point (initial render, file-import refresh, live editor sync) through a scoped `cvMd()` that shifts headings down one level (h1→h2 … h5→h6, h6→`role="heading" aria-level="7"`), so the page keeps exactly one `<h1>`. Scoped to `cv.js` on purpose — `UI.md` is shared by help/reports/deep/evaluate, which manage headings their own way (help strips article h1s + builds its TOC from h2). Verified live: `#/cv` → 1 page `<h1>` ("CV"), the user's `# Name` is now `<h2>`, 0 console errors.

### 🧪 Tests

- **`test: tests/cv-single-h1.test.mjs`** — 4 cases (cvMd shift chain, every preview site uses cvMd not raw UI.md, single page-title h1, the transform re-derived + proven to map every level down). 717 → 721.

### Verification

```bash
$ npm run test:ci
# 721 / 721 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.54.1
# Playwright #/cv: 1 <h1> ("CV"), preview h1=0/h2=1, 0 console errors
```

---

## [1.54.0] — 2026-05-18

**WS10 — canonical-docs re-validation + help-bundle H3 parity (final convergence release).**

The absolute-last workstream: re-validate the SPA against the 5
canonical `career-ops.org/docs` guides + the parent project, close the
last structural doc-divergence, and refresh the SDD spec — shipped as
its own release per the WS10 mandate.

### 🐛 Fixes

- **`fix(docs): help-bundle H3 parity — en=70 vs locales=68`** — the CHANGELOG/structure CI gate only checked **H2**, so `docs/help/en.md` had silently drifted to 70 `### ` subsections while all 7 localized bundles stayed at 68. The gap was §17 ("How to add a new job-portal source"): the **"Reference adapters"** table + **"Common pitfalls"** list had been added to en only. Both are now translated into es/ja/ko-KR/pt-BR/ru/zh-CN/zh-TW (adapter filenames, relative links, `registry.mjs`, `r.source === fs`, `fetchImpl`/`signal`, `tracked_companies` kept byte-identical). All 8 bundles: **17 H2 / 70 H3**.

### 🧪 Tests

- **`test(help): H3-parity gate`** — `help-ru-config-section.test.mjs` now also asserts every bundle (en + 7) has an identical H3 count (70), not just H2. An en-only `###` addition can no longer silently diverge the localized bundles. 716 → 717.

### 📝 Documentation

- **Canonical re-validation:** `tests/canonical-docs-coverage.test.mjs` (7/7) confirms the help bundles still mirror all 5 canonical guides — *what-is-career-ops*, *scan-job-portals*, *apply-for-a-job*, *batch-evaluate-offers*, *set-up-playwright* — and the WS2 UX-audit (40 findings, every screen Playwright-verified across v1.41→v1.52) validated every screen against documented behaviour. No divergence found.
- **`docs/sdd/CONVENTIONS.md`** refreshed to v1.54.0 reality: test totals (716 `node --test` + 4 E2E + shell-surface tier), the new H3-parity gate, updated file-size outliers (scan/config grew with WS2), and a new **Accessibility** section codifying the WS2 patterns (focus-trapped `UI.confirm`, WAI-ARIA tabs, SSE live-regions, label binding, sortable-table `aria-sort`, async-relabel announce) as standing conventions.

### Verification

```bash
$ npm run test:ci
# 717 / 717 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.54.0
# help bundles: all 8 → 17 H2 / 70 H3 · canonical-docs-coverage 7/7
```

> WS0–WS10 complete. Only WS11 (qa/ actualization + final QA prompt) remains.

---

## [1.53.0] — 2026-05-18

**WS9 — shell-surface test pyramid (the last untested layer).**

### 🧪 Tests

- **`test: tests/sh-files.test.mjs`** — the 4 `bin/*.sh` scripts and the `.githooks/pre-commit` hook had **zero** coverage. 10 cases now lock: `bash -n`/`sh -n` syntax, shebang + executable bit, and the behavioural contracts other workstreams depend on:
  - `career-ops-ui.sh` — `help` exits 0 + prints usage with **no shell-source leak** (v1.40.0 regression guard), unknown verb exits 2 with usage on stderr, `usage()` is a heredoc (not the fragile `sed`-scrape), all dispatcher case-labels present.
  - `start.sh` — `NO_OPEN` honored, Node ≥ 18 gate, browser-raise delegated to `scripts/open-dashboard.mjs` (v1.43.0 guard), no bare `open "$URL"`.
  - `setup.sh` — strict mode, `SKIP_START`, clones both repos, `need git`.
  - `run_all.sh` — `--quick`/`--no-e2e` parsing, runs all 4 suites via `run_suite`.
  - `.githooks/pre-commit` — execs the WS7 reviewer; **no shell file invokes `git --no-verify`** (CLAUDE.md hard rule #7 guard); `install-hooks.mjs` wires `core.hooksPath` and is the npm `prepare` step.
- 706 → 716.

### 📝 Documentation

- `docs/architecture/TESTING.md` — added the **shell-surface base layer** to the pyramid diagram + a v1.53.0 totals note (716 `node --test` cases / 90 files + 4 E2E surfaces); documents that `scripts/*.mjs` logic is covered by `cli-doctor`/`open-dashboard`/`ai-precommit-review`/`provider-selector` + the CI-gate scripts.

### Verification

```bash
$ npm run test:ci
# 716 / 716 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.53.0
```

---

## [1.52.0] — 2026-05-18

**WS2 LOWs #33–#40 — batched polish sweep (closes the UX-audit queue).**

### 🐛 Fixes

- **`fix(a11y/i18n): WS2 LOW batch`** — eight low-severity findings:
  - **#33** `#/dashboard` — the 3 header CTAs were inconsistent (only 2 had a leading icon); "Open Pipeline" now gets `📋` so all three match.
  - **#34** `#/profile` — archetype `fit`/`level` rendered as two bare ambiguous chips; now prefixed (`Fit: …` / `Level: …`) with matching `aria-label`.
  - **#35** `#/health` — Run-doctor / verify toasts showed raw `doctor.mjs` / `verify-pipeline.mjs` strings; now i18n-keyed (`health.runningDoctor/Verify`).
  - **#36** `#/health` — the check results were a flat run of `<div>`s with no programmatic name↔status link. Now a `role="list"` `<ul>`/`<li>` and the status badge carries `aria-label="<check>: <status>"`.
  - **#37** `#/reports` — report cards were mouse-only `<div onClick>`; now `role="link"` + `tabindex="0"` + Enter/Space handler + `aria-label`.
  - **#38** `#/activity` — the paginator comment said "200" while the code requested 500; reconciled to a `CAP` constant and a `role="note"` notice now surfaces when the 500-cap truncates older history (`activity.truncated`).
  - **#39** `#/batch` — prose placeholders were hardcoded English while their `aria-label`s were localized; the four (`minScore/maxRetries/model/startFrom`) are now i18n-keyed (the TSV-template placeholder stays — it's a data-format example).
  - **#40** mode pages — the async health probe relabelled/reordered the primary button silently; a visually-hidden `role="status"` region now announces it (`mode.liveReadyAnnounce`).

### 🌐 i18n

- 10 new keys × 8 locales (`set.fit/level`, `health.runningDoctor/Verify`, `activity.truncated` (`{n}` preserved), `batch.minScorePh/maxRetriesPh/modelPh/startFromPh`, `mode.liveReadyAnnounce`). `i18n-coverage` gate green.

### 🧪 Tests

- **`test: tests/low-sweep.test.mjs`** — 9 cases (one per finding + the 10-key ×8 i18n check). 697 → 706. Playwright-verified: health `ul[role=list]` (17 `li`, badge aria "Node version: OK"), report card role=link/tabindex/aria, dashboard CTAs all-iconed, 0 console errors.

> This closes the WS2 UX-audit queue (#1–#40 across v1.41→v1.52). Next: WS9 (test pyramid) → WS10 (canonical re-validation + separate final release) → WS11 (qa/ finalization).

### Verification

```bash
$ npm run test:ci
# 706 / 706 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.52.0
```

---

## [1.51.0] — 2026-05-18

**WS2 #13 + #14 + #18 + #19 + #20 — feedback / i18n sweep (auto + evaluate).**

### 🐛 Fixes

- **`fix(a11y/ux): pending feedback, actionable errors, real clipboard, status regions`**:
  - **#13** `#/auto` Run button was disabled with an unchanged label → no pending cue for the multi-second pipeline. It now shows a busy state (`is-loading` + `aria-busy` + "⏳ Running…"), restored in `finally`.
  - **#14** the HTTP-failure branch put a bare "HTTP 500" on step 1 with no toast and an empty live region. Now an actionable, i18n'd message (`auto.httpFail`, `{n}`-substituted) on the step **and** a toast.
  - **#18** the manual-mode "Copy prompt" used deprecated `document.execCommand('copy')` and always toasted "Copied" even when it silently no-op'd. Now prefers the async Clipboard API, falls back to `execCommand`, and toasts a real failure (`auto.copyFail`) instead of a false success.
  - **#19** `#/evaluate` `#eval-out` had no live role — the long LLM call was silent for screen readers. Now `role="status" aria-live="polite"` so "Evaluating…", the verdict, and errors are announced.
  - **#20** the Evaluate button was a plain `onClick: run` (enabled during the call → duplicate submissions). Now `UI.withSpinner`-wrapped (disables + busy state).

### 🌐 i18n

- 3 new keys × 8 locales — `auto.running`, `auto.httpFail` (`{n}` preserved), `auto.copyFail`. `i18n-coverage` gate green.

### 🧪 Tests

- **`test: tests/feedback-i18n-sweep.test.mjs`** — 6 cases (busy state + restore, actionable+toasted HTTP fail, async-clipboard fallback, eval status region, eval spinner-wrap, 3 i18n keys ×8). 691 → 697.
- **`fix(test): e2e pipeline-delete teardown`** (commit 7f8e250) — `e2e.mjs` / `e2e-comprehensive.mjs` deleted the test row via the pre-v1.48 native-confirm path; v1.48.0's focus-trapped `UI.confirm()` left the modal open and its backdrop blocked later flows (CI Playwright-e2e red). Teardown is now an API DELETE. Not a product regression — tests predated the confirm gate.

### Verification

```bash
$ npm run test:ci
# 697 / 697 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.51.0
$ node tests/e2e.mjs               # 20/0
$ node tests/e2e-comprehensive.mjs # 23/23
```

---

## [1.50.0] — 2026-05-18

**WS2 #12 + #27 + #28 — help navigation accessibility.**

### 🐛 Fixes

- **`fix(a11y): help — single h1, labelled+filterable TOC, focus-on-anchor, back-to-top`** — three `#/help` findings on a 17-section / 90+-heading guide:
  - **#28** the doc markdown opened with its own `# Title`, producing a SECOND `<h1>` on a page whose header already supplies the canonical h1 (and a h1→h3 jump in some locales). Every article `<h1>` is now stripped, so there is exactly one h1 and the hierarchy starts cleanly at the `<h2>` sections.
  - **#27** the TOC `<nav>` was an unnamed landmark (two unlabeled `<nav>`s on the page); it now has `aria-label` (`help.toc`). Clicking a TOC entry no longer just scrolls the viewport — focus moves to the section heading (`tabindex=-1` + `focus()`), so keyboard/SR users land in the section.
  - **#12** no way to find anything in a long doc. A `type="search"` filter above the TOC narrows entries by heading text live; a floating, `aria-label`led **Back to top** button appears after scrolling, returns to top and moves focus back to the page `<h1>`. Its scroll listener is removed on `hashchange` away from `#/help` (no leak).

### 🌐 i18n

- 2 new keys × 8 locales — `help.tocFilter`, `help.backToTop`. `i18n-coverage` gate green.

### 🧪 Tests

- **`test: tests/help-nav-a11y.test.mjs`** — 6 cases (h1 strip, labelled nav, focus-on-anchor, filter narrows, back-to-top + listener cleanup, 2 i18n keys ×8). 685 → 691. Playwright-verified: 1 h1, TOC `aria-label`, filter narrows 17→1 on "scan", 0 console errors.

### Verification

```bash
$ npm run test:ci
# 691 / 691 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.50.0
```

---

## [1.49.0] — 2026-05-18

**WS2 #10 + #11 + #25 + #26 — tracker table accessibility & sort.**

### 🐛 Fixes

- **`fix(a11y): tracker headers, sortable table, localized fix labels, empty state`** — four `#/tracker` findings:
  - **#10** the action column header was an empty string and the per-row Report button had no context. Every `<th>` now has `scope="col"`; the action header is `t('track.col.actions')`; `Score`/`PDF` headers are i18n-keyed (were hardcoded English); the Report button gains an `aria-label` (`<report> — <company>`).
  - **#11** a job tracker with no way to sort. Date / Score / Status headers are now keyboard-operable sort buttons inside the `<th>` with `aria-sort` (`none`/`ascending`/`descending`); a `sorted()` comparator (numeric for score, locale-compare for date/status) runs before pagination; clicking toggles direction and resets the pager.
  - **#25** `track.normalize/dedup/merge` were identical English in all 8 locales despite being the highest-stakes destructive controls — now properly localized, plus a `title` tooltip (`Rewrites data/applications.md in place`).
  - **#26** a zero-row first run showed the same "no match" message as an over-filtered list. `rows.length === 0` now renders a distinct empty state (title + body + "Open pipeline" CTA); the filter-excluded-everything case keeps `track.noMatch`.

### 🌐 i18n

- 7 new keys × 8 locales (`track.col.score/pdf/actions`, `track.fixHint`, `track.emptyTitle/Body/Cta`) + 3 re-localized (`track.normalize/dedup/merge`). `i18n-coverage` gate green.

### 🧪 Tests

- **`test: tests/tracker-a11y-sort.test.mjs`** — 6 cases (scope + i18n headers, Report aria-label, sortable th/aria-sort/comparator, localized destructive labels + title, distinct empty state, 7 i18n keys ×8). 677 → 683. Playwright-verified: 9 th all scope=col, 3 sortable, action header localized, aria-sort none→ascending on click, 0 console errors.

### Verification

```bash
$ npm run test:ci
# 683 / 683 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.49.0
```

---

## [1.48.0] — 2026-05-18

**WS2 #8 + #22 — pipeline: focus-trapped confirm + preview a11y.**

### 🐛 Fixes

- **`fix(a11y): pipeline UI.confirm() + live preview region`** —
  - **#8** all three `#/pipeline` actions used native `confirm()` (auto-dismissed in embeds, not focus-trapped): the preview-pane Delete, the per-row `✕` delete, and "Evaluate first". All now route through the focus-trapped `UI.confirm()` (v1.44.0 infra) — the two deletes `danger:true` (Cancel-default), "Evaluate first" `danger:false`.
  - **#22** `previewPane` had no live role and a fetch failure was stuffed into `previewBody` so it rendered as a misleading `<pre>` "preview". It's now `role="region" aria-live="polite"` with an `aria-label`; failures set a separate `previewError` and render a distinct `role="alert"` block. `previewError` is cleared on (re)select and when the active row is deleted.
- No native `confirm()` remains in `pipeline.js`.

### 🌐 i18n

- 4 new keys × 8 locales — `pipe.confirmDelTitle`, `pipe.previewError`, `pipe.evaluateAllTitle`, `pipe.previewRegion`. `i18n-coverage` gate green.

### 🧪 Tests

- **`test: tests/pipeline-confirm-preview.test.mjs`** — 5 cases (no native confirm, ≥3 UI.confirm with correct danger flags, labelled live region, distinct alert + state-clear, 4 i18n keys ×8). 672 → 677. Playwright-verified: preview role=region/aria-live, row-delete opens a focus-trapped modal (focus on Cancel), 0 console errors.

### Verification

```bash
$ npm run test:ci
# 677 / 677 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.48.0
```

---

## [1.47.0] — 2026-05-18

**WS2 #7 + #30 + #31 + #16 — unbound-label accessibility sweep.**

### 🐛 Fixes

- **`fix(a11y): bind every swept form control to an accessible name`** — four UX-audit findings where inputs had no programmatic label (WCAG 1.3.1 / 3.3.2 / 4.1.2):
  - **#7** `scan.js` — the `dry-run` checkbox and `company-select` dropdown had labels with no `for`; added `htmlFor` (matching the existing `id`s).
  - **#30** `deep.js` — `company` / `role` inputs had unbound labels; added `id` + `htmlFor` (`deep-company`, `deep-role`).
  - **#31** `apply.js` — `url` / `jd` had unbound labels; added `id` + `htmlFor` (`apply-url`, `apply-jd`).
  - **#16** `cv.js` — the primary markdown `<textarea>` had no accessible name; bound it via `aria-labelledby` to the visible "Markdown" `<h3>` (`id="cv-md-heading"`) — SR name == on-screen heading, no new i18n key.
- Uses the explicit `label[for]`↔`control[id]` pattern already standard in `batch.js` / `mode-page.js`. No new i18n keys; zero behaviour change.

### 🧪 Tests

- **`test: tests/unbound-label-sweep.test.mjs`** — 5 cases incl. a binding-integrity check that every new `htmlFor`/`aria-labelledby` has a matching `id` in-file. 667 → 672. Playwright-verified: on #/scan, #/deep, #/apply every `label[for]` resolves to a control; #/cv `aria-labelledby` resolves to the heading.

### Verification

```bash
$ npm run test:ci
# 672 / 672 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.47.0
# Playwright: scan/deep/apply 2 bound label[for] each (all resolve) · cv aria-labelledby resolves · 0 errors
```

---

## [1.46.0] — 2026-05-18

**WS2 #5 + #6 + #21 + #24 — scan SSE accessibility.**

### 🐛 Fixes

- **`fix(a11y): scan SSE — live-log region, Stop, run-state, error banner`** — four UX-audit findings on `#/scan`:
  - **#5** the streaming console (`<pre id="scan-console">`) was a bare element; screen readers got no announcement of scanned lines. Now `role="log" aria-live="polite" aria-relevant="additions"` + an `aria-label` + `tabindex="0"` (keyboard-scrollable). A separate visually-hidden `role="status" aria-live="assertive"` region announces terminal events (complete / failed / stopped).
  - **#6** an in-flight `EventSource` scan had no abort path. The handle is now captured (`activeES`) and a **Stop** button closes it (`es.close()`), cancels the result poll, and resets state. Stop is shown only while a scan runs.
  - **#21** the Scan button stayed enabled with no busy cue during a multi-minute crawl. `setScanRunning()` now disables it + sets `aria-busy` and toggles the Stop button across both stream paths (single-phase `streamTo` and multi-phase `runScanAll` — the latter only ends the run on the terminal `done`, `final !== false`).
  - **#24** an SSE failure was a 3.5 s toast only. A persistent `role="alert"` banner now shows the error with a **Retry scan** action (re-invokes the last run fn); cleared on the next run.
- All side-effecting closures keep the existing `__cancelActiveScanPoll()` hashchange cleanup.

### 🌐 i18n

- 8 new keys × 8 locales — `scan.consoleLabel/stop/stopped/statusDone/statusFailed/statusStopped/errBannerTitle/errRetry`. `i18n-coverage` gate green.

### 🧪 Tests

- **`test: tests/scan-sse-a11y.test.mjs`** — 7 cases (log-region roles, assertive status, Stop closes EventSource on both paths, run-state aria-busy, persistent alert + Retry, terminal-done gating, 8 i18n keys ×8). 660 → 667.

### Verification

```bash
$ npm run test:ci
# 667 / 667 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.46.0
# Playwright #/scan: console role=log aria-live=polite tabindex=0 · status role=status · error role=alert(hidden) · Stop hidden · 0 errors
```

---

## [1.45.0] — 2026-05-18

**WS2 #3 — config tabs: full WAI-ARIA Tabs pattern.**

### 🐛 Fixes

- **`fix(a11y): config.js tabs implement role=tablist/tab/tabpanel`** — the three #/config tabs (API keys / Profile / Modes) were plain `<button class="tab-btn">` with click-only activation: no `role`, no `aria-selected`, no keyboard model (UX-audit HIGH #3, WCAG 4.1.2 / 2.1.1). Now: a `role="tablist"` container with an `aria-label`; each tab `role="tab"` + `id` + `aria-controls` + `aria-selected` (synced in `activate()`) + roving `tabindex` (0 active / -1 rest); the panel `role="tabpanel"` + `tabindex="0"` + `aria-labelledby` tracking the active tab. Full keyboard nav: ←/→/↑/↓ (wrapping) + Home/End move focus AND activate. The legacy `.tab-btn.is-active` CSS hook is preserved. Verified live: ArrowRight API→Profile syncs aria-selected + panel labelledby; End→Modes; 0 console errors.

### 🌐 i18n

- 1 new key × 8 locales — `config.tablistLabel` ("Settings sections"). `i18n-coverage` gate green.

### 🧪 Tests

- **`test: tests/config-tabs-aria.test.mjs`** — 7 cases (tablist/tab/tabpanel roles, aria-controls + roving tabindex, activate() aria-selected sync, keyboard map incl. wrap + preventDefault + focus move, legacy textContent-toggle removed, i18n key ×8). Total 653 → 660.
- **`fix(test): retarget 2 stale auto-pipeline smoke tests`** (commit 5d253ba) — the pre-v1.34 Playwright-e2e smoke tests asserted a transient modal the dashboard "Auto-pipeline" button stopped opening in v1.34.0 (→ `Router.go('/auto')`); they had been red on the separate Playwright-e2e CI job for 10 releases. Retargeted to the #/auto screen. Local smoke 16/16; CI green.

### Verification

```bash
$ npm run test:ci
# 660 / 660 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.45.0
# Playwright: #/config ArrowRight/End move + activate tabs, aria-selected synced, 0 errors
```

---

## [1.44.0] — 2026-05-18

**WS2 #4 + #9 — focus-trapped confirmation for destructive parent writes.**

### 🐛 Fixes

- **`fix(a11y/safety): UI.confirm() gate before whole-file parent overwrites`** — two UX-audit HIGHs, both data-loss: (#4) `config.js` `saveProfileRaw`/`saveModesRaw` replaced the ENTIRE parent `config/profile.yml` / `modes/_profile.md` with no confirmation; (#9) `tracker.js` Normalize/Dedup/Merge rewrote parent `data/applications.md` in place with no confirmation. Added `UI.confirm(title, message, opts)` to `public/js/api.js` — a **focus-trapped** dialog reusing the existing WAI-ARIA modal infra (focus-return, Tab-trap), returning `Promise<boolean>`. A new `_onClose` hook fires from `closeModal()` so EVERY dismissal path (Esc / backdrop / × / Cancel) resolves `false`; only the explicit confirm button resolves `true`. Focus defaults to **Cancel** (safe choice for a destructive op). NOT native `confirm()` (auto-dismissed in embeds, not focus-trapped). All three call sites are now gated before the `API.put`/`API.post`. Verified live: Normalize → focus-trapped "Переписать applications.md?" modal, focus on Cancel, Cancel dismisses with no POST, 0 console errors.

### 🌐 i18n

- 8 new keys × 8 locales — `common.confirm`, `config.rawConfirmTitle/Ok`, `config.profileRawConfirmBody`, `config.modesRawConfirmBody`, `track.fixConfirmTitle/Body/Ok`. The `{op}` placeholder in `track.fixConfirmBody` is preserved verbatim across all locales (runtime-substituted). `i18n-coverage` gate green.

### 🧪 Tests

- **`test: tests/confirm-gate.test.mjs`** — 8 cases: `UI.confirm` exported, `_onClose` resolves false on every dismissal path, Cancel-default focus, `modal()` back-compat onClose arg, all 3 destructive sites gated before their write, no native `confirm()` left, 8 i18n keys present with `{op}` intact. 644 → 652.

### Verification

```bash
$ npm run test:ci
# 652 / 652 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.44.0
# Playwright: #/tracker Normalize → focus-trapped modal, focus=Cancel, Cancel→no POST, 0 errors
```

---

## [1.43.0] — 2026-05-18

**User-requested — `career-ops-ui open` + autostart browser-raise.**

### ✨ Features

- **`feat(cli): career-ops-ui open — open AND raise the dashboard tab`** — after `setup`/`run`, bare `open`/`xdg-open` left the dashboard tab in the background when the browser was already running, so the user had to hunt for it. New `scripts/open-dashboard.mjs` builds the URL from HOST/PORT (rewriting a `0.0.0.0` bind to loopback), optionally waits for `/api/health`, opens the default browser, then **force-raises** it — macOS `osascript` activating whichever of Chrome/Brave/Edge/Safari/Arc/Firefox is running, Linux `xdg-open`+`wmctrl`, Windows `start`. Exposed as the `career-ops-ui open` verb (aliases `dash`, `focus`). `bin/start.sh` autostart now delegates to it so the tab is raised automatically; `NO_OPEN=1` disables auto-open for headless/CI starts. Verified live: `career-ops-ui open` → URL printed, browser raised, exit 0.

### 🧪 Tests

- **`test: tests/open-dashboard.test.mjs`** — 8 cases: `dashboardUrl` (defaults / PORT / `0.0.0.0`→loopback / explicit HOST), `openAndRaise` platform routing (darwin/win32/linux, no real browser), `waitForHealth` bounded-timeout against a dead port, and static guarantees that the dispatcher routes `open|dash|focus` and `start.sh` delegates + honors `NO_OPEN` (old bare-`open` path gone). 636 → 644.

### 📝 Documentation

- README ×8 + help-bundle §1 ×8 — the `open` verb added to the launch block + a note that `setup`/`run` now raises the tab automatically and `NO_OPEN=1` disables it. H2-section parity preserved (17).

### Verification

```bash
$ npm run test:ci
# 644 / 644 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.43.0
$ career-ops-ui open --no-wait    # URL printed, browser raised, exit 0
```

---

## [1.42.0] — 2026-05-18

**WS2 fix #2 — `#/portals` dead-route → config deep-link.**

### 🐛 Fixes

- **`fix(router): #/portals 404 → alias to config + Regional-sources deep-link`** — `#/portals` was an unregistered route that rendered the 404 view, even though it is a plausible bookmarked/typed URL for portal-source management (UX-audit HIGH #2). Added `portals: 'config'` to `router.js` `ALIASES` (same bookmark-stability pattern as `settings→profile`), so it now resolves to the config view with the **config** nav item active. When a Regional-sources group exists, the view (`config.js`) detects the `#/portals` hash, force-opens that `<details>` group, scrolls it into view, and moves focus to its summary (overriding the default h1 focus) so the user lands exactly on the portal-source controls. Never renders an empty regional group from the alias alone. Verified live: `#/portals` → config view, `is404:false`, active nav = config, 0 console errors.

### 🧪 Tests

- **`test(router): portals→config alias guarantee`** — `router.test.mjs` static assertion guarding the new ALIASES entry against future-refactor regression. 635 → 636.

### 📝 Documentation

- help-bundle §5 × 8 — a "Shortcut" blockquote noting `#/portals` now resolves to App settings / Regional sources instead of 404ing. H2-section parity preserved (17 each).

### Verification

```bash
$ npm test
# 636 / 636
# Playwright: #/portals → {h1:"App settings", is404:false, activeNav:"config"} · 0 console errors
```

---

## [1.41.0] — 2026-05-18

**WS2 — senior UX/usability audit + cross-cutting focus-management fix.**

A 10+ yr heuristic audit (Nielsen × WCAG 2.2 AA × project conventions) of
all 17 routes produced a 40-finding, severity-ranked queue
(`.planning/.../UX-AUDIT.md`); HIGH→MEDIUM→LOW are now shipped one fix per
release. This release lands the #1 cross-cutting HIGH.

### 🐛 Fixes

- **`fix(a11y): move focus to the new view on every route change`** — `router.js render()` replaced `#content` on each hashchange but never moved focus, so keyboard / screen-reader users stayed on the destroyed node and lost their place (WCAG 2.4.3 Focus Order / 4.1.3 Status Messages — cross-cutting, affected all 17 screens). New `focusNewView(content)` focuses the new view's first `h1`/`.page-title` (concise SR announcement + correct focus order), making the heading focusable (`tabindex=-1`) if needed and falling back to `#content`. The very first paint is skipped so it never fights the skip-link. Wired on both the success and error render paths. Verified live: after nav, `document.activeElement` is the new view's `H1.page-title`.

### 🧪 Tests

- **`test(router): focus-management static guarantees`** — 4 cases in `router.test.mjs` (helper defined, heading-target + content fallback, first-paint skip guard, ≥2 call sites). 631 → 635.

### 📝 Documentation

- `.planning/.../UX-AUDIT.md` — full 40-finding audit + prioritized fix queue + per-release ship grouping (v1.42 → v1.51). Drives the remaining WS2 iterations.

### Verification

```bash
$ npm run test:ci
# 635 / 635 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.41.0
# Playwright: #/dashboard → #/config → #/tracker · activeElement = new H1.page-title · 0 console errors
```

---

## [1.40.0] — 2026-05-18

**WS8.3 — docs-actualization sweep + `career-ops-ui help` fix + `askSecret` hardening.**

### 🐛 Fixes

- **`fix(cli): career-ops-ui help no longer leaks shell source`** — the dispatcher printed its header comment with `sed -n '2,12p'`, but line 12 (`set -euo pipefail`) is code, not a comment, so `career-ops-ui help` (and the unknown-verb usage text) ended with a stray `set -euo pipefail` line. Narrowed to `2,11p` (the comment block) in both the `help` and `*)` cases. `help` exits 0, unknown verb exits 2 — verified.
- **`fix(cli): scripts/init.mjs key entry never echoes`** — the v1.39.0 follow-up replaced the cosmetic readline-overwrite mask with a real raw-mode reader: `setRawMode(true)` + a buffered line so typed/pasted key bytes never reach the terminal at all (no scrollback / tmux / screen-share leak). A full VT escape FSM consumes every CSI/SS3/OSC/DCS/SOS/PM/APC sequence so arrow & function keys can't corrupt the secret; `stdin` is dependency-injected so the non-TTY fallback is unit-tested without poking the global. Iterated to a clean AI-review LGTM.

### 📝 Documentation

- **README ×8** — the old "one-command install" section is replaced by a prominent **"Launch & initialize in one command"** section: the curl one-liner plus the explicit `career-ops-ui` CLI chain (clone → `npm link` → `setup` → `init` → `doctor` → `run` → `help`), the provider-wizard explanation, the CI `--provider --anthropic-key --yes` form, and the `LLM_PROVIDER` note. All 8 README badges actualized from the stale v1.22–v1.24 / tests-461–474 to **v1.40.0 / tests-631** (e2e badge made non-numeric to avoid an invented count).
- **help-bundle ×8 §1** — a "One-command launch & init" blockquote callout added at the top of the Quick-start playbook (before "A. Setup") in all 8 locales. H2-section parity preserved (17 each — CI gate green).

### 🧪 Tests

- **`test(init): non-TTY askSecret fallback`** — `provider-selector.test.mjs` gains a DI-stdin case asserting `askSecret` delegates to plain `ask()` (trim-parity) off a TTY without mutating the shared global. 629 → 631.

### Verification

```bash
$ npm run test:ci
# 631 / 631 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.40.0
$ career-ops-ui help     # clean, exit 0 (no `set -euo pipefail` leak)
$ career-ops-ui doctor   # all required green, exit 0
```

---

## [1.39.0] — 2026-05-18

**WS8.2 — LLM provider selector + OpenAI/Codex key + interactive `init` wizard.**

### ✨ Features

- **`feat(config): LLM_PROVIDER selector + OPENAI_API_KEY`** — `server/lib/env-config.mjs` adds `LLM_PROVIDER` (auto|claude|gemini) + `OPENAI_API_KEY` to `KNOWN_KEYS`/`KEY_GROUPS`; `OPENAI_API_KEY` is secret-masked. New `providerOrder(env)` helper: `auto`→`[anthropic,gemini]` (legacy), `claude`→`[anthropic]`, `gemini`→`[gemini]`. All **6** provider-gate sites in `server/lib/routes/llm.mjs` (evaluate/deep/mode × Anthropic/Gemini) consult it via `_provGate()` — a forced provider with no key falls through to the manual-prompt path exactly like the pre-v1.39 no-key behaviour (zero behaviour change for `auto`/default). `#/config` API-keys tab gains an `LLM_PROVIDER` select + `OPENAI_API_KEY` input. Provider-key set matches what santifer/career-ops actually implements (Gemini = parent gemini-eval, Anthropic = web-ui SDK + Claude Code, OpenAI = Codex/OpenCode CLI side); Mistral/Qwen are model names with no parent env key — not invented.
- **`feat(cli): interactive career-ops-ui init`** — `scripts/init.mjs` is now a real wizard (was a WS8.1 stub): pick provider 1-4, enter key(s), writes parent `.env` via the validated `env-config.updateEnvFile` path (explicit user action, same as POST /api/config). Flag-driven too: `--provider --anthropic-key --gemini-key --openai-key --yes`.

### 📝 Documentation

- help-bundle §2 × 8 + `docs/sdd/CONVENTIONS.md` — provider selector + the 3 parent-implemented provider keys. (Full README ×8 + canonical-docs fold = WS8.3/WS10, the user-mandated final steps.)

### 🧪 Tests

- **`test: tests/provider-selector.test.mjs`** — 7 cases: `providerOrder` (auto/unknown/whitespace → legacy, claude/gemini forced), env-config surface (KNOWN/SECRET/LLM_PROVIDERS), `init` `parseArgs`+`buildUpdates` (clamp, non-empty-only), and a static canary that all 6 llm.mjs gate-sites use `_provGate()`. 622 → 629.

### Verification

```bash
$ npm run test:ci
# 629 / 629 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.39.0
$ career-ops-ui init --provider gemini --gemini-key … --yes   # writes parent .env
$ career-ops-ui doctor                                          # verifies
```

---

## [1.38.0] — 2026-05-17

**WS8.1 — unified CLI dispatcher + `doctor` verb.**

AutoResearchClaw-style one-command workflow. `bin/career-ops-ui.sh` dispatches `setup` / `run` / `doctor` / `init` / `help`; `package.json` `bin.career-ops-ui` points at it.

### ✨ Features

- **`feat(cli): bin/career-ops-ui.sh dispatcher`** — `setup` → `bin/setup.sh` (existing one-command bootstrap), `run` → `bin/start.sh`, `doctor` → `scripts/doctor.mjs`, `init` → `scripts/init.mjs` (WS8.1 stub; interactive provider wizard = WS8.2), `help`. Backward-compat `career-ops-ui-start` bin alias kept.
- **`feat(cli): scripts/doctor.mjs`** — standalone health check that **reuses the exact `/api/health` engine** (spins `createApp()` in-process on an ephemeral port → renders the JSON to a colorized terminal report). Single source of truth — doctor can never drift from the Health page. **Exit 0 iff every REQUIRED check is green**, exit 1 otherwise, so `setup` / CI can gate on it. No new deps; read-only.

### 📝 Documentation

- `docs/sdd/CONVENTIONS.md` — "CLI dispatcher" section. help-bundle §1 × 8 — CLI quickstart note. (Full README ×8 quickstart block lands in WS8.3, the user-requested final verification step.)

### 🧪 Tests

- **`test(cli): tests/cli-doctor.test.mjs`** — 6 cases: `formatReport` pure logic (all-pass / required-fail / optional-only-fail / empty-tolerant), dispatcher verb-routing canary, `package.json` bin wiring. 616 → 622.

### Verification

```bash
$ npm run test:ci
# 622 / 622 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.38.0
$ node scripts/doctor.mjs   # ✓ all required checks pass · exit 0
```

---

## [1.37.0] — 2026-05-17

**WS7 — pre-commit AI review in the git workflow.**

Per user request: an AI review before every commit. Two layers — a fast deterministic floor that fails-HARD, and an advisory AI pass that fails-SOFT.

### ✨ Features

- **`feat(workflow): pre-commit AI review`**
  - [`scripts/ai-precommit-review.mjs`](scripts/ai-precommit-review.mjs) — **deterministic floor (fail-HARD):** rejects a commit that stages a `.env`/secret-bearing file, contains a high-confidence secret pattern in the added diff lines (`.env.example` placeholders exempt), leaves `.also(` in a staged view (mirrors the CI gate), or stages a `.mjs`/`.js` that fails `node --check`. **AI layer (fail-SOFT):** runs `claude -p` over the staged diff when the CLI is on PATH and `AI_REVIEW !== 'off'`; missing CLI / offline / timeout → notice, never blocks.
  - [`.githooks/pre-commit`](.githooks/pre-commit) + [`scripts/install-hooks.mjs`](scripts/install-hooks.mjs) — `npm install` wires `core.hooksPath=.githooks` via the new `prepare` script. Idempotent; no-op outside a git checkout.
  - `AI_REVIEW=off git commit …` skips only the AI layer. Never `--no-verify` (CLAUDE.md hard rule #7); CI runs the full gate regardless.

### 📝 Documentation

- `docs/sdd/CONVENTIONS.md` — new "Pre-commit AI review" section (floor vs AI layer, env switch, never-bypass rule).

### 🧪 Tests

- **`test(workflow): tests/ai-precommit-review.test.mjs`** — 6 cases over the exported pure floor functions: blocked-path detection (`.env.example` exempt), secret-pattern hits (added-lines only, placeholders ignored), `.also(` view leftover, aggregate floor, clean-diff pass. 610 → 616.

### Verification

```bash
$ npm run test:ci
# 616 / 616 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.37.0
# This very commit was gated by the new hook (live dogfood).
```

---

## [1.36.0] — 2026-05-17

**WS6.3 — #/config Modes tab: raw blob → per-section editor. WS6 complete.**

`modes/_profile.md` is a prompt-engineering doc (markdown tables + prose), not key→value settings — so section-level editing is the right granularity (not field decomposition). This finishes WS6: every settings surface is now structured.

### ✨ Features

- **`feat(config): per-section _profile.md editor`**
  - [`server/lib/routes/content.mjs`](server/lib/routes/content.mjs) — byte-exact `splitProfileSections` (preamble + per-`##` `{ heading, headingLine, body }` via string slices, not line-join — round-trip is byte-identical) + `joinProfileSections`. `GET /api/modes/_profile` now also returns `{ preamble, sections }`. `PUT` accepts `{ sections: { "<heading>": "<body>" } }`: replaces only named sections, **preamble + unknown sections + ordering survive byte-for-byte** (merge-not-replace). Unknown heading → 400. Existing `stripDangerousMarkdown` sanitization retained. Legacy `{ markdown }` raw path unchanged.
  - [`public/js/views/config.js`](public/js/views/config.js) — one collapsible textarea per `##` section (label = `## heading`); Save sends `{ sections }`. Collapsed *Advanced: raw markdown* disclosure retained for add/remove-section + preamble edits.
  - i18n: 5 keys × 8 (`config.modesSectionHint/modesNoSections/modesRawToggle/modesRawHint/modesRawSave`).

### 📝 Documentation

- help-bundle §2 × 8 locales — Modes tab documented as per-section editor (merge-by-section, byte-exact preservation, Advanced raw disclosure).

### 🧪 Tests

- **`test(config): tests/modes-section-form.test.mjs`** — 6 cases: GET exposes preamble+sections, section-merge preserves preamble/others byte-exact, unknown-heading 400, ordering preserved, legacy raw path, sanitization. 604 → 610.

### WS6 outcome

Every settings surface is now field/section-structured: API-keys (already field-based — WS6.2 audit confirmed `KNOWN_KEYS ≡ FIELDS`, no gap), Profile scalars (WS1 v1.32.0), Profile arrays (WS6.4 v1.35.0), Modes sections (WS6.3 v1.36.0). The raw editors remain as documented escape hatches.

### Verification

```bash
$ npm run test:ci
# 610 / 610 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.36.0
```

---

## [1.35.0] — 2026-05-17

**WS6.4 — #/config Profile structured array editors + WS6.2 API-keys audit.**

WS1 (v1.32.0) gave the 14 scalar profile fields a form. WS6.4 finishes the job: the list-shaped fields get add/remove-row editors, so the raw-YAML hatch is now truly last-resort.

### ✨ Features

- **`feat(config): profile array editors`**
  - [`server/lib/routes/content.mjs`](server/lib/routes/content.mjs) — `PUT /api/profile` now also accepts an `{ arrays: { … } }` payload (alongside / combinable with `{ fields }`). Allow-listed paths: `target_roles.primary` + `narrative.superpowers` (string lists), `target_roles.archetypes` (name/level/fit), `narrative.proof_points` (name/url/hero_metric). Object rows keep ONLY allow-listed sub-keys (injected keys dropped); empty rows dropped; an emptied list deletes the leaf. **Same merge-not-replace invariant** — scalars, unknown keys, and untouched arrays survive.
  - [`public/js/views/config.js`](public/js/views/config.js) — 4 collapsible add/remove-row editors (string-list rows; object rows with per-sub-key inputs). Save sends `{ fields, arrays }` in one request.
  - i18n: 6 new keys × 8 (`config.pfPrimaryRoles/Superpowers/Archetypes/ProofPoints/AddRow/RemoveRow`).
- **`audit(config): WS6.2 API-keys tab`** — verified server `KNOWN_KEYS` (ANTHROPIC_API_KEY/MODEL, GEMINI_API_KEY/MODEL, PORT, HOST) ≡ client `FIELDS`. Every recognized `.env` key already has its own labeled input. **No gap — no code change.**

### 📝 Documentation

- help-bundle §2 × 8 locales — Profile-tab section documents the array editors (add/remove rows, drop-empty, merge-not-replace).

### 🧪 Tests

- **`test(config): tests/profile-array-editors.test.mjs`** — 7 cases: string-array merge preserves scalars+unknown-keys, object-array allow-list+drop-empty, empty→leaf-removed, proof_points round-trip, unknown-array-path 400, combined fields+arrays, arrays-only request. 597 → 604.

### Verification

```bash
$ npm run test:ci
# 604 / 604 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.35.0
```

---

## [1.34.0] — 2026-05-17

**WS5 — one-click Auto-pipeline screen (`#/auto`).**

The v1.15 dashboard auto-pipeline was a transient modal. Promoted to a dedicated, linkable page with senior-UX scaffolding.

### ✨ Features

- **`feat(auto): dedicated #/auto screen`** ([`public/js/views/auto.js`](public/js/views/auto.js)) — paste one job URL, one click runs the full chain (validate → fetch → evaluate → save report → append tracker) via the existing `POST /api/auto-pipeline` SSE contract. Senior-UX:
  - Single primary CTA; **Enter** in the URL field also runs it.
  - Live vertical **stepper** as an ordered list with `aria-current="step"` on the running row + a polite `role="status"` live-region announcing every transition (comprehensible without sight).
  - On success the result card **deep-links** to the saved report (`#/reports/:slug · N/5`) and the **tracker** — next action one click away.
  - Failed step marked red with message; CTA re-enables for fix-and-retry without reload.
  - **No API key → manual mode**: steps collapse to a copy-the-prompt card (no spend).
  - Linkable: `#/auto?url=<encoded>&go=1` opens + auto-starts.
  - Sidebar entry (✨ Auto-pipeline, after Pipeline); dashboard ✨ button now routes here (single coherent flow; the `window.AutoPipeline` modal helper stays for backward-compat).
  - i18n: 14 new keys × 8 locales.

### 📝 Documentation

- help-bundle §1 × 8 locales — new "One-click Auto-pipeline (`#/auto`) — the 21-step shortcut" subsection (full step list + a11y + manual-mode + deep-link behaviour). H2 count unchanged (17) — added as a `###` subsection, no parity-gate churn.
- README × 8 — Auto-pipeline headline feature bullet.

### 🧪 Tests

- **`test(auto): tests/auto-screen.test.mjs`** — 8 cases: route registration, POST+SSE-drain transport, a11y scaffolding (aria-live + aria-current), manual-mode card, success deep-links, index.html script+nav wiring, dashboard→#/auto routing, 14 i18n keys × 8 locales parity.
- **589 → 597** unit + acceptance (+8).

### Verification

```bash
$ npm run test:ci
# 597 / 597 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.34.0
```

---

## [1.33.0] — 2026-05-17

**WS4 — full parent career-ops 1.8.0 feature-parity audit + `location_filter`.**

Audited every user-facing parent commit v1.7.0→v1.8.0 (see `.planning/.../PARENT-PARITY.md`). One real GAP found and closed; everything else is FLOW (parent script we shell out to / inline via bundleProjectContext), CLI-ONLY (parent Go TUI), or N/A.

### ✨ Features

- **`feat(scan): portals.yml location_filter parity (parent #570)`** — parent's `scan.mjs` gained an optional `location_filter` block; web-ui runs its OWN in-process `en-scanner`/`ru-scanner` (they do NOT shell out to parent `scan.mjs`), so it did not flow through. New [`server/lib/location-filter.mjs`](server/lib/location-filter.mjs) mirrors the parent `buildLocationFilter` semantics **verbatim** (no key → pass-all; empty location → pass; `block` precedence over `allow`; `allow` empty → pass; `allow` non-empty → match ≥ 1; case-insensitive substring). Wired into both scanners' post-fetch filter step (after title/negative, before dedup/persist). Config-driven via `portals.yml` top-level `location_filter:` — no UI needed.

### 📝 Documentation

- help-bundle §5 (Portals) × 8 locales — new `location_filter` subsection with the worked allow/block example + exact semantics + the "top-level key, sibling of title_filter" note.
- `.planning/.../PARENT-PARITY.md` — full classification table of the 20+ parent commits (GAP / FLOW / CLI-ONLY / DOCS / N/A) with rationale per row.

### 🧪 Tests

- **`test(scan): tests/location-filter.test.mjs`** — 8 cases: no-filter pass-all, empty-location pass, block precedence, allow-empty pass, allow-match-required, case-insensitivity, malformed-config safe-pass, exact parity with parent's `portals.example.yml` worked example. Scanner-integration regression: 51 en/ru/scan tests green (wiring didn't regress).
- **581 → 589** unit + acceptance (+8).

### Parity outcome

career-ops v1.8.0 feature-parity **complete** as of web-ui v1.33.0. Deferred (PLAN R4 scope-guard): #341 Turkish as a 9th UI locale — parent added TR *mode templates* (template-side); a 9th web-ui locale is a dedicated future phase. Optional/LOW backlog: #602 explicit Greenhouse hostname allowlist (already covered by web-ui's `safe-fetch` + `isValidJobUrl` envelope; slug-based URL construction, not raw hostname).

### Verification

```bash
$ npm run test:ci
# 589 / 589 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.33.0
```

---

## [1.32.0] — 2026-05-17

**`#/config` Profile tab — raw-YAML blob → field-by-field form (WS1).**

Before v1.32.0 the Profile tab was a single monospace textarea where name, email, location, archetypes, compensation and every custom key lived in one undifferentiated YAML blob — the exact pain the user called out ("всё в одной куче"). It is now a structured form.

### ✨ Features

- **`feat(config): Profile field-form with merge-not-replace save`**
  - [`public/js/views/config.js`](public/js/views/config.js) — 14 modeled scalar paths grouped into 3 collapsible sections: **Candidate** (full_name/email/phone/location/linkedin/github/portfolio_url/twitter), **Narrative** (headline/exit_story), **Compensation** (target_range/currency/minimum/location_flexibility). Full-name client-side required-check before save.
  - [`server/lib/routes/content.mjs`](server/lib/routes/content.mjs) — `PUT /api/profile` gains a `{ fields: { "candidate.full_name": … } }` payload. Server **reads the existing `config/profile.yml`, sets/clears only the allow-listed leaves, re-serializes the whole object**. Arrays the form doesn't model (`target_roles.archetypes`, `narrative.proof_points`, `narrative.superpowers`) and any custom keys **survive the round-trip untouched** — the load-bearing invariant (PLAN R1). Empty field → leaf deleted (no `phone: ""` residue). Allow-list rejects unknown dotted paths; identity gate (full name required) preserved; corrupt existing YAML → 409 (refuses to clobber, routes user to raw editor).
  - **Raw-YAML escape hatch retained** as a collapsed *Advanced* `<details>` — the pre-1.32 full-file editor, unchanged (`{ yaml }` path, replaces whole file, preserves comments). For nested-array edits or comment preservation.
  - i18n: 23 new `config.pf*` / `config.profile*` keys × 8 locales.

### 📝 Documentation

- help-bundle §2 (App settings) + §3 (Profile) × 8 locales — rewritten for the 3-tab layout + field-form description + the comment-loss tradeoff + Advanced raw-YAML disclosure.

### 🧪 Tests

- **`test(config): tests/profile-field-form.test.mjs`** — 7 cases: arrays + unknown-key survival across a field-merge round-trip (the R1 gate), empty-field leaf-deletion, unknown-path rejection, no-full-name rejection, corrupt-YAML 409 guard, legacy raw `{ yaml }` path still works, value trimming.
- **574 → 581** unit + acceptance (+7).

### 🔄 Migration

No user action. First Profile-tab save after upgrade merges into the existing file; comments are dropped on a *field* save (use the Advanced raw editor to keep them). All data keys preserved.

### Verification

```bash
$ npm run test:ci
# 581 / 581 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.32.0
```

---

## [1.31.0] — 2026-05-17

**Parent career-ops 1.8.0 sync — `#/batch` exposes `--model` + `--start-from`.**

The parent project bumped 1.7.1 → 1.8.0. The user-relevant code delta: `batch-runner.sh` gained `--model NAME` (#504) and `--start-from N`. web-ui surfaces both on `#/batch`, completing flag parity (the runner's full surface — `--parallel --dry-run --retry-failed --start-from --max-retries --min-score --model` — is now reachable from the browser).

### ✨ Features

- **`feat(batch): surface --model + --start-from`**
  - [`public/js/views/batch.js`](public/js/views/batch.js) — new **Model** text input (optional; placeholder "Claude Max default") and **Start from #** numeric input (optional; min 1). Appended to the run-control row next to Max retries.
  - [`server/lib/routes/batch.mjs`](server/lib/routes/batch.mjs) — `GET /api/stream/batch?model=…&startFrom=…`. Defense-in-depth (same posture as v1.28.0 `--max-retries`): `model` accepted only if it matches `^[A-Za-z0-9.\-]{1,60}$` (rejects shell-meta even though `spawn()` is arg-array — belt-and-suspenders); `startFrom` accepted only as an integer 1..100000. Bad values silently dropped, not 400'd — the UI input is the soft contract.
  - i18n: `batch.modelLbl`, `batch.modelAria`, `batch.startFromLbl`, `batch.startFromAria` × 8 locales.

### 📝 Documentation

- help-bundle §14 (Batch evaluate) × 8 locales — `--model` + `--start-from` documented in the flag list with the `#/batch` field-name mapping.
- Parent career-ops 1.8.0 analysis recorded. Other parent deltas assessed as **no web-ui code change required**: interview-prep audience split (#489) flows through `bundleProjectContext` automatically; `dashboard/` is the parent's Go/Bubble-Tea terminal TUI (browser equivalent is our SPA — not integrated by design); `modes/tr/` Turkish templates are parent-side (a 9th web-ui UI locale is a separate deferred decision); `parentVersion` auto-reports 1.8.0 via `health.mjs` runtime read.

### 🧪 Tests

- **`test(batch): tests/batch-model-startfrom.test.mjs`** — 7 cases: model pass-through, shell-meta charset rejection (injection guard), empty-model drop, startFrom pass-through, out-of-range drop (`< 1`), non-integer drop, combined-with-other-flags coexistence.
- **567 → 574** unit + acceptance (+7).

### 🔄 Migration

No user action. The next `🌐 Batch` run with the Model / Start-from fields blank behaves exactly as before (Claude Max default, start at offer #1).

### Verification

```bash
$ npm run test:ci
# 574 / 574 · ✓ no .also( leftovers · ✓ CHANGELOG parity: all 8 locales at v1.31.0
$ curl -sN 'http://127.0.0.1:4317/api/stream/batch?model=claude-sonnet-4-6&startFrom=5' | grep -m1 '"args"'
# data: {"script":"batch-runner.sh","args":["--model","claude-sonnet-4-6","--start-from","5"]}
```

---

## [1.30.0] — 2026-05-14

**`#/scan` results paginator — replaces the v1.12.0 "first 200 of N" truncation.**

### ✨ Features

- **`feat(scan): paginate over full filtered result set`** ([`public/js/views/scan.js`](public/js/views/scan.js)) — pre-v1.30 the scan results table was hard-capped at the first 200 filtered rows with a footnote saying "Showing first 200 of N". Rows 201..N were unreachable from the UI; the user had to re-tune `title_filter.positive` in `portals.yml` to narrow the set if they wanted to inspect later rows. v1.30.0 swaps the cap for `UI.paginate` (the same helper that drives `#/tracker`, `#/reports`, `#/activity`).
  - `PAGE_SIZE = 200` preserves the prior visual density per page.
  - The FULL filtered set is sorted first (boost-to-top is stable across pages), then page-sliced — so a boosted row that lands on page 2 still appears at the top of page 2, not buried.
  - Filter input (text / source / remote / scope / chips) calls `pager.reset()` so the user lands on page 1 of the new filter result.
  - `pager.controls(visible, total)` renders `« ‹ N-M of K › »` with disabled-state buttons when on first / last page. When `total ≤ pageSize`, the controls show only the item count (clean for small datasets).
- Stale `scan.shownTop` i18n key removed from [`public/js/lib/i18n-dict.js`](public/js/lib/i18n-dict.js) (× 8 locales — no longer referenced).

### 🧪 Tests

- **`test(scan): tests/scan-paginator.test.mjs`** — 9 cases across three layers:
  - **Static-source canaries (7):** scan.js declares `PAGE_SIZE = 200`; wires `UI.paginate({ pageSize: PAGE_SIZE, onChange: …renderResults… })`; resets pager on filter input; sorts the FULL `rows.slice()` into `sortedAll` BEFORE paginating; uses `pager.slice(sortedAll)`; appends `pager.controls(sorted.length, rows.length)` after the table; no longer contains the pre-v1.30 `rows.slice(0, 200)` truncation. `i18n-dict.js` does NOT carry the stale `scan.shownTop` key. `api.js` still exports the `paginate()` helper with `.slice / .controls / .reset` surface.
  - **Pure-logic paginator table (1):** replicates clamp+slice rules and exercises 6 boundary cases — page 0 of 550 → 200 rows starting at 0; page 1 → 200 rows starting at 200; page 2 → 150 rows starting at 400; overflow page=99 → clamp to last valid page (2); filter-narrow to 5 rows while on page 2 → clamp to page 0 returning the 5 rows; empty set → page=0, empty slice.
  - **Summary computation (1):** mirrors `start = page * pageSize + 1; end = min(total, start + visible - 1)` from api.js paginate().controls(). Verifies the displayed range across all 3 pages of a 550-row dataset.
- **558 → 567** unit + acceptance (+9 new).

### 🔄 Migration

No user action needed beyond updating to v1.30.0. The next scan that produces > 200 filtered rows will surface the paginator below the results table. Smaller scans see only an "N items" hint (unchanged from `UI.paginate`'s established behaviour in tracker / reports / activity).

### Verification

```bash
$ npm run test:ci
# 567 / 567
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.30.0
```

Manual smoke after redeploy: run a scan that produces > 200 filtered rows, navigate `#/scan`, scroll past the results table, click `›` to advance to page 2 — should show rows 201..400 instantly (no server round-trip; pure client-side slicing of the already-fetched result set).

---

## [1.29.2] — 2026-05-14

**Hot-fix: `🌐 Scan` with `source=both` only ran the EN phase. RU phase was silently dropped.**

### 🚑 Critical hot-fix

User-reported symptom: clicking the unified `🌐 Scan` button (which calls `runScanAll()` → `GET /api/stream/scan?source=both`) returned only the EN ATS phase. The console showed `▶ ATS scan (Greenhouse + Ashby + Lever)` … `✓ ATS done · NEW=0` and then stopped. No RU phase output ever appeared, even with all 5 RU adapters listed in `russian_portals.sources`.

**Root cause** — [`public/js/api.js:156`](public/js/api.js#L156) closed the `EventSource` on **the first `done` event**:

```js
if (ev === 'done' || ev === 'error') es.close();
```

But [`server/lib/routes/scan.mjs::driveOne`](server/lib/routes/scan.mjs) emits `done` once per phase, and the `source=both` branch drives two phases sequentially. The client closed after the EN `done`, the server detected `res.on('close')` → `AbortController.abort()` → the RU phase started but was immediately cancelled.

**Fix — multi-phase SSE contract:**

- **Server** ([`server/lib/routes/scan.mjs`](server/lib/routes/scan.mjs)): `driveOne` now accepts a `final` param (default `true`). The `done` payload carries `final: <bool>`. The `source=both` branch passes `final: false` to the first phase, `final: true` to the second.
- **Client** ([`public/js/api.js:148-172`](public/js/api.js#L148-L172)): `stream(...)` closes the `EventSource` on `done` only when `data.final !== false`. Backward-compatible: legacy single-phase producers (`/api/stream/batch`, `/api/stream/pdf*`, etc.) don't set `final`, so the behaviour is unchanged. Close on `error` remains unconditional.

### 🧪 Tests

- **`test(scan): tests/scan-stream-multi-phase.test.mjs`** — 11 cases covering both server-emitted SSE contract and client decision logic:
  - **SSE contract (6 cases):** `source=ats` → 1 `done` (`final:true`); `source=regional` → 1 `done` (`final:true`); `source=both` → 2 `done` events with `final:false` then `final:true`; `source=both` → 2 `start` events in `en-scanner`/`ru-scanner` order; static canary that the pre-v1.29.2 unconditional close pattern is gone; static canary that the v1.29.2 `data.final !== false` guard is present.
  - **Functional proof of fix (3 cases):** `source=both` actually emits the RU-phase banner line (proves the body runs, not just empty shells); `ru-scanner` start arrives AFTER `en-scanner` done (ordering); `dryRun=1` does NOT modify `data/pipeline.md` (no phase secretly flips `writeFiles`).
  - **Pure-logic close-decision table (1 case, parametrized over 11 inputs):** mirrors the api.js branch in JS — covers `done` with `final:false / true / undefined / null / 0 / 'false'`, plus `error` with payload/null, plus `start` / `log` (never close).
  - **Bug-forensics (1 case):** simulates the pre-v1.29.2 client by cancelling the response stream after the first `done` and verifies the server's `res.on('close')` abort handler is still intact (documents the pre-fix mechanism for future readers).
- **547 → 558** unit + acceptance (+11).

### 🔄 Migration

No user action needed beyond updating to v1.29.2. The next `🌐 Scan` will run both phases.

### Verification

```bash
$ npm run test:ci
# 553 / 553
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.29.2

# Manual smoke — both phases should now emit:
$ curl -sN "http://127.0.0.1:4317/api/stream/scan?source=both&dryRun=1" \
    | grep -E '^event:|"final":'
# event: start                                        ← en-scanner
# ...
# event: done                                         ← phase 1 of 2
# data: {"code":0,"counts":{...},"errors":0,"final":false}
# event: start                                        ← ru-scanner
# ...
# event: done                                         ← phase 2 of 2 (final)
# data: {"code":0,"counts":{...},"errors":0,"final":true}
```

---

## [1.29.1] — 2026-05-14

**Detailed user-facing config guide for the 5 RU portals in help-bundle §5, all 8 locales.**

### 📝 Documentation

- **`docs(help): §5 "Configuring Russian portals — detailed setup guide"`** ([`docs/help/<locale>.md`](docs/help/)): new ### subsection within Portals & sources covers the end-user config flow:
  - 5-row source-inventory table with auth + geo restrictions per adapter.
  - Step 1 — locate `portals.yml` + bootstrap from template.
  - Step 2 — full 5-source `russian_portals:` YAML example.
  - Step 3 — tuning queries, `area`, `per_page`, `only_remote`.
  - Common pitfalls — negative-list collision (with worked example showing the fix).
  - How to disable a single source without losing data.
  - How to verify via 🌐 Scan + the per-source SSE log line shape.
- Universal YAML/code blocks shared across locales; prose translated for ES / PT-BR / KO / JA / RU / ZH-CN / ZH-TW.
- §17 ("How to add a new portal") was the developer flow shipped in v1.29.0; §5 is the user flow shipped in v1.29.1.

### 🧪 Tests

- **`test(help): tests/help-ru-config-section.test.mjs`** — 7 cases asserting every locale's §5 contains the 5-source YAML, the negative-list collision fix, the disable-one-source example, the 5 adapter labels in the verify block, the 5-row inventory table, the `HH_USER_AGENT` env-var reference, and the 17-H2 parity contract held after the edit.
- **540 → 547** unit + acceptance (+7).

### Verification

```bash
$ npm run test:ci
# 547 / 547
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.29.1

# Manual smoke (after redeploy):
$ for lc in en es pt-BR ko ja ru zh-CN zh-TW; do
    curl -fsS "http://127.0.0.1:4317/api/help/$lc" \
      | python3 -c "import sys,json; print('$lc:', 'YES' if 'trudvsem' in json.load(sys.stdin).get('markdown','') else 'NO')"
  done
# every line ends in "YES" — the §5 expansion mentions trudvsem in every locale.
```

---

## [1.29.0] — 2026-05-14

**Russian-portal scanner expanded from 2 to 5 sources. Source registry + dynamic dropdown. New help-section explaining how to add a 12th.**

### ✨ Features

- **`feat(scan): 3 new RU portal adapters — Trudvsem, GetMatch, GeekJob`** ([`server/lib/sources/`](server/lib/sources/)):
  - [`trudvsem.mjs`](server/lib/sources/trudvsem.mjs) — Russian government open-data API (`opendata.trudvsem.ru/api/v1/vacancies`). No auth, no IP gate. Normalizes the documented v1 JSON shape.
  - [`getmatch.mjs`](server/lib/sources/getmatch.mjs) — tech-focused RU HTML board. Defensive regex parser, returns `[]` on parse miss (never throws on healthy 200).
  - [`geekjob.mjs`](server/lib/sources/geekjob.mjs) — same pattern as GetMatch. Handles `article` and `div`-wrapped card variants.

- **`feat(scan): source registry — single source of truth for every adapter`** ([`server/lib/sources/registry.mjs`](server/lib/sources/registry.mjs)): one array of `{ value, label, region, configKey }` records, consumed by the scanner dispatcher, the `GET /api/scan/sources` endpoint, and the SPA's source-filter dropdown. Adding a 12th adapter = one entry here + one adapter file + one row in `RU_DISPATCH`. The pre-v1.29 three-place drift (hardcoded dropdown / hardcoded if-chain / hardcoded default) is gone.

- **`feat(api): GET /api/scan/sources`** ([`server/lib/routes/scan.mjs`](server/lib/routes/scan.mjs)): returns the canonical source list with `Cache-Control: max-age=60`. The SPA fetches this on `#/scan` mount and rebuilds the source-filter dropdown dynamically.

- **`feat(scan-ui): dynamic source-filter dropdown`** ([`public/js/views/scan.js`](public/js/views/scan.js)): on view mount, fetches `/api/scan/sources` and paints `<option>` entries. Build-time hardcoded fallback list survives if the endpoint is unreachable. The filter chip in `#/scan` now lists 11 sources (6 EN ATS + 5 RU).

- **`feat(ru-scanner): default = 5 sources, dispatcher loop generalized`** ([`server/lib/ru-scanner.mjs`](server/lib/ru-scanner.mjs)):
  - Default `russian_portals.sources` (the value used when `portals.yml` omits the array) now pulls from `registry.mjs::RU_CONFIG_KEYS` — 5 sources, not 2.
  - Pre-v1.29 the dispatcher had two hand-written `if (cfg.sources.includes('hh'))` / `if (cfg.sources.includes('habr'))` blocks. v1.29 replaces them with a single loop over `RU_DISPATCH` that's keyed by the registry. Adding a sixth source = no scanner-loop edit.

### 📝 Documentation

- **`docs(help): new §17 "How to add a new job-portal source" × 8 locales`** ([`docs/help/<locale>.md`](docs/help/)) — full English step-by-step (adapter template for API + HTML patterns, registry entry, dispatcher wiring, mocked unit test, `portals.yml` enablement); 7 locale versions with localized prose + universal code blocks + cross-link to the EN canonical text for the full pitfalls table.
- **`docs(help): §5 + §7 updated for 5 RU sources × 8 locales`** — `russian_portals.sources` example now reads `["hh", "habr", "trudvsem", "getmatch", "geekjob"]`; the Source-dropdown description names all 5.
- Help-bundle section count: **16 → 17** (CI parity contract bumped accordingly).

### 🧪 Tests

- **`test(sources): tests/sources-trudvsem.test.mjs`** — 6 cases: normalization, `удалённо`→remote inference, `onlyRemote` filter, 5xx propagation, empty results = no throw, null-record safety.
- **`test(sources): tests/sources-getmatch-geekjob.test.mjs`** — 11 cases across both HTML scrapers: fixture-driven card extraction, nav-anchor skip, empty/null safety, 5xx propagation, `onlyRemote` filter.
- **`test(scan): tests/scan-sources-endpoint.test.mjs`** — 4 cases: shape, RU-source list parity (5 entries), EN-source list parity (6 entries), `Cache-Control` header.
- **`test(ru-scanner): tests/ru-scanner.test.mjs`** — e2e dispatcher test extended to mock all 5 sources.
- **`test(canonical-docs): 17-H2 parity contract`** ([`tests/canonical-docs-coverage.test.mjs`](tests/canonical-docs-coverage.test.mjs)) and **`tests/help-ui.test.mjs`** — both lifted 16 → 17.
- **520 → 540** unit + acceptance (+ 20 new). Playwright 32/32 unchanged.

### 🔄 Migration

For the new RU adapters to fire on your stand, the parent project's `portals.yml` must list them:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]
  area: 113
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
```

If your `portals.yml` has NO `russian_portals.sources:` line at all, the v1.29.0 default kicks in and all 5 sources run automatically. If `sources:` IS present (as in the pre-v1.29 setup), it's used verbatim and you must update it manually — the web-ui never edits parent-project files.

Also note: a global `title_filter.negative: ["php"]` will neutralize every `Senior PHP` query. The scanner emits a stderr warning at scan time (collision detector from v1.13). Adjust the negative list if you see "0 hits" but expected results.

### Verification

```bash
$ npm run test:ci
# 540 / 540
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.29.0

$ curl -fsS http://127.0.0.1:4317/api/scan/sources | jq '.sources | length'
11
$ curl -fsS http://127.0.0.1:4317/api/scan/sources | jq '[.sources[] | select(.region=="ru") | .value]'
[ "geekjob", "getmatch", "habr-career", "hh.ru", "trudvsem" ]
```

---

## [1.28.1] — 2026-05-14

**Hot-fix: router 404 on hashes with `?query`. HH_USER_AGENT row pruned from health.**

### 🚑 Critical hot-fix

- **`fix(router): strip ?query before route lookup`** ([`public/js/router.js`](public/js/router.js)) — pre-v1.28.1 `Router.go('/evaluate?url=…')` produced a hash whose first `split('/')` segment was the whole `"evaluate?url=…"` literal, which never matched a registered route → `__not_found__` (404). Two reported failures had this single root cause:
  - `#/pipeline → ▶` button (`pipeline.js:145`: `Router.go('/evaluate?url=' + encodeURIComponent(url))`).
  - "App settings → Modes" deep link (`settings.js:80`: `href="#/config?tab=modes"`).
  Fix is one line: `hash.split('?')[0]` before the route-name split. The view itself continues to parse query strings via `window.location.hash.split('?')[1]` + `URLSearchParams` (see `evaluate.js`, `config.js`).

### 🧹 Cleanup

- **`fix(health): remove HH_USER_AGENT optional row`** ([`server/lib/routes/health.mjs:54`](server/lib/routes/health.mjs#L54)) — the row surfaced `"unset (hh.ru may 403 from non-RU IPs)"` on every Health page render, including for users who never scan hh.ru. The hh.ru adapter falls back to a baked-in UA when the env var is unset; the 403-from-non-RU gate is still documented in `docs/help/<locale>.md §16` (troubleshooting) and `server/lib/ru-scanner.mjs` still emits a stderr hint at scan time. Removing the row reduces dashboard noise without losing any diagnostic.

### 🧪 Tests

- **`test(router): tests/router-query-string.test.mjs`** — 3 cases: static-source canary (`router.js` must split off `?` before name lookup), explainer-comment canary (the v1.28.1 fix rationale stays in the source), and pure-logic simulation of `current()` over four representative hashes (`#/evaluate?url=…`, `#/config?tab=modes`, `#/reports/abc-123`, `#/dashboard`).
- **`test(health): tests/health-no-hh-user-agent-row.test.mjs`** — 2 cases: regression guard that `/api/health` no longer surfaces `HH_USER_AGENT` row; sanity that adjacent optional rows survived the prune.
- **515 → 520** unit + acceptance (+ 5 new). Playwright 32/32 unchanged.

### Verification

```bash
$ npm run test:ci
# 520 / 520
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.28.1

# Manual smoke (after redeploy):
$ open "http://127.0.0.1:4317/#/evaluate?url=https%3A%2F%2Fexample.com%2Fjd"
# (should render the Evaluate view with the URL prefilled — no 404)
$ open "http://127.0.0.1:4317/#/config?tab=modes"
# (should land directly on the Modes tab of App settings — no 404)
```

---

## [1.28.0] — 2026-05-14

**Docs alignment + `#/batch` `--max-retries N` UI surface.** Closes two open backlog items raised by `qa/QA-PROMPT-docs-vs-app.md`.

### ✨ Features

- **`feat(batch): surface --max-retries N control on #/batch`** ([Issue #2](https://github.com/Fighter90/career-ops-ui/issues/2)) — the canonical [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers) guide documents `--max-retries N` (default 2) but pre-v1.28 the SPA had no way to set it; users were stuck on the runner default.
  - [`public/js/views/batch.js`](public/js/views/batch.js) — new numeric input (1..10), disabled by default, enables only when "Retry failed" is checked. Clears its value when retry is unchecked so an orphaned value can't leak into the next run.
  - [`server/lib/routes/batch.mjs`](server/lib/routes/batch.mjs) — `GET /api/stream/batch?retry=1&maxRetries=N`: parses via `parseInt`, range-validates `1 ≤ N ≤ 10`, silently drops out-of-range/non-integer values (UI is the hard contract; server is defense-in-depth). No-op without `--retry-failed`.
  - i18n: 2 new keys × 8 locales (`batch.maxRetriesLbl`, `batch.maxRetriesAria`) in [`public/js/lib/i18n-dict.js`](public/js/lib/i18n-dict.js).

### 📝 Documentation

- **`docs: align AI-assistant list to career-ops.org/docs canonical`** ([Issue #1](https://github.com/Fighter90/career-ops-ui/issues/1)) — the upstream Quick Start lists Claude Code / Codex / OpenCode / Qwen CLI. Pre-v1.28 we drifted to Claude Code / Codex / Cursor / Gemini CLI / GitHub Copilot CLI, identically across all 8 locales. Resolution: aligned downstream.
  - 8 help-bundles ([`docs/help/<locale>.md`](docs/help/)) — intro paragraph + comparison-table row both now match upstream canonical. One-liner appended: *"other Claude-compatible CLIs work too via the same slash-command surface"*, localized per locale.
  - 8 READMEs ([`README*.md`](README.md)) — intro paragraph aligned with the same one-liner. The "Multi-CLI" feature bullet (about web-ui's own `CLAUDE.md`/`AGENTS.md`/`GEMINI.md` shim files, not about career-ops upstream) deliberately retains its wider list (Cursor / Aider / Gemini CLI) since those CLIs do drive our shims.

### 🧪 Tests

- **`test(canonical-docs): AI-list regression canaries`** — 2 new canaries in [`tests/canonical-docs-coverage.test.mjs`](tests/canonical-docs-coverage.test.mjs):
  - Every help-bundle + README must contain "OpenCode" and "Qwen CLI".
  - No help-bundle or README may contain the pre-v1.28 stale phrase "Cursor, Gemini CLI, GitHub Copilot CLI" (Latin or CJK delimiter).
- **`test(batch): tests/batch-max-retries.test.mjs`** — 7 cases covering: present (`maxRetries=3` → flag appended), out-of-range upper (`=11` → dropped), out-of-range lower (`=0` → dropped), non-integer (`=abc` → dropped), without `retry=1` (always dropped), no-param (runner default 2 wins), combined-with-all-other-flags.
- **506 → 515** unit + acceptance tests (+ 7 max-retries + 2 AI-list canaries). Playwright 32/32 unchanged.

### 📒 Deferred (unchanged)

- **G-005** A-G → A-F report-block realignment — still requires a coordinated commit on the parent [`santifer/career-ops`](https://github.com/santifer/career-ops) `modes/oferta.md`. Tracked in `qa/REGRESSION-v1.27.md §11`.

### Verification

```bash
$ npm run test:ci
# 515 / 515
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.28.0

# Manual smoke:
$ curl -sS http://127.0.0.1:4317/api/health | jq '.version'
"1.28.0"

# AI-list canaries — every help-bundle + README mentions OpenCode + Qwen CLI:
$ for f in docs/help/*.md README*.md; do
    grep -L 'OpenCode' "$f" && echo "  FAIL: $f"
  done
# (silent — all 16 files green)

# max-retries flag pass-through:
$ curl -sS http://127.0.0.1:4317/api/stream/batch?retry=1&maxRetries=3 | head -3
# event: error                                      (runner missing in stand)
# data: {"message":"batch/batch-runner.sh not found..."}
# (the path is exercised by tests/batch-max-retries.test.mjs against a stub runner)
```

---

## [1.27.0] — 2026-05-14

**Cosmetic + a11y polish: deduplicate sidebar `#/dashboard` entry.**

### 🩹 Cosmetic / a11y

- **`fix(sidebar): dedupe #/dashboard entry`** ([`public/index.html:25-32`](public/index.html#L25-L32)) — the brand logo block (`<a class="logo" href="#/dashboard">`) and the first nav item (`<a class="nav-item" href="#/dashboard">`) both targeted the same route. Screen readers announced "Dashboard" twice in a row when entering the sidebar, and keyboard users had a useless extra tab stop on a control with no distinct purpose. The brand block now renders as a plain `<div class="logo">`. The Dashboard nav item remains the sole link.

### 📒 Deferred (parent-coordinated)

- **G-005 / PR-B** (A-G → A-F report block realignment) — still requires a coordinated commit on the parent [`santifer/career-ops`](https://github.com/santifer/career-ops) `modes/oferta.md`. Tracked in `qa/REGRESSION-v1.27.md §Deferred`.

### 🧪 Tests

- **506 / 506** unit + **32 / 32** Playwright — unchanged. No new test required (cosmetic-only).
- CHANGELOG parity gate: ✓ all 8 locales at v1.27.0.

### Verification

```bash
$ npm run test:ci
# 506 / 506
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.27.0

# Manual smoke (after restart):
$ curl -sS http://127.0.0.1:4317/api/health | jq '.version'
"1.27.0"
$ curl -sS http://127.0.0.1:4317/ | grep -c 'href="#/dashboard"'
1   # was 2 on v1.26.1
```

---

## [1.26.1] — 2026-05-14

**Hot-fix: WCAG 2.5.5 — header `.btn` height restored to 44 px floor.**

### 🚑 Critical hot-fix

- **`fix(css): restore min-height: 44px + line-height + flex-shrink:0 on .btn`** ([`public/css/app.css:391-410`](public/css/app.css#L391-L410)) — live Playwright measurement on v1.26.0 found 5 header buttons rendering at 39-41 px (Doctor / Quick scan / Open Pipeline / 🌐 Scan now / ✨ Auto-pipeline a URL) — a WCAG 2.5.5 violation. The fix:
  - Adds `min-height: 44px` to `.btn`. A stale comment at line 427-430 still claimed this floor was in place, but the declaration itself had been lost between v1.18 and v1.26.
  - Adds `line-height: 1.2` so the in-block text doesn't compute the row taller than intended on browsers with looser default leading.
  - Adds `flex-shrink: 0` + `box-sizing: border-box` to keep parent flex rows from squashing the button under their own height constraints.
  - `.btn-sm` keeps its existing 32 px floor (small-control exception per WCAG 2.5.5 + 2.5.8 spaced-target) — `.btn-sm` follows `.btn` in source order so the override applies.

### 🧪 Tests

- **`test(wcag): tests/wcag-target-size.test.mjs`** — 4 static CSS canaries:
  - `.btn` block has `min-height: 44px`
  - `.btn` block has `flex-shrink: 0`
  - `.btn-sm` keeps `min-height: 32px`
  - `.btn-sm` defined AFTER `.btn` in source order (cascade)
- **502 → 506** unit (+4) + 32/32 Playwright unchanged.
- Live verification via headless Chromium across all 13 sidebar routes — every `.btn:not(.btn-sm)` measured ≥ 44 × 44 px after the fix.

### Verification

```bash
$ npm run test:ci
# 506 / 506
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.26.1

# Live Playwright probe (run against server on :4317):
$ for route in /dashboard /scan /pipeline /evaluate /batch /reports /tracker \
                /activity /cv /profile /config /health /help; do
    # use the parent project's playwright to measure
    cd $CAREER_OPS_ROOT && node -e "
      const { chromium } = require('playwright');
      (async () => {
        const browser = await chromium.launch({ headless: true });
        const page = await (await browser.newContext()).newPage();
        await page.goto('http://127.0.0.1:4317/#$route', { waitUntil: 'networkidle' });
        const bad = await page.\$\$eval('.btn:not(.btn-sm)', els =>
          els.filter(b => b.getBoundingClientRect().height < 44).length);
        console.log('$route:', bad === 0 ? 'PASS' : 'FAIL ' + bad);
        await browser.close();
      })();
    "
  done
# Every route → PASS
```

### Out of scope (v1.27.0)

| Item | Notes |
|---|---|
| G-005 — A-G → A-F report block realignment | Still waiting on coordinated parent commit. |
| G-003 — `README.cn.md` rename | Verified-already-closed: repo has `README.zh-CN.md`, no orphan. |
| Sidebar duplicate `#/dashboard` (brand logo + nav item) | Trivial cosmetic, zero UX impact. |

---

## [1.26.0] — 2026-05-14

**Test pyramid (unit → functional → acceptance → e2e) + coverage push to ≥ 93 % line / ≥ 83 % branch.** Adopts the 4-tier structure mandated by the v1.25 backlog. Adds 22 new tests targeting the biggest coverage gaps from v1.25's `npm run test:coverage` report; introduces the `tests/acceptance/` directory for cross-endpoint user-journey tests.

### 📐 Test pyramid documentation

- **`docs(architecture): TESTING.md describes the 4-tier pyramid`** ([`docs/architecture/TESTING.md`](docs/architecture/TESTING.md)) — single-source explanation of how the suite is structured and where new tests land:
  - **Tier 1 (unit)** — pure helpers (`security`, `parsers`, `prompts`, `file-lock`, `rate-limit`, `safe-fetch`, `env-config`). No port binding, no FS beyond stubs, no subprocess.
  - **Tier 2 (functional)** — per-endpoint contracts. `createApp()` against ephemeral port + temp `CAREER_OPS_ROOT`.
  - **Tier 3 (acceptance)** — multi-endpoint user journeys. NEW `tests/acceptance/` directory.
  - **Tier 4 (e2e)** — Playwright headless Chromium (`tests/playwright-{smoke,full-cycle}.mjs`, `tests/e2e{,-comprehensive}.mjs`).
- 100% line coverage target is explicitly scoped to **working functionality** — the `if (isMain) { … }` boot block in `server/index.mjs` and live-LLM call paths in `auto-pipeline.mjs` are documented exclusions.

### 🧪 Tier 2 — Functional gap fills

- **`test(jds): jds-list-create-get.test.mjs`** — pre-v1.26 only the DELETE path was tested. New file adds 10 tests covering:
  - `GET /api/jds` shape on empty + populated state
  - `POST /api/jds` with explicit slug, auto-generated slug, slug normalization warning
  - `POST /api/jds` empty-body / stripped-to-empty-slug 400 responses
  - `GET /api/jds/:name` body roundtrip, 404 on unknown, traversal rejection
  - **`server/lib/routes/jds.mjs` coverage: 61.64 % → 100 % line.**
- **`test(auto-pipeline): auto-pipeline-rejection-paths.test.mjs`** — 10 tests covering every URL rejection branch that doesn't need a live LLM:
  - `javascript:` / `file://` / malformed-string / empty / no-key-body
  - SSRF: loopback, RFC1918, link-local IMDS (169.254.169.254)
  - `mode: 'manual'` interaction with rejected URL — error precedes any done event
  - **`server/lib/routes/auto-pipeline.mjs` branch coverage: 50.00 % → 59.38 %.**

### 🧪 Tier 3 — Acceptance (NEW)

- **`test(acceptance): jd-evaluate-tracker-flow.test.mjs`** — first cross-endpoint user journey. Threads 7 endpoints in the order the SPA invokes them:

  1. `POST /api/jds` — save raw JD
  2. `GET /api/jds` — confirm in list
  3. `GET /api/jds/:name` — read body verbatim
  4. `POST /api/evaluate` (manual fallback) — generate prompt
  5. `POST /api/tracker` — add row
  6. `GET /api/tracker` — verify presence
  7. `GET /api/activity` — confirm audit-log entry

  Second journey: pipeline-add → preview → tracker → delete cycle.

### 🧪 Test count

- **480 → 502** unit + acceptance (+22). 32/32 Playwright unchanged.
- `npm test` now runs `tests/*.test.mjs tests/acceptance/*.test.mjs`.
- `npm run test:coverage` same. `npm run test:ci` runs all of the above plus the two CI gates from v1.24.1 (`check-no-also-leftovers`) and v1.25.0 (`check-changelog-parity`).

### Coverage snapshot

```
all files                     | 93.66 line | 83.73 branch | 92.91 func
server/lib/security.mjs       | 99.30 line
server/lib/safe-fetch.mjs     | 95.81 line
server/lib/file-lock.mjs      | 93.15 line
server/lib/rate-limit.mjs     | 100.00 line
server/lib/parsers.mjs        | 99.57 line
server/lib/routes/jds.mjs     | 100.00 line  ← was 61.64 in v1.25
server/lib/routes/tracker.mjs | 100.00 line
server/lib/routes/reports.mjs | 100.00 line
server/lib/routes/activity.mjs| 100.00 line
```

Remaining < 95 % line modules are gated by live-LLM / spawn-mock complexity:

- `auto-pipeline.mjs` (46 %) — uncovered region is the live Anthropic / Gemini evaluate path + report-save + tracker-write SSE flow. Out of scope for the 100 % target per [TESTING.md "Goal: 100% line coverage of working functionality"](docs/architecture/TESTING.md).
- `batch.mjs` (67 %) — uncovered region is `streamNodeScript` spawn of `batch-runner.sh`. Out of scope (subprocess mocking gap).
- `cv-import.mjs` (77 %) — uncovered region is pandoc / pdftotext fallback paths when the system tools are missing. Out of scope (env-dependent).

### Verification

```bash
$ npm run test:ci
# 502 / 502
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.26.0

$ npm run test:coverage 2>&1 | grep '^# all files'
# all files | 93.66 | 83.73 | 92.91

$ ls tests/acceptance/
# jd-evaluate-tracker-flow.test.mjs
```

### Breaking changes

None.

### Out of scope (v1.27+)

| Item | Notes |
|---|---|
| Live LLM-path coverage in `auto-pipeline.mjs` | Needs SDK-adapter mock + `withFileLock` stub + report-save stub. Currently 46 % line; would push toward 95 % with the mock harness. |
| Subprocess-mocked coverage for `batch.mjs::streamNodeScript` | Needs spawn-mock; would push 67 % → 90 %. |
| `cv-import.mjs` pandoc / pdftotext fallback path | Needs env-injected `which()` stub. |
| G-005 (A-F report block realignment) | Still waiting on coordinated parent commit. |

---

## [1.25.0] — 2026-05-14

**Auto-pipeline manual short-circuit + dashboard cosmetic + CHANGELOG parity backfill.** Closes G-014 (auto-pipeline ignored `mode: 'manual'`), G-012 (CHANGELOG parity drift — 6 locales were 2 releases behind), and the dashboard `✨ ✨` double-glyph cosmetic. G-003 (`README.cn.md` rename) was de-facto already closed — repo only has `README.zh-CN.md`. G-005 (A-G → A-F report block realignment) requires a coordinated parent-project commit and stays deferred.

### 🛡️ G-014 — Auto-pipeline `mode: 'manual'` short-circuit

- **`fix(auto-pipeline): G-014 — honour mode:'manual' short-circuit`** ([`server/lib/routes/auto-pipeline.mjs:158-195`](server/lib/routes/auto-pipeline.mjs#L158-L195)) — pre-v1.25 the route always called an LLM. Passing `mode: 'manual'` (mirroring `/api/evaluate` since v1.10.2) was silently ignored, the request hung 1-3 min on Anthropic. Now the handler:
  - Accepts `mode` AND `evalMode` for back-compat. Either value of `'manual'` triggers the short-circuit.
  - Emits all 5 SSE stages with `status: 'done'` / `status: 'skipped'`. No fetch. No LLM call. No $0.05 per request.
  - `done` payload carries `{ mode: 'manual', prompt: <buildEvaluationPrompt scaffold>, message }` — the SPA can render it like the existing `/api/evaluate` manual-prompt card.
- **Closes DoS-risk** on `HOST=0.0.0.0`: previously, even with `llmRateLimit` capping 10 req/60s/IP, 10 attackers × 10 reqs = $50/min in Anthropic burn. Short-circuit fires before the rate-limit decrement counts toward a real call.
- **Tests** — [`tests/auto-pipeline-manual-mode.test.mjs`](tests/auto-pipeline-manual-mode.test.mjs): 3 tests confirm (1) `mode: 'manual'` returns < 2 s with all 5 step keys, (2) even with `ANTHROPIC_API_KEY` set the short-circuit still fires (the original symptom), (3) legacy `evalMode: 'manual'` callers keep working.

### 📝 G-012 — CHANGELOG parity backfill (6 locales × 2 missing releases)

- **`docs(changelog): backfill v1.23.0, v1.24.0, v1.24.1, v1.25.0 in 6 lagging locales`** — pre-v1.25 only EN had v1.23-v1.24; RU was 1 release behind, the other 6 were 2 releases behind. v1.25 dispatches parallel translation agents (mirrors the v1.23 pattern) to land all four entries in `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md`. RU gets v1.24.0 + v1.24.1 + v1.25.0 (it already had v1.23.0 from the v1.23 cycle).
- **`feat(ci): scripts/check-changelog-parity.mjs gate`** — fails the build if any locale CHANGELOG's newest entry is older than the EN canonical. Wired into `npm run test:ci`. Pre-existing G-012 drift would have caught itself the moment it crossed the EN boundary.

### ✨ Cosmetic — dashboard double-glyph dedup

- **`fix(dashboard): dedup ✨ glyph in auto-pipeline button label`** ([`public/js/lib/i18n-dict.js:219`](public/js/lib/i18n-dict.js#L219)) — `dash.autoPipeline` carried a leading `✨` in every locale string AND `public/js/views/dashboard.js:58` prepended another `✨` in the view. Result: button rendered `✨ ✨ Auto-pipeline …`. v1.25 drops the leading glyph from every locale's DICT entry; the view's prefix is the single source. Same audit pass swept the rest of the i18n bundle — no other double-glyph patterns found.

### 🚫 Deferred to a future release

- **G-005 — Report block A-G → A-F per canonical career-ops.org/docs** — requires a coordinated commit in the parent `santifer/career-ops` project (rewrite `modes/oferta.md` to emit A=Role, B=CV-match, C=Strategy, D=Comp, E=Personalization, F=STAR — drop C-Risks/G-Legitimacy as separate blocks). v1.25.0 ships the web-ui side ready for the new schema (`reports.js` already accepts arbitrary block letters since v1.13). Tracked for the next release window when parent + child can land together.
- **G-003 — `README.cn.md` → `README.zh-CN.md` rename** — verified during v1.25 prep: repo already has `README.zh-CN.md` (no orphan `README.cn.md` anywhere under the worktree). The G-003 finding was stale.

### 🧪 Tests

- **477 → 480** unit (+3 from PR-B `auto-pipeline-manual-mode.test.mjs`).
- 32/32 Playwright unchanged.
- `npm run test:ci` now runs `npm test` + `check-no-also-leftovers.mjs` + `check-changelog-parity.mjs`.

### Verification

```bash
$ npm run test:ci
# 480 / 480
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.25.0

# G-014 — manual mode returns < 2 s even with ANTHROPIC_API_KEY set:
$ ANTHROPIC_API_KEY=sk-ant-test PORT=4317 npm start &
$ sleep 3
$ time curl -sS -X POST -H 'Content-Type: application/json' \
    -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/x","mode":"manual"}' \
    http://127.0.0.1:4317/api/auto-pipeline | head -20
# real  0m0.1xx s  (was 1-3 min)
# event: start … event: step (×5) … event: done {"mode":"manual","prompt":"…"}

# G-012 — every locale CHANGELOG carries the v1.25.0 entry:
$ grep -c '^## \[1.25.0\]' CHANGELOG*.md
# 8 files, each → 1

# Cosmetic — dashboard glyph:
$ grep "dash.autoPipeline" public/js/lib/i18n-dict.js
# No leading ✨ in any locale value (view supplies the single glyph)
```

### Breaking changes

None. `mode: 'manual'` is opt-in; legacy `evalMode: 'manual'` callers keep working unchanged.

### Out of scope (v1.26+)

| Item | Notes |
|---|---|
| G-005 — A-F report block realignment | Needs coordinated parent commit (`santifer/career-ops` rewrites `modes/oferta.md`). |
| Live execution of QA scenario 31 **visual** sub-tests | Require browser-driven agent (Claude Cowork). Covered partially by Playwright smoke. |
| `i18n-dict.js` over 400-LOC target | Translation fixture — exempt by policy. Split would add HTTP requests without a bundler. |

---

## [1.24.1] — 2026-05-14

**Hot-fix: `#/config` crash on all 8 locales (G-015).**

### 🚑 Critical hot-fix

- **`fix(config): G-015 — replace removed Element.prototype.also call in config.js`** ([`public/js/views/config.js:371`](public/js/views/config.js#L371)) — v1.22.0 N-2 dropped the `Element.prototype.also` global monkey-patch and migrated `cv.js` to a free-statement pattern, but **missed `config.js`**. The result: `#/config` crashed at first invocation on every locale with `c(...).also is not a function`. v1.24.1 applies the same migration pattern from `cv.js:188-201` — extract the tree to a `const root = c(...)`, run the activation block on its own, then `return root;`.

### 🛡️ CI gate

- **`feat(ci): scripts/check-no-also-leftovers.mjs sweep`** — walks every file under `public/js/views/` and fails the build on any `.also(` call site (commented references allowed). Wired into the new `npm run test:ci` script. Future revert of the monkey-patch removal can't re-introduce the same regression silently.

### 🧪 Tests

- **`test: tests/config-view-syntax.test.mjs`** — three guards:
  - parse `config.js` via `node:vm.Script` (catches syntax-level regressions without needing Playwright)
  - assert no `.also(` survives outside comments
  - assert the `const root = c(...)` / `return root;` migration anchors are present
- **474 → 477** unit (+3) + 32/32 Playwright unchanged.

### Verification

```bash
$ npm run test:ci
# 477 / 477
# ✓ no .also( leftovers in views/

# Browser smoke:
$ open http://127.0.0.1:4317/#/config
# → renders normally, no "is not a function" card. Every locale equivalent.
```

### Out of scope (deferred to v1.25)

- G-014, G-012, G-005, G-003 — see v1.25.0 entry below for the bundle.

---

## [1.24.0] — 2026-05-14

**Help-bundle content-depth refresh + live execution of QA scenario 31 + RU CHANGELOG end-to-end.** Closes both items the v1.23.0 "Out of scope" table deferred to v1.24: the full content-depth refresh of all 8 help bundles from the 5 canonical career-ops.org/docs URLs (was URL-coverage-only since v1.11.x), and the live execution of QA scenario 31 against a running server (was "needs browser agent + LLM credentials" — turned out 6/6 sub-tests are reachable via curl + grep, only the visual sub-tests need a browser).

### 📖 Help-bundle content-depth refresh

- **`docs(help): refresh en.md from 5 canonical career-ops.org/docs URLs`** ([`docs/help/en.md`](docs/help/en.md)) — pre-v1.24 the EN bundle was 1113 lines and listed the 5 canonical URLs in the front-matter but didn't expand on them in the body. v1.24 fetches all 5 URLs via WebFetch and deepens the matching H2 sections:
  - **About career-ops (front-matter)** — added principles (data sovereignty, AI-agnostic, human-controlled), "What career-ops is NOT" block, expanded concepts inventory from 6 to 10 rows (added Proof points, JD store, Interview-prep, Batch additions).
  - **§5 Portals** — added canonical bootstrap `cp templates/portals.example.yml portals.yml`, clarified required vs optional fields per `tracked_companies` entry.
  - **§7 Scan** — added "no AI tokens consumed" note for Option A, follow-up commands list (`apply` / `contacto` / `deep` / `tracker`).
  - **§14 Apply checklist** — split into SPA checklist mode vs Manual-vs-Playwright-assisted vs Full CLI flow (canonical 8 numbered steps from `/career-ops apply <company>` to `Submitted.` with `Evaluated → Applied` auto-transition); batch evaluate subsection now has TSV schema table + all 4 flags documented + `merge-tracker.mjs --dry-run`; Playwright Setup subsection lists install commands, MCP registration, alternative `.claude/settings.local.json`, headless-by-default note.
- **16-H2 section parity preserved** (CI test `help-ui.test.mjs::section-parity` asserts exactly 16 H2 sections across all 8 locales).
- **Each of the 5 canonical URLs appears ≥ 2 times** in the bundle (CI test `canonical-docs-coverage.test.mjs` enforces). Per-URL count after v1.24: `what-is-career-ops` × 4, `scan-job-portals` × 5, `apply-for-a-job` × 3, `batch-evaluate-offers` × 5, `set-up-playwright` × 3.
- **`docs(help): translate the v1.24 deepening to 7 non-EN locales`** — 7 parallel translation agents dispatched. Each target locale (es / pt-BR / ko-KR / ja / ru / zh-CN / zh-TW) gets a refreshed bundle that mirrors the EN structure section-for-section, preserves verbatim code blocks / URLs / file paths / button labels (📁 Upload CV / 🌐 Scan now / ▶ Evaluate / 📄 Generate PDF / 💾 Save) and English abbreviations (CSP, SSRF, TOCTOU, WCAG, ATS, JD, SSE, REST, API), and translates the deepening to publication-grade native technical style in the target language.

### 🧪 QA scenario 31 — live execution (6/6 PASS)

- **`docs(qa): append last-verified live-execution log to qa/claude-cowork-browser-test-prompt.md`** — pre-v1.24 scenario 31 was documented but never run against a live server (deferred as "needs browser agent + LLM credentials"). v1.24 ran all 6 sub-tests against `http://127.0.0.1:4317`:

  | Sub | Description | Status |
  |---|---|---|
  | 31.1 | Score thresholds in help bundles | ✅ PASS (4.5 × 3, 4.0 × 9, 3.5 × 6 mentions in `docs/help/en.md`) |
  | 31.2 | Scan workflow endpoints | ✅ PASS (`/api/stream/scan-{en,ru}` + `/api/scan-ru/config` → 404; `/api/scan/regional/config` → 200) |
  | 31.3 | `/api/apply-helper` checklist | ✅ PASS (body contains `career-ops apply` + `auto-submit` warning) |
  | 31.4 | `/api/batch` endpoint | ✅ PASS (keys `[exists, runnerExists, raw, rows, additions]`) |
  | 31.5 | Playwright availability | ✅ PASS (`/api/health` reports `Playwright (parent node_modules) ok: true, value: installed`) |
  | 31.6 | Help-bundle URL coverage (5 URLs × 8 locales) | ✅ PASS (**40 / 40 ✓**) |

  Visual-only sub-tests (require browser) flagged separately in the QA prompt — they remain runnable via Claude Cowork or `npm run test:e2e:browser`.

### 🌐 RU CHANGELOG end-to-end (M-9 follow-up)

- **`docs(translate): CHANGELOG.ru.md retry agent — full body translation`** ([`CHANGELOG.ru.md`](CHANGELOG.ru.md)) — the v1.23.0 release shipped with the RU CHANGELOG retry agent still in flight (it had crashed once with a socket error and was re-dispatched). v1.24 picks up the agent's 1542-line full translation: every entry v1.23.0 → v1.6.0 has a publication-grade Russian body, no more EN-bodied stop-gaps. Style discipline matches the v1.22.0 README quality refresh: "функциональность" / "возможности" / "поведение" replace clunky "функционал"; "через" / "с помощью" replace "при помощи"; active voice over passive; "эндпоинт", "лимит запросов", "состояние гонки", "санитайзинг" as canonical terms; English abbreviations (TOCTOU, CSP, SSRF, WCAG, ATS, JD, SSE, REST, API) preserved.

### 🧪 Tests

- **474 / 474** unit + 20 / 20 smoke E2E + 32 / 32 Playwright. Zero behavioral test deltas; every help-bundle CI assertion (16 H2 sections × 8 locales, 5 URLs × ≥ 2 mentions, content floor) still green.

### Verification

```bash
$ npm test                            # 474 / 474

# Help-bundle deepening:
$ wc -l docs/help/en.md
# ~1270 lines (was 1113 — deepened, not bloated)

$ for url in what-is-career-ops scan-job-portals apply-for-a-job \
             batch-evaluate-offers set-up-playwright; do
    echo -n "$url: "
    grep -c "$url" docs/help/en.md
  done
# what-is-career-ops: 4
# scan-job-portals: 5
# apply-for-a-job: 3
# batch-evaluate-offers: 5
# set-up-playwright: 3

# Scenario 31.6 — 40/40 URL coverage:
$ for lang in en es pt-BR ko ja ru zh-CN zh-TW; do
    echo -n "$lang: "
    for url in what-is-career-ops scan-job-portals apply-for-a-job \
               batch-evaluate-offers set-up-playwright; do
      curl -sS "http://127.0.0.1:4317/api/help/$lang" \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('markdown',''))" \
        | grep -q "$url" && echo -n "✓ " || echo -n "✗ "
    done
    echo
  done
```

### Breaking changes

None.

### Out of scope (v1.25+)

| Item | Notes |
|---|---|
| Live execution of scenario 31 **visual** sub-tests | Require browser-driven agent (Claude Cowork or `npm run test:e2e:browser`). Out of scope for curl-only execution; covered by existing Playwright smoke. |
| RU CHANGELOG body translation **of older entries** (v1.5.x and below) | The retry agent only covered v1.6.0 onwards. Pre-v1.6 entries (`v1.5.x`, etc.) — if they ever existed — remain pre-existing-content. |
| Visual regression on dashboard screenshots after future SPA changes | `scripts/capture-dashboard-screenshots.mjs` regenerates per-locale PNGs; no automated diff currently. |

---

## [1.23.0] — 2026-05-14

**i18n split + connection-banner CI fix + localized dashboard screenshots + every backlog stop-gap closed.** Ships the three items the v1.22.0 "Out of scope" table flagged for v1.23 (M-9 locale CHANGELOG bodies, N-1 `i18n.js` LOC split, help-bundle content audit) plus a hot-fix for the smoke E2E test that turned the v1.22.0 main-branch CI red.

### 🚑 CI hot-fix — connection banner recovery

- **`fix(client): reset health-poll cadence + visibilitychange eager re-check`** ([`public/js/api.js:21-91`](public/js/api.js#L21-L91)) — v1.22.0's M-6 exponential backoff was correct (3 s → 6 s → 12 s → cap 15 s, down from the original cap 60 s) but the in-flight `setTimeout` was locked to whatever delay was set previously. A server killed at t=0.1 with the first ping at t=3 would fail, double the delay to 6, and the next recovery probe wouldn't fire until t=9. The smoke E2E's "Flow 2a: connection banner appears on server down, hides on recovery" waited only 4 s and turned red on `main`.

    v1.23.0 reshapes the polling loop:

    - `_healthHandle` is tracked so `setConnectionState(lost=true)` can `clearTimeout` and re-schedule with `_HEALTH_MIN`. The first recovery probe now fires within 3 s of going down, regardless of what delay was queued.
    - `_HEALTH_MAX` lowered from 60 s to 15 s. Backgrounded tab against a dead server still recovers within one polling cycle when the user comes back; bandwidth savings stay substantial.
    - `document.addEventListener('visibilitychange')` eager-rechecks when the tab regains focus and `connectionLost === true` — Cmd-Tab back doesn't wait for the next backoff tick.

### 🧹 N-1 — i18n.js split (over the 400-LOC target)

- **`refactor(client): split DICT into i18n-dict.js (data) + i18n.js (logic)`** — pre-v1.23 `public/js/lib/i18n.js` was 639 LOC. The bulk (lines 23-586) was the `DICT` translation table — pure structured data. v1.23.0 extracts that to [`public/js/lib/i18n-dict.js`](public/js/lib/i18n-dict.js) (578 LOC, exempt-from-LOC-rule per CLAUDE.md "Exempt from these limits: generated files, migrations, test fixtures, lock files, vendored code" — translation tables qualify as fixtures), leaving [`public/js/lib/i18n.js`](public/js/lib/i18n.js) at 86 LOC of pure module logic (well under the 400-LOC target).
- **Loader contract:** `i18n-dict.js` populates `window.__I18N_DICT = { … }`, then `i18n.js` reads it inside the existing IIFE. [`public/index.html`](public/index.html) loads them in order — `i18n-dict.js` before `i18n.js` — so the IIFE sees a fully-populated DICT at construction time. Missing-dict fallback: every `t()` call returns its inline fallback or bare key, which surfaces a misconfiguration loudly without crashing the SPA.
- **Test plumbing updated:** [`tests/i18n-coverage.test.mjs`](tests/i18n-coverage.test.mjs), [`tests/help-ui.test.mjs`](tests/help-ui.test.mjs), [`tests/canonical-docs-coverage.test.mjs`](tests/canonical-docs-coverage.test.mjs) now run both files through the test VM context (or concatenate their source for the regex sweep), preserving every existing assertion.

### 🌐 M-9 — Locale CHANGELOG body translations

- **`docs(translate): 7 non-EN CHANGELOG files end-to-end`** — pre-v1.23 `CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` carried EN-bodied stop-gap notes for every entry from v1.13.0 onwards, with a footer pointing readers at the EN canonical. v1.23.0 dispatches 7 parallel translation agents — one per locale — that rewrite every body to publication-grade technical style in the target language. Stop-gap notes removed. Code blocks, file paths, URLs, commit-message-style strings (`fix(security): B-1 — …`), env vars, and link labels preserved verbatim across all locales.

### 🖼️ Localized dashboard screenshots in every README

- **`docs(readme): wire each locale README at its locale-specific PNG`** — pre-v1.23 only `README.pt-BR.md` referenced `dashboard-pt-BR.png`; the other 6 non-EN READMEs still pointed at `dashboard-en.png`. The screenshots (already captured in v1.22.0 cycle by [`scripts/capture-dashboard-screenshots.mjs`](scripts/capture-dashboard-screenshots.mjs)) were present in `images/` but unused. v1.23.0 updates every `README.{es,ja,ko-KR,ru,zh-CN,zh-TW}.md` line 14 to its own `dashboard-<locale>.png`.

### 🧪 Tests

- Same 474 / 474 unit + 32 / 32 Playwright as v1.22.0. **Smoke E2E now 20 / 20** (was 19 / 1 fail on `main` after v1.22.0 due to the banner-recovery regression; v1.23.0's reschedule fix closes it).
- Three existing tests rewired to handle the i18n split. Zero new test files; zero new assertions deleted.

### Verification

```bash
$ npm test
# 474 / 474

$ npm run test:e2e
# passed: 20    failed: 0    (was 19/1 on v1.22.0 main)

$ wc -l public/js/lib/i18n.js public/js/lib/i18n-dict.js
#       86 public/js/lib/i18n.js          ← logic, under target
#      578 public/js/lib/i18n-dict.js     ← data fixture, exempt

$ grep -h 'dashboard-' README*.md | sed -E 's/.*(dashboard-[^)]+).*/\1/' | sort -u
# dashboard-en.png    (README.md only)
# dashboard-es.png    dashboard-ja.png
# dashboard-ko-KR.png dashboard-pt-BR.png
# dashboard-ru.png    dashboard-zh-CN.png  dashboard-zh-TW.png

# CHANGELOG translation sanity: each locale file > 200 lines of native content
$ wc -l CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md | grep -v total
```

### Breaking changes

None. `public/index.html` now loads two scripts where it loaded one — anyone serving the SPA from a CDN must pick up `i18n-dict.js`; the script load order is enforced by the order of `<script src>` tags in `index.html`. The runtime fallback (empty DICT → `t()` returns the inline EN fallback) prevents hard crashes when the new file is missing.

### Out of scope (v1.24+)

| Item | Notes |
|---|---|
| Help-bundle CONTENT depth refresh from career-ops.org/docs (vs URL coverage) | The 5 canonical URLs already appear in every locale's help bundle since v1.11.x and Scenario 31.6 in the QA prompt verifies coverage. Content-body depth refresh is a v1.24+ candidate. |
| Live execution of QA scenario 31 against a running server | Requires browser agent + live LLM credentials. v1.24 candidate. |
| Per-component touch-target sweep on new mode-page hint paragraphs | v1.22.0 M-1 added `<p class="field-hint">` elements that haven't been verified against WCAG 2.5.5 min-height in all 8 locales. |

---

## [1.22.0] — 2026-05-14

**M/L/N backlog clearout + docs alignment + translation quality pass.** The entire v1.20.1-BACKLOG.md medium-and-below tier shipped in one release: nine M-items, five L-items, two nits. Plus a docs-alignment audit against the five canonical [career-ops.org/docs](https://career-ops.org/docs) guides, refreshed system prompts under `.claude/` and `.github/`, and quality-refreshed READMEs in all 7 non-English locales.

### 🛡️ Security hardening (defense-in-depth)

- **`fix(security): M-4 — entity-aware stripDangerousMarkdown`** ([`server/lib/security.mjs`](server/lib/security.mjs)) — the pre-v1.22 regex matched `<script>`, `javascript:`, `on*=` as literal substrings. `&lt;script&gt;`, `java&#115;cript:`, and `<img src="data:image/svg+xml,<svg onload=…>">` slipped through. The strip now decodes `&lt;`, `&gt;`, `&amp;`, `&quot;`, numeric (`&#NN;`) and hex (`&#xHH;`) entities **before** the strip regex runs. Validated by 11 tests in [`tests/cv-xss-bypasses.test.mjs`](tests/cv-xss-bypasses.test.mjs). Real defense is still the client-side `UI.md` escape-first pipeline; this hardens the at-rest file.

- **`fix(security): L-2 — bash --noprofile --norc on the batch runner`** ([`server/lib/routes/batch.mjs:108`](server/lib/routes/batch.mjs#L108)) — `spawn('bash', [PATHS.batchRunner, ...])` used to inherit the user's `~/.bashrc`. A hostile rc file could influence the run. Now `spawn('bash', ['--noprofile', '--norc', PATHS.batchRunner, ...])`.

### 🔒 Resilience

- **`fix(client): M-6 — exponential backoff on health ping`** ([`public/js/api.js:22-48`](public/js/api.js#L22-L48)) — the disconnected-state poller used to fire 28,800 fetches against a dead server overnight. Now 3 s → 6 s → 12 s → 24 s → 60 s; resets to 3 s on first 2xx recovery. Setup is a `setTimeout` chain (not `setInterval`) so each step picks up the new delay.

- **`fix(client): M-5 — Safari private-mode localStorage guard`** ([`public/js/lib/i18n.js:572-583`](public/js/lib/i18n.js#L572-L583)) — Safari private-mode throws `SecurityError` on every `localStorage.getItem/setItem`. The IIFE-during-load used to fail the entire i18n module, leaving the SPA rendering raw keys. Wrapped both calls in try/catch with the `detect()` browser-language fallback.

- **`fix(server): M-2 — body-size cap on outbound preview fetches (test + verify)`** — the v1.21.0 `safeGet` already streamed chunks and capped at `opts.maxBytes`. v1.22 adds an explicit regression test in [`tests/ssrf-redirect-rebind.test.mjs`](tests/ssrf-redirect-rebind.test.mjs) to lock the contract: 100 KB upstream + 4 KB cap → response ≤ 4 KB.

- **`fix(client): L-5 — clear setTimeout on hashchange in scan.js`** ([`public/js/views/scan.js:6-22, :113-120`](public/js/views/scan.js#L6-L22)) — the post-done 300 ms `refreshResults()` timer used to leak when the user navigated off `#/scan` in that window. Handle is now captured and cleared in `__cancelActiveScanPoll`.

- **`fix(client): L-4 — multi-line SSE data: joiner`** ([`public/js/lib/auto-pipeline.js:158-176`](public/js/lib/auto-pipeline.js#L158-L176)) — the SSE parser used `match()` (single-line). Per spec, an event may carry multiple `data:` lines that the consumer joins with `\n`. Server currently sends single-line JSON, so the old code worked — but was brittle to any future multi-line payload.

### ♿ Accessibility

- **`feat(a11y): M-3 — WCAG 1.4.1 redundant cues on score pills + connection banner`** ([`public/css/app.css:602-625, :812-822`](public/css/app.css#L602-L625)) — score-high / score-mid / score-low used to convey state by hue alone (red/amber/green). Users who can't perceive hue had no fallback. Each tier now gets a redundant glyph via `::before` (✓ / ◐ / ○). Connection banner gets a leading `⚠` glyph in the offline state. Render sites untouched — pure CSS hardening.

- **`feat(a11y): M-1 — inline hint paragraphs for every mode-page field`** ([`public/js/views/mode-page.js`](public/js/views/mode-page.js), [`public/js/lib/i18n.js`](public/js/lib/i18n.js)) — v1.20.0 wired `htmlFor → id` for every mode-page field but didn't carry inline hint copy; only the README walkthroughs documented field intent. v1.22.0 adds 19 hint i18n keys × 8 locales = **152 new translations** and the `field()` builder now renders a `<p id="…-hint">` with `aria-describedby` wiring per field. Screen-reader users hear the hint when the input is focused.

- **`fix(a11y): M-7 — null-guard on UI.el() htmlFor alias`** ([`public/js/api.js:194-198`](public/js/api.js#L194-L198)) — `htmlFor: null` used to render literal `for="null"`. One-liner mirror of the fallthrough branch's `v != null && v !== false` guard.

### 🧹 Quality / portability

- **`fix(server): L-1 — parseInt radix in health.mjs + bin/start.sh + bin/setup.sh`** — `parseInt(process.versions.node)` without radix triggers a lint warning and is brittle if Node ever ships hex versions. Added `10` everywhere.

- **`fix(server): L-3 — Windows-safe entrypoint check`** ([`server/index.mjs:159-163`](server/index.mjs#L159-L163)) — `import.meta.url === \`file://${process.argv[1]}\`` mishandles drive letters and backslashes on Windows. Replaced with `fileURLToPath(import.meta.url) === path.resolve(process.argv[1])`.

- **`refactor(client): N-2 — drop Element.prototype.also monkey-patch`** ([`public/js/views/cv.js:188-201`](public/js/views/cv.js#L188-L201)) — global DOM prototype pollution. Replaced with a local variable for the tree root.

- **`test(canary): M-8 — 404 regression test for retired /api/scan-ru/config`** ([`tests/scan-consolidated.test.mjs`](tests/scan-consolidated.test.mjs)) — v1.20.0 retired the alias but added no canary. Three-line addition mirroring the v1.18 retirement tests.

### 📚 Docs + system prompts

- **`docs(architecture): refresh OVERVIEW + DATA-FLOWS for v1.21+ surface`** — added `safe-fetch.mjs` (DNS-pinned GET), `file-lock.mjs` (per-path mutex), `rate-limit.mjs` (LLM throttle), and `sanitizePathName` to OVERVIEW.md. DATA-FLOWS.md gained two new sections: "Outbound URL fetches (DNS-rebind-safe)" and "LLM endpoint rate-limiting".

- **`docs(readme): security envelope section refresh`** — README.md "Security notes" now documents every helper in the v1.21+ security envelope (sanitizePathName, safeGet, withFileLock, llmRateLimit, entity-aware stripDangerousMarkdown).

- **`docs(qa): scenario 31 — career-ops.org/docs alignment`** ([`qa/claude-cowork-browser-test-prompt.md`](qa/claude-cowork-browser-test-prompt.md)) — six new sub-tests (31.1–31.6) that verify the UI matches behavior described in the five canonical career-ops.org/docs guides: score thresholds, scan workflow (one button), apply workflow (checklist, not auto-submit), batch workflow (TSV editor), Playwright setup (graceful failure), help-bundle coverage (5 URLs × 8 locales).

- **`docs(translate): README quality refresh × 7 non-EN locales`** — every non-EN README rewritten to publication-grade technical style in its native language. Common clunky calques replaced; v1.21/v1.22 security envelope mentions added; release/test badges bumped.

- **`docs(system): .claude/PROJECT-CONTEXT.md + .github/copilot-instructions.md`** — single-file orientation for agents joining a session. Compressed CLAUDE.md, names the v1.21+ helpers, lists common pitfalls.

- **`docs(bin): actualize start.sh / setup.sh / run_all.sh comments`** — "two deps" → "three deps" (express + js-yaml + multer); "298 tests" → "474+ tests"; `parseInt` radix added.

### 🧪 Tests

- **461 → 474 unit** (+13) + 32/32 Playwright unchanged.
- New test files: `cv-xss-bypasses.test.mjs` (M-4, 11 tests).
- Extended: `ssrf-redirect-rebind.test.mjs` (+1 for M-2 body cap), `scan-consolidated.test.mjs` (+1 for M-8 alias canary).
- Zero behavioral test deltas on existing suites — every fix is additive or covered by a new canary.

### Verification

```bash
npm test                          # 474 / 474
npm run test:e2e:browser          # 32 / 32

# Entity-encoded XSS strip:
node -e "import('./server/lib/security.mjs').then(({stripDangerousMarkdown}) => console.log(stripDangerousMarkdown('&lt;script&gt;alert(1)&lt;/script&gt;')))"
# → '' (no <script> survives)

# Health-ping backoff (open devtools, kill server, watch network panel):
#   3 s → 6 s → 12 s → 24 s → 60 s, then resets on first successful ping

# Score-pill glyph (open #/reports in light + dark theme):
#   .score-high shows ✓ + numeric score
#   .score-mid  shows ◐ + numeric score
#   .score-low  shows ○ + numeric score

# Mode-page hints (#/contacto, etc):
#   <input aria-describedby="mode-contacto-recipient-hint">  ← targets <p id="…">

# Retired alias:
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/scan-ru/config
# → 404
```

### Breaking changes

None. Every fix is additive or preserves existing endpoint contracts.

### Out of scope (v1.23+)

| Item | Notes |
|---|---|
| M-9 — locale CHANGELOG body translations | All `CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` v1.13+ entries are EN-bodied stop-gaps. Bulk translation candidate after release cadence slows. |
| N-1 — `public/js/lib/i18n.js` over the 400-LOC target | Splitting per locale increases HTTP cost without a bundler. Defer until the build-step decision lands. |
| Help-bundle content refresh from career-ops.org/docs | The five canonical URLs already appear in every locale's help bundle (since v1.11.x). Scenario 31.6 in the QA prompt verifies coverage. Content depth refresh is a v1.23 candidate. |

---

## [1.21.0] — 2026-05-14

**Security + concurrency + a11y polish from two independent code-review passes.** Seven findings from [`docs/sdd/specs/V1.20.1-BACKLOG.md`](docs/sdd/specs/V1.20.1-BACKLOG.md) shipped in one release: one blocker (DNS-rebind TOCTOU), six high-severity bugs (path-traversal sanitization spread, rate-limit gap on LAN deploy, concurrent-write race, i18n coverage hole, dangling aria-describedby, missing label associations). 34 new tests; baseline rose from 427 → 461 unit + 32/32 Playwright. Every fix lands behind a named regression test.

### 🛡️ Security

- **`fix(security): B-1 — close DNS-rebind TOCTOU via safe-fetch.mjs`** ([`server/lib/safe-fetch.mjs`](server/lib/safe-fetch.mjs)) — the previous pattern did one explicit `dnsLookup` for validation, then let `fetch()` do its own independent lookup. A DNS rebind attacker with TTL=0 could return a public IP on lookup 1 and `127.0.0.1` / `169.254.169.254` / a LAN address on lookup 2, bypassing `isPrivateOrLoopbackHost`. The new `safeGet` resolves ONCE, pins the TCP connection to that exact IP via node:http(s), and sets SNI/Host so cert validation still targets the original hostname. Used by `/api/pipeline/preview` and `/api/auto-pipeline`. Fail-CLOSED on lookup error (reverses the prior `try { … } catch { /* fall through */ }`). Validated by 8 new tests in [`tests/ssrf-redirect-rebind.test.mjs`](tests/ssrf-redirect-rebind.test.mjs).

- **`fix(security): H-4 — consolidate sanitizePathName across 10 routes`** ([`server/lib/security.mjs`](server/lib/security.mjs)) — the bare `replace(/[^\w\-.]/g, '')` regex was duplicated across `jds.mjs`, `content.mjs`, `reports.mjs`, `llm.mjs`, `runners.mjs` and kept `.` characters, so `..pdf`, `....md`, leading-dot names survived. Only `reports.mjs::sanitizeSlug` did it right. v1.21.0 hoists the correct version (`sanitizePathName`) into `security.mjs`, deletes 10 broken copies, and rejects empty results with 400. Validated by 12 tests in [`tests/path-traversal.test.mjs`](tests/path-traversal.test.mjs).

- **`fix(security): H-5 — rate-limit LLM endpoints on public bind`** ([`server/lib/rate-limit.mjs`](server/lib/rate-limit.mjs)) — `/api/evaluate`, `/api/deep`, `/api/mode/:slug`, `/api/auto-pipeline` previously had no per-IP throttle. Loopback users are unaffected; LAN-exposed deploys (`HOST=0.0.0.0`) get 10 req/min/IP with `Retry-After` and `X-RateLimit-*` headers on overflow. Configurable via `LLM_RATE_LIMIT="N/Ws"`. Cheap interim defense ahead of the v2.0 P-12 auth gate. Validated by 6 tests in [`tests/rate-limit.test.mjs`](tests/rate-limit.test.mjs).

### 🔒 Concurrency

- **`fix(data): H-6 — per-file mutex on applications.md / pipeline.md`** ([`server/lib/file-lock.mjs`](server/lib/file-lock.mjs)) — concurrent `POST /api/tracker` (or auto-pipeline racing a manual add) used to both read `num=42`, both write `num=43`, and silently drop the earlier row. `withFileLock(path, fn)` serializes read-modify-write per path; independent paths still run in parallel. Wired into `tracker.mjs`, `pipeline.mjs` (POST + DELETE), and `auto-pipeline.mjs` tracker step. Validated by 5 tests in [`tests/concurrent-tracker-write.test.mjs`](tests/concurrent-tracker-write.test.mjs) including a 20-concurrent-POST integration check that asserts rows 001..020 land sequentially.

### ♿ Accessibility

- **`fix(a11y): H-1 — id="batch-tsv-hint" on the batch.js hint paragraph`** ([`public/js/views/batch.js`](public/js/views/batch.js)) — v1.20.0 added `aria-describedby="batch-tsv-hint"` to the TSV textarea but never gave the hint `<p>` a matching `id`. Screen readers had nothing to voice. Fixed.

- **`fix(a11y): H-2 — htmlFor on batch-parallel / batch-min-score labels`** ([`public/js/views/batch.js`](public/js/views/batch.js)) — four v1.20.0 inputs got new ids but their labels weren't programmatically associated. WCAG 3.3.2 now satisfied.

- New static-analysis canary in [`tests/a11y-form-wires.test.mjs`](tests/a11y-form-wires.test.mjs) — walks every view file and asserts every `aria-describedby` / `htmlFor` IDREF points at a sibling `id:` declaration. Catches typo-class regressions at CI time.

### 🌐 i18n

- **`fix(i18n): H-3 — 13 keys from v1.20.0 silently fell through to EN for 7 locales`** ([`public/js/lib/i18n.js`](public/js/lib/i18n.js)) — `pipe.filter`, `pipe.count`, `pipe.preview*`, `pipe.openTab`, `pipe.evaluateAll*`, `eval.jdHint`, `batch.parallelAria`, `batch.minScoreAria`, plus `common.delete`, `config.group{Core,Runtime,Regional}`, `config.profileEmpty`, `config.viewProfile`, `scan.atsBadge`, `scan.regionalBadge` were referenced via `t('key', 'EN fallback')` but never added to DICT. Russian, Japanese, Chinese screen-reader users heard English `aria-label`s — directly defeating the WCAG 3.3.2 win v1.20.0 claimed. v1.21.0 adds all 19 keys × 8 locales (≈ 150 new translations) and extends [`tests/i18n-coverage.test.mjs`](tests/i18n-coverage.test.mjs) with a static-analysis pass that scans every `t('key', …)` call in `public/js/**/*.js` and asserts each key exists in DICT. Future drift caught at CI time.

### 🧪 Tests

- **427 → 461 unit** (+34) + 32/32 Playwright unchanged.
- New test files: `ssrf-redirect-rebind`, `path-traversal`, `concurrent-tracker-write`, `rate-limit`, `a11y-form-wires`.
- Existing `pipeline-preview.test.mjs` rewired from `globalThis.fetch` mock to the new `_setTransport` injection point in `safe-fetch.mjs` — the SSRF path no longer goes through fetch, so the old mock was bypassed silently.

### Verification

```bash
npm test                              # 461 / 461
npm run test:e2e:browser              # 32 / 32
node --test tests/ssrf-redirect-rebind.test.mjs tests/path-traversal.test.mjs \
  tests/concurrent-tracker-write.test.mjs tests/rate-limit.test.mjs \
  tests/a11y-form-wires.test.mjs      # 34 new tests, all green

# Path-traversal: every traversal-style :name returns 400 / 404
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/jds/..pdf
# → 400

# Rate-limit on public bind:
HOST=0.0.0.0 LLM_RATE_LIMIT=3/60s npm start &
for i in 1 2 3 4; do
  curl -sS -o /dev/null -w '%{http_code} ' -X POST -H 'Content-Type: application/json' \
    -d '{"jd":"…"}' http://0.0.0.0:4317/api/evaluate
done
# → 200 200 200 429

# Concurrent tracker writes: 20 parallel POSTs, 20 rows land:
node tests/concurrent-tracker-write.test.mjs
# 20 sequential rows 001..020

# Aria wires sanity:
grep -r 'aria-describedby' public/js/views/ | wc -l
# matching `id:` lookups all resolve (a11y-form-wires.test.mjs canary)
```

### Out of scope (v1.22+)

| Item | Notes |
|---|---|
| `pipeline-preview` body-size streaming cap (M-2) | `await upstream.text()` reads full body before the 8 KB slice; malicious 1 GB stream could exhaust memory. Stream-read with byte counter + abort. |
| WCAG 1.4.1 — color-only state on `.connection-banner` + score pills (M-3) | Hue alone signals state; add icon prefix (✓ / ◐ / ○) or text suffix. |
| `stripDangerousMarkdown` bypasses via HTML entities (M-4) | `&lt;script&gt;`, `java&#115;cript:`, `<img src="data:image/svg+xml,<svg onload=…>">` survive the regex. Defense-in-depth via UI.md still holds; doc + lock bypasses in a test sweep. |
| Safari private-mode `localStorage` access without try/catch (M-5) | `i18n.js:544/571` throws → SPA renders raw keys. Wrap in try/catch with `'en'` default. |
| `setInterval(checkHealth, 3000)` polls forever with no backoff (M-6) | Exponential 3s → 6s → 12s → cap 60s. |
| `htmlFor` alias missing null-guard (M-7) | One-line `if (v != null && v !== false)` defense. |
| 404 canary for retired `/api/scan-ru/config` (M-8) | Three-line test mirroring v1.18 precedent. |
| Locale CHANGELOG body translations (M-9) | Bulk translation candidate after release cadence slows. |
| Inline-hint paragraphs for every mode-page field (M-1) | ~168 i18n keys × 8 locales; held back as polish item. |
| L-1 through L-5 nits | parseInt radix, bash --noprofile, Windows-safe fileURLToPath, multi-line SSE, scan.js timer cleanup. |

---

## [1.20.0] — 2026-05-13

**Per-component a11y polish + non-EN README parity + `/api/scan-ru/config` alias retired.** Closes the four items the v1.19.0 "Out of scope" table flagged for v1.20.

### ♿ WCAG 2.5.5 / 2.5.8 — per-component touch-target audit

- **`a11y(touch-target): chip min-height 28 px + 8 px gap (2.5.8 spaced-target exception)`** — `.chip` was 24 × ~50 px (vertical was 24, height failed 2.5.5's 24 px floor for clustered controls); the spaced-target exception of 2.5.8 requires either ≥ 24 × 24 px OR 24 px of clearance. Bumped `.chip` to `min-height: 28px; padding: 6px 12px;` and the wrapping `.chip-row` to `gap: 8px;` so both conditions hold.
- **`a11y(touch-target): sidebar nav-item min-height 44 px`** — `.nav-item` padded only `10px 14px`, computed height ~36 px on most viewports. Now `padding: 12px 14px; min-height: 44px; box-sizing: border-box;`. Matches the `.btn` floor.
- **`a11y(touch-target): tab-btn min-height 44 px`** — same treatment for Sortable Headers / category tabs across Reports, Tracker, Scan results.

### ♿ WCAG 1.3.1 / 3.3.2 — `aria-describedby` on inline form hints

Every form control across the SPA now owns a stable `id`, its `<label>` targets it via `htmlFor`, and any inline hint paragraph is associated via `aria-describedby`. Five view files were rewired:

- **`a11y(forms): config.js`** — per-key `id` + hint association (`cfg-<key>` / `cfg-<key>-hint`).
- **`a11y(forms): evaluate.js`** — `eval-jd` textarea + `eval-jd-hint` paragraph documenting the 50-char minimum after sanitization.
- **`a11y(forms): batch.js`** — `batch-tsv` / `batch-tsv-hint`, plus `aria-label`s on `batch-parallel`, `batch-min-score`, `batch-dry-run`, `batch-retry`.
- **`a11y(forms): pipeline.js`** — `pipe-filter` + `pipe-new-url` / `pipe-new-url-hint`.
- **`a11y(forms): mode-page.js`** — every field across the 7 generic modes (`project`, `training`, `followup`, `batch-prompt`, `contacto`, `interview-prep`, `patterns`) gets `mode-<slug>-<name>` ids and `htmlFor` labels.

`UI.el()` learned a React-style `htmlFor` alias so view code stays declarative — it sets the underlying `for` attribute (which is JS-reserved as a property name).

### 🌍 Non-EN README parity

- **`docs(readme): translate 7 locales to 585-line parity with EN master`** — `README.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` were 306–316 lines (covered headlines but skipped the marketing-heavy walkthroughs and most of the API reference). All seven now mirror the EN structure end-to-end: About → One-command install → Why? → Quick start (3 numbered steps) → Requirements → What you get table → Scan → Architecture (full directory tree) → API reference (every route table) → Tests → Configuration → Security notes → Limitations → Contributing → 🌍 Getting Started 5-step walkthrough → License.

### 🧹 `/api/scan-ru/config` alias retired

- **`feat!(scan): remove /api/scan-ru/config legacy alias (sunset v1.20)`** — kept as a one-release alias in v1.19 for back-compat. Canonical `/api/scan/regional/config` is the only path now. Removed: route registration in `server/lib/routes/scan.mjs`, doc references in `README.md`, `docs/architecture/{OVERVIEW,SERVER,API}.md`. Tests already covered the canonical path — no test changes needed.

### 🧪 Tests

- Same suite as v1.19. **427 / 427** unit + 20/20 smoke + 23/23 comprehensive + 32/32 Playwright. All a11y wiring is additive (more `id` / `for` / `aria-describedby` attributes) — no behavioral changes, no test deltas.

### Verification

```bash
npm test                              # 427 / 427
npm run test:e2e:browser              # 32 / 32

# Touch targets — every chip / nav-item / tab-btn ≥ 28 / 44 / 44 px:
#   Chrome DevTools → Computed → height/min-height on .chip, .nav-item, .tab-btn

# Form labels — every input has a label[for=…] association:
#   document.querySelectorAll('input,textarea,select').forEach(el =>
#     console.assert(el.labels?.length || el.getAttribute('aria-label'), el))

# Alias gone:
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/scan-ru/config
# → 404

# Canonical still works:
curl -s http://127.0.0.1:4317/api/scan/regional/config | jq '.'
```

### Breaking changes

- `DELETE /api/scan-ru/config` — gone. Use `/api/scan/regional/config`. Was announced as sunset in v1.19.0's CHANGELOG and verification script.

### Out of scope (v1.21+)

| Item | Notes |
|---|---|
| Inline-hint paragraphs for every mode-page field | Today only the `<label for=…>` association is in place; visible per-field hint copy is still EN-only in the SPA. The README walkthroughs document the field intent in every locale, so this is a polish item, not a blocker. |
| Color-only state surfacing in `.connection-banner` and dashboard score pills (WCAG 1.4.1) | The banner relies on red/amber/green; needs an icon or text suffix for users who can't perceive hue. |
| Locale-specific CHANGELOG body translations | English-bodied stop-gaps remain in `CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md`. Translation happens once the v1.x release cadence slows. |

---

## [1.19.0] — 2026-05-13

**WCAG 1.4.3 contrast + scan unification (final) + HH_USER_AGENT removed from UI.** Closes the v1.18 out-of-scope contrast audit, finishes the EN/RU split elimination begun in v1.18, and removes the `HH_USER_AGENT` configuration knob from the UI per user direction (a sensible default bundled in the server already handles non-RU IPs for most users).

### ♿ WCAG 1.4.3 contrast pass

- **`a11y(contrast): introduce AA-passing *-text variants for accent tokens`** — light theme: `--rausch-text: #b80f42` (6.59:1 on white, was 3.52:1), `--kazan-text: #066507` (7.31:1, was 4.53:1), `--darjeeling-text: #7a5800` (5.73:1 on amber bg, was 4.24:1), `--babu-text: #00665e` (6.09:1, was 2.70:1). Dark theme: lightened mirrors (`#ff8aa0`, `#6ee7b7`, `#fcd34d`, `#5eead4`) hit the same 4.5:1 floor on `#161a22` paper.
- Badge classes (`.badge-ok`, `.badge-warn`, `.badge-bad`, `.badge-info`) and score pills (`.score-high`, `.score-mid`, `.score-low`) now route through the new `*-text` variants — every text-on-tinted-bg combo passes AA. The accent fill tokens (`--rausch`, `--kazan`, etc.) stay unchanged for borders and outlines (which only need 3:1 for non-text UI components).

### 🧹 Scan unification (finishes v1.18 work)

- **`docs(scan): scrub remaining EN/RU split references across READMEs + help + architecture docs`** — eight READMEs + eight help bundles + three architecture docs (API.md, SERVER.md, OVERVIEW.md, DATA-FLOWS.md) + scan.js comment now describe a single consolidated scan method. The legacy `/api/stream/scan-{en,ru}` aliases were already gone in v1.18; v1.19 catches the doc/copy that still framed scanning as a two-step EN+RU process.
- **`feat(scan): canonical /api/scan/regional/config endpoint`** — `/api/scan-ru/config` kept as a thin alias through one release for back-compat. The new path matches the source-naming convention (`?source=regional`).

### 🛠️ HH_USER_AGENT removed from UI

- **`feat!(config): drop HH_USER_AGENT field from /#/config + KNOWN_KEYS`** — power users can still set `HH_USER_AGENT` directly in `career-ops/.env` (the server reads via `process.env.HH_USER_AGENT` in `server/lib/sources/hh.mjs` with the bundled UA as fallback). The UI no longer exposes it because the default works for most users and seeing an inscrutable User-Agent field in the App Settings page was a recurring source of confusion.
- README mentions across 8 locales + help bundle mentions across 8 locales replaced with "run via a Russian IP / VPN" advice. The `scan.hhWarning` i18n key was rephrased to drop the env-var setup detail.
- `KEY_GROUPS` collapsed: no more `regional` classification (it only had HH_USER_AGENT). Tests updated; `regionalActive` payload field preserved for SPA back-compat.

### 🧪 Tests

- `tests/env-config.test.mjs` — `KNOWN_KEYS` assertion now excludes HH_USER_AGENT; new assertion that the key is intentionally absent.
- `tests/config-endpoint.test.mjs` — POST-write multi-key test uses `GEMINI_MODEL` as the second known key instead of HH_USER_AGENT.
- `tests/config-groups.test.mjs` — `groups.HH_USER_AGENT` is now expected `undefined`.
- Total: **427 / 427** unit + 20/20 smoke E2E + 23/23 comprehensive E2E + 32/32 Playwright. Same counts as v1.18.0 because every adjusted test was already counted.

### Verification

```bash
npm test                              # 427 / 427

# Contrast (Chrome DevTools or axe) on light + dark:
#   .badge-ok / .badge-warn / .badge-bad / .badge-info → AA pass (4.5:1+)
#   .score-high / .score-mid / .score-low → AA pass

# HH_USER_AGENT no longer in /api/config:
curl -s http://127.0.0.1:4317/api/config | jq '.values | keys'
# → ["ANTHROPIC_API_KEY","ANTHROPIC_MODEL","GEMINI_API_KEY","GEMINI_MODEL","HOST","PORT"]
# (no HH_USER_AGENT)

# Canonical regional config endpoint:
curl -s http://127.0.0.1:4317/api/scan/regional/config | jq '.'
# Legacy alias still alive through v1.20:
curl -s http://127.0.0.1:4317/api/scan-ru/config | jq '.'
```

### Out of scope (v1.20+)

| Item | Notes |
|---|---|
| Per-component touch-target audit (filter chips, sortable headers, sidebar nav) | v1.18 set the global floor (`.btn` 44 px, `.btn-sm` 32 px); per-component verification across the SPA remains. |
| `aria-describedby` on inline form hints (`#/config`, `#/pipeline`, `#/evaluate`, `#/batch`) | v1.17 covered `aria-label` on global search + modal close. Per-input hint association is the next polish layer. |
| Full non-EN README parity (585 lines like EN) | v1.18 brought non-EN to ~307 (53 % of EN). Marketing-heavy "Quick start" + "🌍 Getting Started" walkthroughs remain EN-only. |
| Remove `/api/scan-ru/config` legacy alias | Sunset planned for v1.20. The canonical `/api/scan/regional/config` is the migration target. |

---

## [1.18.0] — 2026-05-13

**Scan-endpoint consolidation + WCAG 2.2 AA pass + i18n long-tail finalization.** Retires the legacy `/api/stream/scan-{en,ru}` aliases (Sunset window 2026-10-01 advanced to v1.18 per user direction). Brings non-EN READMEs to ~307 lines and translates the remaining RU-bodied v1.16.0 + v1.17.0 CHANGELOG entries in 6 locales.

### 🚪 Breaking

- **`feat!(scan): retire legacy /api/stream/scan-{en,ru} aliases`** — the deprecated EN/RU split SSE endpoints are gone. Every consumer goes through the consolidated `/api/stream/scan?source=ats|regional|both` endpoint (live since v1.12.0). The legacy paths had Deprecation + Sunset (RFC 8594) headers since v1.15.0; the migration window is now closed. External integrations on the old paths get a clean **404** rather than being silently routed to the SPA catch-all.

### ♿ Accessibility (WCAG 2.2 AA pass)

- **WCAG 2.4.1 Bypass Blocks** — new **Skip to main content** link as the first focusable on every page. Visually hidden via `.skip-link` until it receives focus, snaps to the top-left corner on Tab from page load.
- **WCAG 2.4.7 Focus Visible** — global `*:focus-visible` style. Mouse-click focus rings off, keyboard-Tab focus rings on (the WAI-ARIA AP standard pattern). Modal close (×) gets a higher-contrast focus ring.
- **WCAG 2.5.5 Target Size** — minimum 44×44 px touch target on `.skip-link`. `.btn-sm` keeps a 32 px min-height (which combined with row spacing meets the 24×24 + spacing AAA exception for compact table-row controls).
- **WCAG 3.1.1 Language of Page** — `<html lang="en">` corrected from `lang="ru"` (the JS i18n bootstrap already overrode this on load, but the SSR default now matches the SPA's default locale).
- **WCAG 1.3.1 Info & Relationships** — `#content` gets `tabindex="-1"` so the skip-link target focuses cleanly. (ARIA roles + focus-trap were already added in v1.17.)

### 📚 i18n long-tail

- **`docs(i18n): v1.16.0 + v1.17.0 CHANGELOG translated in 6 locales`** — entries previously RU-bodied in `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md` are now in their native language. RU-char count per locale dropped 79 → 42 → 23 (remaining 23 are technical inline references like file paths + the multi-locale header link, which is intentional).
- **`docs(readme): expand non-EN READMEs with Why / Requirements / Features / Configuration / Contributing`** — each non-EN README grew from 240 → ~307 lines. Now covers the same non-marketing sections as the 585-line EN. Full 1:1 parity (marketing-heavy walkthrough sections) remains deferred.

### 🛠️ Misc

- **`docs(api): consolidated scan endpoint in API.md + DATA-FLOWS.md + README.md`** — the API reference table now lists only `/api/stream/scan?source=…`. README's Scan section explains the v1.18.0 retirement of the EN/RU split.
- **`fix(scan.js): drop stale comment about deprecated aliases being live`** — the SPA's runScanAll dispatcher comment now reflects the consolidated reality.

### 🧪 Tests

- `tests/scan-consolidated.test.mjs::F-018 backwards compat` rewritten — the two former "legacy endpoint still works" assertions now verify that requests to `/api/stream/scan-{en,ru}` return **404** (rather than being routed to the SPA catch-all).
- Total: **427 / 427** unit + 20/20 smoke E2E + 23/23 comprehensive E2E + 32/32 Playwright (unchanged count; +2 newly-correct legacy-removal assertions replacing the +2 legacy-still-works assertions).

### Verification

```bash
npm test                              # 427 / 427
npm run test:e2e:full                 # 23 / 23

# Legacy endpoint retirement:
curl -sI http://127.0.0.1:4317/api/stream/scan-en | head -1   # → HTTP/1.1 404
curl -sI http://127.0.0.1:4317/api/stream/scan-ru | head -1   # → HTTP/1.1 404

# Consolidated endpoint:
curl -sN 'http://127.0.0.1:4317/api/stream/scan?source=ats&dryRun=1' | head -5
# → event: start
# → data: {"script":"en-scanner","writeFiles":false,…}

# Skip link (a11y):
curl -s http://127.0.0.1:4317/ | grep -c 'class="skip-link"'  # → 1

# html lang fallback:
curl -s http://127.0.0.1:4317/ | grep -c 'html lang="en"'     # → 1
```

### Out of scope (v1.19+)

| Item | Notes |
|---|---|
| Full non-EN README parity (585 lines like EN) | v1.18 brought non-EN to ~307 (53 % of EN). Marketing-heavy "Why?" / "Quick start" walkthroughs remain EN-only. |
| Color-contrast audit (WCAG 1.4.3 AA — text 4.5:1, large text 3:1) | v1.18 covered structural a11y; per-token contrast verification across light + dark palettes remains. |
| Touch-target audit across every interactive element | v1.18 set the floor (`.btn`: 44 px, `.btn-sm`: 32 px); per-component verification (filter chips, sidebar nav, sortable headers) remains. |

---

## [1.17.0] — 2026-05-13

**Polish + a11y + CI fix release.** Closes all 9 follow-ups from the
v1.16.0 list: browser smoke verification, README badge truth,
coverage refresh, `lastWorkdayFallback` surfaced in SPA, full E2E
re-baseline, Playwright auto-pipeline scenarios, a11y audit pass,
historical CHANGELOG condensed in 6 locales, and non-EN READMEs
expanded with Architecture / API / Security / Tests sections.

### 🐛 Fixes

- **`fix(e2e): smoke + comprehensive suites re-aligned with v1.16 UX`** —
  the v1.16 Cmd+K Enter → AutoPipeline modal change made the
  e2e tests' `search.press('Enter')` open a modal that intercepted
  subsequent clicks. Tests now use `Shift+Enter` for the legacy
  quick-add path, matching the v1.16 documented split. Also
  updates the comprehensive E2E batch-mode iteration to use
  `/#/batch-prompt` (the legacy mode-prompt slug that v1.15 PR-H
  introduced). **This was the CI failure on v1.16.0 push** —
  Playwright e2e timed out 30 s waiting on backdrop-intercepted
  clicks.
- **`fix(mode-page): batch-prompt route → modes/batch.md via serverSlug`** —
  v1.15 renamed the legacy mode slug to `batch-prompt`, but the
  server's `POST /api/mode/:slug` was then looking for
  `modes/batch-prompt.md` which doesn't exist. New `serverSlug`
  field decouples the route hash from the parent's mode filename.
- **`chore: bump deprecation messages from v1.16.0 to v1.17.0`** —
  the scan-en/scan-ru deprecation copy and the batch-prompt
  deprecation banner referenced the past version.

### ✨ Features

- **`feat(scan): 🔒 Workday CAPTCHA chip in Active Companies card`** — the
  server-side `lastWorkdayFallback` export from v1.16 PR-7 is now
  consumed by the SPA. `/api/scan-results` returns the snapshot;
  `#/scan` renders a warn-tinted card above Active Companies when
  a Workday tenant fell back ("🔒 Workday tenant blocked — fallback:
  use /career-ops scan (Playwright)"). New `getLastWorkdayFallback()`
  exporter avoids ESM live-binding ambiguity. 2 new i18n keys ×
  8 locales.

### ♿ Accessibility

- **`a11y: ARIA roles + focus management pass on critical surfaces`** —
  - `index.html`: `role` attributes on `<aside>` (navigation),
    `<header>` (banner), `<section id="content">` (main),
    `<div id="modal">` (dialog with aria-modal/aria-labelledby),
    `<div id="toast">` + `#conn-banner` (status with aria-live),
    `<div class="searchbar">` (search).
  - `#sidebar-toggle` gets `aria-controls="sidebar"` +
    `aria-expanded` synced by JS on open/close.
  - `#global-search` gets a visually-hidden `<label>` plus an
    explicit `aria-label` that surfaces the Cmd+K shortcut hint.
  - Modal close (×) gets `aria-label="Close dialog"`.
  - Decorative backdrops get `aria-hidden="true"`.
  - **Focus trap on modal** — `UI.modal()` remembers the click
    owner, focuses the first non-close focusable on open, and
    cycles Tab/Shift+Tab inside the modal. `UI.closeModal()`
    restores focus to the prior owner.
  - New `.visually-hidden` utility class in `public/css/app.css`
    (WAI-ARIA AP standard pattern).

### 📚 Documentation

- **`docs(readme): badge truth across 8 READMEs`** — tests badge
  `284 / 379 / 360` → **427**; release badge `v1.9.1 / v1.13.0`
  → **v1.16.0** then → v1.17.0 via the v1.17 bump. Release link
  targets updated.
- **`docs(readme): expand 7 non-EN READMEs with reference sections`** —
  each grew 170 → ~240 lines with new Architecture / API
  reference / Security notes / Tests / A11y / Limitations /
  License sections in the native language. Not yet at full 585-line
  parity with EN but covers all key non-marketing surfaces.
- **`docs(changelog): condense pre-v1.12 entries in 6 locales`** —
  the long RU-bodied v1.11.x + v1.10.x entries that bled into the
  non-EN/non-RU CHANGELOGs are now replaced by a compact
  "Earlier releases" exec summary in each locale's native
  language. Detailed history stays in `CHANGELOG.md` (EN).

### 🛠️ Tooling

- **`coverage: refresh numbers`** — last published was 95.46 % line
  / 84.06 % branch (v1.13.0 REVIEW). v1.17 baseline: **94.14 %
  line / 82.98 % branch / 93.20 % function**. Slight drop from
  new error paths in auto-pipeline + reports-write; still well
  above the 80 % floor in CLAUDE.md.

### 🧪 Tests

- Total: **427 / 427** unit + 20/20 smoke E2E + 23/23 comprehensive
  E2E + **32 / 32** Playwright (was 28; +4 new auto-pipeline
  scenarios: button opens modal, Cmd+K paste triggers modal,
  invalid URL gates step 1, `POST /api/auto-pipeline` SSE event
  framing).
- E2E suite re-aligned with v1.16.0 UX (Shift+Enter quick-add,
  /#/batch-prompt for legacy mode).

### Verification

```bash
# Locally:
npm test                          # 427 / 427
npm run test:e2e                  # 20 / 20
npm run test:e2e:full             # 23 / 23
npm run test:e2e:browser          # 32 / 32

# Browser smoke (page-level):
curl -s http://127.0.0.1:4317/api/scan-results | jq '.workdayFallback'
# null when no Workday fallback occurred; {apiUrl, reason, at} after a 4xx.

# A11y spot-check:
node -e "
const c = require('cheerio').load(require('fs').readFileSync('public/index.html','utf8'));
['banner','navigation','main','dialog','status','search'].forEach(r =>
  console.log(r, c('[role=' + r + ']').length));
"
# Each role should appear ≥1.

# CI gate verification: dashboard-screenshots workflow boots a /tmp
# scaffold, regenerates PNGs, diffs against committed — green when
# images/dashboard-*.png are up to date with rendered SPA.
```

### Out of scope (v1.18+)

| Item | Notes |
|---|---|
| Translate v1.16.0 entry in non-EN CHANGELOGs | Currently RU-bodied (~30 lines × 6 locales = 180 lines). Was outside the user's explicit v1.11.x/v1.10.x scope. |
| Full non-EN README parity (585 lines like EN) | v1.17 brought non-EN to ~240; the marketing-heavy "Why?" / "Quick start" walkthroughs remain EN-only. |
| Parent commit for canonical A-F prompt | `santifer/career-ops::modes/oferta.md` rewrite still needed upstream (CLAUDE.md hard rule #1). |
| Full WCAG 2.2 AA audit | v1.17 covered structural ARIA + focus trap; per-component contrast/Tab-order audit pending. |

---

## [1.16.0] — 2026-05-13

**Auto-pipeline finalization + adapter polish + i18n long-tail.** Closes
all 11 follow-ups from the v1.15.0 REVIEW: server-side SSE auto-pipeline,
`POST /api/reports` primitive, Cmd+K shortcut, SmartRecruiters pagination,
Workday CAPTCHA-fallback, CI screenshot-drift gate, scan source filter UX,
historical CHANGELOG translation (v1.13.0/v1.12.0 × 6 locales), non-EN
README expansion, and a paste-ready trending-companies importer.

### ✨ Features

- **`feat(auto-pipeline): server-side SSE orchestrator`** (#1, #2, #3, #8) —
  the v1.15 client-side chained-fetch orchestrator is gone. `POST
  /api/auto-pipeline` is now a curl-able SSE endpoint that chains
  validate → fetch JD → evaluate → save report → tracker server-side
  with real-time step events. The slow Anthropic call (30–90 s) now
  emits a `running` event instead of a generic spinner. Failures emit
  `error` with `step` + `message`. The orchestrator also persists the
  report markdown to parent `reports/<slug>.md` (was lost in v1.15).
- **`feat(reports): POST /api/reports primitive`** — new writer endpoint
  in `server/lib/routes/reports.mjs`. Slug sanitization with path-
  traversal guard (strip leading dots, collapse internal `...`).
  1 MB cap (413). 409 on existing file unless `overwrite:true`.
  Atomic write through `stripDangerousMarkdown` XSS pass. Logs
  activity.reports.save. Tests: 9 cases.
- **`feat(app): Cmd+K paste URL → auto-pipeline`** — pasting a URL into
  the global search + Enter now opens the AutoPipeline modal with
  `autoStart=true`. Shift+Enter preserves the legacy "add to
  pipeline only" path. The canonical career-ops.org Quick Start §7
  "paste URL → done" UX.
- **`feat(portals): SmartRecruiters pagination`** (#4) —
  `server/lib/sources/smartrecruiters.mjs` walks pages via
  `?limit=100&offset=N` until `totalFound` is reached OR an empty
  page is returned OR the 30-page / 3000-job safety cap fires.
  Strips caller-supplied limit/offset so the cursor is server-owned.
  Big boards (Procter & Gamble, Amazon-style) no longer lose their
  tail of 100+ postings. Tests: 6 cases.
- **`feat(portals): Workday CAPTCHA-fallback graceful`** (#7) —
  `server/lib/sources/workday.mjs` no longer throws on 4xx /
  non-JSON / network errors. Returns `[]` and annotates the new
  exported `lastWorkdayFallback` snapshot. Scanner timeline
  continues with the next tenant. Caller can opt back into the
  v1.14 throw behaviour with `strict:true`. Tests: 7 cases.

### 🛠️ Tooling + CI

- **`ci(workflows): dashboard-screenshots drift gate`** (#5) — new
  `.github/workflows/dashboard-screenshots.yml`. On PRs touching
  `public/css/app.css` / `public/js/views/dashboard.js` /
  `public/js/lib/i18n.js` / `public/index.html`, the workflow
  boots the web-ui server against a /tmp scaffold, regenerates the
  8 hero PNGs via Playwright + chromium, and fails the build if
  the result drifts from what's committed. Uploads the regenerated
  PNGs as a CI artifact on failure.
- **`feat(scripts): import-trending-companies.mjs`** (#11) — verifies
  the 13 trending companies in `docs/portals-examples.md` via their
  real boards-API and emits paste-ready YAML for the user's parent
  `portals.yml::tracked_companies`. `enabled: false` is stamped on
  any candidate whose slug 404s. Live probe of all 6 ATSes
  (Greenhouse / Ashby / Lever / Workable / SmartRecruiters /
  Workday). Run via `npm run import:trending`.
- **`feat(scripts): npm run capture:dashboards`** — exposes
  `scripts/capture-dashboard-screenshots.mjs` as a top-level script
  (was only documented in `images/README.md` before).

### 🎨 UX

- **`fix(scan): consolidated source-filter dropdown`** (#6) —
  `#/scan` source dropdown rebuilt from the v1.14 adapter registry:
  6 ATSes + hh.ru + Habr Career, alphabetical, no geo-tag prefix.
  `runEnScan` / `runRuScan` now hit the consolidated
  `/api/stream/scan?source={ats,regional}` endpoint instead of the
  deprecated `/api/stream/scan-{en,ru}` aliases (Sunset headers
  stay live through v1.16).

### 📚 i18n long-tail

- **`docs(i18n): translate v1.13.0 + v1.12.0 CHANGELOG in 6 locales`**
  (#9) — entries previously RU-bodied in
  `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md` are now in their
  actual locale. Each non-EN/non-RU CHANGELOG also gets an i18n
  note explaining that pre-v1.12 entries remain RU per project
  convention (canonical text lives in `CHANGELOG.md`).
- **`docs: expand non-EN READMEs with v1.16.0 highlights section`**
  (#10) — 6 non-EN READMEs (es / pt-BR / ko-KR / ja / ru / zh-CN /
  zh-TW) get a new ~35-line section covering: auto-pipeline
  one-click flow + curl example, SmartRecruiters pagination,
  Workday fallback, scan source-filter UX, importer script, and
  CI screenshot workflow. RU README also extended.

### 🧪 Tests

- New `tests/reports-write.test.mjs` (9 cases) — happy path, slug
  sanitization (incl. path-traversal guard), 409 conflict,
  overwrite flag, XSS strip, 400 on missing fields, 413 on >1 MB,
  GET/POST round-trip.
- New `tests/auto-pipeline.test.mjs` (5 cases) — SSE framing,
  invalid URL gate, SSRF/loopback gate, no-LLM-key error path,
  `text/event-stream` Content-Type header.
- New `tests/smartrecruiters-pagination.test.mjs` (6 cases) —
  single page, 3 pages, empty-page early-stop, hard cap honored,
  query strip, 503 throws.
- New `tests/workday-fallback.test.mjs` (7 cases) — happy path,
  403/429 graceful, non-JSON body, network error, strict opt-in
  for both 4xx and network errors.
- Total: **427 / 427** unit (was 400; +27 net). 0 failures. 28/28
  Playwright + 23/23 comprehensive E2E + 20/20 smoke E2E green
  from v1.15.0 baseline.

### Out of scope (v1.17+)

| Item | Notes |
|---|---|
| Parent commit for canonical A-F prompt | Still pending upstream `santifer/career-ops::modes/oferta.md` rewrite (CLAUDE.md hard rule #1). |
| Translate pre-v1.12 CHANGELOG entries (v1.11.x, v1.10.x) | Convention preserved: RU-bodied. Backporting is ~1800 lines of translation work; deferred. |
| Full non-EN README parity (585 lines like EN) | v1.16 added ~35 lines per locale; full parity is a separate effort. |
| Server-side `runEnScan` reading the Workday fallback annotation to render 🔒 chips | The `lastWorkdayFallback` export is wired; the SPA's Active Companies card consumes it in v1.17+. |

### Verification

```bash
npm test                          # 427 / 427
npm run test:e2e:full             # 23 / 23
npm run import:trending --check-only   # probe 13 trending boards

# Auto-pipeline curl smoke:
curl -N -X POST http://127.0.0.1:4317/api/auto-pipeline \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/4567"}'

# POST /api/reports round-trip:
curl -X POST http://127.0.0.1:4317/api/reports \
  -H 'Content-Type: application/json' \
  -d '{"slug":"smoke","markdown":"# smoke\n"}'
```

---

## [1.15.0] — 2026-05-13

**Doc-conformance release.** Closes 9 of the 10 still-open findings
from the conformance audit (`qa/conformance-vs-docs/00-CONFORMANCE-REPORT.md`)
plus the localized hero images. Brings the UI in line with the
canonical career-ops.org/docs workflow so the same pipeline promised
by the CLI works end-to-end through the browser on every locale.

### ✨ Features

- **`feat(auto-pipeline): PR-C — 1-click "paste URL → report + PDF + tracker row"`** (G-007)
  Match the canonical career-ops.org promise. Until v1.15 users did 5 manual clicks across /#/pipeline → /#/evaluate → /#/cv → /#/tracker. Now a single ✨ button on /#/dashboard chains: validate URL → fetch JD (SSRF-safe) → evaluate against CV → generate PDF → add tracker row. Renders a step-by-step modal timeline with [✓]/[…]/[✗] per step. Heuristic company/role extraction from JD first lines. Score + legitimacy extracted via regex from the evaluation markdown. New file: `public/js/lib/auto-pipeline.js`. 19 new i18n keys × 8 locales.
- **`feat(modes): PR-D — modes/_profile.md editor as #/config → Modes tab`** (G-008)
  The canonical "Career framing" file per Quick Start §Step-5 was invisible to UI users before. Now exposed via a new "Modes" tab on /#/config plus a discoverable card on /#/profile. New endpoints: `GET/PUT /api/modes/_profile` with 256 KB cap, `stripDangerousMarkdown` XSS pass, scaffold from `_profile.template.md` on first read. 9 new i18n keys × 8 locales.
- **`feat(profile): PR-E — accept canonical schema; add location + headline`** (G-009)
  `/api/profile` now accepts BOTH the legacy (`candidate:{...}`) AND canonical (top-level `full_name`, `narrative.headline`, `target_roles.primary`, `compensation.target_range`) schemas. Legacy wins when both are present so existing YAMLs render identically. New `summarizeProfile()` helper returns unified shape. `/#/profile` surfaces `narrative.headline` as a new card. 2 new i18n keys × 8 locales.
- **`feat(tracker): PR-B — Legitimacy column on #/tracker`** (G-006)
  Restores parity with the canonical pipeline output table from career-ops.org/docs. Adds Legitimacy column between Status and PDF with badge-ok/warn/bad tinting (mirrors statusClass pattern). Graceful degrade — pre-v1.15 rows without a Legitimacy column show `—`. 1 new i18n key × 8 locales.
- **`fix(routing): PR-H — dedupe sidebar; route #/batch to v1.13.0 TSV SPA`** (G-011)
  Before this fix /#/batch was registered TWICE in the sidebar AND both went to the legacy mode-prompt builder. The v1.13.0 TSV SPA (8 KB, 4 endpoints) was unreachable. Removed duplicate sidebar entry; renamed mode slug `batch` → `batch-prompt` with a deprecation banner. Canonical /#/batch is now the TSV SPA.

### 📚 Documentation

- **`docs(evaluate): PR-A — realign Block A-F with canonical career-ops.org rubric`** (G-005)
  career-ops.org docs document A–F (Strategy/Personalization/STAR stories at C/E/F). We emitted A–G with shifted semantics (Risks/Verdict/Legitimacy). v1.15 updates all 8 help bundles §9 to show the canonical A–F with a "Pre-v1.15 used A–G; we render those as-is for back-compat" callout. `eval.subtitle` i18n key × 8 locales also realigned. Score + legitimacy now documented as report-header fields. ⚠ Parent commit still required: `santifer/career-ops::modes/oferta.md` needs to be rewritten upstream to emit canonical A–F.
- **`docs: PR-F — seniority_boost + search_queries in help §5 across 8 locales + scaffold`** (G-010)
  Help §5 in 8 bundles now documents the third title-filter key (`seniority_boost`) AND has a `search_queries` example block with translated 1-paragraph intro clarifying it drives only the AI-powered Option B scan. `bin/setup.sh` portals.yml scaffold seeds `seniority_boost: ["Senior", "Staff", "Lead"]` by default. H2 parity preserved: 16 × 8 locales.
- **`docs: PR-I — localized hero images per README locale`**
  Each of 8 READMEs now has a locale-specific `images/dashboard-<locale>.png` (HiDPI 1440×900) generated via `scripts/capture-dashboard-screenshots.mjs` (Playwright + chromium). Old shared `public/images/screen_vacancy_found.png` deleted. Non-EN readers see their UI labelled in their language on first landing.

### 🧹 Carryover cleanups

- **`PR-G — G-001`** `scan.noResults` i18n bundle: replaced 8 strings containing "EN or RU scan" literal with locale-clean copy.
- **`PR-G — G-002`** 📄 Generate PDF button now surfaces on #/interview-prep result panels (mirrors deep.js pattern).
- **`PR-G — G-003`** `README.cn.md` → `README.zh-CN.md` (canonical locale tag); references swept across siblings + tests/canonical-docs-coverage.test.mjs.
- **`PR-G — G-004`** `/api/stream/scan-en` + `scan-ru` now emit RFC 8594 Sunset + Deprecation + Link headers (sunset 2026-10-01). Scheduled for removal in v1.16.0.

### 🧪 Tests

- New `tests/profile-canonical-schema.test.mjs` (6 cases) — canonical YAML, legacy YAML, mixed legacy-wins, accept-canonical-only, reject neither-shape, comp range parsing.
- New `tests/modes-profile-crud.test.mjs` (8 cases) — built-in scaffold on empty, template-takeover, persisted-wins, write happy-path, sanitization, 400 on non-string, 413 on >256 KB, generic /api/modes/:name still works.
- Fixed isolation regression in test fixtures: tests now use `before/after + dynamic-import` pattern (matching `tests/batch-endpoints.test.mjs`) so they no longer mutate the user's real parent `config/profile.yml`. **NOTE for users:** if your `config/profile.yml` looks like a test placeholder after upgrading from a v1.15.0-RC build, restore from your backup — the regression existed in the dev branch only.
- Total: **400 / 400** unit tests (was 386; +14 net). 0 failures. 20/20 smoke E2E + 23/23 comprehensive E2E + 28/28 Playwright all green from v1.14.0 baseline.

### Out of scope (v1.16+ follow-up)

| Item | Notes |
|---|---|
| Parent commit for canonical A–F prompt | `santifer/career-ops::modes/oferta.md` needs rewriting upstream. CLAUDE.md hard rule #1 forbids us editing parent files. Web-ui side is already done (graceful degrade — pre-v1.15 A–G reports render unchanged). |
| Server-side `POST /api/auto-pipeline` SSE | Client-side orchestrator ships the UX win. Server-side endpoint would enable retry-from-step-N + curl-able CI. |
| `POST /api/reports` primitive | Auto-pipeline currently shows the report markdown inline but doesn't persist it to parent `reports/`. The PDF + tracker row are the durable artifacts. |
| Cmd+K paste-URL → run auto-pipeline | Defer to v1.16+. |

### Verification

```
npm test                              # 400 / 400
npm run test:e2e:full                 # 23 / 23
curl -sf http://127.0.0.1:4317/api/health | jq '.checks | length'   # → 18
curl -sI http://127.0.0.1:4317/api/stream/scan-en | grep -i sunset  # G-004 visible
curl -sf http://127.0.0.1:4317/api/modes/_profile | jq '.scaffolded' # G-008 wired
ls images/dashboard-*.png | wc -l     # 8 (PR-I)
grep -c 'href="#/batch"' public/index.html  # 1 (PR-H dedupe)
```

---

## [1.14.0] — 2026-05-13

3 new ATS adapters land on top of v1.13.0's registry, taking us from 3 → 6 supported ATSes (Greenhouse / Ashby / Lever **+ Workable / SmartRecruiters / Workday-beta**). User-facing docs across 17 files swept from "3 ATSes" to "6 ATSes" in one shot (42 phrase upgrades) — README × 8 locales, help bundle × 8 locales, PROJECT.md. Adds `docs/portals-examples.md` blocks for 13 trending companies as ready-to-paste YAML for parent `portals.yml`.

### ✨ Features

- **`feat(portals): 3 new ATS adapters — Workable, SmartRecruiters, Workday-beta`** — registry now resolves 6 ATSes (was 3). New files: `server/lib/portals/adapters/{workable,smartrecruiters,workday}.mjs` (each a thin uniform-contract wrapper around the new sources) and `server/lib/sources/{workable,smartrecruiters,workday}.mjs` (raw HTTP + response normalization to the canonical `{ id, title, company, url, location, isRemote, … }` shape with `source: <id>`).
  - **Workable**: detects `apply.workable.com/<slug>` AND legacy `<subdomain>.workable.com`. Endpoint: `https://apply.workable.com/api/v3/accounts/<slug>/jobs?details=true`.
  - **SmartRecruiters**: detects `jobs.smartrecruiters.com/<slug>` AND `careers.smartrecruiters.com/<slug>`. Endpoint: `https://api.smartrecruiters.com/v1/companies/<slug>/postings`.
  - **Workday (beta)**: detects `<tenant>.wd<N>.myworkdayjobs.com/<lang>/<site>`. Endpoint: POST to `/wday/cxs/<tenant>/<site>/jobs`. Defaults `site=External` when the careers_url omits it. Beta because some tenants gate CXS behind CAPTCHA — when that happens, fall back to parent's `/career-ops scan` (Playwright-driven).

### 📚 Docs

- **`docs(portals-examples): trending boards block`** — `docs/portals-examples.md` extended with v1.14.0 section listing 13 trending companies as ready-to-paste YAML for `tracked_companies`, split across Greenhouse-hosted (Stripe, GitLab, HashiCorp, Cloudflare, Datadog, Hugging Face) and Ashby-hosted (Notion, Linear, PostHog, Replicate, Modal Labs, Fly.io, Render). Each entry uses `enabled: false` so users verify the slug responds before turning it on. Plus example blocks for Workable / SmartRecruiters / Workday with the URL pattern that detects each.
- **`docs(framing): 42 ATS-phrase upgrades across 17 user-facing docs`** — every appearance of "Greenhouse / Ashby / Lever" in user-facing documentation now reads "Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday". Touches README × 8 locales (EN/ES/PT-BR/RU/JA/KO/CN/TW), help bundle × 8 locales, PROJECT.md. Historical CHANGELOG entries and bug-fix prescription docs (`qa/fixes/F-014`, `qa/FIX-PROMPT`) are deliberately untouched — they describe past or already-correct state.
- **`docs(qa): browser test scenario 19 — 6 ATS adapter coverage`** — `qa/claude-cowork-browser-test-prompt.md` extended with Scenario 19: `ALL_ADAPTERS.length === 6` invariant, `resolveAdapter()` URL-detection sweep for all 6 adapters, soft-check for the Active Companies card in `#/scan`, and structural check for `docs/portals-examples.md` blocks per ATS.

### 🧪 Tests

- `tests/adapter-registry.test.mjs` extended with 7 new tests for the 3 new adapters (Workable apply-URL pattern, Workable legacy subdomain pattern, SmartRecruiters jobs.* + careers.* patterns, Workday tenant.wd5.* with explicit site, Workday default site fallback to "External", `ALL_ADAPTERS.length === 6` invariant, `detectApi()` legacy-shape compatibility).
- Total: **386 / 386** unit tests (was 379; +7 net). 0 failures.

### Verification

```
npm test                        # 386 / 386
node -e "import('./server/lib/portals/registry.mjs').then(m => console.log(m.ALL_ADAPTERS.length))"   # → 6

# Adapter detection sweep:
node -e "import('./server/lib/portals/registry.mjs').then(m => {
  console.log(m.resolveAdapter({ careers_url: 'https://apply.workable.com/foo/' }).adapter.id);          // → workable
  console.log(m.resolveAdapter({ careers_url: 'https://jobs.smartrecruiters.com/Bar' }).adapter.id);     // → smartrecruiters
  console.log(m.resolveAdapter({ careers_url: 'https://baz.wd5.myworkdayjobs.com/en-US' }).adapter.id);  // → workday
})"
```

### Out of scope (deferred follow-up)

| Item | Notes |
|---|---|
| Per-company adapter records for the 13 trending Greenhouse/Ashby companies | `docs/portals-examples.md` v1.14.0 block lists them as user-pasteable YAML; slug verification + bulk add into parent's `portals.yml` is a separate phase. |
| Workday CAPTCHA-fallback automation | Workday adapter throws when the CXS feed is gated; the planned fallback delegates to parent's `/career-ops scan` (Playwright). Wiring that into the SPA's "scan" UX is v1.15+. |

---

## [1.13.0] — 2026-05-13

Big slice. Closes all 4 deferred items from the post-v1.12.0 backlog in one release: PR-4 (full multer pipeline), Adapter registry (architectural F-018 follow-on), Batch evaluate SPA page, and locale-aware mode-template scaffolding. Plus a mid-session dark-theme table fix.

### ✨ Features

- **`feat(cv): multer-based multipart upload (PR-4 full)`** — `/api/cv/import` now accepts BOTH the original octet-stream contract (`Content-Type: application/octet-stream` + `X-Filename`) AND `multipart/form-data` properly parsed via multer. The v1.10.2 415-reject was a stopgap; v1.13.0 is the real fix. External clients (curl `-F`, Postman default, any HTTP client) work seamlessly. Both paths feed the same `importDocumentToMarkdown` converter + `stripDangerousMarkdown` XSS pass. New dep: `multer ^2.1.1`.
- **`feat(portals): adapter registry`** — extracted Greenhouse / Ashby / Lever fetchers into `server/lib/portals/adapters/*.mjs` with a uniform contract (`id`, `label`, `matches`, `buildEndpoint`, `fetch`). New `server/lib/portals/registry.mjs::resolveAdapter()` is the single dispatch surface. `en-scanner.mjs::detectApi()` + `FETCHERS` now delegate to the registry; legacy return shape preserved. To add a new ATS: drop a file under `adapters/`, append to `ALL_ADAPTERS` — no scanner changes needed.
- **`feat(batch): #/batch evaluate page`** — new SPA view + 4 endpoints (`GET /api/batch`, `PUT /api/batch`, `GET /api/stream/batch`, `POST /api/batch/merge`). TSV editor for `batch/batch-input.tsv`, parallel/min-score/dry-run/retry controls, live SSE log of `bash batch/batch-runner.sh`, post-run list of `batch/tracker-additions/` with one-click `node merge-tracker.mjs`. Sidebar link under Decision group. 21 new i18n keys × 8 locales.
- **`feat(prompts): locale-aware mode scaffolding`** — `buildModePrompt` + `buildEvaluationPrompt` now wrap the parent's English mode-template body with localized scaffolding text (role line, "Read these files first", "User-supplied context") in 8 locales. The parent's `modes/<slug>.md` body stays English (read-only per CLAUDE.md hard rule #1); the career-ops-ui scaffolding around it is translated.

### 🎨 UX fixes

- **`fix(theme): dark-mode table hover + tab-btn`** — hardcoded `#fafafa` / `#fff` / `#f7f7f7` replaced with `var(--beach)` / `var(--paper)` / `var(--slate)` tokens so the dark palette swap actually reaches table rows and tab buttons. Adds `.row-boosted` accent strip for boosted scan rows that works in both themes.

### 🧪 Tests

- New `tests/adapter-registry.test.mjs` (7 cases) — uniform contract, URL detection per ATS, explicit `api:` field priority, null on no match, legacy `detectApi()` shape preserved.
- New `tests/batch-endpoints.test.mjs` (5 cases) — empty fixture, TSV round-trip, no-URL rejection, 1 MB cap, runner-missing error frame.
- New `tests/locale-scaffold.test.mjs` (6 cases) — scaffold strings in en/ru/ja/ko, `buildModePrompt`/`buildEvaluationPrompt` integration, English back-compat.
- `tests/cv-upload-multipart-reject.test.mjs` rewritten — what was the "multipart returns 415" contract is now the "multipart parsed via multer" contract; the no-side-effect-on-cv.md invariant is preserved.
- Total: **379 / 379** unit tests (was 360; +19 net). 0 failures.
- Coverage: **95.46 % line / 84.06 % branch**.
- 20/20 smoke E2E · 23/23 comprehensive E2E · 28/28 Playwright.

### Out of scope (deferred follow-up work)

| Item | Notes |
|---|---|
| 14 new portal adapters (Workable / SmartRecruiters / Workday / GitLab / HashiCorp / Cloudflare / Datadog / Stripe / Notion / Linear / Posthog / Hugging Face / Replicate / Modal Labs / Fly.io / Render) | Adapter registry is in place — adding new adapters is now one file each. The portal-by-portal research + URL pattern + endpoint normalization for 14 ATSes is a separate phase. |
| Translating parent's `modes/<slug>.md` bodies | Parent files are read-only per CLAUDE.md hard rule #1. v1.13.0's locale-aware scaffolding gets you 80% of the way; full body translation requires a PR upstream to `santifer/career-ops`. |

### Docs

- `docs/reviews/REVIEW-2026-05-13-v1.13.0.md` — session context + adapter registry contract + batch flow.
- All 8 READMEs: badge bumps (tests 360 → 379, release v1.12.0 → v1.13.0).
- All 8 CHANGELOGs receive this entry.

---

## [1.12.0] — 2026-05-13

Bug-fix + UX + branding pass. Closes 8 items from the post-v1.11.1 honest backlog (test gaps #9–12, console error #8, portals-dead drift #4, seniority_boost surface #6, F-018 endpoint consolidation). Adds a dark/light theme toggle and removes "Airbnb-styled" branding from every doc, package metadata, and the GitHub repo description.

### ✨ Features

- **`feat(theme): dark/light toggle (v1.12.0)`** — new theme button in the top bar. Cycles light ↔ dark; persists to `localStorage.theme`; restores on page load via a pre-paint bootstrap (`public/js/lib/theme-bootstrap.js`) so users never see a flash of the wrong colour scheme. Honors `prefers-color-scheme` for first-time visitors. Full dark palette under `[data-theme="dark"]` in `public/css/app.css` — every component reads from CSS custom properties so the swap is centralized in one place.
- **`feat(scan): /api/stream/scan?source=ats|regional|both` (F-018 LITE)`** — single consolidated SSE entrypoint. SPA now opens ONE event-stream that drives both phases sequentially (ATS first, then regional) instead of chaining two separate streams. Legacy `/api/stream/scan-en` + `/api/stream/scan-ru` stay live as deprecated aliases. The runners-table `/api/stream/scan` was renamed to `/api/stream/scan-parent` to clear the namespace; the parent-spawned `scan.mjs` fallback is preserved.
- **`feat(scan): seniority_boost surface (canonical docs §3)`** — both `en-scanner.mjs` and `ru-scanner.mjs` now read `portals.yml::title_filter.seniority_boost` and stamp `_boosted: true` + `_boostedBy: <keyword>` on matching jobs. SPA sorts boosted rows to the top of `#/scan` results and renders a `⬆ boosted` badge with the matching keyword in the title attribute. Two new i18n keys (`scan.boosted`, `scan.boostedBy`) localized across 8 locales.

### 🐛 Bug fixes

- **`fix(ui): null-safe error message reads in 4 places (#8)`** — `app.js` (top-bar doctor button + global-search pipeline add), `views/tracker.js` (line 112), `views/apply.js` (line 21), `views/evaluate.js` (line 32) all now read `(err && err.message) || '<fallback>'`. Previously a Promise rejection without an Error payload threw "Cannot read properties of undefined (reading 'message')" in the page-error stream during e2e tear-down.
- **`fix(test): portals-dead drift warning instead of failure (#4)`** — `tests/portals-dead.test.mjs::FIX-C3` previously failed when the parent's `templates/portals.example.yml` drifted to re-enable a slug we'd flagged dead. v1.12.0 converts the assertion into a stderr warning so CI runs green on parent drift; release decisions stay manual. The slug list `KNOWN_DEAD` is preserved as documentation of intent.

### 📝 Branding / docs

- **`docs(brand): strip 'Airbnb' references from every doc (8 locales)`** — README.md, README.es.md, README.pt-BR.md, README.ko-KR.md, README.ja.md, README.ru.md, README.cn.md, README.zh-TW.md, CLAUDE.md, docs/architecture/FRONTEND.md, package.json, and the GitHub repo description all moved from "Airbnb-styled" / "Airbnb-inspired" wording to "Clean, docs-style". CSS file kept its design-token names (they're internal identifiers, no external coupling) but the explanatory comment was rewritten.

### 🧪 Tests

- **New `tests/canonical-docs-coverage.test.mjs` (5 cases)** closes test gaps #9–12: every help bundle references all 5 canonical career-ops.org guides; 16-H2 parity contract per locale; every README references the canonical front page + ≥ 3 sub-guides; `#/reports` view source contains the score-thresholds card scaffold; i18n bundle includes every new v1.11.x key with all 8 locales.
- **New `tests/scan-consolidated.test.mjs` (6 cases)** covers F-018 LITE: `?source=ats|regional|both` dispatches correctly; unknown source emits an error frame; legacy `/api/stream/scan-en` + `/api/stream/scan-ru` still work as deprecated aliases.
- Total: **360 / 360** unit tests (was 349; +11 new). 0 failures. Coverage: **95.62 % line / 84.37 % branch** (up from 94.59).
- 20 / 20 smoke E2E · 23 / 23 comprehensive E2E · **28 / 28 Playwright**.

### 📋 Internal

- `docs/reviews/REVIEW-2026-05-13-v1.12.0.md` — session context, deferred-list summary, refresh procedure for career-ops.org content sync.
- All 8 CHANGELOGs receive this entry.
- GitHub repo description updated to match the new branding.

### Out of scope (deferred to future, unchanged from v1.11.1)

| Item | Why |
|---|---|
| Batch evaluate SPA page | CLI-only flow per canonical docs; SPA equivalent needs a new view + ≥3 endpoints + fixtures. 2–3 day phase. |
| Full adapter-registry (8 `server/lib/portals/adapters/*.mjs` + 14 new portals + FE rewrite) | F-018 LITE in this release consolidates the API surface; full architectural refactor remains. |
| Full multer pipeline (PR-4) | v1.10.2 closed the data-corruption hole via 415 envelope; full multipart parser + ConversionError envelope is its own phase. |
| Mode-template translations | Coordination with parent project required. |

---

## [1.11.1] — 2026-05-13

Deep career-ops.org/docs integration — follow-up to v1.11.0. Where v1.11.0 added a summary block, v1.11.1 enriches the existing §5 Portals / §7 Scan / §14 Apply sections of every help bundle with the **full CLI flows** (commands verbatim, numbered apply steps, batch-evaluate runner, Playwright setup). The SPA's `#/reports` view gains a score-thresholds card so the documented `≥4.5 / 4.0-4.4 / 3.5-3.9 / <3.5` action table is visible inline.

### 📝 Docs

- **Help bundles (all 8 locales)** — three new subsections per bundle, translated per locale:
  - **§5 Portals → `CLI flow`** — `cp templates/portals.example.yml portals.yml`; canonical schema for `title_filter` (positive / negative / seniority_boost), `tracked_companies` (name + careers_url required), `search_queries` (pre-built broader web searches).
  - **§7 Scan → `CLI scan flow`** — Option A (`npm run scan` + `--dry-run` / `--company`) for Greenhouse/Ashby/Lever ATS, Option B (`/career-ops scan` inside any AI CLI) for non-API discovery. Output to `data/pipeline.md` + `data/scan-history.tsv`. Action-thresholds table.
  - **§14 Apply → `Full CLI apply flow` + `Batch evaluate` + `Playwright setup`** — 8-step numbered apply flow (`/career-ops apply <company>` → Playwright opens browser → numbered draft answers → human reviews and clicks Submit → `Submitted.` flips tracker `Evaluated → Applied`). Batch runner via `./batch/batch-runner.sh` with `--parallel` / `--min-score` / `--retry-failed`. Playwright install via `npm install` + `npx playwright install chromium` + `claude mcp add playwright`.
- All 8 bundles preserve the 16-H2 parity contract (`tests/help-ui.test.mjs::section-parity` stays green).

### ✨ UI

- **`#/reports`** — new collapsible card at the top of the list view with the canonical score → next-step table (`≥ 4.5 → /career-ops apply`, `4.0–4.4 → apply or /career-ops contacto`, `3.5–3.9 → /career-ops deep`, `< 3.5 → skip`). Sources the link out to `career-ops.org/docs/.../scan-job-portals`. 7 new i18n keys (`rep.thresholdsTitle`, `rep.thrAction`, `rep.thr45`, `rep.thr40`, `rep.thr35`, `rep.thrLow`, `rep.thresholdsSource`) across 8 locales.

### 📋 QA

- **`qa/claude-cowork-browser-test-prompt.md`** — appended **Scenario 17 (career-ops.org/docs coverage)** with 5 sub-assertions (front-matter in 8 locales, CLI-flow subsections in §5/§7/§14, README block in 8 locales, `#/apply` Playwright link, `#/reports` score-thresholds card) + **Scenario 18 (help bundle parity)** for the i18n parity regression.

### Out of scope (deferred)

| Item | Why |
|---|---|
| **Batch evaluate SPA page** | Canonical docs describe CLI-only flow; SPA equivalent = new view + ≥3 endpoints + fixtures. Multi-day phase. |
| **F-018 full adapter-registry** | Still queued; label-only slice closed in v1.10.3. |
| **Full multer pipeline** | v1.10.2 closed data-corruption hole via 415 envelope; full parser is its own phase. |

### Test posture

- **348 / 349** unit tests (1 pre-existing parent-data drift).
- Coverage: **94.59 % line / 84.18 % branch**.
- 20 / 20 smoke E2E · 23 / 23 comprehensive E2E · **28 / 28 Playwright**.

### Docs

- `docs/reviews/REVIEW-2026-05-13-v1.11.1.md` — session context + audit.
- All 8 READMEs: release v1.11.0 → v1.11.1.
- All 8 CHANGELOGs receive this entry.

---

## [1.11.0] — 2026-05-13

career-ops.org docs integration — minor release because every change is additive (no API breakage, no data-shape changes, no SPA route renames). Closes the v1.10.3 PR-9 deferral.

### 📝 Docs

- **`docs/career-ops-canonical.md` (new)** — single canonical reference distilled from [career-ops.org/docs](https://career-ops.org/docs) and its 5 sub-guides (What is career-ops, Scan job portals, Apply for a job, Batch-evaluate offers, Set up Playwright). All locale help bundles + READMEs translate this file; when career-ops.org/docs changes, regenerate this file first.
- **All 8 help bundles** (`docs/help/{en, ru, es, pt-BR, ko-KR, ja, zh-CN, zh-TW}.md`) gained a new front-matter `About career-ops` section just below the H1 intro: principles, key concepts (Mode / Archetype / Pipeline / Tracker / Report / Scan history), career-ops vs career-ops-ui distinction, action thresholds by score (≥ 4.5 / 4.0–4.4 / 3.5–3.9 / < 3.5), and links to all five canonical guides. H2 count preserved at 16 per locale (`tests/help-ui.test.mjs` parity stays green).
- **All 8 READMEs** gained an `About career-ops` block before the install heading: same principles, score thresholds, and 5 canonical guide links. The `What's new in v1.10.x` history sections were removed from the README front page (CHANGELOG retains the full history).

### ✨ UI improvements

- **`#/apply`** — the info banner now explicitly surfaces the Playwright setup guide (`career-ops.org/docs/.../set-up-playwright`) and a link to the canonical Apply guide. New i18n keys `apply.playwrightHint` + `apply.docsLink` localized for 8 locales.

### 🔧 Internal

- README screenshot path stays at `public/images/screen_vacancy_found.png` (v1.10.1).
- No new server routes, no schema changes, no new tests required (existing i18n + help parity tests cover the new content surface).
- `tests/help-ui.test.mjs` `section-parity` test continues to pass — every locale has the same 16 H2 headings.

### Audit (gaps deferred, NOT in this release)

| Gap | Why deferred |
|---|---|
| **Batch evaluate SPA page** (`./batch/batch-runner.sh` flow) | The canonical docs describe a CLI-only batch loop (`batch/batch-input.tsv` → parallel runner → `batch/tracker-additions/`). A SPA equivalent needs a new view, three new endpoints, fixture data, and tests. Multi-day phase; documented in `docs/career-ops-canonical.md §4`. |
| **Adapter-registry consolidation** (F-018 / full PR-1) | Still queued; `/api/stream/scan-en` + `/api/stream/scan-ru` remain. The label-only slice landed in v1.10.3. |
| **Multer pipeline** (full PR-4) | v1.10.2 closed the data-corruption hole via a 415 envelope; the full multipart parser + ConversionError envelope refactor is its own phase. |

### Test posture

- **348 / 349** unit tests pass (1 pre-existing parent-data drift in `portals-dead.test.mjs`).
- Coverage: **94.59 % line / 84.24 % branch**.
- 20 / 20 smoke E2E · 23 / 23 comprehensive E2E · **28 / 28 Playwright**.

### Docs

- `docs/reviews/REVIEW-2026-05-13-v1.11.0.md` — session context + UI audit gap list.
- All 8 READMEs: badge bumps (tests 349 → 348 — one test moved as audit cleanup, no functional change), release v1.10.3 → v1.11.0.
- All 8 CHANGELOGs receive this entry.

---

## [1.10.3] — 2026-05-12

Closes 7 of the 11 v1.10.0 QA findings (F-001, F-010 minimal, F-011 minimal, F-013, F-014, F-015, F-019). The remaining 4 (F-018 — full adapter-registry consolidation; PR-4 full multer pipeline; PR-7 follow-ups; PR-9 doc sweep across career-ops.org docs) are deferred to v1.11.0.

### ✨ Features

- **`feat(pdf): Generate-PDF on every long-form surface (F-015)`** — three new SSE endpoints (`GET /api/stream/pdf/report?slug=`, `GET /api/stream/pdf/deep?name=`, `POST /api/stream/pdf/inline { markdown }`) plus a shared `public/js/lib/pdf-generate.js` helper. The **📄 Generate PDF** button now appears on `#/reports/:slug`, `#/deep` (manual + live), `#/evaluate` (manual + live), and `#/interview-prep` (via the deep endpoint). Each kind reuses the v1.10.2 cv-markdown-to-print-HTML helper and lands the result under `output/<slug>-<TS>.pdf` so the existing auto-download flow takes over.
- **`feat(config): regional config group (F-013)`** — `/api/config` now exposes `groups` (`core | runtime | regional`) and `regionalActive` (boolean computed from `portals.yml::russian_portals.sources`). The SPA renders the three groups as collapsible sections; **Regional sources** is auto-collapsed and only present when a regional source is configured.

### 🐛 Bug fixes

- **`fix(server): global Express error handler (F-019)`** — `PayloadTooLargeError` (e.g. an 11 MB upload to `/api/cv/import`) and `SyntaxError` from `express.json` now return JSON envelopes the SPA can localize (HTTP 413 / 400). Previously the default Express handler returned an HTML stack trace, which broke the SPA's `try { await res.json() }`.
- **`fix(i18n): English tokens no longer leak into non-EN UI (F-001)`** — added localizations for `Pipeline`, `Deep research`, `Follow-up`, `Health`, `Outreach`, `Doctor`, `Quick scan` (the labels users saw in their UI language while the rest of the chrome was translated).
- **`fix(scan): drop EN/RU framing from labels (F-010 minimum)`** — the `#/scan` summary line, two scan-done badges, and the source-filter labels now read "ATS adapters" + "Regional portals". The two SSE endpoints (`/api/stream/scan-en`, `/api/stream/scan-ru`) are retained as-is; full registry consolidation lives in PR-1 / v1.11.0.
- **`fix(scan): Active-Companies counter auto-refreshes (F-011 minimum)`** — view dispatches a `scan:refresh` event after each `refreshResults()`; the counter re-derives "companies with hits in last scan" from the actual `/api/scan-results` payload instead of staying frozen at the view-mount snapshot.
- **`docs(en-ru-framing): sweep across READMEs + help bundles (F-014)`** — `EN sweep` → `ATS sweep`, `RU sweep` → `regional sweep`, `EN scanner` → `ATS scanner`, `EN: Greenhouse / Ashby / Lever, RU: hh.ru + Habr Career` → `ATS adapters (Greenhouse / Ashby / Lever) + regional portals (hh.ru / Habr Career)`. Touches `README.md`, `README.ru.md`, `README.ja.md`, `README.ko-KR.md`, `docs/help/en.md`, `docs/help/es.md`, `docs/help/pt-BR.md`.

### 🧪 Tests

- New `tests/global-error-handler.test.mjs` (2 cases): malformed JSON → 400 JSON; 11 MB upload → 413 JSON.
- New `tests/config-groups.test.mjs` (2 cases): `/api/config` exposes `groups`; `regionalActive` flips on when portals.yml gains a regional source.
- New `tests/pdf-extra-routes.test.mjs` (5 cases): each of `/report`, `/deep`, `/inline` invokes `generate-pdf.mjs` with the documented three positional args; 404 on missing slug; 400 on empty inline markdown.
- Total: **349 / 350** unit tests (1 pre-existing parent-data drift in `portals-dead.test.mjs`).
- Coverage: 94.59 % line / 84.16 % branch.
- 20 / 20 smoke E2E, 23 / 23 comprehensive E2E, **28 / 28 Playwright**.

### 📝 Docs

- `docs/reviews/REVIEW-2026-05-12-v1.10.3.md` — session context + scope-out list.
- All 8 READMEs: badge bumps (tests 340 → 349, release v1.10.2 → v1.10.3), "What's new in v1.10.3" section per locale.
- All 8 CHANGELOGs receive this entry.

### Out of scope (deferred to v1.11.0)

- **PR-1** — full locale-agnostic adapter registry (8 ATS-adapter files + new `/api/stream/scan?source=` consolidating the two existing endpoints + +14 new portals + scan-view rewrite). The label-only slice in this release closes F-010 / F-011 visually; the architectural refactor is a multi-day phase.
- **PR-4** — multer-based CV import pipeline (replaces the v1.10.2 415 envelope with a real multipart parser + ConversionError envelope + dependency review).
- **PR-9** — full career-ops.org docs integration: fetch [career-ops.org/docs](https://career-ops.org/docs) + the 4 sub-guides (scan-job-portals, apply-for-a-job, batch-evaluate-offers, set-up-playwright), translate into 7 non-EN locales, rewrite help bundles + READMEs accordingly, audit UI screens against the documented behavior.

---

## [1.10.2] — 2026-05-12

Functional-regression patch. Two bugs discovered in v1.10.1 hand-testing closed; documentation surface expanded.

### 🐛 Bug fixes

- **`fix(cv): /api/cv/import rejects multipart/form-data with 415 (F-016 hardening)`** — any external client (curl `-F`, common HTTP clients) defaulting to `multipart/form-data` previously had its wire envelope (`--boundary…\r\nContent-Disposition: form-data; name="file"; filename="x"…`) stored as `cv.md` content. The SPA's actual path (`Content-Type: application/octet-stream` + `X-Filename`) was unaffected. Route now returns 415 with a hint pointing at the documented contract. Defense-in-depth: octet-stream bodies that sniff as multipart in their first 256 bytes also get 415. `cv.md` is never touched on a 415.
- **`fix(pdf): /api/stream/pdf invokes generate-pdf.mjs with proper positional args`** — was calling the script with `[]`. The script printed its `Usage:` line and exited code 1 — SPA showed the green "PDF generated" toast but no file ever reached disk. The route now reads `cv.md`, renders it to an HTML file under `output/cv-input-<TIMESTAMP>.html` via an in-route markdown-to-print-HTML helper, then spawns `generate-pdf.mjs <input.html> <output.pdf> --format=a4`. Optional `?format=letter` query for US-letter output. When `cv.md` is missing, emits an `error` event + `done { code: 2 }` instead of a fake start frame.

### 🧪 Tests

- New `tests/cv-upload-multipart-reject.test.mjs` (5 cases): SPA happy path returns 200 with clean markdown; `multipart/form-data` → 415; octet-stream body that LOOKS like multipart → 415; empty body → 400; rejected request does NOT modify `cv.md`.
- New `tests/pdf-stream-args.test.mjs` (3 cases): `start` event carries `<input.html> <output.pdf> --format=a4` with absolute paths and the HTML exists on disk; `?format=letter` switches the flag; missing `cv.md` emits the expected error frame.
- Total: **340 unit tests** (was 318). One pre-existing failure in `portals-dead.test.mjs` remains parent-side data drift, unrelated to web-ui.
- Coverage: 94.63 % line / 84.94 % branch.

### 📝 Docs

- New `docs/test-scenarios/` — 21 scenario files in English (index + per-page contracts):
  - 01 smoke / health · 02 CV upload · 03 CV edit-save · 04 CV → PDF download
  - 05 profile YAML · 06 config env · 07 scan · 08 pipeline
  - 09 evaluate · 10 deep research · 11 modes · 12 apply checklist
  - 13 tracker · 14 reports · 15 activity log · 16 interview prep · 17 JDs
  - 18 i18n · 19 help center · 20 security · 21 full funnel
- Each file documents: goal, preconditions, inputs, expected outputs, negative cases, test coverage (file + line range), and manual Playwright steps where applicable.
- New `docs/reviews/REVIEW-2026-05-12-v1.10.2.md` — full session context, scope-out list, verification commands.
- All 8 READMEs: badge bumps (tests 318 → 340, release v1.10.1 → v1.10.2) + "What's new in v1.10.2" section per locale.
- All 8 CHANGELOGs receive this entry.

### Out of scope (deferred to future GSD phases)

PR-1 locale-agnostic adapter registry (still queued), PR-4 multer-based CV import with full conversion pipeline, PR-7 Generate-PDF buttons on reports / evaluate / deep / interview-prep, PR-8 config UI regrouping, PR-9 docs sweep, PR-10 button-by-button localization audit + jsdom CI gate, full Korean retranslation.

---

## [1.10.1] — 2026-05-09

Critical-fixes patch driven by the v1.10.0 QA regression run (`qa/reports/00-FINAL-SUMMARY.md`).

### 🛡️ Security

- **`fix(security): tighten isValidJobUrl + add DNS-rebind defense (PR-3 / F-003)`** — `isValidJobUrl` now rejects RFC1918 (`10/8`, `172.16/12`, `192.168/16`), the full 127/8 loopback range, link-local `169.254/16` (incl. AWS IMDS), `0.0.0.0`, CGNAT `100.64/10`, and IPv6 ULA / link-local. New helper `isPrivateOrLoopbackHost()` is exported from `server/lib/security.mjs` and reused by `/api/pipeline/preview`, which now `dns.lookup`s the host on every redirect hop and rejects when the resolved address itself is private — defeats DNS-rebind. DNS-failure fails open (fetch reports the error) so test stubs / DNS-less sandboxes still work.

### 🐛 Bug fixes

- **`fix(activity): record only successful state changes (PR-5 / F-005)`** — middleware now early-returns on `res.statusCode >= 400`. Rejected pipeline / cv / tracker requests no longer pollute the audit feed.
- **`fix(activity): add profile.save / config.save / cv.import event mappings (F-008)`** — successful `PUT /api/profile` and `POST /api/config` calls now appear in `/api/activity`.
- **`fix(help): alias ko → ko-KR.md so Korean Help body is served (F-002)`** — the SPA sends bare BCP-47 codes (`ko`); the file on disk is `ko-KR.md`. Resolver now walks 4 candidates: exact, region-tag alias, language-only base, then `en.md`.
- **`fix(llm): /api/evaluate honors mode:'manual' (F-009)`** — mirrors `/api/deep`. Manual-mode skips Anthropic / Gemini calls even when a key is set so users can copy the prompt into Claude Code without burning credits.
- **`fix(api): DELETE /api/pipeline accepts ?url= AND body.url, returns 404 on miss (PR-6 / F-017)`** — was silently 200-on-miss with `?url=` only.

### ✨ Features

- **`feat(llm): locale propagation through every prompt (PR-2 / F-012)`** — new `resolveLocale(req)` picks a locale from `body.lang` → `body.locale` → `Accept-Language` → `'en'`. New `buildLocaleDirective(lang)` emits a one-line "Respond in X" header. `buildEvaluationPrompt`, `buildDeepPrompt`, `buildModePrompt` now accept and embed `lang`. SPA `API.call()` auto-attaches `Accept-Language` and merges `lang` into JSON bodies.
- **`feat(scripts): post-qa-cleanup.mjs (PR-11)`** — replays the QA-regression cleanup checklist; `--apply` writes, default is dry-run, idempotent. Sweeps RFC1918 / `nip.io` / `test-cloud-*` URLs from `data/pipeline.md` and audits `cv.md` size.

### 🧪 Tests

- New `tests/critical-fixes.test.mjs` (15 cases) covering: F-002 ko alias resolution, F-009 manual-mode opt-out, PR-6 DELETE shape (body / 404 / 400), PR-3 helper unit tests for IPv4 + IPv6 + bracketed forms, PR-2 `resolveLocale` precedence + `buildLocaleDirective` + prompt-builder integration.
- `tests/url-validation.test.mjs` extended with 5 new tests for RFC1918 / link-local / 0.0.0.0 / 127/8 / CGNAT / IPv6 ULA / link-local.
- `tests/activity-log.test.mjs` test 8 updated to assert the new "no log on 4xx" contract.
- Total: **318 unit tests** (was 298; one pre-existing failure in `portals-dead.test.mjs` is parent-side data drift in `templates/portals.example.yml`, unrelated to web-ui code).

### 📝 Docs

- New `docs/reviews/REVIEW-2026-05-09-v1.10.1.md` — full session context + scope-out list + verification commands.
- All 8 READMEs: badge bumps (test count 298 → 318, release v1.10.0 → v1.10.1), screenshot path moved to `public/images/screen_vacancy_found.png`, "What's new in v1.10.1" section added per locale (English, Spanish, Portuguese, Korean, Japanese, Russian, Simplified Chinese, Traditional Chinese).
- All 8 CHANGELOGs updated with this entry.

### Out of scope (deferred to future GSD phases)

PR-1 (locale-agnostic adapter registry, +14 portals, FE rewrite), PR-4 (multer-based CV import + ConversionError + global error handler), PR-7 (Generate-PDF buttons on reports / evaluate / deep / interview-prep), PR-8 (config UI regrouping), PR-9 (full README/docs/8-help-bundle EN-RU framing sweep), PR-10 (button-by-button localization audit + jsdom CI gate), full Korean help retranslation (the file exists; PR-only fixed runtime delivery).

---

## [1.10.0] — 2026-05-08

CV import revamp + `#/config` tabs + canonical `#/profile` route.

### ✨ Features

- **`feat(cv): server-side import for .docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md`** — new `POST /api/cv/import` endpoint converts an uploaded document (any common format) into markdown the editor can drop in. Office formats go via **pandoc**, PDF via **pdftotext** from Poppler. Result is sanitized through `stripDangerousMarkdown` (defense-in-depth XSS). Hard cap: 10 MB per upload. Frontend `📁 Upload CV` now accepts the full format set; pretty error toasts when a converter is missing on the host.
- **`feat(cv): auto-download generated PDF when generate-pdf.mjs finishes`** — the streaming Generate-PDF flow now snapshots the latest PDF in the output dir, and on `done` triggers a browser download for the *new* file (no-op if the run produced no new artifact). The existing on-page list still shows every previous PDF.
- **`feat(config): two-tab layout — API keys & runtime + Profile`** — `#/config` now has a tab strip. The first tab keeps the existing `.env` editor (API keys, models, scanner knobs). The new **Profile** tab is a direct YAML editor for `config/profile.yml`: `PUT /api/profile` validates the YAML (must be a mapping, must include `candidate`), stamps a canonical `# Career-Ops Profile Configuration` header if missing, and writes the file. Save propagates without restart.
- **`feat(routes): canonical /#/profile route (was /#/settings)`** — sidebar now points at `#/profile`. The old `#/settings` hash still resolves through the router alias table, so existing bookmarks keep working. Internal route handler renamed; tests updated to reflect the new direction.

### 🧪 Tests

- New `tests/cv-import.test.mjs` (7 cases): `.md` / `.txt` passthrough, empty-body 400, unsupported-extension 422, oversized 413, HTML→markdown sanitization (skips when pandoc absent), PDF→text round-trip with a hand-crafted PDF (skips when poppler absent).
- New `tests/profile-put.test.mjs` (7 cases): happy-path round-trip, header stamping, empty / invalid-YAML / non-object / missing-candidate 400s, oversized 413.
- `tests/playwright-full-cycle.mjs` extended 14 → **16** subtests — adds CV-import via HTML and `PUT /api/profile` round-trip.
- `tests/router.test.mjs` ALIAS regex flipped to assert the new `settings → profile` direction.

### 📚 Docs

- `docs/help/{en,ru}.md` — full updates to sections 2/3/4: new App-settings tabs, edit-via-config message on the read-only Profile page, full upload-format matrix on the CV section, PDF auto-download behaviour.
- `docs/help/{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md` — concise mirrors of the new content blocks; section count unchanged (16) so the parity test stays green.

### 🔧 Internal

- New `server/lib/cv-import.mjs` — single source of truth for the format → markdown conversion, with timeout + missing-converter detection that surfaces actionable hints rather than 500s.
- `server/lib/routes/content.mjs` gains `POST /api/cv/import` and `PUT /api/profile` (binary-safe via `express.raw` for the upload, JSON for the YAML PUT).

---

## [1.9.1] — 2026-05-08

Production-readiness pass. Four targeted bug fixes (BF-1..BF-4), Playwright smoke expanded from 5 to 12 tests covering tracker / pipeline / reports / evaluate / config / cv save round-trips. All green in CI.

### 🐛 Bug fixes

- **`fix(tracker): escape pipes + collapse newlines in every cell, not just notes (BF-1)`** — a company name like `"Acme | Co"` previously broke the markdown table layout (parser split the cell into two). Cell sanitizer now applied uniformly to company / role / reportSlug / notes; companion fix in `parsers.mjs::parseMarkdownTable` adds GFM-compliant `\|` escape support so the round-trip is lossless.
- **`fix(config): wrap updateEnvFile in try/catch (BF-2)`** — `POST /api/config` previously bubbled an unhandled rejection on permission-denied / read-only filesystem. Now returns a clean 500 `{ error: 'failed to write parent .env', details: [...] }`.
- **`fix(llm): soft cap on assembled prompt size for Anthropic SDK calls (BF-3 + BF-4)`** — `/api/evaluate`, `/api/deep`, and `/api/mode/:slug` Anthropic branches now bail with 413 when `bundleProjectContext + prompt` exceeds 200 KB (≈50K tokens). Saves a multi-second roundtrip + tokens vs letting the API complain about context size. The cap is well below any current model ceiling (Sonnet 4.6 = 1M context).

### 🧪 Playwright smoke — expanded coverage

5 → **12** tests. New cases:

- `tracker view renders empty + accepts API-seeded row` — exercises BF-1 by seeding a row with a literal pipe in the company name and asserting the round-trip preserves it.
- `pipeline add-URL form populates the queue` + invalid-URL rejection sweep (loopback, `javascript:`, bare strings).
- `reports view handles empty state` — non-crash assertion.
- `evaluate view returns a manual prompt without API key` — verifies the fallback chain.
- `config GET returns known keys masked` — secrets never leak through `/api/config`.
- `cv.md PUT round-trips with sanitization` — XSS-y bits (script tags, `javascript:` schemes) get stripped end-to-end.
- `pipeline preview proxy strips scripts` — invalid-URL rejection path.

### 📦 Behavior changes (no API contract changes)

- Tracker writes are now lossless against pipe-laden company / role names. Existing rows with raw pipes will start parsing correctly on the next read.
- `/api/{evaluate,deep,mode/:slug}` will now return 413 instead of 502/timeout when the prompt is unreasonably large (200 KB+).

### 🧪 Tests

- **284 unit tests** (no change in count; existing tests still all green after parser update).
- **12 Playwright browser-smoke tests** (was 5).

---

## [1.9.0] — 2026-05-08

P-6 → P-10 from the v1.8.0 backlog all shipped in one bundle. Headline: `server/index.mjs` is now a 130-LOC orchestrator (down from 762, total 1230 → 130 = -89%); every route topic has its own module. Anthropic parity for `/api/evaluate`, multi-CLI shims, expanded i18n parity test, and Playwright browser-smoke wired into CI.

### 🏗️ P-6 — server split-by-concern (phase 2)

Continuation of P-2. Extracted the remaining 9 route topics out of `server/index.mjs` into `server/lib/routes/<topic>.mjs` modules. `index.mjs` is now a pure orchestrator: middleware (security headers + activity log + static), 12 `register<Topic>Routes(app)` calls, and the SPA catch-all.

- `server/lib/routes/activity.mjs` — `/api/activity`.
- `server/lib/routes/config.mjs` — `/api/config` GET/POST (parent .env round-trip).
- `server/lib/routes/health.mjs` — `/api/health` + `/api/dashboard`.
- `server/lib/routes/help.mjs` — `/api/help/:lang`.
- `server/lib/routes/jds.mjs` — full CRUD for `jds/*.txt`.
- `server/lib/routes/llm.mjs` — every LLM-bound endpoint (evaluate, deep, mode, apply-helper, interview-prep).
- `server/lib/routes/pipeline.mjs` — `/api/pipeline*` including the SSRF-safe preview proxy with named constants for timeout / max-redirects / max-body.
- `server/lib/routes/reports.mjs` — `/api/reports*`.
- `server/lib/routes/tracker.mjs` — `/api/tracker` GET + dedup-aware POST.

Behavior unchanged. 283/283 unit tests stayed green at every step. The orchestrator's import surface dropped from 47 lines to 22.

### 🔌 P-7 — Anthropic parity for `/api/evaluate`

`/api/evaluate` previously was Gemini-or-manual. v1.9.0 adds an Anthropic branch (preferred when both keys present), mirroring the routing rule already used by `/api/deep` and `/api/mode/:slug`. Routes through `bundleProjectContext({ modeSlugs: ['_shared', 'oferta'] })` so the model has the cv / profile / mode templates inlined (REVIEW-A1).

New endpoint: **`POST /api/evaluate/test-anthropic`** — smoke check for `ANTHROPIC_API_KEY`, mirrors the existing Gemini smoke. Sends a tiny prompt (≤256 output tokens) so it costs essentially nothing; returns a 200-char sample.

Fallback chain is now: Anthropic → Gemini → manual.

### 🌐 P-8 — Help-center i18n parity (audit + test hardening)

Audited every `docs/help/<lang>.md` for structure parity. All 8 locales already cover the same 14 canonical h2 sections. Tests upgraded:

- `tests/help-ui.test.mjs::every help doc covers the same 14 sections` was checking only en + ru. Now iterates **all 8 locales** (en, es, pt-BR, ko-KR, ja, ru, zh-CN, zh-TW) and asserts the section count for each.
- New test: `tests/help-ui.test.mjs::every help locale has substantive content` — guards against locale stubs by asserting each non-EN locale is at least 30% of `en.md`'s byte length. Compact translations naturally hit 40-50%; a stub would be in single-digit %.

Result: structural parity is now CI-enforced.

### 🤖 P-9 — Playwright browser smoke in CI matrix

`tests/playwright-smoke.mjs` (added in v1.8.0 as opt-in) is now part of the CI workflow. The existing `e2e` job already installs Playwright + Chromium; one new step (`npm run test:e2e:browser`) runs the 5 browser-smoke tests right after the comprehensive node E2E.

Order in CI: unit (Node 18/20/22 matrix) → smoke node E2E → comprehensive node E2E → **Playwright browser smoke** → screenshot artifact upload on failure.

### 🌍 P-10 — Multi-CLI compatibility

Parent career-ops v1.7.0 introduced multi-CLI / Open Agent Skill standard support. The UI sub-project follows the same convention with thin shims pointing at the canonical `CLAUDE.md`:

- `web-ui/AGENTS.md` — Codex / Aider / generic CLI entry point.
- `web-ui/GEMINI.md` — Gemini CLI entry point.

Both shims re-state the hard rules and quick reference but defer to `CLAUDE.md` for the full project-level instructions, so non-Claude CLIs land on the same orientation as Claude Code sessions. The deployed UI itself remains CLI-agnostic at runtime.

### 🧪 Tests

- **284 unit tests** (was 283): +1 new help-locale parity test.
- **5 Playwright browser-smoke tests** — now part of CI, not just opt-in.
- Coverage held.

### 🔧 Files touched

```
+ server/lib/routes/activity.mjs              + server/lib/routes/config.mjs
+ server/lib/routes/health.mjs                + server/lib/routes/help.mjs
+ server/lib/routes/jds.mjs                   + server/lib/routes/llm.mjs
+ server/lib/routes/pipeline.mjs              + server/lib/routes/reports.mjs
+ server/lib/routes/tracker.mjs
+ AGENTS.md                                   + GEMINI.md

~ server/index.mjs (762 → 130 LOC, -83%)
~ .github/workflows/ci.yml (Playwright smoke step)
~ tests/help-ui.test.mjs (all-8-locales section parity + content-floor)
~ docs/{ROADMAP,architecture/{OVERVIEW,SERVER}}.md
~ docs/sdd/CONVENTIONS.md
~ CLAUDE.md
~ package.json (1.8.0 → 1.9.0)
```

### 📦 New REST endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/evaluate/test-anthropic` | Smoke check for `ANTHROPIC_API_KEY` (P-7). Mirrors `/api/evaluate/test-gemini`. |

### 🤖 New CLI entry points

| File | CLI | Notes |
|---|---|---|
| `AGENTS.md` | Codex / Aider / generic | Points at `CLAUDE.md` for the full instructions. |
| `GEMINI.md` | Gemini CLI | Auto-loaded by Gemini at session start. |

---

## [1.8.0] — 2026-05-08

Hardening, refactor, and SDD bootstrap. Three high-severity correctness/security fixes (A1, A2, A3), four medium ones (B1–B4), six cleanups, audit of the parent career-ops v1.7.0 surface, server split-by-concern (P-2 phase 1), Playwright browser smoke harness, and a full SDD foundation under `docs/` and `.claude/`.

### 🔥 High-severity fixes

- **`fix(deep): inline cv/profile/mode files for Anthropic SDK calls (REVIEW-A1)`** — `/api/deep` and `/api/mode/:slug` previously told the model "read these files first" but the Anthropic SDK has no filesystem. Output was hollow. New `bundleProjectContext({ modeSlugs })` reads `cv.md`, `config/profile.yml`, `modes/_shared.md`, and the mode template, truncates each at 16 KB, and prepends a `<project_context>` block to the prompt. Verified live: 26 KB grounded markdown response from `claude-sonnet-4-6` for a deep-research call.
- **`fix(runner): SIGKILL escalation after SIGTERM grace period (REVIEW-A2)`** — `runNodeScript` and `streamNodeScript` previously sent only `SIGTERM` on timeout / client-disconnect. A child stuck in a syscall (DNS, blocked socket) ignored it, hanging the SSE connection until Node's GC reaped. Now each path arms a 5 s watchdog that escalates to `SIGKILL`. Promises always resolve.
- **`fix(runner): max-runtime cap on streaming endpoints (REVIEW-A3)`** — every SSE script runner (`/api/stream/{scan,liveness,pdf}`) now has a hard 30-minute ceiling. On expiry: emit `event: error { message: 'maximum runtime exceeded' }`, kill the child via the A2 watchdog, end the response.

### 🛡️ Medium-severity fixes

- **`fix(preview): per-hop redirect validation in /api/pipeline/preview (REVIEW-B1)`** — switched from `redirect: 'follow'` to manual redirect-walking. Each `Location` header is re-validated by `isValidJobUrl`; capped at 3 hops. Hostile boards can no longer bounce us to loopback / private IPs / `file://`. 4 new tests cover the rejection paths.
- **`refactor(keys): hasGeminiKey helper unifies LLM-key checks (REVIEW-B2)`** — direct `process.env.GEMINI_API_KEY` reads in route handlers replaced with `hasGeminiKey()` from `lib/anthropic.mjs`. Mirrors `hasAnthropicKey()` shape for consistency and easier mocking.
- **`feat(scanners): thread AbortSignal through hh.ru, Habr, Greenhouse, Ashby, Lever (REVIEW-B3)`** — when the SSE client disconnects mid-scan, in-flight HTTP fetches are now aborted instead of running every query to completion and dropping events. `runRuScan` and `runEnScan` accept `opts.signal`; SSE handlers in `/api/stream/scan-{ru,en}` create an `AbortController` and abort on `res.close`.
- **`test(anthropic): log-guard test prevents future API-key leaks via console (REVIEW-B4)`** — captures every `console.{log,info,warn,error,debug}` call during `runAnthropic` happy + error paths, asserts zero output and that the canary key string never appears. Defense-in-depth against a future `console.log(opts)` regression.

### 🧹 Low-severity polish

- **`fix(parsers): defense-in-depth URL gate inside addPipelineUrl (REVIEW-C4)`** — parser-level rejection of non-http(s) values, complementing the route-level `isValidJobUrl`. Optional `opts.validate` for callers that want stricter rules.
- **`docs(readme): badge "tests-88 passed" → "tests-277 passed" (REVIEW-C3)`** — was off by an order of magnitude.
- **`test(i18n): missing-keys diff grouped by locale (REVIEW-C6)`** — when `tests/i18n-coverage.test.mjs` finds a gap, output is now `[ru] (3): foo, bar, baz` instead of mixed lines.
- **`docs(review): C1 closed as resolved-on-inspection`** — sanitizer regexes were already in `\x00-\x08` hex form; review entry was a tool-rendering artifact.

### 🏗️ P-2 phase 1 — server split-by-concern

`server/index.mjs` was 1230 LOC, well past the 800-line ceiling. Split into focused modules without behavior change. All 283 unit tests stayed green at every step.

- `server/lib/security.mjs` — `isValidJobUrl`, `stripDangerousMarkdown`, `sanitizeJobDescription`, `isPubliclyExposed`. Re-exported from `index.mjs` for backward-compat with external consumers.
- `server/lib/prompts.mjs` — `bundleProjectContext`, `buildEvaluationPrompt`, `buildDeepPrompt`, `buildModePrompt`, `buildApplyChecklist`.
- `server/lib/store.mjs` — `safeReadApps`, `safeReadPipeline`, `safeListReports`, `checkProfileCustomized`, `ensureRussianPortalsDefaults`.
- `server/lib/routes/scan.mjs` — `registerScanRoutes(app)` for `/api/stream/scan-{ru,en}`, `/api/scan-ru/config`, `/api/scan-results`.
- `server/lib/routes/runners.mjs` — `registerRunnerRoutes(app)` for buffered `/api/run/*` table, streaming `/api/stream/{scan,liveness,pdf}`, generated-PDF list/download.
- `server/lib/routes/content.mjs` — `registerContentRoutes(app)` for CV / Profile / Portals / Modes.

`index.mjs` is now 762 LOC (-38%, under the 800 cap). Phase 2 will extract tracker, pipeline, reports, jds, llm (evaluate/deep/mode), and health into route modules. Targeting <500 LOC for the orchestrator.

### 🔍 Parent career-ops v1.7.0 audit

The user updated the parent project to v1.7.0. Audited every consumed surface — UI is fully compatible. Notable findings documented in `docs/architecture/DATA-FLOWS.md`:

- Modes catalog grew from 7 to 19 files. UI's `MODE_ALLOWLIST` deliberately surfaces only 7 (others are Claude-Code-only). Comment added explaining the intentional narrow scope.
- `portals.yml` schema confirmed: `tracked_companies` (96 entries, 87 enabled, 71 with API). EN scanner reads it correctly; legacy `companies` key still supported.
- New parent surfaces NOT consumed today: `dashboard/` (Go program), `update-system.mjs`, `generate-latex.mjs`, `analyze-patterns.mjs`, `liveness-core.mjs`, `followup-cadence.mjs`, `test-all.mjs`, localized mode subdirs (`de/fr/ja/pt/ru`).
- Live `/api/dashboard`, `/api/health`, `/api/modes`, `/api/portals`, `/api/profile`, `/api/cv`, `/api/jds`, `/api/reports`, `/api/tracker`, `/api/pipeline`, `/api/evaluate`, `/api/deep`, `/api/stream/scan-en` all verified green.

### 🤖 SDD / GSD bootstrap

`career-ops-ui` now has a full Spec-Driven Development foundation aligned with the GSD pipeline (`gsd-*` skills from `superpowers@claude-plugins-official`).

- `CLAUDE.md` (root) — project-level agent system prompt: stack, GSD pipeline, hard rules (parent contract, security envelope, no `--no-verify`), conventions, parent-project boundary.
- `.aiignore` — exclusion list for AI agents: vendored, binaries, parent user data, `.planning/`, `.env`, locale duplicates.
- `.claude/agents/` — three project-specific subagent definitions:
  - `web-ui-route-reviewer.md` — gates new routes against SSRF, CSP, sanitizers, parent-write contract, conventions, tests.
  - `spa-view-reviewer.md` — CSP-safe DOM, i18n, router registration, accessibility.
  - `test-isolation-reviewer.md` — verifies tests are CI-isolated (no parent-project assumptions, no live network, no port collision).
- `.claude/commands/` — slash-command stubs: `/sdd-status`, `/codebase-tour`.
- `docs/` tree — all in English:
  - `PROJECT.md` — what/why/for-whom, scope, constraints, success criteria.
  - `ROADMAP.md` — current milestone + completed history + backlog.
  - `sdd/SDD-GUIDE.md` — discuss → spec → plan → execute → verify → review pipeline mapped to `gsd-*` skills.
  - `sdd/CONVENTIONS.md` — module system, naming, routes, sanitizers, client patterns, i18n, errors, logging, testing, commits, branches, CSS.
  - `architecture/OVERVIEW.md` — top-level diagram, layers, boot sequence, invariants, "where to look first when…" cheat sheet.
  - `architecture/SERVER.md` — per-file map for `server/lib/*.mjs` (updated for P-2 split).
  - `architecture/FRONTEND.md` — SPA structure, view inventory, globals, "how to add a view".
  - `architecture/API.md` — full inventory of every `/api/*` route.
  - `architecture/DATA-FLOWS.md` — every parent-project read/write, with the explicit-user-action contract.
  - `reviews/REVIEW-2026-05-07.md` — static review that produced this changelog's fixes.

### 🔒 Security & repo hygiene

- **`chore(.gitignore): comprehensive defense-in-depth patterns`** — covers env variants, IDE folders, GSD scratch (`.planning/`), per-user agent settings (`.claude/settings.local.json`, `.claude/cache/`, `.claude/state/`, `.claude/memory/`), Playwright artifacts (`playwright-report/`, `test-results/`, `.playwright/`, `trace.zip`), heap/CPU profiles, lockfiles for unshipped tooling, expanded macOS Finder noise, generic secret patterns (`secrets.json`, `credentials.json`, `*.pem`, `*.key`).

### 🧪 Tests

- **283 unit tests** (was 277): +6 new (4 for B1 redirect-rejection, 1 for `hasGeminiKey`, 1 for `runAnthropic` log-guard).
- **5 Playwright browser-smoke tests** (new, opt-in via `npm run test:e2e:browser`): dashboard render + version footer, dashboard → scan → pipeline → cv navigation, language-switch persistence, 404 view, health-page render. Resolves Playwright via parent's `node_modules` — no new dependency.
- Coverage held at ~93% line / ~83% branch.

### 📝 New / updated package.json scripts

| Script | Purpose |
|---|---|
| `npm run test:e2e:browser` | Run Playwright smoke harness against in-process server (5 tests). |

### 🔧 Files touched

```
+ CLAUDE.md                                    +  .aiignore
+ docs/PROJECT.md                              +  docs/ROADMAP.md
+ docs/sdd/SDD-GUIDE.md                        +  docs/sdd/CONVENTIONS.md
+ docs/architecture/OVERVIEW.md                +  docs/architecture/SERVER.md
+ docs/architecture/FRONTEND.md                +  docs/architecture/API.md
+ docs/architecture/DATA-FLOWS.md              +  docs/reviews/REVIEW-2026-05-07.md
+ .claude/agents/web-ui-route-reviewer.md      +  .claude/agents/spa-view-reviewer.md
+ .claude/agents/test-isolation-reviewer.md
+ .claude/commands/sdd-status.md               +  .claude/commands/codebase-tour.md
+ server/lib/security.mjs                      +  server/lib/prompts.mjs
+ server/lib/store.mjs
+ server/lib/routes/scan.mjs                   +  server/lib/routes/runners.mjs
+ server/lib/routes/content.mjs
+ tests/playwright-smoke.mjs

~ .gitignore                                   ~  README.md (badge fix)
~ package.json (1.7.2 → 1.8.0)
~ server/index.mjs (1230 → 762 LOC)
~ server/lib/runner.mjs (SIGKILL escalation, max-runtime cap)
~ server/lib/anthropic.mjs (hasGeminiKey)
~ server/lib/parsers.mjs (URL gate in addPipelineUrl)
~ server/lib/ru-scanner.mjs                    ~  server/lib/en-scanner.mjs
~ server/lib/sources/{hh,habr,greenhouse,ashby,lever}.mjs (signal threading)
~ tests/anthropic.test.mjs                     ~  tests/i18n-coverage.test.mjs
~ tests/pipeline-preview.test.mjs
```

---

## [1.7.2] — 2026-05-04

Help center, in-UI App settings, mobile sidebar, single Scan button, and a "Show result" shortcut on every prompt-builder.

### ✨ New features

- **`feat(help): in-app user guide` (`/#/help`)** — long-form Markdown documentation accessible from a new sidebar entry. Covers every page step-by-step: quick start, CV editor, Profile, Scan filters, Pipeline preview, Evaluate, Deep research, Apply, Tracker, Reports, all 7 modes, Activity log, Health, setup hints. Auto-built sticky table of contents from `<h2>` headings, synchronous DOM build (no race). Localized for all 8 supported locales.
- **`feat(config): in-UI App settings page` (`/#/config`)** — edit `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `HH_USER_AGENT`, `PORT`, `HOST` from the browser. Writes to the **parent project's** `.env` file so career-ops Node scripts AND web-ui's dotenv loader pick up the same source. Secret keys masked on read (first/last 4 chars). Model fields are dropdowns with curated lists (claude-sonnet-4-6 / claude-opus-4-7 / claude-haiku-4-5 / gemini-2.0-flash / etc.). Empty value deletes the key. Values applied to running process.env immediately — no restart for most settings.
- **`feat(modes): "⚡ Show result" button alongside "Copy prompt"`** — when a prompt is generated in manual mode, users no longer have to retype their inputs to get the LLM result. The new button re-submits the same form with `run: true`, falling through to a clear toast (`Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env first`) when no key is configured. Works on `/#/deep`, `/#/project`, `/#/training`, `/#/followup`, `/#/batch`, `/#/contacto`, `/#/interview-prep`, `/#/patterns`.

### 🐛 UX + UI fixes

- **`fix(scan): single Scan button replaces three (Scan all + EN + RU)`** — overwhelming choice, identical default in 99% of cases. The unified `🌐 Scan` button runs every enabled source. Help docs updated across 8 locales.
- **`fix(ui): mobile sidebar drawer`** — viewport <900px now gets a hamburger button (☰) in the topbar; `body.sidebar-open` toggles a CSS transform that slides the sidebar in. Backdrop dim + click-anywhere closes it. Anchor click + hashchange auto-close so the user lands on the new page with the drawer tucked away. Larger viewports unaffected.
- **`fix(server): footer version reflects web-ui, not the parent VERSION`** — `/api/health` now reads web-ui's own `package.json`. The footer no longer leaks a stale `1.6.0` from the parent's version file. Parent's VERSION is still surfaced separately as `parentVersion`.

### 📦 New REST endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/help/:lang` | Returns the Markdown user guide for the requested locale, falling back to `en.md`. Path-traversal-safe. |
| `GET`  | `/api/config` | Returns current values for all known env keys; secrets masked. |
| `POST` | `/api/config` | Writes the given keys into the parent project's `.env`, validates each value, applies live to `process.env`. |

### 🌐 i18n

- 30+ new keys across `nav.help`, `nav.config`, `help.*`, `config.*`, `deep.showResult`, `deep.needKey`, `scan.btnRun`. All 8 locales populated.

### 🧪 Tests

- `tests/help.test.mjs` (12 cases) — every supported locale returns substantive markdown, EN spot-checks every page slug, unknown lang → EN fallback, path-traversal sanitized, every locale references `cv.md` / `profile.yml` / `.env`.
- `tests/help-ui.test.mjs` (9 cases) — view file registration, sidebar entry, i18n keys present in every locale, docs files exist for every locale, EN/RU help has 14 canonical sections, every #/foo route covered, Show-result wiring on deep + mode-page.
- `tests/env-config.test.mjs` (18 cases) — pure-function tests for `parseEnv`, `maskSecret`, `validateConfig`, `updateEnvFile` (bootstrap, in-place rewrite preserving comments, empty-value delete, quote-when-needed).
- `tests/config-endpoint.test.mjs` (8 cases) — GET masks secrets / returns env path; POST writes to parent .env; live process.env application; empty-value unsets; rejects unknown keys + malformed Anthropic keys with 400.

### 📊 Stats

- **Tests:** 233 → **277** (+44 across 4 new test files).
- **E2E:** 20 smoke + 23 comprehensive = 43 Playwright steps, all green.
- **Coverage:** 93.5% line / 82.6% branch / 93.7% funcs (unchanged — new code is fully tested).

---

## [1.7.1] — 2026-05-04

Patch release stacking the post-v1.7.0 work: pipeline preview pane, Anthropic API integration, scrollable sidebar, dotenv loader, dynamic Active-companies list, CI workflow hardening.

### ✨ Pipeline preview pane

- **`/#/pipeline` overhaul** — left list + right preview pane. Click any URL to fetch a server-side proxied snapshot (`GET /api/pipeline/preview` strips scripts/styles/tags, caps at 8 KB, validated through `isValidJobUrl`). Live filter input, "In queue" counter, ⚡ "Evaluate first" header button. Inline ▶/✕ on every row plus full Evaluate / Open in tab / Delete on the preview pane. Stable test selectors via `data-url` + `.pipeline-row` + `.pipeline-row-delete` classes. **8 new tests** in `tests/pipeline-preview.test.mjs` (mocked fetch, no upstream binding needed).

### ✨ Anthropic API integration — "Run live" everywhere

- **`server/lib/anthropic.mjs`** — zero-dependency client for Anthropic Messages API (claude-sonnet-4-6 default, override via `ANTHROPIC_MODEL`). When `ANTHROPIC_API_KEY` is set, every mode page (`/#/deep`, `/#/project`, `/#/training`, `/#/batch`, `/#/contacto`, `/#/interview-prep`, `/#/patterns`) renders an "⚡ Run live (Anthropic)" button as the **primary** action — clicking executes the prompt and renders Markdown back into the browser instead of handing off to Claude Code. Gemini stays as fallback when only its key is set. Manual mode still works with no keys at all. **8 new tests** in `tests/anthropic.test.mjs`.

### 🐛 CI / pipeline fixes

- **`fix(api): tighten pipeline URL validator` (FIX-M7)** — now also rejects loopback hostnames, length <10 or >2000, whitespace inside URLs.
- **`fix(server): actually load .env so HH_USER_AGENT / GEMINI_API_KEY hints work`** — added `server/lib/dotenv.mjs` (35-line zero-dep loader) wired in at the top of `server/index.mjs`. The runtime hints in scanner code finally do something. **6 new tests**.
- **`fix(ui): scrollable sidebar`** — 18 nav items in 6 groups overflowed shorter viewports. `.sidebar` now has `overflow-y: auto` with thin custom-styled scrollbars.
- **`fix(ui): make HH_USER_AGENT banner dismissible`** — then removed entirely from `/scan` once we realized it was overkill. Health page check still surfaces it.
- **`fix(scan): Active companies list is now collapsible + filterable + grouped`** — 87 tags flat was overwhelming. Now a "▸ Active companies 87/71" toggle expands an ordered list (✓ API-backed first, ○ websearch second) plus a search filter.
- **`fix(test): isolate api.test.mjs + en-scanner.test.mjs from parent project`** — both now spin up tmp project roots so CI works without the parent checked out alongside web-ui.
- **`fix(workflow): publish-package version-match only on release events`** — `workflow_dispatch` from main no longer fails the tag/version check.
- **`fix(e2e): stable selector for pipeline row delete`** — restored anchor wrapper + added `data-url` attribute so e2e suite is selector-stable.

### 📦 New REST endpoint

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/pipeline/preview?url=…` | Server-side proxy: returns visible-text snapshot of the URL (scripts/styles stripped, 8 KB cap), gated by `isValidJobUrl`. |

### 📊 Stats after this batch

- **Tests:** 225 → **233** (8 more on top of v1.7.0).
- **Test files:** 25 → **26**.
- **E2E:** 20 + 23 = 43 Playwright steps, all green.

---

## [1.7.0] — 2026-05-03

A 35-commit hardening + UX + feature-completion pass driven by QA r5. Three security layers landed (XSS sanitization, CSP, input validation), every missing CRUD endpoint was filled in, the parent-project bootstrap is now fully automated, and the UI gained **9 new pages** — Activity, redesigned Deep Research, plus 7 sidebar-grouped modes (project / training / followup / batch / outreach / interview-prep / patterns) covering 100% of parent's `modes/`. Pipeline gained a server-side preview pane. Anthropic API integration makes "Run live" a one-click action across all modes. Test coverage went from **73** to **225**, across **25 test files**, plus **23 comprehensive Playwright e2e steps**. GitHub Actions ship CI / AI review / Release / Publish-Package workflows.

### 🔒 Security

- **`fix(cv): sanitize CV markdown to block stored XSS in preview` (FIX-C10)** — `PUT /api/cv` now strips `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<form>`, `<svg>`, `on*=` event handlers, and `javascript:`/`vbscript:`/`data:text/html` URIs before writing `cv.md`. Body capped at 1 MB (413 on overflow). Client-side `UI.md()` was rewritten to escape every byte before any markdown transformation runs, so raw HTML can never reach `innerHTML`. Link `href` attributes are validated against an allowlist of safe schemes (`http`/`https`/`mailto`/`tel`/relative + `data:image` only). 17 new tests across the strip helper and HTTP round-trips.
- **`fix(server): add CSP and baseline security headers` (FIX-L2)** — every response now carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`. When the server binds beyond loopback (`HOST` ≠ `127.0.0.1`/`::1`/`localhost`), a strict `Content-Security-Policy` is layered on top: `default-src 'self'`, `script-src 'self'` (no `unsafe-inline`), Google Fonts whitelisted, `connect-src 'self'` blocks XSS exfiltration. Inline `onclick` handlers in `index.html` and `router.js` were moved to `addEventListener` to keep the strict CSP intact. 8 new tests gating CSP across 5 different `HOST` values.
- **`fix(api): tighten pipeline URL validator` (FIX-M7)** — `POST /api/pipeline` used to accept `"not-a-url"` and persist it. Now `isValidJobUrl()` rejects bare strings, inputs <10 or >2000 chars, whitespace-containing URLs, non-`http(s)` schemes, and loopback hostnames (`localhost`/`127.0.0.1`/`::1`). Folds in **FIX-M3** + **FIX-M6** (return 400 on invalid, plus a `deduped` flag on success).
- **`fix(server): actually load .env so HH_USER_AGENT / GEMINI_API_KEY hints work`** — previously the runtime told users to "set HH_USER_AGENT in .env" but the server never read that file, so following the instruction did nothing. Adds a 35-line zero-dependency dotenv loader (`server/lib/dotenv.mjs`) wired in at the top of `server/index.mjs`. Process-env values set on the command line still win, so existing CI overrides aren't shadowed. Parent's `.env.example` now includes a documented `HH_USER_AGENT` block with a real-Chrome User-Agent example. 6 new tests.
- **`fix(api): sanitize JD before prompt assembly` (FIX-M5)** — `POST /api/evaluate` strips ANSI escapes, control bytes, inline `<script>` tags, and trims whitespace before either calling Gemini or echoing the prompt back. 50 KB length cap. The 50-char minimum runs against the *sanitized* text, so prompt-injection attempts that look long enough but consist mostly of escapes fail-fast with 400.
- **`fix(health): mask Node version + project root when HOST!=loopback` (FIX-M1)** — `/api/health` no longer fingerprints the host on LAN-exposed deployments. Loopback responses keep the values for local diagnostics.

### ✨ New features

- **`feat: 7 new sidebar modes + grouped sidebar` (FIX-C8)** — covers 100% of the parent's `modes/` directory with no UI gaps. New routes: `#/project` (portfolio project advisor), `#/training` (course / cert evaluation), `#/followup` (per-application cadence), `#/batch` (parallel URL processor), `#/contacto` (LinkedIn outreach drafter), `#/interview-prep` (stage-specific prep), `#/patterns` (rejection-pattern analyzer). All seven share a single config-driven view factory (`public/js/views/mode-page.js`) and a single generic endpoint `POST /api/mode/:slug` — adding a new mode in the future is one config row + one i18n block. Sidebar reorganized into 6 groups: Sourcing / Decision / Application / Networking / Analytics / Setup. 18 nav items total. 12 new tests in `tests/modes-endpoints.test.mjs`.
- **`fix: bootstrap parent deps + russian_portals defaults` (FIX-C4 + C9 + C12 + H2)** — `bin/start.sh` now installs the parent's `node_modules` (js-yaml, playwright, jsdom) AND `npx playwright install chromium` on fresh clones, so `/api/stream/scan`, `/pdf`, and `/liveness` work end-to-end out of the box. `createApp()` probes `portals.yml` on every boot — if the `russian_portals:` block is missing, appends a documented default with comments. Idempotent: the second boot is a no-op. 3 new tests.
- **`fix: disable 9 dead portal slugs in template + health-check script` (FIX-C3)** — `templates/portals.example.yml` now ships with Ada / Factorial / Tinybird / Weights & Biases / Travelperk / Clarity AI / Forto / Vinted / Runway flagged `enabled: false` (each entry has an inline reason comment). New installs scan **87** alive companies instead of 96. New `web-ui/scripts/portals-health-check.mjs` HEAD-probes every enabled `careers_url` and reports DEAD entries with a suggested patch list (JSON output via `--json`). 3 new tests.
- **`feat(activity): user-action log + Activity sidebar page`** — every state-changing API request is captured to `data/activity.jsonl` (timestamp, action verb, target, success flag, optional detail). New sidebar entry **Activity** with action-prefix chip filters (pipeline / cv / jd / evaluate / scan / stream / script), action ✓/✗ badges, and refresh button. Auto-rotates at 5 MB. 10 new tests covering middleware, read filters, corrupt-line tolerance, and the recursion guard for `GET /api/activity` itself.
- **`feat(deep): view Deep Research in browser + saved-results archive`** — the Deep Research page now (a) runs the prompt through Gemini live when `{ run: true }` and `GEMINI_API_KEY` is set, persisting output to `interview-prep/{slug}.md`; (b) lists every saved deep-research file as clickable cards with relative timestamps; (c) renders results as Markdown with **📋 Copy / ⬇ Download .md / ↗ Open in tab** actions per result. New REST surface: `GET /api/interview-prep`, `GET /api/interview-prep/:name`, `DELETE /api/interview-prep/:name`. 7 new tests.
- **`feat(cv): generate + download PDF in browser, with PDF archive`** — new **📄 Generate PDF** button on the CV page streams `/api/stream/pdf` in a modal console. On `ERR_MODULE_NOT_FOUND` / `playwright` errors, it surfaces a copy-pasteable bootstrap command. New "Generated PDFs" section auto-loads after each successful run, listing every `output/*.pdf` with **↗ Open** and **⬇ Download** buttons. New REST surface: `GET /api/output/pdfs`, `GET /api/output/pdfs/:name`. 6 new tests.
- **`feat(api): POST /api/tracker — append rows from the UI` (FIX-H8)** — append a canonical row to `data/applications.md` from the browser. Validates company + role, normalizes status against `templates/states.yml`, auto-increments zero-padded `#`, dedups by company+role (case-insensitive), pipe-escapes notes so the markdown table doesn't fracture. Bootstraps the table when the file is empty. 6 new tests.
- **`feat(api): DELETE /api/jds/:name` (FIX-H4)** — remove saved JDs without shelling out. Path-traversal characters are stripped before any filesystem touch; the parameter must end in `.txt`. 5 new tests, including `../../etc/passwd` refusal.
- **`feat(api): POST /api/evaluate/test-gemini` (FIX-H7)** — smoke-test endpoint that runs a 50-char dummy JD through `gemini-eval.mjs` so the user can verify the API key works without sitting through a real evaluation. Returns `{ ok, code, sampleLength, sample }`.

### 🐛 Bug fixes

- **`fix(router): catch-all 404 view + i18n coverage guard` (FIX-C7)** — unknown hash routes used to silently fall back to the dashboard, masking typos and broken bookmarks. Now `#/totally-random-xyz` renders a dedicated 404 page that quotes the bad path back and links to the dashboard. The 404 view is registered inside the router IIFE itself so it cannot collide with any user route. New `tests/i18n-coverage.test.mjs` runs `i18n.js` inside a `vm.Context` with a stub `window`, exposes the private `DICT`, and asserts every one of the 173+ keys × 8 locales is populated and non-empty. 4 new router tests.
- **`fix(router): alias #/profile → settings` (FIX-C2)** — the internal route name is `settings` (with `nav.settings` rendering "Profile") but external links and muscle memory go to `#/profile`. Now both addresses reach the same view, and the sidebar nav-item lights up either way. 2 new tests.
- **`fix(health): unify Health/Doctor + flag template profiles` (FIX-C6 + FIX-H6)** — Health and Doctor were two different sources of truth. Now `/api/health` exposes everything Doctor reports (parent-deps, Playwright, dirs, profile-customized, `HH_USER_AGENT`). The `Profile customized` check detects placeholder names (`Jane Smith`, `Alex Doe`, `John Doe`, `Your Name`, `Test User`) and explicit YAML parse errors. 4 new tests.
- **`fix(scan): warn on query↔negative collisions in RU config` (FIX-H3)** — when `portals.yml` ships with `"PHP"` in `title_filter.negative` while the queries target Senior PHP, every match gets filtered and the user sees zero results. `loadConfig()` now computes a `warnings` array; `runRuScan()` emits each warning as an SSE stderr line before the scan starts. 2 new tests verify the shipped defaults stay PHP-friendly out of the box.
- **`fix(scan): warn when HH_USER_AGENT is unset` (FIX-H1)** — the `/scan` page probes `/api/health` and shows a yellow warning card above the action row when `HH_USER_AGENT` is empty, so users know about the hh.ru 403 *before* they click RU scan.
- **`fix(api): warn when POST /api/jds slug had unsafe chars stripped` (FIX-M2)** — slug normalization that strips dangerous characters now returns a `warning` field; pure case/whitespace cleanup stays silent. Empty result after sanitization returns 400.
- **`fix(ui): clear global search on route change + button spinners` (FIX-M4 + FIX-L1)** — the global-search input is cleared on `hashchange` (with a guard for active typing). New `UI.withSpinner(button, fn)` helper wires loading state, ARIA, and double-click prevention into every async button click. Already adopted on Doctor / Verify / sync-check / Save CV / Normalize / Dedup / Merge buttons.
- **`fix(ui): make sidebar scrollable so 18 nav items always reach the footer`** — the grouped sidebar from FIX-C8 overflowed shorter viewports; bottom items (Activity / Health) were clipped. `.sidebar` now has `overflow-y: auto` with thin custom-styled scrollbars (WebKit + Firefox). Footer stays pinned via the existing `margin-top: auto`.
- **`fix(ui): empty modal-title placeholder` (FIX-H9)** — the hardcoded English `"Title"` string in `index.html` is gone, closing the brief race window where it was visible during modal open.

### 🌐 i18n

- 173+ translation keys × 8 supported locales (`en`, `es`, `pt-BR`, `ko`, `ja`, `ru`, `zh-CN`, `zh-TW`). New keys added across all locales for: 404 page, activity log, deep research, PDF flow, security warnings, tracker mutation, apply rename. Coverage is now enforced by `tests/i18n-coverage.test.mjs` — every key must have a non-empty value in every supported locale or CI fails.

### ⚙️ DevOps

- **Test count:** 73 → **201** (+128 tests across 23 test files). The single remaining failing test (`runEnScan: dry-run end-to-end across multiple sources`) is a pre-existing flake dependent on Greenhouse/Ashby/Lever live API responses.
- **Comprehensive Playwright e2e** (`tests/e2e-comprehensive.mjs`, 23 steps): walks the full user journey — CV save → preview → PDF generation → all 7 new modes → tracker filters → activity log → 404 → modal ESC → sidebar scroll → Ctrl-K focus → search clear → profile alias → language persistence.
- **GitHub Actions** (`.github/workflows/`):
  - `ci.yml` — unit + integration tests on Node 18/20/22 matrix, plus i18n coverage gate (every key × 8 locales must be non-empty), plus the full Playwright e2e on every PR.
  - `ai-review.yml` — Claude Code AI review on every PR. Maintainers retain merge authority; Claude only suggests. Skip via `skip-ai-review` label.
  - `release.yml` — auto-publish a GitHub Release when a `v*.*.*` tag is pushed; release notes are sliced from `CHANGELOG.md` so all 8 language variants stay the canonical source.
- **CSP-friendly UI:** all inline `onclick` handlers removed from `index.html` and `router.js`. The strict `script-src 'self'` policy is now enforceable without breaking any feature.

### 📦 New REST endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`    | `/api/activity`                  | List user-action events, newest first |
| `GET`    | `/api/interview-prep`            | List saved Deep Research files |
| `GET`    | `/api/interview-prep/:name`      | Read a single Deep Research file |
| `DELETE` | `/api/interview-prep/:name`      | Remove a Deep Research file |
| `GET`    | `/api/output/pdfs`               | List generated PDFs |
| `GET`    | `/api/output/pdfs/:name`         | Stream a PDF as an attachment |
| `POST`   | `/api/tracker`                   | Append a row to `applications.md` |
| `DELETE` | `/api/jds/:name`                 | Remove a saved JD |
| `POST`   | `/api/evaluate/test-gemini`      | Smoke-test the Gemini API key |
| `POST`   | `/api/mode/:slug`                | Generic prompt builder for the 7 new modes (project / training / followup / batch / contacto / interview-prep / patterns) |

---

## [1.6.0] — 2026-05-02

Initial public release of the web UI. See `README.md` for the feature inventory at this baseline.
