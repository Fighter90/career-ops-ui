#!/usr/bin/env node
/**
 * site-regression.mjs — browser regression of the public site (cvstart.org).
 *
 *   SITE_URL=https://cvstart.org node scripts/remote-qa/site-regression.mjs
 *
 * Every page × every locale from site/src/i18n/locales.ts: HTTP status, <html
 * lang>/dir, title + h1, console errors and JS exceptions, broken same-origin
 * requests and images, hreflang alternates, horizontal overflow at 1366 and
 * 390 px, and a HEAD/GET of every distinct same-origin link. Read-only.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(ROOT + '/package.json');
const { chromium } = require('playwright');
const { BENIGN_CONSOLE } = await import(ROOT + '/tests/helpers/console-noise.mjs');

const SITE = (process.env.SITE_URL || 'https://cvstart.org').replace(/\/+$/, '');
const localesTs = readFileSync(resolve(ROOT, 'site/src/i18n/locales.ts'), 'utf8');
const LOCALES = [...localesTs.matchAll(/\{\s*code:\s*'([^']+)',\s*slug:\s*'([^']*)',[^}]*dir:\s*'(ltr|rtl)'/g)]
  .map((m) => ({ code: m[1], slug: m[2], dir: m[3] }));
const PAGES = require('node:fs').readdirSync(resolve(ROOT, 'site/src/pages/[locale]'))
  .filter((f) => f.endsWith('.astro')).map((f) => f.replace(/\.astro$/, '')).map((p) => (p === 'index' ? '' : p));

const findings = [];
const add = (where, kind, msg = '') => findings.push({ where, kind, msg: String(msg).slice(0, 180) });
const urlFor = (slug, page) => SITE + '/' + [slug, page].filter(Boolean).join('/') + (slug || page ? '/' : '');

const browser = await chromium.launch({ headless: true });
const links = new Map();
let visits = 0;
const t0 = Date.now();

for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport });
  for (const loc of LOCALES) {
    for (const page of PAGES) {
      const url = urlFor(loc.slug, page);
      const where = `${loc.code} /${page}${viewport.width < 500 ? ' @390' : ''}`;
      const p = await ctx.newPage();
      const errs = [];
      p.on('console', (m) => { if (m.type() === 'error' && !BENIGN_CONSOLE.test(m.text())) errs.push(m.text()); });
      p.on('pageerror', (e) => errs.push('exception: ' + e.message));
      p.on('response', (r) => {
        if (r.url().startsWith(SITE) && r.status() >= 400) errs.push(`${r.status()} ${new URL(r.url()).pathname}`);
      });
      visits++;
      try {
        const res = await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
        if (!res || res.status() !== 200) add(where, 'http', `${res && res.status()} ${url}`);
        const s = await p.evaluate(() => ({
          lang: document.documentElement.lang, dir: document.documentElement.dir || 'ltr',
          title: document.title.trim(), h1: (document.querySelector('h1')?.innerText || '').trim(),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          brokenImgs: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && !i.loading?.includes('lazy')).map((i) => i.currentSrc || i.src),
          hreflang: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => l.hreflang),
          hrefs: [...document.querySelectorAll('a[href]')].map((a) => a.href),
        }));
        if (s.lang !== loc.code && s.lang.toLowerCase() !== loc.code.toLowerCase()) add(where, 'lang', `html lang=${s.lang}`);
        if (s.dir !== loc.dir) add(where, 'dir', `dir=${s.dir}`);
        if (!s.title) add(where, 'no-title');
        if (!s.h1) add(where, 'no-h1');
        if (s.overflow > 2) add(where, 'h-overflow', `${s.overflow}px`);
        for (const i of s.brokenImgs) add(where, 'broken-img', i);
        if (viewport.width > 500) {
          const missing = LOCALES.map((l) => l.code).filter((c) => !s.hreflang.some((h) => h.toLowerCase() === c.toLowerCase()));
          if (missing.length) add(where, 'hreflang-missing', missing.join(','));
          for (const h of s.hrefs) {
            const u = new URL(h); u.hash = '';
            if (u.origin === new URL(SITE).origin && !links.has(u.href)) links.set(u.href, where);
          }
        }
      } catch (e) { add(where, 'crash', e.message.split('\n')[0]); }
      for (const e of errs) add(where, 'console/network', e);
      await p.close();
    }
  }
  await ctx.close();
}
await browser.close();

// Every distinct same-origin link found on any page.
for (const [href, from] of links) {
  let status = 0;
  try { status = (await fetch(href, { redirect: 'follow' })).status; } catch (e) { status = e.message; }
  if (status !== 200) add(from, 'broken-link', `${status} ${href.replace(SITE, '')}`);
}
const nf = await fetch(SITE + '/definitely-not-a-page/').then((r) => r.status).catch(() => 0);
if (nf !== 404) add('/definitely-not-a-page/', '404-status', `returned ${nf}`);

// Markdown table cell: escape backslashes first, then pipes and newlines.
const md = (v) => String(v).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
const byKind = {};
for (const f of findings) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
const lines = [
  `## Site regression — ${new URL(SITE).host}`, '',
  `${LOCALES.length} locales × ${PAGES.length} pages × 2 viewports = ${visits} visits, ${links.size} distinct internal links, in ${Math.round((Date.now() - t0) / 1000)}s.`, '',
  findings.length ? '| kind | count |\n|---|---|\n' + Object.entries(byKind).map(([k, n]) => `| ${k} | ${n} |`).join('\n') : '**No findings.**', '',
];
if (findings.length) {
  lines.push('| where | kind | detail |', '|---|---|---|');
  for (const f of findings.slice(0, 300)) lines.push(`| ${md(f.where)} | ${md(f.kind)} | ${md(f.msg)} |`);
}
const out = lines.join('\n');
console.log(out);
process.exit(findings.length ? 1 : 0);
