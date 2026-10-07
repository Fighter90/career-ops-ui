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
  const detach = () => upstream?.removeEventListener?.('abort', onAbort);

  if (upstream) {
    if (upstream.aborted) onAbort();
    else upstream.addEventListener('abort', onAbort, { once: true });
  }

  let timer = null;
  if (ms > 0 && !ctrl.signal.aborted) {
    timer = setTimeout(() => {
      ctrl.abort(new DOMException(`scan fetch timed out after ${ms}ms`, 'TimeoutError'));
      // The timer can outlive the call (a response whose body is never read),
      // so it detaches itself rather than waiting for a clear() that may not come.
      detach();
    }, ms);
    // Ref'd while the request is in flight, so a pending fetch keeps the process
    // alive until it settles; see unref() for the body-read phase.
  }

  return {
    signal: ctrl.signal,
    clear() {
      if (timer) clearTimeout(timer);
      detach();
    },
    /** Once the headers are in, the timer only guards the body read and must not
     *  keep the process alive on its own. */
    unref() {
      timer?.unref?.();
    },
  };
}

import { withPinnedEncoding, guardResolvedHost } from './http-json.mjs';
import { isPrivateOrLoopbackHost } from './security.mjs';

/** Redirect hops the wrapper follows on a source's behalf before giving up. */
export const MAX_SCAN_REDIRECTS = 5;

// Response methods that read the body. The deadline stays armed until one of
// them settles, so a body that stalls after the headers is still cut off.
const BODY_READERS = ['text', 'json', 'arrayBuffer', 'blob', 'formData', 'bytes'];

// Headers a cross-origin hop must not carry (what fetch itself strips), plus the
// body headers a 301/302/303 → GET rewrite makes meaningless.
const CREDENTIAL_HEADERS = new Set(['authorization', 'cookie', 'proxy-authorization']);
const BODY_HEADERS = new Set(['content-type', 'content-length', 'content-encoding', 'content-language', 'content-location']);

function blockedRedirect(message, location) {
  const err = new Error(message);
  err.code = 'ECAREEROPS_BLOCKED_REDIRECT';
  err.location = location;
  return err;
}

function dropHeaders(headers, names) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) if (!names.has(k.toLowerCase())) out[k] = v;
  return out;
}

/** Release a 3xx body we are not going to read, so its socket goes back to the pool. */
function discardBody(res) {
  try { res.body?.cancel?.().catch?.(() => {}); } catch { /* stub without a stream */ }
}

/**
 * Wrap a base `fetch` so every call gets a timeout (combined with any
 * per-call `signal`). Drop-in `fetchImpl` for the scanners.
 *
 * The deadline covers the WHOLE request — headers and body. It is released
 * when the body has been read through one of the Response readers; if the
 * caller never reads it, the timer fires, aborts the request (freeing the
 * socket) and detaches itself.
 *
 * Redirects: most sources call this with no `redirect` option, which made
 * undici follow a 3xx anywhere — including to a private address. Unless the
 * caller picked a mode itself (`'error'` / `'manual'`, passed through as-is),
 * the wrapper follows redirects by hand: https targets only, no private /
 * loopback host (literal or by DNS answer), at most MAX_SCAN_REDIRECTS hops.
 *
 * @param {typeof fetch} [baseFetch]
 * @param {number} [ms]
 * @returns {typeof fetch}
 */
export function makeTimeoutFetch(baseFetch = fetch, ms = DEFAULT_SCAN_TIMEOUT_MS) {
  return async function timeoutFetch(url, opts = {}) {
    const deadline = withTimeout(opts.signal, ms);
    const { signal, clear } = deadline;
    let handedOff = false;
    try {
      // DNS-rebinding guard. http-json's helpers only run it when handed the
      // real global fetch — and the scanners never hand them that, they hand
      // them THIS wrapper — so without the check here the guard never ran on a
      // real scan. It no-ops for an injected test transport, and is raced
      // against the same timeout so a stalled resolver cannot hang the scan.
      // A Request object stringifies to a non-URL and fails open by design.
      const aborted = new Promise((_, reject) => {
        if (signal.aborted) reject(signal.reason);
        else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
      aborted.catch(() => {}); // a later timeout during the fetch itself must not surface as unhandled
      const guard = (target) => Promise.race([guardResolvedHost(baseFetch, target), aborted]);
      await guard(String(url));
      // The pin belongs HERE, not only in the http-json helpers: 25 of the 92
      // sources call the injected `fetchImpl` directly (greenhouse, lever,
      // ashby, workday, hh, rss, …) and never pass through them. This wrapper
      // is what both scanners actually inject, so it is the one chokepoint
      // every source shares — the parent gets the same guarantee for free
      // because `providers/_http.mjs` IS its only transport.
      const callerMode = opts.redirect;
      const followHere = (callerMode === undefined || callerMode === 'follow')
        && (typeof url === 'string' || url instanceof URL);
      let current = String(url);
      let req = { ...opts, headers: withPinnedEncoding(opts.headers), signal };
      if (!followHere) {
        const res = await baseFetch(url, req);
        handedOff = armBodyDeadline(res, deadline);
        return res;
      }
      for (let hop = 0; ; hop += 1) {
        const res = await baseFetch(current, { ...req, redirect: 'manual' });
        const location = res?.status >= 300 && res.status < 400 ? res.headers?.get?.('location') : null;
        if (!location) {
          handedOff = armBodyDeadline(res, deadline);
          return res;
        }
        discardBody(res);
        if (hop + 1 > MAX_SCAN_REDIRECTS) {
          throw new Error(`more than ${MAX_SCAN_REDIRECTS} redirects from ${String(url)}`);
        }
        let next;
        try { next = new URL(location, current); } catch {
          throw blockedRedirect(`invalid redirect target from ${current}`, location);
        }
        if (next.protocol !== 'https:') {
          throw blockedRedirect(`refusing non-https redirect to ${next.protocol}//${next.host}`, location);
        }
        if (isPrivateOrLoopbackHost(next.hostname)) {
          throw blockedRedirect(`refusing redirect to private host ${next.hostname}`, location);
        }
        await guard(next.href);
        // Same rewrites fetch applies: 303 (and 301/302 on POST) become a
        // body-less GET; a cross-origin hop loses its credentials.
        const status = res.status;
        const method = String(req.method || 'GET').toUpperCase();
        if (status === 303 ? method !== 'HEAD' : ((status === 301 || status === 302) && method === 'POST')) {
          req = { ...req, method: 'GET', body: undefined, headers: dropHeaders(req.headers, BODY_HEADERS) };
        }
        if (next.origin !== new URL(current).origin) {
          req = { ...req, headers: dropHeaders(req.headers, CREDENTIAL_HEADERS) };
        }
        current = next.href;
      }
    } finally {
      if (!handedOff) clear();
    }
  };

  /**
   * Keep the deadline armed until the body is read: wrap each reader so the
   * timer is released when it settles. Returns false (caller clears now) for a
   * response with nothing to wrap, e.g. a hand-rolled stub.
   */
  function armBodyDeadline(res, deadline) {
    if (!res || typeof res !== 'object') return false;
    const { clear } = deadline;
    let wrapped = false;
    for (const name of BODY_READERS) {
      const original = res[name];
      if (typeof original !== 'function') continue;
      wrapped = true;
      res[name] = async function readBody(...args) {
        try { return await original.apply(res, args); } finally { clear(); }
      };
    }
    if (wrapped) deadline.unref();
    return wrapped;
  }
}
