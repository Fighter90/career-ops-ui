/**
 * DOC-2 (v1.233.1) — every key named in a help bundle's "Recognized keys"
 * table must actually be a recognized key.
 *
 * The table carried a row whose Key cell was not a key at all but a parenthesised
 * note, `(server uses default UA)`, describing an `HH_USER_AGENT` setting that
 * v1.19.0 removed from KNOWN_KEYS and the UI. The description then told the
 * reader to register an application at dev.hh.ru and supply its UA string —
 * work that has bought nothing since v1.65.0, when the hh.ru adapter switched
 * to scraping the public search site with a browser UA of its own. So the
 * section asked the user to configure something and never said what, and the
 * one concrete instruction in it was wrong.
 *
 * The existing help gates count HEADINGS (32 H2 / 122 H3) and the §17 source
 * total. Nothing looked at the CONTENT of a table that names configuration
 * keys, which is why a row could name a key that had not existed for 200
 * releases. This closes that: the first column of every such table is checked
 * against the live KNOWN_KEYS.
 *
 * Runs over all 17 bundles. A locale that translated the header still works —
 * the table is found by its column shape, not by the heading text.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HELP = resolve(ROOT, 'docs', 'help');

/**
 * Pull every `| \`KEY\` | … |` row whose first cell looks like it is naming a
 * config key — a single backticked token in SCREAMING_SNAKE_CASE, or anything
 * parenthesised, which is exactly the shape the stale row had.
 */
function keyCells(md, known) {
  // Scoped to tables that ARE key tables. A bundle has several tables whose
  // first column is a backticked uppercase word — `PDF` in the export matrix,
  // for one — and judging those against KNOWN_KEYS would be nonsense. A table
  // qualifies only if at least one of its own rows names a real key; then
  // every other key-shaped cell in it is fair game.
  const tables = [];
  let cur = null;
  for (const line of md.split('\n')) {
    if (line.startsWith('|')) {
      if (!cur) { cur = []; tables.push(cur); }
      cur.push(line);
    } else if (line.trim() === '') {
      cur = null;
    }
  }
  const out = [];
  for (const rows of tables) {
    const cells = [];
    for (const line of rows) {
      const c = line.split('|').map((x) => x.trim());
      if (c.length < 3 || !c[1]) continue;
      const m = c[1].match(/^`([^`]+)`$/);
      if (!m) continue;
      const token = m[1].trim();
      // Uppercase identifiers, or the parenthesised-prose shape DOC-2 had.
      if (/^[A-Z][A-Z0-9_]{2,}$/.test(token) || token.startsWith('(')) cells.push({ token, line });
    }
    if (!cells.some(({ token }) => known.has(token))) continue;   // not a key table
    for (const c of cells) if (!known.has(c.token)) out.push(c);
  }
  return out;
}

test('DOC-2: every key named in a help table is a recognized config key', async () => {
  const { KNOWN_KEYS } = await import('../server/lib/env-config.mjs');
  const known = new Set(KNOWN_KEYS);
  const bundles = readdirSync(HELP).filter((f) => f.endsWith('.md'));
  assert.ok(bundles.length >= 17, `expected at least 17 help bundles, found ${bundles.length}`);

  const offenders = [];
  for (const file of bundles) {
    const md = readFileSync(resolve(HELP, file), 'utf8');
    for (const { token, line } of keyCells(md, known)) {
      if (!known.has(token)) offenders.push(`${file}: \`${token}\` — ${line.slice(0, 90)}`);
    }
  }
  assert.deepEqual(offenders, [],
    'these help-table cells name something that is not a recognized config key:\n  ' + offenders.join('\n  '));
});

test('DOC-2: no bundle still sends the reader to dev.hh.ru', async () => {
  const stale = readdirSync(HELP)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => /dev\.hh\.ru|server uses default UA/.test(readFileSync(resolve(HELP, f), 'utf8')));
  assert.deepEqual(stale, [],
    'hh.ru has needed no key and no UA setting since v1.65.0; these bundles still say otherwise: ' + stale.join(', '));
});

/**
 * DOC-1 — the "Use the default (…)" entry is the only place the difference
 * between "unset, follow the project default" and "pinned in .env" is
 * explained, and that difference is the whole point of CONFIG-2 and CONFIG-3.
 * The heading gates cannot see it: nothing about it adds an H2 or an H3.
 */
test('DOC-1: every bundle explains the "Use the default" entry', () => {
  const PATTERNS = /use the default|использовать умолчание|використовувати усталене|usar el valor por defecto|usar o padrão|utiliser la valeur par défaut|usa il valore predefinito|standard verwenden|użyj wartości domyślnej|brug standardværdien|varsayılanı kullan|既定値を使う|使用默认值|使用預設值|기본값 사용|استخدام القيمة الافتراضية|डिफ़ॉल्ट का उपयोग करें/i;
  const missing = readdirSync(HELP)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !PATTERNS.test(readFileSync(resolve(HELP, f), 'utf8')));
  assert.deepEqual(missing, [],
    'these bundles do not document the dropdown entry that expresses "key not set": ' + missing.join(', '));
});
