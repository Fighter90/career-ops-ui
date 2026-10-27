/**
 * FULL-R1 (finding 2, part 3) — atomicWrite: temp-then-rename for the
 * shared data files. A plain `writeFileSync(target)` opens the target
 * with 'w' (truncating it) and only then writes, so a crash mid-write
 * (OOM kill, ENOSPC, any throw) leaves a TRUNCATED file — on
 * pipeline.md that means the next timer tick reads an empty fence.
 * Every shared-file writer must go through atomicWrite: write a
 * same-directory temp (same filesystem ⇒ rename stays atomic), rename
 * into place, unlink the temp on any failure so the original survives
 * byte-for-byte.
 *
 * The helper itself is tested behaviorally. A source-static gate pins
 * the pipeline.md call-sites: a regression back to a bare
 * writeFileSync(target) is not observable in a behavioral test without
 * deterministically crashing the process mid-write, so the call-site
 * contract is enforced statically (same trade-off as the ACTING_GET
 * coverage gate).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { atomicWrite } from '../server/lib/file-lock.mjs';

const ROOT = resolve(import.meta.dirname, '..');

test('atomicWrite replaces content and leaves no temp litter', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fullr1-atomic-'));
  const file = join(dir, 'pipeline.md');
  writeFileSync(file, 'old content\n');
  atomicWrite(file, 'new content\n');
  assert.equal(readFileSync(file, 'utf8'), 'new content\n');
  assert.deepEqual(readdirSync(dir).sort(), ['pipeline.md'], 'no *.tmp files may be left behind');
});

test('atomicWrite creates a missing file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fullr1-atomic-'));
  const file = join(dir, 'fresh.md');
  atomicWrite(file, 'x');
  assert.equal(readFileSync(file, 'utf8'), 'x');
  assert.deepEqual(readdirSync(dir), ['fresh.md']);
});

test('atomicWrite keeps the original intact when the write throws', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fullr1-atomic-'));
  const file = join(dir, 'pipeline.md');
  writeFileSync(file, 'precious original\n');
  // A non-string/non-buffer payload throws inside writeFileSync — the
  // deterministic stand-in for a crash mid-write. The OLD inline pattern
  // (writeFileSync(target)) truncates the target before throwing; the
  // helper must leave the original untouched AND clean up its temp.
  assert.throws(() => atomicWrite(file, /** @type {any} */ ({ nope: true })));
  assert.equal(readFileSync(file, 'utf8'), 'precious original\n');
  assert.deepEqual(readdirSync(dir), ['pipeline.md'], 'failed temp must be unlinked');
});

test('static gate — every pipeline.md writer goes through atomicWrite', () => {
  const writers = [
    'server/lib/routes/pipeline.mjs',
    'server/lib/routes/auto-pipeline.mjs',
    'server/lib/en-scanner.mjs',
    'server/lib/ru-scanner.mjs',
  ];
  for (const rel of writers) {
    const src = readFileSync(resolve(ROOT, rel), 'utf8');
    assert.ok(
      src.includes('atomicWrite'),
      `${rel} must call atomicWrite for its pipeline.md write (FULL-R1 part 3)`,
    );
    assert.ok(
      !/writeFileSync\(\s*PATHS\.pipeline\b/.test(src),
      `${rel} still writes pipeline.md with a bare writeFileSync — a mid-write crash truncates the file (FULL-R1 part 3)`,
    );
  }
});
