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

const BUCKETS = new Map(); // ip → { count, resetAt }

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
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = BUCKETS.get(ip);
  if (!bucket || bucket.resetAt < now) {
    BUCKETS.set(ip, { count: 1, resetAt: now + windowMs });
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
 * invoke this; the eviction happens organically when each bucket's
 * `resetAt` passes Date.now().
 */
export function _resetBuckets() {
  BUCKETS.clear();
}
