/**
 * Career tasks routes (v1.271.0 — «Career tasks» kanban). CI-isolated:
 * mkdtemp CAREER_OPS_ROOT (paths resolve once — env set BEFORE the dynamic
 * import), 127.0.0.1:0 listen, no network, no LLM. Covers the pinned API
 * contract — CRUD round-trip, the validation table, unknown-id 404s, the
 * file round-trip across an app restart, newest-updated-first ordering,
 * the corrupt-file fail-safe (warn once, then recover), and concurrent
 * POSTs surviving the read-modify-write lock.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server; let baseUrl; let tasksPath;

before(async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'tasks-'));
  mkdirSync(resolve(root, 'data'), { recursive: true });
  mkdirSync(resolve(root, 'config'), { recursive: true });
  writeFileSync(resolve(root, 'cv.md'), '# Jane Dev\nSenior Backend Engineer.\n');
  writeFileSync(resolve(root, 'config', 'profile.yml'), 'candidate:\n  full_name: Jane\n');
  writeFileSync(resolve(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(root, 'data', 'applications.md'), '# Applications\n| 1 | Acme | Backend | 4.2/5 | Applied |\n');
  for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER']) delete process.env[k];
  process.env.CAREER_OPS_ROOT = root;
  tasksPath = resolve(root, 'data', 'career-tasks.json');
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
beforeEach(() => { if (existsSync(tasksPath)) rmSync(tasksPath); });
after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

const post = (b) => fetch(`${baseUrl}/api/tasks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const put = (id, b) => fetch(`${baseUrl}/api/tasks/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const del = (id) => fetch(`${baseUrl}/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
const list = async () => (await (await fetch(`${baseUrl}/api/tasks`)).json()).tasks;

test('GET on a fresh board → 200 {tasks: []}', async () => {
  const r = await fetch(`${baseUrl}/api/tasks`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { tasks: [] });
});

test('POST creates a task with the contract shape + defaults', async () => {
  const r = await post({ title: 'Tailor CV for Acme' });
  assert.equal(r.status, 201);
  const { task } = await r.json();
  assert.match(task.id, /^t-[a-z0-9]+-[a-z0-9]{4}$/);
  assert.equal(task.title, 'Tailor CV for Acme');
  assert.equal(task.notes, '');
  assert.equal(task.status, 'backlog');
  assert.equal(task.priority, 'normal');
  assert.deepEqual(task.tags, []);
  assert.match(task.created, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(task.created, task.updated);
});

test('POST trims title and tags but keeps notes verbatim', async () => {
  const { task } = await (await post({ title: '  Fix resume parser  ', notes: '  keep  spacing  ', tags: ['  aws ', ' cv '] })).json();
  assert.equal(task.title, 'Fix resume parser');
  assert.equal(task.notes, '  keep  spacing  ');
  assert.deepEqual(task.tags, ['aws', 'cv']);
});

test('POST honors explicit priority / notes / tags (values round-trip)', async () => {
  const { task } = await (await post({ title: 'Prep loop', notes: 'STAR stories', priority: 'high', tags: ['interview', 'prep'] })).json();
  assert.equal(task.priority, 'high');
  assert.equal(task.notes, 'STAR stories');
  assert.deepEqual(task.tags, ['interview', 'prep']);
});

// The validation table — every case 400 with a message. The six pinned
// cases (empty title, >200 title, bad priority, >8 tags, empty tag, bad
// status on PUT) plus the same-field edge cases (missing/non-string title,
// notes >2000, tag >24, tags not an array).
const CASES = [
  ['empty (whitespace) title', 'POST', { title: '   ' }],
  ['missing title', 'POST', { notes: 'no title here' }],
  ['title > 200 chars', 'POST', { title: 'x'.repeat(201) }],
  ['non-string title', 'POST', { title: 42 }],
  ['bad priority', 'POST', { title: 'Ok', priority: 'urgent' }],
  ['notes > 2000 chars', 'POST', { title: 'Ok', notes: 'n'.repeat(2001) }],
  ['more than 8 tags', 'POST', { title: 'Ok', tags: Array.from({ length: 9 }, (_, i) => `t${i}`) }],
  ['empty tag string', 'POST', { title: 'Ok', tags: ['  '] }],
  ['tag > 24 chars', 'POST', { title: 'Ok', tags: ['y'.repeat(25)] }],
  ['tags not an array', 'POST', { title: 'Ok', tags: 'aws' }],
  ['bad status on PUT', 'PUT', { status: 'archived' }],
];

for (const [name, method, body] of CASES) {
  test(`validation: ${name} → 400 with a message`, async () => {
    let id = null;
    if (method === 'PUT') {
      id = (await (await post({ title: 'PUT fixture' })).json()).task.id;
    }
    const r = method === 'PUT' ? await put(id, body) : await post(body);
    assert.equal(r.status, 400);
    const { error } = await r.json();
    assert.equal(typeof error, 'string');
    assert.ok(error.length > 0, 'error message must be non-empty');
  });
}

test('PUT drag {status} walks the canonical board order, title untouched', async () => {
  const { task } = await (await post({ title: 'Drag me' })).json();
  assert.equal(task.status, 'backlog');
  const p1 = (await (await put(task.id, { status: 'in-progress' })).json()).task;
  assert.equal(p1.status, 'in-progress');
  assert.equal(p1.title, 'Drag me');
  const p2 = (await (await put(task.id, { status: 'done' })).json()).task;
  assert.equal(p2.status, 'done');
  const { tasks } = await (await fetch(`${baseUrl}/api/tasks`)).json();
  assert.equal(tasks.find((t) => t.id === task.id).status, 'done');
});

test('PUT partial update: only provided fields move, every write bumps updated', async () => {
  const { task } = await (await post({ title: 'Original', notes: 'keep', priority: 'low', tags: ['a'] })).json();
  const before = task.updated;
  const after = (await (await put(task.id, { title: 'Renamed' })).json()).task;
  assert.equal(after.title, 'Renamed');
  assert.equal(after.notes, 'keep');        // untouched
  assert.equal(after.priority, 'low');      // untouched
  assert.deepEqual(after.tags, ['a']);      // untouched
  assert.equal(after.status, 'backlog');    // untouched
  assert.ok(after.updated >= before, 'updated must bump on write');
  assert.equal(after.created, task.created);
});

test('PUT rejects an oversized title (same field validation as POST)', async () => {
  const { task } = await (await post({ title: 'Ok' })).json();
  const r = await put(task.id, { title: 'z'.repeat(201) });
  assert.equal(r.status, 400);
  const { error } = await r.json();
  assert.match(error, /title/);
});

test('PUT unknown id → 404 {error} (and no file write)', async () => {
  const r = await put('t-nope-0000', { title: 'Ghost' });
  assert.equal(r.status, 404);
  const { error } = await r.json();
  assert.equal(typeof error, 'string');
  assert.equal(existsSync(tasksPath), false, 'a 404 PUT must not create the file');
});

test('DELETE unknown id → 404 {error}', async () => {
  const r = await del('t-nope-0000');
  assert.equal(r.status, 404);
  const { error } = await r.json();
  assert.equal(typeof error, 'string');
});

test('DELETE removes the task ({ok:true}) and it leaves the list', async () => {
  const { task } = await (await post({ title: 'Doomed' })).json();
  const r = await del(task.id);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  const tasks = await list();
  assert.equal(tasks.some((t) => t.id === task.id), false);
});

test('list is newest-updated first (update the SECOND → it jumps to the front)', async () => {
  const a = (await (await post({ title: 'First created' })).json()).task;
  const b = (await (await post({ title: 'Second created' })).json()).task;
  // Touch the LAST-created task — insertion order would keep `a` first, so
  // this discriminates a real sort from an accidentally-passing array order.
  await put(b.id, { priority: 'high' });
  const tasks = await list();
  assert.equal(tasks[0].id, b.id, 'the newest-updated task must lead');
  assert.ok(tasks.some((t) => t.id === a.id), 'the untouched task must still be listed');
  for (let i = 1; i < tasks.length; i++) {
    assert.ok(String(tasks[i - 1].updated) >= String(tasks[i].updated), 'array must be non-increasing by updated');
  }
});

test('persistence: a second app instance on the same root still sees the task (file round-trip)', async () => {
  const { task } = await (await post({ title: 'Survives the restart', notes: 'disk, not memory' })).json();
  // "Restart": close the server, boot a fresh app on the same CAREER_OPS_ROOT.
  await new Promise((r) => server.close(r));
  const { createApp } = await import('../server/index.mjs');
  const app2 = createApp();
  await new Promise((r) => { server = app2.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
  const tasks = await list();
  const found = tasks.find((t) => t.id === task.id);
  assert.ok(found, 'task must survive the restart');
  assert.equal(found.notes, 'disk, not memory');
  assert.equal(found.title, 'Survives the restart');
});

test('corrupt file → read fails safe to {tasks:[]}, console.warn fires once, then a write recovers', async () => {
  writeFileSync(tasksPath, '{ this is not json');
  const warns = [];
  const orig = console.warn;
  console.warn = (m) => warns.push(String(m));
  try {
    const first = await (await fetch(`${baseUrl}/api/tasks`)).json();
    assert.deepEqual(first, { tasks: [] });
    const second = await (await fetch(`${baseUrl}/api/tasks`)).json();
    assert.deepEqual(second, { tasks: [] });
  } finally {
    console.warn = orig;
  }
  assert.equal(warns.length, 1, `corrupt parse must warn exactly once, got ${warns.length}`);
  assert.match(warns[0], /career-tasks/);
  // Recovery: the next write rebuilds a valid file from scratch.
  const rec = await post({ title: 'Recovery write' });
  assert.equal(rec.status, 201);
  const parsed = JSON.parse(readFileSync(tasksPath, 'utf8'));
  assert.ok(Array.isArray(parsed.tasks) && parsed.tasks.some((t) => t.title === 'Recovery write'));
});

test('5 concurrent POSTs via Promise.all all persist (lock serializes read-modify-write)', async () => {
  const bodies = ['Concurrent 1', 'Concurrent 2', 'Concurrent 3', 'Concurrent 4', 'Concurrent 5'].map((title) => ({ title }));
  const rs = await Promise.all(bodies.map((b) => post(b)));
  for (const r of rs) assert.equal(r.status, 201);
  const ids = (await Promise.all(rs.map((r) => r.json()))).map((x) => x.task.id);
  assert.equal(new Set(ids).size, 5, 'ids must be unique');
  const tasks = await list();
  for (const id of ids) assert.ok(tasks.some((t) => t.id === id), `${id} must persist`);
});
