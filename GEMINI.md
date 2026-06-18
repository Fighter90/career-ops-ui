# career-ops-ui — Agent Instructions (Gemini CLI shim)

> Gemini CLI auto-loads this file at session start. The actual project-level instructions, hard rules, conventions, and SDD pipeline live in [`CLAUDE.md`](./CLAUDE.md) — everything there applies to Gemini equally. This file is a thin pointer so Gemini-driven sessions get the same orientation as Claude Code or Codex sessions.

Read `CLAUDE.md` next.

## Why a shim

The parent career-ops project supports multiple CLIs (Claude Code, Codex, Gemini, OpenCode) via the [Open Agent Skill standard](https://github.com/Fighter90/career-ops). This UI sub-project adopts the same convention: one source of truth (`CLAUDE.md`) plus thin shims (`AGENTS.md` for Codex, this file for Gemini).

## Gemini-specific notes

- The UI itself is CLI-agnostic at runtime. The Gemini CLI is only relevant during *development inside this repo*. The deployed UI runs as a regular Node ≥18 process and works regardless of which CLI authored the code.
- `npm run test:e2e:browser` (Playwright smoke) drives a real Chromium against the in-process server. Resolves Playwright via the parent project's `node_modules` — no new dependency in `web-ui/`.
- The SDD pipeline (`docs/sdd/SDD-GUIDE.md`) is described in CLI-agnostic terms; Gemini users follow the same `discuss → spec → plan → execute → verify → review` loop, manually creating Markdown artifacts under `.planning/phases/P-NN-<slug>/` if the GSD slash-commands aren't available.
- Live LLM execution from `/api/evaluate`, `/api/deep`, `/api/mode/:slug` works with either `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` set in the parent project's `.env`. Anthropic is preferred when both are present (better long-form structured output).

## Hard rules — do NOT violate

(See `CLAUDE.md` for the complete list with rationale.)

1. Never edit outside `web-ui/`. The parent career-ops project owns `cv.md`, `config/`, `modes/`, `data/`, `reports/`, etc.
2. Never weaken security headers (CSP, `X-Frame-Options`, etc.).
3. Never bypass `isValidJobUrl()` (SSRF guard) or `stripDangerousMarkdown()` (XSS guard).
4. Never commit `.env`. Never log secrets.
5. Tests must be CI-isolated.
6. No `git --no-verify`, no `--force` push, no `git reset --hard` without explicit user approval.

## Where to start

1. `docs/architecture/OVERVIEW.md` — five-minute tour.
2. `docs/architecture/API.md` — full route inventory.
3. `docs/architecture/DATA-FLOWS.md` — every parent-project read/write contract.
4. `docs/sdd/SDD-GUIDE.md` — how to plan and execute non-trivial changes.
