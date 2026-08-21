// @ts-check
/**
 * Job Bank (Canada) source — Canada's federal public job-search service
 * (jobbank.gc.ca), run by Employment and Social Development Canada. A national
 * employment service, same class as arbeitsagentur.mjs (Germany): a high-volume
 * public source no commercial aggregator covers well.
 *
 * Implements the web-ui source contract (rich job objects + `meta` for
 * auto-discovery). Config comes from the company entry's `jobbankca:` block,
 * read via `opts.company`:
 *
 *   tracked_companies:
 *     - name: Job Bank Canada — Software
 *       provider: jobbankca
 *       jobbankca:
 *         # keywords optional: falls back to config/profile.yml's target_roles
 *         # (primary[] + archetypes[].name) when omitted, same as vdab.mjs.
 *         keywords: ["software engineer", "backend developer"]
 *       max_pages: 5        # optional, clamped to MAX_PAGES_CAP (20)
 *       enabled: true
 *
 * PUBLIC FEED, NO AUTH. `FEED_URL` below is Job Bank's public search feed —
 * despite "RSS" in its path it is ATOM (`<feed><entry>`, not `<rss><item>`).
 * No login, no API key, no session cookie.
 *
 * robots.txt sets `Crawl-delay: 5` and does not disallow `/jobsearch/feed/`.
 * INTER_REQUEST_DELAY_MS honors that delay between every request this source
 * makes (overridable via `opts.delayMs` — set 0 in tests). `searchstring` does
 * free-text matching against title+description; `locationstring` does NOT
 * reliably filter, so — recall-first, same as arbeitsagentur.mjs's nationwide
 * pass — this source does not attempt location filtering at the source; the
 * en-scanner's location_filter runs on the results afterwards.
 *
 * PAGE SIZE. Every page returns exactly 100 entries while results remain, and a
 * page past the end returns 0 with a plain HTTP 200. A short page (< PAGE_SIZE)
 * ends that keyword's pagination — same convention senjob.mjs uses.
 *
 * SSRF: every fetched URL is asserted against TRUSTED_HOST over HTTPS
 * (assertJobBankUrl) before it goes out, with `redirect: 'error'`.
 *
 * Used by the jobbankca adapter (server/lib/portals/adapters/jobbankca.mjs).
 */
import { fetchText, BROWSER_LIKE_USER_AGENT, delay } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
import { PATHS } from '../paths.mjs';
import { existsSync, readFileSync } from 'node:fs';
// NOTE: `js-yaml` is loaded lazily inside resolveProfileKeywords (below), NOT at
// module top level. The registry enumerates every source with a bare `import()`
// to read its `meta` — that runs in environments without the repo-root
// node_modules (the cvstart.org Pages build only `npm ci`s in site/). A
// top-level `import 'js-yaml'` there throws, the registry silently drops this
// source, and the landing's source count falls out of sync with the app
// (v1.212.0 shipped 80 on the site vs 81 everywhere else). Keep source modules
// import-safe with only node: builtins + relative modules; defer third-party
// deps to call time. Guarded by tests/site-sources.test.mjs + the sync-assets
// file-count-vs-registry assertion.

const FEED_URL = 'https://www.jobbank.gc.ca/jobsearch/feed/jobSearchRSSfeed';
export { FEED_URL };
const TRUSTED_HOST = 'www.jobbank.gc.ca';

/** Measured page size; a short page (< this) is the end of that keyword's results. */
const PAGE_SIZE = 100;
/** Pages per keyword; 5 covers a common keyword (~500 postings) with room to spare. */
const DEFAULT_MAX_PAGES = 5;
/** Hard ceiling on a configured `max_pages`, so one entry cannot sweep forever. */
const MAX_PAGES_CAP = 20;
/** robots.txt: `Crawl-delay: 5`. Applied between every request, including the first. */
const INTER_REQUEST_DELAY_MS = 5000;

// Job Bank is bilingual (English/French); flag remote from either language.
const REMOTE_RE = /\b(remote|telework|t[eé]l[eé]travail|work[-\s]?from[-\s]?home|home[-\s]?based)\b/i;

export const meta = {
  value: 'jobbankca',
  label: 'Job Bank (Canada)',
  region: 'en',
};

// ── tiny stable hash (djb2) → base36, for a URL with no numeric posting id ──
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/**
 * Read + sanitize the entry's `jobbankca:` config block.
 * @param {{ jobbankca?: any }} entry
 * @returns {{ keywords: string[] }}
 */
export function parseJobBankConfig(entry) {
  const cfg = (entry && entry.jobbankca) || {};
  const keywords = [...new Set(
    (Array.isArray(cfg.keywords) ? cfg.keywords : [])
      .filter((k) => typeof k === 'string' && k.trim())
      .map((k) => k.trim()),
  )];
  return { keywords };
}

/**
 * Extract candidate search keywords from a parsed profile.yml's `target_roles`
 * block: `primary[]` plus `archetypes[].name`. Pure — exported for tests.
 * @param {any} profile
 * @returns {string[]}
 */
export function profileTargetKeywords(profile) {
  const roles = profile && profile.target_roles;
  if (!roles || typeof roles !== 'object') return [];
  return [...new Set(
    [
      ...(Array.isArray(roles.primary) ? roles.primary : []),
      ...(Array.isArray(roles.archetypes) ? roles.archetypes.map((a) => a && a.name) : []),
    ]
      .filter((k) => typeof k === 'string')
      .map((k) => k.trim())
      .filter(Boolean),
  )];
}

/**
 * Read config/profile.yml (if present) and return its target-role keywords.
 * Fails open (empty array) on a missing/unparseable file — a convenience
 * fallback, never a hard requirement, so it must never throw. Async because
 * js-yaml is imported lazily (see the top-of-file note) — it loads at scan time
 * on the server, where the dep is installed, not at module-import time.
 * @param {string} [profilePath]
 * @returns {Promise<string[]>}
 */
export async function resolveProfileKeywords(profilePath = PATHS.profile) {
  if (!profilePath || !existsSync(profilePath)) return [];
  try {
    const yaml = await import('js-yaml');
    const profile = yaml.load(readFileSync(profilePath, 'utf8')) || {};
    return profileTargetKeywords(profile);
  } catch {
    return [];
  }
}

/** @param {string} keyword @param {number} page */
export function buildFeedUrl(keyword, page) {
  const params = new URLSearchParams({ searchstring: keyword, locationstring: '', page: String(page) });
  return `${FEED_URL}?${params.toString()}`;
}

/**
 * Assert that `url` points to Job Bank (www.jobbank.gc.ca) over HTTPS. Throws on
 * failure — closes the SSRF vector on every fetched URL.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertJobBankUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`jobbankca: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`jobbankca: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`jobbankca: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

/** ISO datetime → YYYY-MM-DD (empty string when unparseable). */
function toIsoDate(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString().slice(0, 10);
}

// Resolve an Atom element's inner text: unwrap CDATA, else decode entities.
function extractText(inner) {
  const cdata = inner.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdata) return cdata[1].trim();
  return decodeEntities(inner).trim();
}

function tagText(block, tag) {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? extractText(m[1]) : '';
}

// <link rel="alternate" type="text/html" href="..."/> — an attribute here, not
// inner text (Atom), unlike an RSS <link>text</link>. An Atom entry may carry
// several <link> elements (e.g. a "self" link alongside "alternate"); the
// human-facing posting page is specifically the "alternate" one, so it is
// preferred over whichever <link> happens to come first.
//
// Attributes are tokenized sequentially with a global regex (`attrsOf`) rather
// than searched for with a standalone `rel=`/`href=` pattern. A standalone
// pattern scans the ENTIRE tag text, including the inside of other attributes'
// quoted values — so a same-host attack tag like
// `<link data=" rel='alternate' href='.../WRONG'" rel="self" href="REAL"/>`
// has a `rel='alternate' href='...'` substring inside `data="..."` preceded by
// whitespace exactly like a real attribute, defeating even a precisely
// word-boundary-anchored pattern. Sequential tokenization can't make this
// mistake because each match consumes a full `name="value"` pair before the
// next match starts, so a quoted value's contents are never re-scanned.
function attrsOf(tag) {
  const attrs = {};
  const re = /([a-zA-Z_:][-\w:.]*)\s*=\s*(["'])((?:(?!\2)[\s\S])*)\2/g;
  let m;
  while ((m = re.exec(tag))) attrs[m[1].toLowerCase()] = m[3];
  return attrs;
}

function linkHref(block) {
  const links = (block.match(/<link(?=[\s/>])[^>]*>/gi) || []).map(attrsOf);
  const alternate = links.find((a) => (a.rel || '').toLowerCase() === 'alternate') || links[0];
  return alternate && alternate.href ? decodeEntities(alternate.href).trim() : '';
}

function cleanUrl(value) {
  if (!value) return '';
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' && parsed.hostname === TRUSTED_HOST ? parsed.href : '';
  } catch {
    return '';
  }
}

// The summary embeds Location/Employer/Salary as labeled HTML inside one CDATA
// block rather than as separate Atom elements, e.g.:
//   <strong>Job number:</strong> 123<br /><strong>Location:</strong> Vancouver
//   (BC)<br /><strong>Employer:</strong> Acme Inc<br /><strong>Salary:</strong>
//   $100,000.00 annually
// Each label is extracted independently.
//
// Strips HTML tags to a bare fixed point, not one regex pass: a single
// `.replace(/<[^>]+>/g, '')` call can leave a residual tag-shaped fragment
// behind when the source nests malformed brackets. This is a government feed,
// but the summary text still originates from a third-party employer's posting
// content, so it is not trusted input. Looping until a pass changes nothing
// closes that gap without needing a real HTML parser for a few plain-text labels.
function stripTags(s) {
  let prev;
  let out = s;
  do {
    prev = out;
    out = out.replace(/<[^>]+>/g, '');
  } while (out !== prev);
  // A malformed/nested bracket construct (`<<a>b>`) can leave a lone `>` (or,
  // symmetrically, a lone `<`) behind even at fixed point: the loop only ever
  // removes a COMPLETE `<...>` span. Neither field this feeds is meant to carry
  // markup, so any remaining bracket — paired or not — is simply dropped.
  return out.replace(/[<>]/g, '');
}

function summaryField(summaryHtml, label) {
  const re = new RegExp(`<strong>${label}:</strong>\\s*([\\s\\S]*?)\\s*(?:<br\\s*/?>|$)`, 'i');
  const m = summaryHtml.match(re);
  return m ? stripTags(decodeEntities(m[1])).trim() : '';
}

/** Numeric posting id from the URL path, else a stable djb2(url). */
function jobPostingId(url) {
  const m = String(url).match(/\/jobposting\/(\d+)/i);
  return m ? m[1] : djb2(url);
}

/**
 * Parse Job Bank's public Atom feed into the web-ui rich job shape. Exported
 * for unit tests. The `<link rel="alternate">` (host-pinned) is the identity;
 * entries without a usable https jobbank.gc.ca URL or a title are dropped.
 * @param {string} xml
 * @returns {import('../../../types.mjs').Job[]}
 */
export function parseAtomFeed(xml) {
  const jobs = [];
  const entries = String(xml ?? '').match(/<entry\b[^>]*>[\s\S]*?<\/entry>/gi) || [];

  for (const entry of entries) {
    const url = cleanUrl(linkHref(entry));
    if (!url) continue;

    const title = tagText(entry, 'title');
    if (!title) continue;

    const summaryRaw = tagText(entry, 'summary');
    const company = summaryField(summaryRaw, 'Employer');
    const location = summaryField(summaryRaw, 'Location');
    const salary = summaryField(summaryRaw, 'Salary');

    const haystack = `${title} ${location}`;
    const isRemote = REMOTE_RE.test(haystack);

    jobs.push({
      id: `jobbankca-${jobPostingId(url)}`,
      title,
      company,
      url,
      salary,
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : 'Onsite',
      relocates: false,
      date: toIsoDate(tagText(entry, 'updated')),
      snippet: '',
      source: 'jobbankca',
    });
  }

  return jobs;
}

/**
 * Fetch + normalize Job Bank postings across the configured keywords.
 * @param {string} feedUrl base feed endpoint (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           maxPages?: number, delayMs?: number, profileKeywords?: string[] }} [opts]
 */
export async function fetchJobBankCa(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  // Defence-in-depth: reject an off-host endpoint override before any fetch.
  assertJobBankUrl(feedUrl);

  let { keywords } = parseJobBankConfig(company);
  // Fall back to config/profile.yml's target_roles when this entry has no
  // jobbankca.keywords[] of its own — same convention vdab.mjs's parent uses.
  // `opts.profileKeywords` is an injectable override (tests avoid the FS).
  if (!keywords.length) {
    keywords = Array.isArray(opts.profileKeywords) ? opts.profileKeywords : await resolveProfileKeywords();
  }
  if (!keywords.length) {
    throw new Error(`jobbankca: entry "${company.name || '(unnamed)'}" has no jobbankca.keywords[] and no config/profile.yml target_roles to fall back to`);
  }

  const entryMaxPages = Number.isInteger(company.max_pages) && company.max_pages > 0
    ? Math.min(company.max_pages, MAX_PAGES_CAP)
    : DEFAULT_MAX_PAGES;
  const maxPages = Math.min(
    entryMaxPages,
    Number.isInteger(opts.maxPages) && opts.maxPages > 0 ? opts.maxPages : Infinity,
  );

  const delayMs = Number.isFinite(opts.delayMs) ? opts.delayMs : INTER_REQUEST_DELAY_MS;

  const byUrl = new Map();
  const errors = [];
  let succeeded = 0;

  for (const keyword of keywords) {
    let keywordFailed = false;
    for (let page = 1; page <= maxPages; page++) {
      await delay(delayMs, signal);

      const url = assertJobBankUrl(buildFeedUrl(keyword, page));
      let xml;
      try {
        xml = await fetchText(fetchImpl, url, {
          signal,
          redirect: 'error',
          headers: { 'User-Agent': BROWSER_LIKE_USER_AGENT, accept: 'application/atom+xml, application/xml, text/xml' },
        });
      } catch (err) {
        // Only a page-1 failure means the keyword's request failed outright; a
        // later page failing just ends this keyword's pagination early.
        if (page === 1) {
          keywordFailed = true;
          errors.push(`"${keyword}": ${(err && err.message) || err}`);
        }
        break;
      }

      const parsed = parseAtomFeed(xml);
      for (const job of parsed) {
        if (!byUrl.has(job.url)) byUrl.set(job.url, job);
      }
      if (parsed.length < PAGE_SIZE) break; // short page — end of this keyword's results
    }
    if (!keywordFailed) succeeded++;
  }

  // Total outage = every keyword's first request failed. A keyword that
  // answered with zero results is not an outage — recall-first, same as
  // arbeitsagentur.mjs.
  if (succeeded === 0 && errors.length) {
    throw new Error(`jobbankca: all ${keywords.length} keyword request(s) failed — ${errors[0]}`);
  }

  return [...byUrl.values()];
}
