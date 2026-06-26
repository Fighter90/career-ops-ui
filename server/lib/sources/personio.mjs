// @ts-check
/**
 * Personio source — hits the public, no-auth XML jobs feed at
 *   GET https://<slug>.jobs.personio.(de|com)/xml
 * (common across DACH/EU companies).
 *
 * Ported from parent career-ops v1.13.0 `providers/personio.mjs` into the web-ui
 * source contract. Per-tenant subdomains vary, so the SSRF defence is an anchored
 * host regex (same approach as bamboohr/breezy) plus `redirect:'error'`. The feed
 * is a flat, well-defined XML document parsed in-process with a tiny tag extractor
 * (no XML dependency — the repo ships none).
 *
 * Used by the personio adapter (server/lib/portals/adapters/personio.mjs).
 */
import { fetchText } from '../http-json.mjs';

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

function fromCodePoint(cp) {
  try {
    return String.fromCodePoint(cp);
  } catch {
    return '';
  }
}

// Decode the XML entities that appear in Personio job text. Numeric forms first;
// &amp; LAST so "&amp;lt;" yields "&lt;" rather than over-decoding to "<".
function decodeXmlEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractText(inner) {
  const cdata = inner.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdata) return cdata[1].trim();
  return decodeXmlEntities(inner).trim();
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
 * Fetch + normalize a Personio tenant's XML jobs feed.
 * @param {string} apiUrl `https://<slug>.jobs.personio.(de|com)/xml` (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchPersonio(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertPersonioUrl(apiUrl);
  const host = new URL(apiUrl).hostname;
  const text = await fetchText(fetchImpl, apiUrl, {
    signal,
    headers: { accept: 'application/xml, text/xml' },
  });
  return parsePersonioXml(text, company.name || '', host);
}
