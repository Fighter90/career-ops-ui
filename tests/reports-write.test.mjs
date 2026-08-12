/**
 * v1.16.0 — POST /api/reports primitive (G-007 follow-up).
 *
 * Auto-pipeline finalization: until v1.16 the orchestrator could
 * generate a PDF and add a tracker row but couldn't persist the
 * markdown to parent reports/. This route fills that gap.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let dir;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'reports-write-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'),   { recursive: true });
  mkdirSync(resolve(dir, 'modes'),  { recursive: true });
  mkdirSync(resolve(dir, 'reports'),{ recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '# Applications\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'oferta\n');
  process.env.CAREER_OPS_ROOT = dir;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((r) => server.close(r));
});

function clean() {
  try { rmSync(resolve(dir, 'reports', 'test-report.md'), { force: true }); } catch {}
  try { rmSync(resolve(dir, 'reports', 'evil-slug.md'),   { force: true }); } catch {}
}

test('POST /api/reports writes reports/<slug>.md and returns ok', async () => {
  clean();
  const r = await fetch(baseUrl + '/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: 'test-report', markdown: '# Test\n\nBody.\n' }),
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.ok, true);
  assert.equal(body.slug, 'test-report');
  assert.equal(body.path, 'reports/test-report.md');
  const persisted = readFileSync(resolve(dir, 'reports', 'test-report.md'), 'utf8');
  assert.match(persisted, /^# Test/);
});

test('POST /api/reports: slug sanitized — strip dangerous chars', async () => {
  clean();
  const r = await fetch(baseUrl + '/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: '../evil/slug $$$', markdown: '# X\n' }),
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.slug, 'evilslug');
  assert.ok(existsSync(resolve(dir, 'reports', 'evilslug.md')));
  // Cleanup
  rmSync(resolve(dir, 'reports', 'evilslug.md'), { force: true });
});

test('POST /api/reports: 409 when file exists without overwrite flag', async () => {
  clean();
  writeFileSync(resolve(dir, 'reports', 'test-report.md'), '# Old\n');
  const r = await fetch(baseUrl + '/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: 'test-report', markdown: '# New\n' }),
  });
  assert.equal(r.status, 409);
});

test('POST /api/reports: overwrite:true replaces existing file', async () => {
  clean();
  writeFileSync(resolve(dir, 'reports', 'test-report.md'), '# Old\n');
  const r = await fetch(baseUrl + '/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: 'test-report', markdown: '# New\n', overwrite: true }),
  });
  assert.equal(r.status, 200);
  const persisted = readFileSync(resolve(dir, 'reports', 'test-report.md'), 'utf8');
  assert.match(persisted, /^# New/);
});

test('POST /api/reports: sanitizes <script> and javascript: payloads', async () => {
  clean();
  const r = await fetch(baseUrl + '/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: 'test-report',
      markdown: '# Report\n\n<script>alert(1)</script>\n[bad](javascript:doStuff())\n',
    }),
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.sanitized, true);
  const persisted = readFileSync(resolve(dir, 'reports', 'test-report.md'), 'utf8');
  assert.doesNotMatch(persisted, /<script>/);
  assert.doesNotMatch(persisted, /javascript:/);
});

test('POST /api/reports: 400 on missing slug', async () => {
  const r = await fetch(baseUrl + '/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown: '# X\n' }),
  });
  assert.equal(r.status, 400);
});

test('POST /api/reports: 400 on missing markdown', async () => {
  const r = await fetch(baseUrl + '/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: 'test-report' }),
  });
  assert.equal(r.status, 400);
});

test('POST /api/reports: 413 on >1 MB body', async () => {
  clean();
  const big = '# Big\n' + 'x'.repeat(1024 * 1024 + 100);
  const r = await fetch(baseUrl + '/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: 'test-report', markdown: big }),
  });
  assert.equal(r.status, 413);
});

test('GET /api/reports/test-report returns just-written content', async () => {
  clean();
  await fetch(baseUrl + '/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: 'test-report', markdown: '# Round trip\n\nValue.\n' }),
  });
  const r = await fetch(baseUrl + '/api/reports/test-report');
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.match(body.markdown, /Round trip/);
});

// FIX-1 (v1.159.0) — a non-English report must yield full metadata on the
// live list/read path, not just in the unit test. Writes a RU report whose
// only machine-readable score/legitimacy live in the `## Machine Summary`
// block and asserts GET /api/reports parses them (pre-fix: scoreNum null).
test('FIX-1: GET /api/reports parses a Russian report via Machine Summary', async () => {
  const ru = `# Оценка вакансии: Пример — Ведущий инженер

## Блок C — Уровень и стратегия
Оценка соответствия: 1.5 / 5
Легитимность: High Confidence

## Machine Summary
score: 1.5 / 5
legitimacy: High
company: Пример
role: Ведущий инженер
`;
  writeFileSync(resolve(dir, 'reports', 'ru-report.md'), ru);
  try {
    const r = await fetch(baseUrl + '/api/reports');
    assert.equal(r.status, 200);
    const { reports } = await r.json();
    const row = reports.find((x) => x.slug === 'ru-report');
    assert.ok(row, 'ru-report present in the list');
    assert.equal(row.scoreNum, 1.5, 'scoreNum parsed from the Machine Summary block');
    assert.ok(/^high/i.test(row.legitimacy), 'legitimacy parsed');
    assert.ok(row.date, 'date filled (Machine Summary or mtime fallback)');
  } finally {
    rmSync(resolve(dir, 'reports', 'ru-report.md'), { force: true });
  }
});
