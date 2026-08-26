/**
 * v1.216.0 — provider-logo.js monogram coverage + CSP-safety.
 *
 * The tiles are decoration, but a MISSING slug means a provider with no logo,
 * so this gate ties the monogram map to LLM_PROVIDERS (the canonical roster) and
 * to the Settings API-key fields. provider-logo.js is a browser-only file, so —
 * like the provider-selector / live-provider-gating canaries — it is asserted by
 * reading the source, not by importing it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { LLM_PROVIDERS } from '../server/lib/env-config.mjs';

const R = (...p) => readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', ...p), 'utf8');
const SRC = R('public', 'js', 'lib', 'provider-logo.js');

// Slugs that need a tile = every dispatch provider (LLM_PROVIDERS minus the
// meta value 'auto'; 'claude' is an alias handled explicitly in MARKS).
const ROSTER = LLM_PROVIDERS.filter((p) => p !== 'auto');

test('MARKS covers every provider slug in LLM_PROVIDERS (+ the claude alias)', () => {
  for (const slug of ROSTER) {
    assert.match(SRC, new RegExp(`\\b${slug}:\\s*\\{\\s*bg:`), `MARKS missing tile for '${slug}'`);
  }
  assert.match(SRC, /\bclaude:\s*\{\s*bg:/, 'MARKS missing the claude→anthropic alias tile');
});

test('KEY_SLUG maps each provider API-key / enabler env var to a slug', () => {
  for (const key of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY',
    'OPENROUTER_API_KEY', 'GITHUB_MODELS_API_KEY', 'HERMES_API_KEY', 'DEEPSEEK_API_KEY',
    'ZAI_API_KEY', 'MOONSHOT_API_KEY', 'MINIMAX_API_KEY', 'MISTRAL_API_KEY', 'XAI_API_KEY',
    'TOGETHER_API_KEY', 'FIREWORKS_API_KEY', 'OLLAMA_BASE_URL']) {
    assert.match(SRC, new RegExp(`${key}:\\s*'`), `KEY_SLUG missing ${key}`);
  }
});

test('provider-logo.js is CSP-safe: DOM via createElementNS/textContent, no innerHTML, no remote assets', () => {
  // Strip comments so documentation prose ("no innerHTML") can't false-positive.
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/\.innerHTML\s*=/.test(code), 'must not assign innerHTML');
  assert.match(code, /createElementNS/, 'must build the SVG via createElementNS');
  assert.match(code, /\.textContent\s*=/, 'monogram text must be set via textContent');
  assert.ok(!/https?:\/\//.test(code.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')),
    'must not reference any remote host (only the SVG XML namespace is allowed)');
  assert.match(code, /window\.ProviderLogo\s*=/, 'must expose window.ProviderLogo');
});

test('index.html loads provider-logo.js after provider-status.js', () => {
  const html = R('public', 'index.html');
  const iStatus = html.indexOf('/js/lib/provider-status.js');
  const iLogo = html.indexOf('/js/lib/provider-logo.js');
  assert.ok(iStatus > 0 && iLogo > iStatus, 'provider-logo.js must load after provider-status.js');
});
