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
 * Browser-like User-Agent for sources that must clear WAF/CDN bot management
 * blocking a generic UA outright (seen live upstream: Glints' firewall,
 * Cloudflare-gated Workday tenants). Shared so every source working around
 * such a block bumps one constant instead of drifting Chrome versions
 * independently per file. Mirrors parent career-ops `providers/_http.mjs`.
 */
export const BROWSER_LIKE_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * undici's `err.cause.message` for a `fetch(url, { redirect: 'error' })` that
 * meets a 3xx. Undocumented and undici-internal, so it is pinned here (and by a
 * test) — if a Node upgrade changes the wording, `fetchJsonWithRetry` reverts to
 * over-retrying a deterministic failure, which the test catches loudly. Mirrors
 * parent career-ops `providers/_http.mjs` (#2657).
 */
export const REDIRECT_REFUSAL_CAUSE_MESSAGE = 'unexpected redirect';

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
 * Text-over-fetch sibling of {@link fetchJson} for sources whose feed is not
 * JSON (e.g. Personio's public XML jobs feed). Same contract: GET by default,
 * `redirect: 'error'` to close the SSRF redirect vector, and an Error with
 * `.status` on a non-2xx response.
 *
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string,string>, body?: string,
 *           signal?: AbortSignal, redirect?: 'error'|'follow'|'manual' }} [opts]
 * @returns {Promise<string>}
 */
export async function fetchText(fetchImpl, url, opts = {}) {
  const { method = 'GET', headers = {}, body, signal, redirect = 'error' } = opts;
  const res = await fetchImpl(url, { method, headers, body, signal, redirect });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} (${url})`);
    err.status = res.status;
    throw err;
  }
  return await res.text();
}

/**
 * Retrying sibling of {@link fetchJson} for feeds that paginate into the
 * hundreds of pages, where a single transient upstream blip mid-sweep used to
 * abort the whole provider and return nothing (parent career-ops #2506,
 * `providers/_http.mjs::fetchJsonWithRetry`). Retries ONLY transient failures —
 * HTTP 429, HTTP ≥ 500, and network/timeout errors that carry no `.status` —
 * with an abort-aware backoff. A permanent 4xx (e.g. 404) is NOT retried: it is
 * rethrown immediately so the caller's dead-board logic still fires. Once the
 * retry budget is exhausted the last error propagates unchanged, so the caller
 * decides throw-vs-keep-partials exactly as it would for a single fetch.
 *
 * A **refused redirect** (our `redirect: 'error'` SSRF guard meeting a 3xx)
 * surfaces from undici as a bare `TypeError` with no `.status` — the same shape
 * as a transient network error — but it is deterministic and will never succeed
 * on retry, so retrying it just burns the whole budget before failing. It is
 * distinguished by `err.cause.message === 'unexpected redirect'` and classified
 * non-retryable (parent career-ops #2657; the wording is undici-internal and
 * pinned by a test so a silent revert to over-retrying fails loudly. Node < 18.5
 * reports `cause` as undefined, so the check simply doesn't fire there and the
 * old — retryable — classification stands).
 *
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string,string>, body?: string,
 *           signal?: AbortSignal, redirect?: 'error'|'follow'|'manual',
 *           retries?: number, retryDelayMs?: number }} [opts]
 * @returns {Promise<any>}
 */
export async function fetchJsonWithRetry(fetchImpl, url, opts = {}) {
  const { retries = 2, retryDelayMs = 500, signal, ...rest } = opts;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchJson(fetchImpl, url, { ...rest, signal });
    } catch (err) {
      lastErr = err;
      const status = err && typeof err.status === 'number' ? err.status : undefined;
      // A refused redirect looks like a no-status network error but is
      // deterministic — never retry it (parent #2657).
      const redirectRefusal = status === undefined
        && err instanceof TypeError
        && err?.cause?.message === REDIRECT_REFUSAL_CAUSE_MESSAGE;
      // Transient = 429, any 5xx, or a network/timeout error (no HTTP status).
      // A permanent 4xx is not worth retrying — rethrow now.
      const transient = !redirectRefusal
        && (status === undefined || status === 429 || status >= 500);
      if (!transient || attempt === retries || signal?.aborted) throw err;
      await delay(retryDelayMs, signal);
    }
  }
  throw lastErr;
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
