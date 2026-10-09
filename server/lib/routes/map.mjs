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
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { PATHS } from '../paths.mjs';
import { parsePipelineRows, parseReportHeader } from '../parsers.mjs';
import { safeReadApps } from '../store.mjs';
import { titleFit, loadProfileTargetRoles } from '../title-fit.mjs';

const read = (f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
// Only http(s) links reach window.open in the client — parent data is LLM-written.
const httpOnly = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

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

// ponytail: rebuilt per request by reading scan-history + every JD header; cache by mtime if it gets slow.
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

function readJds() {
  try {
    return readdirSync(PATHS.jdsDir).filter((f) => f.endsWith('.md')).map((f) => read(resolve(PATHS.jdsDir, f)));
  } catch { return []; }
}

/** Report URL for a tracker row's reportPath, confined to the reports dir. */
function reportUrl(reportPath) {
  if (!reportPath) return '';
  const file = resolve(PATHS.reportsDir, reportPath.replace(/^(\.\.\/)*(reports\/)?/, ''));
  if (!file.startsWith(PATHS.reportsDir + sep)) return '';
  return parseReportHeader(read(file)).url || '';
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
  app.get('/api/map/jobs', (_req, res) => {
    const pending = parsePipelineRows(read(PATHS.pipeline));
    const idx = buildLocationIndex({
      pipelineRows: pending,
      scanHistory: read(PATHS.scanHistory),
      jds: readJds(),
    });
    const targets = loadProfileTargetRoles();
    const pipeline = pending.map((r) => {
      const f = titleFit(r.title, targets);
      const row = { ...r, href: httpOnly(r.href) };
      return f ? { ...row, fit: { band: f.band, score: f.score } } : row;
    });
    const tracker = safeReadApps().map((r) => {
      const href = r.url || reportUrl(r.reportPath);
      return { ...r, href: httpOnly(href), location: r.location || idx.get(href) || '', workplace: notesPlace(r.notes) };
    });
    const { url, attribution, dark } = tileConfig();
    res.json({ pipeline, tracker, tiles: { url, attribution, dark: { url: dark.url, attribution: dark.attribution } } });
  });
}
