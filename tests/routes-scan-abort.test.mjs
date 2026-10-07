/**
 * routes-3 — GET /api/stream/scan?source=both: a Stop / disconnect during the
 * ATS phase must abort that phase and must NOT start the regional phase (which
 * would write files and hold the single-flight slot -> SCAN_BUSY). Progress is
 * still emitted as an SSE `progress` event while the client listens.
 *
 * The scanner functions are swapped for stubs through the `__scanRunners` hook,
 * so no adapter or network is touched. CI-isolated mkdtemp root.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root, runners, slot, realRunners;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'routes-scan-abort-'));
  for (const d of ['config', 'data']) mkdirSync(join(root, d), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# x\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), '');
  process.env.CAREER_OPS_ROOT = root;
  const { createApp } = await import('../server/index.mjs');
  ({ __scanRunners: runners, __scanSlot: slot } = await import('../server/lib/routes/scan.mjs'));
  realRunners = { ...runners };
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => {
  Object.assign(runners, realRunners);
  delete process.env.CAREER_OPS_ROOT;
  if (root) rmSync(root, { recursive: true, force: true });
  server.closeAllConnections?.();
  return new Promise((r) => server.close(r));
});

const waitFor = async (fn, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 10)); }
  return fn();
};

function parse(text) {
  return text.split('\n\n').filter(Boolean).map((block) => ({
    ev: (block.match(/^event: (.+)$/m) || [])[1] || 'message',
    data: JSON.parse((block.match(/^data: (.+)$/m) || [])[1] || 'null'),
  }));
}

test('source=both: disconnect during the ATS phase aborts it and never starts regional', async () => {
  let enSignal = null;
  let ruCalls = 0;
  let enSettled = false;
  runners.en = (opts) => new Promise((resolve) => {
    enSignal = opts.signal;
    opts.onLog('stdout', 'scanning…');
    // A real scanner returns its partial result when aborted — it does not throw.
    opts.signal.addEventListener('abort', () => { enSettled = true; resolve({ counts: {}, errors: [] }); });
  });
  runners.ru = async () => { ruCalls += 1; return { counts: {}, errors: [] }; };

  const ctrl = new AbortController();
  const res = await fetch(`${baseUrl}/api/stream/scan?source=both&dryRun=1`, { signal: ctrl.signal });
  const reader = res.body.getReader();
  await reader.read(); // first frame(s): start + log
  ctrl.abort();

  assert.ok(await waitFor(() => enSettled), 'ATS phase must see the abort signal');
  assert.equal(enSignal.aborted, true);
  assert.ok(await waitFor(() => slot.active === null), 'slot must be released');
  // Give a would-be phase 2 a moment to start.
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(ruCalls, 0, 'regional phase must not start after a disconnect');
});

test('source=both: a completed ATS phase hands over to regional and progress events flow', async () => {
  let ruCalls = 0;
  runners.en = async (opts) => {
    opts.onProgress(1, 2);
    opts.onProgress(2, 2);
    return { counts: { fresh: 1 }, errors: [] };
  };
  runners.ru = async (opts) => {
    ruCalls += 1;
    assert.equal(opts.signal.aborted, false);
    assert.equal(opts.writeFiles, false);
    return { counts: { fresh: 0 }, errors: ['x'] };
  };
  const evs = parse(await (await fetch(`${baseUrl}/api/stream/scan?source=both&dryRun=1`)).text());
  assert.equal(ruCalls, 1);
  assert.deepEqual(evs.filter((e) => e.ev === 'progress').map((e) => e.data), [{ done: 1, total: 2 }, { done: 2, total: 2 }]);
  const dones = evs.filter((e) => e.ev === 'done').map((e) => e.data);
  assert.deepEqual(dones.map((d) => d.final), [false, true]);
  assert.equal(dones[1].errors, 1);
});

test('a runner that throws surfaces an SSE error and releases the slot', async () => {
  runners.ru = async () => { throw new Error('regional exploded'); };
  const evs = parse(await (await fetch(`${baseUrl}/api/stream/scan?source=regional`)).text());
  assert.ok(evs.some((e) => e.ev === 'error' && /regional exploded/.test(e.data.message)));
  assert.equal(slot.active, null);
});

test('unknown source -> SSE error', async () => {
  const evs = parse(await (await fetch(`${baseUrl}/api/stream/scan?source=nope`)).text());
  assert.equal(evs[0].ev, 'error');
  assert.match(evs[0].data.message, /unknown source/);
});
