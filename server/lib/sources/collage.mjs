// @ts-check
/**
 * Collage HR public job-site API.
 *
 *   GET https://api.collage.co/v1/positions/<job-site-address>
 *
 * Per-tenant and zero-token. The path segment is an explicit **job-site
 * address** the tenant chose, not a company-name slug — so it is read from
 * config or from a `secure.collage.co/jobs/<address>` careers URL, never
 * guessed from the company name. Guessing it would silently scan somebody
 * else's board.
 *
 * Ported from parent career-ops v1.32.0 (`providers/collage.mjs`, #3787).
 */
import { fetchJson } from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';

export const meta = {
  value: 'collage',
  label: 'Collage',
  region: 'en',
};

const API_ORIGIN = 'https://api.collage.co';
const API_HOST = 'api.collage.co';
const SITE_HOST = 'secure.collage.co';

/**
 * SSRF guard. HTTPS-only, host pinned to `api.collage.co` exactly, and the
 * path shape pinned to `/v1/positions/<address>` — without the path check any
 * URL on that host would be accepted as a board.
 * @param {string} url
 */
export function assertCollageApiUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`collage: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`collage: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== API_HOST) {
    throw new Error(`collage: untrusted hostname "${parsed.hostname}" — must be ${API_HOST}`);
  }
  if (!/^\/v1\/positions\/[^/?#]+$/.test(parsed.pathname)) {
    throw new Error(`collage: API URL must be /v1/positions/<job-site-address>: ${url}`);
  }
  return url;
}

/**
 * Resolve the API URL from `api:` (used verbatim) or from a
 * `secure.collage.co/jobs/<address>` careers URL. Returns null when the entry
 * names neither — the caller turns that into a hard error rather than a scan
 * of an address it invented.
 * @param {object} [company]
 */
export function resolveCollageApiUrl(company = {}) {
  const explicit = typeof company.api === 'string' ? company.api.trim() : '';
  if (explicit) return assertCollageApiUrl(explicit);

  const raw = typeof company.careers_url === 'string' ? company.careers_url.trim() : '';
  if (!raw) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== SITE_HOST) return null;
  if (!/^\/jobs\/[^/]+\/?$/.test(parsed.pathname)) return null;
  const site = parsed.pathname.split('/').filter(Boolean).at(-1);
  // A dot in the segment means a hostname slipped into the path — that is a
  // malformed careers_url, not an address.
  if (!site || site.includes('.')) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(site);
  } catch {
    decoded = site;
  }
  if (!decoded || decoded.includes('/')) return null;
  return assertCollageApiUrl(`${API_ORIGIN}/v1/positions/${encodeURIComponent(decoded)}`);
}

/** Only an absolute HTTPS URL with no embedded credentials. */
function httpsUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) return '';
    return u.href;
  } catch {
    return '';
  }
}

function isoDate(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value < 1e12 ? value * 1000 : value).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const ms = Date.parse(value);
    if (!Number.isNaN(ms)) return new Date(ms).toISOString();
  }
  return '';
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Normalize one Collage response into web-ui job objects.
 *
 * Throws on an unrecognized envelope. The endpoint has appeared both as a bare
 * array and wrapped in `positions`; both are accepted, but any other shape is
 * rejected loudly rather than read as an empty board — a changed API must not
 * look like a tenant with no openings.
 * @param {any} json
 * @param {string} companyName
 */
export function parseCollageResponse(json, companyName) {
  const rows = Array.isArray(json) ? json : Array.isArray(json?.positions) ? json.positions : null;
  if (!rows) {
    const keys = json && typeof json === 'object' ? Object.keys(json).join(', ') : String(json);
    throw new Error(`collage: unrecognized response envelope (expected a positions array), got: [${keys}]`);
  }

  const out = [];
  for (const j of rows) {
    const title = str(j?.title);
    if (!title) continue;
    // A posting with no usable link cannot be applied to, so it is dropped
    // rather than written into the tracker as a dead row.
    const url = httpsUrl(j.hostedUrl) || httpsUrl(j.url) || httpsUrl(j.applyUrl);
    if (!url) continue;

    const location = Array.isArray(j.location)
      ? j.location.map(str).filter(Boolean).join('; ')
      : str(j.location);
    const metadata = [
      str(j.department) && `Department: ${str(j.department)}`,
      str(j.commitment) && `Commitment: ${str(j.commitment)}`,
      str(j.employmentType) && `Employment type: ${str(j.employmentType)}`,
    ].filter(Boolean).join('\n');
    const description = [htmlToText(str(j.descriptionPlain)), metadata].filter(Boolean).join('\n\n');

    out.push({
      id: `collage-${j.id ?? url}`,
      title,
      company: companyName,
      url,
      salary: '',
      location,
      isRemote: /remote|anywhere/i.test(location),
      workplaceType: '',
      relocates: false,
      date: isoDate(j.createdDate ?? j.createdAt ?? j.publishedAt),
      snippet: description.slice(0, 400),
      description,
      source: 'collage',
    });
  }
  return out;
}

/** @param {object} [company] */
export function buildCollageUrl(company = {}) {
  const url = resolveCollageApiUrl(company);
  if (!url) {
    throw new Error('collage: set `api: https://api.collage.co/v1/positions/<address>` or a secure.collage.co/jobs/<address> careers_url');
  }
  return url;
}

/**
 * Fetch + normalize one Collage tenant.
 * @param {string} url from buildEndpoint
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchCollage(url, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const target = assertCollageApiUrl(url || buildCollageUrl(company));
  const json = await fetchJson(fetchImpl, target, {
    signal,
    headers: { accept: 'application/json' },
    redirect: 'error',
  });
  return parseCollageResponse(json, company?.name || 'Collage');
}
