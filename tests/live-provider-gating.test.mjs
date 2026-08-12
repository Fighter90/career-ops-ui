/**
 * v1.157.0 — live-eval availability must reflect the SERVER's active provider
 * (any of the 7: Anthropic / Gemini / OpenAI / Qwen / OpenRouter / GitHub Models
 * / Hermes), NOT a stale `/api/health` probe of only ANTHROPIC_API_KEY /
 * GEMINI_API_KEY. Regression guard for the user-reported bug where a user whose
 * only key was OPENROUTER_API_KEY was wrongly forced into manual mode on
 * #/deep and the mode-page views.
 *
 * Source-static (browser-only files → asserted by reading the source, like the
 * config-tabs-aria / provider-selector canaries).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const R = (...p) => readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', ...p), 'utf8');

test('provider-status.js reads /api/status/providers and labels all 7 providers', () => {
  const src = R('public', 'js', 'lib', 'provider-status.js');
  assert.match(src, /\/api\/status\/providers/, 'must query /api/status/providers');
  assert.match(src, /window\.ProviderStatus\s*=/, 'must expose window.ProviderStatus');
  for (const p of ['anthropic', 'gemini', 'openai', 'qwen', 'openrouter', 'github', 'hermes']) {
    assert.match(src, new RegExp(`${p}:\\s*'`), `LABELS missing ${p}`);
  }
});

test('deep.js + mode-page.js gate live-eval on ProviderStatus, not a 2-provider health probe', () => {
  for (const f of ['deep.js', 'mode-page.js']) {
    const src = R('public', 'js', 'views', f);
    assert.match(src, /window\.ProviderStatus\.live\(\)/, `${f} must use window.ProviderStatus.live()`);
    // The stale gate resolved liveAvailable from an ANTHROPIC_API_KEY health-row
    // probe — it must be gone.
    assert.ok(!src.includes("name === 'ANTHROPIC_API_KEY'"),
      `${f} still probes ANTHROPIC_API_KEY directly (stale 2-provider gate)`);
    assert.ok(!src.includes("name === 'GEMINI_API_KEY'"),
      `${f} still probes GEMINI_API_KEY directly (stale 2-provider gate)`);
  }
});

test('index.html loads provider-status.js after api.js', () => {
  const html = R('public', 'index.html');
  const iApi = html.indexOf('/js/api.js');
  const iPs = html.indexOf('/js/lib/provider-status.js');
  assert.ok(iApi > 0 && iPs > iApi, 'provider-status.js must load after api.js');
});

test('stale ANTHROPIC/GEMINI-only hint text is reworded to all providers', () => {
  const en = R('public', 'js', 'lib', 'locales', 'i18n-dict.en.js');
  assert.ok(!en.includes('no GEMINI_API_KEY'), 'eval.manualMode still says "no GEMINI_API_KEY"');
  assert.ok(!en.includes('ANTHROPIC_API_KEY (or GEMINI_API_KEY) in .env'),
    'deep.tipManual still names only Anthropic/Gemini in .env');
  assert.ok(!en.includes('Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env'),
    'deep.needKey still names only Anthropic/Gemini in .env');
  for (const k of ['dash.system.liveEvals', 'dash.system.ready', 'dash.system.manual']) {
    assert.ok(en.includes(`'${k}'`), `missing new dashboard key ${k}`);
  }
});
