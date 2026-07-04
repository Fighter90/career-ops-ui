# Changelog (Italiano)

> Questo changelog inizia dalla v1.85.0 — la versione in cui è stata aggiunta la localizzazione italiana. Per le versioni precedenti vedi [CHANGELOG.md](CHANGELOG.md).

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
