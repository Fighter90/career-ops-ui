/**
 * Location geocoder for the #/map view.
 *
 *   GET /api/geocode?q=<location>[&company=<name>] → { lat, lon, exact }
 *
 * The location must resolve to at least county/city precision (Nominatim
 * place_rank ≥ 12): "Baden-Württemberg, Germany" is a state centroid, not a
 * place, and would stack every such posting on one fake spot. With `company`,
 * the employer's own OSM feature near that place is tried first (`exact: true`)
 * — accepted only if it is a company-like object (office, building, industrial
 * site …, never a street named after the firm) within 25 km of the place.
 *
 * Backed by OpenStreetMap Nominatim (no API key), or a self-hosted instance
 * via NOMINATIM_URL. The public instance's usage policy asks for ≤1
 * request/second, an identifying User-Agent and client-side caching, so every
 * lookup is serialised through one queue (1.1 s gap on the public host; set
 * NOMINATIM_EMAIL to identify yourself) and every answer (hits AND misses) is
 * cached in memory and persisted to `.cache/geocode.json` inside the web-ui
 * checkout (gitignored, never the parent project). The host is fixed by the
 * operator, never by a request, so no SSRF surface.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { WEB_UI_ROOT } from '../paths.mjs';
import { withFileLock } from '../file-lock.mjs';

const NOMINATIM_BASE = (process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/+$/, '');
const NOMINATIM = NOMINATIM_BASE + '/search';
const PUBLIC_NOMINATIM = /^https:\/\/nominatim\.openstreetmap\.org$/i.test(NOMINATIM_BASE);
const EMAIL = process.env.NOMINATIM_EMAIL ? '&email=' + encodeURIComponent(process.env.NOMINATIM_EMAIL) : '';
const UA = 'career-ops-ui (self-hosted job map; https://github.com/Fighter90/career-ops-ui)';
// Public host: ≥1.1 s per its policy. Raise it when several instances share
// one public IP (the limit is per IP): two instances → 2200. A self-hosted
// instance has no such limit unless NOMINATIM_GAP_MS sets one.
const GAP_MS = PUBLIC_NOMINATIM
  ? Math.max(1100, Number(process.env.NOMINATIM_GAP_MS) || 0)
  : Number(process.env.NOMINATIM_GAP_MS) || 0;
// After a 429/503 stop asking entirely for a while instead of retrying each second.
const BACKOFF_MS = 10 * 60 * 1000;
const MAX_LEN = 200;

// Env knobs are read lazily so tests (and operators) can tune a running
// deployment via the environment without a rebuild.
const numEnv = (k, d) => {
  const n = Number(process.env[k]);
  return Number.isFinite(n) && n > 0 ? n : d;
};
// CAR-105 — cap uncached lookups per rolling window (default 50 / minute).
// A cold first map load used to fire thousands of serialized Nominatim calls
// and blocked the page for tens of seconds; now the map fills progressively:
// the first window resolves up to BUDGET places, everything already cached
// answers instantly, later loads spend the next window. Saves the public
// instance from a burst too. Cached keys never consume the budget.
const BUDGET_DEFAULT = 50;
const BUDGET_WINDOW_DEFAULT = 60 * 1000;
let budgetUsed = 0;
let budgetSince = 0;

function budgetAllows() {
  const now = Date.now();
  if (now - budgetSince >= numEnv('GEOCODE_BUDGET_WINDOW_MS', BUDGET_WINDOW_DEFAULT)) {
    budgetSince = now;
    budgetUsed = 0;
  }
  if (budgetUsed >= numEnv('GEOCODE_BUDGET', BUDGET_DEFAULT)) return false;
  budgetUsed++;
  return true;
}

/** Seconds until `until` (epoch ms) — the route's Retry-After (CAR-142). */
function retryAfterSec(until) {
  return Math.max(1, Math.ceil((until - Date.now()) / 1000));
}

// Longest raw `q` the route accepts; normalizeLocation keeps its first place.
export const MAX_QUERY = 2000;
// Locations that are not a place — answered without a request.
const NOT_A_PLACE = /^(remote|anywhere|worldwide|global|distributed|home ?office|wfh|n\/?a|tbd|-|—)$/i;

let cacheFile = resolve(WEB_UI_ROOT, '.cache', 'geocode.json');

let cache = null;            // Map<key, { lat, lon, rank? }> (lat/lon null = known miss)
let queue = Promise.resolve();
let lastCall = 0;
let blockedUntil = 0;

/** Normalise a free-text location into a cache key, or null if not geocodable. */
export function normalizeLocation(q) {
  if (typeof q !== 'string') return null;
  // "Berlin, Germany (Remote)" → "berlin, germany"; "Remote - Berlin" → "berlin"
  const cleaned = q.replace(/\((?:remote|hybrid|on-?site|hq|headquarters)[^)]*\)/gi, '')
    .replace(/^\s*(?:remote|hybrid|on-?site)\s*[-–—:|/]\s*/i, '');
  // Multi-location postings ("Berlin; Munich", "Berlin | London", "Berlin / Munich",
  // one per line, "Berlin Office · Berlin · Germany · Bosnia · …"): map the first
  // real place. Split BEFORE the length check — a 300-character country list still
  // names its city first (2026-10-07: four such postings had no marker).
  const first = cleaned.split(/\s*[;|·•\n]\s*|\s+\/\s+|\s+or\s+/i)
    .map((p) => p.replace(/\s+/g, ' ').trim().toLowerCase())
    .find((p) => p && !NOT_A_PLACE.test(p) && !/^remote\b/.test(p)); // "Remote U.S." is not a place
  let s = first || '';
  if (!s || s.length > MAX_LEN) return null;      // one 200+ char "place" is not a place
  // Work-mode segments ("Berlin, Remote", "Remote, Remote") are not places —
  // Nominatim happily resolves "berlin, remote" to Ontario.
  s = s.split(/\s*,\s*/).filter((p) => p && !NOT_A_PLACE.test(p) && !/^(hybrid|on-?site)$/.test(p)).join(', ');
  s = s.replace(/^greater (.+?) area$/, '$1');   // LinkedIn metro labels
  s = s.replace(/\s+(?:office|hq|headquarters)$/, ''); // "Berlin Office" → "berlin"
  if (/^posted:/.test(s)) return null;           // scraper noise in the location cell
  return s || null;
}

function loadCache() {
  if (cache) return cache;
  try {
    const stored = JSON.parse(readFileSync(cacheFile, 'utf8'));
    cache = new Map(stored && typeof stored === 'object' && !Array.isArray(stored) ? Object.entries(stored) : []);
  } catch { cache = new Map(); }
  trimInMemory(cache);       // CAR-142 rev-2 — a disk-loaded map can exceed the cap
  return cache;
}

// CAR-105 — one debounced write per burst instead of a full-file rewrite per
// insert (a big board made the old code rewrite the whole cache thousands of
// times per map load). The write is bounded (GEOCODE_CACHE_MAX, oldest
// entries dropped — Map keeps insertion order) and serialised through
// withFileLock, like every other shared-file write in this repo.
let saveTimer = null;
let dirty = false;
let saveGen = 0;             // bumped on every insert (CAR-142 rev-2 — dirty races)

function scheduleSave() {
  dirty = true;
  saveGen++;
  // CAR-142 rev-3 #8 — new data re-arms the beforeExit hook: the latch only
  // covers the last FAILED attempt (a failing flush must not loop the exit
  // sequence), so fresh inserts always get a fresh flush attempt.
  beforeExitFlushed = false;
  // CAR-142 rev-3 #4 — lazy install at the FIRST insert: a script that merely
  // imports the module installs nothing, but any consumer that actually has
  // something to lose (routes, CLI builders) keeps the teardown flush.
  installExitHooks();
  if (saveTimer) return;
  saveTimer = setTimeout(() => { _flushGeocodeCache().catch(() => {}); }, numEnv('GEOCODE_SAVE_MS', 2000));
  saveTimer.unref?.();
}

/** The entries a flush persists (bounded — Map keeps insertion order, oldest first). */
function persistableEntries() {
  const max = numEnv('GEOCODE_CACHE_MAX', 20000);
  return max > 0 && cache.size > max ? [...cache].slice(-max) : [...cache];
}

// CAR-142 rev-3 #6 — flushes are serialized through this chain: every
// snapshot is taken at the flush's own turn, so a write can never land
// BEHIND a newer full-file write. (withFileLock serialises the writes
// themselves, but the snapshots were taken before the wait — the ordering
// used to lean on that chain's FIFO internals; now it is structural.)
let flushChain = Promise.resolve();

/** Persist the cache now (test hook; also the trailing edge of the debounce). */
export function _flushGeocodeCache() {
  const run = flushChain.then(() => flushGeocodeCacheNow());
  flushChain = run.catch(() => {});
  return run;
}

// CAR-142 rev-3 #5 — >0 while a flush is inside its withFileLock critical
// section. The signal hook never re-raises a shutdown while a write is in
// flight: the process would die between the lock acquisition and the release
// and strand the file mid-write (a torn cache file).
let lockWrites = 0;

/**
 * Persist the cache now (test hook; also the trailing edge of the debounce).
 *
 * CAR-142 — the flag clears only AFTER the write landed, so a failed write
 * (read-only install, transient ENOSPC) keeps the pending inserts for a later
 * flush. CAR-142 rev-2 — the snapshot is taken at entry and the generation
 * counter guards the clear: an insert landing while this flush waits for the
 * lock (or after its write) bumps `saveGen`, so `dirty` stays set and the
 * next flush persists it instead of the trailing debounce seeing a clean flag
 * and skipping the value.
 */
async function flushGeocodeCacheNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (!dirty || !cache) return;
  const g = saveGen;
  const entries = persistableEntries();
  try {
    mkdirSync(dirname(cacheFile), { recursive: true });
    await withFileLock(cacheFile, () => {
      lockWrites++;
      try {
        writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(entries)));
      } finally {
        lockWrites--;
      }
    });
    if (saveGen === g) dirty = false;
  } catch { /* read-only install → memory cache only; dirty survives */ }
}

// CAR-142 — the debounced save above is unref'd, so a service restart used to
// drop every insert flushed in the last GEOCODE_SAVE_MS. Flush on teardown:
// `beforeExit` runs the normal async save while the loop is still draining,
// `exit` makes one synchronous best-effort write (async work is not allowed
// in `exit`), and SIGTERM/SIGINT flush then re-raise — node suppresses the
// default termination while a signal listener is registered, so the re-raise
// keeps the process dying on systemctl stop / Ctrl-C (skipped when another
// handler owns the signal; that handler will exit() and the `exit` hook fires).
function flushSyncBestEffort() {
  if (!dirty || !cache) return;
  try {
    mkdirSync(dirname(cacheFile), { recursive: true });
    writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(persistableEntries())));
  } catch { /* best effort — the process is exiting */ }
}

// CAR-142 rev-2 — beforeExit latches after a FAILED flush. A flush that keeps
// failing (EACCES/ENOSPC, a lock that never acquires) schedules new async work
// on every fire, which refills the event loop so beforeExit fires again — the
// process would never exit naturally. Anything still dirty is the sync `exit`
// hook's job. CAR-142 rev-3 #8 — the latch covers only the LAST attempt:
// scheduleSave() clears it, so new data always gets a fresh flush attempt and
// a long-lived process never skips a later teardown permanently.
let beforeExitFlushed = false;

function onBeforeExit() {
  if (beforeExitFlushed) return;
  beforeExitFlushed = true;
  _flushGeocodeCache().catch(() => {});
}

// CAR-142 rev-2 — race the flush against a short budget: a contended/stale
// lock must be able to hold shutdown hostage only that long (systemd then
// escalates to SIGKILL; a naturally draining loop simply exits). The timer is
// unref'd so it never keeps a dying process alive on its own.
const FLUSH_EXIT_BUDGET_MS = 1000;

function signalFlush(signal) {
  return () => {
    const done = _flushGeocodeCache().catch(() => {});
    const budget = new Promise((resolve) => {
      const t = setTimeout(resolve, numEnv('GEOCODE_FLUSH_EXIT_MS', FLUSH_EXIT_BUDGET_MS));
      t.unref?.();
    });
    // CAR-142 rev-3 #2 — the race promise is RETURNED, so a caller (tests, any
    // wrapper) can wait out the re-raise DECISION instead of racing it:
    // asserting or restoring state before it settles is exactly the bug class
    // this hook exists to prevent.
    return Promise.race([done, budget]).then(async () => {
      // CAR-142 rev-3 #5 — never re-raise with a write in flight: the process
      // would die between the lock acquisition and the release and leave the
      // cache file torn. Finish the write, then terminate.
      if (lockWrites > 0) await done;
      if (process.listenerCount(signal) === 0) {
        try { process.kill(process.pid, signal); } catch { /* already gone */ }
      }
    });
  };
}

let exitHooksInstalled = false;

// CAR-142 rev-3 #4 — nothing installs at MODULE LOAD; the hooks arrive with
// the first scheduleSave() (below) or with route registration — whichever
// happens first for this consumer.
function installExitHooks() {
  if (exitHooksInstalled) return;
  exitHooksInstalled = true;
  process.on('beforeExit', onBeforeExit);
  process.on('exit', flushSyncBestEffort);
  process.once('SIGTERM', signalFlush('SIGTERM'));
  process.once('SIGINT', signalFlush('SIGINT'));
}

/** Test hook: the teardown handlers (invoke directly — no real events emitted, no install). */
export function _geocodeExitHooks() {
  return { beforeExit: onBeforeExit, exit: flushSyncBestEffort, signal: signalFlush };
}

const MISS = { lat: null, lon: null };
const MIN_PLACE_RANK = 12;   // county/city and finer; state = 8, country = 4
// City-states (Berlin, Hamburg) rank like a state but are cities.
const SETTLEMENT = new Set(['city', 'town', 'village', 'municipality', 'suburb', 'borough']);
const MAX_COMPANY_KM = 25;

/** CAR-142 — bound the LIVE map (previously only the persisted copy was trimmed). */
function trimInMemory(c) {
  const max = numEnv('GEOCODE_CACHE_MAX', 20000);
  while (max > 0 && c.size > max) c.delete(c.keys().next().value);
}

/** Rate-limited Nominatim search → raw jsonv2 hits. */
async function search(q, limit, fetchImpl) {
  if (Date.now() < blockedUntil) {
    // CAR-142 rev-2 — the backoff window is a "try later" state like a spent
    // budget: the route turns this into 503 + Retry-After instead of 502.
    const err = new Error('nominatim backoff');
    err.code = 'GEOCODE_BACKOFF';
    err.retryAfter = retryAfterSec(blockedUntil);
    throw err;
  }
  if (!budgetAllows()) {
    // CAR-142 — a spent budget is "try later", not "provider down": the route
    // turns this into 503 + Retry-After instead of a generic 502, so a cold
    // map burst does not read as every row being permanently unlocatable.
    const err = new Error('geocode budget exhausted');
    err.code = 'GEOCODE_BUDGET';
    err.retryAfter = retryAfterSec(budgetSince + numEnv('GEOCODE_BUDGET_WINDOW_MS', BUDGET_WINDOW_DEFAULT));
    throw err;
  }
  const wait = lastCall + GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const url = `${NOMINATIM}?format=jsonv2&limit=${limit}&q=${encodeURIComponent(q)}${EMAIL}`;
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 429 || res.status === 503) blockedUntil = Date.now() + BACKOFF_MS;
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const hits = await res.json();
  return Array.isArray(hits) ? hits : [];
}

const coords = (h) => {
  const lat = parseFloat(h && h.lat);
  const lon = parseFloat(h && h.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
};

/**
 * Employer name → search term: drops legal forms, group/region suffixes and
 * parentheticals ("NTT DATA Europe & Latam" → "NTT DATA", "ZEISS Group" →
 * "ZEISS", "Acme S.A.S." → "Acme"), which OSM names rarely carry. null when
 * nothing usable is left.
 */
export function cleanCompany(name) {
  if (typeof name !== 'string') return null;
  const s = name.replace(/\([^)]*\)/g, ' ').split(/\s+[/|]\s+/)[0]
    // Legal forms (DE/AT/CH, UK/US, FR, IT/ES, Benelux, Nordics, PL, AU, JP),
    // dotted ("S.A.S.", "B.V.") or not, then group and region words — never
    // the first word ("SAS Institute", "AB InBev" keep it).
    .replace(/(?<=\S\s+)(?:s\.?\s?a\.?\s?r\.?\s?l|s\.?\s?a\.?\s?s|s\.?\s?r\.?\s?l|s\.?\s?p\.?\s?a|s\.?\s?l|s\.?\s?a|b\.?\s?v|n\.?\s?v|sp\.?\s?z\s?o\.?\s?o|e\.?\s?v|k\.?\s?k)\.?(?![\p{L}\p{N}])/giu, ' ')
    .replace(/(?<=\S\s+)\b(gmbh|mbh|ag|se|kgaa|kg|co|gbr|ug|ltd|limited|inc|llc|plc|corp|corporation|oy|oyj|ab|asa|as|aps|pty|group|gruppe|groupe|grupo|holding|international|europe|emea|americas|apac|latam|global)\b\.?/gi, ' ')
    .replace(/[^\p{L}\p{N}&.\- ]/gu, ' ')
    .replace(/(\s[&+\-]\s*)+$/, '')
    .replace(/\s+/g, ' ').trim().replace(/^[&\-\s]+|[&\-\s]+$/g, '');
  return s.length >= 2 && s.length <= 120 ? s : null;
}

// A street named "Carl-Zeiss-Straße" or a whole town is not the employer.
const COMPANY_TYPES = {
  office: null, craft: null, industrial: null, man_made: ['works'],
  healthcare: null, building: ['commercial', 'industrial', 'office', 'retail', 'warehouse', 'yes', 'university', 'hospital'],
  landuse: ['industrial', 'commercial', 'retail'],
  amenity: ['university', 'college', 'research_institute', 'hospital', 'clinic', 'townhall'],
};
export function isCompanyFeature(h) {
  if (!h || !Object.hasOwn(COMPANY_TYPES, h.category)) return false;
  const types = COMPANY_TYPES[h.category];
  return !types || types.includes(h.type);
}

function km(a, b) {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

/**
 * Recency refresh on a hit (CAR-142 rev-2): re-insert the key so the
 * insertion-ordered trim keeps hot keys. No scheduleSave — geocode is
 * read-heavy and the debounce exists to avoid a write per lookup; but the
 * reorder itself IS durable: persistableEntries() spreads the live map at
 * flush time, so the next flush persists the recency order too (rev-3 #9).
 */
function touch(c, key) {
  const v = c.get(key);
  c.delete(key);
  c.set(key, v);
}

/** Cached, queued lookup: `compute` runs at most once per key. */
function cached(key, compute) {
  const c = loadCache();
  if (c.has(key)) { touch(c, key); return Promise.resolve(c.get(key)); }
  const run = queue.then(async () => {
    if (c.has(key)) { touch(c, key); return c.get(key); }     // filled while we were queued
    c.set(key, await compute());
    trimInMemory(c);                       // CAR-142 — bound the live map at insert time too
    scheduleSave();
    return c.get(key);
  });
  // A failed lookup (network/429) is NOT cached and must not stall the queue.
  queue = run.catch(() => {});
  return run;
}

/** Geocode one location (+ optional employer); cached, rate-limited. */
export async function geocode(q, deps = {}, company = '') {
  const key = normalizeLocation(q);
  if (!key) return { ...MISS, exact: false };
  const f = deps.fetch || fetch;
  const c = loadCache();
  // Entries from before the precision check carry no rank, and early rejects
  // carry no address type (city-states) — look those up again, but keep the
  // old answer if Nominatim is unavailable (rate limit) rather than losing it.
  const old = c.get(key);
  const stale = old && ((old.lat != null && old.rank == null) || (old.lat == null && old.rank != null && old.at == null));
  if (stale) c.delete(key);
  let place;
  try {
    place = await cached(key, async () => {
      const [hit] = await search(key, 1, f);
      const pos = coords(hit);
      const rank = hit ? Number(hit.place_rank) || 0 : 0;
      const at = (hit && hit.addresstype) || '';
      return pos && (rank >= MIN_PLACE_RANK || SETTLEMENT.has(at)) ? { ...pos, rank, at } : { ...MISS, rank, at };
    });
  } catch (err) {
    if (!stale) throw err;
    c.set(key, old);
    place = old;
  }
  if (place.lat == null) return { ...MISS, exact: false };
  const name = cleanCompany(company);
  if (name) {
    // A failed employer lookup (429/5xx) is not cached; the place still counts.
    const firm = await cached(`co:${name.toLowerCase()}|${key}`, async () => {
      const hits = await search(`${name}, ${key}`, 5, f);
      const hit = hits.find((h) => isCompanyFeature(h) && coords(h) && km(coords(h), place) <= MAX_COMPANY_KM);
      return coords(hit) || MISS;
    }).catch(() => MISS);
    if (firm.lat != null) return { lat: firm.lat, lon: firm.lon, exact: true };
  }
  return { lat: place.lat, lon: place.lon, exact: false };
}

/** Test hook: reset state, seed the cache, redirect the cache file. */
export function _resetGeocode(seed = null, file = cacheFile) {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  dirty = false;
  saveGen = 0;
  beforeExitFlushed = false;
  budgetUsed = 0; budgetSince = 0;
  cache = seed instanceof Map ? new Map(seed) : seed && typeof seed === 'object' ? new Map(Object.entries(seed)) : null;
  cacheFile = file; queue = Promise.resolve(); lastCall = 0; blockedUntil = 0;
}

export function registerGeocodeRoutes(app) {
  installExitHooks();          // rev-3 #4 — routes install eagerly; non-route consumers install lazily via scheduleSave()
  app.get('/api/geocode', async (req, res) => {
    // A long multi-location cell is trimmed to its first place, not refused;
    // only an absurd query (not a posting's location) is a 400.
    const q = String(req.query.q || '');
    const company = String(req.query.company || '').slice(0, MAX_LEN);
    if (q.length > MAX_QUERY) return res.status(400).json({ error: 'q too long' });
    try {
      res.json(await geocode(q, {}, company));
    } catch (err) {
      // CAR-142 — both "try later" states (spent budget, Nominatim backoff)
      // answer 503 + Retry-After so the client can tell them from a provider
      // failure. The value is computed once: header and body always agree.
      if (err && (err.code === 'GEOCODE_BUDGET' || err.code === 'GEOCODE_BACKOFF')) {
        // retryAfterSec() is always ≥ 1 — no fallback needed (rev-3 #10).
        const retryAfter = err.retryAfter;
        res.set('Retry-After', String(retryAfter));
        return res.status(503).json({
          error: err.code === 'GEOCODE_BUDGET' ? 'geocode budget exhausted' : 'nominatim backoff',
          retryAfter,
        });
      }
      res.status(502).json({ error: 'geocoder unavailable' });
    }
  });
}
