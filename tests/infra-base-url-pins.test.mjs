/**
 * v1.241.0 review hardening — `*_BASE_URL` host pins.
 *
 * ZAI / MOONSHOT / ARK / ARK_CN / HERMES / OLLAMA base URLs are user-writable
 * (POST /api/config, or .env) and receive the provider key as a Bearer token.
 * They accepted any http(s) host, so the key could be pointed at anyone's
 * server. Vendor bases are now pinned to the vendor's domains (https); the
 * self-hosted gateways to loopback / private-network hosts. Enforced on write
 * (validateConfig) and again at call time for a hand-edited .env.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const KEYS = ['ZAI_BASE_URL', 'MOONSHOT_BASE_URL', 'ARK_BASE_URL', 'ARK_CN_BASE_URL', 'HERMES_BASE_URL', 'OLLAMA_BASE_URL',
  'ZAI_API_KEY', 'MOONSHOT_API_KEY', 'ARK_API_KEY', 'ARK_CN_API_KEY', 'HERMES_API_KEY', 'OLLAMA_API_KEY'];
const saved = {};
const savedRoot = process.env.CAREER_OPS_ROOT;
let ROOT;
let envFile;
let cfg;
let openai;

before(async () => {
  ROOT = mkdtempSync(join(tmpdir(), 'infra-baseurl-'));
  writeFileSync(join(ROOT, 'cv.md'), '# CV\n');
  envFile = join(ROOT, '.env');
  process.env.CAREER_OPS_ROOT = ROOT;
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  cfg = await import('../server/lib/env-config.mjs');
  openai = await import('../server/lib/openai.mjs');
});
beforeEach(() => { writeFileSync(envFile, ''); for (const k of KEYS) delete process.env[k]; });
after(() => {
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  if (savedRoot === undefined) delete process.env.CAREER_OPS_ROOT; else process.env.CAREER_OPS_ROOT = savedRoot;
  rmSync(ROOT, { recursive: true, force: true });
});

test('checkBaseUrl: vendor bases accept the official hosts (intl + CN), https only', () => {
  const ok = [
    ['ZAI_BASE_URL', 'https://api.z.ai/api/paas/v4'],
    ['ZAI_BASE_URL', 'https://open.bigmodel.cn/api/paas/v4'],
    ['MOONSHOT_BASE_URL', 'https://api.moonshot.cn/v1'],
    ['MOONSHOT_BASE_URL', 'https://api.moonshot.ai/v1/'],
    ['ARK_BASE_URL', 'https://ark.ap-southeast.bytepluses.com/api/v3'],
    ['ARK_CN_BASE_URL', 'https://ark.cn-beijing.volces.com/api/v3'],
    ['ZAI_BASE_URL', ''],
  ];
  for (const [k, v] of ok) assert.equal(cfg.checkBaseUrl(k, v), null, `${k}=${v}`);
  const bad = [
    ['ZAI_BASE_URL', 'https://evil.example/v4'],
    ['ZAI_BASE_URL', 'https://api.z.ai.evil.example/v4'],
    ['ZAI_BASE_URL', 'https://notz.ai/v4'],
    ['ZAI_BASE_URL', 'http://api.z.ai/v4'],
    ['MOONSHOT_BASE_URL', 'https://user:pw@api.moonshot.cn/v1'],
    ['ARK_CN_BASE_URL', 'not a url'],
  ];
  for (const [k, v] of bad) assert.match(cfg.checkBaseUrl(k, v) || '', /./, `${k}=${v} should be refused`);
  assert.equal(cfg.checkBaseUrl('OPENAI_MODEL', 'https://anything'), null); // no policy
});

test('checkBaseUrl: Hermes / Ollama must stay on this machine or the LAN', () => {
  for (const v of ['http://127.0.0.1:8642/v1', 'http://localhost:11434', 'http://[::1]:11434/v1',
    'http://192.168.1.20:11434', 'http://10.0.0.7/v1', 'http://100.101.1.2:11434', 'http://ollama:11434',
    'http://gpu-box.local:11434', 'http://host.docker.internal:11434', 'https://nas.home.arpa/v1', 'http://localhost.:1/v1']) {
    assert.equal(cfg.checkBaseUrl('OLLAMA_BASE_URL', v), null, v);
    assert.equal(cfg.checkBaseUrl('HERMES_BASE_URL', v), null, v);
  }
  for (const v of ['https://attacker.example/v1', 'http://93.184.216.34:11434', 'http://169.254.169.254/latest',
    'http://[fe80::1]/v1', 'file:///etc/passwd', 'http://[2001:db8::1]/v1']) {
    assert.match(cfg.checkBaseUrl('OLLAMA_BASE_URL', v) || '', /./, `${v} should be refused`);
  }
});

test('validateConfig refuses an off-policy base URL and accepts the official one', () => {
  const bad = cfg.validateConfig({ MOONSHOT_BASE_URL: 'https://collector.example/v1', HERMES_BASE_URL: 'https://attacker.example/v1' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.startsWith('MOONSHOT_BASE_URL:')));
  assert.ok(bad.errors.some((e) => e.startsWith('HERMES_BASE_URL:')));
  assert.equal(cfg.validateConfig({ MOONSHOT_BASE_URL: 'https://api.moonshot.cn/v1', OLLAMA_BASE_URL: 'http://localhost:11434' }).ok, true);
});

test('a hand-edited .env base URL off-policy never receives the key', async () => {
  const runners = [
    ['runZai', 'ZAI'], ['runKimi', 'MOONSHOT'], ['runArk', 'ARK'], ['runArkCn', 'ARK_CN'],
    ['runHermes', 'HERMES'], ['runOllama', 'OLLAMA'],
  ];
  for (const [fn, prefix] of runners) {
    writeFileSync(envFile, `${prefix}_BASE_URL=https://collector.example/v1\n${prefix}_API_KEY=secret-canary-key-000000001\n`);
    let called = false;
    const r = await openai[fn]('hi', { fetchImpl: async () => { called = true; return new Response('{}'); } });
    assert.equal(called, false, `${fn} must not dial the configured host`);
    assert.match(r.error, new RegExp(`${prefix}_BASE_URL`), fn);
    assert.doesNotMatch(r.error, /secret-canary/);
  }
});

test('an on-policy base URL is used as before', async () => {
  writeFileSync(envFile, 'ZAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4\nZAI_API_KEY=zai-canary-key-0000000001\nOLLAMA_BASE_URL=http://localhost:11434\n');
  const urls = [];
  const fetchImpl = async (url) => { urls.push(url); return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] })); };
  assert.equal((await openai.runZai('hi', { fetchImpl })).error, null);
  assert.equal((await openai.runOllama('hi', { fetchImpl })).error, null);
  assert.equal((await openai.runHermes('hi', { fetchImpl, apiKey: 'hermes-local-key' })).error, null);
  assert.deepEqual(urls, [
    'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    'http://localhost:11434/v1/chat/completions',
    'http://127.0.0.1:8642/v1/chat/completions',
  ]);
});
