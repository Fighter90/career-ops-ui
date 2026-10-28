/**
 * Browser-sweep P2/P3 — #/map cluster bubbles (CAR-125 v2 map).
 *
 * P2 (dark theme): the cluster fills were theme-blind — `.job-cluster.ring`
 * kept a fixed WHITE background while the number took the dark score palette
 * (#53d3c4 teal on white = 1.83:1), and filled tiles put WHITE numbers on
 * bright teal at the same ratio. In dark mode a cluster must sit on a
 * surface token with the score colour for the number/border, at ≥ 4.5:1
 * (computed here, not asserted by eye).
 * P3 (both themes): a word cluster label («related», ~36px) is wider than
 * the circle's ~30px content box, so the bubble read «elated». The label
 * must fit inside the box.
 *
 * Opt-in (needs a browser binary; Playwright is the parent's dep, not ours):
 *   npm run test:e2e:browser
 *
 * CI-isolated: throw-away CAREER_OPS_ROOT; /api/geocode, the tile host and
 * the font hosts are answered/aborted in the browser, so nothing reaches the
 * network. Geometry is computed for the initial fit ceiling (zoom 9):
 * each same-kind pair sits ~11px apart (inside the 26px solo distance → one
 * cluster per pair) and the two pairs' anchors sit ~44px apart (outside the
 * 18+18+4px fold threshold → the ring and the filled cluster stay separate).
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

// Both scan rows carry the same «related» fit band → the ring cluster's
// number is the seven-character word «related» (the P3 repro) and its
// colour is --map-score-mid (the tightest dark-palette contrast case).
const SCAN_ROWS = [
  { company: 'Acme', title: 'Platform Engineer', location: 'Leeds, UK', source: 'greenhouse', url: 'https://example.com/j/1', fit: { band: 'related' } },
  { company: 'Globex', title: 'SRE', location: 'Lyon, France', source: 'lever', url: 'https://example.com/j/2', fit: { band: 'related' } },
];
// Screen geometry at the fit ceiling (zoom 9 ≈ 0.18 km/px here):
// Acme↔Globex ≈ 11px (one ring cluster), TrackOne↔TrackTwo ≈ 11px (one
// filled cluster), ring anchor ↔ filled anchor ≈ 44px (no cross-kind fold).
const GEO = {
  Acme: { lat: 53.8, lon: -1.55 },
  Globex: { lat: 53.8, lon: -1.52 },
  TrackOne: { lat: 53.8, lon: -1.4 },
  TrackTwo: { lat: 53.8, lon: -1.43 },
};

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-map-cluster-'));
  for (const d of ['config', 'data', 'modes']) mkdirSync(resolve(dir, d), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Tester\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  // Two scored tracker rows (filled clusters). Their locations resolve
  // server-side through the scan-history URL index (no Location column).
  writeFileSync(resolve(dir, 'data', 'applications.md'), [
    '# Applications Tracker',
    '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes | URL |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|-----|',
    '| 1 | 2026-10-28 | TrackOne | Backend Engineer | 4.5/5 | Applied | ❌ | — | x | https://example.com/j/9 |',
    '| 2 | 2026-10-28 | TrackTwo | Data Engineer | 4.5/5 | Applied | ❌ | — | x | https://example.com/j/10 |',
    '',
  ].join('\n'));
  writeFileSync(resolve(dir, 'data', 'scan-history.tsv'), [
    'url\tlocation',
    'https://example.com/j/9\tOslo, Norway',
    'https://example.com/j/10\tOslo, Norway',
    '',
  ].join('\n'));
  const snap = { en: { kind: 'en', when: new Date().toISOString(), fresh: SCAN_ROWS, filtered: SCAN_ROWS }, ru: null };
  writeFileSync(resolve(dir, 'data', 'last-scan.json'), JSON.stringify(snap));
  process.env.CAREER_OPS_ROOT = dir;

  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
  browser = await playwright.chromium.launch({ headless: process.env.PWDEBUG !== '1' });
  context = await browser.newContext();
  await context.route('**/api/geocode?**', (route) => {
    const company = new URL(route.request().url()).searchParams.get('company') || '';
    const at = GEO[company] || { lat: 0, lon: 0 };
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...at, exact: false }) });
  });
  await context.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  // Strictly offline: the real suite tolerates the Google Fonts fetch, this
  // fixture must not need the network at all.
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
});

after(async () => {
  if (context) await context.close();
  if (browser) await browser.close();
  if (server) { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
  delete process.env.CAREER_OPS_ROOT;
});

async function openMapWithClusters(page) {
  await page.goto(baseUrl + '/#/map');
  await page.waitForSelector('#job-map.leaflet-container', { timeout: 10000 });
  // All four places geocode and pass the inclusive default filters.
  await page.waitForFunction(() => /4 \/ 4 mapped/.test(document.querySelector('.job-map-status-chip')?.textContent || ''),
    null, { timeout: 15000 });
  await page.locator('.job-cluster.ring').first().waitFor({ timeout: 10000 });
  await page.locator('.job-cluster:not(.ring)').first().waitFor({ timeout: 10000 });
}

// Shared in-page helpers: parse "rgb(...)" and compute WCAG contrast.
const MEASURE_JS = () => {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  window.__contrast = (fg, bg) => {
    const [a, b] = [lum(parse(fg)), lum(parse(bg))].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  };
  window.__readCluster = (sel) => {
    const el = document.querySelector(sel);
    const lab = el.querySelector('.job-cluster-best');
    return {
      label: lab.textContent,
      bg: getComputedStyle(el).backgroundColor,
      fg: getComputedStyle(lab).color,
      contrast: window.__contrast(getComputedStyle(lab).color, getComputedStyle(el).backgroundColor),
      // offsetWidth/clientWidth ignore the scale-in animation transform.
      labW: lab.offsetWidth,
      boxW: el.clientWidth,
    };
  };
};

test('map: dark-theme cluster bubbles sit on a surface fill with AA number contrast', { skip: SKIP }, async () => {
  const page = await context.newPage();
  try {
    await openMapWithClusters(page);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.evaluate(MEASURE_JS);
    const ring = await page.evaluate(() => window.__readCluster('.job-cluster.ring'));
    const filled = await page.evaluate(() => window.__readCluster('.job-cluster:not(.ring)'));
    assert.equal(ring.label, 'related', 'the ring cluster carries the long word label');
    assert.notEqual(ring.bg, 'rgb(255, 255, 255)', `the dark ring fill must not stay white (got ${ring.bg})`);
    assert.ok(ring.contrast >= 4.5, `ring number contrast ${ring.contrast.toFixed(2)}:1 < 4.5 (${ring.fg} on ${ring.bg})`);
    assert.ok(filled.contrast >= 4.5, `filled number contrast ${filled.contrast.toFixed(2)}:1 < 4.5 (${filled.fg} on ${filled.bg})`);
  } finally { await page.close(); }
});

test('map: the prefers-color-scheme dark mirror gets the same cluster treatment', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: 'dark' });
  try {
    await openMapWithClusters(page);
    await page.evaluate(MEASURE_JS);
    const ring = await page.evaluate(() => window.__readCluster('.job-cluster.ring'));
    assert.notEqual(ring.bg, 'rgb(255, 255, 255)', `the OS-dark ring fill must not stay white (got ${ring.bg})`);
    assert.ok(ring.contrast >= 4.5, `OS-dark ring number contrast ${ring.contrast.toFixed(2)}:1 < 4.5 (${ring.fg} on ${ring.bg})`);
  } finally { await page.close(); }
});

test('map: the cluster label fits the circle (a long word is not clipped)', { skip: SKIP }, async () => {
  const page = await context.newPage();
  try {
    await openMapWithClusters(page);
    await page.evaluate(MEASURE_JS);
    // The label fit runs one frame after the icon attaches — poll briefly,
    // then assert on the settled measurement (pre-fix this stays overflowing
    // and the assert below is the fast, explicit red).
    await page.waitForFunction(() => {
      const el = document.querySelector('.job-cluster.ring');
      if (!el) return false;
      const lab = el.querySelector('.job-cluster-best');
      return lab && lab.offsetWidth <= el.clientWidth;
    }, null, { timeout: 2500 }).catch(() => {});
    const fit = await page.evaluate(() => window.__readCluster('.job-cluster.ring'));
    assert.equal(fit.label, 'related', 'the fixture must produce the long word label');
    assert.ok(fit.labW <= fit.boxW + 0.5, `label ${fit.labW}px overflows the cluster content box ${fit.boxW}px — the bubble reads «${fit.label.slice(0, -1)}»`);
  } finally { await page.close(); }
});
