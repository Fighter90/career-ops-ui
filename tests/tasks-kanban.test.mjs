/**
 * The «Career tasks» kanban (public/js/views/tasks.js) — client half.
 *
 * Layers covered here:
 *   1. vm-realm logic — the pure parts of the view in a synthetic window:
 *      parseTags (the POST contract: ≤ 8 strings), moveTarget (the ←/→
 *      column walk, no wraparound), and moveTask (optimistic move + revert,
 *      ONE canonical PUT per move, in-flight guard — the tracker-kanban
 *      pattern against PUT /api/tasks/:id).
 *   2. source-static — the write contract (only /api/tasks endpoints), the
 *      CSP-safe DOM discipline, the DnD/keyboard guards inside their handler
 *      bodies, the index.html registration (nav item + route + script), and
 *      the ×19 locale keys + snapshot parity.
 *
 * The DOM board itself is gated in a real browser
 * (tests/playwright-career-tasks.mjs): drag & drop needs real element
 * geometry, which a synthetic window does not provide.
 *
 * CI-isolated: file reads + a synthetic realm + `node --check`, no network,
 * no server.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const VIEW = readFileSync(R('public/js/views/tasks.js'), 'utf8');
const HTML = readFileSync(R('public/index.html'), 'utf8');

// ── 1 · vm realm — the pure helpers ─────────────────────────────────────────

// The view registers its route at module scope, so the synthetic realm needs
// a stub Router; the renderer itself is never invoked here (no DOM needed).
const registered = {};
const ctx = createContext({
  window: {},
  Router: { register: (name, fn) => { registered[name] = fn; }, render: () => {} },
  UI: {
    el: () => { throw new Error('UI.el must not run in the pure-helper realm'); },
    toast: (msg, type) => toasts.push({ msg, type }),
    modal: () => {},
    closeModal: () => {},
    confirm: async () => false,
  },
  I18n: { t: (k, f) => f },
  API: { get: async () => ({ tasks: [] }), post: async () => ({}), put: async () => ({}), del: async () => ({}) },
  FocusPreserved: { withFocusPreserved: (_host, fn) => fn() },
});
const toasts = [];
runInContext(VIEW, ctx);
const TV = ctx.window.TasksView;

test('the view registers the #/tasks route at module scope', () => {
  assert.ok(typeof registered.tasks === 'function', 'Router.register("tasks", …) ran in the realm');
  assert.ok(TV, 'window.TasksView exposes the pure helpers');
});

test('parseTags: comma input → trimmed, deduped, capped at 8 (the POST contract)', () => {
  const rt = (v) => JSON.parse(JSON.stringify(v)); // vm-realm arrays → local
  assert.deepEqual(rt(TV.parseTags('a, b ,  c')), ['a', 'b', 'c']);
  assert.deepEqual(rt(TV.parseTags('job, cv, JOB,  , interview')), ['job', 'cv', 'interview']);
  assert.deepEqual(rt(TV.parseTags('')), []);
  assert.deepEqual(rt(TV.parseTags(null)), []);
  assert.deepEqual(rt(TV.parseTags('x'.repeat(3))), ['xxx']);
  const many = rt(TV.parseTags('1,2,3,4,5,6,7,8,9,10'));
  assert.equal(many.length, 8, 'the cap is 8 tags');
  assert.deepEqual(many, ['1', '2', '3', '4', '5', '6', '7', '8']);
});

test('moveTarget: ←/→ walk the pinned column order; the ends are null (no wraparound)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(TV.STATUSES)), ['backlog', 'in-progress', 'done']);
  assert.equal(TV.moveTarget('backlog', 'ArrowRight'), 'in-progress');
  assert.equal(TV.moveTarget('in-progress', 'ArrowRight'), 'done');
  assert.equal(TV.moveTarget('done', 'ArrowRight'), null, 'the right end never wraps');
  assert.equal(TV.moveTarget('in-progress', 'ArrowLeft'), 'backlog');
  assert.equal(TV.moveTarget('backlog', 'ArrowLeft'), null, 'the left end never wraps');
  assert.equal(TV.moveTarget('unknown', 'ArrowRight'), null);
});

// ── 2 · moveTask — optimistic move + revert, ONE canonical PUT per move ─────

test('moveTask: optimistic set + a successful PUT keeps the status, toasts once', async () => {
  toasts.length = 0;
  const task = { id: 't1', status: 'backlog' };
  const puts = [];
  const put = async (path, body) => { puts.push([path, body]); return { task: { ...task, ...body } }; };
  const events = [];
  const ok = await TV.moveTask({
    task, to: 'in-progress', put,
    onApplied: (t2, from, to) => events.push(['applied', t2.status, from, to]),
    onReverted: () => events.push(['reverted']),
  });
  assert.equal(ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(puts)), [['/api/tasks/t1', { status: 'in-progress' }]], 'ONE canonical PUT body');
  assert.equal(task.status, 'in-progress');
  assert.deepEqual(events, [['applied', 'in-progress', 'backlog', 'in-progress']]);
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].type, 'success');
  assert.match(toasts[0].msg, /In Progress/, 'the toast names the localized column');
});

test('moveTask: a failed PUT reverts to the captured status and toasts the failure', async () => {
  toasts.length = 0;
  const task = { id: 't2', status: 'in-progress' };
  const put = async () => { throw new Error('500'); };
  const events = [];
  const ok = await TV.moveTask({
    task, to: 'done', put,
    onApplied: (t2) => events.push(['applied', t2.status]),
    onReverted: (t2, from) => events.push(['reverted', t2.status, from]),
  });
  assert.equal(ok, false);
  assert.equal(task.status, 'in-progress', 'the task is back on the captured snapshot');
  assert.deepEqual(events, [['applied', 'done'], ['reverted', 'in-progress', 'in-progress']]);
  assert.equal(toasts[0].type, 'error');
});

test('moveTask: same-column drop, unknown status and missing id are no-ops (never a write)', async () => {
  toasts.length = 0;
  let called = 0;
  const put = async () => { called += 1; return {}; };
  assert.equal(await TV.moveTask({ task: { id: 'a', status: 'done' }, to: 'done', put }), false);
  assert.equal(await TV.moveTask({ task: { id: 'a', status: 'backlog' }, to: 'nope', put }), false);
  assert.equal(await TV.moveTask({ task: { status: 'backlog' }, to: 'done', put }), false);
  assert.equal(await TV.moveTask({ task: { id: 'a', status: 'backlog' }, to: '', put }), false);
  assert.equal(await TV.moveTask({ task: { id: 'a', status: 'backlog' }, to: 'done', put: null }), false);
  assert.equal(called, 0, 'no PUT for a no-op');
  assert.equal(toasts.length, 0);
});

test('moveTask: one write per task at a time (in-flight guard, no double-PUT race)', async () => {
  toasts.length = 0;
  const task = { id: 't7', status: 'backlog' };
  let resolvePut;
  const put = () => new Promise((r) => { resolvePut = r; });
  const first = TV.moveTask({ task, to: 'in-progress', put });
  const second = await TV.moveTask({ task, to: 'done', put });
  assert.equal(second, false, 'a second move of the SAME in-flight task is ignored');
  resolvePut({});
  assert.equal(await first, true);
  assert.equal(task.status, 'in-progress', 'the ignored second move never mutated the task');
  const third = await TV.moveTask({ task, to: 'done', put: async () => ({}) });
  assert.equal(third, true, 'after completion the task can move again');
});

// ── 3 · source-static — the write contract + CSP discipline ─────────────────

test('the view writes ONLY through the pinned /api/tasks endpoints', () => {
  const paths = [...VIEW.matchAll(/API\.(?:put|post|del|get)\('([^']+)'/g)].map((m) => m[1]);
  assert.ok(paths.length >= 4, `read/write call sites found: ${paths.join(' | ')}`);
  for (const p of paths) {
    assert.ok(p.startsWith('/api/tasks'), `every call targets /api/tasks — got ${p}`);
  }
  assert.ok(paths.includes('/api/tasks'), 'the collection GET/POST target /api/tasks');
  assert.ok(paths.includes('/api/tasks/'), 'the item PUT/DELETE target /api/tasks/:id');
  assert.ok(!/\/api\/tasks\/(bulk|move)/.test(VIEW), 'no invented task endpoints');
});

test('CSP-safe DOM: no innerHTML, no inline handlers in the view', () => {
  assert.ok(!/innerHTML/.test(VIEW), 'innerHTML is forbidden (UI.el only)');
  assert.ok(!/\son[a-z]+\s*=/.test(VIEW), 'no inline event handlers');
});

test('DnD guards live INSIDE the handler bodies (anchored, not substring)', () => {
  const over = VIEW.slice(VIEW.indexOf("'dragover'"), VIEW.indexOf("'dragleave'"));
  assert.ok(over.length > 0 && over.length < 1200, 'the dragover body is sliceable');
  assert.match(over, /dragId == null/, 'no drop candidate → the column never accepts');
  assert.match(over, /statusOf\(task\) === status/, 'same-column hover is refused before any write');
  const drop = VIEW.slice(VIEW.indexOf("'drop'"), VIEW.indexOf('return col;'));
  assert.ok(drop.length > 0 && over.length < 1200 && drop.length < 1800, 'the drop body is sliceable');
  assert.match(drop, /statusOf\(task\) === status/, 'drop re-checks the same-column guard');
  assert.match(drop, /move\(task, status\)/, 'the drop goes through moveTask (the one write path)');
});

test('keyboard + focus discipline: cards are focusable/draggable; ←/→ and Enter wired; keys at the select stay there', () => {
  assert.match(VIEW, /tabIndex: 0/);
  assert.match(VIEW, /draggable: 'true'/);
  const keydown = VIEW.slice(VIEW.indexOf("'keydown'"), VIEW.indexOf('return el;'));
  assert.ok(keydown.length > 0);
  assert.match(keydown, /e\.target !== el/, 'keys aimed at the inner select never move the card');
  assert.match(keydown, /ArrowLeft/);
  assert.match(keydown, /ArrowRight/);
  assert.match(keydown, /openDetailsModal\(task\)/, 'Enter opens the details modal');
  assert.match(keydown, /move\(task, target\)/, 'arrow keys use the same canonical write path');
});

test('the per-card status select is the no-drag mover and snaps back on an ignored move', () => {
  assert.match(VIEW, /statusSelect\(task\)/);
  const sel = VIEW.slice(VIEW.indexOf('function statusSelect'), VIEW.indexOf('// ── Modals'));
  assert.match(sel, /moveTask\(/, 'the select rides the same write path');
  assert.match(sel, /if \(!ok\) sel\.value = statusOf\(task\)/, 'an ignored/reverted move snaps the select back');
});

test('a failed GET renders the localized error empty-state with Retry (never a silent blank board)', () => {
  assert.match(VIEW, /t\('tasks\.error', 'Could not load tasks'\)/);
  assert.match(VIEW, /t\('tasks\.retry', 'Retry'\)/);
  assert.match(VIEW, /Router\.render\(\)/, 'the Retry button re-runs the route');
});

test('the view stays under the 800-LOC hard limit', () => {
  const lines = VIEW.split('\n').length;
  assert.ok(lines > 0 && lines <= 800, `tasks.js is ${lines} lines`);
});

// ── 4 · index.html registration ─────────────────────────────────────────────

test('index.html: the nav item sits in the Growth group with its i18n label', () => {
  const growth = HTML.slice(HTML.indexOf('data-nav-group="growth"'), HTML.indexOf('data-nav-group="setup"'));
  assert.ok(growth.length > 0, 'the growth group section is sliceable');
  assert.match(growth, /<a class="nav-item" href="#\/tasks" data-route="tasks">/);
  assert.match(growth, /data-i18n="nav\.tasks"/);
  // Placement: after Career orientation, per the board's spec.
  const iOrientation = growth.indexOf('data-route="orientation"');
  const iTasks = growth.indexOf('data-route="tasks"');
  assert.ok(iOrientation > -1 && iTasks > iOrientation, 'tasks follows orientation in the Growth group');
});

test('index.html: the tasks view script is registered next to the other views', () => {
  const iTasks = HTML.indexOf('/js/views/tasks.js');
  const iPlan = HTML.indexOf('/js/views/career-plan.js');
  const iOrientation = HTML.indexOf('/js/views/orientation.js');
  assert.ok(iTasks > -1, 'the script tag exists');
  assert.ok(iTasks > iOrientation && iOrientation > iPlan, 'it loads after the Growth neighbours');
});

// ── 5 · i18n — the tasks.*/nav.tasks keys exist in ALL 19 locales ───────────

const I18N_LANGS = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi'];
const TASKS_KEYS = [
  'nav.tasks', 'tasks.title', 'tasks.subtitle',
  'tasks.col.backlog', 'tasks.col.inProgress', 'tasks.col.done',
  'tasks.add', 'tasks.empty', 'tasks.error', 'tasks.retry',
  'tasks.modalTitle', 'tasks.field.title', 'tasks.field.notes',
  'tasks.field.priority', 'tasks.field.tags', 'tasks.save',
  'tasks.delete', 'tasks.deleteConfirm', 'tasks.moved', 'tasks.moveFailed',
  'tasks.prio.high', 'tasks.prio.normal', 'tasks.prio.low', 'tasks.created',
];
// Reused vocabulary the view borrows from the tracker-kanban/shared namespaces.
const REUSED_KEYS = ['kanban.status', 'kanban.dropHere', 'common.error'];

function loadTable(lang) {
  const c2 = createContext({ window: {} });
  runInContext(readFileSync(R('public/js/lib/locales', `i18n-dict.${lang}.js`), 'utf8'), c2);
  const g = `__I18N_DICT_${lang.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  return c2.window[g];
}

test('every tasks.* key exists in ALL 19 locales (and the dicts parse in a vm realm)', () => {
  for (const lang of I18N_LANGS) {
    const table = loadTable(lang);
    const missing = TASKS_KEYS.filter((k) => typeof table[k] !== 'string' || !table[k].length);
    assert.deepEqual(missing, [], `${lang} is missing: ${missing.join(', ')}`);
  }
});

test('the en values are the en fallbacks the view renders with (dict ↔ view parity)', () => {
  const en = loadTable('en');
  for (const k of TASKS_KEYS) {
    if (k === 'nav.tasks') {
      assert.match(HTML, /data-i18n="nav\.tasks"/, 'nav.tasks is wired as the sidebar label');
      continue;
    }
    assert.ok(VIEW.includes(`'${k}'`), `${k} is referenced by the view`);
  }
  assert.equal(en['tasks.title'], 'Career tasks');
  assert.equal(en['tasks.subtitle'],
    'A personal kanban board — drag tasks from Backlog through In Progress to Done.');
  assert.equal(en['tasks.moveFailed'], 'The move did not stick — reverted');
  // The {state} placeholder survives in every locale (the toast interpolates it).
  for (const lang of I18N_LANGS) {
    assert.ok(loadTable(lang)['tasks.moved'].includes('{state}'), `${lang}.tasks.moved keeps {state}`);
  }
});

test('the reused kanban.*/common.* keys the view borrows still resolve in all 19 locales', () => {
  for (const lang of I18N_LANGS) {
    const table = loadTable(lang);
    const missing = REUSED_KEYS.filter((k) => typeof table[k] !== 'string' || !table[k].length);
    assert.deepEqual(missing, [], `${lang} is missing: ${missing.join(', ')}`);
  }
});

test('snapshot parity: the regenerated fixture carries the tasks keys ×19', () => {
  const snapshot = JSON.parse(readFileSync(R('tests/fixtures/i18n-dict.snapshot.json'), 'utf8'));
  for (const k of TASKS_KEYS) {
    assert.ok(snapshot[k], `snapshot is missing ${k}`);
    for (const lang of I18N_LANGS) {
      assert.ok(snapshot[k][lang], `snapshot ${k} is missing ${lang}`);
    }
  }
});

test('every locale dict file still passes node --check', () => {
  for (const lang of I18N_LANGS) {
    const file = R('public/js/lib/locales', `i18n-dict.${lang}.js`);
    const res = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(res.status, 0, `${lang} dict failed node --check: ${res.stderr}`);
  }
});

test('the assembled dict equals the snapshot fixture (i18n-locale-files parity, redundant guard)', () => {
  const assembled = {};
  for (const lang of I18N_LANGS) Object.assign(assembled, { [lang]: loadTable(lang) });
  const snapshot = JSON.parse(readFileSync(R('tests/fixtures/i18n-dict.snapshot.json'), 'utf8'));
  for (const k of TASKS_KEYS) {
    for (const lang of I18N_LANGS) {
      assert.equal(assembled[lang][k], snapshot[k][lang], `${k} drift between dict and snapshot (${lang})`);
    }
  }
});
