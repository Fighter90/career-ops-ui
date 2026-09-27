#!/usr/bin/env node
/**
 * prod-regression.mjs — read-only browser regression of a DEPLOYED web-ui.
 *
 *   BASE_URL=https://resumecraft.ru BASIC_USER=… BASIC_PASS=… node scripts/remote-qa/prod-regression.mjs
 *
 * Every registered route × every UI locale, plus a handful of client-only
 * interactions (theme toggle, ⌘K palette, 404 route, narrow viewport).
 *
 * It must never change the instance it looks at, because that instance holds a
 * real person's CV, tracker and API keys:
 *   - every non-GET request to /api is aborted in the browser before it leaves,
 *     and counted as a finding (a view must not write just by being opened);
 *   - SSE streams (/api/stream/*) are aborted too — they start scans and LLM runs;
 *   - no button that submits, saves, runs or deletes is ever clicked.
 *
 * Output is counts, route names and truncated error messages only — never page
 * text, never screenshots: the CI log of a public repo is public.
 *
 * Runs from CI (.github/workflows/remote-qa.yml). Not part of `npm test`.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(ROOT + '/package.json');
const { chromium } = require('playwright');
const { BENIGN_CONSOLE } = await import(ROOT + '/tests/helpers/console-noise.mjs');

const BASE = (process.env.BASE_URL || '').replace(/\/+$/, '');
if (!BASE) { console.error('BASE_URL is required'); process.exit(2); }
const httpCredentials = process.env.BASIC_USER
  ? { username: process.env.BASIC_USER, password: process.env.BASIC_PASS || '' }
  : undefined;
const ONLY = (process.env.LOCALES || '').split(',').filter(Boolean);

// Routes and locales come from the code, not from a hand-kept list.
const routeSrc = ['public/js/views', 'public/js'].flatMap((d) => {
  try { return require('node:fs').readdirSync(resolve(ROOT, d), { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => resolve(ROOT, d, f)); } catch { return []; }
});
const ROUTES = [...new Set(routeSrc.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/register\('([a-z0-9_-]+)'/g)].map((m) => m[1])))]
  .filter((r) => r !== '__not_found__').sort();
const LOCALES = require('node:fs').readdirSync(resolve(ROOT, 'public/js/lib/locales'))
  .map((f) => f.match(/^i18n-dict\.([A-Za-z-]+)\.js$/)?.[1]).filter((l) => l && l !== 'aliases')
  .filter((l) => !ONLY.length || ONLY.includes(l)).sort();
// Dotted i18n keys: if one shows up verbatim on screen, a translation is missing.
const KEYS = [...readFileSync(resolve(ROOT, 'public/js/lib/locales/i18n-dict.en.js'), 'utf8').matchAll(/^\s*'([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+)':/gm)].map((m) => m[1]);

const findings = [];
const add = (locale, route, kind, msg = '') => findings.push({ locale, route, kind, msg: String(msg).replace(/\?[^\s]*/g, '?…').slice(0, 180) });

const browser = await chromium.launch({ headless: true });

async function newPage(locale, viewport = { width: 1366, height: 900 }) {
  const ctx = await browser.newContext({ httpCredentials, viewport, ignoreHTTPSErrors: false });
  await ctx.addInitScript((l) => { try { localStorage.setItem('career-ops-ui:lang', l); } catch {} }, locale);
  const page = await ctx.newPage();
  const bag = { console: [], pageerror: [], http: [], blocked: [] };
  await page.route('**/api/**', (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() !== 'GET' || path.startsWith('/api/stream/')) {
      bag.blocked.push(`${req.method()} ${path}`);
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (BENIGN_CONSOLE.test(t) || /ERR_BLOCKED_BY_CLIENT|blockedbyclient/i.test(t)) return;
    bag.console.push(t);
  });
  page.on('pageerror', (e) => bag.pageerror.push(e.message));
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.origin !== new URL(BASE).origin) return;
    if (r.status() >= 500) bag.http.push(`${r.status()} ${u.pathname}`);
  });
  return { ctx, page, bag };
}

async function settle(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => {
    const main = document.querySelector('#app, main, #view, #content') || document.body;
    return main && main.innerText.trim().length > 20;
  }, null, { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
}

function drain(locale, route, bag) {
  for (const m of bag.console) add(locale, route, 'console-error', m);
  for (const m of bag.pageerror) add(locale, route, 'js-exception', m);
  for (const m of bag.http) add(locale, route, 'http-5xx', m);
  for (const m of bag.blocked) add(locale, route, 'write-on-open', m);
  bag.console.length = bag.pageerror.length = bag.http.length = bag.blocked.length = 0;
}

let visits = 0;
const t0 = Date.now();
for (const locale of LOCALES) {
  const { ctx, page, bag } = await newPage(locale);
  const r0 = await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  if (!r0 || r0.status() !== 200) { add(locale, '/', 'http', `shell returned ${r0 && r0.status()}`); await ctx.close(); continue; }
  await settle(page); // let the landing view's own requests finish before leaving it
  for (const route of ROUTES) {
    visits++;
    try {
      // A hash-only change is a same-document navigation; load each route fresh
      // so the check never reads the previous view.
      await page.goto('about:blank');
      await page.goto(`${BASE}/#/${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h1.page-title, h1', { timeout: 20000 }).catch(() => {});
      await settle(page);
      const s = await page.evaluate((keys) => {
        // Text outside <code>/<pre>: Help quotes keys like `nav.scan` on purpose.
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll('code, pre, script, style').forEach((n) => n.remove());
        const text = clone.innerText || clone.textContent || '';
        const title = document.querySelector('h1.page-title, h1');
        const leaked = keys.filter((k) => text.includes(k)).slice(0, 5);
        return {
          lang: document.documentElement.lang, dir: document.documentElement.dir || 'ltr',
          title: title ? title.innerText.trim().length : 0,
          notFound: !!document.querySelector('[data-route="__not_found__"], .not-found, #not-found'),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          leaked,
        };
      }, KEYS);
      if (!s.title) add(locale, route, 'no-title', 'no h1 rendered');
      if (s.notFound) add(locale, route, 'not-found', 'registered route rendered the 404 view');
      if (s.lang.toLowerCase().split('-')[0] !== locale.toLowerCase().split('-')[0]) add(locale, route, 'lang', `html lang=${s.lang}`);
      if ((locale === 'ar') !== (s.dir === 'rtl')) add(locale, route, 'dir', `dir=${s.dir}`);
      if (s.overflow > 2) add(locale, route, 'h-overflow', `${s.overflow}px at 1366`);
      for (const k of s.leaked) add(locale, route, 'raw-i18n-key', k);
    } catch (e) {
      add(locale, route, 'crash', e.message.split('\n')[0]);
    }
    drain(locale, route, bag);
  }
  await ctx.close();
}

// Client-only interactions (en): nothing here reaches the server except GETs.
{
  const { ctx, page, bag } = await newPage('en');
  await page.goto(BASE + '/#/dashboard'); await settle(page);
  const before = await page.evaluate(() => document.documentElement.dataset.theme || '');
  await page.click('#theme-toggle').catch((e) => add('en', 'dashboard', 'theme-toggle', e.message));
  const after = await page.evaluate(() => document.documentElement.dataset.theme || '');
  if (before === after) add('en', 'dashboard', 'theme-toggle', `theme did not change (${before})`);
  await page.click('#theme-toggle').catch(() => {});
  // Ctrl+K focuses the global search box.
  await page.keyboard.press('Control+k');
  const focused = await page.evaluate(() => { const a = document.activeElement; return !!a && a.tagName === 'INPUT' && /search/i.test(a.id + ' ' + a.type + ' ' + (a.getAttribute('role') || '')); });
  if (!focused) add('en', 'dashboard', 'ctrl-k', 'Ctrl+K did not focus the search box');
  await page.keyboard.press('Escape');
  await page.goto('about:blank'); await page.goto(BASE + '/#/definitely-not-a-route'); await settle(page);
  const nf = await page.evaluate(() => document.body.innerText.length > 0);
  if (!nf) add('en', 'definitely-not-a-route', 'not-found', 'empty page for unknown route');
  drain('en', 'interactions', bag);
  await ctx.close();
  // Narrow viewport: no page may scroll sideways on a phone.
  const narrow = await newPage('en', { width: 390, height: 844 });
  for (const route of ROUTES) {
    await narrow.page.goto('about:blank');
    await narrow.page.goto(`${BASE}/#/${route}`);
    await narrow.page.waitForSelector('h1.page-title, h1', { timeout: 20000 }).catch(() => {});
    await settle(narrow.page);
    const o = await narrow.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (o > 2) add('en', route, 'h-overflow-390', `${o}px at 390`);
    drain('en', route, narrow.bag);
  }
  await narrow.ctx.close();
}
await browser.close();

// ── report ──
// Markdown table cell: escape backslashes first, then pipes and newlines.
const md = (v) => String(v).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
const byKind = {};
for (const f of findings) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
const lines = [
  `## Prod regression — ${new URL(BASE).host}`,
  '',
  `${LOCALES.length} locales × ${ROUTES.length} routes = ${visits} page visits, plus interactions and a 390px sweep, in ${Math.round((Date.now() - t0) / 1000)}s.`,
  '',
  findings.length ? '| kind | count |\n|---|---|\n' + Object.entries(byKind).map(([k, n]) => `| ${k} | ${n} |`).join('\n') : '**No findings.**',
  '',
];
if (findings.length) {
  lines.push('| locale | route | kind | detail |', '|---|---|---|---|');
  for (const f of findings.slice(0, 300)) lines.push(`| ${md(f.locale)} | ${md(f.route)} | ${md(f.kind)} | ${md(f.msg)} |`);
  if (findings.length > 300) lines.push(`| … | … | … | ${findings.length - 300} more |`);
}
const out = lines.join('\n');
console.log(out);
process.exit(findings.length ? 1 : 0);
