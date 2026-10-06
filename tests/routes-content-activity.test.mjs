/**
 * security-sweep / routes-1 — content.mjs + reports.mjs:
 *   - PUT /api/profile `arrays` keys are checked with Object.hasOwn, so a
 *     prototype key (`constructor`, `toString`) is an unknown path (400).
 *   - PUT /api/modes/_profile section merge: a section literally headed
 *     `constructor` is not overwritten by Object.prototype.constructor.
 *   - explicit logActivity calls record a real `action` (they passed `type`,
 *     which logActivity ignores -> 'unknown').
 * CI-isolated mkdtemp root.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'routes-content-'));
  for (const d of ['config', 'data', 'modes', 'reports']) mkdirSync(join(root, d), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# x\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'modes', '_profile.md'), '# Profile\n\n## constructor\nkeep me\n\n## Targets\nold\n');
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

const put = (p, b) => fetch(baseUrl + p, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const post = (p, b) => fetch(baseUrl + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const activity = () => (existsSync(join(root, 'data', 'activity.jsonl'))
  ? readFileSync(join(root, 'data', 'activity.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  : []);

test('PUT /api/profile: a prototype key in `arrays` is an unknown path (400)', async () => {
  for (const k of ['constructor', 'toString', '__proto__']) {
    const r = await fetch(baseUrl + '/api/profile', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: `{"arrays":{"${k}":[]}}`,
    });
    assert.equal(r.status, 400, k);
    assert.match((await r.json()).error, /unknown profile array path/);
  }
  assert.equal(readFileSync(join(root, 'config', 'profile.yml'), 'utf8'), 'candidate:\n  full_name: T\n');
});

test('PUT /api/modes/_profile sections: a `constructor` heading keeps its body', async () => {
  const r = await put('/api/modes/_profile', { sections: { Targets: 'new\n' } });
  assert.equal(r.status, 200);
  const md = readFileSync(join(root, 'modes', '_profile.md'), 'utf8');
  assert.match(md, /## constructor\nkeep me/);
  assert.doesNotMatch(md, /native code/);
  assert.match(md, /## Targets\nnew/);
});

test('logActivity call sites record a real action', async () => {
  await put('/api/modes/_profile', { markdown: '# P\n\n## A\nx\n' });
  await post('/api/reports', { slug: 'acme-1', markdown: '# Acme\n' });
  const actions = activity().map((e) => e.action);
  assert.ok(actions.includes('modes_profile.save'), JSON.stringify(actions));
  assert.ok(actions.includes('reports.save'), JSON.stringify(actions));
  assert.ok(!actions.includes('unknown'), JSON.stringify(actions));
  const rep = activity().find((e) => e.action === 'reports.save');
  assert.equal(rep.target, 'reports/acme-1.md');
  assert.equal(rep.ok, true);
});
