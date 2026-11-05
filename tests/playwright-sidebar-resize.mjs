/**
 * CAR-235 — sidebar resize: real-browser geometry specs.
 *
 *   G1  default width ≈ 256, the handle is visible and focusable
 *   G2  drag +120px → the sidebar grew ≈ +120 and `.main` followed
 *   G3  the dragged width persisted in localStorage and survived a reload
 *   G4  double-click resets to the default (and clears the override)
 *   G5  keyboard: ArrowRight/ArrowLeft ±16, Home resets
 *   G6  at 420px no sidebar label is ellipsis-truncated (the whole point:
 *       full labels readable; the CAR-203 title tooltips stay as backup)
 *   G7  ≤900px: the handle is hidden, the drawer contract is intact
 *       (.main margin 0, the toggle still opens the drawer)
 *
 * Same CI-isolated fixture shape as playwright-nav-v2.mjs (mkdtemp
 * CAREER_OPS_ROOT, 127.0.0.1 bind, no network). Wired into
 * `npm run test:e2e:browser` (package.json); standalone:
 * node --test tests/playwright-sidebar-resize.mjs
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

const KEY = 'career-ops-ui:sidebarW';
const W = (px) => Math.abs(px);
let server, baseUrl, browser, dir;

before(async () => {
  if (SKIP) return;
  dir = mkdtempSync(resolve(tmpdir(), 'pw-sidecar-resize-'));
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

async function newPage(lang = 'en') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(([k, v]) => {
    try { window.localStorage.setItem(k, v); } catch { /* private mode */ }
  }, ['career-ops-ui:lang', lang]);
  const page = await context.newPage();
  return { context, page };
}

async function sidebarWidth(page) {
  const box = await page.locator('#sidebar').boundingBox();
  return Math.round(box.width);
}
async function sidebarVar(page) {
  return page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w').trim());
}
async function dragBy(page, dx) {
  const handle = page.locator('#sidebar-resize');
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
}

test('CAR-235 geometry: drag, persistence, reset, keyboard, truncation-free at 420, mobile hidden', { skip: SKIP }, async () => {
  const { context, page } = await newPage();
  await page.goto(baseUrl + '/');

  // G1 — default width + a named, focusable separator handle.
  assert.ok(W(await sidebarWidth(page) - 256) <= 3, `default ≈256, got ${await sidebarWidth(page)}`);
  assert.equal(await sidebarVar(page), '256px');
  const handle = page.locator('#sidebar-resize');
  assert.equal(await handle.getAttribute('role'), 'separator');
  assert.equal(await handle.getAttribute('aria-orientation'), 'vertical');
  await handle.focus();
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'sidebar-resize');

  // G2 — drag +120 → sidebar grew ≈ +120; `.main` margin follows the var.
  const before = await sidebarWidth(page);
  await dragBy(page, 120);
  const afterDrag = await sidebarWidth(page);
  assert.ok(W(afterDrag - (before + 120)) <= 4, `grew ≈+120: ${before} → ${afterDrag}`);
  const mainMargin = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.main')).marginInlineStart));
  assert.ok(W(mainMargin - afterDrag) <= 4, `.main reflows (${mainMargin} vs ${afterDrag})`);

  // G3 — persisted; survives reload.
  assert.equal(await page.evaluate((k) => window.localStorage.getItem(k), KEY), String(afterDrag));
  await page.reload();
  await page.waitForSelector('#sidebar');
  assert.ok(W(await sidebarWidth(page) - afterDrag) <= 3, `width restored after reload: ${await sidebarWidth(page)}`);

  // G5 — keyboard: ±16 steps; ArrowRight widens; Home resets.
  await page.locator('#sidebar-resize').focus();
  await page.keyboard.press('ArrowRight');
  assert.ok(W(await sidebarWidth(page) - (afterDrag + 16)) <= 3);
  await page.keyboard.press('ArrowLeft');
  assert.ok(W(await sidebarWidth(page) - afterDrag) <= 3);
  await page.keyboard.press('Home');
  assert.ok(W(await sidebarWidth(page) - 256) <= 3, 'Home = reset');
  assert.equal(await page.evaluate((k) => window.localStorage.getItem(k), KEY), null, 'reset cleared the override');

  // G4 — double-click resets from a stored width.
  await page.evaluate((kv) => window.localStorage.setItem(kv[0], kv[1]), [KEY, '360']);
  await page.reload();
  await page.waitForSelector('#sidebar');
  assert.ok(W(await sidebarWidth(page) - 360) <= 3, 'stored 360 restored');
  await page.locator('#sidebar-resize').dblclick();
  assert.ok(W(await sidebarWidth(page) - 256) <= 3, 'double-click reset');
  assert.equal(await page.evaluate((k) => window.localStorage.getItem(k), KEY), null);

  // G6 — at 420 no sidebar label truncates (CAR-203 tooltips remain as backup).
  await page.evaluate((kv) => window.localStorage.setItem(kv[0], kv[1]), [KEY, '420']);
  await page.reload();
  await page.waitForSelector('#sidebar');
  assert.ok(W(await sidebarWidth(page) - 420) <= 3, '420 clamped/kept at max');
  const truncated = await page.evaluate(() => {
    const sels = [
      '.nav .nav-item > span:not(.nav-ico)',
      '.nav .nav-v2-toggle > span:not(.nav-v2-chev)',
      '.nav .nav-v2-row-link > span:not(.nav-ico)',
    ];
    const bad = [];
    for (const sel of sels) {
      for (const el of document.querySelectorAll(sel)) {
        if (el.scrollWidth > el.clientWidth + 1) bad.push(el.textContent.trim());
      }
    }
    return bad;
  });
  assert.deepEqual(truncated, [], 'no ellipsized labels at 420px');
  await context.close();
});

test('CAR-235 geometry: ≤900px the handle hides and the drawer contract is intact', { skip: SKIP }, async () => {
  const { context, page } = await newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl + '/');
  await page.waitForSelector('#sidebar', { state: 'attached' });
  const handleVisible = await page.locator('#sidebar-resize').isVisible();
  assert.equal(handleVisible, false, 'handle hidden on mobile');
  const margin = await page.evaluate(() => getComputedStyle(document.querySelector('.main')).marginInlineStart);
  assert.equal(margin, '0px', '.main margin 0 on mobile (existing contract)');
  await page.locator('#sidebar-toggle').click();
  // The drawer animates in (transform + visibility transition) — wait it out.
  await page.locator('#sidebar').waitFor({ state: 'visible', timeout: 5000 });
  assert.ok(true, 'drawer still opens');
  await context.close();
});
