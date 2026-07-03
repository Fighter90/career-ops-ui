/**
 * Target-Roles stats routes (v1.86.0) — POST /api/stats/snapshot +
 * GET /api/stats/trend, plus the pure helpers (toCompactSnapshot).
 *
 * CI-isolated: boots createApp() against a mktemp CAREER_OPS_ROOT (paths
 * carriers imported dynamically AFTER the env is set — the eager-import leak
 * lesson from v1.69.2). Snapshots land in <root>/data/role-stats.jsonl.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let statsPath;
let toCompactSnapshot;

before(async () => {
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'stats-'));
  mkdirSync(resolve(projectRoot, 'config'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'data'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'modes'), { recursive: true });
  writeFileSync(resolve(projectRoot, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(projectRoot, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(projectRoot, 'portals.yml'), 'tracked_companies: []\n');
  process.env.CAREER_OPS_ROOT = projectRoot;
  statsPath = resolve(projectRoot, 'data', 'role-stats.jsonl');
  ({ toCompactSnapshot } = await import('../server/lib/routes/stats.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); });
  });
});

beforeEach(() => { if (existsSync(statsPath)) rmSync(statsPath); });
after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

const postJson = (path, body) => fetch(`${baseUrl}${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const getJson = async (path) => (await fetch(`${baseUrl}${path}`)).json();

const SAMPLE = {
  totalJobs: 10, matchedJobs: 4,
  perRole: [
    { role: 'Backend Engineer', total: 3, salary: { medianUsd: 130000, count: 3 } },
    { role: 'Data Scientist', total: 1, salary: { medianUsd: 150000, count: 1 } },
  ],
  byCountry: [{ code: 'de', count: 5 }, { code: 'gb', count: 3 }, { code: 'remote', count: 2 }],
};

test('toCompactSnapshot: sanitizes + bounds the payload', () => {
  const c = toCompactSnapshot({
    totalJobs: 'x', matchedJobs: 4,
    perRole: [{ role: 'A'.repeat(200), total: 'nope', salary: { medianUsd: 99 } }],
    byCountry: [{ code: 'deutschland-long', count: 2 }],
    extra: 'ignored',
  });
  assert.equal(c.totalJobs, 0);            // non-number → 0
  assert.equal(c.matchedJobs, 4);
  assert.equal(c.perRole[0].role.length, 120); // role truncated
  assert.equal(c.perRole[0].total, 0);     // non-number → 0
  assert.equal(c.perRole[0].medianUsd, 99);
  assert.equal(c.byCountry[0].code.length, 8);  // code truncated
  assert.equal(c.extra, undefined);        // unknown keys dropped
});

test('POST /api/stats/snapshot persists a server-stamped row', async () => {
  const res = await postJson('/api/stats/snapshot', SAMPLE);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.match(body.ts, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(existsSync(statsPath), 'role-stats.jsonl created');
});

test('GET /api/stats/trend returns accumulated snapshots (newest appended last)', async () => {
  await postJson('/api/stats/snapshot', SAMPLE);
  await postJson('/api/stats/snapshot', { ...SAMPLE, totalJobs: 12 });
  const { snapshots } = await getJson('/api/stats/trend');
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0].totalJobs, 10);
  assert.equal(snapshots[1].totalJobs, 12);
  assert.equal(snapshots[0].perRole[0].role, 'Backend Engineer');
  assert.equal(snapshots[0].perRole[0].medianUsd, 130000);
  assert.ok(snapshots[0].ts && snapshots[0].byCountry.length === 3);
});

test('GET /api/stats/trend?role= filters to one role series', async () => {
  await postJson('/api/stats/snapshot', SAMPLE);
  const { snapshots } = await getJson('/api/stats/trend?role=' + encodeURIComponent('Backend Engineer'));
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].role.role, 'Backend Engineer');
  assert.equal(snapshots[0].role.total, 3);
  assert.equal(snapshots[0].totalJobs, 10);
});

test('GET /api/stats/trend is empty-safe when no snapshots exist', async () => {
  const { snapshots } = await getJson('/api/stats/trend');
  assert.deepEqual(snapshots, []);
});

test('POST /api/stats/snapshot is rate-limited on a public bind (locks the guard)', async () => {
  const { _resetBuckets } = await import('../server/lib/rate-limit.mjs');
  const origHost = process.env.HOST;
  const origLimit = process.env.LLM_RATE_LIMIT;
  try {
    process.env.HOST = '0.0.0.0';        // isPubliclyExposed() → true
    process.env.LLM_RATE_LIMIT = '2/60s'; // tiny bucket so the 3rd POST trips it
    _resetBuckets();
    const r1 = await postJson('/api/stats/snapshot', SAMPLE);
    const r2 = await postJson('/api/stats/snapshot', SAMPLE);
    const r3 = await postJson('/api/stats/snapshot', SAMPLE);
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal(r3.status, 429, '3rd snapshot over the 2/60s limit must be 429');
    assert.equal((await r3.json()).ok, false);
  } finally {
    if (origHost === undefined) delete process.env.HOST; else process.env.HOST = origHost;
    if (origLimit === undefined) delete process.env.LLM_RATE_LIMIT; else process.env.LLM_RATE_LIMIT = origLimit;
    _resetBuckets();
  }
});
