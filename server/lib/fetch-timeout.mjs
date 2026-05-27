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

export const DEFAULT_SCAN_TIMEOUT_MS = Number(process.env.SCAN_FETCH_TIMEOUT_MS) || 15000;

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
export function makeTimeoutFetch(baseFetch = fetch, ms = DEFAULT_SCAN_TIMEOUT_MS) {
  return async function timeoutFetch(url, opts = {}) {
    const { signal, clear } = withTimeout(opts.signal, ms);
    try {
      return await baseFetch(url, { ...opts, signal });
    } finally {
      clear();
    }
  };
}
