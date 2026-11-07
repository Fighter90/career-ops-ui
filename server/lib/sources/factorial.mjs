// @ts-check
/**
 * Factorial source — the careers sites the Factorial ATS hosts for each
 * customer, one tenant per `tracked_companies:` entry:
 *
 *   - name: Acme
 *     careers_url: https://acme.factorialhr.com
 *
 * Ported from the parent's providers/factorial.mjs (upstream #6394).
 *
 * A tenant is one label under one of Factorial's domains (FACTORIAL_DOMAINS).
 * The same tenant can answer on more than one of them, and its board links its
 * postings to its home domain (`casafari.factorialhr.com` 302'd to
 * `casafari.factorialhr.pt` while `casafari.factorial.com` served the same
 * board with postings linked to `.factorialhr.pt` — 2026-11-04). So a card is
 * kept when it names the same tenant on any Factorial domain. The request goes
 * to the host the entry names, except `.factorialhr.com`, which redirects (301
 * to `.factorial.com` for most tenants) and is read at
 * `<tenant>.factorial.com`. Factorial's product hosts (www, app, api, help,
 * blog) are not claimed. A tenant that does not exist serves no board (404 /
 * no DNS / 526), so a mistyped slug is a loud error, not an empty board.
 *
 * The board's home page server-renders every posting, grouped by office:
 *
 *   <div data-target='job-filters.officeGroup'>
 *     <h3 …>Barcelona</h3>
 *     <li class='job-offer-item …' data-is-remote='false'
 *         data-job-postings-url='https://<tenant>.factorial.com/job_posting/<slug>-<id>' …>
 *       <div class="… factorial__headingFontFamily">Account Executive</div>
 *
 * One request reads the whole board; no pagination was seen. The list carries
 * no date and no description: those are on each posting page, which this
 * source never fetches — so `date` stays '' and there is no snippet for the
 * content filter (missing = pass).
 *
 * Deviations for the web-ui source contract: the fetch goes through the shared
 * fetchTextWithRetry (injected fetchImpl, redirect:'error'), the endpoint is
 * re-validated against the domain list before any request, and rows are
 * normalized to the scanner's job shape. Descriptions are never fetched, so
 * htmlToText/DESCRIPTION_CAP are not applicable here.
 */
import { fetchTextWithRetry } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

export const meta = {
  value: 'factorial',
  label: 'Factorial',
  region: 'en',
};

/**
 * Factorial's own domains, from the `frame-ancestors` list in the
 * Content-Security-Policy its tenant boards send (read 2026-11-04). An
 * explicit list, so a host such as `acme.factorialhr.com.evil.example` is
 * never taken for a tenant.
 */
export const FACTORIAL_DOMAINS = [
  'factorial.ae', 'factorial.be', 'factorial.ch', 'factorial.co', 'factorial.com',
  'factorial.es', 'factorial.fr', 'factorial.it', 'factorial.ke', 'factorial.mx',
  'factorial.pl', 'factorial.rs',
  'factorialhr.ar', 'factorialhr.cl', 'factorialhr.co', 'factorialhr.co.uk',
  'factorialhr.com', 'factorialhr.com.ar', 'factorialhr.com.br', 'factorialhr.com.de',
  'factorialhr.de', 'factorialhr.pt',
];
const TENANT_LABEL_RE = /^[a-z0-9][a-z0-9-]*$/;
/** Subdomains that are Factorial's product or marketing, not a careers board. */
const NOT_A_BOARD = new Set(['www', 'app', 'api', 'help', 'blog']);

const POSTING_HREF_RE = /\/job_posting\/[a-z0-9-]+/i;

/**
 * Splits a host into a Factorial tenant and domain, or null when it is not
 * one label under a Factorial domain. Exported for tests.
 * @param {string} hostname
 * @returns {{ tenant: string, domain: string } | null}
 */
export function splitTenantHost(hostname) {
  const host = hostname.toLowerCase();
  for (const domain of FACTORIAL_DOMAINS) {
    if (!host.endsWith(`.${domain}`)) continue;
    const tenant = host.slice(0, -(domain.length + 1));
    if (!TENANT_LABEL_RE.test(tenant) || NOT_A_BOARD.has(tenant)) return null;
    return { tenant, domain };
  }
  return null;
}

/**
 * The tenant's board origin, or null when the URL is not a Factorial tenant
 * board. The host the entry names, except `.factorialhr.com`, which redirects
 * and is read at `<tenant>.factorial.com` instead. Exported for tests.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function resolveFactorialOrigin(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  const split = splitTenantHost(parsed.hostname);
  if (!split) return null;
  const domain = split.domain === 'factorialhr.com' ? 'factorial.com' : split.domain;
  return `https://${split.tenant}.${domain}`;
}

/**
 * Defence-in-depth endpoint check: HTTPS on exactly a Factorial tenant host
 * (default port only). Runs on the endpoint the adapter resolved, before any
 * request — a tampered or misconfigured entry can never point the fetch
 * somewhere else. Exported for tests.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertFactorialUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`factorial: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`factorial: URL must use HTTPS: ${url}`);
  if (parsed.port !== '') throw new Error(`factorial: a non-default port is not allowed: ${url}`);
  if (!splitTenantHost(parsed.hostname)) {
    throw new Error(`factorial: untrusted hostname "${parsed.hostname}" — must be <tenant>.factorial.com (or another Factorial domain)`);
  }
  return url;
}

/** @param {string} html */
function text(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * Reads one attribute value from a start tag (single or double quotes).
 * @param {string} tag
 * @param {string} name
 */
function attr(tag, name) {
  const m = new RegExp(`\\s${name}=(?:'([^']*)'|"([^"]*)")`).exec(tag);
  return m ? decodeEntities(m[1] ?? m[2] ?? '') : '';
}

/**
 * Parses a tenant board's home page. Exported for unit tests.
 *
 * Throws when the page links to postings but no card could be read (the
 * markup changed); a page with no posting links is an empty board. A
 * malformed row is dropped, never fatal.
 *
 * @param {string} html
 * @param {string} origin - the board origin the page was read from
 * @param {string} company
 * @returns {Array<{title: string, url: string, company: string, location: string,
 *   externalId?: string, remote: boolean}>}
 */
export function parseFactorialBoard(html, origin, company) {
  const page = typeof html === 'string' ? html : '';
  if (!page.trim()) throw new Error('factorial: empty response body');
  const tenant = splitTenantHost(new URL(origin).hostname)?.tenant;
  // One entry per posting URL. Offices and the remote flag are kept apart and
  // the location is rendered once at the end, so a posting listed under a
  // second office cannot repeat a place already in its location.
  /** @type {Map<string, { job: any, offices: string[], remote: boolean }>} */
  const byUrl = new Map();

  // Each office group starts at its marker; a card's office is the heading of
  // the group it sits in. Cards before the first marker get no office.
  const parts = page.split(/data-target=['"]job-filters\.officeGroup['"]/);
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const heading = i === 0 ? '' : text((/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(part) || [])[1] || '');
    const cards = part.split(/<li\s+class=['"]job-offer-item\b/).slice(1);
    for (const card of cards) {
      const tag = card.slice(0, card.indexOf('>') + 1);
      const rawUrl = attr(tag, 'data-job-postings-url');
      let url;
      try {
        url = new URL(rawUrl);
      } catch {
        continue;
      }
      // The same tenant on any Factorial domain: a board can link its postings
      // to the tenant's home domain rather than the host it was read from.
      if (url.protocol !== 'https:' || !POSTING_HREF_RE.test(url.pathname)) continue;
      if (!tenant || splitTenantHost(url.hostname)?.tenant !== tenant) continue;
      const titleMatch = /factorial__headingFontFamily[^>]*>([\s\S]*?)<\//.exec(card);
      const title = titleMatch ? text(titleMatch[1]) : '';
      if (!title) continue;

      const remote = attr(tag, 'data-is-remote') === 'true';
      const office = heading || attr(tag, 'data-location-key').replace(/^city:/, '');

      const key = url.href;
      let entry = byUrl.get(key);
      if (!entry) {
        const job = { title, url: key, company, location: '', remote: false };
        const id = /-(\d+)\/?$/.exec(url.pathname);
        if (id) job.externalId = id[1];
        entry = { job, offices: [], remote: false };
        byUrl.set(key, entry);
      }
      // The same posting listed under a second office: one row, both places.
      if (office && !entry.offices.includes(office)) entry.offices.push(office);
      entry.remote ||= remote;
    }
  }

  const jobs = [...byUrl.values()].map(({ job, offices, remote }) => {
    const places = [offices.join(' / ')];
    if (remote && !offices.some((o) => /\bremote\b/i.test(o))) places.push('Remote');
    job.location = places.filter(Boolean).join(' · ');
    job.remote = remote;
    return job;
  });
  if (jobs.length === 0 && POSTING_HREF_RE.test(page)) {
    throw new Error(`factorial: ${origin} links to job postings but none could be parsed — the board markup changed`);
  }
  return jobs;
}

/** Scanner job-row shape for one parsed posting. */
function normalize(row) {
  return {
    id: `factorial-${row.url}`,
    title: row.title,
    company: row.company,
    url: row.url,
    salary: '',
    location: row.location || '',
    isRemote: row.remote === true || /remote|удал[её]н/i.test(`${row.title} ${row.location}`),
    workplaceType: '',
    relocates: false,
    date: '', // the board list carries no dates (they live on each posting page)
    snippet: '', // no description is fetched — nothing to feed the content filter
    source: 'factorial',
  };
}

/**
 * Fetch + parse one Factorial tenant board (single request). The endpoint is
 * re-validated against the Factorial domain list before any request, and the
 * request goes to `<origin>/` rebuilt from the validated tenant label — no
 * path or port from the entry ever reaches the fetch.
 *
 * @param {string} endpoint - the board origin (asserted here)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchFactorial(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company } = opts;
  // Host allowlist before any request (SSRF guard): the adapter resolved this
  // endpoint from the entry; re-validate it here.
  const origin = resolveFactorialOrigin(endpoint);
  if (!origin) {
    throw new Error(`factorial: ${company?.name || endpoint} is not a Factorial tenant board (<tenant>.factorialhr.com, <tenant>.factorial.com or another Factorial domain)`);
  }
  assertFactorialUrl(origin);
  // A scan aborted before the first request must fail loud, not report an
  // empty board (deel convention).
  signal?.throwIfAborted();
  const html = await fetchTextWithRetry(fetchImpl, `${origin}/`, { signal, redirect: 'error' });
  return parseFactorialBoard(html, origin, String(company?.name ?? '')).map(normalize);
}
