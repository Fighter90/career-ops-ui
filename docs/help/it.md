# Guida — career-ops-ui

Una guida completa a ogni pagina, dal momento in cui avvii
l'applicazione fino a ottenere un colloquio. Ogni intestazione `##` qui
sotto corrisponde a una voce della barra laterale o a una fase del
flusso di lavoro. Alla prima esecuzione leggila dall'alto verso il
basso; in seguito passa a una sezione specifica tramite l'indice nella
barra laterale della guida.

> **Destinatari:** chiunque abbia appena inserito questa UI dentro un
> checkout di `career-ops` ed eseguito `bash bin/start.sh`. Non si
> presuppone alcuna conoscenza pregressa di career-ops.

### Informazioni su career-ops

[career-ops](https://career-ops.org) è un sistema di ricerca di lavoro
open source che gira come slash command dentro qualsiasi CLI di coding AI (Claude Code, Gemini CLI, Codex, Qwen Code, OpenCode, GitHub Copilot CLI — anche altre CLI compatibili con Claude funzionano tramite la stessa superficie di slash command). È indipendente dal modello. Valuta
ogni offerta di lavoro rispetto al tuo CV con una rubrica a sei
dimensioni da 0.0 a 5.0, genera curriculum PDF su misura e traccia ogni
candidatura localmente sulla tua macchina.

**Riferimento canonico (leggili in quest'ordine alla prima installazione):**

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
  — il sistema, i principi e l'inventario dei concetti.
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
  — scopri offerte di lavoro; popola il Pipeline.
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
  — flusso completo di candidatura con lettura del modulo tramite Playwright.
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  — valuta 10+ JD in una volta con `batch-runner.sh`.
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)
  — installa Chromium + registra l'MCP per PDF e compilazione moduli.

**Principi fondanti** (da
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

- **Open source, sul serio** — MIT, nessun piano a pagamento, nessuna
  lista d'attesa, nessuna telemetria, nessun account. Il sistema opera
  senza livelli a pagamento, account o telemetria. I contributi al
  codice passano una revisione della community prima del rilascio.
- **Sovranità dei dati** — `cv.md`, `config/profile.yml`, `data/`,
  `reports/`, `interview-prep/` non lasciano mai il tuo portatile a meno
  che tu non li invii esplicitamente. Lo esegui localmente sulla tua
  macchina, conservando la piena sovranità sui dati.
- **Architettura agnostica rispetto all'AI** — career-ops NON include un
  modello. Funziona come comandi dentro le CLI di coding AI esistenti.
  Cambia provider (Anthropic ↔ Gemini ↔ OpenAI) e la tua cronologia di
  valutazioni resta coerente.
- **Candidature controllate dall'uomo** — career-ops redige le risposte
  e apre il modulo, ma **sei tu a fare clic su Invia**. Il sistema non si
  candida mai automaticamente. Il sistema fornisce struttura e
  valutazione; gli esseri umani mantengono l'autorità finale sull'invio.
- **Ricerca strutturata** — costruito per una ricerca di lavoro attiva e
  deliberata con molte candidature; non è uno strumento a invio singolo,
  non è un motore di raccomandazione. La configurazione richiede ~15
  minuti e presuppone dimestichezza con il terminale.

**Cosa career-ops NON è** (obiettivi esplicitamente esclusi):

- Non è un candidatore automatico. Non invierà moduli al posto tuo.
- Non è un ricostruttore di curriculum. Adatta per singola JD; non
  inventa esperienza.
- Non è un ottimizzatore LinkedIn. Il tuo profilo è affar tuo.
- Non è un sostituto del foglio di calcolo che si nasconde dietro una UI
  SaaS. I dati sono semplice markdown sul tuo filesystem.

**Concetti chiave** (inventario completo — ogni artefatto che
career-ops tocca):

| Concetto | Cos'è |
|---|---|
| **Mode** | Un template di prompt sotto `modes/<slug>.md`. Integrati: `oferta`, `deep`, `apply`, `pipeline`, `batch`, `contacto`, `followup`, `interview-prep`, `patterns`, `project`, `training`, `ofertas`, `auto-pipeline`, `pdf`, `latex`, `scan`, `tracker`. |
| **Archetype** | Un profilo di ruolo target in `config/profile.yml`. La rubrica pesa le corrispondenze di competenze rispetto all'archetipo attivo — **il singolo campo più importante**. |
| **Pipeline** | `data/pipeline.md` — casella di posta di URL di JD in attesa di essere valutate. |
| **Tracker** | `data/applications.md` — tabella GFM storica di ogni valutazione + stato della candidatura. |
| **Report** | `reports/<NNN>-<company>-<DATE>.md` — valutazione A–F completa per JD, con punteggio + legittimità nell'intestazione. |
| **Scan history** | `data/scan-history.tsv` — log solo in accodamento; previene i duplicati tra le scansioni. |
| **Proof points** | Blocchi di evidenza STAR+R estratti da `cv.md`, riutilizzati nella valutazione, nelle risposte di candidatura, nella preparazione ai colloqui. |
| **JD store** | `jds/jd-<date>-<ts>.txt` — descrizioni di lavoro alla lettera salvate durante la valutazione per la tracciabilità. |
| **Interview-prep** | `interview-prep/<company>-<role>.md` — brief di ricerca approfondita e one-pager per round. |
| **Batch additions** | `batch/tracker-additions/*.tsv` — righe in attesa messe in coda da `batch-runner.sh` per l'unione nel tracker. |

### career-ops vs career-ops-ui (questa app)

| | career-ops (CLI) | career-ops-ui (questa app) |
|---|---|---|
| Dove gira | dentro Claude Code / Gemini CLI / Codex / Qwen Code / OpenCode / GitHub Copilot CLI | `http://127.0.0.1:4317` nel tuo browser |
| Superficie | slash command `/career-ops <mode>` | barra laterale con una pagina per flusso di lavoro |
| Compilazione moduli | sì, tramite Playwright MCP | no — genera la checklist, la completi nella CLI |
| PDF | `generate-pdf.mjs` | `📄 Generate PDF` su `#/cv`, `#/reports/:slug`, `#/evaluate`, `#/deep`, `#/interview-prep` |
| File di dati | condivisi con career-ops-ui | condivisi con career-ops |

career-ops-ui è **pura aggiunta**. Nulla dentro `career-ops/`
cambia. Entrambe le superfici condividono gli stessi `cv.md`, `config/profile.yml`,
`portals.yml`, `data/`, `reports/`, `interview-prep/`, `modes/`.

### Soglie di azione per punteggio

Una volta che una JD ha una valutazione, il punteggio determina cosa
fare dopo (tabella canonica da
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

| Punteggio | Passo successivo |
|---|---|
| **≥ 4.5** | Esegui `/career-ops apply` — alta compatibilità, procedi subito. |
| **4.0 – 4.4** | Candidati, oppure `/career-ops contacto` prima per un contatto caldo. |
| **3.5 – 3.9** | Esegui `/career-ops deep` — ricerca l'azienda / ruolo prima di decidere. |
| **< 3.5** | Salta a meno che tu non abbia una ragione personale specifica. |

`#/dashboard` e `#/tracker` di career-ops-ui evidenziano ogni riga pari
o superiore a 4.0 così puoi scegliere l'azione senza rieseguire nulla.

### Documentazione esterna

Il riferimento completo per il motore career-ops sottostante
(scansione, rubrica di valutazione, elaborazione batch, flusso di
candidatura, configurazione di Playwright) è su
[career-ops.org/docs](https://career-ops.org/docs):

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)

---

## 1. Avvio rapido — passo per passo completo, da "crea il CV" a "candidato e messaggio inviato"

Questo è il playbook canonico, pulsante per pulsante. Seguilo in ordine
la prima volta. Ogni passo indica il percorso esatto, il pulsante
esatto e ciò che vedrai in caso di successo. Le sezioni 2–16 qui sotto
approfondiscono ogni fase.

> **Avvio e inizializzazione con un solo comando.** Da un terminale puoi
> fare l'intero bootstrap senza toccare la UI:
>
> ```bash
> career-ops-ui setup      # install deps → doctor → run the server
> career-ops-ui init       # pick LLM provider + paste its key (echo suppressed)
> career-ops-ui doctor     # re-verify any time (exit 0 ⇔ all required green)
> career-ops-ui run        # just launch the server at http://127.0.0.1:4317
> career-ops-ui open       # open + RAISE the dashboard tab in your browser
> ```
>
> Dopo `setup`/`run` la scheda del browser viene aperta **e portata in
> primo piano** automaticamente (v1.43.0); `career-ops-ui open` fa lo
> stesso su richiesta così non devi mai cercare la scheda della
> dashboard. `NO_OPEN=1` disabilita l'apertura automatica per avvii
> headless/CI.
>
> `setup` esegue l'intera catena da solo. `init` scrive la chiave nel
> `career-ops/.env` del progetto padre attraverso lo stesso percorso
> validato che usa la scheda API-keys di `#/config`, e imposta
> `LLM_PROVIDER`
> (`auto` | `claude` | `gemini`) che le route live evaluate / deep / mode /
> auto-pipeline rispettano. Forma per CI:
> `career-ops-ui init --provider claude --anthropic-key sk-ant-… --yes`.
> Preferisci la UI? Continua con i passi qui sotto.

### A. Configurazione (fai questi una volta sola, ~5 minuti)

**career-ops-ui deve trovarsi in `career-ops/web-ui/`** (annidato dentro il progetto padre career-ops). Legge i tuoi `cv.md`, `config/` e `data/` dalla cartella padre tramite `../` e non funziona in modo autonomo. Se `career-ops-ui init` non viene trovato dopo un pull, esegui `cd career-ops/web-ui && npm install && npx career-ops-ui init`.

**Passo 1 — Apri l'app su `http://127.0.0.1:4317`.** Se non è in
esecuzione, in un terminale esegui `bash bin/start.sh` dalla radice del
repo. Si carica la Dashboard (`#/dashboard`).

**Passo 2 — Fai clic su `❤ Health` nella barra laterale sinistra.** Ogni
controllo richiesto deve essere verde:

- `cv.md`, `config/profile.yml`, `portals.yml` esistono
- Chiave API impostata (almeno una tra `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`)
- Playwright installato (richiesto solo se userai Generate PDF)

Se qualcosa è rosso, la pagina ti dice il file o la variabile d'ambiente
esatta da correggere. Non procedere finché Health non è verde.

**Passo 3 — Fai clic su `⚒ App settings` nella barra laterale.** Arrivi
sulla scheda **API keys & runtime**.
- Incolla `ANTHROPIC_API_KEY` (preferita — miglior punteggio su testi
  lunghi) e/o `GEMINI_API_KEY`. Ottieni le chiavi da
  <https://console.anthropic.com/settings/keys> o
  <https://aistudio.google.com/apikey>.
- Fai clic su **💾 Save**. Poi fai clic su **▶ Test Anthropic** (o Gemini) — un
  minuscolo round-trip conferma che la chiave funziona.

**Passo 4 — Passa alla scheda `Profile` nella stessa pagina.** È
l'editor YAML diretto per `config/profile.yml`. Modifica come minimo:
- `candidate.full_name` — sostituisci qualsiasi segnaposto ("Jane Smith") con
  il tuo vero nome
- `candidate.email`, `linkedin`, `github` — usati nelle lettere di presentazione
- `target.roles` — i titoli di lavoro a cui ti candiderai
- `target.comp_total_min_usd` — retribuzione totale minima; le offerte al di sotto di questa
  vengono segnalate nella sezione D di ogni valutazione
- `target.archetypes` — i pattern di carriera che accetti (il campo
  singolo di maggior impatto)

Fai clic su **💾 Save**. Il server valida lo YAML e appone
l'intestazione canonica `# Career-Ops Profile Configuration`.

### B. CV (fai questo una volta sola, ~10 minuti)

**Passo 5 — Fai clic su `✎ CV` nella barra laterale.** Due colonne:
editor a sinistra, anteprima in tempo reale a destra.

**Passo 6 — Scegli un percorso per riempire l'editor:**
- **Carica un curriculum esistente** — fai clic su **📁 Upload CV**, scegli uno tra
  `.docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md`. Il
  server converte in markdown tramite pandoc o pdftotext, sanifica l'XSS
  e inserisce il risultato nell'editor. **Rivedi la conversione** —
  i PDF in particolare possono perdere fedeltà nel layout.
- **Incolla markdown direttamente** — la textarea è un editor markdown;
  il pannello di destra è ciò che l'LLM (e il tuo futuro recruiter) vedrà.
- **Consigli sul tono:** un punto elenco = una realizzazione con una metrica. Mantieni
  sotto le 1500 parole. Sezioni in quest'ordine: Summary, Experience,
  Projects, Education, Skills.

**Passo 7 — Fai clic su `💾 Save` (in alto a destra della pagina CV).** Il server
sanifica (rimuove `<script>` / `javascript:` / gestori inline) e
scrive `cv.md`. Toast: *"Saved"*.

**Passo 8 (opzionale) — Fai clic su `📄 Generate PDF`.** Esegue
`generate-pdf.mjs` nel padre (Playwright richiesto) e **il nuovo
PDF viene scaricato automaticamente** nel tuo browser al termine. L'elenco in
fondo alla pagina conserva ogni file generato in precedenza.

### C. Trova offerte di lavoro (~2 minuti per scansione)

**Passo 9 — Fai clic su `🌐 Scan` nella barra laterale.** Conferma che `portals.yml`
elenchi i board che ti interessano (sezione 5 di questa guida). Premi il
pulsante **🌐 Scan now**. Un log SSE in tempo reale scorre mentre lo scanner
percorre Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (board inglesi) e hh.ru / Habr
Career (board russi se abilitati).

**Passo 10 — Quando la scansione termina, rivedi i risultati.** Fai clic su qualsiasi
tag azienda per filtrare; fai clic sull'icona ↗ per aprire la pagina
carriere dell'azienda in una nuova scheda. Ogni offerta di lavoro che ha superato
il filtro sul titolo è messa in coda nel Pipeline.

### D. Valuta le offerte (~30 secondi per JD)

**Passo 11 — Fai clic su `Pipeline` nella barra laterale.** Vedi ogni URL
messo in coda dallo scanner. Fai clic su una voce per visualizzare l'anteprima della JD in linea.

**Passo 12 — Fai clic su `▶ Evaluate` accanto a qualsiasi JD.** Questo salta a
`#/evaluate`. Con una chiave API impostata, gira in tempo reale; senza, ottieni
un prompt manuale da incollare nel tuo LLM. La modalità in tempo reale produce un
**punteggio 0–5** rispetto al tuo CV nelle sezioni A–G (Role / Company /
Compensation / Risk / Stretch / Cultural fit / Verdict). Il salvataggio finisce
in `reports/<date>-<slug>.md`.

**Passo 13 — Fai clic su `Reports` nella barra laterale** e rivedi l'ultima
valutazione. Qualsiasi cosa sotto il tuo `comp_total_min_usd` è segnalata in rosso
nella sezione D. Qualsiasi cosa con `Verdict: pursue` è la tua rosa di candidati.

### E. Decidi e ricerca in modo approfondito l'azienda in rosa (~3 minuti)

**Passo 14 — Scegli un'offerta di lavoro che vale la pena perseguire. Fai clic su `Deep research`
nella barra laterale.** Inserisci il nome dell'azienda e il ruolo. Il modello
produce un brief aziendale a 7 sezioni (missione, notizie recenti, tech
stack, segnali di assunzione, benchmark retributivi, rischi, angolazione consigliata).
Il salvataggio finisce in `interview-prep/<company>-<role>.md`.

### F. Candidati (~5 minuti per candidatura)

**Passo 15 — Fai clic su `Apply checklist` nella barra laterale.** Incolla l'URL
dell'offerta di lavoro + JD. L'assistente genera una checklist di candidatura
passo per passo:
- Bozza di lettera di presentazione su misura (usa i tuoi `cv.md` + `profile.yml`)
- Parole chiave specifiche da rispecchiare dalla JD
- File da allegare (PDF del CV — vedi passo 8)
- Dove candidarsi (l'URL carriere canonico, non i reindirizzamenti
  degli aggregatori)
- Promemoria: **MAI inviare automaticamente** — la revisione finale e l'invio sono
  sempre manuali.

**Passo 16 — Apri la pagina carriere in una nuova scheda.** Usa la
apply checklist come tua lista di cose da fare. Invia tramite il modulo
effettivo dell'azienda. Allega il PDF generato al passo 8.

**Passo 17 — Contatta un vero essere umano.** Apri la modalità **Outreach**
(`#/contacto` nella barra laterale). Il modello redige un breve messaggio LinkedIn /
email su misura per il brief aziendale del passo 14. Personalizza
l'apertura (un dettaglio specifico dal tuo brief di ricerca approfondita).
Invialo.

### G. Traccia e fai il follow-up (continuo)

**Passo 18 — Fai clic su `Tracker` nella barra laterale** e aggiungi una riga per
la candidatura: azienda, ruolo, punteggio, stato `Applied`, link al
rapporto, link al brief di ricerca approfondita. La data è compilata automaticamente.

**Passo 19 — Una settimana dopo: apri la modalità `Follow-up`** (`#/followup`).
Redige un'email di verifica cortese che fa riferimento alla candidatura originale.
Invia. Aggiorna lo stato nel tracker a `Followed up`.

**Passo 20 — Quando ricevi un invito a colloquio, esegui la modalità `Interview prep`**
(`#/interview-prep`). Genera una preparazione mirata per la
specifica azienda + fase (system design / behavioral / coding).
Attinge automaticamente dal brief di ricerca approfondita.

**Passo 21 — Hai ottenuto l'offerta? Aggiorna lo stato nel Tracker a `Offer`** e
rivisita la sezione retribuzione del tuo rapporto di valutazione — il tuo numero
minimo di accettazione è proprio lì.

### TL;DR — l'ordine della barra laterale corrisponde al flusso di lavoro

`Health → App settings → Profile → CV → Scan → Pipeline → Evaluate
→ Reports → Deep research → Apply checklist → Outreach → Tracker
→ Follow-up → Interview prep → Activity log`

Tutto qui. 21 passi, pulsante per pulsante, da zero all'offerta.

### Auto-pipeline con un clic (`#/auto`) — la scorciatoia in 21 passi

Se vuoi solo valutare in fretta un'offerta specifica, salta la guida
manuale. **Barra laterale → ✨ Auto-pipeline** (o il pulsante ✨ sulla
Dashboard) apre una schermata dedicata: incolla l'URL del lavoro, premi **Enter**
o fai clic su **▶ Run full pipeline**, e il server esegue l'intera catena
in un'unica passata osservabile:

1. **Validating URL** — controllo SSRF-safe (`isValidJobUrl`); rifiuta
   loopback / `file:` / IP privati / caratteri di script.
2. **Fetching job description** — `safeGet` (con DNS bloccato, reindirizzamenti
   rivalidati) scarica + sanifica la JD.
3. **Evaluating against your CV** — Anthropic (preferito) → ripiego
   su Gemini → prompt manuale se non c'è chiave.
4. **Saving report** — scrive `reports/<slug>.md` con punteggio +
   legittimità nell'intestazione.
5. **Adding to tracker** — accoda una riga a `data/applications.md`.

Il feedback in tempo reale è uno **stepper** verticale (ogni passo si
illumina in corso → fatto / fallito). È un elenco ordinato con `aria-current`
sul passo attivo e una live-region educata per screen reader che annuncia
ogni transizione. In caso di successo la card del risultato porta direttamente
al rapporto salvato (**View report · N/5**) e al **tracker**. Un passo
fallito è marcato in rosso con il suo messaggio e il pulsante si riabilita così
puoi correggere l'URL e riprovare senza ricaricare.

**Nessuna chiave API?** La pipeline gira in **modalità manuale**: i passi 3–5
si comprimono e ottieni una card di prompt pronta da incollare (copia in Claude
Code / Anthropic / Gemini). Nessuna chiamata LLM in tempo reale, nessuna spesa.

`#/auto` è collegabile: `#/auto?url=<encoded>&go=1` apre la schermata e
avvia automaticamente. Il pulsante ✨ della dashboard e questa voce della barra laterale portano
entrambi qui (un unico flusso coerente — il modale transitorio pre-1.34 è stato promosso
a questa pagina).
> **CLI (v1.38.0).** Un comando fa la catena: `career-ops-ui setup` (bootstrap → install → start). Verbi autonomi: `career-ops-ui doctor` (controllo env/chiavi/tooling — stesso motore della pagina Health; exit 1 su qualsiasi errore richiesto), `career-ops-ui run`, `career-ops-ui init` (procedura guidata provider+chiave, v1.39.0).
> **Provider (v1.39.0).** La scheda API-keys aggiunge un select `LLM_PROVIDER` (`auto` = default Anthropic→Gemini · `claude` · `gemini`) e un campo `OPENAI_API_KEY` (lato CLI Codex/OpenCode). `career-ops-ui init` è una procedura guidata interattiva per lo stesso.
>
> **Provider (v1.57.0).** La valutazione in tempo reale headless ora copre **Anthropic → Gemini → OpenAI → Qwen → OpenRouter** (l'ordine `auto`; `LLM_PROVIDER` ne fissa uno). **OpenRouter** — una sola `OPENROUTER_API_KEY` fa da facciata a 300+ modelli; il menu a tendina `OPENROUTER_MODEL` carica il catalogo in tempo reale di OpenRouter (proxy lato server, ripiego offline curato). Corretto anche: le chiavi incollate con un newline finale / spazi circostanti ora vengono ripulite prima della validazione, così `/#/config` non mostra più "validation failed" per nessun provider.



---

## 2. App settings & API keys (`#/config`)

> **Novità in v1.55 → v1.56.** Con **nessuna** chiave LLM impostata, un banner rosso su ogni schermata spiega che ⚡ Run-live è in modalità prompt manuale e collega qui; una volta impostata una chiave diventa un chip discreto che indica il provider attivo. Prima di qualsiasi pulsante ⚡ Run-live (`#/auto`, `#/evaluate`, `#/deep`, mode) appare una stima onesta del costo (es. "Estimated cost: OpenAI gpt-5-codex · ~$0.04/eval", o una nota di assenza di costo API in modalità manuale). `#/scan` nasconde i filtri secondari dietro un pannello **Advanced filters**; `#/tracker` aggiunge chip a imbuto cliccabili + paginazione lato server opzionale; `#/pipeline` virtualizza oltre le 1000 righe.

Tre schede:

1. **API keys & runtime** — modulo a campi strutturati sul file `.env`
   del progetto padre (lo stesso file che gli script Node di career-ops leggono
   all'avvio). Raggruppati: API keys / Runtime / Regional sources. La scheda
   espone anche i selettori di modello per provider — `OPENAI_MODEL`
   (OpenAI/Codex) insieme a `ANTHROPIC_MODEL` e `GEMINI_MODEL`.
2. **Profile** — **modulo campo per campo** su `config/profile.yml`
   (web-ui 1.32.0). Il salvataggio **unisce** nel file — i tuoi archetipi,
   proof point e qualsiasi chiave personalizzata sono preservati intatti.
3. **Modes** — **modulo a campi strutturati** per `modes/_profile.md`
   (web-ui 1.54.3), derivato dallo schema documentato. Le sezioni di tipo
   elenco — **Target Roles / Adaptive Framing / Comp Targets** —
   sono rese come input a voci ripetibili (aggiungi/rimuovi righe); le sezioni
   in prosa — **Exit Narrative / Location Policy** — sono rese come
   textarea etichettate; qualsiasi sezione sconosciuta o non-elenco ripiega su
   una textarea etichettata alla lettera. Il salvataggio **unisce comunque per sezione** —
   il preambolo, le sezioni intatte e qualsiasi sezione personalizzata sono
   preservati byte per byte. Un pannello *Advanced: raw markdown* rimane
   per le modifiche all'intero file — aggiungere/rimuovere sezioni o modificare
   il preambolo.

Un salvataggio in qualsiasi scheda si propaga immediatamente — nessun riavvio del server.

**Configurare il tuo provider LLM (passo per passo).** La valutazione in tempo reale ⚡ della web UI gira *headless* e usa una sola chiave API. Funziona con "OR" — imposta **una qualsiasi** di queste e funziona; con diverse impostate, `auto` le preferisce in quest'ordine: Anthropic → Gemini → OpenAI → Qwen. (career-ops in sé è agnostica rispetto alla CLI — la esegui anche dentro Claude Code, Codex, Gemini, OpenCode, Qwen, Copilot o Kimi; questo è separato da questa chiave headless.)

1. Apri `#/config` → la scheda **API keys & runtime**.
2. Scegli il tuo provider in **`LLM_PROVIDER`**: `auto` (usa qualunque chiave sia impostata), o forzane uno con `claude` / `gemini` / `openai` / `qwen`.
3. Compila la chiave + modello per il provider che hai scelto:
   - **Anthropic** — imposta `ANTHROPIC_API_KEY` (console.anthropic.com), opzionalmente `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`).
   - **Gemini** — imposta `GEMINI_API_KEY` (aistudio.google.com/apikey), opzionalmente `GEMINI_MODEL` (default `gemini-2.0-flash`).
   - **OpenAI** — imposta `OPENAI_API_KEY` (platform.openai.com), opzionalmente `OPENAI_MODEL` (default `gpt-5-codex`).
   - **Qwen** — imposta `QWEN_API_KEY` (Alibaba Model Studio / DashScope, dashscope.console.aliyun.com), opzionalmente `QWEN_MODEL` (default `qwen-max`). Per l'endpoint della Cina continentale imposta `QWEN_BASE_URL` nel `.env` grezzo.
4. Fai clic su **Save**. Le chiavi vengono scritte nel `.env` del progetto padre; la modifica ha effetto immediato — nessun riavvio del server necessario.
5. Verifica su `#/evaluate`: incolla un URL/descrizione di lavoro e premi **⚡ Run live**. L'intestazione del risultato mostra quale provider ha girato (`anthropic` / `gemini` / `openai` / `qwen`). Nessuna chiave impostata da nessuna parte → ottieni invece il prompt manuale da copia-incolla.

I segreti vengono mascherati dopo il salvataggio e mai registrati nei log. I campi model-id (`*_MODEL`) non sono segreti.

### Scheda Profile (modulo a campi — v1.32.0)

Prima di v1.32.0 questa scheda era una singola textarea YAML grezza dove ogni
impostazione viveva in un unico blob indifferenziato. Ora è un modulo
strutturato, con campi raggruppati in tre sezioni comprimibili:

- **Candidate** — Full name (obbligatorio), Email, Phone, Location,
  LinkedIn, GitHub, Portfolio URL, X / Twitter.
- **Narrative** — Headline, Exit story.
- **Compensation** — Target range, Currency, Walk-away minimum,
  Location flexibility.
- **Editor di array strutturati** (web-ui 1.35.0) — editor con
  aggiunta/rimozione riga per i campi a forma di elenco, così anche questi non
  richiedono più lo YAML grezzo: **Target roles** + **Superpowers** (elenchi di stringhe);
  **Archetypes** (righe name / level / fit); **Proof points** (righe name /
  url / hero-metric). Le righe vuote vengono scartate; un elenco svuotato
  rimuove la chiave in modo pulito. Stessa garanzia di unione-non-sostituzione — ogni
  array che non tocchi sopravvive intatto.

Come il salvataggio è sicuro:

- Il modulo invia solo i 14 percorsi scalari modellati come
  `{ fields: { "candidate.full_name": … } }`. Il server **legge il
  `config/profile.yml` esistente, imposta/cancella solo quelle foglie, e
  ri-serializza l'intero oggetto** — così gli array annidati che il modulo
  non modella (`target_roles.archetypes`, `narrative.proof_points`,
  `narrative.superpowers`) e qualsiasi chiave personalizzata aggiunta a mano
  **sopravvivono al round-trip intatti**. Svuotare un campo rimuove quella
  chiave in modo pulito (nessun residuo `phone: ""`).
- La validazione richiede comunque un nome completo; l'intestazione `# Career-Ops Profile
  Configuration` viene apposta automaticamente.
- Un compromesso: un salvataggio del modulo a campi **ri-serializza lo YAML, quindi i commenti
  `#` inline vengono persi**. Per preservare i commenti o per modificare array
  annidati, usa il pannello **Advanced: edit raw YAML** in
  fondo alla scheda — è l'editor dell'intero file pre-1.32, invariato
  (sostituisce l'intero file al salvataggio).
- Il riepilogo di sola lettura su `#/profile` è il compagno visivo.

### Chiavi riconosciute

| Chiave | Cosa fa | Dove ottenerla |
|---|---|---|
| `ANTHROPIC_API_KEY` | Abilita le chiamate live all'SDK Anthropic. Preferita quando sono impostate sia Anthropic + Gemini — output strutturato su testi lunghi migliore per il punteggio JD e la ricerca approfondita. | <https://console.anthropic.com/settings/keys> |
| `ANTHROPIC_MODEL` | Sovrascrive il default `claude-sonnet-4-6`. Prova `claude-opus-4-7` per ragionamenti più difficili, `claude-haiku-4-5-20251001` per economico-e-veloce. | — |
| `GEMINI_API_KEY` | Ripiego quando non c'è chiave Anthropic. Usato da `gemini-eval.mjs` per la modalità `oferta`. Il free tier va bene per volumi bassi. | <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | Sovrascrive il modello Gemini di default. | — |
| `(server uses default UA)` | Richiesto quando esegui scansioni di `hh.ru` da fuori Russia (l'API restituisce 403 su User-Agent semplici). Registra un'app su <https://dev.hh.ru/admin> e usa la sua stringa UA. | dev.hh.ru |
| `PORT` | Porta di bind di Express. Default 4317. | — |
| `HOST` | Indirizzo di bind. Default `127.0.0.1`. Impostare `0.0.0.0` espone la UI sulla LAN — **ancora nessun gate di autenticazione**, vedi il documento Production-readiness. | — |

### Comportamento

- **Read** (`GET /api/config`) restituisce ogni chiave riconosciuta. Le chiavi
  segrete (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) sono **mascherate** — vedi
  `sk-ant•••••••a1b2`, mai il valore completo.
- **Save** (`POST /api/config`) valida ogni valore, scrive in
  `<parent>/.env`, e applica immediatamente al processo in esecuzione.
  Nessun riavvio necessario.
- **Un valore vuoto elimina** la chiave. Utile se vuoi smettere di usare un IP russo / VPN.

### Pulsanti smoke-test

Dopo il salvataggio, fai clic su **▶ Test Anthropic** o **▶ Test Gemini** — entrambi
lanciano un minuscolo prompt (≤256 token in output) così spendi essenzialmente
nulla mentre confermi che la chiave è collegata correttamente. Restituisce un
campione di ~200 caratteri in caso di successo.

---

## 3. Profile (`#/profile` — raggiungibile anche come `#/settings`)

Una vista a card di riepilogo di sola lettura di `config/profile.yml`. **Per modificare**,
vai su **App settings → scheda Profile** (`#/config` → Profile) — poiché
web-ui 1.32.0 quello è un modulo campo per campo (Candidate / Narrative /
Compensation), non un blob YAML grezzo. I salvataggi si uniscono nello stesso file;
questa pagina ri-analizza al ricaricamento.

I campi che contano di più:

- `candidate.full_name` — usato in ogni prompt. **Sostituisci il
  template `Jane Smith`** prima di scansionare qualcosa sul serio, altrimenti le tue
  lettere di presentazione generate usciranno sotto il nome segnaposto.
- `candidate.email`, `linkedin`, `github` — richiamati nella generazione della lettera
  di presentazione e nella apply checklist.
- `target.roles` — titoli di lavoro accettati. Il filtro positivo dello scanner
  li usa implicitamente (via `portals.yml::title_filter`).
- `target.comp_total_min_usd` — retribuzione totale minima. La sezione D di ogni
  valutazione segnala le offerte al di sotto.
- `target.archetypes` — il campo *più importante*. Sono i
  pattern di carriera che accetti (es. `Tech-Lead-Backend`,
  `Founding-Engineer`, `Data-Platform`). Ogni JD è confrontata con
  essi e l'archetipo di migliore compatibilità finisce nell'intestazione del rapporto.

La pagina Health mostra un controllo **Profile customized** che fallisce
finché `full_name` corrisponde a un nome segnaposto noto.

---

## 4. CV (`#/cv`)

Unica fonte di verità per ogni valutazione, ricerca approfondita e lettera
di presentazione. Vive in `cv.md` alla radice del progetto padre.

### Opzioni di modifica

- **Incollalo direttamente** — la textarea a sinistra è un editor markdown.
  Il pannello di destra riflette ciò che l'LLM (e il tuo futuro
  recruiter) vede.
- **📁 Upload CV** — scegli un file locale in uno di questi formati e
  il server lo converte in markdown per te:
  - **Formati di testo** — `.md`, `.markdown`, `.txt`, `.html`, `.htm`
    vengono passati direttamente (l'HTML passa via pandoc → GFM markdown).
  - **Formati Office** — `.docx`, `.doc`, `.odt`, `.rtf` vengono
    convertiti tramite **pandoc** (`brew install pandoc` su macOS,
    `apt install pandoc` su Linux).
  - **PDF** — `.pdf` viene estratto tramite **pdftotext** da Poppler
    (`brew install poppler` / `apt install poppler-utils`).
  - Il markdown convertito finisce nell'editor; fai clic su **💾 Save**
    per persistere. Il risultato è sanificato (stessa rimozione XSS dell'incolla).
  - Limite massimo: **10 MB** per upload. File più grandi → 413.
- **Da LinkedIn** — percorso più facile: apri Claude Code nel progetto
  padre, esegui `/career-ops`, incolla il tuo URL LinkedIn e chiedi
  `extract my CV from this and write it to cv.md`.

### Cosa viene sanificato

Lato server, ogni PUT a `/api/cv` passa attraverso `stripDangerousMarkdown`:

- Tag `<script>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`, `<style>`,
  `<form>` — rimossi interamente.
- Gestori di eventi inline (`onclick=`, `onerror=`, ecc.) — rimossi.
- Schemi URI `javascript:`, `vbscript:`, `data:text/html` — neutralizzati.

La risposta include `sanitized: true` ogni volta che uno dei suddetti è stato
rimosso, così sai se la fonte aveva qualcosa di pericoloso.

Dimensione massima del corpo: 1 MB. Qualsiasi cosa più grande restituisce 413.

### Altri pulsanti

- **sync-check** — esegue `cv-sync-check.mjs` nel progetto padre.
  Segnala incongruenze: un progetto elencato nel tuo CV ma non negli
  archetipi di `data/applications.md`, ecc.
- **📄 Generate PDF** — trasmette `generate-pdf.mjs`. L'output finisce in
  `output/*.pdf`. Richiede Playwright (la pagina Health mostra se è
  installato nei `node_modules` del padre). Al termine della generazione,
  il PDF **più recente** viene scaricato automaticamente nella tua cartella Downloads
  predefinita; l'elenco in pagina conserva ogni file generato in precedenza.

### Consigli su tono / formato

- Un punto elenco = una realizzazione con una metrica.
  *"Reduced p99 latency by 38%"* batte *"improved performance"* per
  ogni rubrica di valutazione.
- Sezioni in quest'ordine: **Summary** (3–5 righe), **Experience**
  (in ordine cronologico inverso), **Projects** (max 5), **Education**,
  **Skills** (deduplicate, niente minestrone di parole d'ordine).
- Mantienilo sotto le 1500 parole. La rubrica di punteggio usa informazione
  densa; un CV dispersivo viene penalizzato per il rumore.

---

## 5. Portali & sorgenti (`portals.yml`)

La configurazione dello scanner vive in `portals.yml` alla radice del padre. Contano
tre sezioni. Le tre sezioni della SPA (sotto) corrispondono allo schema canonico
di career-ops.org da
[scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
1:1.

> **Scorciatoia:** l'URL `#/portals` ora risolve direttamente su **App
> settings** e (quando una sorgente regionale è configurata) salta al
> gruppo **Regional sources** — così un link `#/portals` segnalibro o
> digitato non dà più 404 (v1.42.0).

### `title_filter`

```yaml
title_filter:
  positive: [backend, engineer, senior, tech lead, golang, php]
  negative: [junior, intern, frontend, ios, android, java]
  seniority_boost: [Senior, Staff, Lead, Principal]
```

Un'offerta di lavoro scansionata passa quando il suo titolo contiene **almeno una
keyword positive** E **nessuna** delle keyword negative. Regola entrambe.
Le keyword sono sottostringhe case-insensitive.

`seniority_boost` è la terza chiave del title-filter. Le keyword elencate
qui non filtrano nulla — spingono i lavori corrispondenti più in alto nei
risultati così un "Senior Backend Engineer" finisce sopra un "Engineer".
Default: `["Senior", "Staff", "Lead"]`. Regola per corrispondere a come i tuoi
ruoli target sono intitolati.

Inizia con 3–5 keyword positive per chiarezza; allarga in seguito.

### `location_filter` (opzionale — web-ui 1.33.0, padre #570)

```yaml
location_filter:
  allow:
    - "Remote"
    - "United States"
    - "Atlanta"
  block:
    - "India"
    - "London"
    - "Germany"
```

Filtra le offerte di lavoro scansionate in base alla loro stringa di **location**
(sottostringa case-insensitive), applicato sia dalla scansione ATS sia da quella regionale.
Semantica, identica alla `scan.mjs` canonica di career-ops:

- Nessuna chiave `location_filter` → ogni location passa (default).
- Un'offerta di lavoro con una location **vuota/mancante** → passa (i dati mancanti
  non sono penalizzati).
- Una corrispondenza con keyword `block` → **rifiutata** (block ha precedenza su
  allow).
- `allow` vuoto → passa (block l'ha già lasciata passare).
- `allow` non vuoto → deve corrispondere ad **almeno una** keyword.

Chiave di primo livello in `portals.yml` (fratello di `title_filter`, non annidato
sotto `russian_portals`). Usalo per scartare lavori che hanno superato il
title filter ma sono in una regione che non puoi accettare.

Inizia con 3–5 keyword positive per chiarezza; allarga in seguito.

**`content_filter` (opzionale — web-ui 1.75.0, padre #974).** Un fratello di
primo livello di `location_filter` con gli stessi elenchi di keyword `positive` / `negative`,
ma confrontati con il testo della **descrizione / snippet** di un'offerta invece
della sua location:

```yaml
content_filter:
  positive: ["python", "machine learning"]
  negative: ["security clearance", "on-site only"]
```

Semantica identica a `location_filter`: nessuna chiave → tutto passa; un'offerta
con una descrizione **vuota/mancante** passa (i dati mancanti non sono penalizzati); una
corrispondenza `negative` → rifiutata; `positive` vuoto → passa; `positive` non vuoto →
deve corrispondere ad almeno una keyword (sottostringa case-insensitive). Applicato sia
dalla scansione ATS sia da quelle regionali. Solo le sorgenti che forniscono una descrizione/snippet
(es. RSS) sono interessate — ogni altra offerta passa — così abilitarlo non
scarta mai silenziosamente righe da sorgenti che non portano un corpo. Usalo per scartare
un'offerta che passa il titolo ma il cui corpo rivela un ostacolo insormontabile.

**`trust_filter` (opzionale — web-ui 1.76.0, padre career-ops v1.13.0).** Un
blocco di primo livello che **annota** (non scarta mai) ogni offerta scansionata con un
punteggio di fiducia (0–100), un livello (`high` / `medium` / `low`) e flag. Disattivato a meno che non sia
presente e non disabilitato:

```yaml
trust_filter:
  enabled: true
  suspicious_domains: ["bit.ly", "tinyurl.com"]   # optional — overrides the default shortener list
  ats_allowlist: ["greenhouse.io", "ashbyhq.com"] # optional — overrides the default ATS host allowlist
```

Euristiche: URL di candidatura mancante (−40), URL non valido (−50), dominio
di accorciamento sospetto (−25), disallineamento azienda↔dominio (−15, saltato per host ATS noti).
Le offerte sotto `high` ottengono un badge **⚠ score** neutrale rispetto alla lingua nella tabella `#/scan`
(il tooltip elenca i codici flag), così puoi individificare a occhio le righe a bassa fiducia
senza che nulla venga filtrato. Ometti del tutto il blocco per mantenere il
comportamento pre-1.76 (nessuna annotazione, nessun badge).

### `search_queries`

```yaml
search_queries:
  - name: "Greenhouse — Rails Engineer"
    query: 'site:job-boards.greenhouse.io "Rails Engineer" OR "Ruby on Rails" remote'
    enabled: true
  - name: "Ashby — Senior Backend"
    query: 'site:jobs.ashbyhq.com "Senior Backend" remote'
    enabled: false
```

`search_queries` guidano la scansione Opzione B basata su AI (`/career-ops scan`
dentro Claude Code / Codex). NON vengono eseguite dallo scansionatore in-process
`npm run scan` (che colpisce solo le API dei board pubblici). Usale quando
vuoi scoprire ruoli in aziende non ancora presenti in
`tracked_companies`. Imposta `enabled: false` per mantenere una voce senza
eseguirla.

### `tracked_companies`

```yaml
tracked_companies:
  - { name: Stripe,     enabled: true, careers_url: https://job-boards.greenhouse.io/stripe }
  - { name: Linear,     enabled: true, careers_url: https://jobs.ashbyhq.com/linear }
  - { name: JetBrains,  enabled: true, careers_url: https://jobs.lever.co/jetbrains }
```

Campi obbligatori per voce: `name` e `careers_url`. Opzionali:
`api` (endpoint esplicito Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday),
`enabled: true|false` per includere/escludere senza eliminare
la voce. Lo scanner ATS rileva l'ATS dal pattern dell'URL
(`job-boards.greenhouse.io/<slug>` → Greenhouse, ecc.) e recupera l'API
boards pubblica di ogni azienda direttamente. Le aziende senza un
ATS riconoscibile vengono saltate (la card **Active Companies** su `/#/scan` le mostra
in grigio con `○`).

**Provider ATS per-tenant (v1.76.0 — parità con padre career-ops v1.13.0).** Altri sei
ATS si auto-rilevano direttamente da `careers_url` (o un `api:` esplicito), nessun
`provider:` necessario:

```yaml
tracked_companies:
  - { name: Acme,    enabled: true, careers_url: https://acme.bamboohr.com }          # BambooHR
  - { name: Foo,     enabled: true, careers_url: https://foo.breezy.hr }              # Breezy HR
  - { name: Bar,     enabled: true, careers_url: https://bar.jobs.personio.de }       # Personio (XML feed)
  - { name: Baz,     enabled: true, careers_url: https://baz.recruitee.com }          # Recruitee
  - { name: SolidCo, enabled: true, careers_url: https://solid.jobs/public-api/offers/it }  # SolidJobs
  # Comeet needs the full careers-api URL (uid + token aren't in the branded page):
  - { name: ComeetCo, enabled: true, api: https://www.comeet.co/careers-api/2.0/company/<uid>/positions?token=<token> }
```

Ognuno fissa il suo host con una regex ancorata + `redirect:'error'` (SSRF-safe). Vedi
`docs/portals-examples.md` per voci più complete da copia-incolla.

### `rss` (board RSS / Atom)

```yaml
tracked_companies:
  - { name: LaraJobs, enabled: true, provider: rss, rss: https://larajobs.com/feed }
  - { name: WeWorkRemotely, enabled: true, provider: rss, rss: https://weworkremotely.com/remote-jobs.rss }
```

Punta lo scanner a qualsiasi job board che pubblica un feed RSS/Atom (LaraJobs, WeWorkRemotely, RemoteOK, golangprojects, …) aggiungendo una voce con `provider: rss` più una chiave `rss:` (o `feed_url:`) — **nessuna modifica al codice**. L'adattatore RSS analizza ogni `<item>` (CDATA + entità HTML, titoli/aziende con i tag rimossi), lo normalizza in un lavoro, ed esegue lo stesso flusso `title_filter` / `location_filter` + dedup + accodamento-pipeline delle sorgenti ATS. **RSS** appare poi come sorgente selezionabile nel menu a tendina dei filtri di `#/scan`. (web-ui v1.62.x)


### `russian_portals`

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]      # or just one
  area: 113                 # 1=Moscow, 2=SPb, 113=Russia, 1001=remote
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Тимлид PHP"
```

`queries` sono corrispondenze di sottostringa case-insensitive contro i titoli
delle offerte di lavoro su hh.ru e Habr Career. **Attenzione alla sovrapposizione con la lista
negativa** — se `"Senior PHP"` è in `queries` ma `"php"` finisce in
`title_filter.negative`, la scansione restituirà zero risultati e la
console ti avviserà del conflitto.


### Configurare i portali russi — guida dettagliata alla configurazione

v1.29.0 include 5 adattatori in lingua russa. Due non hanno bisogno di altro che dello UA di default (`habr-career`, scraping HTML; `trudvsem`, API open-data governativa — nessuna chiave, nessun gate IP). Due sono scraping HTML di board tecnici (`getmatch`, `geekjob` — anche questi senza chiave). Uno è l'API canonica di hh.ru che può dare 403 da IP non russi a meno che tu non imposti una variabile d'ambiente `HH_USER_AGENT` tramite **App settings → API keys & runtime** (o esegua il server da un IP russo / nodo di uscita VPN).

#### Inventario delle sorgenti

| Chiave sorgente | Etichetta visualizzata | Tipo | Auth | Restrizione geografica |
|---|---|---|---|---|
| `hh` | hh.ru | JSON API | `HH_USER_AGENT` opzionale | gli IP non-RU possono dare 403 |
| `habr` | Habr Career | HTML | nessuna | nessuna |
| `trudvsem` | Trudvsem | JSON API (open-data) | nessuna | nessuna |
| `getmatch` | GetMatch | HTML | nessuna | nessuna |
| `geekjob` | GeekJob | HTML | nessuna | nessuna |

#### Passo 1 — Apri `portals.yml`

Il file vive nella radice del padre `career-ops/` (NON dentro `web-ui/`). Se non esiste ancora, copia l'esempio fornito con il progetto padre:

```bash
# from the parent career-ops/ root (NOT web-ui/)
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

#### Passo 2 — Abilita tutte e 5 le sorgenti

Aggiungi o aggiorna il blocco `russian_portals` per elencare ogni sorgente che vuoi scansionare. L'ordine nell'array è irrilevante; lo scanner le percorre in ordine di registro.

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]
  area: 113                  # 1=Moscow, 2=SPb, 113=Russia, 1001=remote
  per_page: 50               # how many vacancies per query per source
  only_remote: false         # set true to keep only remote postings
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Backend Senior"
    - "Тимлид PHP"
```

#### Passo 3 — Regola query e filtri

`queries` sono le stringhe che lo scanner usa per cercare su ogni sorgente. Ogni query viene eseguita una volta su ogni sorgente — quindi 4 query × 5 sorgenti = 20 chiamate per scansione. Mantieni l'elenco focalizzato (3–7 query) per tenere il tempo di scansione sotto il minuto. `area` è il codice regione di hh.ru (le altre sorgenti lo ignorano). `per_page` limita quante offerte di lavoro ogni sorgente restituisce per query. `only_remote: true` filtra ogni risultato a solo-remoto a livello di adattatore (la tabella dei risultati ha comunque un chip Remote separato).

#### Insidie comuni

**Collisione con la lista negativa.** Se una parola da una query (`"php"`, `"senior"`) appare anche in `title_filter.negative`, ogni risultato viene filtrato prima che tu lo veda. Lo scanner emette un avviso di collisione su stderr al momento della scansione — cerca la riga `⚠ config: query "Senior PHP" contains "php" which is in the negative list`. Correggi rimuovendo la parola in conflitto da `negative`:

```yaml
title_filter:
  positive: [backend, senior, lead, php, go, golang, python]
  negative: [junior, intern, frontend, ios, android]
russian_portals:
  queries:
    - "Senior PHP"     # OK — "php" no longer in negative list
    - "Senior Go"
```

#### Disabilitare temporaneamente una sorgente

Per disabilitare una sorgente senza eliminarne i dati, basta togliere la sua chiave da `sources`:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem"]   # only 3 of 5 sources will run
```

#### Verificare la configurazione

Dopo aver salvato `portals.yml`:

```bash
# 1. Save portals.yml.
# 2. In the SPA, switch to #/scan.
# 3. Click 🌐 Scan now.
# 4. Watch the SSE log for the per-source line per query:
#       "Senior PHP"
#         hh.ru    18
#         habr     21
#         trudvsem  3
#         getmatch  0
#         geekjob   2
#    A value of 0 is normal for some queries — it just means that
#    source had no matches. A "geo-blocked" or "timeout" line means
#    the adapter reached the site but couldn't read results.
```

### Flusso di bootstrap CLI ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

La configurazione canonica di career-ops (eseguita una volta dalla radice del padre):

```bash
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

Questo è l'intero bootstrap. Modifica le tre sezioni (`title_filter`,
`tracked_companies`, `search_queries`, opzionale `russian_portals`),
salva, e sei pronto a scansionare.

### Comportamento di bootstrap della SPA

Alla prima esecuzione il server accoda un blocco `russian_portals:` documentato
a `portals.yml` se manca — idempotente (il secondo avvio è un no-op
perché la riga letterale `russian_portals:` è ora presente). Le sezioni
inglesi NON vengono iniettate automaticamente; provengono dal
`templates/portals.example.yml` che hai copiato secondo il bootstrap canonico
sopra.

**Cooldown di ri-candidatura (v1.84.0).** Aggiungi un blocco `re_apply_windows:` a
`config/profile.yml` per impedire alla scansione di far riemergere ruoli a cui ti sei già
candidato. Per azienda imposti `last_apply_date` (`YYYY-MM-DD`),
`same_role_days` (durata del cooldown), `applied_to:` (una lista di titoli di ruolo a cui ti sei
candidato), e un opzionale `cross_role_bucket` (keyword con underscore, es.
`backend_em`). Finché `today` è prima di `last_apply_date + same_role_days`, qualsiasi
ruolo scansionato in quell'azienda il cui titolo corrisponde a `applied_to` (sottostringa) o
alle keyword del bucket viene **saltato** — il log della scansione mostra `Cooldown skipped: N`
e quelle righe non raggiungono mai la tabella dei risultati o `pipeline.md`. La corrispondenza dell'azienda
è insensibile alla punteggiatura e attenta ai confini di parola (`Acme Inc` corrisponde a
`Acme, Inc.`). Nessuna chiave `re_apply_windows:` → nessun cooldown (il default).

**Retribuzione in `pipeline.md` (v1.84.0).** Quando un'offerta scansionata porta un
salario, viene accodata a `data/pipeline.md` come colonna finale opzionale —
`url | salary` — accanto all'URL. L'URL resta la chiave di dedup (la colonna del salario
viene rimossa quando la pipeline viene riletta), la cella è sanificata così non
può iniettare una riga o una formula di foglio di calcolo, e le pipeline esistenti con solo URL
continuano a funzionare invariate.

---

## 6. Health (`#/health`)

Ogni gate di configurazione, in badge OK / OPTIONAL / FAIL. Leggi questo prima di
aprire qualsiasi issue "non funziona".

### Controlli richiesti (il sistema non può funzionare senza questi)

- `Node version` ≥ 18 — il server usa `fetch` nativo e
  `node:test`.
- `Project root` — che `CAREER_OPS_ROOT` (env o auto-rilevato)
  esista.
- `cv.md`, `config/profile.yml`, `portals.yml`,
  `data/applications.md`, `data/pipeline.md`, `modes/oferta.md`.

### Controlli opzionali (solo avvisi)

- `Profile customized` — `candidate.full_name` non è il segnaposto
  del template.
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` — impostate in `.env`.
- `(server uses default UA)` — conta solo se scansioni hh.ru da fuori Russia.
- `Playwright (parent node_modules)` — richiesto per la generazione PDF
  e `check-liveness.mjs`. Installa con
  `cd $CAREER_OPS_ROOT && npm install && npx playwright install chromium`.
- `Parent project dependencies` — `cd $CAREER_OPS_ROOT && npm install`
  se mancanti.
- Cartelle `data/`, `reports/`, `output/`, `jds/` — create automaticamente alla
  prima scrittura.

Quando il server è esposto oltre il loopback (`HOST=0.0.0.0`) i
percorsi assoluti e la versione esatta di Node sono sostituiti con `"hidden"` nella
risposta così un vicino curioso non può profilare la tua installazione.

### Pulsanti di esecuzione

- **▶ Doctor** esegue `node doctor.mjs` e mostra l'output in un modale.
- **▶ Verify pipeline** esegue `node verify-pipeline.mjs`.

---

## 7. Scan (`#/scan`)

Lo scanner esplora ogni board abilitato, deduplica rispetto alla tua
cronologia, e scrive i risultati in `data/last-scan.json` e
`data/pipeline.md`.

### Scansione con un clic (SPA)

**🌐 Scan** esegue ogni sorgente abilitata in un'unica passata:

- Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (la scansione ATS) per ogni azienda in
  `tracked_companies` con un URL ATS riconoscibile.
- Gli aggregatori v1.75.0 per ogni voce `tracked_companies` che aderisce a uno: RemoteOK / Remotive / Working Nomads (feed remoti a livello di board, `provider: <slug>`) e IBM / Arbeitsagentur / Glints / Jobstreet · SEEK (config-driven, blocco `<provider>:` per voce).
- API hh.ru + Habr Career + Trudvsem + GetMatch + GeekJob per ogni query in `russian_portals`.

**Due fasi, un clic (v1.29.2).** Il singolo pulsante 🌐 Scan guida SIA la scansione ATS SIA quella regionale in un unico stream SSE. Vedrai due intestazioni di fase nel log, in ordine:

1. `▶ ATS scan (Greenhouse + Ashby + Lever)` — board ATS EN.
2. `▶ Regional scan (hh.ru + Habr Career)` — 5 sorgenti RU dal registro.

Ogni fase termina con un riepilogo `✓ done · NEW=N`. Se vedi solo la fase ATS, la tua build è precedente alla v1.29.2 — aggiorna. Prima di v1.29.2 il client SSE si chiudeva al primo evento `done` e la fase regionale veniva silenziosamente scartata (`tests/scan-stream-multi-phase.test.mjs` è la rete di regressione).

Il log SSE in tempo reale scorre nel pannello di destra mentre la scansione gira. Fai clic su
**Stop** (o naviga semplicemente altrove) per interrompere — il server annulla le
richieste HTTPS in volo tramite `AbortController`.

### Filtrare i risultati

Sotto il log, la tabella dei risultati rende le righe da `data/last-scan.json`.

> **v1.76.0 — nessun limite ai risultati.** Le build precedenti memorizzavano al massimo 2000 righe corrispondenti
> per regione (`MAX_STORED_RESULTS`), nascondendo silenziosamente la coda di una scansione grande.
> Quel limite è **sparito**: ogni offerta corrispondente viene memorizzata e la tabella semplicemente
> le pagina (200 per pagina — usa i controlli del pager sotto la tabella).
> Nulla viene scartato; giri solo le pagine.

> **v1.78.1 — auto-refresh in tempo reale.** La tabella dei risultati ora si aggiorna automaticamente
> mentre una scansione gira e ancora una volta subito dopo che termina — nessun ricaricamento manuale o
> cambio pagina necessario. La cache viene azzerata all'inizio di ogni scansione e riempita.

> **v1.80.0 — Max per sorgente & quarantena sorgente.** Il campo **Max per source**
> accanto al pulsante Scan limita quanti lavori ogni board contribuisce (vuoto/0 =
> illimitato, il default) — utile quando un board enorme dominerebbe altrimenti.
> Separatamente, qualsiasi sorgente che restituisce un **404 / 410** permanente viene scritta in
> `data/scan-quarantine.json` e saltata nelle scansioni successive (auto-riparante: riprovata
> dopo 14 giorni), così gli slug morti smettono di intasare il log. Disabilita con
> `scan_quarantine: false` in `portals.yml`.

Filtri:

- **Testo libero** — corrispondenza di sottostringa contro titolo / azienda.
- Menu a tendina **Source** — Arbeitsagentur / Ashby / BambooHR / Breezy HR / Comeet / GeekJob / Glints / Greenhouse / GetMatch / Habr Career / hh.ru / IBM / Jobstreet · SEEK / Lever / Personio / Recruitee / RemoteOK / Remotive / RSS / SmartRecruiters / SolidJobs / Teamtailor / Trudvsem / We Work Remotely / Workable / Workday / Working Nomads (popolato automaticamente da `GET /api/scan/sources`).
- Menu a tendina **Remote / Hybrid / Onsite**.
- Menu a tendina **Country** (v1.78.0) — un filtro geografico popolato dai paesi rilevati nei risultati correnti, ciascuno mostrato con la sua emoji bandiera e un conteggio (es. `🇩🇪 Germany (12)`). Scegline uno per mantenere solo i ruoli legati a quel paese. Il rilevamento mappa la location in testo libero di un'offerta (nomi/alias di paesi + ~100 principali città del mercato del lavoro) a un paese; è conservativo e non indovina mai, così un'offerta la cui location non può essere risolta — o un annuncio puramente "Remote" — resta sotto **All countries**. Combinalo con il menu a tendina del tipo di lavoro per trovare ruoli legati a un paese *e* remoti.
- Menu a tendina **Posted within** (v1.80.0) — un filtro sull'età lato client (Last 24 hours / 7 days / 30 days). Le righe la cui `pubDate` è più vecchia vengono nascoste; le righe **senza data indicata passano** (i dati mancanti non sono penalizzati).
- **★ Favorites** (v1.80.0) — fai clic sulla ☆ in qualsiasi riga per aggiungere un lavoro ai preferiti (memorizzato in `localStorage` per URL); spunta **★ Favorites** nel pannello dei filtri per mostrare solo le righe con stella. Le stelle sopravvivono a scansioni e ricaricamenti.
- **Saved searches** (v1.80.0) — la barra sopra i filtri: dai un nome al set di filtri corrente e **💾 Save**, poi ri-applicalo dal menu a tendina o **🗑 Delete**. Memorizzato in `localStorage`; un valore corrotto/modificato si azzera in modo pulito a vuoto.
- **Stack chip** (PHP / Go / Backend / Senior / …) — rilevati automaticamente
  per riga da `Skills.detectTech` e `Skills.detectLevel`. Intersezione a selezione
  multipla — selezionare `PHP + Senior` mostra le righe che hanno ENTRAMBI.
- **Chip dinamici** sotto quelli statici dello stack — i primi 25 token
  capitalizzati più frequenti dai titoli, così la UI si adatta a
  qualunque ruolo tu effettivamente scansioni (marketing, design, finanza…)
  invece di essere bloccata sul vocabolario dell'ingegnere backend.

### Card Active Companies

Una card comprimibile che elenca ogni azienda in `portals.yml` con il suo
stato di scansione:

- tag verde ✓ — supporto API diretto (Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday).
- tag grigio ○ — ripiego sul prompt di ricerca web (nessuna corrispondenza API).

**Fai clic sul nome dell'azienda** → riempie il filtro dei risultati sopra con quel
nome. **Fai clic sull'icona ↗** → apre il `careers_url` dell'azienda in una
nuova scheda.

### Flusso di scansione CLI ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

Due modi per scansionare dal lato CLI (entrambi depositano gli URL nello stesso
`data/pipeline.md` che la SPA legge):

**Opzione A — script diretto (~30 s, zero token AI):**

```bash
npm run scan                          # all Greenhouse/Ashby/Lever boards
npm run scan -- --dry-run             # preview without persisting
npm run scan -- --company Anthropic   # narrow to one tracked company
```

Funziona solo per Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (URL ATS riconoscibili).
Nessun token AI consumato — colpisce le API dei board pubblici direttamente.

**Opzione B — scansione browser basata su AI:**

```
/career-ops scan
```

Dentro Claude Code / Codex / Cursor / Gemini CLI. Usa token del modello.
Visita ogni pagina `tracked_companies` direttamente e può scoprire board
non-API (pagine carriere, ATS custom, portali regionali). Più lento ma
più ampio. Utile quando una scansione ATS non restituisce nulla per un target che
sai stia assumendo.

**Output (entrambi i percorsi)** — nuovi URL di JD accodati a `data/pipeline.md`,
ogni URL visitato registrato in `data/scan-history.tsv` (dedup su tutte le
scansioni future), riepilogo stampato: aziende scansionate · lavori trovati ·
filtrati per titolo · duplicati saltati · nuove offerte aggiunte.

**Soglie di azione per punteggio** (applica dopo che `/career-ops pipeline`
valuta in batch i nuovi URL):

| Punteggio | Passo successivo consigliato |
|---|---|
| **≥ 4.5** | `/career-ops apply` — alta compatibilità, procedi subito |
| **4.0 – 4.4** | candidati, oppure `/career-ops contacto` per un contatto caldo |
| **3.5 – 3.9** | `/career-ops deep` — ricerca prima |
| **< 3.5** | salta a meno che tu non abbia una ragione personale specifica |

`#/dashboard` e `#/tracker` della SPA evidenziano ogni riga pari o
superiore a 4.0 così puoi scegliere l'azione senza rieseguire nulla.

### Comandi di follow-up

Dopo il punteggio, i follow-up canonici sono:

- `/career-ops apply` — Compila la candidatura con risposte su misura
- `/career-ops contacto` — Redige outreach LinkedIn / email
- `/career-ops deep` — Ricerca a fondo azienda / ruolo
- `/career-ops tracker` — Visualizza lo stato della pipeline

---
### hh.ru — scansionato dal sito web (nessuna configurazione, nessun proxy)

hh.ru viene scansionato leggendo il suo sito web di ricerca pubblico (`hh.ru/search/vacancy`), nello stesso modo in cui viene scansionato Habr Career — **funziona da qualsiasi IP, senza chiave, proxy o configurazione.** L'API JSON (`api.hh.ru`) intenzionalmente *non* è usata: ora restituisce `403 forbidden` a ogni client programmatico indipendentemente da IP o User-Agent (un blocco anti-bot al margine, non un errore API documentato), mentre il sito web serve risultati completi a qualsiasi client simile a un browser. Quindi hh.ru gira esattamente come Habr e Trudvsem — basta tenerlo in `russian_portals.sources` e scansionare.

## 8. Pipeline (`#/pipeline`)

Casella di posta di URL in attesa di essere valutati. Vive in `data/pipeline.md`.

### Aggiungere URL

Tre modi:

- Digita / incolla un URL nell'input + fai clic su **+ Add**.
- Usa la **ricerca globale della barra superiore** (il suo badge riporta **Enter**): incolla
  qualsiasi link `http(s)://…` e premi **Enter** per aprire l'auto-pipeline;
  digita qualsiasi altro testo e **Enter** salta a `#/scan` con quel termine
  pre-compilato (v1.78.1). Ctrl/Cmd+K mette comunque il focus sul box dove il
  browser lo consente. Il **logo** del brand riporta alla dashboard.
- Esegui una Scan (vedi sopra) — i risultati freschi vanno alla pipeline
  automaticamente.

Ogni URL passa attraverso `isValidJobUrl()` lato server. Loopback
(`localhost`, `127.0.0.1`), `file://`, `javascript:`, letterali IP, e
stringhe con caratteri di template (`<`, `>`, `"`) danno tutte 400.

### Pannello di anteprima lato server

Fai clic su qualsiasi riga della pipeline per caricare un'anteprima a destra. La maggior parte dei board ATS
non invia header CORS quindi il browser non può recuperarli direttamente; il
server fa da proxy alla richiesta, rimuove tag `<script>` / `<style>` / HTML,
e restituisce fino a 8 KB di testo semplice.

Il proxy di anteprima segue i reindirizzamenti manualmente con **validazione SSRF
per-hop** — ogni header `Location` passa di nuovo attraverso `isValidJobUrl()`,
così un board ostile non può rimbalzarti su loopback / IP privato
/ `file://`. Limitato a 3 hop, timeout di 15 secondi.

### Azioni di riga

- **▶** — salta a `#/evaluate?url=…` con l'URL pre-compilato.
- **✕** — rimuove l'URL da `data/pipeline.md`.

### Pulsanti in alto a destra

- **⚡ Evaluate first** — apre il primo URL in coda sulla pagina Evaluate,
  pronto per il punteggio.
- **Scan** — torna allo scanner se vuoi più URL.

---

## 9. Evaluate (`#/evaluate`)

Valuta una singola Job Description rispetto a `cv.md` e
`config/profile.yml`. Restituisce una valutazione strutturata A–G secondo
`modes/oferta.md` più un punteggio 0–5.

### Input

Incolla la JD nella textarea, o arriva qui da `#/pipeline` con
`?url=<href>` — la pagina recupera l'URL attraverso lo stesso proxy SSRF-safe
usato per le anteprime della pipeline e pre-compila la textarea.

Fai clic su **💾 Save JD** per persistere la JD in `jds/jd-<date>-<ts>.txt`
per la tracciabilità (o passa `save: true` nella chiamata API — stesso
effetto).

### Catena di ripiego

1. **Anthropic** — preferito quando `ANTHROPIC_API_KEY` è impostata. Il
   server raggruppa `cv.md`, `config/profile.yml`, `modes/_shared.md`,
   e `modes/oferta.md` in un blocco `<project_context>` prima del
   prompt (ogni file limitato a 16 KB, prompt completo con soft-cap a
   200 KB). Restituisce markdown fondato direttamente alla pagina.
2. **Gemini** — quando è impostata solo `GEMINI_API_KEY`. Il server lancia
   `gemini-eval.mjs` con la JD come file temporaneo. Il modello del free-tier
   (`gemini-2.0-flash`) va bene per il punteggio di routine.
3. **Manuale** — nessuna chiave impostata. La pagina restituisce un prompt completamente formato
   che puoi incollare in Claude Code, ChatGPT, o qualsiasi altro LLM.

### Sezioni di output (A-F canonico di career-ops.org)

> **Riallineamento v1.15.0.** Le lettere dei blocchi ora corrispondono allo
> [schema canonico di career-ops.org](https://career-ops.org/docs).
> I rapporti pre-v1.15 usavano A–G (con `C=Risks`, `F=Verdict`,
> `G=Legitimacy`); li rendiamo ancora così per retrocompatibilità,
> ma i nuovi rapporti emettono A–F con la semantica canonica
> qui sotto. Punteggio e Legittimità ora vivono nell'intestazione del
> rapporto (`score: 4.2/5`, `legitimacy: High|Medium|Low`).

A. **Role Summary** — recap in 3 punti (rischi indicati in linea).
B. **CV Match** — le 3 principali competenze centrate + le 3 principali mancanti.
C. **Strategy** — raccomandazione: apply now / contacto first /
deep first / skip. Era `Risks` prima di v1.15.
D. **Compensation** — relativa al tuo
`target.comp_total_min_usd` (legacy) o `compensation.target_range`
(canonico).
E. **Personalization** — angolazione con cui aprire, framing per archetipo,
ganci da menzionare nella lettera di presentazione / outreach. Era `Application
Strategy` prima di v1.15.
F. **STAR stories** — 1–3 blocchi S-T-A-R pronti da incollare su misura
per il ruolo. Era `Verdict` (punteggio grezzo) prima di v1.15; il punteggio ora
appare nell'intestazione del rapporto insieme a `legitimacy`.

### Salvare il rapporto

Fai clic su **💾 Save report** (o usa l'interruttore di salvataggio nella chiamata API) per
persistere il markdown in `reports/<date>-<company>-<role>.md`. L'intestazione
analizzata del rapporto (Score / Legitimacy / URL) appare sulla pagina
**Reports** e sulla **Dashboard**.

### Valutazione batch quando hai 10+ JD

Per una singola JD questa pagina `#/evaluate` è lo strumento giusto. Per 10+
URL in coda nella pipeline, il click-through per singola JD è impraticabile
— salta alla sottosezione **Batch evaluate** del §14 (eseguendo
`./batch/batch-runner.sh` dal padre), lascia che macini durante la
notte, poi torna a `#/reports` / `#/tracker` per i risultati. Flusso completo:
[batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers).

---

## 10. Reports (`#/reports`)

Sfoglia ogni valutazione salvata. Le card mostrano titolo, data, flag di
legittimità, e punteggio (codificato per colore: verde ≥ 4.0, giallo ≥ 3.0, rosso sotto).

Fai clic su una card per leggere il markdown completo. Paginazione: 12 per pagina;
controlli in fondo.

La vista del singolo rapporto ha anche:

- **← All reports** — torna alla griglia.
- **🔗 Open JD** — apre l'offerta di lavoro originale in una nuova scheda.

---

## 11. Tracker (`#/tracker`)

Il CRM. Una riga per candidatura; vive in `data/applications.md` come
tabella GitHub-Flavored Markdown.

### Flusso di stato

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` /
`Rejected` / `Discarded` / `SKIP`.

La whitelist degli stati è imposta lato server; inviare qualcos'altro in
un `POST /api/tracker` fa il default a `Evaluated`. La transizione canonica
`Evaluated → Applied` è automatica quando confermi
`Submitted.` alla fine di `/career-ops apply` (vedi §14).

### Layout delle colonne

| Colonna | Cos'è |
|---|---|
| `#` | Numerata automaticamente, con zeri iniziali (`001`, `002`, …). |
| `Date` | Data ISO (`YYYY-MM-DD`). Default a oggi. |
| `Company` | Testo libero. **Le pipe (`\|`) e i newline vengono escapati automaticamente.** |
| `Role` | Uguale. |
| `Score` | Formato `N/5` (es. `4.2/5`). |
| `Status` | Enum in whitelist. |
| `PDF` | ✅ una volta che `generate-pdf.mjs` è riuscito per questa riga. |
| `Report` | Link markdown al `reports/*.md` corrispondente. |
| `Notes` | Testo libero, limitato a 200 caratteri. |

### Filtri

- Menu a tendina **Status**.
- Menu a tendina **Score** — `≥ 4.0` (alto), `≥ 3.0` (medio), `< 3.0` (basso).
- **Search** — corrispondenza di sottostringa su azienda + ruolo.

Ogni filtro azzera il paginatore a pagina 1. 25 righe per pagina.

### Pulsanti di manutenzione

- **▶ Normalize** esegue `normalize-statuses.mjs` — ri-canonicalizza
  le grafie degli stati (`applied` → `Applied`, `interview` → `Interview`).
- **▶ Dedup** esegue `dedup-tracker.mjs` — rimuove i duplicati
  case-insensitive per `(company, role)`.
- **▶ Merge** esegue `merge-tracker.mjs` — importa le voci in attesa da
  `batch/tracker-additions/*.tsv` (dove il flusso batch del padre deposita le
  candidature inviate tramite l'Apply helper). Deduplica e
  archivia i file elaborati in `batch/tracker-additions/merged/`. Vedi
  [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  per il flusso batch a monte.

### Aggiungere righe

`POST /api/tracker` — corpo `{ company, role, score?, status?, url?,
reportSlug?, notes?, date? }`. Dedup per `(company, role)`
case-insensitive. Dalla UI, la pagina Evaluate offre un pulsante "Add to
tracker" dopo un punteggio riuscito.

---

## 12. Deep research (`#/deep`)

Genera un brief aziendale strutturato: snapshot, cultura ingegneristica,
notizie recenti, sentiment Glassdoor, processo di colloquio, punti di
leva per la negoziazione, tre domande intelligenti da porre al recruiter.

### Input

Due campi — nome dell'azienda e (opzionale) ruolo. Il template della modalità
(`modes/deep.md`) è ciò che modella la struttura.

### Percorsi di output

Stessa catena di ripiego di Evaluate:

1. **Anthropic in tempo reale** (preferito) — `bundleProjectContext` inserisce
   cv + profile + `_shared.md` + `deep.md`. Output: 10–30 KB di
   markdown fondato salvato in
   `interview-prep/<company>-<role>.md`.
2. **Gemini in tempo reale** — invocazione `gemini-eval.mjs`. Stessa destinazione di salvataggio.
3. **Prompt manuale** — la pagina ti consegna un prompt pronto per Claude
   Code (che ha WebFetch + WebSearch e può fare ricerca reale).

### Consigli

- Anthropic su `claude-sonnet-4-6` in genere restituisce ~13 KB di testo
  utile in 1–3 minuti per chiamata.
- L'SDK Anthropic non ha ricerca web integrata. Per i ruoli in cui hai
  bisogno di notizie fresche + sentiment Glassdoor, incolla il prompt manuale in
  Claude Code e lascia che usi il suo strumento WebFetch.
- Le esecuzioni in tempo reale sono fatturate; una chiamata di ricerca approfondita con Sonnet 4.6 costa ≈
  $0.30–0.50.

---

## 13. Prompt di modalità (le sette pagine `/#/<mode>`)

Sette costruttori di prompt: idee di **Project**, piani di **Training**,
email di **Follow-up**, valutazioni **Batch**, **Outreach** verso
recruiter, one-pager di **Interview prep**, e retrospettive **Patterns**.
Ciascuno avvolge uno specifico template `modes/<slug>.md`:

| Pagina | Slug | Scopo |
|---|---|---|
| `#/project` | `project` | Adatta un progetto di portfolio per un ruolo target. |
| `#/training` | `training` | Analisi dei gap di competenze → curriculum. |
| `#/followup` | `followup` | Bozza di email post-colloquio. |
| `#/batch` | `batch` | Prompt di valutazione batch multi-JD. |
| `#/contacto` | `contacto` | Messaggio di outreach a un recruiter / referral. |
| `#/interview-prep` | `interview-prep` | One-pager di preparazione per uno specifico round di colloquio. |
| `#/patterns` | `patterns` | Analisi riflessiva "Quali pattern mi hanno reso di successo?". |

### Forma condivisa

Ogni pagina ha un piccolo modulo (i campi sono specifici della modalità), un pulsante **▶
Generate prompt** (manuale), e — quando è presente una chiave Anthropic o Gemini
— un pulsante **⚡ Run live** che viene promosso a primario.

Fare clic su **▶ Generate prompt** restituisce il prompt assemblato con i tuoi
valori del modulo JSON-stringificati in un blocco `User-supplied context:`,
seguito dal template `modes/<slug>.md` alla lettera. Copia e incolla
nel tuo LLM preferito.

Fare clic su **⚡ Run live** invia lo stesso prompt ad Anthropic (o
Gemini), con `cv.md` + `profile.yml` + `_shared.md` inseriti via
`bundleProjectContext`. Il risultato è reso in pagina, copiabile, e
scaricabile come `.md`.

Le sette pagine sono una allowlist esplicita — le modalità che hanno una
route dedicata (`oferta` → Evaluate, `deep` → Deep research) e le
modalità che il progetto padre supporta solo dentro Claude Code (`apply`,
`scan`, `pipeline`, `tracker`, `pdf`, `latex`, `ofertas`,
`auto-pipeline`) restano deliberatamente fuori da questa UI.

---

## 14. Apply checklist (`#/apply`)

Una volta deciso di candidarti, questa pagina Apply helper genera una
checklist di candidatura per il passo effettivo della candidatura. NON auto-compila
i moduli — quel flusso resta in `/career-ops apply` dentro Claude Code,
che usa Playwright nel progetto padre.

### Modalità checklist SPA (`#/apply`)

La checklist della SPA è per gli utenti che preferiscono compilare il modulo a mano
senza invocare Playwright. Copre:

0. Esegui `/career-ops apply <url>` in Claude Code per leggere il modulo tramite
   Playwright (salta questo passo se stai compilando a mano).
1. Verifica che l'offerta di lavoro sia ancora in tempo reale (`check-liveness.mjs`).
2. Conferma che il CV sia l'ultimo (`cv-sync-check.mjs`, poi PDF se punteggio ≥ 4.0).
3. Adatta la lettera di presentazione / risposta "Why us?" usando i proof
   point STAR+R da `cv.md`.
4. Rispondi alle domande EEO / sponsorizzazione / data di inizio con sincerità.
5. Salva le risposte compilate in
   `interview-prep/{company}-{role}.md` prima di inviare.
6. **MAI inviare automaticamente** — sei tu (l'essere umano) a fare clic sul pulsante finale.
7. Dopo l'invio: aggiungi una riga a `data/applications.md` (o scrivi un TSV in
   `batch/tracker-additions/`).

### Compilazione manuale vs assistita da Playwright

Due percorsi per l'invio effettivo:

- **Manuale** — apri la pagina carriere in una normale scheda del browser, segui
  la checklist SPA sopra, copia/incolla le risposte. Nessun Playwright necessario.
  Usalo quando il modulo è breve o non hai Chromium installato.
- **Assistito da Playwright** — esegui `/career-ops apply <company>` in
  Claude Code (progetto padre). Playwright apre il proprio browser,
  legge ogni campo del modulo, restituisce bozze di risposte numerate. Fai comunque
  clic su Invia. Usalo quando il modulo è lungo, dinamico, o vuoi la
  tracciabilità di quali domande avevano quali risposte.

### Flusso completo di candidatura CLI ([apply-for-a-job](https://career-ops.org/docs/introduction/guides/apply-for-a-job))

**Prerequisiti:**

1. Esegui prima `/career-ops pipeline` così la JD ha un rapporto di valutazione
   sotto `reports/`. Il comando apply dipende da una valutazione esistente;
   senza una, esegui prima la pipeline.
2. Abbi il rapporto e il profilo caricati.
3. **Consigliato:** Playwright installato
   (`npx playwright install chromium` — vedi Playwright Setup qui sotto).
   Ripiega su WebFetch (anteprima del modulo solo-testo, senza click-fill) quando
   manca.

**Flusso numerato** (canonici 8 passi):

1. **Esegui il comando** con il nome dell'azienda:

   ```
   /career-ops apply <company>
   ```

   Esempio: `/career-ops apply Anthropic`. Senza un argomento, fornisci
   uno screenshot del modulo, il testo del modulo incollato, o l'URL
   della candidatura nel turno successivo.

2. **Individua il rapporto.** Il sistema trova la valutazione corrispondente in
   `reports/` (quella creata da `/career-ops pipeline` o
   `#/evaluate` in precedenza).

3. **Apri il modulo.** Playwright avvia una finestra del browser
   **automaticamente** — NON la apri tu.

4. **Leggi i campi.** Il sistema legge e analizza ogni campo del modulo
   (etichetta, tipo, obbligatorio, opzioni per i select).

5. **Genera le risposte.** career-ops crea risposte su misura per ogni
   campo in base al tuo profilo, ai proof point, e al ruolo.

6. **Restituisce un elenco numerato.** Ricevi risposte ordinate per corrispondere al
   layout del modulo — campi semplici (nome, email) prima, campi di testo libero
   (lettera di presentazione, "Why us?") per ultimi. Gli elementi segnalati puntano a cose
   che necessitano di attenzione umana — ancoraggio salariale, dettagli mancanti del curriculum,
   domande opzionali.

7. **Compilazione manuale.** Copi e incolli ogni risposta nel
   campo corrispondente. Questo passo è manuale, non automatizzato. Tu
   rivedi ogni risposta prima.

8. **L'utente invia.** Fai clic tu stesso su Invia. career-ops **non**
   fa **mai** clic su Invia. Conferma il completamento digitando in chat:

   ```
   Submitted.
   ```

**Aggiornamenti automatici su `Submitted.`:**

- Lo stato passa da `Evaluated → Applied` in `data/applications.md`.
- Le risposte compilate persistono nella Sezione G del rapporto per riferimento
  futuro.

**Passaggio al tracker:**

```
/career-ops tracker
```

Monitora lo stato dell'intera pipeline, indipendentemente dal punteggio del ruolo.

### Batch evaluate ([batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers))

Quando hai 10+ JD da valutare in una volta (la `#/evaluate` a una alla volta
della SPA è impraticabile per quel volume), usa il batch runner
dalla CLI.

**File di input — `batch/batch-input.tsv`** (separato da tab):

| Colonna | Scopo |
|---|---|
| `id` | Numero sequenziale univoco |
| `url` | Link completo all'offerta di lavoro |
| `source` | Piattaforma di origine (LinkedIn, Greenhouse, ecc.) |
| `notes` | Dettaglio contestuale opzionale |

Riga di esempio:

```
1<TAB>https://jobs.example.com/senior<TAB>LinkedIn<TAB>
```

**Flag di `./batch/batch-runner.sh`:**

- `--dry-run` — Anteprima delle offerte in attesa senza valutazione. Esegui sempre
  questo prima per validare il TSV.
- `--parallel N` — Esegue N worker simultaneamente (1, 2, o 3
  consigliati).
- `--min-score X.X` — Salta la persistenza delle offerte con punteggio sotto la
  soglia. Utile per conservare i rapporti solo per ruoli ad alta compatibilità.
- `--retry-failed` — Rielabora solo le offerte che sono andate in errore
  nell'esecuzione precedente (guasti di rete, rate limit).
- `--max-retries N` — Tenta le offerte fallite fino a N volte (default: 2).
- `--model NAME` — Modello Claude passato a `claude -p --model` (padre career-ops 1.8.0, #504). Non impostato = il default della tua sottoscrizione Claude Max. Usa un modello più economico per grandi batch, es. `claude-sonnet-4-6`. Mostrato in `#/batch` come input **Model** (web-ui 1.31.0).
- `--start-from N` — Salta gli ID di offerta sotto N (riprendi un batch parzialmente elaborato). Mostrato in `#/batch` come input **Start from #** (web-ui 1.31.0).

**Sequenza standard:**

1. **Modifica** `batch/batch-input.tsv` — una riga per JD.

2. **Dry-run** (consigliato per primo):

   ```bash
   ./batch/batch-runner.sh --dry-run
   ```

3. **Esegui** — sequenziale o parallelo:

   ```bash
   ./batch/batch-runner.sh                       # one at a time
   ./batch/batch-runner.sh --parallel 2          # two concurrent
   ./batch/batch-runner.sh --parallel 3          # three concurrent
   ./batch/batch-runner.sh --parallel 2 --min-score 4.0  # only persist high-fit
   ```

4. **Riprova i fallimenti** (rete / rate-limit):

   ```bash
   ./batch/batch-runner.sh --retry-failed --max-retries 3
   ```

5. **I rapporti** finiscono in `reports/` come
   `{id}-{company}-{YYYY-MM-DD}.md`. Le righe di riepilogo si accodano a
   `batch/tracker-additions/`.

6. **Unisci nel tracker:**

   ```bash
   node merge-tracker.mjs                 # apply the batch additions
   node merge-tracker.mjs --dry-run       # preview the merge
   ```

   Il comando merge deduplica le voci e archivia i file elaborati
   in `batch/tracker-additions/merged/`.

La SPA mostra i rapporti risultanti sotto `#/reports` (paginati,
con pill di punteggio colorate) e le righe del tracker sotto `#/tracker` — esattamente
come se avessi aggiunto ciascuno tramite `#/evaluate`. Abbina il
pulsante di manutenzione **▶ Merge** su `#/tracker` se preferisci non
scendere alla CLI.

### Configurazione di Playwright ([set-up-playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright))

Richiesto per due funzionalità di career-ops:

- **Compilazione moduli** in `/career-ops apply` (passo 3 sopra — Playwright
  apre il browser, legge le etichette dei campi, suggerisce risposte).
- **Generazione PDF** tramite `/career-ops pdf` e il pulsante
  **📄 Generate PDF** della SPA su `#/cv` / `#/reports/:slug` /
  `#/evaluate` / `#/deep` / `#/interview-prep`.

**Ripiego quando Playwright manca:** il flusso apply ripiega su
WebFetch (anteprima del modulo solo-testo, senza click-fill). La generazione PDF
semplicemente dà errore.

**Configurazione base (esegui dalla radice del padre career-ops):**

```bash
# Install Chromium for Playwright
npm install
npx playwright install chromium

# Register the Playwright MCP so Claude Code can drive forms
claude mcp add playwright npx @playwright/mcp@latest

# Verify all three components (Chromium, Playwright lib, MCP)
npm run doctor
```

**Registrazione MCP alternativa** — aggiungi a
`.claude/settings.local.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

**Note sul comportamento:**

- **Headless per default.** Playwright opera silenziosamente. Per guardare il
  browser in azione, di' a Claude `open up with playwright the browser
  and fill out the entire form.`
- **Tre ruoli in un pacchetto** — l'install npm di Playwright ti dà
  la libreria di automazione del browser, il motore di rendering PDF per
  `/career-ops pdf`, e (tramite l'MCP) il flusso di compilazione moduli dentro
  Claude Code.
- **Verifica prima di affidartici** — `npm run doctor` conferma che tutti e
  tre siano operativi. La pagina Health della SPA mostra un
  controllo `Playwright (parent node_modules)` che fallisce subito se manca.

---

## 15. Preparazione ai colloqui

Questa è la fase post-ricerca, pre-colloquio. Tre artefatti in
questa app convergono:

1. **File di ricerca approfondita salvati** sotto `interview-prep/`, uno per
   coppia azienda-ruolo che hai eseguito. Sfoglia dalla pagina **Deep research**
   o direttamente via `/api/interview-prep`.
2. **Modalità Patterns** (`#/patterns`) — genera un prompt auto-riflessivo:
   "attraverso i miei ultimi N colloqui / offerte / rifiuti, quali
   pattern reggono?" Utile quando hai accumulato 5+ righe nel tracker.
3. **Modalità Interview-prep** (`#/interview-prep`) — pre-compila un
   one-pager per uno specifico round imminente (behavioral, technical,
   system design). L'output va nella stessa cartella `interview-prep/`.

### Flusso di lavoro consigliato

Per ogni colloquio che hai in agenda:

1. **Ri-esegui Deep** (o apri il file salvato) il giorno prima.
2. **`#/interview-prep`** — genera un one-pager per lo specifico
   round. Incolla nei tuoi appunti.
3. **Round di system design / coding** — apri `#/training` e chiedi
   un ripasso mirato di 30 minuti sullo specifico sottosistema che la JD
   enfatizza.
4. **Round di retribuzione** — apri il file di ricerca approfondita, salta a
   "Negotiation leverage points". Porta 2–3 dati specifici
   (banda Glassdoor, finanziamento recente, offerta comparabile in un'altra
   azienda).
5. **Round comportamentali** — estrai le storie STAR+R dal tuo `cv.md` che
   finiscono nella sezione B del rapporto Evaluate originale.

Dopo il colloquio, immediatamente:

1. Aggiorna la riga del tracker: stato → `Responded` (poi `Interview`,
   `Offer`, ecc.).
2. Esegui `#/followup` per redigere l'email di ringraziamento.
3. Se hai ottenuto nuove informazioni (fascia retributiva, composizione del team, sorpresa sul tech
   stack), modifica il `interview-prep/<company>-<role>.md` salvato
   con `## Post-round notes` così il te-futuro le ha.

---

## 16. Activity log + Risoluzione dei problemi

### Activity log (`#/activity`)

Traccia di audit di ogni richiesta che modifica lo stato e colpisce il server.
Registra: aggiunte alla pipeline, scritture nel tracker, salvataggi CV, salvataggi JD, esecuzioni di
evaluate, esecuzioni di ricerca approfondita, esecuzioni di scansione, modifiche di configurazione, esecuzioni di modalità.

I segreti (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) sono redatti in
ingresso; non vedrai mai un valore di chiave reale in `data/activity.jsonl`.

Filtra per prefisso di azione (`pipeline.`, `cv.`, `evaluate`, `scan.`,
ecc.). 25 righe per pagina; il server restituisce fino a 500 eventi più
recenti.

### Risoluzione dei problemi

| Sintomo | Causa probabile | Correzione |
|---|---|---|
| Pagina Health rossa su `cv.md` | Prima esecuzione, il file non esiste ancora | `touch $CAREER_OPS_ROOT/cv.md` poi ricarica. |
| Health rossa su `Profile customized` | `candidate.full_name` dice ancora `Jane Smith` | Modifica `config/profile.yml`. |
| `hh.ru: HTTP 403` nel log di scansione | IP non russo, nessun `(server uses default UA)` | Registra su `dev.hh.ru/admin`, imposta un IP russo / VPN. |
| `gemini-eval.mjs: ERR_MODULE_NOT_FOUND` | Dipendenze del progetto padre non installate | `cd $CAREER_OPS_ROOT && npm install`. |
| Errori di Generate PDF | Playwright non installato nel padre | `cd $CAREER_OPS_ROOT && npx playwright install chromium`. |
| `/career-ops apply` dice "no report found" | La pipeline non ha mai valutato questa JD | Esegui prima `/career-ops pipeline` (o `#/evaluate`); vedi i prerequisiti del §14. |
| `batch-runner.sh: no such file` | Esecuzione dalla directory sbagliata | `cd $CAREER_OPS_ROOT` prima di invocare `./batch/batch-runner.sh`. |
| Il server segnala `EADDRINUSE: 4317` | Vecchia istanza ancora in esecuzione | `pkill -f 'node server/index.mjs'` poi riavvia. |
| La chiamata LLM in tempo reale si blocca > 2 min | Prompt enorme o Anthropic lento | Controlla il flag Anthropic di `/api/health`; il server applica un soft-cap ai prompt a 200 KB e restituisce 413. |
| L'anteprima della pipeline mostra `(unsafe redirect)` | L'offerta reindirizzava a un IP privato / loopback | Questa è una funzione di sicurezza (REVIEW-B1). Il target del reindirizzamento è rifiutato e l'URL originale è invariato. |
| Il testo di una riga del tracker rompe la tabella | Pipe nel nome dell'azienda pre-v1.9.1 | Aggiorna a v1.9.1+ — le pipe sono escapate da un capo all'altro (BF-1). |
| `npm test` fallisce su un clone pulito | I test presuppongono il layout del progetto padre | Usa `CAREER_OPS_ROOT=$(mktemp -d)` e fai il bootstrap delle fixture. |

Per diagnostiche più approfondite: esegui **▶ Doctor** sulla pagina Health, copia l'
output, e cerca la issue nel tracker su
<https://github.com/Fighter90/career-ops-ui/issues>.


---

## 17. Come aggiungere una nuova sorgente di portale di lavoro

career-ops-ui tratta ogni job board come un **adattatore** — un singolo file sotto
[`server/lib/sources/<slug>.mjs`](../../server/lib/sources/) che sa
come recuperare + normalizzare i risultati di un board. A partire da v1.82.0 il
registro `server/lib/sources/` include **45** adattatori — 40 inglesi (gli
ATS Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday, RSS,
gli aggregatori v1.75.0 RemoteOK / Remotive / Working Nomads / IBM /
Arbeitsagentur / Glints / Jobstreet · SEEK, gli ATS per-tenant v1.76.0
BambooHR / Breezy HR / Comeet / Personio / Recruitee / SolidJobs, il
feed RSS a livello di board v1.79.0 We Work Remotely, l'ATS per-tenant v1.80.0
Teamtailor, e il batch di parità con il padre v1.81.0 Arbeitnow / Himalayas /
Jobicy / Landing.jobs / 4 Day Week / The Muse / The Hub / Jobspresso /
Hacker News / JustJoin.it / NoFluffJobs / Pinpoint / Rippling, e il
feed RSS a livello di board v1.82.0 NoDesk) e 5 board russi. Gli aggregatori sono sorgenti a livello di board o config-driven selezionate da
`provider:` (incl. We Work Remotely); gli ATS per-tenant (BambooHR / Breezy HR /
Comeet / Personio / Recruitee / SolidJobs / Teamtailor) si auto-rilevano da un host `careers_url`
(`<tenant>.bamboohr.com`, `<tenant>.breezy.hr`, `<slug>.jobs.personio.de`,
`<slug>.recruitee.com`, `solid.jobs/public-api/offers/<division>`) o un
URL `api:` esplicito (Comeet) — vedi §5 per lo YAML e
`docs/portals-examples.md` per le voci da copia-incolla.

> **v1.69.0 (P-14) — auto-discovery drop-in.** Aggiungere una 12ª sorgente è ora
> un **puro drop di file**. Il registro
> ([`server/lib/sources/registry.mjs`](../../server/lib/sources/registry.mjs))
> non contiene più una lista mantenuta a mano — all'avvio scansiona questa cartella
> (`readdirSync` + `import()` dinamico) e raccoglie il blocco `export const meta`
> da ogni `*.mjs`. Scrivi l'adattatore, dichiara il suo `meta`, ed è
> immediatamente visibile allo scanner, al menu a tendina dei filtri di `#/scan`, e al
> dispatcher RU — **nessuna modifica a `registry.mjs` richiesta**. (Le sorgenti RU hanno ancora bisogno
> di una riga nel `portals.yml` del padre; vedi Passo 5.)

### Passo 1 — Scrivi l'adattatore

Crea `server/lib/sources/<slug>.mjs`. Due pattern funzionano a seconda che
la sorgente abbia un'API JSON o renda solo HTML:

**Sorgente basata su API** (la più pulita — usa questa ogni volta che il sito ha un
endpoint di dati aperto):

```js
// server/lib/sources/example.mjs
const ENDPOINT = 'https://example.com/api/v1/vacancies';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...';

// v1.69.0 (P-14) — self-describing metadata. The registry auto-discovers
// this block at boot; THIS is what registers the source (see Step 2).
export const meta = {
  value: 'example',          // ← must equal job.source written below
  label: 'Example.com',      // ← shown in the #/scan filter dropdown
  region: 'ru',              // ← 'en' (ATS sweep) | 'ru' (regional dispatcher)
  configKey: 'example',      // ← RU only; the key used in portals.yml
};

export async function searchExample(query, opts = {}) {
  const { onlyRemote = false, fetchImpl = fetch, signal } = opts;
  const res = await fetchImpl(`${ENDPOINT}?text=${encodeURIComponent(query)}`, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`Example: HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return (data.items || []).map(normalizeExample);
}

function normalizeExample(item) {
  return {
    id: `example-${item.id}`,
    title: item.title || '',
    company: item.company?.name || '',
    url: item.url || '',
    salary: item.salary || '',
    location: item.location || '',
    isRemote: !!item.remote,
    workplaceType: item.remote ? 'Remote' : 'Onsite',
    relocates: false,
    date: item.posted_at || '',
    snippet: (item.description || '').slice(0, 240),
    source: 'example',           // ← must match the registry `value` exactly
  };
}
```

**Sorgente con scraping HTML** (quando non c'è API — vedi
[`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) e
[`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) per esempi completi):

```js
const BASE = 'https://example.com';

export async function searchExample(query, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  const res = await fetchImpl(`${BASE}/vacancies?q=${encodeURIComponent(query)}`, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Example: HTTP ${res.status}`), { status: res.status });
  }
  return parseExampleCards(await res.text());
}

export function parseExampleCards(html) {
  // …regex-based card extraction. Return [] on parse failure (DON'T throw):
  // a healthy 200 with no parseable cards is "no results", not "error",
  // so the multi-source scanner can keep going.
}
```

Tre contratti che ogni adattatore DEVE onorare:

- **Esporta un blocco `meta` valido** (vedi Passo 2). Senza di esso il registro
  salta silenziosamente il file (un `console.warn` all'avvio) e la sorgente
  non appare mai.
- **Accetta `{ onlyRemote, fetchImpl, signal }` in `opts`.** `fetchImpl`
  è ciò che rende gli adattatori testabili senza rete; `signal` è richiesto
  per la propagazione della disconnessione del client (REVIEW-B3).
- **Restituisci record con la forma comune** —
  `{ id, title, company, url, salary, location, isRemote, workplaceType,
  relocates, date, snippet, source }`, dove `source` corrisponde al
  `meta.value`.

### Passo 2 — Dichiara il `meta` dell'adattatore (auto-registrazione)

Questo è l'intero passo di registrazione. **Non modifichi `registry.mjs`.**
Assicurati solo che l'adattatore esporti un blocco `meta` — il registro
lo auto-scopre all'avvio:

```js
// at the top of server/lib/sources/example.mjs
export const meta = {
  value: 'example',          // job.source value AND #/scan option.value
  label: 'Example.com',      // display label in the dropdown
  region: 'ru',              // 'en' | 'ru'
  configKey: 'example',      // RU only — key in portals.yml::russian_portals.sources
};
```

Come la scoperta lo valida (un file che fallisce qualsiasi regola viene saltato, con un
avviso `[sources/registry]`, così un branch a metà migrazione resta diagnosticabile):

- `value` — stringa non vuota. DEVE corrispondere a `job.source` dal tuo adattatore.
- `label` — stringa non vuota.
- `region` — esattamente `'en'` o `'ru'`; qualsiasi altra cosa è rifiutata.
- `configKey` — **richiesto** per `region: 'ru'`, ignorato per `'en'`.

`region: 'en'` si unisce alla scansione ATS (si auto-scopre dai pattern di URL di
`tracked_companies`); `region: 'ru'` si unisce al dispatcher regionale. L'API pubblica
(`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`, `getRegionalSources`) è
ricostruita da ogni `meta` scoperto, ordinata `en` prima poi `ru`,
alfabeticamente per label dentro ogni regione — così l'ordine del menu a tendina resta
stabile per gli utenti.

### Passo 3 — Collega al dispatcher (solo RU)

Le sorgenti ATS EN si auto-scoprono dai pattern di URL di `tracked_companies` —
nessun ulteriore collegamento necessario. Per le sorgenti RU, apri
[`server/lib/ru-scanner.mjs`](../../server/lib/ru-scanner.mjs), trova
la tabella `RU_DISPATCH`, e aggiungi una riga:

```js
import { searchExample } from './sources/example.mjs';
// …
const RU_DISPATCH = {
  // …existing…
  example: { label: 'example.com', search: searchExample },
};
```

Il loop del dispatcher chiama `entry.search(query, opts)` per ogni chiave
presente in `cfg.sources`. Nessuna ulteriore modifica al codice necessaria.

### Passo 4 — Testa (mockato, mai in tempo reale)

Metti un file sotto `tests/sources-<slug>.test.mjs`. La rete reale è
**vietata** nei test (contratto di isolamento CI):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchExample } from '../server/lib/sources/example.mjs';

test('searchExample normalizes one record', async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({ items: [{ id: 1, title: 'Backend Engineer' }] }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  const out = await searchExample('q', { fetchImpl });
  assert.equal(out.length, 1);
  assert.equal(out[0].source, 'example');
});
```

### Passo 5 — Abilita nel tuo `portals.yml`

Il `portals.yml` del progetto padre è la config di proprietà dell'utente. Aggiungi il
`configKey` della nuova sorgente all'array:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob", "example"]
  area: 113
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
```

Ricarica `#/scan` nel browser. Il menu a tendina dei filtri per sorgente raccoglie la
nuova voce automaticamente (unica fonte di verità tramite
[`GET /api/scan/sources`](../../server/lib/routes/scan.mjs) →
[`registry.mjs`](../../server/lib/sources/registry.mjs)). Il
pulsante 🌐 Scan ora include la nuova sorgente in ogni scansione regionale.

### Adattatori di riferimento (rispecchia questi per le nuove sorgenti)

| File adattatore | Tipo | Note |
|---|---|---|
| [`hh.mjs`](../../server/lib/sources/hh.mjs) | JSON API | Adattatore API RU canonico; UA di ripiego geo-aware. |
| [`trudvsem.mjs`](../../server/lib/sources/trudvsem.mjs) | JSON API | Open-data governativo russo; nessun gate IP. |
| [`habr.mjs`](../../server/lib/sources/habr.mjs) | HTML scrape | Board tecnico russo; parser di card basato su regex. |
| [`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) | HTML scrape | Parser difensivo, `[]` su parse mancato. |
| [`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) | HTML scrape | Stesso stile difensivo di GetMatch. |
| [`greenhouse.mjs`](../../server/lib/sources/greenhouse.mjs) | JSON API | Adattatore ATS EN canonico; usa il pattern di URL di `tracked_companies`. |

### Insidie comuni

- **Dimenticare l'export di `meta`.** Da v1.69.0 il blocco `meta` è l'
  *unica* cosa che registra una sorgente. Nessun `meta` (o uno malformato) =
  il file viene silenziosamente saltato all'avvio con un singolo avviso
  `[sources/registry] <file> has no valid \`export const meta\` — skipped`,
  e la sorgente non raggiunge mai il menu a tendina. Controlla il log del server
  se un adattatore nuovo di zecca non compare.
- **Disallineamento del campo `source`.** La stringa scritta dal tuo adattatore DEVE
  corrispondere esattamente a `meta.value`. Se divergono, il
  menu a tendina dei filtri di `#/scan` mostrerà la sorgente ma selezionandola
  filtrerà via ogni riga (perché il controllo di uguaglianza è `r.source === fs`).
- **Lanciare eccezioni al fallimento del parsing.** Gli scraper HTML DEVONO restituire `[]` su un
  200 sano senza card analizzabili. Lanciare rompe il loop del dispatcher
  multi-sorgente — una struttura HTML sbagliata uccide ogni altra sorgente per
  la stessa query.
- **Dimenticare `fetchImpl` / `signal`.** Senza di essi, il tuo adattatore
  non può essere testato con unit test senza colpire la rete reale, e le disconnessioni
  del client non si propagano (il fetch in background resta vivo dopo che l'utente chiude
  la scheda).
- **Fidarsi di `tracked_companies` per RU.** Quella lista è solo per le sorgenti
  ATS EN. Gli adattatori RU si guidano da soli da
  `russian_portals.queries` invece — nessuna voce per-azienda.

---

## 18. Notifiche (🔔 nella barra superiore)

> v1.58.34 — ogni toast che appare nell'angolo in basso a destra viene anche catturato
> in un journal in memoria (limite 50, il più vecchio scartato). Fai clic sulla campanella 🔔 nella
> barra superiore per aprire il cassetto **Notifications** a scorrimento da destra e rileggere qualsiasi cosa
> ti sia sfuggita. Il journal è per-scheda, per-sessione — chiudere la scheda lo cancella.

Il cassetto **si apre solo quando fai clic sulla campanella** (o lo attivi con Enter /
Spazio quando ha il focus da tastiera). Non appare mai da solo. Il badge rosso sulla
campanella conta le voci che non hai visto dall'ultima apertura; aprire il cassetto
cancella il badge.

### Categorie di notifica

| Categoria | Quando scatta | Segnale visivo |
|---|---|---|
| **Success** | `Saved`, `Copied`, `Refreshed`, scansione completata, CV importato, azioni della apply-checklist ("Copied unchecked", "Reset"), profilo salvato, URL della pipeline aggiunto | bordo sinistro verde nel cassetto; sfondo toast verde |
| **Error** | Fallimento della validazione URL (deve iniziare con `http://` / `https://`, nessun carattere di script/template), errori API con il postfisso `(METHOD /path · HTTP NNN)`, guasti di rete (server giù), duplicati pipeline-400, exit non-zero di doctor / verify-pipeline | bordo sinistro rosso; sfondo toast rosso; postfisso tecnico riposto nel blocco `<details>` `Details` (U-4 / v1.58.24) |
| **Info / progress** | `Running doctor.mjs…`, `Running verify-pipeline.mjs…`, `Refreshing…`, `Loading…`, `Generating prompt…`, righe di avanzamento della scansione | bordo sinistro grigio; sfondo toast di default |

Ogni voce del cassetto mostra:

- **Timestamp** (`HH:MM:SS` localizzato nella lingua attiva della SPA).
- **Message** (la frase leggibile, con il postfisso tecnico rimosso dal titolo per U-4).
- **Details** (quando presente — il postfisso `(METHOD /path · HTTP NNN)` della chiamata API o qualsiasi altra digressione tecnica, in monospace).

### Cosa NON è una notifica

- Il **modale dei risultati** di Doctor / verify-pipeline (stdout / stderr completo) — è un modale, non un toast, e non finisce nel journal.
- Le righe di log SSE su `#/scan` e `#/auto` — quelle scorrono nel corpo della pagina, non nella pipeline dei toast.
- Gli stati di caricamento solo-spinner (quelli usano `UI.withSpinner` senza toast).

### Tastiera

- **Clic** o focus + **Enter / Spazio** sulla campanella → apre il cassetto.
- **Esc**, clic sul pulsante di chiusura **×**, o clic di nuovo sulla campanella → chiude il cassetto; il focus torna alla campanella.
- **Tab** mentre il cassetto è aperto → si sposta attraverso il pulsante di chiusura e qualsiasi dettaglio focalizzabile all'interno; il cassetto è `aria-modal="false"`, quindi Tab non intrappola (puoi comunque raggiungere il resto della pagina).


## 19. Localizzare l'app nella tua lingua

L'interfaccia è disponibile in 9 lingue (English, Español, Français, Português, 한국어, 日本語, Русский, 简体中文, 繁體中文). Ogni etichetta a schermo proviene da un dizionario di traduzione, e puoi aggiungere o correggere una lingua senza toccare la logica dell'app.

**Dove vivono le traduzioni.** Da v1.60.0 ogni lingua è il proprio file sotto `public/js/lib/locales/` — `i18n-dict.en.js`, `i18n-dict.es.js`, `i18n-dict.ru.js`, e così via — un semplice elenco di coppie `'key': 'text'`. Un `i18n-dict.aliases.js` condiviso consente alle chiavi che devono leggersi sempre in modo identico (l'etichetta di una voce della barra laterale e il suo titolo di pagina) di puntare a una sola traduzione. `i18n-dict.js` le unisce tutte al caricamento della pagina; non lo modifichi mai.

**Correggi o aggiungi una frase.** Apri il file per la tua lingua, trova la chiave (es. `'nav.scan'`) e modifica il testo. Per aggiungere un'etichetta nuova di zecca, aggiungi la stessa chiave a **tutti e 8** i file di lingua con il valore tradotto, poi richiamala nella pagina via `t('your.key')`. Esegui `npm test` — fallisce se qualsiasi lingua manca della chiave, così nulla viene spedito tradotto a metà.

**Aggiungi un'intera nuova lingua.** Copia `i18n-dict.en.js` in `i18n-dict.<code>.js`, traduci ogni valore, poi registra il codice in `i18n.js` (l'elenco delle lingue + l'auto-rilevamento del browser), nell'assembler `i18n-dict.js`, e aggiungi una riga `<script>` in `index.html`. La checklist completa — inclusi lo snapshot di test e i file compagni della guida / README — è in `docs/LOCALIZATION.md`.

**Buono a sapersi.** Il selettore di lingua è nel footer della barra laterale; la tua scelta è ricordata per browser. I messaggi diagnostici del server restano in inglese di proposito (così i log si leggono in modo coerente) — solo l'interfaccia a schermo è tradotta.

## 20. Statistiche per ruoli target (`#/stats`)

La pagina **Analytics → Statistiche ruoli target** trasforma i dati sparsi che le tue scansioni già raccolgono in un quadro di mercato per i ruoli che stai davvero puntando: numero di posizioni e livelli salariali per Paese, oltre a un trend che puoi seguire nel tempo. Nulla è inventato: aggrega solo ciò che gli scanner hanno trovato ed è onesta su quanto sia esigua la campionatura.

### Da dove vengono i numeri

- I **ruoli target** vengono letti dal tuo Profilo (`config/profile.yml` → target roles), mai scritti nel codice. Impostali prima su `#/profile`; senza ruoli la pagina mostra un avviso "imposta i tuoi ruoli target" invece di grafici vuoti.
- **Gli annunci** provengono dalla tua ultima scansione (eseguine prima una su `#/scan`). La località di ogni offerta viene mappata su un Paese (lo stesso rilevatore del filtro Paese della scansione) e la sua stringa salariale viene analizzata e normalizzata in **USD** tramite una tabella di cambio approssimativa.
- Tutto viene aggregato **nel tuo browser**: nessun dato lascia la tua macchina, e l'unica cosa che questa pagina scrive mai è uno snapshot che salvi esplicitamente.

### Leggere i grafici

- **Posizioni per Paese**: quanti annunci corrispondenti ci sono in ciascun Paese. Usa i filtri **Ruolo** e **Paese** in alto per restringere a un singolo ruolo target o a un singolo Paese.
- **Salario mediano per Paese (USD)**: il salario intermedio analizzato per ciascun Paese. Vengono conteggiati solo gli annunci con un salario interpretabile; la dimensione del campione è mostrata accanto al grafico e gli importi sono convertiti a tassi approssimativi, quindi leggilo come *indicativo*, non esatto. Un `¥` isolato (ambiguo tra yen giapponese e yuan cinese) viene scartato anziché indovinato, per evitare una forte distorsione FX.
- Quando la scansione corrente non ha salari interpretabili, il grafico dei salari lo dichiara invece di inventare numeri.

### Salvare snapshot e seguire il trend

- Fai clic su **Salva snapshot** per aggiungere l'aggregato corrente a `data/role-stats.jsonl`. Ogni snapshot riceve un timestamp sul server; gli snapshot sono l'unica cosa che questa pagina scrive e non toccano mai il tuo CV né il tuo profilo.
- Il grafico del **trend** traccia il numero di posizioni attraverso i tuoi snapshot salvati: salvane uno periodicamente (per esempio dopo ogni scansione settimanale) per osservare come si muove nel tempo il mercato dei tuoi ruoli target.
