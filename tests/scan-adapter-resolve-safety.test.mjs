/**
 * One misconfigured tracked_companies entry must not abort the whole EN scan.
 *
 * Before: collage / feishu-jobs / mokahr / telegram / telegram-channel threw
 * from buildEndpoint() on a bad entry (violating the `string | null`
 * contract), resolveAdapter() had no catch, and en-scanner ran detectApi over
 * every company in one `.map()` outside any per-company catch — so a single
 * bad handle killed the scan for every other company.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT, stub fetchImpl, no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let dir;
let resolveAdapter;
let ALL_ADAPTERS;
let runEnScan;
let adapters;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'scan-adapter-safety-'));
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  process.env.CAREER_OPS_ROOT = dir;
  ({ resolveAdapter, ALL_ADAPTERS } = await import('../server/lib/portals/registry.mjs'));
  ({ runEnScan } = await import('../server/lib/en-scanner.mjs'));
  adapters = {
    collage: (await import('../server/lib/portals/adapters/collage.mjs')).collageAdapter,
    feishu: (await import('../server/lib/portals/adapters/feishu-jobs.mjs')).feishuJobsAdapter,
    mokahr: (await import('../server/lib/portals/adapters/mokahr.mjs')).mokahrAdapter,
    telegram: (await import('../server/lib/portals/adapters/telegram.mjs')).telegramAdapter,
    telegramChannel: (await import('../server/lib/portals/adapters/telegram-channel.mjs')).telegramChannelAdapter,
  };
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

test('the five adapters return null (never throw) from buildEndpoint on an invalid entry', () => {
  const bad = [
    [adapters.collage, { name: 'C', provider: 'collage', api: 'https://evil.example/v1/positions/x' }],
    [adapters.collage, { name: 'C', provider: 'collage' }],
    [adapters.feishu, { name: 'F', provider: 'feishu-jobs', careers_url: 'https://evil.example' }],
    [adapters.mokahr, { name: 'M', provider: 'mokahr', careers_url: 'https://evil.example/x/1' }],
    [adapters.telegram, { name: '', provider: 'telegram', channel: 'no spaces allowed!' }],
    [adapters.telegramChannel, { name: 'T', provider: 'telegram-channel', channel: 'x' }],
  ];
  for (const [adapter, company] of bad) {
    assert.equal(adapter.matches(company), true, `${adapter.id} claims the provider-selected entry`);
    assert.doesNotThrow(() => adapter.buildEndpoint(company), adapter.id);
    assert.equal(adapter.buildEndpoint(company), null, adapter.id);
  }
});

test('the five adapters still build an endpoint for a valid entry', () => {
  assert.equal(adapters.collage.buildEndpoint({ provider: 'collage', careers_url: 'https://secure.collage.co/jobs/acme' }),
    'https://api.collage.co/v1/positions/acme');
  assert.equal(adapters.feishu.buildEndpoint({ provider: 'feishu-jobs', careers_url: 'https://jobs.bytedance.com' }),
    'https://jobs.bytedance.com/api/v1/search/job/posts');
  assert.match(adapters.mokahr.buildEndpoint({ provider: 'mokahr', careers_url: 'https://app.mokahr.com/social-recruitment/acme/12345' }),
    /^https:\/\/app\.mokahr\.com\//);
  assert.equal(adapters.telegram.buildEndpoint({ provider: 'telegram', channel: 'rabotaphp' }), 'https://t.me/s/rabotaphp');
  assert.equal(adapters.telegramChannel.buildEndpoint({ provider: 'telegram-channel', channel: 'job_python' }), 'https://t.me/s/job_python');
});

test('mokahr / feishu: a valid tenant URL in `api` is used even when careers_url is an unrelated homepage', async () => {
  const moka = { name: 'Acme', careers_url: 'https://acme.example', api: 'https://app.mokahr.com/social-recruitment/acme/12345' };
  assert.equal(adapters.mokahr.matches(moka), true);
  assert.match(adapters.mokahr.buildEndpoint(moka), /^https:\/\/app\.mokahr\.com\//);
  const feishu = { name: 'Byte', careers_url: 'https://bytedance.example', api: 'https://acme.jobs.feishu.cn/careers' };
  assert.equal(adapters.feishu.buildEndpoint(feishu), 'https://acme.jobs.feishu.cn/api/v1/search/job/posts');

  // The mokahr fetch wrapper hands the SOURCE the entry with the parseable URL,
  // so it no longer throws "careers_url must be an allowed HTTPS tenant URL".
  let seenErr = null;
  try {
    await adapters.mokahr.fetch('ignored', { company: moka, fetchImpl: async () => new Response('{}', { status: 500 }) });
  } catch (e) { seenErr = e; }
  assert.ok(seenErr, 'the stubbed 500 still fails the fetch');
  assert.doesNotMatch(String(seenErr.message), /careers_url must be/);

  // A non-object company passes straight through (the source reports it).
  await assert.rejects(() => adapters.mokahr.fetch('x', { fetchImpl: async () => new Response('{}') }), /careers_url must be/);
});

test('resolveAdapter: an adapter whose matches()/buildEndpoint() throws is no match, reported via onError, and the next adapter still wins', () => {
  const thrower = {
    id: 'zz-thrower',
    matches: () => { throw new Error('boom in matches'); },
    buildEndpoint: () => 'https://never',
    fetch: async () => [],
  };
  const builderThrower = {
    id: 'zz-builder',
    matches: () => true,
    buildEndpoint: () => { throw new Error('boom in buildEndpoint'); },
    fetch: async () => [],
  };
  ALL_ADAPTERS.unshift(thrower, builderThrower);
  try {
    const errors = [];
    const r = resolveAdapter(
      { name: 'GH', api: 'https://boards-api.greenhouse.io/v1/boards/gh/jobs' },
      (a, e) => errors.push(`${a.id}: ${e.message}`),
    );
    assert.equal(r.adapter.id, 'greenhouse');
    assert.deepEqual(errors, ['zz-thrower: boom in matches', 'zz-builder: boom in buildEndpoint']);
    // No callback → still no throw.
    assert.doesNotThrow(() => resolveAdapter({ name: 'x' }));
  } finally {
    ALL_ADAPTERS.splice(0, 2);
  }
});

test('resolveAdapter: a non-string endpoint is no endpoint (string|null contract)', () => {
  const objectEndpoint = { id: 'zz-obj', matches: () => true, buildEndpoint: () => ({ url: 'x' }), fetch: async () => [] };
  ALL_ADAPTERS.unshift(objectEndpoint);
  try {
    assert.equal(resolveAdapter({ name: 'nothing else matches' }), null);
  } finally {
    ALL_ADAPTERS.shift();
  }
});

test('runEnScan: a broken entry is that entry\'s error — the other companies are still scanned', async () => {
  writeFileSync(resolve(dir, 'portals.yml'), [
    'tracked_companies:',
    '  - name: Good',
    '    api: https://boards-api.greenhouse.io/v1/boards/good/jobs',
    '  - name: BadHandle',
    '    provider: telegram-channel',
    '    channel: "x"',
    '  - null',
    '  - name: Broken',
    '    provider: zz-explode',
  ].join('\n'));
  const exploding = {
    id: 'zz-explode',
    matches: (c) => c.provider === 'zz-explode',
    buildEndpoint: () => { throw new Error('unparseable config'); },
    fetch: async () => [],
  };
  ALL_ADAPTERS.unshift(exploding);
  try {
    const logs = [];
    const fetchImpl = async (url) => new Response(JSON.stringify(String(url).includes('/offices') ? { offices: [] } : {
      jobs: [{ id: 1, title: 'Engineer', absolute_url: 'https://example.com/good/1', location: { name: 'Remote' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    const r = await runEnScan({ writeFiles: false, fetchImpl, onLog: (_s, l) => logs.push(l) });
    assert.equal(r.fresh.length, 1, 'Good is scanned');
    assert.ok(r.errors.some((e) => /^Broken: zz-explode: unparseable config/.test(e)), r.errors.join(' | '));
    assert.equal(r.counts.skipped, 2, 'BadHandle (null endpoint) and Broken are skipped; the null entry is dropped');
    assert.ok(logs.some((l) => /✗ Broken/.test(l)));
  } finally {
    ALL_ADAPTERS.shift();
  }
});

test('runEnScan: a non-array tracked_companies block is treated as empty', async () => {
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies:\n  name: oops\n');
  const r = await runEnScan({ writeFiles: false, fetchImpl: async () => { throw new Error('no fetch'); } });
  assert.equal(r.counts.raw, 0);
  assert.deepEqual(r.errors, []);
});
