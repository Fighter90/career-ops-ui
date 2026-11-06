/**
 * CAR-236 (P1 perf) — one-entry-per-file memo keyed on (path, mtimeMs, size).
 *
 * `cachedByMtime(file, compute)` → compute(resolvedFile), remembered until the
 * file's mtime or size changes. Same invalidation discipline as store.mjs's
 * reportCache (v1.238.3): every writer in this project goes through
 * atomicWrite/withFileLock or the parent's runners, so a write always changes
 * the stat, and nothing needs an explicit bust.
 *
 * Fail-open by construction — a cache bug must degrade to the old behavior,
 * never break the endpoint:
 *   - stat failure (missing/unreadable file) → plain recompute, nothing cached;
 *   - a compute throw propagates to the caller and is never cached, so the
 *     next call retries;
 *   - the Map keeps ONE entry per file (recomputed entries replace in place).
 *
 * Note the trade-off this shares with reportCache: the key is (mtime, size),
 * so a same-length rewrite with the mtime pinned back would serve stale —
 * irrelevant here because every real writer updates the mtime.
 */
import { statSync } from 'node:fs';
import { resolve } from 'node:path';

const cache = new Map(); // resolvedPath → { mtimeMs, size, value }

/** Diagnostic counters — mirrors __reportCache; tests spy through these.
 * reset() forgets the MEMO TOO (not just the counters), so a test that
 * resets sees the next call rebuild from scratch. */
export const __mtimedCache = {
  hits: 0,
  misses: 0,
  get size() { return cache.size; },
  reset() { cache.clear(); this.hits = 0; this.misses = 0; },
};

export function cachedByMtime(file, compute) {
  const key = resolve(String(file));
  let stat = null;
  try { stat = statSync(key); } catch { stat = null; }
  const hit = stat && cache.get(key);
  if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) {
    __mtimedCache.hits++;
    return hit.value;
  }
  __mtimedCache.misses++;
  const value = compute(key);
  if (stat) cache.set(key, { mtimeMs: stat.mtimeMs, size: stat.size, value });
  return value;
}
