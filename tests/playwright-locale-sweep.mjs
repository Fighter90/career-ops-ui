/**
 * Playwright locale sweep (I18N-SPLIT v1.60.0).
 *
 * Proves the per-locale split actually works in a real browser: for every
 * supported locale, walk every sidebar route and assert
 *   1. the page renders (non-empty #content),
 *   2. the sidebar localizes (nav.dashboard reads the expected per-locale
 *      string from the dictionary — never the raw key, never the English
 *      fallback on a non-English locale), and
 *   3. no console errors fire (a missing locale <script> or a broken
 *      assembler would surface here).
 *
 * This is the end-to-end guarantee behind "all locales must work on every
 * page". Opt-in (needs a browser binary): runs under `test:e2e:browser`.
 *
 * Mirrors tests/playwright-smoke.mjs harness: in-process server, ephemeral
 * port, mktemp parent fixtures — never touches real career-ops data.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const require = createRequire(import.meta.url);

function resolvePlaywright() {
  for (const id of ['playwright',
    resolve(process.cwd(), '..', 'node_modules', 'playwright'),
    resolve(process.cwd(), 'node_modules', 'playwright')]) {
    try { return require(id); } catch { /* try next */ }
  }
  return null;
}

const playwright = resolvePlaywright();
const SKIP = !playwright;
const DICT = loadAssembledDict();
const STORAGE_KEY = 'career-ops-ui:lang';

const ROUTES = [
  'dashboard', 'scan', 'pipeline', 'auto', 'evaluate', 'batch', 'deep',
  'project', 'training', 'apply', 'tracker', 'followup', 'contacto',
  'interview-prep', 'patterns', 'reports', 'activity', 'cv', 'profile',
  'config', 'health', 'help',
];

let server, baseUrl, browser;

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-locale-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n\nJane Doe, Senior Engineer.\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'),
    'candidate:\n  full_name: Jane Doe\n  email: jane@example.com\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# Pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), '# Oferta\n');
  process.env.CAREER_OPS_ROOT = dir;

  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
  browser = await playwright.chromium.launch({ headless: process.env.PWDEBUG !== '1' });
});

after(async () => {
  if (browser) await browser.close();
  if (server) {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
  delete process.env.CAREER_OPS_ROOT;
});

for (const lang of I18N_LANGS) {
  test(`Playwright: every page renders + localizes in ${lang} (per-locale split load)`, { skip: SKIP }, async () => {
    // Persist the locale BEFORE any app script runs so i18n.js boots in it.
    const context = await browser.newContext();
    await context.addInitScript(([key, value]) => {
      try { window.localStorage.setItem(key, value); } catch { /* private mode */ }
    }, [STORAGE_KEY, lang]);
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    const expectedDashboard = DICT['nav.dashboard'][lang];

    for (const route of ROUTES) {
      await page.goto(`${baseUrl}/#/${route}`);
      await page.waitForSelector('#content', { timeout: 8000 });
      const html = await page.locator('#content').innerHTML();
      assert.ok(html.length > 30, `[${lang}] #/${route} rendered empty`);
      // Sidebar must show the localized label, not the raw key.
      const navLabel = (await page.locator('[data-i18n="nav.dashboard"]').first().textContent() || '').trim();
      assert.equal(navLabel, expectedDashboard,
        `[${lang}] sidebar nav.dashboard should read "${expectedDashboard}" on #/${route}, got "${navLabel}"`);
    }

    try { await page.evaluate(() => window.stop()); } catch { /* page gone */ }
    // Ignore expected network-refused noise from probes to the absent parent.
    const realErrors = consoleErrors.filter((e) => !/ERR_CONNECTION_REFUSED|Failed to load resource/.test(e));
    assert.deepEqual(realErrors, [], `[${lang}] console errors: ${realErrors.join(' | ')}`);
    await context.close();
  });
}
