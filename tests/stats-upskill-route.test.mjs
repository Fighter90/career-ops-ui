/**
 * GET /api/stats/upskill — zero-token read-only relay of upskill.mjs (JSON stdout
 * by default; carries an { error } field when there is too little data). CI-isolated:
 * bootstraps a mkdtemp CAREER_OPS_ROOT + a FAKE upskill.mjs, so the shell-out
 * contract is tested without the real parent. paths.mjs carriers load via dynamic
 * import() AFTER the env is set (paths-once rule).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root;

const GAPS_JSON = {
  schema_version: 3,
  metadata: { reportsLinked: 6, reportsRead: 6, reportsWithMachineSummary: 5, reportsScored: 6, lowFitReports: 4, lowFitScoreThreshold: 3, knownSkillCount: 12 },
  gaps: [
    { tier: 'Critical', skill: 'Kubernetes', reports: 4, lowFitReports: 3, weightedScore: 8.5 },
    { tier: 'Medium', skill: 'GraphQL', reports: 2, lowFitReports: 2, weightedScore: 3.2 },
  ],
  excludedAsKnown: [{ skill: 'Python' }, { skill: 'Go' }],
  knownSkills: ['go', 'python'],
};

const writeFake = (obj) => writeFileSync(join(root, 'upskill.mjs'), `console.log(JSON.stringify(${JSON.stringify(obj)}));`);

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'upskill-root-'));
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), '');
  writeFake(GAPS_JSON);
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

test('GET /api/stats/upskill relays the tiered gap map under available:true', async () => {
  const r = await fetch(baseUrl + '/api/stats/upskill');
  const d = await r.json();
  assert.equal(d.available, true);
  assert.equal(d.metadata.reportsScored, 6);
  assert.equal(d.gaps.length, 2);
  assert.equal(d.gaps[0].tier, 'Critical');
  assert.equal(d.gaps[0].skill, 'Kubernetes');
  assert.deepEqual(d.excludedAsKnown.map((e) => e.skill), ['Python', 'Go']);
});

test('GET /api/stats/upskill passes the { error } field through (too little data)', async () => {
  writeFake({ error: 'Not enough data: 2/5 scored reports. Evaluate more offers and come back.', current: 2, threshold: 5 });
  const r = await fetch(baseUrl + '/api/stats/upskill');
  const d = await r.json();
  assert.equal(d.available, true); // relay succeeded; the honest error lives in the payload
  assert.match(d.error, /Not enough data/);
});

test('GET /api/stats/upskill fails soft to {available:false} when the script is absent', async () => {
  rmSync(join(root, 'upskill.mjs'), { force: true });
  const r = await fetch(baseUrl + '/api/stats/upskill');
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.available, false);
  assert.equal(d.reason, 'script-not-found');
});
