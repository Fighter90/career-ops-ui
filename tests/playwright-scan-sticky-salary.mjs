/**
 * Playwright probes for two owner-reported #/scan visual defects:
 *
 *   1. Sticky scan-table header paints OVER the topbar: both
 *      `table.scan-tbl thead th` and `.topbar` carry z-index var(--z-topbar)
 *      and the thead is later in the DOM, so once the page scrolls the
 *      container's sticky header under the topbar it covers the search bar.
 *      Fix: thead z-index 1 (sticky already lifts it above the rows —
 *      precedent: components.css `.reposts-body .tbl th`).
 *
 *   2. The Salary popover inputs inherit `.v2-scan-bar .input`
 *      (flex: 1 1 200px) — in the popover's COLUMN flex container that
 *      flex-basis becomes a ~200px HEIGHT. Fix: scope the bar rule to direct
 *      children (`.v2-scan-bar > .input`) + a protective pop rule.
 *
 * Opt-in (needs a browser binary): npm run test:e2e:browser
 * CI-isolated: throw-away CAREER_OPS_ROOT via mkdtempSync — no real data.
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

// A tall-enough canned corpus so the results table has body height; the page
// must be scrollable so the table container can travel under the topbar.
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
const ROWS = Array.from({ length: 30 }, (_, i) => ({
  company: `Acme ${i + 1}`, title: `Senior Backend Engineer ${i + 1}`,
  location: 'Berlin, Germany', source: 'greenhouse', isRemote: false,
  workplaceType: 'Onsite', relocates: false, date: iso(0),
  salary: i % 2 ? '90000 EUR' : '', url: `https://example.com/j/${i + 1}`,
}));

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-sticky-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
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
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
});

after(async () => {
  if (context) await context.close();
  if (browser) await browser.close();
  if (server) { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
  delete process.env.CAREER_OPS_ROOT;
});

async function openScan() {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/scan');
  await page.waitForSelector('#scan-results table tbody tr', { timeout: 8000 });
  return page;
}

test('scan sticky thead never paints over the topbar search bar', { skip: SKIP }, async () => {
  const page = await openScan();
  // Scroll the page until the sticky thead sits INSIDE the searchbar's band:
  // the thead rides with the results container (its own scrollport is
  // separate), so the page scroll offset is computed from the measured boxes.
  const scrolled = await page.evaluate(() => {
    const topbar = document.querySelector('.topbar');
    const wrap = document.querySelector('.table-wrap.v2-scan-viewport');
    // Phase 1: scroll past any top-of-page banner so the sticky topbar is
    // actually stuck to the viewport top.
    window.scrollTo(0, document.documentElement.scrollHeight);
    const search = document.querySelector('.searchbar');
    const s = search.getBoundingClientRect();
    // Phase 2: bring the container top 2px below the searchbar top — the th
    // band then sits fully inside the searchbar band.
    const wTop = wrap.getBoundingClientRect().top;
    window.scrollBy(0, Math.round(wTop - (s.y + 2)));
    return {
      topbarBottom: topbar.getBoundingClientRect().bottom,
      wrapTop: wrap.getBoundingClientRect().top,
      scrollY: window.scrollY,
    };
  });
  assert.ok(scrolled.scrollY > 0, 'page must be scrollable for this probe to mean anything');
  assert.ok(scrolled.wrapTop >= 0 && scrolled.wrapTop < scrolled.topbarBottom,
    `container top (${scrolled.wrapTop}) must travel into the topbar band (0…${scrolled.topbarBottom})`);

  const hit = await page.evaluate(() => {
    const th = document.querySelector('#scan-results thead th');
    const search = document.querySelector('.searchbar');
    if (!th || !search) return { error: 'missing elements' };
    const a = th.getBoundingClientRect(), b = search.getBoundingClientRect();
    const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.width, b.x + b.width), y2 = Math.min(a.y + a.height, b.y + b.height);
    if (x2 <= x1 || y2 <= y1) return { overlap: false };
    // The point sits in BOTH boxes — whoever paints there wins.
    const el = document.elementFromPoint((x1 + x2) / 2, (y1 + y2) / 2);
    return {
      overlap: true,
      coveredByThead: !!(el && (el === th || th.contains(el) || (el.closest && el.closest('thead')))),
      top: el ? (el.tagName + '.' + (el.className || '')).slice(0, 80) : 'none',
    };
  });
  if (hit.error) assert.fail(hit.error);
  if (!hit.overlap) { await page.close(); return; } // layout changed; nothing to assert
  assert.equal(hit.coveredByThead, false,
    `thead th paints over the topbar searchbar (topmost element at the overlap: ${hit.top})`);
  await page.close();
});

test('scan salary popover inputs are not 200px tall', { skip: SKIP }, async () => {
  const page = await openScan();
  await page.click('.v2-scan-chip-btn[title="Salary"]');
  await page.waitForSelector('#scan-filter-salary-min', { state: 'visible', timeout: 4000 });
  const h = await page.evaluate(() => {
    const min = document.getElementById('scan-filter-salary-min');
    const max = document.getElementById('scan-filter-salary-max');
    return { min: min.offsetHeight, max: max.offsetHeight };
  });
  assert.ok(h.min < 80, `salary-min input is ${h.min}px tall (flex-basis 200px leaked into the column popover)`);
  assert.ok(h.max < 80, `salary-max input is ${h.max}px tall`);
  await page.close();
});
