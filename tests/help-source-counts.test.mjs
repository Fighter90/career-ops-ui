/**
 * BUG-A guard (v1.228.0) — the §17 source-count sentence in every help bundle
 * must agree with the LIVE registry, and with itself.
 *
 * The sentence states a total and then breaks it down:
 *
 *     the `server/lib/sources/` registry ships **85** adapters
 *     — **80 English + 5 Russian** boards
 *
 * Both numbers were maintained by hand. Every new source bumped the total and
 * left the breakdown alone, so by v1.227.0 the sentence contradicted itself in
 * all 17 locales — "**85** adapters — **78 English + 5 Russian**" (78+5=83), and
 * ja/ko had drifted further still, to 77. Nothing caught it: the help gates
 * (`canonical-docs-coverage`, `help-ui`, `help-ru-config-section`) count
 * HEADINGS, and no test had ever looked at a number inside a paragraph.
 *
 * That matters more than a typo would, because `docs/help/<lang>.md` is the
 * ONLY grounding corpus for the "Ask the docs" assistant — a user asking how
 * many sources are supported got two contradictory numbers from one sentence.
 *
 * The sentence also used to carry an "As of vX.Y.Z" anchor that went stale the
 * same way (pinned at v1.213.0 while the count moved twice). It was rewritten
 * to a version-free phrasing, and this test keeps it that way: a hardcoded
 * version in that paragraph is drift waiting to happen, and the count itself
 * is now asserted against the registry, which is the honest source of truth.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES } from '../server/lib/sources/registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const HELP_LOCALES = ['en', 'es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW',
  'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi'];

const TOTAL = SOURCES.length;
const EN_COUNT = SOURCES.filter((s) => s.region === 'en').length;
const RU_COUNT = SOURCES.filter((s) => s.region === 'ru').length;

function readHelp(lang) {
  return readFileSync(resolve(ROOT, 'docs', 'help', `${lang}.md`), 'utf8');
}

/**
 * The §17 paragraph: located by the registry path it names, NOT by a hardcoded
 * count — locating it by the number would make the test vacuous the moment the
 * number went wrong, which is the exact failure being guarded against.
 */
function sourceParagraph(lang) {
  const text = readHelp(lang);
  const para = text
    .split(/\n\s*\n/)
    .find((p) => p.includes('server/lib/sources/') && /\*\*\s*\d+\s*\*\*|\*\*\d+/.test(p));
  assert.ok(para, `${lang}: could not locate the §17 source-count paragraph`);
  return para;
}

test('every help bundle states the registry total that the registry actually has', () => {
  for (const lang of HELP_LOCALES) {
    const para = sourceParagraph(lang);
    assert.ok(
      para.includes(`**${TOTAL}**`),
      `${lang}.md §17 does not state the live registry total (**${TOTAL}**)`,
    );
  }
});

test('the EN + RU breakdown sums to the stated total in all 17 locales', () => {
  for (const lang of HELP_LOCALES) {
    const para = sourceParagraph(lang);
    // The breakdown is the bold run that carries the EN count. Every locale
    // words it differently ("80 English + 5 Russian", "英語圏 80 個 + ロシア系 5 個",
    // "영문 80개 + 러시아어 5개"), so match the numbers, never the prose.
    const bold = para.match(new RegExp(`\\*\\*[^*]*?${EN_COUNT}[^*]*?\\*\\*`));
    assert.ok(bold, `${lang}.md §17 has no breakdown containing the EN count ${EN_COUNT}`);
    const parts = (bold[0].match(/\d+/g) || []).map(Number);
    assert.deepEqual(
      parts, [EN_COUNT, RU_COUNT],
      `${lang}.md §17 breakdown is ${parts.join('+')}, expected ${EN_COUNT}+${RU_COUNT}`,
    );
    assert.equal(
      parts.reduce((a, b) => a + b, 0), TOTAL,
      `${lang}.md §17 breakdown sums to ${parts.reduce((a, b) => a + b, 0)}, but the paragraph states ${TOTAL}`,
    );
  }
});

test('the source-count paragraph pins no version (it went stale that way before)', () => {
  for (const lang of HELP_LOCALES) {
    const para = sourceParagraph(lang);
    const pinned = para.match(/v\d+\.\d+\.\d+/g);
    assert.equal(
      pinned, null,
      `${lang}.md §17 pins ${pinned && pinned.join(', ')} — use version-free wording; the count is asserted against the registry instead`,
    );
  }
});
