/**
 * PROFILE-1 (v1.232.0) — a long value in a `.card` must not widen the page.
 *
 * `#/profile` renders each field as a `.card` inside a `.card-row` grid whose
 * tracks are `repeat(auto-fit, minmax(220px, 1fr))`. The value was an anonymous
 * `<div>` carrying only inline font styles — no wrapping rule at all, so its
 * computed `overflow-wrap` stayed `normal`. A LinkedIn vanity URL
 * (`https://www.linkedin.com/in/first-last/`, ~47 chars) offers CSS no legal
 * break point, so the element's **min-content width is the whole string**.
 *
 * Grid items default to `min-width: auto`, which refuses to shrink below
 * min-content. The card therefore burst its track and pushed the row, the main
 * column and finally the document wider than the viewport — 23 px of real
 * horizontal scroll at 1280 px on the fixture below, more with a longer handle.
 *
 * Width-dependent, which is why it hid for so long: at ≤ 420 px the media query
 * drops to a single column wide enough to fit, and between 768 and 1024 px the
 * text merely spills out of the card without moving the document. Only once
 * `auto-fit` adds a fourth column does the overflow reach the page.
 *
 * The fix is `overflow-wrap: anywhere` on a shared `.card-value` class —
 * `anywhere` is counted when the browser computes min-content, whereas
 * `break-word` is not and would leave the track just as wide. `.card-row > *
 * { min-width: 0 }` backs it up so no future content can burst the row.
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

// Deliberately longer than any real handle: the defect is the ABSENCE of
// wrapping, not one particular URL, so the fixture pins the worst case.
const LONG_URL = 'https://www.linkedin.com/in/a-very-long-vanity-handle-for-testing/';
const LONG_EMAIL = 'real.person.with.a.long.address@example-company-domain.com';

let server, baseUrl, browser;

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-card-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'config', 'profile.yml'),
    'candidate:\n' +
    '  full_name: Real Person\n' +
    `  email: ${LONG_EMAIL}\n` +
    `  linkedin: ${LONG_URL}\n` +
    '  location: Amsterdam\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# Pipeline\n');
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n\nReal Person.\n');
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

/** Widths that matter: 1280/1440 are where auto-fit adds the track that burst the page. */
const WIDTHS = [768, 1024, 1280, 1440];

async function measure(page, width) {
  const context = page;
  await context.goto(baseUrl + '/#/profile');
  await context.waitForSelector('#content .card', { timeout: 8000 });
  await context.waitForTimeout(300);
  return context.evaluate(() => {
    const de = document.documentElement;
    const cards = [...document.querySelectorAll('#content .card')];
    return {
      docOverflow: de.scrollWidth - de.clientWidth,
      burst: cards
        .filter((el) => el.scrollWidth > el.clientWidth)
        .map((el) => `${el.querySelector('.metric-label')?.textContent?.trim() || '?'}` +
                     ` (${el.scrollWidth} > ${el.clientWidth})`),
      count: cards.length,
    };
  });
}

test('PROFILE-1: a long URL never widens the page or bursts its card', { skip: SKIP }, async () => {
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    try {
      const m = await measure(page, width);
      assert.ok(m.count > 0, `${width}px: no cards rendered — the fixture profile did not load`);
      assert.equal(m.docOverflow, 0,
        `${width}px: the page scrolls horizontally by ${m.docOverflow}px — a card value refused to wrap`);
      assert.deepEqual(m.burst, [],
        `${width}px: these cards are wider than their track: ${m.burst.join('; ')}`);
    } finally {
      await context.close();
    }
  }
});

test('PROFILE-1: the long value wraps rather than being clipped', { skip: SKIP }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(baseUrl + '/#/profile');
    await page.waitForSelector('#content .card', { timeout: 8000 });
    await page.waitForTimeout(300);
    const m = await page.evaluate((url) => {
      const el = [...document.querySelectorAll('#content .card')]
        .find((c) => c.textContent.includes(url.slice(0, 40)));
      if (!el) return null;
      const value = el.querySelector('.card-value') || el.lastElementChild;
      const cs = getComputedStyle(value);
      return {
        text: value.textContent.trim(),
        wrap: cs.overflowWrap,
        cardOverflowHidden: getComputedStyle(el).overflow,
        lines: Math.round(value.getBoundingClientRect().height / parseFloat(cs.lineHeight || '20')),
      };
    }, LONG_URL);
    assert.ok(m, 'the LinkedIn card was not found on #/profile');
    assert.equal(m.text, LONG_URL, 'the URL must be rendered in full, not truncated');
    assert.equal(m.wrap, 'anywhere',
      'the value needs overflow-wrap:anywhere — `break-word` wraps the text but leaves min-content, and the track, just as wide');
    assert.ok(m.lines >= 2, `the URL should wrap onto multiple lines, measured ${m.lines}`);
    assert.notEqual(m.cardOverflowHidden, 'hidden',
      'the card must not hide overflow — that would clip the URL instead of wrapping it');
  } finally {
    await context.close();
  }
});
