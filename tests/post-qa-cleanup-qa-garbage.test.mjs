/**
 * v1.248.2 — the QA-garbage sweep of scripts/post-qa-cleanup.mjs.
 *
 * The prod regression found the eval timer had filled the parent project
 * with: ZZ-QA-TEST tracker rows, example.com pipeline entries, and
 * reports/<date>-t-role-<ts>.md files whose text is the model's
 * "Insufficient JD" answer (no SCORE_SUMMARY → no valid score), with one
 * of them surfacing on the dashboard as "Last evaluation".
 *
 * Contract under test:
 *   - default run is a DRY-RUN: prints the plan, changes nothing;
 *   - --apply removes exactly the targets and first backs everything up
 *     (data/*.md.bak-<ts> copies; report files MOVED into
 *     qa/cleanup-backup-<ts>/, never deleted bypassing the backup);
 *   - a *-t-role-*.md report WITH a valid SCORE (0..5 via asciiNumber)
 *     survives, and so does any report without -t-role- in its name.
 *
 * Runs end-to-end via the CLI against a throwaway CAREER_OPS_ROOT —
 * never the real parent project.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'post-qa-cleanup.mjs');
let mod;

before(async () => { mod = await import(SCRIPT); });

const JUNK_REPORT = 'Insufficient JD information to evaluate.\n';
const VALID_REPORT = [
  '# Evaluation — QA',
  '---SCORE_SUMMARY---',
  'COMPANY: QA Corp',
  'ROLE: Tester',
  'ARCHETYPE: QA',
  'LEGITIMACY: Verified',
  'SCORE: 4,2/5', // decimal comma — valid through asciiNumber
  '---END_SUMMARY---',
  '',
].join('\n');

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'post-qa-garbage-'));
  mkdirSync(join(root, 'data'), { recursive: true });
  mkdirSync(join(root, 'reports'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '#'.repeat(4096));
  writeFileSync(join(root, 'data', 'pipeline.md'), [
    '# Pipeline',
    '- [ ] https://boards.greenhouse.io/acme/jobs/1 | Acme | SRE',
    '- [ ] https://example.com/qa-v167-t-role | QA | junk',
    '- [ ] http://192.168.0.7/job | Lab | Test',
    '',
  ].join('\n'));
  writeFileSync(join(root, 'data', 'applications.md'), [
    '| # | Date | Company | Role | Score | Status |',
    '|---|------|---------|------|-------|--------|',
    '| 1 | 2026-10-09 | Acme \\| Co | Engineer | 4.1/5 | Evaluated |',
    '| 2 | 2026-10-09 | ZZ-QA-TEST | QA fill | — | Evaluated |',
    '| 3 | 2026-10-09 | Real Co | SRE | 4.0/5 | Applied |',
    '',
  ].join('\n'));
  writeFileSync(join(root, 'reports', '2026-10-09-t-role-1760000000000.md'), JUNK_REPORT);
  writeFileSync(join(root, 'reports', '2026-10-09-t-role-1760000000001.md'), VALID_REPORT);
  // No -t-role- in the name: never a candidate, even without a score.
  writeFileSync(join(root, 'reports', '2026-10-08-acme-sre.md'), JUNK_REPORT);
  return root;
}

test('exports: the QA-garbage matchers and the SCORE gate behave', () => {
  assert.ok(mod.QA_TRACKER_ROW.test('| 2 | 2026-10-09 | ZZ-QA-TEST | QA |'), 'tracker row matcher');
  assert.ok(!mod.QA_TRACKER_ROW.test('| 3 | 2026-10-09 | Real Co | SRE |'), 'real rows untouched');
  assert.ok(mod.isExampleUrl('- [ ] https://example.com/qa-v167-t-role | QA'),
    'the example.com host is detected from the full pipeline line (production path)');
  assert.ok(!mod.isExampleUrl('https://boards.greenhouse.io/acme/jobs/1'));
  assert.ok(!mod.isExampleUrl('https://notexample.com.evil.io/x'), 'host must match strictly, not by substring');
  assert.ok(mod.T_ROLE_REPORT.test('2026-10-09-t-role-1760000000000.md'));
  assert.ok(!mod.T_ROLE_REPORT.test('2026-10-08-acme-sre.md'));
  assert.equal(mod.hasValidScore(VALID_REPORT), true, 'SCORE: 4,2/5 is a valid 0..5 score');
  assert.equal(mod.hasValidScore(JUNK_REPORT), false, 'no SCORE_SUMMARY — unscored');
  assert.equal(mod.hasValidScore(VALID_REPORT.replace('SCORE: 4,2/5', 'SCORE: 9,9/5')), false, 'out of range is not valid');
});

test('dry run reports the plan line by line and changes NOTHING', () => {
  const root = makeRoot();
  try {
    const pipelineBefore = readFileSync(join(root, 'data', 'pipeline.md'), 'utf8');
    const appsBefore = readFileSync(join(root, 'data', 'applications.md'), 'utf8');
    const out = execFileSync(process.execPath, [SCRIPT], { env: { ...process.env, CAREER_OPS_ROOT: root }, encoding: 'utf8' });

    assert.match(out, /Dry run/);
    assert.match(out, /2 dirty-URL line\(s\) would be removed/);        // example.com + 192.168.x
    assert.match(out, /- \[ \] https:\/\/example\.com\/qa-v167-t-role/); // per-line report
    assert.match(out, /2 test-row line\(s\) would be removed/);          // Acme \| Co + ZZ-QA-TEST
    assert.match(out, /\| 2 \|.*ZZ-QA-TEST/);                            // per-line report
    assert.match(out, /reports\/2026-10-09-t-role-1760000000000\.md — no valid SCORE/);
    assert.match(out, /would be moved/);

    // Nothing on disk moved or changed.
    assert.equal(readFileSync(join(root, 'data', 'pipeline.md'), 'utf8'), pipelineBefore);
    assert.equal(readFileSync(join(root, 'data', 'applications.md'), 'utf8'), appsBefore);
    assert.deepEqual(readdirSync(join(root, 'reports')).sort(),
      ['2026-10-08-acme-sre.md', '2026-10-09-t-role-1760000000000.md', '2026-10-09-t-role-1760000000001.md']);
    assert.ok(!existsSync(join(root, 'qa')), 'no backup dir in a dry run');
    assert.ok(readdirSync(join(root, 'data')).every((f) => !f.includes('.bak-')), 'no .bak files in a dry run');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('apply removes exactly the targets, backs up data files, MOVES junk reports', () => {
  const root = makeRoot();
  try {
    const out = execFileSync(process.execPath, [SCRIPT, '--apply'], { env: { ...process.env, CAREER_OPS_ROOT: root }, encoding: 'utf8' });

    // Pipeline: example.com + private-IP gone, the real URL stays.
    const pipeline = readFileSync(join(root, 'data', 'pipeline.md'), 'utf8');
    assert.ok(!mod.isExampleUrl(pipeline), 'no example.com URL remains in the pipeline');
    assert.ok(!pipeline.includes('192.168'));
    assert.ok(pipeline.includes('boards.greenhouse.io/acme/jobs/1'));

    // Tracker: both test rows gone, the real row stays.
    const apps = readFileSync(join(root, 'data', 'applications.md'), 'utf8');
    assert.ok(!apps.includes('ZZ-QA-TEST'));
    assert.ok(!apps.includes('Acme'));
    assert.ok(apps.includes('Real Co'));

    // Backups exist and hold the pre-clean content.
    const dataFiles = readdirSync(join(root, 'data'));
    const pipelineBak = dataFiles.find((f) => /^pipeline\.md\.bak-/.test(f));
    const appsBak = dataFiles.find((f) => /^applications\.md\.bak-/.test(f));
    assert.ok(pipelineBak, 'pipeline.md.bak-<ts> created');
    assert.ok(appsBak, 'applications.md.bak-<ts> created');
    const bakLines = readFileSync(join(root, 'data', pipelineBak), 'utf8').split('\n');
    assert.ok(bakLines.some((l) => mod.isExampleUrl(l)), 'pipeline backup holds the original (strict host check)');
    assert.ok(readFileSync(join(root, 'data', appsBak), 'utf8').includes('ZZ-QA-TEST'), 'tracker backup holds the original');

    // Reports: junk t-role MOVED into qa/cleanup-backup-<ts>/, valid one kept,
    // non-t-role report never touched.
    const reports = readdirSync(join(root, 'reports')).sort();
    assert.deepEqual(reports, ['2026-10-08-acme-sre.md', '2026-10-09-t-role-1760000000001.md']);
    const backupDirs = readdirSync(join(root, 'qa')).filter((d) => d.startsWith('cleanup-backup-'));
    assert.equal(backupDirs.length, 1, 'one qa/cleanup-backup-<ts>/ dir');
    const backupFiles = readdirSync(join(root, 'qa', backupDirs[0]));
    assert.deepEqual(backupFiles, ['2026-10-09-t-role-1760000000000.md']);
    assert.equal(readFileSync(join(root, 'qa', backupDirs[0], backupFiles[0]), 'utf8'), JUNK_REPORT, 'junk report preserved in the backup');
    assert.match(out, /moved to qa\/cleanup-backup-/);
    assert.match(out, /backup →/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('idempotent: a second run reports everything clean', () => {
  const root = makeRoot();
  try {
    execFileSync(process.execPath, [SCRIPT, '--apply'], { env: { ...process.env, CAREER_OPS_ROOT: root }, encoding: 'utf8' });
    const again = execFileSync(process.execPath, [SCRIPT], { env: { ...process.env, CAREER_OPS_ROOT: root }, encoding: 'utf8' });
    assert.match(again, /already clean/);
    assert.match(again, /no unscored \*-t-role-\*\.md reports/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── v1.248.3 — header-first SCORE (auto-pipeline strips the summary block,
// so a saved t-role report with a header score is a REAL posting) ──────────
test('v1.248.3: a t-role report with a header score but no summary SURVIVES', () => {
  assert.equal(mod.hasValidScore('# Senior Backend Engineer\n\n**Score:** 4.2/5\n\nBody.'), true);
});

test('v1.248.3: a t-role report with no score anywhere is still junk', () => {
  assert.equal(mod.hasValidScore('# T-role\n\nInsufficient data to evaluate.'), false);
});

test('v1.248.3: dry-run does not touch mtimes or the file count', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qa-mtime-'));
  const rep = join(dir, '2026-10-09-t-role-1.md');
  writeFileSync(rep, '# T-role\n\nInsufficient data.');
  const beforeM = (await import('node:fs')).statSync(rep).mtimeMs;
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, [SCRIPT, '--apply'], { env: { ...process.env, CAREER_OPS_ROOT: dir }, encoding: 'utf8' });
  const afterM = (await import('node:fs')).statSync(rep).mtimeMs;
  assert.equal(beforeM, afterM, 'mtime unchanged');
  assert.ok(existsSync(rep), 'junk without --apply context is untouched here');
});
