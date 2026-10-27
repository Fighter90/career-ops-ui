/**
 * Company logo proxy (v1.104.0).
 *
 *   GET /api/logo?domain=<host> → the company's favicon bytes (image), or 404.
 *
 * Privacy-preserving by design: the logo is the favicon fetched from the
 * company's OWN domain (the one already appearing in scan results), NOT a
 * third-party logo aggregator — so no new party learns which employers you
 * look at. The fetch goes through the DNS-pinned, SSRF-safe `safeGet` (binary
 * mode), is size-capped and time-bounded, and results are cached in memory
 * (never written to disk — this is a read-only viewer). Off by
 * default; the client only calls this when the user enables company logos.
 */
import { safeGet } from '../safe-fetch.mjs';

const MAX_BYTES = 200 * 1024;     // a favicon is tiny; cap hard
const TIMEOUT_MS = 6000;
const TTL_MS = 24 * 60 * 60 * 1000;
// A miss is often transient (timeout, DNS blip, a 5xx) — cache it briefly so a
// list of rows doesn't hammer one host, but don't hide the logo for a day.
const NEG_TTL_MS = 10 * 60 * 1000;
const CACHE_CAP = 512;            // domains; simple LRU-ish eviction

// domain → { buf, contentType, ts } (hit) | { miss: true, ts } (negative)
const cache = new Map();

function cacheGet(domain) {
  const e = cache.get(domain);
  if (!e) return null;
  if (Date.now() - e.ts > (e.miss ? NEG_TTL_MS : TTL_MS)) { cache.delete(domain); return null; }
  // Refresh LRU recency.
  cache.delete(domain); cache.set(domain, e);
  return e;
}
function cacheSet(domain, entry) {
  cache.set(domain, { ...entry, ts: Date.now() });
  while (cache.size > CACHE_CAP) cache.delete(cache.keys().next().value);
}

/** A conservative hostname check — no scheme, no path, no port, valid labels. */
export function isPlausibleDomain(d) {
  if (typeof d !== 'string') return false;
  const s = d.trim().toLowerCase();
  if (s.length < 4 || s.length > 253) return false;
  if (/[^a-z0-9.-]/.test(s)) return false;                 // only host chars
  if (s.startsWith('.') || s.endsWith('.') || s.includes('..')) return false;
  return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(s);
}

// A minimal image-magic sniff so we never serve HTML error pages as an "image".
// Raster formats only — SVG is active content (script, foreignObject) and this
// proxy serves same-origin bytes, so an SVG payload is refused no matter what
// it declares or looks like (FULL-M4).
function looksLikeImage(buf, contentType) {
  if (contentType && /svg/i.test(String(contentType))) return false;
  // FULL-M4 review r1 — the header is NEVER trusted on its own: a lying
  // `image/png` carried SVG bytes past the old early-return. Every payload
  // must win the magic-byte sniff; the route clamps a lying non-image
  // content-type at store time, so the header only ever ADDS refusals.
  if (!buf || buf.length < 4) return false;
  const b = buf;
  if (b[0] === 0x00 && b[1] === 0x00 && (b[2] === 0x01 || b[2] === 0x02)) return true; // .ico
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true;    // PNG
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true;                     // GIF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;                     // JPEG
  if (b.length >= 12 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return true;  // RIFF···WEBP
  if (b[0] === 0x42 && b[1] === 0x4d) return true;                                      // BM (BMP)
  return false;
}

/** Fetch a domain's favicon via the SSRF-safe binary path. Exported for tests. */
export async function fetchFavicon(domain, deps = {}) {
  const get = deps.safeGet || safeGet;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    // Ask for one byte past the cap: safeGet cuts an oversized body to exactly
    // `maxBytes`, so a buffer longer than MAX_BYTES means "truncated" even when
    // the transport reports no `truncated` flag. A cut-off image is not served.
    const r = await get(`https://${domain}/favicon.ico`, {
      binary: true, maxBytes: MAX_BYTES + 1, signal: ac.signal,
      headers: { Accept: 'image/*,*/*;q=0.8' },
    });
    if (r && (r.truncated === true || (r.buffer && r.buffer.length > MAX_BYTES))) return null;
    if (r && r.status === 200 && r.buffer && r.buffer.length && looksLikeImage(r.buffer, r.contentType)) {
      return { buf: r.buffer, contentType: /^image\//i.test(r.contentType || '') ? r.contentType : 'image/x-icon' };
    }
    return null;
  } catch {
    return null;                 // SSRF-blocked / timeout / DNS failure → no logo
  } finally {
    clearTimeout(timer);
  }
}

// Test seam: swap the favicon fetcher so the endpoint's success/cache paths are
// exercisable without live DNS/network (same pattern as safe-fetch `_setTransport`).
let _fetcher = fetchFavicon;
export function _setFaviconFetcher(fn) { _fetcher = fn || fetchFavicon; }

export function registerLogoRoutes(app) {
  app.get('/api/logo', async (req, res) => {
    const domain = String((req.query && req.query.domain) || '').trim().toLowerCase();
    if (!isPlausibleDomain(domain)) return res.status(400).json({ error: 'invalid domain' });

    const cached = cacheGet(domain);
    if (cached) {
      if (cached.miss) return res.status(404).end();
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // private, never public: these are per-domain proxied bytes served from
      // the app origin; a shared cache must not store them (FULL-M4).
      res.setHeader('Cache-Control', 'private, max-age=86400');
      return res.end(cached.buf);
    }

    const got = await _fetcher(domain);
    // Serving-boundary re-check (FULL-M4): the fetcher is injectable and is
    // the only thing standing between an upstream payload and same-origin
    // bytes, so the route refuses anything that is not a raster image.
    if (!got || !looksLikeImage(got.buf, got.contentType)) {
      cacheSet(domain, { miss: true });
      return res.status(404).end();
    }
    // FULL-M4 review r1 — clamp the content-type AT STORE TIME (mirrors
    // fetchFavicon's normalization): a lying `text/html` from the fetcher
    // must never be served or cached as HTML — nosniff does not block HTML
    // rendering on navigation, and the cache-hit path would re-serve it.
    const ct = /^image\//i.test(String(got.contentType || '')) ? String(got.contentType) : 'image/x-icon';
    cacheSet(domain, { buf: got.buf, contentType: ct });
    res.setHeader('Content-Type', ct);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.end(got.buf);
  });
}

// Exposed for tests (reset between cases).
export function _clearLogoCache() { cache.clear(); }
// Test seam: age a cached entry by `ms` (exercises the TTLs without waiting).
export function _ageLogoCache(domain, ms) {
  const e = cache.get(domain);
  if (e) e.ts -= ms;
}
