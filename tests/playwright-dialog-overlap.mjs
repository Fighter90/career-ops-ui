/**
 * CAR-238 — a dialog TITLE must never run under the corner «✕ Close dialog»
 * control (the regression: the scan quick view's long posting title rendered
 * underneath the close button in the panel's top-right corner).
 *
 * The fix is at the CLASS level, one contract for every dialog family:
 *   1. the corner close control is absolutely positioned inside the dialog
 *      (out of the title's flow — a long title can never push or overlap it);
 *   2. every dialog title reserves the control's room on the inline-end side
 *      via a LOGICAL padding (52px — control + gap), so [dir="rtl"] mirrors
 *      the reserved side to the left automatically;
 *   3. long titles wrap (overflow-wrap: anywhere) instead of clipping.
 *
 * Two halves, in one file:
 *   - source-static pins (always run, no browser needed): the CSS contract is
 *     present in overlays.css (shared #modal) and app.css (scan quick view),
 *     and the quick view renders the compact ✕ control;
 *   - a real-browser geometry spec (skipped without Chromium, same harness as
 *     tests/playwright-scan-filters.mjs): opens BOTH dialog families with a
 *     60+ char title at 1440px and 390px viewports (plus RTL) and asserts the
 *     title and close-control bounding rects DO NOT intersect.
 *
 * Opt-in: run via `npm run test:e2e:browser` (add the file to the runner list)
 * or `node --test tests/playwright-dialog-overlap.mjs`.
 *
 * CI-isolated: a throw-away CAREER_OPS_ROOT via mkdtempSync — never the user's
 * real career-ops data; no network (the scan corpus is a canned snapshot).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { BENIGN_CONSOLE } from './helpers/console-noise.mjs';
import { realConsoleErrors } from './helpers/console-noise.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

// ── source-static pins ───────────────────────────────────────────────────────
// These run everywhere (no browser binary required) and fail first when the
// class-level contract is missing from the stylesheets / the quick view.

const OVERLAYS_CSS = resolve(process.cwd(), 'public/css/overlays.css');
const APP_CSS = resolve(process.cwd(), 'public/css/app.css');
const RUNNER_JS = resolve(process.cwd(), 'public/js/views/scan/runner.js');

/** First rule block for a selector — the CSS contract lives there. */
function ruleBlock(css, selector) {
  const i = css.indexOf(selector);
  assert.ok(i !== -1, `selector not found: ${selector}`);
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  return css.slice(i, close);
}

test('CAR-238 pin: shared modal title reserves the corner close control (overlays.css)', () => {
  const css = readFileSync(OVERLAYS_CSS, 'utf8');
  const header = ruleBlock(css, '.modal-header {');
  assert.match(header, /padding-inline-end:[^;]*52px/, '.modal-header (the title container) must reserve the close control room (logical padding — mirrors in RTL)');
  assert.match(header, /position:\s*relative/, '.modal-header must be the close control positioning context');
  const title = ruleBlock(css, '.modal-header h3');
  assert.match(title, /overflow-wrap:\s*anywhere/, '.modal-header h3 must wrap long titles instead of clipping');
  assert.match(title, /min-width:\s*0/, '.modal-header h3 must be shrinkable inside the flex header');
  const close = ruleBlock(css, '.modal-close');
  assert.match(close, /position:\s*absolute/, '.modal-close must be absolutely positioned in the header, not in the title flow');
  assert.match(close, /inset-inline-end/, '.modal-close must pin to the inline-end edge (mirrors in RTL)');
});

test('CAR-238 pin: scan quick-view title container reserves the corner close control (app.css)', () => {
  const css = readFileSync(APP_CSS, 'utf8');
  const head = ruleBlock(css, '.v2-scan-qv-head');
  assert.match(head, /padding-inline-end:\s*52px/, '.v2-scan-qv-head (the title container) must reserve the close control room (logical padding — mirrors in RTL)');
  const title = ruleBlock(css, '.v2-scan-qv-title');
  assert.match(title, /overflow-wrap:\s*anywhere/, '.v2-scan-qv-title must wrap long titles instead of clipping');
  assert.match(title, /min-width:\s*0/, '.v2-scan-qv-title must be shrinkable');
  assert.doesNotMatch(title, /margin-right|margin:[^;]*24px/, '.v2-scan-qv-title must not keep the old physical (non-mirroring) margin reservation');
  const close = ruleBlock(css, '.v2-scan-qv-close');
  assert.match(close, /position:\s*absolute/, '.v2-scan-qv-close must be absolutely positioned in the panel');
  assert.match(close, /inset-inline-end/, '.v2-scan-qv-close must pin to the inline-end edge (mirrors in RTL)');
});

test('CAR-238 pin: the quick view renders the compact ✕ control (runner.js)', () => {
  const src = readFileSync(RUNNER_JS, 'utf8');
  const i = src.indexOf("className: 'btn btn-ghost btn-sm v2-scan-qv-close'");
  assert.ok(i !== -1, 'quick view close button not found');
  const block = src.slice(i, src.indexOf('},', i) + 2);
  assert.match(block, /'aria-label':\s*t\('common\.closeDialog'/, 'the compact ✕ keeps its localized accessible name');
  assert.match(block, /title:\s*t\('common\.closeDialog'/, 'the compact ✕ keeps a localized sighted tooltip');
  const children = src.slice(src.indexOf('},', i), src.indexOf('));', i));
  assert.match(children, /'✕'\s*\)/, 'the close control renders the bare ✕ glyph (no in-flow text label that could re-introduce the overlap)');
  // The title rides its own container (the reserve lives on the container,
  // so the title element's own rect stays clear of the control).
  const headIdx = src.indexOf("className: 'v2-scan-qv-head'");
  assert.ok(headIdx !== -1, 'the title container .v2-scan-qv-head is missing');
  const headBlock = src.slice(headIdx - 400, headIdx + 200);
  assert.match(headBlock, /titleEl/, '.v2-scan-qv-head must wrap the title element');
});

// ── real-browser geometry spec ───────────────────────────────────────────────

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

let server, baseUrl, browser;

// 96 chars — longer than anything the CAR screenshot showed, spaces AND a
// pipe-separated suffix like real posting titles.
const LONG_TITLE = 'Senior Backend Engineer - Analytics Platform | United States | Remote (Visa Sponsorship Available)';

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-dialog-overlap-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Tester\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'x\n');
  // The canned corpus the SPA reads via GET /api/scan-results — one row with
  // the pathological title, so the quick view opens with it (no network).
  const row = {
    company: 'Acme', title: LONG_TITLE, location: 'Berlin, Germany',
    source: 'greenhouse', isRemote: false, workplaceType: 'Onsite',
    relocates: false, date: new Date().toISOString().slice(0, 10),
    salary: '', url: 'https://example.com/j/1',
  };
  const snap = { en: { kind: 'en', when: new Date().toISOString(), fresh: [row], filtered: [row] }, ru: null };
  writeFileSync(resolve(dir, 'data', 'last-scan.json'), JSON.stringify(snap));
  process.env.CAREER_OPS_ROOT = dir;

  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
  browser = await playwright.chromium.launch({ headless: process.env.PWDEBUG !== '1' });
});

after(async () => {
  if (browser) await browser.close();
  if (server) { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
  delete process.env.CAREER_OPS_ROOT;
});

/** Strict non-intersection: the boxes may not share any area. */
function rectsDontIntersect(a, b) {
  return a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
}

/**
 * Open #/scan, click the seeded row, and measure the quick view's title vs
 * its corner close control. Returns { title, close } bounding boxes.
 */
async function measureQuickView(context) {
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.message || e)));
  await page.goto(baseUrl + '/#/scan');
  await page.waitForSelector('tr.scan-row', { timeout: 10000 });
  // The row's own guard ignores clicks landing on nested a/button controls
  // (star, title link) — click the plain meta div so the quick view opens.
  await page.click('tr.scan-row .scan-posting-meta');
  await page.waitForSelector('.v2-scan-panel.is-open .v2-scan-qv-title', { timeout: 5000 });
  const boxes = await page.evaluate(() => {
    const grab = (sel) => {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
    };
    return { title: grab('.v2-scan-qv-title'), close: grab('.v2-scan-qv-close') };
  });
  const real = realConsoleErrors(errors);
  assert.deepEqual(real, [], 'console errors on #/scan quick view: ' + real.join(' | '));
  await page.close();
  return boxes;
}

for (const [name, viewport] of [['1440px', { width: 1440, height: 900 }], ['390px', { width: 390, height: 844 }]]) {
  test(`Playwright: scan quick view — 96-char title does not intersect the ✕ control at ${name}`, { skip: SKIP }, async () => {
    const context = await browser.newContext({ viewport });
    try {
      const { title, close } = await measureQuickView(context);
      assert.ok(title.width > 200, `the long title actually rendered (width ${title.width})`);
      assert.ok(rectsDontIntersect(title, close),
        `title ${JSON.stringify(title)} intersects the close control ${JSON.stringify(close)} at ${name}`);
      assert.ok(close.right >= title.right - 0.5, 'the ✕ control sits on the inline-end side of the title');
    } finally { await context.close(); }
  });
}

test('Playwright: scan quick view — RTL mirrors the reserved side and still clears the ✕', { skip: SKIP }, async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => localStorage.setItem('career-ops-ui:lang', 'ar'));
  try {
    const { title, close } = await measureQuickView(context);
    assert.ok(rectsDontIntersect(title, close),
      `title ${JSON.stringify(title)} intersects the close control ${JSON.stringify(close)} in RTL`);
    // Mirrored: the control is pinned to the LEFT (inline-end under RTL),
    // fully left of the title box.
    assert.ok(close.right <= title.left + 0.5, `RTL: ✕ (${JSON.stringify(close)}) must sit left of the title (${JSON.stringify(title)})`);
  } finally { await context.close(); }
});

test('Playwright: shared #modal (UI.modal) — long title clears .modal-close at 1440 and 390', { skip: SKIP }, async () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => localStorage.setItem('career-ops-ui:lang', 'en'));
    const page = await context.newPage();
    try {
      await page.goto(baseUrl + '/#/dashboard');
      await page.waitForSelector('#content', { timeout: 10000 });
      await page.evaluate((t) => window.UI.modal(t, 'body'), LONG_TITLE);
      await page.waitForSelector('#modal:not([hidden])', { timeout: 5000 });
      const { title, close } = await page.evaluate(() => {
        const grab = (sel) => {
          const r = document.querySelector(sel).getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
        };
        return { title: grab('#modal-title'), close: grab('.modal-close') };
      });
      assert.ok(title.width > 200, `the long modal title actually rendered (width ${title.width})`);
      assert.ok(rectsDontIntersect(title, close),
        `#modal-title ${JSON.stringify(title)} intersects .modal-close ${JSON.stringify(close)} at ${viewport.width}px`);
      await page.evaluate(() => window.UI.closeModal());
    } finally { await context.close(); }
  }
});
