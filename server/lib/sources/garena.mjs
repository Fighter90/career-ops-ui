// @ts-check
/**
 * Garena source — the public careers API behind careers.garena.com.
 *
 *   POST https://careers.garena.com/api/job/list?office=<office>
 *
 * Single-company and zero-token, like ibm / dassault: one fixed host, no
 * per-tenant discovery, so an entry selects it with `provider: garena`.
 *
 * Unusually for a single-company source (most are a plain GET) the request is
 * a POST with an empty JSON object. The parent verified live that the endpoint
 * 200s with no body at all, and that `office` does not filter anything — every
 * office code tried, including an invented one, returned the same 98-job list.
 * It is still sent, because matching the real request shape is safer than
 * relying on undocumented leniency, and because the PUBLIC job page does use
 * it in its path (`/<office>/careers/<id>`). So a wrong office breaks the job
 * links, not the listing.
 *
 * Response shape: `{ jobs: [{ id, title, tags: { location: string[] },
 * description }] }` — one request, no pagination; `jobs` is the whole board.
 *
 * Ported from parent career-ops v1.31.0 (`providers/garena.mjs`).
 */
import { fetchJson } from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';

export const meta = {
  value: 'garena',
  label: 'Garena',
  region: 'en',
};

const API_URL = 'https://careers.garena.com/api/job/list';
const HOST = 'careers.garena.com';
const DEFAULT_OFFICE = 'global';

/**
 * Validate a Garena URL: HTTPS-only, host pinned to `careers.garena.com`
 * exactly. An `endsWith` check would accept `careers.garena.com.evil.test`.
 * @param {string} url
 */
export function assertGarenaUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`garena: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`garena: URL must use HTTPS: ${url}`);
  if (parsed.host.toLowerCase() !== HOST) {
    throw new Error(`garena: untrusted host "${parsed.host}" — must be ${HOST}`);
  }
  return url;
}

/** @param {{ garena?: { office?: string } }} [company] */
export function resolveOffice(company) {
  const office = company?.garena?.office;
  return typeof office === 'string' && office.trim() ? office.trim() : DEFAULT_OFFICE;
}

/**
 * Escape an untrusted value before it is interpolated into a Garena URL.
 *
 * `office` is user config and `id` is remote API data, so neither may widen the
 * URL we intended: separators are percent-escaped, and `.` / `..` are rejected
 * outright because escaping leaves them intact as traversal segments.
 * @param {string} name field name, for the error message
 * @param {string} value
 */
export function urlSegment(name, value) {
  if (value === '.' || value === '..') {
    throw new Error(`garena: ${name} is not a usable URL segment: ${JSON.stringify(value)}`);
  }
  return encodeURIComponent(value);
}

/** @param {object} [company] */
export function buildGarenaUrl(company) {
  return `${API_URL}?office=${urlSegment('office', resolveOffice(company))}`;
}

/**
 * Normalize one Garena API response into web-ui job objects.
 *
 * Throws when the payload does not carry `jobs[]`, so a silent endpoint change
 * surfaces as a hard error rather than as a board with no openings — the
 * failure mode that makes a scraped source untrustworthy.
 * @param {any} json
 * @param {{ name?: string, garena?: { office?: string } }} [company]
 */
export function parseGarenaResponse(json, company = {}) {
  const jobs = json && Array.isArray(json.jobs) ? json.jobs : null;
  if (!jobs) {
    const keys = json ? Object.keys(json).join(', ') : 'null';
    throw new Error(`garena: unexpected API response — expected jobs[], got keys: [${keys}]`);
  }

  const officeSegment = urlSegment('office', resolveOffice(company));
  const name = company?.name || 'Garena';
  const out = [];

  for (const j of jobs) {
    if (!j || typeof j.title !== 'string' || !j.title.trim()) continue;
    const id = j.id != null ? String(j.id).trim() : '';
    if (!id) continue;

    const locations = Array.isArray(j.tags?.location)
      ? j.tags.location.filter((l) => typeof l === 'string' && l.trim())
      : [];
    const location = locations.join(', ');
    const description = typeof j.description === 'string' ? htmlToText(j.description).trim() : '';
    const url = `https://${HOST}/${officeSegment}/careers/${urlSegment('id', id)}`;

    out.push({
      id: `garena-${id}`,
      title: j.title.trim(),
      company: name,
      url,
      salary: '',
      location,
      isRemote: /remote/i.test(location),
      workplaceType: '',
      relocates: false,
      date: '',
      snippet: description.slice(0, 400),
      description,
      source: 'garena',
    });
  }
  return out;
}

/**
 * Fetch + normalize the Garena board.
 * @param {string} url from buildEndpoint
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchGarena(url, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const target = assertGarenaUrl(url || buildGarenaUrl(company));

  // redirect:'error' is the SSRF guard — a server-side redirect must not be
  // followed to a private address. The empty-object body is what the careers
  // site itself sends.
  const json = await fetchJson(fetchImpl, target, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({}),
    redirect: 'error',
  });

  return parseGarenaResponse(json, company);
}
