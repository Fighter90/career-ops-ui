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
import { dirname, resolve } from 'node:path';
import { PATHS, PROJECT_ROOT } from '../paths.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import { runNodeScript } from '../runner.mjs';
import { parseJsonStdout, isEmptyTrackerError, sanitizeDetail } from '../parent-relay.mjs';

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

// Bound how many snapshots a single trend read PARSES/materializes, so an
// append-only role-stats.jsonl that grows over months can't turn GET
// /api/stats/trend into an unbounded parse+JSON.parse pass. The tail is what
// the trend chart wants anyway. (The raw file read is still whole-file; for
// this manual-snapshot feature that stays small — rotation is a future step.)
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

  // v1.117.0 — rejection-pattern / ATS-channel analytics.
  // Shells out to the `analyze-patterns.mjs` script (JSON stdout: outcome
  // classification per archetype / seniority / remote / score band, plus the
  // per-ATS-vendor advance rate motivated by Bommasani et al., FAccT 2026)
  // instead of reimplementing it — that script stays the source of truth and
  // web-ui cannot drift. Read-only; fail-soft { available:false } when the
  // script is absent (CI, standalone installs) so the tab shows an honest note.
  app.get('/api/stats/patterns', llmRateLimit, async (_req, res) => {
    const script = 'analyze-patterns.mjs';
    if (!existsSync(resolve(PROJECT_ROOT, script))) {
      res.json({ available: false, reason: 'script-not-found' });
      return;
    }
    const r = await runNodeScript(script, [], { timeoutMs: 60_000 });
    const data = parseJsonStdout(r.stdout);
    // Structured {error} on stdout = a healthy "no data yet" answer (empty
    // tracker), not a failure — relay as available with empty sections so the
    // tab renders its honest empty state. Keyed to the script's exact
    // messages (analyze-patterns.mjs) via isEmptyTrackerError; any OTHER
    // {error} falls through to the honest script-error path below.
    if (data && isEmptyTrackerError(data.error)) {
      res.json({ available: true, empty: true, note: data.error, metadata: { total: 0, byOutcome: {} }, recommendations: [], vendorAnalysis: {}, archetypeBreakdown: [] });
      return;
    }
    if (r.code !== 0 || !data) {
      res.json({
        available: false,
        reason: r.killed ? 'timeout' : 'script-error',
        detail: sanitizeDetail(r.stderr),
      });
      return;
    }
    res.json({ available: true, ...data });
  });

  // v1.118.0 — lifetime pipeline stats (#1605).
  // Shells out to the `stats.mjs` script (zero-token aggregator: tracker
  // roll-up, cumulative funnel, lifetime scanner totals, portal coverage,
  // follow-up compliance). The script degrades sections to null itself when a
  // source file is missing and reports what it found in `metadata.sources`,
  // so a fresh install still relays a full contract shape. Read-only;
  // fail-soft { available:false } without the script.
  app.get('/api/stats/lifetime', llmRateLimit, async (_req, res) => {
    const script = 'stats.mjs';
    if (!existsSync(resolve(PROJECT_ROOT, script))) {
      res.json({ available: false, reason: 'script-not-found' });
      return;
    }
    const r = await runNodeScript(script, [], { timeoutMs: 60_000 });
    const data = parseJsonStdout(r.stdout);
    if (r.code !== 0 || !data) {
      res.json({
        available: false,
        reason: r.killed ? 'timeout' : 'script-error',
        detail: sanitizeDetail(r.stderr),
      });
      return;
    }
    res.json({ available: true, ...data });
  });

  // v1.118.0 — compensation observations (salary-gap.mjs).
  // Desired vs advertised vs actual comp, folded from reports' Machine Summary,
  // data/salary-observations.tsv and profile target range. Same relay contract
  // as /api/stats/lifetime: read-only, fail-soft without the script.
  app.get('/api/stats/salary-gap', llmRateLimit, async (_req, res) => {
    const script = 'salary-gap.mjs';
    if (!existsSync(resolve(PROJECT_ROOT, script))) {
      res.json({ available: false, reason: 'script-not-found' });
      return;
    }
    const r = await runNodeScript(script, [], { timeoutMs: 60_000 });
    const data = parseJsonStdout(r.stdout);
    if (r.code !== 0 || !data) {
      res.json({
        available: false,
        reason: r.killed ? 'timeout' : 'script-error',
        detail: sanitizeDetail(r.stderr),
      });
      return;
    }
    res.json({ available: true, ...data });
  });

  // Funnel calibration vs market benchmarks + waiting list + per-stage velocity
  // medians — a zero-token read-only relay of funnel-velocity.mjs (JSON stdout:
  // { calibration, waiting, velocity }, each with its statistical-honesty
  // caveats baked in). Same contract as /api/stats/lifetime.
  app.get('/api/stats/funnel', llmRateLimit, async (_req, res) => {
    const script = 'funnel-velocity.mjs';
    if (!existsSync(resolve(PROJECT_ROOT, script))) {
      res.json({ available: false, reason: 'script-not-found' });
      return;
    }
    const r = await runNodeScript(script, [], { timeoutMs: 60_000 });
    const data = parseJsonStdout(r.stdout);
    if (r.code !== 0 || !data) {
      res.json({
        available: false,
        reason: r.killed ? 'timeout' : 'script-error',
        detail: sanitizeDetail(r.stderr),
      });
      return;
    }
    res.json({ available: true, ...data });
  });

  // GET /api/stats/company-history[?company=X] — per-company evidence cards
  // (responsiveness + posting churn) joining tracker + follow-ups + scan-history.
  // Zero-token, read-only relay of company-history.mjs (JSON stdout by default;
  // `--company X` returns a single card, bare returns the full result). `company`
  // is a runNodeScript array arg — never shell-interpolated, length-capped.
  app.get('/api/stats/company-history', llmRateLimit, async (req, res) => {
    const script = 'company-history.mjs';
    if (!existsSync(resolve(PROJECT_ROOT, script))) {
      res.json({ available: false, reason: 'script-not-found' });
      return;
    }
    const company = typeof req.query.company === 'string' ? req.query.company.trim().slice(0, 200) : '';
    const argv = company ? ['--company', company] : [];
    const r = await runNodeScript(script, argv, { timeoutMs: 60_000 });
    const data = parseJsonStdout(r.stdout);
    if (r.code !== 0 || !data) {
      res.json({
        available: false,
        reason: r.killed ? 'timeout' : (isEmptyTrackerError(r.stderr) ? 'empty-tracker' : 'script-error'),
        detail: sanitizeDetail(r.stderr),
      });
      return;
    }
    res.json({ available: true, ...data });
  });

  // GET /api/stats/upskill — a tracker-wide skill-gap roll-up (weighted 5−score
  // across all evaluated reports, tiered Critical/High/Medium), so you can see
  // what to learn next. Zero-token, read-only relay of upskill.mjs (JSON stdout
  // by default; carries an { error } field when there is not enough data yet).
  app.get('/api/stats/upskill', llmRateLimit, async (_req, res) => {
    const script = 'upskill.mjs';
    if (!existsSync(resolve(PROJECT_ROOT, script))) {
      res.json({ available: false, reason: 'script-not-found' });
      return;
    }
    const r = await runNodeScript(script, [], { timeoutMs: 60_000 });
    const data = parseJsonStdout(r.stdout);
    if (r.code !== 0 || !data) {
      res.json({
        available: false,
        reason: r.killed ? 'timeout' : (isEmptyTrackerError(r.stderr) ? 'empty-tracker' : 'script-error'),
        detail: sanitizeDetail(r.stderr),
      });
      return;
    }
    res.json({ available: true, ...data });
  });

  // GET /api/stats/rejection-latency — interviews that have gone silent past a
  // courtesy window (default 30d): a gentle "these deserve a nudge or closure"
  // list joining data/active-interviews.md + the tracker. Suggestion-only, zero-
  // token, read-only relay of rejection-latency.mjs (JSON stdout by default).
  app.get('/api/stats/rejection-latency', llmRateLimit, async (_req, res) => {
    const script = 'rejection-latency.mjs';
    if (!existsSync(resolve(PROJECT_ROOT, script))) {
      res.json({ available: false, reason: 'script-not-found' });
      return;
    }
    const r = await runNodeScript(script, [], { timeoutMs: 60_000 });
    const data = parseJsonStdout(r.stdout);
    if (r.code !== 0 || !data) {
      res.json({
        available: false,
        reason: r.killed ? 'timeout' : (isEmptyTrackerError(r.stderr) ? 'empty-tracker' : 'script-error'),
        detail: sanitizeDetail(r.stderr),
      });
      return;
    }
    res.json({ available: true, ...data });
  });
}
