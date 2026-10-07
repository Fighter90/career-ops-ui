/**
 * scripts/coverage-report.mjs — parser + threshold logic, against a small
 * fixture table. No test run happens here: the functions under test are
 * pure (text in, data out), so the fixture is the whole input.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCoverageTable, scopeRows, summarize, evaluate, parseArgs, baselineFrom, testArgsFromScript,
} from '../scripts/coverage-report.mjs';

// Shape of `node --test --experimental-test-coverage` TAP output: directories
// are rows with empty columns, depth is one space per level after "# ".
const TAP = [
  'ok 1 - something',
  '# start of coverage report',
  '# ---------------------------------------------------------------',
  '# file                 | line % | branch % | funcs % | uncovered lines',
  '# ---------------------------------------------------------------',
  '# public               |        |          |         | ',
  '#  js                  |        |          |         | ',
  '#   lib                |        |          |         | ',
  '#    api.js            |  50.00 |    40.00 |   25.00 | 3-9',
  '#   router.js          | 100.00 |   100.00 |  100.00 | ',
  '# server               |        |          |         | ',
  '#  index.mjs           |  90.00 |    80.00 |  100.00 | 12',
  '#  lib                 |        |          |         | ',
  '#   paths.mjs          |  70.00 |    60.00 |  100.00 | 30-38',
  '#   sources            |        |          |         | ',
  '#    ashby.mjs         |  98.00 |    92.00 |  100.00 | 5',
  '# tests                |        |          |         | ',
  '#  a.test.mjs          | 100.00 |   100.00 |  100.00 | ',
  '# ---------------------------------------------------------------',
  '# all files            |  84.00 |    78.00 |   88.00 | ',
  '# ---------------------------------------------------------------',
  '# end of coverage report',
].join('\n');

test('parseCoverageTable rebuilds nested paths from indentation', () => {
  const { rows, all } = parseCoverageTable(TAP);
  assert.deepEqual(rows.map((r) => r.file), [
    'public/js/lib/api.js',
    'public/js/router.js',
    'server/index.mjs',
    'server/lib/paths.mjs',
    'server/lib/sources/ashby.mjs',
    'tests/a.test.mjs',
  ]);
  assert.deepEqual(rows[0], { file: 'public/js/lib/api.js', line: 50, branch: 40, funcs: 25 });
  assert.deepEqual(all, { line: 84, branch: 78, funcs: 88 });
});

test('parseCoverageTable accepts the spec reporter prefix and ignores text outside the table', () => {
  const spec = TAP.split('\n').map((l) => l.replace(/^# /, 'ℹ ')).join('\n');
  assert.deepEqual(parseCoverageTable(spec), parseCoverageTable(TAP));
  assert.throws(() => parseCoverageTable('ok 1 - no table here'), /no coverage table/);
});

test('scopeRows keeps only server/ and public/', () => {
  const files = scopeRows(parseCoverageTable(TAP).rows).map((r) => r.file);
  assert.ok(!files.some((f) => f.startsWith('tests/')));
  assert.equal(files.length, 5);
});

test('summarize: per-directory means (unweighted) and overall mean', () => {
  const s = summarize(scopeRows(parseCoverageTable(TAP).rows));
  assert.deepEqual(s.dirs.get('server/lib'), { files: 1, line: 70, branch: 60, funcs: 100 });
  assert.deepEqual(s.dirs.get('public/js'), { files: 1, line: 100, branch: 100, funcs: 100 });
  assert.equal(s.mean.line, (50 + 100 + 90 + 70 + 98) / 5);
  assert.equal(s.mean.branch, (40 + 100 + 80 + 60 + 92) / 5);
});

test('evaluate: below-threshold files are listed; exempt ones do not fail the gate', () => {
  const rows = scopeRows(parseCoverageTable(TAP).rows);
  const r1 = evaluate(rows, { line: 60, branch: 50, exempt: [] });
  assert.deepEqual(r1.below.map((b) => b.file), ['public/js/lib/api.js']);
  assert.deepEqual(r1.failing.map((b) => b.file), ['public/js/lib/api.js']);
  assert.equal(r1.meanOk, true);
  assert.equal(r1.ok, false, 'one non-exempt file under the bar fails the gate');

  const r2 = evaluate(rows, { line: 60, branch: 50, exempt: ['public/js/lib/api.js'] });
  assert.deepEqual(r2.below.map((b) => b.file), ['public/js/lib/api.js'], 'still reported');
  assert.deepEqual(r2.failing, [], 'but exempt');
  assert.equal(r2.ok, true);

  // The mean itself is gated too, exemptions or not.
  const r3 = evaluate(rows, { line: 90, branch: 0, exempt: rows.map((r) => r.file) });
  assert.equal(r3.meanOk, false);
  assert.equal(r3.ok, false);
});

test('baselineFrom rounds the means DOWN and grandfathers files under them', () => {
  const rows = scopeRows(parseCoverageTable(TAP).rows);
  const b = baselineFrom(rows);
  assert.equal(b.line, Math.floor((50 + 100 + 90 + 70 + 98) / 5)); // 81
  assert.equal(b.branch, Math.floor((40 + 100 + 80 + 60 + 92) / 5)); // 74
  assert.deepEqual(b.exempt, ['public/js/lib/api.js', 'server/lib/paths.mjs']);
  // A fresh baseline passes against the run it was measured from.
  assert.equal(evaluate(rows, b).ok, true);
});

test('parseArgs: flags override, unknown flags throw', () => {
  assert.deepEqual(parseArgs([]), {});
  assert.deepEqual(parseArgs(['--line', '85', '--branch=70', '--from', 'x.txt', '--write-baseline']),
    { line: 85, branch: 70, from: 'x.txt', writeBaseline: true });
  assert.throws(() => parseArgs(['--nope']), /unknown flag/);
  assert.throws(() => parseArgs(['--line', 'abc']), /--line/);
});

test('testArgsFromScript takes the file set from the test:coverage script', () => {
  assert.deepEqual(
    testArgsFromScript('node --test --experimental-test-coverage tests/*.test.mjs tests/acceptance/*.test.mjs'),
    ['tests/*.test.mjs', 'tests/acceptance/*.test.mjs'],
  );
  assert.throws(() => testArgsFromScript('jest'), /--experimental-test-coverage/);
});

test('CLI --from: prints the report and exits 1 only when the gate fails', async () => {
  // Parses a saved transcript — no test run is spawned.
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const fixture = join(mkdtempSync(join(tmpdir(), 't-cov-')), 'cov.txt');
  writeFileSync(fixture, TAP);
  const script = new URL('../scripts/coverage-report.mjs', import.meta.url).pathname;
  const run = (...flags) => spawnSync(process.execPath, [script, '--from', fixture, ...flags], { encoding: 'utf8' });

  const fail = run('--line', '60', '--branch', '50');
  assert.equal(fail.status, 1, fail.stdout + fail.stderr);
  assert.match(fail.stdout, /Per directory/);
  assert.match(fail.stdout, /server\/lib\/sources\/ashby\.mjs/);
  assert.match(fail.stdout, /FAIL\s+public\/js\/lib\/api\.js/);
  assert.doesNotMatch(fail.stdout, /tests\/a\.test\.mjs/, 'test files are out of scope');

  const pass = run('--line', '0', '--branch', '0');
  assert.equal(pass.status, 0, pass.stdout + pass.stderr);

  const bad = run('--bogus');
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown flag/);
});
