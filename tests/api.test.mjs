import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let createApp;

before(async () => {
  // Build a throwaway career-ops project root so api tests don't depend on
  // the user's real cv.md / portals.yml or CI's lack of a parent project.
  const dir = mkdtempSync(resolve(tmpdir(), 'api-test-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: "Customized Name"\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'),
    '# Oferta evaluation mode\n\n' +
    'Read cv.md and config/profile.yml. Evaluate the offer across\n' +
    'A-G blocks: Role Summary, CV Match, Risks, Compensation,\n' +
    'Application Strategy, Verdict, Posting Legitimacy.\n');
  process.env.CAREER_OPS_ROOT = dir;
  ({ createApp } = await import('../server/index.mjs'));
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((resolve) => server.close(resolve));
});

async function get(path) {
  const res = await fetch(baseUrl + path);
  const text = await res.text();
  const ct = res.headers.get('content-type') || '';
  let body = null;
  if (text && ct.includes('application/json')) {
    try { body = JSON.parse(text); } catch { body = null; }
  }
  return { status: res.status, body, raw: text, ct };
}

async function post(path, body) {
  const res = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

// ───────────────────────── smoke: each endpoint responds ─────────────────────────

test('GET /api/health → 200 with checks[]', async () => {
  const { status, body } = await get('/api/health');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.checks));
  assert.ok(body.checks.length > 5);
  assert.ok('version' in body);
  // every check has the required flag (true|false)
  assert.ok(body.checks.every((c) => typeof c.required === 'boolean'));
});

test('GET /api/health: version comes from web-ui package.json (not parent VERSION)', async () => {
  // Footer shows "v" + body.version — must match what users installed,
  // i.e. web-ui's own package.json. The parent's VERSION file (if any)
  // is exposed separately as parentVersion.
  const { body } = await get('/api/health');
  assert.match(body.version, /^\d+\.\d+\.\d+/, `expected SemVer-ish, got "${body.version}"`);
  // 1.6.0 was the parent's stale VERSION; we should not display that.
  assert.notEqual(body.version, '1.6.0', 'web-ui version is being read from parent VERSION');
});

test('GET /api/health: ok=true even when only optional checks fail', async () => {
  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const { body } = await get('/api/health');
    // GEMINI_API_KEY is OPTIONAL → must not flip overall ok flag
    const geminiCheck = body.checks.find((c) => c.name === 'GEMINI_API_KEY');
    assert.equal(geminiCheck.required, false);
    assert.equal(geminiCheck.ok, false);
    assert.equal(body.ok, true, 'ok should be true since only optional check failed');
    assert.ok(body.warnings >= 1);
  } finally {
    if (prevKey) process.env.GEMINI_API_KEY = prevKey;
  }
});

test('GET /api/health: every headless live-eval provider has an optional check row (v1.58.8)', async () => {
  // GEMINI_API_KEY and ANTHROPIC_API_KEY were already surfaced; user
  // request — extend the same "set / unset (manual mode)" pattern to
  // OPENAI_API_KEY, QWEN_API_KEY and OPENROUTER_API_KEY so the Health
  // page reports the real state of every provider that
  // /api/status/providers can route to.
  const keys = ['OPENAI_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_API_KEY'];
  const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  try {
    const { body } = await get('/api/health');
    for (const k of keys) {
      const row = body.checks.find((c) => c.name === k);
      assert.ok(row, `missing /api/health row for ${k}`);
      assert.equal(row.required, false, `${k} must be OPTIONAL`);
      assert.equal(row.ok, false, `${k} unset must report ok=false`);
      assert.match(row.value, /unset \(manual mode\)/,
        `${k} unset value must match the GEMINI 'unset (manual mode)' wording`);
    }
    assert.equal(body.ok, true,
      'optional provider keys must not flip overall ok');
  } finally {
    for (const k of keys) if (prev[k] !== undefined) process.env[k] = prev[k];
  }
});

test('GET /api/dashboard → 200 with counts', async () => {
  const { status, body } = await get('/api/dashboard');
  assert.equal(status, 200);
  assert.ok(body.counts);
  assert.equal(typeof body.counts.applications, 'number');
  assert.equal(typeof body.counts.pipeline, 'number');
  assert.equal(typeof body.counts.reports, 'number');
});

test('GET /api/tracker → 200 with rows[]', async () => {
  const { status, body } = await get('/api/tracker');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.rows));
});

test('GET /api/pipeline → 200 with urls[]', async () => {
  const { status, body } = await get('/api/pipeline');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.urls));
});

test('GET /api/reports → 200 with reports[]', async () => {
  const { status, body } = await get('/api/reports');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.reports));
});

test('GET /api/portals → 200 with portals data', async () => {
  const { status, body } = await get('/api/portals');
  assert.equal(status, 200);
  assert.ok('portals' in body);
});

test('GET /api/profile → 200', async () => {
  const { status, body } = await get('/api/profile');
  assert.equal(status, 200);
  assert.ok('profile' in body);
});

test('GET /api/cv → 200 with markdown', async () => {
  const { status, body } = await get('/api/cv');
  assert.equal(status, 200);
  assert.equal(typeof body.markdown, 'string');
});

test('GET /api/modes → 200 with modes[]', async () => {
  const { status, body } = await get('/api/modes');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.modes));
  assert.ok(body.modes.includes('oferta'));
});

test('GET /api/modes/oferta → text/plain content', async () => {
  const { status, raw, ct } = await get('/api/modes/oferta');
  assert.equal(status, 200);
  assert.match(ct || '', /text\/plain/);
  assert.ok(raw.length > 100);
});

test('GET /api/modes/.. → blocked path traversal', async () => {
  const { status } = await get('/api/modes/' + encodeURIComponent('../../etc/passwd'));
  // sanitizer strips → becomes "etcpasswd" → 404, never reaches /etc/passwd
  assert.equal(status, 404);
});

test('GET /api/* unknown → 404', async () => {
  const { status } = await get('/api/nonexistent');
  assert.equal(status, 404);
});

// ───────────────────────── pipeline POST/DELETE ─────────────────────────

test('POST /api/pipeline rejects missing url', async () => {
  const { status, body } = await post('/api/pipeline', {});
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('POST /api/pipeline + DELETE round-trip', async () => {
  const url = 'https://test-' + Date.now() + '.example.com/job/1';
  const add = await post('/api/pipeline', { url });
  assert.equal(add.status, 200);
  assert.ok(add.body.urls.includes(url));

  const list = await get('/api/pipeline');
  assert.ok(list.body.urls.includes(url));

  const res = await fetch(baseUrl + '/api/pipeline?url=' + encodeURIComponent(url), { method: 'DELETE' });
  assert.equal(res.status, 200);

  const after = await get('/api/pipeline');
  assert.ok(!after.body.urls.includes(url));
});

// ───────────────────────── evaluate fallback (no Gemini) ─────────────────────────

test('POST /api/evaluate without GEMINI_API_KEY → manual prompt', async () => {
  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const r = await post('/api/evaluate', {
      jd: 'About the role: looking for a Senior Backend Engineer with PHP and Go experience. Responsibilities include building services and reviewing code.',
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.mode, 'manual');
    assert.ok(r.body.prompt.includes('cv.md'));
  } finally {
    if (prevKey) process.env.GEMINI_API_KEY = prevKey;
  }
});

test('POST /api/evaluate rejects short JD', async () => {
  const r = await post('/api/evaluate', { jd: 'too short' });
  assert.equal(r.status, 400);
});

// ───────────────────────── deep / apply prompt builders ─────────────────────────

test('POST /api/deep returns prompt referencing company', async () => {
  const r = await post('/api/deep', { company: 'Wheely', role: 'Senior Backend' });
  assert.equal(r.status, 200);
  assert.ok(r.body.prompt.includes('Wheely'));
  assert.ok(r.body.prompt.includes('interview-prep/'));
});

test('POST /api/deep rejects missing company', async () => {
  const r = await post('/api/deep', {});
  assert.equal(r.status, 400);
});

test('POST /api/apply-helper returns checklist', async () => {
  const r = await post('/api/apply-helper', { url: 'https://x.com/1' });
  assert.equal(r.status, 200);
  assert.ok(r.body.checklist.includes('NEVER auto-submit'));
});

// ───────────────────────── static SPA ─────────────────────────

test('GET / serves SPA shell', async () => {
  const res = await fetch(baseUrl + '/');
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /career-ops/);
  assert.match(html, /<aside class="sidebar"/);
});

test('GET /unknown → SPA fallback (200 html)', async () => {
  const res = await fetch(baseUrl + '/random-route');
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /career-ops/);
});
