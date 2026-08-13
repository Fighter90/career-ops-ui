/**
 * Generated-PDF list + download endpoints. The actual PDF generation
 * runs through generate-pdf.mjs in the parent project (Playwright) and
 * is therefore NOT exercised here — see the e2e flow for that.
 *
 * What we DO test here:
 *   - GET  /api/output/pdfs        → list metadata, sorted newest first
 *   - GET  /api/output/pdfs/:name  → PDF bytes with proper headers
 *   - 4xx on path-traversal / non-.pdf names
 *   - 404 on missing file
 *   - Playwright + parent-deps health check shape
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let projectRoot;

before(async () => {
  projectRoot = mkdtempSync(resolve(tmpdir(), 'pdf-out-'));
  mkdirSync(resolve(projectRoot, 'config'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'data'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'modes'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'output'), { recursive: true });
  writeFileSync(resolve(projectRoot, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(projectRoot, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(projectRoot, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(projectRoot, 'data', 'applications.md'), '');
  writeFileSync(resolve(projectRoot, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(projectRoot, 'modes', 'oferta.md'), 'oferta\n');
  // Two fake PDFs — content doesn't need to be valid PDF for the API tests.
  writeFileSync(resolve(projectRoot, 'output', 'cv-2026-05-03.pdf'), '%PDF-1.4 fake newest');
  // Backdate the older file so newest-first ordering is deterministic.
  const olderPath = resolve(projectRoot, 'output', 'cv-2026-04-01.pdf');
  writeFileSync(olderPath, '%PDF-1.4 fake older');
  const past = new Date('2026-04-01').getTime();
  await import('node:fs/promises').then((fs) => fs.utimes(olderPath, past / 1000, past / 1000));
  process.env.CAREER_OPS_ROOT = projectRoot;
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

test('GET /api/output/pdfs lists PDFs newest-first', async () => {
  const r = await fetch(baseUrl + '/api/output/pdfs');
  const data = await r.json();
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(data.files));
  assert.equal(data.files.length, 2);
  // newest first
  assert.equal(data.files[0].name, 'cv-2026-05-03.pdf');
  assert.equal(data.files[1].name, 'cv-2026-04-01.pdf');
  for (const f of data.files) {
    assert.equal(typeof f.size, 'number');
    assert.ok(f.mtime);
  }
});

test('GET /api/output/pdfs/:name streams the PDF with attachment headers', async () => {
  const r = await fetch(baseUrl + '/api/output/pdfs/cv-2026-05-03.pdf');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.match(r.headers.get('content-disposition'), /attachment;\s*filename="cv-2026-05-03\.pdf"/);
  const text = await r.text();
  assert.ok(text.includes('%PDF-1.4'));
});

test('GET /api/output/pdfs/:name 404 on missing', async () => {
  const r = await fetch(baseUrl + '/api/output/pdfs/never-here.pdf');
  assert.equal(r.status, 404);
});

test('GET /api/output/pdfs/:name 400 on non-.pdf', async () => {
  const r = await fetch(baseUrl + '/api/output/pdfs/cv.txt');
  assert.equal(r.status, 400);
});

test('GET /api/output/pdfs/:name strips path traversal', async () => {
  // ../../etc/passwd has no .pdf → 400
  const r1 = await fetch(baseUrl + '/api/output/pdfs/' + encodeURIComponent('../../etc/passwd'));
  assert.ok(r1.status >= 400);
  // ../../etc/passwd.pdf — slashes stripped → "etcpasswd.pdf" → 404
  const r2 = await fetch(baseUrl + '/api/output/pdfs/' + encodeURIComponent('../../etc/passwd.pdf'));
  assert.ok(r2.status >= 400);
});

test('Health: Playwright + parent-deps checks present, marked optional', async () => {
  const r = await fetch(baseUrl + '/api/health');
  const h = await r.json();
  const playwright = h.checks.find((c) => c.name.startsWith('Playwright'));
  const parentDeps = h.checks.find((c) => c.name.startsWith('Parent project'));
  assert.ok(playwright, 'expected Playwright health check');
  assert.equal(playwright.required, false);
  assert.ok(parentDeps, 'expected Parent project deps check');
  assert.equal(parentDeps.required, false);
  // Both should fail in the empty test fixture (no node_modules):
  assert.equal(playwright.ok, false);
  assert.equal(parentDeps.ok, false);
  // The user-visible value should hint how to fix it:
  assert.match(playwright.value, /npm install/);
  assert.match(parentDeps.value, /npm install/);
});

// D-5 (v1.169.0) — `?inline=1` serves the SAME file with an inline disposition
// so the browser renders it (review-before-send preview) instead of forcing a
// download. The default (no param) must stay `attachment`.
test('D-5: GET /api/output/pdfs/:name?inline=1 serves an inline preview', async () => {
  const r = await fetch(baseUrl + '/api/output/pdfs/cv-2026-05-03.pdf?inline=1');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.match(
    r.headers.get('content-disposition'),
    /^inline;\s*filename="cv-2026-05-03\.pdf"/,
    'inline=1 must switch Content-Disposition to inline',
  );
  const text = await r.text();
  assert.ok(text.includes('%PDF-1.4'), 'same bytes served');
});

test('D-5: the default (no inline param) is still a download (attachment)', async () => {
  const r = await fetch(baseUrl + '/api/output/pdfs/cv-2026-05-03.pdf');
  assert.match(r.headers.get('content-disposition'), /^attachment;/, 'default stays attachment');
});

test('D-5: ?inline=1 still enforces the path/name guards (no bypass)', async () => {
  const r1 = await fetch(baseUrl + '/api/output/pdfs/cv.txt?inline=1');
  assert.equal(r1.status, 400, 'non-.pdf rejected even with inline');
  const r2 = await fetch(baseUrl + '/api/output/pdfs/' + encodeURIComponent('../../etc/passwd.pdf') + '?inline=1');
  assert.ok(r2.status >= 400, 'path traversal still blocked with inline');
});
