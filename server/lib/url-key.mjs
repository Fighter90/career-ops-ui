/**
 * url-key.mjs — canonical posting-URL key for deterministic dedup.
 *
 * Two URLs that point to the same job posting must collapse to the same key, so
 * the scanner and the pipeline can recognise a re-listing instead of recording
 * it as a brand-new job (a duplicate scan-history row, a duplicate pipeline
 * line, and a wasted evaluation).
 *
 * UNDER-STRIP ON PURPOSE — the two failure modes are asymmetric:
 *   - over-normalizing merges two genuinely different postings into one key
 *     → a SILENT loss (the bug this fixes, in reverse);
 *   - under-normalizing leaves two spellings of the SAME posting as two keys
 *     → a VISIBLE duplicate you can see and clean up.
 * So we only: force https (http vs https is the same posting), lowercase the
 * host, drop the fragment and a single trailing slash, remove a narrow denylist
 * of click/campaign params, and sort the rest for order-independence. Every
 * FUNCTIONAL query param is kept (e.g. gh_jid, the canonical posting id on some
 * corporate Greenhouse boards). Generic names (ref/source/src) are deliberately
 * NOT stripped — they are functional on some boards, and stripping them would
 * merge two distinct postings.
 *
 * NO KEY IS NOT A KEY. An input that is not a usable http(s) URL returns '' —
 * never a lowercased-string stand-in. A placeholder ("N/A", "TBD", "—") is a
 * MISSING value; returning a shared key for all of them would make unrelated
 * rows compare equal. Callers must treat '' as "unknown", never as a value that
 * can match another ''.
 */

// Query params that identify a click/campaign, never the posting itself. Keep
// this list literal and narrow — see the module note on why generic names are
// absent.
const TRACKING_PARAMS = [
  /^utm_/i, /^gh_src$/i, /^fbclid$/i, /^gclid$/i,
  /^mc_cid$/i, /^mc_eid$/i, /^igshid$/i, /^_hsenc$/i, /^_hsmi$/i, /^trk$/i, /^trackingid$/i,
];

/**
 * Reduce a posting URL to a stable comparison key.
 * @param {unknown} raw
 * @returns {string} the canonical key, or '' when there is nothing to key on.
 */
export function normalizeUrl(raw) {
  if (typeof raw !== 'string') return '';
  const s = raw.trim();
  if (!s) return '';

  let u;
  try {
    u = new URL(s);
  } catch {
    return ''; // placeholder / free text / non-absolute → no key
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';

  u.protocol = 'https:';
  u.hostname = u.hostname.toLowerCase();
  u.hash = '';

  const keep = [];
  for (const [k, v] of u.searchParams.entries()) {
    if (!TRACKING_PARAMS.some((re) => re.test(k))) keep.push([k, v]);
  }
  keep.sort((x, y) => (x[0] !== y[0] ? (x[0] < y[0] ? -1 : 1) : (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0)));
  u.search = '';
  for (const [k, v] of keep) u.searchParams.append(k, v);

  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.slice(0, -1);
  }

  return u.toString();
}

export default normalizeUrl;
