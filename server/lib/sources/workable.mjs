/**
 * Workable public jobs API wrapper.
 *
 * PRIMARY endpoint (parent career-ops v1.25.0 parity — commit 5ab8425
 * "use the public widget API so large accounts are scanned"):
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
 * HARDENING (parent career-ops parity — commit feabcd4, "harden workable with
 * retry, headers, and serialization"): the widget request carries browser-like
 * headers (the shared BROWSER_LIKE_USER_AGENT + accept-language + origin + a
 * per-account referer), retries transient failures (429 / 5xx / network) via the
 * shared `fetchJsonWithRetry`, and is serialized process-wide against
 * apply.workable.com — Cloudflare fronts every tenant on that single host, so one
 * in-flight request at a time avoids self-inflicted rate-limiting. A permanent
 * 4xx is not retried; once the retry budget is spent the error propagates and the
 * dead-board throw fires. (The web-ui source is single-request — it has no
 * markdown fallback — so the parent's give-up-early-on-long-Retry-After branch,
 * whose only purpose is to fall through to that feed, does not apply here.)
 */
import { fetchJsonWithRetry, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';

// Browser-like request headers. apply.workable.com sits behind Cloudflare, which
// can block a generic UA outright; the shared BROWSER_LIKE_USER_AGENT keeps every
// worked-around source pinned to one Chrome version instead of drifting per file.
// `referer` is per-account, added in fetchWorkable. Mirrors the parent's
// WORKABLE_HEADERS.
const WORKABLE_HEADERS = {
  'user-agent': BROWSER_LIKE_USER_AGENT,
  accept: 'application/json',
  'accept-language': 'en-US,en;q=0.9',
  origin: 'https://apply.workable.com',
};

// Process-wide serialization: apply.workable.com fronts every tenant on the same
// host, so this process never needs more than one in-flight request to it at a
// time. Mirrors the parent's `serialized()` — errors are swallowed off the queue
// tail so one failed fetch can't wedge every later one.
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

export async function fetchWorkable(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal, retryDelayMs = 500 } = opts;

  const slug = resolveWorkableSlug(apiUrl);
  if (!slug) throw new Error(`Workable: cannot derive account slug from ${apiUrl}`);

  // Build on a hard-coded host and re-assert (defence in depth); `redirect:
  // 'error'` closes the SSRF-via-redirect vector, matching the parent.
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
 * tests. Keeps only titled, on-domain, deduped jobs — off-domain or non-HTTPS
 * permalinks are dropped rather than emitted.
 *
 * @param {any} payload — parsed JSON body of the widget endpoint
 * @returns {Array<object>}
 */
export function parseWorkableWidget(payload) {
  if (!payload || !Array.isArray(payload.jobs)) return [];
  const jobs = [];
  const seen = new Set();
  for (const raw of payload.jobs) {
    const title = typeof raw?.title === 'string' ? raw.title.trim() : '';
    if (!title) continue;

    // shortlink is the canonical public permalink; url is the same host. Both
    // are validated; off-domain / non-https entries are dropped.
    const url = safeJobUrl(raw?.shortlink) || safeJobUrl(raw?.url) || safeJobUrl(raw?.application_url);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    jobs.push(normalize(raw, url));
  }
  return jobs;
}

function normalize(j, url) {
  const loc = [j.city, j.state, j.country]
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => v.trim())
    .join(', ');
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
    date: j.published_on || j.created_at || '',
    snippet: '',
    source: 'workable',
  };
}
