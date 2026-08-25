// Shared HTML → plain-text pipeline for sources whose payloads embed
// description markup. Greenhouse's contentToText was the first instance; this
// is the extracted form so later sources cannot grow a divergent copy — the
// same rationale that produced html-entities.mjs when entity decoders drifted.
import { decodeEntities } from './html-entities.mjs';

// Capped like greenhouse/alibaba full-text JDs: a 10 KB/posting body is normal
// on these boards, and scan payloads must stay sane.
export const DESCRIPTION_CAP = 4000;

// A tag ends at an UNQUOTED `>`. Attribute values may contain angle brackets
// (`<a title="a > b">`), so the common `<[^>]+>` shortcut can stop midway
// through a tag and leak the remaining attributes as description text.
// Requiring content between the brackets preserves a literal `<>`, as the old
// matcher did.
const HTML_TAG_RE = /<(?:[^>"']|"[^"]*"|'[^']*')+>/g;
const HTML_MEDIA_RE = /<(script|style)\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/\1\s*>/gi;

/** @param {string} content */
function stripMarkup(content) {
  return content.replace(HTML_MEDIA_RE, ' ').replace(HTML_TAG_RE, ' ');
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
  const decoded = decodeEntities(stripMarkup(content));
  return decodeEntities(stripMarkup(decoded)).replace(/\s+/g, ' ').trim().slice(0, DESCRIPTION_CAP);
}
