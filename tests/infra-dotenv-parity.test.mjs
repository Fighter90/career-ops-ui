/**
 * v1.241.0 review hardening — .env read/write parity with the parent's dotenv.
 *
 * The web-ui reads and writes the SAME .env the parent CLI reads through the
 * npm `dotenv` package, so both must agree on what a line means:
 *  - `KEY=value   # comment` — dotenv strips the comment; we kept it, so a key
 *    annotated in .env became `sk-…   # prod` and every call 401'd.
 *  - `export KEY=value` — accepted by dotenv, skipped by us.
 *  - quoteIfNeeded wrote `"a\"b"`; dotenv does not unescape `\"`, so the parent
 *    read `a\"b`. The writer now picks a quote character the value lacks.
 * Expected values below are what dotenv 18 returns for the same text.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let dotenv;
let envConfig;
before(async () => {
  dotenv = await import('../server/lib/dotenv.mjs');
  envConfig = await import('../server/lib/env-config.mjs');
});

const DOTENV_CASES = [
  ['A=abc   # trailing comment', 'A', 'abc'],
  ['A=abc#def', 'A', 'abc'],
  ['A="a#b" # c', 'A', 'a#b'],
  ["A='x y' # c", 'A', 'x y'],
  ['A=`tick`', 'A', 'tick'],
  ['export A=1', 'A', '1'],
  ['export   A = spaced ', 'A', 'spaced'],
  ['A="a\\"b"', 'A', 'a\\"b'],          // dotenv keeps the backslash
  ['A="line\\nbreak"', 'A', 'line\nbreak'], // and expands \n in double quotes only
  ["A='line\\nbreak'", 'A', 'line\\nbreak'],
  ['A="unclosed', 'A', '"unclosed'],
  ['A=', 'A', ''],
  ['A=""', 'A', ''],
];

test('parseEnvLine matches dotenv for comments, export, quotes', () => {
  for (const [line, key, value] of DOTENV_CASES) {
    assert.deepEqual(dotenv.parseEnvLine(line), { key, value }, line);
  }
  assert.equal(dotenv.parseEnvLine('# just a comment'), null);
  assert.equal(dotenv.parseEnvLine('   '), null);
  assert.equal(dotenv.parseEnvLine('NO_EQUALS'), null);
  assert.equal(dotenv.parseEnvLine('=x'), null);
  assert.equal(dotenv.parseEnvLine('export =x'), null);
});

test('parseEnv and loadEnvFile use the same rules', () => {
  const text = DOTENV_CASES.map(([l]) => l.replace(/^(export\s+)?A/, (m, e) => `${e || ''}K${DOTENV_CASES.findIndex(([x]) => x === l)}`)).join('\n');
  const parsed = envConfig.parseEnv(text);
  DOTENV_CASES.forEach(([, , value], i) => assert.equal(parsed[`K${i}`], value, `K${i}`));

  const dir = mkdtempSync(join(tmpdir(), 'infra-dotenv-'));
  const file = join(dir, '.env');
  const key = `INFRA_DOTENV_${Date.now()}`;
  writeFileSync(file, `export ${key}=sk-live-123   # prod key\n`);
  delete process.env[key];
  try {
    assert.equal(dotenv.loadEnvFile(file).loaded, 1);
    assert.equal(process.env[key], 'sk-live-123');
  } finally { delete process.env[key]; }
});

test('updateEnvFile round-trips awkward values through parseEnv', () => {
  const dir = mkdtempSync(join(tmpdir(), 'infra-dotenv-rt-'));
  const file = join(dir, '.env');
  const values = {
    V1: 'has "double" quotes',
    V2: "it's single",
    V3: 'both " and \' here',
    V4: 'hash#inside',
    V5: 'C:\\new\\path',
    V6: 'plain',
    V7: 'trailing # comment-like',
    V8: '$dollar',
  };
  envConfig.updateEnvFile(file, values);
  const back = envConfig.parseEnv(readFileSync(file, 'utf8'));
  for (const [k, v] of Object.entries(values)) assert.equal(back[k], v, k);
  assert.match(readFileSync(file, 'utf8'), /^V6=plain$/m);
});

test('a value holding all three quote characters is refused (cannot round-trip)', () => {
  const r = envConfig.validateConfig({ HERMES_MODEL: 'a"b\'c`d' });
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /HERMES_MODEL/);
  const dir = mkdtempSync(join(tmpdir(), 'infra-dotenv-q-'));
  assert.throws(() => envConfig.updateEnvFile(join(dir, '.env'), { X: 'a"b\'c`d' }), /quote/);
});

test('updateEnvFile rewrites an `export KEY=` line in place (no duplicate)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'infra-dotenv-exp-'));
  const file = join(dir, '.env');
  writeFileSync(file, '# keys\nexport ANTHROPIC_MODEL=old\nexport HOST=127.0.0.1\n');
  envConfig.updateEnvFile(file, { ANTHROPIC_MODEL: 'new', HOST: '' });
  const text = readFileSync(file, 'utf8');
  assert.equal(text, '# keys\nexport ANTHROPIC_MODEL=new\n');
});

test('updateEnvFile writes .env owner-only (0600), new or existing', { skip: process.platform === 'win32' }, async () => {
  const { statSync, chmodSync } = await import('node:fs');
  const dir = mkdtempSync(join(tmpdir(), 'infra-dotenv-mode-'));
  const fresh = join(dir, 'fresh.env');
  envConfig.updateEnvFile(fresh, { ANTHROPIC_MODEL: 'm' });
  assert.equal(statSync(fresh).mode & 0o777, 0o600);
  const existing = join(dir, 'existing.env');
  writeFileSync(existing, 'HOST=127.0.0.1\n');
  chmodSync(existing, 0o644);
  envConfig.updateEnvFile(existing, { PORT: '4317' });
  assert.equal(statSync(existing).mode & 0o777, 0o600);
});
