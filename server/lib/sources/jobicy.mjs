/**
 * Jobicy source — board-wide remote-jobs aggregator JSON API.
 *   GET https://jobicy.com/api/v2/remote-jobs?count=50 → { jobs: [...] }
 *
 * Implements the
 * web-ui source contract. The full feed is fetched so the
 * en-scanner's title_filter can gate on configured titles.
 *
 * Used by the jobicy adapter (server/lib/portals/adapters/jobicy.mjs).
 */
const UA = 'career-ops-web-ui/1.0';

export const FEED_URL = 'https://jobicy.com/api/v2/remote-jobs?count=50';

export const meta = {
  value: 'jobicy',
  label: 'Jobicy',
  region: 'en',
};

/**
 * Validate that the URL targets jobicy.com over HTTPS (SSRF guard).
 * @param {string} u
 * @returns {string} the same URL if valid
 */
export function assertJobicyUrl(u) {
  let parsed;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error(`Jobicy: invalid URL: ${u}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`Jobicy: URL must use HTTPS: ${u}`);
  }
  if (parsed.hostname !== 'jobicy.com' && parsed.hostname !== 'www.jobicy.com') {
    throw new Error(`Jobicy: untrusted hostname "${parsed.hostname}" — only jobicy.com is allowed`);
  }
  return u;
}

/**
 * Fetch + normalize the Jobicy public JSON feed.
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 */
export async function fetchJobicy(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  assertJobicyUrl(feedUrl);
  const res = await fetchImpl(feedUrl, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`Jobicy: HTTP ${res.status} (${feedUrl})`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  if (!json || !Array.isArray(json.jobs)) {
    throw new Error(
      `Jobicy: unexpected API response — expected { jobs: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`,
    );
  }
  return json.jobs
    .filter((j) => {
      if (!j || typeof j !== 'object') return false;
      if (typeof j.jobTitle !== 'string' || j.jobTitle.trim() === '') return false;
      // validate URL: must be https jobicy.com
      const rawUrl = typeof j.url === 'string' ? j.url.trim() : '';
      try {
        const p = new URL(rawUrl);
        return p.protocol === 'https:' && (p.hostname === 'jobicy.com' || p.hostname === 'www.jobicy.com');
      } catch {
        return false;
      }
    })
    .map((j) => normalize(j));
}

function normalize(j) {
  const url = j.url.trim();

  // Build salary string from annualSalaryMin/Max if present
  let salary = '';
  const min = j.annualSalaryMin;
  const max = j.annualSalaryMax;
  if (min != null && max != null && min !== 0 && max !== 0) {
    salary = `$${Number(min).toLocaleString('en-US')}–$${Number(max).toLocaleString('en-US')}`;
  } else if (min != null && min !== 0) {
    salary = `$${Number(min).toLocaleString('en-US')}+`;
  } else if (max != null && max !== 0) {
    salary = `up to $${Number(max).toLocaleString('en-US')}`;
  }

  // Parse pubDate → 'YYYY-MM-DD' or ''
  let date = '';
  if (typeof j.pubDate === 'string' && j.pubDate.trim()) {
    const parsed = Date.parse(j.pubDate.trim());
    if (!Number.isNaN(parsed)) {
      date = new Date(parsed).toISOString().slice(0, 10);
    }
  }

  return {
    id: `jobicy-${j.id != null ? String(j.id) : url}`,
    title: j.jobTitle.trim(),
    company: typeof j.companyName === 'string' && j.companyName.trim() ? j.companyName.trim() : 'Jobicy',
    url,
    salary,
    location: typeof j.jobGeo === 'string' ? j.jobGeo.trim() : '',
    isRemote: true,
    workplaceType: 'Remote',
    relocates: false,
    date,
    snippet: '',
    source: 'jobicy',
  };
}
