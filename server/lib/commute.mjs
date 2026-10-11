/** Read-only adapter for career-ops-plugin-commute v0.2.0. */
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import yaml from 'js-yaml';
import { PATHS } from './paths.mjs';
import { normalizeUrl } from './url-key.mjs';
import { parseReportHeader } from './parsers.mjs';
import { safeReadApps } from './store.mjs';

const read = (file) => { try { return readFileSync(file, 'utf8'); } catch { return ''; } };
const numberOrNull = (value) => {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Plugin TSV → canonical posting URL → safe UI record. Last duplicate wins. */
export function parseCommute(tsv) {
  const [header = '', ...lines] = String(tsv || '').split(/\r?\n/);
  const columns = header.split('\t');
  const out = new Map();
  for (const line of lines) {
    if (!line) continue;
    const cells = line.split('\t');
    const row = Object.fromEntries(cells.map((value, index) => [columns[index], value]));
    const key = normalizeUrl(row.url);
    if (!key) continue;
    const rawLat = numberOrNull(row.lat);
    const rawLon = numberOrNull(row.lon);
    const rawKm = numberOrNull(row.km);
    const rawMin = numberOrNull(row.min);
    out.set(key, {
      location: String(row.location || ''),
      precision: String(row.precision || 'unknown'),
      lat: rawLat != null && rawLat >= -90 && rawLat <= 90 ? rawLat : null,
      lon: rawLon != null && rawLon >= -180 && rawLon <= 180 ? rawLon : null,
      km: rawKm != null && rawKm >= 0 ? rawKm : null,
      min: rawMin != null && rawMin >= 0 ? rawMin : null,
      checked: String(row.checked || ''),
    });
  }
  return out;
}
/** Only the two settings the UI needs; router/geocoder/private settings never leave the server. */
export function commuteConfig() {
  try {
    const settings = yaml.load(read(PATHS.plugins))?.plugins?.commute || {};
    const lat = numberOrNull(settings.home_lat);
    const lon = numberOrNull(settings.home_lon);
    const home = lat != null && lon != null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
      ? { lat, lon }
      : null;
    const max = numberOrNull(settings.max_minutes);
    return { home, maxMinutes: max != null && max > 0 && max <= 1440 ? max : null };
  } catch {
    return { home: null, maxMinutes: null };
  }
}

function reportUrl(reportPath) {
  if (!reportPath) return '';
  const file = resolve(PATHS.reportsDir, String(reportPath).replace(/^(\.\.\/)*(reports\/)?/, ''));
  if (!file.startsWith(PATHS.reportsDir + sep)) return '';
  return parseReportHeader(read(file)).url || '';
}

/** Complete GET /api/commute response. */
export function commutePayload() {
  const byKey = parseCommute(read(PATHS.commute));
  const byNum = {};
  for (const row of safeReadApps()) {
    const key = normalizeUrl(row.url) || normalizeUrl(reportUrl(row.reportPath));
    const commute = key && byKey.get(key);
    if (commute && row.num) byNum[row.num] = commute;
  }
  const { home, maxMinutes } = commuteConfig();
  return {
    available: byKey.size > 0 || home !== null,
    home,
    maxMinutes,
    byUrl: Object.fromEntries(byKey),
    byNum,
  };
}
