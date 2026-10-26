/**
 * CAR-132 review round — behavior tests for the changelog pagination helpers
 * extracted to site/scripts/lib/changelog-split.mjs (sync-assets imports
 * them; the module is pure — no I/O, no network, CI-safe).
 *
 * Covers the opus review findings:
 *   #1  `## [Unreleased]` (Keep-a-Changelog standard) must not break the
 *       prebuild — it becomes a page-1 pseudo-release, excluded from the
 *       month index; OTHER undated H2s before the first release still fail.
 *   #2  A month crossing a page boundary keeps its full count and records
 *       pages [first, last]; the link lands on the month's first page.
 *   #6  stripLeadingH1 strips the docs title H1 — BOM- and blank-line
 *       tolerant — and leaves documents without a leading H1 untouched.
 *   #8  Fence toggling matches the opening marker (a ~~~ inside a ``` block
 *       is content, not a closer, and vice versa).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LIB = resolve(ROOT, 'site', 'scripts', 'lib', 'changelog-split.mjs');

if (!existsSync(LIB)) {
  // Red on the very first run: the lib does not exist yet.
  console.error(`missing ${LIB} — extract the split helpers from sync-assets first`);
  process.exit(1);
}

const { stripLeadingH1, splitReleases, chunkByWeight, buildMonthIndex, UNRELEASED_YM } =
  await import(`file://${LIB}`);

const md = (...lines) => lines.join('\n');

test('#1 Unreleased section: kept as a page-1 pseudo-release, not in the month index', () => {
  const src = md(
    '# Changelog',
    '',
    '## [Unreleased]',
    '',
    '### Added',
    '',
    '- Something new.',
    '',
    '## [1.0.0] — 2026-01-15',
    '',
    '- First release.',
    '',
    '## [0.9.0] — 2025-12-01',
    '',
    '- Beta.',
    '',
  );
  const releases = splitReleases(src, { lang: 'en' });
  assert.equal(releases.length, 3, 'Unreleased + 2 dated releases');
  assert.equal(releases[0].ym, UNRELEASED_YM);
  assert.ok(releases[0].lines[0].startsWith('## [Unreleased]'), 'heading kept');
  assert.ok(releases[0].lines.some((l) => l.includes('Something new')), 'content kept');
  assert.equal(releases[1].ym, '2026-01');

  const chunks = chunkByWeight(releases, { pageBytes: 1024 * 1024 });
  const months = buildMonthIndex(chunks);
  assert.deepEqual(
    months.map((m) => m.ym),
    ['2026-01', '2025-12'],
    'Unreleased never enters the month index',
  );
});

test('#1 other undated H2 before the first release still fails loudly', () => {
  const src = md('# Changelog', '', '## Mystery section', '', '## [1.0.0] — 2026-01-15', '', '- x', '');
  assert.throws(() => splitReleases(src, { lang: 'en' }), /Mystery section/);
});

test('#1 undated H2 after the first release folds into the preceding chunk (es/fr/ko epilogues)', () => {
  const src = md(
    '# Changelog',
    '',
    '## [1.0.0] — 2026-01-15',
    '',
    '- x',
    '',
    '## Older versions',
    '',
    'Summary of v0.x.',
    '',
  );
  const releases = splitReleases(src, { lang: 'es' });
  assert.equal(releases.length, 1);
  assert.ok(releases[0].lines.some((l) => l.includes('Older versions')), 'epilogue kept in order');
});

test('#2 month crossing a page boundary: full count, pages [first, last], link at month start', () => {
  const oct = (i) => md(`## [1.${i}.0] — 2026-10-${String(10 + i).padStart(2, '0')}`, '', `- rel ${i}`, '');
  const sep = md('## [1.0.0] — 2026-09-30', '', '- old', '');
  // A big October block followed by one September release: force a chunk
  // boundary INSIDE October via a tiny pageBytes cap.
  const releases = [...Array.from({ length: 4 }, (_, i) => ({ ym: '2026-10', lines: oct(i).split('\n') })), { ym: '2026-09', lines: sep.split('\n') }];
  const chunks = chunkByWeight(releases, { pageBytes: 4096, maxReleases: 2 }); // 2 releases/page
  assert.equal(chunks.length, 3); // 2 oct | 2 oct | 1 sep
  assert.equal(chunks[0].length, 2);
  assert.equal(chunks[1][0].ym, '2026-10', 'October spans the boundary');
  assert.equal(chunks[2][0].ym, '2026-09');

  const months = buildMonthIndex(chunks);
  const october = months.find((m) => m.ym === '2026-10');
  assert.ok(october, 'october indexed');
  assert.equal(october.count, 4, 'full month count across the boundary');
  assert.equal(october.page, 1, 'link lands where the month starts');
  assert.equal(october.lastPage, 2, 'boundary recorded');
  assert.deepEqual(months.map((m) => m.ym), ['2026-10', '2026-09']);
});

test('#6 stripLeadingH1: plain, BOM-prefixed, and blank-line-prefixed titles; no H1 → untouched', () => {
  assert.equal(stripLeadingH1(md('# Help — career-ops-ui', '', 'body')), 'body');
  assert.equal(stripLeadingH1('\uFEFF# Справка — career-ops-ui\n\nтекст'), 'текст');
  assert.equal(stripLeadingH1('\n\n# ヘルプ — career-ops-ui\n\n本文'), '本文');
  const noH1 = md('intro', '', '## Section', '', 'text');
  assert.equal(stripLeadingH1(noH1), noH1, 'document without a leading H1 is unchanged');
  // Contract: strip the title H1 only at the head of the document (optional
  // BOM, optional blank lines, then the H1 line); a mid-document H1 and H2
  // sections never match.
  const two = md('## A', '', '# Title', '', '## B');
  assert.equal(stripLeadingH1(two), two, 'mid-document H1 is not a leading title — untouched');
});

test('#8 fence closers must match the opening marker', () => {
  const tricky = md(
    '## [1.0.0] — 2026-01-15',
    '',
    '```text',
    '~~~ not a closer',
    '## not a heading inside a fence',
    '```',
    '',
    '- after',
    '',
    '~~~',
    '``` also not a closer',
    '~~~',
    '',
    '- tail',
    '',
  );
  const releases = splitReleases(tricky, { lang: 'en' });
  assert.equal(releases.length, 1, 'fence games never split the release');
  const body = releases[0].lines.join('\n');
  assert.ok(body.includes('~~~ not a closer'), 'tilde line inside a backtick fence is content');
  assert.ok(body.includes('## not a heading inside a fence'), 'H2 inside a fence is content');
  assert.ok(body.includes('``` also not a closer'), 'backtick line inside a tilde fence is content');
  assert.ok(body.includes('- tail'), 'content after the fences survives');
});

test('wiring: sync-assets consumes the lib (no drifted inline copy)', () => {
  const sync = readFileSync(resolve(ROOT, 'site', 'scripts', 'sync-assets.mjs'), 'utf8');
  assert.ok(sync.includes("from './lib/changelog-split.mjs'"), 'sync-assets must import the lib');
  assert.ok(!/function splitReleases/.test(sync), 'splitReleases must not be re-defined inline');
  assert.ok(!/function stripLeadingH1/.test(sync), 'stripLeadingH1 must not be re-defined inline');
});
