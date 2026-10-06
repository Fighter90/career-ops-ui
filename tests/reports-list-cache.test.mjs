/**
 * safeListReports() backs /api/reports and /api/dashboard. It re-read and
 * re-parsed every report on every call — ~3.7 s per call on the production
 * box, blocking the event loop, so pages timed out while a scan ran. Parsed
 * headers are now cached per file and invalidated on any mtime/size change.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let dir, safeListReports, __reportCache;
const report = (score) => `# Evaluation: Engineer — Acme\n\n**Date:** 2026-09-01\n**Score:** ${score}/5\n\nbody\n`;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'reports-cache-'));
  mkdirSync(resolve(dir, 'reports'), { recursive: true });
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  for (const n of ['a', 'b', 'c']) writeFileSync(resolve(dir, 'reports', `${n}.md`), report('4.1'));
  // A sibling directory sharing the prefix must not be touched by eviction.
  mkdirSync(resolve(dir, 'reports-old'), { recursive: true });
  // paths.mjs honors CAREER_OPS_ROOT only if the directory holds cv.md or
  // portals.yml; without one it falls back to ../, i.e. the REAL parent project
  // on a developer machine (CI has none, which is why only local runs failed).
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  process.env.CAREER_OPS_ROOT = dir;
  ({ safeListReports, __reportCache } = await import('../server/lib/store.mjs'));
});

after(() => { delete process.env.CAREER_OPS_ROOT; });

test('a second listing parses nothing when no report changed', () => {
  __reportCache.reset();
  const first = safeListReports();
  assert.equal(first.length, 3);
  assert.equal(__reportCache.misses, 3);
  const second = safeListReports();
  assert.deepEqual(second.map((r) => r.slug).sort(), ['a', 'b', 'c']);
  assert.equal(__reportCache.misses, 3, 'unchanged reports must come from the cache');
  assert.equal(__reportCache.hits, 3);
});

test('a changed report is re-parsed; callers get copies, not the cached object', () => {
  __reportCache.reset();
  safeListReports();
  const file = resolve(dir, 'reports', 'b.md');
  writeFileSync(file, report('2.5') + 'longer body\n');
  const later = new Date(Date.now() + 5_000);
  utimesSync(file, later, later);
  const list = safeListReports();
  const b = list.find((r) => r.slug === 'b');
  assert.equal(__reportCache.misses, 4, 'only b is parsed again');
  assert.match(JSON.stringify(b), /2\.5/);
  b.slug = 'mutated';
  assert.ok(safeListReports().some((r) => r.slug === 'b'), 'mutating a result must not poison the cache');
});

test('added and deleted reports show up immediately', () => {
  writeFileSync(resolve(dir, 'reports', 'd.md'), report('3.0'));
  rmSync(resolve(dir, 'reports', 'a.md'));
  const slugs = safeListReports().map((r) => r.slug).sort();
  assert.deepEqual(slugs, ['b', 'c', 'd']);
  assert.equal(__reportCache.size, 3, 'the deleted report is evicted');
});
