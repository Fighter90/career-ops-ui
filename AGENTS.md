# career-ops-ui — Agent Instructions (Codex / generic CLI shim)

> Read `CLAUDE.md` for the full project-level instructions, hard rules, conventions, and SDD pipeline. Everything in `CLAUDE.md` applies equally to Codex, Cursor, Aider, OpenAI's CLI, or any other agent driving this repo. This file exists so non-Claude CLIs find a canonical entry point.

## Quick orientation

- This is `career-ops-ui` v1.69.x — an Express + vanilla-JS SPA that puts a polished web interface on top of [`Fighter90/career-ops`](https://github.com/Fighter90/career-ops).
- It runs as a regular Node ≥18 process. It is **CLI-agnostic** at runtime — the choice of agent CLI affects only the *development* workflow inside this repo, not the deployed UI.
- Hard rules and parent-project boundary live in `CLAUDE.md` (root). Codex's CODEOWNERS-style additions, if any, layer on top.

## CLI-specific notes

| CLI | Entry point | Notes |
|---|---|---|
| Claude Code | `CLAUDE.md` | Native. Subagents in `.claude/agents/`, slash commands in `.claude/commands/`. SDD via `gsd-*` skills (superpowers@claude-plugins-official). |
| OpenAI Codex | `AGENTS.md` (this file) | Points to CLAUDE.md. No additional Codex-specific config required. |
| Gemini CLI | `GEMINI.md` | Points to CLAUDE.md. |
| Cursor / Continue | `CLAUDE.md` | Both honor CLAUDE.md by convention. |
| Aider | `CLAUDE.md` | Pass `--read CLAUDE.md` on first run if your aider version doesn't auto-detect. |

## Things every CLI must respect

1. **Never edit anything outside `web-ui/`.** Parent career-ops files (`../cv.md`, `../config/`, `../modes/`, `../data/`, `../reports/`, …) are off-limits.
2. **Never weaken security headers.** CSP excludes `'unsafe-inline'` from `script-src` on purpose.
3. **Never bypass `isValidJobUrl()` for SSRF-relevant routes.** Same for `stripDangerousMarkdown()` (CV markdown).
4. **Never commit `.env`.** Use `.env.example` placeholders only.
5. **Tests must be CI-isolated.** Don't assume the parent project layout exists outside `tests/fixtures/` or `mktemp -d`.

The full list lives in `CLAUDE.md` under "Hard rules — do NOT violate".

## Spec-Driven Development

This project uses the GSD pipeline (Claude-Code-native skills). Non-Claude CLIs can still follow the same discipline manually:

```
discuss → spec → plan → execute → verify → review
```

See `docs/sdd/SDD-GUIDE.md` for the full workflow + which artifacts to produce at each step. Codex / Gemini / Aider users: write the artifacts as plain Markdown under `.planning/phases/P-NN-<slug>/` and run them through whatever review loop your CLI supports.

## Quick reference

| Command | Purpose |
|---|---|
| `npm start` | Run server on `127.0.0.1:4317` |
| `npm test` | Full unit suite (1079 tests as of v1.69.0) |
| `npm run test:e2e:browser` | Playwright browser smoke (opt-in) |
| `bash bin/start.sh` | One-shot launcher with browser open |

For deeper architecture: `docs/architecture/OVERVIEW.md`.
