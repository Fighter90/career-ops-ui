/**
 * jd-parse.mjs — read a JD out of a posting page's own bytes when no ATS API
 * covers the host (CAR-262, the parent's lib/jd-parse.mjs + the pure half of
 * lib/jd-page-fetch.mjs).
 *
 * Template-driven career sites (Phenom, most bespoke ones) render the job body
 * from <script> data: the page ships a schema.org JobPosting in
 * `application/ld+json`, and the visible HTML is title, location and Apply
 * chrome. Anything that converts the page to text drops script content, so it
 * sees ~270 characters and reports "partial page shell" — the auto-pipeline
 * then rejects a live posting as "JD too short" before the LLM call.
 *
 * Pure module: no I/O, no network. Every function takes the ALREADY-DOWNLOADED
 * HTML (the route fetches it through safeGet, whose DNS-pinned transport IS
 * the egress guard). Four guards keep a wrong JD from reaching the evaluate
 * step, which trusts what it is handed:
 *   - a page holding more than one DISTINCT posting is a listing — a miss,
 *     never the longest description on it;
 *   - a single posting whose own URL names a different job than the requested
 *     one is that other job's — a miss;
 *   - a posting whose `validThrough` is past returns closure evidence instead
 *     of a JD, so a dead posting is refused, not scored;
 *   - anything below MIN_PAGE_JD_WORDS words is a stub, not a posting.
 *
 * Every scan below is a forward indexOf pass, so hostile input (millions of
 * `<`, `<!--` or unclosed `<script`) costs linear time, never the quadratic
 * backtracking a lazy regex would.
 */

/** Lowercase A-Z only: String#toLowerCase can change the length (U+0130), which would misalign indexOf offsets with the source. */
export const asciiLower = (s) => String(s).replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));

export const wordCount = (t) => String(t).split(/\s+/).filter(Boolean).length;

/** Same floor the parent's page reader uses: below it the "JD" is a stub, not a posting. */
export const MIN_PAGE_JD_WORDS = 80;

const HTML_ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'",
  '#160': ' ', '#xa0': ' ', '#x27': "'", '#38': '&', mdash: '—', ndash: '–',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…',
};

/** Latin-1 named references (U+00A1-U+00FF), case-sensitive: `&Eacute;` and `&eacute;` differ. nbsp stays a plain space. */
export const LATIN1_ENTITIES = Object.fromEntries(Object.entries({ AElig: 0xc6, Aacute: 0xc1, Acirc: 0xc2, Agrave: 0xc0, Aring: 0xc5, Atilde: 0xc3, Auml: 0xc4, Ccedil: 0xc7, ETH: 0xd0, Eacute: 0xc9, Ecirc: 0xca, Egrave: 0xc8, Euml: 0xcb, Iacute: 0xcd, Icirc: 0xce, Igrave: 0xcc, Iuml: 0xcf, Ntilde: 0xd1, Oacute: 0xd3, Ocirc: 0xd4, Ograve: 0xd2, Oslash: 0xd8, Otilde: 0xd5, Ouml: 0xd6, THORN: 0xde, Uacute: 0xda, Ucirc: 0xdb, Ugrave: 0xd9, Uuml: 0xdc, Yacute: 0xdd, aacute: 0xe1, acirc: 0xe2, acute: 0xb4, aelig: 0xe6, agrave: 0xe0, aring: 0xe5, atilde: 0xe3, auml: 0xe4, brvbar: 0xa6, ccedil: 0xe7, cedil: 0xb8, cent: 0xa2, copy: 0xa9, curren: 0xa4, deg: 0xb0, divide: 0xf7, eacute: 0xe9, ecirc: 0xea, egrave: 0xe8, eth: 0xf0, euml: 0xeb, frac12: 0xbd, frac14: 0xbc, frac34: 0xbe, iacute: 0xed, icirc: 0xee, iexcl: 0xa1, igrave: 0xec, iquest: 0xbf, iuml: 0xef, laquo: 0xab, macr: 0xaf, micro: 0xb5, middot: 0xb7, nbsp: 0xa0, not: 0xac, ntilde: 0xf1, oacute: 0xf3, ocirc: 0xf4, ograve: 0xf2, ordf: 0xaa, ordm: 0xba, oslash: 0xf8, otilde: 0xf5, ouml: 0xf6, para: 0xb6, plusmn: 0xb1, pound: 0xa3, raquo: 0xbb, reg: 0xae, sect: 0xa7, shy: 0xad, sup1: 0xb9, sup2: 0xb2, sup3: 0xb3, szlig: 0xdf, thorn: 0xfe, times: 0xd7, uacute: 0xfa, ucirc: 0xfb, ugrave: 0xf9, uml: 0xa8, uuml: 0xfc, yacute: 0xfd, yen: 0xa5, yuml: 0xff }).filter(([n]) => n !== 'nbsp').map(([n, cp]) => [n, String.fromCodePoint(cp)]));

// An entity-escaped tag: `&lt;p&gt;`, `&lt;/p&gt;`, `&lt;br /&gt;`, `&lt;a href=&quot;x&quot;&gt;`.
// Known tags only, and attributes must be name=value pairs (see htmlToText).
const ESCAPED_TAG_NAMES = 'p|br|hr|div|span|b|i|u|em|strong|ul|ol|li|h[1-6]|a|table|thead|tbody|tr|td|th|section|article|blockquote|font|sup|sub|pre|code|small|big';
// `&amp;` is the one entity that legitimately sits inside a quoted value (a URL's
// query string), so it is allowed there while any other `&` keeps the prose guard.
const ESCAPED_ATTR = String.raw`\s+[a-z_:][\w:.-]*=(?:"(?:[^"<>&]|&amp;)*"|'(?:[^'<>&]|&amp;)*'|&quot;(?:[^<>&]|&amp;)*?&quot;|[^\s"'<>&=]+)`;
const ESCAPED_TAG_RE = new RegExp(String.raw`&lt;(/?(?:${ESCAPED_TAG_NAMES}))((?:${ESCAPED_ATTR})*)\s*/?&gt;`, 'gi');

// `&#99999999;` is out of range and String.fromCodePoint throws on it, which
// aborted the whole extraction. An entity that is not a real code point is not
// decodable, so it reads as a space.
function codePointOrSpace(cp) {
  return Number.isInteger(cp) && cp >= 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff)
    ? String.fromCodePoint(cp)
    : ' ';
}

/** Strip HTML to visible text, matching the pipeline's own normalization. */
function htmlToText(html) {
  // Some boards (Phenom) ship the JobPosting description as entity-ESCAPED
  // markup (`&lt;div&gt;&lt;p&gt;…`). The tag strip cannot see those as tags,
  // and the entity pass then turns them back into literal `<div><p>` in the
  // JD. Unescape the tags, and ONLY the tags: a global `&lt;`/`&gt;` replace
  // would also decode prose like `latency &lt; 50 ms`, and the strip would
  // then eat the prose up to the next `>`.
  const markup = String(html ?? '').replace(
    ESCAPED_TAG_RE,
    (_m, name, attrs) => `<${name}${String(attrs).replace(/&quot;/gi, '"')}>`,
  );
  return stripMarkup(markup)
    .replace(/&([a-z]+|#x?[0-9a-f]+);/gi, (m, e) => {
      if (Object.hasOwn(LATIN1_ENTITIES, e)) return LATIN1_ENTITIES[e];
      const k = e.toLowerCase();
      if (Object.hasOwn(HTML_ENTITIES, k)) return HTML_ENTITIES[k];
      const dec = /^#(\d+)$/.exec(k);
      if (dec) return codePointOrSpace(Number(dec[1]));
      const hex = /^#x([0-9a-f]+)$/.exec(k);
      if (hex) return codePointOrSpace(parseInt(hex[1], 16));
      return ' ';
    })
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
}

const BLOCK_END_TAG = /^\/(p|div|li|h[1-6]|tr|section|article)$/;

/**
 * Remove `<script>`/`<style>` elements and every tag, in one forward pass.
 * Block-closing tags and `<br>` become line breaks so requirement lists do not
 * run together into one paragraph.
 */
function stripMarkup(markup) {
  const src = String(markup);
  const lower = asciiLower(src);
  const out = [];
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt === -1) { out.push(src.slice(i)); break; }
    out.push(src.slice(i, lt));
    const gt = src.indexOf('>', lt + 1);
    if (gt === -1) { out.push(src.slice(lt)); break; }
    const name = /^\/?[a-z][a-z0-9]*|^br(?=[\s/])/.exec(lower.slice(lt + 1, lt + 12))?.[0] ?? '';
    if (name === 'script' || name === 'style') {
      const close = lower.indexOf(`</${name}`, gt + 1);
      const closeGt = close === -1 ? -1 : src.indexOf('>', close);
      if (closeGt === -1) { out.push(' '); break; } // unclosed: the rest is script/style payload, not text
      out.push(' ');
      i = closeGt + 1;
      continue;
    }
    out.push(name === 'br' || BLOCK_END_TAG.test(name) ? '\n' : ' ');
    i = gt + 1;
  }
  return out.join('');
}

/**
 * End of an opening tag, skipping any `>` inside a quoted attribute value.
 * Bounded to 4 KB so an unmatched quote cannot make every later `<script`
 * rescan the page.
 */
function scriptTagEnd(src, start) {
  let quote = '';
  const stop = Math.min(src.length, start + 4096);
  for (let i = start; i < stop; i += 1) {
    const ch = src[i];
    if (quote) { if (ch === quote) quote = ''; }
    else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '>') return i;
  }
  return -1;
}

/**
 * Contents of every `<script type="application/ld+json">` block, found with
 * forward indexOf scans only.
 *
 * @param {string} html
 * @returns {string[]}
 */
export function ldJsonBlocks(html) {
  const src = String(html ?? '');
  const lower = asciiLower(src);
  const blocks = [];
  let i = 0;
  let nextGt = -2;
  for (;;) {
    const start = lower.indexOf('<script', i);
    if (start === -1) break;
    if (nextGt < start) nextGt = src.indexOf('>', start);
    if (nextGt === -1) break; // no later '>' exists
    // A tag whose first '>' is far away is not worth a quote-aware scan; this
    // also keeps a run of unclosed `<script` starts from rescanning the page.
    const gt = nextGt - start > 4096 ? -1 : scriptTagEnd(src, start);
    if (gt === -1) { i = start + 7; continue; }
    const tag = lower.slice(start, gt);
    i = gt + 1;
    if (!/type\s*=\s*["']application\/ld\+json["']/.test(tag)) continue;
    const close = lower.indexOf('</script', i);
    if (close === -1) break;
    blocks.push(src.slice(i, close));
    const closeGt = src.indexOf('>', close);
    if (closeGt === -1) break;
    i = closeGt + 1;
  }
  return blocks;
}

/** Assemble a JD document from the structured fields an ATS exposes. */
function composeJd({ title, company, location, description, employmentType }) {
  const head = [
    title && `# ${title}`,
    company && `**Company:** ${company}`,
    location && `**Location:** ${location}`,
    employmentType && `**Employment type:** ${employmentType}`,
  ].filter(Boolean).join('\n');
  const body = htmlToText(description);
  return [head, body].filter(Boolean).join('\n\n').trim();
}

/**
 * strategy 1 — schema.org JobPosting in <script type="application/ld+json">.
 *
 * Ashby, Lever, SmartRecruiters, Workable, Recruitee and many bespoke career
 * sites all emit it for Google Jobs indexing, whether or not their UI needs
 * JavaScript. A page can carry several ld+json blocks (BreadcrumbList,
 * Organization), and a block may itself be an array or an @graph wrapper, so
 * every shape is walked and only JobPosting nodes are kept. A listing page can
 * carry several DISTINCT postings, and taking the first would hand the worker
 * some other job's JD, so a rescue is only offered when exactly one qualifies.
 *
 * @param {string} html
 * @returns {{text: string, method: 'ld+json'}|null}
 */
export function fromLdJson(html) {
  const candidates = new Map();
  for (const block of ldJsonBlocks(html)) {
    let parsed;
    // A malformed block is normal (trailing commas, HTML comments wrapping the
    // JSON). Skip it and keep looking rather than aborting the whole strategy.
    try { parsed = JSON.parse(block.trim()); } catch { continue; }

    const queue = [parsed];
    for (let qi = 0; qi < queue.length; qi += 1) {
      const node = queue[qi];
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node)) { for (const child of node) queue.push(child); continue; }
      if (Array.isArray(node['@graph'])) for (const child of node['@graph']) queue.push(child);

      const type = node['@type'];
      const isJobPosting = Array.isArray(type)
        ? type.includes('JobPosting')
        : type === 'JobPosting';
      if (!isJobPosting || !node.description) continue;

      const loc = node.jobLocation;
      const locNode = Array.isArray(loc) ? loc[0] : loc;
      const addr = locNode?.address ?? locNode;
      const location = [addr?.addressLocality, addr?.addressRegion, addr?.addressCountry]
        .map((v) => (typeof v === 'object' ? v?.name : v))
        .filter(Boolean).join(', ');

      const text = composeJd({
        title: node.title,
        company: node.hiringOrganization?.name ?? node.hiringOrganization,
        location: location || undefined,
        description: node.description,
        employmentType: Array.isArray(node.employmentType)
          ? node.employmentType.join(', ') : node.employmentType,
      });
      if (wordCount(text) > 0) candidates.set(text, { text, method: 'ld+json' });
    }
  }
  return candidates.size === 1 ? [...candidates.values()][0] : null;
}

/**
 * strategy 2 — the hydration payload.
 *
 * Rather than parse a whole bootstrap object (its shape is not contractual),
 * pull the descriptionHtml/descriptionPlainText/jobDescriptionHtml string
 * values directly (a bare `description` key is too generic: it also labels
 * unrelated page content) and take the longest — the JD is by a wide margin
 * the biggest such field on the page.
 */
/**
 * Decoded values of the description-like JSON string fields in a page. Linear:
 * the key regex has no nested quantifier, and each string is scanned once by
 * hand, so repeated unterminated `"descriptionHtml":"` starts cannot make the
 * scan quadratic.
 * @returns {string[]}
 */
export function embeddedDescriptionStrings(html) {
  const out = [];
  const keyRe = /"(?:descriptionHtml|descriptionPlainText|jobDescriptionHtml)"\s*:\s*"/g;
  const src = String(html);
  while (keyRe.exec(src) !== null) {
    const start = keyRe.lastIndex;
    let i = start;
    while (i < src.length && src[i] !== '"') i += src[i] === '\\' ? 2 : 1;
    if (i >= src.length) break;
    keyRe.lastIndex = i + 1;
    const rawStr = src.slice(start, i);
    try { out.push(JSON.parse(`"${rawStr}"`)); } catch {
      // Malformed (a raw control character). Escape it and parse again, so
      // valid escapes survive; else the value becomes spacing, never markup.
      const fixed = rawStr.replace(/[\u0000-\u001f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
      try { out.push(JSON.parse(`"${fixed}"`)); } catch { out.push(rawStr.replace(/\\./g, ' ').replace(/[\u0000-\u001f]/g, ' ')); }
    }
  }
  return out;
}

export function fromEmbeddedDescription(html) {
  let best = '';
  for (const raw of embeddedDescriptionStrings(html)) {
    const text = htmlToText(raw);
    if (text.length > best.length) best = text;
  }
  if (!best) return null;
  return { text: best, method: 'embedded-description' };
}

/** Distinct large description-like strings in a hydration payload. */
function embeddedDescriptionCount(html) {
  const seen = new Set();
  for (const raw of embeddedDescriptionStrings(html)) {
    if (wordCount(String(raw).replace(/<[^>]+>/g, ' ')) >= MIN_PAGE_JD_WORDS) seen.add(String(raw).replace(/\s+/g, ' ').trim());
  }
  return seen.size;
}

/** Is a posting's `validThrough` in the past? An absent or unparseable date is not evidence. */
function isPastValidThrough(node, now) {
  const raw = node?.validThrough;
  if (typeof raw !== 'string' || !raw.trim()) return false;
  let when = Date.parse(raw);
  // A date-only value parses as UTC midnight, but means "through that day".
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) when += 24 * 60 * 60 * 1000;
  return Number.isFinite(when) && when < now;
}

const collapseWs = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v);

/** Stable form of a JSON value: object keys sorted at every depth, strings whitespace-collapsed. */
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  return collapseWs(v);
}

// Tokens that identify a job in a posting URL: path segments containing a digit, and id-like query values.
function jobIdTokens(u) {
  try {
    const x = new URL(u);
    // SPA routes carry the job id in the fragment (/careers#/job/2), so read it like the path.
    const toks = `${x.pathname}/${x.hash.replace(/^#/, '').split('?')[0]}`.split('/').filter((seg) => /\d/.test(seg)).map((seg) => seg.toLowerCase());
    // id-like query values, from the real query and from a query inside the fragment (#/job?jobId=1).
    const fragQuery = x.hash.includes('?') ? x.hash.slice(x.hash.indexOf('?') + 1) : '';
    for (const params of [x.searchParams, new URLSearchParams(fragQuery)]) {
      for (const [k, val] of params) if (/(^|_)(id|jid|jobid|job_id|reqid|req)$/i.test(k) && val) toks.push(val.toLowerCase());
    }
    return toks;
  } catch { return []; }
}

// A bare year or version segment (/2024/, /v2/) is shared structure, not a job id.
const STRUCTURAL_TOKEN_RE = /^(?:(?:19|20)\d\d|v\d+(?:\.\d+)*)$/;

/**
 * Does this JobPosting's own URL clearly name a different job than the one
 * requested? Only when both are absolute URLs on the same host, both carry
 * id-like tokens, and the tokens share nothing. Postings with no URL, a
 * different host (CDN or alias), or no identifying tokens are not rejected.
 */
function postingNamesOtherJob(node, requestedUrl) {
  if (!requestedUrl) return false;
  const own = typeof node?.url === 'string' ? node.url : (typeof node?.['@id'] === 'string' ? node['@id'] : '');
  if (!own) return false;
  try {
    const a = new URL(requestedUrl); const b = new URL(own);
    if (a.hostname.replace(/^www\./, '').toLowerCase() !== b.hostname.replace(/^www\./, '').toLowerCase()) return false;
  } catch { return false; }
  let want = jobIdTokens(requestedUrl); let got = jobIdTokens(own);
  // Compare without year/version segments when both sides still have a real id; otherwise the
  // raw tokens are the only identity there is (/job/2031 vs /job/2044 must still differ).
  const wantStrong = want.filter((t) => !STRUCTURAL_TOKEN_RE.test(t));
  const gotStrong = got.filter((t) => !STRUCTURAL_TOKEN_RE.test(t));
  if (wantStrong.length && gotStrong.length) { want = wantStrong; got = gotStrong; }
  if (!want.length || !got.length) return false;
  return !want.some((t) => got.includes(t));
}

/**
 * Pick the JD out of already-downloaded page HTML. Pure — exported for tests
 * and for the auto-pipeline's prefetch stage.
 *
 * Null when the page holds no single posting of at least MIN_PAGE_JD_WORDS
 * words (ambiguous pages included: nothing on them can be attributed to one
 * URL). A posting past its `validThrough` date returns `{closed: true,
 * evidence}` instead, so the caller can pass the closure on rather than
 * scoring a posting the page itself calls closed.
 *
 * @param {string} html
 * @param {number} [now] epoch ms, injectable for tests
 * @param {string} [requestedUrl] for the other-job identity check
 * @returns {{text: string, method: string, closed?: boolean, evidence?: string}|null}
 */
export function jdFromPageHtml(html, now = Date.now(), requestedUrl = '') {
  const postings = [];
  for (const block of ldJsonBlocks(html)) {
    let parsed;
    try { parsed = JSON.parse(block.trim()); } catch { continue; }
    const queue = [parsed];
    for (let qi = 0; qi < queue.length; qi += 1) {
      const node = queue[qi];
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node)) { for (const child of node) queue.push(child); continue; }
      if (Array.isArray(node['@graph'])) for (const child of node['@graph']) queue.push(child);
      const type = node['@type'];
      if (Array.isArray(type) ? type.includes('JobPosting') : type === 'JobPosting') postings.push(node);
    }
  }
  // A page that names more than one posting is a listing, or a page whose other
  // postings we cannot tell apart from the requested one. Nothing on it can be
  // attributed to this URL: not a JD, and not a closure either.
  const distinctLd = new Set(postings.map((node) => JSON.stringify(canon([node.title ?? '', node.description ?? '', node.url ?? '', node['@id'] ?? '', node.identifier ?? '', node.hiringOrganization ?? '', node.jobLocation ?? ''])))).size;
  if (distinctLd > 1) return null;
  // A single posting that names a different job than the requested URL is that other job's, not ours.
  if (postings.length && postingNamesOtherJob(postings[0], requestedUrl)) return null;

  // Closed per the page's own structured data: not a JD to score.
  const expired = postings.find((node) => isPastValidThrough(node, now));
  if (expired) return { closed: true, evidence: `JobPosting validThrough ${String(expired.validThrough).slice(0, 40)}`, text: '', method: 'ld-json-expired' };

  let ld = null;
  try { ld = fromLdJson(html); } catch { /* malformed JSON-LD fields: the closure check above still ran */ }
  if (ld && wordCount(ld.text) >= MIN_PAGE_JD_WORDS) return ld;

  // The embedded-payload fallback picks the LONGEST description on the page. It
  // is only trusted when the page holds one description-sized string (and,
  // above, at most one posting), so what it returns can only be this posting's.
  if (embeddedDescriptionCount(html) > 1) return null;
  const embedded = fromEmbeddedDescription(html);
  return embedded && wordCount(embedded.text) >= MIN_PAGE_JD_WORDS ? embedded : null;
}

/**
 * The page's own `<title>` text, raw and uncapped at the first close tag.
 * Cloudflare titles its interstitials itself, so the JD fetch path can refuse
 * them by title (#6798) — this is that title reader. '' when there is none.
 *
 * @param {string} html
 * @returns {string}
 */
export function pageTitle(html) {
  const src = String(html ?? '');
  const open = /<title\b[^>]*>/i.exec(src);
  if (!open) return '';
  const from = open.index + open[0].length;
  const close = asciiLower(src).indexOf('</title', from);
  if (close === -1) return '';
  return src.slice(from, close).trim();
}
