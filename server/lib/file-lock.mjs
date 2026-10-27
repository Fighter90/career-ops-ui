/**
 * v1.20.1 (H-6) — per-file async mutex.
 *
 * Closes the read-then-write race on `data/applications.md` and
 * `data/pipeline.md` (and any future single-file append surface).
 *
 * Pattern before this module:
 *
 *   const content = readFileSync(PATHS.applications, 'utf8');
 *   const existing = parseApplications(content);
 *   const nextNum = max(existing.map(r => parseInt(r.num))) + 1;
 *   writeFileSync(PATHS.applications, content + buildRow(nextNum, ...));
 *
 * Two concurrent POST /api/tracker each read num=42, each write
 * num=43 — the earlier row is silently dropped. Same race on
 * pipeline-URL append (less catastrophic because dedup uses URL
 * content, but two unique parallel appends still race the file).
 *
 * Pattern after this module:
 *
 *   await withFileLock(PATHS.applications, async () => {
 *     const content = readFileSync(...);
 *     ...
 *     writeFileSync(...);
 *   });
 *
 * Each path gets its own promise chain. Callers serialize on that
 * chain — operations on different paths run independently. Express
 * is single-process so an in-memory mutex is sufficient; this module
 * does NOT use OS-level file locks (those would be needed only if
 * the server were horizontally scaled, which is a v2.x topic).
 */

import { writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';

const LOCKS = new Map(); // path → tail promise

/**
 * Run `fn` while holding the lock for `path`. The lock is released
 * even if `fn` throws. Returns whatever `fn` returns.
 *
 * @template T
 * @param {string} path — typically `PATHS.applications` / `PATHS.pipeline`
 * @param {() => Promise<T>} fn — read-modify-write critical section
 * @returns {Promise<T>}
 */
export async function withFileLock(path, fn) {
  const prev = LOCKS.get(path) || Promise.resolve();
  let release;
  const next = new Promise((r) => { release = r; });
  // Make the next caller wait on `next` instead of `prev`.
  const tail = prev.then(() => next).catch(() => {});
  LOCKS.set(path, tail);
  // Wait for our turn.
  await prev.catch(() => {}); // a prior critical section throwing shouldn't break our chain
  try {
    return await fn();
  } finally {
    release();
    // FULL-M6 (CAR-165) — real GC: once the stored tail settles, drop the
    // entry so the Map does not grow unboundedly across the process lifetime.
    // A caller that queued while the tail was pending has already REPLACED the
    // entry, so the identity check skips deletion — only the truly-last
    // holder clears the slot. (The old check here compared freshly built
    // promise chains and could never match; it was dead code.)
    tail.then(() => { if (LOCKS.get(path) === tail) LOCKS.delete(path); });
  }
}

/**
 * FULL-R1 (finding 2, part 3) — temp-then-rename write for the shared
 * data files (pipeline.md, last-scan.json, …). A plain
 * `writeFileSync(target)` opens the target with 'w' — truncating it —
 * and only then writes, so a crash mid-write (OOM kill, ENOSPC, any
 * throw) leaves a truncated file behind. Writing a same-directory temp
 * (same filesystem ⇒ rename stays atomic) and renaming it into place
 * means readers see either the whole old file or the whole new one,
 * never a partial write. The temp carries a pid + random suffix and is
 * unlinked on ANY failure so no litter accumulates.
 *
 * Pair it with `withFileLock` for read-modify-write surfaces: the lock
 * closes the lost-update race between writers, atomicWrite closes the
 * torn-file race between a writer and every reader.
 *
 * @param {string} filePath — absolute target path
 * @param {string|Buffer} data — full new content
 */
export function atomicWrite(filePath, data) {
  const tmp = join(
    dirname(filePath),
    `.${basename(filePath)}.${process.pid}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.tmp`,
  );
  try {
    writeFileSync(tmp, data);
    renameSync(tmp, filePath);
  } catch (err) {
    try { unlinkSync(tmp); } catch { /* temp never created or already gone */ }
    throw err;
  }
}

/**
 * Test-only — reset the lock map. Used by `tests/concurrent-tracker-write`
 * to ensure each test starts from a clean state. Production callers
 * never invoke this.
 */
export function _resetLocks() {
  LOCKS.clear();
}

/**
 * Test-only — number of live lock slots. `withFileLock`'s GC drops an entry
 * once its tail settles with no caller queued behind it, so this reads 0 in a
 * settled process (guarded by tests/file-lock-gc).
 */
export function _pendingLocks() {
  return LOCKS.size;
}
