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
 * Provides the `fetchJson(url, opts)` contract:
 *   - GET by default; POST when `method`/`body` are supplied.
 *   - `redirect: 'error'` by default — refuses to follow server-side
 *     redirects, which closes the SSRF redirect vector.
 *   - Throws an Error with `.status` on a non-2xx response so callers can
 *     branch on outage vs empty-result.
 *   - DNS-rebinding defence-in-depth (v1.221.0): on the REAL network path only,
 *     the URL's hostname is resolved and rejected if it points at a
 *     private/loopback/cloud-metadata address before the fetch. Scanner hosts
 *     are already pinned to public registrable domains, so this only bites a
 *     misconfigured source or a hostile record; the user-URL path has stronger
 *     connection-pinning in `safe-fetch.mjs`.
 */
import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { isPrivateOrLoopbackHost } from './security.mjs';

/**
 * Test-only resolver hook (mirrors safe-fetch.mjs `_setLookup`): a suite can
 * force resolver outcomes without touching real DNS. fn: async (hostname,
 * opts) => answers-array. Production callers never touch this hook.
 */
let _guardLookupOverride = null;
export function _setGuardLookup(fn) {
  const prev = _guardLookupOverride;
  _guardLookupOverride = fn || null;
  return () => { _guardLookupOverride = prev; };
}

/**
 * DNS-rebinding guard for the scanner fetch path. Runs ONLY when the real
 * global `fetch` is the transport — a test's injected `fetchImpl` supplies the
 * response itself, and its URL is often a stub host that would not resolve, so
 * validating there would break the mocked suites for no security gain.
 *
 * Fail-open on a resolver error USED to be the stance (v1.221.0): "a hostname
 * that will not resolve cannot be connected to either". FULL-M2 closes it:
 * a hostile resolver wins the TOCTOU race exactly by FAILING the guard's
 * lookup and answering a private address on fetch's own second lookup — the
 * one bypass this resolve-time check exists to close. A resolver error here
 * is a stub, an outage, or an attack; none of them should be silently
 * proceeded past (safe-fetch.mjs' resolvePinned has failed closed for the
 * same reason since v1.20.1). The refusal is tagged `ssrfRefused` so the
 * retry helpers classify it deterministic and never burn the retry budget.
 *
 * CAR-90: an IPv6 LITERAL must never reach the resolver. `new URL(u).hostname`
 * keeps the brackets (`[::1]`), `dns.lookup` throws ENOTFOUND on the bracketed
 * form, and the fail-open catch above let `fetch` connect straight to the
 * loopback / cloud-metadata address the guard exists to refuse. A literal IP
 * needs no resolution at all — classify it directly and never consult DNS.
 *
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 */
export async function guardResolvedHost(fetchImpl, url) {
  if (fetchImpl !== globalThis.fetch) return;
  let hostname;
  try { hostname = new URL(url).hostname; } catch { return; }
  if (!hostname) return;
  // Strip the URL parser's IPv6 brackets, then short-circuit literals: an
  // address in the URL is the address fetch will connect to, so the private/
  // loopback classification is final without any lookup.
  const bare = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
  if (isIP(bare)) {
    if (isPrivateOrLoopbackHost(bare)) {
      const err = new Error(`Refusing to fetch ${hostname}: literal non-public address ${bare}`);
      err.code = 'ECAREEROPS_BLOCKED_ADDRESS';
      // FULL-R2 review: tagged so the retry helpers classify the refusal as
      // deterministic — a blocked address is not a transient network error
      // and must never be retried.
      err.ssrfRefused = true;
      err.hostname = hostname;
      err.address = bare;
      throw err;
    }
    return;
  }
  let answers;
  try {
    answers = _guardLookupOverride
      ? await _guardLookupOverride(bare, { all: true, verbatim: true })
      : await dns.lookup(bare, { all: true, verbatim: true });
  } catch (e) {
    // FULL-M2: fail CLOSED on a resolver error (see the header comment) —
    // a resolve failure is never a pass.
    const err = new Error(`Refusing to fetch ${hostname}: DNS lookup failed (${e?.code || e?.message || 'unknown'})`);
    err.code = 'ECAREEROPS_BLOCKED_DNS';
    err.ssrfRefused = true;
    err.hostname = hostname;
    throw err;
  }
  // Every answer, not just the first: the connection may use any of them, so a
  // record set that mixes a public and a private address is refused.
  const list = Array.isArray(answers) ? answers : [answers];
  const address = list.map((a) => a && a.address).find((a) => isPrivateOrLoopbackHost(a));
  if (address) {
    const err = new Error(`Refusing to fetch ${hostname}: resolves to non-public address ${address}`);
    err.code = 'ECAREEROPS_BLOCKED_ADDRESS';
    err.ssrfRefused = true;
    err.hostname = hostname;
    err.address = address;
    throw err;
  }
}

/**
 * Browser-like User-Agent for sources that must clear WAF/CDN bot management
 * blocking a generic UA outright (seen live upstream: Glints' firewall,
 * Cloudflare-gated Workday tenants). Shared so every source working around
 * such a block bumps one constant instead of drifting Chrome versions
 * independently per file.
 */
export const BROWSER_LIKE_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

/**
 * macOS-flavoured browser UA. Some tenants' WAFs treat the Windows string
 * above as automation and 403 it while serving this one — Feishu Jobs is the
 * live case. Ported from parent career-ops v1.31.0.
 */
export const MACOS_BROWSER_LIKE_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/**
 * accept-encoding pinned to the codecs undici decodes correctly.
 *
 * Left unset, Node negotiates whatever its undici build offers. On Node ≥ 23
 * that includes **zstd**, and amazon.jobs' zstd response comes back TRUNCATED
 * AT 1024 BYTES with a 200 status — so the failure surfaces as "Unterminated
 * string in JSON at position 1024", reading like a malformed API rather than a
 * transport bug. Node 18/20/22 (the CI matrix and the server) send
 * `gzip, deflate`, so this is preventive on today's runtimes; it also adds
 * `br`, which they do not offer by default but do decode.
 *
 * Ported from parent career-ops `providers/_http.mjs`.
 */
export const PINNED_ACCEPT_ENCODING = 'gzip, deflate, br';

/**
 * The caller's headers plus the pinned accept-encoding, unless the caller set
 * one — under ANY capitalization. Header names are case-insensitive and fetch
 * JOINS two same-named entries into one comma-separated value, so a naive
 * `{ 'accept-encoding': …, ...headers }` would send `gzip, deflate, br, identity`
 * for a caller passing `Accept-Encoding: identity`.
 *
 * Returns a plain object, not a `Headers`: `fetchImpl` is injectable and every
 * source suite reads `opts.headers['User-Agent']` off it. The caller's own
 * object is copied, never mutated — several sources share one header constant.
 *
 * **Plain objects only.** A `Headers` instance or a `[[k, v]]` array spreads to
 * `{}` and would silently drop every header the caller set; no caller passes
 * one today, and this contract is why.
 * @param {Record<string,string>|undefined} headers
 * @returns {Record<string,string>}
 */
export function withPinnedEncoding(headers) {
  const out = { ...headers };
  const hasEncoding = Object.keys(out).some((k) => k.toLowerCase() === 'accept-encoding');
  if (!hasEncoding) out['accept-encoding'] = PINNED_ACCEPT_ENCODING;
  return out;
}

/**
 * undici's `err.cause.message` for a `fetch(url, { redirect: 'error' })` that
 * meets a 3xx. Undocumented and undici-internal, so it is pinned here (and by a
 * test) — if a Node upgrade changes the wording, `fetchJsonWithRetry` reverts to
 * over-retrying a deterministic failure, which the test catches loudly.
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
  await guardResolvedHost(fetchImpl, url);
  const res = await fetchImpl(url, { method, headers: withPinnedEncoding(headers), body, signal, redirect });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} (${url})`);
    err.status = res.status;
    // Captured so fetchJsonWithRetry can honour a 429/503 `Retry-After` (null
    // when absent → the caller falls back to exponential backoff). res.headers
    // may be absent on a hand-rolled test stub.
    err.retryAfter = res.headers?.get?.('retry-after') ?? null;
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
 * Under `redirect: 'manual'` a 3xx arrives as a non-ok response instead of being
 * followed — so the thrown error also carries `.location` (the raw Location
 * header) and `.retryAfter`. This is READ-ONLY: it lets a caller tell WHICH
 * redirect it hit (jobvite distinguishes a feed pointing at NoJobs.htm — an
 * empty board — from a retired tenant) WITHOUT ever gaining the ability to
 * follow it. Both fields are null for a plain non-redirect error, so existing
 * `redirect:'error'` callers are unaffected.
 *
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string,string>, body?: string,
 *           signal?: AbortSignal, redirect?: 'error'|'follow'|'manual' }} [opts]
 * @returns {Promise<string>}
 */
export async function fetchText(fetchImpl, url, opts = {}) {
  const { method = 'GET', headers = {}, body, signal, redirect = 'error' } = opts;
  await guardResolvedHost(fetchImpl, url);
  const res = await fetchImpl(url, { method, headers: withPinnedEncoding(headers), body, signal, redirect });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} (${url})`);
    err.status = res.status;
    // Populated only under redirect:'manual', where the 3xx is surfaced rather
    // than followed. res.headers may be absent on a hand-rolled test stub.
    err.location = res.headers?.get?.('location') ?? null;
    err.retryAfter = res.headers?.get?.('retry-after') ?? null;
    throw err;
  }
  return await res.text();
}

// Statuses whose response has no body — reading .text() on them is a no-op.
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

/**
 * Response-returning sibling of {@link fetchText}/{@link fetchJson} for the rare
 * source that needs the RESPONSE HEADERS. csod (Cornerstone) reads the bootstrap
 * home page's `Set-Cookie` to prime the session its search API demands — some
 * tenants answer `401 CSOD Unauthorized` without those cookies.
 * Same SSRF stance (`redirect: 'error'` by default, so a 3xx can't be followed
 * to a private host). Non-2xx throws with `.status`, like the siblings.
 *
 * Returns a small `{ status, headers, text() }` shape rather than the live
 * Response: the body is read once here and handed back via `text()`, and
 * `headers` is passed through untouched so `headers.getSetCookie()` (repeated
 * Set-Cookie) still works on a real fetch — and a hand-rolled test stub can
 * expose whatever `headers` it likes.
 *
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string,string>, body?: string,
 *           signal?: AbortSignal, redirect?: 'error'|'follow'|'manual' }} [opts]
 * @returns {Promise<{ status: number, headers: any, text: () => Promise<string> }>}
 */
export async function fetchResponse(fetchImpl, url, opts = {}) {
  const { method = 'GET', headers = {}, body, signal, redirect = 'error' } = opts;
  // FULL-R2 review: the guard belongs at the chokepoint like the siblings —
  // a no-op for an injected test transport, and the resolve-time private/
  // loopback refusal on the real network path.
  await guardResolvedHost(fetchImpl, url);
  const res = await fetchImpl(url, { method, headers: withPinnedEncoding(headers), body, signal, redirect });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} (${url})`);
    err.status = res.status;
    throw err;
  }
  const text = NULL_BODY_STATUSES.has(res.status) ? '' : await res.text();
  return { status: res.status, headers: res.headers, text: async () => text };
}

/** Jitter added to a backoff so concurrent retries don't re-collide in lockstep. */
export const JITTER_MS = 250;

/**
 * Milliseconds from a `Retry-After` header, in either permitted form (delta
 * seconds, or an HTTP-date). Null when absent or unparseable. Exported for tests.
 * @param {unknown} value
 * @returns {number|null}
 */
export function parseRetryAfterMs(value) {
  if (value == null || value === '') return null;
  const secs = Number(value);
  if (Number.isFinite(secs) && secs >= 0) return secs * 1000;
  const dateMs = Date.parse(String(value));
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : null;
}

/**
 * How long to wait before the next retry. A `Retry-After` (when the failed
 * response carried one) wins but is CLAMPED to `maxDelayMs * 4`, so a hostile or
 * misconfigured `Retry-After: 86400` can't stall a whole sweep. Otherwise an
 * exponential backoff (`baseDelayMs * 2**attempt`, capped at `maxDelayMs` minus
 * the jitter) plus a random jitter so concurrent retries de-synchronise instead
 * of re-colliding in lockstep. `rand` is injectable for deterministic tests.
 * Exported for tests.
 * @param {{ attempt: number, baseDelayMs: number, maxDelayMs: number, retryAfter?: unknown }} p
 * @param {() => number} [rand]
 * @returns {number} milliseconds
 */
export function computeRetryDelayMs({ attempt, baseDelayMs, maxDelayMs, retryAfter }, rand = Math.random) {
  const retryAfterMs = parseRetryAfterMs(retryAfter);
  if (retryAfterMs !== null) return Math.min(retryAfterMs, maxDelayMs * 4);
  // Clamp the jitter to maxDelayMs first (a maxDelayMs below JITTER_MS would
  // otherwise drive the ceiling — and the backoff — negative); cap the backoff
  // at maxDelayMs MINUS the jitter so the jittered total still honours the limit.
  const jitterCap = Math.min(JITTER_MS, Math.max(0, maxDelayMs));
  const ceiling = Math.max(0, maxDelayMs - jitterCap);
  const backoff = Math.min(baseDelayMs * 2 ** attempt, ceiling);
  // Jitter only when there's an actual backoff to de-synchronise, so a 0 base
  // (instant-retry / test mode) stays exactly 0.
  return backoff + (backoff > 0 ? rand() * jitterCap : 0);
}

/**
 * Whether a failed request is the scan fetch timeout itself. The scanners
 * inject `makeTimeoutFetch` as their `fetchImpl`: every request gets a hard
 * deadline that aborts the combined signal with a `TimeoutError`, and fetch
 * rejects with that abort reason. A request that already ran for its WHOLE
 * timeout fails the same way on a retry and would spend that budget again on
 * a board that is still hung (upstream #6132; measured there at ~94s for one
 * Ashby board at 30s × 3). An upstream watchdog / client-disconnect abort is
 * a different signal — an `AbortError` on an already-aborted caller signal,
 * which the retry loop stops for via `signal?.aborted` — and a fast
 * transport error (DNS, reset) never trips this timer, so it still retries.
 * A status the server actually sent wins over the flag (checked first).
 * @param {unknown} err
 * @returns {boolean}
 */
export function spentRequestTimeout(err) {
  return err != null && typeof err === 'object'
    && err.name === 'TimeoutError' && typeof err.status !== 'number';
}

/**
 * Retrying sibling of {@link fetchJson} for feeds that paginate into the
 * hundreds of pages, where a single transient upstream blip mid-sweep used to
 * abort the whole provider and return nothing. Retries ONLY transient failures —
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
 * non-retryable (the wording is undici-internal and
 * pinned by a test so a silent revert to over-retrying fails loudly. Node < 18.5
 * reports `cause` as undefined, so the check simply doesn't fire there and the
 * old — retryable — classification stands).
 *
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string,string>, body?: string,
 *           signal?: AbortSignal, redirect?: 'error'|'follow'|'manual',
 *           retries?: number, retryDelayMs?: number, maxDelayMs?: number }} [opts]
 * @returns {Promise<any>}
 */
export async function fetchJsonWithRetry(fetchImpl, url, opts = {}) {
  const { retries = 2, retryDelayMs = 500, maxDelayMs = 8000, signal, ...rest } = opts;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchJson(fetchImpl, url, { ...rest, signal });
    } catch (err) {
      lastErr = err;
      const status = err && typeof err.status === 'number' ? err.status : undefined;
      // A refused redirect looks like a no-status network error but is
      // deterministic — never retry it.
      const redirectRefusal = status === undefined
        && err instanceof TypeError
        && err?.cause?.message === REDIRECT_REFUSAL_CAUSE_MESSAGE;
      // A guard refusal is deterministic too — the address is blocked and
      // retrying cannot un-block it (FULL-R2 review finding 9).
      const ssrfRefusal = status === undefined && err?.ssrfRefused === true;
      // A request that already spent its whole timeout is not worth the same
      // budget again (upstream #6132).
      const spentTimeout = spentRequestTimeout(err);
      // Transient = 429, any 5xx, or a network/timeout error (no HTTP status).
      // A permanent 4xx is not worth retrying — rethrow now.
      const transient = !redirectRefusal && !ssrfRefusal && !spentTimeout
        && (status === undefined || status === 429 || status >= 500);
      if (!transient || attempt === retries || signal?.aborted) throw err;
      // Exponential backoff + jitter, honouring a (clamped) Retry-After when the
      // 429/503 carried one — instead of a flat delay that keeps re-hammering a
      // rate-limited board at a fixed cadence.
      await delay(computeRetryDelayMs({ attempt, baseDelayMs: retryDelayMs, maxDelayMs, retryAfter: err?.retryAfter }), signal);
    }
  }
  throw lastErr;
}

/**
 * Re-label an HTTP error thrown by {@link fetchJson}/{@link fetchText} with a
 * source's own prefix (`Trudvsem: HTTP 503 (url)`), keeping `.status`,
 * `.retryAfter` and `.location` and chaining the original error as `cause`.
 * A non-HTTP error (network failure, a non-JSON 200) passes through
 * UNCHANGED — callers branch on `.status`, and the shape guards label their
 * own failures.
 *
 * The port to the guarded transport must not change what a scan log or a
 * quarantine reason says, so every ported call site wraps its fetch in
 * `.catch((e) => { throw labeledHttpError(e, 'Label'); })`.
 *
 * @param {unknown} err
 * @param {string} label the source's message prefix, e.g. `'Trudvsem'`
 * @returns {unknown} the relabelled error, or `err` untouched
 */
export function labeledHttpError(err, label) {
  if (!err || typeof err.status !== 'number') return err;
  const relabelled = new Error(`${label}: ${err.message}`, { cause: err });
  relabelled.status = err.status;
  relabelled.retryAfter = err.retryAfter;
  relabelled.location = err.location;
  return relabelled;
}

/**
 * Text-over-fetch page loader that follows only SAME-HOST redirects — the
 * manual-redirect contract for the HTML-scraping sources (hh.ru, Habr Career,
 * GeekJob, GetMatch). Node's default `redirect: 'follow'` would bounce a
 * request to ANY host the upstream names (a compromised or misbehaving board
 * can point it at an internal target), while a bare `redirect: 'error'` would
 * break the boards that legitimately redirect (hh.ru 302s a regional Russian
 * IP to `sochi.hh.ru`, `spb.hh.ru`, …).
 *
 * Each hop is `redirect: 'manual'` and re-guarded by {@link guardResolvedHost},
 * so the redirect target is resolved and refused if it points at a private /
 * loopback address — a 3xx cannot smuggle the request past the DNS-rebinding
 * defence. Redirect budget is small and absolute: a loop throws, it never
 * spins.
 *
 * A refused redirect throws like the siblings (Error with `.status` and
 * `.location`), so a caller can tell a redirect it chose not to follow from a
 * plain HTTP failure — hh.ru reads the Location to detect its VPN-check
 * interstitial without ever leaving hh.ru.
 *
 * GET-only by design: the scraper sources never POST through a redirect.
 *
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {{ headers?: Record<string,string>, signal?: AbortSignal,
 *           maxRedirects?: number, allowSubdomains?: boolean }} [opts]
 * @returns {Promise<{ status: number, url: string, text: string }>} the final
 *   hop's status, final URL (`res.url` on a real fetch), and body text.
 */
export async function fetchTextFollowSameHost(fetchImpl, url, opts = {}) {
  const { headers = {}, signal, maxRedirects = 3, allowSubdomains = false } = opts;
  const first = new URL(url);
  // Pinned to the FIRST hop's host: `hh.ru → sochi.hh.ru → hh.ru` stays inside
  // the pin either way, while `hh.ru → evil.com` can never launder itself into
  // an allowed name two hops later.
  const pinnedHost = first.hostname.toLowerCase();
  let current = first.href;
  for (let hop = 0; ; hop += 1) {
    await guardResolvedHost(fetchImpl, current);
    const res = await fetchImpl(current, {
      signal,
      redirect: 'manual',
      headers: withPinnedEncoding(headers),
    });
    const location = res.headers?.get?.('location') ?? null;
    if (res.status >= 300 && res.status < 400) {
      // Release the unread body BEFORE moving on: undici pins the socket until
      // the body is consumed or cancelled, and a redirect hop (followed or
      // refused) never reads it. FULL-R2 review finding 7.
      await res.body?.cancel?.().catch(() => {});
      const err = new Error(`HTTP ${res.status} (${current})`);
      err.status = res.status;
      err.location = location;
      err.retryAfter = res.headers?.get?.('retry-after') ?? null;
      let next = null;
      if (location && hop < maxRedirects) {
        try { next = new URL(location, current); } catch { next = null; }
        const to = next ? next.hostname.toLowerCase() : '';
        // Same HOST and same PORT: a redirect to https://hh.ru:8443/ keeps the
        // name but changes the service — refused like an off-host hop.
        const portAllowed = !next || next.port === '' || next.port === first.port;
        const sameHostAllowed = next && portAllowed && next.protocol === 'https:'
          && (to === pinnedHost || (allowSubdomains && to.endsWith(`.${pinnedHost}`)));
        if (sameHostAllowed) {
          current = next.href;
          continue;
        }
      }
      throw err;
    }
    if (!res.ok) {
      await res.body?.cancel?.().catch(() => {}); // never read → release the socket (finding 7)
      const err = new Error(`HTTP ${res.status} (${current})`);
      err.status = res.status;
      err.location = location;
      err.retryAfter = res.headers?.get?.('retry-after') ?? null;
      throw err;
    }
    return { status: res.status, url: res.url || current, text: await res.text() };
  }
}

/**
 * Retrying sibling of {@link fetchText} for the text-scraping sources that
 * paginate HTML pages (same transient-only policy as {@link fetchJsonWithRetry}:
 * HTTP 429, HTTP ≥ 500, and status-less network errors; a refused redirect is
 * deterministic and never retried; a permanent 4xx rethrows immediately).
 * Exists so new adapters stop copy-pasting per-source retry loops (the
 * copy-pasted helpers drift — FULL-R2 follow-up).
 *
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string,string>, body?: string,
 *           signal?: AbortSignal, redirect?: 'error'|'follow'|'manual',
 *           retries?: number, retryDelayMs?: number, maxDelayMs?: number }} [opts]
 * @returns {Promise<string>}
 */
export async function fetchTextWithRetry(fetchImpl, url, opts = {}) {
  const { retries = 2, retryDelayMs = 500, maxDelayMs = 8000, signal, ...rest } = opts;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchText(fetchImpl, url, { ...rest, signal });
    } catch (err) {
      lastErr = err;
      const status = err && typeof err.status === 'number' ? err.status : undefined;
      const redirectRefusal = status === undefined
        && err instanceof TypeError
        && err?.cause?.message === REDIRECT_REFUSAL_CAUSE_MESSAGE;
      // A guard refusal is deterministic — never retried (FULL-R2 review
      // finding 9).
      const ssrfRefusal = status === undefined && err?.ssrfRefused === true;
      // Same spent-timeout rule as fetchJsonWithRetry (upstream #6132).
      const spentTimeout = spentRequestTimeout(err);
      const transient = !redirectRefusal && !ssrfRefusal && !spentTimeout
        && (status === undefined || status === 429 || status >= 500);
      if (!transient || attempt === retries || signal?.aborted) throw err;
      await delay(computeRetryDelayMs({ attempt, baseDelayMs: retryDelayMs, maxDelayMs, retryAfter: err?.retryAfter }), signal);
    }
  }
  throw lastErr;
}

/**
 * Guarded raw-Response sibling for the two sources that must see what the
 * shaped helpers hide: a redirect response itself (`redirect: 'manual'` —
 * workday's dead-board confirmation reads the Location header) or a body
 * under ANY status (the same check reads maintenance markers off an error
 * page, and peoplesoft's cookie-jar walker steps redirect-by-redirect). The
 * transport is the chokepoint, not the caller: {@link guardResolvedHost}
 * runs here on the real network path, so a per-hop request still cannot be
 * aimed at a private/loopback address.
 *
 * The Response is returned UNTOUCHED — the caller owns every status, header
 * and body read, exactly as with a raw `fetchImpl` call, minus the bypass.
 *
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string,string>, body?: string,
 *           signal?: AbortSignal, redirect?: 'error'|'follow'|'manual' }} [opts]
 * @returns {Promise<Response>}
 */
export async function fetchRawResponse(fetchImpl, url, opts = {}) {
  const { method = 'GET', headers = {}, body, signal, redirect = 'error' } = opts;
  await guardResolvedHost(fetchImpl, url);
  return fetchImpl(url, { method, headers: withPinnedEncoding(headers), body, signal, redirect });
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
