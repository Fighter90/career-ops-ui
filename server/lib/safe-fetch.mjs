/**
 * v1.20.1 (B-1) — DNS-rebind-safe GET fetcher.
 *
 * Closes the TOCTOU window between an explicit `dnsLookup` and the
 * second lookup `fetch()` does internally. The previous pattern was:
 *
 *   1. dnsLookup(host) → address A   (checked against isPrivateOrLoopbackHost)
 *   2. fetch(url)                    (does its OWN lookup → could get address B)
 *
 * A DNS rebind attacker controls a hostname with TTL=0 and serves:
 *   - public IP on lookup 1 (passes private-IP check)
 *   - 127.0.0.1 / 169.254.169.254 / a LAN address on lookup 2
 *
 * This module resolves ONCE, pins the connection to the validated
 * address, and sets SNI/Host so cert validation and virtual hosting
 * still target the original hostname. The single source of truth for
 * the resolved IP is `requestOpts.host`/`hostname` set explicitly
 * before connect — there is no second lookup.
 *
 * Scope: GET only, follows HTTP redirects with per-hop re-validation,
 * caps body size in bytes, honours AbortSignal. Used by:
 *   - /api/pipeline/preview      (SSRF-safe upstream preview)
 *   - /api/auto-pipeline         (JD fetch step)
 *
 * Why a hand-rolled fetch and not undici Agent:
 *   - undici isn't directly importable in Node 20 stable
 *     (`import { Agent } from 'undici'` requires the npm package)
 *   - Adding undici as a runtime dep contradicts CLAUDE.md's
 *     "no new runtime deps lightly" rule
 *   - Native http/https with `lookup` and `servername` covers our
 *     use-case (GET, redirect, body cap) with no new dep
 */
import http from 'node:http';
import https from 'node:https';
import { promises as dns } from 'node:dns';
import { isPrivateOrLoopbackHost, isValidJobUrl } from './security.mjs';

const MAX_REDIRECTS = 3;

/**
 * FULL-M6a — credential-bearing caller headers. These are aimed at the
 * origin the caller addressed; a redirect (even a per-hop-validated one)
 * must not deliver them to a different origin.
 */
const CREDENTIAL_HEADERS = new Set(['authorization', 'cookie']);

/**
 * Drop credential headers from a caller-supplied header object
 * (case-insensitive). Non-credential headers pass through untouched.
 */
function stripCredentialHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    if (CREDENTIAL_HEADERS.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out;
}

// ─── Test-only transport hook ─────────────────────────────────────
//
// Tests need to exercise the redirect / size-cap / status-mapping
// logic without binding a real socket. The fetch-mock pattern in
// `tests/pipeline-preview.test.mjs` worked when the SSRF path used
// `globalThis.fetch`; the v1.20.1 rewrite uses node:http directly so
// fetch-mock no longer intercepts. Instead, tests call _setTransport()
// to inject a stub that returns `{ status, headers, body, location }`
// for any URL+pinned-IP pair. Production callers never touch this
// hook — the default transport hits the real network through
// http(s).request and is unaffected.
let _transport = defaultTransport;

/** @type {(url: URL, pinned: {address:string,family:4|6}, opts: object) => Promise<{status:number,headers:Record<string,string>,body:Buffer,location?:string}>} */
export function _setTransport(fn) {
  const prev = _transport;
  _transport = fn || defaultTransport;
  return () => { _transport = prev; };
}

/**
 * v1.248.5 — test hook: replace the resolver itself, so a suite can run
 * fully offline (the transport stub alone does not remove the real DNS
 * lookup in resolvePinned). fn: async (hostname, opts) => { address, family }.
 */
let _lookupOverride = null;
export function _setLookup(fn) {
  const prev = _lookupOverride;
  _lookupOverride = fn || null;
  return () => { _lookupOverride = prev; };
}

/**
 * FULL-M6b — test hook: the real node:http transport, exposed so a suite
 * can drive it against a 127.0.0.1 test server (resolvePinned refuses
 * loopback, so safeGet itself can never reach one). Never used in
 * production paths.
 */
export function _defaultTransport() {
  return defaultTransport(...arguments);
}

/**
 * Resolve hostname → address pair (v4 preferred for compatibility) and
 * reject if it points into private/loopback space.
 * Fail-CLOSED on lookup error: an error here is either a typo, a stub,
 * or a hostile resolver — none of which we should silently proceed past.
 */
async function resolvePinned(hostname) {
  let res;
  try {
    res = _lookupOverride
      ? await _lookupOverride(hostname, { verbatim: true })
      : await dns.lookup(hostname, { verbatim: true });
  } catch (e) {
    throw new Error(`DNS lookup failed for ${hostname}: ${e.code || e.message}`);
  }
  if (isPrivateOrLoopbackHost(res.address)) {
    throw new Error(`host ${hostname} resolves to private address ${res.address}`);
  }
  return res;
}

/**
 * Single HTTP/HTTPS request to a pinned address. Does NOT follow
 * redirects — the redirect chain is handled by the wrapper so each hop
 * gets its own validation.
 *
 * @param {URL} url
 * @param {{ address: string, family: 4|6 }} pinned
 * @param {{ signal?: AbortSignal, headers?: Record<string,string> }} opts
 * @returns {Promise<{ status: number, headers: Record<string,string>, body: Buffer, location?: string }>}
 */
function defaultTransport(url, pinned, opts = {}) {
  const lib = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    // FULL-M6b — declared before the response callback closes over it, so
    // every settle path below can detach the abort listener.
    let detachAbort = () => {};
    const req = lib.request({
      // Pin the connection to the pre-validated address. Setting both
      // `host` and `hostname` here side-steps lib's own lookup.
      host: pinned.address,
      hostname: pinned.address,
      family: pinned.family,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      // Keep TLS cert validation targeting the ORIGINAL hostname.
      servername: url.protocol === 'https:' ? url.hostname : undefined,
      headers: {
        // Virtual hosts route by the Host header — must be the original
        // hostname even though we're connecting to an IP.
        Host: url.host,
        ...(opts.headers || {}),
      },
    }, (res) => {
      const chunks = [];
      let received = 0;
      let settled = false;
      const cap = opts.maxBytes || 1024 * 1024;
      // Resolve exactly once. On a cap-hit we `res.destroy()` and settle here
      // directly, because a destroyed IncomingMessage never emits 'end' — relying
      // on 'end' alone would hang the request until the AbortSignal timeout.
      const settle = () => {
        if (settled) return;
        settled = true;
        detachAbort();
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
          location: res.headers.location,
        });
      };
      res.on('data', (chunk) => {
        received += chunk.length;
        if (received > cap) {
          // Cut the body off cleanly, drop the rest of the stream, and settle now.
          chunks.push(chunk.slice(0, chunk.length - (received - cap)));
          res.destroy();
          settle();
        } else {
          chunks.push(chunk);
        }
      });
      res.on('end', settle);
      res.on('error', (err) => { detachAbort(); if (!settled) reject(err); });
    });
    if (opts.signal) {
      // FULL-M6 review — the error listener MUST be registered before any
      // destroy(): on a pre-aborted signal the old code destroyed the request
      // and returned before `req.on('error')` existed — Node emits 'error'
      // asynchronously with no listener → uncaughtException → process crash
      // (reviewer reproduced). Also detach on the abort path itself.
      req.on('error', (err) => { detachAbort(); reject(err); });
      if (opts.signal.aborted) {
        req.destroy(new Error('aborted'));
        return reject(new Error('aborted'));
      }
      const onAbort = () => {
        req.destroy(new Error('aborted'));
        reject(new Error('aborted'));
      };
      opts.signal.addEventListener('abort', onAbort, { once: true });
      // FULL-M6b — `{ once: true }` only removes the listener when it FIRES;
      // a signal that never aborts kept one listener per request forever (the
      // redirect loop shares one signal across hops → per-hop pile-up).
      detachAbort = () => opts.signal.removeEventListener('abort', onAbort);
    } else {
      req.on('error', (err) => { detachAbort(); reject(err); });
    }
    req.end();
  });
}

/**
 * DNS-rebind-safe GET. Follows HTTP redirects up to MAX_REDIRECTS hops,
 * re-validating EACH redirect target through isValidJobUrl + DNS pinning.
 *
 * @param {string} urlString
 * @param {{ signal?: AbortSignal, timeoutMs?: number, headers?: Record<string,string>, maxBytes?: number, userAgent?: string }} opts
 * @returns {Promise<{ status: number, text: string, finalUrl: string }>}
 */
export async function safeGet(urlString, opts = {}) {
  // `timeoutMs` bounds the WHOLE call (every hop of the redirect chain). Node's
  // http.request has no default socket timeout, so without this a hanging
  // origin holds the request open forever. FULL-M2 (a): when the caller ALSO
  // passes its own `signal`, the two are COMBINED — the deadline is no longer
  // dropped, so a tar-pit origin cannot out-wait a caller that only wanted
  // cancel-ability. The caller's abort still wins (same reason propagates), and
  // an already-aborted caller signal passes through unchanged.
  let timer = null;
  // Detaches the caller-signal bridge on settle, so a long-lived scan signal
  // does not accumulate one listener per safeGet call.
  let detachCaller = () => {};
  let signal = opts.signal;
  if (!signal && Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0) {
    const ac = new AbortController();
    timer = setTimeout(() => ac.abort(), opts.timeoutMs);
    signal = ac.signal;
  } else if (signal && !signal.aborted && Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0) {
    const caller = signal;
    const ac = new AbortController();
    const onCallerAbort = () => {
      try { ac.abort(caller.reason); } catch { ac.abort(); }
    };
    caller.addEventListener('abort', onCallerAbort, { once: true });
    detachCaller = () => caller.removeEventListener('abort', onCallerAbort);
    timer = setTimeout(() => {
      ac.abort(new DOMException(`safeGet timed out after ${opts.timeoutMs}ms`, 'TimeoutError'));
    }, opts.timeoutMs);
    signal = ac.signal;
  }
  try {
    return await _safeGetInner(urlString, opts, signal);
  } finally {
    if (timer) clearTimeout(timer);
    detachCaller();
  }
}

async function _safeGetInner(urlString, opts, signal) {
  let current = urlString;
  let hops = 0;
  // FULL-M6a — credentials ride only the origin the caller addressed.
  const origin0 = new URL(urlString).origin;
  while (true) {
    const u = new URL(current);
    if (!['http:', 'https:'].includes(u.protocol)) {
      throw new Error(`unsupported protocol: ${u.protocol}`);
    }
    const pinned = await resolvePinned(u.hostname);
    const callerHeaders = u.origin === origin0
      ? (opts.headers || {})
      : stripCredentialHeaders(opts.headers);
    const res = await _transport(u, pinned, {
      signal,
      maxBytes: opts.maxBytes,
      headers: {
        'User-Agent': opts.userAgent || 'career-ops-ui/1.20.1',
        Accept: 'text/html,application/xhtml+xml,text/plain',
        ...callerHeaders,
      },
    });
    const isRedirect = res.status >= 300 && res.status < 400 && res.location;
    if (!isRedirect) {
      // `binary: true` returns the raw Buffer + content-type (for images like
      // favicons) instead of a utf8-decoded string. All the SSRF protections
      // above — DNS-pinned transport, redirect-target validation, the maxBytes
      // cap — apply identically; only the body decoding differs.
      if (opts.binary) {
        return {
          status: res.status,
          buffer: res.body,
          contentType: (res.headers && res.headers['content-type']) || '',
          finalUrl: current,
        };
      }
      return {
        status: res.status,
        text: res.body.toString('utf8'),
        finalUrl: current,
      };
    }
    if (++hops > MAX_REDIRECTS) {
      throw new Error(`>${MAX_REDIRECTS} redirects from ${urlString}`);
    }
    const next = new URL(res.location, current).toString();
    if (!isValidJobUrl(next)) {
      throw new Error('unsafe redirect target');
    }
    current = next;
  }
}
