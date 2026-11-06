/**
 * CAR-247 — browser gates for the #/stats «Детали» (Details) tab.
 *
 * Seeds a canned CAREER_OPS_ROOT (tracker rows + one report + a scan snapshot),
 * then drives the real tab: currency switch reformats salary figures (and
 * persists across a reload), the period selector drops older entries, search
 * narrows the drill-down table, and facet chips AND-compose.
 *
 * Opt-in (needs a browser binary): npm run test:e2e:browser
 * CI-isolated: throw-away CAREER_OPS_ROOT via mkdtempSync — never the user's
 * real career-ops data; no network beyond 127.0.0.1.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { BENIGN_CONSOLE } from './helpers/console-noise.mjs';
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

// Dates relative to now so the period windows are deterministic with wide
// margins (2d in month; 60d in quarter not month; 200d in year not quarter;
// 400d outside even the year).
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const iso = (n) => `${day(n)}T10:00:00Z`;

const TRACKER_ROWS = [
  // 42 is joined by the scan snapshot's Acme posting (salary/country/source join)
  `| 42 | ${day(2)} | Acme | Backend Engineer | 4.2/5 | Applied | ❌ | [42](reports/042-acme-2026-11-01.md) | | https://boards.greenhouse.io/acme/jobs/123 |`,
  `| 43 | ${day(60)} | Globex | Data Scientist | 3.0/5 | Interview | ✅ | — | | |`,
  `| 44 | ${day(200)} | Initech | Platform Engineer | 3.8/5 | Applied | ❌ | — | | |`,
  `| 45 | ${day(400)} | Umbrella | Designer | 2.5/5 | Evaluated | ❌ | — | | |`,
].join('\n');

const SCAN_ROWS = [
  { company: 'Acme', title: 'Senior Backend Engineer', location: 'Berlin, Germany', salary: '€90,000 - €110,000', date: iso(1), source: 'greenhouse', url: 'https://boards.greenhouse.io/acme/jobs/123' },
  { company: 'Stark', title: 'Data Scientist', location: 'New York, USA', salary: '$150k', date: iso(5), source: 'lever', url: 'https://jobs.lever.co/stark/9' },
  { company: 'Wayne', title: 'DevOps Engineer', location: 'Remote', salary: '', date: iso(10), source: 'ashby', url: 'https://jobs.ashbyhq.com/wayne/7' },
];

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-statsd-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  mkdirSync(resolve(dir, 'reports'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n\nReal Person, Senior Backend Engineer.\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Tester\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'x\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), [
    '# Applications Tracker',
    '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes | URL |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|-----|',
    TRACKER_ROWS,
    '',
  ].join('\n'));
  writeFileSync(resolve(dir, 'reports', '042-acme-2026-11-01.md'),
    '# Evaluation: Acme — Backend Engineer\n\n**Score:** 4.2/5\n');
  const snap = { en: { kind: 'en', when: new Date().toISOString(), fresh: SCAN_ROWS, filtered: SCAN_ROWS }, ru: null };
  writeFileSync(resolve(dir, 'data', 'last-scan.json'), JSON.stringify(snap));
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

async function newPage(opts) {
  const keepPrefs = opts && opts.keepPrefs;
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !BENIGN_CONSOLE.test(m.text())) errors.push(m.text()); });
  await page.addInitScript((keep) => {
    localStorage.setItem('career-ops-ui:lang', 'en');
    if (!keep) {
      localStorage.removeItem('career-ops-ui:statsCurrency');
      localStorage.removeItem('career-ops-ui:statsPeriod');
    }
  }, keepPrefs);
  return { page, errors };
}

/** Open #/stats and switch to the Details tab. */
async function openDetails() {
  const { page, errors } = await newPage();
  await page.goto(baseUrl + '/#/stats');
  await page.click('[role="tab"]:has-text("Details")');
  await page.waitForSelector('[data-testid="statsd-search"]', { timeout: 8000 });
  return { page, errors };
}
const rows = (page) => page.locator('[data-testid="statsd-tbody"] tr').count();
const acmeSalaryCell = (page) => page.locator('[data-testid="statsd-tbody"] tr', { hasText: 'Acme' }).first().locator('td').nth(5);

test('details tab: all 6 entries render (tracker + unmatched postings, join not duplicate)', { skip: SKIP }, async () => {
  const { page, errors } = await openDetails();
  assert.equal(await rows(page), 6, '4 tracked + 2 unmatched postings; the Acme scan row enriched #42');
  assert.deepEqual(errors, [], 'console errors: ' + errors.join(' | '));
  await page.close();
});

test('details tab: currency switch reformats salary figures and persists across reload', { skip: SKIP }, async () => {
  const { page } = await openDetails();
  // Default USD → the joined Acme salary shows a dollar figure.
  const usdCell = await acmeSalaryCell(page).innerText();
  assert.match(usdCell, /\$/, `USD default: got "${usdCell}"`);
  // Switch to EUR → every salary figure reforms to €.
  await page.selectOption('[data-testid="statsd-currency"]', 'EUR');
  await page.waitForFunction(() => {
    const td = [...document.querySelectorAll('[data-testid="statsd-tbody"] tr td')]
      .find((td) => td.textContent && td.textContent.includes('Acme') === false && td.textContent.includes('–'));
    return td && td.textContent.includes('€');
  });
  const eurCell = await acmeSalaryCell(page).innerText();
  assert.match(eurCell, /€/, `EUR switch: got "${eurCell}"`);
  assert.doesNotMatch(eurCell, /\$/, 'no dollar residue after the EUR switch');
  await page.close();

  // Persistence: a fresh page (prefs kept) reads career-ops-ui:statsCurrency.
  const { page: p2 } = await newPage({ keepPrefs: true });
  await p2.goto(baseUrl + '/#/stats');
  await p2.click('[role="tab"]:has-text("Details")');
  await p2.waitForSelector('[data-testid="statsd-search"]', { timeout: 8000 });
  assert.equal(await p2.getAttribute('[data-testid="statsd-currency"]', 'value') ||
    await p2.locator('[data-testid="statsd-currency"]').inputValue(), 'EUR', 'currency persisted');
  await p2.close();
});

test('details tab: period selector drops entries older than the window', { skip: SKIP }, async () => {
  const { page } = await openDetails();
  assert.equal(await rows(page), 6, 'All time → everything');
  await page.selectOption('[data-testid="statsd-period"]', 'year');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="statsd-tbody"] tr').length === 5,
    undefined, { timeout: 4000 });
  assert.equal(await rows(page), 5, 'year drops the 400-day-old Umbrella row');
  await page.selectOption('[data-testid="statsd-period"]', 'quarter');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="statsd-tbody"] tr').length === 4,
    undefined, { timeout: 4000 });
  assert.equal(await rows(page), 4, 'quarter additionally drops the 200-day-old Initech row');
  await page.selectOption('[data-testid="statsd-period"]', 'month');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="statsd-tbody"] tr').length === 3,
    undefined, { timeout: 4000 });
  assert.equal(await rows(page), 3, 'month keeps only Acme + the two fresh postings');
  await page.close();
});

test('details tab: search narrows the drill-down table (case-insensitive)', { skip: SKIP }, async () => {
  const { page } = await openDetails();
  await page.fill('[data-testid="statsd-search"]', 'stark');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="statsd-tbody"] tr').length === 1,
    undefined, { timeout: 4000 });
  assert.equal(await rows(page), 1);
  const first = await page.locator('[data-testid="statsd-tbody"] tr').first().innerText();
  assert.match(first, /Stark/);
  await page.fill('[data-testid="statsd-search"]', '');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="statsd-tbody"] tr').length === 6,
    undefined, { timeout: 4000 });
  await page.close();
});

test('details tab: facet chips AND-compose across groups, Reset clears', { skip: SKIP }, async () => {
  const { page } = await openDetails();
  // Country chip: Germany → only the joined Acme entry carries Germany.
  await page.click('[data-chip="country:Germany"]');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="statsd-tbody"] tr').length === 1,
    undefined, { timeout: 4000 });
  assert.equal(await rows(page), 1);
  // + Status chip Applied → AND still matches Acme (Applied + Germany).
  await page.click('[data-chip="status:Applied"]');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="statsd-tbody"] tr').length === 1,
    undefined, { timeout: 4000 });
  assert.equal(await rows(page), 1);
  // Flip the status chip to Interview → Germany AND Interview = nothing.
  await page.click('[data-chip="status:Applied"]');
  await page.click('[data-chip="status:Interview"]');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="statsd-tbody"] tr').length === 0,
    undefined, { timeout: 4000 });
  assert.equal(await rows(page), 0);
  assert.ok(await page.getByText('Nothing matches the current filters.').isVisible(), 'honest empty state');
  // Reset → everything back, chips cleared.
  await page.click('button:has-text("Reset")');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="statsd-tbody"] tr').length === 6,
    undefined, { timeout: 4000 });
  assert.equal(await rows(page), 6);
  assert.equal(await page.locator('.v2-statsd-chip.is-on').count(), 0, 'no chips left active');
  await page.close();
});

test('details tab: drill-down link navigates to the report view', { skip: SKIP }, async () => {
  const { page } = await openDetails();
  // The company cell carries the real link (keyboard-operable — the same
  // a11y contract that bans mouse-only row handlers).
  await page.click('[data-testid="statsd-tbody"] tr a', { hasText: 'Acme' });
  await page.waitForTimeout(300);
  assert.match(page.url(), /#\/reports\/042-acme/, 'company link → #/reports/{slug}');
  await page.close();
});
