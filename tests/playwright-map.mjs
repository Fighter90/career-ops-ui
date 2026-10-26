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
  writeFileSync(resolve(dir, 'config', 'profile.yml'),
    'candidate:\n  full_name: Tester\ntarget_roles:\n  primary:\n    - Platform Engineer\n    - SRE\n');
  writeFileSync(resolve(dir, 'config', 'plugins.yml'), 'plugins:\n  commute:\n    home_lat: 53.8\n    home_lon: -1.55\n    max_minutes: 45\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'commute.tsv'), [
    'url\tlocation\tprecision\tlat\tlon\tkm\tmin\tchecked\tfactor',
    'https://example.com/j/1\tLeeds, UK\tcity\t53.8\t-1.55\t18\t20\t2026-10-11\t1',
    '',
  ].join('\n'));
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
    // CAR-122 — the sidebar folds into collapsible groups: reach Map in the
    // two deliberate actions the spec guarantees (open the group, click the
    // item). Cmd/Ctrl+K → "map" → Enter is the one-action alternative.
    await page.click('[data-nav-group="sourcing"] .nav-v2-toggle');
    await page.click('.nav-item[data-route="map"]');
    await placesLocated(page);
    await page.click('.nav-item[data-route="dashboard"]');
    await page.waitForFunction(() => !document.getElementById('job-map'));
    // the explicit Sourcing open from the first toggle persists, so the
    // item is directly clickable again
    await page.click('.nav-item[data-route="map"]');
    await placesLocated(page);
    assert.equal(await page.locator('#job-map').count(), 1);
  } finally { await page.close(); }
});

test('map commute/unknown filters persist and Reset restores inclusive defaults', { skip: SKIP }, async () => {
  const page = await context.newPage();
  try {
    await page.goto(baseUrl + '/#/map');
    await placesLocated(page);
    const unknown = page.getByLabel('Show unknown drive time');
    await unknown.uncheck();
    await page.waitForFunction(() => /^1 \/ 2/.test(document.querySelector('.job-map-status-chip')?.textContent || ''));
    await page.reload();
    await placesLocated(page);
    assert.equal(await page.getByLabel('Show unknown drive time').isChecked(), false);
    await page.getByRole('button', { name: 'Reset' }).click();
    assert.equal(await page.getByLabel('Show unknown drive time').isChecked(), true);
    assert.equal(await page.getByLabel('Show jobs without a score').isChecked(), true);
  } finally { await page.close(); }
});

test('mobile marker tap opens a peek before navigation and keeps the map usable', { skip: SKIP }, async () => {
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await mobile.route('**/api/geocode?**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ lat: 50, lon: 0, exact: false }) }));
  await mobile.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  const page = await mobile.newPage();
  try {
    await page.goto(baseUrl + '/#/map');
    await placesLocated(page);
    const mapHeight = await page.locator('#job-map').evaluate((el) => el.getBoundingClientRect().height);
    // The rendered height depends on the viewport chrome and font metrics
    // (642.5px on CI and locally); what matters is that the map fills most
    // of the 844px-tall viewport, not an exact pixel value.
    assert.ok(mapHeight >= 540, `mobile map is only ${mapHeight}px high`);
    const before = page.url();
    // A touch context: Leaflet synthesizes its layer 'click' from the tap
    // gesture — a force mouse click never reaches the marker handler. The
    // fixture pins job 1 at the HOME coordinates, so the Home marker (a DIV
    // in the marker pane, above the SVG overlay) intercepts that circle —
    // tap the other job's circle instead.
    const jobCircle = page.locator('path.leaflet-interactive').nth(1);
    await jobCircle.waitFor({ timeout: 10000 });
    await jobCircle.tap();
    await page.waitForSelector('.job-map-sheet.is-open.is-peek');
    assert.equal(page.url(), before, 'the first marker tap must not navigate');
    assert.match(await page.locator('.job-map-peek-card').innerText(), /Globex · SRE/, 'the peek names the tapped job');
    assert.equal(await page.locator('.job-map-filter-body').isVisible(), false, 'peek must not retain the filter controls');
    const sheetBottom = await page.locator('.job-map-sheet').evaluate((el) => el.getBoundingClientRect().bottom);
    assert.ok(sheetBottom <= 844, `peek sheet extends below the viewport (${sheetBottom}px)`);
  } finally { await mobile.close(); }
});

// CAR-125 — on phones the side list is a bottom sheet over the full-screen map.
test('map: the mobile list toggle opens the bottom-sheet list', { skip: SKIP }, async () => {
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await mobile.route('**/api/geocode?**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ lat: 50, lon: 0, exact: false }) }));
  await mobile.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  const page = await mobile.newPage();
  try {
    await page.goto(baseUrl + '/#/map');
    await placesLocated(page);
    const toggle = page.locator('.v2-map-list-toggle');
    await toggle.waitFor({ timeout: 10000 });
    assert.equal(await page.locator('.v2-map-list').isVisible(), false, 'the list starts closed on phones');
    await toggle.click();
    await page.waitForSelector('.v2-map-list.is-open', { timeout: 5000 });
    await page.locator('.v2-map-row').first().waitFor({ timeout: 5000 });
    // The toggle moves focus INTO the sheet — no Tab dance needed to verify.
    const focused = await page.evaluate(() => document.activeElement?.className || '');
    assert.match(focused, /v2-map-list-close/, 'focus lands on the sheet close button');
    assert.equal(await page.locator('.v2-map-row').count(), 2, 'both in-bounds jobs are listed');
    const box = await page.locator('.v2-map-list').boundingBox();
    assert.ok(box && box.y + box.height <= 844 + 1, `the sheet stays inside the viewport (${JSON.stringify(box)})`);
    await page.locator('.v2-map-list-close').click();
    assert.equal(await page.locator('.v2-map-list.is-open').count(), 0, 'the close button dismisses the sheet');
  } finally { await mobile.close(); }
});

// v1.248.3 — the docs FAB (fixed, bottom-right) must not cover the Leaflet
// attribution: the OSM licence requires it visible. ALL FOUR CORNERS of the
// attribution rect are probed with elementFromPoint — a single-centre check
// gave a false pass before the 96px lift shipped.
test('map: the Leaflet attribution is fully visible (all 4 corners unobstructed)', { skip: SKIP }, async () => {
  const page = await context.newPage();
  try {
    await page.goto(baseUrl + '/#/map', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.leaflet-control-attribution', { timeout: 15000 });
    // A transient toast floats above everything for up to 20 s (errors dwell
    // longer to be readable) — steady-state visibility is what this contract
    // probes, so dismiss it the same way the app's dismissToast() does.
    await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.hidden = true; });
    await page.waitForTimeout(150);
    const obstructed = await page.evaluate(() => {
      const el = document.querySelector('.leaflet-control-attribution');
      const r = el.getBoundingClientRect();
      const pts = [[r.left + 1, r.top + 1], [r.right - 1, r.top + 1], [r.left + 1, r.bottom - 1], [r.right - 1, r.bottom - 1]];
      return pts.map(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        const who = hit ? hit.tagName + '.' + String(hit.className).split(' ').slice(0, 2).join('.') : 'nothing';
        return { x: Math.round(x), y: Math.round(y), ok: !!(hit && (el === hit || el.contains(hit) || hit.contains(el))), who };
      });
    });
    for (const p of obstructed) assert.ok(p.ok, `attribution corner ${p.x},${p.y} is covered by: ${p.who || 'unknown'}`);
  } finally { await page.close(); }
});

// v1.250.0 — the job locator + the text search (the toolbar above the map).
// CAR-125 — the select became a chip row; same settings-driven matcher.
test('map: the specialization chips (from settings) filter the map', { skip: SKIP }, async () => {
  const page = await context.newPage();
  try {
    await page.goto(baseUrl + '/#/map');
    await placesLocated(page);
    const chips = page.locator('.v2-map-chip[data-spec]');
    await chips.first().waitFor({ timeout: 10000 });
    const labels = await chips.allInnerTexts();
    assert.ok(labels.some((o) => o.includes('Platform Engineer')), 'the settings\' role is a chip: ' + JSON.stringify(labels));
    assert.ok(labels.some((o) => o.includes('SRE')), 'SRE listed');
    // «Platform Engineer» keeps only Acme's posting (Globex is an SRE).
    await page.locator('.v2-map-chip[data-spec="Platform Engineer"]').click();
    await page.waitForFunction(() => /^1 \/ 2 mapped/.test(document.querySelector('.job-map-status-chip')?.textContent || ''),
      null, { timeout: 10000 });
    assert.equal(await page.locator('.v2-map-chip[data-spec="Platform Engineer"]').getAttribute('aria-pressed'), 'true',
      'the active chip is exposed to assistive tech');
    // All specializations → everything back.
    await page.locator('.v2-map-chip.v2-map-chip-any').click();
    await page.waitForFunction(() => /^2 \/ 2 mapped/.test(document.querySelector('.job-map-status-chip')?.textContent || ''),
      null, { timeout: 10000 });
  } finally { await page.close(); }
});

// CAR-125 review f11 — the hover assertion must not pass vacuously: if the
// two jobs were one cluster, BOTH rows would light the same element.
test('map: the side list follows the visible bounds and highlights its marker', { skip: SKIP }, async () => {
  const page = await context.newPage();
  try {
    await page.goto(baseUrl + '/#/map');
    await placesLocated(page);
    await page.locator('.v2-map-row').first().waitFor({ timeout: 10000 });
    const count = await page.locator('.v2-map-list-count').innerText();
    assert.equal(Number(count), 2, 'both located jobs are inside the fitted bounds');
    // A row names its job (the fixture pins Acme/Platform Engineer).
    const text = await page.locator('.v2-map-row').first().innerText();
    assert.match(text, /Platform Engineer/, 'rows name the role');
    // Hover highlights the drawn marker (list ↔ map synchronisation), and
    // different rows light DIFFERENT elements — two jobs at one place stay
    // two markers (the f1 spiral fix), so this can never pass vacuously.
    const hotBox = async () => {
      await page.waitForFunction(() => document.querySelectorAll('.v2-map-marker-hot').length === 1,
        null, { timeout: 5000 });
      return page.evaluate(() => {
        const el = document.querySelector('.v2-map-marker-hot');
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
      });
    };
    const rows = page.locator('.v2-map-row');
    await rows.nth(0).hover();
    const hot1 = await hotBox();
    await rows.nth(1).hover();
    const hot2 = await hotBox();
    assert.notDeepEqual(hot1, hot2, 'the two rows highlight two distinct marker elements');
  } finally { await page.close(); }
});

// CAR-125 review f3 — same-sized, same-place sets under different filters
// must re-sync the list (the old geometry memo served the stale rows).
test('map: the list re-syncs when two filters yield the same-sized same-place set', { skip: SKIP }, async () => {
  const page = await context.newPage();
  // Without commute data both jobs geocode to the route's single place, so
  // «Acme» and «Globex» are two 1-row sets over the SAME coordinate.
  await page.route('**/api/commute', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ available: false }) }));
  try {
    await page.goto(baseUrl + '/#/map');
    await placesLocated(page);
    const box = page.locator('.job-map-search');
    await box.waitFor({ timeout: 10000 });
    await box.fill('Acme');
    await page.waitForFunction(() => /Acme/.test(document.querySelector('.v2-map-row')?.textContent || ''),
      null, { timeout: 10000 });
    await box.fill('Globex');
    await page.waitForFunction(() => /Globex/.test(document.querySelector('.v2-map-row')?.textContent || ''),
      null, { timeout: 10000 });
    assert.doesNotMatch(await page.locator('.v2-map-row').first().innerText(), /Acme/,
      'the list must not keep the previous filter\'s row');
  } finally { await page.close(); }
});

// CAR-125 review f8 — a failed /api/profile must not leave a dead filter
// group: the All chip always exists, and an empty role set hides the group.
test('map: the specialization chips survive a failed /api/profile', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.route('**/api/profile', (route) => route.fulfill({ status: 500, body: '{}' }));
  try {
    await page.goto(baseUrl + '/#/map');
    await placesLocated(page);
    const all = page.locator('.v2-map-chip.v2-map-chip-any');
    await all.waitFor({ timeout: 10000 });
    assert.equal(await all.innerText(), 'All specializations', 'the All chip always renders');
    assert.equal(await all.getAttribute('aria-pressed'), 'true', 'and is the active chip');
    assert.equal(await page.locator('.v2-map-chip[data-spec]').count(), 0, 'no phantom role chips');
    assert.equal(await page.locator('.v2-map-chipset').first().evaluate((el) => el.hidden), true,
      'the empty specialization group is hidden, not a dead control');
  } finally { await page.close(); }
});

test('map: the search narrows the map and persists across reload', { skip: SKIP }, async () => {
  const page = await context.newPage();
  try {
    await page.goto(baseUrl + '/#/map');
    await placesLocated(page);
    const box = page.locator('.job-map-search');
    await box.waitFor({ timeout: 10000 });
    await box.fill('Acme');
    // The chip is «visible / total mapped» — filtering narrows the visible
    // half; the specialization chips are settings-driven and do not narrow.
    await page.waitForFunction(() => /^1 \/ 2 mapped/.test(document.querySelector('.job-map-status-chip')?.textContent || ''),
      null, { timeout: 10000 });
    assert.equal(await page.locator('.v2-map-chip[data-spec]').count(), 2, 'the specialization chips are settings-driven — the search does not narrow them');
    await page.reload();
    await placesLocated(page);
    assert.equal(await page.locator('.job-map-search').inputValue(), 'Acme', 'the query persists');
    await page.waitForFunction(() => /^1 \/ 2 mapped/.test(document.querySelector('.job-map-status-chip')?.textContent || ''),
      null, { timeout: 10000 });
    await page.locator('.job-map-search').fill('');
    await page.waitForFunction(() => /^2 \/ 2 mapped/.test(document.querySelector('.job-map-status-chip')?.textContent || ''),
      null, { timeout: 10000 });
    assert.equal(await page.locator('.v2-map-chip[data-spec]').count(), 2, 'clearing restores both jobs');
  } finally { await page.close(); }
});
