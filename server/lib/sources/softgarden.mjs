// @ts-check
/**
 * softgarden source — the hosted job widget at
 * https://{tenant}.softgarden.io/{lang}/widgets/jobs (e.g. RENK:
 * renk-group.softgarden.io/de/widgets/jobs). Companies embed this Wicket page
 * as an iframe on their branded career sites; fetched directly it is a plain
 * server-rendered document listing EVERY posting — no auth, no JS, no
 * pagination (filtering happens client-side via AJAX we don't need).
 *
 * Ported from parent career-ops `providers/softgarden.mjs` into the web-ui
 * source contract (rich job objects + `meta`). One posting renders as a
 * `<div class="matchElement" id="job_id_{id}">` block whose `<a href>` is
 * relative to the /{lang}/widgets/ path — resolved against the widget URL so
 * it lands on {origin}/job/{id}/{slug}?… . Dates are the locale's short form
 * (de: D.M.YY with dots; en: M/D/YY with slashes). Host-pinned to
 * *.softgarden.io + `redirect:'error'` (SSRF-safe); MAX_JOBS=1000 preserved.
 *
 * Used by the softgarden adapter (server/lib/portals/adapters/softgarden.mjs).
 */
import { fetchText } from '../http-json.mjs';

export const meta = {
  value: 'softgarden',
  label: 'softgarden',
  region: 'en',
};

const MAX_JOBS = 1000;

// Minimal HTML entity decoder — titles carry named (&amp;) and numeric
// (&#252; / &#xfc;) entities. Mirrors successfactors.mjs / dassault.mjs.
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m;
  });
}

function clean(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Resolve the widget URL: explicit /widgets/jobs URLs pass through, any other
 * *.softgarden.io URL defaults to that tenant's German jobs widget. */
export function resolveWidgetUrl(company) {
  const raw = String(company.api || company.careers_url || '').trim();
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.host.toLowerCase();
  if (host !== 'softgarden.io' && !host.endsWith('.softgarden.io')) return null;
  if (/\/widgets\/jobs\/?$/.test(u.pathname)) return `${u.origin}${u.pathname.replace(/\/$/, '')}`;
  const lang = (u.pathname.match(/^\/([a-z]{2})(\/|$)/) || [])[1] || 'de';
  return `${u.origin}/${lang}/widgets/jobs`;
}

// Widget dates are the locale's SHORT form: de D.M.YY (dots), en M/D/YY
// (slashes). Separator infers field order; 2-digit years are 20YY.
export function parseSoftgardenDate(raw) {
  if (typeof raw !== 'string') return '';
  const s = raw.trim();
  let a, b, year;
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  const dot = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (slash) {
    [, a, b, year] = slash; // M/D/Y
  } else if (dot) {
    [, b, a, year] = dot; // D.M.Y → swap to month/day
  } else {
    return '';
  }
  const month = Number(a);
  const day = Number(b);
  let y = Number(year);
  if (y < 100) y += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parse the widget page into the rich job shape. Exported for unit tests.
 * @param {string} html @param {string} widgetUrl @param {string} companyName
 */
export function parseWidget(html, widgetUrl, companyName = 'softgarden') {
  if (typeof html !== 'string') return [];
  const out = [];
  const seen = new Set();
  const blocks = html.split(/<div class="matchElement" id="job_id_/).slice(1);
  for (const block of blocks) {
    const id = (block.match(/^(\d+)"/) || [])[1];
    if (!id || seen.has(id)) continue;
    const linkM = block.match(/<a href="([^"]*\/job\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!linkM) continue;
    const title = clean(linkM[2]);
    if (!title) continue;
    let url;
    try {
      // hrefs are relative to the /{lang}/widgets/ path ("../../job/…").
      url = new URL(decodeEntities(linkM[1]), widgetUrl).href;
    } catch {
      continue;
    }
    const cities = [];
    const cityRe = /class="location-view-item"[^>]*>([\s\S]*?)<\/span>/g;
    let cm;
    while ((cm = cityRe.exec(block)) !== null) {
      const c = clean(cm[1]);
      if (c && !cities.includes(c)) cities.push(c);
    }
    const dateM = block.match(/class="matchValue date"[^>]*>([\s\S]*?)<\/div>/);
    seen.add(id);
    out.push({
      id: `softgarden-${id}`,
      title,
      company: companyName,
      url,
      salary: '',
      location: cities.join(' / '),
      isRemote: false,
      workplaceType: '',
      relocates: false,
      date: parseSoftgardenDate(dateM ? clean(dateM[1]) : ''),
      snippet: '',
      source: 'softgarden',
    });
    if (out.length >= MAX_JOBS) break;
  }
  return out;
}

/** Fetch + parse the tenant widget (single request — the page lists everything). */
export async function fetchSoftgarden(widgetUrl, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const resolved = resolveWidgetUrl({ ...company, api: company.api || widgetUrl, careers_url: company.careers_url || widgetUrl });
  if (!resolved) throw new Error(`softgarden: cannot resolve widget URL for ${company.name || widgetUrl}`);
  const html = await fetchText(fetchImpl, resolved, { signal, redirect: 'error', headers: { accept: 'text/html' } });
  const name = (company && typeof company.name === 'string' && company.name.trim()) ? company.name.trim() : 'softgarden';
  return parseWidget(html, resolved, name);
}
