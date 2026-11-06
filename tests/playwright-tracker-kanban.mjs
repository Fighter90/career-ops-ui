/**
 * CAR-237 — the «Воронка» funnel board, in a real browser: column map from
 * /api/tracker/stages (zero-count columns visible), HTML5 drag&drop writing
 * the canonical POST /api/tracker/status, optimistic move + revert on a
 * failed POST, the keyboard fallback, the notes/interview modal, and the
 * career-ops-ui:trackView persistence.
 *
 * Two interaction notes (inherited from playwright-tracker-v2.mjs):
 *   - Headless Chromium does not start native HTML5 DnD from synthetic mouse
 *     moves, so the drag gate dispatches real DragEvents with a DataTransfer
 *     through the board's own wiring.
 *   - set-status.mjs is FAKED inside the throw-away CAREER_OPS_ROOT with a
 *     variant that actually rewrites the Status cell + appends the note to
 *     data/applications.md (tests/fixtures/fake-set-status-kanban.mjs) — so
 *     "page reload keeps it" proves the canonical relay wrote the parent
 *     file, not just client state. A sibling set-status-mock.json drives the
 *     failure mode for the revert gate.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT, 127.0.0.1 bind, no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
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

let server, baseUrl, browser, context, root, mockCtl;

// The fake canonical writer (tests/fixtures/fake-set-status-kanban.mjs) is
// copied into the throw-away CAREER_OPS_ROOT — the same convention
// tests/tracker-inline-status.test.mjs uses for its echo-only variant.
const FAKE_SET_STATUS_PATH = resolve(__dirname, 'fixtures', 'fake-set-status-kanban.mjs');

const TRACKER = [
  '# Applications Tracker',
  '',
  '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
  '|---|------|---------|------|-------|--------|-----|--------|-------|',
  '| 1 | 2026-10-01 | Alpha | Backend Engineer | 4.2/5 | Evaluated | ❌ | — | |',
  '| 2 | 2026-10-02 | Beta | Frontend Engineer | 3.9/5 | Applied | ❌ | — | |',
  '| 3 | 2026-10-03 | Gamma | Platform Engineer | 4.5/5 | Interview | ❌ | — | |',
  '| 4 | 2026-10-04 | Delta | Data Engineer | 4.0/5 | Offer | ❌ | — | |',
  '',
].join('\n');

before(async () => {
  if (SKIP) return;
  root = mkdtempSync(resolve(tmpdir(), 'pw-car237-'));
  mkdirSync(resolve(root, 'config'), { recursive: true });
  mkdirSync(resolve(root, 'data'), { recursive: true });
  mkdirSync(resolve(root, 'modes'), { recursive: true });
  writeFileSync(resolve(root, 'cv.md'), '# CV\n\nReal Person, Senior Backend Engineer.\n');
  writeFileSync(resolve(root, 'config', 'profile.yml'), 'candidate:\n  full_name: Tester\n');
  writeFileSync(resolve(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(root, 'modes', 'oferta.md'), 'x\n');
  writeFileSync(resolve(root, 'data', 'applications.md'), TRACKER);
  writeFileSync(resolve(root, 'set-status.mjs'), readFileSync(FAKE_SET_STATUS_PATH, 'utf8'));
  mockCtl = resolve(root, 'set-status-mock.json');

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

async function newPage({ view = null } = {}) {
  const page = await context.newPage();
  await page.addInitScript((v) => {
    localStorage.setItem('career-ops-ui:lang', 'en');
    localStorage.setItem('career-ops-ui:tracker-view', 'table');
    if (v) localStorage.setItem('career-ops-ui:trackView', v);
    else localStorage.removeItem('career-ops-ui:trackView');
  }, view);
  return page;
}

async function openFunnel(page) {
  await page.goto(baseUrl + '/#/tracker');
  await page.waitForSelector('table.tbl tbody tr', { timeout: 10000 });
  await page.getByRole('button', { name: 'Funnel', exact: true }).click();
  await page.waitForSelector('.funnel-board .funnel-card', { timeout: 10000 });
}

const columnCards = (page, stage) => page.locator(`.funnel-cards[data-stage="${stage}"] .funnel-card`);

// Reset the seeded tracker file (the server + fake writer share this root
// across tests, so every test starts from the same pristine board).
function resetTracker() {
  writeFileSync(resolve(root, 'data', 'applications.md'), TRACKER);
}

// The move POST is async behind the OPTIMISTIC render — the card appears in
// the target column before the relay has written the file. Poll the API from
// the NODE side (waitForFunction's raf polling proved unreliable for an
// async predicate in headless) until the status actually persisted.
async function waitForPersisted(page, company, status, { timeoutMs = 8000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const rows = await trackerRows(page);
    const r = rows.find((x) => x.company === company);
    last = r && r.status;
    if (last === status) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

async function trackerRows(page) {
  return page.evaluate(async () => {
    const r = await fetch('/api/tracker');
    const j = await r.json();
    return j.rows || [];
  });
}

test('columns = the canonical funnel incl. zero-count stages; cards land in their columns', { skip: SKIP }, async () => {
  const page = await newPage();
  await openFunnel(page);
  for (const stage of ['Evaluated', 'Applied', 'Interview', 'Offer', 'Hired', 'Rejected', 'Discarded', 'SKIP']) {
    const n = await page.locator(`.funnel-cards[data-stage="${stage}"]`).count();
    assert.equal(n, 1, `column ${stage} exists (zero-count columns stay visible)`);
  }
  assert.equal(await columnCards(page, 'Evaluated').count(), 1, 'Alpha in Evaluated');
  assert.equal(await columnCards(page, 'Applied').count(), 1, 'Beta in Applied');
  assert.equal(await columnCards(page, 'Offer').count(), 1, 'Delta in Offer');
  // Count badges carry aria-live.
  assert.equal(await page.locator('.funnel-col-count[aria-live="polite"]').count() >= 8, true);
  // Every card is keyboard-reachable and carries the canonical payload hint.
  assert.equal(await page.locator('.funnel-card[tabindex="0"][draggable="true"]').count(), 4);
  // The board head carries the localized title with the HelpHint affordance.
  assert.equal(await page.locator('.funnel-head .help-hint').count(), 1);
  await page.close();
});

test('drag a card Evaluated → Applied: POST fires, the card lands, a reload keeps it', { skip: SKIP }, async () => {
  resetTracker();
  const page = await newPage();
  await openFunnel(page);
  const fired = await page.evaluate(() => new Promise((resolve) => {
    const orig = window.fetch;
    let hit = false;
    window.fetch = (...args) => {
      const [url, opts] = args;
      if (String(url).includes('/api/tracker/status') && opts && opts.method === 'POST') {
        hit = true;
        window.__car237Body = opts.body;
      }
      return orig.apply(window, args);
    };
    const card = [...document.querySelectorAll('.funnel-card')].find((c) => c.textContent.includes('Alpha'));
    const host = document.querySelector('.funnel-cards[data-stage="Applied"]');
    if (!card || !host) return resolve(false);
    const dt = new DataTransfer();
    card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    host.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
    host.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
    card.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    setTimeout(() => { window.fetch = orig; resolve(hit ? window.__car237Body : 'no-post'); }, 1500);
  }));
  assert.equal(typeof fired, 'string', 'the POST fired (the intercepted body came back)');
  const body = JSON.parse(fired);
  assert.deepEqual(body, { row: 1, state: 'Applied' }, 'the body is the canonical relay contract');
  // The card re-rendered into the target column (optimistic state).
  await page.waitForSelector('.funnel-cards[data-stage="Applied"] .funnel-card', { timeout: 5000 });
  assert.equal(await columnCards(page, 'Applied').count(), 2, 'Beta + Alpha now in Applied');
  // The file was rewritten by the (faked) canonical writer — a reload keeps it.
  await page.reload();
  await page.waitForSelector('table.tbl tbody tr', { timeout: 10000 });
  const rows = await trackerRows(page);
  const alpha = rows.find((r) => r.company === 'Alpha');
  assert.equal(alpha && alpha.status, 'Applied', 'the status persisted through the relay');
  await page.close();
});

test('a failed POST reverts the card to its column (optimistic move undone + toast)', { skip: SKIP }, async () => {
  resetTracker();
  writeFileSync(mockCtl, JSON.stringify({ code: 1 }));
  const page = await newPage();
  try {
    await openFunnel(page);
    await page.evaluate(() => {
      const card = [...document.querySelectorAll('.funnel-card')].find((c) => c.textContent.includes('Gamma'));
      const host = document.querySelector('.funnel-cards[data-stage="Offer"]');
      const dt = new DataTransfer();
      card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      host.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
      host.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
      card.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    });
    // The revert re-renders Gamma back into Interview.
    await page.waitForSelector('.funnel-cards[data-stage="Interview"] .funnel-card:has-text("Gamma")', { timeout: 5000 });
    assert.equal(await columnCards(page, 'Offer').count(), 1, 'Delta alone in Offer — Gamma went back');
    await page.waitForSelector('.toast', { timeout: 5000 });
  } finally {
    rmSync(mockCtl, { force: true });
    await page.close();
  }
});

test('keyboard: focus a card, ArrowRight performs the same canonical move', { skip: SKIP }, async () => {
  resetTracker();
  const page = await newPage();
  await openFunnel(page);
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.funnel-card')].find((c) => c.textContent.includes('Alpha'));
    card.focus();
  });
  await page.keyboard.press('ArrowRight');
  await page.waitForSelector('.funnel-cards[data-stage="Applied"] .funnel-card:has-text("Alpha")', { timeout: 5000 });
  await waitForPersisted(page, 'Alpha', 'Applied');
  // Enter opens the notes modal.
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.funnel-card')].find((c) => c.textContent.includes('Alpha'));
    card.focus();
  });
  await page.keyboard.press('Enter');
  await page.waitForSelector('#modal:not([hidden])', { timeout: 5000 });
  assert.match(await page.textContent('#modal-title'), /Notes/i);
  await page.close();
});

test('the modal saves [Заметки] / [Собеседование: …] markers through the relay', { skip: SKIP }, async () => {
  resetTracker();
  const page = await newPage();
  await openFunnel(page);
  await page.locator('.funnel-menu[data-num="2"]').click();
  await page.waitForSelector('#modal:not([hidden])', { timeout: 5000 });
  await page.fill('#funnel-notes', 'recruiter call booked');
  await page.fill('#funnel-at', '2026-11-20T14:30');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForSelector('#modal[hidden]', { state: 'attached', timeout: 5000 });
  const rows = await trackerRows(page);
  const beta = rows.find((r) => r.company === 'Beta');
  assert.match(beta.notes || '', /\[Заметки\] recruiter call booked/, 'the notes marker is in the Notes cell');
  assert.match(beta.notes || '', /\[Собеседование: 2026-11-20 14:30\]/, 'the interview marker is in the Notes cell');
  assert.equal(beta.status, 'Applied', 'the notes save never moved the status');
  // A reload keeps the markers (they went through the canonical writer).
  await page.reload();
  await page.waitForSelector('table.tbl tbody tr', { timeout: 10000 });
  const rows2 = await trackerRows(page);
  assert.match(rows2.find((r) => r.company === 'Beta').notes || '', /\[Заметки\]/);
  await page.close();
});

test('the modal status <select> moves the card (the no-drag / mobile mover)', { skip: SKIP }, async () => {
  resetTracker();
  const page = await newPage();
  await openFunnel(page);
  await page.locator('.funnel-menu[data-num="2"]').click();
  await page.waitForSelector('#modal:not([hidden])', { timeout: 5000 });
  await page.selectOption('#funnel-status-sel', 'Interview');
  await page.waitForSelector('.funnel-cards[data-stage="Interview"] .funnel-card:has-text("Beta")', { timeout: 5000 });
  const persisted = await waitForPersisted(page, 'Beta', 'Interview');
  assert.ok(persisted, 'the select move persisted through the relay');
  const rows = await trackerRows(page);
  assert.equal(rows.find((r) => r.company === 'Beta').status, 'Interview', 'the select persisted the move');
  await page.close();
});

test('the view choice persists (career-ops-ui:trackView) and mobile keeps the strip usable', { skip: SKIP }, async () => {
  resetTracker();
  // A persisted funnel preference opens the board WITHOUT a click.
  const page = await newPage({ view: 'funnel' });
  await page.goto(baseUrl + '/#/tracker');
  await page.waitForSelector('.funnel-board .funnel-card', { timeout: 10000 });
  // Switch back to the table — the key flips to 'table'.
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await page.waitForSelector('table.tbl tbody tr', { timeout: 10000 });
  const stored = await page.evaluate(() => localStorage.getItem('career-ops-ui:trackView'));
  assert.equal(stored, 'table');
  await page.close();

  // Mobile <900px: the board is a horizontal scroll strip, cards reachable.
  const mob = await context.newPage();
  await mob.addInitScript(() => {
    localStorage.setItem('career-ops-ui:lang', 'en');
    localStorage.setItem('career-ops-ui:trackView', 'funnel');
  });
  await mob.setViewportSize({ width: 390, height: 844 });
  await mob.goto(baseUrl + '/#/tracker');
  await mob.waitForSelector('.funnel-board .funnel-card', { timeout: 10000 });
  const scroll = await mob.evaluate(() => {
    const b = document.querySelector('.funnel-board');
    return { overflowX: getComputedStyle(b).overflowX, sw: b.scrollWidth, cw: b.clientWidth };
  });
  assert.match(scroll.overflowX, /auto|scroll/, 'the strip scrolls horizontally on a phone');
  assert.ok(scroll.sw > scroll.cw, '10 columns overflow a 390px viewport — the strip is real');
  await mob.close();
});
