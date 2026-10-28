#!/usr/bin/env node
/**
 * scripts/capture-map-screenshots.mjs
 *
 * One job-map (#/map) screenshot per locale into web-ui/images/job-map-<file>.png,
 * used by the READMEs, the help bundles and the cvstart.org #job-map section.
 * The frame is the map page only — title + located counter + filter chips +
 * search + map + side list + filter bar — never the page chrome: the topbar and
 * the notifications drawer are hidden for the shot (addStyleTag, this script
 * only) and the clip is the exact `.job-map-page` box, so no half-cut topbar
 * search, no sliver of a neighbouring panel. The map is zoomed out two steps so
 * no marker cluster sits on the frame edge.
 *
 * Needs a running web-ui with real scan/tracker data and a warm geocode cache:
 *
 *   npm start                                  # http://127.0.0.1:4317
 *   node scripts/capture-map-screenshots.mjs   # every locale
 *   ONLY=en,ru node scripts/capture-map-screenshots.mjs
 *
 * The first run against a cold cache can take hours (the map geocodes the full
 * dataset at the server's 50 uncached-lookups/minute budget; results persist in
 * web-ui/.cache/geocode.json and every later run reuses them). Idempotent:
 * re-runs overwrite the PNGs.
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
  'zh-TW': 'zh-TW', fr: 'fr', pl: 'pl', uk: 'uk', da: 'da', ar: 'ar', de: 'de', it: 'it', tr: 'tr', hi: 'hi', ta: 'ta', vi: 'vi',
};
const ZOOM_OUT_STEPS = 2; // edge markers are cut by the map's own container, not by the clip
const only = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const locales = only.length ? only : Object.keys(LOCALE_TO_FILE);
const MAX_WAIT_MS = 21_600_000; // 6 h — cold geocode of the full dataset at the Nominatim 1.1 s/lookup policy

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
    // Done when the geocode queue has drained: pending = total − located −
    // noLoc === 0. (The counter alone can never read N/N on a real dataset —
    // Remote rows are structurally without a location and never "located".)
    await page.waitForFunction(() => {
      const n = (txt) => { const m = String(txt).match(/\d+/g); return m ? Number(m[m.length - 1]) : 0; };
      const sub = document.querySelector('.job-map-page .page-subtitle')?.textContent || '';
      const nums = sub.match(/\d+/g);
      if (!nums || nums.length < 2) return false;
      const located = Number(nums[0]);
      const total = Number(nums[1]);
      const chip = document.querySelector('.v2-map-noloc');
      const noLoc = chip && !chip.hidden ? n(chip.textContent) : 0;
      return total > 0 && located + noLoc >= total;
    }, null, { timeout: MAX_WAIT_MS, polling: 500 });
    // Page chrome is not part of the shot: the sticky topbar (its search field
    // otherwise bleeds into the frame top) and the notifications drawer.
    await page.addStyleTag({ content: '#docs-fab, #docs-fab-panel, header.topbar, #notif-drawer { display: none !important; }' });
    // Two steps out: the auto-fit frames the densest 80 %, the shot should show
    // the spread without a cluster sitting half-cut on the map's own edge.
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
    for (let step = 0; step < ZOOM_OUT_STEPS; step++) {
      await page.locator('.leaflet-control-zoom-out').click();
      await page.waitForFunction((z0) => [...document.querySelectorAll('.leaflet-tile')]
        .some((t) => Number(t.src.split('/').slice(-3, -2)[0]) < z0), before, { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
    process.stdout.write(`zoom ${before}→${await zoom()} `);
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    // Every visible tile loaded and faded in (no seams between half-shown tiles).
    await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-tile')]
      .every((t) => t.complete && t.classList.contains('leaflet-tile-loaded')), null, { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    // Pin the map's rendered height, then grow the viewport to fit the whole
    // map page block: the shot is then a plain viewport screenshot. (Chromium's
    // captureBeyondViewport resamples the composited tile layer — white strips
    // appear at the tile-row boundaries; a normal viewport render does not.)
    const frameH = await page.evaluate(() => {
      const el = document.querySelector('#job-map');
      if (!el) return 0;
      const hpx = el.getBoundingClientRect().height;
      const st = document.createElement('style');
      st.textContent = '#job-map { height: ' + hpx + 'px !important; }';
      document.head.appendChild(st);
      return document.querySelector('.job-map-page').getBoundingClientRect().height;
    });
    if (!frameH) throw new Error('.job-map-page not found');
    // Grow the viewport well past the frame (a tight fit lets vh-dependent
    // panels reflow the frame after the measurement) and re-measure the frame
    // box after the resize.
    await page.setViewportSize({ width: 1440, height: Math.ceil(frameH) + 300 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);
    // Integer-align the map container: at a fractional css y the compositor
    // resamples the tile textures and light strips show at the tile-row
    // boundaries. Snapping it to the pixel grid (≤0.5 px shift) removes them.
    await page.evaluate(() => {
      const el = document.querySelector('#job-map');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dy = Math.round(r.top) - r.top;
      if (dy) el.style.transform = 'translateY(' + dy + 'px)';
    });
    await page.waitForTimeout(500);
    // The clip is the whole map page block: title, counter, chips, search, map,
    // side list and the filter bar — a union of the elements the shot promises,
    // so no panel is cut by the frame edge.
    const box = await page.evaluate(() => {
      const el = document.querySelector('.job-map-page');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const left = Math.max(0, r.left);
      return {
        x: left,
        y: Math.max(0, r.top),
        width: Math.min(document.documentElement.clientWidth - left, r.width),
        height: r.height,
      };
    });
    if (!box.y && box.y !== 0) throw new Error('.job-map-page not found');
    const out = path.join(IMAGES_DIR, `job-map-${LOCALE_TO_FILE[loc]}.png`);
    await page.screenshot({ path: out, clip: box });
    console.log('saved', path.relative(WEB_UI_ROOT, out));
    await page.close();
  }
} finally {
  await browser.close();
}
