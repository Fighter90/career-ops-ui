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
 * runners table inside index.mjs; it spawns the standalone scan.mjs and is
 * unrelated to these in-process routes.
 */
import { runRuScan, loadConfig as loadRuConfig } from '../ru-scanner.mjs';
import { runEnScan, loadLastScan } from '../en-scanner.mjs';
import { getLastWorkdayFallback } from '../sources/workday.mjs';
import { SOURCES } from '../sources/registry.mjs';
import { PATHS } from '../paths.mjs';
import { detectRepostsFromFile, DEFAULT_WINDOW_DAYS } from '../detect-reposts.mjs';

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

  // ─── Repost / ghost-posting detection (v1.83.0, parent v1.15.0 parity) ───
  // Reads data/scan-history.tsv and flags company+role clusters re-listed under
  // different URLs within a rolling window. Read-only; never writes.
  app.get('/api/scan/reposts', (req, res) => {
    const raw = parseInt(String(req.query.window || ''), 10);
    const windowDays = Number.isFinite(raw) ? Math.min(365, Math.max(7, raw)) : DEFAULT_WINDOW_DAYS;
    let clusters = [];
    try {
      clusters = detectRepostsFromFile(PATHS.scanHistory, windowDays);
    } catch {
      clusters = []; // fail-soft: a malformed history must not 500 the page
    }
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ windowDays, clusters });
  });

  // ─── Latest scan results (for table view in UI) ───
  //
  // Two modes on one route:
  //
  //   no query params  → the full snapshot, unchanged. The SPA's #/scan table
  //                      reads this and does its own client-side filtering.
  //   ?q= / ?region= / → a filtered, paged slice with a TOTAL count.
  //   ?limit= ?offset=
  //
  // The paged mode exists for API consumers that cannot hold the snapshot in
  // memory. The full response is ~2 MB (2837 regional + 278 EN rows), which
  // overflows an LLM agent's context — so the Telegram assistant, told to
  // "summarize the new on-target postings", was answering from a handful of
  // rows it had gathered elsewhere and reporting 9 matches where the snapshot
  // held 403. It could see the endpoint; it could not consume it.
  //
  // `total` is the count BEFORE paging, so an agent can answer "how many are
  // there?" honestly from one request even when it only renders `limit` rows.
  app.get('/api/scan-results', (req, res) => {
    // v1.17.0 — surface lastWorkdayFallback so the SPA's Active
    // Companies card can render 🔒 chips for CAPTCHA-gated tenants.
    // Only the snapshot, not history — the scanner resets it on each
    // successful Workday fetch.
    const snapshot = loadLastScan();
    const q = String(req.query.q || '').trim();
    const region = String(req.query.region || '').trim().toLowerCase();
    const setName = String(req.query.set || 'filtered').trim().toLowerCase();
    const hasQuery = q || region || req.query.limit || req.query.offset || req.query.set;

    if (!hasQuery) {
      res.json({ ...snapshot, workdayFallback: getLastWorkdayFallback() });
      return;
    }

    // `filtered` is everything that survived the scan's own filters; `fresh` is
    // only what was new on the last run. An agent asked "find all X" wants the
    // former — defaulting to `fresh` is what made the answer look empty.
    const wanted = setName === 'fresh' ? 'fresh' : 'filtered';
    const regions = region === 'ru' || region === 'en' ? [region] : ['en', 'ru'];
    const rows = [];
    for (const r of regions) {
      for (const job of (snapshot?.[r]?.[wanted] || [])) rows.push({ ...job, region: r });
    }

    // Case- and diacritic-insensitive substring over the fields a person would
    // search by. Deliberately NOT the scanner's title_filter: this is a lookup
    // over results already kept, not a second round of exclusion.
    const needle = q.toLowerCase();
    const matched = needle
      ? rows.filter((j) => `${j.title || ''} ${j.company || ''} ${j.location || ''}`.toLowerCase().includes(needle))
      : rows;

    // `|| default` is wrong here: parseInt('0') is 0, which is falsy, so
    // ?limit=0 would silently become 50 instead of clamping to 1. Test for a
    // finite number, then clamp — the two are different questions.
    const rawLimit = parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, rawLimit)) : 50;
    const rawOffset = parseInt(String(req.query.offset ?? ''), 10);
    const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

    res.json({
      total: matched.length,
      returned: Math.min(limit, Math.max(0, matched.length - offset)),
      offset,
      limit,
      set: wanted,
      region: regions.join(','),
      query: q,
      rows: matched.slice(offset, offset + limit),
    });
  });
}
