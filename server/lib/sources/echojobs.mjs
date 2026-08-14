// @ts-check
/**
 * EchoJobs source — board-wide public JSON feed of tech jobs aggregated from
 * company ATS boards (https://echojobs.io/api/jobs). Public, zero-auth,
 * paginated (`?per_page=M&page=N`). The broad feed is fetched so the scanner's
 * title_filter gates on the configured titles; pages are pulled until one comes
 * back short or the page cap is reached (default 3, override with `max_pages`).
 *
 * Each row's `url` is the ORIGINAL ATS posting (e.g. jobs.ashbyhq.com/…), so —
 * unlike the feed host — job URLs are not pinned to echojobs.io; only the feed
 * fetch is host-locked (ECHOJOBS_HOST_RE) + `redirect:'error'`. The per-job url
 * is display-only and never server-fetched here.
 *
 * Implements the web-ui source
 * contract (rich job objects + `meta`). Board-wide, so it is provider-selected
 * (`provider: echojobs`) — there is no per-tenant host.
 *
 * Used by the echojobs adapter (server/lib/portals/adapters/echojobs.mjs).
 */
import { fetchJson } from '../http-json.mjs';

export const FEED_BASE = 'https://echojobs.io/api/jobs';
export const ECHOJOBS_HOST_RE = /^echojobs\.io$/i;

const PER_PAGE = 100;
const DEFAULT_MAX_PAGES = 3;
const MAX_PAGES_CAP = 50;

export const meta = {
  value: 'echojobs',
  label: 'EchoJobs',
  region: 'en',
};

/**
 * Defence-in-depth host check on the feed URL actually fetched (not just a
 * constant), so the host pin is meaningful.
 * @param {string} url
 */
export function assertEchojobsUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`echojobs: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`echojobs: URL must use HTTPS: ${url}`);
  if (!ECHOJOBS_HOST_RE.test(parsed.hostname)) {
    throw new Error(`echojobs: untrusted hostname "${parsed.hostname}" — must be echojobs.io`);
  }
  return url;
}

/** Resolve the page cap: a positive integer `max_pages`, capped. */
function resolveMaxPages(company) {
  const v = company && company.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

// posted_at is epoch milliseconds → ISO date ('' when absent/invalid).
function toIsoDate(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

// Guards against a doubled marker when the board already spells the work model
// into the location itself ("Berlin (Hybrid)", "Hybrid - London").
const HYBRID_MARKER = /\bhybrid\b/i;

/**
 * Normalize a single EchoJobs feed item into the rich web-ui job shape.
 * Exported for unit tests.
 *
 *   - title:    `title`, trimmed (items without one are dropped).
 *   - url:      `url` — an absolute `https:` posting URL on the company's own
 *               ATS host (NOT echojobs.io); non-https/malformed drop the item.
 *   - company:  `company_name`, falling back to the entry name, then "EchoJobs".
 *   - location: joined `locations`, with " · Hybrid" appended when `remote_type`
 *               is hybrid ("Berlin · Hybrid"), and falling back to a bare
 *               "Hybrid" / "Remote" when the posting lists no place at all.
 *               Hybrid is NEVER collapsed into "Remote": the emitted string is
 *               what the client location filter matches on, so collapsing it
 *               would make a `block: ["Hybrid"]` rule unmatchable and let hybrid
 *               roles pass a remote-only filter (#2258). A placeless on_site
 *               posting keeps "" — only remote/hybrid are placeless-tolerant.
 *   - workplaceType: "Hybrid" for a hybrid role, "Remote" for an otherwise
 *               remote one, "" otherwise (isRemote stays true for both).
 *   - date:     ISO date derived from `posted_at` (epoch ms).
 *
 * @param {any} j @param {string} [fallbackCompany]
 */
export function normalizeEchojobsJob(j, fallbackCompany) {
  if (!j || typeof j !== 'object') return null;

  const title = typeof j.title === 'string' ? j.title.trim() : '';
  if (!title) return null;

  // url must be an absolute https link; it lives on the company's ATS host, so
  // it is NOT restricted to echojobs.io.
  let url = '';
  const rawUrl = typeof j.url === 'string' ? j.url.trim() : '';
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'https:') url = parsed.href;
    } catch {
      // malformed URL → leave url = '' → dropped below
    }
  }
  if (!url) return null;

  const company =
    typeof j.company_name === 'string' && j.company_name.trim()
      ? j.company_name.trim()
      : fallbackCompany || 'EchoJobs';

  let location = '';
  if (Array.isArray(j.locations)) {
    location = j.locations
      .filter((l) => typeof l === 'string' && l.trim())
      .map((l) => l.trim())
      .join(', ');
  }
  // The feed is a third-party aggregate, so `remote_type` is compared
  // case/whitespace-insensitively: a "Hybrid" variant must not fall through
  // silently and become an unmarked, unfilterable role (#2258).
  const remoteType = typeof j.remote_type === 'string' ? j.remote_type.trim().toLowerCase() : '';
  const isHybrid = remoteType === 'hybrid';
  if (isHybrid) {
    // A hybrid role keeps its city AND gains the marker ("Berlin · Hybrid"), or
    // is a bare "Hybrid" when placeless. Marking only the placeless ones would
    // leave `block: ["Hybrid"]` half-working — catching the placeless roles but
    // silently passing every hybrid that happens to list a city (#2258).
    if (!HYBRID_MARKER.test(location)) location = [location, 'Hybrid'].filter(Boolean).join(' · ');
  } else if (!location && remoteType === 'remote') {
    // Only remote/hybrid are placeless-tolerant; a placeless on_site posting
    // keeps "", which passes the filter under "don't penalize missing data".
    location = 'Remote';
  }
  const isRemote = remoteType === 'remote' || isHybrid || /remote/i.test(location);
  const workplaceType = isHybrid ? 'Hybrid' : isRemote ? 'Remote' : '';

  return {
    id: `echojobs-${url}`,
    title,
    company,
    url,
    salary: '',
    location,
    isRemote,
    workplaceType,
    relocates: false,
    date: toIsoDate(j.posted_at),
    snippet: '',
    source: 'echojobs',
  };
}

/**
 * Fetch + normalize the board-wide EchoJobs feed (paginated via `page`).
 * The feed URL is fixed (host-pinned) regardless of `endpoint`.
 * @param {string} [endpoint] the feed URL (from buildEndpoint; == FEED_BASE)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchEchojobs(endpoint = FEED_BASE, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const maxPages = resolveMaxPages(company);
  const fallbackCompany = company && company.name;
  const out = [];
  const seen = new Set();

  for (let page = 1; page <= maxPages; page++) {
    // Validate the URL actually fetched so the host pin is meaningful, then
    // redirect:'error' blocks SSRF via server-side redirects.
    const url = assertEchojobsUrl(`${FEED_BASE}?per_page=${PER_PAGE}&page=${page}`);
    const json = await fetchJson(fetchImpl, url, { signal, redirect: 'error', headers: { accept: 'application/json' } });
    if (!json || !Array.isArray(json.jobs)) {
      throw new Error(
        `echojobs: unexpected API response on page ${page} — expected { jobs: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`,
      );
    }
    for (const j of json.jobs) {
      const normalized = normalizeEchojobsJob(j, fallbackCompany);
      if (normalized && !seen.has(normalized.id)) {
        seen.add(normalized.id);
        out.push(normalized);
      }
    }
    if (json.jobs.length < PER_PAGE) break; // short page → last page reached
  }
  return out;
}
