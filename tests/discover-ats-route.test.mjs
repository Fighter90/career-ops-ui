/**
 * POST /api/portals/discover (read-only preview) + POST /api/portals/track
 * (explicit write) — in-process route tests. CI-isolated: the SSRF-safe safeGet
 * is stubbed via `_setSafeGet` (no network), and the parent project is a mktemp
 * CAREER_OPS_ROOT with a fixture portals.yml (no live parent). Never binds 4317.
 *
 * NOTE (paths-once): CAREER_OPS_ROOT is set BEFORE the first dynamic import of
 * server/index.mjs so PATHS pins the fixture, not the user's real parent.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server; let baseUrl; let root;
let _setSafeGet;

const PORTALS = `tracked_companies:
  - name: Existing
    careers_url: https://jobs.lever.co/existing
    enabled: true

title_filter:
  positive: [engineer]
`;

const GH_JOBS = JSON.stringify({ jobs: [{ id: 1, title: 'Engineer', location: { name: 'London' } }] });

before(async () => {
  root = mkdtempSync(resolve(tmpdir(), 'discover-ats-'));
  writeFileSync(resolve(root, 'cv.md'), '# Dev\n');
  writeFileSync(resolve(root, 'portals.yml'), PORTALS);
  process.env.CAREER_OPS_ROOT = root;
  ({ _setSafeGet } = await import('../server/lib/discover-ats.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
after(() => {
  _setSafeGet(null);
  delete process.env.CAREER_OPS_ROOT;
  try { rmSync(root, { recursive: true, force: true }); } catch { /* noop */ }
  return new Promise((r) => server.close(r));
});
beforeEach(() => {
  // Default stub: Greenhouse board with 1 job; every other ATS host 404s.
  _setSafeGet(async (url) => {
    const u = new URL(url);
    if (u.hostname === 'boards-api.greenhouse.io') return { status: 200, text: GH_JOBS, finalUrl: url };
    return { status: 404, text: '', finalUrl: url };
  });
});

function post(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── preview ─────────────────────────────────────────────────────────────
test('POST /api/portals/discover resolves a company to its Greenhouse board (read-only)', async () => {
  const r = await post('/api/portals/discover', { company: 'Adyen' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.company, 'Adyen');
  assert.equal(j.results.length, 1);
  assert.equal(j.results[0].vendor, 'greenhouse');
  assert.equal(j.results[0].careers_url, 'https://job-boards.greenhouse.io/adyen');
  assert.ok(j.results[0].jobCount >= 1);
  // Read-only: portals.yml must be untouched by a discover.
  assert.ok(!readFileSync(resolve(root, 'portals.yml'), 'utf8').includes('Adyen'));
});

test('POST /api/portals/discover: missing/empty company → 400', async () => {
  assert.equal((await post('/api/portals/discover', {})).status, 400);
  assert.equal((await post('/api/portals/discover', { company: '   ' })).status, 400);
});

test('POST /api/portals/discover: no board found → 200 with empty results', async () => {
  _setSafeGet(async (url) => ({ status: 404, text: '', finalUrl: url }));
  const r = await post('/api/portals/discover', { company: 'Nonesuchco' });
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).results, []);
});

// ── write ───────────────────────────────────────────────────────────────
test('POST /api/portals/track appends a discovered board to portals.yml', async () => {
  const r = await post('/api/portals/track', {
    name: 'Adyen', careers_url: 'https://job-boards.greenhouse.io/adyen', provider: 'greenhouse',
  });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.added, true);

  const yml = readFileSync(resolve(root, 'portals.yml'), 'utf8');
  assert.ok(yml.includes('name: Adyen'));
  assert.ok(yml.includes('careers_url: https://job-boards.greenhouse.io/adyen'));
  // Spliced INSIDE the tracked_companies block, before the next top-level key.
  assert.ok(yml.indexOf('name: Adyen') < yml.indexOf('title_filter:'));

  // GET /api/portals now surfaces both companies.
  const list = await (await fetch(`${baseUrl}/api/portals`)).json();
  const names = list.portals.tracked_companies.map((c) => c.name);
  assert.ok(names.includes('Adyen') && names.includes('Existing'));
});

test('POST /api/portals/track: adding the same board again is idempotent (duplicate)', async () => {
  const body = { name: 'Adyen', careers_url: 'https://job-boards.greenhouse.io/adyen', provider: 'greenhouse' };
  await post('/api/portals/track', body); // (may already be present from the prior test)
  const r = await post('/api/portals/track', body);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.added, false);
  assert.equal(j.duplicate, true);
  // Exactly one Adyen entry, never doubled.
  const yml = readFileSync(resolve(root, 'portals.yml'), 'utf8');
  assert.equal((yml.match(/name: Adyen/g) || []).length, 1);
});

test('POST /api/portals/track: careers_url on an unknown host → 400 (no write)', async () => {
  const before = readFileSync(resolve(root, 'portals.yml'), 'utf8');
  const r = await post('/api/portals/track', { name: 'Evil', careers_url: 'https://evil.example.com/board' });
  assert.equal(r.status, 400);
  assert.equal(readFileSync(resolve(root, 'portals.yml'), 'utf8'), before, 'must not write on rejection');
});

test('POST /api/portals/track: a newline in a field (YAML-injection attempt) → 400 (no write)', async () => {
  const before = readFileSync(resolve(root, 'portals.yml'), 'utf8');
  // A newline in `provider` would splice an arbitrary EXTRA key that still PARSES
  // as valid YAML — sailing straight past the `yaml.load` re-parse guard. The
  // control-char guard must reject it before any write.
  const r = await post('/api/portals/track', {
    name: 'Inject',
    careers_url: 'https://jobs.lever.co/inject',
    provider: 'lever\n    evil_injected: pwned',
  });
  assert.equal(r.status, 400);
  const after = readFileSync(resolve(root, 'portals.yml'), 'utf8');
  assert.equal(after, before, 'must not write when a field carries control characters');
  assert.ok(!after.includes('evil_injected'), 'no injected key may reach portals.yml');
});

test('POST /api/portals/track: a newline in careers_url → 400 (no write)', async () => {
  const before = readFileSync(resolve(root, 'portals.yml'), 'utf8');
  const r = await post('/api/portals/track', {
    name: 'Inject2',
    careers_url: 'https://job-boards.greenhouse.io/x\n    evil2: pwned',
  });
  assert.equal(r.status, 400);
  assert.equal(readFileSync(resolve(root, 'portals.yml'), 'utf8'), before, 'must not write on a control-char careers_url');
});

test('POST /api/portals/track: missing name → 400', async () => {
  const r = await post('/api/portals/track', { careers_url: 'https://job-boards.greenhouse.io/foo' });
  assert.equal(r.status, 400);
});
