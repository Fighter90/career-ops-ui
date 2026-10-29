// @ts-check
/**
 * Deel source — the multi-tenant ATS hosted at `jobs.deel.com/<slug>`
 * (Klarna, Deel itself, …). One entry per employer in `tracked_companies:`;
 * auto-detected from `careers_url` / `api:` = `https://jobs.deel.com/<slug>[/...]`.
 *
 * The board has no JSON list API (`/api/` is disallowed by robots.txt and this
 * source never touches it). The tenant landing page is server-rendered by
 * Next.js and ships the whole inventory in its RSC ("flight") stream, so ONE
 * page request returns every posting with title, locations, work arrangement,
 * created/published timestamps and the description — zero per-posting requests:
 *
 *   self.__next_f.push([1,"...\"jobPostings\":[{id, title, richtextDescription:\"$1a\",
 *     createdAt, job:{workArrangementEnum, jobLocations:[{location:{name,country}}]},
 *     jobPostingPublications:[{currentState:{stateSlug, createdAt}}]}, ...]..."])
 *
 * `richtextDescription` is a reference ("$1a") to a text row
 * (`1a:T<hexlen>,<html>`) elsewhere in the same stream; it is resolved here,
 * best-effort, through the shared htmlToText (DESCRIPTION_CAP).
 *
 * Compensation is deliberately NOT mapped: the payload carries `minAmount` /
 * `maxAmount` with no pay interval, so annualizing would be a guess.
 *
 * A tenant that serves its careers from its own site answers
 * `jobs.deel.com/<slug>` with a redirect (Deel itself 301s to
 * www.deel.com/careers/). The fetch never follows it — `redirect: 'error'` is
 * mandatory — and says so by name, so such an entry reads as "not on this
 * board" rather than a generic network failure.
 *
 * Ported from the parent's providers/deel.mjs (upstream #6189). Deviations for
 * the web-ui source contract: the fetch goes through the shared
 * fetchTextWithRetry (injected fetchImpl, redirect:'error' default) and the
 * board rows are normalized to the scanner's job shape (id/source/date/…);
 * the container checks reuse `_shape.mjs` semantics — a malformed 200 throws,
 * never an empty board.
 */
import { fetchTextWithRetry, REDIRECT_REFUSAL_CAUSE_MESSAGE } from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';
import { requireArray } from './_shape.mjs';

export const meta = {
  value: 'deel',
  label: 'Deel',
  region: 'en',
};

export const DEEL_HOST = 'jobs.deel.com';
// First path segment = the tenant slug. Restricted to URL-safe characters, so it
// needs no further encoding when the origin is rebuilt.
export const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/**
 * Defence-in-depth endpoint check: HTTPS on exactly the board host, default
 * port only. Runs on the endpoint the adapter resolved, before any request —
 * a tampered or misconfigured entry can never point the fetch somewhere else.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertDeelUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`deel: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`deel: URL must use HTTPS: ${url}`);
  if (parsed.port !== '') throw new Error(`deel: a non-default port is not allowed: ${url}`);
  if (parsed.hostname !== DEEL_HOST) {
    throw new Error(`deel: untrusted hostname "${parsed.hostname}" — must be ${DEEL_HOST}`);
  }
  return url;
}

/**
 * Pull the tenant slug out of a URL string. Only the host is a trust boundary:
 * the origin is rebuilt from the fixed host and the validated slug, never from
 * the input's own path or port.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function extractSlug(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== DEEL_HOST) return null;
  const slug = parsed.pathname.split('/').filter(Boolean)[0];
  if (slug && SLUG_RE.test(slug)) return slug;
  return null;
}

/**
 * The slug from an entry's explicit `api` field, else its careers_url.
 * @param {{api?: unknown, careers_url?: unknown}} [entry]
 * @returns {string | null}
 */
export function resolveSlug(entry) {
  return extractSlug(entry?.api) || extractSlug(entry?.careers_url);
}

/** The board-root URL for one slug (the adapter's endpoint shape). */
export function boardUrlFor(slug) {
  return `https://${DEEL_HOST}/${slug}`;
}

/**
 * undici reports a refused redirect (our `redirect: 'error'` meeting a 3xx) as
 * a bare TypeError whose cause names it — deterministic, never a network flake.
 * @param {unknown} err
 * @returns {boolean}
 */
function isRefusedRedirectError(err) {
  return err instanceof TypeError && err?.cause?.message === REDIRECT_REFUSAL_CAUSE_MESSAGE;
}

/** @param {unknown} value */
function toEpochMs(value) {
  if (!value || typeof value !== 'string') return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Concatenate every `self.__next_f.push([1,"..."])` chunk into the one RSC stream.
 * A chunk that won't JSON-decode is skipped (one bad chunk must not lose the board).
 * @param {string} html
 * @returns {string}
 */
export function readFlightStream(html) {
  const parts = [];
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try {
      parts.push(JSON.parse(`"${m[1]}"`));
    } catch { /* skip the chunk */ }
  }
  return parts.join('');
}

/**
 * Index the stream's text rows (`<id>:T<hexlen>,<payload>`) by id. The length is in
 * UTF-8 bytes, so the walk runs over a Buffer. Best-effort: on an unrecognised row
 * the walk stops and returns what it has — a description is never worth the board.
 * @param {string} stream
 * @returns {Map<string, string>}
 */
export function readTextRows(stream) {
  const texts = new Map();
  const buf = Buffer.from(stream, 'utf8');
  let o = 0;
  while (o < buf.length) {
    const colon = buf.indexOf(0x3a, o); // ':'
    if (colon < 0) break;
    const id = buf.toString('utf8', o, colon);
    if (!/^[0-9a-f]*$/.test(id)) break;
    if (buf[colon + 1] === 0x54) { // 'T' — length-prefixed text row
      const comma = buf.indexOf(0x2c, colon + 2);
      if (comma < 0) break;
      const hex = buf.toString('utf8', colon + 2, comma);
      if (!/^[0-9a-f]+$/.test(hex)) break;
      const len = parseInt(hex, 16);
      texts.set(id, buf.toString('utf8', comma + 1, comma + 1 + len));
      o = comma + 1 + len;
    } else {
      const nl = buf.indexOf(0x0a, colon + 1);
      o = nl < 0 ? buf.length : nl + 1;
    }
  }
  return texts;
}

/**
 * Parse the JSON container that starts at `stream[start]` (a `[` or `{`),
 * string-aware. Exported behaviour is upstream's array reader, generalized so
 * a container of the wrong shape reaches requireArray (a named throw) instead
 * of silently reading as "no container".
 * @param {string} stream
 * @param {number} start
 * @returns {unknown}
 */
function readJsonContainerAt(stream, start) {
  const open = stream[start];
  const close = open === '[' ? ']' : open === '{' ? '}' : null;
  if (!close) throw new Error(`deel: unexpected payload where the jobPostings container should be`);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < stream.length; i++) {
    const ch = stream[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return JSON.parse(stream.slice(start, i + 1));
  }
  throw new Error('deel: unterminated container in page payload');
}

/**
 * Location text from a posting's `jobLocations`: each place with its country when
 * the name doesn't already carry it, plus "Remote" for a remote arrangement so a
 * remote-aware location_filter can see it.
 * @param {any} job
 * @returns {string}
 */
function locationOf(job) {
  const places = [];
  for (const jl of Array.isArray(job?.jobLocations) ? job.jobLocations : []) {
    const name = typeof jl?.location?.name === 'string' ? jl.location.name.trim() : '';
    if (!name) continue;
    const country = typeof jl.location.country?.name === 'string' ? jl.location.country.name.trim() : '';
    places.push(country && !name.toLowerCase().includes(country.toLowerCase()) ? `${name}, ${country}` : name);
  }
  let text = places.join('; ');
  if (job?.workArrangementEnum === 'REMOTE' && !/remote/i.test(text)) {
    text = text ? `${text}; Remote` : 'Remote';
  }
  return text;
}

/**
 * Resolve a `richtextDescription` value: a `$<hex>` reference into the text rows,
 * or an inline string. Anything else is no description.
 * @param {unknown} ref
 * @param {Map<string, string>} texts
 * @returns {string}
 */
function descriptionOf(ref, texts) {
  if (typeof ref !== 'string') return '';
  const html = /^\$[0-9a-f]+$/.test(ref) ? texts.get(ref.slice(1)) : ref;
  return html ? htmlToText(html) : '';
}

/**
 * @param {string} slug
 * @param {unknown} id
 * @returns {string | null}
 */
function postingUrl(slug, id) {
  const seg = typeof id === 'string' ? safeEncodeURIComponent(id) : null;
  return seg ? `https://${DEEL_HOST}/${slug}/job-details/${seg}/overview` : null;
}

/**
 * Parse a `jobs.deel.com/<slug>` landing page. Exported for unit tests.
 *
 * - `[]` — the documented container is present and empty (a real, empty board).
 * - throws — the page is the "Job Board Not Found" shell, carries no flight stream,
 *   or carries no `jobPostings` container (a markup change).
 * - a malformed row is dropped, never fatal.
 *
 * @param {string} html
 * @param {{slug: string, company: string}} opts
 * @returns {Array<{title: string, url: string, company: string, location: string,
 *   postedAt?: number, externalId: string, description?: string}>}
 */
export function parseDeelBoard(html, { slug, company }) {
  if (typeof html !== 'string' || !html) throw new Error('deel: empty response body');
  if (/<title>\s*Job Board Not Found\s*<\/title>/i.test(html)) {
    throw new Error(`deel: no board at jobs.deel.com/${slug} (Job Board Not Found)`);
  }
  const stream = readFlightStream(html);
  if (!stream) throw new Error('deel: page carries no Next.js flight data — markup changed?');

  const tenant = stream.indexOf('"jobPostings":');
  if (tenant < 0) {
    throw new Error('deel: no jobPostings in page payload — markup changed?');
  }
  const rows = requireArray(readJsonContainerAt(stream, tenant + '"jobPostings":'.length), 'deel jobPostings');
  return parseTenantPostings(rows, stream, { slug, company });
}

/**
 * @param {any[]} rows
 * @param {string} stream
 * @param {{slug: string, company: string}} opts
 */
function parseTenantPostings(rows, stream, { slug, company }) {
  const texts = rows.some((r) => typeof r?.richtextDescription === 'string' && r.richtextDescription.startsWith('$'))
    ? readTextRows(stream)
    : new Map();
  const out = [];
  for (const r of rows) {
    const title = typeof r?.title === 'string' ? r.title.trim() : '';
    const url = postingUrl(slug, r?.id);
    if (!title || !url) continue;
    // Prefer the moment the posting went live over the record's creation (a draft can
    // sit for weeks); fall back to createdAt when the publication state is absent.
    const published = Array.isArray(r.jobPostingPublications)
      ? r.jobPostingPublications.map((p) => p?.currentState).find((s) => typeof s?.stateSlug === 'string' && s.stateSlug.startsWith('published'))
      : undefined;
    const description = descriptionOf(r.richtextDescription, texts);
    out.push({
      title,
      url,
      company,
      location: locationOf(r.job),
      ...(toEpochMs(published?.createdAt) !== undefined || toEpochMs(r.createdAt) !== undefined
        ? { postedAt: toEpochMs(published?.createdAt) ?? toEpochMs(r.createdAt) }
        : {}),
      externalId: /** @type {string} */ (r.id),
      ...(description ? { description } : {}),
    });
  }
  return out;
}

/** Scanner job-row shape for one parsed posting. */
function normalize(row) {
  return {
    id: `deel-${row.url}`,
    title: row.title,
    company: row.company,
    url: row.url,
    salary: '',
    location: row.location || '',
    isRemote: /remote|удал[её]н/i.test(`${row.title} ${row.location}`),
    workplaceType: '',
    relocates: false,
    date: typeof row.postedAt === 'number' ? new Date(row.postedAt).toISOString() : '',
    snippet: row.description || '',
    source: 'deel',
  };
}

/**
 * Fetch + parse one `jobs.deel.com/<slug>` tenant board (single request).
 * The endpoint is re-validated against the pinned host before any request
 * (assertDeelUrl); a refused redirect — a tenant whose careers live on their
 * own site — is reported by name so the entry reads as "not on this board".
 *
 * @param {string} endpoint - the board-root URL (asserted here).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchDeel(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company } = opts;
  // Host allowlist before any request (SSRF guard): the adapter resolved this
  // endpoint from the entry; re-validate it here.
  assertDeelUrl(endpoint);
  // A scan aborted before the first request must fail loud, not report an
  // empty board (paylocity convention).
  signal?.throwIfAborted();
  const slug = extractSlug(endpoint);
  if (!slug) {
    throw new Error(`deel: cannot derive a jobs.deel.com/<slug> board for ${company?.name || endpoint}. Set careers_url to https://jobs.deel.com/<slug>`);
  }
  let html;
  try {
    html = await fetchTextWithRetry(fetchImpl, boardUrlFor(slug), { signal, redirect: 'error' });
  } catch (err) {
    if (isRefusedRedirectError(err)) {
      throw new Error(`deel: jobs.deel.com/${slug} redirects away from the board — the company serves its careers elsewhere`);
    }
    throw err;
  }
  return parseDeelBoard(html, { slug, company: String(company?.name ?? '') }).map(normalize);
}
