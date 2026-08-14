/**
 * GET /api/stats/rejection-latency — zero-token read-only relay of
 * rejection-latency.mjs (JSON stdout by default: { metadata, flags, warnings }).
 * CI-isolated: bootstraps a mkdtemp CAREER_OPS_ROOT + a FAKE rejection-latency.mjs.
 * paths.mjs carriers load via dynamic import() AFTER the env is set (paths-once rule).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root;

const JSON_OUT = {
  metadata: { today: '2026-08-14', courtesyDays: 30, interviewRows: 3, companiesChecked: 3, flagged: 1, disclaimer: 'Suggestion only — not a rejection claim.' },
  flags: [
    { company: 'Acme', role: 'Engineer', trackerNums: ['4'], lastInterviewDate: '2026-05-29', daysSinceLastInterview: 77, tier: 'courtesy', thresholdDays: 30, reason: 'silent past the 30-day courtesy window', reasonCode: 'courtesy-threshold-exceeded' },
  ],
  warnings: ['A "Globex" interview row had no parseable date.'],
};

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'rejlat-root-'));
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), '');
  writeFileSync(join(root, 'rejection-latency.mjs'), `console.log(JSON.stringify(${JSON.stringify(JSON_OUT)}));`);
  process.env.CAREER_OPS_ROOT = root;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  if (root) rmSync(root, { recursive: true, force: true });
  return new Promise((r) => server.close(r));
});

test('GET /api/stats/rejection-latency relays the flagged interviews under available:true', async () => {
  const r = await fetch(baseUrl + '/api/stats/rejection-latency');
  const d = await r.json();
  assert.equal(d.available, true);
  assert.equal(d.metadata.courtesyDays, 30);
  assert.equal(d.metadata.flagged, 1);
  assert.equal(d.flags.length, 1);
  assert.equal(d.flags[0].company, 'Acme');
  assert.equal(d.flags[0].daysSinceLastInterview, 77);
  assert.equal(d.warnings.length, 1);
});

test('GET /api/stats/rejection-latency fails soft to {available:false} when the script is absent', async () => {
  rmSync(join(root, 'rejection-latency.mjs'), { force: true });
  const r = await fetch(baseUrl + '/api/stats/rejection-latency');
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.available, false);
  assert.equal(d.reason, 'script-not-found');
});
