/**
 * Request guard — Host allowlist (DNS rebinding) + same-origin check (CSRF).
 *
 * The server has no login: binding to loopback is the only access control. That
 * stops other machines but not the user's own browser, which a hostile page can
 * point at 127.0.0.1 two ways:
 *
 *  - DNS rebinding — `rebind.evil.example` first resolves to the attacker, then
 *    to 127.0.0.1. The page is now same-origin with the API (so no `Origin`
 *    mismatch to detect) and can read the CV/profile and call every PUT/POST.
 *    The only tell is the `Host` header, which still names the attacker's domain.
 *  - Cross-site requests — a `<form method=POST action="http://127.0.0.1:4317/api/run/dedup">`
 *    or `<img src=".../api/stream/scan-parent">` needs no CORS at all.
 *
 * Host: IP literals are always allowed (a DNS name cannot be rebound onto an
 * IP-literal URL, and it keeps LAN use working); so are `localhost`, the
 * configured bind HOST, and anything in ALLOWED_HOSTS (comma separated, `*` to
 * switch the check off). A production reverse proxy that forwards the public
 * name must list it in ALLOWED_HOSTS.
 *
 * Origin: for every state-changing method, and for the GET routes that act
 * (`/api/stream/*`, `/api/run/*`), a present `Origin` must name this server
 * (same host as the request, or an allowed host) and a present
 * `Sec-Fetch-Site` must not be `cross-site`. Requests carrying NEITHER
 * header fall back to `Referer` (same same-origin-or-allowed-host
 * discipline): an old browser's cross-site `<img src=".../api/stream/
 * batch">` sends no Fetch-Metadata header and, per spec, no `Origin` on a
 * simple GET either — but still carries a Referer under the default
 * Referrer-Policy. Only a request with NONE of the three (curl, the CLI,
 * server-side tests) stays trusted.
 */
import { isIP } from 'node:net';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Express matches routes case-insensitively, so `/API/RUN/dedup` reaches the same
// handler as `/api/run/dedup` — this test must be case-insensitive too, and it
// looks at the path only (a `?x=/api/run` query must neither trip nor hide it).
// /api/geocode is a GET with an outbound side effect (Nominatim calls under the
// user's IP, a growing cache) — a cross-site <img> must not drive it.
// Exported (FULL-R1 review r1): the static coverage gate imports THIS regex, so
// narrowing it silently cannot pass CI while registered routes stay uncovered.
export const ACTING_GET = /^\/api\/(?:stream|run|geocode)(?:\/|$|\?)/i;

/** Lower-cased hostname of a `Host` value or URL host, without port or brackets. */
export function hostnameOf(hostHeader) {
  const raw = String(hostHeader || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']');
    return end === -1 ? '' : raw.slice(1, end);
  }
  const colon = raw.lastIndexOf(':');
  // A bare IPv6 literal has several colons and no port; a name or IPv4 has at most one.
  if (colon !== -1 && raw.indexOf(':') === colon) return raw.slice(0, colon);
  return raw;
}

/**
 * @param {{ bindHost?: string, allowedHosts?: string }} [config]
 * `names` is every Host name accepted; `explicit` is only what the operator listed in
 * ALLOWED_HOSTS — the one set an `Origin` may differ from the Host header by.
 * @returns {{ matchAll: boolean, names: Set<string>, explicit: Set<string> }}
 */
export function buildHostPolicy({ bindHost = '', allowedHosts = '' } = {}) {
  const names = new Set(['localhost']);
  const explicit = new Set();
  const bind = hostnameOf(bindHost);
  if (bind && !['0.0.0.0', '::'].includes(bind)) names.add(bind);
  let matchAll = false;
  for (const part of String(allowedHosts).split(',')) {
    const h = part.trim().toLowerCase();
    if (!h) continue;
    if (h === '*') matchAll = true;
    else { names.add(hostnameOf(h)); explicit.add(hostnameOf(h)); }
  }
  return { matchAll, names, explicit };
}

export function isAllowedHost(hostHeader, policy) {
  if (policy.matchAll) return true;
  const name = hostnameOf(hostHeader);
  if (!name) return false;
  if (isIP(name)) return true;
  return policy.names.has(name);
}

/**
 * Does `headerHost` (the `host` of a parsed Origin/Referer URL) count as
 * this server, for the purposes of the cross-site check? Same discipline
 * either way: the EXACT host:port this request was addressed to, or — only
 * behind a proxy that rewrites Host — an operator-listed ALLOWED_HOSTS
 * entry. The Host allowlist's OWN rules (any IP literal, the implicit
 * localhost / bind host) must NOT be reused here: they would make
 * `http://198.51.100.7`, or another app on `http://127.0.0.1:<other
 * port>`, count as ours.
 */
function isSameOriginHost(headerHost, req, policy) {
  if (headerHost === String(req.headers.host || '').toLowerCase()) return true;
  if (policy.matchAll) return true;
  return policy.explicit.has(hostnameOf(headerHost));
}

/**
 * FULL-R1 fallback — Referer, used ONLY when the request carries neither
 * Sec-Fetch-Site nor Origin (an old browser's cross-site `<img>`/`<script>`
 * subresource request sends no Fetch-Metadata header and no Origin on a
 * simple GET, but still a Referer under the default Referrer-Policy). No
 * Referer either keeps today's trusted-tool behaviour (curl, the CLI,
 * server-side tests).
 */
function isCrossSiteReferer(req, policy) {
  const referer = req.headers.referer ?? req.headers.referrer;
  if (referer === undefined || referer === '') return false;
  let refHost;
  try { refHost = new URL(referer).host.toLowerCase(); } catch { return true; }
  return !isSameOriginHost(refHost, req, policy);
}

/** Does the request's Origin / Sec-Fetch-Site / Referer make it cross-site? */
export function isCrossSite(req, policy) {
  const site = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (site === 'cross-site') return true;
  const origin = req.headers.origin;
  if (origin === undefined || origin === '') {
    // `same-site` is NOT same-origin: any other port on this host (another
    // local dev server, a tool's web UI) is same-site with
    // 127.0.0.1:<port>. Such a request with no Origin to compare is refused.
    if (site === 'same-site') return true;
    // An explicit same-origin/none Fetch-Metadata value is itself the
    // trusted signal — no need to fall back to Referer.
    if (site) return false;
    // Neither header present — fall back to Referer (FULL-R1).
    return isCrossSiteReferer(req, policy);
  }
  if (origin === 'null') return true;
  let originHost;
  try { originHost = new URL(origin).host.toLowerCase(); } catch { return true; }
  return !isSameOriginHost(originHost, req, policy);
}

export function requestGuard(config = {}) {
  const policy = buildHostPolicy(config);
  return function guard(req, res, next) {
    if (!isAllowedHost(req.headers.host, policy)) {
      return res.status(421).json({ error: 'host not allowed' });
    }
    const path = String(req.originalUrl || req.url || '').split('?')[0];
    const acts = !SAFE_METHODS.has(req.method) || ACTING_GET.test(path);
    if (acts && isCrossSite(req, policy)) {
      return res.status(403).json({ error: 'cross-site request refused' });
    }
    next();
  };
}
