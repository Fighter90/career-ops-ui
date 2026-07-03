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
import { rateLimit } from '../rate-limit.mjs';

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

/** Parse role-stats.jsonl into an array of snapshot objects (bad lines skipped). */
export function readSnapshots() {
  if (!existsSync(PATHS.roleStats)) return [];
  try {
    return readFileSync(PATHS.roleStats, 'utf8').split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

export function registerStatsRoutes(app) {
  // rateLimit is a no-op on loopback; on a public bind it bounds the
  // filesystem-writing snapshot append per IP (CodeQL js/missing-rate-limiting).
  app.post('/api/stats/snapshot', rateLimit, (req, res) => {
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
