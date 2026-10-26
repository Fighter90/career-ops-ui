/**
 * Security helpers — sanitizers and host-trust checks.
 *
 * These are project-wide invariants. NEVER duplicate them; route through
 * the named exports here. Any new ingress that takes user-supplied URL,
 * Markdown, or JD text MUST go through the matching helper.
 *
 * Tested via the route handlers (tests/url-validation, cv-xss,
 * jd-sanitize, security-headers).
 */

/** Host the server bound at listen() — null until then. */
let boundHost = null;

/**
 * Record the host `listen()` actually bound (http-timeouts.mjs calls this). An
 * empty/undefined bind host means every interface. `null` forgets it (tests).
 * @param {string|null|undefined} host
 */
export function recordBindHost(host) {
  boundHost = host === null ? null : (String(host ?? '').trim() || '0.0.0.0');
}

/**
 * True when HOST binds beyond loopback — i.e. listening on 0.0.0.0 or any
 * non-127.0.0.1/::1 interface. Used to gate Content-Security-Policy so
 * stricter limits only kick in when the UI is reachable from the network.
 */
export function isPubliclyExposed() {
  // The address the server actually bound wins over the live env: POST
  // /api/config rewrites process.env.HOST, and reading that would let a
  // request flip the exposed-only guards (LLM rate limit, health redaction)
  // off while the socket is still listening on 0.0.0.0. The env is only the
  // fallback before listen() — and in tests that never bind.
  const host = String(boundHost ?? process.env.HOST ?? '127.0.0.1').trim() || '127.0.0.1';
  if (host === '127.0.0.1' || host === '::1' || host === 'localhost') return false;
  return true;
}

/**
 * Returns true when `host` resolves to a private/loopback/link-local space
 * we never want to fetch. Covers (PR-3):
 *   - RFC1918 ranges 10/8, 172.16/12, 192.168/16
 *   - Loopback 127/8 (entire range, not just 127.0.0.1)
 *   - Link-local 169.254/16 — the AWS IMDS endpoint 169.254.169.254 lives here
 *   - 0.0.0.0 (any-address alias)
 *   - CGNAT 100.64/10
 *   - IPv6 loopback ::1, unspecified ::, ULA fc00::/7, link-local fe80::/10
 *   - localhost / *.localhost suffix
 * Used both by isValidJobUrl (string-level) and by the preview proxy
 * after DNS resolution to defeat DNS-rebinding (PR-3).
 */
export function isPrivateOrLoopbackHost(host) {
  if (!host || typeof host !== 'string') return false;
  let h = host.toLowerCase().trim();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  // A fully-qualified name may end in a dot: `localhost.` (which the URL parser
  // keeps as-is) names the same host as `localhost`.
  h = h.replace(/\.+$/, '');
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) {
    const parts = h.split('.').map(Number);
    if (parts.some((n) => n > 255 || Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (h.includes(':')) {
    // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d) addresses
    // reach the embedded IPv4 host, so classify them by that host. Parent
    // providers/_ip-guard.mjs does the same (#4079 follow-up).
    const dotted = /^::(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h);
    if (dotted) return isPrivateOrLoopbackHost(dotted[1]);
    // The same two forms written in hex, which is how the URL parser prints
    // them: `new URL('http://[::ffff:127.0.0.1]/').hostname` is `[::ffff:7f00:1]`.
    const hexEmbedded = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
    if (hexEmbedded) {
      const high = Number.parseInt(hexEmbedded[1], 16);
      const low = Number.parseInt(hexEmbedded[2], 16);
      return isPrivateOrLoopbackHost(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
    }
    if (h === '::1' || h === '::') return true;
    if (/^fc[0-9a-f]{2}:/.test(h) || /^fd[0-9a-f]{2}:/.test(h)) return true;
    if (/^fe[89ab][0-9a-f]:/.test(h)) return true;
    return false;
  }
  return false;
}

/**
 * Validate a string as a job-posting URL. Defends against:
 *   - bare strings ("not-a-url") that slip past scheme checks because
 *     they have no scheme to reject (FIX-M7)
 *   - templating chars < > " ' ` \\ that hint at injection attempts
 *   - non-http(s) schemes (javascript:, data:, file:, ftp:, vbscript:)
 *   - loopback / RFC1918 / link-local / CGNAT hostnames — a public job
 *     board is never on a private network, so anything pointing inward
 *     is almost certainly a misconfig or SSRF probe (PR-3 expanded the
 *     range from just localhost/::1 to the full private-IP set incl. AWS
 *     IMDS 169.254.169.254 and 0.0.0.0)
 *   - obviously bogus length: <10 chars (a real URL needs at least
 *     "http://x.x") or >2000 chars (typical browser cap, anything
 *     longer is a paste mistake or a tracking-blob explosion)
 */
/**
 * Paired URL-templating syntaxes that the route-level error message
 * ("contain no script or template characters") explicitly promises to
 * reject. ASP/EJS (`<%…%>`) is already covered by the `[<>"'`\\\s]` gate
 * because both `<` and `>` are blocked. JS template literals (`${…}`)
 * and Mustache/Handlebars (`{{…}}`) use only `$` / `{` / `}` and slipped
 * through pre-v1.58.7 (NEW-2). We block only *paired* forms — a bare
 * `}` appears in legitimate URLs occasionally; only the un-escaped
 * opener+closer of a templating placeholder is a real risk signal.
 */
const TEMPLATE_PATTERNS = [
  /\$\{[^}]*\}/,    // JS template literal:    ${…}
  /\{\{[^}]*\}\}/,  // Mustache / Handlebars:  {{…}}
];

function hasTemplatePlaceholder(url) {
  return TEMPLATE_PATTERNS.some((re) => re.test(url));
}

export function isValidJobUrl(input) {
  if (typeof input !== 'string') return false;
  const url = input.trim();
  if (url.length < 10 || url.length > 2000) return false;
  if (/[<>"'`\\\s]/.test(url)) return false;
  // NEW-2 (v1.58.7) — error message says "contain no script or
  // template characters". `<%…%>` is caught by the bracket-char gate
  // above, but `${…}` and `{{…}}` were not. Reject paired placeholders
  // so the message matches reality (and we get a slight hardening
  // against URL-templating injection attempts as a side benefit).
  if (hasTemplatePlaceholder(url)) return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return false;
  if (!parsed.hostname) return false;
  if (isPrivateOrLoopbackHost(parsed.hostname)) return false;
  return true;
}

/**
 * Sanitize a request-path component (`:name` / `:slug` route parameters)
 * before joining it onto a project-relative directory. v1.20.1 (H-4)
 * consolidates the previously-duplicated `.replace(/[^\w\-.]/g, '')`
 * pattern that lived in 10 call sites across `routes/`.
 *
 * The bare-regex form kept `.` characters — so `..pdf`, `....md`,
 * leading-dot names survived. There was no `/` in the allowed set
 * (escape from `output/` is impossible), but the duplication invited
 * regression by copy-paste. This helper also:
 *   - strips leading dots / dot-runs (`.`, `..`, `...`)
 *   - collapses internal dot-runs (`foo..bar` → `foo.bar`)
 *   - caps length at 200 chars
 *   - returns an empty string when no usable characters remain
 *
 * Callers MUST check for the empty-string result and return a 400.
 *
 * @param {string|null|undefined} s — raw `req.params.name` / `:slug`
 * @returns {string} — safe name, or `''` if input contained no allowed chars
 */
export function sanitizePathName(s) {
  return String(s || '')
    .replace(/[^\w\-.]/g, '')   // allow only \w, hyphen, dot
    .replace(/^\.+/, '')         // no leading "." or ".." prefixes
    .replace(/\.{2,}/g, '.')     // collapse internal "..."
    .slice(0, 200);
}

/**
 * Sanitize a job-description text before it joins a prompt destined for
 * an LLM. Removes:
 *   - control bytes (NUL, ANSI escapes, etc.) that would confuse downstream
 *     terminals or trigger silent string-mangling in tooling
 *   - script tags, which neither contribute meaning nor belong in a JD
 *   - leading/trailing whitespace
 * Caps length at 50 KB — JDs over that size are paste mistakes, not real
 * postings, and bloat the prompt for no upside.
 */
export function sanitizeJobDescription(input) {
  if (typeof input !== 'string') return '';
  let s = input
    .replace(/\x1B\[[0-9;]*m/g, '')         // ANSI color escapes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // control chars (keep \t \n \r)
  // Script spans (`<script …>…</script >`) go through the linear scanner — the
  // equivalent lazy regex was quadratic on a run of unclosed `<script`.
  s = stripPairedTag(s, 'script', true).trim();
  if (s.length > 50_000) s = s.slice(0, 50_000);
  return s;
}

/**
 * Strip dangerous patterns from CV markdown before persisting.
 * Defense-in-depth — the client-side renderer also escapes everything,
 * but neutralizing the file at rest protects any consumer that bypasses
 * the renderer (e.g. raw `cat cv.md`, third-party tools, future endpoints).
 *
 * FULL-R4: the strip must never CORRUPT ordinary prose. Two rules make
 * that hold:
 *   - Dangerous schemes are renamed to the inert `data-blocked:` only in
 *     real link/attribute contexts (markdown inline link `](…)`, markdown
 *     reference definition `[ref]: …`, `href=`/`src=` attributes) — never
 *     on bare prose, so «JavaScript: React, Node» survives a save.
 *   - Entities are NOT decoded in place (the old in-place decoder
 *     permanently rewrote `R&amp;D` → `R&D`, `&lt;T&gt;` → `<T>`,
 *     `&#36;` → `$`). Detection runs on a decoded scratch copy and the
 *     cut is made back in the original text, so prose entities survive
 *     byte-identical while an encoded `<script>` payload is still found
 *     and removed.
 */
export function stripDangerousMarkdown(text) {
  if (!text) return '';
  let s = String(text).replace(/\x00/g, '');
  // Apply the edit pass repeatedly until the string stops changing (bounded).
  // A single pass can REVEAL a new match — e.g. `<scr<script></script>ipt>` or a
  // nested `<sty<style></style>le>` — so run to a fixed point (CodeQL
  // incomplete-multi-character-sanitization). The end-tag patterns use `[^>]*>`
  // (not `\s*>`) so `</script foo>` / `</script\n bar>` are also removed
  // (CodeQL bad-tag-filter).
  let prev;
  let passes = 0;
  do { prev = s; s = applyDangerousEdits(s); } while (s !== prev && ++passes < 8);
  // Final belt (v1.111.0; output form hardened in the FULL-R4 re-review):
  // the loop removes well-formed dangerous tags AND `<tag …>` openers that
  // carry a closing `>`. What can still survive is a *truncated* opener
  // with no `>` at all — e.g. a payload ending in `<script` or `<iframe`.
  // Escape its `<` to `&amp;lt;` so the OUTPUT contains no `<` glyph a
  // single decode could turn back into a live tag (the old `&lt;` form
  // decoded straight back to `<script`, and re-saving the file rewrote it
  // a second time). Escaping the `<` is a COMPLETE sanitization (no
  // partial multi-character delimiter can be reconstructed downstream),
  // which closes the incomplete-multi-character-sanitization class at the
  // trust boundary.
  // CAR-90: one FLAT character class, not `\s*\/?\s*`. The old shape carried a
  // nested quantifier (two `\s*` runs around an optional `\/` over the SAME
  // whitespace run), so `<` + 100k spaces split the run O(k²) ways — ~16s of
  // blocked event loop through /api/cv/import. A single-class run has no
  // ambiguity to backtrack (per-`<` work is bounded by its own following run,
  // and runs are disjoint → linear overall). Same openers escaped; the only
  // widening is extra slashes (`< //script`), which is the safe direction.
  s = s.replace(/<(?=[\s/]*(?:script|iframe|object|embed|style|form|svg)\b)/gi, '&amp;lt;');
  // Same belt for event-handler attributes: the strip loop is capped at 8
  // passes, so nesting deeper than that could leave an `on…=` behind. Rename
  // what survives to an inert `data-blocked=`; the replacement cannot
  // re-form `<whitespace>on…=`, so one pass is complete. Scoped to tag
  // regions (see handlerSpansInTagRegions) so prose `one = 1` is not
  // rewritten.
  s = applySpans(s, handlerSpansInTagRegions(s), null, null);
  return s;
}

const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'style', 'form', 'svg'];

// Scheme alternation shared by the link/attribute contexts. Dangerous
// schemes are RENAMED to the inert `data-blocked:` (not deleted) — same
// rename-not-delete reasoning as the `on…=` handlers below.
//
// Control characters that URL parsers strip anywhere inside a URL make a
// scheme live even when spelled `java&Tab;script:` / `java&NewLine;script:`
// — so the scheme token tolerates [\t\n\r] between its letters. The
// letters stay MANDATORY between the runs (no ambiguous quantifier splits
// — linear per attempt), and line STRUCTURE is never crossed: the token
// starts with a letter, so a blank line still ends a reference definition.
const URL_CTL = '[\\t\\n\\r]';
const schemeWord = (word) => word.split('').join(URL_CTL + '*');
const SCHEME_RE =
  `(?:${schemeWord('javascript')}\\s*:|${schemeWord('vbscript')}\\s*:` +
  `|${schemeWord('data')}\\s*:\\s*${schemeWord('text')}\\s*\\/\\s*${schemeWord('html')})`;
// Every pattern keeps the SCHEME as its LAST capture group (the rename
// span is always `[matchEnd - schemeLength, matchEnd)`), and every
// whitespace run is separated from the next by a MANDATORY character
// (`(`, `<`, `]`, `:`, a quote, a list marker, a digit) — no pattern can
// backtrack a run O(k²) ways (the pre-review `(\s*=\s*["']?\s*)` shape
// was polynomial: `href=` + 100k spaces ≈ 109 s).
const SCHEME_CONTEXT_RES = [
  // [x](javascript:…) incl. the CommonMark angle-bracket destination
  // form [x](<javascript:…>).
  new RegExp(`\\]\\(\\s*(?:<\\s*)?(${SCHEME_RE})`, 'gi'),
  // <javascript:…> autolinks — CommonMark renders them as live links.
  new RegExp(`<\\s*(${SCHEME_RE})`, 'gi'),
  // Link reference definitions after any block-quote / list markers
  // (`> [r]:`, `- [r]:`, `1. [r]:`); the destination may sit on the next
  // line, but a definition ends at a BLANK line (CommonMark), so prose
  // below one is never touched.
  new RegExp(`^(?:[ \\t]*(?:>|[-*+]|\\d+[.)])[ \\t]*)*([ \\t]*\\[[^\\]\\n]*\\]:[ \\t]*(?:\\r?\\n[ \\t]*)?)(${SCHEME_RE})`, 'gim'),
  // Destination-carrying HTML attributes; the optional quote is anchored
  // INSIDE the optional group so adjacent whitespace runs stay unambiguous,
  // and a quoted value may start on the next line (browsers strip the
  // leading newline).
  new RegExp(`\\b(href|src|action|formaction|xlink:href|data|poster|background)(\\s*=\\s*(?:["'][ \\t\\r\\n]*)?)(${SCHEME_RE})`, 'gi'),
  // <meta http-equiv=refresh content="…url=javascript:…"> — the value
  // scan is bounded by the closing quote (or whitespace/`>` unquoted)
  // and only a `content=` occurrence starts one.
  new RegExp(`\\bcontent\\s*=\\s*(?:"[^"]*?|'[^']*?|[^\\s>]*?)\\burl\\s*=\\s*(?:["'][ \\t\\r\\n]*)?(${SCHEME_RE})`, 'gi'),
];
const HANDLER_RE = /([\s/"'])(on[a-z]+)(\s*=)/gi;
const OPENER_ESCAPE_RE = /<(?=[\s/]*(?:script|iframe|object|embed|style|form|svg)\b)/gi;
// Entity variant: OPENERS only. An encoded closer (`&lt;/script&gt;`) is
// inert on its own — and when it completes a real opener, the mapped cut
// above removes the whole span — so re-escaping it would only make the
// stored text drift on every re-save (`&lt;` → `&amp;lt;`).
const ENTITY_OPENER_ESCAPE_RE = /<(?=[\s]*(?:script|iframe|object|embed|style|form|svg)\b)/gi;
// Scratch-decode set: the six XSS-rewriting forms plus the HTML5 named
// entities that complete a scheme (`javascript&colon;`, `java&Tab;script:`).
// Detection-only — stored prose is never rewritten.
const ENTITY_RE = /&(?:#[xX]([0-9a-fA-F]+)|#([0-9]+)|(lt|gt|quot|amp|colon|Tab|NewLine));/gi;

/**
 * One edit pass — the steps run SEQUENTIALLY on the evolving string (the
 * old pass semantics): a cut can REVEAL a construct for a later step in
 * the same pass (`<scr<script></script>ipt>` — the paired cut reveals
 * `<script>`, which the dangling-opener step then removes). Detection for
 * every step runs on a decoded scratch view of the CURRENT string and the
 * edit is cut/renamed back in the original, so prose entities survive.
 * The decode is cached: a step that edits nothing leaves `s` unchanged,
 * so the following step reuses it (typically one decode per pass).
 */
function applyDangerousEdits(s0) {
  let s = s0;
  let cacheSrc = null;
  let cache = null;
  const decoded = () => {
    if (s !== cacheSrc) { cache = decodeForDetection(s); cacheSrc = s; }
    return cache;
  };
  const apply = (spans, srcStart = cache.srcStart, srcEnd = cache.srcEnd) => {
    s = applySpans(s, spans, srcStart, srcEnd);
  };
  // Tag removal is scanned, not matched with `<tag\b[\s\S]*?<\/tag[^>]*>`
  // regexes: a backtracking engine retries that lazy span from EVERY
  // opener, so a run of unclosed `<script ` was quadratic (160 KB = 27 s
  // of blocked event loop through /api/cv/import). Same matches, linear
  // time. Each opener pairs with the FIRST closer after it (lazy); when
  // an opener has no closer, no later opener can have one either.
  for (const tag of DANGEROUS_TAGS) {
    const spans = pairedTagSpans(decoded().text, tag);
    if (spans.length) apply(spans);
  }
  let spans = openerSpans(decoded().text, /<embed\b/gi);
  if (spans.length) apply(spans);
  // Unclosed / dangling opener of an executable/embedding tag (no closing
  // tag in the input) — cut the opener so a later consumer can't complete it.
  spans = openerSpans(decoded().text, /<(?:script|iframe|object|style|form|svg)\b/gi);
  if (spans.length) apply(spans);
  // Scheme detection runs on the plain decoded view — control characters
  // are tolerated INSIDE the scheme token (see URL_CTL/schemeWord), never
  // stripped from the view, so line structure (blank lines) stays intact.
  spans = schemeSpans(decoded().text);
  if (spans.length) apply(spans);
  spans = handlerSpansInTagRegions(decoded().text);
  if (spans.length) apply(spans);
  const { srcStart, srcEnd } = decoded();
  if (srcStart) {
    spans = entityBeltSpans(cache.text, srcStart, srcEnd);
    if (spans.length) apply(spans);
  }
  return s;
}

/**
 * Cut/rename spans — `[start, end, replacement]` on the decoded text,
 * replacement `null` meaning "cut the span entirely" — sorted by start
 * (longest first at a tie), overlaps dropped, applied left to right.
 * Mapping is monotone (a decoded unit never maps backwards), so spans
 * disjoint on the decoded text stay disjoint in the original.
 */
function applySpans(s, spans, srcStart, srcEnd) {
  if (spans.length === 0) return s;
  const edits = spans
    .map(([a, b, rep]) => ({
      start: srcStart ? srcStart[a] : a,
      end: srcStart ? srcEnd[b - 1] : b,
      rep,
    }))
    .sort((x, y) => x.start - y.start || (y.end - y.start) - (x.end - x.start));
  let out = '';
  let pos = 0;
  for (const e of edits) {
    if (e.start < pos) continue; // overlaps an edit already applied
    out += s.slice(pos, e.start);
    if (e.rep !== null) out += e.rep;
    pos = e.end;
  }
  return out + s.slice(pos);
}

/** Paired `<tag …>…</tag …>` spans on the decoded text. */
function pairedTagSpans(d, tag) {
  const open = new RegExp(`<${tag}\\b`, 'gi');
  const close = new RegExp(`<\\/${tag}`, 'gi');
  const spans = [];
  let pos = 0;
  for (;;) {
    open.lastIndex = pos;
    const o = open.exec(d);
    if (!o) break;
    const end = closerEnd(d, close, o.index + o[0].length, false);
    if (end === -1) break;
    spans.push([o.index, end, null]);
    pos = end;
  }
  return spans;
}

/** Each `opener … >` (what `<opener[^>]*>` removes), as spans, linear time. */
function openerSpans(d, opener) {
  const spans = [];
  opener.lastIndex = 0;
  for (let m = opener.exec(d); m; m = opener.exec(d)) {
    const gt = d.indexOf('>', m.index + m[0].length);
    if (gt === -1) break; // no `>` after this opener — none after any later one either
    spans.push([m.index, gt + 1, null]);
    opener.lastIndex = gt + 1;
  }
  return spans;
}

/** Dangerous schemes in link/attribute contexts → `data-blocked:` spans. */
function schemeSpans(d) {
  const spans = [];
  for (const re of SCHEME_CONTEXT_RES) {
    re.lastIndex = 0;
    for (let m = re.exec(d); m; m = re.exec(d)) {
      const end = m.index + m[0].length;
      spans.push([end - m[m.length - 1].length, end, 'data-blocked:']);
    }
  }
  return spans;
}

/**
 * `<tag …>` opener regions in `d`, found by a linear quote-aware scan (a
 * `>` inside a quoted attribute value does not end the tag). An unclosed
 * opener swallows the rest of the view — exactly how an HTML parser
 * discards it.
 */
function tagRegions(d) {
  const regions = [];
  let i = d.indexOf('<');
  while (i !== -1) {
    const c1 = d[i + 1];
    if (c1 !== undefined && /[a-zA-Z/!?]/.test(c1)) {
      let quote = null;
      let end = -1;
      for (let j = i + 1; j < d.length; j += 1) {
        const ch = d[j];
        if (quote) {
          if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'") {
          quote = ch;
        } else if (ch === '>') {
          end = j + 1;
          break;
        }
      }
      if (end === -1) break;
      regions.push([i, end]);
      i = d.indexOf('<', end);
    } else {
      i = d.indexOf('<', i + 1);
    }
  }
  return regions;
}

/**
 * `on…=` handler renames INSIDE `<tag …>` regions only: an event handler
 * is only live inside tag syntax, and the previous whole-document rename
 * corrupted ordinary prose («- one = 1» → «- data-blocked = 1»). Works on
 * the decoded view, so entity-encoded tags are covered.
 */
function handlerSpansInTagRegions(d) {
  const spans = [];
  for (const [from, to] of tagRegions(d)) {
    HANDLER_RE.lastIndex = 0;
    const region = d.slice(from, to);
    for (let m = HANDLER_RE.exec(region); m; m = HANDLER_RE.exec(region)) {
      const start = from + m.index + m[1].length;
      spans.push([start, start + m[2].length, 'data-blocked']);
    }
  }
  return spans;
}

/**
 * The literal-`<` belt at the end of stripDangerousMarkdown only sees raw
 * text. A `<` that exists only AFTER entity decoding (`&lt;script src=…`
 * with no `&gt;`) would survive it and come back to life under a naive
 * single decode — so re-escape its ENTITY source here (`&lt;` →
 * `&amp;lt;`). A cut span covering the same `<` wins (applySpans drops the
 * overlap), so live tags are still removed whole.
 */
function entityBeltSpans(d, srcStart, srcEnd) {
  const spans = [];
  ENTITY_OPENER_ESCAPE_RE.lastIndex = 0;
  for (let m = ENTITY_OPENER_ESCAPE_RE.exec(d); m; m = ENTITY_OPENER_ESCAPE_RE.exec(d)) {
    const i = m.index;
    if (srcEnd[i] - srcStart[i] === 1) continue; // literal `<` — the raw belt owns it
    spans.push([i, i + 1, '&amp;lt;']);
  }
  return spans;
}

/**
 * Remove every `<tag …>…</tag …>` span — what the lazy regex
 * `<tag\b[\s\S]*?<\/tag[^>]*>` removes (with `strictClose`, the closer is
 * `</tag\s*>` instead) — in linear time. Each opener pairs with the FIRST
 * closer after it; when an opener has no closer, no later opener can have one
 * either, so the scan stops and leaves the rest to the dangling-opener pass.
 * @param {string} s
 * @param {string} tag  lower-case tag name (a literal, never user input)
 * @param {boolean} [strictClose]
 */
function stripPairedTag(s, tag, strictClose = false) {
  const open = new RegExp(`<${tag}\\b`, 'gi');
  const close = new RegExp(`<\\/${tag}`, 'gi');
  let out = '';
  let pos = 0;
  for (;;) {
    open.lastIndex = pos;
    const o = open.exec(s);
    if (!o) break;
    const end = closerEnd(s, close, o.index + o[0].length, strictClose);
    if (end === -1) break;
    out += s.slice(pos, o.index);
    pos = end;
  }
  return pos === 0 ? s : out + s.slice(pos);
}

/** Index just past the first acceptable closer at or after `from`, or -1. */
function closerEnd(s, close, from, strict) {
  close.lastIndex = from;
  for (let c = close.exec(s); c; c = close.exec(s)) {
    let i = c.index + c[0].length;
    if (!strict) {
      const gt = s.indexOf('>', i);
      return gt === -1 ? -1 : gt + 1;
    }
    while (i < s.length && /\s/.test(s[i])) i += 1;
    if (s[i] === '>') return i + 1;
  }
  return -1;
}

/**
 * Decode entities into a SCRATCH copy used ONLY for detection (FULL-R4 —
 * the old decoder rewrote the stored text in place, permanently mangling
 * `R&amp;D` → `R&D` on every save). Returns the decoded text plus, for
 * every UTF-16 unit of it, the `[start, end)` range in the ORIGINAL it
 * was produced from: plain characters map 1:1, every character of an
 * entity maps to the whole `&…;` span. When `s` holds no `&` the maps
 * are `null` and the decoded text IS `s` (fast path — indices are
 * already original coordinates).
 *
 * Same single-decode semantics as the old in-place decoder, with the
 * entity set extended for detection only: the six XSS-rewriting forms
 * (`&lt;` `&gt;` `&quot;` `&amp;` `&#NNN;` `&#xHH;`) plus the HTML5
 * named entities that complete a scheme (`&colon;` `&Tab;` `&NewLine;`).
 * Decoding every named entity would still be wrong — and rewriting
 * `&copy;` to `©` in the stored text was exactly the FULL-R4 corruption;
 * here nothing decoded ever reaches the output. A scan consumes each
 * entity once and never re-scans its output, so `&amp;lt;` yields the
 * literal TEXT `&lt;` (not `<`) — exactly what the old replace-chain's
 * `&amp;`-last ordering produced. Invalid numeric entities are dropped,
 * as before.
 */
function decodeForDetection(s) {
  if (!s.includes('&')) return { text: s, srcStart: null, srcEnd: null };
  const chars = [];
  const starts = [];
  const ends = [];
  let pos = 0;
  ENTITY_RE.lastIndex = 0;
  for (let m = ENTITY_RE.exec(s); m; m = ENTITY_RE.exec(s)) {
    for (let i = pos; i < m.index; i += 1) { // plain run before the entity
      chars.push(s[i]); starts.push(i); ends.push(i + 1);
    }
    const dec = decodedEntity(m);
    for (let k = 0; k < dec.length; k += 1) { // per UTF-16 unit (astral chars are 2)
      chars.push(dec[k]); starts.push(m.index); ends.push(m.index + m[0].length);
    }
    pos = m.index + m[0].length;
  }
  for (let i = pos; i < s.length; i += 1) {
    chars.push(s[i]); starts.push(i); ends.push(i + 1);
  }
  return { text: chars.join(''), srcStart: starts, srcEnd: ends };
}

/** Decoded text of one entity match ('' for an invalid numeric, as before). */
function decodedEntity(m) {
  if (m[1] !== undefined) {
    const code = parseInt(m[1], 16);
    return Number.isFinite(code) && code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : '';
  }
  if (m[2] !== undefined) {
    const code = parseInt(m[2], 10);
    return Number.isFinite(code) && code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : '';
  }
  switch (m[3].toLowerCase()) { // named forms match case-insensitively
    case 'lt': return '<';
    case 'gt': return '>';
    case 'quot': return '"';
    case 'colon': return ':';
    case 'tab': return '\t';
    case 'newline': return '\n';
    default: return '&'; // amp
  }
}
