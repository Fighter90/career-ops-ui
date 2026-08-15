/**
 * GET /api/jds/:name/reuse — zero-token "reuse a past CV?" relay of the parent
 * jd-similarity.mjs. It compares a saved JD against every OTHER saved JD and
 * returns the single most reusable match ({ decision, score, reason }).
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT with saved JDs + a FAKE jd-similarity.mjs
 * that mirrors the REAL CLI contract — two file-path args in, pretty JSON
 * { decision: reuse|reuse-with-edits|regenerate, score, reason } out. paths.mjs
 * carriers load via dynamic import() AFTER the env is set. Tests run in order
 * and each restores any fixture state it mutates.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root;

// Faithful to the real jd-similarity.mjs: reads two file paths (argv[2] = new,
// argv[3] = previous) and prints the exact { decision, score, reason } shape.
// Here the verdict is driven off a marker in the PREVIOUS file so ranking is
// deterministic, standing in for the real Jaccard + seniority computation.
const FAKE_SIMILARITY = [
  "import { readFileSync } from 'node:fs';",
  "let prev = '';",
  "try { prev = readFileSync(process.argv[3], 'utf8'); } catch {}",
  "let out;",
  "if (prev.includes('MATCH_REUSE')) out = { decision: 'reuse', score: 0.9, reason: 'high-similarity' };",
  "else if (prev.includes('MATCH_EDITS')) out = { decision: 'reuse-with-edits', score: 0.5, reason: 'medium-similarity' };",
  "else out = { decision: 'regenerate', score: 0.1, reason: 'low-similarity' };",
  "console.log(JSON.stringify(out, null, 2));",
].join('\n');

const SIMILARITY_PATH = () => join(root, 'jd-similarity.mjs');

function seedPriors() {
  writeFileSync(join(root, 'jds', 'reuseone.txt'), 'MATCH_REUSE Backend Engineer\n');
  writeFileSync(join(root, 'jds', 'editsone.txt'), 'MATCH_EDITS Platform Engineer\n');
  writeFileSync(join(root, 'jds', 'regenone.txt'), 'Marketing Manager\n');
}

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'jsr-root-'));
  mkdirSync(join(root, 'jds'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'jds', 'new.txt'), 'Senior Backend Engineer — Go, Postgres\n');
  seedPriors();
  writeFileSync(SIMILARITY_PATH(), FAKE_SIMILARITY);
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

test('returns the most reusable match, ranking reuse > reuse-with-edits > regenerate', async () => {
  const r = await fetch(baseUrl + '/api/jds/new.txt/reuse');
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.available, true);
  assert.equal(d.comparedCount, 3, 'all three OTHER saved JDs were compared');
  assert.ok(d.best && typeof d.best === 'object');
  assert.equal(d.best.name, 'reuseone.txt', 'the reuse-verdict JD outranks the edits/regenerate ones');
  assert.equal(d.best.decision, 'reuse');
  assert.equal(d.best.score, 0.9);
  assert.equal(d.best.reason, 'high-similarity');
});

test('falls to reuse-with-edits when no exact reuse match exists', async () => {
  rmSync(join(root, 'jds', 'reuseone.txt'), { force: true });
  try {
    const r = await fetch(baseUrl + '/api/jds/new.txt/reuse');
    const d = await r.json();
    assert.equal(d.available, true);
    assert.equal(d.best.name, 'editsone.txt');
    assert.equal(d.best.decision, 'reuse-with-edits');
    assert.equal(d.comparedCount, 2);
  } finally {
    seedPriors();
  }
});

test('an unknown JD name is a 404, not a script run', async () => {
  const r = await fetch(baseUrl + '/api/jds/nope.txt/reuse');
  assert.equal(r.status, 404);
});

test('a path-traversal name never reaches the script (rejected 400/404)', async () => {
  const r = await fetch(baseUrl + '/api/jds/' + encodeURIComponent('../../etc/passwd') + '/reuse');
  assert.ok(r.status === 400 || r.status === 404, `traversal must be rejected, got ${r.status}`);
  const d = await r.json();
  assert.notEqual(d.available, true, 'a traversal name must never produce a script result');
});

test('a JD with no OTHER saved JD to compare against is available:false (no-prior-jds)', async () => {
  for (const f of ['reuseone.txt', 'editsone.txt', 'regenone.txt']) rmSync(join(root, 'jds', f), { force: true });
  try {
    const r = await fetch(baseUrl + '/api/jds/new.txt/reuse');
    const d = await r.json();
    assert.equal(r.status, 200);
    assert.equal(d.available, false);
    assert.equal(d.reason, 'no-prior-jds');
  } finally {
    seedPriors();
  }
});

test('fails soft to {available:false, reason:script-not-found} when jd-similarity.mjs is absent (CI reality)', async () => {
  rmSync(SIMILARITY_PATH(), { force: true });
  try {
    const r = await fetch(baseUrl + '/api/jds/new.txt/reuse');
    const d = await r.json();
    assert.equal(r.status, 200);
    assert.equal(d.available, false);
    assert.equal(d.reason, 'script-not-found');
  } finally {
    writeFileSync(SIMILARITY_PATH(), FAKE_SIMILARITY);
  }
});
