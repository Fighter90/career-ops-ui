/**
 * FULL-M1 (CAR-164, cluster 2) — the PUT save routes write shared files with
 * a bare `writeFileSync`: a plain write opens the target with 'w'
 * (truncating it) and only then writes, so a crash mid-save leaves a
 * TRUNCATED cv.md / profile.yml / modes/_profile.md behind — the files every
 * generator, the LLM prompt bundler and the parent CLI read. Every shared-file
 * PUT must hold `withFileLock` and land its write through `atomicWrite`
 * (temp-then-rename), the contract portals.mjs/tracker.mjs already follow.
 *
 * Behavioral interleaving is not observable for these handlers — they are
 * synchronous inside one process, so two PUTs can never overlap on the event
 * loop. The regression this gate pins is the WRITE MECHANISM: backsliding to
 * a bare `writeFileSync(target)` (or dropping the lock) is a source change,
 * so — the same trade-off as tests/full-r1-atomic-write.test.mjs — the
 * call-site contract is enforced statically, with behavioral round-trip
 * canaries proving the routes still work through the lock.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let app;
let server;
let baseUrl;
let root;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'm1-put-'));
  writeFileSync(join(root, 'cv.md'), '# Jane Dev\nSenior Backend Engineer.\n');
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'modes'), { recursive: true });
  mkdirSync(join(root, 'batch'), { recursive: true });
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: Jane\n');
  writeFileSync(join(root, 'modes', '_profile.md'), '## Target\n\nSenior roles.\n');
  for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER']) delete process.env[k];
  process.env.CAREER_OPS_ROOT = root;
  const { createApp } = await import('../server/index.mjs');
  app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(async () => {
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((r) => server.close(r));
});

/** No *.tmp litter may survive a save — the atomicWrite temp must be renamed or unlinked. */
function assertNoTmpLitter(dir, label) {
  const litter = readdirSync(dir).filter((f) => f.includes('.tmp'));
  assert.deepEqual(litter, [], `${label}: no temp files may be left behind`);
}

const putJson = (path, body) => fetch(baseUrl + path, {
  method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

// ─────────────────── static gate: the write mechanism ───────────────────

test('static gate — every shared-file PUT write goes through withFileLock + atomicWrite', () => {
  const readSrc = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');

  // content.mjs — PUT /api/cv, PUT /api/profile (fields + raw), PUT /api/modes (sections + raw)
  const content = readSrc('server', 'lib', 'routes', 'content.mjs');
  assert.match(content, /import \{[^}]*atomicWrite[^}]*\} from '\.\.\/file-lock\.mjs'/,
    'content.mjs must import the lock + atomicWrite helpers');
  for (const key of ['cv', 'profile', 'modesProfile']) {
    assert.match(content, new RegExp(`withFileLock\\(\\s*PATHS\\.${key}\\b`),
      `content.mjs must hold withFileLock(PATHS.${key}, …) around its ${key} write`);
    assert.match(content, new RegExp(`atomicWrite\\(\\s*PATHS\\.${key}\\b`),
      `content.mjs must land its ${key} write through atomicWrite (temp-then-rename)`);
    assert.doesNotMatch(content, new RegExp(`writeFileSync\\(\\s*PATHS\\.${key}\\b`),
      `content.mjs: a bare writeFileSync(PATHS.${key}, …) truncates the file on crash — use atomicWrite`);
  }

  // config.mjs — POST /api/config rewrites .env through updateEnvFile:
  // the read→rewrite must run under the .env file lock.
  const config = readSrc('server', 'lib', 'routes', 'config.mjs');
  assert.match(config, /await withFileLock\(\s*PATHS\.envFile,\s*\(\)\s*=>\s*updateEnvFile\(PATHS\.envFile, safe\)\)/,
    'config.mjs must run updateEnvFile under withFileLock(PATHS.envFile, …)');

  // batch.mjs — PUT /api/batch writes batch/batch-input.tsv, read by the
  // batch-runner subprocess: lock + atomicWrite.
  const batch = readSrc('server', 'lib', 'routes', 'batch.mjs');
  assert.match(batch, /withFileLock\(\s*PATHS\.batchInput\b/);
  assert.match(batch, /atomicWrite\(\s*PATHS\.batchInput\b/);
  assert.doesNotMatch(batch, /writeFileSync\(\s*PATHS\.batchInput\b/);

  // Already-locked writers must at least be ATOMIC (crash-safe), not just locked.
  for (const [file, key] of [
    ['server/lib/routes/career-plan.mjs', 'careerPlan'],
    ['server/lib/routes/memory.mjs', 'memory'],
    ['server/lib/routes/two-pager.mjs', 'twoPager'],
  ]) {
    const src = readSrc(...file.split('/'));
    assert.match(src, new RegExp(`atomicWrite\\(\\s*PATHS\\.${key}\\b`),
      `${file}: the locked write must go through atomicWrite`);
    assert.doesNotMatch(src, new RegExp(`writeFileSync\\(\\s*PATHS\\.${key}\\b`),
      `${file}: a bare writeFileSync inside the lock still truncates on crash`);
  }
});

// ─────────────────── behavioral round-trip canaries ───────────────────

test('PUT /api/cv saves sanitized markdown and leaves no temp litter', async () => {
  const md = '# Jane Dev\n\nSenior Backend Engineer. <script>alert(1)</script>\n';
  const r = await putJson('/api/cv', { markdown: md });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.ok, true);
  const saved = readFileSync(join(root, 'cv.md'), 'utf8');
  assert.ok(!saved.includes('<script>'), 'XSS strip still runs on the locked write path');
  assertNoTmpLitter(root, 'PUT /api/cv');
  const { markdown } = await (await fetch(`${baseUrl}/api/cv`)).json();
  assert.match(markdown, /Senior Backend Engineer/);
});

test('PUT /api/profile (fields) merges into the existing YAML and leaves no temp litter', async () => {
  const r = await putJson('/api/profile', { fields: { 'candidate.full_name': 'Jane Doe', 'candidate.location': 'Berlin' } });
  assert.equal(r.status, 200);
  const saved = readFileSync(join(root, 'config', 'profile.yml'), 'utf8');
  assert.match(saved, /full_name: Jane Doe/);
  assert.match(saved, /location: Berlin/);
  assertNoTmpLitter(join(root, 'config'), 'PUT /api/profile');
});

test('PUT /api/profile (raw yaml) replaces the file and leaves no temp litter', async () => {
  const yaml = 'candidate:\n  full_name: Raw Jane\n';
  const r = await putJson('/api/profile', { yaml });
  assert.equal(r.status, 200);
  const saved = readFileSync(join(root, 'config', 'profile.yml'), 'utf8');
  assert.match(saved, /full_name: Raw Jane/);
  assertNoTmpLitter(join(root, 'config'), 'PUT /api/profile raw');
});

test('PUT /api/modes (sections) merges sections under the lock; raw path writes atomically', async () => {
  const sections = await putJson('/api/modes/_profile', { sections: { 'Target': 'Staff roles, remote-first.' } });
  assert.equal(sections.status, 200);
  const saved = readFileSync(join(root, 'modes', '_profile.md'), 'utf8');
  assert.match(saved, /Staff roles, remote-first\./);
  const raw = await putJson('/api/modes/_profile', { markdown: '## Everything\n\nReplaced wholesale.\n' });
  assert.equal(raw.status, 200);
  assert.match(readFileSync(join(root, 'modes', '_profile.md'), 'utf8'), /Replaced wholesale\./);
  assertNoTmpLitter(join(root, 'modes'), 'PUT /api/modes');
});

test('PUT /api/batch saves the TSV under the lock; POST /api/config rewrites .env under the lock', async () => {
  const tsv = '1\thttps://example.com/job/1\tgreenhouse\t\n';
  const rb = await putJson('/api/batch', { raw: tsv });
  assert.equal(rb.status, 200);
  assert.equal(readFileSync(join(root, 'batch', 'batch-input.tsv'), 'utf8'), tsv);
  assertNoTmpLitter(join(root, 'batch'), 'PUT /api/batch');

  const rc = await fetch(baseUrl + '/api/config', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ LLM_PROVIDER: 'gemini' }),
  });
  assert.equal(rc.status, 200);
  const env = readFileSync(join(root, '.env'), 'utf8');
  assert.match(env, /^LLM_PROVIDER=gemini$/m);
  assert.equal(process.env.LLM_PROVIDER, 'gemini', 'the running process still picks the change up');
  delete process.env.LLM_PROVIDER;
});

test('career-plan / memory / two-pager saves still round-trip through atomicWrite', async () => {
  const plan = await putJson('/api/career-plan', { markdown: '# Plan\n\nShip M1.\n' });
  assert.equal(plan.status, 200);
  assert.match(readFileSync(join(root, 'config', 'career-plan.md'), 'utf8'), /Ship M1\./);
  const mem = await putJson('/api/memory', { markdown: '- Terse tone.' });
  assert.equal(mem.status, 200);
  assert.match(readFileSync(join(root, 'config', 'memory.md'), 'utf8'), /Terse tone\./);
  const tp = await putJson('/api/two-pager', { who_i_am: 'Senior engineer who ships.' });
  assert.equal(tp.status, 200);
  assert.match(readFileSync(join(root, 'config', 'two-pager.yml'), 'utf8'), /Senior engineer/);  assertNoTmpLitter(join(root, 'config'), 'plan/memory/two-pager saves');
});

test('networking saves stay create-exclusive (never overwrite an existing plan)', async () => {
  // networking.mjs uses writeExclusive (flag 'wx') — already safe under M1;
  // pinned here so a future rewrite to a plain write fails loudly.
  const src = readFileSync(resolve(ROOT, 'server/lib/routes/networking.mjs'), 'utf8');
  assert.match(src, /writeExclusive\(/, 'networking saves must keep the create-exclusive writer');
});
