/**
 * runners-data-migrations.test.mjs — route-level contract for the two
 * CAR-232/233 migration endpoints (review v1.268.1 finding: they shipped
 * with module-level tests only):
 *   · POST /api/runners/report-dates — mode validation, dry-run default
 *     (read-only), apply = header rewrite + backup + atomic temp-rename;
 *   · POST /api/runners/company-fix — mode validation, dry-run read-only,
 *     apply = line-surgical rewrite under the tracker lock.
 *
 * CI-isolated: CAREER_OPS_ROOT is a mktemp dir (cv.md + fixture reports +
 * applications.md), no network, no keys, servers on 127.0.0.1:0.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SAVE = {};

let createApp;
let app;
let server;
let baseUrl;
let dataRoot;

const REPORT_BAD = `# Evaluation: Acme — Engineer

**Company:** Acme
**Date:** 2025-01-15
**Score:** 4.1/5
`;
// Filename date 2026-06-01 vs header date 2025-01-15 → a scan hit.

const TRACKER = `# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
| 1 | 2026-06-01 | **hh** | Go Engineer | 4.1/5 | Оценена | ❌ | [1](../reports/001-acme-2026-06-01.md) | via hh |
`;

before(async () => {
  for (const k of ['CAREER_OPS_ROOT']) { SAVE[k] = process.env[k]; }
  dataRoot = mkdtempSync(resolve(tmpdir(), 'runners-dm-'));
  process.env.CAREER_OPS_ROOT = dataRoot;
  mkdirSync(resolve(dataRoot, 'reports'), { recursive: true });
  mkdirSync(resolve(dataRoot, 'data'), { recursive: true });
  writeFileSync(resolve(dataRoot, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dataRoot, 'reports', '001-acme-2026-06-01.md'), REPORT_BAD);
  writeFileSync(resolve(dataRoot, 'data', 'applications.md'), TRACKER);
  ({ createApp } = await import('../server/index.mjs'));
  app = createApp();
  server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; });
  await new Promise((r) => { if (baseUrl) r(); else server.on('listening', r); });
});

after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  rmSync(dataRoot, { recursive: true, force: true });
  for (const [k, v] of Object.entries(SAVE)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

const post = async (path, body) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

test('both endpoints reject a bad mode with 400', async () => {
  const r1 = await post('/api/runners/report-dates', { mode: 'yolo' });
  assert.equal(r1.status, 400);
  const r2 = await post('/api/runners/company-fix', { mode: 'yolo' });
  assert.equal(r2.status, 400);
});

test('report-dates dry-run is the default and writes nothing', async () => {
  const implicit = await post('/api/runners/report-dates', {});
  assert.equal(implicit.status, 200);
  assert.equal(implicit.body.mode, 'dry-run');
  assert.equal(implicit.body.count, 1, 'the fixture mismatch is found');
  const explicit = await post('/api/runners/report-dates', { mode: 'dry-run' });
  assert.equal(explicit.body.mode, 'dry-run');
  // Read-only: the report header still carries the stale date, no backups exist.
  const after = readFileSync(resolve(dataRoot, 'reports', '001-acme-2026-06-01.md'), 'utf8');
  assert.match(after, /\*\*Date:\*\* 2025-01-15/);
  assert.equal(readdirSync(resolve(dataRoot, 'reports')).filter((f) => f.includes('.bak-')).length, 0);
});

test('report-dates apply rewrites the header, leaves a backup, keeps the file valid', async () => {
  const r = await post('/api/runners/report-dates', { mode: 'apply' });
  assert.equal(r.status, 200);
  assert.equal(r.body.mode, 'apply');
  assert.equal(r.body.count, 1);
  const fixed = readFileSync(resolve(dataRoot, 'reports', '001-acme-2026-06-01.md'), 'utf8');
  assert.match(fixed, /\*\*Date:\*\* 2026-06-01/, 'the header date now matches the filename');
  assert.ok(!fixed.includes('.tmp'), 'no temp file survives');
  assert.equal(existsSync(resolve(dataRoot, 'reports', '001-acme-2026-06-01.md.tmp')), false);
});

test('company-fix dry-run is the default and writes nothing; apply fixes the cell under backup', async () => {
  const dry = await post('/api/runners/company-fix', {});
  assert.equal(dry.status, 200);
  assert.equal(dry.body.mode, 'dry-run');
  assert.equal(dry.body.count, 1, 'the source-name row is detected');
  const untouched = readFileSync(resolve(dataRoot, 'data', 'applications.md'), 'utf8');
  assert.match(untouched, /\*\*hh\*\*/, 'dry-run left the tracker untouched');

  const apply = await post('/api/runners/company-fix', { mode: 'apply' });
  assert.equal(apply.status, 200);
  assert.equal(apply.body.changed, 1);
  const fixed = readFileSync(resolve(dataRoot, 'data', 'applications.md'), 'utf8');
  assert.ok(!fixed.includes('**hh**'), 'the source-name cell is rewritten');
  assert.equal(existsSync(`${resolve(dataRoot, 'data', 'applications.md')}.tmp`), false, 'atomic rename left no temp');
  const backups = readdirSync(resolve(dataRoot, 'data')).filter((f) => f.includes('.bak-'));
  assert.equal(backups.length, 1, 'exactly one timestamped backup');
});
