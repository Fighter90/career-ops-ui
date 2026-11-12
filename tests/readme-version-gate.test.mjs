// README version gate — every push ships READMEs that agree with package.json.
//
// Three releases (v1.271.13/.14/.15) shipped with a stale EN banner lead: the
// release script rotated CHANGELOG ×19 but never README ×19, and the manual
// sweep then missed the EN trail (still v1.271.12) and the EN lead's trailing
// test count (8411 while every badge said 8450). This gate fails on any of
// those drift classes, on every CI run:
//   1. the 🆕 lead line names the current package.json version;
//   2. the release badge + release link name the current version;
//   3. the lead's trailing localized test count equals the badge's count
//      (language-independent: the count itself is compared, not the wording);
//   4. all 19 locales carry the same badge count;
//   5. the locale file set is exactly the 19-locale enumeration (a renamed or
//      dropped locale file surfaces here instead of silently unshipping docs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;

// Keep in sync with the 19-locale enumeration (i18n dict locales; ko-KR is the
// file suffix — README.ko-KR.md — while the dict key is ko).
const EXPECTED_FILES = [
  'README.md', // en
  'README.es.md', 'README.pt-BR.md', 'README.ko-KR.md', 'README.ja.md',
  'README.ru.md', 'README.zh-CN.md', 'README.zh-TW.md', 'README.fr.md',
  'README.pl.md', 'README.uk.md', 'README.da.md', 'README.ar.md',
  'README.de.md', 'README.it.md', 'README.tr.md', 'README.hi.md',
  'README.ta.md', 'README.vi.md',
].sort();

const actualFiles = readdirSync(ROOT).filter((n) => /^README.*\.md$/.test(n)).sort();

test('the README locale set is exactly the 19-locale enumeration', () => {
  assert.deepEqual(actualFiles, EXPECTED_FILES);
});

function leadLine(name) {
  const content = readFileSync(resolve(ROOT, name), 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    if (lines[i].includes('🆕')) return { content, line: lines[i] };
  }
  return { content, line: null };
}

function leadTailCount(lead) {
  // The trailing localized count: the last number on the lead line, optionally
  // followed by sentence punctuation (".", "。", "।").
  const m = lead.match(/(\d+)[.。।]?[ \t]*$/u);
  return m ? m[1] : null;
}

for (const name of EXPECTED_FILES) {
  test(`${name}: lead + badges name v${version}`, () => {
    const { line } = leadLine(name);
    assert.ok(line, `${name} carries a 🆕 lead line`);
    assert.ok(
      line.includes(`v${version}`),
      `${name} lead must name v${version} (stale banner — rotate it on release)`,
    );
    const { content } = leadLine(name);
    assert.ok(
      content.includes(`release-v${version}-blue`) && content.includes(`releases/tag/v${version}`),
      `${name} release badge/link must name v${version}`,
    );
  });

  test(`${name}: lead count == badge count`, () => {
    const { line, content } = leadLine(name);
    assert.ok(line, `${name} carries a 🆕 lead line`);
    const badge = content.match(/tests-(\d+)%20passed/);
    assert.ok(badge, `${name} carries a tests badge`);
    const tail = leadTailCount(line);
    assert.ok(
      tail !== null,
      `${name} lead ends with the localized test count`,
    );
    assert.equal(
      tail,
      badge[1],
      `${name}: lead count ${tail} != badge count ${badge[1]} — one of them is stale`,
    );
  });
}

test('all 19 READMEs carry the same tests badge count', () => {
  const counts = new Map();
  for (const name of EXPECTED_FILES) {
    const { content } = leadLine(name);
    const badge = content.match(/tests-(\d+)%20passed/);
    counts.set(name, badge ? badge[1] : null);
  }
  const distinct = [...new Set(counts.values())];
  assert.equal(distinct.length, 1, `badge counts diverge across locales: ${JSON.stringify([...counts])}`);
});
