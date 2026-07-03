/**
 * Target-Roles statistics routes (v1.86.0).
 *
 * The heavy lifting — matching scan jobs to the profile's target roles and
 * grouping salaries by country — happens CLIENT-side in
 * `public/js/lib/role-stats.js` (reusing `window.Countries`), so the server
 * stays a thin, honest snapshot store: it persists the current aggregate so
 * vacancy counts / salary levels can be TRACKED OVER TIME (the "dynamics"
 * the feature needs), and reads that trend back.
 *
 *   POST /api/stats/snapshot  — append the current aggregate (server-stamped)
 *   GET  /api/stats/trend     — the accumulated snapshots (optionally per role)
 *
 * Writes land in `data/role-stats.jsonl` (this project's writable data area,
 * same as activity.jsonl / last-scan.json) — never in CV/profile files. The
 * POST is an explicit user action ("Save snapshot"), consistent with the
 * write-through contract in docs/architecture/DATA-FLOWS.md.
 */
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PATHS } from '../paths.mjs';
import { llmRateLimit } from '../rate-limit.mjs';

const num = (v, d = 0) => (Number.isFinite(v) ? v : d);

/** Reduce a client-sent aggregate to a compact, size-bounded, sanitized row. */
export function toCompactSnapshot(body) {
  const b = (body && typeof body === 'object') ? body : {};
  const perRole = Array.isArray(b.perRole) ? b.perRole.slice(0, 50).map((r) => ({
    role: String((r && r.role) || '').slice(0, 120),
    total: num(r && r.total),
    medianUsd: (r && r.salary && Number.isFinite(r.salary.medianUsd)) ? r.salary.medianUsd
      : (r && Number.isFinite(r.medianUsd) ? r.medianUsd : null),
  })) : [];
  const byCountry = Array.isArray(b.byCountry) ? b.byCountry.slice(0, 80).map((c) => ({
    code: String((c && c.code) || '').slice(0, 8),
    count: num(c && c.count),
  })) : [];
  return { totalJobs: num(b.totalJobs), matchedJobs: num(b.matchedJobs), perRole, byCountry };
}

// Bound how many snapshots a single trend read materializes, so an append-only
// role-stats.jsonl that grows over months can't turn GET /api/stats/trend into
// an unbounded memory read. The tail is what the trend chart wants anyway.
const MAX_TREND_SNAPSHOTS = 5000;

/** Parse role-stats.jsonl into an array of snapshot objects (bad lines skipped). */
export function readSnapshots() {
  if (!existsSync(PATHS.roleStats)) return [];
  try {
    const lines = readFileSync(PATHS.roleStats, 'utf8').split('\n').filter(Boolean);
    const tail = lines.length > MAX_TREND_SNAPSHOTS ? lines.slice(-MAX_TREND_SNAPSHOTS) : lines;
    return tail
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

export function registerStatsRoutes(app) {
  // llmRateLimit is a per-IP token bucket (no-op on loopback); it bounds the
  // filesystem-writing snapshot append on a public bind. Reused verbatim from
  // the LLM routes so CodeQL's rate-limiting model recognizes the guard
  // (js/missing-rate-limiting).
  app.post('/api/stats/snapshot', llmRateLimit, (req, res) => {
    const snap = { ts: new Date().toISOString(), ...toCompactSnapshot(req.body) };
    try {
      mkdirSync(dirname(PATHS.roleStats), { recursive: true });
      appendFileSync(PATHS.roleStats, `${JSON.stringify(snap)}\n`);
    } catch {
      return res.status(500).json({ error: 'failed to persist snapshot' });
    }
    return res.json({ ok: true, ts: snap.ts });
  });

  app.get('/api/stats/trend', (req, res) => {
    const role = typeof req.query.role === 'string' && req.query.role ? req.query.role : null;
    let snapshots = readSnapshots();
    if (role) {
      snapshots = snapshots.map((s) => ({
        ts: s.ts,
        totalJobs: num(s.totalJobs),
        role: (Array.isArray(s.perRole) ? s.perRole : []).find((r) => r.role === role) || null,
      }));
    }
    res.json({ snapshots });
  });
}
