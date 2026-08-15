/**
 * CV & profile "setup doctor" relay (GET /api/cv-sync-check).
 *
 * Surfaces the parent's `cv-sync-check.mjs` — a zero-LLM, read-only script
 * that flags whether `cv.md` / `config/profile.yml` are filled in and warns
 * about leftover example/placeholder data and hardcoded metrics in the prompt
 * files (`modes/_shared.md`, `modes/_writing.md`, `batch/batch-prompt.md`).
 *
 * INTEGRATION NOTE — the parent CLI has NO `--json` flag; it prints stable
 * human text and sets its exit code:
 *
 *     === career-ops sync check ===
 *
 *     ERRORS (2):
 *       ERROR: cv.md not found in project root. …
 *       ERROR: config/profile.yml not found. …
 *
 *     WARNINGS (3):
 *       WARN: cv.md seems too short. …
 *       WARN: config/profile.yml may still have example data. Check field: full_name
 *       WARN: _shared.md:1 — Possible hardcoded metric: "170+ hours". …
 *
 *   (exit 1 when there are errors, exit 0 otherwise; a clean run prints
 *   "All checks passed."). We do LIGHT structured parsing of those `ERROR:` /
 *   `WARN:` lines — the prefixes are stable — into { ok, errors[], warnings[] }
 *   so the client can render a real panel instead of a raw dump. A non-zero
 *   exit is a normal RESULT (errors were found), NOT a script failure, so the
 *   parser (not the exit code) decides success.
 *
 * Read-only, zero-token. Fail-soft { available:false, reason } when the parent
 * script is absent (CI / standalone installs) so the client shows a muted
 * "not available" line rather than an error. Mirrors the relay shape of
 * routes/stats.mjs (existsSync guard → runNodeScript → parse → fail-soft).
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROJECT_ROOT } from '../paths.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import { runNodeScript } from '../runner.mjs';
import { sanitizeDetail } from '../parent-relay.mjs';

const SCRIPT = 'cv-sync-check.mjs';
const BANNER = '=== career-ops sync check ===';
// Defensive upper bound: the metric scan can emit one WARN per matching line
// across three prompt files, so cap what we materialize into the payload.
const MAX_ITEMS = 100;

/**
 * Parse cv-sync-check.mjs's human-text stdout into { ok, errors[], warnings[] }.
 * Returns null when the output isn't a recognizable run (no banner) so the
 * caller can report an honest script-error instead of a fake "all clear".
 */
export function parseCvSyncOutput(stdout) {
  const text = String(stdout || '');
  if (!text.includes(BANNER)) return null;
  const errors = [];
  const warnings = [];
  for (const line of text.split('\n')) {
    const e = line.match(/^\s*ERROR:\s?(.*)$/);
    if (e) { if (errors.length < MAX_ITEMS) errors.push(e[1].trim()); continue; }
    const w = line.match(/^\s*WARN:\s?(.*)$/);
    if (w && warnings.length < MAX_ITEMS) warnings.push(w[1].trim());
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function registerCvSyncRoutes(app) {
  // llmRateLimit is a per-IP token bucket (no-op on loopback); it bounds the
  // subprocess spawn on a public bind, same guard the stats relay routes use.
  app.get('/api/cv-sync-check', llmRateLimit, async (_req, res) => {
    if (!existsSync(resolve(PROJECT_ROOT, SCRIPT))) {
      res.json({ available: false, reason: 'script-not-found' });
      return;
    }
    const r = await runNodeScript(SCRIPT, [], { timeoutMs: 30_000 });
    if (r.killed) {
      res.json({ available: false, reason: 'timeout' });
      return;
    }
    const parsed = parseCvSyncOutput(r.stdout);
    if (!parsed) {
      res.json({ available: false, reason: 'script-error', detail: sanitizeDetail(r.stderr) });
      return;
    }
    res.json({ available: true, ...parsed });
  });
}
