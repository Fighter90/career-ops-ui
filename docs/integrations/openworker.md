# OpenWorker coworker

career-ops-ui (and the `career-ops` engine underneath it) can be driven end-to-end from **[OpenWorker](https://github.com/andrewyng/openworker)** — Andrew Ng's open-source, local-first AI coworker desktop app ([openworker.com](https://openworker.com), see the [roster](https://openworker.com/#roster)). The integration is a **coworker** (an OpenWorker *persona*): a single Markdown file that steers the OpenWorker agent to run the job-search pipeline. It ships **no code** — per OpenWorker's install note, "no third-party code runs, but the instructions steer the coworker."

- **Repo:** [`Fighter90/career-ops-coworker`](https://github.com/Fighter90/career-ops-coworker)
- **The coworker file:** [`career-ops.md`](https://github.com/Fighter90/career-ops-coworker/blob/main/career-ops.md)
- **User guide (17 languages):** [`help/`](https://github.com/Fighter90/career-ops-coworker/tree/main/help)

## What it does

Working inside your `career-ops` project folder, the coworker:

| Stage | Action |
|---|---|
| **Scan** | runs the project scanner (`npm run scan` → `node scan.mjs`, `--dry-run`/`--company`/`--since`) over your `portals.yml`. Zero API tokens. |
| **Score fit** | rates each posting 0–5 against `cv.md` + `config/profile.yml` + `config/two-pager.yml`, with the concrete gaps. |
| **Tailor** | writes a role-specific CV + cover letter as files, grounded **only** in real CV facts (`npm run cv:verify-facts` is the truthfulness gate). |
| **Track** | updates `data/applications.md` with the canonical status. |
| **Follow up / interviews** | drafts follow-up emails (Gmail) and places interview slots (Google Calendar) — approval-gated. |
| **Launch this dashboard** | starts `career-ops-ui` locally: `bash web-ui/bin/start.sh` → `http://127.0.0.1:4317`. |

## How it relates to this repo

- The coworker **drives the parent `career-ops` pipeline directly** (the Node CLIs + your files) — it does not require the web-ui SPA to run. But it can **launch** the web-ui as a browser dashboard on request (`bin/start.sh` / `npm start`, port 4317, local-only).
- It lives in its **own repo** (a coworker is a standalone, shareable bundle that targets the OpenWorker format), not inside `web-ui/`. Nothing in `server/` or `public/` depends on it; this page is a pointer.
- Its safety posture matches career-ops doctrine: truthfulness (never fabricate a CV fact), read-only by default, approval-gated sends/writes, local-first privacy.

## Install (summary)

**One command** sets up the pipeline the coworker drives — it is idempotent and non-destructive, so an already-installed `career-ops` project or `web-ui` dashboard is detected and reused, never overwritten:

```bash
curl -fsSL https://raw.githubusercontent.com/Fighter90/career-ops-coworker/main/install.sh | bash
```

Then install [OpenWorker](https://openworker.com) + a model key (Anthropic / OpenAI / Google / Ollama) and add the persona from its **Install a coworker** panel, any of three ways:

1. **GitHub URL** — paste `https://github.com/Fighter90/career-ops-coworker`. (OpenWorker clones the repo and installs the persona; the coworker repo keeps `career-ops.md` as its only top-level `.md` so this repo-install path works.)
2. **.zip** — download `career-ops-coworker.zip` from the coworker repo's [Releases](https://github.com/Fighter90/career-ops-coworker/releases).
3. **Import / folder** — pick the `career-ops.md` file (or point the folder option at a local clone).

The coworker lands **disabled pending your consent**; approve it, open a **Job-Search Coworker** session, and pick your `career-ops` folder (which holds `cv.md`, `config/profile.yml`, `portals.yml`). Full instructions, connectors, safety model, and troubleshooting are in the coworker repo's [help guide](https://github.com/Fighter90/career-ops-coworker/tree/main/help).

## How the coworker mechanism works

Verified against the OpenWorker source ([`andrewyng/openworker`](https://github.com/andrewyng/openworker)) — its engine is built on Andrew Ng's [`aisuite`](https://github.com/andrewyng/aisuite). The essentials:

- **A coworker is a *persona*** — one Markdown file: **YAML frontmatter** (structured identity + capability declaration) followed by a **Markdown body that is the system prompt**. Formally `persona ⊇ skill` — the same frontmatter-then-markdown shape as a `SKILL.md`, with more fields. Frontmatter fields (from `coworker/personas/manifest.py`): `id` (a filesystem-safe slug, becomes a directory name), `name`, `icon`, `tagline`, `description`, `tools`, `requires_folder`, `subagents`, `scheduling`, `messaging`, `connectors`, `team` (`lead`/`worker`/solo), `default_permission_mode`, `recommended_models`, `skills`, `mcp`, `version`, `recommends`, `ships`, `group`.
- **The tool catalog is closed and platform-owned.** `tools:` may only reference vetted capability ids — `code_files, files, git, search, shell, todo` (`coworker/catalog.py`). A third party **cannot add tool code**; breadth comes from OpenWorker adding vetted capabilities and from **MCP**. This is why the install screen says *"no third-party code runs, but the instructions steer the coworker."*
- **Connectors are a declared grant.** `connectors:` is `false` (none), `true` (every connected connector — reserved for built-ins), or an allowlist of ids; the session exposes *declared ∩ connected*. `recommends:` surfaces suggested connectors/MCP with a `reason` + `tier` (`core`/`optional`) — and **every recommended connector must be inside the `connectors` grant** (the loader rejects a recommendation outside the grant).
- **Install = snapshot.** Installing a coworker — by GitHub URL, `.zip`, folder, or single-file import — copies the persona into OpenWorker's **managed install area** (keyed by the persona `id`). The repo/URL installer (`personas/registry.py::install_from_git` → `install_from_dir`) globs **every top-level `*.md`** in the repo and parses each as a persona, so a coworker repo must keep its persona as the only root `.md` (ours does — README/CHANGELOG/CLAUDE live under `.github/` and `docs/`). Later edits to the source don't change an installed copy — re-install to update; `version:` only drives the "replaces vN" note (there's no auto-update channel with folder/git distribution).
- **Approval-gating & privacy.** Reads are free; consequential actions (sending a message, changing a calendar, running a write command) are **approval-gated** check-ins. Everything is local-first — model keys and connector tokens live in the app's local secret store; the only cloud piece brokers OAuth.
- **Runtime.** `to_agent()` materializes the persona into an aisuite Agent (system prompt + catalog-expanded tools + traits: `requires_folder`, `subagents`, `scheduling`, `messaging`, `connectors`, `team`).

Our coworker uses exactly this contract: `tools: [files, search, shell, todo]`, `requires_folder: true`, `connectors: [gmail, google_calendar, github]` with matching `recommends`, and a system prompt that encodes career-ops's truthfulness-first, approval-gated doctrine.

## Verified

The coworker is verified installable against OpenWorker's own `parse_manifest` / `load_manifest_file` loader (id slug, permission mode, catalog tool ids `files/search/shell/todo`, and the `recommends ⊆ connectors` grant rule) **and against its repo installer** (`install_from_git` → `install_from_dir`) — so the **GitHub-URL, folder, and `.zip`** paths all install cleanly, not just the single-file import. The underlying scanner is verified to pull live vacancies and to launch the dashboard on `127.0.0.1:4317`.
