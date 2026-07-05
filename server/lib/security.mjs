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

/**
 * True when HOST binds beyond loopback — i.e. listening on 0.0.0.0 or any
 * non-127.0.0.1/::1 interface. Used to gate Content-Security-Policy so
 * stricter limits only kick in when the UI is reachable from the network.
 */
export function isPubliclyExposed() {
  const host = (process.env.HOST || '127.0.0.1').trim();
  if (!host) return false;
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
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars (keep \t \n \r)
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '');
  s = s.trim();
  if (s.length > 50_000) s = s.slice(0, 50_000);
  return s;
}

/**
 * Strip dangerous patterns from CV markdown before persisting.
 * Defense-in-depth — the client-side renderer also escapes everything,
 * but neutralizing the file at rest protects any consumer that bypasses
 * the renderer (e.g. raw `cat cv.md`, third-party tools, future endpoints).
 */
export function stripDangerousMarkdown(text) {
  if (!text) return '';
  let s = String(text).replace(/\x00/g, '');
  // v1.22.0 (M-4) — entity-normalize before applying the strip regex.
  // The pre-v1.22 implementation missed:
  //   &lt;script&gt;…&lt;/script&gt;     — entity-encoded tags
  //   java&#115;cript:                 — entity-encoded scheme letter
  //   ja&#x76;ascript:                — hex-entity-encoded scheme letter
  //   <img src="data:image/svg+xml,<svg onload=…>">  — nested SVG vector
  // Decoding numeric / named entities first lets the same regex pass
  // catch the decoded payload. The result is rewritten with HTML entities
  // re-escaped for `<`, `>`, `&` so the output is still safe to embed.
  s = decodeHtmlEntities(s);
  // Apply the strip pass repeatedly until the string stops changing (bounded).
  // A single pass can REVEAL a new match — e.g. `<scr<script></script>ipt>` or a
  // nested `<sty<style></style>le>` — so run to a fixed point (CodeQL
  // incomplete-multi-character-sanitization). The end-tag patterns use `[^>]*>`
  // (not `\s*>`) so `</script foo>` / `</script\n bar>` are also removed
  // (CodeQL bad-tag-filter).
  let prev;
  let passes = 0;
  do { prev = s; s = stripDangerousOnce(s); } while (s !== prev && ++passes < 8);
  return s;
}

/** One strip pass over the known dangerous tags/attributes/schemes. */
function stripDangerousOnce(s) {
  return s
    .replace(/<script\b[\s\S]*?<\/script[^>]*>/gi, '')
    .replace(/<iframe\b[\s\S]*?<\/iframe[^>]*>/gi, '')
    .replace(/<object\b[\s\S]*?<\/object[^>]*>/gi, '')
    .replace(/<embed\b[^>]*\/?>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style[^>]*>/gi, '')
    .replace(/<form\b[\s\S]*?<\/form[^>]*>/gi, '')
    .replace(/<svg\b[\s\S]*?<\/svg[^>]*>/gi, '')
    // Unclosed / dangling opener of an executable/embedding tag (no closing tag
    // in the input) — strip the opener so a later consumer can't complete it.
    .replace(/<(?:script|iframe|object|style|form|svg)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '');
}

/**
 * Minimal HTML entity decoder used as a pre-pass by stripDangerousMarkdown.
 * Decodes:
 *   - numeric decimal entities `&#NNN;`
 *   - numeric hex entities `&#xHH;`
 *   - the four named entities that matter for XSS rewriting: `&lt;`,
 *     `&gt;`, `&amp;`, `&quot;`
 *
 * We deliberately do NOT decode every named entity — that would expand
 * `&copy;` to `©` and other non-XSS sequences in stored CVs, which
 * would change unrelated text. The four above are sufficient to defeat
 * the bypass class observed in the audit.
 */
function decodeHtmlEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&');
}
