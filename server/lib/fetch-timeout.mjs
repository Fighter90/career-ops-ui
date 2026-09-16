/**
 * Per-request fetch timeout for the portal scanners (v1.63.0).
 *
 * Source modules call `fetchImpl(url, { signal })` with no deadline, so a
 * stalled upstream (e.g. api.hh.ru from a blocked IP) used to HANG the whole
 * scan. The scanners now inject `makeTimeoutFetch()` as their default
 * `fetchImpl`, giving every source request a hard deadline. A timed-out
 * request rejects with a TimeoutError, which the scanners already catch and
 * record as a per-source error — so the scan skips it and continues instead
 * of freezing.
 *
 * Node-18 safe: builds a combined AbortSignal by hand (no `AbortSignal.any`).
 */

// v1.68.1 — raised 10000 → 60000 (one minute). 10s failed fast but also cut
// off slow-but-alive Ashby boards that just needed more time; user preference
// is to wait up to a minute so those return. NB: a genuinely dead/hung source
// now holds a concurrency slot for the full 60s, so a worst-case scan is
// slower — the chronic hangers (Perplexity, Supabase, Resend, …) likely still
// time out. A per-source / lower-Ashby-concurrency fix would address those
// properly. Override with SCAN_FETCH_TIMEOUT_MS.
export const DEFAULT_SCAN_TIMEOUT_MS = Number(process.env.SCAN_FETCH_TIMEOUT_MS) || 60000;

/**
 * Combine an upstream abort signal with a timeout. Returns the combined
 * `signal` plus a `clear()` the caller MUST run in a `finally` (cancels the
 * timer + detaches the listener — no leaks).
 *
 * @param {AbortSignal|undefined} upstream
 * @param {number} ms
 * @returns {{ signal: AbortSignal, clear: () => void }}
 */
export function withTimeout(upstream, ms = DEFAULT_SCAN_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const onAbort = () => {
    try { ctrl.abort(upstream?.reason); } catch { ctrl.abort(); }
  };

  if (upstream) {
    if (upstream.aborted) onAbort();
    else upstream.addEventListener('abort', onAbort, { once: true });
  }

  let timer = null;
  if (ms > 0 && !ctrl.signal.aborted) {
    timer = setTimeout(() => {
      ctrl.abort(new DOMException(`scan fetch timed out after ${ms}ms`, 'TimeoutError'));
    }, ms);
    // NB: not unref'd on purpose — the timer is always cancelled in clear()
    // (run from a finally), so it never outlives the request it guards.
  }

  return {
    signal: ctrl.signal,
    clear() {
      if (timer) clearTimeout(timer);
      upstream?.removeEventListener?.('abort', onAbort);
    },
  };
}

/**
 * Wrap a base `fetch` so every call gets a timeout (combined with any
 * per-call `signal`). Drop-in `fetchImpl` for the scanners.
 *
 * @param {typeof fetch} [baseFetch]
 * @param {number} [ms]
 * @returns {typeof fetch}
 */
import { withPinnedEncoding } from './http-json.mjs';

export function makeTimeoutFetch(baseFetch = fetch, ms = DEFAULT_SCAN_TIMEOUT_MS) {
  return async function timeoutFetch(url, opts = {}) {
    const { signal, clear } = withTimeout(opts.signal, ms);
    try {
      // The pin belongs HERE, not only in the http-json helpers: 25 of the 92
      // sources call the injected `fetchImpl` directly (greenhouse, lever,
      // ashby, workday, hh, rss, …) and never pass through them. This wrapper
      // is what both scanners actually inject, so it is the one chokepoint
      // every source shares — the parent gets the same guarantee for free
      // because `providers/_http.mjs` IS its only transport.
      return await baseFetch(url, { ...opts, headers: withPinnedEncoding(opts.headers), signal });
    } finally {
      clear();
    }
  };
}
