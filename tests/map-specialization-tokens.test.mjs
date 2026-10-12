/**
 * v1.251.1 — the specialization filter must match on DISTINCTIVE tokens:
 * seniority (senior/junior/lead/ведущий…) and generic job nouns
 * (developer/engineer/…) are dropped from the role's matcher, so
 * «Senior PHP Developer» keeps the PHP postings and stops matching
 * «Senior Java Developer». A role with no distinctive tokens left
 * («Software Engineer») falls back to the whole-phrase match.
 * «Go» stays word-bounded: it never catches «Golang» or «Google».
 *
 * The ticket's table (8 postings, 3+1 roles) drives the assertions via the
 * status chip "visible / total mapped".
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

function resolvePlaywright() {
  try {
    // CI: npm install --no-save playwright
    return require('playwright');
  } catch {
    throw new Error('playwright is required');
  }
}
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const ROOT = mkdtempSync(resolve(tmpdir(), 'pw-map-tokens-'));
let server; let baseUrl; let browser; let context;

const POSTINGS = [
  ['Senior PHP Developer', 'https://example.com/j/1'],
  ['Senior Java Developer', 'https://example.com/j/2'],
  ['Ведущий PHP-разработчик', 'https://example.com/j/3'],
  ['Golang Developer', 'https://example.com/j/4'],
  ['Go Engineer', 'https://example.com/j/5'],
  ['Platform Engineer', 'https://example.com/j/6'],
  ['Data Engineer', 'https://example.com/j/7'],
  ['Software Engineer', 'https://example.com/j/8'],
];
const ROLES = ['Senior PHP Developer', 'Go Developer', 'Platform Engineer', 'Software Engineer'];

before(async () => {
  process.env.CAREER_OPS_ROOT = ROOT;
  for (const d of ['config', 'data', 'modes']) mkdirSync(resolve(ROOT, d), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'),
    'candidate:\n  full_name: Tester\ntarget_roles:\n  primary:\n'
    + ROLES.map((r) => `    - ${r}`).join('\n') + '\n');
  writeFileSync(resolve(ROOT, 'config', 'plugins.yml'), 'plugins:\n  commute:\n    home_lat: 53.8\n    home_lon: -1.55\n    max_minutes: 45\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(ROOT, 'data', 'applications.md'), '');
  // Fixed coordinates per posting — no geocode round-trips in the test.
  writeFileSync(resolve(ROOT, 'data', 'commute.tsv'), [
    'url\tlocation\tprecision\tlat\tlon\tkm\tmin\tchecked\tfactor',
    ...POSTINGS.map(([, url], i) => `${url}\tLeeds, UK\tcity\t${53.5 + i * 0.05}\t${-1.6 + i * 0.05}\t${10 + i}\t${20 + i * 3}\t2026-10-12\t1`),
    '',
  ].join('\n'));
  writeFileSync(resolve(ROOT, 'modes', 'oferta.md'), 'x\n');
  writeFileSync(resolve(ROOT, 'data', 'last-scan.json'), JSON.stringify({
    en: { kind: 'en', when: new Date().toISOString(),
      fresh: POSTINGS.map(([title, url], i) => ({ company: `Co${i + 1}`, title, location: 'Leeds, UK', source: 'greenhouse', url })),
      filtered: POSTINGS.map(([title, url], i) => ({ company: `Co${i + 1}`, title, location: 'Leeds, UK', source: 'greenhouse', url })) },
    ru: null,
  }));

  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
  const pw = resolvePlaywright();
  browser = await pw.chromium.launch({ headless: process.env.PWDEBUG !== '1' });
  context = await browser.newContext();
});

after(async () => {
  await browser?.close();
  await new Promise((r) => server?.close(r));
});

async function chipAfterSpec(page, role) {
  const sel = page.locator('.job-map-spec-select');
  await sel.waitFor({ timeout: 10000 });
  await sel.selectOption(role === null ? { index: 0 } : { label: role });
  await page.waitForFunction(
    (want) => (document.querySelector('.job-map-status-chip')?.textContent || '').startsWith(want),
    role === null ? '8 / 8' : role === 'Senior PHP Developer' ? '2 / 8'
      : role === 'Go Developer' ? '1 / 8'
      : role === 'Platform Engineer' ? '1 / 8'
      : role === 'Software Engineer' ? '1 / 8'
      : '',
    { timeout: 10000 },
  );
  return (document.querySelector('.job-map-status-chip')?.textContent || '').trim();
}

test('specialization tokens: «Senior PHP Developer» keeps only the PHP postings', async () => {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/#/map`);
    await page.waitForSelector('#job-map.leaflet-container', { timeout: 15000 });
    await page.waitForFunction(() => /8 \/ 8/.test(document.querySelector('.job-map-status-chip')?.textContent || ''), null, { timeout: 15000 });
    const chip = await chipAfterSpec(page, 'Senior PHP Developer');
    assert.match(chip, /^2 \/ 8/, 'PHP role: the seniority word no longer matches Java; «Ведущий PHP-разработчик» matches via PHP');
  } finally { await page.close(); }
});

test('specialization tokens: «Go Developer» keeps «Go Engineer», never «Golang»', async () => {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/#/map`);
    await page.waitForSelector('#job-map.leaflet-container', { timeout: 15000 });
    await page.waitForFunction(() => /8 \/ 8/.test(document.querySelector('.job-map-status-chip')?.textContent || ''), null, { timeout: 15000 });
    const chip = await chipAfterSpec(page, 'Go Developer');
    assert.match(chip, /^1 \/ 8/, 'generic Developer dropped; word-bounded Go never matches Golang');
  } finally { await page.close(); }
});

test('specialization tokens: «Platform Engineer» keeps only itself (generic Engineer dropped)', async () => {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/#/map`);
    await page.waitForSelector('#job-map.leaflet-container', { timeout: 15000 });
    await page.waitForFunction(() => /8 \/ 8/.test(document.querySelector('.job-map-status-chip')?.textContent || ''), null, { timeout: 15000 });
    const chip = await chipAfterSpec(page, 'Platform Engineer');
    assert.match(chip, /^1 \/ 8/, 'Data/Go Engineers no longer ride the generic token');
  } finally { await page.close(); }
});

test('specialization fallback: «Software Engineer» (no distinctive tokens) matches the whole phrase', async () => {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/#/map`);
    await page.waitForSelector('#job-map.leaflet-container', { timeout: 15000 });
    await page.waitForFunction(() => /8 \/ 8/.test(document.querySelector('.job-map-status-chip')?.textContent || ''), null, { timeout: 15000 });
    const chip = await chipAfterSpec(page, 'Software Engineer');
    assert.match(chip, /^1 \/ 8/, 'the whole-phrase fallback matches its own posting, not Data/Go Engineers');
  } finally { await page.close(); }
});

test('specialization reset: «All specializations» restores all 8', async () => {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/#/map`);
    await page.waitForSelector('#job-map.leaflet-container', { timeout: 15000 });
    await page.waitForFunction(() => /8 \/ 8/.test(document.querySelector('.job-map-status-chip')?.textContent || ''), null, { timeout: 15000 });
    const chip = await chipAfterSpec(page, null);
    assert.match(chip, /^8 \/ 8/);
  } finally { await page.close(); }
});
