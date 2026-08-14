/**
 * POST /api/cv-studio/verify-facts — a zero-token truthfulness gate that writes
 * the client's generated text to a throwaway temp file and runs verify-cv-facts.mjs
 * against cv.md + profile + two-pager. The parent script exits 1 on a 'block'
 * verdict while still printing valid JSON, so the relay must trust the JSON verdict
 * regardless of exit code. CI-isolated via a mkdtemp CAREER_OPS_ROOT + a fake
 * verify-cv-facts.mjs. paths.mjs carriers load via dynamic import() AFTER the env
 * is set (paths-once rule).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root;

// A fake that echoes a fixed verdict and mimics the real exit code (1 on block).
const fakeBlock = `console.log(JSON.stringify({verdict:'block',invented:['250%','$1.2m'],unsupportedFacts:[{kind:'title',value:'CTO'}],forbidden:[],warnings:['synergy']}));process.exit(1);`;
const fakePass = `console.log(JSON.stringify({verdict:'pass',invented:[],unsupportedFacts:[],forbidden:[],warnings:[]}));process.exit(0);`;
const writeFake = (body) => writeFileSync(join(root, 'verify-cv-facts.mjs'), body);

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'verify-root-'));
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# CV\nSoftware engineer.\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), '');
  writeFake(fakeBlock);
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

const post = (text) => fetch(baseUrl + '/api/cv-studio/verify-facts', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }),
});

test('a block verdict is returned under available:true even though the script exits 1', async () => {
  const r = await post('Increased revenue by 250% and cut costs by $1.2M as CTO.');
  const d = await r.json();
  assert.equal(d.available, true);
  assert.equal(d.verdict, 'block');
  assert.deepEqual(d.invented, ['250%', '$1.2m']);
  assert.equal(d.unsupportedFacts[0].value, 'CTO');
  assert.deepEqual(d.warnings, ['synergy']);
});

test('a pass verdict is returned under available:true', async () => {
  writeFake(fakePass);
  const r = await post('Experienced engineer who builds reliable systems.');
  const d = await r.json();
  assert.equal(d.available, true);
  assert.equal(d.verdict, 'pass');
});

test('empty text is a 400', async () => {
  const r = await post('   ');
  assert.equal(r.status, 400);
});

test('fails soft to {available:false} when the script is absent', async () => {
  rmSync(join(root, 'verify-cv-facts.mjs'), { force: true });
  const r = await post('anything');
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.available, false);
  assert.equal(d.reason, 'script-not-found');
});
