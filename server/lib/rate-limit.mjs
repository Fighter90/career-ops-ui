/**
 * v1.20.1 (H-5) — in-memory rate limiter for LLM-calling routes.
 *
 * Default loopback deploys (HOST=127.0.0.1) are single-user; rate
 * limiting is unnecessary noise. But the project supports HOST=0.0.0.0
 * (LAN exposure) and HOST=<public> for testbed scenarios. In those
 * modes any LAN attacker can POST to /api/evaluate / /api/deep /
 * /api/mode/:slug / /api/auto-pipeline and drain the user's
 * ANTHROPIC_API_KEY at ≈ $0.05 per request.
 *
 * Strategy:
 *   - 10 req / 60 s per IP (configurable via LLM_RATE_LIMIT env)
 *   - sliding window with monotonic clock
 *   - 429 + Retry-After header on bucket overflow
 *   - active ONLY when isPubliclyExposed() is true — loopback users see
 *     no behavioural change
 *
 * The v2.x auth gate (P-12) will replace this with proper per-user
 * accounting. Until then, this is the cheap interim defense.
 */
import { isPubliclyExposed } from './security.mjs';

const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_MS = 60_000;

const BUCKETS = new Map(); // client key → { count, resetAt }

// Hard ceiling on tracked clients. Expired buckets are swept at most once a
// second (or once a window, if shorter); if a flood of distinct addresses still overfills the map, the oldest
// entries (Map keeps insertion order) are dropped first.
export const MAX_BUCKETS = 10_000;
const SWEEP_EVERY_MS = 1_000;
let nextSweepAt = 0;

/**
 * Bucket key for a client address. IPv6 is keyed by its /64 — a single host is
 * routinely handed a whole /64, so per-address keys let it rotate the low bits
 * into an endless supply of fresh buckets. IPv4 (and IPv4-mapped IPv6) is keyed
 * per address. Anything unparseable is used verbatim.
 * @param {string} ip
 */
export function clientKey(ip) {
  const raw = String(ip || '').trim().toLowerCase().replace(/%.*$/, '');
  if (!raw) return 'unknown';
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(raw);
  if (mapped) return mapped[1];
  if (!raw.includes(':')) return raw;
  const halves = raw.split('::');
  if (halves.length > 2) return raw;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? Math.max(0, 8 - head.length - tail.length) : 0;
  const groups = [...head, ...Array(fill).fill('0'), ...tail];
  if (groups.length < 4 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g) && !g.includes('.'))) return raw;
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

function sweep(now, windowMs) {
  if (now >= nextSweepAt) {
    nextSweepAt = now + Math.min(SWEEP_EVERY_MS, windowMs);
    for (const [key, bucket] of BUCKETS) if (bucket.resetAt < now) BUCKETS.delete(key);
  }
  for (const key of BUCKETS.keys()) {
    if (BUCKETS.size < MAX_BUCKETS) break;
    BUCKETS.delete(key);
  }
}

function limitConfig() {
  // Per-instance config from env. Caller can override via
  // LLM_RATE_LIMIT="20/30s" syntax for testing.
  const raw = process.env.LLM_RATE_LIMIT;
  if (!raw) return { limit: DEFAULT_LIMIT, windowMs: DEFAULT_WINDOW_MS };
  const m = /^(\d+)\/(\d+)(s|ms)?$/.exec(raw.trim());
  if (!m) return { limit: DEFAULT_LIMIT, windowMs: DEFAULT_WINDOW_MS };
  const limit = parseInt(m[1], 10);
  const win = parseInt(m[2], 10);
  const unit = m[3] || 's';
  return { limit, windowMs: unit === 'ms' ? win : win * 1000 };
}

/**
 * Express middleware. Apply BEFORE the route handler:
 *
 *   app.post('/api/evaluate', llmRateLimit, async (req, res) => { … });
 *
 * On loopback / private bind the middleware is a no-op. On a public
 * bind, the per-IP bucket fills up; on overflow we 429 with the
 * Retry-After header that browsers respect for back-off.
 */
export function llmRateLimit(req, res, next) {
  if (!isPubliclyExposed()) return next();
  const { limit, windowMs } = limitConfig();
  const key = clientKey(req.ip || req.socket?.remoteAddress);
  const now = Date.now();
  const bucket = BUCKETS.get(key);
  if (!bucket || bucket.resetAt < now) {
    if (bucket) BUCKETS.delete(key); // re-insert at the end: eviction order = age
    else sweep(now, windowMs);
    BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }
  if (bucket.count >= limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Reset', String(Math.floor(bucket.resetAt / 1000)));
    return res.status(429).json({
      ok: false,
      error: `rate limit: ${limit} req per ${Math.round(windowMs / 1000)}s`,
      retryAfter,
    });
  }
  bucket.count += 1;
  next();
}

/**
 * Test-only — reset buckets between cases. Production callers never
 * invoke this; expired buckets are swept by sweep() as requests arrive.
 */
export function _resetBuckets() {
  BUCKETS.clear();
  nextSweepAt = 0;
}

/** Test-only — how many client buckets are tracked. */
export function _bucketCount() {
  return BUCKETS.size;
}
