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

test('v1.224.0 — real brand logos (simple-icons, CC0) for the 11 providers that publish one; monogram fallback for the rest', () => {
  const WITH_LOGO = ['anthropic', 'claude', 'gemini', 'openai', 'qwen', 'openrouter', 'github', 'deepseek', 'kimi', 'minimax', 'mistral', 'ollama'];
  const NO_LOGO = ['hermes', 'zai', 'grok', 'together', 'fireworks', 'ark', 'arkcn'];
  const logos = (SRC.match(/var LOGOS = \{([\s\S]*?)\n {2}\};/) || [])[1] || '';
  assert.ok(logos.length > 200, 'LOGOS block not found');
  for (const slug of WITH_LOGO) {
    assert.match(logos, new RegExp(`\\b${slug}:\\s*["']`), `LOGOS missing a real path for '${slug}'`);
  }
  for (const slug of NO_LOGO) {
    assert.ok(!new RegExp(`\\b${slug}:\\s*["']`).test(logos), `'${slug}' has no public brand icon → stays a monogram, must not be in LOGOS`);
  }
  // el() renders the real logo through a <path> whose d is set via setAttribute (CSP-safe).
  assert.match(SRC, /createElementNS\(NS, 'path'\)/, 'el() must render the real logo via a <path>');
  assert.match(SRC, /var d = LOGOS\[slug\];/, 'el() must branch on LOGOS[slug]');
  assert.match(SRC, /path\.setAttribute\('d', d\)/, 'the logo path d must be set via setAttribute — no innerHTML');
  assert.match(SRC, /function hasLogo/, 'must expose hasLogo()');
});

test('index.html loads provider-logo.js after provider-status.js', () => {
  const html = R('public', 'index.html');
  const iStatus = html.indexOf('/js/lib/provider-status.js');
  const iLogo = html.indexOf('/js/lib/provider-logo.js');
  assert.ok(iStatus > 0 && iLogo > iStatus, 'provider-logo.js must load after provider-status.js');
});

test('v1.218.0 — active/result provider surfaces render a ProviderLogo tile', () => {
  for (const f of ['dashboard.js', 'config.js', 'evaluate.js']) {
    const src = R('public', 'js', 'views', f);
    assert.match(src, /window\.ProviderLogo(?:\s*&&\s*[^\n]*)?\.el\(/,
      `${f} must render the active/result provider's monogram via ProviderLogo.el`);
  }
  // v1.219.0 — the global onboarding banner (app.js) too.
  const app = R('public', 'js', 'app.js');
  assert.match(app, /window\.ProviderLogo(?:\s*&&\s*[^\n]*)?\.el\(/,
    'app.js onboarding banner must render the active provider monogram');
  assert.match(app, /window\.ProviderStatus\.label\(st\.activeProvider\)/,
    'app.js onboarding banner must resolve the name via ProviderStatus.label (not a stale 4-entry map)');
  assert.ok(!/PROVIDER_NAME\s*=\s*\{\s*anthropic:/.test(app),
    'app.js still has the stale 4-entry PROVIDER_NAME map');
});

test('v1.218.0 — no stale ≤5-entry provider NAME map or hardcoded "/ 7" in the chrome', () => {
  // The dashboard chip + config summary + eval result must resolve the friendly
  // name via the shared ProviderStatus.label (18 providers), not a local map
  // that silently mislabels the newer providers.
  for (const f of ['dashboard.js', 'config.js', 'evaluate.js']) {
    const src = R('public', 'js', 'views', f);
    assert.ok(!/const NAME = \{ anthropic: 'Anthropic', gemini: 'Gemini', openai: 'OpenAI', qwen: 'Qwen', openrouter: 'OpenRouter' \}/.test(src),
      `${f} still has the stale 5-entry provider NAME map`);
    assert.match(src, /ProviderStatus(?:\s*&&\s*window\.ProviderStatus)?\.label\(/,
      `${f} must resolve the provider name via ProviderStatus.label`);
  }
  // config summary denominator is derived (18), not the hardcoded "/ 7".
  const cfg = R('public', 'js', 'views', 'config.js');
  assert.ok(!/keysConfiguredPrefix[^\n]*'\s*\+\s*count\s*\+\s*' \/ 7'/.test(cfg),
    'config.js still hardcodes "/ 7" for the provider count');
  assert.ok(!/r\.mode === 'anthropic' \? 'Anthropic' : 'Gemini'/.test(R('public', 'js', 'views', 'evaluate.js')),
    'evaluate.js still mislabels every non-Anthropic provider as Gemini');
});
