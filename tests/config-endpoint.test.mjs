/**
 * GET / POST /api/config — backend for the /#/config page.
 * Reads from + writes to the parent project's .env so career-ops Node
 * scripts and web-ui's dotenv loader pick up the same source.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server, baseUrl, projectRoot;

before(async () => {
  projectRoot = mkdtempSync(resolve(tmpdir(), 'cfg-ep-'));
  mkdirSync(resolve(projectRoot, 'config'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'data'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'modes'), { recursive: true });
  writeFileSync(resolve(projectRoot, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(projectRoot, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(projectRoot, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(projectRoot, 'data', 'applications.md'), '');
  writeFileSync(resolve(projectRoot, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(projectRoot, 'modes', 'oferta.md'), 'oferta\n');
  process.env.CAREER_OPS_ROOT = projectRoot;
  // Pre-clear any env vars the test will exercise so leakage from
  // the host shell doesn't change behaviour.
  for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'HH_USER_AGENT']) {
    delete process.env[k];
  }
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
});

beforeEach(() => {
  // Each test gets a fresh .env so writes don't bleed across cases.
  const envPath = resolve(projectRoot, '.env');
  if (existsSync(envPath)) rmSync(envPath);
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((r) => server.close(r));
});

async function get(path) {
  const res = await fetch(baseUrl + path);
  return { status: res.status, body: await res.json() };
}
async function postJson(path, body) {
  const res = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: res.status < 500 ? await res.json() : null };
}

// ─────────────── GET ───────────────

test('GET /api/config returns the known keys + envFile path', async () => {
  const r = await get('/api/config');
  assert.equal(r.status, 200);
  assert.ok(r.body.envFile.endsWith('.env'));
  for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'PORT', 'HOST']) {
    assert.ok(k in r.body.values, `missing ${k} in values`);
  }
  // v1.19.0: HH_USER_AGENT removed from UI-exposed keys.
  assert.ok(!('HH_USER_AGENT' in r.body.values), 'HH_USER_AGENT should be UI-hidden post v1.19');
});

test('GET /api/config: secret values are masked, never echoed in plain text', async () => {
  const envPath = resolve(projectRoot, '.env');
  writeFileSync(envPath, 'ANTHROPIC_API_KEY=sk-ant-api03-' + 'X'.repeat(40) + '\n');
  const r = await get('/api/config');
  // Either masked (with …) or null — never the raw value.
  assert.ok(!r.body.values.ANTHROPIC_API_KEY.includes('XXXXXXXXXX'),
    `secret leaked: ${r.body.values.ANTHROPIC_API_KEY}`);
});

test('GET /api/config: non-secret values are returned in clear text', async () => {
  writeFileSync(resolve(projectRoot, '.env'),
    'ANTHROPIC_MODEL=claude-opus-4-7\nHOST=0.0.0.0\n');
  const r = await get('/api/config');
  assert.equal(r.body.values.ANTHROPIC_MODEL, 'claude-opus-4-7');
  assert.equal(r.body.values.HOST, '0.0.0.0');
});

// ─────────────── POST ───────────────

test('POST /api/config writes to parent .env', async () => {
  // v1.19.0: HH_USER_AGENT no longer in KNOWN_KEYS, so PUT body uses
  // GEMINI_MODEL as a second non-secret known key for multi-write
  // verification.
  const r = await postJson('/api/config', {
    ANTHROPIC_MODEL: 'claude-haiku-4-5',
    GEMINI_MODEL: 'gemini-2.0-flash',
  });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.written.sort(), ['ANTHROPIC_MODEL', 'GEMINI_MODEL']);
  const text = readFileSync(resolve(projectRoot, '.env'), 'utf8');
  assert.match(text, /ANTHROPIC_MODEL=claude-haiku-4-5/);
  assert.match(text, /GEMINI_MODEL=gemini-2.0-flash/);
});

test('POST /api/config applies values to running process.env', async () => {
  await postJson('/api/config', { ANTHROPIC_MODEL: 'claude-opus-4-7' });
  assert.equal(process.env.ANTHROPIC_MODEL, 'claude-opus-4-7');
});

test('POST /api/config: empty value unsets the key on disk + in process.env', async () => {
  // First set
  await postJson('/api/config', { ANTHROPIC_MODEL: 'will-be-deleted' });
  assert.equal(process.env.ANTHROPIC_MODEL, 'will-be-deleted');
  // Then delete via empty string
  await postJson('/api/config', { ANTHROPIC_MODEL: '' });
  assert.equal(process.env.ANTHROPIC_MODEL, undefined);
  const text = readFileSync(resolve(projectRoot, '.env'), 'utf8');
  assert.ok(!/^ANTHROPIC_MODEL=/m.test(text), 'key still in .env after delete');
});

test('POST /api/config rejects unknown keys with 400', async () => {
  const r = await postJson('/api/config', { UNKNOWN_KEY: 'x' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /validation/);
});

test('POST /api/config rejects malformed ANTHROPIC_API_KEY', async () => {
  const r = await postJson('/api/config', { ANTHROPIC_API_KEY: 'not-a-key' });
  assert.equal(r.status, 400);
});

// v1.57.2 — the SPA's api.js auto-attaches `lang` to every JSON POST.
// Before the fix the config route 400'd EVERY browser Save with
// "validation failed — lang: not a known config key" (curl repros
// never sent lang, so it stayed hidden). This reproduces the browser
// body shape exactly.
test('POST /api/config tolerates the SPA-injected `lang` field (browser parity)', async () => {
  const r = await postJson('/api/config', {
    LLM_PROVIDER: 'openrouter', PORT: '4317', HOST: '127.0.0.1', lang: 'en',
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.written.includes('PORT'));
  // `lang` must never be written to the parent .env
  const text = readFileSync(resolve(projectRoot, '.env'), 'utf8');
  assert.ok(!/^lang=/m.test(text), '`lang` must not leak into .env');
});

test('POST /api/config still rejects a genuine unknown key even with lang present', async () => {
  const r = await postJson('/api/config', { lang: 'en', EVIL_INJECT: 'x' });
  assert.equal(r.status, 400, 'attacker-injection guard must stay intact');
  assert.match(r.body.details.join(' '), /EVIL_INJECT/);
});

test('POST /api/config: known keys are filtered before write (no attacker injection)', async () => {
  // Even if validation accepted UNKNOWN, the server should never
  // write keys outside KNOWN_KEYS into the .env. validateConfig
  // already rejects them — this test is the belt-and-suspenders
  // assertion that nothing slips through.
  await postJson('/api/config', { ANTHROPIC_MODEL: 'claude-sonnet-4-6' });
  const text = readFileSync(resolve(projectRoot, '.env'), 'utf8');
  assert.ok(!/UNKNOWN/i.test(text));
});

// ───────── v1.57.0 — the "validation failed" save flow ─────────
// End-to-end proof that the reported bug is fixed AND that saving
// actually persists a usable key (the form's whole job).

test('POST /api/config: Anthropic key pasted with spaces + trailing newline saves (200) and is stored TRIMMED', async () => {
  const realKey = 'sk-ant-api03-' + 'A1b2C3d4'.repeat(12); // 96-char base64url-ish tail
  const r = await postJson('/api/config', { ANTHROPIC_API_KEY: `  ${realKey}\n` });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.written.includes('ANTHROPIC_API_KEY'));
  const env = parseEnvFile();
  assert.equal(env.ANTHROPIC_API_KEY, realKey, 'stored value is trimmed — no spaces, no newline, no quoting');
  // round-trips masked, never echoed in clear
  const g = await get('/api/config');
  assert.ok(g.body.values.ANTHROPIC_API_KEY && g.body.values.ANTHROPIC_API_KEY.includes('…'));
  assert.ok(!g.body.values.ANTHROPIC_API_KEY.includes(realKey));
});

test('POST /api/config: full OpenRouter triple (provider + key + model) persists; key masked, model clear', async () => {
  const orKey = 'sk-or-v1-' + 'Zz9'.repeat(20);
  const r = await postJson('/api/config', {
    LLM_PROVIDER: 'openrouter',
    OPENROUTER_API_KEY: `${orKey}\r\n`,
    OPENROUTER_MODEL: ' anthropic/claude-sonnet-4 ',
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  for (const k of ['LLM_PROVIDER', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL']) {
    assert.ok(r.body.written.includes(k), `expected ${k} written`);
  }
  const env = parseEnvFile();
  assert.equal(env.LLM_PROVIDER, 'openrouter');
  assert.equal(env.OPENROUTER_API_KEY, orKey, 'CRLF-suffixed key stored trimmed');
  assert.equal(env.OPENROUTER_MODEL, 'anthropic/claude-sonnet-4', 'model trimmed');
  const g = await get('/api/config');
  assert.ok(g.body.values.OPENROUTER_API_KEY.includes('…'), 'OPENROUTER_API_KEY masked on read');
  assert.equal(g.body.values.OPENROUTER_MODEL, 'anthropic/claude-sonnet-4', 'model id is not a secret');
  assert.equal(g.body.values.LLM_PROVIDER, 'openrouter');
});

test('POST /api/config: invalid Anthropic key → 400 with a details array naming the format', async () => {
  const r = await postJson('/api/config', { ANTHROPIC_API_KEY: 'sk-proj-this-is-an-openai-key-not-anthropic' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /validation failed/);
  assert.ok(Array.isArray(r.body.details));
  assert.match(r.body.details.join(' '), /sk-ant/);
});

test('POST /api/config: whitespace-only value is treated as unset (deletes the key)', async () => {
  const orKey = 'sk-or-v1-' + 'Q'.repeat(40);
  await postJson('/api/config', { OPENROUTER_API_KEY: orKey });
  assert.equal(parseEnvFile().OPENROUTER_API_KEY, orKey);
  const r = await postJson('/api/config', { OPENROUTER_API_KEY: '   \n  ' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(parseEnvFile().OPENROUTER_API_KEY, undefined, 'whitespace-only unsets the key');
});

test('POST /api/config: saving a non-secret does NOT wipe an untouched secret (SPA dirty-only contract)', async () => {
  const orKey = 'sk-or-v1-' + 'k'.repeat(44);
  await postJson('/api/config', { OPENROUTER_API_KEY: orKey });
  // SPA only sends secrets the user touched; here we save just the model.
  await postJson('/api/config', { OPENROUTER_MODEL: 'openai/gpt-5' });
  const env = parseEnvFile();
  assert.equal(env.OPENROUTER_API_KEY, orKey, 'untouched secret survives a partial save');
  assert.equal(env.OPENROUTER_MODEL, 'openai/gpt-5');
});

function parseEnvFile() {
  const out = {};
  const text = readFileSync(resolve(projectRoot, '.env'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1).replace(/\\"/g, '"');
    out[m[1]] = v;
  }
  return out;
}

/**
 * v1.233.2 — the behavioural half of what the old source-grep guard stood for.
 * A request cannot steer the `process.env` write, and cannot pollute
 * `Object.prototype`, whatever key names it sends.
 */
test('POST /api/config cannot pollute the prototype chain or write an unlisted env var', async () => {
  const before = { ...process.env };
  const canary = 'CANARY_' + Date.now();

  // Raw JSON strings, not object literals: `{ __proto__: … }` in source sets the
  // prototype instead of creating an own property, so JSON.stringify would send
  // `{}` and the test would prove nothing. On the wire it must be a real key.
  const raws = [
    '{"__proto__":{"polluted":"yes"}}',
    '{"constructor":{"prototype":{"polluted":"yes"}}}',
    '{"prototype":"x"}',
    `{"${canary}":"x"}`,
  ];
  for (const raw of raws) {
    const res = await fetch(baseUrl + '/api/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw,
    });
    const json = res.status < 500 ? await res.json() : null;
    // Every one of these names is outside KNOWN_KEYS, so the validator refuses
    // the request outright — nothing reaches the writer or process.env.
    assert.equal(res.status, 400, `${raw} should be refused: ${JSON.stringify(json)}`);
  }

  assert.equal({}.polluted, undefined, 'Object.prototype must not have gained a property');
  assert.equal(process.env[canary], undefined, 'an unlisted name must never reach process.env');
  // Nothing in the allowlist moved either.
  for (const k of Object.keys(before)) {
    assert.equal(process.env[k], before[k], `${k} changed during a rejected request`);
  }
});
