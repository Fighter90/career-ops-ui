/**
 * _safe-url.mjs — encodeURIComponent for a job-URL path segment that returns
 * null on a lone surrogate instead of throwing URIError.
 *
 * Ported from parent career-ops `providers/_safe-url.mjs` (#3513, parent HEAD
 * after 1.32.0). Same contract, same scope, same reasoning.
 *
 * encodeURIComponent throws URIError when its argument holds a lone UTF-16
 * surrogate — a high (0xD800–0xDBFF) or low (0xDC00–0xDFFF) code unit without
 * its partner. A JSON string can carry one (`"\uD800"` survives JSON.parse), so
 * a job id / slug / refnr taken straight from an API response can arrive
 * ill-formed. A source that builds job URLs in a `.map()` / `for` loop and
 * encodes once per posting then drops JUST the bad posting on a null return,
 * instead of one URIError aborting the loop and losing every job on the page.
 *
 * The failure return is null — never the raw value, never a U+FFFD-substituted
 * `toWellFormed()` result. A lone surrogate in a job URL would flow on into
 * scan-history.tsv, the tracker and generated documents as ill-formed UTF-8,
 * and several sources use the encoded value as a dedup key, where substitution
 * would collide distinct bad postings onto one key.
 *
 * Scope: a host-controlled value from an API response becoming a URL path
 * segment inside a loop. Config-derived values (a portals.yml company slug, a
 * search keyword, a locale), calls already inside their own try/catch, and
 * values already checked against a slug charset do NOT need it — and for the
 * config case, dropping a real job over a bad config character is the wrong
 * trade: that should fail loud, once, outside the loop.
 */

/**
 * encodeURIComponent(String(value)), returning null instead of throwing
 * URIError when `value` contains a lone surrogate.
 *
 * @param {unknown} value
 * @returns {string | null} the encoded string, or null when `value` cannot be
 *   URI-encoded. Callers drop the job on null.
 */
export function safeEncodeURIComponent(value) {
  // Coerce OUTSIDE the try: only a URIError from encodeURIComponent itself (a
  // lone surrogate) becomes null. One thrown by the value's own toString is a
  // caller bug and must propagate.
  const str = String(value);
  try {
    return encodeURIComponent(str);
  } catch (err) {
    if (err instanceof URIError) return null;
    throw err;
  }
}
