/**
 * scoring-cache.mjs — the deterministic-scoring cache (CAR-239).
 *
 * A repeat of the same scoring input must not re-roll the dice: the cache
 * stores the assembled scoring (integer sub-scores + the server-computed
 * final score) keyed by EVERYTHING that can move the number:
 *
 *   key = sha256(stableHeader + '\n' + normalizedJD + '\n' + cvHash
 *                + '\n' + profileHash + '\n' + model)
 *
 *   • stableHeader — the byte-exact scoring instruction header; a rubric
 *     edit invalidates every entry by construction.
 *   • normalizedJD — whitespace-normalized JD text (a re-scan that only
 *     reflows whitespace stays a hit).
 *   • cvHash — sha256 of cv.md; profileHash — sha256 over config/profile.yml,
 *     modes/_profile.md and modes/_custom.md (the user-owned scoring inputs;
 *     the system rubric files ride stableHeader). 'missing' when a file is
 *     absent, so creating one invalidates too.
 *   • model — the active provider slug + its configured model id; a model
 *     switch invalidates.
 *
 * Locale is deliberately NOT in the key: the scoring input is byte-identical
 * across all 19 locales (the cache-neutrality gate), so one entry serves
 * every language and the per-locale parity gate holds by construction.
 *
 * Safety TTL: 7 days — even with unchanged inputs, a stale entry expires
 * rather than serving a number the rubric may no longer produce.
 *
 * Storage: data/scoring-cache.json (CAREER_OPS_ROOT-aware via PATHS.root),
 * bounded to ~500 entries (LRU by lastUsed), written atomically
 * (temp file + rename) under the per-file lock. Every failure mode — a
 * corrupt file, an unwritable dir, a lock timeout — degrades to a miss;
 * the cache is an optimization, never a dependency.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { PATHS } from './paths.mjs';
import { effectiveEnv } from './env-config.mjs';
import { withFileLock } from './file-lock.mjs';

const MAX_ENTRIES = 500;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const SCORING_CACHE_FILE = join(PATHS.root, 'data', 'scoring-cache.json');

function sha256(s) {
  return createHash('sha256').update(String(s ?? '')).digest('hex');
}

/**
 * Whitespace-normalized JD for the cache key: CRLF → LF, runs of spaces and
 * tabs collapsed, 3+ newlines folded to a paragraph break, trimmed. Content
 * semantics are untouched — only bytes that cannot change the score are.
 */
export function normalizeJdForCache(jd) {
  return String(jd ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function fileHash(p) {
  try {
    return sha256(readFileSync(p, 'utf8'));
  } catch {
    return 'missing';
  }
}

/** The user-owned inputs that can move the score, hashed separately. */
function cvHash() {
  return fileHash(PATHS.cv);
}

function profileHash() {
  const files = [
    PATHS.profile,
    PATHS.modesProfile,
    join(PATHS.root, 'modes', '_custom.md'),
  ];
  return sha256(files.map((p) => `${p}:${fileHash(p)}`).join('\n'));
}

/**
 * The model identity ingredient: provider slug + configured model id. The
 * one slug that breaks the `${SLUG}_MODEL` convention (github →
 * GITHUB_MODELS_MODEL) is special-cased; anything unmapped reads 'default',
 * which only loses per-model granularity, never correctness.
 */
const MODEL_ENV_BY_SLUG = { github: 'GITHUB_MODELS_MODEL' };

export function scoringModelIdentity(mode) {
  const slug = String(mode || 'unknown');
  const envName = MODEL_ENV_BY_SLUG[slug] || `${slug.toUpperCase()}_MODEL`;
  let model = null;
  try {
    model = effectiveEnv(envName, PATHS.envFile);
  } catch { model = null; }
  return `${slug}:${model || 'default'}`;
}

/**
 * The cache key (CAR-239). `stableHeader` is the scoring step's byte-stable
 * instruction prefix; `jd` the raw JD (normalized here); `model` the
 * identity string from scoringModelIdentity().
 */
export function scoringCacheKey({ stableHeader, jd, model }) {
  return sha256(
    `${stableHeader}\n${normalizeJdForCache(jd)}\n${cvHash()}\n${profileHash()}\n${model}`,
  );
}

/** Load the on-disk map; any defect reads as an empty cache. */
function loadMap() {
  try {
    const parsed = JSON.parse(readFileSync(SCORING_CACHE_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object' && parsed.entries && typeof parsed.entries === 'object') {
      return parsed;
    }
  } catch { /* corrupt or absent → empty */ }
  return { entries: {} };
}

/**
 * Read-side LRU freshness: a read bumps the entry's recency in-process, and
 * the NEXT structural write persists the bumps before evicting. Reading must
 * not itself take the lock (the cache is best-effort), so the bump rides
 * along in memory, bounded — this is what makes the eviction LRU rather than
 * insertion-order FIFO.
 */
const lastUsedBumps = new Map();

function pruneBumps() {
  if (lastUsedBumps.size <= MAX_ENTRIES) return;
  const sorted = [...lastUsedBumps.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_ENTRIES);
  lastUsedBumps.clear();
  for (const [k, v] of sorted) lastUsedBumps.set(k, v);
}

function entryFreshness(e) {
  return Number.isFinite(e?.lastUsed) ? e.lastUsed : (Number.isFinite(e?.cachedAt) ? e.cachedAt : 0);
}

/**
 * Read a cache entry. Returns the stored scoring object (integer sub-scores
 * + final score) or null on miss / TTL expiry / corrupt entry.
 */
export function readScoringCache(key, { now = Date.now() } = {}) {
  const e = loadMap().entries?.[key];
  if (!e || !e.scoring || typeof e.scoring !== 'object' || !e.scoring.blocks) return null;
  if (!Number.isFinite(e.cachedAt) || now - e.cachedAt > TTL_MS) return null;
  // In-memory LRU freshness — persisted by the next structural write (see
  // lastUsedBumps), never a write of its own.
  lastUsedBumps.set(key, now);
  pruneBumps();
  return e.scoring;
}

/**
 * Store a scoring result under `key`. Atomic (temp + rename) and locked
 * (read-modify-write against concurrent evaluations). Best-effort by
 * contract: the caller wraps it in try/catch and scoring works without it.
 */
export async function writeScoringCache(key, scoring, { now = Date.now() } = {}) {
  return withFileLock(SCORING_CACHE_FILE, () => {
    const map = loadMap();
    // Fold the read-side recency bumps in before ordering the eviction —
    // entries the caller still hits are not the stale ones.
    for (const [k, t] of lastUsedBumps) {
      const e = map.entries[k];
      if (e && (t > (e.lastUsed ?? 0))) e.lastUsed = t;
    }
    lastUsedBumps.clear();
    map.entries[key] = { scoring, cachedAt: now, lastUsed: now };
    const ids = Object.keys(map.entries);
    if (ids.length > MAX_ENTRIES) {
      ids.sort((a, b) => entryFreshness(map.entries[a]) - entryFreshness(map.entries[b]));
      for (const id of ids.slice(0, ids.length - MAX_ENTRIES)) delete map.entries[id];
    }
    mkdirSync(dirname(SCORING_CACHE_FILE), { recursive: true });
    const tmp = `${SCORING_CACHE_FILE}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tmp, JSON.stringify(map));
    renameSync(tmp, SCORING_CACHE_FILE);
  });
}
