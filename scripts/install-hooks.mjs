#!/usr/bin/env node
/**
 * WS7 — point git at the in-repo .githooks/ dir. Idempotent; run by
 * `npm install` via the `prepare` script. No-op outside a git repo
 * (e.g. when installed as a published package tarball), and no-op when
 * the enclosing repository is not this package's own — web-ui sitting
 * inside the parent career-ops clone without a .git of its own would
 * otherwise point the PARENT's hooks at a .githooks/ it does not have.
 */
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Wire only when git's top level is the package root itself. */
export function shouldWire(toplevel, pkgRoot) {
  return Boolean(toplevel) && resolve(toplevel) === resolve(pkgRoot);
}

function main() {
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: PKG_ROOT, stdio: 'pipe', encoding: 'utf8' }).trim();
    if (!shouldWire(realpathSync(top), realpathSync(PKG_ROOT))) return;
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: PKG_ROOT });
    console.log('✓ git core.hooksPath → .githooks (pre-commit AI review active)');
  } catch {
    // Not a git checkout (npm tarball / CI cache) — nothing to wire.
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
