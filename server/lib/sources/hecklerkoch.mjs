// @ts-check
/**
 * Heckler & Koch source — SSR vacancy list at
 *   https://www.heckler-koch.com/de/Karriere/Stellenangebote
 *
 * Ported from parent career-ops `providers/hecklerkoch.mjs` into the web-ui
 * source contract (rich job objects + `meta` for auto-discovery). Single
 * company, zero-token: the Nuxt listing page is SERVER-rendered, so one bare
 * HTTP GET returns every posting (small board, ~32 roles). The apply backend
 * lives on karriere.heckler-koch.com/jobposting/{hash}; the listing links
 * straight to it, so that hash is our stable id + job URL.
 *
 * Card markup:
 *   <a href="https://karriere.heckler-koch.com/jobposting/{hash}" …>
 *     <div class="text-secondary font-medium">
 *       <p> {Field} | {Type} </p>
 *       <h3 class="text-lg md:text-2xl">{Title}</h3>
 *     </div> …
 *   </a>
 *
 * The list carries no explicit location or date; H&K is effectively
 * single-site (Oberndorf a. N.), and titles often name the site, so location
 * stays empty rather than guessed. Host-pinned to heckler-koch.com; the fetch
 * uses `redirect:'error'` (SSRF-safe, via the fetchText default).
 *
 * Used by the hecklerkoch adapter (server/lib/portals/adapters/hecklerkoch.mjs).
 */
import { fetchText } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

export const DEFAULT_LIST_URL = 'https://www.heckler-koch.com/de/Karriere/Stellenangebote';
// Host match — heckler-koch.com or any subdomain. Anchored so a path or
// suffix spoof (evil.com/x.heckler-koch.com, heckler-koch.com.evil.com) fails.
export const HECKLERKOCH_HOST_RE = /^(?:[a-z0-9-]+\.)*heckler-koch\.com$/i;
const MAX_JOBS = 500; // generous cap; the board is tiny

export const meta = {
  value: 'hecklerkoch',
  label: 'Heckler & Koch',
  region: 'en',
};

// Minimal HTML entity decoder — inlined from the parent's shared
// `providers/_html-entities.mjs` (web-ui convention: no cross-repo helper).
// Range-guarded: a code point above 0x10FFFF or a lone surrogate half
// (&#xD800;) degrades to the literal text instead of throwing RangeError and
/** @param {string} s */

/** @param {string} s */
function clean(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertHecklerkochUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`hecklerkoch: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`hecklerkoch: URL must use HTTPS: ${url}`);
  if (!HECKLERKOCH_HOST_RE.test(parsed.hostname)) {
    throw new Error(`hecklerkoch: untrusted hostname "${parsed.hostname}" — must be heckler-koch.com`);
  }
  return url;
}

/**
 * Resolve the vacancy-list URL from a company's api:/careers_url; any other
 * path on the trusted host defaults to the DE Stellenangebote list (same
 * behaviour as the parent's resolveListUrl, https-only per web-ui policy).
 * Returns null for foreign/spoofed hosts. Exported for the adapter + tests.
 * @param {{ api?: string, careers_url?: string }} company
 */
export function resolveListUrl(company) {
  const raw = (company && (company.api || company.careers_url)) || '';
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (!HECKLERKOCH_HOST_RE.test(u.hostname)) return null;
  // A Stellenangebote path passes through; anything else on the host defaults.
  if (/Stellenangebote/i.test(u.pathname)) return `${u.origin}${u.pathname}`;
  return `${u.origin}/de/Karriere/Stellenangebote`;
}

/**
 * Parse the SSR listing into raw {id, title, url} records. Anchors on the
 * karriere.heckler-koch.com/jobposting/{hash} link (the stable id + URL), then
 * reads the sibling <h3> title inside the same anchor. Exported for tests.
 * @param {string} html
 */
export function parseListing(html) {
  if (typeof html !== 'string') return [];
  const out = [];
  const seen = new Set();
  const re = /<a\b[^>]*href="(https:\/\/karriere\.heckler-koch\.com\/jobposting\/([a-z0-9]+))"[\s\S]*?<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = decodeEntities(m[1]);
    const id = m[2];
    if (seen.has(id)) continue;
    const block = m[0];
    const titleM = block.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
    const title = titleM ? clean(titleM[1]) : '';
    if (!title) continue;
    seen.add(id);
    out.push({ id, title, url });
  }
  return out;
}

/**
 * Fetch + normalize the Heckler & Koch SSR vacancy list (single request).
 * @param {string} endpoint list URL (host-pinned to heckler-koch.com)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchHecklerkoch(endpoint = DEFAULT_LIST_URL, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertHecklerkochUrl(endpoint);
  const fallbackCompany = (company && typeof company.name === 'string' && company.name.trim())
    ? company.name.trim() : 'Heckler & Koch';

  const html = await fetchText(fetchImpl, endpoint, {
    signal,
    redirect: 'error',
    headers: { accept: 'text/html' },
  });
  const jobs = [];
  for (const row of parseListing(html)) {
    jobs.push({
      id: `hecklerkoch-${row.id}`,
      title: row.title,
      company: fallbackCompany,
      url: row.url,
      salary: '',
      location: '', // single-site board; no location on the list by design
      isRemote: false,
      workplaceType: '',
      relocates: false,
      date: '', // the list carries no posting date
      snippet: '',
      source: 'hecklerkoch',
    });
    if (jobs.length >= MAX_JOBS) break;
  }
  return jobs;
}
