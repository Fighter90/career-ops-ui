// @ts-check
/**
 * Personio source — hits the public, no-auth XML jobs feed at
 *   GET https://<slug>.jobs.personio.(de|com)/xml
 * (common across DACH/EU companies).
 *
 * Implements the web-ui
 * source contract. Per-tenant subdomains vary, so the SSRF defence is an anchored
 * host regex (same approach as bamboohr/breezy) plus `redirect:'error'`. The feed
 * is a flat, well-defined XML document parsed in-process with a tiny tag extractor
 * (no XML dependency — the repo ships none).
 *
 * Used by the personio adapter (server/lib/portals/adapters/personio.mjs).
 */
import { fetchText } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
const decodeXmlEntities = decodeEntities;

export const PERSONIO_HOST_RE = /^[a-z0-9][a-z0-9-]*\.jobs\.personio\.(de|com)$/;
const REMOTE_RE = /remote|homeoffice|home\s*office|ortsunabh|deutschlandweit|bundesweit/i;

export const meta = {
  value: 'personio',
  label: 'Personio',
  region: 'en',
};

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertPersonioUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`personio: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`personio: URL must use HTTPS: ${url}`);
  if (!PERSONIO_HOST_RE.test(parsed.hostname)) {
    throw new Error(`personio: untrusted hostname "${parsed.hostname}" — must match <slug>.jobs.personio.(de|com)`);
  }
  return url;
}

function extractText(inner) {
  const cdata = inner.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdata) return cdata[1].trim();
  return decodeXmlEntities(inner).trim();
}

// Looped to a fixed point rather than a single pass: a single global replace
// only removes non-overlapping matches in one left-to-right sweep, which CodeQL
// flags as an incomplete sanitizer (js/incomplete-sanitization) since adversarial
// nesting can leave a `<`-fragment behind. Repeating until the string stops
// changing removes any tag that pass N reveals. Used by the HTML fallback parser.
function stripTags(s) {
  let prev;
  do {
    prev = s;
    s = s.replace(/<[^>]*>/g, '');
  } while (s !== prev);
  return s;
}

function tagText(block, tag) {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? extractText(m[1]) : '';
}

// NaN-safe Date.parse → ISO string.
function toIso(value) {
  if (!value) return '';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString();
}

/**
 * Parse Personio's public XML jobs feed. Exported for unit tests.
 *
 * Shape: `<workzag-jobs><position>…</position>…</workzag-jobs>`, each position
 * carrying `<id>`, `<name>`, `<office>` (+ optional `<additionalOffices>`), and
 * `<createdAt>`. The feed has NO per-job URL, so it is built from the validated
 * tenant host: `https://<host>/job/<id>` (only when `<id>` is a plain integer).
 *
 * @param {string} xml raw XML feed body
 * @param {string} companyName value written into job.company
 * @param {string} host validated tenant host, e.g. `acme.jobs.personio.de`
 */
export function parsePersonioXml(xml, companyName, host) {
  if (typeof xml !== 'string') return [];
  const jobs = [];
  // Strip <jobDescriptions> subtrees first: free-text HTML can carry a literal
  // "</position>" that would truncate the non-greedy block match, and nested
  // <name> tags that would race the position's own <name>.
  const stripped = xml.replace(/<jobDescriptions\b[^>]*>[\s\S]*?<\/jobDescriptions>/gi, '');
  const blocks = stripped.match(/<position\b[^>]*>[\s\S]*?<\/position>/g) || [];
  for (const block of blocks) {
    const title = tagText(block, 'name');
    if (!title) continue;

    const id = tagText(block, 'id');
    if (!/^\d+$/.test(id)) continue; // need a clean numeric id to build the url

    const offices = [];
    const seen = new Set();
    for (const om of block.matchAll(/<office\b[^>]*>([\s\S]*?)<\/office>/g)) {
      const name = extractText(om[1]);
      if (name && !seen.has(name)) {
        seen.add(name);
        offices.push(name);
      }
    }
    const location = offices.join(', ');
    const isRemote = REMOTE_RE.test(location) || REMOTE_RE.test(title);

    jobs.push({
      id: `personio-${id}`,
      title,
      company: companyName,
      url: `https://${host}/job/${id}`,
      salary: '',
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : 'Onsite',
      relocates: false,
      date: toIso(tagText(block, 'createdAt')),
      snippet: '',
      source: 'personio',
    });
  }
  return jobs;
}

/**
 * Fallback parser for tenants whose /xml feed is disabled (404 on /xml, 200 on
 * the careers page). The page is server-rendered by the shared Personio frontend
 * build, so the full job list is already present in the initial HTML — no
 * headless browser needed. Each job is an `<a href="/job/{id}">` carrying the
 * stable, non-hashed marker class `job-box`, wrapping an `<h3>` title and a
 * `<span class="…jobMetaText…">` with the first location line. Only the stable
 * `job-box` / `jobMetaText` substrings are matched so the regex stays independent
 * of the build-specific hashed CSS-module suffixes (e.g. `page_jobTitle__K0ilk`).
 *
 * No creation date is exposed on the listing page, so `date` is always ''
 * (unlike parsePersonioXml's createdAt). Exported for unit tests.
 *
 * @param {string} html careers page HTML body
 * @param {string} companyName value written into job.company
 * @param {string} host validated tenant host, e.g. `acme.jobs.personio.de`
 */
export function parsePersonioHtml(html, companyName, host) {
  if (typeof html !== 'string') return [];
  const jobs = [];
  const seen = new Set();
  // href may carry a trailing query string (e.g. "/job/2560093?language=en"
  // when the page was fetched with ?language=en) — the numeric id is what we
  // need, so the query part (if any) is matched and discarded. class and href
  // aren't guaranteed in a fixed order on the anchor, so the opening tag's
  // attributes are captured as one blob and checked independently.
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = anchorRe.exec(html))) {
    const attrs = m[1];
    if (!/\bclass="[^"]*\bjob-box\b[^"]*"/.test(attrs)) continue;
    const hrefMatch = attrs.match(/\bhref="\/job\/(\d+)(?:\?[^"]*)?"/);
    if (!hrefMatch) continue;
    const id = hrefMatch[1];
    if (seen.has(id)) continue;
    const block = m[2];

    const titleMatch = block.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/);
    if (!titleMatch) continue;
    const title = decodeXmlEntities(stripTags(titleMatch[1])).trim();
    if (!title) continue;

    const locMatch = block.match(/<span\b[^>]*class="[^"]*jobMetaText[^"]*"[^>]*>([\s\S]*?)<\/span>/);
    const location = locMatch ? decodeXmlEntities(stripTags(locMatch[1])).trim() : '';
    const isRemote = REMOTE_RE.test(location) || REMOTE_RE.test(title);

    seen.add(id);
    jobs.push({
      id: `personio-${id}`,
      title,
      company: companyName,
      url: `https://${host}/job/${id}`,
      salary: '',
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : 'Onsite',
      relocates: false,
      date: '',
      snippet: '',
      source: 'personio',
    });
  }
  return jobs;
}

/**
 * Fetch + normalize a Personio tenant's jobs. Primary path is the public XML
 * feed; when a tenant disables it (404 on /xml) the careers page is scraped
 * instead — see {@link parsePersonioHtml}. Any other error (network, 5xx,
 * blocked) is a genuine dead board and rethrown; if the HTML fallback itself
 * fails/errors, that error propagates too (dead board preserved).
 * @param {string} apiUrl `https://<slug>.jobs.personio.(de|com)/xml` (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchPersonio(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertPersonioUrl(apiUrl);
  const host = new URL(apiUrl).hostname;
  try {
    const text = await fetchText(fetchImpl, apiUrl, {
      signal,
      headers: { accept: 'application/xml, text/xml' },
    });
    return parsePersonioXml(text, company.name || '', host);
  } catch (err) {
    // A non-404 failure is a genuine dead board — rethrow, no silent fallback.
    if (err?.status !== 404) throw err;
    // Some tenants disable the public XML feed (404 on /xml, 200 on the page).
    // The careers page is server-rendered with the full job list in its initial
    // HTML, so fall back to scraping it directly instead of giving up.
    // ?language=en forces English titles — unlike the XML feed (no language
    // param; always the tenant default), the HTML page respects it.
    const pageUrl = `https://${host}/?language=en`;
    assertPersonioUrl(pageUrl);
    const html = await fetchText(fetchImpl, pageUrl, {
      signal,
      headers: { accept: 'text/html' },
    });
    return parsePersonioHtml(html, company.name || '', host);
  }
}
