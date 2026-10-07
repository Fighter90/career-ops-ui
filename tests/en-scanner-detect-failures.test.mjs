/**
 * en-scanner — per-company detection isolation + truncation-flag propagation
 * (docs/sdd/BACKLOG.md v1.242.0 sources-2).
 *
 *  - [H] A detector that THROWS for one misconfigured entry (collage /
 *    feishu-jobs build their endpoint from config and throw when it is
 *    malformed) is that entry's failure — it must never abort the whole EN
 *    scan (buildEndpoint `string | null` contract).
 *  - The fetcher-side `ultiproTruncated` flag lives on the returned ARRAY, so
 *    the scanner's map/slice drops it; the scan result must still carry which
 *    sources were truncated.
 *
 * CI-isolated: CAREER_OPS_ROOT is a temp dir containing cv.md; the only
 * transport is the injected fetchImpl; no network; nothing binds a port.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let runEnScan;
let loadLastScan;
let ALL_ADAPTERS;

const writePortals = (lines) => writeFileSync(resolve(dir, 'portals.yml'), lines.join('\n'));

let dir;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'en-detect-test-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writePortals([
    'tracked_companies:',
    '  - name: Healthy GH',
    '    api: https://boards-api.greenhouse.io/v1/boards/healthy/jobs',
    'title_filter:',
    '  positive: ["Senior"]',
  ]);
  process.env.CAREER_OPS_ROOT = dir;
  ({ runEnScan, loadLastScan } = await import('../server/lib/en-scanner.mjs'));
  ({ ALL_ADAPTERS } = await import('../server/lib/portals/registry.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
});

const ghFetch = (board, jobs) => async (url) => {
  if (String(url).includes(`/boards/${board}/jobs`)) {
    return new Response(JSON.stringify({
      jobs: jobs.map((j, i) => ({ id: i, title: j.title, company_name: board, absolute_url: j.url, location: { name: 'Remote' }, offices: [] })),
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('nf', { status: 404 });
};

test('[H] a misconfigured collage entry (throwing URL-builder path) is skipped; the scan completes', async () => {
  writePortals([
    'tracked_companies:',
    '  - name: Broken Collage',
    '    provider: collage',          // matches collageAdapter; no api / careers_url → buildCollageUrl throws
    '  - name: Healthy GH',
    '    api: https://boards-api.greenhouse.io/v1/boards/healthy/jobs',
  ]);
  const result = await runEnScan({
    writeFiles: false,
    fetchImpl: ghFetch('healthy', [{ title: 'Senior Go Engineer', url: 'https://example.com/gh/1' }]),
    onLog: () => {},
  });
  assert.ok(result.errors.some((e) => /Broken Collage/.test(e)) || result.counts.skipped >= 1,
    'the broken entry is either recorded as an error (throwing detector) or skipped (null endpoint)');
  assert.equal(result.counts.fresh, 1, 'the healthy company is still scanned');
  assert.equal(result.fresh[0].url, 'https://example.com/gh/1');
  assert.equal(result.counts.skipped >= 1, true, 'the broken entry is skipped, not fatal');
});

test('[H] a detector that THROWS (fake adapter) records the error and the scan continues', async () => {
  const boom = {
    id: 'zz-boom',
    label: 'Boom',
    matches: (c) => c.provider === 'zz-boom',
    buildEndpoint: () => { throw new Error('boom: misconfigured entry'); },
    fetch: async () => [],
  };
  ALL_ADAPTERS.unshift(boom);
  try {
    writePortals([
      'tracked_companies:',
      '  - name: Booming',
      '    provider: zz-boom',
      '  - name: Healthy GH',
      '    api: https://boards-api.greenhouse.io/v1/boards/healthy/jobs',
    ]);
    const result = await runEnScan({
      writeFiles: false,
      fetchImpl: ghFetch('healthy', [{ title: 'Senior Go Engineer', url: 'https://example.com/gh/2' }]),
      onLog: () => {},
    });
    assert.ok(result.errors.some((e) => /Booming.*boom: misconfigured entry/.test(e)),
      `detector throw must be recorded per company: ${JSON.stringify(result.errors)}`);
    assert.equal(result.counts.fresh, 1, 'the sibling company still scans');
  } finally {
    ALL_ADAPTERS.splice(ALL_ADAPTERS.indexOf(boom), 1);
  }
});

test('ultiproTruncated flows to the scan result and the last-scan snapshot (not just the log)', async () => {
  // Fake adapter whose fetch returns a job array flagged like fetchUltipro does
  // when the page cap truncates the board.
  const flagged = () => Object.assign(
    [{ title: 'Senior Platform Engineer', url: 'https://example.com/u/1' }],
    { ultiproTruncated: true },
  );
  const fake = {
    id: 'zz-trunc',
    label: 'Trunc',
    matches: (c) => c.provider === 'zz-trunc',
    buildEndpoint: () => 'https://example.com/api',
    fetch: flagged,
  };
  ALL_ADAPTERS.unshift(fake);
  try {
    writePortals([
      'tracked_companies:',
      '  - name: Truncated Co',
      '    provider: zz-trunc',
    ]);
    const logs = [];
    const result = await runEnScan({
      writeFiles: true,
      fetchImpl: async () => { throw new Error('must not be called'); },
      onLog: (s, l) => logs.push(`${s}:${l}`),
    });
    assert.ok(Array.isArray(result.truncatedSources), 'result carries truncatedSources');
    assert.deepEqual(result.truncatedSources, ['Truncated Co']);
    const snapshot = loadLastScan();
    assert.deepEqual(snapshot.en.truncatedSources, ['Truncated Co'], 'snapshot carries it too');
  } finally {
    ALL_ADAPTERS.splice(ALL_ADAPTERS.indexOf(fake), 1);
  }
});

test('truncatedSources is absent (empty) when no source was truncated', async () => {
  writePortals([
    'tracked_companies:',
    '  - name: Healthy GH',
    '    api: https://boards-api.greenhouse.io/v1/boards/healthy/jobs',
  ]);
  const result = await runEnScan({
    writeFiles: false,
    fetchImpl: ghFetch('healthy', []),
    onLog: () => {},
  });
  assert.deepEqual(result.truncatedSources, []);
});
