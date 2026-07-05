# Changelog (Italiano)

> Questo changelog inizia dalla v1.85.0 — la versione in cui è stata aggiunta la localizzazione italiana. Per le versioni precedenti vedi [CHANGELOG.md](CHANGELOG.md).

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
