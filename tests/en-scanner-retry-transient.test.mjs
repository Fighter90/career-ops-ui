/**
 * CAR-256 (parent-sync #6675) — retry-after-sweep.
 *
 * A board whose fetch failed on a TRANSIENT error (network reset / timeout /
 * HTTP 5xx) is retried ONCE after the main concurrent sweep, one at a time:
 * the provider's own retries run inside the same burst that caused the
 * failure, so re-running the failed boards sequentially afterwards removes
 * the contention instead of repeating into it. A 4xx (403/404) is never
 * retried — it will not change in seconds.
 *
 * On a successful retry the sweep's error is removed, the company leaves the
 * failed set (R-12's snapshot guard) and its rows count normally. On a second
 * failure the error is re-recorded.
 *
 * CI-isolated: CAREER_OPS_ROOT is a temp dir; the only transport is the
 * injected fetchImpl; no network. The inter-attempt gap is shrunk through
 * CAREER_OPS_TRANSIENT_RETRY_GAP_MS so tests stay fast.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let runEnScan;
let ALL_ADAPTERS;

const writePortals = (lines) => writeFileSync(resolve(dir, 'portals.yml'), lines.join('\n'));

let dir;
const adapters = [];

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'car256-retry-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writePortals(['tracked_companies: []']);
  process.env.CAREER_OPS_ROOT = dir;
  process.env.CAREER_OPS_TRANSIENT_RETRY_GAP_MS = '5';
  ({ runEnScan } = await import('../server/lib/en-scanner.mjs'));
  ({ ALL_ADAPTERS } = await import('../server/lib/portals/registry.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  delete process.env.CAREER_OPS_TRANSIENT_RETRY_GAP_MS;
});

const makeAdapter = (id, behavior) => ({
  id,
  label: id,
  matches: (c) => c.provider === id,
  buildEndpoint: () => `https://example.com/${id}`,
  fetch: behavior,
});

test('a transient-failing board is retried once after the sweep and recovers', async () => {
  const calls = [];
  const flaky = makeAdapter('zz-car256-flaky', async () => {
    calls.push('flaky');
    if (calls.filter((c) => c === 'flaky').length === 1) {
      throw new Error('fetch failed'); // transient: ECONNRESET-class message
    }
    return [{ title: 'Senior Platform Engineer', url: 'https://example.com/flaky/1' }];
  });
  const healthy = makeAdapter('zz-car256-steady', async () => {
    calls.push('steady');
    return [{ title: 'Senior Go Engineer', url: 'https://example.com/steady/1' }];
  });
  adapters.push(flaky, healthy);
  ALL_ADAPTERS.unshift(flaky, healthy);
  try {
    writePortals([
      'tracked_companies:',
      '  - name: Flaky Co',
      '    provider: zz-car256-flaky',
      '  - name: Steady Co',
      '    provider: zz-car256-steady',
    ]);
    const logs = [];
    const result = await runEnScan({ writeFiles: false, onLog: (s, l) => logs.push(`${s}:${l}`) });
    // The retry runs AFTER the whole sweep: both boards were attempted once
    // before Flaky Co's second attempt.
    assert.equal(calls.filter((c) => c === 'flaky').length, 2, 'exactly one retry attempt');
    assert.ok(calls.indexOf('steady') < calls.lastIndexOf('flaky'),
      'the healthy board was swept before the retry pass');
    assert.equal(result.errors.filter((e) => e.startsWith('Flaky Co:')).length, 0,
      `the recovered board's sweep error is gone: ${JSON.stringify(result.errors)}`);
    assert.ok(result.fresh.some((j) => String(j.url).includes('/flaky/1')),
      'the retried board contributes its rows');
    assert.ok(logs.some((l) => /retrying 1 board\(s\) that failed on a transient error/.test(l) && l.includes('Flaky Co')),
      `a stderr notice names the retried boards: ${JSON.stringify(logs)}`);
  } finally {
    for (const a of adapters) ALL_ADAPTERS.splice(ALL_ADAPTERS.indexOf(a), 1);
    adapters.length = 0;
  }
});

test('a board failing on HTTP 5xx is transient too', async () => {
  let attempts = 0;
  const flaky5xx = makeAdapter('zz-car256-5xx', async () => {
    attempts++;
    if (attempts === 1) {
      const err = new Error('HTTP 502');
      err.status = 502;
      throw err;
    }
    return [{ title: 'Senior Rust Engineer', url: 'https://example.com/5xx/1' }];
  });
  ALL_ADAPTERS.unshift(flaky5xx);
  try {
    writePortals([
      'tracked_companies:',
      '  - name: Server 5xx Co',
      '    provider: zz-car256-5xx',
    ]);
    const result = await runEnScan({ writeFiles: false, onLog: () => {} });
    assert.equal(attempts, 2, 'retried once');
    assert.equal(result.errors.length, 0);
    assert.equal(result.fresh.length, 1);
  } finally {
    ALL_ADAPTERS.splice(ALL_ADAPTERS.indexOf(flaky5xx), 1);
  }
});

test('a 4xx (auth) failure is NOT retried', async () => {
  let attempts = 0;
  const forbidden = makeAdapter('zz-car256-403', async () => {
    attempts++;
    const err = new Error('HTTP 403');
    err.status = 403;
    throw err;
  });
  ALL_ADAPTERS.unshift(forbidden);
  try {
    writePortals([
      'tracked_companies:',
      '  - name: Forbidden Co',
      '    provider: zz-car256-403',
    ]);
    const logs = [];
    const result = await runEnScan({ writeFiles: false, onLog: (s, l) => logs.push(`${s}:${l}`) });
    assert.equal(attempts, 1, 'no retry for a 4xx');
    assert.ok(result.errors.some((e) => e.startsWith('Forbidden Co:')));
    assert.ok(!logs.some((l) => /retrying .* board\(s\)/.test(l)), 'no retry notice');
  } finally {
    ALL_ADAPTERS.splice(ALL_ADAPTERS.indexOf(forbidden), 1);
  }
});

test('a retry that fails again re-records the error (and is not retried a second time)', async () => {
  let attempts = 0;
  const always = makeAdapter('zz-car256-dead', async () => {
    attempts++;
    throw new Error('fetch failed');
  });
  ALL_ADAPTERS.unshift(always);
  try {
    writePortals([
      'tracked_companies:',
      '  - name: Dead Co',
      '    provider: zz-car256-dead',
    ]);
    const result = await runEnScan({ writeFiles: false, onLog: () => {} });
    assert.equal(attempts, 2, 'sweep + one retry, then it gives up');
    assert.equal(result.errors.filter((e) => e.startsWith('Dead Co:')).length, 1,
      'exactly one error stands at the end');
  } finally {
    ALL_ADAPTERS.splice(ALL_ADAPTERS.indexOf(always), 1);
  }
});

// CAR-256 (parent parity, upstream #6636) — a board cut short is CALLed OUT in
// the run summary (the parent's "only PARTLY read" block) and lands in the
// scan result's partialSources with the reason + counts, so a partial read is
// never silently presented as the whole board.
test('a partly-read board gets the run-summary call-out and lands in partialSources', async () => {
  const jobs = [{ title: 'Senior Kotlin Engineer', url: 'https://example.com/cap/1' }];
  jobs.truncated = { reason: 'page-cap', fetched: 1, total: 340 };
  const capped = makeAdapter('zz-car256-cap', async () => jobs);
  ALL_ADAPTERS.unshift(capped);
  try {
    writePortals([
      'tracked_companies:',
      '  - name: Capped Co',
      '    provider: zz-car256-cap',
    ]);
    const logs = [];
    const result = await runEnScan({ writeFiles: false, onLog: (s, l) => logs.push(`${s}:${l}`) });
    assert.deepEqual(result.partialSources, [
      { company: 'Capped Co', reason: 'page-cap', fetched: 1, total: 340, source: 'truncated' },
    ]);
    assert.ok(result.truncatedSources.includes('Capped Co'), 'the bare-name snapshot shape is kept');
    assert.ok(
      logs.some((l) => /board\(s\) only PARTLY read/.test(l)),
      `the run summary flags the partly-read boards: ${JSON.stringify(logs)}`,
    );
    assert.ok(
      logs.some((l) => /•\s+Capped Co \(page-cap, 1 of 340\)/.test(l)),
      `the run summary names the board with its reason + counts: ${JSON.stringify(logs)}`,
    );
    assert.equal(result.errors.length, 0, 'a partial read is not a failure');
  } finally {
    ALL_ADAPTERS.splice(ALL_ADAPTERS.indexOf(capped), 1);
  }
});
