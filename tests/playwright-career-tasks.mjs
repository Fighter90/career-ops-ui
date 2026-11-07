/**
 * The «Career tasks» kanban, in a real browser: three columns with live
 * counts, HTML5 drag&drop writing exactly ONE canonical PUT, optimistic move
 * + revert on a failed PUT, the keyboard fallback (←/→ + Enter), the mobile
 * per-card status select, and the create modal.
 *
 * The CLIENT half owns no server code, so the /api/tasks surface is MOCKED
 * with page.route (the real server in this tree has no tasks route yet —
 * the server agent builds it in a parallel worktree against the pinned
 * contract; persistence-across-restart with a REAL backend is gated there):
 *   GET    /api/tasks      → 3 fixture tasks (one per column)
 *   POST   /api/tasks      → 201 {task} (echoed fixture-shaped task)
 *   PUT    /api/tasks/:id  → captures the body, echoes {task:{...updated}};
 *                            a failure toggle answers 500 for the revert gate
 *
 * Interaction note (inherited from playwright-tracker-kanban.mjs): headless
 * Chromium does not start native HTML5 DnD from synthetic mouse moves, so the
 * drag gate dispatches real DragEvents with a DataTransfer through the board's
 * own wiring.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT, 127.0.0.1 bind, no external network
 * (the only tasks traffic is intercepted by page.route).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function resolvePlaywright() {
  const candidates = [];
  if (process.env.CAREER_OPS_PLAYWRIGHT_PATH) candidates.push(process.env.CAREER_OPS_PLAYWRIGHT_PATH);
  for (const id of ['playwright', resolve(process.cwd(), '..', 'node_modules', 'playwright'), resolve(process.cwd(), 'node_modules', 'playwright')]) {
    candidates.push(id);
  }
  for (const id of candidates) {
    try { return require(id); } catch { /* next */ }
  }
  return null;
}
const __dirname = dirname(fileURLToPath(import.meta.url));
const playwright = resolvePlaywright();
const SKIP = !playwright;

let server, baseUrl, browser, context, root;

const NOW = '2026-11-01T10:00:00Z';
const mkTask = (id, title, status, priority, tags) => ({
  id, title, notes: '', status, priority, tags, created: NOW, updated: NOW,
});
const TASKS = [
  mkTask('t1', 'Polish CV summary', 'backlog', 'high', ['cv']),
  mkTask('t2', 'Prep Alpha interview', 'in-progress', 'normal', ['interview']),
  mkTask('t3', 'Sign the offer', 'done', 'low', []),
];

// ── the mocked /api/tasks surface (the pinned contract) ─────────────────────
let putLog = [];  // { id, body }
let postLog = []; // bodies
let failPut = false;

function tasksApiById(id) {
  return TASKS.find((x) => x.id === id) || null;
}

async function tasksApi(route) {
  const req = route.request();
  const method = req.method();
  const url = new URL(req.url());
  const id = url.pathname.startsWith('/api/tasks/')
    ? decodeURIComponent(url.pathname.slice('/api/tasks/'.length))
    : null;
  if (method === 'GET') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tasks: TASKS }),
    });
    return;
  }
  if (method === 'POST') {
    const body = JSON.parse(req.postData() || '{}');
    postLog.push(body);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ task: mkTask('t-new', body.title || '', 'backlog', body.priority || 'normal', body.tags || []) }),
    });
    return;
  }
  if (method === 'PUT') {
    const body = JSON.parse(req.postData() || '{}');
    putLog.push({ id, body });
    if (failPut) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) });
      return;
    }
    const task = tasksApiById(id);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ task: { ...(task || { id }), ...body, updated: NOW } }),
    });
    return;
  }
  if (method === 'DELETE') {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    return;
  }
  await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: 'method not allowed' }) });
}

before(async () => {
  if (SKIP) return;
  root = mkdtempSync(resolve(tmpdir(), 'pw-career-tasks-'));
  mkdirSync(resolve(root, 'config'), { recursive: true });
  mkdirSync(resolve(root, 'data'), { recursive: true });
  mkdirSync(resolve(root, 'modes'), { recursive: true });
  writeFileSync(resolve(root, 'cv.md'), '# CV\n\nReal Person, Senior Backend Engineer.\n');
  writeFileSync(resolve(root, 'config', 'profile.yml'), 'candidate:\n  full_name: Tester\n');
  writeFileSync(resolve(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(root, 'modes', 'oferta.md'), 'x\n');

  process.env.CAREER_OPS_ROOT = root;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
  browser = await playwright.chromium.launch({ headless: process.env.PWDEBUG !== '1' });
  context = await browser.newContext();
});

after(async () => {
  if (context) await context.close();
  if (browser) await browser.close();
  if (server) { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
  delete process.env.CAREER_OPS_ROOT;
  if (root) rmSync(root, { recursive: true, force: true });
});

async function newPage({ viewport = null } = {}) {
  const page = await context.newPage();
  if (viewport) await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    localStorage.setItem('career-ops-ui:lang', 'en');
  });
  await page.route('**/api/tasks', tasksApi);
  await page.route('**/api/tasks/*', tasksApi);
  return page;
}

async function openBoard(page) {
  await page.goto(baseUrl + '/#/tasks');
  await page.waitForSelector('.funnel-board .funnel-card', { timeout: 10000 });
}

const colCards = (page, stage) => page.locator(`.funnel-cards[data-stage="${stage}"] .funnel-card`);
const colCount = (page, stage) => page.locator(`.funnel-col[data-stage="${stage}"] .funnel-col-count`);

// The move PUT is async behind the OPTIMISTIC render — poll the mock's log
// from the NODE side until the write landed (waitForFunction's raf polling
// proved unreliable for an async predicate in headless).
async function waitForPutLog(page, min, { timeoutMs = 8000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (putLog.length >= min) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

// Dispatch a real HTML5 DnD sequence through the board's own wiring.
async function dragCard(page, titleText, toStage) {
  return page.evaluate(([title, stage]) => new Promise((resolve) => {
    const card = [...document.querySelectorAll('.funnel-card')].find((c) => c.textContent.includes(title));
    const host = document.querySelector(`.funnel-cards[data-stage="${stage}"]`);
    if (!card || !host) return resolve('missing');
    const dt = new DataTransfer();
    card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    host.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
    host.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
    card.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    setTimeout(() => resolve('done'), 100);
  }), [titleText, toStage]);
}

test('the board renders 3 columns with the fixture counts, live badges and per-column «+»', { skip: SKIP }, async () => {
  const page = await newPage();
  await openBoard(page);
  for (const stage of ['backlog', 'in-progress', 'done']) {
    assert.equal(await page.locator(`.funnel-col[data-stage="${stage}"]`).count(), 1, `column ${stage} exists`);
  }
  assert.equal(await colCards(page, 'backlog').count(), 1, 't1 in backlog');
  assert.equal(await colCards(page, 'in-progress').count(), 1, 't2 in in-progress');
  assert.equal(await colCards(page, 'done').count(), 1, 't3 in done');
  assert.deepEqual([
    await colCount(page, 'backlog').textContent(),
    await colCount(page, 'in-progress').textContent(),
    await colCount(page, 'done').textContent(),
  ], ['1', '1', '1'], 'the count badges read the fixture');
  assert.equal(await page.locator('.funnel-col-count[aria-live="polite"]').count(), 3, 'counts are aria-live');
  assert.equal(await page.locator('button[aria-label="Add task"]').count(), 3, 'one «+» per column');
  // Every card is keyboard-reachable and carries the priority dot + chips.
  assert.equal(await page.locator('.funnel-card[tabindex="0"][draggable="true"]').count(), 3);
  assert.equal(await page.locator('.funnel-card .dash-chip').count(), 5, '3 priority chips + cv + interview tag chips');
  assert.equal(await page.locator('.funnel-card select').count(), 3, 'the per-card status select (mobile mover)');
  await page.close();
});

test('drag a card backlog → in-progress: exactly ONE canonical PUT, the card lands, the empty state shows', { skip: SKIP }, async () => {
  const page = await newPage();
  await openBoard(page);
  putLog.length = 0;
  const drag = await dragCard(page, 'Polish CV summary', 'in-progress');
  assert.equal(drag, 'done');
  assert.ok(await waitForPutLog(page, 1), 'the PUT fired');
  await page.waitForTimeout(250); // let the toast/render settle; no second write may arrive
  assert.equal(putLog.length, 1, 'exactly ONE PUT per move (no double-fire)');
  assert.deepEqual(putLog[0], { id: 't1', body: { status: 'in-progress' } }, 'the canonical PUT body');
  // The card re-rendered into the target column (optimistic state).
  await page.waitForSelector('.funnel-cards[data-stage="in-progress"] .funnel-card:has-text("Polish CV summary")', { timeout: 5000 });
  assert.equal(await colCards(page, 'in-progress').count(), 2, 't2 + t1 now in in-progress');
  assert.equal(await colCards(page, 'backlog').count(), 0);
  assert.equal(await colCount(page, 'in-progress').textContent(), '2');
  assert.equal(await colCount(page, 'backlog').textContent(), '0');
  // The emptied column shows the localized empty state.
  assert.match(await page.textContent('.funnel-cards[data-stage="backlog"] .funnel-empty'), /No tasks here yet/);
  await page.close();
});

test('a reload refetches the mocked list (persistence is the server half’s gate, not the client’s)', { skip: SKIP }, async () => {
  const page = await newPage();
  await openBoard(page);
  putLog.length = 0;
  await dragCard(page, 'Polish CV summary', 'in-progress');
  assert.ok(await waitForPutLog(page, 1));
  await page.reload();
  await page.waitForSelector('.funnel-board .funnel-card', { timeout: 10000 });
  // The mock's GET always serves the pristine fixture list — the reload
  // proves the client hydrates from the API rather than trusting local state.
  assert.equal(await colCards(page, 'backlog').count(), 1, 't1 back in backlog (fresh GET)');
  assert.equal(await colCards(page, 'in-progress').count(), 1);
  assert.equal(await colCards(page, 'done').count(), 1);
  await page.close();
});

test('a failed PUT reverts the card to its column and toasts the failure', { skip: SKIP }, async () => {
  const page = await newPage();
  await openBoard(page);
  putLog.length = 0;
  failPut = true;
  try {
    await dragCard(page, 'Prep Alpha interview', 'done');
    assert.ok(await waitForPutLog(page, 1), 'the PUT attempt fired');
    // The revert re-renders t2 back into in-progress.
    await page.waitForSelector('.funnel-cards[data-stage="in-progress"] .funnel-card:has-text("Prep Alpha interview")', { timeout: 5000 });
    assert.equal(await colCards(page, 'done').count(), 1, 't3 alone in done — t2 went back');
    assert.equal(await colCount(page, 'in-progress').textContent(), '1');
    const toast = await page.waitForSelector('.toast', { timeout: 5000 });
    assert.match(await toast.textContent(), /reverted/i, 'the localized failure toast fires');
  } finally {
    failPut = false;
    await page.close();
  }
});

test('keyboard: focus a card, ArrowRight performs one canonical move; Enter opens the card', { skip: SKIP }, async () => {
  const page = await newPage();
  await openBoard(page);
  putLog.length = 0;
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.funnel-card')].find((c) => c.textContent.includes('Polish CV summary'));
    card.focus();
  });
  await page.keyboard.press('ArrowRight');
  assert.ok(await waitForPutLog(page, 1));
  await page.waitForTimeout(250);
  assert.equal(putLog.length, 1, 'one PUT for one keypress');
  assert.deepEqual(putLog[0], { id: 't1', body: { status: 'in-progress' } });
  await page.waitForSelector('.funnel-cards[data-stage="in-progress"] .funnel-card:has-text("Polish CV summary")', { timeout: 5000 });
  // Enter opens the details modal for the card.
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.funnel-card')].find((c) => c.textContent.includes('Polish CV summary'));
    card.focus();
  });
  await page.keyboard.press('Enter');
  await page.waitForSelector('#modal:not([hidden])', { timeout: 5000 });
  assert.equal(await page.textContent('#modal-title'), 'Task');
  await page.close();
});

test('mobile 390px: the per-card status <select> moves the card (the no-drag mover)', { skip: SKIP }, async () => {
  const page = await newPage({ viewport: { width: 390, height: 844 } });
  await openBoard(page);
  putLog.length = 0;
  await page.locator('.funnel-card:has-text("Polish CV summary") select').selectOption('in-progress');
  assert.ok(await waitForPutLog(page, 1));
  await page.waitForTimeout(250);
  assert.equal(putLog.length, 1, 'one canonical PUT from the select');
  assert.deepEqual(putLog[0], { id: 't1', body: { status: 'in-progress' } });
  await page.waitForSelector('.funnel-cards[data-stage="in-progress"] .funnel-card:has-text("Polish CV summary")', { timeout: 5000 });
  // The board is the mobile horizontal strip, still fully usable.
  const strip = await page.evaluate(() => {
    const b = document.querySelector('.funnel-board');
    return { overflowX: getComputedStyle(b).overflowX, sw: b.scrollWidth, cw: b.clientWidth };
  });
  assert.match(strip.overflowX, /auto|scroll/, 'the strip scrolls horizontally on a phone');
  await page.close();
});

test('create via «+» opens the preselected modal; saving fires exactly one POST (and no PUT in the same column)', { skip: SKIP }, async () => {
  const page = await newPage();
  await openBoard(page);
  putLog.length = 0;
  postLog.length = 0;
  await page.locator('button[data-stage="backlog"][aria-label="Add task"]').click();
  await page.waitForSelector('#modal:not([hidden])', { timeout: 5000 });
  // The status select is preselected to the column the «+» came from.
  assert.equal(await page.locator('#tasks-create-status').inputValue(), 'backlog');
  await page.fill('#tasks-create-title', 'Book referencing call');
  await page.fill('#tasks-create-notes', 'ask Dmitri about the pipeline');
  await page.fill('#tasks-create-tags', 'networking, warm intro, networking');
  await page.locator('#modal-body button.btn-primary').click();
  await page.waitForSelector('#modal[hidden]', { state: 'attached', timeout: 5000 });
  assert.ok(await page.waitForFunction(() => document.querySelectorAll('.funnel-card').length === 4, null, { timeout: 5000 }),
    'the new card lands on the board');
  assert.equal(postLog.length, 1, 'exactly one POST');
  assert.deepEqual(postLog[0], {
    title: 'Book referencing call',
    notes: 'ask Dmitri about the pipeline',
    priority: 'normal',
    tags: ['networking', 'warm intro'],
  }, 'the POST body follows the pinned contract (tags cleaned, deduped)');
  assert.equal(putLog.length, 0, 'creating in the server-default column needs no follow-up PUT');
  assert.equal(await colCards(page, 'backlog').count(), 2, 't1 + the new task in backlog');
  assert.equal(await colCount(page, 'backlog').textContent(), '2');
  await page.close();
});

test('create from a non-default column: one POST + one canonical status PUT', { skip: SKIP }, async () => {
  const page = await newPage();
  await openBoard(page);
  putLog.length = 0;
  postLog.length = 0;
  await page.locator('button[data-stage="done"][aria-label="Add task"]').click();
  await page.waitForSelector('#modal:not([hidden])', { timeout: 5000 });
  assert.equal(await page.locator('#tasks-create-status').inputValue(), 'done', 'preselected to the done column');
  await page.fill('#tasks-create-title', 'Archive the old tracker');
  await page.locator('#modal-body button.btn-primary').click();
  await page.waitForFunction(() => document.querySelectorAll('.funnel-card').length === 4, null, { timeout: 5000 });
  assert.equal(postLog.length, 1, 'one POST');
  assert.equal(putLog.length, 1, 'one follow-up status PUT (the pinned POST carries no status)');
  assert.deepEqual(putLog[0], { id: 't-new', body: { status: 'done' } });
  await page.waitForSelector('.funnel-cards[data-stage="done"] .funnel-card:has-text("Archive the old tracker")', { timeout: 5000 });
  await page.close();
});
