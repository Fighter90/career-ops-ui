/**
 * v1.57.1 — "validation failed" was opaque: the server returns
 * `{ error, details: ["FIELD: reason", …] }` but the SPA only ever
 * showed the top line, so users couldn't tell WHICH field was wrong.
 *
 * Two halves, both regression-guarded here:
 *   1. api.js folds `data.details` into the thrown Error message
 *      SITE-WIDE (every `catch (e) { UI.toast(e.message) }` benefits).
 *   2. config.js prefills PORT=4317 / HOST=127.0.0.1 so the fields show
 *      the values the server actually uses instead of looking unset.
 *   3. Server contract: every validation error is a field-prefixed
 *      string in `details` (what api.js relies on).
 *
 * api.js / config.js are browser-only → asserted statically (the
 * project's router.test.mjs / openai-model-selector.mjs pattern). The
 * server contract is exercised against a real in-process app.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __d = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(resolve(__d, '..', ...p), 'utf8');

// ── 1. api.js surfaces per-field details site-wide ──

test('api.js folds data.details into the thrown error message', () => {
  const src = read('public', 'js', 'api.js');
  assert.match(src, /Array\.isArray\(data\.details\)/, 'must read data.details');
  assert.match(src, /details\.join\(/, 'must join the per-field reasons into the message');
  assert.match(src, /msg \+=/, 'must append details to the error message');
  assert.match(src, /err\.details =/, 'must also expose err.details for inline rendering');
});

test('api.js adds WHERE/WHY context to every API error (method+path+status, raw fallback)', () => {
  const src = read('public', 'js', 'api.js');
  // WHERE: the failing request + HTTP status appended to every error.
  assert.match(src, /\$\{method\} \$\{path\} · HTTP \$\{res\.status\}/,
    'every API error must name the request + status');
  // WHY fallback: non-JSON error body snippet when there are no details.
  assert.match(src, /data\.raw/, 'must fall back to the raw error body');
  // network errors also carry the verb+path so "save failed" is located.
  // v1.58.0 — the human sentence is now localized via I18n (api.netError
  // / api.netHint); the diagnostic (METHOD path) token stays literal.
  assert.match(src, /api\.netError[\s\S]*\$\{method\} \$\{path\}[\s\S]*api\.netHint/,
    'network errors must be localized and still include the request context');
});

test('UI.toast keeps error messages on screen long enough to read', () => {
  const src = read('public', 'js', 'api.js');
  assert.match(src, /type === 'error'/, 'toast must special-case error dwell time');
  assert.match(src, /Math\.max\(9000/, 'error toasts get a longer readable floor');
});

// ── 2. config.js PORT/HOST defaults ──

test('config.js: PORT defaults to 4317, HOST defaults to 127.0.0.1', () => {
  // v1.155.0 (P-15 split) — the PORT/HOST field specs moved to
  // config/field-specs.js; the fieldRow renderer that USES the default stays
  // in config.js. Assert against both.
  const src = read('public', 'js', 'views', 'config', 'field-specs.js')
    + '\n' + read('public', 'js', 'views', 'config.js');
  const port = src.match(/key: 'PORT'[\s\S]{0,160}?label: 'PORT'/);
  assert.ok(port && /defaultValue: '4317'/.test(port[0]), "PORT field missing defaultValue '4317'");
  const host = src.match(/key: 'HOST'[\s\S]{0,160}?label: 'HOST'/);
  assert.ok(host && /defaultValue: '127\.0\.0\.1'/.test(host[0]), "HOST field missing defaultValue '127.0.0.1'");
  // text inputs must actually USE the default when the value is unset
  assert.match(src, /input\.value = value \|\| spec\.defaultValue \|\| ''/,
    'non-secret inputs must prefill spec.defaultValue when unset');
});

// ── 3. server contract: details are field-prefixed strings ──

let server, baseUrl, root;
const savedRoot = process.env.CAREER_OPS_ROOT;

before(async () => {
  root = mkdtempSync(resolve(tmpdir(), 'cfg-detail-'));
  mkdirSync(resolve(root, 'data'), { recursive: true });
  mkdirSync(resolve(root, 'modes'), { recursive: true });
  writeFileSync(resolve(root, 'cv.md'), '# cv\n');
  writeFileSync(resolve(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(root, 'data', 'applications.md'), '');
  writeFileSync(resolve(root, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(root, 'modes', 'oferta.md'), 'oferta\n');
  writeFileSync(resolve(root, '.env'), 'LLM_PROVIDER=manual\n');
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
  server?.close();
  if (savedRoot === undefined) delete process.env.CAREER_OPS_ROOT;
  else process.env.CAREER_OPS_ROOT = savedRoot;
  try { rmSync(root, { recursive: true, force: true }); } catch {}
});

async function post(body) {
  const res = await fetch(`${baseUrl}/api/config`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('400 details are field-prefixed strings — one per bad field', async () => {
  const r = await post({ PORT: 'abc', HOST: 'bad host!' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'validation failed');
  assert.ok(Array.isArray(r.body.details));
  assert.equal(r.body.details.length, 2, 'one detail per offending field');
  assert.ok(r.body.details.some((d) => d.startsWith('PORT:')), 'PORT detail present + prefixed');
  assert.ok(r.body.details.some((d) => d.startsWith('HOST:')), 'HOST detail present + prefixed');
  // The exact string a user will now see in the toast (api.js join):
  const userMsg = r.body.error + ' — ' + r.body.details.join(' · ');
  assert.match(userMsg, /PORT: must be 1-65535/);
  assert.match(userMsg, /HOST: invalid hostname\/ip/);
});

test('valid PORT 4317 + HOST 127.0.0.1 (the new defaults) pass validation', async () => {
  const r = await post({ PORT: '4317', HOST: '127.0.0.1' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.written.includes('PORT'));
  assert.ok(r.body.written.includes('HOST'));
});

test('wrong-provider key in the Anthropic field → a single ANTHROPIC_API_KEY-prefixed detail', async () => {
  const r = await post({ ANTHROPIC_API_KEY: 'sk-proj-an-openai-key-pasted-into-the-anthropic-box' });
  assert.equal(r.status, 400);
  assert.equal(r.body.details.length, 1);
  assert.match(r.body.details[0], /^ANTHROPIC_API_KEY: /);
});

test('input-error messages are descriptive (what + how to fix)', async () => {
  const r = await post({ PORT: 'abc', HOST: 'bad host!', ANTHROPIC_API_KEY: 'totally-wrong' });
  assert.equal(r.status, 400);
  const j = r.body.details.join(' || ');
  assert.match(j, /PORT: must be 1-65535 — a whole number, digits only \(the default is 4317\); you entered "abc"/);
  assert.match(j, /HOST: invalid hostname\/ip — only letters, digits and the characters \. : - _/);
  assert.match(j, /HOST.*you entered "bad host!"/);
  assert.match(j, /ANTHROPIC_API_KEY: expected sk-ant-… format[\s\S]*console\.anthropic\.com/);
});

test('SECRET key errors NEVER echo the entered value (no leak in details)', async () => {
  const secret = 'sk-definitely-not-anthropic-SUPERSECRET-1234567890';
  const r = await post({ ANTHROPIC_API_KEY: secret });
  assert.equal(r.status, 400);
  const joined = r.body.details.join(' ');
  assert.ok(!joined.includes(secret), 'the raw secret must not appear in the error');
  assert.ok(!joined.includes('SUPERSECRET'), 'no secret substring leaks');
  assert.match(joined, /the \d+-character value you entered/, 'describes shape, not content');
});

test('PORT in range 1-65535 enforced (99999 with 5 digits is now correctly rejected)', async () => {
  const r = await post({ PORT: '99999' });
  assert.equal(r.status, 400);
  assert.match(r.body.details.join(' '), /PORT: must be 1-65535 — 99999 is outside the valid TCP port range/);
});
