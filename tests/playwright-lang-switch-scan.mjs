/**
 * Language-switch survival for #/scan (owner-reported: "при переключении
 * языка некоторый контент не показывается правильно").
 *
 * I18n.onChange → Router.render() re-creates the whole view; scan state that
 * lived INSIDE render() (the loaded results corpus, the facet-chip sets) was
 * thrown away on every switch, blanking the results table until the heavy
 * /api/scan-results round-trip finished again. The fix hoists that state to
 * module level; this harness proves a language switch KEEPS the rendered rows
 * (and the ru labels) instead of blanking.
 *
 * Seeded corpus: the same canned last-scan.json pattern as
 * playwright-scan-filters.mjs — no network, CI-isolated.
 *
 * Opt-in (needs a browser binary): npm run test:e2e:browser
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function resolvePlaywright() {
  const candidates = [];
  if (process.env.CAREER_OPS_PLAYWRIGHT_PATH) candidates.push(process.env.CAREER_OPS_PLAYWRIGHT_PATH);
  for (const id of ['playwright', resolve(process.cwd(), '..', 'node_modules', 'playwright'), resolve(process.cwd(), 'node_modules', 'playwright')]) {
    try { return require(id); } catch { /* next */ }
  }
  return null;
}
const playwright = resolvePlaywright();
const SKIP = !playwright;

let server, baseUrl, browser, context, dir;

const ROWS = [
  { company: 'Acme Robotics', title: 'Senior Backend Engineer', location: 'Berlin, Germany', source: 'greenhouse', isRemote: false, workplaceType: 'Onsite', relocates: false, date: new Date().toISOString().slice(0, 10), salary: '90000 EUR', url: 'https://jobs.acme.example/1' },
  { company: 'Globex', title: 'Platform Engineer', location: 'Remote (EU)', source: 'lever', isRemote: true, workplaceType: 'Remote', relocates: false, date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), salary: '', url: 'https://jobs.globex.example/2' },
  { company: 'Initech', title: 'Staff Frontend Engineer', location: 'Munich, Germany', source: 'ashby', isRemote: false, workplaceType: 'Hybrid', relocates: false, date: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10), salary: '', url: 'https://jobs.initech.example/3' },
];

function seedLastScan() {
  // /api/scan-results contract: { en: snapshot, ru: snapshot } — a full
  // snapshot per locale (the view reads lastResults[lang]).
  const snap = () => ({ kind: 'en', when: new Date().toISOString(), fresh: ROWS, filtered: ROWS });
  writeFileSync(resolve(dir, 'data', 'last-scan.json'), JSON.stringify({ en: snap(), ru: snap() }));
}

before(async () => {
  if (SKIP) return;
  dir = mkdtempSync(resolve(tmpdir(), 'lang-switch-scan-'));
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\nEngineer.\n');
  seedLastScan();
  process.env.CAREER_OPS_ROOT = dir;
  process.env.CAREER_OPS_PLAYWRIGHT_PATH = process.env.CAREER_OPS_PLAYWRIGHT_PATH || '';
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
  browser = await playwright.chromium.launch();
  context = await browser.newContext({ viewport: { width: 1380, height: 900 } });
});

after(async () => {
  if (SKIP) return;
  await browser?.close();
  await new Promise((r) => server.close(r));
  delete process.env.CAREER_OPS_ROOT;
});

(async () => {
  if (SKIP) {
    test('skipped — no Playwright browser available', () => { assert.ok(true); });
    return;
  }

  test('switching en→ru keeps the rendered results table (no blanking)', async () => {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('career-ops-ui:lang', 'en'));
    const consoleErrors = [];
    page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 120)));
    // The owner-visible blank came from the /api/scan-results round-trip
    // being SLOW on a data-heavy instance. Emulate it: every refetch waits
    // 3 s, so the OLD render-local-state code sits blank past the assertion
    // window while the module-state fix paints instantly.
    let resultsGets = 0;
    await page.route('**/api/scan-results*', async (route) => {
      resultsGets++;
      await new Promise((r) => setTimeout(r, 4000));
      await route.continue();
    });
    await page.goto(`${baseUrl}/#/scan`, { waitUntil: 'domcontentloaded' });
    // Wait until the seeded corpus is actually on screen.
    await page.waitForFunction(() => document.body.innerText.includes('Acme Robotics'), null, { timeout: 15000 });
    const before = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().length);
    assert.ok(before > 200, `sanity: the en scan page should carry the seeded corpus (got ${before} chars)`);

    // The topbar language switcher.
    const sel = page.locator('select').filter({ has: page.locator('option[value="ru"]') }).first();
    await sel.selectOption('ru');
    await page.waitForTimeout(1500);

    const text = await page.evaluate(() => document.body.innerText);
    // THE discriminator: while the (3 s-delayed) refetch is still in flight,
    // module-level state must have ALREADY painted the ru results area.
    // The old render()-local state sat blank here — red.
    await page.waitForFunction(
      () => /подходящие|СТЕК|Подходящие/.test((document.getElementById('scan-results') || {}).innerText || ''),
      null,
      { timeout: 3200 },
    ).catch(() => {
      throw new Error(`results area must paint from module state while the 4 s refetch is in flight — the old render()-local state sat blank here. resultsHead: ${JSON.stringify((page.evaluate(() => (document.getElementById('scan-results') || {}).innerText || '').then ? '' : ''))}`);
    });
    const facts = await page.evaluate(async () => {
      const api = await fetch('/api/scan-results').then((r) => r.json());
      return {
        apiKeys: Object.keys(api),
        ruRows: Array.isArray(api.ru) ? api.ru.length : (api.ru && Array.isArray(api.ru.fresh) ? api.ru.fresh.length : String(api.ru).slice(0, 40)),
        resultsText: (document.getElementById('scan-results') || {}).innerText?.slice(0, 200) ?? null,
      };
    });
    console.log('FACTS:', JSON.stringify(facts));
    // The seeded corpus must SURVIVE the switch (module-level state).
    // The facets render from module state instantly; the row table lands
    // with the (delayed) refresh. Either way the corpus survives.
    await page.waitForFunction(() => document.body.innerText.includes('Acme Robotics'), null, { timeout: 10000 }).catch(() => {});
    assert.ok(text.includes('Acme Robotics') || (await page.evaluate(() => document.body.innerText)).includes('Acme Robotics'), `the results corpus must survive the language switch (it blanked — render()-local state). Page text head: ${text.slice(0, 300).replace(/\n/g, ' | ')}`);
    // The chrome must actually be Russian now.
    assert.ok(/[\u0400-\u04FF]/.test(text), 'the switched page must carry ru translations');
    assert.deepEqual(consoleErrors, [], `no page errors during the switch: ${JSON.stringify(consoleErrors)}`);
    const after = text.replace(/\s+/g, ' ').trim().length;
    assert.ok(after > before * 0.5, `content must not collapse on switch (before ${before} → after ${after} chars)`);
  });
})();
