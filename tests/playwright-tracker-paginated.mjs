/**
 * CAR-236 — the tracker pagination contract, in a real browser.
 *
 * Seeds 250 rows through the REAL POST /api/tracker writer, then pins what a
 * navigation costs and what each view shows:
 *   - #/tracker (table): exactly ONE /api/tracker GET, ?page=1&pageSize=200;
 *     page 1 renders 200 rows; the header count and the ALL tab read the
 *     whole-history total (250), never the page size.
 *   - the pager's next page: ONE more GET with page=2 → the remaining 50 rows.
 *   - the funnel flip: ONE all-rows GET (no paging params) → ALL 250 cards
 *     across the columns; flipping back to the table costs NOTHING (the pages
 *     derive locally from the cached allRows).
 *   - #/pipeline: exactly ONE /api/tracker GET; the overview chip counts 250.
 *   - #/stats: a full pass across every tab costs exactly ONE /api/tracker GET
 *     (the three tab renders share the mount's promise).
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT, 127.0.0.1 bind, no network.
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

const TOTAL_ROWS = 250; // > the table's 200-row page → page 2 must exist
const STATUSES = ['Evaluated', 'Applied', 'Interview', 'Offer', 'Hired', 'Rejected', 'Discarded', 'SKIP'];

before(async () => {
  if (SKIP) return;
  root = mkdtempSync(resolve(tmpdir(), 'pw-car236-'));
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
  // The bulk seeding loop deliberately exceeds the write limiter's designed
  // envelope (60 POSTs/min per route) — raise the documented cap for this
  // process only, before the server module (and its limiters) load.
  process.env.WRITE_RATE_LIMIT = '1000/60s';

  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });

  // Seed through the REAL writer (the same POST the pipeline uses) — bulk
  // loop, distinct company+role so the dedup never folds two seeds into one.
  for (let i = 1; i <= TOTAL_ROWS; i++) {
    const res = await fetch(baseUrl + '/api/tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: `Bulk ${i}`, role: `Role ${i}`, score: '4.0/5', status: STATUSES[i % STATUSES.length] }),
    });
    assert.equal(res.status, 200, `seed row ${i} written`);
  }

  browser = await playwright.chromium.launch({ headless: process.env.PWDEBUG !== '1' });
  context = await browser.newContext();
});

after(async () => {
  if (context) await context.close();
  if (browser) await browser.close();
  if (server) { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
  delete process.env.CAREER_OPS_ROOT;
  delete process.env.WRITE_RATE_LIMIT;
  if (root) rmSync(root, { recursive: true, force: true });
});

async function newPage() {
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('career-ops-ui:lang', 'en');
    localStorage.setItem('career-ops-ui:tracker-view', 'table');
    localStorage.removeItem('career-ops-ui:trackView');
  });
  return page;
}

// Every GET whose pathname is EXACTLY /api/tracker (the /stages endpoint and
// the status POSTs are different surfaces and never count).
function trackTrackerReads(page) {
  const urls = [];
  page.on('request', (r) => {
    try {
      if (r.method() === 'GET' && new URL(r.url()).pathname === '/api/tracker') urls.push(r.url());
    } catch { /* not a URL we care about */ }
  });
  return urls;
}

test('table: ONE paginated read per navigation; page 1 shows 200 of 250; whole-history counts', { skip: SKIP }, async () => {
  const page = await newPage();
  const reads = trackTrackerReads(page);
  await page.goto(baseUrl + '/#/tracker');
  await page.waitForSelector('table.tbl tbody tr');
  // Let the mount fan-out settle (stages/commute ride alongside; tracker reads must not).
  await page.waitForTimeout(400);
  assert.equal(reads.length, 1, `exactly ONE /api/tracker GET per navigation (got ${reads.length})`);
  assert.match(reads[0], /page=1&pageSize=200/, 'the table fetches the documented first server page');
  assert.equal(await page.locator('table.tbl tbody tr').count(), 200, 'page 1 renders 200 rows');
  // Whole-history numbers, not page numbers: the header subtitle and the ALL tab.
  const subtitle = await page.textContent('.page-subtitle');
  assert.match(subtitle, /250/, 'the header count is the whole-history total');
  const allTab = await page.textContent('.tracker-tab');
  assert.match(allTab, /250/, 'the ALL tab carries the whole-history count');
  await page.close();
});

test('the pager pages server-side: next → ONE more read (page=2) → the remaining 50 rows', { skip: SKIP }, async () => {
  const page = await newPage();
  const reads = trackTrackerReads(page);
  await page.goto(baseUrl + '/#/tracker');
  await page.waitForSelector('table.tbl tbody tr');
  await page.waitForTimeout(300);
  const before = reads.length;
  await page.locator('button[title="Next"]').click();
  await page.waitForFunction(() => document.querySelectorAll('table.tbl tbody tr').length === 50, { timeout: 10000 });
  assert.equal(reads.length, before + 1, 'the page change costs exactly ONE tracker read');
  assert.match(reads[reads.length - 1], /page=2&pageSize=200/, 'the pager fetches the documented second page');
  assert.equal(await page.locator('table.tbl tbody tr').count(), 50, 'page 2 renders the remaining 50 rows');
  await page.close();
});

test('funnel flip: ONE all-rows read → 250 cards; flipping back costs nothing', { skip: SKIP }, async () => {
  const page = await newPage();
  const reads = trackTrackerReads(page);
  await page.goto(baseUrl + '/#/tracker');
  await page.waitForSelector('table.tbl tbody tr');
  await page.waitForTimeout(300);
  const tableReads = reads.length;
  await page.getByRole('button', { name: 'Funnel', exact: true }).click();
  await page.waitForSelector('.funnel-board .funnel-card');
  await page.waitForTimeout(400);
  assert.equal(reads.length, tableReads + 1, 'the board flip adds exactly ONE tracker read');
  assert.ok(!/[?&]page=/.test(reads[reads.length - 1]), 'the board read carries NO paging params (all rows)');
  assert.equal(await page.locator('.funnel-card').count(), TOTAL_ROWS, `ALL ${TOTAL_ROWS} applications across the columns`);
  // Flip back — the table derives its page from the cached allRows (fresh
  // after any board move) and must not re-fetch.
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await page.waitForSelector('table.tbl tbody tr');
  await page.waitForTimeout(400);
  assert.equal(reads.length, tableReads + 1, 'flipping back to the table costs ZERO tracker reads');
  assert.equal(await page.locator('table.tbl tbody tr').count(), 200, 'the table shows its 200-row page again');
  await page.close();
});

test('pipeline: ONE tracker read per navigation; the overview chip counts all 250', { skip: SKIP }, async () => {
  const page = await newPage();
  const reads = trackTrackerReads(page);
  await page.goto(baseUrl + '/#/pipeline');
  // The fixture pipeline is empty — wait for the OVERVIEW strip (always
  // painted at mount), then read the tracked chip off it.
  await page.waitForSelector('a[href="#/tracker"]');
  await page.waitForTimeout(500);
  assert.equal(reads.length, 1, `exactly ONE /api/tracker GET per navigation (got ${reads.length})`);
  const chip = await page.locator('a[href="#/tracker"]:has-text("tracked")').first().textContent();
  assert.match(chip, /250/, 'the tracked chip shows the whole tracker count');
  await page.close();
});

test('stats: a full pass across every tab costs exactly ONE tracker read', { skip: SKIP }, async () => {
  const page = await newPage();
  const reads = trackTrackerReads(page);
  await page.goto(baseUrl + '/#/stats');
  await page.waitForSelector('.v2-stats-tab');
  const tabs = page.locator('.v2-stats-tab');
  const n = await tabs.count();
  assert.ok(n >= 3, 'the stats view exposes its tab strip');
  for (let i = 0; i < n; i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(350); // each tab render settles before the next click
  }
  await page.waitForTimeout(500);
  assert.equal(reads.length, 1, `a full tab pass costs ONE /api/tracker GET (got ${reads.length}: ${reads.join(' | ')})`);
  await page.close();
});
