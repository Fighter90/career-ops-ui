// Upstream #6757 + #6801 — a portals.yml entry can raise its response-body
// budget with `max_response_mb`, and the entry fetch wrapper preserves the
// fetch-method receiver while applying it.
//
// The parent (career-ops lib/entry-response-cap.mjs) injects `maxBytes` into
// the per-entry ctx's fetch helpers; #6801 fixed the wrapper to forward `this`
// (`original.call(this, …)`) instead of an arrow that dropped the receiver —
// a stateful provider whose fetch helper reads its own state used to crash
// with an undefined `this`. web-ui's transport is an injected fetchImpl
// rather than a ctx, so the mirror lives in en-scanner.mjs next to the
// sibling `applyEntryTimeout` wrapper: same validation, same "the entry
// value wins over a maxBytes the caller passes" rule, same receiver
// preservation.
//
// CI-isolated: no network, CAREER_OPS_ROOT is a mkdtemp dir for the wiring test.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

// ───────────── resolveEntryResponseCapBytes ─────────────

let resolveEntryResponseCapBytes;
let applyEntryResponseCap;

test('module exports the response-cap helpers', async () => {
  ({ resolveEntryResponseCapBytes, applyEntryResponseCap } = await import('../server/lib/en-scanner.mjs'));
  assert.equal(typeof resolveEntryResponseCapBytes, 'function');
  assert.equal(typeof applyEntryResponseCap, 'function');
});

test('an entry without max_response_mb resolves to null (no override)', () => {
  assert.equal(resolveEntryResponseCapBytes({ name: 'Acme' }), null);
  assert.equal(resolveEntryResponseCapBytes({}), null);
  assert.equal(resolveEntryResponseCapBytes(null), null);
});

test('a valid max_response_mb resolves to its whole byte count', () => {
  const MB = 1024 * 1024;
  assert.equal(resolveEntryResponseCapBytes({ name: 'BigCo', max_response_mb: 20 }), 20 * MB);
  assert.equal(resolveEntryResponseCapBytes({ name: 'BigCo', max_response_mb: 2.5 }), Math.floor(2.5 * MB), 'fractions floor to bytes');
  assert.equal(resolveEntryResponseCapBytes({ name: 'BigCo', max_response_mb: 1 }), MB);
});

test('a max_response_mb that is not a positive number of at least one byte is ignored with a warning naming the entry', (t) => {
  const warnings = [];
  t.mock.method(console, 'error', (msg) => { warnings.push(String(msg)); });
  // Not a YAML number (Number() would turn true into 1 MiB and [20] into
  // 20 MiB), or a number that floors to 0 bytes or overflows to Infinity.
  const bads = [0, -5, 'big', '20', true, [20], Number.NaN, 1e-9, 1e303];
  for (const bad of bads) {
    assert.equal(resolveEntryResponseCapBytes({ name: 'BadCo', max_response_mb: bad }), null, `value: ${String(bad)}`);
  }
  assert.equal(warnings.length, bads.length);
  assert.ok(warnings.every((w) => w.includes('BadCo') && w.includes('max_response_mb')));
});

// ───────────── applyEntryResponseCap ─────────────

// A fetchImpl that records the options it was called with.
function recordingFetch(answer = { ok: true, status: 200 }) {
  const calls = [];
  const fetch = async (url, opts = {}) => { calls.push({ url, opts }); return answer; };
  fetch.calls = calls;
  return fetch;
}

test('an entry without max_response_mb returns the fetchImpl as-is', () => {
  const base = recordingFetch();
  assert.equal(applyEntryResponseCap(base, { name: 'Acme' }), base);
});

test('max_response_mb sets maxBytes on every fetch and keeps the other options', async () => {
  const MB = 1024 * 1024;
  const base = recordingFetch();
  const wrapped = applyEntryResponseCap(base, { name: 'BigCo', max_response_mb: 20 });
  await wrapped('https://example.test/a', { redirect: 'error', headers: { 'x-a': '1' } });
  await wrapped('https://example.test/b');
  assert.deepEqual(base.calls.map((c) => c.opts.maxBytes), [20 * MB, 20 * MB]);
  assert.equal(base.calls[0].opts.redirect, 'error');
  assert.equal(base.calls[0].opts.headers['x-a'], '1');
});

test('the entry value wins over a maxBytes the caller passes', async () => {
  const MB = 1024 * 1024;
  const base = recordingFetch();
  const wrapped = applyEntryResponseCap(base, { name: 'BigCo', max_response_mb: 64 });
  await wrapped('https://example.test/a', { maxBytes: 5 * MB });
  assert.equal(base.calls[0].opts.maxBytes, 64 * MB);
});

test('an unusable max_response_mb returns the fetchImpl as-is', (t) => {
  const warnings = [];
  t.mock.method(console, 'error', (msg) => { warnings.push(String(msg)); });
  const base = recordingFetch();
  assert.equal(applyEntryResponseCap(base, { name: 'BadCo', max_response_mb: 'big' }), base);
});

// #6801 — the wrapper must preserve the fetch-method receiver: the parent's
// repro is a stateful ctx whose fetch helper reads its own state, and the old
// arrow wrapper dropped `this` so the helper crashed. The web-ui mirror
// forwards `this` to the wrapped transport.
test('max_response_mb preserves the fetch receiver', async () => {
  const MB = 1024 * 1024;
  const calls = [];
  const ctx = {
    state: { name: 'Career Board' },
    async fetch(url, opts = {}) {
      calls.push({ receiver: this, url, opts });
      return { ok: true, status: 200, board: this.state.name };
    },
  };
  const wrapped = applyEntryResponseCap(ctx.fetch, { name: 'StatefulCo', max_response_mb: 20 });
  const result = await wrapped.call(ctx, 'https://example.test/a');
  assert.equal(result.board, 'Career Board', 'the receiver reached the wrapped fetch');
  assert.equal(calls[0].receiver, ctx);
  assert.equal(calls[0].opts.maxBytes, 20 * MB);
});

// ───────────── runEnScan wiring ─────────────
// The per-entry cap must actually reach the source fetcher: one entry with
// max_response_mb and one without, and the fetcher's opts show the value only
// on the configured entry.

let dir;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'scan-entry-response-cap-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'portals.yml'), [
    'tracked_companies:',
    '  - name: BigCo',
    '    api: https://boards-api.greenhouse.io/v1/boards/bigco/jobs',
    '    enabled: true',
    '    max_response_mb: 20',
    '  - name: SmallCo',
    '    api: https://boards-api.greenhouse.io/v1/boards/smallco/jobs',
    '    enabled: true',
    '',
  ].join('\n'));
  process.env.CAREER_OPS_ROOT = dir;
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
});

test('runEnScan threads the entry max_response_mb into that entry\'s fetch opts only', async () => {
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
  const big = [...byUrl.entries()].find(([u]) => u.includes('/bigco'));
  const small = [...byUrl.entries()].find(([u]) => u.includes('/smallco'));
  assert.ok(big, 'bigco fetched');
  assert.ok(small, 'smallco fetched');
  assert.equal(big[1].maxBytes, 20 * 1024 * 1024, 'the configured entry carries its cap');
  assert.equal(small[1].maxBytes, undefined, 'the other entry keeps the default');
});
