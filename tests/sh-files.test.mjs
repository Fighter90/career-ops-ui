/**
 * WS9 (v1.53.0) — shell-surface test pyramid. The project ships 4
 * `bin/*.sh` scripts + a git hook that until now had ZERO coverage.
 * These assert: syntax (`bash -n`), shebang + exec bit, and the
 * behavioural contracts other workstreams depend on (the v1.40 help
 * heredoc, the v1.43 browser-raise delegation, the WS7 hook, the
 * CLAUDE.md #7 no-`--no-verify` rule). Only `career-ops-ui.sh
 * help|<bogus>` is executed — it has no side effects; setup/start/
 * run_all are asserted statically (running them would clone / install
 * / boot a server).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, mkdtempSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const __d = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__d, '..');
const R = (...p) => resolve(ROOT, ...p);
const read = (p) => readFileSync(R(p), 'utf8');

const SH = ['bin/career-ops-ui.sh', 'bin/start.sh', 'bin/setup.sh', 'bin/run_all.sh'];
const HOOK = '.githooks/pre-commit';

test('every shell script parses (bash -n) and the hook (sh -n)', () => {
  for (const f of SH) {
    execFileSync('bash', ['-n', R(f)]); // throws on syntax error
  }
  execFileSync('sh', ['-n', R(HOOK)]);
});

test('every shell file has the right shebang + is executable', () => {
  for (const f of SH) {
    assert.match(read(f), /^#!\/usr\/bin\/env bash\n/, `${f} shebang`);
    assert.ok(statSync(R(f)).mode & 0o111, `${f} not executable`);
  }
  assert.match(read(HOOK), /^#!\/bin\/sh\n/);
  assert.ok(statSync(R(HOOK)).mode & 0o111, 'pre-commit not executable');
});

test('career-ops-ui.sh: help exits 0, prints usage, no shell-source leak', () => {
  const out = execFileSync('bash', [R('bin/career-ops-ui.sh'), 'help'], { encoding: 'utf8' });
  assert.match(out, /career-ops-ui setup/);
  assert.match(out, /career-ops-ui open/);
  assert.match(out, /career-ops-ui help/);
  // v1.40.0 regression guard: the old sed-scrape leaked this line.
  assert.ok(!/set -euo pipefail/.test(out), 'help leaked shell source');
});

test('career-ops-ui.sh: unknown verb exits 2 with usage on stderr', () => {
  let code = 0, stderr = '';
  try {
    execFileSync('bash', [R('bin/career-ops-ui.sh'), 'definitely-not-a-verb'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { code = e.status; stderr = (e.stderr || '').toString(); }
  assert.equal(code, 2);
  assert.match(stderr, /unknown verb/);
  assert.match(stderr, /career-ops-ui setup/);
});

test('career-ops-ui.sh: usage is a heredoc (not the fragile sed-scrape)', () => {
  const s = read('bin/career-ops-ui.sh');
  assert.match(s, /usage\(\)\s*\{\s*\n\s*cat <<'USAGE'/);
  assert.ok(!/sed -n '2,1[12]p'/.test(s), 'old sed line-scrape must be gone');
  // exact case labels (substring — avoids regex-meta in `open|dash|focus`)
  for (const label of ['setup)', 'run|start)', 'doctor)', 'init)', 'open|dash|focus)', 'help|-h|--help)']) {
    assert.ok(s.includes(label), `dispatcher missing case ${label}`);
  }
});

test('career-ops-ui.sh + start.sh canonicalize SCRIPT_DIR through symlinks (npx/.bin)', () => {
  // Regression lock (v1.68.x): npm/npx expose the bins as symlinks under
  // node_modules/.bin/. The old `dirname "${BASH_SOURCE[0]}"` pointed at
  // `.bin`, so WEB_UI became node_modules and verbs ran
  // `node node_modules/scripts/init.mjs` → MODULE_NOT_FOUND. Both scripts
  // must follow the symlink chain so WEB_UI lands on the real package root.
  for (const f of ['bin/career-ops-ui.sh', 'bin/start.sh']) {
    const s = read(f);
    assert.match(s, /while \[ -h "\$SOURCE" \]; do/, `${f} missing symlink-resolution loop`);
    assert.match(s, /readlink "\$SOURCE"/, `${f} must readlink the source`);
    assert.match(s, /SCRIPT_DIR="\$\( cd -P/, `${f} must canonicalize SCRIPT_DIR with cd -P`);
  }
});

test('career-ops-ui.sh: a verb invoked through a .bin-style symlink resolves scripts/ (not node_modules/scripts)', () => {
  // Mimic the exact npm layout that broke `npx career-ops-ui init`:
  //   <tmp>/.bin/career-ops-ui -> <repo>/bin/career-ops-ui.sh
  // and run a read-only verb (doctor) that dereferences "$WEB_UI/scripts/*.mjs".
  // Pre-fix this threw `Cannot find module .../node_modules/scripts/doctor.mjs`.
  const dir = mkdtempSync(join(tmpdir(), 'co-ui-bin-'));
  try {
    const bin = join(dir, '.bin');
    mkdirSync(bin, { recursive: true });
    symlinkSync(R('bin/career-ops-ui.sh'), join(bin, 'career-ops-ui'));
    let out = '';
    try {
      out = execFileSync('bash', [join(bin, 'career-ops-ui'), 'doctor'], {
        encoding: 'utf8',
        timeout: 30_000,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, CAREER_OPS_ROOT: dir, NO_OPEN: '1' },
      });
    } catch (e) {
      // doctor exits 1 when required checks fail (mktemp parent has no cv.md) —
      // that's fine. We only assert the script was FOUND, not that it passed.
      out = `${e.stdout || ''}${e.stderr || ''}`;
    }
    assert.ok(!/Cannot find module/.test(out), `path-resolution regressed:\n${out}`);
    assert.ok(!/node_modules\/scripts\//.test(out), `WEB_UI resolved to node_modules:\n${out}`);
    assert.match(out, /career-ops-ui doctor/, `doctor.mjs did not run:\n${out}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('start.sh: NO_OPEN honored, Node>=18 gate, delegates raise to open-dashboard.mjs', () => {
  const s = read('bin/start.sh');
  assert.match(s, /set -euo pipefail/);
  assert.match(s, /NO_OPEN/);
  assert.match(s, /scripts\/open-dashboard\.mjs/);          // v1.43 delegation
  assert.ok(!/open "\$URL" 2>\/dev\/null/.test(s), 'bare `open $URL` must be gone');
  assert.match(s, /NODE_MAJOR.*-lt 18|Node\.js >= 18/);
});

test('setup.sh: strict mode, SKIP_START honored, clones both repos, needs git', () => {
  const s = read('bin/setup.sh');
  assert.match(s, /set -euo pipefail/);
  assert.match(s, /SKIP_START/);
  assert.match(s, /need git/);
  assert.match(s, /Fighter90\/career-ops\.git/);
  assert.match(s, /Fighter90\/career-ops-ui/);
});

test('run_all.sh: parses --quick / --no-e2e and runs every suite', () => {
  const s = read('bin/run_all.sh');
  assert.match(s, /--quick/);
  assert.match(s, /--no-e2e/);
  assert.match(s, /run_suite/);                       // the 4-suite wrapper
  assert.match(s, /run_suite "unit \+ integration"\s+npm test/);
  assert.match(s, /npm run test:e2e:browser/);
  assert.match(s, /npm run test:e2e\b/);
  assert.match(s, /npm run test:e2e:full/);
});

test('.githooks/pre-commit: execs the WS7 reviewer, forbids --no-verify', () => {
  const h = read(HOOK);
  assert.match(h, /scripts\/ai-precommit-review\.mjs/);
  assert.match(h, /--no-verify/);            // it documents the rule…
  assert.match(h, /Never bypass|hard rule #7/i);
  // …and no shell file actually invokes --no-verify.
  for (const f of [...SH, HOOK]) {
    assert.ok(!/git[^\n]*--no-verify/.test(read(f)), `${f} uses --no-verify`);
  }
});

test('install-hooks.mjs wires core.hooksPath and is the npm prepare step', () => {
  const ih = read('scripts/install-hooks.mjs');
  assert.match(ih, /'core\.hooksPath',\s*'\.githooks'/);
  assert.match(read('package.json'), /"prepare":\s*"node scripts\/install-hooks\.mjs"/);
});
