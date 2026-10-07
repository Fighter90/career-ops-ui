/**
 * llm-parsers findings in server/lib/parsers.mjs (pure functions, no I/O):
 *   - removePipelineUrl / addPipelineUrl work on raw lines (other rows keep
 *     `| comp`, comments survive) and use a replacer function (`$&` in a URL).
 *   - header / value regexes use `[ \t]*`, so an empty label never captures
 *     the next line.
 *   - slugify folds Latin accents and hashes unfoldable scripts (no '' slugs).
 *   - parseApplications reads `4,5/5` as 4.5.
 *   - parseMarkdownTable keeps the last cell of a row without a trailing pipe.
 *   - the ambiguous French `Note` label never beats `Bewertung` / a real score.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addPipelineUrl, removePipelineUrl, parsePipeline, slugify,
  parseApplications, parseMarkdownTable, parseReportHeader,
} from '../server/lib/parsers.mjs';

const FENCED = '# Pipeline\n\n```\nhttps://a.example/1 | 100k\n# a comment\nhttps://b.example/2 | 200k\n```\n';

test('removePipelineUrl keeps other rows\' comp and non-URL lines', () => {
  assert.equal(removePipelineUrl(FENCED, 'https://a.example/1'),
    '# Pipeline\n\n```\n# a comment\nhttps://b.example/2 | 200k\n```\n');
});

test('removePipelineUrl is a no-op (same string) when nothing matches or the token is not a URL', () => {
  assert.equal(removePipelineUrl(FENCED, 'https://zzz.example/'), FENCED);
  assert.equal(removePipelineUrl(FENCED, '# a comment'), FENCED);
  assert.equal(removePipelineUrl('', 'https://a.example/1'), '');
  assert.equal(removePipelineUrl(FENCED, null), FENCED);
});

test('removePipelineUrl on a bare-URL file drops the line', () => {
  assert.equal(removePipelineUrl('https://a.example/1\nhttps://b.example/2 | 9k\n', 'https://a.example/1'),
    'https://b.example/2 | 9k\n');
});

test('removePipelineUrl: a `$&` in a remaining URL is written literally', () => {
  const text = '```\nhttps://a.example/?x=$&y=1\nhttps://b.example/2\n```\n';
  assert.equal(removePipelineUrl(text, 'https://b.example/2'), '```\nhttps://a.example/?x=$&y=1\n```\n');
});

test('addPipelineUrl appends inside the fence, keeps comments, and writes `$&` literally', () => {
  const out = addPipelineUrl(FENCED, "https://c.example/?q=$&r=$'");
  assert.equal(out,
    "# Pipeline\n\n```\nhttps://a.example/1 | 100k\n# a comment\nhttps://b.example/2 | 200k\nhttps://c.example/?q=$&r=$'\n```\n");
  assert.deepEqual(parsePipeline(out).slice(-1), ["https://c.example/?q=$&r=$'"]);
});

test('addPipelineUrl on a bare-URL file appends a bare line (no duplicated fence)', () => {
  assert.equal(addPipelineUrl('https://a.example/1', 'https://b.example/2'), 'https://a.example/1\nhttps://b.example/2\n');
  // Empty / heading-only files still get a fresh fence.
  assert.match(addPipelineUrl('', 'https://b.example/2'), /```\nhttps:\/\/b\.example\/2\n```\n$/);
  assert.equal(addPipelineUrl('# P\n\n', 'https://b.example/2', { comp: '90k' }), '# P\n\n```\nhttps://b.example/2 | 90k\n```\n');
});

test('addPipelineUrl into an empty fence', () => {
  assert.equal(addPipelineUrl('x\n```\n```\n', 'https://b.example/2'), 'x\n```\nhttps://b.example/2\n```\n');
});

test('parseReportHeader: an empty bold label does not capture the next line', () => {
  const h = parseReportHeader('# T\n\n**Date:**\n**Score:** 4/5\n');
  assert.equal(h.date, '');
  assert.equal(h.scoreNum, 4);
});

test('parseReportHeader: an empty Machine Summary key does not capture the next key', () => {
  const h = parseReportHeader('# T\n\n## Machine Summary\ndate:\nurl: https://x.example/\nlegitimacy: High\n');
  assert.equal(h.date, '');
  assert.equal(h.url, 'https://x.example/');
  assert.equal(h.legitimacy, 'High');
});

test('parseReportHeader: localized bold label with an empty value does not swallow the next line', () => {
  const h = parseReportHeader('# T\n**Легитимность:**\nтекст\n');
  assert.equal(h.legitimacy, '');
});

test('parseReportHeader: `Note` (fr) never beats `Bewertung` (de) or a non-score annotation', () => {
  assert.equal(parseReportHeader('# T\n**Note:** Remote unclear\n**Bewertung:** 4.2\n').scoreNum, 4.2);
  assert.equal(parseReportHeader('# T\nNote: ask about visa\n').score, '');
  // A genuine French score under `Note` still parses.
  assert.equal(parseReportHeader('# T\n**Note :** 3,5/5\n').scoreNum, 3.5);
});

test('slugify: Latin accents fold; unfoldable scripts get a stable, distinct hash', () => {
  assert.equal(slugify('Nürnberg Café'), 'nurnberg-cafe');
  const y = slugify('Яндекс');
  const s = slugify('Сбербанк');
  assert.match(y, /^[0-9a-f]{8}$/);
  assert.notEqual(y, s);
  assert.equal(slugify('Яндекс'), y, 'stable');
  assert.match(slugify('Яндекс Cloud'), /^cloud-[0-9a-f]{8}$/);
  assert.match(slugify('東京'), /^[0-9a-f]{8}$/);
  // ASCII input unchanged; punctuation-only stays ''.
  assert.equal(slugify('Wheely (Cyprus)'), 'wheely-cyprus');
  assert.equal(slugify('!!!'), '');
  assert.equal(slugify(undefined), '');
});

test('parseApplications: comma decimal score', () => {
  const rows = parseApplications('| # | Company | Score |\n|---|---|---|\n| 1 | A | 4,5/5 |\n| 2 | B | 3.8/5 |\n');
  assert.deepEqual(rows.map((r) => r.scoreNum), [4.5, 3.8]);
});

test('parseMarkdownTable: last cell kept when the row has no trailing pipe', () => {
  const t = parseMarkdownTable('| a | b |\n|---|---|\n| 1 | 2\n| 3 | 4 |\n| x | y \\|\n');
  assert.deepEqual(t.rows, [['1', '2'], ['3', '4'], ['x', 'y |']]);
});
