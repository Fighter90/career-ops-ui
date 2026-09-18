// @ts-check
/**
 * Generalist World source — the curated board of generalist / operator roles
 * (chief of staff, founder's associate, ops lead, "first business hire") at
 * https://generalist.world/jobs/.
 *
 * Ported from parent career-ops `providers/generalist-world.mjs` (final
 * behaviour, including #4264 "match inner class tokens and fail loud on
 * unusable cards"), re-shaped to the web-ui source contract: a `meta` export
 * for registry auto-discovery, pure exported parsers the tests drive with no
 * network, an injected `fetchImpl`, and the 12-field web-ui job object.
 *
 * ── The page ─────────────────────────────────────────────────────────────
 * One server-rendered WordPress page: a single plain GET returns every open
 * posting (138 cards / ~300 KB when the parent wrote this, 2026-09) — no
 * pagination, no JSON API, no auth. Each posting is one anchor:
 *
 *   <a class="gw-job-card" data-type="connector" data-region="remote"
 *      href="/jobs/{slug}/">
 *     <div class="gw-job-company">ExampleCo</div>
 *     <div class="gw-job-title">Chief of Staff</div>
 *     <p class="gw-job-description">One-paragraph teaser.</p>
 *     <span class="gw-job-meta-tag gw-salary">£70k–£85k</span>
 *     <span class="gw-job-meta-tag gw-location">Remote (UK)</span>
 *   </a>
 *
 * Field mapping: title / company / location straight off the card, with the
 * anchor's `data-region` as the location fallback; a card missing its title or
 * its employer is skipped (a listing has to be attributable to an identifiable
 * employer). The teaser is in the list payload, so `snippet` costs no extra
 * request. `job.url` is the board's own /jobs/{slug}/ page: the list page
 * carries no employer link, and fetching 100+ detail pages per scan would
 * break the zero-token rule. The "Featured" block at the top reuses the same
 * card markup and is parsed with the rest; URLs are deduped, so a card
 * rendered twice counts once.
 *
 * Divergence from the parent, deliberate: the parent drops the free-text
 * `gw-salary` tag because its Job.salary carries structured figures. web-ui's
 * `salary` is a DISPLAY STRING (see 4dayweek / builtin), so the tag is carried
 * through verbatim instead of being thrown away.
 *
 * No posted date is exposed at list level, so `date` is always '' — these rows
 * are exempt from the scanner's age filter rather than carrying a fabricated
 * date. `workplaceType` is only ever 'Remote' or '': the board publishes no
 * onsite signal, and guessing 'Onsite' would be an invention.
 *
 * ── Failing loud ─────────────────────────────────────────────────────────
 * A scraped board that answers "0 jobs" after a redesign is worse than one
 * that errors: the scan looks healthy forever. So {@link parseGeneralistWorldJobs}
 * throws when the page carries neither cards nor the listing container, AND
 * when card anchors matched but not one of them yielded a usable job (the
 * anchors are still there, an inner field moved). Same policy as garena's
 * "unexpected API response". An alive-but-empty board — the listing container
 * present, zero cards — still returns [].
 */
import { fetchText } from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';

export const meta = {
  value: 'generalist-world',
  label: 'Generalist World',
  region: 'en',
};

const UA = 'career-ops-web-ui/1.0';

export const SITE_ORIGIN = 'https://generalist.world';
export const LIST_URL = `${SITE_ORIGIN}/jobs/`;

/**
 * SSRF host pin. ANCHORED at both ends, so `generalist.world.evil.test` and
 * `evil.test/generalist.world` are both refused; `www.` is the board's own
 * alias and is the only accepted prefix.
 */
export const GENERALIST_WORLD_HOST_RE = /^(?:www\.)?generalist\.world$/i;

/**
 * Validate a Generalist World URL: HTTPS-only, host pinned by the anchored
 * regex above. Throws with a message naming the offending value.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertGeneralistWorldUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`generalist-world: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`generalist-world: URL must use HTTPS: ${url}`);
  }
  if (!GENERALIST_WORLD_HOST_RE.test(parsed.hostname)) {
    throw new Error(
      `generalist-world: untrusted hostname "${parsed.hostname}" — must be generalist.world`,
    );
  }
  return url;
}

// One card = one anchor whose class list carries the gw-job-card token (a
// whole token: gw-job-card-top is a child div, not a card). Cards never nest
// another <a>, so the lazy match ends at the card's own closing tag.
// The captured attribute string starts at the tag's first whitespace, so
// every attribute name is preceded by whitespace (a `\b` alone would also
// match the tail of data-class= / data-href=); class tokens are matched whole.
const CARD_SRC = '<a(\\s(?:[^>]*?\\s)?class="(?:[^"]*\\s)?gw-job-card(?:\\s[^"]*)?"[^>]*)>([\\s\\S]*?)<\\/a>';
const CARDS_RE = new RegExp(CARD_SRC, 'g');
const ONE_CARD_RE = new RegExp(CARD_SRC);
const HREF_RE = /\shref="([^"]*)"/;
const REGION_RE = /\sdata-region="([^"]*)"/;
// Inner fields: same whole-token rule as the card itself, so an extra class on
// the element (a class attribute is a token list) does not drop the field —
// parent #4264. A near-miss class (gw-job-title-small) still does not count.
const TITLE_RE = /<div\s(?:[^>]*?\s)?class="(?:[^"]*\s)?gw-job-title(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/div>/;
const COMPANY_RE = /<div\s(?:[^>]*?\s)?class="(?:[^"]*\s)?gw-job-company(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/div>/;
const LOCATION_RE = /<span\s(?:[^>]*?\s)?class="(?:[^"]*\s)?gw-location(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/span>/;
const SALARY_RE = /<span\s(?:[^>]*?\s)?class="(?:[^"]*\s)?gw-salary(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/span>/;
const DESCRIPTION_RE = /<p\s(?:[^>]*?\s)?class="(?:[^"]*\s)?gw-job-description(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/p>/;
// The listing container, `<div class="gw-jobs-section" data-jobs-container>`.
// It is part of the page template, so it is present even when nothing is
// posted; that separates "alive, empty board" from "not the page this parser
// knows". Matched as an opening tag carrying the class token or the
// attribute, so the words appearing in text, CSS or script do not count.
const BOARD_MARKER_RE = /<[a-zA-Z][^\s>]*\s(?:[^>]*?\s)?(?:class="(?:[^"]*\s)?gw-jobs-section(?:\s[^"]*)?"|data-jobs-container(?=[\s>\/=]))[^>]*>/;

// Content the browser never renders as markup: comments, the raw-text
// elements (script, style, textarea) and inert <template> subtrees. A
// tag-shaped literal inside one (a JS or theme template, a CSS content:
// string, a commented-out block) must neither produce a job nor count as
// the listing container, so these are removed before either match. The
// walk goes tag by tag the way the HTML tokenizer does, so a marker inside
// a quoted attribute value (`data-copy="<template>"`) belongs to that
// attribute and never opens or closes anything. On the live page the
// removed blocks hold only inlined CSS and analytics (about 120 KB of the
// 300 KB response) and no card markup.
const TAG_START_RE = /<(\/?)([a-zA-Z][^\s/>]*)/y;
const RAW_TEXT_END = new Map([
  ['script', /<\/script(?=[\s/>])[^>]*>/gi],
  ['style', /<\/style(?=[\s/>])[^>]*>/gi],
  ['textarea', /<\/textarea(?=[\s/>])[^>]*>/gi],
]);
const TAG_WHITESPACE = ' \t\n\r\f';
// Every sequence the tokenizer accepts as the end of a comment: `-->`, the
// incorrectly closed `--!>`, and the abrupt `<!-->` / `<!--->` (searched
// from just after `<!` so the opener's own dashes count).
const COMMENT_END_RE = /--!?>/g;

/**
 * Index just past the `>` that ends the tag whose name ends at `from`.
 * Quotes delimit a value only after `=`, as in the tokenizer's attribute
 * states, so a stray quote inside an attribute name cannot swallow the
 * rest of the page. An unterminated tag runs to the end of the document.
 * @param {string} html
 * @param {number} from
 */
function tagEnd(html, from) {
  let quote = '';
  let afterEquals = false;
  for (let i = from; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '>') {
      return i + 1;
    } else if (ch === '=') {
      afterEquals = true;
    } else if ((ch === '"' || ch === "'") && afterEquals) {
      quote = ch;
      afterEquals = false;
    } else if (!TAG_WHITESPACE.includes(ch)) {
      afterEquals = false;
    }
  }
  return html.length;
}

/**
 * Drop comments, raw-text elements and <template> subtrees (nested ones
 * included: template content is parsed markup, unlike script or style).
 * Raw text ends at the element's own closing tag wherever it appears, as in
 * a browser; a stray </template> is ignored; an unclosed comment, raw-text
 * element or template swallows the rest of the document, which is the
 * conservative reading. Exported for tests.
 * @param {string} html
 * @returns {string}
 */
export function stripNonRendered(html) {
  let out = '';
  let kept = 0; // start of the rendered run not yet copied to `out`
  let depth = 0; // open <template> elements
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) break;
    let stop; // index just past this construct
    let drop = false;
    if (html.startsWith('<!--', lt)) {
      COMMENT_END_RE.lastIndex = lt + 2;
      const end = COMMENT_END_RE.exec(html);
      stop = end ? end.index + end[0].length : html.length;
      drop = true;
    } else {
      TAG_START_RE.lastIndex = lt;
      const tag = TAG_START_RE.exec(html);
      if (!tag) {
        i = lt + 1;
        continue;
      }
      const closing = tag[1] === '/';
      const name = tag[2].toLowerCase();
      stop = tagEnd(html, TAG_START_RE.lastIndex);
      const rawEnd = closing ? undefined : RAW_TEXT_END.get(name);
      if (rawEnd) {
        rawEnd.lastIndex = stop;
        const end = rawEnd.exec(html);
        stop = end ? end.index + end[0].length : html.length;
        drop = true;
      } else if (name === 'template') {
        if (!closing) {
          if (depth === 0) out += html.slice(kept, lt);
          depth++;
        } else if (depth > 0) {
          depth--;
          if (depth === 0) kept = stop;
        }
      }
    }
    if (drop && depth === 0) {
      out += `${html.slice(kept, lt)} `;
      kept = stop;
    }
    i = stop;
  }
  if (depth === 0) out += html.slice(kept);
  return out;
}

// The href is host-controlled and becomes a URL path segment, so it is held
// to a strict slug charset instead of being encoded: anything that is not
// /jobs/{slug}/ on this host (another origin, a query string, a traversal
// segment) drops just that card.
const SLUG_PATH_RE = /^\/jobs\/([A-Za-z0-9][A-Za-z0-9._~-]*)\/?$/;

/**
 * Human label for the card's data-region attribute, used only when the card
 * carries no gw-location tag. Known values on the live board: remote, uk,
 * eu, us.
 * @param {unknown} code
 */
function regionLabel(code) {
  if (typeof code !== 'string') return '';
  const c = code.trim().toLowerCase();
  if (!c) return '';
  return c === 'remote' ? 'Remote' : c.replace(/[-_]+/g, ' ').toUpperCase();
}

/**
 * Resolve a card href to the posting SLUG, or null when the href is not a
 * /jobs/{slug}/ path on this host (site-relative, or absolute on
 * generalist.world over https with no query/fragment).
 * @param {unknown} href
 * @returns {string | null}
 */
function resolveSlug(href) {
  if (typeof href !== 'string') return null;
  let path = href.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
    // Absolute (or scheme-relative-looking) href: only https on the trusted
    // host, with no query or fragment, is taken as a posting page.
    let parsed;
    try {
      parsed = new URL(path);
    } catch {
      return null;
    }
    if (parsed.protocol !== 'https:') return null;
    if (!GENERALIST_WORLD_HOST_RE.test(parsed.hostname)) return null;
    if (parsed.search || parsed.hash) return null;
    path = parsed.pathname;
  }
  const m = SLUG_PATH_RE.exec(path);
  return m ? m[1] : null;
}

/**
 * Resolve a card href to the canonical posting URL, or null when it is not a
 * /jobs/{slug}/ path (site-relative, or absolute on generalist.world).
 * Exported for tests.
 * @param {unknown} href
 * @returns {string | null}
 */
export function resolveGeneralistWorldUrl(href) {
  const slug = resolveSlug(href);
  if (slug === null) return null;
  // The slug charset above is pure ASCII, so this can only be the identity —
  // but the encode is the contract for a host-controlled value reaching a URL
  // path segment, and a null return drops just this card instead of a URIError
  // unwinding the whole page's parse loop.
  const encoded = safeEncodeURIComponent(slug);
  if (encoded === null) return null;
  return `${SITE_ORIGIN}/jobs/${encoded}/`;
}

/**
 * @param {string} attrs  the card anchor's attribute string
 * @param {string} inner  the card anchor's inner HTML
 * @returns {object | null} a 12-field web-ui job, or null for an unusable card
 */
function cardToJob(attrs, inner) {
  const href = HREF_RE.exec(attrs)?.[1];
  const slug = resolveSlug(href);
  if (slug === null) return null;
  const url = resolveGeneralistWorldUrl(href);
  if (!url) return null;

  const title = htmlToText(TITLE_RE.exec(inner)?.[1]);
  if (!title) return null;
  // A board listing has to be attributed to an identifiable employer; every
  // live card carries one, so a card without it is malformed, not a posting.
  const company = htmlToText(COMPANY_RE.exec(inner)?.[1]);
  if (!company) return null;

  const regionCode = (REGION_RE.exec(attrs)?.[1] || '').trim().toLowerCase();
  const location = htmlToText(LOCATION_RE.exec(inner)?.[1]) || regionLabel(regionCode);
  const isRemote = regionCode === 'remote' || /remote/i.test(location);
  const description = htmlToText(DESCRIPTION_RE.exec(inner)?.[1]);

  return {
    id: `generalist-world-${slug}`,
    title,
    company,
    url,
    // Free text on this board ("$1,500/mo retainer + equity"); web-ui's salary
    // field is a display string, so it is carried through as written.
    salary: htmlToText(SALARY_RE.exec(inner)?.[1]),
    location,
    isRemote,
    // The board publishes no onsite signal — '' rather than a guessed 'Onsite'.
    workplaceType: isRemote ? 'Remote' : '',
    relocates: false,
    date: '', // no list-level posting date — exempt from the age filter
    snippet: description.slice(0, 400),
    source: 'generalist-world',
  };
}

/**
 * Normalize one `<a class="gw-job-card" …>…</a>` fragment into the web-ui job
 * shape, or null when it is not a card or lacks a usable title, employer or
 * link. Exported for tests.
 * @param {unknown} cardHtml
 * @returns {object | null}
 */
export function normalizeGeneralistWorldCard(cardHtml) {
  if (typeof cardHtml !== 'string') return null;
  const m = ONE_CARD_RE.exec(cardHtml);
  return m ? cardToJob(m[1], m[2]) : null;
}

/**
 * Parse the board page. Comments, script, style, textarea and template blocks
 * are dropped first. An empty body, or a page that still carries the listing
 * container but no cards, is an alive-but-empty board and yields [].
 *
 * A body with neither throws, and so does one whose cards all fail to yield a
 * job (the anchors match but an inner field moved) — parent #4264 — so a
 * redesign or a challenge page surfaces as an error instead of a board that
 * quietly reads 0 forever. A malformed card among usable ones is still just
 * skipped. Exported for tests.
 * @param {unknown} html
 * @returns {object[]}
 */
export function parseGeneralistWorldJobs(html) {
  if (typeof html !== 'string' || !html.trim()) return [];
  const rendered = stripNonRendered(html);
  const jobs = [];
  const seen = new Set();
  let cards = 0;
  for (const m of rendered.matchAll(CARDS_RE)) {
    cards++;
    const job = cardToJob(m[1], m[2]);
    if (!job || seen.has(job.url)) continue;
    seen.add(job.url);
    jobs.push(job);
  }
  if (jobs.length === 0 && cards > 0) {
    throw new Error(
      `generalist-world: ${cards} gw-job-card anchor(s) matched but none carried a usable title, employer and /jobs/{slug}/ link; the card markup likely changed`,
    );
  }
  if (jobs.length === 0 && !BOARD_MARKER_RE.test(rendered)) {
    throw new Error(
      'generalist-world: no gw-job-card anchors and no listing container in the response; the page structure likely changed',
    );
  }
  return jobs;
}

/**
 * Fetch + normalize the Generalist World board — one plain GET, no pagination.
 *
 * The endpoint is host-checked BEFORE the request, so a config-supplied URL on
 * another origin never reaches the network. `redirect: 'error'` (fetchText's
 * default, passed explicitly here) refuses a server-side redirect off the host.
 * `fetchImpl` is always the injected one — this module never calls global
 * fetch directly.
 *
 * @param {string} [url] from buildEndpoint; defaults to the canonical list URL
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchGeneralistWorld(url = LIST_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  const target = assertGeneralistWorldUrl(url || LIST_URL);

  const html = await fetchText(fetchImpl, target, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });

  return parseGeneralistWorldJobs(html);
}
