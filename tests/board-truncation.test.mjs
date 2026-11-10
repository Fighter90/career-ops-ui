/**
 * CAR-256 (parent-sync #6636) — a board read only PARTLY (page cap, 429,
 * fetch error) is reported as `partial`, not as a complete read.
 *
 * The parent's lib/board-truncation.mjs is mirrored: a provider can tag its
 * result array with the canonical `truncated` shape ({reason, fetched?,
 * total?}) or the legacy per-provider `<name>Truncated` / `<name>Incomplete`
 * flag; the scanner reads ALL of them (web-ui previously knew only
 * `ultiproTruncated` + `peoplesoftIncomplete`) and surfaces
 * `partialSources` entries ({company, reason, fetched?, total?}) in the scan
 * result and the last-scan snapshot.
 *
 * CI-isolated: CAREER_OPS_ROOT is a temp dir; the only transport is the
 * injected fetchImpl; no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let boardTruncation;
let markTruncated;
let describeTruncation;
let runEnScan;
let loadLastScan;
let ALL_ADAPTERS;

const writePortals = (lines) => writeFileSync(resolve(dir, 'portals.yml'), lines.join('\n'));

let dir;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'car256-trunc-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writePortals(['tracked_companies: []']);
  process.env.CAREER_OPS_ROOT = dir;
  ({ boardTruncation, markTruncated, describeTruncation } = await import('../server/lib/board-truncation.mjs'));
  ({ runEnScan, loadLastScan } = await import('../server/lib/en-scanner.mjs'));
  ({ ALL_ADAPTERS } = await import('../server/lib/portals/registry.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
});

// ── the mirror lib ──────────────────────────────────────────────────

test('boardTruncation: no jobs / untagged array → null', () => {
  assert.equal(boardTruncation(null), null);
  assert.equal(boardTruncation(undefined), null);
  assert.equal(boardTruncation('nope'), null);
  assert.equal(boardTruncation([]), null);
  assert.equal(boardTruncation([{ title: 'x' }]), null);
});

test('boardTruncation: canonical truncated string → {reason, source:"truncated"}', () => {
  const jobs = [{ title: 'x' }];
  jobs.truncated = 'rate-limited';
  assert.deepEqual(boardTruncation(jobs), { reason: 'rate-limited', source: 'truncated' });
});

test('boardTruncation: canonical truncated object carries fetched/total counts', () => {
  const jobs = [{ title: 'x' }];
  jobs.truncated = { reason: 'page-cap', fetched: 100, total: 340 };
  assert.deepEqual(boardTruncation(jobs), { reason: 'page-cap', fetched: 100, total: 340, source: 'truncated' });
});

test('boardTruncation: legacy <name>Truncated flag (true) → cap-or-fetch-error', () => {
  const jobs = [{ title: 'x' }];
  jobs.doverTruncated = true;
  assert.deepEqual(boardTruncation(jobs), { reason: 'cap-or-fetch-error', source: 'doverTruncated' });
});

test('boardTruncation: legacy <name>Incomplete object → its reason', () => {
  const jobs = [{ title: 'x' }];
  jobs.peoplesoftIncomplete = { complete: false, reason: 'stopCause', collected: 5, reportedTotal: 20 };
  assert.deepEqual(boardTruncation(jobs), { reason: 'stopCause', source: 'peoplesoftIncomplete' });
});

test('boardTruncation: a falsy legacy flag means "not truncated"', () => {
  const jobs = [{ title: 'x' }];
  jobs.ultiproTruncated = false;
  assert.equal(boardTruncation(jobs), null);
});

test('boardTruncation: the canonical shape wins over a legacy tag', () => {
  const jobs = [{ title: 'x' }];
  jobs.truncated = { reason: 'page-cap' };
  jobs.doverTruncated = true;
  const t = boardTruncation(jobs);
  assert.equal(t.source, 'truncated');
  assert.equal(t.reason, 'page-cap');
});

test('markTruncated stamps the canonical shape and returns the same array', () => {
  const jobs = [{ title: 'x' }];
  const out = markTruncated(jobs, 'page-cap', { fetched: 2 });
  assert.equal(out, jobs);
  assert.deepEqual(jobs.truncated, { fetched: 2, reason: 'page-cap' });
});

test('describeTruncation renders one summary fragment', () => {
  assert.equal(describeTruncation('Apple', { reason: 'page-cap', fetched: 100, total: 340 }),
    'Apple (page-cap, 100 of 340)');
  assert.equal(describeTruncation('Apple', { reason: 'rate-limited', fetched: 12 }),
    'Apple (rate-limited, 12 read)');
  assert.equal(describeTruncation('Apple', { reason: 'cap-or-fetch-error' }),
    'Apple (cap-or-fetch-error)');
});

// ── the scanner surfaces partial reads ──────────────────────────────

const withAdapter = async (adapter, portals, opts) => {
  ALL_ADAPTERS.unshift(adapter);
  try {
    writePortals(portals);
    return await runEnScan({ onLog: () => {}, ...opts });
  } finally {
    ALL_ADAPTERS.splice(ALL_ADAPTERS.indexOf(adapter), 1);
  }
};

test('a canonical-truncated board lands in partialSources + truncatedSources (result + snapshot)', async () => {
  const flagged = () => Object.assign(
    [{ title: 'Senior Platform Engineer', url: 'https://example.com/tc/1' }],
    { truncated: { reason: 'page-cap', fetched: 100, total: 340 } },
  );
  const fake = {
    id: 'zz-car256-trunc',
    label: 'TruncC',
    matches: (c) => c.provider === 'zz-car256-trunc',
    buildEndpoint: () => 'https://example.com/car256-trunc',
    fetch: flagged,
  };
  const result = await withAdapter(fake, [
    'tracked_companies:',
    '  - name: Trunc Canonical Co',
    '    provider: zz-car256-trunc',
  ], { writeFiles: true });
  assert.deepEqual(result.partialSources, [
    { company: 'Trunc Canonical Co', reason: 'page-cap', fetched: 100, total: 340, source: 'truncated' },
  ]);
  assert.deepEqual(result.truncatedSources, ['Trunc Canonical Co'],
    'truncatedSources keeps carrying the names');
  const snapshot = loadLastScan();
  assert.deepEqual(snapshot.en.partialSources, [
    { company: 'Trunc Canonical Co', reason: 'page-cap', fetched: 100, total: 340, source: 'truncated' },
  ]);
});

test('a NON-ultipro legacy tag (<name>Truncated) is also recognized', async () => {
  const flagged = () => Object.assign(
    [{ title: 'Senior Platform Engineer', url: 'https://example.com/dv/1' }],
    { kalibrrTruncated: true },
  );
  const fake = {
    id: 'zz-car256-legacy',
    label: 'LegacyT',
    matches: (c) => c.provider === 'zz-car256-legacy',
    buildEndpoint: () => 'https://example.com/car256-legacy',
    fetch: flagged,
  };
  const result = await withAdapter(fake, [
    'tracked_companies:',
    '  - name: Legacy Tag Co',
    '    provider: zz-car256-legacy',
  ], { writeFiles: false });
  assert.deepEqual(result.partialSources, [
    { company: 'Legacy Tag Co', reason: 'cap-or-fetch-error', source: 'kalibrrTruncated' },
  ]);
  assert.deepEqual(result.truncatedSources, ['Legacy Tag Co']);
});

test('partialSources stays empty when no board was truncated', async () => {
  const fake = {
    id: 'zz-car256-clean',
    label: 'Clean',
    matches: (c) => c.provider === 'zz-car256-clean',
    buildEndpoint: () => 'https://example.com/car256-clean',
    fetch: async () => [{ title: 'Senior Go Engineer', url: 'https://example.com/cl/1' }],
  };
  const result = await withAdapter(fake, [
    'tracked_companies:',
    '  - name: Clean Co',
    '    provider: zz-car256-clean',
  ], { writeFiles: false });
  assert.deepEqual(result.partialSources, []);
  assert.deepEqual(result.truncatedSources, []);
});
