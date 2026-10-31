/**
 * v1.20.1 (H-5) — in-memory rate limiters for this loopback-by-default app.
 *
 * Default loopback deploys (HOST=127.0.0.1) are single-user; rate
 * limiting is unnecessary noise. But the project supports HOST=0.0.0.0
 * (LAN exposure) and HOST=<public> for testbed scenarios. In those
 * modes any LAN attacker can POST to /api/evaluate / /api/deep /
 * /api/mode/:slug / /api/auto-pipeline and drain the user's
 * ANTHROPIC_API_KEY at ≈ $0.05 per request.
 *
 * Two limiters:
 *   - llmRateLimit  — 10 req / 60 s per IP (configurable via LLM_RATE_LIMIT
 *     env), active ONLY when isPubliclyExposed() is true — loopback users
 *     see no behavioural change. Guards the token-spending routes.
 *   - writeRateLimit — a factory over express-rate-limit's rateLimit()
 *     (the canonical middleware CodeQL's js/missing-rate-limiting query
 *     recognises), 60 req / 60 s per (route × IP) (configurable via
 *     WRITE_RATE_LIMIT env), UNCONDITIONAL. Guards the file-mutating /
 *     subprocess-spawning relays flagged by CodeQL (#705
 *     /api/runners/report-links, #703 /api/tracker/status): a guard
 *     that skips loopback is not a guard — on the default bind those
 *     endpoints were unthrottled, and a per-request subprocess (or a
 *     data-file rewrite) is exactly what a runaway client loop must not
 *     saturate. The limit is generous: no legitimate client (or test,
 *     ≤12 calls per endpoint per process) comes near it.
 *
 * Mechanics:
 *   - llmRateLimit: sliding window with a monotonic clock, 429 +
 *     Retry-After header on bucket overflow. Buckets are swept at most once
 *     a second and the map evicts oldest-first at MAX_BUCKETS, so a flood
 *     of distinct addresses cannot grow it without bound.
 *   - writeRateLimit: a per-route express-rate-limit MemoryStore (each
 *     factory call creates its own instance → per-route isolation by
 *     construction, with the route prefix still in the key), standard +
 *     legacy headers, and the same 429 JSON contract as before.
 */
import { isPubliclyExposed } from './security.mjs';
import { rateLimit, MemoryStore } from 'express-rate-limit';

const LLM_DEFAULT_LIMIT = 10;
const WRITE_DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;
const SWEEP_EVERY_MS = 1_000;

// Hard ceiling on tracked clients per store. Expired buckets are swept at
// most once a second (or once a window, if shorter); if a flood of distinct
// addresses still overfills the map, the oldest entries (Map keeps
// insertion order) are dropped first.
export const MAX_BUCKETS = 10_000;

// The LLM limiter's store (keys by IP — one global spend budget per
// client). The write limiter now owns one express-rate-limit MemoryStore
// per route (see WRITE_STORES below).
function makeStore() {
  return { map: new Map(), nextSweepAt: 0 };
}

const LLM_STORE = makeStore();

// The write limiter's per-route express-rate-limit stores, tracked so
// __resetRateLimits() can clear every instance between test cases.
const WRITE_STORES = new Set();

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

function sweep(store, now, windowMs) {
  if (now >= store.nextSweepAt) {
    store.nextSweepAt = now + Math.min(SWEEP_EVERY_MS, windowMs);
    for (const [key, bucket] of store.map) if (bucket.resetAt < now) store.map.delete(key);
  }
  for (const key of store.map.keys()) {
    if (store.map.size < MAX_BUCKETS) break;
    store.map.delete(key);
  }
}

/** "20/30s" → { limit, windowMs }; a missing/malformed value → the fallback. */
function limitConfig(envVar, fallback) {
  const raw = process.env[envVar];
  if (!raw) return fallback;
  const m = /^(\d+)\/(\d+)(s|ms)?$/.exec(raw.trim());
  if (!m) return fallback;
  const limit = parseInt(m[1], 10);
  const win = parseInt(m[2], 10);
  const unit = m[3] || 's';
  return { limit, windowMs: unit === 'ms' ? win : win * 1000 };
}

function tooManyRequests(res, bucket, limit, windowMs, now) {
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

/**
 * Express middleware factory. Apply BEFORE the route handler:
 *
 *   app.post('/api/evaluate', llmRateLimit, async (req, res) => { … });
 *
 * On overflow we 429 with the Retry-After header that browsers respect
 * for back-off. `gate` lets the limiter stay inactive under a condition
 * (the LLM limiter is loopback-free by design). The mutating-relay
 * limiter (writeRateLimit, below) no longer shares this engine — it is a
 * factory over express-rate-limit.
 */
function makeRateLimiter({ store, envVar, defaultLimit, gate, perRoute }) {
  return function rateLimit(req, res, next) {
    if (gate && !gate()) return next();
    const { limit, windowMs } = limitConfig(envVar, { limit: defaultLimit, windowMs: DEFAULT_WINDOW_MS });
    const ip = clientKey(req.ip || req.socket?.remoteAddress);
    const key = perRoute ? `${String(req.originalUrl || req.url || '').split('?')[0]}|${ip}` : ip;
    const now = Date.now();
    const bucket = store.map.get(key);
    if (!bucket || bucket.resetAt < now) {
      if (bucket) store.map.delete(key); // re-insert at the end: eviction order = age
      else sweep(store, now, windowMs);
      store.map.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= limit) {
      return tooManyRequests(res, bucket, limit, windowMs, now);
    }
    bucket.count += 1;
    next();
  };
}

/**
 * LLM-spending routes (evaluate / deep / mode / auto-pipeline / batch …).
 * No-op on loopback / private binds — the single-user default.
 */
export const llmRateLimit = makeRateLimiter({
  store: LLM_STORE,
  envVar: 'LLM_RATE_LIMIT',
  defaultLimit: LLM_DEFAULT_LIMIT,
  gate: isPubliclyExposed,
});

/**
 * File-mutating / subprocess-spawning relay routes (CodeQL #705/#703 —
 * js/missing-rate-limiting). Unconditional: active on loopback too, with
 * a generous 60 req/min per (route × IP) so normal UI use and the test
 * suite never trip it, while a runaway client loop gets a 429 instead of
 * saturating per-request spawns or tracker-file rewrites.
 *
 * A factory over express-rate-limit's rateLimit() — the literal
 * `rateLimit({…})` middleware CodeQL's js/missing-rate-limiting models —
 * so the registration reads `app.post(path, writeRateLimit(), handler)`.
 * Each call creates its own MemoryStore instance, which IS the per-route
 * isolation; the route prefix in the key keeps the documented keying
 * contract (route × IP) intact for direct-call tests.
 */
export function writeRateLimit() {
  const { limit, windowMs } = limitConfig('WRITE_RATE_LIMIT', {
    limit: WRITE_DEFAULT_LIMIT,
    windowMs: DEFAULT_WINDOW_MS,
  });
  const store = new MemoryStore({ windowMs });
  WRITE_STORES.add(store);
  return rateLimit({
    windowMs,
    limit,
    statusCode: 429,
    // draft-6 RateLimit-* headers + Retry-After on block; legacyHeaders
    // keeps the previous X-RateLimit-Limit/Reset contract.
    standardHeaders: true,
    legacyHeaders: true,
    // Route × IP — the same keying as before (route prefix guards the
    // direct-call unit tests; the store instance is per-route anyway).
    keyGenerator: (req) =>
      `${String(req.originalUrl || req.url || '').split('?')[0]}|${clientKey(req.ip || req.socket?.remoteAddress)}`,
    handler: (req, res) => {
      const resetAt = req.rateLimit?.resetTime?.getTime?.() ?? Date.now() + windowMs;
      const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        ok: false,
        error: `rate limit: ${limit} req per ${Math.round(windowMs / 1000)}s`,
        retryAfter,
      });
    },
    // Loopback single-user app (no trust proxy, Caddy in front on prod):
    // the built-in validations would only add console noise the old
    // custom middleware never emitted.
    validate: false,
    store,
  });
}

/**
 * Test-only — reset the LLM limiter's buckets between cases. Production
 * callers never invoke this; expired buckets are swept by sweep() as
 * requests arrive.
 */
export function _resetBuckets() {
  LLM_STORE.map.clear();
  LLM_STORE.nextSweepAt = 0;
}

/** Test-only — how many client buckets the LLM limiter tracks. */
export function _bucketCount() {
  return LLM_STORE.map.size;
}

/**
 * Test-only — reset BOTH limiters (LLM + write) between cases or suites.
 * The LLM buckets die with the custom map; each write store exposes the
 * public MemoryStore.resetAll(). Production callers never invoke this;
 * MemoryStore rotates its own windows on the windowMs timer.
 */
export function __resetRateLimits() {
  _resetBuckets();
  for (const store of WRITE_STORES) {
    if (typeof store.resetAll === 'function') store.resetAll();
  }
}
