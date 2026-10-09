#!/usr/bin/env node
/**
 * scripts/capture-map-screenshots.mjs
 *
 * One job-map (#/map) screenshot per locale into web-ui/images/job-map-<file>.png,
 * used by the READMEs, the help bundles and the cvstart.org #job-map section.
 * The shot is the page title + status line + map, like the hand-made en/ru ones.
 *
 * Needs a running web-ui with real scan/tracker data and a warm geocode cache:
 *
 *   npm start                                  # http://127.0.0.1:4317
 *   node scripts/capture-map-screenshots.mjs   # every locale except en, ru
 *   ONLY=en,ru node scripts/capture-map-screenshots.mjs
 *
 * en and ru are skipped by default: those two were captured by hand (ru is
 * zoomed on Central Russia). Idempotent: re-runs overwrite the PNGs.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WEB_UI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMAGES_DIR = path.join(WEB_UI_ROOT, 'images');
const BASE_URL = process.env.CAREER_OPS_UI_URL || 'http://127.0.0.1:4317';
// UI locale id → file suffix (ko ↔ ko-KR, as for the dashboard screenshots).
const LOCALE_TO_FILE = {
  en: 'en', ru: 'ru', es: 'es', 'pt-BR': 'pt-BR', ko: 'ko-KR', ja: 'ja', 'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW', fr: 'fr', pl: 'pl', uk: 'uk', da: 'da', ar: 'ar', de: 'de', it: 'it', tr: 'tr', hi: 'hi', ta: 'ta',
};
const HAND_MADE = new Set(['en', 'ru']);
const only = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const locales = only.length ? only : Object.keys(LOCALE_TO_FILE).filter((l) => !HAND_MADE.has(l));
const MAX_WAIT_MS = 1_500_000; // 25 min — cold geocode of the full map dataset

if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  for (const loc of locales) {
    if (!LOCALE_TO_FILE[loc]) throw new Error(`unknown locale ${loc}`);
    process.stdout.write(`[${loc}] `);
    const page = await context.newPage();
    await page.addInitScript((l) => { try { localStorage.setItem('career-ops-ui:lang', l); } catch {} }, loc);
    await page.goto(BASE_URL + '/#/map', { waitUntil: 'domcontentloaded' });
    await page.locator('#job-map').waitFor({ timeout: 30_000 });
    // Done when the status line reads "N/N" — every place looked up.
    await page.waitForFunction(() => {
      const m = (document.querySelector('#job-map')?.parentElement?.textContent || document.body.textContent)
        .match(/(\d+)\s*\/\s*(\d+)/);
      return m && m[1] === m[2] && Number(m[2]) > 0;
    }, null, { timeout: MAX_WAIT_MS, polling: 500 });
    // The docs assistant button floats over the map's corner — not part of the shot.
    await page.addStyleTag({ content: '#docs-fab, #docs-fab-panel { display: none !important; }' });
    // One step out: the auto-fit frames the densest 80 %, the shot should show the spread.
    const zoom = () => page.evaluate(() => {
      const z = [...document.querySelectorAll('.leaflet-tile')].map((t) => Number(t.src.split('/').slice(-3, -2)[0]));
      return z.length ? Math.min(...z) : null;
    });
    // Wait for the auto-fit to land: the tile zoom has to hold still for 3 s.
    for (let last = null, same = 0, t0 = Date.now(); same < 6 && Date.now() - t0 < 30_000;) {
      await page.waitForTimeout(500);
      const z = await zoom();
      same = z === last ? same + 1 : 0; last = z;
    }
    const before = await zoom();
    await page.locator('.leaflet-control-zoom-out').click();
    await page.waitForFunction((z0) => [...document.querySelectorAll('.leaflet-tile')]
      .some((t) => Number(t.src.split('/').slice(-3, -2)[0]) < z0), before, { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    process.stdout.write(`zoom ${before}→${await zoom()} `);
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    // Every visible tile loaded and faded in (no seams between half-shown tiles).
    await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-tile')]
      .every((t) => t.complete && t.classList.contains('leaflet-tile-loaded')), null, { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const box = await page.evaluate(() => {
      const map = document.querySelector('#job-map').getBoundingClientRect();
      const h1 = document.querySelector('h1.page-title, h1').getBoundingClientRect();
      const top = Math.max(0, Math.min(h1.top, map.top) - 24);
      const left = Math.max(0, Math.min(h1.left, map.left) - 24);
      return { x: left, y: top + scrollY, width: Math.min(innerWidth - left, map.right - left + 24), height: map.bottom - top + 24 };
    });
    const out = path.join(IMAGES_DIR, `job-map-${LOCALE_TO_FILE[loc]}.png`);
    await page.screenshot({ path: out, clip: box, fullPage: true });
    console.log('saved', path.relative(WEB_UI_ROOT, out));
    await page.close();
  }
} finally {
  await browser.close();
}
