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

import { fetchJson, labeledHttpError } from '../http-json.mjs';

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

// Annualization multipliers for Lever's salaryRange.interval values
// (lever/postings-api: salaryRange is { currency, interval, min, max }).
// Observed live on real boards: 'per-year-salary', 'per-hour-wage'. The
// rest follow Lever's per-{period}-{salary|wage} naming; an interval not
// in this table leaves salary off rather than guessing (same rule as the
// parent's ashby.mjs INTERVAL_MULTIPLIERS lookup). Same annualization
// basis as Ashby: 40 h/week, 52 weeks/year, 5 days/week.
const LEVER_INTERVAL_MULTIPLIERS = {
  'per-hour-wage': 2080,
  'per-day-wage': 260,
  'per-week-wage': 52,
  'per-month-salary': 12,
  'per-year-salary': 1,
};

/**
 * Map a Lever posting's salaryRange to the Job.salary bounds
 * ({ min, max, currency }, annualized), or undefined when the posting
 * carries no usable range. Mirrors the parent's leverSalary() (#6907):
 * only a real finite non-negative number counts, a one-sided range fills
 * the missing bound from the other, bounds are ordered min<=max, an
 * unrecognised interval leaves salary OFF (never guess), and the currency
 * is trimmed + uppercased.
 *
 * Exported for tests.
 *
 * @param {any} j - one posting from the v0 postings list
 * @returns {{min: number, max: number, currency: string} | undefined}
 */
export function leverSalary(j) {
  const range = j?.salaryRange;
  if (!range || typeof range !== 'object') return undefined;
  // An interval naming an inherited Object property (e.g. 'constructor')
  // resolves to a truthy non-number, which would annualize to NaN. Require a
  // string interval that is an OWN property of the table (hasOwn is the
  // prototype-name guard); every table value is a non-zero constant, so the
  // multiplier needs no further truthiness check.
  if (typeof range.interval !== 'string' || !Object.hasOwn(LEVER_INTERVAL_MULTIPLIERS, range.interval)) return undefined;
  const multiplier = LEVER_INTERVAL_MULTIPLIERS[range.interval];
  /** @param {unknown} v */
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
  const minValue = num(range.min);
  const maxValue = num(range.max);
  if (minValue === undefined && maxValue === undefined) return undefined;
  const annualizedMin = minValue !== undefined ? minValue * multiplier : undefined;
  const annualizedMax = maxValue !== undefined ? maxValue * multiplier : undefined;
  const resolvedMin = /** @type {number} */ (annualizedMin ?? annualizedMax);
  const resolvedMax = /** @type {number} */ (annualizedMax ?? annualizedMin);
  const currency = typeof range.currency === 'string' ? range.currency.trim().toUpperCase() : '';
  return {
    min: Math.min(resolvedMin, resolvedMax),
    max: Math.max(resolvedMin, resolvedMax),
    currency,
  };
}

/**
 * Render the annualized bounds into the web-ui shape's STRING `salary` field
 * ('' when there is no comp data). The web-ui job shape carries salary as a
 * display string (the en-scanner's `comp`, the pipeline column,
 * scan-results' salaryHead), not a structured object — same convention as
 * the manfred/applicantpro sources. leverSalary() always fills both bounds
 * before returning, so only the both-bounds line is reachable.
 * @param {{min: number, max: number, currency: string} | undefined} salary
 */
function salaryText(salary) {
  if (!salary) return '';
  const cur = salary.currency ? ` ${salary.currency}` : '';
  return `${salary.min}–${salary.max}${cur}`;
}


export async function fetchLever(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal } = opts; // REVIEW-B3
  assertLeverUrl(apiUrl);
  const data = await fetchJson(fetchImpl, apiUrl, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  }).catch((e) => { throw labeledHttpError(e, 'Lever'); });
  // lever returns either an array directly OR { ... data: [] } — anything else
  // is a wrong-shape 200 and throws rather than reading as an empty board.
  const list = Array.isArray(data) ? data : requireArray(data?.data, 'Lever postings');
  return list.map(normalize);
}

// Same word edges as the parent's location compiler, so "Remotely in Europe"
// does not count as already saying Remote (upstream #6138).
const REMOTE_WORD_RE = /(?<![\p{L}\p{M}\p{N}])remote(?![\p{L}\p{M}\p{N}])/iu;

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
  // workplaceType is a top-level posting flag (remote | hybrid | onsite), not
  // a location. A remote role whose city is "London" never contains the word
  // Remote, so a filter that allows Remote drops it. Hybrid stays city-only:
  // the office is still the place. Append once, and skip when a segment
  // already says remote ("Remote — Europe") (upstream #6138).
  const remote = typeof j.workplaceType === 'string' && j.workplaceType.trim().toLowerCase() === 'remote';
  if (remote && !merged.some((m) => REMOTE_WORD_RE.test(m))) merged.push('Remote');
  const location = merged.join(' · ');
  const isRemote = /remote|anywhere/i.test(location);
  const isHybrid = /hybrid/i.test(primary);
  return {
    id: `lever-${j.id}`,
    title: j.text || '',
    company: '',
    url: j.hostedUrl || j.applyUrl || '',
    // Lever's salaryRange ({ currency, interval, min, max }) maps to the
    // web-ui string `salary` field annualized (CAR-271, parent #6907); an
    // unknown interval or no usable number leaves salary off rather than
    // guessing. The old `${min}-${max} ${currency}` read the raw figures
    // (an hourly wage 2080× too small), dropped min:0 as falsy and dropped
    // a max-only range entirely.
    salary: salaryText(leverSalary(j)),
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : (isHybrid ? 'Hybrid' : 'Onsite'),
    relocates: false,
    date: j.createdAt ? new Date(j.createdAt).toISOString() : '',
    snippet: cats.team || cats.department || '',
    source: 'lever',
  };
}
