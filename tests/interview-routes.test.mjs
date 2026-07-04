/**
 * Mock Interview 2.0 routes (v1.90.0, Epic 15).
 *
 * CI-isolated: createApp() against a mktemp CAREER_OPS_ROOT; paths carriers
 * imported dynamically AFTER the env is set (eager-import leak lesson). No
 * provider keys are set, so every /turn falls to the honest manual prompt —
 * we never hit a live LLM in CI.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server; let baseUrl; let ipDir;
let normalizeHistory; let buildInterviewPrompt;

before(async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'mockint-'));
  mkdirSync(resolve(root, 'config'), { recursive: true });
  mkdirSync(resolve(root, 'interview-prep'), { recursive: true });
  writeFileSync(resolve(root, 'cv.md'), '# Jane Dev\nSenior Backend Engineer, Go + PostgreSQL. Led a payments migration.\n');
  writeFileSync(resolve(root, 'config', 'profile.yml'), 'candidate:\n  full_name: Jane\n');
  writeFileSync(resolve(root, 'interview-prep', 'story-bank.md'), '# Stories\n- Cut checkout latency 40% (STAR).\n');
  writeFileSync(resolve(root, 'portals.yml'), 'tracked_companies: []\n');
  // Ensure no provider keys leak in from the host env.
  for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER']) delete process.env[k];
  process.env.CAREER_OPS_ROOT = root;
  ipDir = resolve(root, 'interview-prep');
  ({ normalizeHistory, buildInterviewPrompt } = await import('../server/lib/routes/interview.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
beforeEach(() => {
  for (const f of readdirSync(ipDir)) { if (f.startsWith('mock-')) rmSync(resolve(ipDir, f)); }
});
after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

const post = (p, b) => fetch(`${baseUrl}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

test('normalizeHistory bounds & types turns', () => {
  const h = normalizeHistory([
    { speaker: 'candidate', text: '  hi  ' },
    { speaker: 'weird', text: 'x'.repeat(9000) },
    { text: '' },
    'nope',
    null,
  ]);
  assert.equal(h[0].speaker, 'candidate');
  assert.equal(h[0].text, 'hi');
  assert.equal(h[1].speaker, 'interviewer'); // unknown speaker → interviewer
  assert.equal(h[1].text.length, 6000);      // capped
  assert.equal(h.length, 2);                 // empty + junk dropped
  assert.deepEqual(normalizeHistory('nope'), []);
});

test('buildInterviewPrompt: opening asks ONE question; answered turn asks for feedback', () => {
  const opening = buildInterviewPrompt('CTX', { role: 'Backend Engineer', company: 'Acme', history: [] });
  assert.match(opening, /opening interview question/);
  assert.match(opening, /Backend Engineer/);
  assert.match(opening, /Acme/);
  assert.doesNotMatch(opening, /### Feedback/);

  const answered = buildInterviewPrompt('CTX', {
    role: 'Backend Engineer',
    history: [{ speaker: 'interviewer', text: 'Why Go?' }, { speaker: 'candidate', text: 'I like goroutines.' }],
  });
  assert.match(answered, /### Feedback/);
  assert.match(answered, /### Next question/);
  assert.match(answered, /Score: N\/5/);
  assert.match(answered, /goroutines/);
});

test('POST /turn with no key returns an honest manual prompt (no fabricated answer)', async () => {
  const r = await post('/api/mock-interview/turn', { role: 'Backend Engineer', company: 'Acme', history: [] });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.mode, 'manual');
  assert.match(j.prompt, /mock job interview/);
  assert.match(j.prompt, /Jane Dev/);           // cv.md inlined
  assert.match(j.prompt, /story-bank/);         // story bank inlined
  assert.equal(j.markdown, undefined);          // no invented answer
});

test('POST /turn requires a role or a JD', async () => {
  const r = await post('/api/mock-interview/turn', { history: [] });
  assert.equal(r.status, 400);
});

test('save → list → fetch → delete round-trips a session', async () => {
  const save = await post('/api/mock-interview/save', { role: 'Backend Engineer', company: 'Acme', transcript: '**Q:** Why Go?\n\n**A:** Goroutines.' });
  assert.equal(save.status, 200);
  const { name } = await save.json();
  assert.match(name, /^mock-acme-backend-engineer-\d{4}-\d{2}-\d{2}\.md$/);
  assert.ok(existsSync(resolve(ipDir, name)));

  const list = await (await fetch(`${baseUrl}/api/mock-interview/sessions`)).json();
  assert.ok(list.sessions.some((s) => s.name === name));

  const one = await (await fetch(`${baseUrl}/api/mock-interview/sessions/${name}`)).json();
  assert.match(one.markdown, /Why Go\?/);

  const del = await fetch(`${baseUrl}/api/mock-interview/sessions/${name}`, { method: 'DELETE' });
  assert.equal(del.status, 200);
  assert.ok(!existsSync(resolve(ipDir, name)));
});

test('session name is path-traversal safe', async () => {
  const r = await fetch(`${baseUrl}/api/mock-interview/sessions/${encodeURIComponent('../../etc/passwd')}`);
  assert.equal(r.status, 400);
});

test('save requires a transcript', async () => {
  const r = await post('/api/mock-interview/save', { role: 'X', transcript: '   ' });
  assert.equal(r.status, 400);
});
