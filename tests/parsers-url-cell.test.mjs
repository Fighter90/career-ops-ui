/**
 * v1.248.8 — parent parity #3516: the tracker `URL` cell is written as a
 * markdown link (`[ashby](https://…)`); the href is the dedup key, so
 * parseApplications extracts it at parse time. A bare URL / placeholder
 * passes through verbatim.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseApplications, extractCellUrl, parseMarkdownLinks } from '../server/lib/parsers.mjs';

const tracker = (urlCell) => [
  '| # | Date | Company | Role | Score | Status | PDF | Report | Notes | URL |',
  '|---|------|---------|------|-------|--------|-----|--------|-------|-----|',
  `| 001 | 2026-10-11 | Acme | Eng | 4/5 | Evaluated | ❌ | [001](reports/001.md) | n | ${urlCell} |`,
].join('\n');

test('extractCellUrl: the markdown-link href is the url', () => {
  assert.equal(extractCellUrl('[ashby](https://jobs.ashbyhq.com/acme/abc)'), 'https://jobs.ashbyhq.com/acme/abc');
});

test('extractCellUrl: a bare URL passes through verbatim', () => {
  assert.equal(extractCellUrl('https://jobs.lever.co/beta/xyz'), 'https://jobs.lever.co/beta/xyz');
});

test('extractCellUrl: a placeholder / empty cell passes through trimmed', () => {
  assert.equal(extractCellUrl('—'), '—');
  assert.equal(extractCellUrl('  '), '');
});

test('extractCellUrl: a percent-encoded space decodes to the same dedup key', () => {
  // The parent guarantees the KEY, not the literal: a linked destination
  // with a space is written %20; new URL() parses both to the same URL.
  const a = new URL(extractCellUrl('[host](https://x.example/a%20b)'));
  const b = new URL('https://x.example/a b');
  assert.equal(a.href, b.href);
});

test('parseApplications: the url field is always the href', () => {
  const rows = parseApplications(tracker('[careers.acme.com](https://careers.acme.com/jobs/123)'));
  assert.equal(rows[0].url, 'https://careers.acme.com/jobs/123');
});

test('parseApplications: a row with no URL parses with an empty url', () => {
  const rows = parseApplications(tracker('—'));
  assert.equal(rows[0].url, '—');
});

test('parseMarkdownLinks: nested parentheses survive in the target', () => {
  const links = parseMarkdownLinks('[x](https://a.example/b_(c))');
  assert.equal(links.length, 1);
  assert.equal(links[0].target, 'https://a.example/b_(c)');
});
