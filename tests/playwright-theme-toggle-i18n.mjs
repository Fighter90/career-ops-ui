/**
 * Playwright browser test — MINOR-001 (v1.61.1).
 *
 * The dark/light theme toggle (`#theme-toggle`) must localize BOTH its
 * `title` (tooltip) and `aria-label` (screen-reader) across all 9
 * locales, driven by the `top.themeToggle` i18n key via applyI18n()'s
 * `data-i18n-title` / `data-i18n-aria-label` handling — on first paint
 * AND when the language is switched at runtime.
 *
 * Pre-fix the values were hardcoded English ("Toggle theme") in
 * index.html across every locale (the lone LOW finding from the v1.61.0
 * French sign-off). Run via:
 *   npm run test:e2e:browser
 *
 * Opt-in: skips cleanly when Playwright isn't installed in the parent
 * (same pattern as playwright-smoke.mjs). Boots the in-process server on
 * an ephemeral port against a mkdtemp fixture — never touches real data.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
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

// The canonical localized strings — must match i18n-dict.<locale>.js.
const EXPECTED = {
  en: 'Toggle theme',
  es: 'Cambiar tema',
  'pt-BR': 'Alternar tema',
  fr: 'Changer de thème',
  ru: 'Сменить тему',
  ja: 'テーマを切り替え',
  ko: '테마 전환',
  'zh-CN': '切换主题',
  'zh-TW': '切換主題',
};

let server, baseUrl, browser, context;

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-theme-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n\nReal Person.\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'),
    'candidate:\n  full_name: Real Person\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# Pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), '# Oferta\n');
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

// Read the toggle's title/aria once they've been localized by applyI18n().
async function readToggle(page, expected) {
  await page.waitForSelector('#theme-toggle', { timeout: 5000 });
  await page.waitForFunction(
    (exp) => {
      const b = document.getElementById('theme-toggle');
      return b && b.getAttribute('title') === exp && b.getAttribute('aria-label') === exp;
    },
    expected,
    { timeout: 5000 },
  );
  const btn = page.locator('#theme-toggle');
  return {
    title: await btn.getAttribute('title'),
    aria: await btn.getAttribute('aria-label'),
  };
}

for (const [locale, expected] of Object.entries(EXPECTED)) {
  test(`theme-toggle title + aria-label localized — ${locale}`, { skip: SKIP }, async () => {
    const page = await context.newPage();
    try {
      // set the persisted locale BEFORE any page script runs
      await page.addInitScript((loc) => {
        try { localStorage.setItem('career-ops-ui:lang', loc); } catch {}
      }, locale);
      await page.goto(baseUrl + '/#/dashboard');
      const { title, aria } = await readToggle(page, expected);
      assert.equal(title, expected, `[${locale}] title`);
      assert.equal(aria, expected, `[${locale}] aria-label`);
    } finally {
      await page.close();
    }
  });
}

test('theme-toggle updates in place on runtime locale switch', { skip: SKIP }, async () => {
  const page = await context.newPage();
  try {
    await page.addInitScript(() => {
      try { localStorage.setItem('career-ops-ui:lang', 'en'); } catch {}
    });
    await page.goto(baseUrl + '/#/dashboard');
    let r = await readToggle(page, 'Toggle theme');
    assert.equal(r.title, 'Toggle theme');

    // switch to French via the sidebar language picker
    await page.locator('#lang-select').selectOption('fr');
    r = await readToggle(page, 'Changer de thème');
    assert.equal(r.title, 'Changer de thème', 'title re-applied on lang switch');
    assert.equal(r.aria, 'Changer de thème', 'aria-label re-applied on lang switch');
  } finally {
    await page.close();
  }
});
