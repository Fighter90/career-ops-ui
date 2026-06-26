#!/usr/bin/env node
/**
 * scripts/capture-dashboard-screenshots.mjs
 *
 * Generate one dashboard screenshot per locale into web-ui/images/.
 * Used by the READMEs and the in-app screenshots in docs/help/<locale>.md.
 *
 * Prereq: parent project has Playwright installed (covered by /career-ops apply
 * flow per docs/introduction/guides/set-up-playwright).
 *
 *   cd $CAREER_OPS_ROOT && npm install && npx playwright install chromium
 *   node web-ui/scripts/capture-dashboard-screenshots.mjs
 *
 * Idempotent: re-runs overwrite the existing PNGs.
 *
 * Output:
 *   web-ui/images/dashboard-en.png
 *   web-ui/images/dashboard-ru.png
 *   web-ui/images/dashboard-es.png
 *   web-ui/images/dashboard-pt-BR.png
 *   web-ui/images/dashboard-ko-KR.png
 *   web-ui/images/dashboard-ja.png
 *   web-ui/images/dashboard-zh-CN.png
 *   web-ui/images/dashboard-zh-TW.png
 *   web-ui/images/dashboard-fr.png
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_UI_ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(WEB_UI_ROOT, 'images');
const BASE_URL = process.env.CAREER_OPS_UI_URL || 'http://127.0.0.1:4317';
const LOCALES = ['en', 'ru', 'es', 'pt-BR', 'ko', 'ja', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar'];
// What the lang switch stores in localStorage. Internal locale ID — not
// always the same as the file naming convention (ko ↔ ko-KR).
const LOCALE_TO_FILE = {
  en: 'en', ru: 'ru', es: 'es', 'pt-BR': 'pt-BR',
  ko: 'ko-KR', ja: 'ja', 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', fr: 'fr',
  pl: 'pl', uk: 'uk', da: 'da', ar: 'ar'
};
const SETTLE_MS = 2000;
const VIEWPORT = { width: 1440, height: 900 };

if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(BASE_URL + '/#/dashboard', { waitUntil: 'networkidle' });

  for (const loc of LOCALES) {
    process.stdout.write(`[${loc}] switching locale… `);
    // I18N-EXPAND (v1.70.0) — the picker is a <select>; drive the i18n
    // module directly (its onChange does the re-render + persists), which
    // also flips <html dir="rtl"> for Arabic.
    await page.evaluate((l) => { try { window.I18n && window.I18n.setLang(l); } catch {} }, loc);
    await page.waitForTimeout(SETTLE_MS);
    // Re-navigate just in case the lang switch redirected
    await page.evaluate(() => { location.hash = '/dashboard'; });
    await page.waitForTimeout(SETTLE_MS);
    const fileName = `dashboard-${LOCALE_TO_FILE[loc]}.png`;
    const outPath = path.join(IMAGES_DIR, fileName);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`saved ${path.relative(WEB_UI_ROOT, outPath)}`);
  }
} finally {
  await browser.close();
}
console.log('\\nDone. Commit the new files under web-ui/images/.');
