# AI CLI detection panel (v1.103.0)

**Status:** Shipped · **Version:** 1.103.0 · **Date:** 2026-07-06

## Problem

The parent web UI advertises "Works with Claude Code, Codex, Gemini, OpenCode,
Copilot, Qwen, Antigravity". The user asked to surface, in Settings, **which of
those agent CLIs are installed on the machine and where** — parity with the
parent's settings panel.

## Solution

### Server — `server/lib/routes/cli-detect.mjs` (28th route module)

- `GET /api/cli-detect` → `{ tools: [{ id, name, installed, path }], platform }`.
- Detection is a **pure PATH scan**: for each known binary name we look for an
  executable file across the directories in `process.env.PATH` (on Windows, also
  trying `.cmd/.exe/.bat` shims; on POSIX, requiring the execute bit).
- **Safety invariant — never execute.** We only resolve the *path* of a found
  binary; we never spawn it, never run `--version`. A hostile file on `PATH`
  cannot be run by this route. The binary names come from a fixed 7-entry
  allowlist, never from request input. No writes, no LLM, no network, no user data.
- Exported helpers `findOnPath(bins, pathEnv)` and `detectClis(pathEnv)` for tests.

### Client — `public/js/views/config.js`

A 4th tab in `#/config`, **AI CLI tools**, lazy-loaded on first activation
(`GET /api/cli-detect`): each known CLI as a row with an installed ✓/— badge and
its resolved path. Deep-linkable via `#/config?tab=cli`.

## Tests

`tests/cli-detect-routes.test.mjs` (3): a stub executable on a synthetic PATH is
detected by `findOnPath`/`detectClis` (and is **never run** — its body echoes a
sentinel that must not appear), the detect result shape (7-entry allowlist, path
only when installed), and the endpoint returns `{tools, platform}`. 8 new i18n
keys ×16 (`cli.*` + `config.tabCli`). Help §2 extended in place (no new H2/H3).
