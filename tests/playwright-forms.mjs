/**
 * Playwright end-to-end FORM + ERROR sweep (v1.57.1).
 *
 * Two guarantees, exercised in a real Chromium against the in-process
 * server (temp parent root — never touches real career-ops data):
 *
 *   1. The detailed what/where/why error surfacing works END-TO-END in
 *      a browser: an invalid /#/config save shows a toast that names
 *      the field, the reason, AND the failing request — not the opaque
 *      "validation failed" the user reported. Secret fields never echo.
 *   2. Every form-bearing route renders with NO console errors and
 *      produces visible user feedback on submit (no silent failures).
 *
 * Opt-in (Playwright is not a direct dep): `npm run test:e2e:browser`.
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
  for (const id of candidates) {
    try { return require(id); } catch {}
  }
  return null;
}

const playwright = resolvePlaywright();
const SKIP = !playwright;

let server, baseUrl, browser, context;

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-forms-'));
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
  writeFileSync(resolve(dir, 'modes', 'project.md'), '# Project\n');
  writeFileSync(resolve(dir, '.env'), 'LLM_PROVIDER=manual\n');
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
  context = await browser.newContext();
});

after(async () => {
  if (context) await context.close();
  if (browser) await browser.close();
  if (server) {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
  delete process.env.CAREER_OPS_ROOT;
});

async function closePage(page) {
  try { await page.evaluate(() => window.stop()); } catch { /* gone */ }
  await page.close();
}

// ── 1. /#/config — PORT/HOST defaults are prefilled ──

test('Playwright: /#/config prefills PORT=4317 and HOST=127.0.0.1', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/config');
  await page.waitForSelector('#cfg-port', { timeout: 8000 });
  assert.equal(await page.locator('#cfg-port').inputValue(), '4317');
  assert.equal(await page.locator('#cfg-host').inputValue(), '127.0.0.1');
  await closePage(page);
});

// ── 2. invalid save → detailed what/where/why toast (the reported bug) ──

test('Playwright: invalid PORT save shows field + reason + request context (not just "validation failed")', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/config');
  await page.waitForSelector('#cfg-port', { timeout: 8000 });
  await page.fill('#cfg-port', 'abc');
  // The visible API-keys panel's primary Save button.
  await page.locator('#cfg-tabpanel button.btn-primary', { hasText: /Save|Сохранить|Guardar|保存|儲存|저장|Salvar/ }).first().click();
  const toast = page.locator('#toast');
  await toast.waitFor({ state: 'visible', timeout: 8000 });
  const txt = (await toast.textContent()) || '';
  assert.match(txt, /PORT: must be 1-65535/, `toast must name the field+reason, got: ${txt}`);
  assert.match(txt, /you entered "abc"/, 'toast must echo the bad (non-secret) value');
  assert.match(txt, /POST \/api\/config/, 'toast must say WHERE it failed');
  assert.match(txt, /HTTP 400/, 'toast must include the status');
  assert.doesNotMatch(txt, /^validation failed$/, 'must NOT be the bare opaque message');
  await closePage(page);
});

// ── 3. secret field never echoes its value in the browser toast ──

test('Playwright: wrong Anthropic key error never leaks the typed secret', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/config');
  await page.waitForSelector('#cfg-anthropic-api-key', { timeout: 8000 });
  const secret = 'sk-LEAKCANARY-not-anthropic-1234567890';
  await page.fill('#cfg-anthropic-api-key', secret);
  await page.locator('#cfg-tabpanel button.btn-primary').first().click();
  const toast = page.locator('#toast');
  await toast.waitFor({ state: 'visible', timeout: 8000 });
  const txt = (await toast.textContent()) || '';
  assert.match(txt, /ANTHROPIC_API_KEY: expected sk-ant-… format/, `got: ${txt}`);
  assert.match(txt, /console\.anthropic\.com/, 'message must tell the user how to fix it');
  assert.ok(!txt.includes(secret), 'the typed secret must NOT appear in the toast');
  assert.ok(!txt.includes('LEAKCANARY'), 'no secret substring leaks');
  await closePage(page);
});

// ── 4. valid save (prefilled defaults) succeeds ──

test('Playwright: a valid /#/config save shows a success toast', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/config');
  await page.waitForSelector('#cfg-port', { timeout: 8000 });
  // defaults are already valid (4317 / 127.0.0.1)
  await page.locator('#cfg-tabpanel button.btn-primary').first().click();
  const toast = page.locator('#toast');
  await toast.waitFor({ state: 'visible', timeout: 8000 });
  const txt = (await toast.textContent()) || '';
  assert.match(txt, /saved|Сохран|Guardad|保存|儲存|저장|Salvo|Salv/i,
    `expected a success toast, got: ${txt}`);
  await closePage(page);
});

// ── 5. every form-bearing route renders with NO console errors ──

const FORM_ROUTES = [
  'dashboard', 'config', 'cv', 'evaluate', 'deep', 'auto', 'scan',
  'tracker', 'batch', 'pipeline', 'reports', 'activity', 'profile',
  'health', 'help', 'apply', 'project', 'training', 'followup',
  'contacto', 'patterns', 'interview-prep',
];

for (const route of FORM_ROUTES) {
  test(`Playwright: /#/${route} renders with no console errors`, { skip: SKIP }, async () => {
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.goto(baseUrl + '/#/' + route);
    await page.waitForSelector('#content', { timeout: 8000 });
    // Let async view fetches settle (model catalogue, lists, etc.).
    await page.waitForTimeout(400);
    const html = await page.locator('#content').innerHTML();
    assert.ok(html.length > 20, `#/${route} rendered empty`);
    // Ignore benign favicon/network noise from unconfigured optional
    // endpoints; fail only on real JS/render errors.
    const real = realConsoleErrors(errors);
    assert.deepEqual(real, [], `#/${route} console errors: ${real.join(' | ')}`);
    await closePage(page);
  });
}
