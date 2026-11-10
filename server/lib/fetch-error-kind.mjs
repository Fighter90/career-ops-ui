// CAR-256 (parent parity, upstream #6675) — how a failed board fetch is
// classified, and whether the failure is TRANSIENT (worth one retry after
// the sweep).
//
// Mirrors the parent scan.mjs's classifyFetchError kinds: a transient error
// is a network-level failure (abort / refused / timed out / "fetch failed")
// or an HTTP 5xx — a retry a few seconds later, without the burst that
// caused it, can genuinely succeed. A 404/410 (slug gone) or a 401/403
// (auth) will not change in seconds, so they are never retried.

/**
 * @param {unknown} err
 * @returns {'network'|'slug_gone'|'auth'|'server'|'unknown'}
 */
export function classifyFetchErrorKind(err) {
  if (!err) return 'unknown';
  if (/** @type {any} */ (err).name === 'AbortError') return 'network';
  const msg = String(/** @type {any} */ (err).message || err);
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed|network/i.test(msg)) return 'network';
  const status = /** @type {any} */ (err).status;
  if (status === 404 || status === 410) return 'slug_gone';
  if (status === 401 || status === 403) return 'auth';
  if (typeof status === 'number' && status >= 500) return 'server';
  if (/HTTP 404|HTTP 410/.test(msg)) return 'slug_gone';
  if (/HTTP 401|HTTP 403/.test(msg)) return 'auth';
  if (/HTTP 5\d\d/.test(msg)) return 'server';
  return 'unknown';
}

const TRANSIENT_KINDS = new Set(['network', 'server']);

/**
 * Whether a failed board fetch is worth one post-sweep retry.
 * @param {unknown} err
 * @returns {boolean}
 */
export function isTransientFetchError(err) {
  return TRANSIENT_KINDS.has(classifyFetchErrorKind(err));
}
