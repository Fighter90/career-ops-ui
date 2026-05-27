# Help — career-ops-ui

A complete walkthrough of every page, from the moment you launch the
app to landing an interview. Each `##` heading below corresponds to a
sidebar entry or a phase of the workflow. Read top-to-bottom on first
run; jump to a specific section later via the table of contents in the
help sidebar.

> **Audience:** anyone who just dropped this UI inside a `career-ops`
> checkout and ran `bash bin/start.sh`. No prior career-ops knowledge
> assumed.

### About career-ops

[career-ops](https://career-ops.org) is an open-source job-search system
that runs as slash commands inside any AI coding CLI (Claude Code, Codex, OpenCode, Qwen CLI — other Claude-compatible CLIs work too via the same slash-command surface). Model-agnostic. It
evaluates each posting against your CV with a six-dimension 0.0–5.0
rubric, generates tailored PDF résumés, and tracks every application
locally on your machine.

**Canonical reference (read these in order on first install):**

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
  — the system, principles, and concepts inventory.
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
  — discover vacancies; populate the Pipeline.
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
  — full submission flow with Playwright form-read.
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  — score 10+ JDs at once via `batch-runner.sh`.
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)
  — install Chromium + register the MCP for PDF and form-fill.

**Defining principles** (from
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

- **Open source, seriously** — MIT, no paid tier, no waitlist, no
  telemetry, no accounts. The system operates without paid tiers,
  accounts, or telemetry. Code contributions undergo community review
  before release.
- **Data sovereignty** — `cv.md`, `config/profile.yml`, `data/`,
  `reports/`, `interview-prep/` never leave your laptop unless you
  explicitly push them. You run it locally on your machine, retaining
  full data sovereignty.
- **AI-agnostic architecture** — career-ops does NOT bundle a model.
  It functions as commands inside existing AI coding CLIs. Switch
  providers (Anthropic ↔ Gemini ↔ OpenAI) and your evaluation history
  stays consistent.
- **Human-controlled submissions** — career-ops drafts answers and
  opens the form, but **you click Submit**. The system never
  auto-applies. The system provides structure and evaluation; humans
  retain final submission authority.
- **Structured search** — built for an active, deliberate job hunt
  with many applications; not a single-submission tool, not a
  recommendation engine. Setup takes ~15 minutes and assumes terminal
  comfort.

**What career-ops is NOT** (explicit non-goals):

- Not an auto-applier. It will not submit forms for you.
- Not a résumé rebuilder. It tailors per-JD; it does not invent
  experience.
- Not a LinkedIn optimizer. Your profile is your business.
- Not a spreadsheet replacement that hides behind a SaaS UI. The data
  is plain markdown on your filesystem.

**Key concepts** (full inventory — every artifact career-ops touches):

| Concept | What it is |
|---|---|
| **Mode** | A prompt template under `modes/<slug>.md`. Built-in: `oferta`, `deep`, `apply`, `pipeline`, `batch`, `contacto`, `followup`, `interview-prep`, `patterns`, `project`, `training`, `ofertas`, `auto-pipeline`, `pdf`, `latex`, `scan`, `tracker`. |
| **Archetype** | A target-role profile in `config/profile.yml`. The rubric weights skill matches against the active archetype — **the single most important field**. |
| **Pipeline** | `data/pipeline.md` — inbox of JD URLs waiting to be evaluated. |
| **Tracker** | `data/applications.md` — historical GFM table of every evaluation + application status. |
| **Report** | `reports/<NNN>-<company>-<DATE>.md` — full A–F evaluation per JD, with score + legitimacy in the header. |
| **Scan history** | `data/scan-history.tsv` — append-only log; prevents duplicates across scans. |
| **Proof points** | STAR+R evidence blocks extracted from `cv.md`, reused across evaluation, apply answers, interview prep. |
| **JD store** | `jds/jd-<date>-<ts>.txt` — verbatim job descriptions saved during evaluation for the audit trail. |
| **Interview-prep** | `interview-prep/<company>-<role>.md` — deep-research briefs and round one-pagers. |
| **Batch additions** | `batch/tracker-additions/*.tsv` — pending rows queued by `batch-runner.sh` for merge into the tracker. |

### career-ops vs career-ops-ui (this app)

| | career-ops (CLI) | career-ops-ui (this app) |
|---|---|---|
| Where it runs | inside Claude Code / Codex / OpenCode / Qwen CLI | `http://127.0.0.1:4317` in your browser |
| Surface | `/career-ops <mode>` slash commands | sidebar with one page per workflow |
| Form-fill | yes, via Playwright MCP | no — generates the checklist, you finish in the CLI |
| PDF | `generate-pdf.mjs` | `📄 Generate PDF` on `#/cv`, `#/reports/:slug`, `#/evaluate`, `#/deep`, `#/interview-prep` |
| Data files | shared with career-ops-ui | shared with career-ops |

career-ops-ui is **pure additions**. Nothing inside `career-ops/`
changes. Both surfaces share the same `cv.md`, `config/profile.yml`,
`portals.yml`, `data/`, `reports/`, `interview-prep/`, `modes/`.

### Action thresholds by score

Once a JD has an evaluation, the score determines what to do next
(canonical table from
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

| Score | Next step |
|---|---|
| **≥ 4.5** | Run `/career-ops apply` — high fit, push immediately. |
| **4.0 – 4.4** | Apply, or `/career-ops contacto` for warm intro first. |
| **3.5 – 3.9** | Run `/career-ops deep` — research the company / role before deciding. |
| **< 3.5** | Skip unless you have a specific personal reason. |

career-ops-ui's `#/dashboard` and `#/tracker` highlight every row at or
above 4.0 so you can pick action without re-running anything.

### External docs

Full reference for the underlying career-ops engine
(scanning, evaluation rubric, batch processing, apply flow,
Playwright setup) is at
[career-ops.org/docs](https://career-ops.org/docs):

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)

---

## 1. Quick start — full step-by-step from "create CV" to "applied & messaged"

This is the canonical, button-by-button playbook. Follow it in order
the first time. Every step names the exact route, the exact button,
and what you'll see on success. Sections 2–16 below dive deeper into
each phase.

> **One-command launch & init.** From a terminal you can do the whole
> bootstrap without touching the UI:
>
> ```bash
> career-ops-ui setup      # install deps → doctor → run the server
> career-ops-ui init       # pick LLM provider + paste its key (echo suppressed)
> career-ops-ui doctor     # re-verify any time (exit 0 ⇔ all required green)
> career-ops-ui run        # just launch the server at http://127.0.0.1:4317
> career-ops-ui open       # open + RAISE the dashboard tab in your browser
> ```
>
> After `setup`/`run` the browser tab is opened **and brought to the
> front** automatically (v1.43.0); `career-ops-ui open` does the same on
> demand so you never have to hunt for the dashboard tab. `NO_OPEN=1`
> disables auto-open for headless/CI starts.
>
> `setup` runs the entire chain itself. `init` writes the key to the
> parent `career-ops/.env` through the same validated path the
> `#/config` API-keys tab uses, and sets `LLM_PROVIDER`
> (`auto` | `claude` | `gemini`) which the live evaluate / deep / mode /
> auto-pipeline routes honour. CI form:
> `career-ops-ui init --provider claude --anthropic-key sk-ant-… --yes`.
> Prefer the UI? Continue with the steps below.

### A. Setup (do these once, ~5 minutes)

**career-ops-ui must live at `career-ops/web-ui/`** (nested inside the parent career-ops project). It reads your `cv.md`, `config/`, and `data/` from the parent folder via `../` and does not work standalone. If `career-ops-ui init` is not found after a pull, run `cd career-ops/web-ui && npm install && npx career-ops-ui init`.

**Step 1 — Open the app at `http://127.0.0.1:4317`.** If it isn't
running, in a terminal run `bash bin/start.sh` from the repo root.
The Dashboard (`#/dashboard`) loads.

**Step 2 — Click `❤ Health` in the left sidebar.** Every required
check must be green:

- `cv.md`, `config/profile.yml`, `portals.yml` exist
- API key set (at least one of `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`)
- Playwright installed (only required if you'll use Generate PDF)

If anything is red, the page tells you the exact file or env var to
fix. Don't proceed until Health is green.

**Step 3 — Click `⚒ App settings` in the sidebar.** You land on the
**API keys & runtime** tab.
- Paste `ANTHROPIC_API_KEY` (preferred — better long-form scoring)
  and/or `GEMINI_API_KEY`. Get keys from
  <https://console.anthropic.com/settings/keys> or
  <https://aistudio.google.com/apikey>.
- Click **💾 Save**. Then click **▶ Test Anthropic** (or Gemini) — a
  tiny round-trip confirms the key works.

**Step 4 — Switch to the `Profile` tab on the same page.** This is the
direct YAML editor for `config/profile.yml`. Edit at minimum:
- `candidate.full_name` — replace any placeholder ("Jane Smith") with
  your real name
- `candidate.email`, `linkedin`, `github` — used in cover letters
- `target.roles` — the job titles you'll apply to
- `target.comp_total_min_usd` — minimum total comp; offers below this
  get flagged in section D of every evaluation
- `target.archetypes` — the career patterns you accept (single
  most-impactful field)

Click **💾 Save**. Server validates the YAML and stamps the canonical
`# Career-Ops Profile Configuration` header.

### B. CV (do this once, ~10 minutes)

**Step 5 — Click `✎ CV` in the sidebar.** Two columns: editor on the
left, live preview on the right.

**Step 6 — Pick one path to fill the editor:**
- **Upload an existing résumé** — click **📁 Upload CV**, pick any of
  `.docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md`. The
  server converts to markdown via pandoc or pdftotext, sanitizes XSS,
  and drops the result in the editor. **Review the conversion** —
  PDFs especially can lose layout fidelity.
- **Paste markdown directly** — the textarea is a markdown editor;
  the right pane is what the LLM (and your future recruiter) will see.
- **Tone tips:** one bullet = one accomplishment with a metric. Keep
  under 1500 words. Sections in this order: Summary, Experience,
  Projects, Education, Skills.

**Step 7 — Click `💾 Save` (top-right of CV page).** The server
sanitizes (`<script>` / `javascript:` / inline handlers stripped) and
writes `cv.md`. Toast: *"Saved"*.

**Step 8 (optional) — Click `📄 Generate PDF`.** Runs
`generate-pdf.mjs` in the parent (Playwright required) and **the new
PDF auto-downloads** to your browser when done. The list at the
bottom of the page keeps every previously generated file.

### C. Find vacancies (~2 minutes per scan)

**Step 9 — Click `🌐 Scan` in the sidebar.** Confirm `portals.yml`
lists the boards you care about (sections 5 of this help). Press the
**🌐 Scan now** button. A live SSE log streams while the scanner
walks Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (English boards) and hh.ru / Habr
Career (Russian boards if enabled).

**Step 10 — When the scan finishes, review results.** Click any
company tag to filter; click the ↗ icon to open the company's
careers page in a new tab. Every vacancy that survived the
title-filter is queued in the Pipeline.

### D. Score the offers (~30 seconds per JD)

**Step 11 — Click `Pipeline` in the sidebar.** You see every URL
the scanner queued. Click an entry to preview the JD inline.

**Step 12 — Click `▶ Evaluate` next to any JD.** This jumps to
`#/evaluate`. With an API key set, it runs live; without one, you
get a manual prompt to paste into your own LLM. Live mode produces a
**0–5 score** against your CV across sections A–G (Role / Company /
Compensation / Risk / Stretch / Cultural fit / Verdict). Save lands
in `reports/<date>-<slug>.md`.

**Step 13 — Click `Reports` in the sidebar** and review the latest
evaluation. Anything below your `comp_total_min_usd` is flagged red
in section D. Anything with `Verdict: pursue` is your shortlist.

### E. Decide & deeply research the shortlisted company (~3 minutes)

**Step 14 — Pick a vacancy worth pursuing. Click `Deep research`
in the sidebar.** Enter the company name and role. The model
produces a 7-section company brief (mission, recent news, tech
stack, hiring signals, comp benchmarks, risks, recommended angle).
Save lands in `interview-prep/<company>-<role>.md`.

### F. Apply (~5 minutes per application)

**Step 15 — Click `Apply checklist` in the sidebar.** Paste the
vacancy URL + JD. The helper generates a step-by-step submission
checklist:
- Tailored cover-letter draft (uses your `cv.md` + `profile.yml`)
- Specific keywords to mirror from the JD
- Files to attach (CV PDF — see step 8)
- Where to apply (the canonical careers URL, not aggregator
  redirects)
- Reminder: **NEVER auto-submit** — final review and submission is
  always manual.

**Step 16 — Open the careers page in a new tab.** Use the apply
checklist as your todo list. Submit through the company's actual
form. Attach the PDF you generated in step 8.

**Step 17 — Reach out to a real human.** Open the **Outreach** mode
(`#/contacto` in the sidebar). The model drafts a short LinkedIn /
email message tailored to the company brief from step 14. Personalize
the opener (one specific detail from your deep-research brief).
Send it.

### G. Track & follow up (continuous)

**Step 18 — Click `Tracker` in the sidebar** and add a row for
the application: company, role, score, status `Applied`, link to the
report, link to the deep-research brief. Date is auto-filled.

**Step 19 — A week later: open `Follow-up` mode** (`#/followup`).
Drafts a polite check-in email referencing the original application.
Send. Update tracker status to `Followed up`.

**Step 20 — When you get an interview invite, run `Interview prep`
mode** (`#/interview-prep`). Generates targeted prep for the
specific company + stage (system design / behavioral / coding).
Pulls from the deep-research brief automatically.

**Step 21 — Got the offer? Update Tracker status to `Offer`** and
revisit the comp section of your evaluation report — your minimum
acceptance number is right there.

### TL;DR — sidebar order matches the workflow

`Health → App settings → Profile → CV → Scan → Pipeline → Evaluate
→ Reports → Deep research → Apply checklist → Outreach → Tracker
→ Follow-up → Interview prep → Activity log`

That's it. 21 steps, button-by-button, from zero to offer.

### One-click Auto-pipeline (`#/auto`) — the 21-step shortcut

If you just want to score one specific posting fast, skip the manual
walkthrough. **Sidebar → ✨ Auto-pipeline** (or the ✨ button on the
Dashboard) opens a dedicated screen: paste the job URL, press **Enter**
or click **▶ Run full pipeline**, and the server runs the whole chain
in one observable pass:

1. **Validating URL** — SSRF-safe check (`isValidJobUrl`); rejects
   loopback / `file:` / private IPs / script chars.
2. **Fetching job description** — `safeGet` (DNS-pinned, redirect-
   revalidated) pulls + sanitizes the JD.
3. **Evaluating against your CV** — Anthropic (preferred) → Gemini
   fallback → manual-prompt if no key.
4. **Saving report** — writes `reports/<slug>.md` with score +
   legitimacy in the header.
5. **Adding to tracker** — appends a row to `data/applications.md`.

Live feedback is a vertical **stepper** (each step lights up
running → done / failed). It is an ordered list with `aria-current`
on the active step and a polite screen-reader live-region announcing
every transition. On success the result card deep-links straight to
the saved report (**View report · N/5**) and the **tracker**. A failed
step is marked red with its message and the button re-enables so you
can fix the URL and retry without reloading.

**No API key?** The pipeline runs in **manual mode**: steps 3–5
collapse and you get a ready-to-paste prompt card (copy into Claude
Code / Anthropic / Gemini). No live LLM call, no spend.

`#/auto` is linkable: `#/auto?url=<encoded>&go=1` opens the screen and
auto-starts. The dashboard ✨ button and this sidebar entry both land
here (single coherent flow — the pre-1.34 transient modal was promoted
to this page).
> **CLI (v1.38.0).** One command does the chain: `career-ops-ui setup` (bootstrap → install → start). Standalone verbs: `career-ops-ui doctor` (env/keys/tooling check — same engine as the Health page; exit 1 on any required failure), `career-ops-ui run`, `career-ops-ui init` (provider+key wizard, v1.39.0).
> **Providers (v1.39.0).** API-keys tab adds an `LLM_PROVIDER` select (`auto` = Anthropic→Gemini default · `claude` · `gemini`) and an `OPENAI_API_KEY` field (Codex/OpenCode CLI side). `career-ops-ui init` is an interactive wizard for the same.
>
> **Providers (v1.57.0).** Headless live-eval now spans **Anthropic → Gemini → OpenAI → Qwen → OpenRouter** (the `auto` order; `LLM_PROVIDER` pins one). **OpenRouter** — one `OPENROUTER_API_KEY` fronts 300+ models; the `OPENROUTER_MODEL` dropdown loads OpenRouter's live catalogue (server-side proxy, curated offline fallback). Also fixed: keys pasted with a trailing newline / surrounding spaces are now trimmed before validation, so `/#/config` no longer shows "validation failed" for any provider.



---

## 2. App settings & API keys (`#/config`)

> **New in v1.55 → v1.56.** With **no** LLM key set, a red banner on every screen explains that ⚡ Run-live is in manual-prompt mode and links here; once a key is set it becomes a quiet chip naming the active provider. Before any ⚡ Run-live button (`#/auto`, `#/evaluate`, `#/deep`, modes) an honest cost ballpark shows (e.g. "Estimated cost: OpenAI gpt-5-codex · ~$0.04/eval", or a no-API-cost note in manual mode). `#/scan` tucks secondary filters behind an **Advanced filters** disclosure; `#/tracker` adds clickable funnel chips + optional server-side pagination; `#/pipeline` virtualizes past 1000 rows.

Three tabs:

1. **API keys & runtime** — structured field form over the parent
   project's `.env` (same file the career-ops Node scripts read on
   startup). Grouped: API keys / Runtime / Regional sources. The tab
   also exposes per-provider model selectors — `OPENAI_MODEL`
   (OpenAI/Codex) alongside `ANTHROPIC_MODEL` and `GEMINI_MODEL`.
2. **Profile** — **field-by-field form** over `config/profile.yml`
   (web-ui 1.32.0). Save **merges** into the file — your archetypes,
   proof points, and any custom keys are preserved untouched.
3. **Modes** — **structured field-form** for `modes/_profile.md`
   (web-ui 1.54.3), derived from the documented schema. List-type
   sections — **Target Roles / Adaptive Framing / Comp Targets** —
   render as repeatable line-item inputs (add/remove rows); prose
   sections — **Exit Narrative / Location Policy** — render as
   labelled textareas; any unknown or non-list section falls back to
   a labelled verbatim textarea. Save still **merges by section** —
   the preamble, untouched sections, and any custom sections are
   preserved byte-for-byte. An *Advanced: raw markdown* disclosure
   remains for full-file edits — adding/removing sections or editing
   the preamble.

A save in any tab propagates immediately — no server restart.

**Setting up your LLM provider (step by step).** The web UI's ⚡ live evaluation runs *headless* and uses one API key. It works via "OR" — set **any one** of these and it just works; with several set, `auto` prefers them in this order: Anthropic → Gemini → OpenAI → Qwen. (career-ops itself is CLI-agnostic — you also run it inside Claude Code, Codex, Gemini, OpenCode, Qwen, Copilot or Kimi; that's separate from this headless key.)

1. Open `#/config` → the **API keys & runtime** tab.
2. Pick your provider in **`LLM_PROVIDER`**: `auto` (use whichever key is set), or force one with `claude` / `gemini` / `openai` / `qwen`.
3. Fill the key + model for the provider you chose:
   - **Anthropic** — set `ANTHROPIC_API_KEY` (console.anthropic.com), optionally `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`).
   - **Gemini** — set `GEMINI_API_KEY` (aistudio.google.com/apikey), optionally `GEMINI_MODEL` (default `gemini-2.0-flash`).
   - **OpenAI** — set `OPENAI_API_KEY` (platform.openai.com), optionally `OPENAI_MODEL` (default `gpt-5-codex`).
   - **Qwen** — set `QWEN_API_KEY` (Alibaba Model Studio / DashScope, dashscope.console.aliyun.com), optionally `QWEN_MODEL` (default `qwen-max`). For the mainland-CN endpoint set `QWEN_BASE_URL` in the raw `.env`.
4. Click **Save**. Keys write to the parent project's `.env`; the change takes effect immediately — no server restart needed.
5. Verify on `#/evaluate`: paste a job URL/description and press **⚡ Run live**. The result header shows which provider ran (`anthropic` / `gemini` / `openai` / `qwen`). No key set anywhere → you get the copy-paste manual prompt instead.

Secrets are masked after saving and never logged. Model-id fields (`*_MODEL`) are not secret.

### Profile tab (field form — v1.32.0)

Before v1.32.0 this tab was a single raw-YAML textarea where every
setting lived in one undifferentiated blob. It is now a structured
form, fields grouped into three collapsible sections:

- **Candidate** — Full name (required), Email, Phone, Location,
  LinkedIn, GitHub, Portfolio URL, X / Twitter.
- **Narrative** — Headline, Exit story.
- **Compensation** — Target range, Currency, Walk-away minimum,
  Location flexibility.
- **Structured array editors** (web-ui 1.35.0) — add/remove-row
  editors for the list-shaped fields, so even these no longer need
  the raw YAML: **Target roles** + **Superpowers** (string lists);
  **Archetypes** (name / level / fit rows); **Proof points** (name /
  url / hero-metric rows). Empty rows are dropped; an emptied list
  removes the key cleanly. Same merge-not-replace guarantee — every
  array you don't touch survives untouched.

How the save is safe:

- The form sends only the 14 modeled scalar paths as
  `{ fields: { "candidate.full_name": … } }`. The server **reads the
  existing `config/profile.yml`, sets/clears only those leaves, and
  re-serializes the whole object** — so nested arrays the form does
  not model (`target_roles.archetypes`, `narrative.proof_points`,
  `narrative.superpowers`) and any custom keys you added by hand
  **survive the round-trip untouched**. Clearing a field removes that
  key cleanly (no `phone: ""` residue).
- Validation still requires a full name; the `# Career-Ops Profile
  Configuration` header is stamped automatically.
- One tradeoff: a field-form save **re-serializes the YAML, so inline
  `#` comments are lost**. To preserve comments or to edit nested
  arrays, use the **Advanced: edit raw YAML** disclosure at the
  bottom of the tab — it is the pre-1.32 full-file editor, unchanged
  (replaces the whole file on save).
- The read-only summary at `#/profile` is the visual companion.

### Recognized keys

| Key | What it does | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Enables live Anthropic SDK calls. Preferred when both Anthropic + Gemini are set — better long-form structured output for JD scoring and deep research. | <https://console.anthropic.com/settings/keys> |
| `ANTHROPIC_MODEL` | Override the default `claude-sonnet-4-6`. Try `claude-opus-4-7` for harder reasoning, `claude-haiku-4-5-20251001` for cheap-and-fast. | — |
| `GEMINI_API_KEY` | Fallback when no Anthropic key. Used by `gemini-eval.mjs` for `oferta` mode. Free tier works for low volume. | <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | Override default Gemini model. | — |
| `(server uses default UA)` | Required when running `hh.ru` scans from outside Russia (the API returns 403 on plain User-Agents). Register an app at <https://dev.hh.ru/admin> and use its UA string. | dev.hh.ru |
| `PORT` | Express bind port. Default 4317. | — |
| `HOST` | Bind address. Default `127.0.0.1`. Setting `0.0.0.0` exposes the UI on the LAN — **no auth gate yet**, see Production-readiness doc. | — |

### Behavior

- **Read** (`GET /api/config`) returns every recognized key. Secret
  keys (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) are **masked** — you see
  `sk-ant•••••••a1b2`, never the full value.
- **Save** (`POST /api/config`) validates each value, writes to
  `<parent>/.env`, and immediately applies to the running process.
  No restart needed.
- **Empty value deletes** the key. Useful if you want to unuse a Russian IP / VPN.

### Smoke-test buttons

After saving, click **▶ Test Anthropic** or **▶ Test Gemini** — both
fire a tiny prompt (≤256 tokens output) so you spend essentially
nothing while confirming the key is wired up correctly. Returns a
~200-character sample on success.

---

## 3. Profile (`#/profile` — also reachable as `#/settings`)

A read-only summary card view of `config/profile.yml`. **To edit**,
go to **App settings → Profile tab** (`#/config` → Profile) — since
web-ui 1.32.0 that is a field-by-field form (Candidate / Narrative /
Compensation), not a raw-YAML blob. Saves merge into the same file;
this page re-parses on reload.

The fields that matter most:

- `candidate.full_name` — used in every prompt. **Replace the
  template `Jane Smith`** before scanning anything for real, or your
  generated cover letters will go out under the placeholder name.
- `candidate.email`, `linkedin`, `github` — referenced in cover-letter
  generation and the apply checklist.
- `target.roles` — accepted job titles. The scanner's positive filter
  uses this implicitly (via `portals.yml::title_filter`).
- `target.comp_total_min_usd` — minimum total comp. Section D of every
  evaluation flags offers below this.
- `target.archetypes` — the *most important field*. These are the
  career patterns you accept (e.g. `Tech-Lead-Backend`,
  `Founding-Engineer`, `Data-Platform`). Every JD is matched against
  them and the best-fit archetype lands in the report header.

The Health page surfaces a **Profile customized** check that fails as
long as `full_name` matches a known placeholder name.

---

## 4. CV (`#/cv`)

Single source of truth for every evaluation, deep research, and cover
letter. Lives in `cv.md` at the parent project root.

### Editing options

- **Paste it directly** — the textarea on the left is a markdown
  editor. The right-hand pane mirrors what the LLM (and your future
  recruiter) sees.
- **📁 Upload CV** — pick a local file in any of these formats and
  the server converts it to markdown for you:
  - **Text formats** — `.md`, `.markdown`, `.txt`, `.html`, `.htm`
    are passed through (HTML goes via pandoc → GFM markdown).
  - **Office formats** — `.docx`, `.doc`, `.odt`, `.rtf` are
    converted via **pandoc** (`brew install pandoc` on macOS,
    `apt install pandoc` on Linux).
  - **PDF** — `.pdf` is extracted via **pdftotext** from Poppler
    (`brew install poppler` / `apt install poppler-utils`).
  - The converted markdown lands in the editor; click **💾 Save**
    to persist. The result is sanitized (same XSS strip as paste).
  - Hard cap: **10 MB** per upload. Larger files → 413.
- **From LinkedIn** — easiest path: open Claude Code in the parent
  project, run `/career-ops`, paste your LinkedIn URL, and ask
  `extract my CV from this and write it to cv.md`.

### What gets sanitized

Server-side, every PUT to `/api/cv` runs through `stripDangerousMarkdown`:

- `<script>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`, `<style>`,
  `<form>` tags — removed entirely.
- Inline event handlers (`onclick=`, `onerror=`, etc.) — stripped.
- `javascript:`, `vbscript:`, `data:text/html` URI schemes — neutered.

The response includes `sanitized: true` whenever any of the above were
removed, so you know if the source had something nasty.

Max body size: 1 MB. Anything larger returns 413.

### Other buttons

- **sync-check** — runs `cv-sync-check.mjs` in the parent project.
  Flags inconsistencies: a project listed in your CV but not in
  `data/applications.md` archetypes, etc.
- **📄 Generate PDF** — streams `generate-pdf.mjs`. Output lands in
  `output/*.pdf`. Requires Playwright (Health page shows whether it's
  installed in the parent's `node_modules`). When generation finishes,
  the **newest** PDF is auto-downloaded to your default Downloads
  folder; the on-page list keeps every previously generated file.

### Tone / format tips

- One bullet = one accomplishment with a metric.
  *"Reduced p99 latency by 38%"* beats *"improved performance"* for
  every evaluation rubric.
- Sections in this order: **Summary** (3–5 lines), **Experience**
  (reverse-chronological), **Projects** (max 5), **Education**,
  **Skills** (deduplicated, no buzzword soup).
- Keep it under 1500 words. The scoring rubric uses dense info; a
  sprawling CV gets penalized for noise.

---

## 5. Portals & sources (`portals.yml`)

The scanner config lives in `portals.yml` at the parent root. Three
sections matter. The SPA's three sections (below) match the canonical
career-ops.org schema from
[scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
1:1.

> **Shortcut:** the `#/portals` URL now resolves straight to **App
> settings** and (when a regional source is configured) jumps to the
> **Regional sources** group — so a bookmarked or typed `#/portals`
> link no longer 404s (v1.42.0).

### `title_filter`

```yaml
title_filter:
  positive: [backend, engineer, senior, tech lead, golang, php]
  negative: [junior, intern, frontend, ios, android, java]
  seniority_boost: [Senior, Staff, Lead, Principal]
```

A scanned vacancy passes when its title contains **at least one
positive** keyword AND **none of the negative** keywords. Tune both.
Keywords are case-insensitive substrings.

`seniority_boost` is the third title-filter key. Keywords listed
here don't filter anything out — they push matching jobs higher in
the results so a "Senior Backend Engineer" lands above an "Engineer".
Default: `["Senior", "Staff", "Lead"]`. Tune to match how your
target roles are titled.

Start with 3–5 positive keywords for clarity; broaden later.

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

Filters scanned vacancies by their **location** string (case-insensitive
substring), applied by both the ATS sweep and the regional sweep.
Semantics, identical to the canonical career-ops `scan.mjs`:

- No `location_filter` key → every location passes (default).
- A vacancy with an **empty/missing** location → passes (missing data
  is not penalized).
- A `block` keyword match → **rejected** (block takes precedence over
  allow).
- `allow` empty → passes (block already cleared it).
- `allow` non-empty → must match **at least one** keyword.

Top-level key in `portals.yml` (a sibling of `title_filter`, not nested
under `russian_portals`). Use it to drop jobs that survived the
title filter but are in a region you can't take.

Start with 3–5 positive keywords for clarity; broaden later.

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

`search_queries` drive the AI-powered Option B scan (`/career-ops scan`
inside Claude Code / Codex). They are NOT executed by the in-process
`npm run scan` (which only hits public boards APIs). Use them when
you want to discover roles at companies not yet in
`tracked_companies`. Set `enabled: false` to keep an entry without
running it.

### `tracked_companies`

```yaml
tracked_companies:
  - { name: Stripe,     enabled: true, careers_url: https://job-boards.greenhouse.io/stripe }
  - { name: Linear,     enabled: true, careers_url: https://jobs.ashbyhq.com/linear }
  - { name: JetBrains,  enabled: true, careers_url: https://jobs.lever.co/jetbrains }
```

Required fields per entry: `name` and `careers_url`. Optional:
`api` (explicit Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday
endpoint), `enabled: true|false` to include/exclude without deleting
the entry. The ATS scanner detects the ATS from the URL pattern
(`job-boards.greenhouse.io/<slug>` → Greenhouse, etc.) and fetches each
company's public boards-api directly. Companies without a recognizable
ATS are skipped (the **Active Companies** card on `/#/scan` shows them
in gray with `○`).

### `rss` (RSS / Atom boards)

```yaml
tracked_companies:
  - { name: LaraJobs, enabled: true, provider: rss, rss: https://larajobs.com/feed }
  - { name: WeWorkRemotely, enabled: true, provider: rss, rss: https://weworkremotely.com/remote-jobs.rss }
```

Point the scanner at any job board that publishes an RSS/Atom feed (LaraJobs, WeWorkRemotely, RemoteOK, golangprojects, …) by adding an entry with `provider: rss` plus an `rss:` (or `feed_url:`) key — **no code changes**. The RSS adapter parses each `<item>` (CDATA + HTML entities, titles/companies tag-stripped), normalizes it to a job, and runs the same `title_filter` / `location_filter` + dedup + pipeline-append flow as ATS sources. **RSS** then appears as a selectable source in the `#/scan` filter dropdown. (web-ui v1.62.x)


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

`queries` are case-insensitive substring matches against vacancy titles
on hh.ru and Habr Career. **Be careful with overlap with the negative
list** — if `"Senior PHP"` is in `queries` but `"php"` ends up in
`title_filter.negative`, the scan will return zero results and the
console will warn you about the conflict.


### Configuring Russian portals — detailed setup guide

v1.29.0 ships 5 Russian-language adapters. Two need nothing more than the default UA (`habr-career`, HTML scrape; `trudvsem`, government open-data API — no key, no IP gate). Two are HTML scrapes of tech boards (`getmatch`, `geekjob` — also no key). One is the canonical hh.ru API which may 403 from non-Russian IPs unless you set a `HH_USER_AGENT` env var via **App settings → API keys & runtime** (or run the server from a Russian IP / VPN exit node).

#### Source inventory

| Source key | Display label | Type | Auth | Geo restriction |
|---|---|---|---|---|
| `hh` | hh.ru | JSON API | optional `HH_USER_AGENT` | non-RU IPs may 403 |
| `habr` | Habr Career | HTML | none | none |
| `trudvsem` | Trudvsem | JSON API (open-data) | none | none |
| `getmatch` | GetMatch | HTML | none | none |
| `geekjob` | GeekJob | HTML | none | none |

#### Step 1 — Open `portals.yml`

The file lives in the parent `career-ops/` root (NOT inside `web-ui/`). If it doesn't exist yet, copy the example shipped with the parent project:

```bash
# from the parent career-ops/ root (NOT web-ui/)
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

#### Step 2 — Enable all 5 sources

Add or update the `russian_portals` block to list every source you want to scan. The order in the array is irrelevant; the scanner walks them in registry order.

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

#### Step 3 — Tune queries and filters

`queries` are the strings the scanner uses to search each source. Each query runs once on every source — so 4 queries × 5 sources = 20 calls per scan. Keep the list focused (3–7 queries) to keep scan time under a minute. `area` is the hh.ru region code (other sources ignore it). `per_page` caps how many vacancies each source returns per query. `only_remote: true` filters every result to remote-only at the adapter level (the result table still has a separate Remote chip).

#### Common pitfalls

**Negative-list collision.** If a word from a query (`"php"`, `"senior"`) also appears in `title_filter.negative`, every result is filtered out before you see it. The scanner emits a stderr collision warning at scan time — look for the line `⚠ config: query "Senior PHP" contains "php" which is in the negative list`. Fix by removing the colliding word from `negative`:

```yaml
title_filter:
  positive: [backend, senior, lead, php, go, golang, python]
  negative: [junior, intern, frontend, ios, android]
russian_portals:
  queries:
    - "Senior PHP"     # OK — "php" no longer in negative list
    - "Senior Go"
```

#### Disabling one source temporarily

To disable a source without deleting its data, just drop its key from `sources`:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem"]   # only 3 of 5 sources will run
```

#### Verifying the setup

After saving `portals.yml`:

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

### CLI bootstrap flow ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

The canonical career-ops setup (run from the parent root once):

```bash
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

That's the entire bootstrap. Edit the three sections (`title_filter`,
`tracked_companies`, `search_queries`, optional `russian_portals`),
save, and you're ready to scan.

### SPA bootstrap behavior

On first run the server appends a documented `russian_portals:` block
to `portals.yml` if it's missing — idempotent (second boot is a no-op
because the literal `russian_portals:` line is now there). The English
sections are NOT auto-injected; they come from the
`templates/portals.example.yml` you copied per the canonical bootstrap
above.

---

## 6. Health (`#/health`)

Every setup gate, in OK / OPTIONAL / FAIL badges. Read this before
filing any "doesn't work" issue.

### Required checks (system can't function without these)

- `Node version` ≥ 18 — the server uses native `fetch` and
  `node:test`.
- `Project root` — that `CAREER_OPS_ROOT` (env or auto-detected)
  exists.
- `cv.md`, `config/profile.yml`, `portals.yml`,
  `data/applications.md`, `data/pipeline.md`, `modes/oferta.md`.

### Optional checks (warnings only)

- `Profile customized` — `candidate.full_name` is not the template
  placeholder.
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` — set in `.env`.
- `(server uses default UA)` — only matters if you scan hh.ru from outside Russia.
- `Playwright (parent node_modules)` — required for PDF generation
  and `check-liveness.mjs`. Install with
  `cd $CAREER_OPS_ROOT && npm install && npx playwright install chromium`.
- `Parent project dependencies` — `cd $CAREER_OPS_ROOT && npm install`
  if missing.
- `data/`, `reports/`, `output/`, `jds/` directories — auto-created on
  first write.

When the server is exposed beyond loopback (`HOST=0.0.0.0`) the
absolute paths and exact Node version are replaced with `"hidden"` in
the response so a curious neighbor can't fingerprint your install.

### Run buttons

- **▶ Doctor** runs `node doctor.mjs` and shows the output in a modal.
- **▶ Verify pipeline** runs `node verify-pipeline.mjs`.

---

## 7. Scan (`#/scan`)

The scanner crawls every enabled board, deduplicates against your
history, and writes hits into `data/last-scan.json` and
`data/pipeline.md`.

### One-click scan (SPA)

**🌐 Scan** runs every enabled source in a single sweep:

- Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (the ATS sweep) for every company in
  `tracked_companies` with a recognizable ATS URL.
- hh.ru API + Habr Career + Trudvsem + GetMatch + GeekJob for every query in `russian_portals`.

**Two phases, one click (v1.29.2).** The single 🌐 Scan button drives BOTH the ATS sweep and the regional sweep in one SSE stream. You'll see two phase headers in the log, in order:

1. `▶ ATS scan (Greenhouse + Ashby + Lever)` — EN ATS boards.
2. `▶ Regional scan (hh.ru + Habr Career)` — 5 RU sources from the registry.

Each phase ends with a `✓ done · NEW=N` summary. If you only see the ATS phase, your stand is on a pre-v1.29.2 build — upgrade. Pre-v1.29.2 the SSE client closed on the first `done` event and the regional phase was silently dropped (`tests/scan-stream-multi-phase.test.mjs` is the regression net).

Live SSE log streams to the right pane while the scan runs. Click
**Stop** (or just navigate away) to abort — the server cancels
in-flight HTTPS requests via `AbortController`.

### Filtering results

Below the log, the results table renders rows from `data/last-scan.json`.

Filters:

- **Free text** — substring match against title / company.
- **Source** dropdown — Ashby / GeekJob / Greenhouse / GetMatch / Habr Career / hh.ru / Lever / SmartRecruiters / Trudvsem / Workable / Workday.
- **Remote / Hybrid / Onsite** dropdown.
- **Stack chips** (PHP / Go / Backend / Senior / …) — auto-detected
  per row by `Skills.detectTech` and `Skills.detectLevel`. Multi-select
  intersection — selecting `PHP + Senior` shows rows that have BOTH.
- **Dynamic chips** below the static stack ones — top-25 most
  frequent capitalized tokens from titles, so the UI adapts to
  whatever roles you actually scan (marketing, design, finance…)
  instead of being locked to the backend-engineer vocabulary.

### Active Companies card

A collapsible card listing every company in `portals.yml` with its
scan status:

- ✓ green tag — direct API support (Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday).
- ○ gray tag — fallback to web-search prompt (no API match).

**Click the company name** → fills the results filter above with that
name. **Click the ↗ icon** → opens the company's `careers_url` in a
new tab.

### CLI scan flow ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

Two ways to scan from the CLI side (both deposit URLs to the same
`data/pipeline.md` that the SPA reads):

**Option A — direct script (~30 s, zero AI tokens):**

```bash
npm run scan                          # all Greenhouse/Ashby/Lever boards
npm run scan -- --dry-run             # preview without persisting
npm run scan -- --company Anthropic   # narrow to one tracked company
```

Works only for Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday (recognizable ATS URLs).
No AI tokens consumed — it hits the public boards APIs directly.

**Option B — AI-powered browser scan:**

```
/career-ops scan
```

Inside Claude Code / Codex / Cursor / Gemini CLI. Uses model tokens.
Visits each `tracked_companies` page directly and can discover non-API
boards (career pages, custom ATS, regional portals). Slower but
broader. Useful when an ATS sweep returns nothing for a target you
know is hiring.

**Output (both paths)** — new JD URLs appended to `data/pipeline.md`,
every visited URL logged to `data/scan-history.tsv` (dedup across all
future scans), summary printed: companies scanned · jobs found ·
filtered by title · duplicates skipped · new offers added.

**Action thresholds by score** (apply after `/career-ops pipeline`
batch-scores the new URLs):

| Score | Recommended next step |
|---|---|
| **≥ 4.5** | `/career-ops apply` — high fit, push immediately |
| **4.0 – 4.4** | apply, or `/career-ops contacto` for warm intro |
| **3.5 – 3.9** | `/career-ops deep` — research first |
| **< 3.5** | skip unless you have a specific personal reason |

The SPA's `#/dashboard` and `#/tracker` highlight every row at or
above 4.0 so you can pick action without re-running anything.

### Follow-up commands

After scoring, the canonical follow-ups are:

- `/career-ops apply` — Fill application with tailored answers
- `/career-ops contacto` — Draft LinkedIn / email outreach
- `/career-ops deep` — Research company / role deeply
- `/career-ops tracker` — View pipeline status

---

## 8. Pipeline (`#/pipeline`)

Inbox of URLs waiting to be evaluated. Lives in `data/pipeline.md`.

### Adding URLs

Three ways:

- Type / paste a URL into the input + click **+ Add**.
- Press **Ctrl+K** (or **Cmd+K**) to focus the global search, paste
  any `http(s)://…` link, hit **Enter** — the URL goes into the
  pipeline immediately.
- Run a Scan (see above) — fresh hits go to the pipeline
  automatically.

Every URL passes through `isValidJobUrl()` server-side. Loopback
(`localhost`, `127.0.0.1`), `file://`, `javascript:`, IP literals, and
strings with template chars (`<`, `>`, `"`) all 400.

### Server-side preview pane

Click any pipeline row to load a preview on the right. Most ATS boards
don't send CORS headers so the browser can't fetch them directly; the
server proxies the request, strips `<script>` / `<style>` / HTML tags,
and returns up to 8 KB of plain text.

The preview proxy walks redirects manually with **per-hop SSRF
validation** — every `Location` header runs through `isValidJobUrl()`
again, so a hostile board can't bounce you to loopback / private IP
/ `file://`. Capped at 3 hops, 15-second timeout.

### Row actions

- **▶** — jumps to `#/evaluate?url=…` with the URL pre-filled.
- **✕** — removes the URL from `data/pipeline.md`.

### Top-right buttons

- **⚡ Evaluate first** — opens the first queued URL on the Evaluate
  page, ready to score.
- **Scan** — back to the scanner if you want more URLs.

---

## 9. Evaluate (`#/evaluate`)

Scores a single Job Description against `cv.md` and
`config/profile.yml`. Returns a structured A–G evaluation per
`modes/oferta.md` plus a 0–5 score.

### Input

Paste the JD into the textarea, or arrive here from `#/pipeline` with
`?url=<href>` — the page fetches the URL through the same SSRF-safe
proxy used for pipeline previews and pre-fills the textarea.

Click **💾 Save JD** to persist the JD to `jds/jd-<date>-<ts>.txt`
for the audit trail (or pass `save: true` in the API call — same
effect).

### Fallback chain

1. **Anthropic** — preferred when `ANTHROPIC_API_KEY` is set. The
   server bundles `cv.md`, `config/profile.yml`, `modes/_shared.md`,
   and `modes/oferta.md` into a `<project_context>` block before the
   prompt (each file capped at 16 KB, full prompt soft-capped at
   200 KB). Returns grounded markdown directly to the page.
2. **Gemini** — when only `GEMINI_API_KEY` is set. Server spawns
   `gemini-eval.mjs` with the JD as a temp file. Free-tier model
   (`gemini-2.0-flash`) is fine for routine scoring.
3. **Manual** — no key set. The page returns a fully-formed prompt
   you can paste into Claude Code, ChatGPT, or any other LLM.

### Output sections (canonical career-ops.org A-F)

> **v1.15.0 realignment.** Block letters now match the
> [canonical career-ops.org schema](https://career-ops.org/docs).
> Pre-v1.15 reports used A–G (with `C=Risks`, `F=Verdict`,
> `G=Legitimacy`); we still render them as-is for backward
> compatibility, but new reports emit A–F with the canonical
> semantics below. Score and Legitimacy now live in the report
> header (`score: 4.2/5`, `legitimacy: High|Medium|Low`).

A. **Role Summary** — 3-bullet recap (risks called out inline).
B. **CV Match** — top 3 skills hit + top 3 missing.
C. **Strategy** — recommendation: apply now / contacto first /
deep first / skip. Was `Risks` before v1.15.
D. **Compensation** — relative to your
`target.comp_total_min_usd` (legacy) or `compensation.target_range`
(canonical).
E. **Personalization** — angle to lead with, framing per archetype,
hooks to mention in cover letter / outreach. Was `Application
Strategy` before v1.15.
F. **STAR stories** — 1–3 ready-to-paste S-T-A-R blocks tailored
to the role. Was `Verdict` (raw score) before v1.15; score now
appears in the report header alongside `legitimacy`.

### Saving the report

Click **💾 Save report** (or use the save toggle in the API call) to
persist the markdown to `reports/<date>-<company>-<role>.md`. The
report's parsed header (Score / Legitimacy / URL) appears on the
**Reports** page and the **Dashboard**.

### Batch-evaluate when you have 10+ JDs

For a single JD this `#/evaluate` page is the right tool. For 10+
URLs queued in the pipeline, the per-JD click-through is impractical
— jump to §14's **Batch evaluate** subsection (running
`./batch/batch-runner.sh` from the parent), let it churn through
overnight, then come back to `#/reports` / `#/tracker` for the
results. Full flow:
[batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers).

---

## 10. Reports (`#/reports`)

Browse every saved evaluation. Cards show title, date, legitimacy
flag, and score (color-coded: green ≥ 4.0, yellow ≥ 3.0, red below).

Click a card to read the full markdown. Pagination: 12 per page;
controls at the bottom.

The single-report view also has:

- **← All reports** — back to the grid.
- **🔗 Open JD** — opens the original job posting in a new tab.

---

## 11. Tracker (`#/tracker`)

The CRM. One row per application; lives in `data/applications.md` as a
GitHub-Flavored Markdown table.

### Status flow

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` /
`Rejected` / `Discarded` / `SKIP`.

The status whitelist is enforced server-side; sending anything else in
a `POST /api/tracker` defaults to `Evaluated`. The canonical
`Evaluated → Applied` transition is automatic when you confirm
`Submitted.` at the end of `/career-ops apply` (see §14).

### Column layout

| Column | What it is |
|---|---|
| `#` | Auto-numbered, zero-padded (`001`, `002`, …). |
| `Date` | ISO date (`YYYY-MM-DD`). Defaults to today. |
| `Company` | Free text. **Pipes (`\|`) and newlines are escaped automatically.** |
| `Role` | Same. |
| `Score` | `N/5` format (e.g. `4.2/5`). |
| `Status` | Whitelisted enum. |
| `PDF` | ✅ once `generate-pdf.mjs` succeeded for this row. |
| `Report` | Markdown link to the matching `reports/*.md`. |
| `Notes` | Free text, capped at 200 chars. |

### Filters

- **Status** dropdown.
- **Score** dropdown — `≥ 4.0` (high), `≥ 3.0` (mid), `< 3.0` (low).
- **Search** — substring match across company + role.

Every filter resets the paginator to page 1. 25 rows per page.

### Maintenance buttons

- **▶ Normalize** runs `normalize-statuses.mjs` — re-canonicalizes
  status spellings (`applied` → `Applied`, `interview` → `Interview`).
- **▶ Dedup** runs `dedup-tracker.mjs` — removes case-insensitive
  duplicates by `(company, role)`.
- **▶ Merge** runs `merge-tracker.mjs` — pulls in pending entries from
  `batch/tracker-additions/*.tsv` (where the parent's batch flow drops
  applications submitted via the Apply helper). Deduplicates and
  archives processed files to `batch/tracker-additions/merged/`. See
  [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  for the upstream batch flow.

### Adding rows

`POST /api/tracker` — body `{ company, role, score?, status?, url?,
reportSlug?, notes?, date? }`. Dedup by `(company, role)`
case-insensitive. From the UI, the Evaluate page offers an "Add to
tracker" button after a successful score.

---

## 12. Deep research (`#/deep`)

Generate a structured company brief: snapshot, engineering culture,
recent news, Glassdoor sentiment, interview process, negotiation
leverage points, three smart questions to ask the recruiter.

### Input

Two fields — company name and (optional) role. The mode template
(`modes/deep.md`) is what shapes the structure.

### Output paths

Same fallback chain as Evaluate:

1. **Anthropic live** (preferred) — `bundleProjectContext` inlines
   cv + profile + `_shared.md` + `deep.md`. Output: 10–30 KB of
   grounded markdown saved to
   `interview-prep/<company>-<role>.md`.
2. **Gemini live** — `gemini-eval.mjs` invocation. Same save target.
3. **Manual prompt** — the page hands you a ready prompt for Claude
   Code (which has WebFetch + WebSearch and can do real research).

### Tips

- Anthropic on `claude-sonnet-4-6` typically returns ~13 KB of useful
  text in 1–3 minutes per call.
- The Anthropic SDK has no built-in web search. For roles where you
  need fresh news + Glassdoor sentiment, paste the manual prompt into
  Claude Code and let it use its WebFetch tool.
- Live runs are billed; one Sonnet 4.6 deep-research call costs ≈
  $0.30–0.50.

---

## 13. Mode prompts (the seven `/#/<mode>` pages)

Seven prompt builders: **Project** ideas, **Training** plans,
**Follow-up** emails, **Batch** evaluations, **Outreach** to
recruiters, **Interview prep** one-pagers, and **Patterns**
retrospectives. Each one wraps a specific `modes/<slug>.md` template:

| Page | Slug | Purpose |
|---|---|---|
| `#/project` | `project` | Tailor a portfolio project for a target role. |
| `#/training` | `training` | Skill-gap analysis → curriculum. |
| `#/followup` | `followup` | After-interview email draft. |
| `#/batch` | `batch` | Multi-JD batch evaluation prompt. |
| `#/contacto` | `contacto` | Outreach message to a recruiter / referral. |
| `#/interview-prep` | `interview-prep` | One-pager prep for a specific interview round. |
| `#/patterns` | `patterns` | "What patterns made me successful?" reflective analysis. |

### Shared shape

Each page has a small form (the fields are mode-specific), a **▶
Generate prompt** button (manual), and — when an Anthropic or Gemini
key is present — a **⚡ Run live** button that promotes to primary.

Clicking **▶ Generate prompt** returns the assembled prompt with your
form values JSON-stringified into a `User-supplied context:` block,
followed by the verbatim `modes/<slug>.md` template. Copy and paste
into your LLM of choice.

Clicking **⚡ Run live** sends the same prompt to Anthropic (or
Gemini), with `cv.md` + `profile.yml` + `_shared.md` inlined via
`bundleProjectContext`. Result is rendered on the page, copyable, and
downloadable as `.md`.

The seven pages are an explicit allowlist — modes that have a
dedicated route (`oferta` → Evaluate, `deep` → Deep research) and
modes the parent project supports only inside Claude Code (`apply`,
`scan`, `pipeline`, `tracker`, `pdf`, `latex`, `ofertas`,
`auto-pipeline`) deliberately stay off this UI.

---

## 14. Apply checklist (`#/apply`)

Once you've decided to apply, this Apply helper page generates a
submission checklist for the actual application step. It does **NOT** auto-fill
forms — that flow stays in `/career-ops apply` inside Claude Code,
which uses Playwright in the parent project.

### SPA checklist mode (`#/apply`)

The SPA's checklist is for users who prefer to fill the form by hand
without invoking Playwright. It covers:

0. Run `/career-ops apply <url>` in Claude Code to read the form via
   Playwright (skip this step if you're filling by hand).
1. Verify the posting is still live (`check-liveness.mjs`).
2. Confirm CV is the latest (`cv-sync-check.mjs`, then PDF if score ≥ 4.0).
3. Tailor the cover letter / "Why us?" answer using STAR+R proof
   points from `cv.md`.
4. Answer EEO / sponsorship / start-date questions truthfully.
5. Save filled answers to
   `interview-prep/{company}-{role}.md` before submitting.
6. **NEVER auto-submit** — you (the human) click the final button.
7. After submit: add row to `data/applications.md` (or write TSV to
   `batch/tracker-additions/`).

### Manual fill vs Playwright-assisted

Two routes for the actual submission:

- **Manual** — open the careers page in a normal browser tab, follow
  the SPA checklist above, copy/paste answers. No Playwright needed.
  Use when the form is short or you don't have Chromium installed.
- **Playwright-assisted** — run `/career-ops apply <company>` in
  Claude Code (parent project). Playwright opens its own browser,
  reads every form field, returns numbered draft answers. You still
  click Submit. Use when the form is long, dynamic, or you want the
  audit trail of which questions had which answers.

### Full CLI apply flow ([apply-for-a-job](https://career-ops.org/docs/introduction/guides/apply-for-a-job))

**Prerequisites:**

1. Run `/career-ops pipeline` first so the JD has an evaluation report
   under `reports/`. The apply command depends on an existing
   evaluation; without one, run the pipeline initially.
2. Have the report and profile loaded.
3. **Recommended:** Playwright installed
   (`npx playwright install chromium` — see Playwright Setup below).
   Falls back to WebFetch (text-only form preview, no click-fill) when
   missing.

**Numbered flow** (canonical 8 steps):

1. **Run the command** with the company name:

   ```
   /career-ops apply <company>
   ```

   Example: `/career-ops apply Anthropic`. Without an argument, supply
   a screenshot of the form, the form text pasted, or the application
   URL on the next turn.

2. **Locate the report.** The system finds the matching evaluation in
   `reports/` (the one created by `/career-ops pipeline` or
   `#/evaluate` earlier).

3. **Open the form.** Playwright launches a browser window
   **automatically** — you do NOT open it yourself.

4. **Read the fields.** The system reads and parses every form field
   (label, type, required, options for selects).

5. **Generate answers.** career-ops creates tailored responses for each
   field based on your profile, proof points, and the role.

6. **Return numbered list.** You receive answers ordered to match the
   form layout — simple fields (name, email) first, free-text fields
   (cover letter, "Why us?") last. Flagged items point at things
   needing human attention — salary anchor, missing résumé details,
   optional questions.

7. **Manual filling.** You copy and paste each answer into the
   corresponding field. This step is manual, not automated. You
   review every answer first.

8. **User submits.** You click Submit yourself. career-ops **never**
   clicks Submit. Confirm completion by typing in chat:

   ```
   Submitted.
   ```

**Automatic updates on `Submitted.`:**

- Status flips `Evaluated → Applied` in `data/applications.md`.
- The filled answers persist in Section G of the report for future
  reference.

**Handoff to tracker:**

```
/career-ops tracker
```

Monitor your entire pipeline's status, regardless of role score.

### Batch evaluate ([batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers))

When you've got 10+ JDs to score at once (the SPA's one-at-a-time
`#/evaluate` is impractical for that volume), use the batch runner
from the CLI.

**Input file — `batch/batch-input.tsv`** (tab-separated):

| Column | Purpose |
|---|---|
| `id` | Unique sequential number |
| `url` | Full job posting link |
| `source` | Origin platform (LinkedIn, Greenhouse, etc.) |
| `notes` | Optional contextual detail |

Example row:

```
1<TAB>https://jobs.example.com/senior<TAB>LinkedIn<TAB>
```

**`./batch/batch-runner.sh` flags:**

- `--dry-run` — Preview pending offers without evaluation. Always run
  this first to validate the TSV.
- `--parallel N` — Run N workers simultaneously (1, 2, or 3
  recommended).
- `--min-score X.X` — Skip persisting offers scoring below the
  threshold. Useful to only keep reports for high-fit roles.
- `--retry-failed` — Reprocess only the offers that errored on the
  previous run (network failures, rate limits).
- `--max-retries N` — Attempt failed offers up to N times (default: 2).
- `--model NAME` — Claude model passed to `claude -p --model` (parent career-ops 1.8.0, #504). Unset = your Claude Max subscription default. Use a cheaper model for large batches, e.g. `claude-sonnet-4-6`. Surfaced in `#/batch` as the **Model** input (web-ui 1.31.0).
- `--start-from N` — Skip offer IDs below N (resume a partially-processed batch). Surfaced in `#/batch` as the **Start from #** input (web-ui 1.31.0).

**Standard sequence:**

1. **Edit** `batch/batch-input.tsv` — one row per JD.

2. **Dry-run** (recommended first):

   ```bash
   ./batch/batch-runner.sh --dry-run
   ```

3. **Run** — sequential or parallel:

   ```bash
   ./batch/batch-runner.sh                       # one at a time
   ./batch/batch-runner.sh --parallel 2          # two concurrent
   ./batch/batch-runner.sh --parallel 3          # three concurrent
   ./batch/batch-runner.sh --parallel 2 --min-score 4.0  # only persist high-fit
   ```

4. **Retry failures** (network / rate-limit):

   ```bash
   ./batch/batch-runner.sh --retry-failed --max-retries 3
   ```

5. **Reports** land in `reports/` as
   `{id}-{company}-{YYYY-MM-DD}.md`. Summary rows append to
   `batch/tracker-additions/`.

6. **Merge into tracker:**

   ```bash
   node merge-tracker.mjs                 # apply the batch additions
   node merge-tracker.mjs --dry-run       # preview the merge
   ```

   The merge command deduplicates entries and archives processed files
   to `batch/tracker-additions/merged/`.

The SPA surfaces the resulting reports under `#/reports` (paginated,
score-pill colored) and the tracker rows under `#/tracker` — exactly
as if you'd added each one through `#/evaluate`. Pair with the
**▶ Merge** maintenance button on `#/tracker` if you prefer not to
drop to the CLI.

### Playwright setup ([set-up-playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright))

Required for two career-ops features:

- **Form-fill** in `/career-ops apply` (step 3 above — Playwright
  opens the browser, reads field labels, suggests answers).
- **PDF generation** via `/career-ops pdf` and the SPA's
  **📄 Generate PDF** button on `#/cv` / `#/reports/:slug` /
  `#/evaluate` / `#/deep` / `#/interview-prep`.

**Fallback when Playwright is missing:** the apply flow falls back to
WebFetch (text-only form preview, no click-fill). PDF generation
simply errors.

**Core setup (run from the career-ops parent root):**

```bash
# Install Chromium for Playwright
npm install
npx playwright install chromium

# Register the Playwright MCP so Claude Code can drive forms
claude mcp add playwright npx @playwright/mcp@latest

# Verify all three components (Chromium, Playwright lib, MCP)
npm run doctor
```

**Alternative MCP registration** — add to
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

**Behavior notes:**

- **Headless by default.** Playwright operates silently. To watch the
  browser in action, tell Claude `open up with playwright the browser
  and fill out the entire form.`
- **Three roles in one package** — the Playwright npm install gives
  you the browser-automation library, the PDF rendering engine for
  `/career-ops pdf`, and (via the MCP) the form-fill workflow inside
  Claude Code.
- **Verify before relying on it** — `npm run doctor` confirms all
  three are operational. The SPA's Health page surfaces a
  `Playwright (parent node_modules)` check that fails fast if missing.

---

## 15. Interview preparation

This is the post-research, pre-interview phase. Three artifacts in
this app converge:

1. **Saved deep-research files** under `interview-prep/`, one per
   company-role pair you ran. Browse from the **Deep research** page
   or directly via `/api/interview-prep`.
2. **Patterns mode** (`#/patterns`) — generates a self-reflective
   prompt: "across my last N interviews / offers / rejections, what
   patterns hold?" Useful when you've accumulated 5+ tracker rows.
3. **Interview-prep mode** (`#/interview-prep`) — pre-fills a
   one-pager for a specific upcoming round (behavioral, technical,
   system design). Output goes into the same `interview-prep/`
   folder.

### Recommended workflow

For each interview you have on the books:

1. **Re-run Deep** (or open the saved file) the day before.
2. **`#/interview-prep`** — generate a one-pager for the specific
   round. Paste into your notes.
3. **System design / coding rounds** — open `#/training` and ask for
   a 30-minute targeted refresher on the specific subsystem the JD
   emphasizes.
4. **Compensation rounds** — open the deep-research file, jump to
   "Negotiation leverage points." Bring 2–3 specific data points
   (Glassdoor band, recent funding, comparable offer at another
   company).
5. **Behavioral rounds** — pull STAR+R stories from your `cv.md` that
   land in section B of the original Evaluate report.

After the interview, immediately:

1. Update the tracker row: status → `Responded` (then `Interview`,
   `Offer`, etc.).
2. Run `#/followup` to draft the thank-you email.
3. If you got new intel (compensation range, team makeup, tech stack
   surprise), edit the saved `interview-prep/<company>-<role>.md`
   with `## Post-round notes` so future-you has it.

---

## 16. Activity log + Troubleshooting

### Activity log (`#/activity`)

Audit trail of every state-changing request hitting the server.
Records: pipeline adds, tracker writes, CV saves, JD saves, evaluate
runs, deep-research runs, scan runs, config changes, mode runs.

Secrets (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) are redacted on the
way in; you'll never see a real key value in `data/activity.jsonl`.

Filter by action prefix (`pipeline.`, `cv.`, `evaluate`, `scan.`,
etc.). 25 rows per page; server returns up to 500 most-recent
events.

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Health page red on `cv.md` | First run, file doesn't exist yet | `touch $CAREER_OPS_ROOT/cv.md` then refresh. |
| Health red on `Profile customized` | `candidate.full_name` still says `Jane Smith` | Edit `config/profile.yml`. |
| `hh.ru: HTTP 403` in scan log | Non-Russian IP, no `(server uses default UA)` | Register at `dev.hh.ru/admin`, set a Russian IP / VPN. |
| `gemini-eval.mjs: ERR_MODULE_NOT_FOUND` | Parent project deps not installed | `cd $CAREER_OPS_ROOT && npm install`. |
| Generate PDF errors | Playwright not installed in parent | `cd $CAREER_OPS_ROOT && npx playwright install chromium`. |
| `/career-ops apply` says "no report found" | Pipeline never scored this JD | Run `/career-ops pipeline` (or `#/evaluate`) first; see §14 prerequisites. |
| `batch-runner.sh: no such file` | Running from wrong directory | `cd $CAREER_OPS_ROOT` before invoking `./batch/batch-runner.sh`. |
| Server reports `EADDRINUSE: 4317` | Old instance still running | `pkill -f 'node server/index.mjs'` then restart. |
| Live LLM call hangs > 2 min | Prompt huge or Anthropic slow | Check `/api/health` Anthropic flag; the server soft-caps prompts at 200 KB and returns 413. |
| Pipeline preview shows `(unsafe redirect)` | Posting redirected to a private IP / loopback | This is a security feature (REVIEW-B1). The redirect target is rejected and the original URL is unchanged. |
| Tracker row text breaks the table | Pipe in company name pre-v1.9.1 | Update to v1.9.1+ — pipes are escaped end-to-end (BF-1). |
| `npm test` fails on fresh clone | Tests assume parent project layout | Use `CAREER_OPS_ROOT=$(mktemp -d)` and bootstrap fixtures. |

For deeper diagnostics: run **▶ Doctor** on the Health page, copy the
output, and search the issue tracker on
<https://github.com/Fighter90/career-ops-ui/issues>.


---

## 17. How to add a new job-portal source

career-ops-ui treats each job board as an **adapter** — a single file under
[`server/lib/sources/<slug>.mjs`](../../server/lib/sources/) that knows
how to fetch + normalize one board's results. v1.29.0 ships with 11
adapters (6 English ATSes, 5 Russian boards). Adding a 12th is three
short edits in this repo + one line in the parent's `portals.yml`.

### Step 1 — Write the adapter

Create `server/lib/sources/<slug>.mjs`. Two patterns work depending on
whether the source has a JSON API or only renders HTML:

**API-backed source** (cleanest — use this whenever the site has an
open data endpoint):

```js
// server/lib/sources/example.mjs
const ENDPOINT = 'https://example.com/api/v1/vacancies';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...';

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

**HTML-scrape source** (when there is no API — see
[`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) and
[`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) for full examples):

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

Two contracts every adapter MUST honor:

- **Accept `{ onlyRemote, fetchImpl, signal }` in `opts`.** `fetchImpl`
  is what makes adapters testable without network; `signal` is required
  for client-disconnect propagation (REVIEW-B3).
- **Return records with the common shape** —
  `{ id, title, company, url, salary, location, isRemote, workplaceType,
  relocates, date, snippet, source }`, where `source` matches the
  registry `value`.

### Step 2 — Add a row to the registry

Open [`server/lib/sources/registry.mjs`](../../server/lib/sources/registry.mjs)
and add one entry:

```js
export const SOURCES = [
  // …existing entries…
  { value: 'example', label: 'Example.com', region: 'ru', configKey: 'example' },
];
```

- `value` MUST match `job.source` from your adapter.
- `region: 'en'` joins the ATS sweep (auto-discovers from
  `tracked_companies` URL patterns); `region: 'ru'` joins the regional
  dispatcher.
- `configKey` (only for `region: 'ru'`) — the key the user lists in
  `portals.yml::russian_portals.sources`.

### Step 3 — Wire into the dispatcher (RU only)

EN ATS sources auto-discover from `tracked_companies` URL patterns —
no further wiring needed. For RU sources, open
[`server/lib/ru-scanner.mjs`](../../server/lib/ru-scanner.mjs), find
the `RU_DISPATCH` table, and add a row:

```js
import { searchExample } from './sources/example.mjs';
// …
const RU_DISPATCH = {
  // …existing…
  example: { label: 'example.com', search: searchExample },
};
```

The dispatcher loop calls `entry.search(query, opts)` for every key
present in `cfg.sources`. No further code change needed.

### Step 4 — Test (mocked, never live)

Drop a file under `tests/sources-<slug>.test.mjs`. Real network is
**forbidden** in tests (CI-isolation contract):

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

### Step 5 — Enable in your `portals.yml`

The parent project's `portals.yml` is the user-owned config. Add the
new source's `configKey` to the array:

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

Reload `#/scan` in the browser. The source-filter dropdown picks the
new entry up automatically (single source of truth via
[`GET /api/scan/sources`](../../server/lib/routes/scan.mjs) →
[`registry.mjs`](../../server/lib/sources/registry.mjs)). The
🌐 Scan button now includes the new source on every regional sweep.

### Reference adapters (mirror these for new sources)

| Adapter file | Type | Notes |
|---|---|---|
| [`hh.mjs`](../../server/lib/sources/hh.mjs) | JSON API | Canonical RU API adapter; geo-aware UA fallback. |
| [`trudvsem.mjs`](../../server/lib/sources/trudvsem.mjs) | JSON API | Russian government open-data; no IP gate. |
| [`habr.mjs`](../../server/lib/sources/habr.mjs) | HTML scrape | Russian tech board; regex-based card parser. |
| [`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) | HTML scrape | Defensive parser, `[]` on parse miss. |
| [`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) | HTML scrape | Same defensive style as GetMatch. |
| [`greenhouse.mjs`](../../server/lib/sources/greenhouse.mjs) | JSON API | Canonical EN ATS adapter; uses `tracked_companies` URL pattern. |

### Common pitfalls

- **`source` field mismatch.** The string written by your adapter MUST
  match the `value` in `registry.mjs` exactly. If they drift, the
  `#/scan` filter dropdown will show the source but selecting it will
  filter out every row (because the equality check is `r.source === fs`).
- **Throwing on parse failure.** HTML scrapers MUST return `[]` on a
  healthy 200 with no parseable cards. Throwing breaks the multi-source
  dispatcher loop — one bad HTML structure kills every other source for
  the same query.
- **Forgetting `fetchImpl` / `signal`.** Without them, your adapter
  cannot be unit-tested without hitting live network, and client
  disconnects don't propagate (background fetch stays alive after the
  user closes the tab).
- **Trusting `tracked_companies` for RU.** That list is for EN ATS
  sources only. RU adapters drive themselves from
  `russian_portals.queries` instead — no per-company entries.

---

## 18. Notifications (🔔 in the top bar)

> v1.58.34 — every toast that appears in the bottom-right corner is also captured
> into an in-memory journal (cap 50, oldest dropped). Click the 🔔 bell in the
> top bar to open the right-slide **Notifications** drawer and re-read anything
> you missed. The journal is per-tab, per-session — closing the tab clears it.

The drawer **only opens when you click the bell** (or activate it with Enter /
Space when it's keyboard-focused). It never appears on its own. The red badge on
the bell counts entries you haven't seen since the last open; opening the drawer
clears the badge.

### Notification categories

| Category | When it fires | Visual cue |
|---|---|---|
| **Success** | `Saved`, `Copied`, `Refreshed`, scan complete, CV imported, apply-checklist actions ("Copied unchecked", "Reset"), profile saved, pipeline URL added | green left border in the drawer; green toast background |
| **Error** | URL validation failure (must start with `http://` / `https://`, no script/template characters), API errors with the `(METHOD /path · HTTP NNN)` postfix, network failures (server down), pipeline-400 duplicates, doctor / verify-pipeline non-zero exit | red left border; red toast background; technical postfix tucked into the `Details` `<details>` block (U-4 / v1.58.24) |
| **Info / progress** | `Running doctor.mjs…`, `Running verify-pipeline.mjs…`, `Refreshing…`, `Loading…`, `Generating prompt…`, scan progress lines | grey left border; default toast background |

Every drawer entry shows:

- **Timestamp** (`HH:MM:SS` localized to the active SPA language).
- **Message** (the human sentence, with the technical postfix stripped from the headline per U-4).
- **Details** (when present — the API call's `(METHOD /path · HTTP NNN)` postfix or any other technical aside, monospace).

### What is NOT a notification

- The Doctor / verify-pipeline **result modal** (full stdout / stderr) — that's a modal, not a toast, and not journaled.
- SSE log lines on `#/scan` and `#/auto` — those stream into the page body, not into the toast pipeline.
- Spinner-only loading states (those use `UI.withSpinner` without a toast).

### Keyboard

- **Click** or focus + **Enter / Space** on the bell → opens the drawer.
- **Esc**, click the **×** close button, or click the bell again → closes the drawer; focus returns to the bell.
- **Tab** while the drawer is open → moves through the close button and any focusable details inside; the drawer is `aria-modal="false"`, so Tab does not trap (you can still reach the rest of the page).


## 19. Localizing the app into your language

The interface ships in 9 languages (English, Español, Français, Português, 한국어, 日本語, Русский, 简体中文, 繁體中文). Every on-screen label comes from a translation dictionary, and you can add or correct a language without touching the app logic.

**Where the translations live.** Since v1.60.0 each language is its own file under `public/js/lib/locales/` — `i18n-dict.en.js`, `i18n-dict.es.js`, `i18n-dict.ru.js`, and so on — a simple list of `'key': 'text'` pairs. A shared `i18n-dict.aliases.js` lets keys that must always read identically (a sidebar label and its page title) point at one translation. `i18n-dict.js` merges them all at page load; you never edit it.

**Fix or add a phrase.** Open the file for your language, find the key (e.g. `'nav.scan'`) and edit the text. To add a brand-new label, add the same key to **all 8** language files with the translated value, then reference it in the page via `t('your.key')`. Run `npm test` — it fails if any language is missing the key, so nothing ships half-translated.

**Add a whole new language.** Copy `i18n-dict.en.js` to `i18n-dict.<code>.js`, translate every value, then register the code in `i18n.js` (the language list + browser auto-detect), in the `i18n-dict.js` assembler, and add a `<script>` line in `index.html`. The full checklist — including the test snapshot and the help / README companion files — is in `docs/LOCALIZATION.md`.

**Good to know.** The language switcher is in the sidebar footer; your choice is remembered per browser. Server diagnostic messages stay in English on purpose (so logs read consistently) — only the on-screen interface is translated.

See **`docs/LOCALIZATION.md`** in the repository for the complete, step-by-step localization guide.
