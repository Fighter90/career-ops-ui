/**
 * FULL-M3 (unpinned overrides) — the shared `pinnedOverride(raw, HOST_RE)`
 * helper (server/lib/sources/_override.mjs) and its wiring into every board
 * adapter that accepts a portals.yml endpoint override (`api:` /
 * `company.<id>`). A valid HTTPS URL on the board's pinned host reaches the
 * fetch slot; anything else — off-host, http downgrade, garbage, non-string —
 * falls back to the canonical endpoint instead of aiming the scanner
 * transport at an attacker-chosen URL (portals.yml is API-writable).
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT with cv.md before the adapter imports
 * (mycareersfuture.mjs transitively loads paths.mjs, which resolves at module
 * load), injected nothing, no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { pinnedOverride } from '../server/lib/sources/_override.mjs';
import { FEED_URL as REMOTEOK_FEED, REMOTEOK_HOST_RE } from '../server/lib/sources/remoteok.mjs';
import { FEED_URL as REMOTIVE_FEED, REMOTIVE_HOST_RE } from '../server/lib/sources/remotive.mjs';

// [adapter export, provider value, override keys in precedence order]
const CASES = [
  ['remoteokAdapter', 'remoteok', ['remoteok', 'api']],
  ['remotiveAdapter', 'remotive', ['remotive', 'api']],
  ['thehubAdapter', 'thehub', ['thehub', 'api']],
  ['themuseAdapter', 'themuse', ['themuse', 'api']],
  ['landingjobsAdapter', 'landingjobs', ['landingjobs', 'api']],
  ['weworkremotelyAdapter', 'weworkremotely', ['weworkremotely', 'api']],
  ['vdabAdapter', 'vdab', ['api']],
  ['wttjAdapter', 'wttj', ['api']],
  ['mycareersfutureAdapter', 'mycareersfuture', ['api']],
  ['glintsAdapter', 'glints', ['api']],
  ['jobstreetAdapter', 'jobstreet', ['api']],
  ['jobspressoAdapter', 'jobspresso', ['jobspresso', 'api']],
  ['jobicyAdapter', 'jobicy', ['jobicy', 'api']],
  ['himalayasAdapter', 'himalayas', ['himalayas', 'api']],
  ['arbeitnowAdapter', 'arbeitnow', ['arbeitnow', 'api']],
  ['fourDayWeekAdapter', '4dayweek', ['4dayweek', 'api']],
  ['flowxtraAdapter', 'flowxtra', ['flowxtra', 'api']],
  ['higheredjobsAdapter', 'higheredjobs', ['higheredjobs', 'api']],
];

let dir;
const adapters = {};

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'full-m3-pinned-override-'));
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  process.env.CAREER_OPS_ROOT = dir;

  const base = '../server/lib/portals/adapters/';
  await Promise.all(CASES.map(async ([name, provider, keys]) => {
    const file = name
      .replace(/Adapter$/, '')
      .replace(/fourDayWeek/i, '4dayweek')
      .replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    const mod = await import(`${base}${file}.mjs`);
    adapters[name] = { adapter: mod[name], provider, keys };
  }));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

// ── the helper itself ───────────────────────────────────────────────────────

const HOST_RE = /^example\.com$/i;

test('pinnedOverride: a valid https URL on the pinned host passes through', () => {
  assert.equal(pinnedOverride('https://example.com/api/jobs', HOST_RE), 'https://example.com/api/jobs');
  assert.equal(pinnedOverride('https://example.com/', HOST_RE), 'https://example.com/');
  assert.equal(pinnedOverride('  https://example.com/x  ', HOST_RE), 'https://example.com/x', 'trimmed');
  assert.equal(pinnedOverride('https://EXAMPLE.com/x', HOST_RE), 'https://EXAMPLE.com/x');
});

test('pinnedOverride: subdomains only when the regex allows them', () => {
  const SUB_RE = /(?:^|\.)example\.com$/i;
  assert.equal(pinnedOverride('https://api.example.com/x', SUB_RE), 'https://api.example.com/x');
  assert.equal(pinnedOverride('https://example.com.evil.test/x', SUB_RE), null, 'suffix spoof');
});

test('pinnedOverride: off-host / http / garbage / non-string → null', () => {
  for (const bad of [
    'https://evil.com/x',            // different host
    'http://example.com/x',          // scheme downgrade
    'ftp://example.com/x',           // other scheme
    'https://example.com./x',        // trailing-dot FQDN
    'not a url',                     // garbage
    '',                              // empty
    '   ',                           // whitespace only
    'https://',                      // scheme only
  ]) {
    assert.equal(pinnedOverride(bad, HOST_RE), null, `null for ${JSON.stringify(bad)}`);
  }
  for (const bad of [{ evil: 1 }, 42, true, [], null, undefined]) {
    assert.equal(pinnedOverride(bad, HOST_RE), null, `null for ${JSON.stringify(bad)}`);
  }
});

test('pinnedOverride: never throws', () => {
  assert.doesNotThrow(() => pinnedOverride('https://[' , HOST_RE));
  assert.equal(pinnedOverride('https://[', HOST_RE), null);
});

// ── adapter wiring: the 18 FULL-M3 adapters ────────────────────────────────

test('every override-capable adapter keeps an on-host https override in the fetch slot', () => {
  for (const { adapter, provider, keys } of Object.values(adapters)) {
    assert.ok(adapter, 'adapter loaded');
    // Derive the pinned host from the adapter's own canonical endpoint — the
    // override host must be the host the source's assert accepts anyway.
    const canonical = adapter.buildEndpoint({ provider });
    assert.ok(typeof canonical === 'string' && canonical.startsWith('https://'), 'canonical endpoint');
    const onHost = `${new URL(canonical).origin}/mirror?x=1`;
    for (const key of keys) {
      const got = adapter.buildEndpoint({ provider, [key]: onHost });
      assert.equal(got, onHost, `buildEndpoint must keep the on-host ${key}: override`);
    }
  }
});

test('every override-capable adapter falls back to the canonical endpoint for bad overrides', () => {
  for (const { adapter, provider } of Object.values(adapters)) {
    const canonical = adapter.buildEndpoint({ provider });
    for (const bad of [
      'https://evil.test/mirror',               // off-host
      `http://${new URL(canonical).host}/mirror`, // scheme downgrade
      'not a url',                              // garbage
      { evil: 1 },                              // non-string
      42,
      null,
    ]) {
      const got = adapter.buildEndpoint({ provider, api: bad });
      assert.notEqual(got, bad, `must not aim the fetch slot at ${JSON.stringify(bad)}`);
      assert.equal(typeof got, 'string', 'falls back to a string endpoint');
      assert.equal(got, canonical, 'falls back to the canonical endpoint');
    }
  }
});

test('precedence: the board key wins over api:, and an invalid first key falls through', () => {
  const remoteok = adapters.remoteokAdapter.adapter;
  assert.equal(
    remoteok.buildEndpoint({ provider: 'remoteok', remoteok: 'https://remoteok.com/a', api: 'https://remoteok.com/b' }),
    'https://remoteok.com/a',
  );
  // An invalid board-key override no longer shadows a valid api: override.
  assert.equal(
    remoteok.buildEndpoint({ provider: 'remoteok', remoteok: 'https://evil.test/a', api: 'https://remoteok.com/b' }),
    'https://remoteok.com/b',
  );
});

test('remoteok/remotive reuse the source-exported host regexes (no drift)', () => {
  assert.equal(pinnedOverride('https://remoteok.com/api', REMOTEOK_HOST_RE), 'https://remoteok.com/api');
  assert.equal(pinnedOverride('https://www.remoteok.com/api', REMOTEOK_HOST_RE), 'https://www.remoteok.com/api');
  assert.equal(pinnedOverride('https://remoteok.com.evil.test/api', REMOTEOK_HOST_RE), null);
  assert.equal(pinnedOverride('https://remotive.com/api/remote-jobs', REMOTIVE_HOST_RE), 'https://remotive.com/api/remote-jobs');
  assert.equal(REMOTEOK_FEED.startsWith('https://'), true);
  assert.equal(REMOTIVE_FEED.startsWith('https://'), true);
});

test('SEEK market hosts stay valid jobstreet overrides (au/nz seek.com migration)', () => {
  const jobstreet = adapters.jobstreetAdapter.adapter;
  for (const host of ['au.seek.com', 'nz.seek.com', 'www.seek.com.au', 'sg.jobstreet.com', 'hk.jobsdb.com']) {
    assert.equal(
      jobstreet.buildEndpoint({ provider: 'jobstreet', api: `https://${host}/api/jobsearch/v5/search` }),
      `https://${host}/api/jobsearch/v5/search`,
      host,
    );
  }
});

test('glints alternate allowlist hosts stay valid overrides', () => {
  const glints = adapters.glintsAdapter.adapter;
  for (const host of ['glints.com', 'www.glints.com', 'glints.id']) {
    assert.equal(
      glints.buildEndpoint({ provider: 'glints', api: `https://${host}/api/graphql` }),
      `https://${host}/api/graphql`,
      host,
    );
  }
});
