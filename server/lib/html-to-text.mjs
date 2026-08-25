// Shared HTML → plain-text pipeline for sources whose payloads embed
// description markup. Greenhouse's contentToText was the first instance; this
// is the extracted form so later sources cannot grow a divergent copy — the
// same rationale that produced html-entities.mjs when entity decoders drifted.
import { decodeEntities } from './html-entities.mjs';

// Capped like greenhouse/alibaba full-text JDs: a 10 KB/posting body is normal
// on these boards, and scan payloads must stay sane.
export const DESCRIPTION_CAP = 4000;

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
  const html = decodeEntities(content);
  const noMedia = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  return decodeEntities(noMedia.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, DESCRIPTION_CAP);
}
