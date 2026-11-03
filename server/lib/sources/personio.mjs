// @ts-check
/**
 * Personio source — public, no-auth `<slug>.jobs.personio.(de|com)` career
 * sites (common across DACH/EU companies), auto-detected from that careers
 * host.
 *
 * A tenant serves its postings on three public pages:
 *
 *   /           the careers page. Server-rendered; its Next.js payload lists
 *               every posting with its `available_languages` and the language
 *               this response rendered it in.
 *   /xml        the documented XML feed. Some tenants disable it.
 *   /job/<id>   one posting's page.
 *
 * A posting can be published in several languages. Each of these pages renders
 * one of them, chosen by a `?language=` param (Accept-Language is ignored).
 * Without the param, `/` and `/job/<id>` render a posting in its own default
 * language, while `/xml` renders every posting in the tenant's language. So
 * `/` is the primary source, and each emitted row is ONE language version of
 * a posting — the version's code (e.g. `en`, `de`) rides the row's optional
 * `language` field and `/job/<id>?language=<code>` on its URL, so the scanner
 * can dedup/pick per language (CAR-223; port of parent career-ops #5044).
 *
 * - Default: one fetch of `/`, each posting in its own default language. A
 *   `?language=xx` on the tenant's careers_url asks for that language instead,
 *   wherever a posting has it.
 * - `opts.dedupIncludeLanguage` (scan_history.dedup_include_language): one
 *   more fetch of `/` per further language, up to MAX_EXTRA_LANGUAGES, so
 *   every version comes back; each posting's default-language version first,
 *   which the scan-side language dedup relies on. Skipped under a probe
 *   (`opts.maxPages`), which needs one listing request and nothing more.
 * - `opts.preferredLanguageRank` (portals.yml preferred_languages): when set
 *   and no careers_url language names one, the preferred languages' versions
 *   are fetched next to the default one.
 *
 * The payload is undocumented, so when `/` yields nothing (fetch failure, or
 * a changed page build) the source falls back to `/xml`, parsed in-process
 * with a tiny tag extractor (no XML dependency — the repo ships none), and to
 * the job links on `/` when the tenant has the feed disabled. Job links on
 * `/` with no postings in its payload mean the page build changed, which is
 * warned about rather than passed over silently.
 *
 * SSRF defence: an anchored host regex (same approach as bamboohr/breezy)
 * re-checked by `assertPersonioUrl` on EVERY request URL, plus
 * `redirect:'error'`. Per-tenant posting ids are plain integers gated by
 * `/^\d+$/` before any URL is built.
 *
 * Used by the personio adapter (server/lib/portals/adapters/personio.mjs).
 */
import { fetchTextWithRetry, delay } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
const decodeXmlEntities = decodeEntities;

export const PERSONIO_HOST_RE = /^[a-z0-9][a-z0-9-]*\.jobs\.personio\.(de|com)$/;
const REMOTE_RE = /remote|homeoffice|home\s*office|ortsunabh|deutschlandweit|bundesweit/i;

// The query param every Personio page takes its rendering language from.
const LANGUAGE_PARAM = 'language';

// A language code as Personio writes it (`de`, `en`). Codes from the payload
// and from careers_url go into request and job URLs verbatim, so this gate
// keeps them to tag characters; the scan side canonicalizes them.
const LANGUAGE_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/;

// Spacing between the per-language careers-page fetches of one tenant.
const INTER_LANGUAGE_DELAY_MS = 200;

// Ceiling on the per-language fetches of one tenant. The languages come from
// the payload, so the source alone must never decide how many requests one
// portals.yml entry makes; live tenants carry a handful at most.
const MAX_EXTRA_LANGUAGES = 5;

export const meta = {
  value: 'personio',
  label: 'Personio',
  region: 'en',
};

/** Defence-in-depth host check on EVERY request URL this source builds. */
export function assertPersonioUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`personio: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`personio: URL must use HTTPS: ${url}`);
  if (!PERSONIO_HOST_RE.test(parsed.hostname)) {
    throw new Error(`personio: untrusted hostname "${parsed.hostname}" — must match <slug>.jobs.personio.(de|com)`);
  }
  return url;
}

/** The query string asking a Personio page for `language`; '' for none. */
function languageQuery(language) {
  return language ? `?${LANGUAGE_PARAM}=${language}` : '';
}

/** `https://<host>/` with the language query, re-checked by the host gate. */
function careersPageUrl(host, language) {
  return assertPersonioUrl(`https://${host}/${languageQuery(language)}`);
}

/**
 * The language a tenant's careers_url asks for (`?language=xx`), or null.
 * A careers_url OFF the Personio host (the slug-pin case: the tenant is
 * embedded on a branded page) contributes no language.
 * @param {{ careers_url?: unknown }} company
 */
function preferredLanguage(company) {
  if (typeof company?.careers_url !== 'string') return null;
  let parsed;
  try {
    parsed = new URL(company.careers_url);
  } catch {
    return null;
  }
  if (!PERSONIO_HOST_RE.test(parsed.hostname)) return null;
  const language = (parsed.searchParams.get(LANGUAGE_PARAM) || '').trim().toLowerCase();
  return LANGUAGE_RE.test(language) ? language : null;
}

function extractText(inner) {
  const cdata = inner.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdata) return cdata[1].trim();
  return decodeXmlEntities(inner).trim();
}

// Looped to a fixed point rather than a single pass: a single global replace
// only removes non-overlapping matches in one left-to-right sweep, which CodeQL
// flags as an incomplete sanitizer (js/incomplete-sanitization) since adversarial
// nesting can leave a `<`-fragment behind. Repeating until the string stops
// changing removes any tag that pass N reveals. Used by the HTML fallback parser.
function stripTags(s) {
  let prev;
  do {
    prev = s;
    s = s.replace(/<[^>]*>/g, '');
  } while (s !== prev);
  return s;
}

function tagText(block, tag) {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? extractText(m[1]) : '';
}

// NaN-safe Date.parse → ISO string.
function toIso(value) {
  if (!value) return '';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString();
}

// Fields every web-ui scan row carries (shape contract shared by the parsers).
function rowShape({ id, title, company, url, location, date }) {
  const isRemote = REMOTE_RE.test(location) || REMOTE_RE.test(title);
  return {
    id,
    title,
    company,
    url,
    salary: '',
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : 'Onsite',
    relocates: false,
    date,
    snippet: '',
    source: 'personio',
  };
}

/**
 * Parse Personio's public XML jobs feed. Exported for unit tests.
 *
 * Shape: `<workzag-jobs><position>…</position>…</workzag-jobs>`, each position
 * carrying `<id>`, `<name>`, `<office>` (+ optional `<additionalOffices>`), and
 * `<createdAt>`. The feed has NO per-job URL, so it is built from the validated
 * tenant host: `https://<host>/job/<id>` (only when `<id>` is a plain integer).
 * The feed exposes no language, so its rows carry no `language` field.
 *
 * @param {string} xml raw XML feed body
 * @param {string} companyName value written into job.company
 * @param {string} host validated tenant host, e.g. `acme.jobs.personio.de`
 */
export function parsePersonioXml(xml, companyName, host) {
  if (typeof xml !== 'string') {
    throw new TypeError(`personio: expected an XML feed string, got ${String(xml)}`);
  }
  const jobs = [];
  // Strip <jobDescriptions> subtrees first: free-text HTML can carry a literal
  // "</position>" that would truncate the non-greedy block match, and nested
  // <name> tags that would race the position's own <name>.
  const stripped = xml.replace(/<jobDescriptions\b[^>]*>[\s\S]*?<\/jobDescriptions>/gi, '');
  const blocks = stripped.match(/<position\b[^>]*>[\s\S]*?<\/position>/g) || [];
  // Phase-2: a 200 with zero <position> blocks is only "empty" when the body
  // still speaks the documented <workzag-jobs> envelope. Anything else (the
  // tenant's HTML careers page, a drifted body) served on /xml is a wrong
  // shape, not an empty board — THROW (single request = page 1).
  if (blocks.length === 0 && !/<workzag-jobs\b/i.test(xml)) {
    throw new TypeError(`personio: expected a <workzag-jobs> XML feed, got ${xml.slice(0, 60).replace(/\s+/g, ' ').trim() || 'an empty body'}`);
  }
  for (const block of blocks) {
    const title = tagText(block, 'name');
    if (!title) continue;

    const id = tagText(block, 'id');
    if (!/^\d+$/.test(id)) continue; // need a clean numeric id to build the url

    const offices = [];
    const seen = new Set();
    for (const om of block.matchAll(/<office\b[^>]*>([\s\S]*?)<\/office>/g)) {
      const name = extractText(om[1]);
      if (name && !seen.has(name)) {
        seen.add(name);
        offices.push(name);
      }
    }
    jobs.push(rowShape({
      id: `personio-${id}`,
      title,
      company: companyName,
      url: `https://${host}/job/${id}`,
      location: offices.join(', '),
      date: toIso(tagText(block, 'createdAt')),
    }));
  }
  return jobs;
}

/**
 * Last-resort parser, for a tenant whose /xml feed is disabled (404 there,
 * 200 on the careers page) when {@link parsePersonioListing} reads nothing
 * from the same page. The page is server-rendered by the shared Personio
 * frontend build, so the full job list is already present in the initial
 * HTML — no headless browser needed. Each job is an `<a href="/job/{id}">`
 * carrying the stable, non-hashed marker class `job-box`, wrapping an `<h3>`
 * title and a `<span class="…jobMetaText…">` with the first location line.
 * Only the stable `job-box` / `jobMetaText` substrings are matched so the
 * regex stays independent of the build-specific hashed CSS-module suffixes
 * (e.g. `page_jobTitle__K0ilk`).
 *
 * The job links carry no creation date, so `date` is always '' (unlike
 * parsePersonioXml's createdAt), and no language, so neither is `language`.
 * Exported for unit tests.
 *
 * @param {string} html careers page HTML body
 * @param {string} companyName value written into job.company
 * @param {string} host validated tenant host, e.g. `acme.jobs.personio.de`
 */
export function parsePersonioHtml(html, companyName, host) {
  if (typeof html !== 'string') return [];
  const jobs = [];
  const seen = new Set();
  // href may carry a trailing query string (e.g. "/job/2560093?language=en"
  // when the page was fetched with ?language=en) — the numeric id is what we
  // need, so the query part (if any) is matched and discarded. class and href
  // aren't guaranteed in a fixed order on the anchor, so the opening tag's
  // attributes are captured as one blob and checked independently.
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = anchorRe.exec(html))) {
    const attrs = m[1];
    if (!/\bclass="[^"]*\bjob-box\b[^"]*"/.test(attrs)) continue;
    const hrefMatch = attrs.match(/\bhref="\/job\/(\d+)(?:\?[^"]*)?"/);
    if (!hrefMatch) continue;
    const id = hrefMatch[1];
    if (seen.has(id)) continue;
    const block = m[2];

    const titleMatch = block.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/);
    if (!titleMatch) continue;
    const title = decodeXmlEntities(stripTags(titleMatch[1])).trim();
    if (!title) continue;

    const locMatch = block.match(/<span\b[^>]*class="[^"]*jobMetaText[^"]*"[^>]*>([\s\S]*?)<\/span>/);
    const location = locMatch ? decodeXmlEntities(stripTags(locMatch[1])).trim() : '';

    seen.add(id);
    jobs.push(rowShape({
      id: `personio-${id}`,
      title,
      company: companyName,
      url: `https://${host}/job/${id}`,
      location,
      date: '',
    }));
  }
  return jobs;
}

/**
 * Fetch + normalize a Personio tenant's jobs, one row per language version.
 *
 * Primary path is the careers page `/` (no language force; the tenant's own
 * `?language=xx` on careers_url is honoured where a posting has it). When the
 * payload yields postings, `dedupIncludeLanguage` fans out to one more
 * careers-page fetch per further language (capped, paced, best-effort) so
 * every version comes back. When the payload yields nothing — fetch failure,
 * or a changed page build, which warns — the documented `/xml` feed answers
 * instead (feed rows carry no `language`), and when the feed itself is
 * disabled (404) the careers page's job links are the last resort. Any other
 * error (network, 5xx, blocked) is a genuine dead board and rethrown.
 *
 * @param {string} apiUrl `https://<slug>.jobs.personio.(de|com)/xml` (from
 *   buildEndpoint) — anchors the tenant host and is the feed-fallback URL
 * @param {{
 *   fetchImpl?: Function,
 *   signal?: AbortSignal,
 *   company?: object,
 *   dedupIncludeLanguage?: boolean,
 *   preferredLanguageRank?: (language: string) => number,
 *   maxPages?: number,
 * }} [opts]
 */
export async function fetchPersonio(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal, company = {}, dedupIncludeLanguage, preferredLanguageRank, maxPages } = opts;
  assertPersonioUrl(apiUrl);
  const host = new URL(apiUrl).hostname;
  const companyName = company.name || '';
  const probing = Number(maxPages) > 0;
  const allLanguages = dedupIncludeLanguage === true && !probing;
  const preferred = preferredLanguage(company);
  const rank = typeof preferredLanguageRank === 'function' ? preferredLanguageRank : null;
  // A careers_url language is a per-entry choice and wins over the scan-wide
  // preferred_languages, so those are fetched only when the entry names none.
  const preferredVersions = !allLanguages && !probing && preferred === null && rank !== null;
  // When further languages are fetched, the first fetch is the defaults one:
  // it is what puts each posting's default-language version first.
  const language = allLanguages || preferredVersions ? null : preferred;

  // redirect:'error' prevents SSRF via server-side redirects; combined with
  // assertPersonioUrl it guarantees the final hostname stays in-domain.
  let page = null;
  try {
    page = await fetchTextWithRetry(fetchImpl, careersPageUrl(host, language), {
      signal,
      redirect: 'error',
      headers: { accept: 'text/html' },
    });
  } catch {
    // Falls through to the XML feed, which answers for the tenant itself.
  }
  const postings = page === null ? [] : parsePersonioListing(page);
  if (postings.length > 0) {
    const versions = postings.map(posting => [posting]);
    if (allLanguages) {
      await addLanguageVersions(fetchImpl, companyName, host, postings, versions, { signal }, preferred, rank);
    } else if (preferredVersions) {
      await addLanguageVersions(fetchImpl, companyName, host, postings, versions, { signal }, null, rank, lang => rank(lang) >= 0);
    }
    return versions.flat()
      .map(posting => listingPostingToJob(posting, companyName, host))
      .filter(job => job !== null);
  }
  if (page !== null && parsePersonioHtml(page, companyName, host).length > 0) {
    console.warn(`personio: ${companyName}: careers page links jobs but its payload yielded none — page build may have changed; falling back to /xml`);
  }

  const feedUrl = language ? assertPersonioUrl(`${apiUrl}${languageQuery(language)}`) : apiUrl;
  try {
    const text = await fetchTextWithRetry(fetchImpl, feedUrl, {
      signal,
      redirect: 'error',
      headers: { accept: 'application/xml, text/xml' },
    });
    return parsePersonioXml(text, companyName, host);
  } catch (err) {
    // A 404 is never retried, so it arrives here on the first attempt.
    if (err?.status !== 404) throw err;
    // Some tenants disable the public XML feed; the careers page still links
    // every job in its initial HTML — reuse the page already fetched.
    const html = page ?? await fetchTextWithRetry(fetchImpl, careersPageUrl(host, language), {
      signal,
      redirect: 'error',
      headers: { accept: 'text/html' },
    });
    return parsePersonioHtml(html, companyName, host);
  }
}

/**
 * Fetch the careers page once per language some posting has beyond the one it
 * was first rendered in, and append each posting's version in that language to
 * its entry in `versions`. Best-effort: a language whose fetch fails is skipped
 * and the versions already collected stand. Languages past MAX_EXTRA_LANGUAGES
 * are not fetched, with a warning; the order is the careers_url language
 * first, then the preferred languages best first, then code order, so the cap
 * skips the languages nobody asked for before one that was asked for.
 *
 * @param {string} companyName
 * @param {string} host
 * @param {ListingPosting[]} postings - From the defaults fetch.
 * @param {ListingPosting[][]} versions - Parallel to `postings`; appended to.
 * @param {{ signal?: AbortSignal }} io
 * @param {string|null} preferred - The careers_url language, if any.
 * @param {((language: string) => number)|null} rank - preferredLanguageRank, if set.
 * @param {(language: string) => boolean} [keep] - Fetch only the languages it accepts.
 */
async function addLanguageVersions(fetchImpl, companyName, host, postings, versions, io, preferred, rank, keep = () => true) {
  const indexById = new Map(postings.map((posting, i) => [posting.id, i]));
  const order = (lang) => {
    if (lang === preferred) return -1;
    const r = rank ? rank(lang) : -1;
    return r < 0 ? Number.MAX_SAFE_INTEGER : r;
  };
  const wanted = [...new Set(postings.flatMap(posting =>
    posting.availableLanguages.filter(lang => lang !== posting.currentLocale && keep(lang))))]
    .sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  const languages = wanted.slice(0, MAX_EXTRA_LANGUAGES);
  if (languages.length < wanted.length) {
    console.warn(`personio: ${companyName}: ${wanted.length} further languages exceed the cap of ${MAX_EXTRA_LANGUAGES}; skipped ${wanted.slice(MAX_EXTRA_LANGUAGES).join(', ')}`);
  }
  for (const [n, lang] of languages.entries()) {
    if (n > 0) await delay(INTER_LANGUAGE_DELAY_MS, io.signal);
    let page;
    try {
      page = await fetchTextWithRetry(fetchImpl, careersPageUrl(host, lang), {
        signal: io.signal,
        redirect: 'error',
        headers: { accept: 'text/html' },
      });
    } catch {
      continue;
    }
    for (const posting of parsePersonioListing(page)) {
      const i = indexById.get(posting.id);
      // A posting without this language comes back in its default one, which
      // the defaults fetch already holds.
      if (i === undefined || posting.currentLocale !== lang) continue;
      if (postings[i].currentLocale === lang) continue;
      versions[i].push(posting);
    }
  }
}

/**
 * One emitted row = one language version of a posting. `language` carries the
 * version's code exactly as Personio writes it, lowercased and gated by
 * LANGUAGE_RE (e.g. `en`, `de`); omitted when the payload's current_locale was
 * unreadable. The posting id is digits-only (gated by toListingPosting), so
 * the URL is safe by construction.
 * @param {ListingPosting} posting
 * @param {string} companyName
 * @param {string} host
 */
function listingPostingToJob(posting, companyName, host) {
  if (!posting.name) return null;
  const language = posting.currentLocale;
  const offices = [...new Set([posting.mainOffice, ...posting.additionalOffices].filter(Boolean))];
  return {
    ...rowShape({
      id: `personio-${posting.id}`,
      title: posting.name,
      company: companyName,
      url: `https://${host}/job/${posting.id}${languageQuery(language)}`,
      location: offices.join(', '),
      date: toIso(posting.createdAt),
    }),
    ...(language ? { language } : {}),
  };
}

/**
 * @typedef {object} ListingPosting
 * @property {string} id
 * @property {string} name
 * @property {string} mainOffice
 * @property {string[]} additionalOffices
 * @property {string} createdAt
 * @property {string[]} availableLanguages
 * @property {string} currentLocale - The language this page rendered it in; '' when unreadable.
 */

/**
 * Parse the postings out of a careers page's Next.js payload. Exported for
 * unit tests.
 *
 * The page streams its React Server Component payload as
 * `self.__next_f.push([1,"<chunk>"])` scripts; the chunks are JSON string
 * literals that concatenate into one text, in which each posting is a JSON
 * object starting `{"id":"<digits>"` and carrying `available_languages`. Only
 * objects that parse as JSON and have a numeric id, a name and that array are
 * kept, so the unrelated objects sharing the `id` key never pass.
 *
 * @param {string} html - careers page HTML body
 * @returns {ListingPosting[]} In page order, one per id; empty when nothing parses.
 */
export function parsePersonioListing(html) {
  if (typeof html !== 'string') return [];
  let payload = '';
  for (const m of html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)) {
    try {
      const chunk = JSON.parse(m[1]);
      if (chunk[0] === 1 && typeof chunk[1] === 'string') payload += chunk[1];
    } catch {
      // Not a data chunk.
    }
  }
  const postings = [];
  const seen = new Set();
  let from = 0;
  for (;;) {
    const start = payload.indexOf('{"id":"', from);
    if (start === -1) break;
    const end = jsonObjectEnd(payload, start);
    from = start + 1;
    if (end === -1) continue;
    let raw;
    try {
      raw = JSON.parse(payload.slice(start, end));
    } catch {
      continue;
    }
    const posting = toListingPosting(raw);
    if (!posting || seen.has(posting.id)) continue;
    seen.add(posting.id);
    postings.push(posting);
    from = end;
  }
  return postings;
}

/** @param {any} raw @returns {ListingPosting|null} */
function toListingPosting(raw) {
  if (!raw || typeof raw.id !== 'string' || !/^\d+$/.test(raw.id)) return null;
  if (typeof raw.name !== 'string' || !Array.isArray(raw.available_languages)) return null;
  const languageOf = (value) => {
    const language = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return LANGUAGE_RE.test(language) ? language : '';
  };
  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  return {
    id: raw.id,
    name: text(raw.name),
    mainOffice: text(raw.main_office),
    additionalOffices: Array.isArray(raw.additional_offices) ? raw.additional_offices.map(text).filter(Boolean) : [],
    createdAt: text(raw.created_at),
    availableLanguages: raw.available_languages.map(languageOf).filter(Boolean),
    currentLocale: languageOf(raw.current_locale),
  };
}

/**
 * Index just past the JSON object opening at `start`, or -1 when it never
 * closes. Braces inside string literals are skipped.
 *
 * @param {string} text
 * @param {number} start - Index of the opening `{`.
 */
function jsonObjectEnd(text, start) {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i + 1;
  }
  return -1;
}
