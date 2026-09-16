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
 * host, drop NON-IDENTITY fragments and a single trailing slash, remove a narrow denylist
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
 * `decodeURIComponent` throws `URIError` on a malformed percent-escape, and the
 * id here comes straight off a scraped URL. A bad escape means "no usable id",
 * not "abort the key" — mirrors the null-returning shape of `_safe-url.mjs`.
 * @param {string} raw
 * @returns {string|null}
 */
function safeDecode(raw) {
  try { return decodeURIComponent(raw) || null; } catch { return null; }
}

/**
 * Promote a known identity-bearing SPA fragment into a functional query key
 * before generic normalization drops the fragment.
 *
 * Most fragments are presentation-only (`#apply`, `#section-2`) and must
 * collapse. `#/job/{id}` and `#/jobs/{id}` are the narrow exception: on these
 * boards every posting shares the tenant path and the id exists ONLY in the
 * fragment, so dropping it made every job on a tenant compare equal — the
 * silent over-merge this module's header calls the worse failure mode. MokaHR
 * is the case in our own registry (`…/social-recruitment/{tenant}/{id}#/job/{n}`).
 *
 * MokaHR keeps its established board-specific key so previously-written keys
 * stay comparable; every other host gets the internal `_career_ops_*` name.
 * `append`, not `set`: a URL that already carries the comparison param holds a
 * different posting's id, and overwriting it would merge the two.
 *
 * The emitted/displayed URL is untouched — this mutates only the URL object
 * used to build the comparison key.
 * @param {URL} url
 */
export function promoteKnownFragmentIdentity(url) {
  const match = /^#\/jobs?\/([^/?#]+)(?:\?[^#]*)?$/i.exec(url.hash);
  if (!match) return;
  const jobId = safeDecode(match[1]);
  if (!jobId) return;
  if (url.hostname.toLowerCase() === 'app.mokahr.com') {
    url.searchParams.append('mokahr_job_id', jobId);
    return;
  }
  url.searchParams.append('_career_ops_fragment_job_id', jobId);
}

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
  promoteKnownFragmentIdentity(u);
  u.hash = '';                      // an unrecognized fragment does not identify it

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
