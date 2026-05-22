/**
 * v1.55.3 — UX-2 (HIGH): on-screen onboarding for the 4-provider OR
 * contract. A cold-start user with 0 LLM keys gets ⚡ Run-live in
 * manual-prompt mode with no explanation; the OR-promise (one of
 * Anthropic|Gemini|OpenAI|Qwen, auto-ordered) is the headline
 * differentiator and must be discoverable, not learned by trial.
 *
 * Server contract: GET /api/status/providers →
 *   { activeProvider: 'anthropic'|'gemini'|'openai'|'qwen'|null,
 *     activeModel: string|null,
 *     keysConfigured: string[] }
 * Selection walks providerOrder() (honors LLM_PROVIDER pin) and
 * returns the first provider whose key is set, or null.
 *
 * Integration tests hit createApp() in-process on an ephemeral port
 * (project convention — never hardcode 4317). The SPA banner is
 * browser-only → asserted statically (router.test.mjs style).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { selectActiveProvider } from '../server/lib/env-config.mjs';

// CI ISOLATION (CLAUDE.md rules #2 + #8): effectiveEnv() resolves keys
// as process.env ∨ <PROJECT_ROOT>/.env. The real parent career-ops
// .env may hold a live GEMINI/ANTHROPIC key — a test must never read
// it. Point CAREER_OPS_ROOT at a temp dir BEFORE any server import so
// paths.mjs freezes PROJECT_ROOT to it; the 4 provider keys are also
// stripped from process.env so only the controlled .env counts.
const ENV_DIR = mkdtempSync(resolve(tmpdir(), 'onb-prov-'));
mkdirSync(resolve(ENV_DIR, 'config'), { recursive: true });
mkdirSync(resolve(ENV_DIR, 'data'), { recursive: true });
writeFileSync(resolve(ENV_DIR, 'cv.md'), '# CV\n\nTest Person.\n');
writeFileSync(resolve(ENV_DIR, 'portals.yml'), 'tracked_companies: []\n');
process.env.CAREER_OPS_ROOT = ENV_DIR;
const PROVIDER_KEYS = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY'];
const savedKeys = {};
for (const k of PROVIDER_KEYS) { savedKeys[k] = process.env[k]; delete process.env[k]; }
function writeEnv(lines) { writeFileSync(resolve(ENV_DIR, '.env'), lines.join('\n') + '\n'); }

const __d = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(resolve(__d, '..', 'public', 'js', 'app.js'), 'utf8');
const HTML = readFileSync(resolve(__d, '..', 'public', 'index.html'), 'utf8');
const DICT = legacyDictText();
const LOCALES = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr'];

// ── pure selection logic ────────────────────────────────────────────
test('selectActiveProvider: auto order → first configured wins', () => {
  assert.equal(selectActiveProvider(['gemini', 'openai'], {}), 'gemini');
  assert.equal(selectActiveProvider(['openai'], {}), 'openai');
  assert.equal(selectActiveProvider(['anthropic', 'qwen'], {}), 'anthropic');
});

test('selectActiveProvider: none configured → null', () => {
  assert.equal(selectActiveProvider([], {}), null);
});

test('selectActiveProvider: LLM_PROVIDER pin with no matching key → null', () => {
  // pinned to openai but only gemini key present → falls through
  assert.equal(selectActiveProvider(['gemini'], { LLM_PROVIDER: 'openai' }), null);
  // pinned to claude with anthropic key → anthropic
  assert.equal(selectActiveProvider(['anthropic', 'gemini'], { LLM_PROVIDER: 'claude' }), 'anthropic');
});

// ── /api/status/providers endpoint ──────────────────────────────────
async function withApp(fn) {
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  const server = await new Promise((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test('GET /api/status/providers — 0 keys → activeProvider null, empty list', async () => {
  writeEnv(['# no provider keys']);
  await withApp(async (base) => {
    const r = await fetch(`${base}/api/status/providers`);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.activeProvider, null);
    assert.deepEqual(j.keysConfigured, []);
    assert.equal(j.activeModel, null);
  });
});

test('GET /api/status/providers — one key set → that provider active + model', async () => {
  writeEnv(['OPENAI_API_KEY=sk-test-openai-key-value-1234567890',
    'OPENAI_MODEL=gpt-5-codex']);
  await withApp(async (base) => {
    const r = await fetch(`${base}/api/status/providers`);
    const j = await r.json();
    assert.equal(j.activeProvider, 'openai');
    assert.ok(j.keysConfigured.includes('openai'));
    assert.ok(!j.keysConfigured.includes('anthropic'));
    assert.equal(j.activeModel, 'gpt-5-codex');
  });
});

test('GET /api/status/providers — auto order prefers Anthropic over Gemini', async () => {
  writeEnv(['ANTHROPIC_API_KEY=sk-ant-test-aaaaaaaaaaaaaaaaaaaa',
    'GEMINI_API_KEY=AIzaTESTtesttesttesttesttesttesttest']);
  await withApp(async (base) => {
    const j = await (await fetch(`${base}/api/status/providers`)).json();
    assert.equal(j.activeProvider, 'anthropic');
    assert.deepEqual([...j.keysConfigured].sort(), ['anthropic', 'gemini']);
  });
});

test.after(() => {
  for (const [k, v] of Object.entries(savedKeys)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

// ── SPA wiring (static) ─────────────────────────────────────────────
test('index.html has the onboarding banner host element', () => {
  assert.match(HTML, /id="onboarding-banner"/,
    'a #onboarding-banner host must exist in the shell');
});

test('app.js fetches /api/status/providers and renders the banner/chip', () => {
  assert.match(APP, /\/api\/status\/providers/,
    'app.js must query the provider status endpoint');
  assert.match(APP, /onboarding-banner/,
    'app.js must populate the onboarding banner host');
  // 0-key path links to the API-keys config tab
  assert.match(APP, /#\/config\?tab=api-keys/,
    'no-key CTA must deep-link to the API-keys config tab');
});

test('onboarding.* i18n keys present in all 8 locales', () => {
  for (const key of ['onboarding.noKey.title', 'onboarding.noKey.cta', 'onboarding.activeProvider']) {
    const line = DICT.split('\n').find((l) => l.includes(`'${key}'`));
    assert.ok(line, `i18n key ${key} missing from i18n-dict.js`);
    for (const loc of LOCALES) {
      const tok = /-/.test(loc) ? `'${loc}':` : `${loc}:`;
      assert.ok(line.includes(tok), `${key} missing locale ${loc}`);
    }
  }
});
