/**
 * CAR-40 — bare GET /api/runners must describe the runners surface.
 *
 * The runners router only registers sub-paths (POST /api/run/<action>,
 * GET /api/stream/*, GET /api/output/pdfs), so a bare GET /api/runners
 * fell through to `app.all('/api/*')` and answered the catch-all
 * {"error":"unknown api"} — misleading, because the resource exists and
 * serves real sub-paths. Now it returns a small JSON index derived from
 * the router's own BUFFERED registry, so the two can never drift.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT with cv.md, dynamic import inside
 * before(), ephemeral 127.0.0.1 port, no network (POSTs hit missing
 * parent scripts, which runNodeScript resolves fast with code != 0).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'routes-runners-index-'));
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# placeholder\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), '');
  process.env.CAREER_OPS_ROOT = root;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((r) => server.close(r));
});

test('CAR-40: GET /api/runners returns the buffered action index', async () => {
  const res = await fetch(`${baseUrl}/api/runners`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /application\/json/);
  const { actions } = await res.json();
  assert.ok(Array.isArray(actions), 'actions must be an array');
  const names = actions.map((a) => a.name).sort();
  assert.deepEqual(
    names,
    ['dedup', 'doctor', 'merge', 'normalize', 'reconcile', 'sync-check', 'verify'],
    'index must list every buffered runner action (drift alarm)',
  );
  for (const a of actions) {
    assert.equal(a.method, 'POST', 'buffered actions are POST');
    assert.equal(a.route, `/api/run/${a.name}`);
  }
});

test('CAR-40: every advertised action really answers POST (no phantom index)', async () => {
  const { actions } = await (await fetch(`${baseUrl}/api/runners`)).json();
  assert.ok(actions.length > 0);
  for (const a of actions) {
    // The fixture has no parent scripts; runNodeScript resolves fast with
    // code != 0, proving the route exists and speaks the runner shape.
    const res = await fetch(`${baseUrl}${a.route}`, { method: 'POST' });
    assert.equal(res.status, 200, `${a.route} must exist`);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json();
    assert.equal(typeof body.code, 'number', `${a.route} must answer the runner shape`);
  }
});
