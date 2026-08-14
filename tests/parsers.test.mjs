import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMarkdownTable,
  parseApplications,
  parsePipeline,
  addPipelineUrl,
  removePipelineUrl,
  parseReportHeader,
  slugify,
  today,
} from '../server/lib/parsers.mjs';

// ───────────────────────── parseMarkdownTable ─────────────────────────

test('parseMarkdownTable: empty input', () => {
  assert.deepEqual(parseMarkdownTable(''), { headers: [], rows: [] });
  assert.deepEqual(parseMarkdownTable(null), { headers: [], rows: [] });
});

test('parseMarkdownTable: simple table', () => {
  const md = `
intro line

| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
| 4 | 5 | 6 |

after
`;
  const { headers, rows } = parseMarkdownTable(md);
  assert.deepEqual(headers, ['A', 'B', 'C']);
  assert.deepEqual(rows, [['1', '2', '3'], ['4', '5', '6']]);
});

test('parseMarkdownTable: stops at first blank line after table', () => {
  const md = `| H |
|---|
| x |

| H2 |
|----|
| y  |`;
  const { rows } = parseMarkdownTable(md);
  assert.deepEqual(rows, [['x']]);
});

test('parseMarkdownTable: rejects fake tables (no separator)', () => {
  const md = `| A | B |\n| 1 | 2 |\n`;
  assert.deepEqual(parseMarkdownTable(md), { headers: [], rows: [] });
});

// ───────────────────────── parseApplications ─────────────────────────

test('parseApplications: real-world tracker row', () => {
  const md = `# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
| 1 | 2026-05-02 | Wheely | Senior Backend | 4.2/5 | Evaluated | ✅ | [001](reports/001-wheely-2026-05-02.md) | Strong Go fit |
`;
  const apps = parseApplications(md);
  assert.equal(apps.length, 1);
  const a = apps[0];
  assert.equal(a.num, '1');
  assert.equal(a.company, 'Wheely');
  assert.equal(a.score, '4.2/5');
  assert.equal(a.scoreNum, 4.2);
  assert.equal(a.status, 'Evaluated');
  assert.equal(a.pdfReady, true);
  assert.equal(a.reportPath, 'reports/001-wheely-2026-05-02.md');
});

test('parseApplications: handles missing pdf and report', () => {
  const md = `| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | 2026-01-01 | Acme | Eng | 3.0/5 | Applied | ❌ | — | n/a |`;
  const a = parseApplications(md)[0];
  assert.equal(a.pdfReady, false);
  assert.equal(a.reportPath, null);
});

test('parseApplications: empty tracker', () => {
  assert.deepEqual(parseApplications(''), []);
  assert.deepEqual(parseApplications('# Tracker\n\nNo data'), []);
});

// ───────────────────────── parsePipeline ─────────────────────────

test('parsePipeline: empty', () => {
  assert.deepEqual(parsePipeline(''), []);
  assert.deepEqual(parsePipeline('# Pipeline\n\nDrop URLs:\n\n```\n```\n'), []);
});

test('parsePipeline: extracts urls from fence', () => {
  const md = '# Pipeline\n```\nhttps://a.com/job/1\nhttps://b.com/job/2\nlocal:jds/x.txt\n```';
  assert.deepEqual(parsePipeline(md), [
    'https://a.com/job/1',
    'https://b.com/job/2',
    'local:jds/x.txt',
  ]);
});

test('parsePipeline: ignores non-URL lines in fence', () => {
  const md = '```\n# comment\nhttps://x.com/1\n\nsome note\n```';
  assert.deepEqual(parsePipeline(md), ['https://x.com/1']);
});

// ───────────────────────── addPipelineUrl ─────────────────────────

test('addPipelineUrl: adds new url', () => {
  const before = '# Pipeline\n\n```\nhttps://a.com/1\n```\n';
  const after = addPipelineUrl(before, 'https://b.com/2');
  assert.deepEqual(parsePipeline(after), ['https://a.com/1', 'https://b.com/2']);
});

test('addPipelineUrl: dedup', () => {
  const before = '```\nhttps://a.com/1\n```';
  const after = addPipelineUrl(before, 'https://a.com/1');
  assert.equal(after, before);
});

test('addPipelineUrl: canonical dedup — a tracking-param / http / trailing-slash variant is the same posting', () => {
  const before = '```\nhttps://a.com/1\n```';
  // http↔https, a utm param, and a trailing slash all collapse to the same key.
  assert.equal(addPipelineUrl(before, 'http://a.com/1?utm_source=nl'), before, 'utm + http variant deduped');
  assert.equal(addPipelineUrl(before, 'https://a.com/1/'), before, 'trailing-slash variant deduped');
  assert.equal(addPipelineUrl(before, 'https://a.com/1#apply'), before, 'fragment variant deduped');
  // A genuinely different posting (different functional query) is still added.
  const grown = addPipelineUrl(before, 'https://a.com/1?ref=partner');
  assert.notEqual(grown, before, 'a kept functional param is a different posting');
});

test('addPipelineUrl: creates fence when missing', () => {
  const after = addPipelineUrl('', 'https://x.com/1');
  assert.deepEqual(parsePipeline(after), ['https://x.com/1']);
  assert.match(after, /```[\s\S]*```/);
});

// v1.84.0 (#1017) — optional compensation column `url | <comp>`
test('addPipelineUrl: appends a compensation column when opts.comp is set', () => {
  const after = addPipelineUrl('', 'https://x.com/1', { comp: '120000-150000 USD' });
  assert.match(after, /https:\/\/x\.com\/1 \| 120000-150000 USD/);
  assert.deepEqual(parsePipeline(after), ['https://x.com/1']); // URL still extracted
});

test('addPipelineUrl: preserves an existing comp column when adding another url', () => {
  let md = addPipelineUrl('', 'https://a.com/1', { comp: '100k EUR' });
  md = addPipelineUrl(md, 'https://b.com/2', { comp: '200k USD' });
  assert.match(md, /https:\/\/a\.com\/1 \| 100k EUR/);
  assert.match(md, /https:\/\/b\.com\/2 \| 200k USD/);
  assert.deepEqual(parsePipeline(md), ['https://a.com/1', 'https://b.com/2']);
});

test('addPipelineUrl: dedups on the URL even when a comp column is present', () => {
  const before = addPipelineUrl('', 'https://a.com/1', { comp: '100k' });
  const after = addPipelineUrl(before, 'https://a.com/1', { comp: '999k' });
  assert.equal(after, before); // unchanged (URL already present)
});

test('addPipelineUrl: sanitizes comp (strips pipe/newline, neutralizes formula lead)', () => {
  const after = addPipelineUrl('', 'https://x.com/1', { comp: '=cmd()\n| evil' });
  // newline + extra pipe collapsed to spaces (no injected row), formula lead quoted
  assert.match(after, /https:\/\/x\.com\/1 \| '=cmd\(\) evil/);
  assert.deepEqual(parsePipeline(after), ['https://x.com/1']); // exactly one entry — no row injection
});

test('addPipelineUrl: no comp → bare URL line (backward compatible)', () => {
  const after = addPipelineUrl('', 'https://x.com/1');
  assert.match(after, /```\nhttps:\/\/x\.com\/1\n```/);
});

test('addPipelineUrl: comp is hard-capped to 80 chars TOTAL (formula-lead reserves the quote)', () => {
  // (a) formula-lead, over length → quote + 79 content chars = 80 total (not 81)
  const after = addPipelineUrl('', 'https://x.com/1', { comp: '=' + 'A'.repeat(85) });
  const cell = after.match(/https:\/\/x\.com\/1 \| (.+)\n/)[1];
  assert.equal(cell, "'=" + 'A'.repeat(78));
  assert.equal(cell.length, 80);
  assert.deepEqual(parsePipeline(after), ['https://x.com/1']);
  // (b) non-formula, over length → exactly 80 of the content, no stray quote
  const after2 = addPipelineUrl('', 'https://y.com/2', { comp: 'B'.repeat(90) });
  const cell2 = after2.match(/https:\/\/y\.com\/2 \| (.+)\n/)[1];
  assert.equal(cell2, 'B'.repeat(80));
  assert.equal(cell2.length, 80);
  assert.ok(!cell2.startsWith("'"));
});

test('removePipelineUrl: removes url', () => {
  const before = '```\nhttps://a.com/1\nhttps://b.com/2\n```';
  const after = removePipelineUrl(before, 'https://a.com/1');
  assert.deepEqual(parsePipeline(after), ['https://b.com/2']);
});

// ───────────────────────── parseReportHeader ─────────────────────────

test('parseReportHeader: full header', () => {
  const md = `# Evaluation: Wheely — Senior Backend

**Date:** 2026-05-02
**Archetype:** Senior Go Backend
**Score:** 4.2/5
**URL:** https://example.com/job/1
**Legitimacy:** High Confidence
**PDF:** pending

---

## A) Role Summary
content
`;
  const h = parseReportHeader(md);
  assert.equal(h.title, 'Evaluation: Wheely — Senior Backend');
  assert.equal(h.date, '2026-05-02');
  assert.equal(h.score, '4.2/5');
  assert.equal(h.scoreNum, 4.2);
  assert.equal(h.url, 'https://example.com/job/1');
  assert.equal(h.legitimacy, 'High Confidence');
});

test('parseReportHeader: missing fields → empty strings', () => {
  const h = parseReportHeader('# Hello');
  assert.equal(h.title, 'Hello');
  assert.equal(h.score, '');
  assert.equal(h.scoreNum, null);
});

// ───────────────────────── slugify / today ─────────────────────────

test('slugify', () => {
  assert.equal(slugify('Hello World!'), 'hello-world');
  assert.equal(slugify('  Multiple   spaces  '), 'multiple-spaces');
  assert.equal(slugify('Wheely (Cyprus)'), 'wheely-cyprus');
  assert.equal(slugify(''), '');
  assert.equal(slugify(null), '');
});

test('today: YYYY-MM-DD format', () => {
  const t = today();
  assert.match(t, /^\d{4}-\d{2}-\d{2}$/);
});
