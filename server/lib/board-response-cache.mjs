/**
 * Board-response cache for the EN scanner (CAR-226, ported from parent
 * career-ops #6105 / `providers/_http-cache.mjs`).
 *
 * A second scan within 15 minutes used to download every board again. Within
 * one scan scope, successful GET and POST bodies stay for the freshness
 * window (default 15 minutes), an overlapping request for the same board
 * collapses onto the in-flight one, and a stale GET is rechecked with
 * If-None-Match — a 304 keeps the saved body and refreshes its stamp, a
 * changed ETag refetches.
 *
 * **Deliberate deviation from the parent** (kept, not an oversight): the
 * parent persists saved bodies under `data/cache/http/` so a SEPARATE scan
 * process reuses them. web-ui has no on-disk cache contract, so the store is
 * IN MEMORY and lives only inside one `withBoardResponseCache()` scope — one
 * scan run. Nothing crosses runs, nothing is written to disk, and no pruning
 * is needed; a small FIFO bound keeps a long-lived server process honest.
 *
 * The cache is keyed by method + URL + credential headers + body. Boards are
 * only ever stored via {@link cachedBoardText}'s callers (`fetchJson` /
 * `fetchText` in `http-json.mjs`); raw-Response, redirect-walking and
 * cookie-priming transports stay live by design.
 *
 * Scope: `AsyncLocalStorage` — exactly the parent's shape. `runEnScan` opens
 * the scope around the company-fetch loop; every other http-json consumer
 * (liveness probes, portals health, discover) runs store-less and is
 * untouched.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';

const storage = new AsyncLocalStorage();

export const DEFAULT_BOARD_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_TIMER_MS = 2_147_483_647;
// In-memory bound instead of the parent's 7-day disk prune: 512 distinct
// boards/bodies is far above any real tracked_companies + pagination fan-out.
const MAX_ENTRIES = 512;

/**
 * Parse a `CAREER_OPS_HTTP_CACHE_TTL_MS`-style value. 0 is usable and means
 * never fresh (every GET rechecks); anything absent, blank, non-finite,
 * negative or above the setTimeout ceiling falls back to `fallback`.
 */
export function resolveBoardCacheTtlMs(raw, fallback = DEFAULT_BOARD_CACHE_TTL_MS) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_TIMER_MS) return fallback;
  return parsed;
}

/** Human window for the scan log: `15 minutes` / `30 seconds` / `1234 ms`. */
export function formatBoardCacheWindow(ttlMs) {
  if (ttlMs >= 60_000 && ttlMs % 60_000 === 0) {
    const minutes = ttlMs / 60_000;
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }
  if (ttlMs >= 1_000 && ttlMs % 1_000 === 0) {
    const seconds = ttlMs / 1_000;
    return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
  }
  return `${ttlMs} ms`;
}

/**
 * Run `fn` inside one cache scope. `disabled: true` (or
 * `CAREER_OPS_HTTP_CACHE=0` at the caller) runs `fn` with NO store — every
 * fetch goes to the network. `now` is injectable for deterministic tests.
 * @param {{ ttlMs?: number, now?: () => number, disabled?: boolean }} options
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
export function withBoardResponseCache(options, fn) {
  if (options?.disabled) return fn();
  const ttlMs = resolveBoardCacheTtlMs(options?.ttlMs, DEFAULT_BOARD_CACHE_TTL_MS);
  const store = {
    ttlMs,
    now: options?.now ?? (() => Date.now()),
    memory: new Map(),
    inflight: new Map(),
    stats: { hits: 0, misses: 0, revalidated: 0 },
  };
  return storage.run(store, fn);
}

/** Hit/miss/revalidated counters for the current scope, or null outside one. */
export function boardCacheStats() {
  const store = storage.getStore();
  if (!store) return null;
  return { ...store.stats };
}

function bodyText(body) {
  if (body == null) return '';
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) return Buffer.from(body).toString('utf8');
  if (body instanceof URLSearchParams) return body.toString();
  return null; // not a serializable request body → never cached
}

function isCredentialHeader(name) {
  return name === 'authorization' || name === 'cookie' || name === 'proxy-authorization'
    || name.includes('api-key') || name.includes('apikey');
}

function credentialMaterial(headers) {
  const parts = [];
  for (const [name, value] of new Headers(headers || {}).entries()) {
    if (isCredentialHeader(name)) parts.push(`${name}=${value}`);
  }
  parts.sort();
  return parts.join('\n');
}

function cacheKey(method, url, opts, body) {
  return createHash('sha256').update(`${method}\n${url}\n${credentialMaterial(opts.headers)}\n${body}`).digest('hex');
}

function isFresh(entry, store) {
  if (!entry || !(store.ttlMs > 0)) return false;
  const age = store.now() - entry.storedAt;
  // A storedAt ahead of the clock is not a fresh board. Recheck it.
  return age >= 0 && age < store.ttlMs;
}

/**
 * Each caller gets its OWN copy of a cached body: strings pass through,
 * parsed JSON objects are structuredCloned so one caller mutating its result
 * can never leak into the next caller's copy (the parent got this for free
 * by re-parsing stored text on every serve).
 */
function cloneBody(body) {
  return typeof body === 'string' ? body : structuredClone(body);
}

async function plain(url, opts, load) {
  const loaded = await load(url, opts, { ifNoneMatch: null });
  if (loaded?.notModified) {
    const err = new Error('HTTP 304');
    err.status = 304;
    throw err;
  }
  return loaded.body;
}

async function fulfill(store, key, url, opts, load, method) {
  const entry = store.memory.get(key);
  if (isFresh(entry, store)) {
    store.stats.hits++;
    return cloneBody(entry.body);
  }
  const conditional = method === 'GET' && entry?.etag
    ? { ifNoneMatch: entry.etag }
    : { ifNoneMatch: null };
  const loaded = await load(url, opts, conditional);
  if (loaded?.notModified) {
    if (!entry) {
      // A 304 with nothing saved can only mean a caller-supplied
      // If-None-Match met an unsaved board — surface it as the HTTP status
      // it is, like the parent does.
      const err = new Error('HTTP 304');
      err.status = 304;
      throw err;
    }
    entry.storedAt = store.now();
    store.stats.revalidated++;
    return cloneBody(entry.body);
  }
  const saved = {
    storedAt: store.now(),
    body: loaded.body,
    etag: typeof loaded.etag === 'string' && loaded.etag ? loaded.etag : null,
  };
  store.stats.misses++;
  if (loaded.noStore) return loaded.body;
  if (store.memory.size >= MAX_ENTRIES) {
    const oldest = store.memory.keys().next().value;
    if (oldest !== undefined && oldest !== key) store.memory.delete(oldest);
  }
  store.memory.set(key, saved);
  return loaded.body;
}

/**
 * Cache-consulting entry point. `load(url, opts, conditional)` performs the
 * real fetch and returns `{ body, etag, noStore }` or `{ notModified: true }`;
 * it must validate its own body (a JSON body that does not parse must throw
 * inside `load`, so a bad board is never saved). Returns the body value —
 * text for text fetches, the parsed object for JSON ones.
 *
 * Only GET and POST with a serializable body are cached; anything else (and
 * any store-less caller) passes straight through to `load`.
 */
export function cachedBoardText(url, opts, load) {
  const store = storage.getStore();
  if (!store) return plain(url, opts, load);
  const method = String(opts.method || 'GET').toUpperCase();
  const body = bodyText(opts.body);
  if (body === null || (method !== 'GET' && method !== 'POST')) return plain(url, opts, load);
  const key = cacheKey(method, url, opts, body);
  const pending = store.inflight.get(key);
  if (pending) {
    // Join the in-flight request; each joiner still gets its own body copy.
    // A join saved a network round-trip like a fresh hit did, so it counts
    // as one (the parent's join path is silent; without this the run log
    // would miss the most common within-run reuse — concurrent same-board
    // reads under the per-host limiter).
    store.stats.hits++;
    return pending.then((joined) => cloneBody(joined));
  }
  const work = fulfill(store, key, url, opts, load, method);
  // Registered before the first await so two overlapping calls collapse
  // onto one request.
  store.inflight.set(key, work);
  return work.finally(() => {
    if (store.inflight.get(key) === work) store.inflight.delete(key);
  });
}
