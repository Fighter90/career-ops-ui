/**
 * Dead-key guard (BACKLOG v1.243.0) — the dictionary carries no key that
 * nothing references.
 *
 * 31 keys (nav.settings, dash.evaluate, scan.hhWarning, funded.*, …) were
 * orphaned by refactors but stayed in all 17 locale files — 527 rows of
 * translator work for strings no t() call can ever reach, and a standing
 * trap: a translator "fixing" a dead key sees zero effect in the UI.
 *
 * The check is a repo-wide scan: every non-alias dict key must appear as a
 * string literal in code (public/, server/, tests/, tools/, scripts/,
 * bin/, evals/). Dynamic-prefix construction (`t('diag.' + id)`) is
 * honored by collecting `'x.y.' +` concatenation prefixes. If this test
 * fails for a key you just wired through a computation the prefix scan
 * can't see, register the key in a static list (like help-hint.js's
 * recognized-keys arrays) or extend DYN_PREFIXES below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAssembledDict } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SCAN_DIRS = ['public', 'server', 'tests', 'tools', 'scripts', 'bin', 'evals'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'locales', 'fixtures', 'screenshots']);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = resolve(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|mjs|cjs|html|sh|json)$/.test(e.name)) out.push(p);
  }
  return out;
}

const sources = SCAN_DIRS
  .flatMap((d) => walk(resolve(ROOT, d)))
  .map((f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } })
  .join('\n');

// Prefixes used by dynamic key construction, e.g. t('diag.section.' + kind).
// Extend when a new computed-key family is added.
const DYN_PREFIXES = new Set();
for (const m of sources.matchAll(/['"`]([a-zA-Z][\w-]*(?:\.[\w-]+)+)\.['"`]\s*\+/g)) DYN_PREFIXES.add(m[1] + '.');
for (const m of sources.matchAll(/\+\s*['"`]((?:[\w-]+\.)+)['"`]/g)) DYN_PREFIXES.add(m[1]);

test('the dictionary has zero dead keys (every key is referenced or an alias)', () => {
  const dict = loadAssembledDict();
  const aliases = new Set();
  const aliasTargets = new Set();
  for (const [key, row] of Object.entries(dict)) {
    if (row && row['@alias']) { aliases.add(key); aliasTargets.add(row['@alias']); }
  }
  const dead = [];
  for (const key of Object.keys(dict)) {
    if (aliases.has(key) || aliasTargets.has(key)) continue; // alias plumbing
    const re = new RegExp("['\"`]" + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"`]");
    if (re.test(sources)) continue;
    if ([...DYN_PREFIXES].some((p) => key.startsWith(p))) continue;
    dead.push(key);
  }
  assert.deepEqual(dead, [],
    `dead keys present in the dictionary (${dead.length}) — remove them from all 17 locale files:\n  ` + dead.join('\n  '));
});
