/**
 * v1.118.0 parent-parity routes — lifetime pipeline stats (stats.mjs #1605),
 * compensation observations (salary-gap.mjs), and the canonical 'Hired'
 * tracker status (templates/states.yml id:hired).
 *
 * CI-isolated: bootstraps a mkdtemp CAREER_OPS_ROOT and writes FAKE parent
 * scripts (stats.mjs / salary-gap.mjs) into it, so the shell-out contract is
 * tested without the real parent. All paths.mjs carriers load via dynamic
 * import() AFTER the env is set (the paths-once eager-import rule).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'parity118-root-'));
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), '');
  // Fake parent scripts: emit the parent's real JSON shapes (career-ops v1.18.0).
  writeFileSync(join(root, 'stats.mjs'), `
console.log(JSON.stringify({
  metadata: { generatedAt: '2026-07-09', sources: { tracker: true, scanHistory: true, followups: false, portals: true, scanRuns: false } },
  tracker: { total: 12, byStatus: { Applied: 5, Interview: 2, Hired: 1 }, avgScore: 4.1, avgScoreApplied: 4.3, topScore: 4.8, pdfPct: 80, reportPct: 100, activeApps: 7 },
  funnel: { everApplied: 8, everResponded: 4, everInterview: 2, everOffer: 1, responseRate: 50, interviewRate: 25, offerRate: 13, smallSample: true },
  scan: { totalRecorded: 900, added: 40, byStatus: {}, byPortal: { greenhouse: 500, lever: 400 }, distinctCompanies: 60, firstSeen: '2026-01-01', lastSeen: '2026-07-09', addedPerWeek: [] },
  portals: { configuredCompanies: 128, configuredBoards: 3, activePortals: 10, producingCompanies: 45, producingPct: 35 },
  followups: null,
  runs: null,
}));`);
  writeFileSync(join(root, 'salary-gap.mjs'), `
console.log(JSON.stringify({
  applications: [
    { num: '031', company: 'Acme', role: 'ML Engineer',
      desired: { value: 120000, currency: 'EUR' }, advertised: { value: 110000, currency: 'EUR' },
      actual: { value: 125000, currency: 'EUR' }, advToActPct: 13.6, desiredToActPct: 4.2, trail: [] },
  ],
  aggregates: { byCurrency: { EUR: { confirmed: 1 } }, byCompanyRole: { 'Acme|ML Engineer': { company: 'Acme', role: 'ML Engineer', confirmed: 1, advToActPcts: [13.6] } } },
  quality: { orphans: [], unparseable: [], invalidSources: [], currencyMismatches: [], withoutActual: 0, latestObservation: '2026-07-01' },
}));`);
  process.env.CAREER_OPS_ROOT = root;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

test('GET /api/stats/lifetime relays the stats.mjs JSON (tracker roll-up + funnel + scan)', async () => {
  const r = await fetch(baseUrl + '/api/stats/lifetime');
  const d = await r.json();
  assert.equal(d.available, true);
  assert.equal(d.tracker.total, 12);
  assert.equal(d.tracker.byStatus.Hired, 1);
  assert.equal(d.funnel.responseRate, 50);
  assert.equal(d.scan.byPortal.greenhouse, 500);
  assert.equal(d.portals.producingPct, 35);
});

test('GET /api/stats/salary-gap relays the salary-gap.mjs JSON (folded applications)', async () => {
  const r = await fetch(baseUrl + '/api/stats/salary-gap');
  const d = await r.json();
  assert.equal(d.available, true);
  assert.equal(d.applications.length, 1);
  assert.equal(d.applications[0].company, 'Acme');
  assert.equal(d.applications[0].actual.value, 125000);
  assert.equal(d.quality.withoutActual, 0);
});

test("POST /api/tracker accepts the canonical 'Hired' status (parent states.yml parity)", async () => {
  const r = await fetch(baseUrl + '/api/tracker', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ company: 'Acme', role: 'ML Engineer', status: 'Hired', score: '4.5' }),
  });
  assert.equal(r.status, 200);
  const tracker = readFileSync(join(root, 'data', 'applications.md'), 'utf-8');
  assert.match(tracker, /\| Hired \|/);
  const list = await (await fetch(baseUrl + '/api/tracker')).json();
  assert.equal(list.rows.find((x) => x.company === 'Acme').status, 'Hired');
});

test('POST /api/tracker still whitelists: an unknown status degrades to Evaluated', async () => {
  const r = await fetch(baseUrl + '/api/tracker', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ company: 'Globex', role: 'Data Engineer', status: 'Bogus' }),
  });
  assert.equal(r.status, 200);
  const list = await (await fetch(baseUrl + '/api/tracker')).json();
  assert.equal(list.rows.find((x) => x.company === 'Globex').status, 'Evaluated');
});
