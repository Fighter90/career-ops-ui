// @ts-check
/**
 * BambooHR source — hits the public per-tenant careers list API.
 *   GET https://<tenant>.bamboohr.com/careers/list
 *
 * Implements the web-ui
 * source contract. Per-tenant subdomains are the variable part, so the SSRF
 * defence is an anchored host regex (same approach as breezy/personio) plus
 * never following a redirect (`manual` on the list, `error` on the probe) — a
 * server-side redirect can't bounce the fetch off-domain.
 *
 * The list endpoint returns lightweight metadata (title, url, location) at zero
 * token cost; the full JD lives behind a second per-job request the scanner
 * deliberately skips, so `date`/`snippet` are omitted.
 *
 * Redirect classification (parent #4365). `/careers/list` is fetched with
 * `redirect:'manual'` — never auto-followed, so the SSRF guarantee is the same
 * as `redirect:'error'` — so a 3xx is readable via `err.status/err.location`
 * instead of a bare TypeError. Observed live upstream (2,720 tenants without a
 * public list): a bounce to bamboohr.com's marketing site (~92%) means the slug
 * is not a tenant → synthetic 404 straight away. Any other redirect (suspended
 * account, login wall) probes the public embed-widget feed
 * `/jobs/embed2.php`: an empty `departments` array is a live board with
 * nothing open → `[]`; a populated one is the account-restriction signature
 * (job pages answer with an employee login) and an unreachable probe proves
 * nothing live — both map to a synthetic 404, which the scanner's
 * scan-quarantine (404/410 only) then skips on later runs.
 *
 * Used by the bamboohr adapter (server/lib/portals/adapters/bamboohr.mjs).
 */
import { fetchJson, fetchText } from '../http-json.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';
import { requireContainer, requireArray } from './_shape.mjs';

export const BAMBOOHR_HOST_RE = /^[a-z0-9][a-z0-9-]*\.bamboohr\.com$/;
const REMOTE_RE = /remote|anywhere|home\s*office/i;

export const meta = {
  value: 'bamboohr',
  label: 'BambooHR',
  region: 'en',
};

/**
 * Defence-in-depth host check on the endpoint built by the adapter. The endpoint
 * is constructed from an already-validated host, so this only ever rejects a
 * caller that hand-built a bad URL.
 * @param {string} url
 */
export function assertBambooHRUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`bamboohr: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`bamboohr: URL must use HTTPS: ${url}`);
  if (!BAMBOOHR_HOST_RE.test(parsed.hostname)) {
    throw new Error(`bamboohr: untrusted hostname "${parsed.hostname}" — must match <tenant>.bamboohr.com`);
  }
  return url;
}

/**
 * Parse a BambooHR `/careers/list` response. Exported for unit tests.
 *
 * BambooHR returns `{ result: [{ id, jobOpeningName,
 *   location: { city?, state? }, isRemote? }] }`. A 200 that no longer speaks
 * that envelope is a shape change and THROWS (phase-2: never a silent
 * healthy-but-empty board; a live-but-empty board is `{result: []}`). Rows
 * without a non-empty `id` are dropped (id is the URL/dedup key; a blank id
 * collapses distinct postings).
 *
 * @param {any} json
 * @param {string} companyName
 * @param {string} origin  e.g. "https://acme.bamboohr.com"
 */
export function parseBambooHRResponse(json, companyName, origin) {
  requireContainer(json, 'BambooHR careers list', 'result');
  const rows = requireArray(json.result, 'BambooHR careers list rows');
  return rows
    .filter((j) => j && j.jobOpeningName && String(j.id ?? '').trim().length > 0)
    .map((j) => {
      const loc = j.location || {};
      const remote = j.isRemote ? 'Remote' : '';
      const location = [loc.city, loc.state, remote].filter(Boolean).join(', ');
      const id = String(j.id).trim();
      const isRemote = !!j.isRemote || REMOTE_RE.test(location);
      // A lone surrogate in id throws URIError out of encodeURIComponent and
      // aborts this .map(), losing every job on the page. Drop this one on a
      // null; the trailing .filter(Boolean) removes it.
      const encodedId = safeEncodeURIComponent(id);
      if (encodedId === null) return null;
      return {
        id: `bamboohr-${id}`,
        title: String(j.jobOpeningName),
        company: companyName,
        url: `${origin}/careers/${encodedId}`,
        salary: '',
        location,
        isRemote,
        workplaceType: isRemote ? 'Remote' : 'Onsite',
        relocates: false,
        date: '',
        snippet: '',
        source: 'bamboohr',
      };
    })
    .filter(Boolean);
}

/**
 * Fetch + normalize a BambooHR tenant's open positions.
 * @param {string} apiUrl `https://<tenant>.bamboohr.com/careers/list` (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchBambooHR(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertBambooHRUrl(apiUrl);
  const origin = new URL(apiUrl).origin;
  let text;
  try {
    // fetchText (not fetchJson) because only it carries `err.location` for a
    // manual 3xx. The host is still pinned: nothing here ever follows it.
    text = await fetchText(fetchImpl, apiUrl, {
      signal,
      redirect: 'manual',
      headers: { accept: 'application/json' },
    });
  } catch (err) {
    if (typeof err?.status === 'number' && err.status >= 300 && err.status < 400) {
      if (/^https?:\/\/(www\.)?bamboohr\.com\/?$/i.test(String(err.location || ''))) {
        const deadErr = new Error(`bamboohr: /careers/list redirected (${err.status} -> ${err.location}) — no such tenant`);
        deadErr.status = 404;
        throw deadErr;
      }
      if (await isLiveWithNoOpenings(origin, fetchImpl, signal)) return [];
      const deadErr = new Error(`bamboohr: /careers/list redirected (${err.status} -> ${err.location}) — no usable public postings`);
      deadErr.status = 404;
      throw deadErr;
    }
    throw err;
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`non-JSON 2xx response from ${apiUrl}: ${e.message}`);
  }
  return parseBambooHRResponse(json, company.name || '', origin);
}

/**
 * Aliveness probe for a redirected tenant: BambooHR's own embed-widget JSON
 * feed. Only decides live-vs-dead — never a job source (a populated feed is
 * the suspended-account signature whose job pages are a login wall).
 * @returns {Promise<boolean>} true only for a confirmed-live, currently-empty board
 */
async function isLiveWithNoOpenings(origin, fetchImpl, signal) {
  const url = `${origin}/jobs/embed2.php?version=1.0.0&format=json`;
  try {
    assertBambooHRUrl(url);
    const json = await fetchJson(fetchImpl, url, { signal, redirect: 'error', headers: { accept: 'application/json' } });
    return json?.success === true && Array.isArray(json.departments) && json.departments.length === 0;
  } catch {
    return false; // no parseable answer — not confirmed alive
  }
}
