/**
 * #/map data — pending pipeline rows and tracker rows, each with a location.
 *
 *   GET /api/map/jobs → { pipeline: [{url, href, company, title, location, fit?}],
 *                         tracker:  [{...tracker row, href, location}],
 *                         tiles:    {url, attribution} }
 *
 * Tracker rows rarely carry a location column, and the parent rewrites a
 * processed pipeline row without its location. So locations are resolved
 * through a URL → location index built from every place the parent records
 * one: pending pipeline rows, data/scan-history.tsv and the `- URL:` /
 * `- Location:` header of saved JDs (jds/*.md). A tracker row's URL is its own
 * `url` column, else the `**URL:**` of its report. Read-only.
 *
 * Tracker rows also get `workplace`: the place the evaluation itself verified,
 * when its Notes lead with one ("Leeds (West Yorkshire) – 40 min drive; …").
 * The posting's location can be a metro label or plain wrong (LinkedIn says
 * Stuttgart for a job in Turin), so the map tries `workplace` first and falls
 * back to `location` when it does not geocode to a settlement.
 */
import { readFileSync, readdirSync, openSync, readSync, closeSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { PATHS } from '../paths.mjs';
import { parsePipelineRows, parseReportHeader } from '../parsers.mjs';
import { safeReadApps } from '../store.mjs';
import { cachedByMtime, __mtimedCache } from '../mtimed-cache.mjs';
import { titleFit, loadProfileTargetRoles } from '../title-fit.mjs';
import { commutePayload } from '../commute.mjs';

const read = (f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
// Only http(s) links reach window.open in the client — parent data is LLM-written.
const httpOnly = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

// CAR-236 (P1 perf) — the URL→location index inputs are memoized by
// (path, mtimeMs, size) instead of being rebuilt from scratch on every
// request: the jds dir's own stat covers its capture set (captures are
// write-once — archive-posting names carry a URL hash, collisions get a
// -2/-3 suffix — so an in-place rewrite never happens), scan-history.tsv
// is keyed per file, and a url-less tracker row's report header is parsed
// once per report file instead of per row per request. A warm request
// stats instead of reading every capture's full text plus the whole TSV.
// Diagnostic counters mirror __reportCache/__appsCache (tests spy on them).
// reset() also drops this route's memo entries (via __mtimedCache.reset())
// so a test that resets sees the next call rebuild from scratch.
export const __mapCache = {
  jdsBuilds: 0,
  scanBuilds: 0,
  reportParses: 0,
  reset() {
    this.jdsBuilds = 0; this.scanBuilds = 0; this.reportParses = 0;
    __mtimedCache.reset();
  },
};

/**
 * Leading place in a tracker Notes cell, or ''. Only a short, capitalised
 * name survives — the geocoder still has to accept it as a settlement, so a
 * role phrase that slips through ("Program Management Rutesheim") just misses.
 */
export function notesPlace(notes) {
  let s = String(notes || '').split(';')[0];
  // Language-neutral: the place is whatever precedes the first parenthesis or
  // separator. Wordy leads ("Located near Leeds") fail the shape check below.
  s = s.replace(/\([^)]*\)?/g, ' ')                       // "(West Yorkshire)", unclosed "(…"
    .split(/[,/:~—–]|\s-\s/)[0]
    .replace(/\s+/g, ' ').trim();
  return /^\p{Lu}[\p{L}.]*(?:[- ]\p{Lu}[\p{L}.]*){0,2}$/u.test(s) && s.length <= 40 ? s : '';
}

// ponytail resolved (CAR-236): the scan-history / jds / report-header parts
// of the index are mtime-keyed memos now (see __mapCache above).
export function buildLocationIndex({ pipelineRows = [], scanHistory = '', jds = [] } = {}) {
  const idx = new Map();
  const put = (url, loc) => { if (url && loc && !idx.has(url)) idx.set(url, loc); };
  for (const r of pipelineRows) { put(r.url, r.location); put(r.href, r.location); }
  const [head, ...lines] = scanHistory.split(/\r?\n/);
  const cols = (head || '').split('\t');
  const iu = cols.indexOf('url');
  const il = cols.indexOf('location');
  if (iu >= 0 && il >= 0) {
    for (const l of lines) { const c = l.split('\t'); put(c[iu], (c[il] || '').trim()); }
  }
  for (const text of jds) {
    const head10 = text.slice(0, 1500);
    const u = head10.match(/^-\s*URL:\s*(\S+)/m);
    const l = head10.match(/^-\s*Location:\s*(.+)$/m);
    if (u && l) put(u[1], l[1].trim());
  }
  return idx;
}

// The builder consumes only the first 1500 chars of each capture (the slice
// below in buildLocationIndex), so a capture head is all we ever read:
// HEAD_CHARS * 4 bytes is the worst-case UTF-8 encoding of HEAD_CHARS code
// points, guaranteeing the slice sees exactly the window a full read used to.
const HEAD_CHARS = 1500;
const HEAD_BYTES = HEAD_CHARS * 4;

/** First HEAD_CHARS of a capture — the index never reads deeper. */
function readHead(file) {
  let fd;
  try {
    fd = openSync(file, 'r');
    const buf = Buffer.alloc(HEAD_BYTES);
    const n = readSync(fd, buf, 0, HEAD_BYTES, 0);
    return buf.toString('utf8', 0, n).slice(0, HEAD_CHARS);
  } catch {
    return '';
  } finally {
    if (fd !== undefined) { try { closeSync(fd); } catch { /* already closed */ } }
  }
}

function readJdHeads(dir) {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => readHead(resolve(dir, f)));
  } catch { return []; }
}

/** jds captures → {url → location}, rebuilt only when the dir stat changes. */
function jdsIndex() {
  return cachedByMtime(PATHS.jdsDir, () => {
    __mapCache.jdsBuilds++;
    return buildLocationIndex({ jds: readJdHeads(PATHS.jdsDir) });
  });
}

/** scan-history TSV → {url → location}, rebuilt only when the file changes. */
function scanHistoryIndex() {
  return cachedByMtime(PATHS.scanHistory, (file) => {
    __mapCache.scanBuilds++;
    return buildLocationIndex({ scanHistory: read(file) });
  });
}

/** Report URL for a tracker row's reportPath, confined to the reports dir. */
function reportUrl(reportPath) {
  if (!reportPath) return '';
  const file = resolve(PATHS.reportsDir, reportPath.replace(/^(\.\.\/)*(reports\/)?/, ''));
  if (!file.startsWith(PATHS.reportsDir + sep)) return '';
  const header = cachedByMtime(file, (f) => {
    __mapCache.reportParses++;
    return parseReportHeader(read(f));
  });
  return header.url || '';
}

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * CAR-57 (v1.247.0) — dark-theme tile set. CARTO's "dark matter" raster
 * (served over OpenStreetMap data) is the canonical dark basemap; `{s}` walks
 * a–d, `{r}` upgrades to @2x on retina. CAVEAT (verified 2026-10-09): the
 * keyless endpoint now answers real tile requests with an "API KEY REQUIRED"
 * placeholder PNG, so it is only a PRESET for operators — the client mounts it
 * when MAP_TILE_DARK_URL names a working (keyed/self-hosted) dark provider,
 * and otherwise renders dark mode with a CSS-inverted light layer.
 * `origin` is the CSP form (wildcard subdomains). Attribution links are
 * anchors, not images — no CSP entry needed for carto.com.
 */
export const DARK_TILES = Object.freeze({
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  origin: 'https://*.basemaps.cartocdn.com',
});

/**
 * Tile server for the map: OpenStreetMap unless MAP_TILE_URL names another
 * Leaflet template (self-hosted or a provider's). `origin` feeds the CSP
 * (host limited to [\w.{}:-], so the env cannot smuggle in a directive);
 * a `{s}` subdomain becomes the CSP wildcard `*.`. `darkOrigin` is the
 * second allowed img-src host — the dark-theme basemap the client swaps in.
 */
export function tileConfig(env = process.env) {
  const url = /^https?:\/\/[\w.{}:-]+\/\S+$/.test(env.MAP_TILE_URL || '') ? env.MAP_TILE_URL : OSM_TILES;
  // MAP_TILE_DARK_URL — an operator-configured dark basemap (e.g. keyed
  // Carto, or a self-hosted dark style). Without it the client falls back to
  // CSS-inverted light tiles, because the Carto preset is placeholder-gated.
  const darkConfigured = /^https?:\/\/[\w.{}:-]+\/\S+$/.test(env.MAP_TILE_DARK_URL || '');
  const darkUrl = darkConfigured ? env.MAP_TILE_DARK_URL : DARK_TILES.url;
  return {
    url,
    // Plain text: Leaflet renders attribution as HTML.
    attribution: String(env.MAP_TILE_ATTRIBUTION || '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`),
    origin: url.match(/^https?:\/\/[^/]+/)[0].replace(/\{s\}/g, '*'),
    darkOrigin: darkConfigured
      ? darkUrl.match(/^https?:\/\/[^/]+/)[0].replace(/\{s\}/g, '*')
      : DARK_TILES.origin,
    dark: {
      url: darkUrl,
      attribution: darkConfigured
        ? String(env.MAP_TILE_DARK_ATTRIBUTION || '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
        : DARK_TILES.attribution,
      configured: darkConfigured,
    },
  };
}

export function registerMapRoutes(app) {
  app.get('/api/commute', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(commutePayload());
  });

  app.get('/api/map/jobs', (_req, res) => {
    const pending = parsePipelineRows(read(PATHS.pipeline));
    // CAR-236: the pipeline part of the index is computed fresh (pipeline.md
    // is small and changes on every pipeline write); the scan-history and
    // jds parts come from mtime-keyed memos. The merge keeps
    // buildLocationIndex's first-wins precedence: pipeline → scan-history
    // → jds. Fail-open: an index bug degrades to unlocated pins, never a 500.
    let idx;
    try {
      idx = buildLocationIndex({ pipelineRows: pending });
      for (const [u, loc] of scanHistoryIndex()) if (!idx.has(u)) idx.set(u, loc);
      for (const [u, loc] of jdsIndex()) if (!idx.has(u)) idx.set(u, loc);
    } catch {
      idx = new Map();
    }
    const targets = loadProfileTargetRoles();
    const pipeline = pending.map((r) => {
      const f = titleFit(r.title, targets);
      const row = { ...r, href: httpOnly(r.href) };
      return f ? { ...row, fit: { band: f.band, score: f.score } } : row;
    });
    const tracker = safeReadApps().map((r) => {
      let href = r.url;
      if (!href) { try { href = reportUrl(r.reportPath); } catch { href = ''; } }
      return { ...r, href: httpOnly(href), location: r.location || idx.get(href) || '', workplace: notesPlace(r.notes) };
    });
    const { url, attribution, dark } = tileConfig();
    res.json({ pipeline, tracker, tiles: { url, attribution, dark: { url: dark.url, attribution: dark.attribution } } });
  });
}
