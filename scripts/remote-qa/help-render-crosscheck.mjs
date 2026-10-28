/**
 * One-off Playwright cross-check (step а of the rqa2 task): run the EXACT
 * prod-regression.mjs raw-i18n-key evaluate on a LOCAL fixture server's
 * #/help for en/de/da and report the leaked keys with ±60-char context.
 * Not committed as a test — the committed gate is the vm-based
 * tests/help-rendered-keys.test.mjs; this proves the vm gate matches the
 * real browser DOM. Read-only; CAREER_OPS_ROOT is a throw-away mkdtemp dir.
 *
 *   node scripts/remote-qa/help-render-crosscheck.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(ROOT + '/package.json');
const { chromium } = require('playwright');

const KEYS = [...readFileSync(join(ROOT, 'public/js/lib/locales/i18n-dict.en.js'), 'utf8')
  .matchAll(/^\s*'([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+)':/gm)].map((m) => m[1]);

const dir = mkdtempSync(resolve(tmpdir(), 'rqa2-help-'));
mkdirSync(resolve(dir, 'config'), { recursive: true });
mkdirSync(resolve(dir, 'data'), { recursive: true });
mkdirSync(resolve(dir, 'modes'), { recursive: true });
writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Tester\n');
writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
writeFileSync(resolve(dir, 'data', 'applications.md'), '');
writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'x\n');
process.env.CAREER_OPS_ROOT = dir;

const { createApp } = await import(join(ROOT, 'server', 'index.mjs'));
const app = createApp();
let server;
await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ headless: true });
let total = 0;
for (const locale of ['en', 'de', 'da']) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript((l) => { try { localStorage.setItem('career-ops-ui:lang', l); } catch {} }, locale);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#/help`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  // EXACT evaluate from prod-regression.mjs (line 128-142), extended with context.
  const res = await page.evaluate((keys) => {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('code, pre, script, style').forEach((n) => n.remove());
    const text = clone.innerText || clone.textContent || '';
    return keys.filter((k) => text.includes(k)).map((k) => {
      const at = text.indexOf(k);
      return `${k}  …${text.slice(Math.max(0, at - 60), at + k.length + 60).replace(/\n/g, '⏎')}…`;
    });
  }, KEYS);
  total += res.length;
  console.log(`\n=== ${locale}: ${res.length} leak(s) via REAL DOM ===`);
  for (const l of res.slice(0, 8)) console.log('  ', l);
  if (res.length > 8) console.log(`   … +${res.length - 8} more`);
  await ctx.close();
}
await browser.close();
server.closeAllConnections?.();
await new Promise((r) => server.close(r));
console.log(total ? `\nTOTAL ${total} leaked (browser DOM)` : '\nCLEAN via REAL browser DOM (en+de+da): 0 leaked keys');
process.exit(total ? 1 : 0);
