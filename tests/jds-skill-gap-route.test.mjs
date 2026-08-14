/**
 * GET /api/jds/:name/skill-gap — zero-token relay of jd-skill-gap.mjs
 * ({ existing, supportedByResume, gap, lowConfidence }). CI-isolated: mkdtemp
 * CAREER_OPS_ROOT with a saved JD + a FAKE jd-skill-gap.mjs. The `:name` is
 * path-sanitized and must resolve to a real jds/ file before it becomes a
 * script arg. paths.mjs carriers load via dynamic import() AFTER the env is set.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'jsg-root-'));
  mkdirSync(join(root, 'jds'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# CV\n## Skills\nGo, PostgreSQL\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'jds', 'acme.txt'), 'Requirements: Go, Kubernetes, Redis\n');
  // Fake jd-skill-gap.mjs: echoes a fixed classification and PROVES the JD path
  // arg reached it (writes the arg into a field so we can assert it's `jds/<name>`).
  writeFileSync(join(root, 'jd-skill-gap.mjs'),
    "const jd = process.argv[2] || '';\n"
    + "console.log(JSON.stringify({ existing: ['Go','PostgreSQL'], supportedByResume: [], gap: ['Kubernetes','Redis'], lowConfidence: null, _arg: jd }));");
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

test('GET /api/jds/:name/skill-gap relays the classification and passes the safe jds/<name> path', async () => {
  const r = await fetch(baseUrl + '/api/jds/acme.txt/skill-gap');
  const d = await r.json();
  assert.equal(d.available, true);
  assert.deepEqual(d.existing, ['Go', 'PostgreSQL']);
  assert.deepEqual(d.gap, ['Kubernetes', 'Redis']);
  assert.equal(d._arg, 'jds/acme.txt', 'the script receives the sanitized jds/<name> path');
});

test('a path-traversal name never reaches the script (rejected 400/404)', async () => {
  // sanitizePathName strips the slashes, so `../../etc/passwd` folds to a safe,
  // non-existent name under jds/ → 404 (or 400 if it sanitized to empty). Either
  // way the script is never run on a path outside jds/, and no file leaks.
  const r = await fetch(baseUrl + '/api/jds/' + encodeURIComponent('../../etc/passwd') + '/skill-gap');
  assert.ok(r.status === 400 || r.status === 404, `traversal must be rejected, got ${r.status}`);
  const d = await r.json();
  assert.notEqual(d.available, true, 'a traversal name must never produce a script result');
});

test('an unknown JD name is a 404, not a script run', async () => {
  const r = await fetch(baseUrl + '/api/jds/nope.txt/skill-gap');
  assert.equal(r.status, 404);
});

test('fails soft to {available:false} when jd-skill-gap.mjs is absent', async () => {
  rmSync(join(root, 'jd-skill-gap.mjs'), { force: true });
  const r = await fetch(baseUrl + '/api/jds/acme.txt/skill-gap');
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.available, false);
  assert.equal(d.reason, 'script-not-found');
});
