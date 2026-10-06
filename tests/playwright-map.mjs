/**
 * Playwright regression for #/map: the map must render when reached by in-app
 * navigation (hashchange), not only on a cold load. The router's hashchange
 * listener renders the view before map.js's own listener runs; that listener
 * once bumped the render generation and so aborted every navigated-to map.
 *
 * Opt-in (needs a browser binary; Playwright is the parent's dep, not ours):
 *   npm run test:e2e:browser
 *
 * CI-isolated: throw-away CAREER_OPS_ROOT; /api/geocode and the tile host are
 * answered in the browser, so nothing reaches Nominatim or OpenStreetMap.
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

const ROWS = [
  { company: 'Acme', title: 'Platform Engineer', location: 'Leeds, UK', source: 'greenhouse', url: 'https://example.com/j/1' },
  { company: 'Globex', title: 'SRE', location: 'Lyon, France', source: 'lever', url: 'https://example.com/j/2' },
];

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-map-'));
  for (const d of ['config', 'data', 'modes']) mkdirSync(resolve(dir, d), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Tester\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'x\n');
  const snap = { en: { kind: 'en', when: new Date().toISOString(), fresh: ROWS, filtered: ROWS }, ru: null };
  writeFileSync(resolve(dir, 'data', 'last-scan.json'), JSON.stringify(snap));
  process.env.CAREER_OPS_ROOT = dir;

  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
  browser = await playwright.chromium.launch({ headless: process.env.PWDEBUG !== '1' });
  context = await browser.newContext();
  await context.route('**/api/geocode?**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ lat: 50, lon: 0, exact: false }) }));
  await context.route('https://tile.openstreetmap.org/**', (route) => route.abort());
});

after(async () => {
  if (context) await context.close();
  if (browser) await browser.close();
  if (server) { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
  delete process.env.CAREER_OPS_ROOT;
});

async function placesLocated(page) {
  await page.waitForSelector('#job-map.leaflet-container', { timeout: 10000 });
  await page.waitForFunction(() => /2\/2/.test(document.querySelector('#content [role=status]')?.textContent || ''), null, { timeout: 10000 });
}

test('map renders on a cold load of #/map', { skip: SKIP }, async () => {
  const page = await context.newPage();
  try {
    await page.goto(baseUrl + '/#/map');
    await placesLocated(page);
  } finally { await page.close(); }
});

test('map renders when reached via the nav (hashchange), and again on return', { skip: SKIP }, async () => {
  const page = await context.newPage();
  try {
    await page.goto(baseUrl + '/#/dashboard');
    await page.waitForSelector('#content h1');
    await page.click('.nav-item[data-route="map"]');
    await placesLocated(page);
    await page.click('.nav-item[data-route="dashboard"]');
    await page.waitForFunction(() => !document.getElementById('job-map'));
    await page.click('.nav-item[data-route="map"]');
    await placesLocated(page);
    assert.equal(await page.locator('#job-map').count(), 1);
  } finally { await page.close(); }
});
