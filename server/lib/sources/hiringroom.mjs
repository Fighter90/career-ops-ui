// @ts-check
/**
 * HiringRoom source — a LATAM/AR applicant-tracking system where every
 * employer runs its own `<company>.hiringroom.com` microsite.
 *
 * Ported from parent career-ops `providers/hiringroom.mjs` (legacy `/jobs`
 * cards + the newer JSON-LD `/portal/jobs` layout), re-shaped to the web-ui
 * source contract: a `meta` export for registry auto-discovery, pure exported
 * parsers the tests drive with no network, an injected `fetchImpl`, and the
 * web-ui job object.
 *
 * ── The two layouts ──────────────────────────────────────────────────────
 * There is no public JSON API, so the tenant's microsite HTML is fetched once
 * and parsed in-process (zero-token):
 *
 *   - legacy `/jobs`: server-rendered vacancy cards. Each vacancy is an
 *     `<a href="/jobs/get_vacancy/<hex id>">` wrapping a card whose
 *     `<h4 class="… name__vacancy">` holds the title and whose
 *     `.hr-Location-pin` icon precedes the location text. Apply links
 *     (`…/candidates/new`) and title-less blocks are skipped; URLs deduped.
 *   - newer `/portal/jobs`: the listing is embedded as schema.org JSON-LD (an
 *     ItemList of JobPosting). JSON-LD is tried FIRST; the card markup is the
 *     fallback when the page carries none.
 *
 * Tenants on the newer layout answer `/jobs` with a 302 to `/portal`, which the
 * `redirect:'error'` guard refuses — so their portals.yml entry must point at
 * `/portal/jobs` (`/portal` alone lists only a few featured vacancies). That
 * refusal is intentional and matches the parent.
 *
 * ── Security ─────────────────────────────────────────────────────────────
 * `assertHiringRoomUrl` requires HTTPS and a host that is `hiringroom.com` or a
 * subdomain of it (a look-alike such as `evil-hiringroom.com` is refused), and
 * the fetch uses `redirect:'error'`. JSON-LD posting URLs are rebuilt as
 * `origin + path` and kept only when they point at a vacancy on the tenant's
 * own host — the payload advertises `http://`, and a URL on any other host is
 * never emitted.
 *
 * ── Caps / failure ───────────────────────────────────────────────────────
 * The microsite is a single page (no pagination in either layout), so the page
 * cap is one request per company; the row count is capped at MAX_JOBS. A fetch
 * failure throws, and the scanner's per-company try/catch turns it into one
 * logged error for that company without affecting the others (a 404/410 also
 * feeds the quarantine). A malformed JSON-LD block is skipped, not fatal.
 */
import { fetchText, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
import { htmlToText } from '../html-to-text.mjs';

export const meta = {
  value: 'hiringroom',
  label: 'HiringRoom',
  region: 'en',
};

export const TRUSTED_HOST = 'hiringroom.com';
/** `hiringroom.com` or any subdomain; anchored at both ends. */
export const HIRINGROOM_HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*hiringroom\.com$/i;

/** Hard ceiling on rows per company — the microsite is one unpaginated page. */
export const MAX_JOBS = 1000;
const SNIPPET_CAP = 400;
const DEFAULT_COMPANY = 'HiringRoom';

const VACANCY_PATH_RE = /^\/jobs\/get_vacancy\/([a-f0-9]+)$/i;

/**
 * Whether a hostname is HiringRoom-owned. Exported for the adapter + tests.
 * @param {unknown} hostname
 */
export function isHiringRoomHost(hostname) {
  return typeof hostname === 'string' && HIRINGROOM_HOST_RE.test(hostname);
}

/**
 * Validate a HiringRoom URL: HTTPS-only, host pinned to hiringroom.com or a
 * subdomain. Throws with a message naming the offending value.
 * @param {string} url
 * @returns {URL} the parsed URL
 */
export function assertHiringRoomUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`hiringroom: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`hiringroom: URL must use HTTPS: ${url}`);
  if (!isHiringRoomHost(parsed.hostname)) {
    throw new Error(`hiringroom: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST} or a subdomain`);
  }
  return parsed;
}

/**
 * Markup → plain text, tightening the space the tag strip leaves before
 * punctuation (`<strong>x</strong>.` → `x.`), as the parent does.
 * @param {unknown} s
 */
function toText(s) {
  return htmlToText(s).replace(/\s+([.,;:])/g, '$1');
}

/** @param {string} s */
function oneLine(s) {
  return decodeEntities(s).replace(/\s+/g, ' ').trim();
}

/** @param {unknown} loc */
function jsonLdLocation(loc) {
  const place = Array.isArray(loc) ? loc[0] : loc;
  const address = place && typeof place === 'object' ? /** @type {any} */ (place).address : undefined;
  if (typeof address === 'string') return oneLine(address);
  if (address && typeof address === 'object') {
    return ['addressLocality', 'addressRegion', 'addressCountry']
      .map((k) => address[k])
      .filter((v) => typeof v === 'string' && v.trim())
      .map((v) => oneLine(v))
      .join(', ');
  }
  return '';
}

/**
 * `datePosted` → `YYYY-MM-DD` (UTC), or '' when absent/unparseable — a
 * fabricated date would defeat the scanner's age filter.
 * @param {unknown} v
 */
function isoDate(v) {
  if (typeof v !== 'string' || !v.trim()) return '';
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : '';
}

/**
 * Build one web-ui job row.
 * @param {{ host: string, vacancyId: string, title: string, url: string, company: string,
 *           location: string, date?: string, description?: string, remoteHint?: boolean }} p
 */
function toJob({ host, vacancyId, title, url, company, location, date = '', description = '', remoteHint = false }) {
  const isRemote = remoteHint || /\bremot[oae]\b/i.test(location) || /\bremote\b/i.test(title);
  /** @type {Record<string, any>} */
  const job = {
    id: `hiringroom-${host}-${vacancyId.toLowerCase()}`,
    title,
    company,
    url,
    salary: '',
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : '',
    relocates: false,
    date,
    snippet: description.slice(0, SNIPPET_CAP),
    source: 'hiringroom',
  };
  if (description) job.description = description;
  return job;
}

/**
 * Read the schema.org JobPosting entries a `/portal/jobs` page embeds.
 * @param {string} html
 * @param {string} origin
 * @param {string} company
 */
function parseJsonLdJobs(html, origin, company) {
  const host = new URL(origin).hostname.toLowerCase();
  const jobs = [];
  const seen = new Set();
  const scriptRe = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  for (const [, body] of html.matchAll(scriptRe)) {
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      continue; // one malformed block never sinks the page
    }
    const items = Array.isArray(data?.itemListElement) ? data.itemListElement : [];
    for (const el of items) {
      const posting = el?.item;
      if (!posting || posting['@type'] !== 'JobPosting') continue;
      const title = typeof posting.title === 'string' ? toText(posting.title) : '';
      if (!title) continue;

      let parsed;
      try {
        parsed = new URL(String(posting.url));
      } catch {
        continue;
      }
      const idM = VACANCY_PATH_RE.exec(parsed.pathname);
      if (parsed.hostname.toLowerCase() !== host || !idM) continue;
      // Rebuilt on the validated https origin: the payload says http://.
      const url = origin + parsed.pathname;
      if (seen.has(url)) continue;
      seen.add(url);

      jobs.push(toJob({
        host,
        vacancyId: idM[1],
        title,
        url,
        company,
        location: jsonLdLocation(posting.jobLocation),
        date: isoDate(posting.datePosted),
        description: typeof posting.description === 'string' ? toText(posting.description) : '',
        remoteHint: posting.jobLocationType === 'TELECOMMUTE',
      }));
    }
  }
  return jobs;
}

/**
 * Parse a HiringRoom microsite (either layout) into web-ui job rows. JSON-LD
 * first; the legacy card markup when the page carries none. Exported for tests.
 *
 * @param {unknown} html raw microsite HTML
 * @param {string} origin validated tenant origin, e.g. "https://growuphr.hiringroom.com"
 * @param {string} [company] the portals.yml entry name
 * @returns {object[]}
 */
export function parseHiringRoomJobs(html, origin, company = DEFAULT_COMPANY) {
  if (typeof html !== 'string' || !html) return [];
  let host;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return [];
  }
  const label = typeof company === 'string' && company.trim() ? company.trim() : DEFAULT_COMPANY;

  const fromJsonLd = parseJsonLdJobs(html, origin, label);
  if (fromJsonLd.length > 0) return fromJsonLd.slice(0, MAX_JOBS);

  const jobs = [];
  const seen = new Set();
  const matches = [...html.matchAll(/href="(\/jobs\/get_vacancy\/([a-f0-9]+))"/gi)];
  for (let k = 0; k < matches.length; k++) {
    const href = matches[k][1];
    const start = matches[k].index ?? 0;
    const end = k + 1 < matches.length ? (matches[k + 1].index ?? html.length) : html.length;
    const block = html.slice(start, end);

    const titleM = block.match(/name__vacancy[^>]*>([\s\S]*?)<\/h4>/i);
    if (!titleM) continue;
    const title = toText(titleM[1]);
    if (!title) continue;

    const url = origin + href;
    if (seen.has(url)) continue;
    seen.add(url);

    const locM = block.match(/hr-Location-pin[^>]*><\/i>\s*([^<]+)/i);
    const location = locM ? oneLine(locM[1]) : '';

    jobs.push(toJob({ host, vacancyId: matches[k][2], title, url, company: label, location }));
    if (jobs.length >= MAX_JOBS) break;
  }
  return jobs;
}

// Every real HiringRoom microsite — including an EMPTY board — references the
// HiringRoom product somewhere: tenant-host links, the /jobs/get_vacancy/
// permalinks, or embedded JSON-LD. A bot wall answers 200 with a small HTML
// challenge page that carries none of those, and parsed as zero vacancies it
// used to read as a healthy empty board.
function assertHiringRoomPage(html, url) {
  if (typeof html === 'string'
      && /hiringroom\.com|\/jobs\/get_vacancy\/|application\/ld\+json/i.test(html)) return;
  throw new Error(`hiringroom: ${url} is not a HiringRoom microsite (bot-wall challenge or dead tenant?)`);
}

/**
 * Fetch + normalize one HiringRoom tenant microsite — a single GET.
 *
 * The endpoint is host-checked BEFORE the request, so an off-host URL never
 * reaches the network; the response must carry the HiringRoom container
 * (assertHiringRoomPage). `fetchImpl` is always the injected one.
 *
 * @param {string} endpoint from buildEndpoint (the entry's careers_url / api)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchHiringRoom(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const parsed = assertHiringRoomUrl(endpoint);
  const html = await fetchText(/** @type {any} */ (fetchImpl), parsed.href, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': BROWSER_LIKE_USER_AGENT, Accept: 'text/html' },
  });
  assertHiringRoomPage(html, parsed.href);
  const name = company && typeof company.name === 'string' ? company.name : '';
  return parseHiringRoomJobs(html, parsed.origin, name);
}
