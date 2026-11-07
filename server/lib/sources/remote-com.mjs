// @ts-check
/**
 * Remote (remote.com, the employer-of-record company) — its own in-house ATS
 * at apply.remote.com. Single-company `tracked_companies:` adapter (like
 * ibm.mjs): every posting the endpoint returns is a Remote job, so there is
 * no tenant to resolve and no per-entry config.
 *
 *   - name: Remote
 *     careers_url: https://apply.remote.com/jobs
 *
 * Not to be confused with remoteok.mjs / remotive.mjs / remotli.mjs, which
 * are remote-work job boards, not this employer.
 *
 * Ported from the parent's providers/remote-com.mjs (upstream #6392).
 *
 * Endpoint (UNDOCUMENTED — the `jobs` call in the apply.remote.com SPA's own
 * API client; no auth, no pagination, the whole board in one response,
 * 52 postings / ~230 KB measured 2026-11-01):
 *
 *   GET https://apply.remote.com/api/public/jobs
 *   → { jobs: [{ public_id, title, location, workplace, opened_at, department,
 *                employment_type, accepting_applications, status, pay, … }] }
 *
 * The posting page a candidate opens is https://apply.remote.com/jobs/{public_id}.
 * The list's `description` is only the posting's opening paragraph, and often
 * just "." (22 of 52 on 2026-11-01); the body sits in `advert_sections` of
 * the per-posting endpoint (/api/public/jobs/{public_id}). That endpoint is
 * not called (one request per posting), and the opening paragraph is left
 * off rather than fed to content_filter as if it were the posting text — so
 * htmlToText/DESCRIPTION_CAP are not applicable here.
 *
 * Location — the reason this source exists. Remote states a posting's
 * eligibility as region codes: "EMEA", "NORAM", "LATAM", "APAC", or a
 * comma-separated combination ("EMEA, NORAM"). Aggregators that re-list
 * Remote's jobs have been seen dropping the code entirely, leaving an empty
 * location that every location_filter lets through. Here each known code is
 * kept AND spelled out, so a filter written in either vocabulary matches:
 *
 *   "EMEA, NORAM" → "Remote · EMEA (Europe, Middle East & Africa) / NORAM (North America)"
 *   "LATAM"       → "Remote · LATAM (Latin America)"
 *
 * Unknown codes pass through verbatim. "Remote" comes from the `workplace`
 * field, not from the company name.
 */
import { fetchJsonWithRetry } from '../http-json.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';
import { requireArray } from './_shape.mjs';

export const meta = {
  value: 'remote-com',
  label: 'Remote',
  region: 'en',
};

export const HOST = 'apply.remote.com';
export const API_URL = `https://${HOST}/api/public/jobs`;
export const POSTING_BASE = `https://${HOST}/jobs/`;
export const COMPANY = 'Remote';

/** Region code → its standard expansion. Keys are upper-case. */
export const REGION_NAMES = Object.freeze({
  EMEA: 'Europe, Middle East & Africa',
  NORAM: 'North America',
  LATAM: 'Latin America',
  APAC: 'Asia-Pacific',
});

/** `workplace` value → display label. Unknown values are left out. */
export const WORKPLACE_LABELS = Object.freeze({
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
  on_site: 'On-site',
  'on-site': 'On-site',
  office: 'On-site',
});

/** @param {unknown} value */
function toEpochMs(value) {
  if (typeof value !== 'string' || !value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Renders Remote's region codes and workplace into one readable location.
 * Exported for tests.
 * @param {unknown} location - e.g. "EMEA, NORAM"
 * @param {unknown} workplace - e.g. "remote"
 * @returns {string}
 */
export function formatRemoteLocation(location, workplace) {
  const seen = new Set();
  const regions = [];
  if (typeof location === 'string') {
    for (const raw of location.split(',')) {
      const code = raw.trim();
      if (!code) continue;
      const key = code.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const name = Object.prototype.hasOwnProperty.call(REGION_NAMES, key)
        ? REGION_NAMES[/** @type {keyof typeof REGION_NAMES} */ (key)]
        : '';
      regions.push(name ? `${key} (${name})` : code);
    }
  }
  const wpKey = typeof workplace === 'string' ? workplace.trim().toLowerCase() : '';
  const wp = Object.prototype.hasOwnProperty.call(WORKPLACE_LABELS, wpKey)
    ? WORKPLACE_LABELS[/** @type {keyof typeof WORKPLACE_LABELS} */ (wpKey)]
    : '';
  return [wp, regions.join(' / ')].filter(Boolean).join(' · ');
}

/**
 * Whether a URL is on apply.remote.com — any path, since the board root and
 * a single posting link both lead here. Exported for tests.
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isRemoteAtsUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return false;
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return false;
  }
  return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === HOST;
}

/**
 * Normalizes the /api/public/jobs response. Exported for unit tests.
 *
 * Throws when the `jobs[]` envelope is missing or wrong-typed (a named
 * error through the shape guard), so an endpoint change surfaces as an
 * error instead of an empty board; a malformed row is dropped.
 *
 * @param {any} json
 * @returns {Array<{title: string, url: string, company: string, location: string,
 *   externalId: string, postedAt?: number}>}
 */
export function parseRemoteJobs(json) {
  const rows = requireArray(json?.jobs, 'remote-com jobs');
  const out = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    // Either flag closes a posting. Every live row read on 2026-11-01 was
    // status "open" with accepting_applications true, so only "closed" is
    // matched: an unseen status value is not taken to mean closed.
    if (row.accepting_applications === false || row.status === 'closed') continue;
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    if (!title) continue;
    const id = typeof row.public_id === 'string' ? row.public_id.trim() : '';
    if (!id) continue;
    const seg = safeEncodeURIComponent(id);
    if (seg === null) continue;

    const postedAt = toEpochMs(row.opened_at);
    out.push({
      title,
      url: `${POSTING_BASE}${seg}`,
      company: COMPANY,
      location: formatRemoteLocation(row.location, row.workplace),
      externalId: id,
      ...(postedAt !== undefined ? { postedAt } : {}),
    });
  }
  return out;
}

/** Scanner job-row shape for one parsed posting. */
function normalize(row) {
  return {
    id: `remote-com-${row.url}`,
    title: row.title,
    company: row.company,
    url: row.url,
    salary: '',
    location: row.location || '',
    isRemote: /^remote\b/i.test(row.location) || /remote|удал[её]н/i.test(`${row.title} ${row.location}`),
    workplaceType: '',
    relocates: false,
    date: typeof row.postedAt === 'number' ? new Date(row.postedAt).toISOString() : '',
    snippet: '', // the opening paragraph is left off — see the header note
    source: 'remote-com',
  };
}

/**
 * Fetch + normalize the Remote board (single request, fixed literal URL).
 * No per-entry host allowlist is needed — the URL is a constant — and
 * redirects are still refused.
 *
 * @param {string} endpoint - from buildEndpoint (the same constant)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchRemoteCom(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  // A scan aborted before the first request must fail loud, not report an
  // empty board (deel convention).
  signal?.throwIfAborted();
  const json = await fetchJsonWithRetry(fetchImpl, API_URL, {
    signal,
    redirect: 'error',
    headers: { accept: 'application/json' },
  });
  return parseRemoteJobs(json).map(normalize);
}
