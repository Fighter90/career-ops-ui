/**
 * CAR-122 — sidebar v2 behavioural flows (real browser):
 *   P1  Cmd/Ctrl+K opens the palette; the input takes focus (main entry)
 *   P2  typing fuzzy-filters; arrows move aria-activedescendant +
 *       aria-selected; Enter navigates to the route
 *   P3  Escape closes; focus returns to the trigger
 *   P4  a pasted URL becomes an auto-pipeline action (#/auto?url=…)
 *   P5  favorites: star pins into the Favorites group, survives reload,
 *       ↑/↓ reorder, ✕ unpins (all keyboard-operable buttons)
 *   P6  groups: toggle collapses (aria-expanded + hidden), collapse
 *       persists across reload, an explicit closed wins over the active
 *       route, an untouched group auto-opens on its own route
 *   P7  the sidebar launch button opens the palette too
 *   P8  default visibility: a fresh profile shows ≤ 12 nav entries
 *
 * Same CI-isolated fixture shape as playwright-pipeline-v2.mjs
 * (mkdtemp CAREER_OPS_ROOT, 127.0.0.1 bind, injected nothing, no
 * network). Wired into `npm run test:e2e:browser` (package.json);
 * standalone: node --test tests/playwright-nav-v2.mjs
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { chromium = require('playwright').chromium; } catch { chromium = null; }
const SKIP = !chromium;

let server, baseUrl, browser, dir;

before(async () => {
  if (SKIP) return;
  dir = mkdtempSync(resolve(tmpdir(), 'pw-nav-v2-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  mkdirSync(resolve(dir, 'reports'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n\nReal Person, Senior Backend Engineer.\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Tester\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'x\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'),
    '# Applications Tracker\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes | URL |\n' +
    '|---|------|---------|------|-------|--------|-----|--------|-------|-----|\n');
  process.env.CAREER_OPS_ROOT = dir;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
  browser = await chromium.launch();
});

after(async () => {
  if (browser) await browser.close();
  if (server) {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
  delete process.env.CAREER_OPS_ROOT;
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* windows */ }
});

/** Fresh context = fresh localStorage (favorites/groups persist per origin). */
async function newPage(lang = 'en') {
  const context = await browser.newContext();
  await context.addInitScript(([key, value]) => {
    try { window.localStorage.setItem(key, value); } catch { /* private mode */ }
  }, ['career-ops-ui:lang', lang]);
  const page = await context.newPage();
  return { context, page };
}

test('P1: Ctrl/Cmd+K opens the palette and focuses its input', { skip: SKIP }, async () => {
  const { context, page } = await newPage();
  await page.goto(`${baseUrl}/#/dashboard`);
  await page.waitForSelector('#nav-v2-launch');
  await page.keyboard.press('Control+k');
  await page.waitForSelector('.nav-v2-palette', { state: 'visible' });
  assert.equal(await page.getAttribute('.nav-v2-input', 'aria-expanded'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement?.className), 'nav-v2-input',
    'the palette input must hold focus when opened');
  assert.ok(await page.locator('.nav-v2-opt').first().isVisible(), 'options render for the empty query');
  await context.close();
});

test('P2: fuzzy filter + arrow navigation + Enter navigates', { skip: SKIP }, async () => {
  const { context, page } = await newPage();
  await page.goto(`${baseUrl}/#/dashboard`);
  await page.waitForSelector('#nav-v2-launch');
  await page.keyboard.press('Control+k');
  await page.fill('.nav-v2-input', 'trk');
  await page.waitForFunction(() => document.querySelectorAll('.nav-v2-opt').length > 0);
  const firstTitle = await page.locator('.nav-v2-opt').first().locator('.nav-v2-opt-title').textContent();
  assert.match(String(firstTitle), /Tracker/i, '"trk" must surface Tracker first');
  // first option selected via aria
  const firstId = await page.locator('.nav-v2-opt').first().getAttribute('id');
  assert.equal(await page.getAttribute('.nav-v2-input', 'aria-activedescendant'), firstId);
  assert.equal(await page.locator('.nav-v2-opt').first().getAttribute('aria-selected'), 'true');
  // ArrowDown moves the selection
  await page.keyboard.press('ArrowDown');
  const secondId = await page.locator('.nav-v2-opt').nth(1).getAttribute('id');
  assert.equal(await page.getAttribute('.nav-v2-input', 'aria-activedescendant'), secondId,
    'ArrowDown moves aria-activedescendant');
  assert.equal(await page.locator('.nav-v2-opt').nth(1).getAttribute('aria-selected'), 'true');
  // Enter follows through
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.location.hash.startsWith('#/'));
  assert.match(await page.evaluate(() => window.location.hash), /#\//);
  assert.equal(await page.locator('.nav-v2-overlay').isVisible().catch(() => false), false,
    'choosing an option closes the palette');
  await context.close();
});

test('P3: Escape closes and returns focus to the trigger', { skip: SKIP }, async () => {
  const { context, page } = await newPage();
  await page.goto(`${baseUrl}/#/dashboard`);
  await page.waitForSelector('#nav-v2-launch');
  await page.click('#nav-v2-launch'); // P7 folded in: the button opens it too
  await page.waitForSelector('.nav-v2-palette', { state: 'visible' });
  assert.ok(await page.locator('.nav-v2-overlay').isVisible());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  assert.equal(await page.locator('.nav-v2-overlay').isVisible().catch(() => false), false,
    'Escape closes the palette');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'nav-v2-launch',
    'focus returns to the trigger');
  await context.close();
});

test('P4: a pasted URL becomes an auto-pipeline action', { skip: SKIP }, async () => {
  const { context, page } = await newPage();
  await page.goto(`${baseUrl}/#/dashboard`);
  await page.waitForSelector('#nav-v2-launch');
  await page.keyboard.press('Control+k');
  await page.fill('.nav-v2-input', 'https://career.habr.com/vacancies/1000136672');
  await page.waitForFunction(() => {
    const t = document.querySelector('.nav-v2-opt-title');
    return t && /vacancies\/1000136672/.test(t.textContent || '');
  }, undefined, { timeout: 3000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.location.hash.includes('/auto?url='));
  assert.match(await page.evaluate(() => window.location.hash), /#\/auto\?url=/,
    'the URL action navigates to #/auto?url=…');
  await context.close();
});

test('P5: favorites pin, persist, reorder, unpin — keyboard-operable buttons', { skip: SKIP }, async () => {
  const { context, page } = await newPage();
  // A star lives on its group's row, so pin from each route (the active
  // route's group is the one that auto-opens).
  await page.goto(`${baseUrl}/#/scan`);
  await page.waitForSelector('[data-route-row="scan"] .nav-v2-star', { state: 'visible' });
  await page.click('[data-route-row="scan"] .nav-v2-star');
  await page.waitForSelector('[data-nav-group="__favs"]:not([hidden])');
  const favLink = page.locator('[data-nav-group="__favs"] a[href="#/scan"]');
  assert.equal(await favLink.count(), 1, 'Scan appears in the Favorites group');
  assert.equal(await page.getAttribute('[data-route-row="scan"] .nav-v2-star', 'aria-pressed'), 'true',
    'the star reflects its pinned state');
  // pin Reports too, then reorder
  await page.goto(`${baseUrl}/#/reports`);
  await page.waitForSelector('[data-route-row="reports"] .nav-v2-star', { state: 'visible' });
  await page.click('[data-route-row="reports"] .nav-v2-star');
  await page.waitForFunction(() => document.querySelectorAll('[data-nav-group="__favs"] [data-nav-fav]').length === 2);
  const order = () => page.$$eval('[data-nav-group="__favs"] [data-nav-fav]',
    (rows) => rows.map((r) => r.getAttribute('data-nav-fav')));
  assert.deepEqual(await order(), ['scan', 'reports']);
  await page.click('[data-nav-fav="reports"] .nav-v2-up');
  assert.deepEqual(await order(), ['reports', 'scan'], '↑ moves the row up');
  await page.click('[data-nav-fav="reports"] .nav-v2-down');
  assert.deepEqual(await order(), ['scan', 'reports'], '↓ moves the row back');
  // persistence across reload
  await page.reload();
  await page.waitForSelector('[data-nav-group="__favs"]:not([hidden])');
  assert.deepEqual(await order(), ['scan', 'reports'], 'favorites survive a reload');
  // unpin
  await page.click('[data-nav-fav="reports"] .nav-v2-unpin');
  await page.waitForFunction(() => document.querySelectorAll('[data-nav-group="__favs"] [data-nav-fav]').length === 1);
  assert.deepEqual(await order(), ['scan']);
  await context.close();
});

test('P9: aliased hashes (#/settings) auto-open the item\u2019s group', { skip: SKIP }, async () => {
  const { context, page } = await newPage();
  // #/settings resolves through the router's alias table to the Profile
  // route (setup group) — the auto-open must follow the RESOLVED route,
  // or the aliased hash leaves the highlighted item hidden.
  await page.goto(`${baseUrl}/#/settings`);
  await page.waitForSelector('[data-nav-group="setup"] .nav-v2-toggle');
  assert.equal(await page.getAttribute('[data-nav-group="setup"] .nav-v2-toggle', 'aria-expanded'), 'true',
    'the aliased route\u2019s group auto-opens');
  assert.ok(await page.locator('.nav-item[data-route="profile"].active').isVisible(),
    'the aliased route\u2019s nav item is visible and highlighted');
  // the outreach alias resolves to the contacto route (networking group)
  await page.goto(`${baseUrl}/#/outreach`);
  await page.waitForSelector('[data-nav-group="networking"] .nav-v2-toggle');
  assert.equal(await page.getAttribute('[data-nav-group="networking"] .nav-v2-toggle', 'aria-expanded'), 'true',
    'the outreach→contacto alias opens the networking group');
  await context.close();
});

test('P6: group collapse persists; explicit closed wins; untouched groups follow the route', { skip: SKIP }, async () => {
  const { context, page } = await newPage();
  // P8 folded in at the very first paint: fresh profile → ≤ 12 visible entries
  await page.goto(`${baseUrl}/#/dashboard`);
  await page.waitForSelector('#nav-v2-launch');
  const visibleItems = await page.$$eval('.nav .nav-item', (els) =>
    els.filter((e) => e.offsetParent !== null).length);
  assert.ok(visibleItems <= 12, `default visibility: ${visibleItems} nav entries ≤ 12`);
  // dashboard owns no group → no STATIC group auto-opens (the dynamic
  // Favorites/Recents toggles ship expanded but hidden while empty)
  const openToggles = await page.$$eval('.nav-v2-toggle[aria-expanded="true"]', (els) =>
    els.filter((e) => e.offsetParent !== null).length);
  assert.equal(openToggles, 0, 'fresh dashboard: no visible group is open');

  // the active untouched group auto-opens on its own route (#/scan → Sourcing)
  await page.goto(`${baseUrl}/#/scan`);
  await page.waitForSelector('[data-nav-group="sourcing"] .nav-v2-toggle');
  const sourcingToggle = page.locator('[data-nav-group="sourcing"] .nav-v2-toggle');
  assert.equal(await sourcingToggle.getAttribute('aria-expanded'), 'true');
  assert.ok(await page.locator('#nav-v2-items-sourcing .nav-item').first().isVisible());

  // collapse it explicitly → hidden immediately
  await sourcingToggle.click();
  assert.equal(await sourcingToggle.getAttribute('aria-expanded'), 'false');
  assert.ok(!(await page.locator('#nav-v2-items-sourcing .nav-item').first().isVisible()),
    'collapsed items are hidden');
  // persists across reload AND wins over the active route (#/scan still open)
  await page.reload();
  await page.waitForSelector('[data-nav-group="sourcing"] .nav-v2-toggle');
  assert.equal(await page.getAttribute('[data-nav-group="sourcing"] .nav-v2-toggle', 'aria-expanded'), 'false',
    'explicitly closed survives a reload on its own route');
  // an untouched group auto-opens on its own route; the explicit one stays shut
  await page.goto(`${baseUrl}/#/evaluate`);
  await page.waitForSelector('[data-nav-group="decision"] .nav-v2-toggle');
  assert.equal(await page.getAttribute('[data-nav-group="decision"] .nav-v2-toggle', 'aria-expanded'), 'true',
    'the active untouched group auto-opens');
  assert.equal(await page.getAttribute('[data-nav-group="sourcing"] .nav-v2-toggle', 'aria-expanded'), 'false',
    'the explicit choice is untouched by navigation');
  // …and the previous auto-open releases when the route moves away
  await page.goto(`${baseUrl}/#/config`);
  await page.waitForSelector('[data-nav-group="setup"] .nav-v2-toggle');
  assert.equal(await page.getAttribute('[data-nav-group="setup"] .nav-v2-toggle', 'aria-expanded'), 'true',
    'setup follows the active route');
  assert.equal(await page.getAttribute('[data-nav-group="decision"] .nav-v2-toggle', 'aria-expanded'), 'false',
    'the previous untouched group closes again');
  await context.close();
});
