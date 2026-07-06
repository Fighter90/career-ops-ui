/**
 * Follow-up cadence routes (v1.117.0) — parent parity.
 *
 * The parent career-ops ships a full follow-up cadence engine
 * (`followup-cadence.mjs` — parses applications.md + follow-ups.md, computes
 * per-application urgency: urgent / overdue / waiting / cold — and
 * `followup-seed.mjs` — pins a first follow-up date when a row turns Applied).
 * web-ui only had the LLM `followup` mode page; the deterministic cadence data
 * was never surfaced. These routes SHELL OUT to the parent scripts (the same
 * pattern as the doctor/verify/dedup runners) instead of reimplementing the
 * cadence math — the parent stays the single source of truth and web-ui can't
 * drift from it.
 *
 *   GET  /api/followup       → run `followup-cadence.mjs` (JSON stdout) and
 *                              relay { available:true, metadata, entries,
 *                              cadenceConfig }. If the parent script is absent
 *                              (CI, standalone installs) → { available:false }.
 *   POST /api/followup/seed  → explicit user action. Body {appNum} seeds one
 *                              application, {backfill:true} seeds the whole
 *                              tracker; optional {force:true}. Runs
 *                              `followup-seed.mjs … --json` which writes the
 *                              user-layer data/follow-ups.md pin directives.
 *
 * Fail-soft by design: a missing script, a non-zero exit, or unparseable
 * stdout never 500s the UI — the page shows an honest "not available" note.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROJECT_ROOT } from '../paths.mjs';
import { runNodeScript } from '../runner.mjs';

const CADENCE_SCRIPT = 'followup-cadence.mjs';
const SEED_SCRIPT = 'followup-seed.mjs';
const RUN_TIMEOUT_MS = 30_000;

function scriptAvailable(name) {
  return existsSync(resolve(PROJECT_ROOT, name));
}

/** Parse a script's stdout as JSON, tolerating stray log lines before it. */
function parseJsonStdout(stdout) {
  const s = String(stdout || '').trim();
  if (!s) return null;
  const start = s.indexOf('{');
  if (start === -1) return null;
  try {
    return JSON.parse(s.slice(start));
  } catch {
    return null;
  }
}

export function registerFollowupRoutes(app) {
  app.get('/api/followup', async (_req, res) => {
    if (!scriptAvailable(CADENCE_SCRIPT)) {
      res.json({ available: false, reason: 'script-not-found' });
      return;
    }
    const r = await runNodeScript(CADENCE_SCRIPT, [], { timeoutMs: RUN_TIMEOUT_MS });
    const data = parseJsonStdout(r.stdout);
    if (r.code !== 0 || !data) {
      res.json({
        available: false,
        reason: r.killed ? 'timeout' : 'script-error',
        detail: String(r.stderr || '').split('\n').slice(0, 3).join(' ').slice(0, 300),
      });
      return;
    }
    res.json({ available: true, ...data });
  });

  app.post('/api/followup/seed', async (req, res) => {
    if (!scriptAvailable(SEED_SCRIPT)) {
      res.status(400).json({ error: 'followup-seed.mjs not found in the parent project' });
      return;
    }
    const body = req.body || {};
    const args = [];
    if (body.backfill === true) {
      args.push('--backfill');
    } else {
      const appNum = Number(body.appNum);
      if (!Number.isInteger(appNum) || appNum <= 0 || appNum > 1_000_000) {
        res.status(400).json({ error: 'appNum must be a positive integer (or pass backfill:true)' });
        return;
      }
      args.push(String(appNum));
    }
    if (body.force === true) args.push('--force');
    args.push('--json');
    const r = await runNodeScript(SEED_SCRIPT, args, { timeoutMs: RUN_TIMEOUT_MS });
    const data = parseJsonStdout(r.stdout);
    if (r.code !== 0) {
      res.status(422).json({
        error: 'seed failed',
        detail: (data && data.error) || String(r.stderr || r.stdout || '').split('\n').slice(0, 3).join(' ').slice(0, 300),
      });
      return;
    }
    res.json({ ok: true, result: data || { raw: String(r.stdout || '').slice(0, 500) } });
  });
}
