/**
 * CAR-187 — MiniMax defaults follow the endpoint region.
 *
 * 'MiniMax-Text-01' is retired: the vendor's current defaults are
 * 'MiniMax-M3.1-Flash' on the international endpoint (api.minimax.io) and
 * 'MiniMax-M3' on the China endpoint (api.minimax.cn) — upstream #5531.
 * runMiniMax now resolves the base URL from MINIMAX_BASE_URL (hand-edited
 * .env / shell export; guarded by the env-config BASE_URL_POLICIES vendor
 * pin) and derives the default model from the resolved origin.
 * MINIMAX_MODEL always wins over the region default.
 *
 * CI-isolated: CAREER_OPS_ROOT → temp dir BEFORE import, cv.md +
 * portals.yml fixtures, fakeFetch everywhere — no network, no credits.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let runMiniMax;
let ROOT, ENV_FILE;
const savedRoot = process.env.CAREER_OPS_ROOT;

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'openai-minimax-'));
  ENV_FILE = resolve(ROOT, '.env');
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  process.env.CAREER_OPS_ROOT = ROOT;
  ({ runMiniMax } = await import('../server/lib/openai.mjs'));
});

after(() => {
  if (savedRoot === undefined) delete process.env.CAREER_OPS_ROOT;
  else process.env.CAREER_OPS_ROOT = savedRoot;
  try { rmSync(ROOT, { recursive: true, force: true }); } catch {}
});

function clearParentEnv() { if (existsSync(ENV_FILE)) rmSync(ENV_FILE); }

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  });
}
const okChat = (txt) => jsonResponse(200, {
  choices: [{ message: { role: 'assistant', content: txt } }],
  usage: { prompt_tokens: 1, completion_tokens: 1 },
});

/** Runs runMiniMax with a capturing fake fetch. Returns { r, sentUrl, sentModel }. */
async function capture(envLines, opts = {}) {
  clearParentEnv();
  if (envLines) writeFileSync(ENV_FILE, envLines);
  let sentUrl, sentModel, sentAuth;
  const fakeFetch = async (url, o) => {
    sentUrl = url; sentModel = JSON.parse(o.body).model; sentAuth = o.headers.Authorization;
    return okChat('ok');
  };
  try {
    const r = await runMiniMax('hi', {
      apiKey: 'minimax-canary-0000001', fetchImpl: fakeFetch, ...opts,
    });
    return { r, sentUrl, sentModel, sentAuth, called: sentUrl !== undefined };
  } finally {
    clearParentEnv();
  }
}

test('default base (no env, no opts) → api.minimax.io + MiniMax-M3.1-Flash', async () => {
  const { r, called, sentUrl, sentModel, sentAuth } = await capture(null);
  assert.equal(r.error, null, r.error);
  assert.ok(called, 'fetchImpl was never called');
  assert.equal(sentUrl, 'https://api.minimax.io/v1/chat/completions');
  assert.equal(sentModel, 'MiniMax-M3.1-Flash', 'the retired MiniMax-Text-01 must no longer be the default');
  assert.equal(sentAuth, 'Bearer minimax-canary-0000001');
});

test('MINIMAX_BASE_URL=api.minimax.cn → MiniMax-M3', async () => {
  const { r, sentUrl, sentModel } =
    await capture('MINIMAX_BASE_URL=https://api.minimax.cn/v1\n');
  assert.equal(r.error, null, r.error);
  assert.equal(sentUrl, 'https://api.minimax.cn/v1/chat/completions');
  assert.equal(sentModel, 'MiniMax-M3');
});

test('MINIMAX_BASE_URL bare-host CN form also resolves to MiniMax-M3', async () => {
  const { r, sentUrl, sentModel } =
    await capture('MINIMAX_BASE_URL=https://api.minimax.cn\n');
  assert.equal(r.error, null, r.error);
  assert.equal(sentUrl, 'https://api.minimax.cn/v1/chat/completions');
  assert.equal(sentModel, 'MiniMax-M3');
});

test('MINIMAX_BASE_URL=api.minimax.io (explicit intl) → MiniMax-M3.1-Flash', async () => {
  const { r, sentModel } =
    await capture('MINIMAX_BASE_URL=https://api.minimax.io/v1\n');
  assert.equal(r.error, null, r.error);
  assert.equal(sentModel, 'MiniMax-M3.1-Flash');
});

test('MINIMAX_MODEL in .env always wins over the region default', async () => {
  const { r, sentModel } = await capture(
    'MINIMAX_BASE_URL=https://api.minimax.cn/v1\nMINIMAX_MODEL=MiniMax-M2.7\n');
  assert.equal(r.error, null, r.error);
  assert.equal(sentModel, 'MiniMax-M2.7');
});

test('opts.model beats both the env and the region default', async () => {
  const { r, sentModel } = await capture(
    'MINIMAX_MODEL=MiniMax-M2.7\n', { model: 'custom-model' });
  assert.equal(r.error, null, r.error);
  assert.equal(sentModel, 'custom-model');
});

test('opts.url to the CN endpoint also drives the region default', async () => {
  const { r, sentUrl, sentModel } = await capture(null, {
    url: 'https://api.minimax.cn/v1/chat/completions',
  });
  assert.equal(r.error, null, r.error);
  assert.equal(sentUrl, 'https://api.minimax.cn/v1/chat/completions');
  assert.equal(sentModel, 'MiniMax-M3');
});

test('a non-vendor MINIMAX_BASE_URL is refused and the key is never sent there', async () => {
  const { r, called } = await capture('MINIMAX_BASE_URL=https://evil.example.test/v1\n');
  assert.match(String(r.error), /not an official endpoint/);
  assert.equal(called, false, 'the API key must never reach a non-vendor base');
});

test('a lookalike host (api.minimax.cn.evil.test) does not get the CN default — refused', async () => {
  const { r, called } = await capture('MINIMAX_BASE_URL=https://api.minimax.cn.evil.test/v1\n');
  assert.match(String(r.error), /not an official endpoint/);
  assert.equal(called, false);
});
