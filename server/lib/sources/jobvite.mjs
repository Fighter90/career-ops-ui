// @ts-check
/**
 * Jobvite source — per-tenant public jobs feed. Used by ~3,000 companies.
 *
 * Ported from parent career-ops `providers/jobvite.mjs` (#2623 migration) into
 * the web-ui source contract (rich job objects + `meta` for auto-discovery).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * WHY THE XML FEED AND NOT THE OLD JSON API
 *
 * The previous endpoint — `GET https://jobs.jobvite.com/api/company/{slug}/jobs`
 * — is RETIRED. It now 302s to `search.jobvite.com?invalid=1`, so the source
 * returned zero jobs SILENTLY rather than failing loudly. The live public feed
 * is XML, on a DIFFERENT host:
 *
 *   GET https://app.jobvite.com/CompanyJobs/Xml.aspx?c={companyEId}
 *   <result><job>
 *     <id>…</id><title>…</title><category>…</category>
 *     <location>…</location><date>M/D/YYYY</date>
 *     <detail-url><![CDATA[…]]></detail-url>
 *     <apply-url><![CDATA[…]]></apply-url>
 *   </job>…</result>
 *
 * THE TENANT KEY CHANGED SHAPE. The old API keyed on the vanity slug from the
 * careers URL ("tylertech"). The XML feed keys on an opaque `companyEId`
 * ("q6NaVfwI") that does NOT appear in the careers URL — only in the board
 * page's inline JS as `companyEId: 'q6NaVfwI'`. Resolution order (cheapest
 * first):
 *   1. `company_eid:` on the portal entry            (explicit, no network)
 *   2. `c=` query param of an explicit `api:` URL    (explicit, no network)
 *   3. discovery: GET the board page and scrape it   (one extra request)
 *
 * ───────────────────────────────────────────────────────────────────────────
 * SSRF STANCE — the security core of this port.
 *
 * TWO hosts are now in play: `jobs.jobvite.com` (the board, for eId discovery)
 * and `app.jobvite.com` (the XML feed). Both are pinned by `assertJobviteUrl`
 * before every fetch; any other hostname is rejected; https-only. NO redirect
 * is ever followed:
 *   - the board discovery fetch uses `redirect:'error'` (a retired slug that
 *     still 302s must fail loudly, not be laundered into "0 jobs");
 *   - the feed fetch uses `redirect:'manual'` — same guarantee (undici hands
 *     back the 3xx as a response instead of chasing it, so the final hostname
 *     still cannot move) but it lets us READ the Location header to tell an
 *     empty board (feed 302 → NoJobs.htm, a legitimate 0 jobs) from anything
 *     else. See `isEmptyBoardRedirect`.
 * The eId is only ever a query-param value, never a path segment. Per-job
 * detail/apply URLs are display-only (written into the job list, never fetched
 * here) and accepted from any https: origin — Jobvite tenants commonly brand
 * them onto their own domain.
 *
 * Used by the jobvite adapter (server/lib/portals/adapters/jobvite.mjs), which
 * documents how to wire a tenant in via a `tracked_companies:` entry.
 */
import { fetchText } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

export const BOARD_HOST = 'jobs.jobvite.com';
export const FEED_HOST = 'app.jobvite.com';
export const ALLOWED_HOSTS = new Set([BOARD_HOST, FEED_HOST]);
export const MAX_JOBS = 5000; // bounded-work cap on a single-page feed
const UA = 'career-ops-web-ui/1.0';

export const meta = {
  value: 'jobvite',
  label: 'Jobvite',
  region: 'en',
};

/**
 * Pin a URL to the two known Jobvite hosts over HTTPS. Defence-in-depth guard
 * run before every fetch this source makes. @param {string} url
 */
export function assertJobviteUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`jobvite: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`jobvite: URL must use HTTPS: ${url}`);
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`jobvite: untrusted hostname "${parsed.hostname}" — must be ${BOARD_HOST} or ${FEED_HOST}`);
  }
  return url;
}

// NaN-safe Date.parse → epoch ms (parent career-ops parity).
/** @param {string} value */
function toEpochMs(value) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * The companyEId from explicit config, without touching the network. Reads
 * `company_eid:` first, then the `c=` param of an `api:` URL (host-pinned).
 * Returns null when the entry only carries a vanity slug.
 *
 * @param {{ company_eid?: unknown, api?: unknown }} entry
 * @returns {string | null}
 */
export function resolveConfiguredEid(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const direct = typeof entry.company_eid === 'string' ? entry.company_eid.trim() : '';
  if (direct) return direct;

  const api = typeof entry.api === 'string' ? entry.api.trim() : '';
  if (!api) return null;
  let parsed;
  try {
    parsed = new URL(api);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) return null;
  const c = parsed.searchParams.get('c');
  return c && c.trim() ? c.trim() : null;
}

/**
 * The vanity slug from a company entry's `careers_url`, or null. Only used to
 * build the board URL for eId discovery.
 *
 * @param {{ careers_url?: unknown }} entry
 * @returns {string | null}
 */
export function resolveSlug(entry) {
  if (!entry || typeof entry !== 'object') return null;
  return slugFromBoardUrl(typeof entry.careers_url === 'string' ? entry.careers_url : '');
}

/** Extract the vanity slug from a `https://jobs.jobvite.com/{slug}[/…]` URL. */
export function slugFromBoardUrl(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== BOARD_HOST) return null;
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (!segments.length || segments[0] === 'api') return null;
  return segments[0];
}

/**
 * Scrape `companyEId` out of a Jobvite board page's inline JS
 * (`companyEId: 'q6NaVfwI'`). Quoting/spacing vary between tenants, hence the
 * tolerant pattern. Exported so the scrape is unit-testable without a network
 * call. @param {string} html
 */
export function extractEidFromBoard(html) {
  if (typeof html !== 'string' || !html) return null;
  const m = html.match(/companyEId\s*[:=]\s*['"]([A-Za-z0-9_-]{4,40})['"]/);
  return m ? m[1] : null;
}

/** Canonical XML feed URL for a companyEId. @param {string} eid */
export function buildFeedUrl(eid) {
  const u = new URL(`https://${FEED_HOST}/CompanyJobs/Xml.aspx`);
  u.searchParams.set('c', eid);
  return u.href;
}

/** The tenant's public board URL (display-only; never fetched). @param {string} slug */
export function buildBoardUrl(slug) {
  return `https://${BOARD_HOST}/${encodeURIComponent(slug)}`;
}

/**
 * The board URL actually requested during eId discovery. `fr=true&nl=1` is what
 * the branded-careers-page iframe requests: many Jobvite tenants point their
 * public careers page at their own domain, and a bare `jobs.jobvite.com/{slug}`
 * 302s straight there, so the board HTML carrying `companyEId` is never served.
 * With these params the listing renders inline instead of redirecting. A no-op
 * where it is not needed, so it goes on every board request. @param {string} slug
 */
export function buildBoardFetchUrl(slug) {
  const u = new URL(buildBoardUrl(slug));
  u.searchParams.set('fr', 'true');
  u.searchParams.set('nl', '1');
  return u.href;
}

/**
 * Whether a thrown redirect is the feed saying "this board is empty". A tenant
 * with no open positions does not get an empty `<result/>`; the feed 302s to
 * `NoJobs.htm`. Zero vacancies is a legitimate answer, not a failure.
 *
 * Scoped deliberately tight — a 3xx, on the feed host, whose target is that one
 * page — so the board's own retired-tenant redirect keeps failing loudly.
 * The Location header is relative in practice (`NoJobs.htm`), so it is resolved
 * against the request URL before comparing.
 *
 * @param {any} err  Error from a redirect:'manual' fetchText (carries .status + .location).
 * @param {string} requestUrl  The feed URL that produced it.
 */
export function isEmptyBoardRedirect(err, requestUrl) {
  const status = err?.status;
  if (typeof status !== 'number' || status < 300 || status > 399) return false;
  if (!err.location) return false;
  let target;
  try {
    target = new URL(err.location, requestUrl);
  } catch {
    return false;
  }
  return target.hostname === FEED_HOST && target.pathname.toLowerCase().endsWith('/nojobs.htm');
}

// ── lightweight XML extraction (no dependency) ──────────────────────────────
//
// indexOf cursor scanning rather than `xml.matchAll(/<job>([\s\S]*?)<\/job>/g)`
// and per-tag regexes. The feed is a remote document that can reach ~1.9 MB;
// the obvious lazy patterns are polynomial-backtracking on input that never
// closes a tag (CodeQL js/polynomial-redos, high). indexOf walks it once. This
// mirrors the parent's fixed provider, which switched to the same technique.


/** Codepoint → string, guarding invalid / illegal-XML / astral-overflow values. */

/**
 * Decode the XML entities that appear in this feed, including numeric refs
 * (`&#8217;` right quote, `&#x2013;` en dash) that show up in real titles.
 * An illegal codepoint is left as written (visible and inert) rather than
 * emitting NUL / a lone surrogate into a job title. @param {string} s
 */

/** Read one tag out of a `<job>` block, unwrapping CDATA. Index-based (no regex). */
function tagText(block, name) {
  const open = `<${name}>`;
  const close = `</${name}>`;
  const start = block.indexOf(open);
  if (start === -1) return '';
  const from = start + open.length;
  const end = block.indexOf(close, from);
  if (end === -1) return '';

  let value = block.slice(from, end).trim();
  if (value.startsWith('<![CDATA[') && value.endsWith(']]>')) {
    value = value.slice('<![CDATA['.length, -']]>'.length).trim();
  }
  return value;
}

/**
 * Parse a Jobvite `CompanyJobs/Xml.aspx` feed into the web-ui rich job shape.
 * Exported for unit tests. Per `<job>`:
 *   - title    ← `<title>`                          (required; dropped when blank)
 *   - url      ← `<detail-url>`, else `<apply-url>` (required; http:→https:, else drop)
 *   - company  ← companyName                        (the feed carries no company name)
 *   - location ← `<location>`
 *   - date     ← `<date>` (M/D/YYYY) → ISO string   ('' when absent/unparseable)
 *   - snippet  ← `<category>`
 * `<detail-url>` is preferred over `<apply-url>` — the human-readable posting
 * page rather than the raw application form. Output capped at MAX_JOBS.
 *
 * @param {string} xml
 * @param {string} companyName
 */
export function parseJobviteXml(xml, companyName) {
  if (typeof xml !== 'string' || !xml) return [];
  const company = typeof companyName === 'string' ? companyName : '';

  const out = [];
  const OPEN = '<job>';
  const CLOSE = '</job>';
  let cursor = 0;
  for (;;) {
    if (out.length >= MAX_JOBS) break;
    const start = xml.indexOf(OPEN, cursor);
    if (start === -1) break;
    const from = start + OPEN.length;
    const end = xml.indexOf(CLOSE, from);
    if (end === -1) break; // unterminated final block — nothing further to read
    cursor = end + CLOSE.length;
    const block = xml.slice(from, end);

    const title = decodeEntities(tagText(block, 'title'));
    if (!title) continue;

    // Try detail-url first, then apply-url. Each candidate is VALIDATED before
    // the next is considered, so a malformed detail-url doesn't discard a
    // posting that has a good apply-url beside it. http: is upgraded to https:
    // (feed URLs arrive as http: in practice; they are display-only).
    let url = '';
    for (const candidate of [tagText(block, 'detail-url'), tagText(block, 'apply-url')]) {
      if (!candidate) continue;
      try {
        const p = new URL(decodeEntities(candidate));
        if (p.protocol === 'http:') p.protocol = 'https:';
        if (p.protocol === 'https:') { url = p.href; break; }
      } catch { /* malformed — fall through to the next candidate */ }
    }
    if (!url) continue;

    const location = decodeEntities(tagText(block, 'location'));
    const snippet = decodeEntities(tagText(block, 'category'));
    const rawId = tagText(block, 'id');
    const postedAt = toEpochMs(tagText(block, 'date'));
    const isRemote = /\bremote\b/i.test(`${location} ${title}`);

    out.push({
      id: `jobvite-${rawId || url}`,
      title,
      company,
      url,
      salary: '', // the public feed exposes no salary field
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : '',
      relocates: false,
      date: postedAt !== undefined ? new Date(postedAt).toISOString() : '',
      snippet,
      source: 'jobvite',
    });
  }
  return out;
}

/**
 * Fetch + normalize a Jobvite tenant's job list. The companyEId is resolved
 * from config (`company_eid:` / `api:?c=`) or, failing that, discovered by
 * scraping the board page — then the XML feed is fetched and parsed.
 *
 * @param {string} endpoint  URL from buildEndpoint (a feed URL when the eId was
 *   known at build time, otherwise the board URL for discovery).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchJobvite(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const companyName = (company && typeof (/** @type {any} */ (company).name) === 'string'
    && /** @type {any} */ (company).name.trim())
    ? /** @type {any} */ (company).name.trim()
    : '';

  // 1. Configured eId: from the full entry, else the endpoint's own ?c= param.
  let eid = resolveConfiguredEid(company) || resolveConfiguredEid({ api: endpoint });

  // 2. Discovery: a vanity slug (from the entry or the board endpoint) → scrape.
  if (!eid) {
    const slug = resolveSlug(company) || slugFromBoardUrl(endpoint);
    if (!slug) {
      throw new Error(`jobvite: cannot derive a company id from ${endpoint} — set company_eid: or an api: URL with ?c=`);
    }
    const boardUrl = buildBoardFetchUrl(slug);
    assertJobviteUrl(boardUrl); // SSRF guard before the discovery fetch
    // redirect:'error' — a board that still redirects with fr=true&nl=1 present
    // is a retired slug (search.jobvite.com?invalid=1) and must fail loudly.
    const html = await fetchText(fetchImpl, boardUrl, {
      signal, redirect: 'error',
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    });
    eid = extractEidFromBoard(html);
    if (!eid) {
      throw new Error(
        `jobvite: could not find companyEId on ${boardUrl} — set it explicitly with `
        + `company_eid: (find it in the board page source as companyEId: '…').`,
      );
    }
  }

  const feedUrl = buildFeedUrl(eid);
  assertJobviteUrl(feedUrl); // SSRF guard before the feed fetch
  try {
    // redirect:'manual' — the 3xx is surfaced, never followed, so the empty
    // board (feed 302 → NoJobs.htm) can be told from a real failure.
    const xml = await fetchText(fetchImpl, feedUrl, {
      signal, redirect: 'manual',
      headers: { 'User-Agent': UA, Accept: 'application/xml, text/xml, */*' },
    });
    return parseJobviteXml(xml, companyName);
  } catch (err) {
    if (isEmptyBoardRedirect(err, feedUrl)) return []; // 0 jobs, not a failure
    throw err;
  }
}
