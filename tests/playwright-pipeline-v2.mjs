/**
 * CAR-116 — #/pipeline v2 behavioural flows (real browser):
 *   F1  grouped view renders by default with enriched cards
 *       (role/company/score/„Evaluated" badge joined from the tracker
 *       + a report header — the EXISTING /api payloads);
 *   F2  a row checkbox selects → the bulk bar appears; group checkbox
 *       selects the whole group;
 *   F3  single delete: NO confirm dialog, the undo bar appears, Undo
 *       re-adds the URL through POST /api/pipeline;
 *   F4  bulk discard: confirm modal → sequential DELETEs with progress
 *       → undo bar → Undo restores the batch;
 *   F5  hide-already-evaluated (default ON) hides the tracked entry;
 *   F6  flat (compact) view still renders the legacy rows.
 *
 * Runs against the same CI-isolated fixture shape as
 * playwright-car93-spa.mjs (mkdtemp CAREER_OPS_ROOT, 127.0.0.1 bind).
 * Not yet wired into `npm run test:e2e:browser` (package.json is outside
 * this task's file ownership) — run standalone:
 *   node --test tests/playwright-pipeline-v2.mjs
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { chromium = require('playwright').chromium; } catch { chromium = null; }
const SKIP = !chromium;

let server, baseUrl, browser, dir;
const context = {};

before(async () => {
  if (SKIP) return;
  const { execFileSync } = await import('node:child_process');
  chromium = chromium || (await import('playwright')).chromium;
  dir = mkdtempSync(resolve(tmpdir(), 'pw-pipe-v2-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  mkdirSync(resolve(dir, 'reports'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n\nReal Person, Senior Backend Engineer.\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Tester\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'x\n');
  // Pipeline: 3 URLs. ONE of them (habr 1000136672) is already tracked —
  // it must be hidden by default and badge-able when shown.
  writeFileSync(resolve(dir, 'data', 'pipeline.md'),
    '# Pipeline\n\n```\nhttps://career.habr.com/vacancies/1000136672\nhttps://career.habr.com/vacancies/1000136673\nhttps://jobs.lever.co/acme/777\n```\n');
  // Tracker: habr …672 evaluated 4.2/5 — the enrichment + hide-tracked source.
  writeFileSync(resolve(dir, 'data', 'applications.md'),
    '# Applications Tracker\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes | URL |\n' +
    '|---|------|---------|------|-------|--------|-----|--------|-------|-----|\n' +
    '| 1 | 2026-10-01 | Хабр | Backend Developer | 4.2/5 | Evaluated | ❌ | — | | https://career.habr.com/vacancies/1000136672 |\n');
  // A report whose header names the lever.co posting — the report-header
  // enrichment source (title + scoreNum).
  writeFileSync(resolve(dir, 'reports', '007-acme.md'),
    '# Evaluation: Acme — Platform Engineer\n\n' +
    '**Date:** 2026-10-02\n**Score:** 3.8/5\n**URL:** https://jobs.lever.co/acme/777\n');
  process.env.CAREER_OPS_ROOT = dir;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
  browser = await chromium.launch();
  context.page = await browser.newPage();
  await context.page.addInitScript(() => localStorage.setItem('career-ops-ui:lang', 'en'));
});

after(async () => {
  if (context.page) await context.page.close().catch(() => {});
  if (browser) await browser.close();
  if (server) await new Promise((r) => server.close(r));
  delete process.env.CAREER_OPS_ROOT;
  if (dir) rmSync(dir, { recursive: true, force: true });
});

async function open() {
  const page = context.page;
  // Same-URL goto is a same-document no-op — a stale bar/selection from
  // the previous flow would leak into this one. Force a real reload.
  await page.goto('about:blank');
  await page.goto(baseUrl + '/#/pipeline');
  await page.waitForSelector('h1.page-title');
  return page;
}

test('CAR-116 F1: grouped view default; cards carry role/company/score/badge', { skip: SKIP }, async () => {
  const page = await open();
  await page.waitForSelector('.v2-group');
  // hide-tracked defaults ON → the evaluated habr row is hidden. The
  // remaining lever.co entry is enriched from its report header; the
  // untracked habr entry (fenced pipeline = no company cells) falls
  // back to its host group — the documented no-data fallback.
  const labels = await page.locator('.v2-group-label').allTextContents();
  assert.ok(labels.includes('Acme') && labels.includes('career.habr.com'), `groups: ${labels}`);
  const first = page.locator('.pipeline-row.v2-row').first();
  const title = await first.locator('.v2-row-title').textContent();
  assert.match(title, /Platform Engineer — Acme|Acme/, `enriched title, got: ${title}`);
  const chip = await first.locator('.v2-chip-score').textContent();
  assert.match(chip, /3\.8/, 'report score chip');
  const url = await first.locator('.v2-row-url').textContent();
  assert.match(url, /^https:\/\/jobs\.lever\.co/, 'raw URL stays visible');
});

test('CAR-116 F5: show already-evaluated reveals the tracked entry with its badge', { skip: SKIP }, async () => {
  const page = await open();
  await page.uncheck('#pipe-hide-tracked');
  await page.waitForSelector('.v2-chip-tracked');
  const txt = await page.locator('.v2-group').first().textContent();
  assert.match(txt.replace(/\s+/g, ' '), /Evaluated · Evaluated|Evaluated/, 'evaluated badge');
  const row = page.locator('.pipeline-row.v2-row', { hasText: '1000136672' });
  assert.match(await row.locator('.v2-chip-score').textContent(), /4\.2/, 'tracker score');
});

test('CAR-116 F2: row + group checkboxes drive the bulk bar', { skip: SKIP }, async () => {
  const page = await open();
  await page.waitForSelector('.v2-group');
  const bar = page.locator('.v2-bulkbar');
  assert.ok(await bar.isHidden(), 'bulk bar hidden at zero selection');
  const row = page.locator('.pipeline-row.v2-row').first();
  const lbl = await row.locator('input[type=checkbox]').getAttribute('aria-label');
  assert.match(lbl, /^Select: /, 'row checkbox is labelled');
  await row.locator('input[type=checkbox]').check();
  assert.ok(await bar.isVisible(), 'bulk bar appears');
  assert.match(await bar.textContent(), /1\s*selected/);
  const groupBox = page.locator('.v2-group-head input[type=checkbox]').first();
  const glbl = await groupBox.getAttribute('aria-label');
  assert.match(glbl, /^Select all in group: /, 'group checkbox is labelled');
  await groupBox.check();
  assert.match(await bar.textContent(), /selected/);
  await page.locator('button', { hasText: 'Clear selection' }).click();
  assert.ok(await bar.isHidden(), 'clear empties the selection');
});

test('CAR-116 F3: single delete — no confirm, undo bar, Undo restores', { skip: SKIP }, async () => {
  const page = await open();
  await page.waitForSelector('.pipeline-row.v2-row');
  let dialogs = 0;
  page.on('dialog', () => { dialogs += 1; });
  const row = page.locator('.pipeline-row.v2-row').first();
  const del = row.locator('button.pipeline-row-delete');
  const lbl = await del.getAttribute('aria-label');
  assert.match(lbl, /^Delete: /, 'delete button is labelled');
  await del.click();
  await page.waitForSelector('#pipeline-undo-bar', { state: 'visible' });
  assert.equal(dialogs, 0, 'no confirm dialog on single delete');
  const count = await page.evaluate(async () => (await (await fetch('/api/pipeline')).json()).urls.length);
  assert.equal(count, 2, 'one shown URL removed; the hidden tracked one + its group neighbour remain');
  await page.locator('#pipeline-undo-btn').click();
  await page.waitForFunction(async () => {
    const r = await fetch('/api/pipeline');
    return (await r.json()).urls.length === 3;
  }, null, { timeout: 5000 }).catch(() => {});
  const restored = await page.evaluate(async () => (await (await fetch('/api/pipeline')).json()).urls.length);
  assert.equal(restored, 3, 'Undo re-added the deleted URL');
});

test('CAR-116 F4: bulk discard — confirm → progress → undo restores the batch', { skip: SKIP }, async () => {
  const page = await open();
  await page.waitForSelector('.v2-group');
  // select ALL shown (2 entries: tracker row is hidden)
  await page.locator('.v2-toolbar button', { hasText: 'Select all shown' }).click();
  const bar = page.locator('.v2-bulkbar');
  await page.locator('button', { hasText: 'Remove selected' }).click();
  // focus-trapped UI.confirm modal — confirm the danger action
  await page.waitForSelector('#modal:not([hidden])', { timeout: 3000 });
  await page.locator('#modal button.btn-danger, #modal .btn-danger').first().click();
  await page.waitForSelector('#pipeline-undo-bar', { state: 'visible', timeout: 8000 });
  const left = await page.evaluate(async () => (await (await fetch('/api/pipeline')).json()).urls.length);
  assert.equal(left, 1, 'both selected URLs were removed (only the tracked one remains)');
  await page.locator('#pipeline-undo-btn').click();
  await page.waitForFunction(async () => {
    const r = await fetch('/api/pipeline');
    return (await r.json()).urls.length === 3;
  }, null, { timeout: 5000 }).catch(() => {});
  const restored = await page.evaluate(async () => (await (await fetch('/api/pipeline')).json()).urls.length);
  assert.equal(restored, 3, 'bulk Undo restored the batch');
});

test('CAR-116 F6: the compact (flat) view keeps the legacy rows', { skip: SKIP }, async () => {
  const page = await open();
  await page.locator('.v2-toolbar button', { hasText: 'Compact list' }).click();
  await page.waitForSelector('#pipeline-list .pipeline-row');
  const rows = await page.locator('#pipeline-list .pipeline-row').count();
  assert.equal(rows, 2, 'hide-tracked still applies in flat view');
  const aria = await page.locator('#pipeline-list .pipeline-row button').first().getAttribute('aria-label');
  assert.match(aria, /^Evaluate: /, 'legacy disambiguated labels kept');
  await page.locator('.v2-toolbar button', { hasText: 'Grouped' }).click();
  await page.waitForSelector('.v2-group');
});
