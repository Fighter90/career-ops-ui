# career-ops — canonical reference

> **Synthesized from <https://career-ops.org/docs> (fetched 2026-05-12).** This file is the single source of truth that the help bundles and READMEs translate into 8 languages. When career-ops.org/docs changes, **regenerate this file first**, then re-sync the bundles.

## 1. What career-ops is

An open-source job-search system that runs as commands inside an AI coding CLI (Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot CLI). Model-agnostic. The CLI evaluates each posting against your CV using a structured rubric, generates tailored PDF resumes, and tracks every application locally.

### Problem it solves

Eliminates the manual tracking-via-spreadsheets / cover-letters-from-scratch loop and enforces a consistent rubric across every offer, without cloud accounts or data leaving the machine.

### Defining principles

- **Open source, seriously** — MIT-licensed, no paid tier, no waitlist, no telemetry, no accounts.
- **Data sovereignty** — `cv.md`, `config/profile.yml`, `data/`, `reports/`, `interview-prep/` never leave the laptop unless the user explicitly pushes them.
- **Human-controlled submissions** — the system drafts answers and opens the form, but **the user clicks Submit**. career-ops never auto-applies.
- **Structured search focus** — designed for an active, deliberate job hunt; not a recommendation engine.

### Key concepts

| Concept | What it is |
|---|---|
| **Mode** | A prompt template under `modes/<slug>.md`. The CLI applies the active mode's rubric. Built-in: `oferta` (evaluate one JD), `deep` (company brief), `apply`, `pipeline`, `batch`, `contacto`, `followup`, `interview-prep`, `patterns`, `project`, `training`. |
| **Archetype** | A target-role profile in `config/profile.yml` that the JD matcher uses. Most-important field; the rubric weights skill matches against the active archetype. |
| **Pipeline** | The inbox of pending JD URLs (`data/pipeline.md`). Each line is one URL waiting to be evaluated. |
| **Tracker** | The historical log of every evaluation + application status (`data/applications.md`, GFM markdown table). |
| **Report** | A full A–G scored evaluation per JD, saved to `reports/<NNN>-<company>-<DATE>.md`. |
| **Scan history** | Append-only log of every scanned URL (`data/scan-history.tsv`); used for dedup across future scans. |
| **Scoring rubric** | Six-dimension 0.0–5.0 score with explicit action thresholds (see §5 below). |

## 2. Onboarding (first run)

1. **Prerequisites.** Node.js ≥ 18, Git, and at least one AI coding CLI installed.
2. **Clone career-ops.** `git clone https://github.com/Fighter90/career-ops.git && cd career-ops`.
3. **Create `cv.md`** — paste / convert your résumé into clean markdown. Concrete metrics (`"reduced p99 by 38%"`, not `"improved performance"`).
4. **Fill `config/profile.yml`** — name, email, location, target archetypes (**most important field**), salary band.
5. **Fill `portals.yml`** — `cp templates/portals.example.yml portals.yml`. Customize three sections: title filter, tracked companies, search queries.
6. **(Optional) `modes/_profile.md`** — adaptive framing for the archetypes.
7. **(Optional)** Add `GEMINI_API_KEY` and/or `ANTHROPIC_API_KEY` to `.env` for live evaluations. Without keys the CLI falls back to copy-paste prompts.

## 3. Scanning job portals

> Source: `/docs/introduction/guides/scan-job-portals`.

### Configuration: `portals.yml`

Three sections:

**Title filter** — `positive`, `negative`, `seniority_boost` keyword lists. Match is case-insensitive. A role needs ≥ 1 `positive` match to proceed; any `negative` match excludes immediately. `seniority_boost` ranks higher without filtering. Start with 3–5 positive keywords.

**`tracked_companies`** — every entry MUST have `name` and `careers_url`. Optional: `api` (Greenhouse / Ashby / Lever endpoint), `enabled: true|false` to include/exclude without deletion.

**`search_queries`** — pre-built broader web searches. Default set works for most users.

### Run the scan

**Option A — Direct script (~30 s, no AI tokens).** `npm run scan` (or `--dry-run` / `--company Anthropic`). Works for Greenhouse / Ashby / Lever boards only.

**Option B — AI-powered browser scan.** `/career-ops scan` in the CLI. Uses LLM tokens; visits each page; supports non-API companies and discovery beyond `tracked_companies`.

### Output

- New JD URLs appended to `data/pipeline.md`.
- Every visited URL logged to `data/scan-history.tsv` (dedup across future scans).
- Summary stats printed: companies scanned, jobs found, filtered out by title, duplicates skipped, new offers added.

## 4. Evaluating a JD (single + batch)

> Source: `/docs/introduction/guides/batch-evaluate-offers`.

### Single

In career-ops CLI: paste a JD URL or text. The `oferta` mode runs the rubric and writes `reports/<NNN>-<company>-<DATE>.md`. Score 0.0–5.0 + Legitimacy (the rubric checks for posting freshness, contradictions, and known scam patterns).

In `career-ops-ui`: open `#/evaluate`, paste the JD, click Evaluate. With `ANTHROPIC_API_KEY` set the SPA runs Anthropic; with `GEMINI_API_KEY` it falls back to Gemini; otherwise it returns a copy-paste prompt.

### Batch (10+ offers at once)

1. Edit `batch/batch-input.tsv` with columns `id | url | source | notes` (tab-separated).
2. Preview: `./batch/batch-runner.sh --dry-run`.
3. Run: `./batch/batch-runner.sh` (sequential) or `--parallel 2` / `--parallel 3` (concurrent). Optional `--min-score 4.0` filter.
4. Retry failures: `./batch/batch-runner.sh --retry-failed [--max-retries 3]`.
5. Reports land in `reports/`; summary rows in `batch/tracker-additions/`.
6. Merge into tracker: `node merge-tracker.mjs` (or `--dry-run`).

## 5. Action thresholds (score → next step)

| Score | Recommended next step |
|---|---|
| **≥ 4.5** | Run `/career-ops apply` — high-fit, push immediately. |
| **4.0 – 4.4** | Apply, or `/career-ops contacto` for warm intro first. |
| **3.5 – 3.9** | Run `/career-ops deep` — research the company / role before deciding. |
| **< 3.5** | Skip unless you have a specific personal reason. |

career-ops-ui's `#/dashboard` and `#/tracker` highlight every row at or above 4.0 so the user can pick action without re-running anything.

## 6. Applying for a job

> Source: `/docs/introduction/guides/apply-for-a-job`.

1. **Run** `/career-ops apply <company>` (or just `/career-ops apply` and provide screenshot / pasted form text).
2. **Playwright** opens a browser window and reads the form. The user does NOT open the browser manually.
3. The CLI returns a **numbered draft answer list** matching the form's field order. Each answer is sourced from the evaluation report's proof points and STAR stories.
4. The CLI flags items that need user attention — salary anchor, missing résumé fields, optional questions.
5. **The user reviews every answer and clicks Submit themselves**. career-ops never clicks Submit.
6. User types `Submitted.` back in chat.
7. Tracker status flips `Evaluated → Applied` in `data/applications.md`; answers persist in the report's Section G.
8. View pipeline status: `/career-ops tracker`.

In career-ops-ui: `#/apply` generates the same checklist text. The Playwright form-fill itself stays inside the CLI — the SPA's role is to surface the checklist for review.

## 7. Playwright setup

> Source: `/docs/introduction/guides/set-up-playwright`.

Required for the `/career-ops apply` form-fill flow and for `📄 Generate PDF` in career-ops-ui. Falls back to WebFetch (text-only) when missing.

1. `npm install` in the career-ops root.
2. `npx playwright install chromium` (one-time per host).
3. `claude mcp add playwright npx @playwright/mcp@latest` — registers the Playwright MCP with Claude Code so the CLI can drive forms.
4. Verify: `npm run doctor`.

Alternative MCP registration via `.claude/settings.local.json`:

```json
{ "mcpServers": { "playwright": { "command": "npx", "args": ["-y", "@playwright/mcp@latest"] } } }
```

## 8. career-ops vs career-ops-ui

| | career-ops (CLI) | career-ops-ui (this repo) |
|---|---|---|
| **Where it runs** | Inside Claude Code / Codex / Cursor / Gemini CLI | `http://127.0.0.1:4317` in your browser |
| **Primary surface** | `/career-ops <mode>` slash commands | Sidebar with one page per workflow |
| **Form fill** | Yes, via Playwright MCP | No — generates the checklist; submission stays in the CLI |
| **PDF generation** | `generate-pdf.mjs <input.html> <output.pdf>` | `📄 Generate PDF` button on `#/cv`, `#/reports/:slug`, `#/evaluate`, `#/deep`, `#/interview-prep` |
| **Data files** | Reads + writes the parent project's files | Reads on every render; writes only on explicit POST/PUT actions |

career-ops-ui is **pure additions**. Nothing inside `career-ops/` changes. Both surfaces share the same `cv.md`, `config/profile.yml`, `portals.yml`, `data/`, `reports/`, `interview-prep/`, `modes/`.
