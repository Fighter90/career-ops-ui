/**
 * Market-report route (v1.94.0, Epic 25). CI-isolated. Verifies input bounding,
 * the prompt is built from the candidate's own CV/profile (so it knows the
 * target roles), the honesty label is present, and the manual/no-key path
 * returns a copy-paste prompt rather than a fabricated report.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server; let baseUrl;
let normalizeRegion; let normalizeCurrency; let buildMarketPrompt;

before(async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'market-'));
  mkdirSync(resolve(root, 'config'), { recursive: true });
  writeFileSync(resolve(root, 'cv.md'), '# Jane Dev\nSenior Backend Engineer, Go + Postgres.\n');
  writeFileSync(resolve(root, 'config', 'profile.yml'), 'summary:\n  target_roles:\n    - Senior Backend Engineer\n');
  writeFileSync(resolve(root, 'portals.yml'), 'tracked_companies: []\n');
  for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER']) delete process.env[k];
  process.env.CAREER_OPS_ROOT = root;
  ({ normalizeRegion, normalizeCurrency, buildMarketPrompt } = await import('../server/lib/routes/market.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

const post = (b) => fetch(`${baseUrl}/api/stats/market`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

test('normalizeRegion bounds + strips newlines', () => {
  assert.equal(normalizeRegion('  EU-remote \n'), 'EU-remote');
  assert.equal(normalizeRegion('x'.repeat(300)).length, 120);
  assert.equal(normalizeRegion(42), '');
});

test('normalizeCurrency whitelists to ISO codes, defaults USD', () => {
  assert.equal(normalizeCurrency('eur'), 'EUR');
  assert.equal(normalizeCurrency('RUB'), 'RUB');
  assert.equal(normalizeCurrency('BTC'), 'USD');
  assert.equal(normalizeCurrency(null), 'USD');
});

test('buildMarketPrompt carries region, currency, honesty label, and context', () => {
  const p = buildMarketPrompt('<project_context>CV…</project_context>', 'Germany', 'en', 'EUR');
  assert.match(p, /REGION \/ MARKET: Germany/);
  assert.match(p, /PRIMARY CURRENCY: report salary figures primarily in EUR/);
  assert.match(p, /DIRECTIONAL ESTIMATE/);
  assert.match(p, /<project_context>/);
});

test('POST /api/stats/market returns a manual prompt seeded from CV/profile (no key)', async () => {
  const r = await post({ region: 'Russia', currency: 'RUB' });
  assert.equal(r.status, 200);
  const { mode, prompt } = await r.json();
  assert.equal(mode, 'manual');
  assert.match(prompt, /Senior Backend Engineer/);   // target role pulled from profile/cv
  assert.match(prompt, /REGION \/ MARKET: Russia/);
  assert.match(prompt, /primarily in RUB/);
});
