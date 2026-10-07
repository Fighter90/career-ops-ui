/**
 * scripts/install-hooks.mjs (the npm `prepare` step) wires core.hooksPath
 * only in a checkout whose git top level IS this package — never in an
 * enclosing repository (web-ui dropped inside the parent career-ops clone
 * without its own .git). Exercised on throwaway repos under tmpdir; this
 * checkout's git config is never touched.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'install-hooks.mjs');
let tmp;
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const hooksPath = (cwd) => { try { return git(cwd, 'config', '--local', '--get', 'core.hooksPath'); } catch { return ''; } };
// Clean env: no GIT_DIR / GIT_WORK_TREE inherited from a hook that runs the suite.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
const run = (pkgDir) => execFileSync(process.execPath, [join(pkgDir, 'scripts', 'install-hooks.mjs')], { cwd: pkgDir, env, encoding: 'utf8' });

function pkgAt(dir) {
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  copyFileSync(SRC, join(dir, 'scripts', 'install-hooks.mjs'));
  return dir;
}

before(() => { tmp = realpathSync(mkdtempSync(join(tmpdir(), 'ci-install-hooks-'))); });
after(() => { rmSync(tmp, { recursive: true, force: true }); });

test('own checkout: core.hooksPath is set to .githooks', () => {
  const dir = pkgAt(join(tmp, 'own'));
  git(dir, 'init', '-q');
  const out = run(dir);
  assert.equal(hooksPath(dir), '.githooks');
  assert.match(out, /core\.hooksPath/);
});

test('nested in a parent repo without its own .git: parent config untouched', () => {
  const parent = join(tmp, 'parent');
  mkdirSync(parent, { recursive: true });
  git(parent, 'init', '-q');
  const dir = pkgAt(join(parent, 'web-ui'));
  const out = run(dir);
  assert.equal(hooksPath(parent), '', 'must not rewrite the enclosing repo hooksPath');
  assert.doesNotMatch(out, /core\.hooksPath →/);
});

test('outside any git repo: silent no-op', () => {
  const dir = pkgAt(join(tmp, 'nogit'));
  const out = execFileSync(process.execPath, [join(dir, 'scripts', 'install-hooks.mjs')], {
    cwd: dir, env: { ...env, GIT_CEILING_DIRECTORIES: tmp }, encoding: 'utf8',
  });
  assert.equal(out, '');
});

test('shouldWire compares the git top level with the package root', async () => {
  const { shouldWire } = await import(SRC);
  assert.equal(shouldWire('/a/web-ui', '/a/web-ui'), true);
  assert.equal(shouldWire('/a', '/a/web-ui'), false);
  assert.equal(shouldWire('', '/a/web-ui'), false);
});
