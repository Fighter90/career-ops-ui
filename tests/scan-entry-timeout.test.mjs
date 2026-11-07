// #6582 / parent — a portals.yml entry can raise its request timeout with
// `timeout_ms`. A board that returns its whole catalogue in one response can
// need more time than the scanner's default budget allows, and the scan then
// reports it as a network error. The setting is the USER's, so it wins over
// every other timeout on that entry's fetches; every other entry keeps the
// default. An unusable value is ignored with a warning naming the entry
// (setTimeout rewrites a delay outside 1..2147483647ms to 1ms, which would
// abort every request of the entry — the range guard exists for that).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { applyEntryTimeout, resolveEntryTimeoutMs } from '../server/lib/entry-timeout.mjs';
import { makeTimeoutFetch } from '../server/lib/fetch-timeout.mjs';

// ───────────── resolveEntryTimeoutMs ─────────────

test('an entry without timeout_ms resolves to null (no override)', () => {
  assert.equal(resolveEntryTimeoutMs({ name: 'Acme' }), null);
  assert.equal(resolveEntryTimeoutMs({}), null);
  assert.equal(resolveEntryTimeoutMs(null), null);
});

test('a valid timeout_ms resolves to its whole-number value', () => {
  assert.equal(resolveEntryTimeoutMs({ name: 'BigCo', timeout_ms: 60_000 }), 60_000);
  assert.equal(resolveEntryTimeoutMs({ name: 'BigCo', timeout_ms: 1 }), 1);
  assert.equal(resolveEntryTimeoutMs({ name: 'BigCo', timeout_ms: 2_147_483_647 }), 2_147_483_647);
});

test('an unusable timeout_ms is ignored with a warning naming the entry', (t) => {
  const warnings = [];
  t.mock.method(console, 'error', (msg) => { warnings.push(String(msg)); });
  const bads = [0, -5, 1.5, 2_147_483_648, 'big', '60000', true, [60000], Number.NaN, Number.POSITIVE_INFINITY];
  for (const bad of bads) {
    assert.equal(resolveEntryTimeoutMs({ name: 'BadCo', timeout_ms: bad }), null, `value: ${String(bad)}`);
  }
  assert.equal(warnings.length, bads.length);
  assert.ok(warnings.every((w) => w.includes('BadCo') && w.includes('timeout_ms')));
});

// ───────────── applyEntryTimeout ─────────────

// A fetchImpl that records the options it was called with.
function recordingFetch(answer = { ok: true, status: 200 }) {
  const calls = [];
  const fetch = async (url, opts = {}) => { calls.push({ url, opts }); return answer; };
  fetch.calls = calls;
  return fetch;
}

test('an entry without timeout_ms returns the fetchImpl as-is', () => {
  const base = recordingFetch();
  assert.equal(applyEntryTimeout(base, { name: 'Acme' }), base);
});

test('timeout_ms reaches every fetch and keeps the other options', async () => {
  const base = recordingFetch();
  const wrapped = applyEntryTimeout(base, { name: 'BigCo', timeout_ms: 60_000 });
  await wrapped('https://example.test/a', { redirect: 'error', headers: { 'x-a': '1' } });
  await wrapped('https://example.test/b');
  assert.deepEqual(base.calls.map((c) => c.opts.timeoutMs), [60_000, 60_000]);
  assert.equal(base.calls[0].opts.redirect, 'error');
  assert.equal(base.calls[0].opts.headers['x-a'], '1');
});

test('the entry value wins over a timeoutMs the caller passes', async () => {
  const base = recordingFetch();
  const wrapped = applyEntryTimeout(base, { name: 'BigCo', timeout_ms: 60_000 });
  await wrapped('https://example.test/a', { timeoutMs: 30_000 });
  assert.equal(base.calls[0].opts.timeoutMs, 60_000);
});

// ───────────── makeTimeoutFetch honors the injected value ─────────────

const stalledFetch = (_url, { signal } = {}) =>
  new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason || new Error('aborted')), { once: true });
  });

test('makeTimeoutFetch aborts on the injected opts.timeoutMs, not its wrapper budget', async () => {
  const wrapped = applyEntryTimeout(makeTimeoutFetch(stalledFetch, 60_000), { name: 'BigCo', timeout_ms: 25 });
  const t0 = Date.now();
  await assert.rejects(wrapped('https://example.test/stall'), (err) => err?.name === 'TimeoutError');
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 5000, `entry budget won (took ${elapsed}ms, wrapper budget 60s)`);
});

// ───────────── runEnScan wiring ─────────────
// The per-entry override must actually reach the source fetcher: one entry
// with timeout_ms and one without, and the fetcher's opts show the value only
// on the configured entry.

let dir;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'scan-entry-timeout-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'portals.yml'), [
    'tracked_companies:',
    '  - name: SlowCo',
    '    careers_url: https://job-boards.greenhouse.io/slowco',
    '    enabled: true',
    '    timeout_ms: 750',
    '  - name: FastCo',
    '    careers_url: https://job-boards.greenhouse.io/fastco',
    '    enabled: true',
    '',
  ].join('\n'));
  process.env.CAREER_OPS_ROOT = dir;
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
});

test('runEnScan threads the entry timeout_ms into that entry\'s fetch opts only', async () => {
  const { runEnScan } = await import('../server/lib/en-scanner.mjs');
  const base = recordingFetch({
    ok: true,
    status: 200,
    json: async () => ({
      jobs: [{
        id: 1,
        title: 'Engineer',
        company_name: 'Co',
        absolute_url: 'https://co.example/1',
        location: { name: 'Berlin' },
        offices: [],
        first_published: '2026-01-01',
      }],
    }),
  });
  const result = await runEnScan({ writeFiles: false, fetchImpl: base, onLog: () => {} });
  assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
  const byUrl = new Map(base.calls.map((c) => [c.url, c.opts]));
  const slow = [...byUrl.entries()].find(([u]) => u.includes('/slowco'));
  const fast = [...byUrl.entries()].find(([u]) => u.includes('/fastco'));
  assert.ok(slow, 'slowco fetched');
  assert.ok(fast, 'fastco fetched');
  assert.equal(slow[1].timeoutMs, 750, 'the configured entry carries its timeout');
  assert.equal(fast[1].timeoutMs, undefined, 'the other entry keeps the default');
});
