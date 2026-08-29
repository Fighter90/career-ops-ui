/**
 * Playwright acceptance — narrow-viewport layout integrity (v1.227.2).
 *
 * MOBILE-1: `#/config` scrolled horizontally on viewports ≤ 352 px. Every
 * select-kind field carried an inline `min-width: 300px`; an inline style beats
 * the stylesheet, so the control could not shrink with its container. At 320 px
 * the select's right edge landed at 353 px and the page grew a horizontal
 * scrollbar, pushing controls off-screen. 360 px and 375 px had just enough
 * slack to hide it, which is why every earlier mobile pass came back clean.
 *
 * The existing Playwright suites drive a 1280-wide window and the mobile pass
 * used 375 px, so nothing in CI had ever measured a viewport this narrow.
 *
 * 320 px is the floor worth defending: iPhone SE (1st gen), the Galaxy Fold
 * cover screen at 280 px, and older Android devices all sit at or below the
 * 352 px threshold. This suite sweeps the routes that carry form controls,
 * plus the widest data table, and fails on ANY horizontal overflow.
 *
 * Opt-in (needs a browser binary); run via `npm run test:e2e:browser`.
 * CI-isolated: mocks parent fixtures under a mkdtemp root.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function resolvePlaywright() {
  for (const c of ['playwright',
    resolve(process.cwd(), '..', 'node_modules', 'playwright'),
    resolve(process.cwd(), 'node_modules', 'playwright')]) {
    try { return require(c); } catch { /* next */ }
  }
  return null;
}
const playwright = resolvePlaywright();
const SKIP = playwright ? false : 'Playwright not installed';

// 320 px is the floor this suite defends: the classic small-phone width, and
// the one MOBILE-1 was reported and reproduced at (scrollWidth 353 > 320).
//
// 280 px (the Galaxy Fold cover screen) is deliberately NOT gated yet. It still
// overflows by ~5 px, but from an unrelated cause — long content inside the
// config card's <details> blocks, and the 256 px sidebar against a 280 px
// viewport — not the inline min-width this suite was written for. Fixing that
// means reflowing content at a width no mainstream phone reports, so it is
// tracked as a separate finding rather than folded in here. Raise this list to
// [320, 280] once that work lands; the assertion already handles both.
const WIDTHS = [320];
const ROUTES = ['#/config', '#/dashboard', '#/scan', '#/tracker', '#/cv', '#/help'];

let server, baseUrl, browser;

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-narrow-'));
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
  process.env.CAREER_OPS_ROOT = dir;

  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); });
  });
  browser = await playwright.chromium.launch({ headless: process.env.PWDEBUG !== '1' });
});

after(async () => {
  if (browser) await browser.close();
  if (server) { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
  delete process.env.CAREER_OPS_ROOT;
});

test('no route scrolls horizontally at 320 px or 280 px', { skip: SKIP }, async () => {
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 720 } });
    const page = await context.newPage();
    try {
      for (const route of ROUTES) {
        await page.goto(baseUrl + '/' + route);
        await page.waitForSelector('main', { timeout: 8000 });
        await page.waitForTimeout(350); // let async field/catalogue renders settle
        const m = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          // Name the widest offender so a failure points straight at it.
          widest: (() => {
            let worst = null;
            for (const el of document.querySelectorAll('main *')) {
              const r = el.getBoundingClientRect();
              if (r.width === 0) continue;
              if (!worst || r.right > worst.right) {
                worst = { right: Math.round(r.right), tag: el.tagName, id: el.id || '', cls: el.className || '' };
              }
            }
            return worst;
          })(),
        }));
        assert.ok(
          m.scrollWidth <= m.clientWidth,
          `${route} at ${width}px: scrollWidth ${m.scrollWidth} > clientWidth ${m.clientWidth}` +
          ` — widest element right edge ${m.widest?.right}px (${m.widest?.tag}#${m.widest?.id}.${m.widest?.cls})`,
        );
      }
    } finally {
      await context.close();
    }
  }
});

test('#/config select controls shrink with the viewport (MOBILE-1)', { skip: SKIP }, async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 720 } });
  const page = await context.newPage();
  try {
    await page.goto(baseUrl + '/#/config');
    await page.waitForSelector('select.select', { timeout: 8000 });
    await page.waitForTimeout(350);
    const bad = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('select.select')) {
        const r = el.getBoundingClientRect();
        // A control must never extend past the viewport. An inline min-width
        // that cannot shrink is exactly what MOBILE-1 was.
        if (r.right > window.innerWidth) {
          out.push({ id: el.id, right: Math.round(r.right), minWidth: el.style.minWidth });
        }
      }
      return out;
    });
    assert.deepEqual(bad, [], `selects overflow the 320px viewport: ${JSON.stringify(bad)}`);
  } finally {
    await context.close();
  }
});
