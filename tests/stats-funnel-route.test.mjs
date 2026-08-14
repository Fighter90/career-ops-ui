/**
 * GET /api/stats/funnel — zero-token read-only relay of funnel-velocity.mjs
 * ({ calibration, waiting, velocity }). CI-isolated: bootstraps a mkdtemp
 * CAREER_OPS_ROOT and writes a FAKE funnel-velocity.mjs emitting the real JSON
 * shape, so the shell-out contract is tested without the real parent. paths.mjs
 * carriers load via dynamic import() AFTER the env is set (paths-once rule).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root;

const FUNNEL_JSON = {
  calibration: {
    everApplied: 8, smallSample: true, claimMinN: 20,
    responseRate: { band: 'above-range', ownPct: 41.7, rangePct: [2, 13], typicalPct: 3, vsTypical: 13.9, source: 'HiringThing 2025', year: 2025, caveat: 'Mass-application platform data.' },
    interviewRate: { band: 'in-range', ownPct: 25, rangePct: [2, 40], typicalPct: 12, vsTypical: 2.1, source: 'aggregate 2026', year: 2026, caveat: '' },
  },
  waiting: {
    windowDays: [5, 14], windowSource: { source: 'estimate', year: 2025 }, inFlight: 3, unknownDates: 1,
    items: [
      { num: 4, company: 'Umbrella', appliedDate: '2026-07-01', elapsedDays: 20, beyondTypicalWindow: true, dateSource: 'tracker' },
      { num: 5, company: 'Stark', appliedDate: '2026-07-10', elapsedDays: 8, beyondTypicalWindow: false, dateSource: 'tracker' },
    ],
  },
  velocity: {
    appliedToResponded: { from: 'Applied', to: 'Responded', n: 3, median: 5, p75: 6, censored: 1 },
    respondedToInterview: { from: 'Responded', to: 'Interview', n: 2, median: 6, p75: 6, censored: 0 },
    interviewToOffer: { from: 'Interview', to: 'Offer', n: 1, median: null, p75: null, censored: 1 },
    appliedToRejected: { from: 'Applied', to: 'Rejected', n: 1, median: 6, p75: 6, censored: 0 },
  },
};

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'funnel-root-'));
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), '');
  writeFileSync(join(root, 'funnel-velocity.mjs'), `console.log(JSON.stringify(${JSON.stringify(FUNNEL_JSON)}));`);
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

test('GET /api/stats/funnel relays the funnel-velocity.mjs JSON verbatim under available:true', async () => {
  const r = await fetch(baseUrl + '/api/stats/funnel');
  const d = await r.json();
  assert.equal(d.available, true);
  assert.equal(d.calibration.responseRate.band, 'above-range');
  assert.equal(d.calibration.responseRate.ownPct, 41.7);
  assert.deepEqual(d.calibration.responseRate.rangePct, [2, 13]);
  assert.equal(d.calibration.smallSample, true);
  assert.equal(d.waiting.inFlight, 3);
  assert.equal(d.waiting.items.filter((it) => it.beyondTypicalWindow).length, 1);
  assert.equal(d.velocity.appliedToResponded.median, 5);
  assert.equal(d.velocity.interviewToOffer.median, null); // insufficient-data hop stays null
});

test('GET /api/stats/funnel fails soft to {available:false} when the script is absent', async () => {
  // Remove the stub after the happy-path test ran → the route must degrade,
  // not 500, so the tab shows an honest empty state on a standalone install.
  rmSync(join(root, 'funnel-velocity.mjs'), { force: true });
  const r = await fetch(baseUrl + '/api/stats/funnel');
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.available, false);
  assert.equal(d.reason, 'script-not-found');
});
