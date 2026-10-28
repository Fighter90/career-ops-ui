import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// CAR-173 — the persistent geocode cache must survive a restart.
//
// (a)+(b) lock the debounced insert-flush contract (CAR-142): an insert lands
// in .cache/geocode.json within the debounce window, the file stays valid
// JSON, and previously cached entries survive alongside the new key.
//
// (c) is the mechanism gate for the actual CAR-173 defect: the flush wrote the
// TARGET path with a bare writeFileSync (truncate-then-write), so a crash, OOM
// or SIGKILL mid-write left a torn file and the next boot's JSON.parse threw —
// silently discarding the WHOLE cache (weeks of Nominatim budget, not just the
// day's). The flush must go through file-lock.mjs::atomicWrite (same-dir temp
// + rename), like every other shared-file write since FULL-R1/FULL-M1.
// Weak gate (mechanism): a mid-write crash is not deterministically injectable
// in CI, so the contract pins the atomicWrite path instead; the behavioral
// half runs both flush paths end to end (debounce + exit hook) and asserts no
// temp litter and a parseable file.

let mod;
const dir = mkdtempSync(join(tmpdir(), 'geocode-flush-'));
const file = join(dir, 'geocode.json');

before(async () => {
  process.env.GEOCODE_SAVE_MS = '150';   // fast debounce for the window assertions (read lazily per save)
  mod = await import('../server/lib/routes/geocode.mjs');
});

function nominatim(table) {
  return async (url) => {
    const q = decodeURIComponent(new URL(url).searchParams.get('q'));
    return { ok: true, json: async () => table[q] || [] };
  };
}

const KYIV = { kyiv: [{ lat: '50.45', lon: '30.52', place_rank: 16, addresstype: 'city' }] };

test('CAR-173 (a): an insert reaches the cache file within the debounce window — no explicit flush', async () => {
  mod._resetGeocode({}, file);
  await mod.geocode('Kyiv', { fetch: nominatim(KYIV) });
  await new Promise((r) => setTimeout(r, 600));   // > GEOCODE_SAVE_MS(150) debounce
  const stored = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(stored['kyiv'].lat, 50.45);
});

test('CAR-173 (b): the flushed file is valid JSON and keeps earlier entries', async () => {
  mod._resetGeocode({ 'moscow, russia': { lat: 55.75, lon: 37.61, rank: 16, at: 'city' } }, file);
  await mod.geocode('Kyiv', { fetch: nominatim(KYIV) });
  await new Promise((r) => setTimeout(r, 600));
  const stored = JSON.parse(readFileSync(file, 'utf8'));   // must not throw
  assert.equal(stored['kyiv'].lat, 50.45);
  assert.equal(stored['moscow, russia'].lat, 55.75);
});

test('CAR-173 (c): both flush paths write atomically (tmp+rename) and leave no torn target or temp litter', async () => {
  // Debounce path: insert → the unref'd timer's flush lands through atomicWrite.
  mod._resetGeocode({}, file);
  await mod.geocode('Kyiv', { fetch: nominatim(KYIV) });
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(JSON.parse(readFileSync(file, 'utf8'))['kyiv'].lat, 50.45);

  // Exit path: the synchronous best-effort write is sync-only, so it must be
  // writeFileSync(tmp)+renameSync — never a bare truncate of the target.
  mod._resetGeocode({}, file);
  await mod.geocode('Hamburg', { fetch: nominatim({ hamburg: [{ lat: '53.55', lon: '10.00', place_rank: 16, addresstype: 'city' }] }) });
  mod._geocodeExitHooks().exit();                          // sync flush on teardown
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).hamburg.lat, 53.55);

  const litter = readdirSync(dir).filter((f) => f.endsWith('.tmp'));
  assert.deepEqual(litter, [], 'no temp files survive a successful flush');

  // Mechanism contract: the module persists through atomicWrite and never
  // opens the target for a truncating write.
  const src = readFileSync(new URL('../server/lib/routes/geocode.mjs', import.meta.url), 'utf8');
  assert.match(src, /import \{[^}]*atomicWrite[^}]*\} from '\.\.\/file-lock\.mjs'/,
    'the flush must import atomicWrite from file-lock.mjs');
  assert.doesNotMatch(src, /writeFileSync\(\s*cacheFile/,
    'no bare writeFileSync of the cache target — truncate-then-write tears on a mid-write crash');
});
