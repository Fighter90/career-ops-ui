/**
 * Append-only activity log. Captures user-driven mutations so the UI can
 * show a "what did I do, when?" page without scraping git history or
 * shell scrollback.
 *
 * Format: JSON-lines (one event per line). Read with `readActivity()`,
 * which returns the last N events newest-first.
 *
 * Storage: data/activity.jsonl (alongside applications.md / pipeline.md
 * — same lifecycle, gitignored along with the rest of data/).
 */
import { appendFileSync, readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { PATHS } from './paths.mjs';

const MAX_DETAIL = 200;
const MAX_LINES_RETURNED = 500;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // rotate at 5 MB

/**
 * Truncate a string to a sane length so a giant CV blob can't bloat the
 * log. Non-strings get JSON-stringified first; objects with secrets are
 * already filtered upstream.
 */
function clip(value) {
  if (value == null) return null;
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  if (s.length <= MAX_DETAIL) return s;
  return s.slice(0, MAX_DETAIL) + '…';
}

/**
 * Append one event. Best-effort: never throws into the request path.
 * Schema:
 *   ts      ISO-8601 string
 *   action  short verb.noun ("pipeline.add", "cv.save", "scan.start", …)
 *   target  optional string identifying the thing acted on (URL, slug)
 *   ok      boolean (false for 4xx/5xx); null if the action is async
 *   detail  optional clipped string for context
 */
export function logActivity(event) {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      action: String(event.action || 'unknown'),
      target: event.target ? clip(event.target) : null,
      ok: typeof event.ok === 'boolean' ? event.ok : null,
      detail: event.detail !== undefined ? clip(event.detail) : null,
    });
    rotateIfNeeded();
    mkdirSync(dirname(PATHS.activityLog), { recursive: true });
    appendFileSync(PATHS.activityLog, line + '\n');
  } catch {
    // Logging must not break the request path.
  }
}

function rotateIfNeeded() {
  try {
    if (!existsSync(PATHS.activityLog)) return;
    const size = statSync(PATHS.activityLog).size;
    if (size <= MAX_FILE_BYTES) return;
    // Keep the last half so users still see recent context after a rotation.
    const text = readFileSync(PATHS.activityLog, 'utf8');
    const lines = text.split('\n').filter(Boolean);
    const keep = lines.slice(Math.floor(lines.length / 2));
    writeFileSync(PATHS.activityLog, keep.join('\n') + (keep.length ? '\n' : ''));
  } catch {
    // ignore — next write will try again
  }
}

/**
 * Read the activity log, newest events first. `limit` clamps the response
 * size; an optional `actionPrefix` (e.g. "scan.") narrows results.
 */
export function readActivity({ limit = 200, actionPrefix } = {}) {
  if (!existsSync(PATHS.activityLog)) return [];
  let lines;
  try {
    lines = readFileSync(PATHS.activityLog, 'utf8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
  const cap = Math.min(MAX_LINES_RETURNED, Math.max(1, limit));
  const slice = lines.slice(-cap * 2); // overshoot — JSON.parse failures get filtered below
  const out = [];
  for (const raw of slice) {
    let evt;
    try { evt = JSON.parse(raw); } catch { continue; }
    if (actionPrefix && !evt.action?.startsWith(actionPrefix)) continue;
    out.push(evt);
  }
  // Newest first
  out.reverse();
  return out.slice(0, cap);
}

/**
 * Express middleware that auto-logs successful state-changing requests.
 * Reads-only (GET) and the activity endpoint itself are skipped to keep
 * the log signal-rich. Maps method+path to a stable `action` string.
 *
 * Per F-005 we now record only successful state changes (status < 400).
 * Rejected attempts produced "audit-trail noise + spam vector" — the
 * server still logs them via console for debugging, but the user-visible
 * activity feed gets the validate→write→record contract: no log unless
 * state actually changed.
 */
export function activityMiddleware(req, res, next) {
  const action = mapAction(req);
  if (!action) return next();
  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    logActivity({
      action,
      target: pickTarget(req),
      ok: true,
      detail: null,
    });
  });
  next();
}

function mapAction(req) {
  const m = req.method;
  const p = req.path;
  // Skip the activity endpoint itself.
  if (p.startsWith('/api/activity')) return null;
  // Streams (SSE) — log the start of a long-running operation. This GET must be
  // checked BEFORE the blanket "skip reads" guard below, or it never logs.
  if (m === 'GET' && p.startsWith('/api/stream/')) {
    return 'stream.' + p.slice('/api/stream/'.length).split('/')[0];
  }
  if (m === 'GET') return null; // skip all other reads

  if (p === '/api/pipeline')  return m === 'POST' ? 'pipeline.add' : 'pipeline.remove';
  if (p === '/api/cv')        return 'cv.save';
  if (p === '/api/cv/import') return 'cv.import';
  if (p === '/api/profile')   return 'profile.save';
  if (p === '/api/config')    return 'config.save';
  if (p === '/api/jds')       return 'jd.save';
  if (p.startsWith('/api/jds/')) return m === 'DELETE' ? 'jd.delete' : 'jd.update';
  if (p.startsWith('/api/run/'))    return 'script.' + p.slice('/api/run/'.length);
  if (p === '/api/evaluate')  return 'evaluate';
  if (p === '/api/deep')      return 'deep.research';
  if (p === '/api/apply-helper') return 'apply.checklist';
  if (p === '/api/tracker')   return 'tracker.add';
  if (p.startsWith('/api/')) return null;
  return null;
}

function pickTarget(req) {
  const b = req.body || {};
  // URL-bearing endpoints
  if (typeof b.url === 'string') return b.url;
  if (typeof b.text === 'string' && b.text.includes('http')) {
    const m = b.text.match(/https?:\/\/\S+/);
    if (m) return m[0];
  }
  // company / slug / role
  if (b.company) return b.role ? `${b.company} — ${b.role}` : String(b.company);
  if (b.slug) return String(b.slug);
  // request param (DELETE /api/jds/:name)
  if (req.params && req.params.name) return String(req.params.name);
  // markdown PUT — show first line as a hint
  if (typeof b.markdown === 'string') {
    const first = b.markdown.split('\n').find((l) => l.trim());
    return first ? first.slice(0, 80) : null;
  }
  return null;
}
