/**
 * #/funded enrichment guards (v1.140.x).
 *
 * The view is exercised for real by Playwright; these node:test canaries lock
 * the pure amount parser (drives the funding-amount visualization) and the
 * source-static wiring so a refactor can't silently drop the logo / score /
 * action enrichment.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(resolve(ROOT, 'public/js/views/funded.js'), 'utf8');

/** Brace-match a `function <name>(…) {…}` out of the source. */
function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`funded.js: function ${name} not found`);
  let depth = 0;
  let i = src.indexOf('{', start);
  for (; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) { i += 1; break; } }
  }
  return src.slice(start, i);
}

function loadParseAmount() {
  const ctx = createContext({});
  runInContext(extractFn(SRC, 'parseAmount') + '\nglobalThis.__pa = parseAmount;', ctx);
  return ctx.__pa;
}

test('parseAmount: magnitudes, currencies, and junk', () => {
  const pa = loadParseAmount();
  assert.equal(pa('$120M'), 120e6);
  assert.equal(pa('€1.5B'), 1.5e9);
  assert.equal(pa('$1.2B'), 1.2e9);
  assert.equal(pa('500K'), 500e3);
  assert.equal(pa('$10,000,000'), 10_000_000);   // commas stripped, no unit
  assert.equal(pa('undisclosed'), 0);
  assert.equal(pa(''), 0);
  assert.equal(pa(null), 0);
  // ordering is what the chart needs: bigger amount → bigger magnitude
  assert.ok(pa('$1.2B') > pa('$120M'));
  assert.ok(pa('$120M') > pa('$15M'));
});

test('funded.js wires logo, discovery score, suggested action, and the amount chart', () => {
  assert.match(SRC, /CompanyLogo\.badge\(/, 'renders a company logo/avatar');
  assert.match(SRC, /discovery_score/, 'surfaces the discovery score');
  assert.match(SRC, /suggested_action/, 'surfaces the suggested action');
  assert.match(SRC, /funded\.byAmount/, 'has the funding-amount chart section');
  assert.match(SRC, /parseAmount\(/, 'charts by parsed amount');
});
