# Changelog (Italiano)

> Questo changelog inizia dalla v1.85.0 — la versione in cui è stata aggiunta la localizzazione italiana. Per le versioni precedenti vedi [🇬🇧 CHANGELOG.md](https://github.com/Fighter90/career-ops-ui/blob/main/CHANGELOG.md).

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
- **LICENSE nomina l'autore** — la riga di copyright ora recita: *Sergey Emelyanov (Fighter90) <https://sergey-cv.com> and career-ops-ui contributors* (testo MIT canonico intatto). Un nuovo **NOTICE.md** dettaglia il licenziamento: chi detiene il copyright, cosa copre esattamente la concessione MIT (codice, doc, traduzioni, la landing, la wiki), cosa NON copre (i tuoi dati a runtime, il progetto padre, i contenuti delle job board, i marchi), la tabella dei componenti di terze parti (express/js-yaml — MIT; Astro/Tailwind — MIT; i font Figtree e JetBrains Mono — SIL OFL 1.1; sharp — Apache-2.0) e una riga di attribuzione facoltativa.

## [1.119.3] — 2026-07-13

### Aggiunto
- **SECURITY.md** — la security policy a cui puntava CONTRIBUTING ora esiste: versioni supportate, flusso di segnalazione privata (il **private vulnerability reporting** di GitHub è ora **abilitato** sul repo — scheda Security → «Report a vulnerability»), il modello di minaccia per un'app mono-utente su localhost (in scope: XSS via annunci ostili / SSRF / path traversal / fuga di segreti / indebolimento della CSP; fuori scope: DoS del proprio localhost e problemi del progetto padre) e la baseline di hardening per i reviewer.

## [1.119.2] — 2026-07-13

### Aggiunto
- **CONTRIBUTING.md** — la guida del contributore a cui landing e README puntavano da sempre ora esiste: installazione, mappa del progetto, le regole dure sicurezza/no-build, i livelli di test, il walkthrough dei «due registri» per aggiungere una sorgente di scansione, il contratto i18n ×16, le convenzioni di commit/PR e il processo di release.
- **Bandiere delle lingue sulla landing** — il selettore di lingue di cvstart.org, la griglia delle lingue nel footer e il banner «leggi nella tua lingua» ora mostrano la bandiera di ogni locale accanto al suo endonimo (lo stesso set di indicatori regionali del `<select>` di lingua dell'app; degrada a lettere di regione dove mancano i glifi delle bandiere).
- **Correzioni del footer della landing** — il link morto a Discussions (funzione non abilitata sul repo) ora punta alla **wiki** del progetto, e il footer accredita l'autore: **Sergey Emelyanov** ([sergey-cv.com](https://sergey-cv.com/) · [LinkedIn](https://www.linkedin.com/in/sergey-emelyanov-in-job/)).

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
