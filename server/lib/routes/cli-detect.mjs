/**
 * AI CLI detection (v1.103.0).
 *
 *   GET /api/cli-detect → { tools: [{ id, name, installed, path }], platform }
 *
 * career-ops is a Claude-Code-driven pipeline, but it works with any of the
 * agent CLIs that speak the open agent-skill standard (Claude Code, Codex,
 * Gemini CLI, OpenCode, GitHub Copilot CLI, Qwen, Antigravity). This route
 * reports which of them are installed on the machine and where.
 *
 * SAFETY: detection is a pure PATH scan — for each known binary name we look
 * for an executable file in the directories on `process.env.PATH`. We NEVER
 * execute a found binary (no `--version`, no spawn), so a hostile file on PATH
 * can't be run. The binary names come from a fixed allowlist, never from input.
 * Read-only: no file writes, no LLM, no network, no user data.
 */
import { existsSync, statSync, accessSync, constants } from 'node:fs';
import { join, delimiter } from 'node:path';

// Fixed allowlist: { id, display name, candidate binary basenames }.
// Roster mirrors the parent's docs/SUPPORTED_CLIS.md (v1.126.0 sync — 8
// first-class CLIs + Gemini as a legacy wrapper transitioned into
// Antigravity; the Antigravity binary is `agy` per the parent matrix).
const KNOWN = [
  { id: 'claude', name: 'Claude Code', bins: ['claude'] },
  // v1.127.0 — parent career-ops v1.23.0 re-added Cursor as a first-class host
  // (#2115: skill entrypoint at .cursor/skills/career-ops/SKILL.md). Cursor
  // ships a `cursor` PATH launcher.
  { id: 'cursor', name: 'Cursor', bins: ['cursor'] },
  { id: 'codex', name: 'Codex', bins: ['codex'] },
  { id: 'gemini', name: 'Gemini CLI', bins: ['gemini'] },
  { id: 'opencode', name: 'OpenCode', bins: ['opencode'] },
  { id: 'copilot', name: 'GitHub Copilot CLI', bins: ['copilot', 'github-copilot-cli'] },
  { id: 'qwen', name: 'Qwen Code', bins: ['qwen', 'qwen-code'] },
  { id: 'antigravity', name: 'Antigravity CLI', bins: ['agy', 'antigravity'] },
  { id: 'grok', name: 'Grok Build CLI', bins: ['grok'] },
  { id: 'kimi', name: 'Kimi CLI', bins: ['kimi'] },
];

const IS_WIN = process.platform === 'win32';
// On Windows a CLI is usually a .cmd/.exe/.bat shim; try those extensions too.
const WIN_EXT = ['.cmd', '.exe', '.bat', ''];

function isExecutableFile(full) {
  try {
    if (!existsSync(full) || !statSync(full).isFile()) return false;
    if (IS_WIN) return true;                 // Windows: extension implies runnable
    accessSync(full, constants.X_OK);        // POSIX: needs the execute bit
    return true;
  } catch { return false; }
}

/** Resolve the first PATH hit for any of the candidate binary names, or null. */
export function findOnPath(bins, pathEnv = process.env.PATH || '') {
  const dirs = pathEnv.split(delimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const bin of bins) {
      const cands = IS_WIN ? WIN_EXT.map((e) => join(dir, bin + e)) : [join(dir, bin)];
      for (const full of cands) {
        if (isExecutableFile(full)) return full;
      }
    }
  }
  return null;
}

/** Detect every known AI CLI. Exported for tests. */
export function detectClis(pathEnv = process.env.PATH || '') {
  return KNOWN.map(({ id, name, bins }) => {
    const path = findOnPath(bins, pathEnv);
    return { id, name, installed: Boolean(path), path: path || null };
  });
}

export function registerCliDetectRoutes(app) {
  app.get('/api/cli-detect', (_req, res) => {
    res.json({ tools: detectClis(), platform: process.platform });
  });
}
