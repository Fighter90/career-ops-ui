/**
 * v1.248.4 — README «Translations of this guide» blockquote parity.
 *
 * Each of the 18 READMEs carries ONE blockquote line listing exactly the
 * OTHER 17 READMEs (own language never links to itself — the top switcher
 * line owns that job with the bold self-entry). Generated from one
 * canonical locale list; this test locks the parity the way
 * check-changelog-parity.mjs locks the changelogs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(resolve(ROOT, f), 'utf8');

const READMES = ['README.md', ...readdirSync(ROOT)
  .filter((f) => /^README\..+\.md$/.test(f))
  .sort()];

const FLAGS = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;

test('readme-translations: every README has exactly one translations blockquote', () => {
  for (const f of READMES) {
    const lines = read(f).split('\n');
    const bqs = lines.filter((l) => l.startsWith('> [') && FLAGS.test(l) && (l.match(new RegExp(FLAGS.source, 'gu')) || []).length >= 10);
    assert.equal(bqs.length, 1, `${f}: expected exactly 1 translations blockquote, got ${bqs.length}`);
  }
});

test('readme-translations: each blockquote links exactly the other 17 READMEs', () => {
  for (const f of READMES) {
    const lines = read(f).split('\n');
    const bq = lines.find((l) => l.startsWith('> [') && (l.match(new RegExp(FLAGS.source, 'gu')) || []).length >= 10);
    const links = [...bq.matchAll(/\((README[^)]*\.md)\)/g)].map((m) => m[1]);
    assert.equal(links.length, 17, `${f}: expected 17 links, got ${links.length}`);
    const others = READMES.filter((x) => x !== f);
    for (const o of others) {
      assert.ok(links.includes(o), `${f}: missing a link to ${o}`);
    }
    assert.ok(!links.includes(f), `${f}: must not link itself in the blockquote`);
  }
});

test('readme-translations: the blockquote carries a flag per entry (18 total incl. own on the switcher)', () => {
  for (const f of READMES) {
    const lines = read(f).split('\n');
    const bq = lines.find((l) => l.startsWith('> [') && (l.match(new RegExp(FLAGS.source, 'gu')) || []).length >= 10);
    const flags = (bq.match(new RegExp(FLAGS.source, 'gu')) || []).length;
    assert.ok(flags >= 17, `${f}: the blockquote carries ${flags} flags, expected ≥ 17`);
  }
});
