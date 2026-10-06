// Shared HTML → plain-text pipeline for sources whose payloads embed
// description markup. Greenhouse's contentToText was the first instance; this
// is the extracted form so later sources cannot grow a divergent copy — the
// same rationale that produced html-entities.mjs when entity decoders drifted.
import { decodeEntities } from './html-entities.mjs';

// Capped like greenhouse/alibaba full-text JDs: a 10 KB/posting body is normal
// on these boards, and scan payloads must stay sane.
export const DESCRIPTION_CAP = 4000;

// Input ceiling before any regex runs. Output is capped at DESCRIPTION_CAP
// anyway, and scan payloads are uncapped upstream — a hostile or broken board
// must not hand the tag matcher megabytes to chew on.
export const INPUT_CAP = 200_000;

// A tag ends at an UNQUOTED `>`. Attribute values may contain angle brackets
// (`<a title="a > b">`), so the common `<[^>]+>` shortcut can stop midway
// through a tag and leak the remaining attributes as description text.
// A tag must START like one (`<p`, `</p`, `<!--`, `<?xml`): the old
// `<(?:…)+>` also ate prose such as `salary <50k or >100k`. An unquoted `<`
// cannot sit inside a tag, which bounds each attempt at the next `<` — the old
// matcher rescanned to the end from every `<` of a `<<<<…` run (20 000 of
// them blocked the event loop for 11 s).
const HTML_TAG_RE = /<[a-zA-Z!?/](?:[^<>"']|"[^"]*"|'[^']*')*>/g;
const MEDIA_OPEN_RE = /<(script|style)\b(?:[^<>"']|"[^"]*"|'[^']*')*>/gi;

/**
 * Drop `<script>…</script>` / `<style>…</style>` spans with their contents, in
 * linear time. Each opener pairs with the first matching closer after it; a
 * tag name whose opener has no closer can have none later either, so it is
 * skipped from then on (the lazy-regex form rescanned to the end per opener).
 * @param {string} content
 */
function stripMedia(content) {
  const dead = new Set();
  let out = '';
  let pos = 0;
  MEDIA_OPEN_RE.lastIndex = 0;
  for (let m = MEDIA_OPEN_RE.exec(content); m; m = MEDIA_OPEN_RE.exec(content)) {
    const name = m[1].toLowerCase();
    if (dead.has(name)) continue;
    const close = new RegExp(`<\\/${name}\\s*>`, 'gi');
    close.lastIndex = m.index + m[0].length;
    const c = close.exec(content);
    if (!c) { dead.add(name); continue; }
    out += content.slice(pos, m.index) + ' ';
    pos = c.index + c[0].length;
    MEDIA_OPEN_RE.lastIndex = pos;
  }
  return pos === 0 ? content : out + content.slice(pos);
}

/** @param {string} content */
function stripMarkup(content) {
  return stripMedia(content).replace(HTML_TAG_RE, ' ');
}

/**
 * Entity-decoded markup → stripped plain text.
 *
 * Double-decode: the payload often carries entity-escaped tags (`&lt;p&gt;`),
 * so the first pass reveals real tags, and text-level entities (`&amp;`,
 * `&#39;`) only become decodable once those tags are gone. Plain text is what
 * the content_filter matches against — substring matching over raw HTML misses
 * keywords split by a tag and pads matches into attribute soup.
 *
 * Exported for tests.
 * @param {unknown} content
 * @returns {string}
 */
export function htmlToText(content) {
  if (typeof content !== 'string' || !content) return '';
  // Strip literal markup BEFORE decoding: quote entities inside a quoted
  // attribute are data, and decoding them first would turn them into false
  // delimiters. The second strip handles entity-escaped tags revealed by the
  // first decode; the final decode retains the double-decode behavior.
  const decoded = decodeEntities(stripMarkup(content.slice(0, INPUT_CAP)));
  // Each decode is followed by a strip, so double-encoded active markup cannot
  // become the final plain-text output. A trailing incomplete opener has no
  // closing `>` for stripMarkup() to consume — `safe &lt;img src=x onerror=1`
  // used to survive as `safe <img src=x onerror=1` — so drop just its leading
  // angle bracket: the text stays readable and is inert. Ported from parent
  // career-ops v1.31.0 (#3491).
  const decodedTwice = decodeEntities(stripMarkup(decoded));
  return stripMarkup(decodedTwice)
    .replace(/<(?=\/?[a-z!?])/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, DESCRIPTION_CAP);
}
