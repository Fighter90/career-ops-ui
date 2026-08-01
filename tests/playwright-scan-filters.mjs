/**
 * Playwright interaction harness for the #/scan results table + filters.
 *
 * Purpose: a REGRESSION BASELINE for the scan.js results-subsystem refactor
 * (v1.132.0). It seeds a canned `data/last-scan.json` (so `GET /api/scan-results`
 * returns a known corpus without any network), loads `#/scan`, and drives every
 * client-side filter — asserting the exact visible row count each time. The
 * extraction of `renderResults`/`buildChipRow` into `window.ScanResults` MUST
 * keep every one of these assertions green.
 *
 * Opt-in (needs a browser binary; Playwright is the parent's dep, not ours):
 *   npm run test:e2e:browser
 *
 * CI-isolated: a throw-away CAREER_OPS_ROOT via mkdtempSync — never the user's
 * real career-ops data.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function resolvePlaywright() {
  for (const id of ['playwright', resolve(process.cwd(), '..', 'node_modules', 'playwright'), resolve(process.cwd(), 'node_modules', 'playwright')]) {
    try { return require(id); } catch {}
  }
  return null;
}
const playwright = resolvePlaywright();
const SKIP = !playwright;

let server, baseUrl, browser, context;

// ── canned corpus — one row per filter dimension we assert on ────────────────
// Dates are ISO strings relative to now so the age filter + freshness cells are
// deterministic (dates are allowed in test files).
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
const ROWS = [
  { company: 'Acme',    title: 'Senior Backend Engineer',  location: 'Berlin, Germany', source: 'greenhouse', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(0),  salary: '90000 EUR', url: 'https://example.com/j/1' },
  { company: 'Globex',  title: 'Staff Platform Engineer',  location: 'Remote',          source: 'lever',      isRemote: true,  workplaceType: 'Remote', relocates: false, date: iso(3),  salary: '',          url: 'https://example.com/j/2' },
  { company: 'Initech', title: 'Junior Developer',         location: 'London, UK',      source: 'ashby',      isRemote: false, workplaceType: 'Hybrid', relocates: false, date: iso(10), salary: '',          url: 'https://example.com/j/3' },
  { company: 'Umbrella',title: 'Engineering Manager',      location: 'Remote',          source: 'remoteok',   isRemote: true,  workplaceType: 'Remote', relocates: false, date: iso(40), salary: '',          url: 'https://example.com/j/4' },
  { company: 'Stark',   title: 'Data Scientist',           location: 'New York, USA',   source: 'greenhouse', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(0),  salary: '',          url: 'https://example.com/j/5' },
  { company: 'Wayne',   title: 'Senior Data Engineer',     location: 'Toronto, Canada', source: 'lever',      isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(2),  salary: '',          url: 'https://example.com/j/6' },
];

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-scan-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Tester\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'x\n');
  // The corpus the SPA reads via GET /api/scan-results (server reads this file).
  const snap = { en: { kind: 'en', when: new Date().toISOString(), fresh: ROWS, filtered: ROWS }, ru: null };
  writeFileSync(resolve(dir, 'data', 'last-scan.json'), JSON.stringify(snap));
  process.env.CAREER_OPS_ROOT = dir;

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

// Open #/scan and wait for the canned corpus to render.
async function openScan() {
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(baseUrl + '/#/scan');
  await page.waitForSelector('#scan-results table tbody tr', { timeout: 8000 });
  return { page, errors };
}
const rowCount = (page) => page.locator('#scan-results table tbody tr').count();
// Apply a <select> value and let the synchronous re-render settle.
async function pick(page, id, value) { await page.selectOption(id, value); await page.waitForTimeout(60); }

test('scan filters: baseline corpus renders all rows, no console errors', { skip: SKIP }, async () => {
  const { page, errors } = await openScan();
  assert.equal(await rowCount(page), ROWS.length, 'all seeded rows should render');
  assert.deepEqual(errors, [], 'console errors: ' + errors.join(' | '));
  await page.close();
});

test('scan filters: Source dropdown filters by adapter', { skip: SKIP }, async () => {
  const { page } = await openScan();
  await pick(page, '#scan-filter-source', 'greenhouse');
  assert.equal(await rowCount(page), 2, 'greenhouse → Acme + Stark');
  await pick(page, '#scan-filter-source', 'lever');
  assert.equal(await rowCount(page), 2, 'lever → Globex + Wayne');
  await pick(page, '#scan-filter-source', '');
  assert.equal(await rowCount(page), ROWS.length, 'cleared → all rows');
  await page.close();
});

test('scan filters: Seniority facet buckets by title', { skip: SKIP }, async () => {
  const { page } = await openScan();
  await pick(page, '#scan-filter-seniority', 'senior');
  assert.equal(await rowCount(page), 2, 'senior → Senior Backend + Senior Data');
  await pick(page, '#scan-filter-seniority', 'staff');
  assert.equal(await rowCount(page), 1, 'staff → Staff Platform');
  await pick(page, '#scan-filter-seniority', '');
  assert.equal(await rowCount(page), ROWS.length);
  await page.close();
});

test('scan filters: Remote work-type filter', { skip: SKIP }, async () => {
  const { page } = await openScan();
  await pick(page, '#scan-filter-remote', 'remote');
  assert.equal(await rowCount(page), 2, 'remote → Globex + Umbrella');
  await pick(page, '#scan-filter-remote', '');
  assert.equal(await rowCount(page), ROWS.length);
  await page.close();
});

test('scan filters: "Posted within" age filter', { skip: SKIP }, async () => {
  const { page } = await openScan();
  await pick(page, '#scan-filter-age', '7');
  assert.equal(await rowCount(page), 4, '≤7d → 2 today + 3d + 2d (10d, 40d dropped)');
  await pick(page, '#scan-filter-age', '');
  assert.equal(await rowCount(page), ROWS.length);
  await page.close();
});

test('scan filters: text include + exclude (Apply-driven)', { skip: SKIP }, async () => {
  const { page } = await openScan();
  await page.fill('#scan-filter-text', 'data');
  await page.click('#scan-apply');
  await page.waitForTimeout(60);
  assert.equal(await rowCount(page), 2, 'include "data" → Data Scientist + Senior Data Engineer');
  await page.fill('#scan-filter-text', '');
  await page.fill('#scan-filter-exclude', 'manager');
  await page.click('#scan-apply');
  await page.waitForTimeout(60);
  assert.equal(await rowCount(page), ROWS.length - 1, 'exclude "manager" → drops Engineering Manager');
  await page.close();
});
