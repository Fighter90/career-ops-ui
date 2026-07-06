/**
 * v1.117.0 parent-parity routes — follow-up cadence, rejection patterns,
 * CV add-entry, reconcile runner.
 *
 * CI-isolated: bootstraps a mkdtemp CAREER_OPS_ROOT and writes FAKE parent
 * scripts (followup-cadence.mjs / followup-seed.mjs / analyze-patterns.mjs)
 * into it, so the shell-out contract is tested without the real parent.
 * All paths.mjs carriers load via dynamic import() AFTER the env is set
 * (the paths-once eager-import rule).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'parity-root-'));
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# CV\n\nSenior Engineer with Node.js and Postgres experience.\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), '');
  // Fake parent scripts: emit the parent's real JSON shapes.
  writeFileSync(join(root, 'followup-cadence.mjs'), `
console.log(JSON.stringify({
  metadata: { analysisDate: '2026-07-06', totalTracked: 3, actionable: 2, overdue: 1, urgent: 1, cold: 0, waiting: 0 },
  entries: [
    { appNum: 7, company: 'Acme', role: 'ML Engineer', status: 'Applied', urgency: 'urgent', daysUntilNext: -2 },
    { appNum: 9, company: 'Globex', role: 'Data Engineer', status: 'Responded', urgency: 'overdue', daysUntilNext: -1 },
  ],
  cadenceConfig: { applied_first: 7 },
}));`);
  writeFileSync(join(root, 'followup-seed.mjs'), `
const args = process.argv.slice(2);
if (args.includes('--boom')) { console.error('nope'); process.exit(1); }
console.log(JSON.stringify({ seeded: args.filter(a => !a.startsWith('--')), backfill: args.includes('--backfill') }));`);
  writeFileSync(join(root, 'analyze-patterns.mjs'), `
console.log(JSON.stringify({
  metadata: { total: 5, analysisDate: '2026-07-06', byOutcome: { positive: 1, negative: 3, self_filtered: 0, pending: 1 } },
  recommendations: [{ action: 'Tighten filters', reasoning: 'because', impact: 'high' }],
  vendorAnalysis: { minSampleForClaim: 8, breakdown: [{ vendor: 'greenhouse', total: 3, advanced: 1, advanceRate: 33, sufficientSample: false }] },
  archetypeBreakdown: [{ archetype: 'Backend', total: 4 }],
}));`);
  process.env.CAREER_OPS_ROOT = root;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

test('GET /api/followup relays the cadence JSON (available:true, urgency-sorted entries)', async () => {
  const r = await fetch(baseUrl + '/api/followup');
  const d = await r.json();
  assert.equal(d.available, true);
  assert.equal(d.metadata.urgent, 1);
  assert.equal(d.entries.length, 2);
  assert.equal(d.entries[0].company, 'Acme');
});

test('POST /api/followup/seed validates input and runs the seed script with --json', async () => {
  const bad = await fetch(baseUrl + '/api/followup/seed', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appNum: 'x' }),
  });
  assert.equal(bad.status, 400);
  const ok = await fetch(baseUrl + '/api/followup/seed', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appNum: 7, force: true }),
  });
  const d = await ok.json();
  assert.equal(d.ok, true);
  assert.deepEqual(d.result.seeded, ['7']);
  const bf = await fetch(baseUrl + '/api/followup/seed', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ backfill: true }),
  });
  assert.equal((await bf.json()).result.backfill, true);
});

test('GET /api/stats/patterns relays the analysis JSON (recommendations + vendor table)', async () => {
  const r = await fetch(baseUrl + '/api/stats/patterns');
  const d = await r.json();
  assert.equal(d.available, true);
  assert.equal(d.metadata.total, 5);
  assert.equal(d.recommendations[0].impact, 'high');
  assert.equal(d.vendorAnalysis.breakdown[0].vendor, 'greenhouse');
});

test('POST /api/cv-studio/add-entry: too-thin source → 400; pasted text → grounded prompt (no writes)', async () => {
  const thin = await fetch(baseUrl + '/api/cv-studio/add-entry', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'tiny' }),
  });
  assert.equal(thin.status, 400);
  const src = 'An open-source scanner that walks 50 ATS job boards, dedups postings, and writes a normalized JSONL feed. Built with Node.js streams; 1200 GitHub stars.';
  const cvBefore = readFileSync(join(root, 'cv.md'), 'utf8');
  const r = await fetch(baseUrl + '/api/cv-studio/add-entry', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: src }),
  });
  const d = await r.json();
  assert.equal(d.mode, 'manual');            // no provider key in CI → manual prompt
  assert.match(d.prompt, /Ground EVERY claim in the SOURCE/);
  assert.match(d.prompt, /1200 GitHub stars/);
  assert.equal(readFileSync(join(root, 'cv.md'), 'utf8'), cvBefore); // NO writes
});

test('POST /api/cv-studio/add-entry rejects unsafe URLs (SSRF gate)', async () => {
  for (const url of ['http://127.0.0.1/x', 'file:///etc/passwd', 'javascript:alert(1)']) {
    const r = await fetch(baseUrl + '/api/cv-studio/add-entry', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }),
    });
    assert.equal(r.status, 400, `expected 400 for ${url}`);
  }
});

test('runners: /api/run/reconcile is registered (404 would mean missing verb)', async () => {
  // The fake root has no reconcile-pipeline.mjs — the runner responds with its
  // structured "script missing/failed" shape, NOT a 404 (route exists).
  const r = await fetch(baseUrl + '/api/run/reconcile', { method: 'POST' });
  assert.notEqual(r.status, 404);
});

test('apply checklist carries the knock-out pre-scan step', async () => {
  const r = await fetch(baseUrl + '/api/apply-helper', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://boards.greenhouse.io/x/jobs/1' }),
  });
  const d = await r.json();
  const text = JSON.stringify(d);
  assert.match(text, /KNOCK-OUT PRE-SCAN/);
  assert.match(text, /KNOCK-OUT WARNING/);
});

// ─── SRV-M2/M3 + TST-M2/M3/M4 — behavioral coverage for the relay contract ──
// These tests OVERWRITE the fake parent scripts, so they run after every
// happy-path test above (node:test executes tests in declaration order).

test('GET /api/followup: parent "no data yet" ({error} + exit 1) relays as a HEALTHY empty state', async () => {
  writeFileSync(join(root, 'followup-cadence.mjs'),
    `console.error('no rows'); console.log(JSON.stringify({ error: 'No applications found in tracker.' })); process.exit(1);`);
  const d = await (await fetch(baseUrl + '/api/followup')).json();
  assert.equal(d.available, true);
  assert.equal(d.empty, true);
  assert.equal(d.note, 'No applications found in tracker.');
  assert.deepEqual(d.entries, []);
});

test('GET /api/followup: an UNRECOGNIZED {error} falls through to script-error (not masked as empty)', async () => {
  writeFileSync(join(root, 'followup-cadence.mjs'),
    `console.log(JSON.stringify({ error: 'TypeError: cannot read x of undefined' })); process.exit(1);`);
  const d = await (await fetch(baseUrl + '/api/followup')).json();
  assert.equal(d.available, false);
  assert.equal(d.reason, 'script-error');
});

test('GET /api/followup: script-error detail strips absolute filesystem paths', async () => {
  writeFileSync(join(root, 'followup-cadence.mjs'),
    `console.error('Error: boom\\n    at fail (' + process.cwd() + '/followup-cadence.mjs:2:9)'); process.exit(3);`);
  const d = await (await fetch(baseUrl + '/api/followup')).json();
  assert.equal(d.available, false);
  assert.equal(d.reason, 'script-error');
  assert.ok(!d.detail.includes(root), `detail leaked the project root: ${d.detail}`);
});

test('GET /api/stats/patterns: both benign "no data" messages relay as healthy empty; unknown {error} does not', async () => {
  writeFileSync(join(root, 'analyze-patterns.mjs'),
    `console.log(JSON.stringify({ error: 'Not enough data: 2/8 applications beyond "Evaluated". Keep applying and come back later.' })); process.exit(1);`);
  let d = await (await fetch(baseUrl + '/api/stats/patterns')).json();
  assert.equal(d.available, true);
  assert.equal(d.empty, true);
  assert.equal(d.metadata.total, 0);

  writeFileSync(join(root, 'analyze-patterns.mjs'),
    `console.log(JSON.stringify({ error: 'ENOENT: config vanished' })); process.exit(1);`);
  d = await (await fetch(baseUrl + '/api/stats/patterns')).json();
  assert.equal(d.available, false);
  assert.equal(d.reason, 'script-error');
});

test('POST /api/followup/seed: failing seed script → 422 with sanitized detail', async () => {
  writeFileSync(join(root, 'followup-seed.mjs'),
    `console.error('seed exploded at ' + process.cwd() + '/followup-seed.mjs:1:1'); process.exit(1);`);
  const r = await fetch(baseUrl + '/api/followup/seed', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appNum: 7 }),
  });
  assert.equal(r.status, 422);
  const d = await r.json();
  assert.equal(d.error, 'seed failed');
  assert.ok(!String(d.detail).includes(root), `detail leaked the project root: ${d.detail}`);
});

test('GET /api/followup: script REMOVED from parent → available:false, script-not-found', async () => {
  const { rmSync } = await import('node:fs');
  rmSync(join(root, 'followup-cadence.mjs'));
  const d = await (await fetch(baseUrl + '/api/followup')).json();
  assert.equal(d.available, false);
  assert.equal(d.reason, 'script-not-found');
});
