/**
 * Scan routes — in-process portal scanners + last-scan accessor.
 *
 * Routes registered:
 *   GET /api/stream/scan?source=ats|regional|both  — consolidated SSE entrypoint
 *   GET /api/scan/regional/config — current russian_portals: config
 *   GET /api/scan-results       — latest run snapshot from data/last-scan.json
 *
 * F-018: v1.18.0 retires the legacy `/api/stream/scan-{en,ru}` aliases
 * (deprecated since v1.12.0, Sunset 2026-10-01 originally announced —
 * advanced for v1.18). Every consumer goes through the consolidated
 * `/api/stream/scan?source=ats|regional|both` endpoint. SSE shape and
 * event names are unchanged.
 *
 * NOTE: the buffered `scan.mjs` runner (POST /api/run/scan) lives in the
 * runners table inside index.mjs; it spawns the parent's scan.mjs and is
 * unrelated to these in-process routes.
 */
import { runRuScan, loadConfig as loadRuConfig } from '../ru-scanner.mjs';
import { runEnScan, loadLastScan } from '../en-scanner.mjs';
import { getLastWorkdayFallback } from '../sources/workday.mjs';
import { SOURCES } from '../sources/registry.mjs';

/**
 * Open an SSE response with the standard headers used across this repo.
 * Returns a `send(event, data)` writer.
 */
function openSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  return (event, data) => {
    if (event) res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
}

/**
 * Single SSE driver for one scanner. The consolidated
 * `/api/stream/scan?source=` route uses this once for ats / regional,
 * twice for both. (v1.18.0 retired the legacy scan-{en,ru} aliases.)
 */
async function driveOne({ res, send, runner, label, query, final = true }) {
  send('start', {
    script: label,
    writeFiles: query.dryRun !== '1',
    companyName: query.company ? String(query.company) : undefined,
  });
  const ctrl = new AbortController();
  let aborted = false;
  res.on('close', () => { aborted = true; ctrl.abort(); });
  try {
    const result = await runner({
      writeFiles: query.dryRun !== '1',
      companyName: query.company ? String(query.company) : undefined,
      // v1.80.0 — optional per-source cap (EN scanner; ru-scanner ignores it).
      maxPerSource: query.maxPerSource ? Number(query.maxPerSource) : 0,
      signal: ctrl.signal,
      onLog: (stream, line) => { if (!aborted) send('log', { stream, line }); },
      onProgress: (done, total) => { if (!aborted) send('progress', { done, total }); },
    });
    // v1.29.2 — `final` lets the consumer know whether MORE phases follow.
    // The SSE client in public/js/api.js auto-closes the EventSource on
    // `done` only when `final !== false`. Pre-v1.29.2 the client closed on
    // the FIRST `done` of `source=both`, terminating the stream before the
    // regional phase could fire — that's the user-reported bug ("ATS
    // scanned but no Russian sites").
    if (!aborted) send('done', { code: 0, counts: result.counts, errors: result.errors.length, final });
    return { ok: true, result };
  } catch (err) {
    if (!aborted) send('error', { message: err && err.message });
    return { ok: false };
  }
}

export function registerScanRoutes(app) {
  // ─── F-018 LITE — consolidated entrypoint ───
  // GET /api/stream/scan?source=ats|regional|both[&dryRun=1][&company=Acme]
  // Default source=both runs ATS first, then regional, in one SSE
  // connection. New SPA code should use this; the two legacy endpoints
  // below stay for backwards compat.
  app.get('/api/stream/scan', async (req, res) => {
    const source = String(req.query.source || 'both').toLowerCase();
    const send = openSse(res);
    if (source === 'ats') {
      await driveOne({ res, send, runner: runEnScan, label: 'en-scanner', query: req.query });
    } else if (source === 'regional') {
      await driveOne({ res, send, runner: runRuScan, label: 'ru-scanner', query: req.query });
    } else if (source === 'both' || source === '') {
      // v1.29.2 — first phase's `done` carries `final: false` so the SSE
      // client keeps the EventSource open for the regional phase.
      const a = await driveOne({ res, send, runner: runEnScan, label: 'en-scanner', query: req.query, final: false });
      if (a.ok && !res.writableEnded) {
        await driveOne({ res, send, runner: runRuScan, label: 'ru-scanner', query: req.query, final: true });
      }
    } else {
      send('error', { message: `unknown source "${source}" (expected: ats | regional | both)` });
    }
    if (!res.writableEnded) res.end();
  });

  // v1.18.0 — legacy /api/stream/scan-{en,ru} aliases removed. Any
  // external integration on the old paths receives 404; the consolidated
  // /api/stream/scan?source=ats|regional|both above is the single way in.
  // Sunset header had been live since v1.15.0 (RFC 8594) — the migration
  // window is now closed.

  // v1.20.0 — sunset of /api/scan-ru/config alias completed.
  // Canonical regional-scanner config endpoint.
  app.get('/api/scan/regional/config', (_req, res) => {
    try {
      res.json(loadRuConfig());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // v1.29.0 — canonical list of every source the scanner knows about.
  // The SPA's #/scan source-filter dropdown reads this on mount so adding
  // a new adapter = one entry in `server/lib/sources/registry.mjs`,
  // dropdown updates automatically. Cached for 60s upstream because the
  // list is effectively static per-deploy.
  app.get('/api/scan/sources', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ sources: SOURCES });
  });

  // ─── Latest scan results (for table view in UI) ───
  app.get('/api/scan-results', (_req, res) => {
    // v1.17.0 — surface lastWorkdayFallback so the SPA's Active
    // Companies card can render 🔒 chips for CAPTCHA-gated tenants.
    // Only the snapshot, not history — the scanner resets it on each
    // successful Workday fetch.
    res.json({
      ...loadLastScan(),
      workdayFallback: getLastWorkdayFallback(),
    });
  });
}
