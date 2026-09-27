/**
 * One scan at a time: a second GET /api/stream/scan while one is running gets
 * an SSE `error` with code SCAN_BUSY and no scanner run. On resumecraft.ru the
 * hourly timer and a UI-started scan overlapped, the viewer ran two full
 * in-process scans at once, and Caddy served 502s until it restarted.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let slot;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'scan-single-flight-'));
  for (const d of ['config', 'data', 'modes']) mkdirSync(resolve(dir, d), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# x\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'x\n');
  process.env.CAREER_OPS_ROOT = dir;
  const { createApp } = await import('../server/index.mjs');
  ({ __scanSlot: slot } = await import('../server/lib/routes/scan.mjs'));
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => {
  slot.release();
  delete process.env.CAREER_OPS_ROOT;
  server.closeAllConnections?.();
  return new Promise((r) => server.close(r));
});

async function events(path) {
  const res = await fetch(baseUrl + path);
  const text = await res.text();
  return text.split('\n\n').filter(Boolean).map((block) => {
    const ev = (block.match(/^event: (.+)$/m) || [])[1] || 'message';
    const data = JSON.parse((block.match(/^data: (.+)$/m) || [])[1] || 'null');
    return { ev, data };
  });
}

test('a second scan while one runs is refused with SCAN_BUSY and runs nothing', async () => {
  slot.claim('ui');
  try {
    const evs = await events('/api/stream/scan?source=ats&dryRun=1');
    assert.equal(evs.length, 1, 'exactly one event: ' + JSON.stringify(evs));
    assert.equal(evs[0].ev, 'error');
    assert.equal(evs[0].data.code, 'SCAN_BUSY');
    assert.match(evs[0].data.message, /already running/);
    assert.ok(!evs.some((e) => e.ev === 'start'), 'no scanner phase may start');
  } finally {
    slot.release();
  }
});

test('the slot is free again after a scan finishes — the next scan runs', async () => {
  const evs = await events('/api/stream/scan?source=ats&dryRun=1');
  assert.ok(evs.some((e) => e.ev === 'start'), JSON.stringify(evs));
  assert.ok(evs.some((e) => e.ev === 'done'), JSON.stringify(evs));
  assert.equal(slot.active, null, 'slot released after the run');
  const again = await events('/api/stream/scan?source=ats&dryRun=1');
  assert.ok(again.some((e) => e.ev === 'done'), 'a second, sequential scan is allowed');
});

test('the slot is released even when the scan errors (unknown source)', async () => {
  const evs = await events('/api/stream/scan?source=bogus');
  assert.equal(evs[0].ev, 'error');
  assert.equal(slot.active, null);
});
