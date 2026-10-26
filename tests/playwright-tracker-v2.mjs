/**
 * CAR-117 — #/tracker v2 browser gates: the status kanban (drag&drop +
 * keyboard Move), the previewed outcome-relay write path, the destructive
 * UI.confirm gate, the moves-off degradation, and the table-grid fix — the
 * parts that only exist in a real DOM. There is NO undo (r2 #1: the outcome
 * writer is append-only — a "revert" would fabricate history); the first
 * test pins the undo bar staying deleted.
 *
 * Two interaction notes for the next editor:
 *   - Headless Chromium does not start native HTML5 DnD from synthetic mouse
 *     moves (Playwright dragTo fires zero dragstart events here), so the DnD
 *     gate dispatches real DragEvents with a DataTransfer through the board's
 *     own wiring — the browser's native drag initiation is not our code.
 *   - Every test re-navigates, so the tracker reloads from the seeded file:
 *     client-side status mutations do NOT persist between tests.
 *
 * The parent outcome.mjs is STUBBED inside the throw-away CAREER_OPS_ROOT
 * (it prints the success JSON and exits 0), so the full write path runs
 * with zero network and zero real parent involvement.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT, 127.0.0.1 bind, no external calls.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
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
const playwright = resolvePlaywright();
const SKIP = !playwright;

let server, baseUrl, browser, context;

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-car117-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n\nReal Person, Senior Backend Engineer.\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Tester\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'x\n');
  // Four rows: Alpha/Interview + Delta/Offer are writable-FROM states (undo
  // batches need both ends writable); Beta/Applied + Gamma/SKIP sit in
  // read-only columns, so one fixture covers both kanban kinds.
  writeFileSync(resolve(dir, 'data', 'applications.md'),
    '# Applications Tracker\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n' +
    '|---|------|---------|------|-------|--------|-----|--------|-------|\n' +
    '| 1 | 2026-10-01 | Alpha | Backend Engineer | 4.2/5 | Interview | ❌ | — | |\n' +
    '| 2 | 2026-10-02 | Beta | Frontend Engineer | 3.9/5 | Applied | ❌ | — | |\n' +
    '| 3 | 2026-10-03 | Gamma | Platform Engineer | 4.5/5 | SKIP | ❌ | — | |\n' +
    '| 4 | 2026-10-04 | Delta | Data Engineer | 4.0/5 | Offer | ❌ | — | |\n');
  // Stub of the parent outcome.mjs — the route spawns `node outcome.mjs …`
  // with cwd = CAREER_OPS_ROOT; printing the success JSON is all the write
  // path needs (the client applies the status locally from the preview).
  writeFileSync(resolve(dir, 'outcome.mjs'),
    'process.stdout.write(JSON.stringify({ ok: true, num: process.argv[2] || "000", company: "stub", canonicalState: "stub" }) + "\\n");\n');

  process.env.CAREER_OPS_ROOT = dir;
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
});

async function newPage() {
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('career-ops-ui:lang', 'en');
    localStorage.setItem('career-ops-ui:tracker-view', 'table');
  });
  return page;
}

async function openTracker(page) {
  await page.goto(baseUrl + '/#/tracker');
  await page.waitForSelector('table.tbl tbody tr', { timeout: 10000 });
}

// Click "Kanban" and wait for the board to carry the seeded cards.
async function openKanban(page) {
  await page.getByRole('button', { name: 'Kanban', exact: true }).click();
  await page.waitForSelector('.v2-track-board .v2-track-card', { timeout: 10000 });
}

// The labelled cards host of one column ("Interview — 1 (…)").
const column = (page, label) => page.locator(`.v2-track-cards[aria-label^="${label} —"]`);

// Drag a card onto a column host through the board's own DnD wiring.
async function dragCard(page, card, targetLabel) {
  const ok = await page.evaluate(([cardText, label]) => {
    const el = [...document.querySelectorAll('.v2-track-card')].find((c) => c.textContent.includes(cardText));
    const host = [...document.querySelectorAll('.v2-track-cards')]
      .find((h) => (h.getAttribute('aria-label') || '').startsWith(label + ' —'));
    if (!el || !host) return false;
    const dt = new DataTransfer();
    el.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    host.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    host.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    el.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    return true;
  }, [card, targetLabel]);
  assert.ok(ok, 'card and target column found');
}

// Walk the move dialog: choose a target (selector step), preview, apply.
async function moveViaDialog(page, target) {
  await page.waitForSelector('#modal select', { timeout: 5000 });
  if (target) await page.selectOption('#modal select', target);
  await page.getByRole('button', { name: 'Preview move' }).click();
  await page.waitForSelector('#modal ul li', { timeout: 5000 });
  await page.locator('#modal button', { hasText: /^Move \d+$/ }).click();
}

// ── grid fix ─────────────────────────────────────────────────────────────────

test('CAR-117: table dates stay on one line and the header is sticky', { skip: SKIP }, async () => {
  const page = await newPage();
  await openTracker(page);
  const dateCell = page.locator('table.tbl tbody tr', { hasText: 'Alpha' }).locator('td').nth(2);
  assert.equal(await dateCell.evaluate((el) => getComputedStyle(el).whiteSpace), 'nowrap');
  const th = page.locator('table.tbl thead th').first();
  assert.equal(await th.evaluate((el) => getComputedStyle(el).position), 'sticky');
  await page.close();
});

// ── kanban structure + a11y ──────────────────────────────────────────────────

test('CAR-117: kanban renders labelled columns, writable + read-only kinds, and per-card Move controls', { skip: SKIP }, async () => {
  const page = await newPage();
  await openTracker(page);
  await openKanban(page);
  // the board is a list; the table is hidden
  assert.equal(await page.locator('.v2-track-board[role="list"]').count(), 1);
  assert.equal(await page.locator('table.tbl').isHidden(), true);
  // writable column contains the Alpha card; read-only column carries the marker
  assert.equal(await column(page, 'Interview').locator('.v2-track-card', { hasText: 'Alpha' }).count(), 1);
  const appliedCol = column(page, 'Applied');
  assert.equal(await appliedCol.locator('.v2-track-card', { hasText: 'Beta' }).count(), 1);
  assert.match(await appliedCol.getAttribute('aria-label'), /read-only/);
  // every card exposes an explicit keyboard Move control (drag is never the only way)
  const moveButtons = page.locator('.v2-track-card .v2-track-move');
  assert.equal(await moveButtons.count(), 4);
  assert.match(await moveButtons.first().getAttribute('aria-label'), /^Move to another status — #/);
  await page.close();
});

// ── keyboard move → preview → write → undo ───────────────────────────────────

test('CAR-117: keyboard move previews, writes through /api/outcome; NO undo exists (r2 #1)', { skip: SKIP }, async () => {
  const page = await newPage();
  await openTracker(page);
  await openKanban(page);
  await column(page, 'Interview').locator('.v2-track-move').first().click();
  await moveViaDialog(page, 'Offer');
  // success toast + the card changed columns
  await page.waitForFunction(() => document.querySelector('#toast .toast-msg')?.textContent?.includes('Moved 1 row(s) to Offer'), { timeout: 10000 });
  assert.equal(await column(page, 'Offer').locator('.v2-track-card', { hasText: 'Alpha' }).count(), 1);
  // the undo bar stays DELETED: the outcome writer only appends, so nothing
  // in this UI may present itself as undo (r2 #1).
  assert.equal(await page.locator('#tracker-undo-bar').count(), 0);
  await page.close();
});

// ── drag & drop ──────────────────────────────────────────────────────────────

test('CAR-117: dragging a card onto a writable column opens the same preview and moves it', { skip: SKIP }, async () => {
  const page = await newPage();
  await openTracker(page);
  await openKanban(page);
  await dragCard(page, 'Alpha', 'Hired');
  await page.waitForSelector('#modal ul li', { timeout: 5000 });
  assert.match(await page.locator('#modal ul li').first().textContent(), /Interview → Hired/);
  await page.locator('#modal button', { hasText: /^Move 1$/ }).click();
  await page.waitForSelector('#toast .toast-msg', { timeout: 10000 });
  assert.equal(await column(page, 'Hired').locator('.v2-track-card', { hasText: 'Alpha' }).count(), 1);
  await page.close();
});

// ── destructive gate ─────────────────────────────────────────────────────────

test('CAR-117: a move to Rejected passes UI.confirm before anything is written', { skip: SKIP }, async () => {
  const page = await newPage();
  await openTracker(page);
  await openKanban(page);
  await dragCard(page, 'Alpha', 'Rejected');
  await page.waitForSelector('#modal ul li', { timeout: 5000 });
  await page.locator('#modal button', { hasText: /^Move 1$/ }).click();
  // UI.confirm's dialog comes FIRST; the write happens only after it.
  await page.waitForSelector('#modal .btn-danger', { timeout: 5000 });
  assert.match(await page.locator('#modal').textContent(), /Record 1 outcome\(s\)\?/);
  await page.locator('#modal button', { hasText: 'Write moves' }).click();
  await page.waitForSelector('#toast .toast-msg', { timeout: 10000 });
  assert.equal(await column(page, 'Rejected').locator('.v2-track-card', { hasText: 'Alpha' }).count(), 1);
  await page.close();
});

// ── moves-off degradation ────────────────────────────────────────────────────

test('CAR-117: a failing outcome writer degrades to a read-only board without crashing', { skip: SKIP }, async () => {
  const page = await newPage();
  // r2 #9 — the pageerror listener is registered BEFORE anything fails.
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // 422 WITHOUT a CLI code = the structured unavailable-writer signal the
  // client keys the degradation on (handled CLI failures answer 400 + code).
  await page.route('**/api/outcome', (route) => route.fulfill({ status: 422, body: JSON.stringify({ error: 'outcome.mjs not found in the parent project' }) }));
  await openTracker(page);
  await openKanban(page);
  await column(page, 'Applied').locator('.v2-track-move').first().click();
  await moveViaDialog(page, 'Interview');
  // The raw relay error surfaces (the toast may not exist yet → wait on text).
  await page.waitForFunction(() => document.querySelector('#toast')?.textContent?.includes('outcome.mjs not found'), { timeout: 10000 });
  assert.equal(await page.locator('.v2-track-card').count(), 4);
  // The board is genuinely read-only now: pressing Move explains, and a drop
  // onto a writable column opens NO preview modal.
  await column(page, 'Applied').locator('.v2-track-move').first().click();
  await page.waitForFunction(() => document.querySelector('#toast')?.textContent?.includes('Status moves are unavailable'), { timeout: 10000 });
  await dragCard(page, 'Beta', 'Interview');
  await page.waitForTimeout(400);
  // visibility-scoped: closeModal keeps the last dialog's nodes in the hidden
  // #modal, so a bare count would count stale children.
  assert.equal(await page.locator('#modal ul li:visible').count(), 0, 'no write path after degradation');
  assert.deepEqual(errors, [], 'no uncaught errors: ' + errors.join(' | '));
  await page.close();
});

// ── bulk ─────────────────────────────────────────────────────────────────────

test('CAR-117: select-all feeds the bulk bar and the preview moves every selected row', { skip: SKIP }, async () => {
  const page = await newPage();
  await openTracker(page);
  // r2 #6 — the HEADER select-all (not per-row checkboxes): the bar must
  // reflect the selection immediately, count rendered as the full localized
  // sentence (r2 #11).
  await page.locator('table.tbl thead input[type="checkbox"]').check();
  await page.waitForSelector('.v2-bulkbar:not([hidden])', { timeout: 5000 });
  assert.match(await page.locator('.v2-bulk-count').textContent(), /\b4\b/);
  await page.selectOption('.v2-bulkbar select', 'Hired');
  await page.locator('.v2-bulkbar button', { hasText: 'Move' }).first().click();
  await page.waitForSelector('#modal ul li', { timeout: 5000 });
  assert.equal(await page.locator('#modal ul li').count(), 4);
  await page.locator('#modal button', { hasText: /^Move 4$/ }).click();
  await page.waitForFunction(() => document.querySelector('#toast .toast-msg')?.textContent?.includes('Moved 4 row(s) to Hired'), { timeout: 15000 });
  // no undo bar exists to offer a restore (r2 #1)
  assert.equal(await page.locator('#tracker-undo-bar').count(), 0);
  await page.close();
});
