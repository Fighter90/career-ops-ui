# Hilfe — career-ops-ui

<p align="center"><img src="https://raw.githubusercontent.com/Fighter90/career-ops-ui/main/images/providers.png" alt="Works with 18 LLM providers — Anthropic, OpenAI, Gemini, Qwen, OpenRouter, GitHub, DeepSeek, Kimi, MiniMax, Mistral, Ollama and more" width="760"></p>

Eine vollständige Anleitung zu jeder Seite, vom Moment des Starts der
App bis zum Erreichen eines Vorstellungsgesprächs. Jede `##`-Überschrift
unten entspricht einem Eintrag in der Seitenleiste oder einer Phase des
Workflows. Lesen Sie beim ersten Start von oben nach unten; springen Sie
später über das Inhaltsverzeichnis in der Hilfe-Seitenleiste zu einem
bestimmten Abschnitt.

> **Zielgruppe:** alle, die diese UI gerade in einem `career-ops`-
> Checkout abgelegt und `bash bin/start.sh` ausgeführt haben. Es werden
> keine Vorkenntnisse zu career-ops vorausgesetzt.

### Über career-ops

[career-ops](https://career-ops.org) ist ein Open-Source-Jobsuchsystem,
das als Slash-Befehle innerhalb jeder KI-Coding-CLI läuft (Claude Code, Cursor, Codex, OpenCode, Antigravity CLI, Grok Build CLI, Qwen Code, Kimi, GitHub Copilot CLI, Gemini CLI (legacy) — andere Claude-kompatible CLIs funktionieren über dieselbe Slash-Befehl-Oberfläche ebenfalls). Modellunabhängig. Es
bewertet jede Ausschreibung anhand Ihres CV mit einem sechsdimensionalen
0.0–5.0-Bewertungsschema, generiert maßgeschneiderte PDF-Lebensläufe und
verfolgt jede Bewerbung lokal auf Ihrem Rechner.

**Kanonische Referenz (beim ersten Installieren in dieser Reihenfolge lesen):**

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
  — das System, die Prinzipien und das Inventar der Konzepte.
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
  — Stellen entdecken; die Pipeline befüllen.
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
  — vollständiger Einreichungsablauf mit Playwright-Formularauslesen.
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  — 10+ JDs auf einmal bewerten über `batch-runner.sh`.
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)
  — Chromium installieren + den MCP für PDF und Formularausfüllen registrieren.
- [Wie career-ops Stellenanzeigen bewertet](https://career-ops.org/methodology)
  — die Bewertungsmethodik: die fünf Dimensionen plus eine ganzheitliche Gesamtbewertung, der 4.0-Bewerbungsschwellenwert
  und was das System ausdrücklich nicht tut. Ebenfalls zusammengefasst unter
  [cvstart.org/methodology](https://cvstart.org/methodology/) in Ihrer Sprache.

**Grundprinzipien** (aus
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

- **Open Source, im Ernst** — MIT, keine Bezahlstufe, keine Warteliste,
  keine Telemetrie, keine Konten. Das System arbeitet ohne Bezahlstufen,
  Konten oder Telemetrie. Code-Beiträge durchlaufen vor der Freigabe eine
  Community-Prüfung.
- **Datenhoheit** — `cv.md`, `config/profile.yml`, `data/`,
  `reports/`, `interview-prep/` verlassen Ihren Laptop nie, es sei denn,
  Sie pushen sie ausdrücklich. Sie führen es lokal auf Ihrem Rechner aus
  und behalten die volle Datenhoheit.
- **KI-agnostische Architektur** — career-ops bündelt KEIN Modell.
  Es funktioniert als Befehle innerhalb bestehender KI-Coding-CLIs.
  Wechseln Sie den Anbieter (Anthropic ↔ Gemini ↔ OpenAI), und Ihre
  Bewertungshistorie bleibt konsistent.
- **Vom Menschen kontrollierte Einreichungen** — career-ops entwirft
  Antworten und öffnet das Formular, aber **Sie klicken auf Absenden**.
  Das System bewirbt sich nie automatisch. Das System liefert Struktur
  und Bewertung; die endgültige Einreichungshoheit bleibt beim Menschen.
- **Strukturierte Suche** — gebaut für eine aktive, bewusste Jobsuche
  mit vielen Bewerbungen; kein Werkzeug für Einzeleinreichungen, keine
  Empfehlungsmaschine. Die Einrichtung dauert ca. 15 Minuten und setzt
  Terminalvertrautheit voraus.

**Was career-ops NICHT ist** (ausdrückliche Nicht-Ziele):

- Kein Auto-Bewerber. Es reicht keine Formulare für Sie ein.
- Kein Lebenslauf-Neubauer. Es passt pro JD an; es erfindet keine
  Erfahrung.
- Kein LinkedIn-Optimierer. Ihr Profil ist Ihre Angelegenheit.
- Kein Tabellenkalkulationsersatz, der sich hinter einer SaaS-UI
  versteckt. Die Daten sind einfaches Markdown auf Ihrem Dateisystem.

**Schlüsselkonzepte** (vollständiges Inventar — jedes Artefakt, das career-ops berührt):

| Konzept | Was es ist |
|---|---|
| **Mode** | Eine Prompt-Vorlage unter `modes/<slug>.md`. Eingebaut: `oferta`, `deep`, `apply`, `pipeline`, `batch`, `contacto`, `followup`, `interview-prep`, `patterns`, `project`, `training`, `ofertas`, `auto-pipeline`, `pdf`, `latex`, `scan`, `tracker`. |
| **Archetype** | Ein Zielrollen-Profil in `config/profile.yml`. Das Bewertungsschema gewichtet Skill-Übereinstimmungen gegen den aktiven Archetyp — **das einzelne wichtigste Feld**. |
| **Pipeline** | `data/pipeline.md` — Posteingang von JD-URLs, die auf ihre Bewertung warten. |
| **Tracker** | `data/applications.md` — historische GFM-Tabelle jeder Bewertung + jedes Bewerbungsstatus. |
| **Report** | `reports/<NNN>-<company>-<DATE>.md` — vollständige A–F-Bewertung pro JD, mit Score + Legitimität im Header. |
| **Scan-Historie** | `data/scan-history.tsv` — reines Anhängen-Log; verhindert Duplikate über Scans hinweg. |
| **Proof Points** | STAR+R-Nachweisblöcke, extrahiert aus `cv.md`, wiederverwendet über Bewertung, Bewerbungsantworten, Interview-Vorbereitung. |
| **JD-Store** | `jds/jd-<date>-<ts>.txt` — wortgetreue Stellenbeschreibungen, die während der Bewertung für die Prüfspur gespeichert werden. |
| **Interview-prep** | `interview-prep/<company>-<role>.md` — Deep-Research-Briefings und Runden-One-Pager. |
| **Batch-Ergänzungen** | `batch/tracker-additions/*.tsv` — ausstehende Zeilen, die von `batch-runner.sh` zum Zusammenführen in den Tracker eingereiht werden. |

### career-ops vs career-ops-ui (diese App)

| | career-ops (CLI) | career-ops-ui (diese App) |
|---|---|---|
| Wo es läuft | innerhalb Claude Code / Cursor / Codex / OpenCode / Antigravity CLI / Grok Build CLI / Qwen Code / Kimi / GitHub Copilot CLI / Gemini CLI (legacy) | `http://127.0.0.1:4317` in Ihrem Browser |
| Oberfläche | `/career-ops <mode>` Slash-Befehle | Seitenleiste mit einer Seite pro Workflow |
| Formularausfüllen | ja, über Playwright MCP | nein — generiert die Checkliste, Sie schließen in der CLI ab |
| PDF | `generate-pdf.mjs` | `📄 Generate PDF` auf `#/cv`, `#/reports/:slug`, `#/evaluate`, `#/deep`, `#/interview-prep` |
| Datendateien | geteilt mit career-ops-ui | geteilt mit career-ops |

career-ops-ui besteht aus **reinen Ergänzungen**. Nichts innerhalb von
`career-ops/` ändert sich. Beide Oberflächen teilen sich dieselbe
`cv.md`, `config/profile.yml`, `portals.yml`, `data/`, `reports/`,
`interview-prep/`, `modes/`.

### Handlungsschwellen nach Score

Sobald eine JD eine Bewertung hat, bestimmt der Score, was als Nächstes
zu tun ist (kanonische Tabelle aus
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

| Score | Nächster Schritt |
|---|---|
| **≥ 4.5** | Führen Sie `/career-ops apply` aus — hohe Passung, sofort loslegen. |
| **4.0 – 4.4** | Bewerben oder `/career-ops contacto` für eine warme Vorstellung zuerst. |
| **3.5 – 3.9** | Führen Sie `/career-ops deep` aus — das Unternehmen / die Rolle vor der Entscheidung recherchieren. |
| **< 3.5** | Überspringen, es sei denn, Sie haben einen bestimmten persönlichen Grund. |

`#/dashboard` und `#/tracker` von career-ops-ui heben jede Zeile ab 4.0
hervor, sodass Sie eine Handlung auswählen können, ohne etwas erneut
ausführen zu müssen.

### Externe Dokumentation

Die vollständige Referenz für die zugrunde liegende career-ops-Engine
(Scannen, Bewertungsschema, Batch-Verarbeitung, Bewerbungsablauf,
Playwright-Einrichtung) finden Sie unter
[career-ops.org/docs](https://career-ops.org/docs):

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)

---

## 1. Schnellstart — vollständig Schritt für Schritt von „CV erstellen" bis „beworben & angeschrieben"

Dies ist das kanonische, Schaltfläche-für-Schaltfläche-Handbuch. Folgen
Sie ihm beim ersten Mal der Reihe nach. Jeder Schritt nennt die genaue
Route, die genaue Schaltfläche und was Sie bei Erfolg sehen werden. Die
Abschnitte 2–16 unten gehen tiefer auf jede Phase ein.

**Doku fragen.** Öffne **Doku fragen 💬** (Seitenleiste, unter Hilfe) und stell eine Frage — sie antwortet nur aus diesem Leitfaden in deiner Sprache und liest nie deinen Lebenslauf. Derselbe Assistent ist von jeder Seite aus nur einen Tipp entfernt — eine Roboter-Chat-Schaltfläche schwebt unten rechts (unten links in Rechts-nach-links-Sprachen); klicke sie an, um zu fragen, ohne deine Arbeit zu verlassen.

> **Start & Init mit einem Befehl.** Von einem Terminal aus können Sie
> den gesamten Bootstrap ohne Berühren der UI durchführen:
>
> ```bash
> career-ops-ui setup      # install deps → doctor → run the server
> career-ops-ui init       # pick LLM provider + paste its key (echo suppressed)
> career-ops-ui doctor     # re-verify any time (exit 0 ⇔ all required green)
> career-ops-ui run        # just launch the server at http://127.0.0.1:4317
> career-ops-ui open       # open + RAISE the dashboard tab in your browser
> ```
>
> Nach `setup`/`run` wird der Browser-Tab automatisch geöffnet **und in
> den Vordergrund gebracht** (v1.43.0); `career-ops-ui open` tut dasselbe
> auf Anfrage, sodass Sie den Dashboard-Tab nie suchen müssen. `NO_OPEN=1`
> deaktiviert das automatische Öffnen für Headless-/CI-Starts.
>
> `setup` führt die gesamte Kette selbst aus. `init` schreibt den
> Schlüssel über denselben validierten Pfad, den der API-Schlüssel-Tab
> unter `#/config` verwendet, in die übergeordnete
> `career-ops/.env` und setzt `LLM_PROVIDER`
> (`auto` | `claude` | `gemini`), was die Live-Routen evaluate / deep / mode /
> auto-pipeline berücksichtigen. CI-Form:
> `career-ops-ui init --provider claude --anthropic-key sk-ant-… --yes`.
> Bevorzugen Sie die UI? Fahren Sie mit den Schritten unten fort.

### A. Einrichtung (einmal ausführen, ~5 Minuten)

**career-ops-ui muss unter `career-ops/web-ui/` liegen** (verschachtelt innerhalb des übergeordneten career-ops-Projekts). Es liest Ihre `cv.md`, `config/` und `data/` über `../` aus dem übergeordneten Ordner und funktioniert nicht eigenständig. Wenn `career-ops-ui init` nach einem Pull nicht gefunden wird, führen Sie `cd career-ops/web-ui && npm install && npx career-ops-ui init` aus.

**Schritt 1 — Öffnen Sie die App unter `http://127.0.0.1:4317`.** Wenn sie
nicht läuft, führen Sie in einem Terminal `bash bin/start.sh` vom
Repo-Stammverzeichnis aus. Das Dashboard (`#/dashboard`) wird geladen.

**Schritt 2 — Klicken Sie in der linken Seitenleiste auf `❤ Health`.**
Jede erforderliche Prüfung muss grün sein:

- `cv.md`, `config/profile.yml`, `portals.yml` existieren
- API-Schlüssel gesetzt (mindestens einer von `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`)
- Playwright installiert (nur erforderlich, wenn Sie Generate PDF verwenden)

Wenn etwas rot ist, sagt Ihnen die Seite genau, welche Datei oder
Umgebungsvariable zu korrigieren ist. Fahren Sie nicht fort, bis Health
grün ist.

**Schritt 3 — Klicken Sie in der Seitenleiste auf `⚒ App settings`.** Sie
landen auf dem Tab **API keys & runtime**.
- Fügen Sie `ANTHROPIC_API_KEY` ein (bevorzugt — bessere Langtext-
  Bewertung) und/oder `GEMINI_API_KEY`. Schlüssel erhalten Sie unter
  <https://console.anthropic.com/settings/keys> oder
  <https://aistudio.google.com/apikey>.
- Klicken Sie auf **💾 Save**. Klicken Sie dann auf **▶ Test Anthropic**
  (oder Gemini) — ein winziger Roundtrip bestätigt, dass der Schlüssel
  funktioniert.

**Schritt 4 — Wechseln Sie auf derselben Seite zum Tab `Profile`.** Das
ist der direkte YAML-Editor für `config/profile.yml`. Bearbeiten Sie
mindestens:
- `candidate.full_name` — ersetzen Sie jeden Platzhalter ("Jane Smith")
  durch Ihren echten Namen
- `candidate.email`, `linkedin`, `github` — werden in Anschreiben
  verwendet
- `target.roles` — die Stellentitel, auf die Sie sich bewerben
- `target.comp_total_min_usd` — Mindestgesamtvergütung; Angebote darunter
  werden in Abschnitt D jeder Bewertung markiert
- `target.archetypes` — die Karrieremuster, die Sie akzeptieren (einzelnes
  wirkungsstärkstes Feld)

Klicken Sie auf **💾 Save**. Der Server validiert das YAML und stempelt
den kanonischen Header `# Career-Ops Profile Configuration`.

### B. CV (einmal ausführen, ~10 Minuten)

**Schritt 5 — Klicken Sie in der Seitenleiste auf `✎ CV`.** Zwei Spalten:
Editor links, Live-Vorschau rechts.

**Schritt 6 — Wählen Sie einen Weg, um den Editor zu füllen:**
- **Vorhandenen Lebenslauf hochladen** — klicken Sie auf **📁 Upload CV**,
  wählen Sie eines der Formate
  `.docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md`. Der
  Server konvertiert über pandoc oder pdftotext in Markdown, bereinigt
  XSS und legt das Ergebnis in den Editor. **Überprüfen Sie die
  Konvertierung** — insbesondere PDFs können an Layout-Treue verlieren.
- **Markdown direkt einfügen** — der Textbereich ist ein Markdown-Editor;
  der rechte Bereich zeigt, was das LLM (und Ihr zukünftiger Recruiter) sehen wird.
- **Ton-Tipps:** ein Aufzählungspunkt = eine Errungenschaft mit einer
  Kennzahl. Halten Sie es unter 1500 Wörtern. Abschnitte in dieser
  Reihenfolge: Summary, Experience, Projects, Education, Skills.

**Schritt 7 — Klicken Sie auf `💾 Save` (oben rechts auf der CV-Seite).**
Der Server bereinigt (`<script>` / `javascript:` / Inline-Handler
entfernt) und schreibt `cv.md`. Toast: *„Saved"*.

**Schritt 8 (optional) — Klicken Sie auf `📄 Generate PDF`.** Führt
`generate-pdf.mjs` im übergeordneten Projekt aus (Playwright erforderlich)
und **das neue PDF wird automatisch heruntergeladen** in Ihren Browser,
wenn es fertig ist. Die Liste am Ende der Seite behält jede zuvor
generierte Datei.

### C. Stellen finden (~2 Minuten pro Scan)

**Schritt 9 — Klicken Sie in der Seitenleiste auf `🌐 Scan`.** Bestätigen
Sie, dass `portals.yml` die Boards auflistet, die Sie interessieren
(Abschnitt 5 dieser Hilfe). Drücken Sie die Schaltfläche
**🌐 Scan now**. Ein Live-SSE-Log streamt, während der Scanner
Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (englische Boards) und hh.ru / Habr
Career (russische Boards, falls aktiviert) durchläuft.

**Schritt 10 — Wenn der Scan fertig ist, überprüfen Sie die Ergebnisse.**
Klicken Sie auf ein Unternehmens-Tag, um zu filtern; klicken Sie auf das
↗-Symbol, um die Karriereseite des Unternehmens in einem neuen Tab zu
öffnen. Jede Stelle, die den Titelfilter überlebt hat, wird in die
Pipeline eingereiht.

### D. Angebote bewerten (~30 Sekunden pro JD)

**Schritt 11 — Klicken Sie in der Seitenleiste auf `Pipeline`.** Sie sehen
jede URL, die der Scanner eingereiht hat. Klicken Sie auf einen Eintrag,
um die JD inline in der Vorschau anzuzeigen.

**Schritt 12 — Klicken Sie neben einer JD auf `▶ Evaluate`.** Dies springt
zu `#/evaluate`. Mit gesetztem API-Schlüssel läuft es live; ohne einen
erhalten Sie einen manuellen Prompt zum Einfügen in Ihr eigenes LLM.
Der Live-Modus erzeugt einen **0–5-Score** gegen Ihr CV über die
Abschnitte A–G (Role / Company / Compensation / Risk / Stretch / Cultural
fit / Verdict). Das Speichern landet in `reports/<date>-<slug>.md`.

**Schritt 13 — Klicken Sie in der Seitenleiste auf `Reports`** und
überprüfen Sie die neueste Bewertung. Alles unter Ihrem
`comp_total_min_usd` ist in Abschnitt D rot markiert. Alles mit
`Verdict: pursue` ist Ihre engere Auswahl.

### E. Das ausgewählte Unternehmen entscheiden & tiefgehend recherchieren (~3 Minuten)

**Schritt 14 — Wählen Sie eine verfolgenswerte Stelle aus. Klicken Sie in
der Seitenleiste auf `Deep research`.** Geben Sie den Unternehmensnamen
und die Rolle ein. Das Modell erstellt ein siebenteiliges
Unternehmensbriefing (Mission, aktuelle Nachrichten, Tech-Stack,
Einstellungssignale, Vergütungs-Benchmarks, Risiken, empfohlener
Ansatz). Das Speichern landet in `interview-prep/<company>-<role>.md`.

### F. Bewerben (~5 Minuten pro Bewerbung)

**Schritt 15 — Klicken Sie in der Seitenleiste auf `Apply checklist`.**
Fügen Sie die Stellen-URL + JD ein. Der Helfer generiert eine
Schritt-für-Schritt-Einreichungscheckliste:
- Maßgeschneiderter Anschreiben-Entwurf (verwendet Ihre `cv.md` + `profile.yml`)
- Bestimmte Schlüsselwörter, die aus der JD gespiegelt werden sollen
- Anzuhängende Dateien (CV-PDF — siehe Schritt 8)
- Wo man sich bewirbt (die kanonische Karriere-URL, nicht Aggregator-
  Weiterleitungen)
- Erinnerung: **NIEMALS automatisch absenden** — die endgültige Prüfung
  und Einreichung erfolgt immer manuell.

**Schritt 16 — Öffnen Sie die Karriereseite in einem neuen Tab.**
Verwenden Sie die Bewerbungscheckliste als Ihre To-do-Liste. Reichen Sie
über das tatsächliche Formular des Unternehmens ein. Hängen Sie das PDF
an, das Sie in Schritt 8 generiert haben.

**Schritt 17 — Wenden Sie sich an einen echten Menschen.** Öffnen Sie den
**Outreach**-Modus (`#/contacto` in der Seitenleiste). Das Modell
entwirft eine kurze, auf das Unternehmensbriefing aus Schritt 14
zugeschnittene LinkedIn-/E-Mail-Nachricht. Personalisieren Sie den
Einstieg (ein bestimmtes Detail aus Ihrem Deep-Research-Briefing).
Senden Sie sie.

### G. Verfolgen & nachfassen (fortlaufend)

**Schritt 18 — Klicken Sie in der Seitenleiste auf `Tracker`** und fügen
Sie eine Zeile für die Bewerbung hinzu: Unternehmen, Rolle, Score, Status
`Applied`, Link zum Report, Link zum Deep-Research-Briefing. Das Datum
wird automatisch ausgefüllt.

**Schritt 19 — Eine Woche später: öffnen Sie den `Follow-up`-Modus**
(`#/followup`). Entwirft eine höfliche Nachfass-E-Mail, die auf die
ursprüngliche Bewerbung Bezug nimmt. Senden. Aktualisieren Sie den
Tracker-Status auf `Followed up`.

**Schritt 20 — Wenn Sie eine Interview-Einladung erhalten, führen Sie den
`Interview prep`-Modus aus** (`#/interview-prep`). Generiert gezielte
Vorbereitung für das jeweilige Unternehmen + die Phase (System-Design /
Behavioral / Coding). Zieht automatisch aus dem Deep-Research-Briefing.

**Schritt 21 — Angebot erhalten? Aktualisieren Sie den Tracker-Status auf
`Offer`** und schauen Sie sich den Vergütungsabschnitt Ihres
Bewertungsreports erneut an — Ihre Mindestannahmezahl steht genau dort.

### TL;DR — die Reihenfolge der Seitenleiste entspricht dem Workflow

`Health → App settings → Profile → CV → Scan → Pipeline → Evaluate
→ Reports → Deep research → Apply checklist → Outreach → Tracker
→ Follow-up → Interview prep → Activity log`

Das war's. 21 Schritte, Schaltfläche für Schaltfläche, von null bis zum
Angebot.

### Auto-pipeline mit einem Klick (`#/auto`) — die Abkürzung für die 21 Schritte

Wenn Sie nur eine bestimmte Ausschreibung schnell bewerten möchten,
überspringen Sie die manuelle Anleitung. **Seitenleiste → ✨ Auto-pipeline**
(oder die ✨-Schaltfläche im Dashboard) öffnet einen eigenen Bildschirm:
Fügen Sie die Stellen-URL ein, drücken Sie **Enter** oder klicken Sie auf
**▶ Run full pipeline**, und der Server führt die gesamte Kette in einem
beobachtbaren Durchlauf aus:

1. **Validating URL** — SSRF-sichere Prüfung (`isValidJobUrl`); lehnt
   Loopback / `file:` / private IPs / Skript-Zeichen ab.
2. **Fetching job description** — `safeGet` (DNS-fixiert, umleitungs-
   neu-validiert) zieht + bereinigt die JD.
3. **Evaluating against your CV** — Anthropic (bevorzugt) → Gemini-
   Fallback → manueller Prompt, falls kein Schlüssel.
4. **Saving report** — schreibt `reports/<slug>.md` mit Score +
   Legitimität im Header.
5. **Adding to tracker** — hängt eine Zeile an `data/applications.md` an.

Das Live-Feedback ist ein vertikaler **Stepper** (jeder Schritt leuchtet
laufend → fertig / fehlgeschlagen auf). Es ist eine geordnete Liste mit
`aria-current` auf dem aktiven Schritt und einem höflichen
Screenreader-Live-Bereich, der jeden Übergang ansagt. Bei Erfolg verlinkt
die Ergebniskarte direkt zum gespeicherten Report (**View report · N/5**)
und zum **tracker**. Ein fehlgeschlagener Schritt wird rot mit seiner
Meldung markiert, und die Schaltfläche wird wieder aktiviert, sodass Sie
die URL korrigieren und ohne Neuladen erneut versuchen können.

**Kein API-Schlüssel?** Die Pipeline läuft im **manuellen Modus**: Die
Schritte 3–5 werden zusammengeklappt, und Sie erhalten eine
einfügefertige Prompt-Karte (kopieren Sie sie in Claude
Code / Anthropic / Gemini). Kein Live-LLM-Aufruf, keine Kosten.

`#/auto` ist verlinkbar: `#/auto?url=<encoded>&go=1` öffnet den Bildschirm
und startet automatisch. Die ✨-Schaltfläche im Dashboard und dieser
Seitenleisteneintrag landen beide hier (einziger kohärenter Ablauf — das
transiente Modal vor 1.34 wurde zu dieser Seite befördert).
> **CLI (v1.38.0).** Ein Befehl erledigt die Kette: `career-ops-ui setup` (bootstrap → install → start). Eigenständige Verben: `career-ops-ui doctor` (env/keys/tooling check — same engine as the Health page; exit 1 on any required failure), `career-ops-ui run`, `career-ops-ui init` (provider+key wizard, v1.39.0).
> **Providers (v1.39.0).** Der API-Schlüssel-Tab fügt eine Auswahl `LLM_PROVIDER` (`auto` = Anthropic→Gemini default · `claude` · `gemini`) und ein Feld `OPENAI_API_KEY` (Codex/OpenCode CLI side) hinzu. `career-ops-ui init` ist ein interaktiver Assistent für dasselbe.
>
> **Providers (v1.57.0).** Die Headless-Live-Bewertung erstreckt sich nun über **Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models → Hermes → DeepSeek → GLM (Z.ai) → Kimi (Moonshot) → MiniMax → Mistral → Grok (xAI) → Together → Fireworks → Ollama → BytePlus Ark → Volcengine Ark** (die `auto`-Reihenfolge; `LLM_PROVIDER` fixiert einen). **OpenRouter** — ein `OPENROUTER_API_KEY` bedient 300+ Modelle; das Dropdown `OPENROUTER_MODEL` lädt OpenRouters Live-Katalog (serverseitiger Proxy, kuratierter Offline-Fallback). Außerdem behoben: Schlüssel, die mit einem abschließenden Zeilenumbruch / umgebenden Leerzeichen eingefügt werden, werden nun vor der Validierung getrimmt, sodass `/#/config` für keinen Anbieter mehr „validation failed" anzeigt.



---

## 2. App-Einstellungen & API-Schlüssel (`#/config`)

> **Neu in v1.55 → v1.56.** Ohne gesetzten LLM-Schlüssel erklärt ein rotes Banner auf jedem Bildschirm, dass ⚡ Run-live im manuellen Prompt-Modus ist, und verlinkt hierher; sobald ein Schlüssel gesetzt ist, wird es zu einem stillen Chip, der den aktiven Anbieter nennt. Vor jeder ⚡ Run-live-Schaltfläche (`#/auto`, `#/evaluate`, `#/deep`, modes) wird eine ehrliche Kostenschätzung angezeigt (z. B. „Estimated cost: OpenAI gpt-5-codex · ~$0.04/eval" oder ein Hinweis zu fehlenden API-Kosten im manuellen Modus). `#/scan` verbirgt sekundäre Filter hinter einer **Advanced filters**-Ausklappung; `#/tracker` fügt anklickbare Trichter-Chips + optionale serverseitige Paginierung hinzu; `#/pipeline` virtualisiert ab 1000 Zeilen.

**KI-CLI-Tools.** Der Tab **KI-CLI-Tools** zeigt, welche Agent-CLIs (Claude Code, Cursor, Codex, Gemini, OpenCode, Copilot, Qwen, Antigravity, Kimi CLI, Grok Build CLI) auf dem Server installiert sind — ein schreibgeschützter PATH-Scan, ohne sie auszuführen. **Darstellung → Firmenlogos anzeigen** (standardmäßig aus) zeigt das Favicon jeder Firma in der Scan-Tabelle, geholt von ihrer eigenen Domain (nie ein Drittanbieterdienst).

Drei Tabs:

1. **API keys & runtime** — strukturiertes Feldformular über die `.env`
   des übergeordneten Projekts (dieselbe Datei, die die career-ops-Node-
   Skripte beim Start lesen). Gruppiert: API keys / Runtime / Regional
   sources. Der Tab stellt auch anbieterspezifische Modellauswahlen bereit
   — `OPENAI_MODEL` (OpenAI/Codex) neben `ANTHROPIC_MODEL` und `GEMINI_MODEL`.
2. **Profile** — **feldweises Formular** über `config/profile.yml`
   (web-ui 1.32.0). Das Speichern **führt** in die Datei **zusammen** —
   Ihre Archetypen, Proof Points und alle benutzerdefinierten Schlüssel
   bleiben unberührt erhalten.
3. **Modes** — **strukturiertes Feldformular** für `modes/_profile.md`
   (web-ui 1.54.3), abgeleitet aus dem dokumentierten Schema. Listenartige
   Abschnitte — **Target Roles / Adaptive Framing / Comp Targets** —
   werden als wiederholbare Einzelposten-Eingaben gerendert
   (Zeilen hinzufügen/entfernen); Prosaabschnitte —
   **Exit Narrative / Location Policy** — werden als beschriftete
   Textbereiche gerendert; jeder unbekannte oder nicht listenartige
   Abschnitt fällt auf einen beschrifteten wortgetreuen Textbereich
   zurück. Das Speichern **führt weiterhin nach Abschnitt zusammen** —
   die Präambel, unberührte Abschnitte und alle benutzerdefinierten
   Abschnitte bleiben byteweise erhalten. Eine Ausklappung
   *Advanced: raw markdown* bleibt für Vollständige-Datei-Bearbeitungen —
   Hinzufügen/Entfernen von Abschnitten oder Bearbeiten der Präambel.

Ein Speichern in einem beliebigen Tab wirkt sich sofort aus — kein
Server-Neustart.

**Einrichten Ihres LLM-Anbieters (Schritt für Schritt).** Die ⚡ Live-Bewertung der Web-UI läuft *headless* und verwendet einen API-Schlüssel. Sie funktioniert per „ODER" — setzen Sie **einen beliebigen** dieser Schlüssel, und es funktioniert einfach; wenn mehrere gesetzt sind, bevorzugt `auto` sie in dieser Reihenfolge: Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models → Hermes → DeepSeek → GLM (Z.ai) → Kimi (Moonshot) → MiniMax → Mistral → Grok (xAI) → Together → Fireworks → Ollama → BytePlus Ark → Volcengine Ark. (career-ops selbst ist CLI-agnostisch — Sie führen es auch innerhalb von Claude Code, Cursor, Codex, Gemini, OpenCode, Antigravity, Grok Build, Qwen, Copilot oder Kimi aus; das ist von diesem Headless-Schlüssel getrennt.)

1. Öffnen Sie `#/config` → den Tab **API keys & runtime**.
2. Wählen Sie Ihren Anbieter in **`LLM_PROVIDER`**: `auto` (verwendet den gesetzten Schlüssel) oder erzwingen Sie einen mit `claude` / `gemini` / `openai` / `qwen`.
3. Füllen Sie den Schlüssel + das Modell für den gewählten Anbieter aus:
   - **Anthropic** — setzen Sie `ANTHROPIC_API_KEY` (console.anthropic.com), optional `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`).
   - **Gemini** — setzen Sie `GEMINI_API_KEY` (aistudio.google.com/apikey), optional `GEMINI_MODEL` (default `gemini-3.6-flash`).
   - **OpenAI** — setzen Sie `OPENAI_API_KEY` (platform.openai.com), optional `OPENAI_MODEL` (default `gpt-5-codex`).
   - **Qwen** — setzen Sie `QWEN_API_KEY` (Alibaba Model Studio / DashScope, dashscope.console.aliyun.com), optional `QWEN_MODEL` (default `qwen-max`). Für den Festland-CN-Endpunkt setzen Sie `QWEN_BASE_URL` in der rohen `.env`.
4. Klicken Sie auf **Save**. Die Schlüssel werden in die `.env` des übergeordneten Projekts geschrieben; die Änderung wird sofort wirksam — kein Server-Neustart nötig.
5. Überprüfen Sie auf `#/evaluate`: Fügen Sie eine Stellen-URL/-beschreibung ein und drücken Sie **⚡ Run live**. Der Ergebnis-Header zeigt, welcher Anbieter lief (`anthropic` / `gemini` / `openai` / `qwen`). Kein Schlüssel irgendwo gesetzt → Sie erhalten stattdessen den manuellen Kopier-Einfüge-Prompt.

Geheimnisse werden nach dem Speichern maskiert und niemals protokolliert. Modell-ID-Felder (`*_MODEL`) sind nicht geheim.

### Profile-Tab (Feldformular — v1.32.0)

Vor v1.32.0 war dieser Tab ein einzelner Roh-YAML-Textbereich, in dem
jede Einstellung in einem undifferenzierten Block lag. Er ist jetzt ein
strukturiertes Formular, Felder gruppiert in drei ausklappbare Abschnitte:

- **Candidate** — Full name (erforderlich), Email, Phone, Location,
  LinkedIn, GitHub, Portfolio URL, X / Twitter.
- **Narrative** — Headline, Exit story.
- **Compensation** — Target range, Currency, Walk-away minimum,
  Location flexibility.
- **Strukturierte Array-Editoren** (web-ui 1.35.0) — Editoren zum
  Hinzufügen/Entfernen von Zeilen für die listenförmigen Felder, sodass
  selbst diese kein Roh-YAML mehr benötigen: **Target roles** +
  **Superpowers** (Zeichenketten-Listen); **Archetypes** (Zeilen name /
  level / fit); **Proof points** (Zeilen name / url / hero-metric). Leere
  Zeilen werden verworfen; eine geleerte Liste entfernt den Schlüssel
  sauber. Dieselbe Zusammenführen-nicht-Ersetzen-Garantie — jedes Array,
  das Sie nicht anfassen, überlebt unberührt.

Wie das Speichern sicher ist:

- Das Formular sendet nur die 14 modellierten Skalarpfade als
  `{ fields: { "candidate.full_name": … } }`. Der Server **liest die
  vorhandene `config/profile.yml`, setzt/leert nur diese Blätter und
  serialisiert das gesamte Objekt neu** — sodass verschachtelte Arrays,
  die das Formular nicht modelliert (`target_roles.archetypes`,
  `narrative.proof_points`, `narrative.superpowers`), und alle
  benutzerdefinierten Schlüssel, die Sie von Hand hinzugefügt haben,
  **den Roundtrip unberührt überstehen**. Das Leeren eines Feldes
  entfernt diesen Schlüssel sauber (kein `phone: ""`-Rückstand).
- Die Validierung erfordert weiterhin einen vollständigen Namen; der
  Header `# Career-Ops Profile Configuration` wird automatisch gestempelt.
- Ein Kompromiss: Ein Feldformular-Speichern **serialisiert das YAML neu,
  sodass Inline-`#`-Kommentare verloren gehen**. Um Kommentare zu
  bewahren oder verschachtelte Arrays zu bearbeiten, verwenden Sie die
  Ausklappung **Advanced: edit raw YAML** am unteren Rand des Tabs — es
  ist der Vollständige-Datei-Editor von vor 1.32, unverändert (ersetzt
  beim Speichern die gesamte Datei).
- Die schreibgeschützte Zusammenfassung unter `#/profile` ist der
  visuelle Begleiter.

### Erkannte Schlüssel

| Schlüssel | Was er bewirkt | Woher zu bekommen |
|---|---|---|
| `ANTHROPIC_API_KEY` | Aktiviert Live-Anthropic-SDK-Aufrufe. Bevorzugt, wenn sowohl Anthropic + Gemini gesetzt sind — bessere strukturierte Langtext-Ausgabe für JD-Bewertung und Deep Research. | <https://console.anthropic.com/settings/keys> |
| `ANTHROPIC_MODEL` | Überschreibt den Standard `claude-sonnet-4-6`. Versuchen Sie `claude-opus-4-7` für schwierigeres Reasoning, `claude-haiku-4-5-20251001` für günstig-und-schnell. | — |
| `GEMINI_API_KEY` | Fallback, wenn kein Anthropic-Schlüssel. Wird von `gemini-eval.mjs` für den `oferta`-Modus verwendet. Der kostenlose Tarif funktioniert für geringes Volumen. | <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | Überschreibt das Standard-Gemini-Modell. | — |
| `(server uses default UA)` | Erforderlich beim Ausführen von `hh.ru`-Scans außerhalb Russlands (die API gibt bei einfachen User-Agents 403 zurück). Registrieren Sie eine App unter <https://dev.hh.ru/admin> und verwenden Sie deren UA-Zeichenkette. | dev.hh.ru |
| `PORT` | Express-Bind-Port. Standard 4317. | — |
| `HOST` | Bind-Adresse. Standard `127.0.0.1`. Das Setzen von `0.0.0.0` legt die UI im LAN offen — **noch kein Auth-Gate**, siehe Production-readiness-Dokument. | — |

### Verhalten

- **Read** (`GET /api/config`) gibt jeden erkannten Schlüssel zurück.
  Geheime Schlüssel (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) werden
  **maskiert** — Sie sehen `sk-ant•••••••a1b2`, niemals den vollen Wert.
- **Save** (`POST /api/config`) validiert jeden Wert, schreibt in die
  `<parent>/.env` und wendet ihn sofort auf den laufenden Prozess an.
  Kein Neustart nötig.
- **Ein leerer Wert löscht** den Schlüssel. Nützlich, wenn Sie eine
  russische IP / ein VPN nicht mehr verwenden möchten.

### Smoke-Test-Schaltflächen

Klicken Sie nach dem Speichern auf **▶ Test Anthropic** oder
**▶ Test Gemini** — beide feuern einen winzigen Prompt (≤256 Token
Ausgabe), sodass Sie praktisch nichts ausgeben, während Sie bestätigen,
dass der Schlüssel korrekt verdrahtet ist. Gibt bei Erfolg eine
Stichprobe von ~200 Zeichen zurück.

### Setup-Doktor — ein unvollständiges CV oder Profil erkennen

Der Tab **Setup-Doktor** auf `#/config` führt eine reine Lesekontrolle durch, ob deine `cv.md` und `config/profile.yml` tatsächlich ausgefüllt sind, und warnt, wenn übrig gebliebene Beispiel- oder Platzhalterdaten oder fest verdrahtete Kennzahlen in deinen Prompt-Dateien (`modes/_shared.md`, `modes/_writing.md`, `batch/batch-prompt.md`) durchrutschen. Er trennt **Fehler** (etwas, das die Pipeline braucht, fehlt, z. B. keine `cv.md`) von **Warnungen** (Beispieldaten noch vorhanden, ein zu kurz wirkendes CV, eine verdächtige Kennzahl). Nichts wird geschrieben und nichts irgendwohin gesendet — er liest und berichtet nur. Drücke **Erneut prüfen**, nachdem du diese Dateien bearbeitet hast. Bei einer eigenständigen Installation ohne das Elternprojekt zeigt der Tab stattdessen eine gedämpfte Zeile „nicht verfügbar“.

---

## 3. Profil (`#/profile` — auch erreichbar als `#/settings`)

Eine schreibgeschützte Zusammenfassungskarten-Ansicht von
`config/profile.yml`. **Zum Bearbeiten** gehen Sie zu
**App settings → Profile tab** (`#/config` → Profile) — seit web-ui 1.32.0
ist das ein feldweises Formular (Candidate / Narrative / Compensation),
kein Roh-YAML-Block. Speichern führt in dieselbe Datei zusammen; diese
Seite parst beim Neuladen neu.

Die Felder, die am wichtigsten sind:

- `candidate.full_name` — wird in jedem Prompt verwendet. **Ersetzen Sie
  die Vorlage `Jane Smith`**, bevor Sie etwas ernsthaft scannen, sonst
  gehen Ihre generierten Anschreiben unter dem Platzhalternamen raus.
- `candidate.email`, `linkedin`, `github` — werden in der
  Anschreiben-Generierung und der Bewerbungscheckliste referenziert.
- `target.roles` — akzeptierte Stellentitel. Der positive Filter des
  Scanners verwendet dies implizit (über `portals.yml::title_filter`).
- `target.comp_total_min_usd` — Mindestgesamtvergütung. Abschnitt D jeder
  Bewertung markiert Angebote darunter.
- `target.archetypes` — das *wichtigste Feld*. Das sind die
  Karrieremuster, die Sie akzeptieren (z. B. `Tech-Lead-Backend`,
  `Founding-Engineer`, `Data-Platform`). Jede JD wird gegen sie
  abgeglichen, und der bestpassende Archetyp landet im Report-Header.

Die Health-Seite zeigt eine Prüfung **Profile customized** an, die
fehlschlägt, solange `full_name` einem bekannten Platzhalternamen
entspricht.

---

## 4. CV (`#/cv`)

Einzige Wahrheitsquelle für jede Bewertung, Deep Research und jedes
Anschreiben. Liegt in `cv.md` im Stammverzeichnis des übergeordneten
Projekts.

### Bearbeitungsoptionen

- **Direkt einfügen** — der Textbereich links ist ein Markdown-Editor.
  Der rechte Bereich spiegelt, was das LLM (und Ihr zukünftiger
  Recruiter) sieht.
- **📁 Upload CV** — wählen Sie eine lokale Datei in einem dieser Formate,
  und der Server konvertiert sie für Sie in Markdown:
  - **Textformate** — `.md`, `.markdown`, `.txt`, `.html`, `.htm`
    werden durchgereicht (HTML geht über pandoc → GFM-Markdown).
  - **Office-Formate** — `.docx`, `.doc`, `.odt`, `.rtf` werden über
    **pandoc** konvertiert (`brew install pandoc` auf macOS,
    `apt install pandoc` auf Linux).
  - **PDF** — `.pdf` wird über **pdftotext** aus Poppler extrahiert
    (`brew install poppler` / `apt install poppler-utils`).
  - Das konvertierte Markdown landet im Editor; klicken Sie auf
    **💾 Save**, um es zu persistieren. Das Ergebnis wird bereinigt
    (derselbe XSS-Strip wie beim Einfügen).
  - Hartes Limit: **10 MB** pro Upload. Größere Dateien → 413.
- **Von LinkedIn** — einfachster Weg: öffnen Sie Claude Code im
  übergeordneten Projekt, führen Sie `/career-ops` aus, fügen Sie Ihre
  LinkedIn-URL ein und bitten Sie
  `extract my CV from this and write it to cv.md`.

### Was bereinigt wird

Serverseitig durchläuft jedes PUT auf `/api/cv` `stripDangerousMarkdown`:

- `<script>`-, `<iframe>`-, `<object>`-, `<embed>`-, `<svg>`-, `<style>`-,
  `<form>`-Tags — vollständig entfernt.
- Inline-Event-Handler (`onclick=`, `onerror=` usw.) — entfernt.
- `javascript:`-, `vbscript:`-, `data:text/html`-URI-Schemata — entschärft.

Die Antwort enthält `sanitized: true`, sobald eines der oben genannten
entfernt wurde, sodass Sie wissen, ob die Quelle etwas Übles enthielt.

Maximale Body-Größe: 1 MB. Alles Größere gibt 413 zurück.

### Andere Schaltflächen

- **sync-check** — führt `cv-sync-check.mjs` im übergeordneten Projekt
  aus. Markiert Inkonsistenzen: ein Projekt, das in Ihrem CV aufgeführt
  ist, aber nicht in den `data/applications.md`-Archetypen usw.
- **📄 Generate PDF** — streamt `generate-pdf.mjs`. Die Ausgabe landet in
  `output/*.pdf`. Erfordert Playwright (die Health-Seite zeigt, ob es in
  den `node_modules` des übergeordneten Projekts installiert ist). Wenn
  die Generierung fertig ist, wird das **neueste** PDF automatisch in
  Ihren Standard-Downloads-Ordner heruntergeladen; die Liste auf der
  Seite behält jede zuvor generierte Datei.

### Ton- / Format-Tipps

- Ein Aufzählungspunkt = eine Errungenschaft mit einer Kennzahl.
  *„Reduced p99 latency by 38%"* schlägt *„improved performance"* für
  jedes Bewertungsschema.
- Abschnitte in dieser Reihenfolge: **Summary** (3–5 Zeilen),
  **Experience** (rückwärtschronologisch), **Projects** (max. 5),
  **Education**, **Skills** (dedupliziert, kein Buzzword-Brei).
- Halten Sie es unter 1500 Wörtern. Das Bewertungsschema nutzt dichte
  Informationen; ein weitschweifiges CV wird für Rauschen bestraft.

---

## 5. Portale & Quellen (`portals.yml`)

Die Scanner-Konfiguration liegt in `portals.yml` im übergeordneten
Stammverzeichnis. Drei Abschnitte sind wichtig. Die drei Abschnitte der
SPA (unten) entsprechen dem kanonischen career-ops.org-Schema aus
[scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
1:1.

> **Abkürzung:** die `#/portals`-URL löst jetzt direkt zu **App
> settings** auf und (wenn eine regionale Quelle konfiguriert ist)
> springt zur Gruppe **Regional sources** — sodass ein gemerkter oder
> getippter `#/portals`-Link nicht mehr 404 liefert (v1.42.0).

### `title_filter`

```yaml
title_filter:
  positive: [backend, engineer, senior, tech lead, golang, php]
  negative: [junior, intern, frontend, ios, android, java]
  seniority_boost: [Senior, Staff, Lead, Principal]
```

Eine gescannte Stelle passt, wenn ihr Titel **mindestens ein positives**
Schlüsselwort enthält UND **keines der negativen** Schlüsselwörter.
Justieren Sie beide. Schlüsselwörter sind Groß-/Kleinschreibungs-
unabhängige Teilzeichenketten.

`seniority_boost` ist der dritte Titelfilter-Schlüssel. Hier aufgeführte
Schlüsselwörter filtern nichts heraus — sie schieben passende Stellen in
den Ergebnissen höher, sodass ein „Senior Backend Engineer" über einem
„Engineer" landet. Standard: `["Senior", "Staff", "Lead"]`. Justieren Sie
es passend dazu, wie Ihre Zielrollen betitelt sind.

Beginnen Sie mit 3–5 positiven Schlüsselwörtern zur Klarheit; erweitern
Sie später.

### `location_filter` (optional — web-ui 1.33.0, parent #570)

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

Filtert gescannte Stellen nach ihrer **Standort**-Zeichenkette
(Groß-/Kleinschreibungs-unabhängige Teilzeichenkette), angewendet sowohl
vom ATS-Durchlauf als auch vom regionalen Durchlauf. Semantik, identisch
zum kanonischen career-ops `scan.mjs`:

- Kein `location_filter`-Schlüssel → jeder Standort passt (Standard).
- Eine Stelle mit einem **leeren/fehlenden** Standort → passt (fehlende
  Daten werden nicht bestraft).
- Eine `block`-Schlüsselwort-Übereinstimmung → **abgelehnt** (block hat
  Vorrang vor allow).
- `allow` leer → passt (block hat es bereits durchgelassen).
- `allow` nicht leer → muss **mindestens ein** Schlüsselwort treffen.

Schlüssel auf oberster Ebene in `portals.yml` (ein Geschwister von
`title_filter`, nicht verschachtelt unter `russian_portals`). Verwenden
Sie ihn, um Stellen zu verwerfen, die den Titelfilter überlebt haben,
aber in einer Region liegen, die Sie nicht annehmen können.

Beginnen Sie mit 3–5 positiven Schlüsselwörtern zur Klarheit; erweitern
Sie später.

**`content_filter` (optional — web-ui 1.75.0, parent #974).** Ein Geschwister
auf oberster Ebene von `location_filter` mit denselben `positive` / `negative`-
Schlüsselwortlisten, aber abgeglichen gegen den **Beschreibungs-/Snippet**-Text
einer Ausschreibung statt gegen ihren Standort:

```yaml
content_filter:
  positive: ["python", "machine learning"]
  negative: ["security clearance", "on-site only"]
```

Identische Semantik zu `location_filter`: kein Schlüssel → alles passt; eine
Ausschreibung mit einer **leeren/fehlenden** Beschreibung passt (fehlende Daten
werden nicht bestraft); eine `negative`-Übereinstimmung → abgelehnt; `positive`
leer → passt; `positive` nicht leer → muss mindestens ein Schlüsselwort treffen
(Groß-/Kleinschreibungs-unabhängige Teilzeichenkette). Angewendet sowohl vom
ATS- als auch vom regionalen Durchlauf. Nur Quellen, die eine Beschreibung/ein
Snippet mitliefern (z. B. RSS), sind betroffen — jede andere Ausschreibung
passt — sodass das Aktivieren nie stillschweigend Zeilen aus Quellen verwirft,
die keinen Body tragen. Verwenden Sie es, um eine titelbestehende Ausschreibung
zu verwerfen, deren Body ein Ausschlusskriterium offenbart.

**`trust_filter` (optional — web-ui 1.76.0, parent career-ops v1.13.0).** Ein
Block auf oberster Ebene, der jede gescannte Ausschreibung mit einem
Vertrauens-Score (0–100), einer Stufe (`high` / `medium` / `low`) und Flags
**annotiert** (nie verwirft). Aus, es sei denn, er ist vorhanden und nicht
deaktiviert:

```yaml
trust_filter:
  enabled: true
  suspicious_domains: ["bit.ly", "tinyurl.com"]   # optional — overrides the default shortener list
  ats_allowlist: ["greenhouse.io", "ashbyhq.com"] # optional — overrides the default ATS host allowlist
```

Heuristiken: fehlende Bewerbungs-URL (−40), ungültige URL (−50), verdächtige
Shortener-Domain (−25), Unternehmen↔Domain-Diskrepanz (−15, übersprungen für
bekannte ATS-Hosts). Ausschreibungen unter `high` erhalten ein
sprachneutrales **⚠ score**-Abzeichen in der `#/scan`-Tabelle (der Tooltip
listet die Flag-Codes auf), sodass Sie Zeilen mit geringem Vertrauen sichten
können, ohne dass etwas herausgefiltert wird. Lassen Sie den Block ganz weg,
um das Verhalten von vor 1.76 beizubehalten (keine Annotation, kein Abzeichen).

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

`search_queries` treiben den KI-gestützten Option-B-Scan (`/career-ops scan`
innerhalb Claude Code / Cursor / Codex) an. Sie werden NICHT vom prozessinternen
`npm run scan` ausgeführt (das nur öffentliche Board-APIs anspricht).
Verwenden Sie sie, wenn Sie Rollen bei Unternehmen entdecken möchten, die
noch nicht in `tracked_companies` sind. Setzen Sie `enabled: false`, um
einen Eintrag zu behalten, ohne ihn auszuführen.

### `tracked_companies`

```yaml
tracked_companies:
  - { name: Stripe,     enabled: true, careers_url: https://job-boards.greenhouse.io/stripe }
  - { name: Linear,     enabled: true, careers_url: https://jobs.ashbyhq.com/linear }
  - { name: JetBrains,  enabled: true, careers_url: https://jobs.lever.co/jetbrains }
```

Erforderliche Felder pro Eintrag: `name` und `careers_url`. Optional:
`api` (expliziter Greenhouse- / Ashby- / Lever- / Workable- / SmartRecruiters- / Workday-
Endpunkt), `enabled: true|false` zum Ein-/Ausschließen ohne Löschen des
Eintrags. Der ATS-Scanner erkennt das ATS aus dem URL-Muster
(`job-boards.greenhouse.io/<slug>` → Greenhouse usw.) und ruft die
öffentliche boards-api jedes Unternehmens direkt ab. Unternehmen ohne ein
erkennbares ATS werden übersprungen (die Karte **Active Companies** auf
`/#/scan` zeigt sie in Grau mit `○`).

**Per-Mandant-ATS-Anbieter (v1.76.0 — parent career-ops v1.13.0 parity).** Sechs
weitere ATSes erkennen automatisch direkt aus `careers_url` (oder einem
expliziten `api:`), kein `provider:` nötig:

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

Jedes fixiert seinen Host mit einem verankerten Regex + `redirect:'error'`
(SSRF-sicher). Siehe `docs/portals-examples.md` für vollständigere
Kopier-Einfüge-Einträge.

### `rss` (RSS-/Atom-Boards)

```yaml
tracked_companies:
  - { name: LaraJobs, enabled: true, provider: rss, rss: https://larajobs.com/feed }
  - { name: WeWorkRemotely, enabled: true, provider: rss, rss: https://weworkremotely.com/remote-jobs.rss }
```

Richten Sie den Scanner auf jedes Job-Board, das einen RSS-/Atom-Feed veröffentlicht (LaraJobs, WeWorkRemotely, RemoteOK, golangprojects, …), indem Sie einen Eintrag mit `provider: rss` plus einem `rss:`- (oder `feed_url:`-)Schlüssel hinzufügen — **keine Code-Änderungen**. Der RSS-Adapter parst jedes `<item>` (CDATA + HTML-Entities, Titel/Unternehmen tag-bereinigt), normalisiert es zu einer Stelle und durchläuft denselben `title_filter` / `location_filter` + Dedup + Pipeline-Anhängen-Ablauf wie ATS-Quellen. **RSS** erscheint dann als auswählbare Quelle im `#/scan`-Filter-Dropdown. (web-ui v1.62.x)


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

`queries` sind Groß-/Kleinschreibungs-unabhängige Teilzeichenketten-
Übereinstimmungen gegen Stellentitel auf hh.ru und Habr Career. **Seien
Sie vorsichtig mit Überschneidungen mit der Negativliste** — wenn
`"Senior PHP"` in `queries` steht, aber `"php"` in
`title_filter.negative` landet, gibt der Scan null Ergebnisse zurück, und
die Konsole warnt Sie vor dem Konflikt.


### Russische Portale konfigurieren — detaillierte Einrichtungsanleitung

v1.29.0 liefert 5 russischsprachige Adapter. Zwei benötigen nichts weiter als den Standard-UA (`habr-career`, HTML-Scrape; `trudvsem`, Regierungs-Open-Data-API — kein Schlüssel, kein IP-Gate). Zwei sind HTML-Scrapes von Tech-Boards (`getmatch`, `geekjob` — ebenfalls kein Schlüssel). Eines ist die kanonische hh.ru-API, die von nicht-russischen IPs mit 403 antworten kann, sofern Sie nicht eine `HH_USER_AGENT`-Umgebungsvariable über **App settings → API keys & runtime** setzen (oder den Server von einer russischen IP / einem VPN-Ausgangsknoten aus ausführen).

#### Quellen-Inventar

| Quellenschlüssel | Anzeigename | Typ | Auth | Geo-Beschränkung |
|---|---|---|---|---|
| `hh` | hh.ru | JSON API | optional `HH_USER_AGENT` | non-RU IPs may 403 |
| `habr` | Habr Career | HTML | none | none |
| `trudvsem` | Trudvsem | JSON API (open-data) | none | none |
| `getmatch` | GetMatch | HTML | none | none |
| `geekjob` | GeekJob | HTML | none | none |

#### Schritt 1 — `portals.yml` öffnen

Die Datei liegt im übergeordneten `career-ops/`-Stammverzeichnis (NICHT innerhalb von `web-ui/`). Wenn sie noch nicht existiert, kopieren Sie das mit dem übergeordneten Projekt gelieferte Beispiel:

```bash
# from the parent career-ops/ root (NOT web-ui/)
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

#### Schritt 2 — Alle 5 Quellen aktivieren

Fügen Sie den `russian_portals`-Block hinzu oder aktualisieren Sie ihn, um jede Quelle aufzulisten, die Sie scannen möchten. Die Reihenfolge im Array ist irrelevant; der Scanner durchläuft sie in Registry-Reihenfolge.

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

#### Schritt 3 — Queries und Filter justieren

`queries` sind die Zeichenketten, die der Scanner verwendet, um jede Quelle zu durchsuchen. Jede Query läuft einmal auf jeder Quelle — also 4 Queries × 5 Quellen = 20 Aufrufe pro Scan. Halten Sie die Liste fokussiert (3–7 Queries), um die Scan-Zeit unter einer Minute zu halten. `area` ist der hh.ru-Regionscode (andere Quellen ignorieren ihn). `per_page` begrenzt, wie viele Stellen jede Quelle pro Query zurückgibt. `only_remote: true` filtert jedes Ergebnis auf reine Remote-Stellen auf Adapter-Ebene (die Ergebnistabelle hat weiterhin einen separaten Remote-Chip).

#### Häufige Fallstricke

**Negativlisten-Kollision.** Wenn ein Wort aus einer Query (`"php"`, `"senior"`) auch in `title_filter.negative` erscheint, wird jedes Ergebnis herausgefiltert, bevor Sie es sehen. Der Scanner gibt zur Scan-Zeit eine stderr-Kollisionswarnung aus — achten Sie auf die Zeile `⚠ config: query "Senior PHP" contains "php" which is in the negative list`. Beheben Sie es, indem Sie das kollidierende Wort aus `negative` entfernen:

```yaml
title_filter:
  positive: [backend, senior, lead, php, go, golang, python]
  negative: [junior, intern, frontend, ios, android]
russian_portals:
  queries:
    - "Senior PHP"     # OK — "php" no longer in negative list
    - "Senior Go"
```

#### Eine Quelle vorübergehend deaktivieren

Um eine Quelle zu deaktivieren, ohne ihre Daten zu löschen, entfernen Sie einfach ihren Schlüssel aus `sources`:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem"]   # only 3 of 5 sources will run
```

#### Die Einrichtung überprüfen

Nach dem Speichern von `portals.yml`:

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

### CLI-Bootstrap-Ablauf ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

Die kanonische career-ops-Einrichtung (einmal vom übergeordneten
Stammverzeichnis ausgeführt):

```bash
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

Das ist der gesamte Bootstrap. Bearbeiten Sie die drei Abschnitte
(`title_filter`, `tracked_companies`, `search_queries`, optional
`russian_portals`), speichern Sie, und Sie sind bereit zum Scannen.

### SPA-Bootstrap-Verhalten

Beim ersten Start hängt der Server einen dokumentierten
`russian_portals:`-Block an `portals.yml` an, wenn er fehlt — idempotent
(der zweite Start ist ein No-op, weil die wörtliche
`russian_portals:`-Zeile nun vorhanden ist). Die englischen Abschnitte
werden NICHT automatisch eingefügt; sie stammen aus der
`templates/portals.example.yml`, die Sie gemäß dem oben genannten
kanonischen Bootstrap kopiert haben.

**Wiederbewerbungs-Cooldown (v1.84.0).** Fügen Sie einen `re_apply_windows:`-
Block zu `config/profile.yml` hinzu, um den Scan davon abzuhalten, Rollen
erneut aufzutauchen, auf die Sie sich bereits beworben haben. Pro Unternehmen
setzen Sie `last_apply_date` (`YYYY-MM-DD`), `same_role_days` (Cooldown-Länge),
`applied_to:` (eine Liste der Rollentitel, auf die Sie sich beworben haben) und
einen optionalen `cross_role_bucket` (Unterstrich-Schlüsselwörter, z. B.
`backend_em`). Solange `today` vor `last_apply_date + same_role_days` liegt, wird
jede gescannte Rolle bei diesem Unternehmen, deren Titel `applied_to`
(Teilzeichenkette) oder die Bucket-Schlüsselwörter trifft, **übersprungen** —
das Scan-Log zeigt `Cooldown skipped: N`, und diese Zeilen erreichen nie die
Ergebnistabelle oder `pipeline.md`. Der Unternehmensabgleich ist
zeichensetzungs-unabhängig und wortgrenzen-bewusst (`Acme Inc` trifft
`Acme, Inc.`). Kein `re_apply_windows:`-Schlüssel → kein Cooldown (der Standard).

**Vergütung in `pipeline.md` (v1.84.0).** Wenn ein gescanntes Angebot ein
Gehalt trägt, wird es an `data/pipeline.md` als optionale nachgestellte Spalte
angehängt — `url | salary` — neben der URL. Die URL bleibt der Dedup-Schlüssel
(die Gehaltsspalte wird entfernt, wenn die Pipeline zurückgelesen wird), die
Zelle wird bereinigt, sodass sie keine Zeile oder Tabellenkalkulationsformel
einschleusen kann, und bestehende Nur-URL-Pipelines funktionieren unverändert
weiter.

### Das ATS-Board eines Unternehmens entdecken

Oben auf `#/portals` gibt es ein Feld **ATS-Board entdecken**. Gib einen Firmennamen ein (zum Beispiel „Stripe“), und die App sondiert Greenhouse, Ashby und Lever nach einem öffentlichen Jobboard unter diesem Namen — schreibgeschützt, ohne KI, ohne Browser. Für jeden Anbieter, der ein Board hat *und* aktuell mindestens eine offene Stelle listet, erhältst du einen Treffer mit Anbieter, Karriere-URL und der Zahl offener Stellen. Drücke **Zu verfolgten hinzufügen**, und dieses Board wird an `tracked_companies:` in deiner `portals.yml` angehängt, sodass der Scanner es ab dem nächsten Scan beobachtet. Duplikate werden erkannt (du siehst „Bereits verfolgt“), und nur bekannte ATS-Hosts lassen sich hinzufügen — beliebige URLs werden abgelehnt. Es werden nur Greenhouse, Ashby und Lever sondiert; ein Unternehmen auf einem anderen Portal oder ohne aktuell ausgeschriebene Stellen zeigt keinen Treffer.

---

## 6. Health (`#/health`)

Jedes Einrichtungs-Gate, in OK- / OPTIONAL- / FAIL-Abzeichen. Lesen Sie
dies, bevor Sie ein „funktioniert nicht"-Issue einreichen.

**KI-Nutzung & Kosten.** Die Seite **KI-Nutzung** (💳, neben Health) zeigt Tokens für Live-KI-Generierungen pro Anbieter über 24 Std./7 T./30 T./gesamt, mit geschätzten USD-Kosten aus einer bearbeitbaren Preistabelle (nie abgerechnet). Eine kompakte **NUTZUNG**-Anzeige ist außerdem unten in der linken Seitenleiste auf jeder Seite angeheftet — dieselben 24h/7T/30T-Token-Summen und geschätzte 24-Stunden-Kosten, live aktualisiert; das Menü bleibt stets frei darüber, und ein Klick auf die Kopfzeile klappt sie ein.

### Erforderliche Prüfungen (das System kann ohne diese nicht funktionieren)

- `Node version` ≥ 18 — der Server verwendet natives `fetch` und
  `node:test`.
- `Project root` — dass `CAREER_OPS_ROOT` (env oder automatisch
  erkannt) existiert.
- `cv.md`, `config/profile.yml`, `portals.yml`,
  `data/applications.md`, `data/pipeline.md`, `modes/oferta.md`.

### Optionale Prüfungen (nur Warnungen)

- `Profile customized` — `candidate.full_name` ist nicht der
  Vorlagen-Platzhalter.
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` — in `.env` gesetzt.
- `(server uses default UA)` — nur relevant, wenn Sie hh.ru von außerhalb Russlands scannen.
- `Playwright (parent node_modules)` — erforderlich für PDF-Generierung
  und `check-liveness.mjs`. Installieren mit
  `cd $CAREER_OPS_ROOT && npm install && npx playwright install chromium`.
- `Parent project dependencies` — `cd $CAREER_OPS_ROOT && npm install`,
  falls fehlend.
- `data/`-, `reports/`-, `output/`-, `jds/`-Verzeichnisse — beim ersten
  Schreiben automatisch erstellt.

Wenn der Server über Loopback hinaus offengelegt ist (`HOST=0.0.0.0`),
werden die absoluten Pfade und die genaue Node-Version in der Antwort
durch `"hidden"` ersetzt, sodass ein neugieriger Nachbar Ihre Installation
nicht fingerprinten kann.

### Ausführen-Schaltflächen

- **▶ Doctor** führt `node doctor.mjs` aus und zeigt die Ausgabe in einem
  Modal an.
- **▶ Verify pipeline** führt `node verify-pipeline.mjs` aus.

---

## 7. Scan (`#/scan`)

Der Scanner durchsucht jedes aktivierte Board, dedupliziert gegen Ihre
Historie und schreibt Treffer in `data/last-scan.json` und
`data/pipeline.md`.

**Suchen + Ausschließen.** Das Suchen-Feld behandelt Kommas als ODER ("zu findende Rollen"); das neue Ausschließen-Feld blendet Zeilen aus, die einem kommagetrennten Wort entsprechen. Beide werden mit deinen Suchen gespeichert.

### Ein-Klick-Scan (SPA)

**🌐 Scan** führt jede aktivierte Quelle in einem einzigen Durchlauf aus:

- Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (der ATS-Durchlauf) für jedes Unternehmen in
  `tracked_companies` mit einer erkennbaren ATS-URL.
- Die v1.75.0-Aggregatoren für jeden `tracked_companies`-Eintrag, der sich für einen entscheidet: RemoteOK / Remotive / Working Nomads (board-weite Remote-Feeds, `provider: <slug>`) und IBM / Arbeitsagentur / Glints / Jobstreet · SEEK (konfigurationsgesteuert, `<provider>:`-Block pro Eintrag).
- hh.ru API + Habr Career + Trudvsem + GetMatch + GeekJob für jede Query in `russian_portals`.

**Zwei Phasen, ein Klick (v1.29.2).** Die einzelne 🌐 Scan-Schaltfläche treibt SOWOHL den ATS-Durchlauf als auch den regionalen Durchlauf in einem SSE-Stream an. Sie sehen zwei Phasen-Header im Log, in dieser Reihenfolge:

1. `▶ ATS scan (Greenhouse + Ashby + Lever)` — EN-ATS-Boards.
2. `▶ Regional scan (hh.ru + Habr Career)` — 5 RU-Quellen aus der Registry.

Jede Phase endet mit einer `✓ done · NEW=N`-Zusammenfassung. Wenn Sie nur die ATS-Phase sehen, ist Ihr Stand auf einem Build vor v1.29.2 — aktualisieren Sie. Vor v1.29.2 schloss der SSE-Client beim ersten `done`-Ereignis, und die regionale Phase wurde stillschweigend verworfen (`tests/scan-stream-multi-phase.test.mjs` ist das Regressionsnetz).

Ein Live-SSE-Log streamt in den rechten Bereich, während der Scan läuft.
Klicken Sie auf **Stop** (oder navigieren Sie einfach weg), um abzubrechen
— der Server storniert laufende HTTPS-Anfragen über `AbortController`.

### Ergebnisse filtern

Unter dem Log rendert die Ergebnistabelle Zeilen aus
`data/last-scan.json`.

> **v1.76.0 — keine Ergebnisobergrenze.** Frühere Builds speicherten höchstens
> 2000 passende Zeilen pro Region (`MAX_STORED_RESULTS`) und versteckten
> stillschweigend den Rest eines großen Durchlaufs. Diese Obergrenze ist
> **weg**: Jede passende Ausschreibung wird gespeichert, und die Tabelle blättert
> einfach durch sie (200 pro Seite — verwenden Sie die Blätter-Steuerelemente
> unter der Tabelle). Nichts wird verworfen; Sie blättern nur Seiten.

> **v1.78.1 — Live-Auto-Aktualisierung.** Die Ergebnistabelle aktualisiert sich
> nun automatisch, während ein Scan läuft, und noch einmal direkt danach — kein
> manuelles Neuladen oder Seitenwechsel nötig. Der Cache wird zu Beginn jedes
> Scans zurückgesetzt und neu gefüllt.

> **v1.80.0 — Max per source & Quellen-Quarantäne.** Das Feld **Max per source**
> neben der Scan-Schaltfläche begrenzt, wie viele Stellen jedes Board beisteuert
> (leer/0 = unbegrenzt, der Standard) — praktisch, wenn ein riesiges Board
> sonst dominieren würde. Separat wird jede Quelle, die ein permanentes
> **404 / 410** zurückgibt, in `data/scan-quarantine.json` geschrieben und bei
> späteren Scans übersprungen (selbstheilend: nach 14 Tagen erneut versucht),
> sodass tote Slugs aufhören, das Log zuzuspammen. Deaktivieren mit
> `scan_quarantine: false` in `portals.yml`.

Filter:

- **Freitext** — Teilzeichenketten-Übereinstimmung gegen Titel /
  Unternehmen.
- **Source**-Dropdown — Arbeitsagentur / Ashby / BambooHR / Breezy HR / Comeet / GeekJob / Glints / Greenhouse / GetMatch / Habr Career / hh.ru / IBM / Jobstreet · SEEK / Lever / Personio / Recruitee / RemoteOK / Remotive / RSS / SmartRecruiters / SolidJobs / Teamtailor / Trudvsem / We Work Remotely / Workable / Workday / Working Nomads (automatisch aus `GET /api/scan/sources` befüllt).
- **Remote / Hybrid / Onsite**-Dropdown.
- **Country**-Dropdown (v1.78.0) — ein Geografie-Filter, befüllt aus den Ländern, die in den aktuellen Ergebnissen erkannt wurden, jeweils mit seinem Flaggen-Emoji und einer Anzahl angezeigt (z. B. `🇩🇪 Germany (12)`). Wählen Sie eines aus, um nur an dieses Land gebundene Rollen zu behalten. Die Erkennung ordnet den Freitext-Standort einer Ausschreibung (Ländernamen/-aliase + ~100 große Job-Markt-Städte) einem Land zu; sie ist konservativ und rät nie, sodass eine Ausschreibung, deren Standort nicht aufgelöst werden kann — oder eine reine „Remote"-Anzeige — unter **All countries** bleibt. Kombinieren Sie es mit dem Arbeitsart-Dropdown, um länderbezogene *und* Remote-Rollen zu finden.
- **Posted within**-Dropdown (v1.80.0) — ein clientseitiger Altersfilter (Last 24 hours / 7 days / 30 days). Zeilen, deren `pubDate` älter ist, werden ausgeblendet; Zeilen mit **keinem aufgeführten Datum passen** (fehlende Daten werden nicht bestraft).
- **★ Favorites** (v1.80.0) — klicken Sie auf das ☆ in einer beliebigen Zeile, um eine Stelle zu markieren (in `localStorage` nach URL gespeichert); haken Sie **★ Favorites** im Filterbereich an, um nur markierte Zeilen anzuzeigen. Sterne überleben Scans und Neuladen.
- **Saved searches** (v1.80.0) — die Leiste über den Filtern: Benennen Sie den aktuellen Filtersatz und **💾 Save**, dann wenden Sie ihn erneut aus dem Dropdown an oder **🗑 Delete**. In `localStorage` gespeichert; ein beschädigter/bearbeiteter Wert wird sauber auf leer zurückgesetzt.
- **Stack-Chips** (PHP / Go / Backend / Senior / …) — automatisch pro Zeile
  erkannt von `Skills.detectTech` und `Skills.detectLevel`.
  Mehrfachauswahl-Schnittmenge — die Auswahl von `PHP + Senior` zeigt
  Zeilen, die BEIDE haben.
- **Dynamische Chips** unter den statischen Stack-Chips — die 25
  häufigsten großgeschriebenen Token aus Titeln, sodass sich die UI an die
  Rollen anpasst, die Sie tatsächlich scannen (Marketing, Design,
  Finanzen …), anstatt auf das Backend-Engineer-Vokabular festgelegt zu
  sein.

### Active Companies-Karte

Eine ausklappbare Karte, die jedes Unternehmen in `portals.yml` mit
seinem Scan-Status auflistet:

- ✓ grünes Tag — direkte API-Unterstützung (Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday).
- ○ graues Tag — Fallback auf Web-Search-Prompt (keine API-Übereinstimmung).

**Klicken Sie auf den Unternehmensnamen** → füllt den obigen
Ergebnisfilter mit diesem Namen. **Klicken Sie auf das ↗-Symbol** →
öffnet die `careers_url` des Unternehmens in einem neuen Tab.

### CLI-Scan-Ablauf ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

Zwei Wege, von der CLI-Seite zu scannen (beide legen URLs in derselben
`data/pipeline.md` ab, die die SPA liest):

**Option A — direktes Skript (~30 s, null AI-Token):**

```bash
npm run scan                          # all Greenhouse/Ashby/Lever boards
npm run scan -- --dry-run             # preview without persisting
npm run scan -- --company Anthropic   # narrow to one tracked company
```

Funktioniert nur für Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (erkennbare ATS-URLs).
Keine AI-Token verbraucht — es spricht die öffentlichen Board-APIs direkt an.

**Option B — KI-gestützter Browser-Scan:**

```
/career-ops scan
```

Innerhalb Claude Code / Cursor / Codex / OpenCode / Antigravity CLI / Grok Build CLI / Qwen Code / Kimi / GitHub Copilot CLI (Gemini CLI legacy). Verwendet
Modell-Token. Besucht jede `tracked_companies`-Seite direkt und kann
Nicht-API-Boards entdecken (Karriereseiten, benutzerdefinierte ATS,
regionale Portale). Langsamer, aber breiter. Nützlich, wenn ein
ATS-Durchlauf für ein Ziel, von dem Sie wissen, dass es einstellt, nichts
zurückgibt.

**Ausgabe (beide Wege)** — neue JD-URLs an `data/pipeline.md` angehängt,
jede besuchte URL in `data/scan-history.tsv` protokolliert (Dedup über
alle zukünftigen Scans), Zusammenfassung ausgegeben: gescannte Unternehmen
· gefundene Stellen · nach Titel gefiltert · übersprungene Duplikate ·
neu hinzugefügte Angebote.

**Handlungsschwellen nach Score** (anwendbar nach `/career-ops pipeline`
batch-scored die neuen URLs):

| Score | Empfohlener nächster Schritt |
|---|---|
| **≥ 4.5** | `/career-ops apply` — hohe Passung, sofort loslegen |
| **4.0 – 4.4** | bewerben oder `/career-ops contacto` für warme Vorstellung |
| **3.5 – 3.9** | `/career-ops deep` — zuerst recherchieren |
| **< 3.5** | überspringen, es sei denn, Sie haben einen bestimmten persönlichen Grund |

`#/dashboard` und `#/tracker` der SPA heben jede Zeile ab 4.0 hervor,
sodass Sie eine Handlung auswählen können, ohne etwas erneut ausführen zu
müssen.

### Nachfass-Befehle

Nach der Bewertung sind die kanonischen Nachfass-Aktionen:

- `/career-ops apply` — Bewerbung mit maßgeschneiderten Antworten ausfüllen
- `/career-ops contacto` — LinkedIn-/E-Mail-Outreach entwerfen
- `/career-ops deep` — Unternehmen / Rolle tiefgehend recherchieren
- `/career-ops tracker` — Pipeline-Status ansehen

---
### hh.ru — von der Website gescannt (seit Juli 2026 russische IP erforderlich)

hh.ru wird über die öffentliche Such-Website (`hh.ru/search/vacancy`) gescannt, genau wie Habr Career — ohne Schlüssel und Konfiguration. **Seit Juli 2026 liefert hh.ru jedoch HTTP 451 (regionale rechtliche Sperre) an IPs außerhalb Russlands**, der Scan funktioniert also nur von einer russischen IP — den Server aus Russland betreiben oder über ein VPN mit russischem Exit-Node. Beim ersten 451 (oder Anti-Bot-403) deaktiviert der Scanner hh.ru für den Rest des Laufs und vermerkt es im Log, sodass die übrigen russischen Quellen normal durchlaufen. Die JSON-API (`api.hh.ru`) wird bewusst *nicht* verwendet: Sie liefert jedem programmatischen Client `403 forbidden`, unabhängig von IP und User-Agent.

Selbst aus einem Netzwerk, das *richtig aussieht*, kann hh.ru die Egress-IP als VPN/Proxy einstufen (jede Datacenter-/Hosting-IP zählt) und den Scan per 302 auf ein Interstitial `/vpncheeck` (“VPN мешает работе сайта”) umleiten, das HTTP 200 mit **null** Vakanzen liefert. Der Scanner erkennt diese Umleitung, deaktiviert hh.ru für den Rest des Laufs und vermerkt es im Log. Die Lösung liegt auf Netzwerkseite: Stellen Sie sicher, dass der Traffic wirklich über eine Residential-IP hinausgeht — ein systemweiter VPN oder Proxy bleibt oft aktiv, auch wenn der Browser-Schalter aus ist (prüfen Sie Ihre echte Egress-IP, z. B. auf api.ipify.org).

## 8. Pipeline (`#/pipeline`)

Posteingang von URLs, die auf ihre Bewertung warten. Liegt in
`data/pipeline.md`.

**Überblicksstreifen.** Ein kompakter Streifen oben zeigt deine Pipeline auf einen Blick — wie viele URLs im Eingang, wie viele verfolgt und die Applied/Responded/Interview/Offer-Zahlen, jede verlinkt auf den Tracker.

### URLs hinzufügen

Drei Wege:

- Tippen / fügen Sie eine URL in die Eingabe ein + klicken Sie auf
  **+ Add**.
- Verwenden Sie die **globale Suche in der oberen Leiste** (ihr Abzeichen
  liest **Enter**): Fügen Sie einen beliebigen `http(s)://…`-Link ein und
  drücken Sie **Enter**, um die Auto-pipeline zu öffnen; tippen Sie einen
  beliebigen anderen Text, und **Enter** springt zu `#/scan` mit diesem
  Begriff vorausgefüllt (v1.78.1). Ctrl/Cmd+K fokussiert weiterhin das
  Feld, wo der Browser es erlaubt. Das Marken-**Logo** kehrt zum Dashboard
  zurück.
- Führen Sie einen Scan aus (siehe oben) — frische Treffer gehen
  automatisch in die Pipeline.

Jede URL durchläuft serverseitig `isValidJobUrl()`. Loopback
(`localhost`, `127.0.0.1`), `file://`, `javascript:`, IP-Literale und
Zeichenketten mit Vorlagen-Zeichen (`<`, `>`, `"`) liefern alle 400.

### Serverseitiger Vorschaubereich

Klicken Sie auf eine beliebige Pipeline-Zeile, um eine Vorschau rechts zu
laden. Die meisten ATS-Boards senden keine CORS-Header, sodass der Browser
sie nicht direkt abrufen kann; der Server proxyt die Anfrage, entfernt
`<script>` / `<style>` / HTML-Tags und gibt bis zu 8 KB Klartext zurück.

Der Vorschau-Proxy durchläuft Weiterleitungen manuell mit **SSRF-
Validierung pro Hop** — jeder `Location`-Header durchläuft erneut
`isValidJobUrl()`, sodass ein feindliches Board Sie nicht zu Loopback /
privater IP / `file://` umleiten kann. Begrenzt auf 3 Hops, 15-Sekunden-
Timeout.

### Zeilenaktionen

- **▶** — springt zu `#/evaluate?url=…` mit der URL vorausgefüllt.
- **✕** — entfernt die URL aus `data/pipeline.md`.

### Schaltflächen oben rechts

- **⚡ Evaluate first** — öffnet die erste eingereihte URL auf der
  Evaluate-Seite, bereit zur Bewertung.
- **Scan** — zurück zum Scanner, wenn Sie mehr URLs möchten.

---

## 9. Evaluate (`#/evaluate`)

Bewertet eine einzelne Stellenbeschreibung gegen `cv.md` und
`config/profile.yml`. Gibt eine strukturierte A–G-Bewertung gemäß
`modes/oferta.md` plus einen 0–5-Score zurück.

### Eingabe

Fügen Sie die JD in den Textbereich ein oder gelangen Sie von
`#/pipeline` hierher mit `?url=<href>` — die Seite ruft die URL über
denselben SSRF-sicheren Proxy ab, der für Pipeline-Vorschauen verwendet
wird, und füllt den Textbereich vor.

Klicken Sie auf **💾 Save JD**, um die JD in
`jds/jd-<date>-<ts>.txt` für die Prüfspur zu persistieren (oder übergeben
Sie `save: true` im API-Aufruf — gleicher Effekt).

### Fallback-Kette

1. **Anthropic** — bevorzugt, wenn `ANTHROPIC_API_KEY` gesetzt ist. Der
   Server bündelt `cv.md`, `config/profile.yml`, `modes/_shared.md` und
   `modes/oferta.md` vor dem Prompt in einen `<project_context>`-Block
   (jede Datei bei 16 KB begrenzt, vollständiger Prompt weich begrenzt bei
   200 KB). Gibt fundiertes Markdown direkt an die Seite zurück.
2. **Gemini** — wenn nur `GEMINI_API_KEY` gesetzt ist. Der Server startet
   `gemini-eval.mjs` mit der JD als temporäre Datei. Das Modell des
   kostenlosen Tarifs (`gemini-3.6-flash`) ist für routinemäßige Bewertung
   in Ordnung.
3. **Manual** — kein Schlüssel gesetzt. Die Seite gibt einen
   vollständig ausformulierten Prompt zurück, den Sie in Claude Code,
   ChatGPT oder ein anderes LLM einfügen können.

### Ausgabeabschnitte (kanonisch career-ops.org A-F)

> **v1.15.0-Neuausrichtung.** Die Blockbuchstaben entsprechen jetzt dem
> [kanonischen career-ops.org-Schema](https://career-ops.org/docs).
> Reports vor v1.15 verwendeten A–G (mit `C=Risks`, `F=Verdict`,
> `G=Legitimacy`); wir rendern sie zur Abwärtskompatibilität weiterhin
> unverändert, aber neue Reports emittieren A–F mit der kanonischen
> Semantik unten. Score und Legitimität leben jetzt im Report-Header
> (`score: 4.2/5`, `legitimacy: High|Medium|Low`).

A. **Role Summary** — 3-Punkt-Zusammenfassung (Risiken inline
benannt).
B. **CV Match** — die 3 wichtigsten getroffenen Skills + die 3
wichtigsten fehlenden.
C. **Strategy** — Empfehlung: apply now / contacto first /
deep first / skip. War `Risks` vor v1.15.
D. **Compensation** — relativ zu Ihrem
`target.comp_total_min_usd` (Legacy) oder `compensation.target_range`
(kanonisch).
E. **Personalization** — Ansatz, mit dem zu führen ist, Framing pro
Archetyp, Anknüpfungspunkte für Anschreiben / Outreach. War `Application
Strategy` vor v1.15.
F. **STAR stories** — 1–3 einfügefertige S-T-A-R-Blöcke, zugeschnitten
auf die Rolle. War `Verdict` (Rohscore) vor v1.15; der Score erscheint
jetzt im Report-Header neben `legitimacy`.

### Den Report speichern

Klicken Sie auf **💾 Save report** (oder verwenden Sie den Speicher-
Umschalter im API-Aufruf), um das Markdown in
`reports/<date>-<company>-<role>.md` zu persistieren. Der geparste Header
des Reports (Score / Legitimität / URL) erscheint auf der **Reports**-Seite
und im **Dashboard**.

### Batch-Bewertung, wenn Sie 10+ JDs haben

Für eine einzelne JD ist diese `#/evaluate`-Seite das richtige Werkzeug.
Für 10+ in der Pipeline eingereihte URLs ist das Durchklicken pro JD
unpraktisch — springen Sie zum Unterabschnitt **Batch evaluate** in §14
(Ausführen von `./batch/batch-runner.sh` vom übergeordneten Projekt),
lassen Sie es über Nacht durcharbeiten und kommen Sie dann für die
Ergebnisse zu `#/reports` / `#/tracker` zurück. Vollständiger Ablauf:
[batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers).

---

## 10. Reports (`#/reports`)

Durchsuchen Sie jede gespeicherte Bewertung. Karten zeigen Titel, Datum,
Legitimitäts-Flag und Score (farbcodiert: grün ≥ 4.0, gelb ≥ 3.0, rot
darunter).

Klicken Sie auf eine Karte, um das vollständige Markdown zu lesen.
Paginierung: 12 pro Seite; Steuerelemente am unteren Rand.

Die Einzelreport-Ansicht hat auch:

- **← All reports** — zurück zum Raster.
- **🔗 Open JD** — öffnet die ursprüngliche Stellenausschreibung in einem
  neuen Tab.

### Einen Bericht als PDF exportieren

Öffne einen gespeicherten Bericht und klicke auf **📄 Generate PDF**. Das
führt `generate-pdf.mjs` im Elternprojekt aus und schreibt die Datei nach
`output/*.pdf` (benötigt Playwright; die Health-Seite zeigt, ob es
installiert ist). Es wird nichts irgendwohin gesendet: prüfe das PDF, bevor
du es einer Bewerbung anhängst.

---

## 11. Tracker (`#/tracker`)

Das CRM. Eine Zeile pro Bewerbung; lebt in `data/applications.md` als
GitHub-Flavored-Markdown-Tabelle.

### Status-Ablauf

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` /
`Hired` / `Rejected` / `Discarded` / `SKIP`.

`Hired` (v1.118.0) ist der glückliche Endzustand — das Angebot wurde angenommen. Der Tracker markiert ihn mit einem feierlichen Badge und begrüßt ihn mit einem „Job gelandet”-Banner.

**Stage-Tab-Board (v1.131.0).** Oberhalb der Tabelle lässt Sie eine **Stage-Tab-Leiste** durch den Funnel wandern: ein **Alle**-Tab plus ein Tab pro kanonischem Status, jeweils mit einer live berechneten Gesamtverlaufs-Anzahl — **einschließlich Stufen mit null Treffern**, sodass die gesamte Pipeline stets auf einen Blick sichtbar ist. Klicken Sie auf eine Stufe, um die Tabelle darauf zu filtern; klicken Sie erneut, um zu **Alle** zurückzukehren. Die Tabs (und die Faltung lokalisierter/veralteter Status-Aliase in den Zählungen) stammen aus `GET /api/tracker/stages`, das dieselbe `templates/states.yml` liest, die auch der Server verwendet — sodass die Tab-Menge automatisch mit dem Status-Vokabular des Elternprojekts synchron bleibt, ohne hartcodierte Liste auf der Seite. Suche, der Score-Filter, sortierbare Spalten und die Report-/PDF-/Legitimitäts-Hinweise pro Zeile bleiben unverändert; bei aktivierten Logos zeigt jede Firmenzeile eine Marke.

Die Status-Whitelist wird serverseitig durchgesetzt; das Senden von etwas
anderem in einem `POST /api/tracker` fällt auf `Evaluated` zurück. Der
kanonische `Evaluated → Applied`-Übergang ist automatisch, wenn Sie
`Submitted.` am Ende von `/career-ops apply` bestätigen (siehe §14).

### Spaltenlayout

| Spalte | Was es ist |
|---|---|
| `#` | Automatisch nummeriert, mit Nullen aufgefüllt (`001`, `002`, …). |
| `Date` | ISO-Datum (`YYYY-MM-DD`). Standardmäßig heute. |
| `Company` | Freitext. **Pipes (`\|`) und Zeilenumbrüche werden automatisch escaped.** |
| `Role` | Dasselbe. |
| `Score` | `N/5`-Format (z. B. `4.2/5`). |
| `Status` | Whitelisted enum. |
| `PDF` | ✅, sobald `generate-pdf.mjs` für diese Zeile erfolgreich war. |
| `Report` | Markdown-Link zum passenden `reports/*.md`. |
| `Notes` | Freitext, bei 200 Zeichen begrenzt. |

### Filter

- **Status**-Dropdown.
- **Score**-Dropdown — `≥ 4.0` (hoch), `≥ 3.0` (mittel), `< 3.0` (niedrig).
- **Search** — Teilzeichenketten-Übereinstimmung über Unternehmen + Rolle.

Jeder Filter setzt den Paginator auf Seite 1 zurück. 25 Zeilen pro Seite.

### Wartungs-Schaltflächen

- **▶ Normalize** führt `normalize-statuses.mjs` aus —
  re-kanonisiert Status-Schreibweisen (`applied` → `Applied`,
  `interview` → `Interview`).
- **▶ Dedup** führt `dedup-tracker.mjs` aus — entfernt
  Groß-/Kleinschreibungs-unabhängige Duplikate nach `(company, role)`.
- **▶ Merge** führt `merge-tracker.mjs` aus — zieht ausstehende Einträge
  aus `batch/tracker-additions/*.tsv` ein (wo der Batch-Ablauf des
  übergeordneten Projekts über den Apply-Helfer eingereichte Bewerbungen
  ablegt). Dedupliziert und archiviert verarbeitete Dateien nach
  `batch/tracker-additions/merged/`. Siehe
  [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  für den vorgelagerten Batch-Ablauf.

### Zeilen hinzufügen

`POST /api/tracker` — Body `{ company, role, score?, status?, url?,
reportSlug?, notes?, date? }`. Dedup nach `(company, role)`
Groß-/Kleinschreibungs-unabhängig. Aus der UI bietet die Evaluate-Seite
nach einer erfolgreichen Bewertung eine „Add to tracker"-Schaltfläche.

### „Noch aktiv?“ — prüfen, ob eine ATS-Anzeige noch offen ist

Jede verfolgte Zeile, die auf eine ATS-gehostete Anzeige verlinkt (Greenhouse, Lever, Ashby, Workday oder SmartRecruiters), erhält einen kleinen Button **Noch aktiv?**. Klick darauf, und die App fragt den eigenen öffentlichen JSON-Endpunkt dieses ATS, ob die Anzeige noch steht — ohne Browser, ohne KI-Tokens, nichts wird gespeichert. Du bekommst eines von drei Abzeichen:

- **Aktiv** — die Anzeige ist noch gelistet.
- **Abgelaufen** — das ATS meldete ein definitives „weg“ (HTTP 404/410), die Stelle wurde also zurückgezogen.
- **Unbekannt** — die Prüfung war nicht eindeutig (die URL ist keine erkannte ATS-Anzeige, oder das API war rate-begrenzt, lief in ein Timeout oder antwortete mehrdeutig).

Die Prüfung ist bewusst konservativ: Sie sagt **Abgelaufen** nur bei einem klaren 404/410, nie auf Verdacht, sodass sie dich nie von einer Stelle abschreckt, die in Wahrheit noch offen ist. Levers öffentliches API gilt als nicht maßgeblich (es verbirgt manche vertraulichen Anzeigen), daher landen solche Fälle bei **Unbekannt** statt Abgelaufen.

### Ein Ergebnis festhalten

Wenn eine Bewerbung ihr Ende erreicht — du hast das Angebot bekommen, den Job angenommen, wurdest abgelehnt oder hast schlicht nie etwas gehört — klicke auf die Schaltfläche **Ergebnis** in dieser Tracker-Zeile, um es festzuhalten. Ein kleines Vorschau-und-Bestätigen-Fenster öffnet sich:

- **Wähle, was passiert ist** — Abgelehnt, Angebot erhalten, Eingestellt / angenommen, Angebot abgelehnt, Keine Antwort / geghostet, oder Zum Interview vorgerückt.
- **Notiz (optional)** — eine kurze Zeile für dich.
- **Vorschau** — die App zeigt genau, was sie tun wird (z. B. *„Setzt #12 Acme → Abgelehnt"*), und schreibt noch nichts.
- **Ergebnis festhalten** — bestätigt es.

Das Festhalten erledigt drei Dinge auf einmal: Es hängt das Ergebnis an ein Nur-Anhängen-Ergebnisjournal an, archiviert den eingereichten Lebenslauf und das Anschreiben im Ergebnisordner dieser Bewerbung und synchronisiert den kanonischen **Status** der Zeile — so taucht ein **Eingestellt** oder **Abgelehnt** im Tracker und in der Statistik auf, ohne dass du die Tabelle von Hand bearbeitest. Wie die anderen Tracker-Werkzeuge bleibt es nur lesend, bis du **Ergebnis festhalten** drückst, und es braucht das übergeordnete career-ops-Projekt neben der App (die Schaltfläche ist verborgen, wenn dieses Projekt fehlt).

---

## 12. Deep research (`#/deep`)

Generieren Sie ein strukturiertes Unternehmensbriefing: Snapshot,
Engineering-Kultur, aktuelle Nachrichten, Glassdoor-Stimmung,
Interview-Prozess, Verhandlungshebel, drei kluge Fragen, die man dem
Recruiter stellen kann.

### Eingabe

Zwei Felder — Unternehmensname und (optional) Rolle. Die Modus-Vorlage
(`modes/deep.md`) formt die Struktur.

### Ausgabepfade

Dieselbe Fallback-Kette wie bei Evaluate:

1. **Anthropic live** (bevorzugt) — `bundleProjectContext` fügt
   cv + profile + `_shared.md` + `deep.md` inline ein. Ausgabe: 10–30 KB
   fundiertes Markdown, gespeichert in
   `interview-prep/<company>-<role>.md`.
2. **Gemini live** — `gemini-eval.mjs`-Aufruf. Gleiches Speicherziel.
3. **Manueller Prompt** — die Seite reicht Ihnen einen fertigen Prompt
   für Claude Code (das WebFetch + WebSearch hat und echte Recherche
   durchführen kann).

### Tipps

- Anthropic auf `claude-sonnet-4-6` gibt typischerweise ~13 KB nützlichen
  Text in 1–3 Minuten pro Aufruf zurück.
- Das Anthropic SDK hat keine eingebaute Websuche. Für Rollen, bei denen
  Sie frische Nachrichten + Glassdoor-Stimmung benötigen, fügen Sie den
  manuellen Prompt in Claude Code ein und lassen Sie es sein WebFetch-Tool
  verwenden.
- Live-Läufe werden abgerechnet; ein Sonnet-4.6-Deep-Research-Aufruf
  kostet ≈ $0.30–0.50.

---

## 13. Modus-Prompts (die sieben `/#/<mode>`-Seiten)

**Kadenz-Board (v1.117.0).** Die Follow-up-Seite öffnet jetzt mit einem deterministischen **Kadenz-Board**, gespeist vom `followup-cadence.mjs` des Elternprojekts: Dringlichkeit je Bewerbung (🔴 dringend / 🟠 überfällig / 🟡 wartend / 🔵 kalt) mit Tagen bis zum nächsten Schritt, plus einem Button **Follow-up-Termine setzen**, der jeder Applied-Zeile ein erstes Datum anheftet (`followup-seed.mjs --backfill`). Ohne die Eltern-Skripte zeigt das Board ehrlich „nicht verfügbar".

Sieben Prompt-Builder: **Project**-Ideen, **Training**-Pläne,
**Follow-up**-E-Mails, **Batch**-Bewertungen, **Outreach** an
Recruiter, **Interview prep**-One-Pager und **Patterns**-
Retrospektiven. Jeder umschließt eine bestimmte
`modes/<slug>.md`-Vorlage:

| Seite | Slug | Zweck |
|---|---|---|
| `#/project` | `project` | Ein Portfolio-Projekt für eine Zielrolle zuschneiden. |
| `#/training` | `training` | Skill-Lücken-Analyse → Curriculum. |
| `#/followup` | `followup` | Nach-Interview-E-Mail-Entwurf. |
| `#/batch` | `batch` | Multi-JD-Batch-Bewertungs-Prompt. |
| `#/contacto` | `contacto` | Outreach-Nachricht an einen Recruiter / eine Empfehlung. |
| `#/interview-prep` | `interview-prep` | One-Pager-Vorbereitung für eine bestimmte Interview-Runde. |
| `#/patterns` | `patterns` | „Welche Muster haben mich erfolgreich gemacht?" reflektierende Analyse. |

### Gemeinsame Form

Jede Seite hat ein kleines Formular (die Felder sind modusspezifisch),
eine Schaltfläche **▶ Generate prompt** (manuell) und — wenn ein
Anthropic- oder Gemini-Schlüssel vorhanden ist — eine Schaltfläche
**⚡ Run live**, die zur primären wird.

Ein Klick auf **▶ Generate prompt** gibt den zusammengesetzten Prompt
zurück, wobei Ihre Formularwerte als JSON in einen `User-supplied
context:`-Block gebracht werden, gefolgt von der wortgetreuen
`modes/<slug>.md`-Vorlage. Kopieren und in Ihr bevorzugtes LLM einfügen.

Ein Klick auf **⚡ Run live** sendet denselben Prompt an Anthropic (oder
Gemini), mit `cv.md` + `profile.yml` + `_shared.md` inline über
`bundleProjectContext`. Das Ergebnis wird auf der Seite gerendert, ist
kopierbar und als `.md` herunterladbar.

Die sieben Seiten sind eine explizite Allowlist — Modi, die eine eigene
Route haben (`oferta` → Evaluate, `deep` → Deep research), und Modi, die
das übergeordnete Projekt nur innerhalb von Claude Code unterstützt
(`apply`, `scan`, `pipeline`, `tracker`, `pdf`, `latex`, `ofertas`,
`auto-pipeline`), bleiben bewusst von dieser UI fern.

---

## 14. Apply checklist (`#/apply`)

Sobald Sie sich zu einer Bewerbung entschieden haben, generiert diese
Apply-Helfer-Seite eine Einreichungscheckliste für den eigentlichen
Bewerbungsschritt. Sie füllt **NICHT** automatisch Formulare aus — dieser
Ablauf bleibt in `/career-ops apply` innerhalb von Claude Code, das
Playwright im übergeordneten Projekt verwendet.

### SPA-Checklisten-Modus (`#/apply`)

Die Checkliste der SPA ist für Benutzer, die das Formular lieber von Hand
ausfüllen, ohne Playwright aufzurufen. Sie deckt ab:

0. Führen Sie `/career-ops apply <url>` in Claude Code aus, um das
   Formular über Playwright zu lesen (überspringen Sie diesen Schritt,
   wenn Sie von Hand ausfüllen).
1. Überprüfen Sie, dass die Ausschreibung noch aktiv ist
   (`check-liveness.mjs`).
2. Bestätigen Sie, dass das CV das neueste ist (`cv-sync-check.mjs`, dann
   PDF, wenn Score ≥ 4.0).
3. Schneiden Sie das Anschreiben / die „Why us?"-Antwort mit STAR+R-
   Proof-Points aus `cv.md` zu.
4. Beantworten Sie EEO-/Sponsorship-/Startdatum-Fragen wahrheitsgemäß.
5. Speichern Sie die ausgefüllten Antworten in
   `interview-prep/{company}-{role}.md` vor dem Absenden.
6. **NIEMALS automatisch absenden** — Sie (der Mensch) klicken auf die
   endgültige Schaltfläche.
7. Nach dem Absenden: fügen Sie eine Zeile zu `data/applications.md` hinzu
   (oder schreiben Sie TSV nach `batch/tracker-additions/`).

### Manuelles Ausfüllen vs. Playwright-unterstützt

Zwei Wege für die eigentliche Einreichung:

- **Manual** — öffnen Sie die Karriereseite in einem normalen Browser-
  Tab, folgen Sie der obigen SPA-Checkliste, kopieren/fügen Sie Antworten
  ein. Kein Playwright nötig. Verwenden Sie es, wenn das Formular kurz ist
  oder Sie Chromium nicht installiert haben.
- **Playwright-unterstützt** — führen Sie `/career-ops apply <company>` in
  Claude Code (übergeordnetes Projekt) aus. Playwright öffnet seinen
  eigenen Browser, liest jedes Formularfeld, gibt nummerierte Antwort-
  Entwürfe zurück. Sie klicken weiterhin auf Absenden. Verwenden Sie es,
  wenn das Formular lang, dynamisch ist oder Sie die Prüfspur wollen,
  welche Fragen welche Antworten hatten.

### Vollständiger CLI-Apply-Ablauf ([apply-for-a-job](https://career-ops.org/docs/introduction/guides/apply-for-a-job))

**Voraussetzungen:**

1. Führen Sie zuerst `/career-ops pipeline` aus, sodass die JD einen
   Bewertungsreport unter `reports/` hat. Der Apply-Befehl hängt von
   einer vorhandenen Bewertung ab; ohne eine führen Sie zunächst die
   Pipeline aus.
2. Haben Sie den Report und das Profil geladen.
3. **Empfohlen:** Playwright installiert
   (`npx playwright install chromium` — siehe Playwright-Einrichtung
   unten). Fällt auf WebFetch zurück (nur-Text-Formular-Vorschau, kein
   Klick-Ausfüllen), wenn es fehlt.

**Nummerierter Ablauf** (kanonische 8 Schritte):

1. **Führen Sie den Befehl** mit dem Unternehmensnamen aus:

   ```
   /career-ops apply <company>
   ```

   Beispiel: `/career-ops apply Anthropic`. Ohne ein Argument liefern Sie
   im nächsten Zug einen Screenshot des Formulars, den eingefügten
   Formulartext oder die Bewerbungs-URL.

2. **Finden Sie den Report.** Das System findet die passende Bewertung in
   `reports/` (die, die zuvor von `/career-ops pipeline` oder
   `#/evaluate` erstellt wurde).

3. **Öffnen Sie das Formular.** Playwright startet ein Browser-Fenster
   **automatisch** — Sie öffnen es NICHT selbst.

4. **Lesen Sie die Felder.** Das System liest und parst jedes
   Formularfeld (Label, Typ, erforderlich, Optionen für Auswahlen).

5. **Generieren Sie Antworten.** career-ops erstellt maßgeschneiderte
   Antworten für jedes Feld basierend auf Ihrem Profil, den Proof Points
   und der Rolle.

6. **Geben Sie eine nummerierte Liste zurück.** Sie erhalten Antworten,
   geordnet passend zum Formularlayout — einfache Felder (Name, E-Mail)
   zuerst, Freitextfelder (Anschreiben, „Why us?") zuletzt. Markierte
   Punkte weisen auf Dinge hin, die menschliche Aufmerksamkeit benötigen —
   Gehaltsanker, fehlende Lebenslauf-Details, optionale Fragen.

7. **Manuelles Ausfüllen.** Sie kopieren jede Antwort und fügen sie in das
   entsprechende Feld ein. Dieser Schritt ist manuell, nicht
   automatisiert. Sie überprüfen jede Antwort zuerst.

8. **Der Benutzer reicht ein.** Sie klicken selbst auf Absenden.
   career-ops klickt **niemals** auf Absenden. Bestätigen Sie den
   Abschluss, indem Sie in den Chat tippen:

   ```
   Submitted.
   ```

**Automatische Aktualisierungen bei `Submitted.`:**

- Der Status wechselt `Evaluated → Applied` in `data/applications.md`.
- Die ausgefüllten Antworten bleiben in Abschnitt G des Reports für
  zukünftige Referenz erhalten.

**Übergabe an den Tracker:**

```
/career-ops tracker
```

Überwachen Sie den Status Ihrer gesamten Pipeline, unabhängig vom
Rollen-Score.

### Batch-Bewertung ([batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers))

Wenn Sie 10+ JDs auf einmal zu bewerten haben (die
Eine-nach-der-anderen-`#/evaluate`-Seite der SPA ist für dieses Volumen
unpraktisch), verwenden Sie den Batch-Runner von der CLI.

**Eingabedatei — `batch/batch-input.tsv`** (tabgetrennt):

| Spalte | Zweck |
|---|---|
| `id` | Eindeutige fortlaufende Nummer |
| `url` | Vollständiger Stellenausschreibungs-Link |
| `source` | Ursprungsplattform (LinkedIn, Greenhouse usw.) |
| `notes` | Optionales Kontextdetail |

Beispielzeile:

```
1<TAB>https://jobs.example.com/senior<TAB>LinkedIn<TAB>
```

**`./batch/batch-runner.sh`-Flags:**

- `--dry-run` — Vorschau ausstehender Angebote ohne Bewertung. Führen Sie
  dies immer zuerst aus, um das TSV zu validieren.
- `--parallel N` — N Worker gleichzeitig ausführen (1, 2 oder 3
  empfohlen).
- `--min-score X.X` — Angebote unterhalb der Schwelle nicht
  persistieren. Nützlich, um nur Reports für gut passende Rollen zu
  behalten.
- `--retry-failed` — Nur die Angebote erneut verarbeiten, die beim
  vorherigen Lauf fehlgeschlagen sind (Netzwerkfehler, Rate-Limits).
- `--max-retries N` — Fehlgeschlagene Angebote bis zu N Mal versuchen
  (Standard: 2).
- `--model NAME` — Claude-Modell, das an `claude -p --model` übergeben wird (parent career-ops 1.8.0, #504). Nicht gesetzt = Ihr Claude-Max-Abonnement-Standard. Verwenden Sie ein günstigeres Modell für große Batches, z. B. `claude-sonnet-4-6`. In `#/batch` als **Model**-Eingabe angezeigt (web-ui 1.31.0).
- `--start-from N` — Angebots-IDs unter N überspringen (einen teilweise verarbeiteten Batch fortsetzen). In `#/batch` als **Start from #**-Eingabe angezeigt (web-ui 1.31.0).

**Standard-Sequenz:**

1. **Bearbeiten** Sie `batch/batch-input.tsv` — eine Zeile pro JD.

2. **Dry-run** (empfohlen zuerst):

   ```bash
   ./batch/batch-runner.sh --dry-run
   ```

3. **Ausführen** — sequenziell oder parallel:

   ```bash
   ./batch/batch-runner.sh                       # one at a time
   ./batch/batch-runner.sh --parallel 2          # two concurrent
   ./batch/batch-runner.sh --parallel 3          # three concurrent
   ./batch/batch-runner.sh --parallel 2 --min-score 4.0  # only persist high-fit
   ```

4. **Fehler erneut versuchen** (Netzwerk / Rate-Limit):

   ```bash
   ./batch/batch-runner.sh --retry-failed --max-retries 3
   ```

5. **Reports** landen in `reports/` als
   `{id}-{company}-{YYYY-MM-DD}.md`. Zusammenfassungszeilen werden an
   `batch/tracker-additions/` angehängt.

6. **In den Tracker zusammenführen:**

   ```bash
   node merge-tracker.mjs                 # apply the batch additions
   node merge-tracker.mjs --dry-run       # preview the merge
   ```

   Der Merge-Befehl dedupliziert Einträge und archiviert verarbeitete
   Dateien nach `batch/tracker-additions/merged/`.

Die SPA zeigt die resultierenden Reports unter `#/reports` (paginiert,
Score-Pill-farbcodiert) und die Tracker-Zeilen unter `#/tracker` — genau
so, als hätten Sie jede über `#/evaluate` hinzugefügt. Kombinieren Sie es
mit der Wartungs-Schaltfläche **▶ Merge** auf `#/tracker`, wenn Sie lieber
nicht in die CLI wechseln möchten.

### Playwright-Einrichtung ([set-up-playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright))

Erforderlich für zwei career-ops-Funktionen:

- **Formularausfüllen** in `/career-ops apply` (Schritt 3 oben —
  Playwright öffnet den Browser, liest Feldbeschriftungen, schlägt
  Antworten vor).
- **PDF-Generierung** über `/career-ops pdf` und die Schaltfläche
  **📄 Generate PDF** der SPA auf `#/cv` / `#/reports/:slug` /
  `#/evaluate` / `#/deep` / `#/interview-prep`.

**Fallback, wenn Playwright fehlt:** der Apply-Ablauf fällt auf WebFetch
zurück (nur-Text-Formular-Vorschau, kein Klick-Ausfüllen). Die
PDF-Generierung schlägt einfach fehl.

**Kern-Einrichtung (vom übergeordneten career-ops-Stammverzeichnis aus ausführen):**

```bash
# Install Chromium for Playwright
npm install
npx playwright install chromium

# Register the Playwright MCP so Claude Code can drive forms
claude mcp add playwright npx @playwright/mcp@latest

# Verify all three components (Chromium, Playwright lib, MCP)
npm run doctor
```

**Alternative MCP-Registrierung** — hinzufügen zu
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

**Verhaltenshinweise:**

- **Standardmäßig headless.** Playwright arbeitet still. Um den Browser
  in Aktion zu sehen, sagen Sie Claude `open up with playwright the browser
  and fill out the entire form.`
- **Drei Rollen in einem Paket** — die Playwright-npm-Installation gibt
  Ihnen die Browser-Automatisierungsbibliothek, die PDF-Rendering-Engine
  für `/career-ops pdf` und (über den MCP) den Formularausfüll-Workflow
  innerhalb von Claude Code.
- **Überprüfen, bevor Sie sich darauf verlassen** — `npm run doctor`
  bestätigt, dass alle drei betriebsbereit sind. Die Health-Seite der SPA
  zeigt eine `Playwright (parent node_modules)`-Prüfung an, die schnell
  fehlschlägt, wenn es fehlt.

---

## 15. Interview-Vorbereitung

Dies ist die Post-Research-, Pre-Interview-Phase. Drei Artefakte in dieser
App laufen zusammen:

1. **Gespeicherte Deep-Research-Dateien** unter `interview-prep/`, eine
   pro Unternehmen-Rolle-Paar, das Sie ausgeführt haben. Durchsuchen Sie
   von der **Deep research**-Seite oder direkt über
   `/api/interview-prep`.
2. **Patterns-Modus** (`#/patterns`) — generiert einen selbstreflektiven
   Prompt: „über meine letzten N Interviews / Angebote / Absagen hinweg,
   welche Muster gelten?" Nützlich, wenn Sie 5+ Tracker-Zeilen angesammelt
   haben.
3. **Interview-prep-Modus** (`#/interview-prep`) — füllt einen One-Pager
   für eine bestimmte anstehende Runde vor (Behavioral, Technical, System
   Design). Die Ausgabe geht in denselben `interview-prep/`-Ordner.

### Empfohlener Workflow

Für jedes Interview, das Sie im Kalender haben:

1. **Führen Sie Deep erneut aus** (oder öffnen Sie die gespeicherte Datei)
   am Tag zuvor.
2. **`#/interview-prep`** — generieren Sie einen One-Pager für die
   bestimmte Runde. In Ihre Notizen einfügen.
3. **System-Design- / Coding-Runden** — öffnen Sie `#/training` und bitten
   Sie um eine 30-minütige gezielte Auffrischung zum jeweiligen
   Teilsystem, das die JD betont.
4. **Vergütungsrunden** — öffnen Sie die Deep-Research-Datei, springen Sie
   zu „Negotiation leverage points". Bringen Sie 2–3 bestimmte
   Datenpunkte mit (Glassdoor-Band, jüngste Finanzierung, vergleichbares
   Angebot bei einem anderen Unternehmen).
5. **Behavioral-Runden** — ziehen Sie STAR+R-Geschichten aus Ihrem
   `cv.md`, die in Abschnitt B des ursprünglichen Evaluate-Reports landen.

Nach dem Interview sofort:

1. Aktualisieren Sie die Tracker-Zeile: Status → `Responded` (dann
   `Interview`, `Offer` usw.).
2. Führen Sie `#/followup` aus, um die Dankes-E-Mail zu entwerfen.
3. Wenn Sie neue Informationen erhalten haben (Vergütungsspanne,
   Teamzusammensetzung, Tech-Stack-Überraschung), bearbeiten Sie die
   gespeicherte `interview-prep/<company>-<role>.md` mit
   `## Post-round notes`, sodass Ihr zukünftiges Ich es hat.

---

## 16. Activity log + Fehlerbehebung

### Activity log (`#/activity`)

Prüfspur jeder zustandsverändernden Anfrage, die den Server trifft.
Erfasst: Pipeline-Ergänzungen, Tracker-Schreibvorgänge, CV-Speicherungen,
JD-Speicherungen, Evaluate-Läufe, Deep-Research-Läufe, Scan-Läufe,
Konfigurationsänderungen, Modus-Läufe.

Geheimnisse (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) werden beim Eingang
redigiert; Sie werden in `data/activity.jsonl` nie einen echten
Schlüsselwert sehen.

Filtern Sie nach Aktionspräfix (`pipeline.`, `cv.`, `evaluate`, `scan.`
usw.). 25 Zeilen pro Seite; der Server gibt bis zu 500 der neuesten
Ereignisse zurück.

### Fehlerbehebung

| Symptom | Wahrscheinliche Ursache | Behebung |
|---|---|---|
| Health-Seite rot bei `cv.md` | Erster Start, Datei existiert noch nicht | `touch $CAREER_OPS_ROOT/cv.md`, dann aktualisieren. |
| Health rot bei `Profile customized` | `candidate.full_name` sagt noch `Jane Smith` | `config/profile.yml` bearbeiten. |
| `hh.ru: HTTP 403` im Scan-Log | Nicht-russische IP, kein `(server uses default UA)` | Unter `dev.hh.ru/admin` registrieren, eine russische IP / ein VPN setzen. |
| `gemini-eval.mjs: ERR_MODULE_NOT_FOUND` | Deps des übergeordneten Projekts nicht installiert | `cd $CAREER_OPS_ROOT && npm install`. |
| Generate PDF schlägt fehl | Playwright nicht im übergeordneten Projekt installiert | `cd $CAREER_OPS_ROOT && npx playwright install chromium`. |
| `/career-ops apply` sagt „no report found" | Pipeline hat diese JD nie bewertet | Zuerst `/career-ops pipeline` (oder `#/evaluate`) ausführen; siehe §14-Voraussetzungen. |
| `batch-runner.sh: no such file` | Aus falschem Verzeichnis ausgeführt | `cd $CAREER_OPS_ROOT` vor dem Aufruf von `./batch/batch-runner.sh`. |
| Server meldet `EADDRINUSE: 4317` | Alte Instanz läuft noch | `pkill -f 'node server/index.mjs'`, dann neu starten. |
| Live-LLM-Aufruf hängt > 2 min | Prompt riesig oder Anthropic langsam | Prüfen Sie das Anthropic-Flag von `/api/health`; der Server begrenzt Prompts weich bei 200 KB und gibt 413 zurück. |
| Pipeline-Vorschau zeigt `(unsafe redirect)` | Ausschreibung leitet zu einer privaten IP / Loopback um | Dies ist eine Sicherheitsfunktion (REVIEW-B1). Das Umleitungsziel wird abgelehnt und die ursprüngliche URL bleibt unverändert. |
| Tracker-Zeilentext bricht die Tabelle | Pipe im Unternehmensnamen vor v1.9.1 | Auf v1.9.1+ aktualisieren — Pipes werden durchgängig escaped (BF-1). |
| `npm test` schlägt bei frischem Klon fehl | Tests setzen das Layout des übergeordneten Projekts voraus | `CAREER_OPS_ROOT=$(mktemp -d)` verwenden und Fixtures bootstrappen. |

Für tiefere Diagnostik: führen Sie **▶ Doctor** auf der Health-Seite aus,
kopieren Sie die Ausgabe und durchsuchen Sie den Issue-Tracker unter
<https://github.com/Fighter90/career-ops-ui/issues>.


---

## 17. So fügen Sie eine neue Jobportal-Quelle hinzu

career-ops-ui behandelt jedes Job-Board als **Adapter** — eine einzelne Datei unter [`server/lib/sources/<slug>.mjs`](../../server/lib/sources/), die weiß, wie man die Ergebnisse eines Boards abruft + normalisiert. Aktuell liefert die `server/lib/sources/`-Registry **85** Adapter — **80 englische + 5 russische** Boards. Das englische Set umfasst die großen ATSes (Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday), board-weite Aggregatoren, die per explizitem `provider:` ausgewählt werden (RemoteOK, Remotive, We Work Remotely, NoDesk, Get on Board, Amazon, …), sowie Per-Mandant-ATSes, die automatisch aus einem `careers_url`-Host oder einer expliziten `api:`-URL erkannt werden (BambooHR, Personio, Recruitee, Teamtailor, Avature, SAP SuccessFactors, …). **Die vollständige Liste muss hier niemals von Hand gezählt werden — sie wird automatisch aus `server/lib/sources/` ermittelt und live im Source-Dropdown von `#/scan` angezeigt.** Siehe §5 für das YAML und `docs/portals-examples.md` für Kopier-Einfüge-Einträge.

> **v1.69.0 (P-14) — Drop-in-Auto-Discovery.** Das Hinzufügen einer 12. Quelle ist
> jetzt ein **reines Datei-Ablegen**. Die Registry
> ([`server/lib/sources/registry.mjs`](../../server/lib/sources/registry.mjs))
> hält keine handgepflegte Liste mehr — beim Boot scannt sie diesen Ordner
> (`readdirSync` + dynamisches `import()`) und sammelt den `export const meta`-
> Block aus jeder `*.mjs`. Schreiben Sie den Adapter, deklarieren Sie sein `meta`,
> und es ist sofort für den Scanner, das `#/scan`-Filter-Dropdown und den RU-
> Dispatcher sichtbar — **keine Bearbeitung von `registry.mjs` erforderlich**. (RU-Quellen
> benötigen weiterhin eine Zeile in der `portals.yml` des übergeordneten Projekts; siehe Schritt 5.)

### Schritt 1 — Den Adapter schreiben

Erstellen Sie `server/lib/sources/<slug>.mjs`. Zwei Muster funktionieren, je
nachdem, ob die Quelle eine JSON-API hat oder nur HTML rendert:

**API-gestützte Quelle** (am saubersten — verwenden Sie dies immer, wenn die
Site einen offenen Datenendpunkt hat):

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

**HTML-Scrape-Quelle** (wenn es keine API gibt — siehe
[`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) und
[`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) für vollständige Beispiele):

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

Drei Verträge, die jeder Adapter EINHALTEN MUSS:

- **Exportieren Sie einen gültigen `meta`-Block** (siehe Schritt 2). Ohne
  ihn überspringt die Registry die Datei stillschweigend (ein
  `console.warn` beim Boot), und die Quelle erscheint nie.
- **Akzeptieren Sie `{ onlyRemote, fetchImpl, signal }` in `opts`.**
  `fetchImpl` ist das, was Adapter ohne Netzwerk testbar macht; `signal`
  ist für die Weiterleitung von Client-Trennungen erforderlich (REVIEW-B3).
- **Geben Sie Datensätze mit der gemeinsamen Form zurück** —
  `{ id, title, company, url, salary, location, isRemote, workplaceType,
  relocates, date, snippet, source }`, wobei `source` mit dem
  `meta.value` übereinstimmt.

### Schritt 2 — Das `meta` des Adapters deklarieren (Auto-Registrierung)

Das ist der gesamte Registrierungsschritt. **Sie bearbeiten `registry.mjs`
nicht.** Stellen Sie einfach sicher, dass der Adapter einen `meta`-Block
exportiert — die Registry entdeckt ihn automatisch beim Boot:

```js
// at the top of server/lib/sources/example.mjs
export const meta = {
  value: 'example',          // job.source value AND #/scan option.value
  label: 'Example.com',      // display label in the dropdown
  region: 'ru',              // 'en' | 'ru'
  configKey: 'example',      // RU only — key in portals.yml::russian_portals.sources
};
```

Wie die Discovery es validiert (eine Datei, die eine Regel nicht erfüllt,
wird übersprungen, mit einer `[sources/registry]`-Warnung, sodass ein
halb-migrierter Branch diagnostizierbar bleibt):

- `value` — nicht-leere Zeichenkette. MUSS mit `job.source` aus Ihrem
  Adapter übereinstimmen.
- `label` — nicht-leere Zeichenkette.
- `region` — genau `'en'` oder `'ru'`; alles andere wird abgelehnt.
- `configKey` — **erforderlich** für `region: 'ru'`, ignoriert für `'en'`.

`region: 'en'` schließt sich dem ATS-Durchlauf an (erkennt automatisch aus
den `tracked_companies`-URL-Mustern); `region: 'ru'` schließt sich dem
regionalen Dispatcher an. Die öffentliche API
(`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`, `getRegionalSources`)
wird aus jedem entdeckten `meta` neu aufgebaut, geordnet `en` zuerst, dann
`ru`, alphabetisch nach Label innerhalb jeder Region — sodass die
Dropdown-Reihenfolge für die Benutzer stabil bleibt.

### Schritt 3 — In den Dispatcher einbinden (nur RU)

EN-ATS-Quellen erkennen automatisch aus den `tracked_companies`-URL-Mustern
— keine weitere Verdrahtung nötig. Für RU-Quellen öffnen Sie
[`server/lib/ru-scanner.mjs`](../../server/lib/ru-scanner.mjs), finden Sie
die `RU_DISPATCH`-Tabelle und fügen Sie eine Zeile hinzu:

```js
import { searchExample } from './sources/example.mjs';
// …
const RU_DISPATCH = {
  // …existing…
  example: { label: 'example.com', search: searchExample },
};
```

Die Dispatcher-Schleife ruft `entry.search(query, opts)` für jeden
Schlüssel auf, der in `cfg.sources` vorhanden ist. Keine weitere
Code-Änderung nötig.

### Schritt 4 — Testen (gemockt, niemals live)

Legen Sie eine Datei unter `tests/sources-<slug>.test.mjs` ab. Echtes
Netzwerk ist in Tests **verboten** (CI-Isolationsvertrag):

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

### Schritt 5 — In Ihrer `portals.yml` aktivieren

Die `portals.yml` des übergeordneten Projekts ist die benutzereigene
Konfiguration. Fügen Sie den `configKey` der neuen Quelle zum Array hinzu:

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

Laden Sie `#/scan` im Browser neu. Das Quellenfilter-Dropdown nimmt den
neuen Eintrag automatisch auf (einzige Wahrheitsquelle über
[`GET /api/scan/sources`](../../server/lib/routes/scan.mjs) →
[`registry.mjs`](../../server/lib/sources/registry.mjs)). Die
🌐 Scan-Schaltfläche schließt die neue Quelle nun bei jedem regionalen
Durchlauf ein.

### Referenz-Adapter (spiegeln Sie diese für neue Quellen)

| Adapter-Datei | Typ | Hinweise |
|---|---|---|
| [`hh.mjs`](../../server/lib/sources/hh.mjs) | JSON API | Kanonischer RU-API-Adapter; geo-bewusster UA-Fallback. |
| [`trudvsem.mjs`](../../server/lib/sources/trudvsem.mjs) | JSON API | Russische Regierungs-Open-Data; kein IP-Gate. |
| [`habr.mjs`](../../server/lib/sources/habr.mjs) | HTML scrape | Russisches Tech-Board; regex-basierter Card-Parser. |
| [`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) | HTML scrape | Defensiver Parser, `[]` bei Parse-Miss. |
| [`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) | HTML scrape | Gleicher defensiver Stil wie GetMatch. |
| [`greenhouse.mjs`](../../server/lib/sources/greenhouse.mjs) | JSON API | Kanonischer EN-ATS-Adapter; verwendet das `tracked_companies`-URL-Muster. |

### Häufige Fallstricke

- **Den `meta`-Export vergessen.** Seit v1.69.0 ist der `meta`-Block das
  *einzige*, was eine Quelle registriert. Kein `meta` (oder ein
  fehlerhaftes) = die Datei wird beim Boot stillschweigend übersprungen
  mit einer einzelnen
  `[sources/registry] <file> has no valid \`export const meta\` — skipped`-
  Warnung, und die Quelle erreicht nie das Dropdown. Prüfen Sie das
  Server-Log, wenn ein brandneuer Adapter nicht auftaucht.
- **`source`-Feld-Diskrepanz.** Die von Ihrem Adapter geschriebene
  Zeichenkette MUSS exakt mit dem `meta.value` übereinstimmen. Wenn sie
  auseinanderdriften, zeigt das `#/scan`-Filter-Dropdown die Quelle an,
  aber ihre Auswahl filtert jede Zeile heraus (weil die
  Gleichheitsprüfung `r.source === fs` ist).
- **Bei Parse-Fehler werfen.** HTML-Scraper MÜSSEN `[]` bei einem gesunden
  200 ohne parsebare Cards zurückgeben. Werfen bricht die
  Multi-Source-Dispatcher-Schleife — eine schlechte HTML-Struktur tötet
  jede andere Quelle für dieselbe Query.
- **`fetchImpl` / `signal` vergessen.** Ohne sie kann Ihr Adapter nicht
  unit-getestet werden, ohne das Live-Netzwerk zu treffen, und
  Client-Trennungen propagieren nicht (der Hintergrund-Fetch bleibt am
  Leben, nachdem der Benutzer den Tab geschlossen hat).
- **`tracked_companies` für RU vertrauen.** Diese Liste ist nur für
  EN-ATS-Quellen. RU-Adapter treiben sich selbst aus
  `russian_portals.queries` an — keine Einträge pro Unternehmen.

---

## 18. Notifications (🔔 in der oberen Leiste)

> v1.58.34 — jeder Toast, der in der unteren rechten Ecke erscheint, wird auch
> in einem In-Memory-Journal erfasst (Obergrenze 50, ältester verworfen). Klicken
> Sie auf die 🔔-Glocke in der oberen Leiste, um die von rechts einfahrende
> **Notifications**-Schublade zu öffnen und alles erneut zu lesen, was Sie
> verpasst haben. Das Journal ist pro Tab, pro Sitzung — das Schließen des Tabs
> leert es.

Die Schublade **öffnet sich nur, wenn Sie auf die Glocke klicken** (oder sie mit
Enter / Space aktivieren, wenn sie den Tastaturfokus hat). Sie erscheint nie von
selbst. Das rote Abzeichen auf der Glocke zählt Einträge, die Sie seit dem letzten
Öffnen nicht gesehen haben; das Öffnen der Schublade löscht das Abzeichen.

### Benachrichtigungskategorien

| Kategorie | Wann sie ausgelöst wird | Visueller Hinweis |
|---|---|---|
| **Success** | `Saved`, `Copied`, `Refreshed`, Scan abgeschlossen, CV importiert, Apply-Checklisten-Aktionen („Copied unchecked", „Reset"), Profil gespeichert, Pipeline-URL hinzugefügt | grüner linker Rand in der Schublade; grüner Toast-Hintergrund |
| **Error** | URL-Validierungsfehler (muss mit `http://` / `https://` beginnen, keine Skript-/Vorlagen-Zeichen), API-Fehler mit dem `(METHOD /path · HTTP NNN)`-Postfix, Netzwerkfehler (Server ausgefallen), Pipeline-400-Duplikate, doctor / verify-pipeline Nicht-Null-Exit | roter linker Rand; roter Toast-Hintergrund; technisches Postfix in den `Details`-`<details>`-Block gesteckt (U-4 / v1.58.24) |
| **Info / progress** | `Running doctor.mjs…`, `Running verify-pipeline.mjs…`, `Refreshing…`, `Loading…`, `Generating prompt…`, Scan-Fortschrittszeilen | grauer linker Rand; Standard-Toast-Hintergrund |

Jeder Schubladeneintrag zeigt:

- **Timestamp** (`HH:MM:SS`, lokalisiert zur aktiven SPA-Sprache).
- **Message** (der menschliche Satz, mit dem technischen Postfix aus der Überschrift entfernt gemäß U-4).
- **Details** (wenn vorhanden — das `(METHOD /path · HTTP NNN)`-Postfix des API-Aufrufs oder jede andere technische Anmerkung, Monospace).

### Was KEINE Benachrichtigung ist

- Das Doctor- / verify-pipeline-**Ergebnis-Modal** (voller stdout / stderr) — das ist ein Modal, kein Toast, und wird nicht journalisiert.
- SSE-Log-Zeilen auf `#/scan` und `#/auto` — die streamen in den Seitenkörper, nicht in die Toast-Pipeline.
- Nur-Spinner-Ladezustände (die verwenden `UI.withSpinner` ohne einen Toast).

### Tastatur

- **Klick** oder Fokus + **Enter / Space** auf der Glocke → öffnet die Schublade.
- **Esc**, Klick auf die **×**-Schließen-Schaltfläche oder erneuter Klick auf die Glocke → schließt die Schublade; der Fokus kehrt zur Glocke zurück.
- **Tab** bei geöffneter Schublade → bewegt sich durch die Schließen-Schaltfläche und alle fokussierbaren Details darin; die Schublade ist `aria-modal="false"`, sodass Tab nicht einfängt (Sie können weiterhin den Rest der Seite erreichen).


## 19. Die App in Ihre Sprache lokalisieren

Die Oberfläche wird in 17 Sprachen ausgeliefert (English, Español, Français, Português, 한국어, 日本語, Русский, 简体中文, 繁體中文, Polski, Українська, Dansk, العربية, Deutsch, Italiano, Türkçe, हिन्दी). Jede Bildschirmbeschriftung stammt aus einem Übersetzungswörterbuch, und Sie können eine Sprache hinzufügen oder korrigieren, ohne die App-Logik zu berühren.

**Wo die Übersetzungen leben.** Seit v1.60.0 ist jede Sprache ihre eigene Datei unter `public/js/lib/locales/` — `i18n-dict.en.js`, `i18n-dict.es.js`, `i18n-dict.ru.js` und so weiter — eine einfache Liste von `'key': 'text'`-Paaren. Ein gemeinsames `i18n-dict.aliases.js` lässt Schlüssel, die immer identisch lauten müssen (eine Seitenleistenbeschriftung und ihr Seitentitel), auf eine Übersetzung zeigen. `i18n-dict.js` führt sie alle beim Laden der Seite zusammen; Sie bearbeiten es nie.

**Eine Phrase korrigieren oder hinzufügen.** Öffnen Sie die Datei für Ihre Sprache, finden Sie den Schlüssel (z. B. `'nav.scan'`) und bearbeiten Sie den Text. Um eine brandneue Beschriftung hinzuzufügen, fügen Sie denselben Schlüssel zu **allen 8** Sprachdateien mit dem übersetzten Wert hinzu und referenzieren Sie ihn dann in der Seite über `t('your.key')`. Führen Sie `npm test` aus — es schlägt fehl, wenn einer Sprache der Schlüssel fehlt, sodass nichts halb übersetzt ausgeliefert wird.

**Eine ganz neue Sprache hinzufügen.** Kopieren Sie `i18n-dict.en.js` nach `i18n-dict.<code>.js`, übersetzen Sie jeden Wert und registrieren Sie dann den Code in `i18n.js` (die Sprachliste + die Browser-Auto-Erkennung), im `i18n-dict.js`-Assembler und fügen Sie eine `<script>`-Zeile in `index.html` hinzu. Die vollständige Checkliste — einschließlich des Test-Snapshots und der Hilfe-/README-Begleitdateien — steht in `docs/LOCALIZATION.md`.

**Gut zu wissen.** Der Sprachumschalter befindet sich in der Fußzeile der Seitenleiste; Ihre Wahl wird pro Browser gemerkt. Server-Diagnosemeldungen bleiben absichtlich auf Englisch (damit Logs konsistent lesbar sind) — nur die Bildschirmoberfläche wird übersetzt.

Siehe **`docs/LOCALIZATION.md`** im Repository für die vollständige, Schritt-für-Schritt-Lokalisierungsanleitung.

## 20. Statistik nach Zielrollen (`#/stats`)

Die Seite **Analytics → Zielrollen-Statistik** verwandelt die spärlichen Daten, die deine Scans ohnehin sammeln, in ein Marktbild für die Rollen, auf die du tatsächlich abzielst: Anzahl der Stellen und Gehaltsniveaus nach Land sowie einen Trend, den du über die Zeit verfolgen kannst. Nichts wird erfunden: Sie aggregiert nur, was die Scanner gefunden haben, und ist ehrlich dazu, wie dünn die Stichprobe ist.

### Woher die Zahlen kommen

- **Zielrollen** werden aus deinem Profil (`config/profile.yml` → target roles) gelesen — nie fest einprogrammiert. Lege sie zuerst unter `#/profile` fest; ohne Rollen zeigt die Seite statt leerer Diagramme einen Hinweis „Lege deine Zielrollen fest“.
- **Die Anzeigen** stammen aus deinem letzten Scan (führe zuerst einen unter `#/scan` aus). Der Standort jeder Stelle wird einem Land zugeordnet (derselbe Detektor wie der Länderfilter im Scan), und ihr Gehaltsstring wird geparst und über eine ungefähre Wechselkurstabelle in **USD** normalisiert.
- Alles wird **in deinem Browser** aggregiert — keine Daten verlassen deinen Rechner, und das Einzige, was die Seite jemals schreibt, ist ein Snapshot, den du ausdrücklich speicherst.

### Die Diagramme lesen

- **Stellen nach Land** — wie viele passende Anzeigen in jedem Land liegen. Nutze die Filter **Rolle** und **Land** oben, um auf eine einzelne Zielrolle oder ein einzelnes Land einzugrenzen.
- **Median-Gehalt nach Land (USD)** — das mittlere geparste Gehalt je Land. Es zählen nur Anzeigen mit parsbarem Gehalt; die Stichprobengröße steht neben dem Diagramm, und die Beträge werden zu groben Kursen umgerechnet, lies es also als *Richtwert*, nicht als exakt. Ein bloßes `¥` (mehrdeutig zwischen japanischem Yen und chinesischem Yuan) wird verworfen statt geraten, um eine große FX-Verzerrung zu vermeiden.
- Wenn der aktuelle Scan keine parsbaren Gehälter hat, sagt das Gehaltsdiagramm das, statt Zahlen zu erfinden.

### Snapshots speichern & den Trend verfolgen

- Klicke auf **Snapshot speichern**, um das aktuelle Aggregat an `data/role-stats.jsonl` anzuhängen. Jeder Snapshot erhält serverseitig einen Zeitstempel; Snapshots sind das Einzige, was diese Seite schreibt, und sie rühren weder deinen Lebenslauf noch dein Profil an.
- Das **Trend**-Diagramm trägt die Stellenanzahl über deine gespeicherten Snapshots auf — speichere regelmäßig einen (zum Beispiel nach jedem wöchentlichen Scan), um zu beobachten, wie sich der Markt für deine Zielrollen über die Zeit bewegt.

## 21. Dein Zwei-Seiten-Papier — Passung Kandidat-Markt (`#/two-pager`)

Fast alles in career-ops-ui fragt „passt dieser Job zu meinem Lebenslauf?". Das **Zwei-Seiten-Papier** beantwortet die andere Hälfte: „passt dieser Job zu dem, was *ich wirklich will*?". Es ist dem **„Mnookin-Zwei-Seiten-Papier"** aus *Never Search Alone* nachempfunden — eine kurze Ich-Aussage darüber, was dir Energie gibt, was du forderst und was du nicht akzeptierst. Öffne es über **Einrichtung → Zwei-Seiten-Papier 🎯**.

**KI-Autofüllung + Export (v1.100).** Der "✨ KI-Ausfüllassistent" füllt jetzt alle Felder live aus deinem Lebenslauf (prüfen, dann Speichern); **👁 Vorschau und Export** rendert den Two-Pager und exportiert ihn als Markdown, PDF oder DOCX.

### Was du ausfüllst

- **Wer ich bin** — ein paar Ich-Sätze über deinen Werdegang und die Art von Rolle, in der du aufblühst.
- **Zielumfeld** — die Unternehmensgröße, -phase und -kultur, die du willst.
- Fünf Chip-Listen — tippe und drücke **Enter** (oder Komma), um jeden Eintrag hinzuzufügen, klicke auf **×**, um ihn zu entfernen:
  - **Was ich liebe** — Energiequellen (Remote, Eigenverantwortung, Greenfield, Mentoring…).
  - **Muss-Kriterien** — harte Anforderungen (eine Gehaltsuntergrenze, ein Land, ein Stack…).
  - **Was ich hasse** — Energieräuber (Rufbereitschaft, endlose Meetings, nur Legacy…).
  - **Ausschlusskriterien** — absolute Neins (nur vor Ort, kein Visa-Sponsoring, unter einer Zahl…).
  - **Nicht verhandelbar** — Grenzen (Standort, Remote, Gehaltsuntergrenze…).

Klicke auf **Zwei-Seiten-Papier speichern**, um es zu sichern. Es wird in die **Benutzerebene deines übergeordneten career-ops-Projekts** unter `config/two-pager.yml` geschrieben, also wird es — wie dein Lebenslauf und dein Profil — beim Aktualisieren des Systems **nie** überschrieben.

### Der KI-Ausfüllassistent

Nicht sicher, wie du es formulieren sollst? Klicke auf **✨ KI-Ausfüllassistent**. Er baut einen ausführbereiten Prompt (das Mnookin-Format, mit deinem Lebenslauf und Profil eingebettet) und zeigt ihn in einem Dialog. Führe diesen Prompt in einem beliebigen LLM aus und füge dann die resultierenden YAML-Felder zurück in das Formular ein. Der Assistent verwendet ausschließlich **deinen eigenen** Lebenslauf und dein Profil — er erfindet nie Fakten über dich, und von diesem Button aus wird kein Live-API-Aufruf ausgelöst.

### Der Passt-zu-deinen-Wünschen-Score

Sobald du ein Zwei-Seiten-Papier gespeichert hast, erhält jede Anzeige auf **`#/scan`** ein kleines **`◎ N`**-Abzeichen (0–100). Es vergleicht **Arbeitsform** (Remote/Hybrid/vor Ort), **Land**, **Gehaltsuntergrenze** und **Umzug** jedes Jobs mit deinem Zwei-Seiten-Papier — ein grünes Abzeichen bedeutet gute Passung, ein rotes bedeutet, dass ein Ausschlusskriterium ausgelöst wurde. Fahre mit der Maus darüber, um die Details zu sehen (✓ was passte, ✗ welches Ausschlusskriterium verletzt wurde).

Es ist bewusst ehrlich: wenn eine Anzeige **kein abgleichbares Signal** liefert (zum Beispiel, wenn deine Präferenzen alle Freitext sind, den eine Scan-Zeile nicht bestätigen kann), wird **überhaupt kein Abzeichen angezeigt** — das System erfindet nie eine Zahl. Die Verletzung eines harten **Ausschlusskriteriums** wiegt schwerer als ein weiches **Hassen** derselben Sache. Über das Abzeichen hinaus wird dein gespeichertes Zwei-Seiten-Papier in jede LLM-**Bewertung** eingebettet, sodass deine angegebenen Präferenzen auch das geschriebene Urteil prägen, nicht nur die Passung Lebenslauf-vs-Stellenanzeige.

## 22. Simuliertes Interview (`#/mock-interview`)

Die Interview-Vorbereitung zu lesen ist eine Sache; *die Antworten laut auszusprechen* eine andere. Die Seite **Simuliertes Interview** (öffne sie über **Interview-Vorbereitung → Simuliertes Interview 🎤** in der Seitenleiste) führt eine Runde-für-Runde-Probe gegen eine konkrete Stelle durch, verankert in deinem eigenen Lebenslauf, Profil, Zwei-Seiten-Papier und deiner Geschichtensammlung. Es ist keine Liste vorgefertigter Fragen — der Interviewer reagiert auf das, was du tatsächlich sagst.

### Eine Sitzung starten

- Gib eine **Zielrolle** ein (und optional ein **Unternehmen**). Füge auch die **Stellenbeschreibung** ein, falls du sie hast — die Fragen werden merklich schärfer.
- Klicke auf **Interview starten**. Der Interviewer eröffnet mit einer fokussierten Frage, zugeschnitten auf die Rolle und deinen Hintergrund.
- Tippe deine Antwort und klicke auf **Antwort senden**. Wiederhole es, so lange du möchtest — es ist ein Gespräch, kein festes Quiz.

### Was dir jede Runde gibt

Nach jeder Antwort antwortet der Interviewer mit drei Teilen:

- **Feedback** — was ankam (Stärken) und was fehlte, formuliert in **STAR+R**-Begriffen (Situation, Aufgabe, Aktion, Ergebnis, Reflexion). Es benennt die konkrete Dimension, die du ausgelassen hast.
- **Punktzahl** — ein schnelles `N/5` mit einer einzeiligen Begründung, damit du den Fortschritt über eine Sitzung hinweg spürst.
- **Nächste Frage** — eine Nachfrage, die gezielt den schwächsten Teil deiner letzten Antwort auslotet.

Alles ist in deinen echten Materialien verankert: `cv.md`, `config/profile.yml`, `config/two-pager.yml` und deine STAR+R-Geschichtensammlung (`interview-prep/story-bank.md`) werden alle in den Prompt eingebettet. Der Interviewer hakt bei echten Lücken nach, erfindet aber nie Erfahrung, die du nicht hast. Wenn kein LLM-Schlüssel gesetzt ist, gibt dir die Seite einen fertig ausführbaren Prompt zum Einfügen in einen beliebigen Assistenten — dasselbe ehrliche Ausweichmittel, das anderswo in der App verwendet wird.

### Sitzungen speichern und erneut aufrufen

Klicke auf **Transkript speichern**, um eine abgeschlossene Probe zu behalten. Es wird in die Nutzerschicht deines übergeordneten Projekts geschrieben, unter `interview-prep/mock-{company}-{role}-{date}.md`, sodass es neben deinen anderen Interview-Vorbereitungsnotizen liegt und nie durch Systemaktualisierungen überschrieben wird. Die Liste **Gespeicherte Sitzungen** am Ende der Seite lässt dich jedes Transkript erneut öffnen oder löschen. Nutze **Neues Interview**, um mit einer anderen Rolle von vorn zu beginnen.

## 23. Networking & tiefgehende Unternehmensrecherche (`#/networking`)

Sich durch die Vordertür zu bewerben ist nur die halbe Miete — die andere Hälfte ist, *jemanden zu kennen*, oder zumindest zu wissen, wen man ansprechen und was man sagen soll. Die Seite **Networking** (öffne sie über **Tiefenrecherche → Networking 🤝** in der Seitenleiste) verwandelt ein Unternehmen in einen konkreten Plan, um ein Vorstellungsgespräch zu bekommen — verankert in deinem eigenen Lebenslauf, deinem Profil und deinem Two-Pager.

### Einen Plan erstellen

- Gib ein **Unternehmen** (erforderlich) und optional eine **Rolle** sowie die **Stellenbeschreibung** ein. Die Stellenbeschreibung schärft die „Warum ich passe"-Aufhänger.
- Klicke auf **Plan erstellen**. Mit einem LLM-Schlüssel läuft es live und rendert den Plan direkt inline; ohne Schlüssel gibt es dir einen fertigen Prompt, den du in einen beliebigen Assistenten einfügen kannst (dasselbe ehrliche Fallback, das in der ganzen App verwendet wird — nichts wird erfunden).

### Was der Plan enthält

Der Plan kommt in vier Abschnitten zurück:

- **Unternehmensdossier** — ein knappes Briefing darüber, was das Unternehmen macht, aktuelle Signale, die es wert sind zitiert zu werden, und zwei oder drei „Warum ich passe"-Aufhänger aus deinem tatsächlichen Werdegang.
- **Wen kontaktieren** — drei bis fünf Ziel-Personas (der Hiring Manager des Teams, ein interner Recruiter, ein Senior Engineer im Team, ein warmer Kontakt oder eine Alumni-Verbindung) mit einer konkreten **LinkedIn-Suchzeichenfolge**, um jeden zu finden. Es erfindet niemals echte Namen — es sagt dir, wie du die richtigen Leute findest.
- **Wärmster Vorstellungsweg** — die einzelne realistischste warme Route hinein für *deinen* Werdegang: ein gemeinsamer Arbeitgeber, eine gemeinsame Schule oder Community; eine Verbindung zweiten Grades; oder eine Kaltnachricht mit hohem Signal, wenn das wirklich die beste Option ist.
- **Kontaktaufnahme-Entwürfe** — kurze, konkrete Nachrichten (drei bis fünf Sätze, ohne Füllwörter) für deine Top-Personas, verankert in deinen echten Belegen, damit sie nicht generisch wirken.

### Pläne speichern und erneut aufrufen

Klicke auf **Plan speichern**, um einen zu behalten. Er wird in der Nutzer-Ebene deines übergeordneten Projekts unter `networking/net-{company}-{role}-{date}.md` abgelegt — deine eigene Datei, die von System-Updates nie überschrieben wird. Über die Liste **Gespeicherte Pläne** unten auf der Seite kannst du jeden Plan wieder öffnen oder löschen. Da die Entwürfe und Personas nur auf deinen echten Materialien beruhen, behandle sie als starken ersten Entwurf zum Personalisieren — nicht als Skript, das du blind versendest.

## 24. CV Studio (`#/cv-studio`)

**Zum CV hinzufügen (v1.117.0).** Eine neue Karte verwandelt ein Projekt, eine Publikation oder eine Portfolio-Seite (URL oder eingefügter Text) in ATS-taugliche Stichpunkte, die NUR auf dieser Quelle beruhen — Kennzahlen, Arbeitgeber oder Daten, die nicht in der Quelle stehen, werden weggelassen, nie erfunden. Du prüfst die Vorschläge und fügst die akzeptierten selbst in den CV-Editor ein; nichts wird automatisch geschrieben, und URLs laufen durch denselben Anti-SSRF-Validator wie die Pipeline.

Auf der Seite `#/cv` *schreibst* du deinen Lebenslauf; im **CV Studio** (öffne es über **Setup → CV Studio 🎨** in der Seitenleiste) *schärfst* du ihn. Es gibt deiner `cv.md` drei ehrliche Werkzeuge an die Hand, von denen zwei deinen Browser nie verlassen.

**An einen Job anpassen (v1.101).** Füge eine Stellenbeschreibung ein, und CV Studio erstellt einen zugeschnittenen Lebenslauf plus ein passendes Anschreiben, geprüft durch ein recruitertaugliches Checklisten-Gate (Fehler blockieren, Warnungen raten), nur auf deinen Materialien basierend.

### Lebenslauf-Diagnose

Sobald du die Seite öffnest, bewertet sie deinen Lebenslauf auf einer Skala bis 100 und listet die Befunde pro Prüfung auf – jeder mit einer kurzen Erklärung, damit *du* entscheidest, was du änderst (sie schreibt nie stillschweigend um):

- **Länge** — liegt der Lebenslauf in einem gesunden Bereich von ein bis zwei Seiten?
- **Quantifizierte Wirkung** — welcher Anteil deiner Stichpunkte enthält eine echte Zahl oder Kennzahl? Recruiter überfliegen genau danach.
- **Starke Aktionsverben** — markiert schwache Formulierungen wie „verantwortlich für" oder „geholfen".
- **Buzzwords** — markiert leere Floskeln („ergebnisorientiert", „Teamplayer").
- **Kernabschnitte** — prüft auf Zusammenfassung, Erfahrung, Ausbildung und Fähigkeiten.
- **Kontaktdaten** — stellt sicher, dass eine E-Mail vorhanden ist.

Das läuft vollständig in deinem Browser ohne LLM — die Zahlen sind deterministisch, und nichts wird erfunden.

### Datenschutzmaske

Bevor du deinen Lebenslauf als Schreibprobe oder Screenshot teilst, schwärzt die **Datenschutzmaske** personenbezogene Daten: E-Mail, Telefon, Links/Handles und Anschrift, dazu deinen **Namen → Initialen**, wenn du das aktivierst und ihn eingibst. Schalte jede Kategorie um, kopiere die maskierte Version und teile sie sicher. Alles geschieht vollständig im Browser, meldet genau, wie viele Einträge geschwärzt wurden, und speichert oder überträgt das Original nie.

### Menschlich machen (Stimmabgleich)

Füge einen steifen Satz oder Absatz ein — die Art generischer KI-Formulierung, die wie Standardtext klingt — und **Menschlich machen** schreibt ihn in *deiner* Stimme um. Das Umschreiben ist serverseitig in deiner `voice-dna.md` (wie sich dein Schreiben liest) und deinen `writing-samples/` (deine echte Prosa) verankert. Die harte Regel: Es darf umsortieren, straffen und die Stimme anpassen, aber es wird **niemals** einen Fakt, eine Kennzahl oder eine Leistung einführen, die nicht bereits im eingefügten Text steht. Mit einem LLM-Schlüssel schreibt es live um; ohne Schlüssel gibt es dir einen fertigen Prompt zum Einfügen in einen beliebigen Assistenten. Bearbeite deinen Lebenslauf danach wie gewohnt auf der Seite `#/cv` — das CV Studio schlägt vor, du entscheidest.

### Hinweis „Ein früheres CV wiederverwenden?“

Wenn du im CV Studio eine gespeicherte Stellenbeschreibung auswählst, sagt dir ein gedämpfter Einzeiler-Hinweis, ob du bereits ein CV für eine ähnliche Rolle zugeschnitten hast. Die App vergleicht die ausgewählte Beschreibung mit deinen anderen gespeicherten Beschreibungen (ein deterministischer Wort-Überlappungswert plus eine Senioritätsprüfung — ohne KI, nichts gespeichert) und hebt den einen besten Treffer als eines von drei Urteilen hervor:

- **wiederverwenden** — sehr ähnlich zu einer gespeicherten Beschreibung; du kannst jenes CV wahrscheinlich unverändert wiederverwenden.
- **mit Änderungen wiederverwenden** — ähnlich; verwende jenes CV wieder, aber feile daran.
- **neu erzeugen** — keine eng ähnliche gespeicherte Beschreibung, also schneide ein frisches CV zu.

Der Hinweis erscheint automatisch, sobald du mindestens zwei gespeicherte Beschreibungen hast, und aktualisiert sich, wenn du die ausgewählte Beschreibung wechselst. Er ist nur ein Anstoß — er ändert nie dein CV oder deine Beschreibungen.

## 25. Gedächtnis (`#/memory`)

Jede andere Seite beginnt jedes Mal von vorn. Das **Gedächtnis** (öffne es über **Einrichtung → Gedächtnis 🧠** in der Seitenleiste) ist der einzige Ort, an dem du dem Assistenten etwas *einmal* sagst und es haften bleibt. Es enthält eine kurze, bearbeitbare Notiz nach dem Motto „merke dir das über mich", die in **jede** KI-Anfrage eingespeist wird.

### Wofür es da ist

Nutze es für dauerhafte Vorlieben und deinen Arbeitsstil, zum Beispiel:

- Die Arten von Rollen und Unternehmen, die du anvisierst (und die, die du nie sehen willst).
- Wie du Antworten geschrieben haben möchtest — knapp oder ausführlich, seniorer Ton, ohne Füllwörter.
- Harte Rahmenbedingungen, die es wert sind, wiederholt zu werden — nur remote, ein Gehaltsminimum, keine Rufbereitschaft.

Beschränke es auf Vorlieben und Steuerung. Es ist **nicht** der Ort für Fakten über deine Erfahrung — deine Fähigkeiten, Arbeitgeber und Erfolge stehen in deinem CV, deinem Profil und deinem Zweiseiter, die die einzigen Quellen für alles bleiben, was in deinen CVs und Anschreiben auftaucht. Die Gedächtnisnotiz prägt, *wie* der Assistent mit dir arbeitet, niemals *was* er über dich behauptet.

### Wie es überall ankommt

Wenn du auf **Gedächtnis speichern** klickst, wird die Notiz in die Nutzerschicht deines übergeordneten Projekts unter `config/memory.md` geschrieben und in den gemeinsamen Projektkontext eingebettet. Das heißt, sie reist automatisch mit **jeder** KI-Anfrage mit — Bewertungen, Übungsinterviews, Networking-Pläne, Umschreibungen im CV Studio — und über **jeden** von dir konfigurierten Anbieter. Schreib sie einmal; du musst dich nicht auf jeder Seite wiederholen. Wie deine anderen Nutzerschicht-Dateien wird sie beim Aktualisieren des Systems nie überschrieben, und sie verlässt deinen Rechner nur innerhalb der LLM-Prompts, die du auszuführen wählst.

### Aus deinen Daten vorschlagen

Nicht sicher, was du schreiben sollst? **✨ Aus meinen Daten vorschlagen** liest deinen Bewerbungs-Tracker und entwirft eine Reihe von Verhaltenspunkten — die Muster darin, was du verfolgst, annimmst und ablehnst. Führe den Prompt, den es dir gibt, in einem beliebigen LLM aus, prüfe die Vorschläge und füge eine bearbeitete Version in die Notiz ein. Es schöpft nur aus deinem eigenen Tracker und erfindet nie Fakten; du prüfst immer, bevor etwas gespeichert wird.

## 26. Statistiken (`#/stats`)

**Tab Absagemuster (v1.117.0).** Ein vierter Tab führt das `analyze-patterns.mjs` des Elternprojekts aus (nur lesend) und zeigt die Ergebnisverteilung, umsetzbare Empfehlungen und die Weiterkommensquote je ATS-Anbieter (das Signal der „algorithmischen Monokultur" — Bommasani et al., FAccT 2026). Anbieter unter der Mindeststichprobe tragen ein Sternchen; ohne das Elternprojekt sagt der Tab das ehrlich.

Die Seite **Statistiken** bringt drei Ansichten unter einer Sektion zusammen: einen KI-generierten Marktbericht, Auswertungen deiner eigenen Pipeline und den Trend der Stellenzahlen für deine Zielrollen aus deinen Scans. Wechsle zwischen ihnen über die Reiter oben.

### Marktbericht

Der Reiter **Marktbericht** bittet das Modell um eine Gehalts- und Arbeitsmarktanalyse *deiner* Zielrollen — es liest deinen CV und dein Profil, um zu wissen, welche Rollen und welche Seniorität abzudecken sind. Gib eine **Region / Markt** ein (zum Beispiel `Russia`, `EU-remote`, `US` oder `Germany`), wähle eine **Währung** und klicke auf **Marktbericht generieren**. Du erhältst einen strukturierten Bericht mit einer Zusammenfassung, Gehalt nach Stufe (Median plus P10/P25/P75/P90), Top-Arbeitgebern, einer Tabelle gefragter Fähigkeiten, der Häufigkeit von Zusatzleistungen, der Aufteilung Büro/Hybrid/Remote, Trends über 12-24 Monate inklusive KI-Einfluss und einer Verhandlungsanleitung. Jede Zahl ist eine **richtungsweisende Schätzung aus dem Trainingswissen des Modells** — keine gescrapten oder Live-Daten — und der Bericht sagt das auch; behandle die Zahlen als Bereiche, nicht als Zitate. Ohne gesetzten API-Schlüssel bekommst du statt eines erfundenen Berichts einen Prompt zum Kopieren und Einfügen. Nutze **Download .md**, **Als PDF speichern** oder **Kopieren**, um den Bericht aus der App herauszuholen.

### Meine Pipeline

Der Reiter **Meine Pipeline** stellt deinen eigenen Bewerbungs-Tracker grafisch dar — nichts Externes. Er zeigt, wie viele Rollen du verfolgt hast, deine Score-Verteilung, den Status-Trichter, deine Top-Unternehmen und -Rollen, Bewerbungen im Zeitverlauf und Konversionsraten (welcher Anteil der Bewerbungen Beworben, Beantwortet, Interview und Angebot erreicht). Es ist der ehrliche Spiegel deiner Suche: er gibt immer nur wieder, was bereits in `data/applications.md` steht.

### Zielrollen-Trend

Der Reiter **Zielrollen-Trend** ist die ursprüngliche Ansicht: Stellenzahlen und Mediangehalt nach Land für deine Zielrollen, aggregiert aus deinem letzten Scan, mit einer Währungsauswahl und einer Übersicht **Stellen nach Zielrolle**. **Snapshot speichern** hält die aktuelle Aggregation fest, sodass du beobachten kannst, wie sich die Stellenzahlen im Zeitverlauf bewegen, und die Trendlinie liest diese Snapshots zurück. Spärliche Daten sind zu erwarten und werden als richtungsweisend gekennzeichnet — sie werden nie mit erfundenen Zahlen aufgefüllt.

### Gesamt & Vergütung

Der **Gesamt**-Tab (v1.118.0) reicht zwei Zero-Token-Skripte des Parents read-only weiter: `stats.mjs` — die Gesamtübersicht deines Trackers, kumulierte Funnel-Quoten (Antwort / Interview / Angebot), Scanner-Gesamtzahlen und Portalabdeckung — und `salary-gap.mjs` — gewünschte vs. ausgeschriebene vs. tatsächliche Vergütung pro Bewerbung, zusammengeführt aus den Machine Summaries der Berichte und `data/salary-observations.tsv`. Kleine Stichproben werden als Richtwerte gekennzeichnet; ohne das übergeordnete Projekt zeigt der Tab einen ehrlichen Hinweis.

### Skill-Selbsteinschätzungs-Log (`#/assessments`)

`#/assessments` ist ein einfaches Log für die Skill-Assessments, die du ablegst — ein Coding-Test auf der Plattform eines Unternehmens, eine Hausaufgabe, ein Zertifizierungsquiz. Erfasse ein Ereignis — das **Unternehmen**, die **Plattform**, den **Skill**, einen optionalen Bestehens-**Schwellenwert %** und deine **Punktzahl %**, dazu eine Freitext-Notiz — und es wird, eine Zeile pro Ereignis, an `data/assessments.tsv` im Elternprojekt angehängt. Die Seite listet außerdem alles Erfasste auf und aggregiert es nach Plattform, damit du deine Entwicklung über die Zeit siehst. Es ist ein expliziter Schreibvorgang, den du auslöst; wenn das Elternprojekt fehlt, zeigt die Seite eine gedämpfte Zeile „nicht verfügbar“.

## 27. Karriereplan (`#/career-plan`)

Die Seite **Karriereplan** verwandelt deinen Lebenslauf und dein Profil in einen konkreten, personalisierten Entwicklungsplan — von der Art, die du mit einem Karrierecoach erarbeiten würdest, aber generiert aus deinen eigenen Unterlagen und von dir zu bearbeiten.

### Einen Plan generieren

Wähle einen **Horizont** (6, 12 oder 24 Monate), gib optional einen **Fokus** ein (zum Beispiel „in die Führung wechseln", „remote arbeiten" oder „auf Go umsteigen") und klicke auf **Plan generieren**. Das Modell liest deinen Lebenslauf, dein Profil, deinen Two-Pager und deine Memory-Notiz (über den geteilten Projektkontext) und schreibt einen strukturierten Plan: eine ehrliche Momentaufnahme deines Ausgangspunkts, eine SWOT aus Stärken und Wachstumsfeldern, Ziele ausgedrückt als SMART / OKR / WOOP, alternative Karrierewege mit ihren Abwägungen, einen Plan für harte und weiche Fähigkeiten, eine Monat-für-Monat-Roadmap für deinen gewählten Horizont, wie du Fortschritte verfolgst, wahrscheinliche Fallstricke und unterstützende Schritte. Jede Empfehlung ist in dem verankert, was deine Unterlagen tatsächlich zeigen — sie plant nach vorn und erfindet niemals Fakten über deinen Werdegang. Ohne gesetzten API-Schlüssel erhältst du stattdessen einen Prompt zum Kopieren und Einfügen.

### Bearbeiten und speichern

Der Plan landet in einem bearbeitbaren Textfeld — passe alles an und klicke dann auf **Plan speichern**. Er wird in die Nutzerschicht deines übergeordneten Projekts unter `config/career-plan.md` geschrieben, sodass er Systemaktualisierungen übersteht und nur innerhalb der LLM-Prompts gesendet wird, die du auszuführen wählst. **Vorschau** rendert dein Markdown, damit du es vor dem Speichern formatiert lesen kannst.

### Exportieren

Verwende **.md herunterladen**, **Als PDF speichern** oder **Kopieren**, um den Plan aus der App herauszuholen — dieselben Export-Steuerelemente, die überall in den KI-Berichten der App verwendet werden. Das PDF durchläuft den bestehenden Inline-PDF-Generator; das Markdown ist ein direkter Download.

## 28. Berufsorientierung (`#/orientation`)

Die Seite **Berufsorientierung** beantwortet die Frage „welche Richtungen passen wirklich zu mir?" — die Art von Einschätzung, die dir ein Berufstest liefern würde, aber abgeleitet aus deinem eigenen Lebenslauf und Profil statt aus einem Fragebogen.

### Was sie erzeugt

Klicke auf **Profil generieren** und das Modell liest deinen Lebenslauf, dein Profil, deinen Two-Pager und deine Memory-Notiz und schreibt ein Berufsorientierungsprofil: deine **am besten passenden Karrierevektoren** (welche der acht Archetypen — Funktionalist, Administrator, Kommunikator, Spezialist, Analyst, Innovator, Manager, Unternehmer — am besten passen, mit Belegen aus deinem Lebenslauf), eine **Neigung zum Berufstyp**, eine Reihe von **empfohlenen Rollen**, deine **beruflichen Stärken**, verknüpft mit dem, was der Lebenslauf zeigt, **Tendenzen im Arbeitsstil** („wie sich dein Lebenslauf liest" auf einigen Achsen) und **Entwicklungsempfehlungen**, um deine Passung zu erweitern.

### Wie sie generiert wird

Es ist eine **KI-Reflexion darüber, wie sich dein Lebenslauf liest — kein psychometrischer Test.** Der Prompt stützt sich vollständig auf deine eigenen Unterlagen: er erfindet keine Erfolge und meldet nie numerische Testwerte, als wären sie gemessen. Ohne gesetzten API-Schlüssel erhältst du statt eines Live-Profils einen Prompt zum Kopieren und Einfügen, den du in einem beliebigen LLM ausführen kannst. Nichts wird auf die Festplatte geschrieben — das Profil wird jedes Mal neu generiert.

### Exportieren

Verwende **.md herunterladen**, **Als PDF speichern** oder **Kopieren**, um das Profil zu behalten — dieselben Export-Steuerelemente, die überall in den KI-Berichten der App verwendet werden. Das PDF durchläuft den bestehenden Inline-PDF-Generator; das Markdown ist ein direkter Download.

## 29. Das CareerOps-Manifest

career-ops — das übergeordnete Projekt, dem diese App eine Oberfläche gibt — ist die erste Referenzimplementierung von [dem CareerOps-Manifest](https://career-ops.org/manifesto) (Eltern-Version v1.20.0). Das Manifest benennt die Praxis, für die diese gesamte Toolchain existiert: eine Jobsuche so zu betreiben, wie Ingenieure Produktivsysteme betreiben — mit Evidenz, mit Disziplin und mit Werkzeugen auf der Seite des Kandidaten am Tisch.

### Was es sagt

Sechs Prinzipien — „besser auf weniger bewerben", „Signal statt Volumen", „Evidenz statt Schlagwörter", „ein Mensch entscheidet", „local-first", „Würde auf beiden Seiten des Tisches" — dazu eine Grundrechte-Erklärung für Kandidaten im Zeitalter der KI-vermittelten Personalgewinnung: Du bist standardmäßig unsichtbar, niemand schlägt dich vor ohne dein Ja, dein Ja ist menschlich und kann nicht an einen Agenten delegiert werden, du zahlst nie, deine Daten gehören dir. Die App folgt diesen Regeln von Anfang an: Nichts wird je automatisch eingereicht, alles läuft lokal, und jede Behauptung in einem generierten Lebenslauf lässt sich auf deine eigenen Unterlagen zurückführen.

### Lesen und unterzeichnen

Der Link im Footer der Seitenleiste öffnet die Manifest-Seite. Du kannst auch `MANIFESTO.md` im übergeordneten Projekt lesen oder dort `npm run manifesto` ausführen, um die Unterzeichnungsseite zu öffnen. Das Unterzeichnen ist optional und dauert zehn Sekunden — deine Signatur wird zu einem öffentlichen Commit im `SIGNATURES.md`-Register des übergeordneten Repositorys. Nichts in der App hängt davon ab, ob du unterzeichnest.

## 30. Hermes & Telegram

**Hermes von Nous Research** ist ein offener, autonomer Agent — Tool-Calling, Skills und über 20 Messaging-Kanäle, Telegram darunter. **Ab v1.151.0 ist Hermes ein angebundener LLM-Provider:** Betreiben Sie seinen OpenAI-kompatiblen API Server (`hermes gateway`), setzen Sie `HERMES_API_KEY` in den **App-Einstellungen**, und career-ops-ui führt seine Live-Auswertungen über Ihr lokales Hermes aus. Dieser Abschnitt behandelt außerdem den Betrieb der App auf einem Cloud-Server und das Überbrücken ihrer Events zu Telegram via Hermes — diese beiden Teile sind Betreiber-Anleitung, keine App-Funktionen. Der vollständige Leitfaden ist `docs/integrations/HERMES.md`, und die `hermes-bridge`-Skill führt durch die Schritte.

### Was Hermes ist

Hermes ist eine Agent-Runtime, die sich mit Ihren eigenen LLM-Providern verbindet — und stellt zudem einen **OpenAI-kompatiblen API Server** bereit: `hermes gateway` liefert `POST /v1/chat/completions` unter `http://127.0.0.1:8642/v1` mit einem Bearer-Schlüssel (seinem `API_SERVER_KEY`). Deshalb behandelt career-ops-ui es wie einen weiteren Provider (den „Shape A“-Weg im Leitfaden): die App POSTet an diesen lokalen Endpoint genau wie bei OpenAI oder Qwen, und Hermes leitet die Anfrage an das intern konfigurierte Modell weiter. Es steht **zuletzt** in der auto-Reihenfolge und überschreibt daher niemals ein bestehendes Anthropic/Gemini/OpenAI/Qwen-Setup.

### Betrieb auf einem Cloud-Server

career-ops-ui bindet standardmäßig an `127.0.0.1`. Um einen Hermes-Agenten zu erreichen, der auf einem Server lebt, verlassen Sie das Loopback — vorsichtig. Halten Sie die App an Loopback gebunden und setzen Sie davor einen Reverse Proxy (nginx oder Caddy), der HTTPS terminiert; betreiben Sie sie unter systemd oder pm2 als Nicht-Root-Benutzer; und halten Sie den Read-only-Vertrag mit dem Eltern-Projekt career-ops auf der Headless-Maschine intakt. Der Sicherheitsrahmen muss den Umzug überstehen: eine Content-Security-Policy ohne Inline-Skripte, der SSRF-Schutz bei jedem Fetch einer nutzergelieferten URL, die Markdown/XSS-Grenze und keine Secrets in Logs. Der Leitfaden hat die vollständige Checkliste — legen Sie `0.0.0.0` niemals direkt ins öffentliche Internet.

### Telegram via Hermes

Die Brücke bringt App-Events — ein abgeschlossener Scan, ein neuer Report, ein gerade dringend gewordenes Follow-up — über Hermes in einen Telegram-Chat. Das Telegram-Bot-Token lebt in Hermes' eigener Konfiguration, niemals in career-ops-ui. Senden Sie nur das nützliche Minimum: „Scan abgeschlossen — 12 neue Treffer" plus einen Link, den Sie selbst öffnen. **Senden Sie niemals** CV-Text, Gehaltszahlen, Report-Inhalte, API-Keys oder interne URLs an den Kanal — die Threat-Model-Liste „was NICHT exponiert werden darf" aus dem Leitfaden ist die Regel. Diese Seite ist über `#/help` erreichbar, und der eingebaute Dokumentations-Assistent beantwortet Fragen auf ihrer Grundlage.

## 31. Den gesamten Stack in der Cloud betreiben

Die meisten Leute betreiben career-ops auf ihrem eigenen Laptop. Aber die Pipeline zeigt sich von ihrer besten Seite, wenn sie **immer läuft** — Boards scannt, während Sie schlafen, den Tracker aktuell hält, und in jedem Browser von jedem Gerät aus bereit ist. Dieser Abschnitt ist das durchgängige Rezept dafür, den **gesamten Stack** auf einem kleinen Cloud-Server unterzubringen: die übergeordnete **career-ops**-Pipeline, diesen **career-ops-ui**-Viewer, und die **Engine**, die die KI ausführt — entweder Ihr **Claude-Abonnement** (über die Claude Code CLI) oder ein lokales **Hermes**-Gateway. Er baut auf den Hermes-Cloud-Hinweisen aus §30 auf; die vollständige Betreiber-Checkliste ist `docs/integrations/HERMES.md`.

### Die drei beweglichen Teile

Der Stack besteht aus drei zusammenarbeitenden Teilen, und es hilft, sie klar zu trennen. **career-ops** (das Eltern-Projekt) ist die KI-Jobsuche-Pipeline — es besitzt Ihre `cv.md`, `config/`, `reports/` und `portals.yml`, und wird von einer **Agent-CLI** gesteuert. **career-ops-ui** (diese App) ist ein größtenteils Read-only-Web-Viewer, der *innerhalb* von career-ops als `web-ui/` liegt und dieselben Dateien im Browser anzeigt; er schreibt nur bei expliziten Aktionen zurück. Die **Engine** ist das, was tatsächlich auf die KI-Prompts antwortet. Zwei der drei Teile sind auf einem Server dieselben wie auf Ihrem Laptop — nur die Wahl der Engine und die Netzwerk-Exposition ändern sich.

### Bereitstellen und installieren

Mieten Sie einen kleinen VPS (1 vCPU / 1 GB RAM reicht für den Viewer völlig aus), auf dem ein aktuelles Linux läuft, und installieren Sie **Node ≥ 18** (22.5+ wird empfohlen — es aktiviert den SQLite-Tracker-Index des Eltern-Projekts). Installieren Sie `git`. Machen Sie dann genau das, was eine lokale Installation macht: klonen Sie das Eltern-Projekt `career-ops`, und klonen Sie dieses Repo darin als `career-ops/web-ui/`. Legen Sie Provider-Keys in die `.env` des Eltern-Projekts (committen Sie sie niemals — `.env` / `.env.*` sind in der gitignore; starten Sie von `.env.example`). Starten Sie den Viewer mit `npm start` — halten Sie ihn aber an `127.0.0.1` gebunden; Sie werden ihn über einen Proxy exponieren, nicht direkt (siehe unten).

### Ihre Engine wählen

career-ops ist CLI-agnostisch, sodass Sie drei ehrliche Optionen für die KI haben. **Ihr Claude-Abonnement** — installieren Sie die **Claude Code**-CLI auf der Maschine und führen Sie `claude login` mit Ihrem Pro/Max-Plan aus; der Agent des Eltern-Projekts nutzt dann Ihr Abonnement, ohne API-Abrechnung pro Token. **Hermes** — führen Sie `hermes gateway` auf derselben Maschine aus (es exponiert eine OpenAI-kompatible API unter `http://127.0.0.1:8642/v1`) und setzen Sie `HERMES_API_KEY` in den **App-Einstellungen**; die Live-Auswertungen von career-ops-ui laufen darüber (als letztes in der automatischen Provider-Reihenfolge). **API-Keys** — setzen Sie `ANTHROPIC_API_KEY` (oder einen der sieben Provider: Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models → Hermes → DeepSeek → GLM (Z.ai) → Kimi (Moonshot) → MiniMax → Mistral → Grok (xAI) → Together → Fireworks → Ollama → BytePlus Ark → Volcengine Ark) in der `.env` des Eltern-Projekts, und die ⚡ Live-Aktionen funktionieren ohne Aufsicht. Sie können sie mischen: ein Claude-Abonnement für die schwere Agenten-Arbeit des Eltern-Projekts, und einen günstigen oder lokalen Provider für die schnellen Auswertungen des Viewers.

### Sicher exponieren

Das Verlassen von `127.0.0.1` bedeutet, dass die Sicherheit, die das Loopback kostenlos bot, jetzt explizit gebaut werden muss — **der Code ist identisch; nur die Exposition ändert sich.** Halten Sie die App an Loopback gebunden und setzen Sie davor einen Reverse Proxy (**nginx** oder **Caddy**), der **HTTPS** terminiert (Let's Encrypt / automatisches TLS) und an `127.0.0.1:4317` weiterleitet; betreiben Sie ihn unter **systemd** oder `pm2` als dedizierten **Nicht-Root**-Benutzer mit `Restart=on-failure`. Setzen Sie die **Authentifizierung** davor — die App hat kein eigenes Login, also ist es der Proxy (Basic-Auth, ein SSO-Forward-Auth, oder ein privates Netzwerk / VPN), der Fremde draußen hält. Wenn Sie `HOST=0.0.0.0` setzen, damit der Proxy sie erreichen kann, schaltet sich das eingebaute Hardening ein, das am Loopback ein No-op war, und wird tragend: das LLM-Rate-Limit, die `safeGet`-Verteidigung gegen DNS-Rebinding, und die Pfadnamen-Bereinigung. Vier Invarianten müssen den Umzug überstehen, und Sie dürfen sie nicht lockern: die **CSP** (keine Inline-Skripte, `frame-ancestors 'none'` — der Proxy darf diese Header nicht entfernen), der **SSRF-Schutz** bei jedem Fetch einer nutzergelieferten URL, die **Markdown/XSS-Grenze** (`stripDangerousMarkdown()` serverseitig + escape-first `UI.md()` clientseitig), und **keine Secrets in Logs**. Der Read-only-Vertrag des Eltern-Projekts gilt weiterhin auf der Headless-Maschine — der Server liest nur Ihre `cv.md` / `config/` / `reports/` und schreibt bei expliziten Aktionen.

## 32. Über OpenWorker betreiben (KI-Kollege)

Lieber einen KI-Kollegen auf dem Desktop statt des Browsers? **[career-ops-coworker](https://github.com/Fighter90/career-ops-coworker)** ist ein **[OpenWorker](https://github.com/andrewyng/openworker)**-Kollege (Andrew Ngs quelloffene, local-first KI-Kollegen-App), der diese gesamte Pipeline für Sie steuert — Boards scannen, die Passgenauigkeit gegen Ihren Lebenslauf bewerten, einen fundierten Lebenslauf + ein Anschreiben zuschneiden, Bewerbungen verfolgen, Nachfass-Nachrichten entwerfen — und er kann auf Wunsch **dieses Dashboard starten**. Es ist eine einzige, code-freie Markdown-„Persona"; OpenWorker führt nichts davon als Programm aus, die Anweisungen steuern lediglich den Agenten. Sein Leitfaden wird in allen 17 Sprachen ausgeliefert.

### Was der Kollege macht

Innerhalb Ihres `career-ops`-Projektordners führt der Kollege dieselben Schritte aus wie die Pipeline: er scannt die Boards in Ihrer `portals.yml` (ohne Token), bewertet jede Ausschreibung mit 0–5 gegen Ihre `cv.md` + `config/profile.yml`, und — auf Wunsch — schneidet er einen rollenspezifischen Lebenslauf + ein Anschreiben zu, das **ausschließlich** auf Fakten beruht, die bereits in Ihrem Lebenslauf stehen (er erfindet niemals einen Arbeitgeber, ein Datum oder eine Kennzahl). Er aktualisiert `data/applications.md`, entwirft Nachfass-E-Mails und kann Interview-Termine setzen — wobei jedes Senden oder Schreiben **freigabepflichtig** ist, genau wie es die Doktrin von career-ops selbst vorsieht. Um diesen Viewer zu öffnen, führt er `bash web-ui/bin/start.sh` (oder `npm start`) aus und übergibt Ihnen `http://127.0.0.1:4317`.

### Installieren und starten

Installiere OpenWorker und füge einen Modellschlüssel hinzu (Anthropic / OpenAI / Google oder ein lokales Ollama). Am schnellsten ist **ein Befehl** — er richtet die `career-ops`-Pipeline ein, die der Coworker steuert, und ist idempotent: er nutzt ein vorhandenes `career-ops` / `web-ui` weiter, ohne deine Daten zu überschreiben:

```bash
curl -fsSL https://raw.githubusercontent.com/Fighter90/career-ops-coworker/main/install.sh | bash
```

Füge den Coworker dann in OpenWorkers **Install a coworker**-Panel hinzu — per **GitHub URL** (`https://github.com/Fighter90/career-ops-coworker`), per **.zip** (aus den [Releases](https://github.com/Fighter90/career-ops-coworker/releases)) oder durch **Importieren** von `career-ops.md`. Öffne eine **Job-Search Coworker**-Sitzung, wähle deinen `career-ops`-Ordner und bitte um etwas Konkretes — *„scanne meine Boards und gib mir die Top 5 Treffer dieser Woche"* oder *„öffne das Dashboard."* Connectors (Gmail, Google Calendar, GitHub) und die vollständige Anleitung stehen im [Hilfe-Guide](https://github.com/Fighter90/career-ops-coworker/tree/main/help) des Repos. Installierbarkeit gegen OpenWorkers Loader und Repo-Installer verifiziert.
