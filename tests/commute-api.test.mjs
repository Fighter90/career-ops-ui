import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server, baseUrl, fixtureRoot, parseCommute, commuteConfig;

before(async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'commute-api-'));
  fixtureRoot = root;
  mkdirSync(resolve(root, 'config'), { recursive: true });
  mkdirSync(resolve(root, 'data'), { recursive: true });
  mkdirSync(resolve(root, 'reports'), { recursive: true });
  writeFileSync(resolve(root, 'cv.md'), '# CV\n');
  writeFileSync(resolve(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(root, 'config', 'profile.yml'), 'commute:\n  home: Never read this\n  max_minutes: 999\n');
  writeFileSync(resolve(root, 'config', 'plugins.yml'), [
    'plugins:',
    '  commute:',
    '    enabled: true',
    '    home_lat: 53.7997',
    '    home_lon: -1.5492',
    '    max_minutes: 45',
    '    router_url: http://localhost:8002',
    '    nominatim_email: private@example.test',
    '',
  ].join('\n'));
  writeFileSync(resolve(root, 'data', 'commute.tsv'), [
    'url\tlocation\tprecision\tlat\tlon\tkm\tmin\tchecked\tfactor',
    'https://jobs.example.test/role/?gh_jid=1&utm_source=x\tLeeds\tcity\t53.8\t-1.55\t31\t34\t2026-10-11\t1',
    'https://jobs.example.test/role/?gh_jid=2\tRemote\tremote\t\t\t\t\t2026-10-11\t1',
    'https://jobs.example.test/role/?gh_jid=3\tBad coordinates\tcity\t999\t-999\t-1\t-5\t2026-10-11\t1',
    'not-a-url\tBad\tcity\t1\t2\t3\t4\t2026-10-11\t1',
    '',
  ].join('\n'));
  writeFileSync(resolve(root, 'data', 'applications.md'), [
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes | URL |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|-----|',
    '| 001 | 2026-10-11 | Acme | One | 4.4/5 | Evaluated | — | | | https://jobs.example.test/role/?gh_jid=1 |',
    '| 002 | 2026-10-11 | Beta | Two | 3.1/5 | Evaluated | — | [two](reports/two.md) | | N/A |',
    '| 003 | 2026-10-11 | Gamma | Three | — | Interested | — | | | N/A |',
    '',
  ].join('\n'));
  writeFileSync(resolve(root, 'reports', 'two.md'), '**URL:** https://jobs.example.test/role/?gh_jid=2\n');
  process.env.CAREER_OPS_ROOT = root;

  ({ parseCommute, commuteConfig } = await import('../server/lib/commute.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((done) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      done();
    });
  });
});
after(async () => {
  if (server) { server.closeAllConnections?.(); await new Promise((done) => server.close(done)); }
  delete process.env.CAREER_OPS_ROOT;
});

test('parseCommute canonicalizes URLs, preserves functional query ids and drops malformed rows', () => {
  const parsed = parseCommute([
    'url\tlocation\tprecision\tlat\tlon\tkm\tmin\tchecked\tfactor',
    'https://E.test/job/?gh_jid=1&utm_source=x\tA\tpoi\t1\t2\t3\t4\t2026-10-10\t1',
    'https://e.test/job?gh_jid=2\tB\tunknown\t\t\t\t\t2026-10-11\t1',
    'bad\tC\tcity\t1\t2\t3\t4\t2026-10-11\t1',
  ].join('\n'));
  assert.equal(parsed.size, 2);
  assert.deepEqual(parsed.get('https://e.test/job?gh_jid=1'), {
    location: 'A', precision: 'poi', lat: 1, lon: 2, km: 3, min: 4, checked: '2026-10-10',
  });
  assert.equal(parsed.get('https://e.test/job?gh_jid=2').min, null);
});

test('parseCommute discards impossible coordinates and negative travel values', () => {
  const parsed = parseCommute([
    'url\tlocation\tprecision\tlat\tlon\tkm\tmin\tchecked\tfactor',
    'https://e.test/job/3\tBad\tcity\t91\t181\t-1\t-5\t2026-10-11\t1',
  ].join('\n')).get('https://e.test/job/3');
  assert.deepEqual(parsed, {
    location: 'Bad', precision: 'city', lat: null, lon: null, km: null, min: null, checked: '2026-10-11',
  });
});

test('parseCommute handles empty input, defaults, zeroes, and duplicate URLs', () => {
  assert.equal(parseCommute().size, 0);
  assert.equal(parseCommute('url\tlocation').size, 0);
  const parsed = parseCommute([
    'url\tlocation\tprecision\tlat\tlon\tkm\tmin\tchecked',
    '',
    'https://e.test/job/4\t\t\t0\t0\t0\t0\t',
    'https://e.test/job/4\tLatest\tpostal\t-90\t-180\t1\t2\tnow',
  ].join('\n'));
  assert.deepEqual(parsed.get('https://e.test/job/4'), {
    location: 'Latest', precision: 'postal', lat: -90, lon: -180, km: 1, min: 2, checked: 'now',
  });
});

test('commuteConfig reads plugins.yml, never the legacy profile.yml shape', () => {
  assert.deepEqual(commuteConfig(), { home: { lat: 53.7997, lon: -1.5492 }, maxMinutes: 45 });
});

test('commuteConfig fails closed for malformed or unsafe plugin values', () => {
  const plugins = resolve(fixtureRoot, 'config', 'plugins.yml');
  writeFileSync(plugins, 'plugins: [');
  assert.deepEqual(commuteConfig(), { home: null, maxMinutes: null });

  writeFileSync(plugins, '{}\n');
  assert.deepEqual(commuteConfig(), { home: null, maxMinutes: null });

  writeFileSync(plugins, [
    'plugins:',
    '  commute:',
    '    home_lat: 91',
    '    home_lon: 181',
    '    max_minutes: -1',
    '',
  ].join('\n'));
  assert.deepEqual(commuteConfig(), { home: null, maxMinutes: null });

  writeFileSync(plugins, [
    'plugins:',
    '  commute:',
    '    home_lat: 0',
    '    home_lon: 0',
    '    max_minutes: 1440',
    '',
  ].join('\n'));
  assert.deepEqual(commuteConfig(), { home: { lat: 0, lon: 0 }, maxMinutes: 1440 });

  writeFileSync(plugins, [
    'plugins:',
    '  commute:',
    '    enabled: true',
    '    home_lat: 53.7997',
    '    home_lon: -1.5492',
    '    max_minutes: 45',
    '',
  ].join('\n'));
});

test('GET /api/commute exposes only UI data, joins tracker nums, and is no-store', async () => {
  const res = await fetch(baseUrl + '/api/commute');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.equal(body.available, true);
  assert.deepEqual(body.home, { lat: 53.7997, lon: -1.5492 });
  assert.equal(body.maxMinutes, 45);
  assert.equal(body.byUrl['https://jobs.example.test/role?gh_jid=1'].min, 34);
  assert.equal(body.byUrl['https://jobs.example.test/role?gh_jid=2'].precision, 'remote');
  assert.equal(body.byNum['001'].min, 34);
  assert.equal(body.byNum['002'].precision, 'remote', 'an invalid tracker URL falls back to the report URL');
  assert.equal(JSON.stringify(body).includes('private@example.test'), false);
  assert.equal(JSON.stringify(body).includes('router_url'), false);
});
