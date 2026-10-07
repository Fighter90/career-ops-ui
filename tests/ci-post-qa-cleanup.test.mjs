/**
 * scripts/post-qa-cleanup.mjs — the two line filters it applies to the
 * parent's data files after a QA run, and the CLI end to end against a
 * throwaway CAREER_OPS_ROOT (never the real parent).
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'post-qa-cleanup.mjs');
let mod;
let root;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'ci-post-qa-'));
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  mod = await import(SCRIPT);
});
after(() => { rmSync(root, { recursive: true, force: true }); });

test('TRACKER_TEST_ROW matches the Sc9 "Acme | Co" row, escaped or not', () => {
  const re = mod.TRACKER_TEST_ROW;
  assert.ok(re.test('| 12 | 2026-07-01 | Acme \\| Co | Engineer | 4.1/5 | Applied |'), 'markdown-escaped pipe');
  assert.ok(re.test('| 12 | 2026-07-01 | Acme | Co | Engineer | 4.1/5 | Applied |'), 'raw pipe');
  assert.ok(!re.test('| 13 | 2026-07-01 | Acme Corp | Engineer | 4.1/5 | Applied |'));
  assert.ok(!re.test('| 14 | 2026-07-01 | Acme \\? | Co | x |'));
});

test('DIRTY_URL catches private / test hosts in URLs', () => {
  const re = mod.DIRTY_URL;
  for (const l of [
    '- [ ] http://10.0.0.5/job/1 | X | Y',
    '- [ ] http://10.12.3.4:8080/careers | X | Y',
    '- [ ] https://172.16.0.9/jobs | X | Y',
    '- [ ] https://172.31.255.1/jobs | X | Y',
    '- [ ] http://192.168.1.20/a | X | Y',
    '- [ ] http://169.254.169.254/latest/meta-data | X | Y',
    '- [ ] http://0.0.0.0:3000/x | X | Y',
    '- [ ] https://127.0.0.1.nip.io/job | X | Y',
    '- [ ] https://test-cloud-7.example/job | X | Y',
  ]) assert.ok(re.test(l), l);
});

test('DIRTY_URL leaves real lines that merely contain look-alike digits', () => {
  const re = mod.DIRTY_URL;
  for (const l of [
    '- [ ] https://boards.greenhouse.io/acme/jobs/110.0.0 | Acme | SRE',
    '- [ ] https://jobs.lever.co/x/1 | Node 10.0.0 runtime | Dev',
    '- [ ] https://acme.com/jobs/172.160.1.1-team | Acme | Dev',
    '- [ ] https://acme.com/r/2192.168.1.1 | Acme | Dev',
    '- [ ] https://172.32.0.1/jobs | public range | Dev',
    '- [ ] https://acme.com/careers?ref=snip.iox | Acme | Dev',
  ]) assert.ok(!re.test(l), l);
});

test('CLI dry run reports, --apply rewrites only the dirty lines', () => {
  mkdirSync(join(root, 'data'), { recursive: true });
  const pipeline = [
    '# Pipeline',
    '- [ ] https://boards.greenhouse.io/acme/jobs/1 | Acme | SRE',
    '- [ ] http://192.168.0.7/job | Lab | Test',
    '- [ ] https://jobs.lever.co/x/1 | Node 10.0.0 runtime | Dev',
  ].join('\n');
  const apps = [
    '| # | Date | Company |',
    '| 1 | 2026-07-01 | Acme \\| Co |',
    '| 2 | 2026-07-01 | Real Co |',
  ].join('\n');
  writeFileSync(join(root, 'data/pipeline.md'), pipeline);
  writeFileSync(join(root, 'data/applications.md'), apps);
  const env = { ...process.env, CAREER_OPS_ROOT: root };

  const dry = execFileSync(process.execPath, [SCRIPT], { env, encoding: 'utf8' });
  assert.match(dry, /1 dirty-URL line\(s\) would be removed/);
  assert.match(dry, /1 test-row line\(s\) would be removed/);
  assert.match(dry, /only \d+ bytes/); // tiny cv.md is flagged
  assert.equal(readFileSync(join(root, 'data/pipeline.md'), 'utf8'), pipeline, 'dry run must not write');

  execFileSync(process.execPath, [SCRIPT, '--apply'], { env, encoding: 'utf8' });
  const p = readFileSync(join(root, 'data/pipeline.md'), 'utf8');
  assert.ok(!p.includes('192.168'));
  assert.ok(p.includes('Node 10.0.0 runtime'), 'a version number is not a private IP');
  const a = readFileSync(join(root, 'data/applications.md'), 'utf8');
  assert.ok(!a.includes('Acme'));
  assert.ok(a.includes('Real Co'));

  const again = execFileSync(process.execPath, [SCRIPT], { env, encoding: 'utf8' });
  assert.match(again, /already clean/);
});

test('CLI skips missing files and a healthy cv.md', () => {
  const empty = mkdtempSync(join(tmpdir(), 'ci-post-qa-empty-'));
  try {
    writeFileSync(join(empty, 'cv.md'), '#'.repeat(4096));
    const out = execFileSync(process.execPath, [SCRIPT], { env: { ...process.env, CAREER_OPS_ROOT: empty }, encoding: 'utf8' });
    assert.match(out, /looks fine/);
    assert.match(out, /skip <career-ops>\/data\/pipeline\.md — not present/);
  } finally { rmSync(empty, { recursive: true, force: true }); }
});
