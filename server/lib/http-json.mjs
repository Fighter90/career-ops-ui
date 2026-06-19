/**
 * Tiny JSON-over-fetch helper for the config-driven scanner sources
 * (Glints / Jobstreet / IBM / Arbeitsagentur), ported alongside parent
 * career-ops v1.12.0.
 *
 * Lives OUTSIDE server/lib/sources/ on purpose: the source registry
 * auto-imports every `*.mjs` in that folder looking for a `meta` export, so a
 * helper there would log a skip-warning on every boot. Keeping it here avoids
 * that noise while staying reusable.
 *
 * Mirrors the parent providers' `ctx.fetchJson(url, opts)` contract:
 *   - GET by default; POST when `method`/`body` are supplied.
 *   - `redirect: 'error'` by default — refuses to follow server-side
 *     redirects, which closes the SSRF redirect vector the parent guards.
 *   - Throws an Error with `.status` on a non-2xx response so callers can
 *     branch on outage vs empty-result.
 */

/**
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string,string>, body?: string,
 *           signal?: AbortSignal, redirect?: 'error'|'follow'|'manual' }} [opts]
 * @returns {Promise<any>}
 */
export async function fetchJson(fetchImpl, url, opts = {}) {
  const { method = 'GET', headers = {}, body, signal, redirect = 'error' } = opts;
  const res = await fetchImpl(url, { method, headers, body, signal, redirect });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} (${url})`);
    err.status = res.status;
    throw err;
  }
  try {
    return await res.json();
  } catch (e) {
    // A 2xx that isn't JSON (e.g. an HTML error/maintenance page served with
    // status 200) would otherwise surface as a bare SyntaxError. Wrap it so the
    // scanner's per-source error log says which endpoint misbehaved.
    throw new Error(`non-JSON 2xx response from ${url}: ${e.message}`);
  }
}

/**
 * Abort-aware delay. Resolves after `ms`, or immediately if `signal` is (or
 * becomes) aborted — so a courtesy rate-limit pause between pagination pages
 * can't hold a scan open after the client disconnects.
 *
 * @param {number} ms
 * @param {AbortSignal} [signal]
 */
export function delay(ms, signal) {
  if (!ms || ms <= 0 || signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', done);
      resolve();
    }
    signal?.addEventListener?.('abort', done, { once: true });
  });
}
