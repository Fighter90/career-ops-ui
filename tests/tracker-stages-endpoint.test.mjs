/**
 * v1.131.0 — GET /api/tracker/stages exposes the canonical funnel (labels in
 * order) + an alias-fold map to the SPA's CRM stage-tab board, sourced from
 * `server/lib/states.mjs` (templates/states.yml, with the built-in fallback)
 * so the client never hardcodes the status whitelist (the v1.128.0 doctrine).
 *
 * CI-isolated: a throw-away CAREER_OPS_ROOT with a known states.yml; every
 * paths.mjs carrier is dynamically imported inside before() AFTER the env is
 * set (the eager-import leak guard — see tests/test-root-isolation.test.mjs).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;

const STATES_YML = `states:
  - id: evaluated
    label: Evaluated
    aliases: [evaluada]
  - id: applied
    label: Applied
    aliases: [aplicado, enviada]
  - id: interview
    label: Interview
    aliases: [entrevista]
  - id: hired
    label: Hired
    aliases: [contratado, accepted]
`;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'tracker-stages-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  mkdirSync(resolve(dir, 'templates'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# x\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'x\n');
  writeFileSync(resolve(dir, 'templates', 'states.yml'), STATES_YML);
  process.env.CAREER_OPS_ROOT = dir;
  // Reset the states cache so this test reads ITS states.yml, not a value a
  // sibling test file may have cached against the real parent.
  const { _resetStatesCache } = await import('../server/lib/states.mjs');
  _resetStatesCache();
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
});

after(async () => {
  delete process.env.CAREER_OPS_ROOT;
  const { _resetStatesCache } = await import('../server/lib/states.mjs');
  _resetStatesCache();
  return new Promise((r) => server.close(r));
});

test('GET /api/tracker/stages returns the canonical labels in file order', async () => {
  const r = await fetch(baseUrl + '/api/tracker/stages');
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(Array.isArray(d.stages), 'stages must be an array');
  assert.deepEqual(d.stages, ['Evaluated', 'Applied', 'Interview', 'Hired']);
});

test('GET /api/tracker/stages folds label, id, and alias (lowercased) to the canonical label', async () => {
  const r = await fetch(baseUrl + '/api/tracker/stages');
  const d = await r.json();
  assert.equal(typeof d.aliases, 'object');
  // label → itself
  assert.equal(d.aliases.applied, 'Applied');
  // alias → canonical
  assert.equal(d.aliases.aplicado, 'Applied');
  assert.equal(d.aliases.enviada, 'Applied');
  assert.equal(d.aliases.entrevista, 'Interview');
  assert.equal(d.aliases.contratado, 'Hired');
  // id → canonical
  assert.equal(d.aliases.evaluated, 'Evaluated');
});

test('GET /api/tracker/stages sends a Cache-Control header (read-only, cacheable)', async () => {
  const r = await fetch(baseUrl + '/api/tracker/stages');
  assert.match(r.headers.get('cache-control') || '', /max-age=\d+/);
});

test('back-compat: GET /api/tracker with no params still returns exactly { rows }', async () => {
  const r = await fetch(baseUrl + '/api/tracker');
  const d = await r.json();
  assert.ok(Array.isArray(d.rows));
  assert.equal(d.stages, undefined, 'the legacy no-param tracker response must stay { rows } only');
  assert.equal(d.funnel, undefined);
});
