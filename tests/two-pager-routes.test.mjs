/**
 * Two-pager routes (v1.89.0, Epic 14) — GET/PUT/POST draft + normalizeTwoPager,
 * and the two-pager flowing into bundleProjectContext.
 *
 * CI-isolated: createApp() against a mktemp CAREER_OPS_ROOT; paths carriers
 * imported dynamically AFTER the env is set (the eager-import leak lesson).
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server; let baseUrl; let twoPagerPath;
let normalizeTwoPager; let bundleProjectContext;

before(async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'twopager-'));
  mkdirSync(resolve(root, 'config'), { recursive: true });
  mkdirSync(resolve(root, 'data'), { recursive: true });
  mkdirSync(resolve(root, 'modes'), { recursive: true });
  writeFileSync(resolve(root, 'cv.md'), '# Jane Dev\nSenior Backend Engineer, Go + PostgreSQL.\n');
  writeFileSync(resolve(root, 'config', 'profile.yml'), 'candidate:\n  full_name: Jane\n');
  writeFileSync(resolve(root, 'portals.yml'), 'tracked_companies: []\n');
  process.env.CAREER_OPS_ROOT = root;
  twoPagerPath = resolve(root, 'config', 'two-pager.yml');
  ({ normalizeTwoPager } = await import('../server/lib/routes/two-pager.mjs'));
  ({ bundleProjectContext } = await import('../server/lib/prompts.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
beforeEach(() => { if (existsSync(twoPagerPath)) rmSync(twoPagerPath); });
after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

const put = (b) => fetch(`${baseUrl}/api/two-pager`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const getJson = async (p) => (await fetch(`${baseUrl}${p}`)).json();

test('normalizeTwoPager: bounded, typed, drops junk', () => {
  const c = normalizeTwoPager({
    who_i_am: 'x'.repeat(9000),
    loves: ['remote', 42, '', '  autonomy  ', 'y'.repeat(999)],
    must_haves: 'not-an-array',
    extra: 'ignored',
  });
  assert.equal(c.who_i_am.length, 4000);
  assert.deepEqual(c.loves.slice(0, 2), ['remote', 'autonomy']);
  assert.equal(c.loves[2].length, 400);       // long item capped
  assert.deepEqual(c.must_haves, []);         // non-array → []
  assert.deepEqual(c.deal_breakers, []);
  assert.equal(c.extra, undefined);
  for (const bad of [null, [], 'x', 7]) assert.deepEqual(normalizeTwoPager(bad).loves, []);
});

test('GET /api/two-pager returns the empty shape before any save', async () => {
  const { twoPager } = await getJson('/api/two-pager');
  assert.deepEqual(twoPager, { who_i_am: '', loves: [], must_haves: [], hates: [], deal_breakers: [], non_negotiables: [], target_environment: '' });
});

test('PUT then GET round-trips the two-pager', async () => {
  const body = { who_i_am: 'Backend eng who loves systems.', loves: ['remote', 'ownership'], must_haves: ['at least $120k'], deal_breakers: ['onsite only'], target_environment: 'small product team', non_negotiables: ['remote'], hates: ['bureaucracy'] };
  const r = await put(body);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
  assert.ok(existsSync(twoPagerPath));
  const { twoPager } = await getJson('/api/two-pager');
  assert.deepEqual(twoPager.loves, ['remote', 'ownership']);
  assert.deepEqual(twoPager.deal_breakers, ['onsite only']);
  assert.equal(twoPager.who_i_am, 'Backend eng who loves systems.');
});

test('the saved two-pager is inlined into bundleProjectContext', async () => {
  await put({ loves: ['fully remote'], deal_breakers: ['relocation'] });
  const ctx = bundleProjectContext({});
  assert.match(ctx, /config\/two-pager\.yml/);
  assert.match(ctx, /fully remote/);
  assert.match(ctx, /positive signals/); // the framing label
});

test('POST /api/two-pager/draft returns a Mnookin prompt with candidate materials', async () => {
  const r = await fetch(`${baseUrl}/api/two-pager/draft`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 200);
  const { prompt } = await r.json();
  assert.match(prompt, /Mnookin/);
  assert.match(prompt, /who_i_am/);
  assert.match(prompt, /Jane Dev/);          // cv.md inlined
});

test('POST /api/two-pager/draft threads the UI locale into the prompt (v1.138.0)', async () => {
  const r = await fetch(`${baseUrl}/api/two-pager/draft`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: 'ru' }) });
  assert.equal(r.status, 200);
  const { prompt } = await r.json();
  assert.match(prompt, /Output language/);   // directive prepended
  assert.match(prompt, /Russian/);           // resolved locale name
  assert.match(prompt, /who_i_am/);          // YAML keys stay English (identifiers untouched)
  assert.match(prompt, /Mnookin/);           // base instructions preserved
  // en → no directive
  const en = await fetch(`${baseUrl}/api/two-pager/draft`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: 'en' }) });
  const { prompt: enPrompt } = await en.json();
  assert.doesNotMatch(enPrompt, /Output language/);
});
