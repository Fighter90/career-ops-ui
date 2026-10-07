/**
 * v1.241.0 review hardening — activity-log.mjs.
 *
 *  - readActivity sliced the last 2×limit lines BEFORE applying the action
 *    filter, so an older matching event behind a burst of other events was
 *    never returned.
 *  - Several routes call logActivity({ type: … }) while the logger read only
 *    `action`, recording them as 'unknown'.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const savedRoot = process.env.CAREER_OPS_ROOT;
let ROOT;
let LOG;
let mod;

before(async () => {
  ROOT = mkdtempSync(join(tmpdir(), 'infra-activity-'));
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(join(ROOT, 'cv.md'), '# CV\n');
  LOG = join(ROOT, 'data', 'activity.jsonl');
  process.env.CAREER_OPS_ROOT = ROOT;
  mod = await import('../server/lib/activity-log.mjs');
});
beforeEach(() => writeFileSync(LOG, ''));
after(() => {
  if (savedRoot === undefined) delete process.env.CAREER_OPS_ROOT; else process.env.CAREER_OPS_ROOT = savedRoot;
  rmSync(ROOT, { recursive: true, force: true });
});

const line = (action, i) => JSON.stringify({ ts: new Date(1_700_000_000_000 + i).toISOString(), action, target: String(i) });

test('the action filter is applied before the limit, not after a 2×limit slice', () => {
  const lines = [line('scan.start', 0), line('scan.start', 1)];
  for (let i = 2; i < 100; i++) lines.push(line('cv.save', i));
  writeFileSync(LOG, lines.join('\n') + '\n');
  const out = mod.readActivity({ limit: 5, actionPrefix: 'scan.' });
  assert.deepEqual(out.map((e) => e.target), ['1', '0']);
  // unfiltered reads keep newest-first + limit
  assert.deepEqual(mod.readActivity({ limit: 2 }).map((e) => e.target), ['99', '98']);
});

test('logActivity accepts `type` as the action when `action` is absent', () => {
  mod.logActivity({ type: 'auto-pipeline.report.saved', target: 'reports/x.md' });
  mod.logActivity({ action: 'cv.save', type: 'ignored' });
  mod.logActivity({ target: 'nothing' });
  const rows = readFileSync(LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(rows.map((r) => r.action), ['auto-pipeline.report.saved', 'cv.save', 'unknown']);
});

test('activityMiddleware maps routes, skips reads and failures', () => {
  const run = (method, path, status, body = {}, params) => {
    let finish;
    const res = { statusCode: status, on: (_e, fn) => { finish = fn; } };
    let nexted = false;
    mod.activityMiddleware({ method, path, body, params }, res, () => { nexted = true; });
    assert.ok(nexted);
    finish?.();
  };
  run('POST', '/api/pipeline', 200, { url: 'https://jobs.example/1' });
  run('DELETE', '/api/pipeline', 200, { text: 'see https://jobs.example/2 now' });
  run('PUT', '/api/cv', 200, { markdown: '\n# Jane\nbody' });
  run('POST', '/api/cv/import', 200);
  run('PUT', '/api/profile', 200, { company: 'Acme', role: 'Dev' });
  run('POST', '/api/config', 200, { company: 'Solo' });
  run('POST', '/api/jds', 200, { slug: 'jd-1' });
  run('DELETE', '/api/jds/x', 200, {}, { name: 'x' });
  run('PUT', '/api/jds/y', 200);
  run('POST', '/api/run/doctor', 200);
  run('POST', '/api/evaluate', 200);
  run('POST', '/api/deep', 200);
  run('POST', '/api/apply-helper', 200);
  run('POST', '/api/tracker', 200);
  run('GET', '/api/stream/scan', 200);
  run('GET', '/api/cv', 200);            // read: skipped
  run('POST', '/api/activity', 200);     // itself: skipped
  run('POST', '/api/other', 200);        // unmapped: skipped
  run('POST', '/api/evaluate', 500);     // failure: skipped
  run('POST', '/elsewhere', 200);        // not API: skipped
  const rows = readFileSync(LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(rows.map((r) => r.action), [
    'pipeline.add', 'pipeline.remove', 'cv.save', 'cv.import', 'profile.save', 'config.save', 'jd.save',
    'jd.delete', 'jd.update', 'script.doctor', 'evaluate', 'deep.research', 'apply.checklist', 'tracker.add', 'stream.scan',
  ]);
  assert.deepEqual(rows.slice(0, 7).map((r) => r.target), [
    'https://jobs.example/1', 'https://jobs.example/2', '# Jane', null, 'Acme — Dev', 'Solo', 'jd-1',
  ]);
  assert.equal(rows[7].target, 'x');
});

test('long details are clipped; a missing log reads as empty; an oversized log rotates', () => {
  mod.logActivity({ action: 'x', detail: { big: 'y'.repeat(500) } });
  const row = JSON.parse(readFileSync(LOG, 'utf8').trim());
  assert.ok(row.detail.length <= 201 && row.detail.endsWith('…'));
  rmSync(LOG);
  assert.deepEqual(mod.readActivity(), []);
  const filler = (line('old', 0) + '\n').repeat(Math.ceil((5 * 1024 * 1024 + 10) / (line('old', 0).length + 1)));
  writeFileSync(LOG, filler);
  mod.logActivity({ action: 'fresh' });
  const after = readFileSync(LOG, 'utf8');
  assert.ok(after.length < filler.length * 0.75);
  assert.equal(mod.readActivity({ limit: 1 })[0].action, 'fresh');
});
