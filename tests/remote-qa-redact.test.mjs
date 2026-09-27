/**
 * The remote-QA reports go to public Actions logs. GitHub masks the prod URL
 * secret only where its exact value appears, and a finding cut to 180 chars
 * once ended mid-host (`at call (https://<ho`), which the mask missed. The
 * host must be redacted before any truncation, in both prod scripts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRedactor } from '../scripts/remote-qa/redact.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const redact = makeRedactor('https://prod.example.org/');

test('redacts the prod origin, the bare host, any case and a port', () => {
  assert.equal(redact('at call (https://prod.example.org/js/api.js:118:19)'), 'at call (<prod>/js/api.js:118:19)');
  assert.equal(redact('GET http://PROD.example.org:8443/x'), 'GET <prod>/x');
  assert.equal(redact('host prod.example.org down'), 'host <prod> down');
  assert.equal(redact('prod-example.org and example.org stay'), 'prod-example.org and example.org stay');
});

test('a long localized message cut at 180 chars no longer ends mid-host', () => {
  const msg = 'Error: Netzwerkfehler: Failed to fetch (GET /api/dashboard) — der Server ist möglicherweise ausgefallen; führen Sie aus: bash web-ui/bin/start.sh     at call (https://prod.example.org/js/api.js:118:19)';
  for (let n = 150; n <= msg.length; n++) {
    assert.doesNotMatch(redact(msg).slice(0, n), /prod\.ex|https:\/\/p/, `cut at ${n}`);
  }
});

test('without a base URL the text passes through', () => {
  assert.equal(makeRedactor('')('anything'), 'anything');
});

test('both prod scripts redact inside add() before slicing, and the final report', () => {
  for (const f of ['prod-regression.mjs', 'prod-llm.mjs']) {
    const src = readFileSync(resolve(ROOT, 'scripts/remote-qa', f), 'utf8');
    const add = src.match(/^const add = .*$/m)?.[0] || '';
    assert.match(add, /msg: redact\(msg\)[^;]*\.slice\(/, `${f}: add() must redact before slice`);
    assert.match(src, /^console\.log\(redact\(/m, `${f}: the printed report must be redacted`);
  }
});
