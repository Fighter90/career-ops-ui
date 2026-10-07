/**
 * `career-ops-ui init` (scripts/init.mjs): a flag-driven run that only adds
 * a key must not reset the user's LLM_PROVIDER, and the .env it writes —
 * which holds API keys — is owner-only. Runs the CLI against a throwaway
 * CAREER_OPS_ROOT; never the real parent.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, statSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'init.mjs');
let root;
let mod;
const runInit = (...args) => execFileSync(process.execPath, [SCRIPT, ...args], {
  env: { ...process.env, CAREER_OPS_ROOT: root }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
});

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'ci-init-'));
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  mod = await import(SCRIPT);
});
after(() => { rmSync(root, { recursive: true, force: true }); });

test('updatesForRun leaves LLM_PROVIDER alone when no provider was chosen', () => {
  assert.deepEqual(mod.updatesForRun({ provider: '', gemini: ' g ' }), { GEMINI_API_KEY: 'g' });
  assert.deepEqual(mod.updatesForRun({ provider: 'claude', anthropic: 'a' }), { LLM_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'a' });
  assert.deepEqual(mod.updatesForRun({ provider: 'bogus' }), { LLM_PROVIDER: 'auto' }); // explicit but invalid → clamped
});

test('init --gemini-key --yes keeps an existing LLM_PROVIDER and writes .env 0600', () => {
  const envFile = join(root, '.env');
  writeFileSync(envFile, 'LLM_PROVIDER=claude\nOTHER=1\n');
  chmodSync(envFile, 0o644);
  const out = runInit('--gemini-key', 'gk-test', '--yes');
  const text = readFileSync(envFile, 'utf8');
  assert.match(text, /^LLM_PROVIDER=claude$/m);
  assert.match(text, /^GEMINI_API_KEY=gk-test$/m);
  assert.match(text, /^OTHER=1$/m);
  assert.match(out, /keys: GEMINI_API_KEY/);
  if (process.platform !== 'win32') assert.equal(statSync(envFile).mode & 0o777, 0o600);
});

test('init --provider gemini --yes sets the provider explicitly', () => {
  runInit('--provider', 'gemini', '--yes');
  assert.match(readFileSync(join(root, '.env'), 'utf8'), /^LLM_PROVIDER=gemini$/m);
});
