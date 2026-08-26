/**
 * eval-badge-tone.test.mjs (v1.223.0)
 *
 * Regression for the #/evaluate result badge: a SUCCESSFUL live eval must not be
 * painted as an error. The in-process live providers (OpenRouter, DeepSeek, …)
 * return no `code` field (there is no subprocess), so the old
 * `r.code === 0 ? 'badge-ok' : 'badge-bad'` evaluated `undefined === 0` → false
 * and painted every success red — while `r.code ?? 0` still rendered "exit 0".
 *
 * Source-static, matching the project's view-testing convention
 * (qa-report-fixes / router / openai-model-selector all assert on view source).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(HERE, '..', 'public', 'js', 'views', 'evaluate.js'), 'utf8');

test('the buggy strict `r.code === 0 ? badge-ok : badge-bad` tone is gone', () => {
  assert.ok(
    !/r\.code\s*===\s*0\s*\?\s*['"]badge-ok['"]\s*:\s*['"]badge-bad['"]/.test(src),
    'evaluate.js still derives the badge tone from a strict `r.code === 0`, which is false for the code-less live-provider response'
  );
});

test('failure is an explicit non-zero NUMERIC exit code; otherwise the badge is ok', () => {
  // failed only when a subprocess actually exited non-zero
  assert.match(
    src,
    /typeof\s+r\.code\s*===\s*['"]number['"]\s*&&\s*r\.code\s*!==\s*0/,
    'the failure predicate must require a numeric, non-zero exit code'
  );
  // the class must default to ok unless `failed`
  assert.match(
    src,
    /const\s+cls\s*=\s*failed\s*\?\s*['"]badge-bad['"]\s*:\s*['"]badge-ok['"]/,
    'the badge class must be badge-ok unless `failed`'
  );
});

test('the "exit N" suffix only shows when there is a real numeric exit code', () => {
  // no more unconditional `r.code ?? 0` in the badge label
  assert.ok(
    !/exit['"]\)\s*\+\s*['"] ['"]\s*\+\s*\(r\.code\s*\?\?\s*0\)/.test(src),
    'the badge label still shows "exit 0" unconditionally via `r.code ?? 0`'
  );
  assert.match(
    src,
    /typeof\s+r\.code\s*===\s*['"]number['"]\s*\?\s*['"] · ['"]\s*\+\s*t\(['"]eval\.exit['"]/,
    'the exit suffix must be guarded by a numeric-code check'
  );
});
