/**
 * FULL-M6 (CAR-165) — dotenv prototype-pollution guard.
 *
 * parseEnv built a plain `{}` and assigned every parsed key, so a .env line
 * `constructor=…` / `prototype=…` became an own property of the result and
 * `__proto__=…` was silently swallowed by the Object.prototype setter — the
 * same class of hole routes/content.mjs guards with its UNSAFE_KEY check.
 * loadEnvFile pushed those keys straight into process.env. The parse must
 * build a null-prototype object and refuse the three poisoned key names.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let dotenv;
let envConfig;

before(async () => {
  dotenv = await import('../server/lib/dotenv.mjs');
  envConfig = await import('../server/lib/env-config.mjs');
});

test('parseEnv builds a null-prototype object', () => {
  const out = envConfig.parseEnv('A=1\nB=2');
  assert.equal(Object.getPrototypeOf(out), null, 'parsed .env must not inherit Object.prototype');
  assert.equal(out.A, '1');
  assert.equal(out.B, '2');
});

test('parseEnv refuses __proto__ / constructor / prototype keys', () => {
  const out = envConfig.parseEnv('__proto__=x\nconstructor=y\nprototype=z\nA=1');
  for (const k of ['__proto__', 'constructor', 'prototype']) {
    assert.equal(Object.hasOwn(out, k), false, `${k} must not become an own key`);
    assert.equal(out[k], undefined, `${k} lookup must not resolve`);
  }
  assert.equal(out.A, '1', 'safe keys still parse');
});

test('loadEnvFile does not write poisoned keys into process.env', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dotenv-proto-'));
  const path = join(dir, '.env');
  writeFileSync(path, '__proto__=injected\nconstructor=also\nprototype=too\n');
  delete process.env.constructor;
  delete process.env.prototype;
  try {
    const r = dotenv.loadEnvFile(path);
    assert.equal(Object.hasOwn(process.env, 'constructor'), false);
    assert.equal(Object.hasOwn(process.env, 'prototype'), false);
    assert.equal(Object.hasOwn(process.env, '__proto__'), false);
    assert.equal(r.loaded, 0, 'no poisoned key counts as loaded');
  } finally {
    delete process.env.constructor;
    delete process.env.prototype;
    delete process.env.__proto__;
  }
});
