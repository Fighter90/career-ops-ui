/**
 * v1.55.8 — UX-8 (Feedback / forms): #/tracker fetched EVERY row and
 * paginated client-side; a long history is a slow wall with no
 * funnel-at-a-glance. Add OPTIONAL server-side pagination to
 * GET /api/tracker (?page=&pageSize=&status=) plus a `funnel`
 * status breakdown — WITHOUT breaking the back-compat shape
 * (no params ⇒ exactly `{ rows: [...] }` as before).
 *
 * In-process Express on an ephemeral port; CAREER_OPS_ROOT points at
 * a temp dir so the real parent applications.md is never read
 * (CLAUDE.md #2/#8). Never hardcode 4317.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let projectRoot, server, baseUrl;

const STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected', 'Evaluated'];
// 23 rows: 10 Applied, 5 Interview, 3 Offer, 3 Rejected, 2 Evaluated.
const PLAN = [['Applied', 10], ['Interview', 5], ['Offer', 3], ['Rejected', 3], ['Evaluated', 2]];

function fixtureTable() {
  const head = [
    '# Applications Tracker', '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|',
  ];
  const rows = [];
  let n = 1;
  for (const [status, count] of PLAN) {
    for (let i = 0; i < count; i++) {
      rows.push(`| ${n} | 2026-05-1${n % 9} | Co${n} | Role ${n} | ${(n % 5) + 1}/5 | ${status} | ❌ | — | note ${n} |`);
      n++;
    }
  }
  return head.concat(rows).join('\n') + '\n';
}

before(async () => {
  projectRoot = mkdtempSync(resolve(tmpdir(), 'tracker-paged-'));
  mkdirSync(resolve(projectRoot, 'data'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'config'), { recursive: true });
  writeFileSync(resolve(projectRoot, 'cv.md'), '# CV\n');
  writeFileSync(resolve(projectRoot, 'portals.yml'), 'tracked_companies: []\n');
  process.env.CAREER_OPS_ROOT = projectRoot;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  delete process.env.CAREER_OPS_ROOT;
});
beforeEach(() => {
  writeFileSync(resolve(projectRoot, 'data', 'applications.md'), fixtureTable());
});

const get = async (qs) => {
  const r = await fetch(baseUrl + '/api/tracker' + (qs ? '?' + qs : ''));
  return { status: r.status, body: await r.json() };
};

test('back-compat: no query params ⇒ { rows } with every row, no envelope', async () => {
  const { status, body } = await get('');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.rows));
  assert.equal(body.rows.length, 23);
  // The legacy shape must be untouched — no pagination keys leak in.
  assert.equal(body.total, undefined);
  assert.equal(body.page, undefined);
  assert.equal(body.funnel, undefined);
});

test('?page=1&pageSize=10 ⇒ first 10 + total + page + pageSize + funnel', async () => {
  const { body } = await get('page=1&pageSize=10');
  assert.equal(body.rows.length, 10);
  assert.equal(body.total, 23);
  assert.equal(body.page, 1);
  assert.equal(body.pageSize, 10);
  assert.ok(body.funnel && typeof body.funnel === 'object');
  // Funnel is the FULL status breakdown (independent of the page).
  assert.equal(body.funnel.Applied, 10);
  assert.equal(body.funnel.Interview, 5);
  assert.equal(body.funnel.Offer, 3);
  assert.equal(body.funnel.Rejected, 3);
  assert.equal(body.funnel.Evaluated, 2);
  const sum = Object.values(body.funnel).reduce((a, b) => a + b, 0);
  assert.equal(sum, 23);
});

test('last partial page returns the remainder, no overlap', async () => {
  const p1 = (await get('page=1&pageSize=10')).body.rows.map((r) => r.num);
  const p3 = (await get('page=3&pageSize=10')).body;
  assert.equal(p3.rows.length, 3);
  // No id appears on both page 1 and page 3.
  const overlap = p3.rows.some((r) => p1.includes(r.num));
  assert.equal(overlap, false);
});

test('page past the end ⇒ empty rows but valid total/page', async () => {
  const { body } = await get('page=99&pageSize=10');
  assert.equal(body.rows.length, 0);
  assert.equal(body.total, 23);
  assert.equal(body.page, 99);
});

test('?status=Applied filters total + rows; funnel stays full', async () => {
  const { body } = await get('status=Applied&page=1&pageSize=100');
  assert.equal(body.total, 10);
  assert.ok(body.rows.every((r) => r.status === 'Applied'));
  assert.equal(body.rows.length, 10);
  // Funnel is still the whole-history breakdown so chips are accurate.
  assert.equal(body.funnel.Interview, 5);
});

test('pageSize is clamped to a sane maximum', async () => {
  const { body } = await get('page=1&pageSize=100000');
  assert.ok(body.pageSize <= 500, `pageSize ${body.pageSize} must be capped`);
});

// ── client funnel chips (tracker.js is browser-only → source-static)
test('#/tracker renders a clickable funnel chip bar', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, resolve: r } = await import('node:path');
  const __d = dirname(fileURLToPath(import.meta.url));
  const TR = readFileSync(r(__d, '..', 'public', 'js', 'views', 'tracker.js'), 'utf8');
  const DICT = legacyDictText();
  const CSS = readFileSync(r(__d, '..', 'public', 'css', 'app.css'), 'utf8');
  assert.match(TR, /className: 'tracker-funnel'/, 'a .tracker-funnel bar must exist');
  assert.match(TR, /tracker-chip/, 'chips use the .tracker-chip class');
  // Clicking a chip drives the Status filter (toggle on re-click).
  assert.match(TR, /filterStatus\.value = \(filterStatus\.value === value\) \? '' : value/);
  assert.match(TR, /'aria-pressed'/, 'chips expose pressed state for a11y');
  assert.match(TR, /t\('track\.funnelAria'/, 'funnel region is labelled');
  assert.match(CSS, /\.tracker-chip\b/);
  assert.match(CSS, /\.tracker-chip--active\b/);
  const line = DICT.split('\n').find((l) => l.includes("'track.funnelAria'"));
  assert.ok(line, 'track.funnelAria i18n key missing');
  for (const loc of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
    const tok = /-/.test(loc) ? `'${loc}':` : `${loc}:`;
    assert.ok(line.includes(tok), `track.funnelAria missing locale ${loc}`);
  }
});
