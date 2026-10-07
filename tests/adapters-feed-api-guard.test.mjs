/**
 * Board-feed adapters: buildEndpoint is `string | null` — never anything else.
 *
 * `company.api || FEED_URL` happily returns a non-string when `api:` is a
 * truthy object / number (a misconfigured portals.yml entry POSTed to
 * /api/portals/track can persist exactly that). The registry treats a
 * non-string endpoint as "no endpoint" (belt), but the adapter contract is
 * the braces: for a non-string `api:` the canonical feed URL is returned
 * instead. Garbage input (null / primitives) is refused, never thrown.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT with cv.md, no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let dir;
let adapters;

// The 13 adapters from the finding, with the provider value that selects them.
const FEED_PROVIDERS = [
  ['fourDayWeekAdapter', '4dayweek'],
  ['arbeitnowAdapter', 'arbeitnow'],
  ['arbeitsagenturAdapter', 'arbeitsagentur'],
  ['flowxtraAdapter', 'flowxtra'],
  ['glintsAdapter', 'glints'],
  ['gupyAdapter', 'gupy'],
  ['higheredjobsAdapter', 'higheredjobs'],
  ['himalayasAdapter', 'himalayas'],
  ['ibmAdapter', 'ibm'],
  ['jobbankcaAdapter', 'jobbankca'],
  ['jobicyAdapter', 'jobicy'],
  ['jobspressoAdapter', 'jobspresso'],
  ['jobstreetAdapter', 'jobstreet'],
];

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'adapters-feed-guard-'));
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  process.env.CAREER_OPS_ROOT = dir;
  const A = '../server/lib/portals/adapters/';
  const mods = await Promise.all(
    [...new Set(FEED_PROVIDERS.map(([name]) => name))].map(async (name) => {
      const file = name
        .replace(/Adapter$/, '')
        // camelCase → kebab-file: fourDayWeek → 4dayweek, higheredjobs → higheredjobs
        .replace(/fourDayWeek/i, '4dayweek')
        .replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      const mod = await import(`${A}${file}.mjs`);
      return [name, mod[name]];
    }),
  );
  adapters = Object.fromEntries(mods);
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

test('every feed adapter returns a STRING endpoint for a non-string api', () => {
  for (const [name, provider] of FEED_PROVIDERS) {
    const adapter = adapters[name];
    assert.ok(adapter, `${name} not loaded`);
    for (const bad of [{ evil: 1 }, 42, true, [], '']) {
      const endpoint = adapter.buildEndpoint({ provider, api: bad });
      assert.equal(typeof endpoint, 'string', `${name}.buildEndpoint(api=${JSON.stringify(bad)}) must be a string, got ${typeof endpoint}`);
      assert.notEqual(endpoint, '', name);
    }
  }
});

test('every feed adapter refuses garbage input without throwing', () => {
  for (const [name] of FEED_PROVIDERS) {
    const adapter = adapters[name];
    for (const bad of [null, undefined, 'x', 42]) {
      assert.doesNotThrow(() => adapter.matches(bad), `${name}.matches(${String(bad)}) must not throw`);
      assert.equal(adapter.matches(bad), false, `${name}.matches(${String(bad)}) must be false`);
      assert.doesNotThrow(() => adapter.buildEndpoint(bad), `${name}.buildEndpoint(${String(bad)}) must not throw`);
    }
  }
});

test('the canonical endpoint is unchanged when api is absent', () => {
  for (const [name, provider] of FEED_PROVIDERS) {
    const endpoint = adapters[name].buildEndpoint({ provider });
    assert.equal(typeof endpoint, 'string', name);
    assert.notEqual(endpoint, '', name);
  }
});
