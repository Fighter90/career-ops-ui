/**
 * cv-voice.mjs — stock-phrase lint (CAR-188, ported from upstream career-ops
 * #6178). Pure-function suite: zero network, zero filesystem.
 *
 * Contract under test:
 *   - BANNED_PHRASES — the upstream list, ported verbatim;
 *   - detectStockPhrases(text) → [{ phrase, line, match, index, lineText }]
 *     with case/space-folded matching, Unicode word boundaries, the
 *     date-range dash heuristic (a dash between years is NOT a tell,
 *     "20–30%" still is) and the <head>/<title> exclusion.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let BANNED_PHRASES;
let detectStockPhrases;

before(async () => {
  ({ BANNED_PHRASES, detectStockPhrases } = await import('../server/lib/cv-voice.mjs'));
});

const EM = '\u2014'; // —
const EN = '\u2013'; // –

test('BANNED_PHRASES ports the upstream #6178 list verbatim', () => {
  assert.equal(BANNED_PHRASES.length, 27);
  for (const want of [
    'passionate about', 'results-oriented', 'results-driven', 'proven track record',
    'leveraged', 'leveraging', 'leverage', 'spearheaded', 'spearheading', 'spearhead',
    'facilitated', 'facilitating', 'synergies', 'synergy', 'cutting-edge', 'cutting edge',
    "in today's fast-paced world", 'demonstrated ability to', 'best practices',
    'significant impact', 'measurable impact', 'orchestrated', 'championed',
    'utilized', 'delve', 'tapestry', 'pivotal',
  ]) {
    assert.ok(BANNED_PHRASES.includes(want), `missing banned phrase: ${want}`);
  }
});

test('every banned phrase is detected in plain text', () => {
  for (const phrase of BANNED_PHRASES) {
    const found = detectStockPhrases(`The draft mentions ${phrase} right here.`);
    assert.ok(
      found.some((f) => f.phrase === phrase),
      `phrase not detected: ${phrase} (got ${JSON.stringify(found)})`,
    );
  }
});

test('matching folds case and runs of whitespace', () => {
  const found = detectStockPhrases(`PROVEN   track RECORD and Cutting-Edge work`);
  const names = found.map((f) => f.phrase);
  assert.ok(names.includes('proven track record'));
  assert.ok(names.includes('cutting-edge'));
});

test('Unicode word boundaries: unleveraged is not leverage', () => {
  const found = detectStockPhrases('Wrote the unleveraged cash report on time.');
  assert.deepEqual(found, []);
});

test('a longer form does not double-report its stem (spearheaded, not spearhead)', () => {
  const found = detectStockPhrases('Spearheaded the migration.');
  assert.deepEqual(found.map((f) => f.phrase), ['spearheaded']);
});

test('a date-range dash is not a stock tell', () => {
  const text = [
    'Northwind Payments',
    `2022${EN}2024`,
    `Mar 2020 ${EM} Present`,
    `2021${EN}current`,
    `2019 ${EM} now`,
  ].join('\n');
  assert.deepEqual(detectStockPhrases(text), []);
});

test('a metric range written with a dash is still a tell', () => {
  const found = detectStockPhrases('Improved conversion by 20\u201330% on the refund page.');
  assert.deepEqual(found.map((f) => f.phrase), ['en dash']);
});

test('a prose dash is a tell', () => {
  const emFound = detectStockPhrases(`Shipped quarterly ${EM} every single time.`);
  assert.deepEqual(emFound.map((f) => f.phrase), ['em dash']);
  const enFound = detectStockPhrases(`Shipped quarterly ${EN} every single time.`);
  assert.deepEqual(enFound.map((f) => f.phrase), ['en dash']);
});

test('the <head>/<title> "Name — CV" separator is never the candidate\'s wording', () => {
  const html = [
    '<html><head><title>Jane Doe \u2014 CV</title></head><body>',
    '<p>Ran the weekly release train</p>',
    '<p>Owned the calendar \u2014 the Tuesday one</p>',
    '</body></html>',
  ].join('\n');
  const found = detectStockPhrases(html);
  assert.equal(found.length, 1);
  assert.equal(found[0].phrase, 'em dash');
  assert.ok(!JSON.stringify(found).includes('JANE'), 'title text must not leak into findings');
});

test('markup breaks lines: one <p> per line', () => {
  const found = detectStockPhrases('<p>Results-driven leader</p><p>Leveraged the budget</p>');
  const byLine = Object.fromEntries(found.map((f) => [f.phrase, f.line]));
  assert.equal(byLine['results-driven'], 1);
  assert.equal(byLine['leveraged'], 2);
});

test('findings carry 1-based line numbers across a multiline draft', () => {
  const text = [
    'Clean opening line.',
    'Spearheaded the on-call rota.',
    'Another clean line.',
    'Results-driven and leveraged on one line.',
  ].join('\n');
  const found = detectStockPhrases(text);
  const byPhrase = Object.fromEntries(found.map((f) => [f.phrase, f.line]));
  assert.equal(byPhrase['spearheaded'], 2);
  assert.equal(byPhrase['results-driven'], 4);
  assert.equal(byPhrase['leveraged'], 4);
});

test('each finding exposes match, index and lineText for exact highlighting', () => {
  const found = detectStockPhrases('Used utilized tooling twice, utilized again.');
  assert.equal(found.length, 2);
  for (const f of found) {
    assert.equal(f.phrase, 'utilized');
    assert.equal(typeof f.index, 'number');
    assert.ok(f.lineText.includes(f.match));
    assert.equal(f.lineText.slice(f.index, f.index + f.match.length), f.match);
  }
  assert.notEqual(found[0].index, found[1].index);
});

test('markdown input keeps its own line numbering', () => {
  const text = [
    '# Jane Dev',
    '',
    '## Experience',
    '',
    '- Spearheaded the on-call rota',
    '- Cut deploy time from 2 weeks to 4 hours',
  ].join('\n');
  const found = detectStockPhrases(text);
  assert.equal(found.length, 1);
  assert.equal(found[0].phrase, 'spearheaded');
  assert.equal(found[0].line, 5);
});

test('empty and clean inputs yield zero findings', () => {
  assert.deepEqual(detectStockPhrases(''), []);
  assert.deepEqual(detectStockPhrases('   \n\n  '), []);
  assert.deepEqual(
    detectStockPhrases('Built the release train; cut deploys from two weeks to four hours.'),
    [],
  );
});

test('the same phrase on several lines reports once per line', () => {
  const found = detectStockPhrases('Utilized Terraform.\nUtilized Helm.');
  assert.deepEqual(found.map((f) => f.line), [1, 2]);
});

// L262-R2 — the <head> strip used a lazy `[\s\S]*?</head>` scan from EVERY
// `<head` start; with the close tag missing (broken template) that is
// quadratic in the number of openers (658 ms on 64 KB in review). The fix
// walks openers with indexOf and stops at the first missing close.
test('unclosed <head> openers are handled in linear time', () => {
  // ~52k unclosed openers in a 256 KB document — the unfixed lazy rescan
  // costs ~800 ms locally (quadratic); the fixed walk is a single scan.
  let html = '<head>'.repeat(52400).slice(0, 256 * 1024);
  html += ' passionate about growth';
  assert.ok(html.length >= 256 * 1024);

  const t0 = performance.now();
  const hits = detectStockPhrases(html);
  const elapsed = performance.now() - t0;
  assert.equal(hits.length, 1, 'the banned phrase after the broken head is still found');
  assert.ok(elapsed < 200, `head strip must be linear: took ${Math.round(elapsed)} ms`);
});

test('head strip keeps its semantics (closed / unclosed / mixed case)', () => {
  // A closed <head> block is dropped outright — its <title> separator never
  // reaches the lint; an unclosed opener loses only the tag itself (the
  // fixed-point tag sweep owns it), and matching is case-insensitive.
  const closed = '<!doctype html><html><HEAD><title>John — CV</title></head><body>passionate about growth</body></html>';
  const hitsClosed = detectStockPhrases(closed);
  assert.equal(hitsClosed.length, 1);
  assert.ok(!hitsClosed[0].lineText.includes('CV</title>'), 'title line is dropped with the head');

  const unclosed = '<html><head><title>John CV</title><body>passionate about growth</body></html>';
  const hitsUnclosed = detectStockPhrases(unclosed);
  assert.equal(hitsUnclosed.length, 1, 'unclosed head does not swallow the body');
  assert.ok(hitsUnclosed[0].lineText.includes('John CV'), 'the unclosed title survives (only the fixed-point sweep owns it)');

  const mixed = '<HEAD>a</HeAd>b passionate about growth';
  assert.equal(detectStockPhrases(mixed).length, 1);
});
