/**
 * portals.yml — a misspelled top-level key must be rejected, not silently
 * ignored (parent career-ops #6107, 32863fd6 — mirrored).
 *
 * `tracked_companys` is not an array under `tracked_companies`, so the EN
 * scanner treated the company list as empty and a scan reported success with
 * zero companies. A key one or two edits from a real setting is a typo; a key
 * far from every known setting is a private note and must keep passing.
 *
 * CI-isolated: CAREER_OPS_ROOT is a temp dir; the only transport is the
 * injected fetchImpl; no network; nothing binds a port.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let portalTopLevelTypos;
let PORTAL_TOP_LEVEL_KEYS;
let nearestKey;
let runEnScan;

const writePortals = (text) => writeFileSync(resolve(dir, 'portals.yml'), text);

const GH_JOB_FIXTURE = (jobs) => async (url) => {
  if (String(url).includes('/boards/healthy/jobs')) {
    return new Response(JSON.stringify({
      jobs: jobs.map((j, i) => ({ id: i, title: j.title, company_name: 'healthy', absolute_url: j.url, location: { name: 'Remote' }, offices: [] })),
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('nf', { status: 404 });
};

let dir;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'portals-keys-test-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  process.env.CAREER_OPS_ROOT = dir;
  ({ portalTopLevelTypos, PORTAL_TOP_LEVEL_KEYS, nearestKey } = await import('../server/lib/portals-keys.mjs'));
  ({ runEnScan } = await import('../server/lib/en-scanner.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
});

// ---------------------------------------------------------------------------
// portalTopLevelTypos — the known-keys allowlist + nearest-key suggestion
// ---------------------------------------------------------------------------

test('a key 1–2 edits from a real setting is flagged with the suggestion', () => {
  const typos = portalTopLevelTypos({
    tracked_companys: [{ name: 'Example Co' }],
    title_fliter: { positive: ['analyst'] },
  });
  const byKey = Object.fromEntries(typos.map((t) => [t.key, t.suggestion]));
  assert.deepEqual(typos.map((t) => t.key).sort(), ['title_fliter', 'tracked_companys']);
  assert.equal(byKey.tracked_companys, 'tracked_companies');
  assert.equal(byKey.title_fliter, 'title_filter');
});

test('a one-letter miss of experience_filter is a typo too (parent follow-up)', () => {
  const typos = portalTopLevelTypos({
    experiance_filter: { enabled: true, stretch_years: 1 },
    tracked_companies: [],
  });
  assert.deepEqual(typos, [{ key: 'experiance_filter', suggestion: 'experience_filter' }]);
});

test('a correctly spelled config and an unrelated private note key pass silently', () => {
  assert.deepEqual(portalTopLevelTypos({
    tracked_companies: [{ name: 'Example Co', careers_url: 'https://boards.example.com/example' }],
    title_filter: { positive: ['analyst'] },
    notes: 'a private reminder, not a setting',
  }), []);
});

test('web-ui-only top-level keys are known (scanner reads them)', () => {
  assert.deepEqual(portalTopLevelTypos({
    telegram_channels: ['@somechannel'],
    scan_quarantine: { enabled: true },
    years_min: 3,
    companies: [{ name: 'Legacy alias' }],
    russian_portals: { queries: ['javascript'] },
  }), []);
});

test('the parent-known shared-file keys are known even where web-ui does not read them', () => {
  // portals.yml is shared with the parent project: keys only the parent's
  // own scanners read must never be flagged here.
  assert.deepEqual(portalTopLevelTypos({
    experience_filter: { enabled: true, stretch_years: 1 },
    max_posting_age_days: 45,
    dayforce_boards: [],
    location_filter: { allow: ['Germany'] },
    skip_tiers: ['Intern'],
  }), []);
});

test('non-object / empty config yields no typos (missing file → {} stays legal)', () => {
  assert.deepEqual(portalTopLevelTypos({}), []);
  assert.deepEqual(portalTopLevelTypos(null), []);
  assert.deepEqual(portalTopLevelTypos(undefined), []);
  assert.deepEqual(portalTopLevelTypos('nope'), []);
  assert.deepEqual(portalTopLevelTypos([]), []);
});

test('PORTAL_TOP_LEVEL_KEYS is exported (the documented allowlist)', () => {
  assert.ok(Array.isArray(PORTAL_TOP_LEVEL_KEYS));
  for (const key of ['tracked_companies', 'title_filter', 'job_boards', 'experience_filter', 'telegram_channels']) {
    assert.ok(PORTAL_TOP_LEVEL_KEYS.includes(key), `missing known key: ${key}`);
  }
});

test('nearestKey: ≤ maxDistance edits suggest, beyond stay null', () => {
  const keys = ['tracked_companies', 'title_filter'];
  assert.equal(nearestKey('tracked_companys', keys, 2), 'tracked_companies');
  assert.equal(nearestKey('title_fliter', keys, 2), 'title_filter');
  assert.equal(nearestKey('totally_unrelated', keys, 2), null);
});

// ---------------------------------------------------------------------------
// runEnScan wiring — the parse path rejects the typo BEFORE any fetch
// ---------------------------------------------------------------------------

test('runEnScan refuses a misspelled portals.yml key and names the file, the key, and the suggestion', async () => {
  writePortals('tracked_companys:\n  - name: "Example Co"\n    careers_url: "https://boards.example.com/example"\ntitle_fliter:\n  positive: ["analyst"]\n');
  let fetched = false;
  await assert.rejects(
    () => runEnScan({
      writeFiles: false,
      fetchImpl: async () => { fetched = true; return new Response('[]', { status: 200 }); },
      onLog: () => {},
    }),
    (err) => {
      const msg = String(err?.message || '');
      assert.match(msg, /portals\.yml/);
      assert.match(msg, new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.match(msg, /tracked_companys/);
      assert.match(msg, /tracked_companies/);
      assert.match(msg, /title_fliter/);
      assert.match(msg, /title_filter/);
      return true;
    },
  );
  assert.equal(fetched, false, 'no company is fetched — the scan refuses to run on a typo’d config');
});

test('runEnScan still accepts a correctly spelled company list and an unrelated note key', async () => {
  writePortals([
    'notes: "a private reminder, not a setting"',
    'tracked_companies:',
    '  - name: Healthy GH',
    '    api: https://boards-api.greenhouse.io/v1/boards/healthy/jobs',
    'title_filter:',
    '  positive: ["Senior"]',
  ].join('\n'));
  const result = await runEnScan({
    writeFiles: false,
    fetchImpl: GH_JOB_FIXTURE([{ title: 'Senior Go Engineer', url: 'https://example.com/gh/1' }]),
    onLog: () => {},
  });
  assert.equal(result.counts.fresh, 1, 'the typo gate is silent on a correct file');
  assert.equal(result.fresh[0].url, 'https://example.com/gh/1');
});
