# Changelog (Italiano)

> Questo changelog inizia dalla v1.85.0 — la versione in cui è stata aggiunta la localizzazione italiana. Per le versioni precedenti vedi [🇬🇧 CHANGELOG.md](CHANGELOG.md).

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
