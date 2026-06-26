# Hjælp — career-ops-ui

En komplet gennemgang af hver side, fra det øjeblik du starter
appen til du lander en jobsamtale. Hver `##`-overskrift nedenfor svarer til en
post i sidebjælken eller en fase i arbejdsgangen. Læs oppefra og ned ved første
kørsel; spring til en bestemt sektion senere via indholdsfortegnelsen i
hjælpe-sidebjælken.

> **Målgruppe:** alle, der lige har lagt denne UI ind i et `career-ops`-
> checkout og kørt `bash bin/start.sh`. Ingen forudgående career-ops-viden
> antages.

### Om career-ops

[career-ops](https://career-ops.org) er et open source-jobsøgningssystem,
der kører som skråstreg-kommandoer inde i enhver AI-kodnings-CLI (Claude Code, Gemini CLI, Codex, Qwen Code, OpenCode, GitHub Copilot CLI — andre Claude-kompatible CLI'er virker også via den samme skråstreg-kommandoflade). Modelagnostisk. Det
evaluerer hvert opslag mod dit CV med en seks-dimensionel 0,0–5,0
rubrik, genererer skræddersyede PDF-CV'er og sporer hver ansøgning
lokalt på din maskine.

**Kanonisk reference (læs disse i rækkefølge ved første installation):**

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
  — systemet, principperne og begrebsoversigten.
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
  — find ledige stillinger; udfyld Pipeline.
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
  — fuldt indsendelsesflow med Playwright-formularlæsning.
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  — vurder 10+ JD'er på én gang via `batch-runner.sh`.
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)
  — installér Chromium + registrér MCP'en til PDF og formularudfyldning.

**Definerende principper** (fra
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

- **Open source, helt seriøst** — MIT, ingen betalt niveau, ingen venteliste, ingen
  telemetri, ingen konti. Systemet fungerer uden betalte niveauer,
  konti eller telemetri. Kodebidrag gennemgår community-review
  før udgivelse.
- **Datasuverænitet** — `cv.md`, `config/profile.yml`, `data/`,
  `reports/`, `interview-prep/` forlader aldrig din laptop, medmindre du
  eksplicit pusher dem. Du kører det lokalt på din maskine og bevarer
  fuld datasuverænitet.
- **AI-agnostisk arkitektur** — career-ops bundter IKKE en model.
  Det fungerer som kommandoer inde i eksisterende AI-kodnings-CLI'er. Skift
  udbyder (Anthropic ↔ Gemini ↔ OpenAI), og din evalueringshistorik
  forbliver konsistent.
- **Menneskestyrede indsendelser** — career-ops udarbejder svar og
  åbner formularen, men **du klikker på Indsend**. Systemet
  ansøger aldrig automatisk. Systemet leverer struktur og evaluering; mennesker
  bevarer den endelige indsendelsesmyndighed.
- **Struktureret søgning** — bygget til en aktiv, bevidst jobjagt
  med mange ansøgninger; ikke et enkelt-indsendelsesværktøj, ikke en
  anbefalingsmotor. Opsætning tager ~15 minutter og forudsætter, at du er
  fortrolig med terminalen.

**Hvad career-ops IKKE er** (eksplicitte ikke-mål):

- Ikke en auto-ansøger. Den indsender ikke formularer for dig.
- Ikke en CV-genopbygger. Den skræddersyr per JD; den opfinder ikke
  erfaring.
- Ikke en LinkedIn-optimerer. Din profil er din egen sag.
- Ikke en regneark-erstatning, der gemmer sig bag en SaaS-UI. Dataene
  er almindelig markdown på dit filsystem.

**Nøglebegreber** (fuld oversigt — hver artefakt career-ops rører ved):

| Begreb | Hvad det er |
|---|---|
| **Mode** | En promptskabelon under `modes/<slug>.md`. Indbygget: `oferta`, `deep`, `apply`, `pipeline`, `batch`, `contacto`, `followup`, `interview-prep`, `patterns`, `project`, `training`, `ofertas`, `auto-pipeline`, `pdf`, `latex`, `scan`, `tracker`. |
| **Archetype** | En målrolle-profil i `config/profile.yml`. Rubrikken vægter færdighedsmatch mod den aktive arketype — **det enkeltvis vigtigste felt**. |
| **Pipeline** | `data/pipeline.md` — indbakke af JD-URL'er, der venter på at blive evalueret. |
| **Tracker** | `data/applications.md` — historisk GFM-tabel over hver evaluering + ansøgningsstatus. |
| **Report** | `reports/<NNN>-<company>-<DATE>.md` — fuld A–F-evaluering per JD, med score + legitimitet i headeren. |
| **Scan history** | `data/scan-history.tsv` — append-only log; forhindrer dubletter på tværs af scanninger. |
| **Proof points** | STAR+R-evidensblokke udtrukket fra `cv.md`, genbrugt på tværs af evaluering, ansøgningssvar og samtaleforberedelse. |
| **JD store** | `jds/jd-<date>-<ts>.txt` — ordrette jobopslag gemt under evaluering til revisionssporet. |
| **Interview-prep** | `interview-prep/<company>-<role>.md` — dybe research-briefs og runde-onepagers. |
| **Batch additions** | `batch/tracker-additions/*.tsv` — afventende rækker sat i kø af `batch-runner.sh` til fletning ind i trackeren. |

### career-ops vs career-ops-ui (denne app)

| | career-ops (CLI) | career-ops-ui (denne app) |
|---|---|---|
| Hvor det kører | inde i Claude Code / Gemini CLI / Codex / Qwen Code / OpenCode / GitHub Copilot CLI | `http://127.0.0.1:4317` i din browser |
| Flade | `/career-ops <mode>` skråstreg-kommandoer | sidebjælke med én side per arbejdsgang |
| Formularudfyldning | ja, via Playwright MCP | nej — genererer tjeklisten, du afslutter i CLI'en |
| PDF | `generate-pdf.mjs` | `📄 Generér PDF` på `#/cv`, `#/reports/:slug`, `#/evaluate`, `#/deep`, `#/interview-prep` |
| Datafiler | delt med career-ops-ui | delt med career-ops |

career-ops-ui er **rene tilføjelser**. Intet inde i `career-ops/`
ændres. Begge flader deler de samme `cv.md`, `config/profile.yml`,
`portals.yml`, `data/`, `reports/`, `interview-prep/`, `modes/`.

### Handlingstærskler efter score

Når en JD har en evaluering, bestemmer scoren, hvad du skal gøre
næste gang (kanonisk tabel fra
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

| Score | Næste skridt |
|---|---|
| **≥ 4.5** | Kør `/career-ops apply` — høj egnethed, push med det samme. |
| **4.0 – 4.4** | Ansøg, eller `/career-ops contacto` for en varm introduktion først. |
| **3.5 – 3.9** | Kør `/career-ops deep` — undersøg virksomheden / rollen, før du beslutter. |
| **< 3.5** | Spring over, medmindre du har en specifik personlig grund. |

career-ops-ui's `#/dashboard` og `#/tracker` fremhæver hver række på eller
over 4.0, så du kan vælge handling uden at køre noget om igen.

### Ekstern dokumentation

Fuld reference for den underliggende career-ops-motor
(scanning, evalueringsrubrik, batch-behandling, ansøgningsflow,
Playwright-opsætning) findes på
[career-ops.org/docs](https://career-ops.org/docs):

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)

---

## 1. Hurtig start — fuld trin-for-trin fra "opret CV" til "ansøgt og kontaktet"

Dette er den kanoniske, knap-for-knap-drejebog. Følg den i rækkefølge
første gang. Hvert trin nævner den nøjagtige rute, den nøjagtige knap
og hvad du vil se ved succes. Sektion 2–16 nedenfor dykker dybere ned i
hver fase.

> **Start og init med én kommando.** Fra en terminal kan du gøre hele
> bootstrappen uden at røre UI'en:
>
> ```bash
> career-ops-ui setup      # installér deps → doctor → kør serveren
> career-ops-ui init       # vælg LLM-udbyder + indsæt dens nøgle (echo undertrykt)
> career-ops-ui doctor     # genverificér når som helst (exit 0 ⇔ alt påkrævet grønt)
> career-ops-ui run        # start bare serveren på http://127.0.0.1:4317
> career-ops-ui open       # åbn + HÆV dashboard-fanen i din browser
> ```
>
> Efter `setup`/`run` åbnes browser-fanen **og bringes i
> forgrunden** automatisk (v1.43.0); `career-ops-ui open` gør det samme on
> demand, så du aldrig skal lede efter dashboard-fanen. `NO_OPEN=1`
> deaktiverer auto-åbning ved headless-/CI-starts.
>
> `setup` kører hele kæden selv. `init` skriver nøglen til den
> overordnede `career-ops/.env` gennem den samme validerede sti, som
> `#/config`-fanen API-nøgler bruger, og sætter `LLM_PROVIDER`
> (`auto` | `claude` | `gemini`), som de live evaluate / deep / mode /
> auto-pipeline-ruter respekterer. CI-form:
> `career-ops-ui init --provider claude --anthropic-key sk-ant-… --yes`.
> Foretrækker du UI'en? Fortsæt med trinene nedenfor.

### A. Opsætning (gør disse én gang, ~5 minutter)

**career-ops-ui skal ligge i `career-ops/web-ui/`** (indlejret i det overordnede career-ops-projekt). Den læser dit `cv.md`, `config/` og `data/` fra den overordnede mappe via `../` og fungerer ikke standalone. Hvis `career-ops-ui init` ikke findes efter en pull, kør `cd career-ops/web-ui && npm install && npx career-ops-ui init`.

**Trin 1 — Åbn appen på `http://127.0.0.1:4317`.** Hvis den ikke
kører, kør `bash bin/start.sh` fra repo-roden i en terminal.
Dashboardet (`#/dashboard`) indlæses.

**Trin 2 — Klik på `❤ Health` i venstre sidebjælke.** Hvert påkrævet
tjek skal være grønt:

- `cv.md`, `config/profile.yml`, `portals.yml` findes
- API-nøgle sat (mindst en af `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`)
- Playwright installeret (kun påkrævet hvis du vil bruge Generér PDF)

Hvis noget er rødt, fortæller siden dig den nøjagtige fil eller env-var, der skal
rettes. Fortsæt ikke, før Health er grøn.

**Trin 3 — Klik på `⚒ App settings` i sidebjælken.** Du lander på
fanen **API-nøgler og runtime**.
- Indsæt `ANTHROPIC_API_KEY` (foretrukket — bedre long-form-scoring)
  og/eller `GEMINI_API_KEY`. Hent nøgler fra
  <https://console.anthropic.com/settings/keys> eller
  <https://aistudio.google.com/apikey>.
- Klik på **💾 Gem**. Klik derefter på **▶ Test Anthropic** (eller Gemini) — en
  lille round-trip bekræfter, at nøglen virker.

**Trin 4 — Skift til fanen `Profile` på samme side.** Dette er den
direkte YAML-editor for `config/profile.yml`. Redigér som minimum:
- `candidate.full_name` — erstat enhver placeholder ("Jane Smith") med
  dit rigtige navn
- `candidate.email`, `linkedin`, `github` — bruges i ansøgningsbreve
- `target.roles` — de jobtitler, du vil ansøge til
- `target.comp_total_min_usd` — minimum total kompensation; tilbud under dette
  bliver flagget i sektion D af hver evaluering
- `target.archetypes` — de karrieremønstre, du accepterer (det enkeltvis
  mest virkningsfulde felt)

Klik på **💾 Gem**. Serveren validerer YAML'en og stempler den kanoniske
`# Career-Ops Profile Configuration`-header.

### B. CV (gør dette én gang, ~10 minutter)

**Trin 5 — Klik på `✎ CV` i sidebjælken.** To kolonner: editor til
venstre, live preview til højre.

**Trin 6 — Vælg én vej til at udfylde editoren:**
- **Upload et eksisterende CV** — klik på **📁 Upload CV**, vælg en af
  `.docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md`. Serveren
  konverterer til markdown via pandoc eller pdftotext, saniterer XSS
  og lægger resultatet i editoren. **Gennemgå konverteringen** —
  især PDF'er kan miste layouttroskab.
- **Indsæt markdown direkte** — tekstfeltet er en markdown-editor;
  højre rude er, hvad LLM'en (og din fremtidige rekrutterer) vil se.
- **Tone-tips:** ét punkt = én bedrift med en metrik. Hold dig
  under 1500 ord. Sektioner i denne rækkefølge: Summary, Experience,
  Projects, Education, Skills.

**Trin 7 — Klik på `💾 Gem` (øverst til højre på CV-siden).** Serveren
saniterer (`<script>` / `javascript:` / inline-handlere fjernes) og
skriver `cv.md`. Toast: *"Gemt"*.

**Trin 8 (valgfrit) — Klik på `📄 Generér PDF`.** Kører
`generate-pdf.mjs` i den overordnede (Playwright påkrævet) og **den nye
PDF auto-downloades** til din browser, når den er færdig. Listen nederst
på siden bevarer hver tidligere genereret fil.

### C. Find ledige stillinger (~2 minutter per scan)

**Trin 9 — Klik på `🌐 Scan` i sidebjælken.** Bekræft, at `portals.yml`
lister de boards, du bekymrer dig om (sektion 5 i denne hjælp). Tryk på
knappen **🌐 Scan nu**. En live SSE-log streamer, mens scanneren
gennemgår Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (engelske boards) og hh.ru / Habr
Career (russiske boards, hvis aktiveret).

**Trin 10 — Når scanningen er færdig, gennemgå resultaterne.** Klik på en
virksomhedstag for at filtrere; klik på ↗-ikonet for at åbne virksomhedens
karriereside i en ny fane. Hver ledig stilling, der overlevede
titelfilteret, er sat i kø i Pipeline.

### D. Vurdér tilbuddene (~30 sekunder per JD)

**Trin 11 — Klik på `Pipeline` i sidebjælken.** Du ser hver URL,
scanneren satte i kø. Klik på en post for at forhåndsvise JD'en inline.

**Trin 12 — Klik på `▶ Evaluate` ved siden af en JD.** Dette springer til
`#/evaluate`. Med en API-nøgle sat kører den live; uden en
får du en manuel prompt at indsætte i din egen LLM. Live-tilstand producerer en
**0–5 score** mod dit CV på tværs af sektion A–G (Role / Company /
Compensation / Risk / Stretch / Cultural fit / Verdict). Gem lander
i `reports/<date>-<slug>.md`.

**Trin 13 — Klik på `Reports` i sidebjælken** og gennemgå den seneste
evaluering. Alt under dit `comp_total_min_usd` er flagget rødt
i sektion D. Alt med `Verdict: pursue` er din shortlist.

### E. Beslut og lav dybt research på den shortlistede virksomhed (~3 minutter)

**Trin 14 — Vælg en stilling værd at forfølge. Klik på `Deep research`
i sidebjælken.** Indtast virksomhedens navn og rolle. Modellen
producerer et 7-sektions virksomhedsbrief (mission, seneste nyheder, tech-
stack, ansættelsessignaler, kompensationsbenchmarks, risici, anbefalet vinkel).
Gem lander i `interview-prep/<company>-<role>.md`.

### F. Ansøg (~5 minutter per ansøgning)

**Trin 15 — Klik på `Apply checklist` i sidebjælken.** Indsæt
stillings-URL'en + JD'en. Hjælperen genererer en trin-for-trin
indsendelsestjekliste:
- Skræddersyet ansøgningsbrev-udkast (bruger dit `cv.md` + `profile.yml`)
- Specifikke nøgleord at spejle fra JD'en
- Filer at vedhæfte (CV PDF — se trin 8)
- Hvor man ansøger (den kanoniske karriere-URL, ikke aggregator-
  omdirigeringer)
- Påmindelse: **ALDRIG auto-indsend** — endelig gennemgang og indsendelse er
  altid manuel.

**Trin 16 — Åbn karrieresiden i en ny fane.** Brug ansøgnings-
tjeklisten som din to-do-liste. Indsend gennem virksomhedens faktiske
formular. Vedhæft den PDF, du genererede i trin 8.

**Trin 17 — Ræk ud til et rigtigt menneske.** Åbn **Outreach**-tilstanden
(`#/contacto` i sidebjælken). Modellen udarbejder en kort LinkedIn- /
e-mail-besked skræddersyet til virksomhedsbriefet fra trin 14. Personaliser
indledningen (én specifik detalje fra dit dybe research-brief).
Send den.

### G. Spor og følg op (løbende)

**Trin 18 — Klik på `Tracker` i sidebjælken** og tilføj en række for
ansøgningen: virksomhed, rolle, score, status `Applied`, link til
rapporten, link til det dybe research-brief. Datoen udfyldes automatisk.

**Trin 19 — En uge senere: åbn `Follow-up`-tilstanden** (`#/followup`).
Udarbejder en høflig opfølgnings-e-mail, der refererer til den oprindelige ansøgning.
Send. Opdater tracker-status til `Followed up`.

**Trin 20 — Når du får en samtaleinvitation, kør `Interview prep`-
tilstanden** (`#/interview-prep`). Genererer målrettet forberedelse til den
specifikke virksomhed + fase (system design / behavioral / coding).
Trækker fra det dybe research-brief automatisk.

**Trin 21 — Fik du tilbuddet? Opdater tracker-status til `Offer`** og
genbesøg kompensationssektionen i din evalueringsrapport — dit minimums-
accepttal står lige der.

### TL;DR — sidebjælke-rækkefølgen matcher arbejdsgangen

`Health → App settings → Profile → CV → Scan → Pipeline → Evaluate
→ Reports → Deep research → Apply checklist → Outreach → Tracker
→ Follow-up → Interview prep → Activity log`

Det var det. 21 trin, knap-for-knap, fra nul til tilbud.

### Auto-pipeline med ét klik (`#/auto`) — genvejen på 21 trin

Hvis du bare vil score ét specifikt opslag hurtigt, så spring den manuelle
gennemgang over. **Sidebjælke → ✨ Auto-pipeline** (eller ✨-knappen på
Dashboardet) åbner en dedikeret skærm: indsæt job-URL'en, tryk på **Enter**
eller klik på **▶ Kør fuld pipeline**, og serveren kører hele kæden
i ét observerbart gennemløb:

1. **Validerer URL** — SSRF-sikkert tjek (`isValidJobUrl`); afviser
   loopback / `file:` / private IP'er / script-tegn.
2. **Henter jobbeskrivelse** — `safeGet` (DNS-pinned, redirect-
   revalideret) trækker + saniterer JD'en.
3. **Evaluerer mod dit CV** — Anthropic (foretrukket) → Gemini
   fallback → manuel prompt hvis ingen nøgle.
4. **Gemmer rapport** — skriver `reports/<slug>.md` med score +
   legitimitet i headeren.
5. **Tilføjer til tracker** — føjer en række til `data/applications.md`.

Live feedback er en lodret **stepper** (hvert trin lyser op
running → done / failed). Det er en ordnet liste med `aria-current`
på det aktive trin og et høfligt skærmlæser live-område, der annoncerer
hver overgang. Ved succes deep-linker resultatkortet direkte til den
gemte rapport (**Vis rapport · N/5**) og **trackeren**. Et fejlet
trin markeres rødt med sin besked, og knappen genaktiveres, så du
kan rette URL'en og prøve igen uden at genindlæse.

**Ingen API-nøgle?** Pipeline kører i **manuel tilstand**: trin 3–5
kollapser, og du får et klar-til-indsæt promptkort (kopier ind i Claude
Code / Anthropic / Gemini). Intet live LLM-kald, ingen omkostning.

`#/auto` er linkbar: `#/auto?url=<encoded>&go=1` åbner skærmen og
starter automatisk. Dashboardets ✨-knap og denne sidebjælke-post lander begge
her (et enkelt sammenhængende flow — den transiente modal fra før 1.34 blev
forfremmet til denne side).
> **CLI (v1.38.0).** Én kommando kører kæden: `career-ops-ui setup` (bootstrap → installér → start). Standalone-verber: `career-ops-ui doctor` (env/nøgler/værktøjs-tjek — samme motor som Health-siden; exit 1 ved enhver påkrævet fejl), `career-ops-ui run`, `career-ops-ui init` (udbyder+nøgle-wizard, v1.39.0).
> **Udbydere (v1.39.0).** API-nøgle-fanen tilføjer en `LLM_PROVIDER`-select (`auto` = Anthropic→Gemini standard · `claude` · `gemini`) og et `OPENAI_API_KEY`-felt (Codex/OpenCode CLI-siden). `career-ops-ui init` er en interaktiv wizard til det samme.
>
> **Udbydere (v1.57.0).** Headless live-eval spænder nu over **Anthropic → Gemini → OpenAI → Qwen → OpenRouter** (`auto`-rækkefølgen; `LLM_PROVIDER` fastlåser én). **OpenRouter** — én `OPENROUTER_API_KEY` fronter 300+ modeller; `OPENROUTER_MODEL`-dropdownen indlæser OpenRouters live-katalog (server-side proxy, kurateret offline-fallback). Også rettet: nøgler indsat med en efterstillet linjeskift / omgivende mellemrum trimmes nu før validering, så `/#/config` ikke længere viser "validation failed" for nogen udbyder.



---

## 2. App settings og API-nøgler (`#/config`)

> **Nyt i v1.55 → v1.56.** Med **ingen** LLM-nøgle sat forklarer et rødt banner på hver skærm, at ⚡ Run-live er i manuel-prompt-tilstand og linker hertil; når en nøgle er sat, bliver det en stille chip, der navngiver den aktive udbyder. Før enhver ⚡ Run-live-knap (`#/auto`, `#/evaluate`, `#/deep`, modes) vises et ærligt omkostningsskøn (f.eks. "Estimeret omkostning: OpenAI gpt-5-codex · ~$0,04/eval", eller en ingen-API-omkostning-note i manuel tilstand). `#/scan` gemmer sekundære filtre bag en **Avancerede filtre**-foldning; `#/tracker` tilføjer klikbare tragt-chips + valgfri server-side-paginering; `#/pipeline` virtualiserer ud over 1000 rækker.

Tre faner:

1. **API-nøgler og runtime** — struktureret feltformular over det overordnede
   projekts `.env` (samme fil, som career-ops Node-scripts læser ved
   opstart). Grupperet: API-nøgler / Runtime / Regionale kilder. Fanen
   eksponerer også per-udbyder-modelvælgere — `OPENAI_MODEL`
   (OpenAI/Codex) sammen med `ANTHROPIC_MODEL` og `GEMINI_MODEL`.
2. **Profile** — **felt-for-felt-formular** over `config/profile.yml`
   (web-ui 1.32.0). Gem **fletter** ind i filen — dine arketyper,
   proof points og eventuelle brugerdefinerede nøgler bevares urørte.
3. **Modes** — **struktureret feltformular** for `modes/_profile.md`
   (web-ui 1.54.3), afledt af det dokumenterede skema. Liste-type-
   sektioner — **Target Roles / Adaptive Framing / Comp Targets** —
   gengives som gentagelige linjepost-inputs (tilføj/fjern rækker); prosa-
   sektioner — **Exit Narrative / Location Policy** — gengives som
   mærkede tekstfelter; enhver ukendt eller ikke-liste-sektion falder tilbage til
   et mærket ordret tekstfelt. Gem **fletter stadig per sektion** —
   indledningen, urørte sektioner og eventuelle brugerdefinerede sektioner
   bevares byte-for-byte. En *Avanceret: rå markdown*-foldning
   forbliver til fuld-fil-redigeringer — tilføjelse/fjernelse af sektioner eller redigering
   af indledningen.

Et gem i en hvilken som helst fane forplanter sig med det samme — ingen server-genstart.

**Opsætning af din LLM-udbyder (trin for trin).** Web-UI'ens ⚡ live-evaluering kører *headless* og bruger én API-nøgle. Den virker via "ELLER" — sæt **en hvilken som helst** af disse, og det virker bare; med flere sat foretrækker `auto` dem i denne rækkefølge: Anthropic → Gemini → OpenAI → Qwen. (career-ops selv er CLI-agnostisk — du kører den også inde i Claude Code, Codex, Gemini, OpenCode, Qwen, Copilot eller Kimi; det er adskilt fra denne headless-nøgle.)

1. Åbn `#/config` → fanen **API-nøgler og runtime**.
2. Vælg din udbyder i **`LLM_PROVIDER`**: `auto` (brug hvilken nøgle der er sat), eller tving en med `claude` / `gemini` / `openai` / `qwen`.
3. Udfyld nøglen + modellen for den udbyder, du valgte:
   - **Anthropic** — sæt `ANTHROPIC_API_KEY` (console.anthropic.com), valgfrit `ANTHROPIC_MODEL` (standard `claude-sonnet-4-6`).
   - **Gemini** — sæt `GEMINI_API_KEY` (aistudio.google.com/apikey), valgfrit `GEMINI_MODEL` (standard `gemini-2.0-flash`).
   - **OpenAI** — sæt `OPENAI_API_KEY` (platform.openai.com), valgfrit `OPENAI_MODEL` (standard `gpt-5-codex`).
   - **Qwen** — sæt `QWEN_API_KEY` (Alibaba Model Studio / DashScope, dashscope.console.aliyun.com), valgfrit `QWEN_MODEL` (standard `qwen-max`). For fastlands-CN-endpointet sæt `QWEN_BASE_URL` i den rå `.env`.
4. Klik på **Gem**. Nøgler skrives til det overordnede projekts `.env`; ændringen træder i kraft med det samme — ingen server-genstart nødvendig.
5. Verificér på `#/evaluate`: indsæt en job-URL/beskrivelse og tryk på **⚡ Kør live**. Resultatheaderen viser, hvilken udbyder der kørte (`anthropic` / `gemini` / `openai` / `qwen`). Ingen nøgle sat nogen steder → du får i stedet den kopier-indsæt manuelle prompt.

Hemmeligheder maskeres efter gem og logges aldrig. Model-id-felter (`*_MODEL`) er ikke hemmelige.

### Profile-fanen (feltformular — v1.32.0)

Før v1.32.0 var denne fane et enkelt rå-YAML-tekstfelt, hvor hver
indstilling levede i én udifferentieret klump. Det er nu en struktureret
formular, felter grupperet i tre sammenfoldelige sektioner:

- **Candidate** — Fulde navn (påkrævet), E-mail, Telefon, Lokation,
  LinkedIn, GitHub, Portfolio-URL, X / Twitter.
- **Narrative** — Headline, Exit-historie.
- **Compensation** — Målinterval, Valuta, Walk-away-minimum,
  Lokationsfleksibilitet.
- **Strukturerede array-editorer** (web-ui 1.35.0) — tilføj/fjern-række-
  editorer til de liste-formede felter, så selv disse ikke længere behøver
  den rå YAML: **Target roles** + **Superpowers** (strenglister);
  **Archetypes** (name / level / fit-rækker); **Proof points** (name /
  url / hero-metric-rækker). Tomme rækker droppes; en tømt liste
  fjerner nøglen rent. Samme flet-ikke-erstat-garanti — hvert
  array, du ikke rører, overlever urørt.

Sådan er gemningen sikker:

- Formularen sender kun de 14 modellerede skalar-stier som
  `{ fields: { "candidate.full_name": … } }`. Serveren **læser den
  eksisterende `config/profile.yml`, sætter/rydder kun disse blade og
  re-serialiserer hele objektet** — så indlejrede arrays, formularen
  ikke modellerer (`target_roles.archetypes`, `narrative.proof_points`,
  `narrative.superpowers`), og eventuelle brugerdefinerede nøgler, du tilføjede i hånden,
  **overlever round-trippet urørt**. Rydning af et felt fjerner den
  nøgle rent (intet `phone: ""`-restprodukt).
- Validering kræver stadig et fuldt navn; `# Career-Ops Profile
  Configuration`-headeren stemples automatisk.
- En afvejning: et feltformular-gem **re-serialiserer YAML'en, så inline
  `#`-kommentarer går tabt**. For at bevare kommentarer eller redigere indlejrede
  arrays, brug **Avanceret: redigér rå YAML**-foldningen nederst
  på fanen — det er pre-1.32-fuld-fil-editoren, uændret
  (erstatter hele filen ved gem).
- Den skrivebeskyttede oversigt på `#/profile` er den visuelle ledsager.

### Genkendte nøgler

| Nøgle | Hvad den gør | Hvor man får den |
|---|---|---|
| `ANTHROPIC_API_KEY` | Aktiverer live Anthropic SDK-kald. Foretrukket når både Anthropic + Gemini er sat — bedre long-form struktureret output til JD-scoring og dybt research. | <https://console.anthropic.com/settings/keys> |
| `ANTHROPIC_MODEL` | Tilsidesæt standard `claude-sonnet-4-6`. Prøv `claude-opus-4-7` til hårdere reasoning, `claude-haiku-4-5-20251001` til billigt-og-hurtigt. | — |
| `GEMINI_API_KEY` | Fallback når ingen Anthropic-nøgle. Bruges af `gemini-eval.mjs` til `oferta`-tilstand. Gratis-niveau virker til lav volumen. | <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | Tilsidesæt standard Gemini-model. | — |
| `(server uses default UA)` | Påkrævet ved kørsel af `hh.ru`-scanninger fra uden for Rusland (API'en returnerer 403 på almindelige User-Agents). Registrér en app på <https://dev.hh.ru/admin> og brug dens UA-streng. | dev.hh.ru |
| `PORT` | Express bind-port. Standard 4317. | — |
| `HOST` | Bind-adresse. Standard `127.0.0.1`. At sætte `0.0.0.0` eksponerer UI'en på LAN'et — **ingen auth-gate endnu**, se Production-readiness-dokumentet. | — |

### Adfærd

- **Læs** (`GET /api/config`) returnerer hver genkendt nøgle. Hemmelige
  nøgler (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) er **maskeret** — du ser
  `sk-ant•••••••a1b2`, aldrig den fulde værdi.
- **Gem** (`POST /api/config`) validerer hver værdi, skriver til
  `<parent>/.env` og anvender den straks på den kørende proces.
  Ingen genstart nødvendig.
- **Tom værdi sletter** nøglen. Nyttigt hvis du vil holde op med at bruge en russisk IP / VPN.

### Smoke-test-knapper

Efter gem, klik på **▶ Test Anthropic** eller **▶ Test Gemini** — begge
affyrer en lille prompt (≤256 tokens output), så du bruger stort set
intet, mens du bekræfter, at nøglen er korrekt forbundet. Returnerer en
~200-tegns prøve ved succes.

---

## 3. Profile (`#/profile` — også tilgængelig som `#/settings`)

En skrivebeskyttet oversigtskort-visning af `config/profile.yml`. **For at redigere**,
gå til **App settings → Profile-fanen** (`#/config` → Profile) — siden
web-ui 1.32.0 er det en felt-for-felt-formular (Candidate / Narrative /
Compensation), ikke en rå-YAML-klump. Gemninger fletter ind i samme fil;
denne side genparser ved genindlæsning.

De felter, der betyder mest:

- `candidate.full_name` — bruges i hver prompt. **Erstat
  skabelonens `Jane Smith`**, før du scanner noget for alvor, ellers vil dine
  genererede ansøgningsbreve gå ud under placeholder-navnet.
- `candidate.email`, `linkedin`, `github` — refereret i ansøgningsbrev-
  generering og ansøgningstjeklisten.
- `target.roles` — accepterede jobtitler. Scannerens positive filter
  bruger dette implicit (via `portals.yml::title_filter`).
- `target.comp_total_min_usd` — minimum total kompensation. Sektion D af hver
  evaluering flagger tilbud under dette.
- `target.archetypes` — det *vigtigste felt*. Disse er de
  karrieremønstre, du accepterer (f.eks. `Tech-Lead-Backend`,
  `Founding-Engineer`, `Data-Platform`). Hver JD matches mod
  dem, og den bedst egnede arketype lander i rapportheaderen.

Health-siden viser et **Profile customized**-tjek, der fejler, så
længe `full_name` matcher et kendt placeholder-navn.

---

## 4. CV (`#/cv`)

Eneste sandhedskilde for hver evaluering, dybt research og ansøgnings-
brev. Lever i `cv.md` i den overordnede projektrod.

### Redigeringsmuligheder

- **Indsæt det direkte** — tekstfeltet til venstre er en markdown-
  editor. Højre rude spejler, hvad LLM'en (og din fremtidige
  rekrutterer) ser.
- **📁 Upload CV** — vælg en lokal fil i et af disse formater, og
  serveren konverterer den til markdown for dig:
  - **Tekstformater** — `.md`, `.markdown`, `.txt`, `.html`, `.htm`
    sendes igennem (HTML går via pandoc → GFM markdown).
  - **Office-formater** — `.docx`, `.doc`, `.odt`, `.rtf`
    konverteres via **pandoc** (`brew install pandoc` på macOS,
    `apt install pandoc` på Linux).
  - **PDF** — `.pdf` udtrækkes via **pdftotext** fra Poppler
    (`brew install poppler` / `apt install poppler-utils`).
  - Den konverterede markdown lander i editoren; klik på **💾 Gem**
    for at persistere. Resultatet saniteres (samme XSS-strip som indsæt).
  - Hård grænse: **10 MB** per upload. Større filer → 413.
- **Fra LinkedIn** — nemmeste vej: åbn Claude Code i det overordnede
  projekt, kør `/career-ops`, indsæt din LinkedIn-URL og bed om
  `extract my CV from this and write it to cv.md`.

### Hvad bliver saniteret

Server-side kører hver PUT til `/api/cv` gennem `stripDangerousMarkdown`:

- `<script>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`, `<style>`,
  `<form>`-tags — fjernes fuldstændigt.
- Inline event-handlere (`onclick=`, `onerror=`, osv.) — strippet.
- `javascript:`, `vbscript:`, `data:text/html` URI-skemaer — neutraliseret.

Svaret inkluderer `sanitized: true`, når noget af ovenstående blev
fjernet, så du ved, om kilden havde noget ondsindet.

Maks. body-størrelse: 1 MB. Alt større returnerer 413.

### Andre knapper

- **sync-check** — kører `cv-sync-check.mjs` i det overordnede projekt.
  Flagger inkonsistenser: et projekt nævnt i dit CV, men ikke i
  `data/applications.md`-arketyper, osv.
- **📄 Generér PDF** — streamer `generate-pdf.mjs`. Output lander i
  `output/*.pdf`. Kræver Playwright (Health-siden viser, om det er
  installeret i den overordnedes `node_modules`). Når genereringen er færdig,
  auto-downloades den **nyeste** PDF til din standard Downloads-
  mappe; on-page-listen bevarer hver tidligere genereret fil.

### Tone- / format-tips

- Ét punkt = én bedrift med en metrik.
  *"Reducerede p99-latens med 38%"* slår *"forbedrede performance"* for
  hver evalueringsrubrik.
- Sektioner i denne rækkefølge: **Summary** (3–5 linjer), **Experience**
  (omvendt kronologisk), **Projects** (maks. 5), **Education**,
  **Skills** (dedupliceret, ingen buzzword-suppe).
- Hold det under 1500 ord. Scoring-rubrikken bruger tæt info; et
  vidtløftigt CV bliver straffet for støj.

---

## 5. Portaler og kilder (`portals.yml`)

Scanner-konfigurationen lever i `portals.yml` i den overordnede rod. Tre
sektioner betyder noget. SPA'ens tre sektioner (nedenfor) matcher det kanoniske
career-ops.org-skema fra
[scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
1:1.

> **Genvej:** `#/portals`-URL'en resolver nu direkte til **App
> settings** og (når en regional kilde er konfigureret) springer til
> **Regionale kilder**-gruppen — så et bogmærket eller indtastet `#/portals`-
> link ikke længere giver 404 (v1.42.0).

### `title_filter`

```yaml
title_filter:
  positive: [backend, engineer, senior, tech lead, golang, php]
  negative: [junior, intern, frontend, ios, android, java]
  seniority_boost: [Senior, Staff, Lead, Principal]
```

En scannet stilling består, når dens titel indeholder **mindst ét
positivt** nøgleord OG **ingen af de negative** nøgleord. Justér begge.
Nøgleord er case-insensitive delstrenge.

`seniority_boost` er den tredje title-filter-nøgle. Nøgleord listet
her filtrerer ikke noget ud — de skubber matchende jobs højere op i
resultaterne, så en "Senior Backend Engineer" lander over en "Engineer".
Standard: `["Senior", "Staff", "Lead"]`. Justér til at matche, hvordan dine
målroller er titulerede.

Start med 3–5 positive nøgleord for klarhed; udvid senere.

### `location_filter` (valgfrit — web-ui 1.33.0, parent #570)

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

Filtrerer scannede stillinger efter deres **location**-streng (case-insensitive
delstreng), anvendt af både ATS-sweepet og det regionale sweep.
Semantik, identisk med den kanoniske career-ops `scan.mjs`:

- Ingen `location_filter`-nøgle → hver location består (standard).
- En stilling med en **tom/manglende** location → består (manglende data
  straffes ikke).
- Et `block`-nøgleordsmatch → **afvist** (block har forrang over
  allow).
- `allow` tom → består (block har allerede ryddet den).
- `allow` ikke-tom → skal matche **mindst ét** nøgleord.

Top-niveau-nøgle i `portals.yml` (et søskende til `title_filter`, ikke indlejret
under `russian_portals`). Brug den til at droppe jobs, der overlevede
titelfilteret, men er i en region, du ikke kan tage.

Start med 3–5 positive nøgleord for klarhed; udvid senere.

**`content_filter` (valgfrit — web-ui 1.75.0, parent #974).** Et top-niveau-
søskende til `location_filter` med de samme `positive` / `negative`-nøgleord-
lister, men matchet mod et opslags **beskrivelse / snippet**-tekst i stedet
for dets location:

```yaml
content_filter:
  positive: ["python", "machine learning"]
  negative: ["security clearance", "on-site only"]
```

Identisk semantik med `location_filter`: ingen nøgle → alt består; et opslag
med en **tom/manglende** beskrivelse består (manglende data straffes ikke); et
`negative`-match → afvist; `positive` tom → består; `positive` ikke-tom →
skal matche mindst ét nøgleord (case-insensitive delstreng). Anvendt af både
ATS- og de regionale sweeps. Kun kilder, der leverer en beskrivelse/snippet
(f.eks. RSS), påvirkes — hvert andet opslag består — så aktivering af det dropper aldrig
stille rækker fra kilder, der ikke bærer en body. Brug den til at droppe et
titel-bestående opslag, hvis body afslører en deal-breaker.

**`trust_filter` (valgfrit — web-ui 1.76.0, parent career-ops v1.13.0).** En
top-niveau-blok, der **annoterer** (aldrig dropper) hvert scannet opslag med en
trust-score (0–100), et niveau (`high` / `medium` / `low`) og flag. Slået fra medmindre
til stede og ikke deaktiveret:

```yaml
trust_filter:
  enabled: true
  suspicious_domains: ["bit.ly", "tinyurl.com"]   # valgfrit — tilsidesætter standard-shortener-listen
  ats_allowlist: ["greenhouse.io", "ashbyhq.com"] # valgfrit — tilsidesætter standard-ATS-host-allowlisten
```

Heuristikker: manglende apply-URL (−40), ugyldig URL (−50), mistænkelig shortener-
domæne (−25), virksomhed↔domæne-mismatch (−15, springes over for kendte ATS-hosts).
Opslag under `high` får et sprogneutralt **⚠ score**-badge i `#/scan`-
tabellen (tooltippet lister flag-koderne), så du kan øjne low-trust-rækker
uden at noget bliver filtreret ud. Lad blokken være helt ude for at bevare den
pre-1.76-adfærd (ingen annotering, ingen badge).

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

`search_queries` driver det AI-drevne Option B-scan (`/career-ops scan`
inde i Claude Code / Codex). De udføres IKKE af det in-process
`npm run scan` (som kun rammer offentlige boards-API'er). Brug dem, når
du vil opdage roller hos virksomheder, der endnu ikke er i
`tracked_companies`. Sæt `enabled: false` for at beholde en post uden at
køre den.

### `tracked_companies`

```yaml
tracked_companies:
  - { name: Stripe,     enabled: true, careers_url: https://job-boards.greenhouse.io/stripe }
  - { name: Linear,     enabled: true, careers_url: https://jobs.ashbyhq.com/linear }
  - { name: JetBrains,  enabled: true, careers_url: https://jobs.lever.co/jetbrains }
```

Påkrævede felter per post: `name` og `careers_url`. Valgfrit:
`api` (eksplicit Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday
endpoint), `enabled: true|false` for at inkludere/ekskludere uden at slette
posten. ATS-scanneren detekterer ATS'en fra URL-mønsteret
(`job-boards.greenhouse.io/<slug>` → Greenhouse, osv.) og henter hver
virksomheds offentlige boards-api direkte. Virksomheder uden et genkendeligt
ATS springes over (**Active Companies**-kortet på `/#/scan` viser dem
i gråt med `○`).

**Per-tenant ATS-udbydere (v1.76.0 — parent career-ops v1.13.0-paritet).** Seks
flere ATS'er auto-detekterer direkte fra `careers_url` (eller et eksplicit `api:`), ingen
`provider:` nødvendig:

```yaml
tracked_companies:
  - { name: Acme,    enabled: true, careers_url: https://acme.bamboohr.com }          # BambooHR
  - { name: Foo,     enabled: true, careers_url: https://foo.breezy.hr }              # Breezy HR
  - { name: Bar,     enabled: true, careers_url: https://bar.jobs.personio.de }       # Personio (XML-feed)
  - { name: Baz,     enabled: true, careers_url: https://baz.recruitee.com }          # Recruitee
  - { name: SolidCo, enabled: true, careers_url: https://solid.jobs/public-api/offers/it }  # SolidJobs
  # Comeet kræver den fulde careers-api-URL (uid + token er ikke på den brandede side):
  - { name: ComeetCo, enabled: true, api: https://www.comeet.co/careers-api/2.0/company/<uid>/positions?token=<token> }
```

Hver fastlåser sin host med et anchored regex + `redirect:'error'` (SSRF-sikkert). Se
`docs/portals-examples.md` for fyldigere copy-paste-poster.

### `rss` (RSS / Atom-boards)

```yaml
tracked_companies:
  - { name: LaraJobs, enabled: true, provider: rss, rss: https://larajobs.com/feed }
  - { name: WeWorkRemotely, enabled: true, provider: rss, rss: https://weworkremotely.com/remote-jobs.rss }
```

Peg scanneren mod et hvilket som helst jobboard, der publicerer et RSS/Atom-feed (LaraJobs, WeWorkRemotely, RemoteOK, golangprojects, …) ved at tilføje en post med `provider: rss` plus en `rss:` (eller `feed_url:`)-nøgle — **ingen kodeændringer**. RSS-adapteren parser hvert `<item>` (CDATA + HTML-entiteter, titler/virksomheder tag-strippet), normaliserer det til et job og kører samme `title_filter` / `location_filter` + dedup + pipeline-append-flow som ATS-kilder. **RSS** vises derefter som en valgbar kilde i `#/scan`-filter-dropdownen. (web-ui v1.62.x)


### `russian_portals`

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]      # eller bare én
  area: 113                 # 1=Moskva, 2=SPb, 113=Rusland, 1001=remote
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Тимлид PHP"
```

`queries` er case-insensitive delstreng-match mod stillingstitler
på hh.ru og Habr Career. **Vær forsigtig med overlap med den negative
liste** — hvis `"Senior PHP"` er i `queries`, men `"php"` ender i
`title_filter.negative`, vil scanningen returnere nul resultater, og
konsollen vil advare dig om konflikten.


### Konfiguration af russiske portaler — detaljeret opsætningsguide

v1.29.0 leverer 5 russisksprogede adaptere. To behøver ikke andet end standard-UA'en (`habr-career`, HTML-scrape; `trudvsem`, statslig open-data-API — ingen nøgle, ingen IP-gate). To er HTML-scrapes af tech-boards (`getmatch`, `geekjob` — også ingen nøgle). En er den kanoniske hh.ru-API, som kan returnere 403 fra ikke-russiske IP'er, medmindre du sætter en `HH_USER_AGENT`-env-var via **App settings → API-nøgler og runtime** (eller kører serveren fra en russisk IP / VPN-exit-node).

#### Kildeoversigt

| Kilde-nøgle | Visningsetiket | Type | Auth | Geo-begrænsning |
|---|---|---|---|---|
| `hh` | hh.ru | JSON API | valgfri `HH_USER_AGENT` | ikke-RU IP'er kan give 403 |
| `habr` | Habr Career | HTML | ingen | ingen |
| `trudvsem` | Trudvsem | JSON API (open-data) | ingen | ingen |
| `getmatch` | GetMatch | HTML | ingen | ingen |
| `geekjob` | GeekJob | HTML | ingen | ingen |

#### Trin 1 — Åbn `portals.yml`

Filen lever i den overordnede `career-ops/`-rod (IKKE inde i `web-ui/`). Hvis den ikke findes endnu, kopiér eksemplet, der leveres med det overordnede projekt:

```bash
# fra den overordnede career-ops/-rod (IKKE web-ui/)
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

#### Trin 2 — Aktivér alle 5 kilder

Tilføj eller opdater `russian_portals`-blokken til at liste hver kilde, du vil scanne. Rækkefølgen i arrayet er irrelevant; scanneren gennemgår dem i registry-rækkefølge.

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]
  area: 113                  # 1=Moskva, 2=SPb, 113=Rusland, 1001=remote
  per_page: 50               # hvor mange stillinger per query per kilde
  only_remote: false         # sæt true for kun at beholde remote-opslag
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Backend Senior"
    - "Тимлид PHP"
```

#### Trin 3 — Justér queries og filtre

`queries` er de strenge, scanneren bruger til at søge i hver kilde. Hver query kører én gang på hver kilde — så 4 queries × 5 kilder = 20 kald per scan. Hold listen fokuseret (3–7 queries) for at holde scan-tiden under et minut. `area` er hh.ru-regionskoden (andre kilder ignorerer den). `per_page` begrænser, hvor mange stillinger hver kilde returnerer per query. `only_remote: true` filtrerer hvert resultat til remote-only på adapter-niveau (resultattabellen har stadig en separat Remote-chip).

#### Almindelige faldgruber

**Negativ-liste-kollision.** Hvis et ord fra en query (`"php"`, `"senior"`) også optræder i `title_filter.negative`, filtreres hvert resultat ud, før du ser det. Scanneren udsender en stderr-kollisionsadvarsel ved scan-tid — kig efter linjen `⚠ config: query "Senior PHP" contains "php" which is in the negative list`. Ret det ved at fjerne det kolliderende ord fra `negative`:

```yaml
title_filter:
  positive: [backend, senior, lead, php, go, golang, python]
  negative: [junior, intern, frontend, ios, android]
russian_portals:
  queries:
    - "Senior PHP"     # OK — "php" er ikke længere i negative-listen
    - "Senior Go"
```

#### Deaktivering af én kilde midlertidigt

For at deaktivere en kilde uden at slette dens data, drop bare dens nøgle fra `sources`:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem"]   # kun 3 af 5 kilder kører
```

#### Verificering af opsætningen

Efter at have gemt `portals.yml`:

```bash
# 1. Gem portals.yml.
# 2. I SPA'en, skift til #/scan.
# 3. Klik 🌐 Scan nu.
# 4. Hold øje med SSE-loggen for per-kilde-linjen per query:
#       "Senior PHP"
#         hh.ru    18
#         habr     21
#         trudvsem  3
#         getmatch  0
#         geekjob   2
#    En værdi på 0 er normal for nogle queries — det betyder bare, at
#    den kilde ikke havde nogen match. En "geo-blocked"- eller "timeout"-linje betyder,
#    at adapteren nåede sitet, men ikke kunne læse resultater.
```

### CLI bootstrap-flow ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

Den kanoniske career-ops-opsætning (kør fra den overordnede rod én gang):

```bash
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

Det er hele bootstrappen. Redigér de tre sektioner (`title_filter`,
`tracked_companies`, `search_queries`, valgfri `russian_portals`),
gem, og du er klar til at scanne.

### SPA bootstrap-adfærd

Ved første kørsel føjer serveren en dokumenteret `russian_portals:`-blok
til `portals.yml`, hvis den mangler — idempotent (anden boot er en no-op,
fordi den bogstavelige `russian_portals:`-linje nu er der). De engelske
sektioner auto-injiceres IKKE; de kommer fra den
`templates/portals.example.yml`, du kopierede per den kanoniske bootstrap
ovenfor.

---

## 6. Health (`#/health`)

Hver opsætnings-gate, i OK / OPTIONAL / FAIL-badges. Læs dette, før
du opretter en "virker ikke"-sag.

### Påkrævede tjek (systemet kan ikke fungere uden disse)

- `Node version` ≥ 18 — serveren bruger native `fetch` og
  `node:test`.
- `Project root` — at `CAREER_OPS_ROOT` (env eller auto-detekteret)
  findes.
- `cv.md`, `config/profile.yml`, `portals.yml`,
  `data/applications.md`, `data/pipeline.md`, `modes/oferta.md`.

### Valgfrie tjek (kun advarsler)

- `Profile customized` — `candidate.full_name` er ikke skabelon-
  placeholderen.
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` — sat i `.env`.
- `(server uses default UA)` — betyder kun noget, hvis du scanner hh.ru fra uden for Rusland.
- `Playwright (parent node_modules)` — påkrævet til PDF-generering
  og `check-liveness.mjs`. Installér med
  `cd $CAREER_OPS_ROOT && npm install && npx playwright install chromium`.
- `Parent project dependencies` — `cd $CAREER_OPS_ROOT && npm install`
  hvis manglende.
- `data/`, `reports/`, `output/`, `jds/`-mapper — auto-oprettet ved
  første skrivning.

Når serveren er eksponeret ud over loopback (`HOST=0.0.0.0`) erstattes de
absolutte stier og den nøjagtige Node-version med `"hidden"` i
svaret, så en nysgerrig nabo ikke kan fingerprint'e din installation.

### Kør-knapper

- **▶ Doctor** kører `node doctor.mjs` og viser outputtet i en modal.
- **▶ Verify pipeline** kører `node verify-pipeline.mjs`.

---

## 7. Scan (`#/scan`)

Scanneren gennemgår hvert aktiveret board, deduplikerer mod din
historik og skriver hits ind i `data/last-scan.json` og
`data/pipeline.md`.

### Scan med ét klik (SPA)

**🌐 Scan** kører hver aktiveret kilde i ét enkelt sweep:

- Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (ATS-sweepet) for hver virksomhed i
  `tracked_companies` med en genkendelig ATS-URL.
- v1.75.0-aggregatorerne for hver `tracked_companies`-post, der vælger en til: RemoteOK / Remotive / Working Nomads (board-brede remote-feeds, `provider: <slug>`) og IBM / Arbeitsagentur / Glints / Jobstreet · SEEK (config-drevet, per-post `<provider>:`-blok).
- hh.ru API + Habr Career + Trudvsem + GetMatch + GeekJob for hver query i `russian_portals`.

**To faser, ét klik (v1.29.2).** Den enkelte 🌐 Scan-knap driver BÅDE ATS-sweepet og det regionale sweep i én SSE-stream. Du vil se to fase-headere i loggen, i rækkefølge:

1. `▶ ATS scan (Greenhouse + Ashby + Lever)` — EN ATS-boards.
2. `▶ Regional scan (hh.ru + Habr Career)` — 5 RU-kilder fra registreringen.

Hver fase slutter med en `✓ done · NEW=N`-opsummering. Hvis du kun ser ATS-fasen, er din stand på en pre-v1.29.2-build — opgradér. Pre-v1.29.2 lukkede SSE-klienten ved den første `done`-event, og den regionale fase blev stille droppet (`tests/scan-stream-multi-phase.test.mjs` er regression-nettet).

Live SSE-log streamer til højre rude, mens scanningen kører. Klik
**Stop** (eller naviger bare væk) for at afbryde — serveren annullerer
in-flight HTTPS-anmodninger via `AbortController`.

### Filtrering af resultater

Under loggen gengiver resultattabellen rækker fra `data/last-scan.json`.

> **v1.76.0 — ingen resultatgrænse.** Tidligere builds lagrede højst 2000 matchende rækker
> per region (`MAX_STORED_RESULTS`), og skjulte stille halen af et stort sweep.
> Den grænse er **væk**: hvert matchet opslag lagres, og tabellen
> pager bare igennem dem (200 per side — brug pager-kontrollerne under tabellen).
> Intet droppes; du vender bare sider.

Filtre:

- **Fritekst** — delstreng-match mod titel / virksomhed.
- **Source**-dropdown — Arbeitsagentur / Ashby / BambooHR / Breezy HR / Comeet / GeekJob / Glints / Greenhouse / GetMatch / Habr Career / hh.ru / IBM / Jobstreet · SEEK / Lever / Personio / Recruitee / RemoteOK / Remotive / RSS / SmartRecruiters / SolidJobs / Trudvsem / Workable / Workday / Working Nomads (auto-udfyldt fra `GET /api/scan/sources`).
- **Remote / Hybrid / Onsite**-dropdown.
- **Stack-chips** (PHP / Go / Backend / Senior / …) — auto-detekteret
  per række af `Skills.detectTech` og `Skills.detectLevel`. Multi-select
  intersektion — at vælge `PHP + Senior` viser rækker, der har BEGGE.
- **Dynamiske chips** under de statiske stack-chips — top-25 mest
  hyppige kapitaliserede tokens fra titler, så UI'en tilpasser sig til
  hvilke roller du faktisk scanner (marketing, design, finans…)
  i stedet for at være låst til backend-engineer-vokabularet.

### Active Companies-kort

Et sammenfoldeligt kort, der lister hver virksomhed i `portals.yml` med dens
scan-status:

- ✓ grøn tag — direkte API-understøttelse (Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday).
- ○ grå tag — fallback til web-søgnings-prompt (intet API-match).

**Klik på virksomhedsnavnet** → udfylder resultatfilteret ovenfor med det
navn. **Klik på ↗-ikonet** → åbner virksomhedens `careers_url` i en
ny fane.

### CLI scan-flow ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

To måder at scanne fra CLI-siden (begge deponerer URL'er til samme
`data/pipeline.md`, som SPA'en læser):

**Option A — direkte script (~30 s, nul AI-tokens):**

```bash
npm run scan                          # alle Greenhouse/Ashby/Lever-boards
npm run scan -- --dry-run             # forhåndsvis uden at persistere
npm run scan -- --company Anthropic   # begræns til én tracked company
```

Virker kun for Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (genkendelige ATS-URL'er).
Ingen AI-tokens forbruges — det rammer de offentlige boards-API'er direkte.

**Option B — AI-drevet browser-scan:**

```
/career-ops scan
```

Inde i Claude Code / Codex / Cursor / Gemini CLI. Bruger model-tokens.
Besøger hver `tracked_companies`-side direkte og kan opdage ikke-API-
boards (karrieresider, custom ATS, regionale portaler). Langsommere men
bredere. Nyttig når et ATS-sweep ikke returnerer noget for et mål, du
ved er i gang med at ansætte.

**Output (begge veje)** — nye JD-URL'er føjet til `data/pipeline.md`,
hver besøgt URL logget til `data/scan-history.tsv` (dedup på tværs af alle
fremtidige scanninger), opsummering printet: virksomheder scannet · jobs fundet ·
filtreret efter titel · dubletter sprunget over · nye tilbud tilføjet.

**Handlingstærskler efter score** (anvend efter `/career-ops pipeline`
batch-scorer de nye URL'er):

| Score | Anbefalet næste skridt |
|---|---|
| **≥ 4.5** | `/career-ops apply` — høj egnethed, push med det samme |
| **4.0 – 4.4** | ansøg, eller `/career-ops contacto` for varm introduktion |
| **3.5 – 3.9** | `/career-ops deep` — undersøg først |
| **< 3.5** | spring over, medmindre du har en specifik personlig grund |

SPA'ens `#/dashboard` og `#/tracker` fremhæver hver række på eller
over 4.0, så du kan vælge handling uden at køre noget om igen.

### Opfølgningskommandoer

Efter scoring er de kanoniske opfølgninger:

- `/career-ops apply` — Udfyld ansøgning med skræddersyede svar
- `/career-ops contacto` — Udarbejd LinkedIn- / e-mail-outreach
- `/career-ops deep` — Undersøg virksomhed / rolle dybt
- `/career-ops tracker` — Vis pipeline-status

---
### hh.ru — scannet fra websitet (ingen opsætning, ingen proxy)

hh.ru scannes ved at læse dets offentlige søge-website (`hh.ru/search/vacancy`), på samme måde som Habr Career scannes — **det virker fra enhver IP, uden nøgle, proxy eller konfiguration.** JSON-API'en (`api.hh.ru`) bruges bevidst *ikke*: den returnerer nu `403 forbidden` til hver programmatisk klient uanset IP eller User-Agent (en edge anti-bot-blokering, ikke en dokumenteret API-fejl), hvorimod websitet serverer fulde resultater til enhver browser-lignende klient. Så hh.ru kører nøjagtigt som Habr og Trudvsem — hold den bare i `russian_portals.sources` og scan.

## 8. Pipeline (`#/pipeline`)

Indbakke af URL'er, der venter på at blive evalueret. Lever i `data/pipeline.md`.

### Tilføjelse af URL'er

Tre måder:

- Skriv / indsæt en URL i inputtet + klik på **+ Tilføj**.
- Tryk på **Ctrl+K** (eller **Cmd+K**) for at fokusere den globale søgning, indsæt
  et hvilket som helst `http(s)://…`-link, tryk på **Enter** — URL'en går ind i
  pipeline med det samme.
- Kør en Scan (se ovenfor) — friske hits går til pipeline
  automatisk.

Hver URL passerer gennem `isValidJobUrl()` server-side. Loopback
(`localhost`, `127.0.0.1`), `file://`, `javascript:`, IP-literaler og
strenge med template-tegn (`<`, `>`, `"`) giver alle 400.

### Server-side preview-rude

Klik på en hvilken som helst pipeline-række for at indlæse en preview til højre. De fleste ATS-boards
sender ikke CORS-headere, så browseren ikke kan hente dem direkte; serveren
proxyer anmodningen, stripper `<script>` / `<style>` / HTML-tags og
returnerer op til 8 KB almindelig tekst.

Preview-proxyen gennemgår omdirigeringer manuelt med **per-hop SSRF-
validering** — hver `Location`-header kører gennem `isValidJobUrl()`
igen, så et fjendtligt board ikke kan sende dig til loopback / privat IP
/ `file://`. Begrænset til 3 hops, 15-sekunders timeout.

### Rækkehandlinger

- **▶** — springer til `#/evaluate?url=…` med URL'en for-udfyldt.
- **✕** — fjerner URL'en fra `data/pipeline.md`.

### Knapper øverst til højre

- **⚡ Evaluér første** — åbner den første køsatte URL på Evaluate-
  siden, klar til at score.
- **Scan** — tilbage til scanneren, hvis du vil have flere URL'er.

---

## 9. Evaluate (`#/evaluate`)

Scorer en enkelt jobbeskrivelse mod `cv.md` og
`config/profile.yml`. Returnerer en struktureret A–G-evaluering per
`modes/oferta.md` plus en 0–5 score.

### Input

Indsæt JD'en i tekstfeltet, eller ankom her fra `#/pipeline` med
`?url=<href>` — siden henter URL'en gennem samme SSRF-sikre
proxy, der bruges til pipeline-previews, og for-udfylder tekstfeltet.

Klik på **💾 Gem JD** for at persistere JD'en til `jds/jd-<date>-<ts>.txt`
til revisionssporet (eller send `save: true` i API-kaldet — samme
effekt).

### Fallback-kæde

1. **Anthropic** — foretrukket når `ANTHROPIC_API_KEY` er sat.
   Serveren bundter `cv.md`, `config/profile.yml`, `modes/_shared.md`,
   og `modes/oferta.md` ind i en `<project_context>`-blok før
   prompten (hver fil begrænset til 16 KB, fuld prompt soft-capped ved
   200 KB). Returnerer grundet markdown direkte til siden.
2. **Gemini** — når kun `GEMINI_API_KEY` er sat. Serveren spawner
   `gemini-eval.mjs` med JD'en som en temp-fil. Gratis-niveau-model
   (`gemini-2.0-flash`) er fin til rutinescoring.
3. **Manuel** — ingen nøgle sat. Siden returnerer en fuldt formet prompt,
   du kan indsætte i Claude Code, ChatGPT eller en hvilken som helst anden LLM.

### Output-sektioner (kanoniske career-ops.org A-F)

> **v1.15.0-omjustering.** Block-bogstaver matcher nu det
> [kanoniske career-ops.org-skema](https://career-ops.org/docs).
> Pre-v1.15-rapporter brugte A–G (med `C=Risks`, `F=Verdict`,
> `G=Legitimacy`); vi gengiver dem stadig som de er for baglæns
> kompatibilitet, men nye rapporter udsender A–F med den kanoniske
> semantik nedenfor. Score og Legitimacy lever nu i rapport-
> headeren (`score: 4.2/5`, `legitimacy: High|Medium|Low`).

A. **Role Summary** — 3-punkts genopsummering (risici nævnt inline).
B. **CV Match** — top 3 færdigheds-hits + top 3 manglende.
C. **Strategy** — anbefaling: ansøg nu / contacto først /
deep først / spring over. Var `Risks` før v1.15.
D. **Compensation** — relativt til dit
`target.comp_total_min_usd` (legacy) eller `compensation.target_range`
(kanonisk).
E. **Personalization** — vinkel at lede med, framing per arketype,
hooks at nævne i ansøgningsbrev / outreach. Var `Application
Strategy` før v1.15.
F. **STAR stories** — 1–3 klar-til-indsæt S-T-A-R-blokke skræddersyet
til rollen. Var `Verdict` (rå score) før v1.15; score vises nu
i rapportheaderen sammen med `legitimacy`.

### Gemning af rapporten

Klik på **💾 Gem rapport** (eller brug gem-toggle i API-kaldet) for at
persistere markdownen til `reports/<date>-<company>-<role>.md`. 
Rapportens parsede header (Score / Legitimacy / URL) vises på
**Reports**-siden og **Dashboardet**.

### Batch-evaluér når du har 10+ JD'er

For en enkelt JD er denne `#/evaluate`-side det rigtige værktøj. For 10+
URL'er køsat i pipeline er den per-JD click-through upraktisk
— spring til §14's **Batch evaluate**-underafsnit (kørsel af
`./batch/batch-runner.sh` fra den overordnede), lad den arbejde sig igennem
natten over, og kom så tilbage til `#/reports` / `#/tracker` for
resultaterne. Fuldt flow:
[batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers).

---

## 10. Reports (`#/reports`)

Gennemse hver gemt evaluering. Kort viser titel, dato, legitimitets-
flag og score (farvekodet: grøn ≥ 4.0, gul ≥ 3.0, rød under).

Klik på et kort for at læse den fulde markdown. Paginering: 12 per side;
kontroller nederst.

Enkelt-rapport-visningen har også:

- **← Alle rapporter** — tilbage til gitteret.
- **🔗 Åbn JD** — åbner det oprindelige jobopslag i en ny fane.

---

## 11. Tracker (`#/tracker`)

CRM'en. Én række per ansøgning; lever i `data/applications.md` som en
GitHub-Flavored Markdown-tabel.

### Statusflow

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` /
`Rejected` / `Discarded` / `SKIP`.

Status-whitelisten håndhæves server-side; at sende noget andet i
en `POST /api/tracker` defaulter til `Evaluated`. Den kanoniske
`Evaluated → Applied`-overgang er automatisk, når du bekræfter
`Submitted.` i slutningen af `/career-ops apply` (se §14).

### Kolonnelayout

| Kolonne | Hvad det er |
|---|---|
| `#` | Auto-nummereret, nul-padded (`001`, `002`, …). |
| `Date` | ISO-dato (`YYYY-MM-DD`). Defaulter til i dag. |
| `Company` | Fritekst. **Pipes (`\|`) og linjeskift escapes automatisk.** |
| `Role` | Samme. |
| `Score` | `N/5`-format (f.eks. `4.2/5`). |
| `Status` | Whitelistet enum. |
| `PDF` | ✅ når `generate-pdf.mjs` lykkedes for denne række. |
| `Report` | Markdown-link til det matchende `reports/*.md`. |
| `Notes` | Fritekst, begrænset til 200 tegn. |

### Filtre

- **Status**-dropdown.
- **Score**-dropdown — `≥ 4.0` (høj), `≥ 3.0` (mid), `< 3.0` (lav).
- **Søg** — delstreng-match på tværs af virksomhed + rolle.

Hvert filter nulstiller paginatoren til side 1. 25 rækker per side.

### Vedligeholdelsesknapper

- **▶ Normalize** kører `normalize-statuses.mjs` — re-kanoniserer
  status-stavemåder (`applied` → `Applied`, `interview` → `Interview`).
- **▶ Dedup** kører `dedup-tracker.mjs` — fjerner case-insensitive
  dubletter efter `(company, role)`.
- **▶ Merge** kører `merge-tracker.mjs` — trækker afventende poster ind fra
  `batch/tracker-additions/*.tsv` (hvor den overordnedes batch-flow dropper
  ansøgninger indsendt via Apply-hjælperen). Deduplikerer og
  arkiverer behandlede filer til `batch/tracker-additions/merged/`. Se
  [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  for upstream-batch-flowet.

### Tilføjelse af rækker

`POST /api/tracker` — body `{ company, role, score?, status?, url?,
reportSlug?, notes?, date? }`. Dedup efter `(company, role)`
case-insensitive. Fra UI'en tilbyder Evaluate-siden en "Add to
tracker"-knap efter en vellykket score.

---

## 12. Deep research (`#/deep`)

Generér et struktureret virksomhedsbrief: snapshot, engineering-kultur,
seneste nyheder, Glassdoor-sentiment, samtaleproces, forhandlings-
løftestænger, tre smarte spørgsmål at stille rekrutteren.

### Input

To felter — virksomhedsnavn og (valgfri) rolle. Mode-skabelonen
(`modes/deep.md`) er det, der former strukturen.

### Output-stier

Samme fallback-kæde som Evaluate:

1. **Anthropic live** (foretrukket) — `bundleProjectContext` inliner
   cv + profil + `_shared.md` + `deep.md`. Output: 10–30 KB
   grundet markdown gemt til
   `interview-prep/<company>-<role>.md`.
2. **Gemini live** — `gemini-eval.mjs`-invokation. Samme gem-mål.
3. **Manuel prompt** — siden giver dig en klar prompt til Claude
   Code (som har WebFetch + WebSearch og kan lave rigtigt research).

### Tips

- Anthropic på `claude-sonnet-4-6` returnerer typisk ~13 KB nyttig
  tekst på 1–3 minutter per kald.
- Anthropic SDK'en har ingen indbygget websøgning. For roller hvor du
  har brug for friske nyheder + Glassdoor-sentiment, indsæt den manuelle prompt i
  Claude Code og lad den bruge sit WebFetch-værktøj.
- Live-kørsler faktureres; ét Sonnet 4.6 deep-research-kald koster ≈
  $0,30–0,50.

---

## 13. Mode-prompts (de syv `/#/<mode>`-sider)

Syv prompt-byggere: **Project**-idéer, **Training**-planer,
**Follow-up**-e-mails, **Batch**-evalueringer, **Outreach** til
rekrutterere, **Interview prep**-onepagers og **Patterns**-
retrospektiver. Hver enkelt indkapsler en specifik `modes/<slug>.md`-skabelon:

| Side | Slug | Formål |
|---|---|---|
| `#/project` | `project` | Skræddersy et porteføljeprojekt til en målrolle. |
| `#/training` | `training` | Færdighedsgab-analyse → curriculum. |
| `#/followup` | `followup` | Efter-samtale-e-mail-udkast. |
| `#/batch` | `batch` | Multi-JD batch-evaluerings-prompt. |
| `#/contacto` | `contacto` | Outreach-besked til en rekrutterer / henvisning. |
| `#/interview-prep` | `interview-prep` | Onepager-forberedelse til en specifik samtalerunde. |
| `#/patterns` | `patterns` | "Hvilke mønstre gjorde mig succesfuld?"-reflekterende analyse. |

### Fælles form

Hver side har en lille formular (felterne er mode-specifikke), en **▶
Generér prompt**-knap (manuel), og — når en Anthropic- eller Gemini-
nøgle er til stede — en **⚡ Kør live**-knap, der forfremmes til primær.

At klikke på **▶ Generér prompt** returnerer den samlede prompt med dine
formularværdier JSON-strengificeret ind i en `User-supplied context:`-blok,
efterfulgt af den ordrette `modes/<slug>.md`-skabelon. Kopier og indsæt
i din LLM efter eget valg.

At klikke på **⚡ Kør live** sender den samme prompt til Anthropic (eller
Gemini), med `cv.md` + `profile.yml` + `_shared.md` inlinet via
`bundleProjectContext`. Resultatet gengives på siden, kan kopieres og
downloades som `.md`.

De syv sider er en eksplicit allowlist — modes der har en
dedikeret rute (`oferta` → Evaluate, `deep` → Deep research) og
modes det overordnede projekt kun understøtter inde i Claude Code (`apply`,
`scan`, `pipeline`, `tracker`, `pdf`, `latex`, `ofertas`,
`auto-pipeline`) holder sig bevidst uden for denne UI.

---

## 14. Apply checklist (`#/apply`)

Når du har besluttet at ansøge, genererer denne Apply-hjælperside en
indsendelsestjekliste til det faktiske ansøgningstrin. Den auto-udfylder **IKKE**
formularer — det flow forbliver i `/career-ops apply` inde i Claude Code,
som bruger Playwright i det overordnede projekt.

### SPA-tjeklistetilstand (`#/apply`)

SPA'ens tjekliste er til brugere, der foretrækker at udfylde formularen i hånden
uden at invokere Playwright. Den dækker:

0. Kør `/career-ops apply <url>` i Claude Code for at læse formularen via
   Playwright (spring dette trin over, hvis du udfylder i hånden).
1. Verificér, at opslaget stadig er live (`check-liveness.mjs`).
2. Bekræft, at CV'et er det nyeste (`cv-sync-check.mjs`, derefter PDF hvis score ≥ 4.0).
3. Skræddersy ansøgningsbrevet / "Why us?"-svaret ved hjælp af STAR+R proof
   points fra `cv.md`.
4. Besvar EEO- / sponsorship- / startdato-spørgsmål sandfærdigt.
5. Gem udfyldte svar til
   `interview-prep/{company}-{role}.md` før indsendelse.
6. **ALDRIG auto-indsend** — du (mennesket) klikker på den endelige knap.
7. Efter indsendelse: tilføj række til `data/applications.md` (eller skriv TSV til
   `batch/tracker-additions/`).

### Manuel udfyldning vs Playwright-assisteret

To veje til den faktiske indsendelse:

- **Manuel** — åbn karrieresiden i en normal browser-fane, følg
  SPA-tjeklisten ovenfor, kopier/indsæt svar. Ingen Playwright nødvendig.
  Brug når formularen er kort, eller du ikke har Chromium installeret.
- **Playwright-assisteret** — kør `/career-ops apply <company>` i
  Claude Code (overordnet projekt). Playwright åbner sin egen browser,
  læser hvert formularfelt, returnerer nummererede udkast-svar. Du klikker stadig
  på Indsend. Brug når formularen er lang, dynamisk, eller du vil have
  revisionssporet over hvilke spørgsmål, der havde hvilke svar.

### Fuldt CLI apply-flow ([apply-for-a-job](https://career-ops.org/docs/introduction/guides/apply-for-a-job))

**Forudsætninger:**

1. Kør `/career-ops pipeline` først, så JD'en har en evalueringsrapport
   under `reports/`. Apply-kommandoen afhænger af en eksisterende
   evaluering; uden en, kør pipeline indledningsvist.
2. Hav rapporten og profilen indlæst.
3. **Anbefalet:** Playwright installeret
   (`npx playwright install chromium` — se Playwright-opsætning nedenfor).
   Falder tilbage til WebFetch (kun-tekst formular-preview, ingen click-fill) når
   manglende.

**Nummereret flow** (kanoniske 8 trin):

1. **Kør kommandoen** med virksomhedsnavnet:

   ```
   /career-ops apply <company>
   ```

   Eksempel: `/career-ops apply Anthropic`. Uden et argument, lever
   et screenshot af formularen, formularteksten indsat eller ansøgnings-
   URL'en i næste tur.

2. **Find rapporten.** Systemet finder den matchende evaluering i
   `reports/` (den oprettet af `/career-ops pipeline` eller
   `#/evaluate` tidligere).

3. **Åbn formularen.** Playwright starter et browser-vindue
   **automatisk** — du åbner det IKKE selv.

4. **Læs felterne.** Systemet læser og parser hvert formularfelt
   (label, type, required, options for selects).

5. **Generér svar.** career-ops opretter skræddersyede svar for hvert
   felt baseret på din profil, proof points og rollen.

6. **Returnér nummereret liste.** Du modtager svar ordnet til at matche
   formularlayoutet — simple felter (navn, e-mail) først, fritekst-felter
   (ansøgningsbrev, "Why us?") sidst. Flaggede poster peger på ting,
   der kræver menneskelig opmærksomhed — løn-anker, manglende CV-detaljer,
   valgfrie spørgsmål.

7. **Manuel udfyldning.** Du kopierer og indsætter hvert svar i det
   tilsvarende felt. Dette trin er manuelt, ikke automatiseret. Du
   gennemgår hvert svar først.

8. **Bruger indsender.** Du klikker på Indsend selv. career-ops klikker
   **aldrig** på Indsend. Bekræft færdiggørelse ved at skrive i chatten:

   ```
   Submitted.
   ```

**Automatiske opdateringer ved `Submitted.`:**

- Status skifter `Evaluated → Applied` i `data/applications.md`.
- De udfyldte svar persisterer i Section G af rapporten til fremtidig
  reference.

**Overdragelse til tracker:**

```
/career-ops tracker
```

Overvåg hele din pipelines status, uanset rolle-score.

### Batch evaluate ([batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers))

Når du har 10+ JD'er at score på én gang (SPA'ens en-ad-gangen
`#/evaluate` er upraktisk til den volumen), brug batch-runneren
fra CLI'en.

**Inputfil — `batch/batch-input.tsv`** (tab-separeret):

| Kolonne | Formål |
|---|---|
| `id` | Unikt sekventielt nummer |
| `url` | Fuldt jobopslag-link |
| `source` | Oprindelsesplatform (LinkedIn, Greenhouse, osv.) |
| `notes` | Valgfri kontekstuel detalje |

Eksempelrække:

```
1<TAB>https://jobs.example.com/senior<TAB>LinkedIn<TAB>
```

**`./batch/batch-runner.sh`-flag:**

- `--dry-run` — Forhåndsvis afventende tilbud uden evaluering. Kør altid
  dette først for at validere TSV'en.
- `--parallel N` — Kør N workers samtidigt (1, 2 eller 3
  anbefalet).
- `--min-score X.X` — Spring persistering af tilbud, der scorer under
  tærsklen. Nyttigt til kun at beholde rapporter for høj-egnethed-roller.
- `--retry-failed` — Genbehandl kun de tilbud, der fejlede i den
  forrige kørsel (netværksfejl, rate limits).
- `--max-retries N` — Forsøg fejlede tilbud op til N gange (standard: 2).
- `--model NAME` — Claude-model sendt til `claude -p --model` (parent career-ops 1.8.0, #504). Usat = din Claude Max-abonnementsstandard. Brug en billigere model til store batches, f.eks. `claude-sonnet-4-6`. Vist i `#/batch` som **Model**-inputtet (web-ui 1.31.0).
- `--start-from N` — Spring tilbuds-ID'er under N over (genoptag en delvist behandlet batch). Vist i `#/batch` som **Start from #**-inputtet (web-ui 1.31.0).

**Standardsekvens:**

1. **Redigér** `batch/batch-input.tsv` — én række per JD.

2. **Dry-run** (anbefalet først):

   ```bash
   ./batch/batch-runner.sh --dry-run
   ```

3. **Kør** — sekventielt eller parallelt:

   ```bash
   ./batch/batch-runner.sh                       # én ad gangen
   ./batch/batch-runner.sh --parallel 2          # to samtidige
   ./batch/batch-runner.sh --parallel 3          # tre samtidige
   ./batch/batch-runner.sh --parallel 2 --min-score 4.0  # persistér kun høj-egnethed
   ```

4. **Genforsøg fejl** (netværk / rate-limit):

   ```bash
   ./batch/batch-runner.sh --retry-failed --max-retries 3
   ```

5. **Rapporter** lander i `reports/` som
   `{id}-{company}-{YYYY-MM-DD}.md`. Opsummeringsrækker føjes til
   `batch/tracker-additions/`.

6. **Flet ind i tracker:**

   ```bash
   node merge-tracker.mjs                 # anvend batch-tilføjelserne
   node merge-tracker.mjs --dry-run       # forhåndsvis fletningen
   ```

   Flet-kommandoen deduplikerer poster og arkiverer behandlede filer
   til `batch/tracker-additions/merged/`.

SPA'en viser de resulterende rapporter under `#/reports` (pagineret,
score-pille-farvet) og tracker-rækkerne under `#/tracker` — nøjagtigt
som hvis du havde tilføjet hver enkelt gennem `#/evaluate`. Par med
**▶ Merge**-vedligeholdelsesknappen på `#/tracker`, hvis du foretrækker ikke at
falde ned til CLI'en.

### Playwright-opsætning ([set-up-playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright))

Påkrævet til to career-ops-funktioner:

- **Formularudfyldning** i `/career-ops apply` (trin 3 ovenfor — Playwright
  åbner browseren, læser feltlabels, foreslår svar).
- **PDF-generering** via `/career-ops pdf` og SPA'ens
  **📄 Generér PDF**-knap på `#/cv` / `#/reports/:slug` /
  `#/evaluate` / `#/deep` / `#/interview-prep`.

**Fallback når Playwright mangler:** apply-flowet falder tilbage til
WebFetch (kun-tekst formular-preview, ingen click-fill). PDF-generering
fejler simpelthen.

**Kerneopsætning (kør fra career-ops-overordnet-roden):**

```bash
# Installér Chromium til Playwright
npm install
npx playwright install chromium

# Registrér Playwright MCP'en, så Claude Code kan drive formularer
claude mcp add playwright npx @playwright/mcp@latest

# Verificér alle tre komponenter (Chromium, Playwright-lib, MCP)
npm run doctor
```

**Alternativ MCP-registrering** — tilføj til
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

**Adfærdsnoter:**

- **Headless som standard.** Playwright opererer lydløst. For at se
  browseren i aktion, fortæl Claude `open up with playwright the browser
  and fill out the entire form.`
- **Tre roller i én pakke** — Playwright npm-installationen giver dig
  browser-automatiserings-biblioteket, PDF-renderingsmotoren til
  `/career-ops pdf` og (via MCP'en) formularudfyldnings-workflowet inde i
  Claude Code.
- **Verificér før du stoler på det** — `npm run doctor` bekræfter, at alle
  tre er operationelle. SPA'ens Health-side viser et
  `Playwright (parent node_modules)`-tjek, der fejler hurtigt, hvis det mangler.

---

## 15. Forberedelse til jobsamtale

Dette er post-research, præ-samtale-fasen. Tre artefakter i
denne app konvergerer:

1. **Gemte deep-research-filer** under `interview-prep/`, en per
   virksomhed-rolle-par du kørte. Gennemse fra **Deep research**-siden
   eller direkte via `/api/interview-prep`.
2. **Patterns-tilstand** (`#/patterns`) — genererer en selvreflekterende
   prompt: "på tværs af mine sidste N samtaler / tilbud / afslag, hvilke
   mønstre holder?" Nyttig når du har akkumuleret 5+ tracker-rækker.
3. **Interview-prep-tilstand** (`#/interview-prep`) — for-udfylder en
   onepager til en specifik kommende runde (behavioral, technical,
   system design). Output går ind i samme `interview-prep/`-
   mappe.

### Anbefalet workflow

For hver samtale du har i kalenderen:

1. **Kør Deep igen** (eller åbn den gemte fil) dagen før.
2. **`#/interview-prep`** — generér en onepager til den specifikke
   runde. Indsæt i dine noter.
3. **System design / coding-runder** — åbn `#/training` og bed om
   en 30-minutters målrettet genopfriskning af det specifikke delsystem, JD'en
   fremhæver.
4. **Kompensationsrunder** — åbn deep-research-filen, spring til
   "Negotiation leverage points". Medbring 2–3 specifikke datapunkter
   (Glassdoor-bånd, seneste funding, sammenligneligt tilbud hos en anden
   virksomhed).
5. **Behavioral-runder** — træk STAR+R-historier fra dit `cv.md`, der
   lander i sektion B af den oprindelige Evaluate-rapport.

Efter samtalen, med det samme:

1. Opdater tracker-rækken: status → `Responded` (derefter `Interview`,
   `Offer`, osv.).
2. Kør `#/followup` for at udarbejde tak-e-mailen.
3. Hvis du fik ny intel (kompensationsinterval, team-sammensætning, tech-stack-
   overraskelse), redigér den gemte `interview-prep/<company>-<role>.md`
   med `## Post-round notes`, så fremtids-dig har det.

---

## 16. Activity log + Fejlfinding

### Activity log (`#/activity`)

Revisionsspor over hver tilstandsændrende anmodning, der rammer serveren.
Registrerer: pipeline-tilføjelser, tracker-skrivninger, CV-gemninger, JD-gemninger, evaluate-
kørsler, deep-research-kørsler, scan-kørsler, config-ændringer, mode-kørsler.

Hemmeligheder (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) redigeres på
vej ind; du vil aldrig se en rigtig nøgleværdi i `data/activity.jsonl`.

Filtrér efter handlingspræfiks (`pipeline.`, `cv.`, `evaluate`, `scan.`,
osv.). 25 rækker per side; serveren returnerer op til 500 nyeste
events.

### Fejlfinding

| Symptom | Sandsynlig årsag | Løsning |
|---|---|---|
| Health-side rød på `cv.md` | Første kørsel, filen findes ikke endnu | `touch $CAREER_OPS_ROOT/cv.md` derefter genindlæs. |
| Health rød på `Profile customized` | `candidate.full_name` siger stadig `Jane Smith` | Redigér `config/profile.yml`. |
| `hh.ru: HTTP 403` i scan-log | Ikke-russisk IP, ingen `(server uses default UA)` | Registrér på `dev.hh.ru/admin`, sæt en russisk IP / VPN. |
| `gemini-eval.mjs: ERR_MODULE_NOT_FOUND` | Overordnet projekts deps ikke installeret | `cd $CAREER_OPS_ROOT && npm install`. |
| Generér PDF fejler | Playwright ikke installeret i den overordnede | `cd $CAREER_OPS_ROOT && npx playwright install chromium`. |
| `/career-ops apply` siger "no report found" | Pipeline scorede aldrig denne JD | Kør `/career-ops pipeline` (eller `#/evaluate`) først; se §14-forudsætninger. |
| `batch-runner.sh: no such file` | Kører fra forkert mappe | `cd $CAREER_OPS_ROOT` før du invokerer `./batch/batch-runner.sh`. |
| Serveren rapporterer `EADDRINUSE: 4317` | Gammel instans kører stadig | `pkill -f 'node server/index.mjs'` derefter genstart. |
| Live LLM-kald hænger > 2 min | Prompt enorm eller Anthropic langsom | Tjek `/api/health` Anthropic-flag; serveren soft-capper prompts ved 200 KB og returnerer 413. |
| Pipeline-preview viser `(unsafe redirect)` | Opslag omdirigerede til en privat IP / loopback | Dette er en sikkerhedsfunktion (REVIEW-B1). Redirect-målet afvises, og den oprindelige URL er uændret. |
| Tracker-rækketekst bryder tabellen | Pipe i virksomhedsnavn pre-v1.9.1 | Opdater til v1.9.1+ — pipes escapes end-to-end (BF-1). |
| `npm test` fejler på frisk clone | Tests antager overordnet projektlayout | Brug `CAREER_OPS_ROOT=$(mktemp -d)` og bootstrap fixtures. |

For dybere diagnostik: kør **▶ Doctor** på Health-siden, kopier
outputtet, og søg i issue-trackeren på
<https://github.com/Fighter90/career-ops-ui/issues>.


---

## 17. Sådan tilføjer du en ny jobportal-kilde

career-ops-ui behandler hvert jobboard som en **adapter** — en enkelt fil under
[`server/lib/sources/<slug>.mjs`](../../server/lib/sources/), der ved,
hvordan man henter + normaliserer ét boards resultater. Pr. v1.76.0 leverer
`server/lib/sources/`-registreringen **25** adaptere — 20 engelske (
Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday-ATS'erne, RSS,
v1.75.0-aggregatorerne RemoteOK / Remotive / Working Nomads / IBM /
Arbeitsagentur / Glints / Jobstreet · SEEK, og v1.76.0-per-tenant-ATS'erne
BambooHR / Breezy HR / Comeet / Personio / Recruitee / SolidJobs) og 5 russiske
boards. De syv aggregatorer tilføjet i v1.75.0 er board-brede eller config-drevne
kilder valgt af `provider:`; de seks per-tenant-ATS'er tilføjet i v1.76.0
(parent career-ops v1.13.0-paritet) auto-detekterer fra en `careers_url`-host
(`<tenant>.bamboohr.com`, `<tenant>.breezy.hr`, `<slug>.jobs.personio.de`,
`<slug>.recruitee.com`, `solid.jobs/public-api/offers/<division>`) eller en
eksplicit `api:`-URL (Comeet) — se §5 for YAML'en og
`docs/portals-examples.md` for copy-paste-poster.

> **v1.69.0 (P-14) — drop-in auto-discovery.** At tilføje en 12. kilde er nu
> et **rent fil-drop**. Registreringen
> ([`server/lib/sources/registry.mjs`](../../server/lib/sources/registry.mjs))
> holder ikke længere en håndvedligeholdt liste — ved boot scanner den denne mappe
> (`readdirSync` + dynamisk `import()`) og indsamler `export const meta`-
> blokken fra hver `*.mjs`. Skriv adapteren, deklarér dens `meta`, og den er
> straks synlig for scanneren, `#/scan`-filter-dropdownen og RU-
> dispatcheren — **ingen redigering af `registry.mjs` påkrævet**. (RU-kilder behøver stadig
> én linje i den overordnedes `portals.yml`; se Trin 5.)

### Trin 1 — Skriv adapteren

Opret `server/lib/sources/<slug>.mjs`. To mønstre virker afhængigt af,
om kilden har en JSON-API eller kun renderer HTML:

**API-baseret kilde** (reneste — brug denne hver gang sitet har et
åbent data-endpoint):

```js
// server/lib/sources/example.mjs
const ENDPOINT = 'https://example.com/api/v1/vacancies';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...';

// v1.69.0 (P-14) — selvbeskrivende metadata. Registreringen auto-opdager
// denne blok ved boot; DETTE er det, der registrerer kilden (se Trin 2).
export const meta = {
  value: 'example',          // ← skal være lig med job.source skrevet nedenfor
  label: 'Example.com',      // ← vist i #/scan-filter-dropdownen
  region: 'ru',              // ← 'en' (ATS-sweep) | 'ru' (regional dispatcher)
  configKey: 'example',      // ← kun RU; nøglen brugt i portals.yml
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
    source: 'example',           // ← skal matche registreringens `value` nøjagtigt
  };
}
```

**HTML-scrape-kilde** (når der ingen API er — se
[`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) og
[`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) for fulde eksempler):

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
  // …regex-baseret kort-ekstraktion. Returnér [] ved parse-fejl (KAST IKKE):
  // en sund 200 uden parsebare kort er "ingen resultater", ikke "fejl",
  // så multi-source-scanneren kan fortsætte.
}
```

Tre kontrakter hver adapter SKAL overholde:

- **Eksportér en gyldig `meta`-blok** (se Trin 2). Uden den springer registreringen
  filen stille over (én `console.warn` ved boot), og kilden
  vises aldrig.
- **Accepter `{ onlyRemote, fetchImpl, signal }` i `opts`.** `fetchImpl`
  er det, der gør adaptere testbare uden netværk; `signal` er påkrævet
  til client-disconnect-propagering (REVIEW-B3).
- **Returnér records med den fælles form** —
  `{ id, title, company, url, salary, location, isRemote, workplaceType,
  relocates, date, snippet, source }`, hvor `source` matcher
  `meta.value`.

### Trin 2 — Deklarér adapterens `meta` (auto-registrering)

Dette er hele registreringstrinet. **Du redigerer ikke `registry.mjs`.**
Sørg bare for, at adapteren eksporterer en `meta`-blok — registreringen
auto-opdager den ved boot:

```js
// øverst i server/lib/sources/example.mjs
export const meta = {
  value: 'example',          // job.source-værdi OG #/scan option.value
  label: 'Example.com',      // visningsetiket i dropdownen
  region: 'ru',              // 'en' | 'ru'
  configKey: 'example',      // kun RU — nøgle i portals.yml::russian_portals.sources
};
```

Hvordan discovery validerer den (en fil, der fejler en regel, springes over, med én
`[sources/registry]`-advarsel, så en halvmigreret branch forbliver diagnosticerbar):

- `value` — ikke-tom streng. SKAL matche `job.source` fra din adapter.
- `label` — ikke-tom streng.
- `region` — nøjagtigt `'en'` eller `'ru'`; alt andet afvises.
- `configKey` — **påkrævet** for `region: 'ru'`, ignoreret for `'en'`.

`region: 'en'` slutter sig til ATS-sweepet (auto-opdager fra `tracked_companies`-
URL-mønstre); `region: 'ru'` slutter sig til den regionale dispatcher. Den offentlige API
(`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`, `getRegionalSources`)
genopbygges fra hver opdaget `meta`, ordnet `en` først derefter `ru`,
alfabetisk efter label inden for hver region — så dropdown-rækkefølgen forbliver
stabil for brugere.

### Trin 3 — Forbind til dispatcheren (kun RU)

EN ATS-kilder auto-opdager fra `tracked_companies`-URL-mønstre —
ingen yderligere forbindelse nødvendig. For RU-kilder, åbn
[`server/lib/ru-scanner.mjs`](../../server/lib/ru-scanner.mjs), find
`RU_DISPATCH`-tabellen, og tilføj en række:

```js
import { searchExample } from './sources/example.mjs';
// …
const RU_DISPATCH = {
  // …eksisterende…
  example: { label: 'example.com', search: searchExample },
};
```

Dispatcher-loopet kalder `entry.search(query, opts)` for hver nøgle,
der er til stede i `cfg.sources`. Ingen yderligere kodeændring nødvendig.

### Trin 4 — Test (mocket, aldrig live)

Drop en fil under `tests/sources-<slug>.test.mjs`. Rigtigt netværk er
**forbudt** i tests (CI-isolerings-kontrakt):

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

### Trin 5 — Aktivér i din `portals.yml`

Det overordnede projekts `portals.yml` er den brugerejede konfiguration. Tilføj den
nye kildes `configKey` til arrayet:

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

Genindlæs `#/scan` i browseren. Kilde-filter-dropdownen samler den
nye post op automatisk (eneste sandhedskilde via
[`GET /api/scan/sources`](../../server/lib/routes/scan.mjs) →
[`registry.mjs`](../../server/lib/sources/registry.mjs)). 
🌐 Scan-knappen inkluderer nu den nye kilde på hvert regionalt sweep.

### Referenceadaptere (spejl disse for nye kilder)

| Adapter-fil | Type | Noter |
|---|---|---|
| [`hh.mjs`](../../server/lib/sources/hh.mjs) | JSON API | Kanonisk RU API-adapter; geo-bevidst UA-fallback. |
| [`trudvsem.mjs`](../../server/lib/sources/trudvsem.mjs) | JSON API | Russisk statslig open-data; ingen IP-gate. |
| [`habr.mjs`](../../server/lib/sources/habr.mjs) | HTML scrape | Russisk tech-board; regex-baseret kort-parser. |
| [`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) | HTML scrape | Defensiv parser, `[]` ved parse-miss. |
| [`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) | HTML scrape | Samme defensive stil som GetMatch. |
| [`greenhouse.mjs`](../../server/lib/sources/greenhouse.mjs) | JSON API | Kanonisk EN ATS-adapter; bruger `tracked_companies`-URL-mønster. |

### Almindelige faldgruber

- **At glemme `meta`-eksporten.** Siden v1.69.0 er `meta`-blokken det
  *eneste*, der registrerer en kilde. Ingen `meta` (eller en misdannet) =
  filen springes stille over ved boot med en enkelt
  `[sources/registry] <file> has no valid \`export const meta\` — skipped`-
  advarsel, og kilden når aldrig dropdownen. Tjek server-loggen,
  hvis en helt ny adapter ikke dukker op.
- **`source`-felt-mismatch.** Strengen skrevet af din adapter SKAL
  matche `meta.value` nøjagtigt. Hvis de driver fra hinanden, vil
  `#/scan`-filter-dropdownen vise kilden, men at vælge den vil
  filtrere hver række ud (fordi lighedstjekket er `r.source === fs`).
- **At kaste ved parse-fejl.** HTML-scrapere SKAL returnere `[]` ved en
  sund 200 uden parsebare kort. At kaste bryder multi-source-
  dispatcher-loopet — én dårlig HTML-struktur dræber hver anden kilde for
  den samme query.
- **At glemme `fetchImpl` / `signal`.** Uden dem kan din adapter
  ikke unit-testes uden at ramme live-netværk, og client-
  disconnects propagerer ikke (baggrunds-fetch forbliver i live efter
  brugeren lukker fanen).
- **At stole på `tracked_companies` for RU.** Den liste er for EN ATS-
  kilder kun. RU-adaptere driver sig selv fra
  `russian_portals.queries` i stedet — ingen per-virksomheds-poster.

---

## 18. Notifikationer (🔔 i topbjælken)

> v1.58.34 — hver toast, der vises i nederste højre hjørne, fanges også
> ind i en in-memory journal (grænse 50, ældste droppet). Klik på 🔔-klokken i
> topbjælken for at åbne den højre-glidende **Notifikationer**-skuffe og genlæse alt,
> du gik glip af. Journalen er per-fane, per-session — at lukke fanen rydder den.

Skuffen **åbnes kun, når du klikker på klokken** (eller aktiverer den med Enter /
Mellemrum, når den er keyboard-fokuseret). Den vises aldrig af sig selv. Det røde badge på
klokken tæller poster, du ikke har set siden sidste åbning; at åbne skuffen
rydder badget.

### Notifikationskategorier

| Kategori | Hvornår den udløses | Visuelt signal |
|---|---|---|
| **Success** | `Gemt`, `Kopieret`, `Genopfrisket`, scan færdig, CV importeret, apply-tjekliste-handlinger ("Kopieret ukrydset", "Nulstil"), profil gemt, pipeline-URL tilføjet | grøn venstre kant i skuffen; grøn toast-baggrund |
| **Error** | URL-valideringsfejl (skal starte med `http://` / `https://`, ingen script-/template-tegn), API-fejl med `(METHOD /path · HTTP NNN)`-postfikset, netværksfejl (server nede), pipeline-400-dubletter, doctor / verify-pipeline ikke-nul exit | rød venstre kant; rød toast-baggrund; teknisk postfiks tucket ind i `Details`-`<details>`-blokken (U-4 / v1.58.24) |
| **Info / progress** | `Running doctor.mjs…`, `Running verify-pipeline.mjs…`, `Refreshing…`, `Loading…`, `Generating prompt…`, scan-progress-linjer | grå venstre kant; standard toast-baggrund |

Hver skuffe-post viser:

- **Tidsstempel** (`HH:MM:SS` lokaliseret til det aktive SPA-sprog).
- **Besked** (den menneskelige sætning, med det tekniske postfiks strippet fra overskriften per U-4).
- **Details** (når til stede — API-kaldets `(METHOD /path · HTTP NNN)`-postfiks eller enhver anden teknisk bemærkning, monospace).

### Hvad der IKKE er en notifikation

- Doctor / verify-pipeline-**resultatmodalen** (fuld stdout / stderr) — det er en modal, ikke en toast, og ikke journaliseret.
- SSE-log-linjer på `#/scan` og `#/auto` — de streamer ind i sidens body, ikke ind i toast-pipelinen.
- Spinner-kun loading-tilstande (de bruger `UI.withSpinner` uden en toast).

### Tastatur

- **Klik** eller fokus + **Enter / Mellemrum** på klokken → åbner skuffen.
- **Esc**, klik på **×**-lukkeknappen, eller klik på klokken igen → lukker skuffen; fokus vender tilbage til klokken.
- **Tab** mens skuffen er åben → bevæger sig gennem lukkeknappen og eventuelle fokuserbare details indeni; skuffen er `aria-modal="false"`, så Tab fanger ikke (du kan stadig nå resten af siden).


## 19. Lokalisering af appen til dit sprog

Grænsefladen leveres på 9 sprog (English, Español, Français, Português, 한국어, 日本語, Русский, 简体中文, 繁體中文). Hver skærm-label kommer fra en oversættelsesordbog, og du kan tilføje eller rette et sprog uden at røre app-logikken.

**Hvor oversættelserne lever.** Siden v1.60.0 er hvert sprog sin egen fil under `public/js/lib/locales/` — `i18n-dict.en.js`, `i18n-dict.es.js`, `i18n-dict.ru.js` osv. — en simpel liste af `'key': 'text'`-par. En delt `i18n-dict.aliases.js` lader nøgler, der altid skal læse identisk (en sidebjælke-label og dens sidetitel), pege på én oversættelse. `i18n-dict.js` fletter dem alle ved sideindlæsning; du redigerer den aldrig.

**Ret eller tilføj en frase.** Åbn filen for dit sprog, find nøglen (f.eks. `'nav.scan'`) og redigér teksten. For at tilføje en helt ny label, tilføj den samme nøgle til **alle 8** sprogfiler med den oversatte værdi, og referér den derefter i siden via `t('your.key')`. Kør `npm test` — den fejler, hvis et sprog mangler nøglen, så intet leveres halvt-oversat.

**Tilføj et helt nyt sprog.** Kopier `i18n-dict.en.js` til `i18n-dict.<code>.js`, oversæt hver værdi, og registrér derefter koden i `i18n.js` (sproglisten + browser-auto-detektering), i `i18n-dict.js`-assembleren, og tilføj en `<script>`-linje i `index.html`. Den fulde tjekliste — inklusive test-snapshottet og hjælpe- / README-ledsagerfilerne — er i `docs/LOCALIZATION.md`.

**Godt at vide.** Sprog-vælgeren er i sidebjælke-footeren; dit valg huskes per browser. Server-diagnostiske beskeder forbliver bevidst på engelsk (så logs læses konsistent) — kun den skærm-baserede grænseflade er oversat.

Se **`docs/LOCALIZATION.md`** i repositoriet for den komplette, trin-for-trin lokaliseringsguide.
