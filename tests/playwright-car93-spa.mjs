/**
 * CAR-93 (Opus 5-5 SPA review, sourcing views) — browser-level red→green
 * gates for the defects that only exist in a real DOM:
 *
 *   F2  pipeline row: nested ▶/✕/link keys must reach the nested controls;
 *   F3  a saved search restored while the corpus is still loading keeps
 *       its country/seniority filters (dataset.want);
 *   F4  the live source-dropdown refresh keeps the selected source;
 *   F5  "Use the default" on OPENROUTER_MODEL is not reverted by the
 *       live catalogue;
 *   F6  config Save / dashboard Refresh re-renders do not stack
 *       providers-changed listeners;
 *   F9  an auto-pipeline stream that ends without done/error toasts;
 *   F10 failed loads render an error state (scan) / "—" (pipeline),
 *       never a blank table or a fake "0 tracked";
 *   F11 tracker Hired rows keep badge-hired (classifier rename pin);
 *   F12 sorting / star toggles keep keyboard focus on the same row;
 *   F1  a single-page tracker renders the pager summary (the reviewed
 *       "appendChild(null)" crash is NOT reproducible — controls() never
 *       returns null; this pins that verdict).
 *
 * CI-isolated: a throw-away CAREER_OPS_ROOT via mkdtempSync — never the
 * user's real career-ops data; no network beyond 127.0.0.1.
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

// ── seeds ────────────────────────────────────────────────────────────────────
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
const SCAN_ROWS = [
  { company: 'Acme', title: 'Senior Backend Engineer', location: 'Berlin, Germany', source: 'greenhouse', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(0), salary: '90000 EUR', url: 'https://example.com/j/1' },
  { company: 'Globex', title: 'Staff Platform Engineer', location: 'Remote', source: 'lever', isRemote: true, workplaceType: 'Remote', relocates: false, date: iso(3), salary: '', url: 'https://example.com/j/2' },
  { company: 'Initech', title: 'Junior Developer', location: 'London, UK', source: 'ashby', isRemote: false, workplaceType: 'Hybrid', relocates: false, date: iso(10), salary: '', url: 'https://example.com/j/3' },
  { company: 'Stark', title: 'Data Scientist', location: 'New York, USA', source: 'greenhouse', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(0), salary: '', url: 'https://example.com/j/5' },
];

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-car93-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n\nReal Person, Senior Backend Engineer.\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Tester\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  // A stored OPENROUTER_MODEL so the config select-remote field is SEEDED
  // with a real value — that's the precondition for the F5 revert bug
  // (`keep = input.value || current` resurrects it over a deliberate '').
  writeFileSync(resolve(dir, '.env'), 'OPENROUTER_MODEL=vendor/stored-model\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'x\n');
  // Pipeline queue: two URLs so the row's nested ▶/✕ controls exist (F2).
  writeFileSync(resolve(dir, 'data', 'pipeline.md'),
    '# Pipeline\n\n```\nhttps://jobs.example.com/one\nhttps://jobs.example.com/two\n```\n');
  // Tracker: three rows, one Hired (F11/F12) — every row carries an
  // Outcome button with IDENTICAL text, which is what broke the focus marker.
  writeFileSync(resolve(dir, 'data', 'applications.md'),
    '# Applications Tracker\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n' +
    '|---|------|---------|------|-------|--------|-----|--------|-------|\n' +
    '| 1 | 2026-10-01 | Alpha | Backend Engineer | 4.2/5 | Interview | ❌ | — | |\n' +
    '| 2 | 2026-10-02 | Beta | Frontend Engineer | 3.9/5 | Hired | ❌ | — | |\n' +
    '| 3 | 2026-10-03 | Gamma | Platform Engineer | 4.5/5 | Applied | ❌ | — | |\n');
  // Scan corpus for the filter/star tests (F3/F4/F12b).
  const snap = { en: { kind: 'en', when: new Date().toISOString(), fresh: SCAN_ROWS, filtered: SCAN_ROWS }, ru: null };
  writeFileSync(resolve(dir, 'data', 'last-scan.json'), JSON.stringify(snap));

  process.env.CAREER_OPS_ROOT = dir;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
  browser = await playwright.chromium.launch({ headless: process.env.PWDEBUG !== '1' });
  context = await browser.newContext();
});

after(async () => {
  if (context) await context.close();
  if (browser) await browser.close();
  if (server) { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
  delete process.env.CAREER_OPS_ROOT;
});

// Pin the UI to EN so text selectors are locale-stable.
async function newPage() {
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('career-ops-ui:lang', 'en');
  });
  return page;
}
async function openScan(page) {
  await page.goto(baseUrl + '/#/scan');
  await page.waitForSelector('#scan-results table tbody tr', { timeout: 10000 });
}

// ── F1 — single-page tracker: no crash, summary renders ─────────────────────

test('CAR-93 F1: a single-page tracker renders the pager summary (appendChild never gets null)', { skip: SKIP }, async () => {
  const page = await newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(baseUrl + '/#/tracker');
  await page.waitForSelector('tbody tr');
  await page.waitForTimeout(150);
  assert.deepEqual(errors, [], 'no uncaught errors: ' + errors.join(' | '));
  const summaries = await page.$$('.pg-summary');
  assert.ok(summaries.length >= 1, 'single-page controls render the N-items summary');
  await page.close();
});

// ── F2 — nested row controls keep their keyboard activation ─────────────────

test('CAR-93 F2: Enter on a row\u2019s nested ▶ button evaluates (not re-selects the row)', { skip: SKIP }, async () => {
  const page = await newPage();
  await page.goto(baseUrl + '/#/pipeline');
  await page.waitForSelector('.pipeline-row');
  const btn = page.locator('.pipeline-row').first().locator('button').first();
  await btn.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const hash = await page.evaluate(() => window.location.hash);
  assert.match(hash, /^#\/evaluate\?url=/,
    `Enter on the row's ▶ must navigate to /evaluate, got: ${hash}`);
  await page.close();
});

// ── F3 — saved-search restore keeps country/seniority ───────────────────────

test('CAR-93 F3: a saved search restored before the corpus loads keeps country + seniority', { skip: SKIP }, async () => {
  const page = await newPage();
  await openScan(page);
  const code = await page.$eval('#scan-filter-country', (el) => (el.options[1] ? el.options[1].value : ''));
  assert.ok(code, 'country options painted from the corpus');
  await page.selectOption('#scan-filter-country', code);
  await page.selectOption('#scan-filter-seniority', 'senior');
  await page.waitForTimeout(80);
  await page.fill('input[placeholder="Name this search…"]', 'de-senior');
  await page.locator('button:has-text("Save search")').click();
  await page.waitForTimeout(120);
  // Restore it on a visit where /api/scan-results is still in flight —
  // the country/seniority options do not exist yet at setFilterState time.
  await page.route('**/api/scan-results', async (route) => {
    await new Promise((r) => setTimeout(r, 600));
    await route.continue();
  });
  await page.goto(baseUrl + '/#/scan');
  await page.waitForFunction(
    () => [...document.querySelectorAll('select[aria-label="Saved searches"] option')]
      .some((o) => o.value === 'de-senior'),
    null, { timeout: 8000 });
  await page.selectOption('select[aria-label="Saved searches"]', 'de-senior');
  await page.waitForSelector('#scan-results table tbody tr', { timeout: 10000 });
  await page.waitForTimeout(150);
  const country = await page.$eval('#scan-filter-country', (el) => el.value);
  const seniority = await page.$eval('#scan-filter-seniority', (el) => el.value);
  assert.equal(country, code, `country filter must survive the restore (got ${country || "''"})`);
  assert.equal(seniority, 'senior', `seniority filter must survive the restore (got ${seniority || "''"})`);
  const rows = await page.locator('#scan-results table tbody tr').count();
  assert.equal(rows, 1, 'the restored filters actually filter (Acme senior backend only)');
  await page.unroute('**/api/scan-results');
  await page.close();
});

// ── F4 — live source-dropdown refresh keeps the selection ───────────────────

test('CAR-93 F4: the live source-dropdown repaint preserves the selected source', { skip: SKIP }, async () => {
  const page = await newPage();
  await page.route('**/api/scan/sources', async (route) => {
    await new Promise((r) => setTimeout(r, 500));
    await route.continue();
  });
  await page.goto(baseUrl + '/#/scan');
  await page.waitForSelector('#scan-results table tbody tr', { timeout: 10000 });
  await page.selectOption('#scan-filter-source', 'greenhouse');
  await page.waitForTimeout(900); // let the delayed registry repaint land
  const v = await page.$eval('#scan-filter-source', (el) => el.value);
  assert.equal(v, 'greenhouse', `the repaint must preserve the user's choice (got ${v || "''"})`);
  const rows = await page.locator('#scan-results table tbody tr').count();
  assert.equal(rows, 2, 'and the table stays filtered by that source');
  await page.unroute('**/api/scan/sources');
  await page.close();
});

// ── F5 — "Use the default" is not reverted by the live catalogue ────────────

test('CAR-93 F5: choosing "Use the default" on OPENROUTER_MODEL sticks after the catalogue lands', { skip: SKIP }, async () => {
  const page = await newPage();
  await page.route('**/api/openrouter/models', async (route) => {
    await new Promise((r) => setTimeout(r, 700));
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ models: [{ id: 'vendor/model-a' }, { id: 'vendor/model-b' }] }),
    });
  });
  await page.goto(baseUrl + '/#/config');
  const sel = page.locator('#cfg-openrouter-model');
  await sel.waitFor({ state: 'visible', timeout: 10000 });
  await sel.selectOption('');
  await page.waitForTimeout(1100); // catalogue resolves AFTER the user's clear
  const after = await sel.inputValue();
  assert.equal(after, '', `a deliberate "Use the default" must stick (got ${after})`);
  await page.unroute('**/api/openrouter/models');
  await page.close();
});

// ── F6 — Router.render() re-renders do not stack listeners ──────────────────

const LISTENER_PROBE = `
  window.__pc = 0;
  window.__pcRm = 0;
  window.__sc = 0;
  window.__scRm = 0;
  const origAddD = document.addEventListener.bind(document);
  const origRmD = document.removeEventListener.bind(document);
  document.addEventListener = function (type, fn, opts) {
    if (type === 'providers-changed') window.__pc++;
    return origAddD(type, fn, opts);
  };
  document.removeEventListener = function (type, fn, opts) {
    if (type === 'providers-changed') window.__pcRm++;
    return origRmD(type, fn, opts);
  };
  const origAddW = window.addEventListener.bind(window);
  const origRmW = window.removeEventListener.bind(window);
  window.addEventListener = function (type, fn, opts) {
    if (type === 'scroll') window.__sc++;
    return origAddW(type, fn, opts);
  };
  window.removeEventListener = function (type, fn, opts) {
    if (type === 'scroll') window.__scRm++;
    return origRmW(type, fn, opts);
  };
`;

test('CAR-93 F6: three config Saves leave exactly one live providers-changed listener', { skip: SKIP }, async () => {
  const page = await newPage();
  await page.addInitScript(LISTENER_PROBE);
  await page.goto(baseUrl + '/#/config');
  await page.waitForSelector('#cfg-tabpanel', { timeout: 10000 });
  const save = page.locator('button:has-text("Save")').first();
  for (let i = 0; i < 3; i++) {
    await save.click();
    await page.waitForTimeout(350);
  }
  const [added, removed] = await page.evaluate(() => [window.__pc, window.__pcRm]);
  assert.equal(added - removed, 1,
    `live providers-changed listeners after 3 saves: ${added - removed} (added ${added}, removed ${removed})`);
  await page.close();
});

test('CAR-114 F6: three dashboard Refreshes leave exactly one live scroll listener (no per-visit stack)', { skip: SKIP }, async () => {
  // Was: the hero provider chip's providers-changed listener (removed by the
  // CAR-114 provider de-dup — app.js's header badge owns provider status and
  // mounts ONCE per page load, never per visit). The per-visit listener the
  // dashboard now owns is the parallax hero's window 'scroll' listener, torn
  // down by __dashV2Cleanup before each re-mount — the same no-stacking
  // invariant, new owner.
  const page = await newPage();
  await page.addInitScript(LISTENER_PROBE);
  await page.goto(baseUrl + '/#/dashboard');
  await page.waitForSelector('[data-test="dash-refresh"]', { timeout: 10000 });
  for (let i = 0; i < 3; i++) {
    await page.click('[data-test="dash-refresh"]');
    await page.waitForTimeout(350);
  }
  const [added, removed] = await page.evaluate(() => [window.__sc, window.__scRm]);
  assert.equal(added - removed, 1,
    `live scroll listeners after 3 refreshes: ${added - removed} (added ${added}, removed ${removed})`);
  // The de-dup contract: the dashboard itself must never re-add a
  // providers-changed listener (the header badge owns that channel).
  const pc = await page.evaluate(() => window.__pc);
  assert.equal(pc, 0, 'dashboard must not register providers-changed listeners (header owns them)');
  await page.close();
});

// ── F9 — a stream that ends without done/error is not silent ────────────────

test('CAR-93 F9: an auto-pipeline stream ending without done/error toasts an error', { skip: SKIP }, async () => {
  const page = await newPage();
  await page.route('**/api/auto-pipeline', (route) => route.fulfill({
    contentType: 'text/event-stream',
    body: 'event: step\ndata: {"i":0,"status":"running"}\n\n',
  }));
  await page.goto(baseUrl + '/#/auto');
  await page.fill('#auto-url', 'https://jobs.example.com/one');
  await page.locator('button:has-text("Run auto-pipeline")').click();
  await page.waitForTimeout(800);
  const toast = await page.$eval('#toast', (el) => el.className + '|' + (el.textContent || ''));
  assert.match(toast, /error/, `a non-terminal stream end must surface an error toast, got: ${toast}`);
  await page.unroute('**/api/auto-pipeline');
  await page.close();
});

// ── F10 — failed loads are error states, not empty states ───────────────────

test('CAR-93 F10: a failed first /api/scan-results renders an error state (not a blank)', { skip: SKIP }, async () => {
  const page = await newPage();
  await page.route('**/api/scan-results', (route) => route.abort());
  await page.goto(baseUrl + '/#/scan');
  await page.waitForTimeout(900);
  const txt = await page.$eval('#scan-results', (el) => (el.textContent || '').trim());
  assert.ok(txt.length > 0, 'the results area must not be blank on a failed first load');
  assert.match(txt, /error/i, `expected an error state, got: ${txt.slice(0, 120)}`);
  await page.unroute('**/api/scan-results');
  await page.close();
});

test('CAR-93 F10: a failed /api/tracker shows "—" tracked, not a fake 0', { skip: SKIP }, async () => {
  const page = await newPage();
  await page.route('**/api/tracker', (route) => route.abort());
  await page.goto(baseUrl + '/#/pipeline');
  await page.waitForTimeout(900);
  const txt = (await page.locator('div.card.mb-3').first().textContent()).replace(/\s+/g, '');
  assert.match(txt, /tracked/, 'the tracked chip is rendered');
  assert.match(txt, /—/, `a failed read shows a dash, got: ${txt}`);
  assert.ok(!/0tracked/.test(txt), `must not read as 0 tracked, got: ${txt}`);
  await page.unroute('**/api/tracker');
  await page.close();
});

// ── F11 — the tracker classifier is its own (pin) ───────────────────────────

test('CAR-93 F11: tracker Hired rows keep badge-hired (renamed classifier)', { skip: SKIP }, async () => {
  const page = await newPage();
  await page.goto(baseUrl + '/#/tracker');
  await page.waitForSelector('tbody tr');
  const cls = await page.locator('tbody tr', { hasText: 'Beta' }).locator('.badge').first().getAttribute('class');
  assert.match(cls, /badge-hired/, `Hired badge class, got: ${cls}`);
  await page.close();
});

// ── F12 — focus preservation across rebuilds ────────────────────────────────

test('CAR-93 F12: a filter rebuild keeps focus on the same row\u2019s Outcome button', { skip: SKIP }, async () => {
  const page = await newPage();
  await page.goto(baseUrl + '/#/tracker');
  await page.waitForSelector('tbody tr');
  // Focus Gamma's Outcome button, then trigger a tbody rebuild WITHOUT
  // moving focus: dispatching `input` on the search box drives
  // applyFilters() while activeElement stays on the row button — exactly
  // the rebuild the withFocusPreserved contract covers. (A real mouse
  // click on a sort header focuses THAT header, which lives outside
  // tbody — nothing to restore there.)
  await page.locator('tbody tr', { hasText: 'Gamma' }).locator('button:has-text("Outcome")').focus();
  await page.evaluate(() => {
    const input = document.querySelector('input[type="search"]');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(200);
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || !el.getAttribute) return '';
    return 'key=' + (el.getAttribute('data-key') || '') + ' label=' + (el.getAttribute('aria-label') || '');
  });
  assert.match(focused, /key=3/, `focus must stay on Gamma's Outcome button (tracker #3), got: ${focused}`);
  assert.match(focused, /label=.*Gamma/, `the focused control must be Gamma's, got: ${focused}`);
  await page.close();
});

test('CAR-93 F12: toggling a star keeps focus on the same row\u2019s star', { skip: SKIP }, async () => {
  const page = await newPage();
  await openScan(page);
  const stars = page.locator('#scan-results tbody .btn-star');
  await stars.nth(1).focus();
  await stars.nth(1).click();
  await page.waitForTimeout(150);
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    return el && el.getAttribute ? (el.getAttribute('data-key') || '') : '';
  });
  assert.equal(info, 'https://example.com/j/2', `focus must stay on Globex's star, got: ${info}`);
  await page.close();
});
