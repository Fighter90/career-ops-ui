/**
 * Workable public jobs API wrapper.
 *
 * PRIMARY endpoint (the public widget API, so large accounts are scanned in
 * full):
 *
 *   GET https://apply.workable.com/api/v1/widget/accounts/<slug>?details=true
 *   → { name, description, jobs: [{ title, shortcode, shortlink, url,
 *        department, city, state, country, telecommuting, published_on,
 *        description, … }] }
 *
 * The widget API returns the account's FULL posting list in ONE request
 * (verified live upstream against a 259-posting account). The old v3 endpoint
 * (`/api/v3/accounts/<slug>/jobs?details=true`, offset/limit paged) silently
 * capped/missed jobs on large accounts, so it is no longer used. Because the
 * widget response is complete, there is no pagination to loop — a single fetch
 * scans the whole board, which is exactly why large accounts are now covered.
 *
 * The adapter (`portals/adapters/workable.mjs`) still hands us the v3 URL, so
 * we derive the account <slug> from whatever workable.com URL we are given and
 * rebuild the widget URL on a hard-coded, host-pinned base. The outbound host
 * is therefore always `apply.workable.com` over HTTPS — no SSRF surface.
 *
 * A total fetch failure THROWS (dead-board contract): the scanner treats a
 * throw as "board unreachable" and an empty array as "board reachable, no
 * matching roles". We never swallow a network/HTTP error into `[]`.
 *
 * HARDENING (retry, headers, and serialization): the widget request carries
 * browser-like
 * headers (the shared BROWSER_LIKE_USER_AGENT + accept-language + origin + a
 * per-account referer), retries transient failures (429 / 5xx / network) via the
 * shared `fetchJsonWithRetry`, and is serialized process-wide against
 * apply.workable.com — Cloudflare fronts every tenant on that single host, so one
 * in-flight request at a time avoids self-inflicted rate-limiting. A permanent
 * 4xx is not retried; once the retry budget is spent the error propagates and the
 * dead-board throw fires. (The web-ui source is single-request — it has no
 * markdown fallback — so a give-up-early-on-long-Retry-After branch,
 * whose only purpose is to fall through to that feed, does not apply here.)
 */
import { fetchJsonWithRetry, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { requireObject, requireArray } from './_shape.mjs';

// Browser-like request headers. apply.workable.com sits behind Cloudflare, which
// can block a generic UA outright; the shared BROWSER_LIKE_USER_AGENT keeps every
// worked-around source pinned to one Chrome version instead of drifting per file.
// `referer` is per-account, added in fetchWorkable.
const WORKABLE_HEADERS = {
  'user-agent': BROWSER_LIKE_USER_AGENT,
  accept: 'application/json',
  'accept-language': 'en-US,en;q=0.9',
  origin: 'https://apply.workable.com',
};

// Process-wide serialization: apply.workable.com fronts every tenant on the same
// host, so this process never needs more than one in-flight request to it at a
// time. Errors are swallowed off the queue tail so one failed fetch can't wedge
// every later one.
let workableQueue = Promise.resolve();
function serialized(fn) {
  const result = workableQueue.then(fn, fn);
  workableQueue = result.then(() => undefined, () => undefined);
  return result;
}

// v1.69.0 (P-14) — self-describing adapter metadata; see ashby.mjs for the rationale.
export const meta = {
  value: 'workable',
  label: 'Workable',
  region: 'en',
};

// The widget API is only served from apply.workable.com. Pin it (+ HTTPS) so a
// crafted `api:`/careers_url can never redirect the fetch off-host.
const ALLOWED_WORKABLE_HOSTS = new Set(['apply.workable.com']);

// Workable account slugs are alphanumerics plus - and _ . Anything else is
// rejected rather than interpolated, so a crafted URL cannot escape the path
// (e.g. `..%2f..%2f`) when we build the widget URL.
const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

const WIDGET_SUFFIX = '.workable.com';

const widgetUrlForSlug = (slug) =>
  `https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`;

/**
 * Assert a URL is HTTPS and on the pinned Workable host. Throws otherwise.
 * @param {string} url
 * @returns {string} the same url when valid
 */
function assertWorkableUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Workable: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`Workable: URL must use HTTPS: ${url}`);
  if (!ALLOWED_WORKABLE_HOSTS.has(parsed.hostname)) {
    throw new Error(`Workable: untrusted hostname "${parsed.hostname}" — must be one of: ${[...ALLOWED_WORKABLE_HOSTS].join(', ')}`);
  }
  return url;
}

/**
 * Extract the account slug from whatever workable.com URL the adapter hands us
 * — the v3 jobs endpoint (`…/accounts/<slug>/jobs`), an explicit widget URL
 * (`…/widget/accounts/<slug>`), a legacy `<slug>.workable.com` host, or a bare
 * `apply.workable.com/<slug>` careers URL. Returns null when it is not a
 * workable.com URL or the slug fails validation.
 *
 * @param {string} apiUrl
 * @returns {string|null}
 */
export function resolveWorkableSlug(apiUrl) {
  if (typeof apiUrl !== 'string' || !apiUrl) return null;
  let parsed;
  try {
    parsed = new URL(apiUrl);
  } catch {
    return null;
  }
  const host = parsed.hostname;
  if (host !== 'workable.com' && !host.endsWith(WIDGET_SUFFIX)) return null;

  const segs = parsed.pathname.split('/').filter(Boolean);
  const ai = segs.indexOf('accounts');
  let slug = ai !== -1 ? segs[ai + 1] : null;

  if (!slug) {
    // Legacy `<slug>.workable.com` → the subdomain IS the account.
    if (host.endsWith(WIDGET_SUFFIX) && host !== 'apply.workable.com') {
      slug = host.slice(0, -WIDGET_SUFFIX.length);
    } else {
      // Bare `apply.workable.com/<slug>` careers URL.
      slug = segs[0] || null;
    }
  }

  if (!slug || !SLUG_RE.test(slug)) return null;
  return slug;
}

/**
 * Validate a job permalink against the Workable host allowlist.
 * @param {unknown} raw
 * @returns {string|null} normalized href, or null when it must be dropped
 */
function safeJobUrl(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return null;
    if (!ALLOWED_WORKABLE_HOSTS.has(parsed.hostname)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

// Joins the locations of a multi-country posting into one cell (parent
// parity: career-ops b07171d1, #4806). This is the multi-location shape
// sources/ashby.mjs already emits for Ashby's secondaryLocations, and the
// shape location_filter (location-filter.mjs, wired into en-scanner.mjs)
// judges as one string — so the two sources read identically to the scanner.
const LOCATION_SEPARATOR = ' · ';

export async function fetchWorkable(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal, retryDelayMs = 500 } = opts;

  const slug = resolveWorkableSlug(apiUrl);
  if (!slug) throw new Error(`Workable: cannot derive account slug from ${apiUrl}`);

  // Build on a hard-coded host and re-assert (defence in depth); `redirect:
  // 'error'` closes the SSRF-via-redirect vector.
  const url = assertWorkableUrl(widgetUrlForSlug(slug));
  const referer = `https://apply.workable.com/${slug}/`;

  // Serialized process-wide (one in-flight request against the shared
  // apply.workable.com host) and retried on transient failures via the shared
  // helper: `fetchJsonWithRetry` retries 429 / 5xx / network errors and rethrows
  // a permanent 4xx immediately, so once the budget is spent the error propagates
  // and the dead-board throw fires (single-request contract). The error keeps its
  // `.status` (set by http-json.mjs on a non-2xx), preserving the scanner's
  // outage-vs-empty branch.
  const data = await serialized(() =>
    fetchJsonWithRetry(fetchImpl, url, {
      signal,
      redirect: 'error',
      headers: { ...WORKABLE_HEADERS, referer },
      retryDelayMs,
    }),
  );
  return parseWorkableWidget(data);
}

/**
 * Parse the widget API payload into the scanner's job shape. Exported for unit
 * tests. The documented envelope is REQUIRED (v1.242.0 Phase 2): a 200 whose
 * body is null or jobs-less is a masked board, not an empty one, so it throws
 * instead of silently returning []. Keeps only titled, on-domain jobs —
 * off-domain or non-HTTPS permalinks are dropped rather than emitted.
 *
 * A multi-country posting is FANNED OUT by this endpoint into one entry per
 * location, every one carrying the same shortlink, title, description and
 * published_on and differing only in city/state/country (parent parity:
 * career-ops b07171d1, #4806; verified live upstream 2026-10-06 against
 * DigitalGenius, where "Implementation Engineer" (801183DB79) comes back as
 * four entries — London/United Kingdom, Romania, Poland, Croatia).
 *
 * The siblings are therefore folded together here: the first entry supplies
 * every field, the rest contribute only their location, and the accumulated
 * set is joined with LOCATION_SEPARATOR. Discarding them (first-wins on URL,
 * which is what this did before) recorded that role as "London, United
 * Kingdom" alone, so an EU allow-list in location_filter rejected a posting
 * that had three viable EU alternatives.
 *
 * Two dead ends, both measured rather than assumed upstream: each entry's own
 * `locations[]` array holds ONLY that entry's single location, so it is not a
 * shortcut to the full set; the per-job detail endpoint
 * (/api/v1/accounts/<slug>/jobs/<shortcode>) does carry a complete array but
 * costs one extra request per posting. This source has no second parse path
 * (single-request contract, no markdown feed), so the fold lives here alone.
 *
 * @param {any} payload — parsed JSON body of the widget endpoint
 * @returns {Array<object>}
 */
export function parseWorkableWidget(payload) {
  const body = requireObject(payload, 'Workable widget');
  const rows = requireArray(body.jobs, 'Workable widget jobs');
  const jobs = [];
  /** @type {Map<string, {job: object, locations: Set<string>}>} */
  const byUrl = new Map();
  for (const raw of rows) {
    const title = typeof raw?.title === 'string' ? raw.title.trim() : '';
    if (!title) continue;

    // shortlink is the canonical public permalink; url is the same host. Both
    // are validated; off-domain / non-https entries are dropped.
    const url = safeJobUrl(raw?.shortlink) || safeJobUrl(raw?.url) || safeJobUrl(raw?.application_url);
    if (!url) continue;

    const loc = rawLocation(raw);
    const merged = byUrl.get(url);
    if (merged) {
      // Fanned-out sibling of a posting already emitted: it contributes its
      // location and nothing else. Empty locations add nothing; a repeated one
      // collapses, so the cell never says "Romania · Romania".
      if (loc) merged.locations.add(loc);
      continue;
    }

    const job = normalize(raw, url);
    jobs.push(job);
    // Seeded from the EMITTED location, not rawLocation: normalize falls back
    // to "Remote" when the entry names no place, and that fallback must not be
    // lost when the final join rewrites the cell below.
    byUrl.set(url, { job, locations: new Set(job.location ? [job.location] : []) });
  }

  // A Set iterates in insertion order, so the joined cell follows payload order
  // and a single-location posting re-joins to the exact string it already had.
  for (const { job, locations } of byUrl.values()) {
    job.location = [...locations].join(LOCATION_SEPARATOR);
  }
  return jobs;
}

/**
 * Any date the widget API hands us → YYYY-MM-DD UTC (v1.242.0 Phase 2
 * freshness contract). A bare YYYY-MM-DD passes through untouched; a naive
 * datetime is treated as UTC for determinism, same convention as tkms.mjs.
 * @param {unknown} value
 * @returns {string}
 */
function toIsoDateUtc(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  let s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) && !/(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString().slice(0, 10);
}

/**
 * The "<city>, <state>, <country>" cell for ONE widget entry — the shape
 * location_filter matches on, matching the markdown feed's rendering so the
 * filter behaves identically across both paths (parent wording, adapted).
 * Used both by normalize() and by the multi-country fold in
 * parseWorkableWidget, so a sibling contributes exactly the string the first
 * entry would have rendered.
 * @param {any} j
 * @returns {string} '' when the entry names no place
 */
function rawLocation(j) {
  return [j.city, j.state, j.country]
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => v.trim())
    .join(', ');
}

function normalize(j, url) {
  const loc = rawLocation(j);
  const remote = !!j.telecommuting || /remote|anywhere/i.test(loc) || /\bremote\b/i.test(j.title || '');
  const hybrid = /hybrid/i.test(loc);
  return {
    id: `wk-${j.shortcode || j.id}`,
    title: (j.title || '').trim(),
    // The widget payload carries the account name at the TOP level
    // (`payload.name`), not per-job, so this is normally '' — deliberately left
    // for the scanner to backfill from the tracked entry's `c.name`
    // (en-scanner stamps `company: i.company || c.name`), identical to the
    // Ashby/Lever contract. `c.name` is the user's canonical portals.yml name,
    // a cleaner display value than the raw ATS account name would be.
    company: j.company || j.account?.name || '',
    url,
    salary: '',
    location: loc || (remote ? 'Remote' : ''),
    isRemote: !!remote,
    workplaceType: remote ? 'Remote' : (hybrid ? 'Hybrid' : 'Onsite'),
    relocates: /\b(visa|relocation|sponsorship)\b/i.test((j.description || '') + ' ' + (j.title || '')),
    date: toIsoDateUtc(j.published_on || j.created_at),
    snippet: '',
    source: 'workable',
  };
}
