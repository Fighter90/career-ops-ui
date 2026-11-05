/**
 * node18-compat.test.mjs — the CI still gates Node 18, where the
 * `import.meta` `.dirname` shorthand does not exist (added in Node 20.11).
 * Twice (i18n-server v1.268.0, runners-data-migrations v1.268.1) a new test
 * file crashed the node-18 CI job on exactly this import. This is the class
 * gate: no test file may use the shorthand — `fileURLToPath(new URL('.',
 * import.meta.url))` is the compatible form. The identifier below is
 * assembled from parts so the scanner cannot match its own source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// import.meta.dirname needs Node >= 20.11 — CI still gates node 18.
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const PITFALL = 'import.meta' + '.dirname';

test('no test file uses the Node-20.11 dirname shorthand (Node 18 has no such property)', () => {
  const offenders = [];
  for (const f of readdirSync(resolve(ROOT, 'tests'))) {
    if (!f.endsWith('.mjs')) continue;
    const src = readFileSync(resolve(ROOT, 'tests', f), 'utf8');
    // Strip block comments first (the compatible form is documented in several
    // files' headers), then comment-only lines, then scan.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    if (code.includes(PITFALL)) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `Node 18 has no ${PITFALL} — use fileURLToPath(new URL('.', import.meta.url)): ${offenders.join(', ')}`);
});
