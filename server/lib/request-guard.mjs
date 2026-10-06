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
 * `Sec-Fetch-Site` must not be `cross-site`. Requests carrying neither header
 * (curl, the CLI, server-side tests) pass.
 */
import { isIP } from 'node:net';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Express matches routes case-insensitively, so `/API/RUN/dedup` reaches the same
// handler as `/api/run/dedup` — this test must be case-insensitive too, and it
// looks at the path only (a `?x=/api/run` query must neither trip nor hide it).
const ACTING_GET = /^\/api\/(?:stream|run)(?:\/|$)/i;

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

/** Does the request's Origin / Sec-Fetch-Site make it cross-site? */
export function isCrossSite(req, policy) {
  const site = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (site === 'cross-site') return true;
  const origin = req.headers.origin;
  if (origin === undefined || origin === '') return false;
  if (origin === 'null') return true;
  let originHost;
  try { originHost = new URL(origin).host.toLowerCase(); } catch { return true; }
  // Same origin = the exact host:port this request was addressed to. The Host
  // allowlist's own rules ("any IP literal", the implicit localhost / bind host)
  // must NOT be reused here: they would make `Origin: http://198.51.100.7`, or
  // another app on http://127.0.0.1:<other port>, count as ours.
  if (originHost === String(req.headers.host || '').toLowerCase()) return false;
  if (policy.matchAll) return false;
  // Behind a proxy that rewrites Host, the operator-listed public name is the
  // one thing an Origin may differ by.
  return !policy.explicit.has(hostnameOf(originHost));
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
