/**
 * Lever public postings API.
 *   GET https://api.lever.co/v0/postings/<slug>
 *     (or https://api.eu.lever.co/… for EU tenants)
 *
 * v1.242.0: the fetch used to accept any URL — including one reached only via
 * a 302 — so a misconfigured entry could point the scanner anywhere. The
 * endpoint is now pinned to Lever's two public API hosts over HTTPS, the
 * fetch refuses redirects, and a wrong-shape 200 throws instead of reading as
 * an empty board. `categories.commitment` (a contract like "Full-time") is no
 * longer misreported as the workplace type.
 */
import { requireArray } from './_shape.mjs';

const UA = 'career-ops-web-ui/1.0';

// Exact hosts — no suffix/substring match (clever.com contains 'lever.co').
const LEVER_HOSTS = new Set(['api.lever.co', 'api.eu.lever.co']);

// v1.69.0 (P-14) — self-describing adapter metadata; see ashby.mjs for the rationale.
export const meta = {
  value: 'lever',
  label: 'Lever',
  region: 'en',
};

/**
 * Assert that `url` is a trusted Lever API host over HTTPS.
 * @param {string} url
 * @returns {string} the validated URL
 */
export function assertLeverUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`lever: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`lever: URL must use HTTPS: ${url}`);
  }
  if (!LEVER_HOSTS.has(parsed.hostname)) {
    throw new Error(`lever: untrusted hostname "${parsed.hostname}" — must be api.lever.co or api.eu.lever.co`);
  }
  return url;
}

export async function fetchLever(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal } = opts; // REVIEW-B3
  assertLeverUrl(apiUrl);
  const res = await fetchImpl(apiUrl, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`Lever: HTTP ${res.status} (${apiUrl})`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  // lever returns either an array directly OR { ... data: [] } — anything else
  // is a wrong-shape 200 and throws rather than reading as an empty board.
  const list = Array.isArray(data) ? data : requireArray(data?.data, 'Lever postings');
  return list.map(normalize);
}

function normalize(j) {
  const cats = j.categories || {};
  // Lever puts a SINGLE primary city in `location` and exposes the full set on
  // multi-location postings in `allLocations`; reading only the primary silently
  // hides every other eligible location from location_filter (a req open in
  // Barcelona AND Montevideo would look Barcelona-only). Merge, deduped.
  const primary = typeof cats.location === 'string' ? cats.location.trim() : '';
  const allLocs = Array.isArray(cats.allLocations)
    ? cats.allLocations.filter((l) => typeof l === 'string' && l.trim()).map((l) => l.trim())
    : [];
  const merged = [];
  for (const l of [primary, ...allLocs]) {
    if (l && !merged.some((m) => m.toLowerCase() === l.toLowerCase())) merged.push(l);
  }
  const location = merged.join(' · ');
  const isRemote = /remote|anywhere/i.test(location);
  const isHybrid = /hybrid/i.test(primary);
  return {
    id: `lever-${j.id}`,
    title: j.text || '',
    company: '',
    url: j.hostedUrl || j.applyUrl || '',
    salary: j.salaryRange?.min ? `${j.salaryRange.min}-${j.salaryRange.max} ${j.salaryRange.currency}` : '',
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : (isHybrid ? 'Hybrid' : 'Onsite'),
    relocates: false,
    date: j.createdAt ? new Date(j.createdAt).toISOString() : '',
    snippet: cats.team || cats.department || '',
    source: 'lever',
  };
}
