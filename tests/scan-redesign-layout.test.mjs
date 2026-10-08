/**
 * Layout contract tests for v1.244.0 — the #/scan results redesign.
 *
 * Enforces the DOM/i18n/budget contract from docs/sdd/specs/
 * 2026-10-06-scan-page-redesign.md §Implementation contract (Phase 4 step 2).
 * These were the RED tests written against pre-redesign code; the v1.244.0
 * implementation PR (scan.js / scan-results.js / components.css) flips them
 * green — the assertions are unchanged, only the env gates are gone.
 *
 * ── i18n key contract (R-08, ×17 parity) ─────────────────────────────────
 *
 *   scan.fitIcon     accessible name for the title-fit chip icon
 *                    (replaces the inline words strong/related/weak fit)
 *   scan.boostIcon   accessible name for the seniority-boost icon
 *                    (replaces «⬆ буст / ⬆ boosted»)
 *   scan.scoreIcon   accessible name for the fit-score ring icon
 *                    (replaces «◎ 65»)
 *   scan.postedMeta  accessible name for the posting meta line
 *                    (source · date · work-type icons row)
 *
 * Parity across all 17 locales is enforced by tests/i18n-coverage.test.mjs;
 * this file asserts the browser resolves them (en + ru).
 *
 * ── The contract under test (selectors from SCAN_CONTRACT in the helper) ──
 *
 *   tr.scan-row / td.scan-cell-posting → .scan-posting-title (line 1) +
 *   .scan-posting-meta (line 2); .scan-icon--{boost,fit,score} (role="img",
 *   aria-label, title tooltip); #scan-page-size (select); 700-row corpus renders
 *   within a 4000-node #scan-results budget at a 50-row default page.
 *
 * ── How to run ──
 *
 *   npm run test:e2e:browser        (this file is in the list)
 *   node --test tests/scan-redesign-layout.test.mjs
 *
 * Opt-in (needs a browser binary; Playwright is the parent's dep, not ours):
 * set CAREER_OPS_PLAYWRIGHT_PATH to the parent node_modules/playwright.
 * SCAN_REDESIGN_CAPTURE=1 additionally writes the AFTER screenshots +
 * metrics to /tmp/scan-redesign/after/ (the before state lives in
 * the mkdtemp root printed by the before-capture run).
 *
 * CI-isolated: throw-away CAREER_OPS_ROOT via mkdtempSync — never real data.
 *
 * AC5 guard (counts/order unchanged by title-fit) is unit-owned by
 * tests/title-fit.test.mjs; the HTTP-boundary guard below only re-checks that
 * the serve-time annotation preserves the served corpus — it must stay GREEN
 * through any refactor.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { BENIGN_CONSOLE } from './helpers/console-noise.mjs';
import {
  SCAN_CONTRACT as SEL,
  loadScanRedesignFixture,
  buildSnapshot,
  seedScanRedesignRoot,
} from './helpers/scan-redesign-fixture.mjs';
import { loadAssembledDict } from './helpers/i18n-vm.mjs';

const require = createRequire(import.meta.url);
function resolvePlaywright() {
  const candidates = [];
  if (process.env.CAREER_OPS_PLAYWRIGHT_PATH) candidates.push(process.env.CAREER_OPS_PLAYWRIGHT_PATH);
  for (const c of ['playwright',
    resolve(process.cwd(), '..', 'node_modules', 'playwright'),
    resolve(process.cwd(), 'node_modules', 'playwright')]) {
    candidates.push(c);
  }
  for (const c of candidates) { try { return require(c); } catch { /* next */ } }
  return null;
}
const playwright = resolvePlaywright();

const CAPTURE = process.env.SCAN_REDESIGN_CAPTURE === '1';
const SKIP = !playwright
  ? 'Playwright not installed (set CAREER_OPS_PLAYWRIGHT_PATH to the parent node_modules/playwright)'
  : false;

let server, baseUrl, browser;
const fixture = loadScanRedesignFixture();

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-scan-redesign-'));
  seedScanRedesignRoot(dir, fixture);
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

/**
 * Open #/scan with a given locale/theme/viewport and wait for the canned
 * corpus. A fresh context per combination: locale + theme are boot-time
 * localStorage reads, viewport is per-context.
 */
async function openScan({ lang = 'en', theme = 'light', width = 1440, height = 900 } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(([storageLang, storageTheme]) => {
    try { localStorage.setItem('career-ops-ui:lang', storageLang); } catch {}
    try { localStorage.setItem('theme', storageTheme); } catch {}
  }, [lang, theme]);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !BENIGN_CONSOLE.test(m.text())) errors.push(m.text()); });
  await page.goto(baseUrl + '/#/scan');
  await page.waitForSelector('#scan-results table tbody tr', { timeout: 15000 });
  await page.waitForTimeout(250); // let fonts/paint settle before any geometry read
  return { context, page, errors };
}

// ── AC1 ──────────────────────────────────────────────────────────────────────
// At 1440 px and 390 px: the posting column never exceeds two text lines and
// nothing overflows (neither the page nor the results wrap nor any posting cell).
// In-page line-box helper, inlined per evaluate ("normal" line-height → font-size × 1.25).
async function measureAC1(page) {
  return page.evaluate(({ sel }) => {
    const lineOf = (el) => {
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight);
      return Number.isFinite(lh) && lh > 0 ? lh : parseFloat(cs.fontSize) * 1.25;
    };
    const de = document.documentElement;
    const postings = [...document.querySelectorAll(sel.postingCell)];
    const wrap = document.querySelector('#scan-results .table-wrap');
    return {
      docOverflow: de.scrollWidth - de.clientWidth,
      wrapOverflow: wrap ? wrap.scrollWidth - wrap.clientWidth : -1,
      postingCount: postings.length,
      overflowingPostings: postings.filter((p) => p.scrollWidth > p.clientWidth + 1).length,
      // Measure the CONTENT element (span inside the td), never the td: table
      // cells stretch vertically to their row's height, so a td's own box says
      // nothing about whether the aux text wrapped.
      tallestAuxPx: Math.max(0, ...[...document.querySelectorAll('td.scan-cell-aux > *')]
        .map((n) => n.getBoundingClientRect().height)),
      tallestAuxCells: [...document.querySelectorAll('td.scan-cell-aux > *')]
        .map((n) => ({ h: n.getBoundingClientRect().height, text: (n.textContent || '').trim().slice(0, 40) }))
        .sort((a, b) => b.h - a.h).slice(0, 3),
      multiLinePostings: postings
        .filter((p) => {
          const title = p.querySelector(sel.postingTitle);
          const meta = p.querySelector(sel.postingMeta);
          if (!title || !meta) return true; // contract: exactly title (line 1) + meta (line 2)
          const lh = lineOf(title);
          return title.clientHeight > lh * 1.4 || meta.clientHeight > lh * 1.4;
        })
        .slice(0, 3)
        .map((p) => (p.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)),
    };
  }, { sel: { postingCell: SEL.postingCell, postingTitle: SEL.postingTitle, postingMeta: SEL.postingMeta } });
}

test('AC1: posting column ≤ 2 lines, zero overflow at 1440 px and 390 px', { skip: SKIP }, async () => {
  for (const width of SEL.widths) {
    const { context, page } = await openScan({ width, height: width >= 1024 ? 900 : 844 });
    try {
      const m = await measureAC1(page);
      assert.ok(m.postingCount > 0,
        `${width}px: no "${SEL.postingCell}" elements — build the row anatomy from ` +
        `docs/sdd/specs/2026-10-06-scan-page-redesign.md §Implementation contract`);
      assert.equal(m.docOverflow, 0, `${width}px: the page scrolls horizontally by ${m.docOverflow}px`);
      assert.equal(m.wrapOverflow, 0,
        `${width}px: the results table scrolls horizontally inside .table-wrap by ${m.wrapOverflow}px — ` +
        `the posting column must be bounded, not sprawl`);
      assert.equal(m.overflowingPostings, 0,
        `${width}px: ${m.overflowingPostings} posting cells render wider than their box`);
      assert.deepEqual(m.multiLinePostings, [],
        `${width}px: posting cells exceed the two-line budget (title line 1 + meta line 2): ` +
        JSON.stringify(m.multiLinePostings));
      // v1.244.2 — a board-side benefits blurb in the salary field must not
      // stretch rows: every aux cell stays on one rendered line (~< 30 px).
      assert.ok(m.tallestAuxPx < 30,
        `${width}px: an aux (seniority/salary) cell wraps its text (${m.tallestAuxPx}px content height) — clamp aux cells to one line. ` +
        `Tallest cells: ${JSON.stringify(m.tallestAuxCells)}`);
    } finally {
      await context.close();
    }
  }
});

// ── AC2 ──────────────────────────────────────────────────────────────────────
// Boost / fit / score are icons with accessible names; the names are localized.
async function measureAC2(page) {
  return page.evaluate(({ icons, keys }) => ({
    boostCount: document.querySelectorAll(icons.boost).length,
    fitCount: document.querySelectorAll(icons.fit).length,
    scoreCount: document.querySelectorAll(icons.score).length,
    boostAria: document.querySelector(icons.boost)?.getAttribute('aria-label') ?? null,
    fitAria: document.querySelector(icons.fit)?.getAttribute('aria-label') ?? null,
    scoreAria: document.querySelector(icons.score)?.getAttribute('aria-label') ?? null,
    tBoost: window.I18n.t(keys.boostIcon),
    tFit: window.I18n.t(keys.fitIcon),
    tScore: window.I18n.t(keys.scoreIcon),
    tPostedMeta: window.I18n.t(keys.postedMeta),
  }), { icons: SEL.icons, keys: SEL.keys });
}

test('AC2: boost/fit/score are icons with accessible names (en)', { skip: SKIP }, async () => {
  const { context, page } = await openScan({ lang: 'en' });
  try {
    const m = await measureAC2(page);
    const rendered = { boost: m.boostCount, fit: m.fitCount, score: m.scoreCount };
    for (const [name, count] of Object.entries(rendered)) {
      assert.ok(count > 0,
        `no "${SEL.icons[name]}" elements rendered — boost/fit/score must be icons per the contract`);
    }
    // The dict templates carry {band}/{by}/{score} placeholders and the view
    // interpolates them: the accessible name must be the SUBSTITUTED text —
    // no brace tokens reach assistive tech, the key must not fall back to
    // itself, and the name must be strictly longer than the template's
    // leading prefix (the placeholder was replaced with a real value, not
    // stripped). No fixture-value coupling: the contract is about
    // substitution, not about specific booster/band/score literals.
    const key_of = { boost: SEL.keys.boostIcon, fit: SEL.keys.fitIcon, score: SEL.keys.scoreIcon };
    for (const [name, aria, mapped] of [
      ['boost', m.boostAria, m.tBoost],
      ['fit', m.fitAria, m.tFit],
      ['score', m.scoreAria, m.tScore],
    ]) {
      assert.ok(aria, `the ${name} icon has no aria-label`);
      assert.notEqual(mapped, key_of[name], `i18n key for ${name} is unmapped (t() returned the key itself)`);
      const prefix = mapped.split('{')[0].trim();
      assert.ok(prefix.length > 0,
        `the ${name} dict template should start with a word before its placeholder (got "${mapped}")`);
      assert.ok(!aria.includes('{'), `the ${name} icon aria-label leaks a placeholder: "${aria}"`);
      assert.ok(aria.startsWith(prefix), `the ${name} icon aria-label must start with the dict prefix "${prefix}" — got "${aria}"`);
      assert.ok(aria.length > prefix.length, `the ${name} icon aria-label carries no interpolated value: "${aria}"`);
    }
  } finally {
    await context.close();
  }
});

test('AC2: icon accessible names are localized in ru', { skip: SKIP }, async () => {
  const dict = loadAssembledDict();
  const missing = Object.values(SEL.keys).filter((k) => !(dict[k] && dict[k].ru && dict[k].ru.trim()));
  assert.deepEqual(missing, [],
    'missing ru dictionary entries (add to ALL 17 locale tables — parity is gated by tests/i18n-coverage.test.mjs): ' + missing.join(', '));
  const { context, page } = await openScan({ lang: 'ru' });
  try {
    const m = await measureAC2(page);
    // Same substituted-name contract as the EN case: no brace tokens, the name
    // starts with the ru template's leading prefix (asserted non-empty so the
    // check cannot pass vacuously) and carries the interpolated value.
    const prefix = (k) => dict[k].ru.split('{')[0].trim();
    for (const [name, aria, key] of [
      ['boost', m.boostAria, SEL.keys.boostIcon],
      ['fit', m.fitAria, SEL.keys.fitIcon],
      ['score', m.scoreAria, SEL.keys.scoreIcon],
    ]) {
      const pfx = prefix(key);
      assert.ok(pfx.length > 0, `the ru template '${key}' starts with a placeholder — assert the contract against a worded template`);
      assert.ok(!aria.includes('{'), `the ${name} icon aria-label leaks a placeholder: "${aria}"`);
      assert.ok(aria.startsWith(pfx), `the ${name} icon aria-label must start with the ru prefix "${pfx}" — got "${aria}"`);
      assert.ok(aria.length > pfx.length, `the ${name} icon aria-label carries no interpolated value: "${aria}"`);
    }
  } finally {
    await context.close();
  }
});

// ── AC3 ──────────────────────────────────────────────────────────────────────
// 700-row corpus renders in pages: node budget + a page-size control.
test('AC3: 700-row corpus pages under the DOM node budget; page-size control exists', { skip: SKIP }, async () => {
  const { context, page } = await openScan({ lang: 'en', width: 1440 });
  try {
    const m = await page.evaluate(() => {
      const results = document.querySelector('#scan-results');
      let nodes = 0;
      const tw = document.createTreeWalker(results, NodeFilter.SHOW_ALL);
      while (tw.nextNode()) nodes++;
      const pager = document.querySelector('#scan-page-size');
      return {
        nodes,
        renderedRows: results.querySelectorAll('tbody tr').length,
        hasPageSize: !!pager,
        pageSizeTag: pager ? pager.tagName.toLowerCase() : null,
        pageSizeOptions: pager ? [...pager.querySelectorAll('option')].map((o) => o.value) : [],
        summary: results.querySelector('.paginator .pg-summary')?.textContent ?? null,
      };
    });
    assert.ok(m.hasPageSize, `no #scan-page-size control — a selectable page size is part of the contract`);
    assert.equal(m.pageSizeTag, 'select', '#scan-page-size must be a <select>');
    assert.ok(m.pageSizeOptions.includes(String(SEL.defaultPageSize)),
      `#scan-page-size must offer the default page size ${SEL.defaultPageSize} (got: ${m.pageSizeOptions.join(', ')})`);
    assert.ok(m.renderedRows > 0 && m.renderedRows <= SEL.defaultPageSize,
      `${m.renderedRows} rows rendered on first paint — the default page size is ${SEL.defaultPageSize}`);
    assert.ok(m.nodes < SEL.nodeBudget,
      `#scan-results carries ${m.nodes} DOM nodes for the ${SEL.corpusRows}-row corpus — ` +
      `budget is < ${SEL.nodeBudget} (page the render; today a page-slice alone is this big)`);
    assert.ok(m.summary, 'the paginator summary (".paginator .pg-summary") must state the visible range');
  } finally {
    await context.close();
  }
});

// ── AC5 (guard — must stay GREEN through the implementation) ────────────────
// Counts, order and row content are unchanged by the serve-time title-fit
// annotation. Unit-level guarantees live in tests/title-fit.test.mjs; this is
// the HTTP-boundary restatement so a regression in GET /api/scan-results
// cannot slip through between suites.
test('AC5 (guard): serve-time title-fit annotation preserves counts and row order', { skip: SKIP }, async () => {
  const served = await (await fetch(baseUrl + '/api/scan-results')).json();
  const expected = buildSnapshot(fixture);
  for (const region of ['en', 'ru']) {
    for (const set of ['fresh', 'filtered']) {
      const got = served[region][set];
      const want = expected[region][set];
      assert.equal(got.length, want.length, `${region}.${set}: row count changed`);
      const key = (r) => `${r.company}|${r.title}`;
      assert.deepEqual(got.map(key), want.map(key), `${region}.${set}: row order/content changed`);
    }
  }
  // The annotation itself is present on the complaint row (strong band) —
  // present, but never allowed to reorder or drop anything (assertions above).
  const grafana = served.en.filtered.find((r) => r.company === 'Grafana Labs');
  assert.equal(grafana?.fit?.band, 'strong', 'the Grafana row should carry a strong title-fit band');
});

// ── AFTER captures (SCAN_REDESIGN_CAPTURE=1) ────────────────────────────────
// Documents the redesigned layout: 3 widths × light/dark × en/ru →
// /tmp/scan-redesign/after/, plus metrics on the CONTRACT selectors (posting
// cell / node budget) so they can be diffed against the pre-redesign baseline
// (the before-capture run prints its own mkdtemp root — diff after vs before).
test('AFTER capture: 12 screenshots + redesign metrics (mkdtemp root, path printed)', { skip: SKIP || !CAPTURE || undefined }, async () => {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const outDir = resolve(mkdtempSync(resolve(tmpdir(), 'scan-redesign-after-')), 'after');
  mkdirSync(outDir, { recursive: true });
  console.log(`after-captures + metrics → ${outDir}`);
  const metrics = { generatedAt: new Date().toISOString(), baseUrl, widths: {} };

  for (const width of [1440, 1024, 390]) {
    for (const theme of ['light', 'dark']) {
      for (const lang of ['en', 'ru']) {
        const { context, page, errors } = await openScan({
          width, height: width >= 1024 ? 900 : 844, theme, lang,
        });
        try {
          await page.screenshot({
            path: resolve(outDir, `scan-${width}-${theme}-${lang}.png`),
            fullPage: true,
          });
          // Metrics only for the two AC1 widths, en/light (the reference pass).
          if (theme === 'light' && lang === 'en' && (width === 1440 || width === 390)) {
            metrics.widths[width] = await page.evaluate((sel) => {
              const lineOf = (el) => {
                const cs = getComputedStyle(el);
                const lh = parseFloat(cs.lineHeight);
                return Number.isFinite(lh) && lh > 0 ? lh : parseFloat(cs.fontSize) * 1.25;
              };
              const de = document.documentElement;
              const wrap = document.querySelector('#scan-results .table-wrap');
              const results = document.querySelector('#scan-results');
              let nodes = 0;
              const tw = document.createTreeWalker(results, NodeFilter.SHOW_ALL);
              while (tw.nextNode()) nodes++;
              const postings = [...results.querySelectorAll(sel)];
              let maxCellOverflow = 0;
              let tallerThanTwoLines = 0;
              for (const p of postings) {
                maxCellOverflow = Math.max(maxCellOverflow, p.scrollWidth - p.clientWidth);
                const title = p.querySelector('.scan-posting-title');
                const meta = p.querySelector('.scan-posting-meta');
                if (!title || !meta ||
                    title.clientHeight > lineOf(title) * 1.4 ||
                    meta.clientHeight > lineOf(meta) * 1.4) tallerThanTwoLines++;
              }
              return {
                docOverflowPx: de.scrollWidth - de.clientWidth,
                wrapOverflowPx: wrap ? wrap.scrollWidth - wrap.clientWidth : null,
                tableWidthPx: results.querySelector('table')?.scrollWidth ?? null,
                pageHeightPx: de.scrollHeight,
                renderedRows: results.querySelectorAll('tbody tr').length,
                scanResultsNodeCount: nodes,
                postingCellMaxOverflowPx: maxCellOverflow,
                postingsTallerThanTwoLines: tallerThanTwoLines,
                postingCellSampleHeightPx: postings[0]?.clientHeight ?? null,
              };
            }, SEL.postingCell);
            metrics.widths[width].consoleErrors = errors;
          }
        } finally {
          await context.close();
        }
      }
    }
  }
  writeFileSync(resolve(outDir, 'metrics.json'), JSON.stringify(metrics, null, 2));
});
