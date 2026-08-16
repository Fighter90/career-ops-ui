/**
 * Playwright end-to-end acceptance test — persistent widgets (v1.116.0).
 *
 * Drives a real Chromium against the in-process server and verifies the two
 * always-on overlays end-to-end, as a user experiences them:
 *   • the Ask-the-docs launcher (#docs-fab, bottom-right) — opens a chat panel
 *     with a greeting + starter chips, closes via X / Escape, and hides itself
 *     on the dedicated #/docs-assistant page;
 *   • the AI usage & cost HUD (#usage-hud, bottom-left, fixed) — reads the
 *     read-only /api/usage rollup of a seeded data/llm-usage.jsonl, shows a
 *     tokens · cost row per window, and collapses (state persisting).
 *
 * Opt-in (needs a browser binary); run via `npm run test:e2e:browser`.
 * CI-isolated: mocks parent fixtures under a mkdtemp root; never touches real
 * career-ops data.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { realConsoleErrors } from './helpers/console-noise.mjs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function resolvePlaywright() {
  const candidates = [
    'playwright',
    resolve(process.cwd(), '..', 'node_modules', 'playwright'),
    resolve(process.cwd(), 'node_modules', 'playwright'),
  ];
  for (const c of candidates) {
    try { return require(c); } catch { /* try next */ }
  }
  return null;
}

const playwright = resolvePlaywright();
const SKIP = playwright ? false : 'Playwright not installed (run in an env with the parent project deps)';

let server, baseUrl, browser, context;

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-widgets-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n\nReal Person, Senior Engineer.\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'),
    'candidate:\n  full_name: Real Person\n  email: real@example.com\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# Pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), '# Oferta\n');
  // Seed the usage log so the HUD renders real rows (a couple of recent calls).
  const now = Date.now();
  const rows = [
    JSON.stringify({ ts: now - 3600_000, provider: 'anthropic', in: 1200, out: 800 }),
    JSON.stringify({ ts: now - 7200_000, provider: 'openai', in: 1500, out: 1300 }),
  ].join('\n') + '\n';
  writeFileSync(resolve(dir, 'data', 'llm-usage.jsonl'), rows);
  process.env.CAREER_OPS_ROOT = dir;

  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); });
  });
  browser = await playwright.chromium.launch({ headless: process.env.PWDEBUG !== '1' });
  context = await browser.newContext();
});

after(async () => {
  if (context) await context.close();
  if (browser) await browser.close();
  if (server) { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
  delete process.env.CAREER_OPS_ROOT;
});

test('Ask-the-docs launcher: opens a chat, closes on Escape, hides on #/docs-assistant', { skip: SKIP }, async () => {
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(baseUrl + '/#/dashboard');
  await page.waitForSelector('#docs-fab', { timeout: 5000 });

  // Panel starts hidden; clicking the launcher opens it with a greeting + chips.
  assert.equal(await page.evaluate(() => document.getElementById('docs-fab-panel').hidden), true, 'panel should start hidden');
  await page.locator('#docs-fab').click();
  await page.waitForFunction(() => !document.getElementById('docs-fab-panel').hidden, null, { timeout: 3000 });
  assert.ok(await page.locator('.docs-fab__bubble--bot').count() >= 1, 'greeting bubble missing');
  assert.ok(await page.locator('.docs-fab__chip').count() >= 1, 'starter chips missing');

  // Escape closes it.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('docs-fab-panel').hidden, null, { timeout: 3000 });

  // The launcher hides on the dedicated docs-assistant page (no duplicate entry).
  await page.goto(baseUrl + '/#/docs-assistant');
  await page.waitForSelector('#content');
  assert.equal(await page.locator('#docs-fab').isVisible(), false, 'launcher must hide on #/docs-assistant');

  const real = realConsoleErrors(errors);
  assert.deepEqual(real, [], 'console errors: ' + real.join(' | '));
  await page.close();
});

test('Usage HUD: fixed bottom-left, shows tokens · cost per window, collapses', { skip: SKIP }, async () => {
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(baseUrl + '/#/dashboard');
  await page.waitForSelector('#usage-hud', { timeout: 5000 });

  // Pinned/fixed to the viewport.
  const pos = await page.locator('#usage-hud').evaluate((el) => getComputedStyle(el).position);
  assert.equal(pos, 'fixed', 'usage HUD must be position:fixed (pinned)');

  // Three window rows, each showing a cost figure from the seeded log.
  await page.waitForFunction(() => document.querySelectorAll('.usage-hud__meter').length === 3, null, { timeout: 3000 });
  const firstVal = await page.locator('.usage-hud__val').first().textContent();
  assert.match(firstVal || '', /\$\d/, `row should show a cost, got "${firstVal}"`);

  // Header toggles collapse (body hidden), and it survives navigation (localStorage).
  await page.locator('.usage-hud__head').click();
  await page.waitForFunction(() => document.getElementById('usage-hud-body').hidden, null, { timeout: 3000 });
  await page.goto(baseUrl + '/#/scan');
  await page.waitForSelector('#usage-hud', { timeout: 5000 });
  await page.waitForFunction(() => document.getElementById('usage-hud-body').hidden, null, { timeout: 3000 });

  const real = realConsoleErrors(errors);
  assert.deepEqual(real, [], 'console errors: ' + real.join(' | '));
  await page.close();
});
