/**
 * #4452 — evidence-confidence chips on the report view (#/reports detail).
 *
 * The parent's evaluation prompt (modes/oferta.md → "Evidence confidence",
 * canonical Machine Summary schema in batch/batch-prompt.md) makes every
 * fresh report carry:
 *   score_evidence:  { cv_match|north_star|compensation|culture|red_flags:
 *                      "supported | partial | unknown" }
 *   confidence_gaps: up to three concrete verification priorities (or [])
 *
 * Live-data note (2026-10-31): NO report in the parent checkout carries these
 * fields yet (reports/ holds 6 files, 1 with a Machine Summary, 0 with
 * score_evidence) — the fields are implemented from the PROMPT CONTRACT and
 * pinned here with a synthetic fixture; the chips render silently (no block)
 * until the parent starts writing them.
 *
 * Layers under test:
 *   1. server/lib/parsers.mjs::parseReportHeader lifts both fields out of the
 *      Machine Summary block (additive keys — routes/reports.mjs already
 *      spreads the header into the detail payload, zero route edits);
 *   2. public/js/views/reports.js renders a green `.badge badge-ok` chip
 *      (N confirmed, title: the supported dimensions) and, when gaps exist,
 *      an amber `.badge badge-warn` chip (M gaps, title: the priorities)
 *      under the score metadata line; no data → no block at all;
 *   3. the four evc.* keys exist in all 19 locale dicts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReportHeader } from '../server/lib/parsers.mjs';
import { loadAssembledDict, I18N_LANGS } from './helpers/i18n-vm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const R = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const SRC = R('public/js/views/reports.js');
const ROUTE = R('server/lib/routes/reports.mjs');

// Synthetic report carrying the parent's Machine Summary contract (fenced
// ```yaml, as real models emit it — see reports/001-netwrk-*.md for the shape).
const REPORT = [
  '# Evaluation: Netwrk — Team Lead Go',
  '**Date:** 2026-05-27',
  '**Score:** 4.5/5',
  '',
  '## Risk Summary',
  '',
  '| legitimacy | proceed_with_caution |',
  '',
  '## Machine Summary',
  '```yaml',
  'company: "Netwrk"',
  'role: "Team Lead Go"',
  'score: 4.5',
  'score_evidence:',
  '  cv_match: "supported"',
  '  north_star: "partial"',
  '  compensation: "supported"',
  '  culture: "supported"',
  '  red_flags: "unknown"',
  'confidence_gaps:',
  '  - "Confirm whether the PKI track record is a hard requirement"',
  '  - "Ask about on-call rotation during the interview"',
  'next_action: "Apply and raise the PKI question in round 1"',
  '```',
  '',
  '## Job Description (archived verbatim)',
  '',
  'Go team lead role…',
].join('\n');

// ───────────────────────── parser layer ─────────────────────────

test('parseReportHeader lifts score_evidence dims out of the Machine Summary', () => {
  const h = parseReportHeader(REPORT);
  assert.deepEqual(h.scoreEvidence, {
    cv_match: 'supported',
    north_star: 'partial',
    compensation: 'supported',
    culture: 'supported',
    red_flags: 'unknown',
  });
  // The pre-existing header fields keep parsing alongside the new keys.
  assert.match(h.score, /4\.5/);
});

test('parseReportHeader parses the block-list confidence_gaps (quotes stripped)', () => {
  const h = parseReportHeader(REPORT);
  assert.deepEqual(h.confidenceGaps, [
    'Confirm whether the PKI track record is a hard requirement',
    'Ask about on-call rotation during the interview',
  ]);
});

test('parseReportHeader reads the inline confidence_gaps list form (commas inside quotes survive)', () => {
  const h = parseReportHeader([
    '## Machine Summary',
    '```yaml',
    'score: 3.0',
    'score_evidence:',
    '  cv_match: supported',
    'confidence_gaps: ["Confirm sponsorship terms, and for which visa types", "Check the notice period"]',
    '```',
  ].join('\n'));
  assert.deepEqual(h.scoreEvidence, { cv_match: 'supported' });
  assert.deepEqual(h.confidenceGaps, [
    'Confirm sponsorship terms, and for which visa types',
    'Check the notice period',
  ]);
});

test('parseReportHeader: schema default confidence_gaps: [] stays empty (no phantom items)', () => {
  const h = parseReportHeader([
    '## Machine Summary',
    '```yaml',
    'score: 4.0',
    'score_evidence:',
    '  cv_match: supported',
  '  north_star: supported',
    'confidence_gaps: []',
    'next_action: "Apply"',
    '```',
  ].join('\n'));
  assert.deepEqual(h.confidenceGaps, []);
  assert.deepEqual(h.scoreEvidence, { cv_match: 'supported', north_star: 'supported' });
});

test('parseReportHeader: absent fields yield {} / [] — the chips must hide', () => {
  const bare = parseReportHeader('# Evaluation: X — Y\n\n**Score:** 4/5\n');
  assert.deepEqual(bare.scoreEvidence, {});
  assert.deepEqual(bare.confidenceGaps, []);

  const noEvc = parseReportHeader([
    '## Machine Summary',
    '```yaml',
    'score: 4.0',
    'next_action: "Apply"',
    '```',
  ].join('\n'));
  assert.deepEqual(noEvc.scoreEvidence, {});
  assert.deepEqual(noEvc.confidenceGaps, []);
});

test('parseReportHeader: partial/unknown statuses are kept (the chip counts only supported)', () => {
  const h = parseReportHeader([
    '## Machine Summary',
    '```yaml',
    'score_evidence:',
    '  cv_match: partial',
    '  culture: unknown',
    'confidence_gaps: []',
    '```',
  ].join('\n'));
  const supported = Object.values(h.scoreEvidence).filter((v) => v === 'supported');
  assert.equal(supported.length, 0);
  assert.deepEqual(h.scoreEvidence, { cv_match: 'partial', culture: 'unknown' });
});

test('parseReportHeader: an unfilled placeholder value degrades to {} (chip stays hidden)', () => {
  const h = parseReportHeader([
    '## Machine Summary',
    '```yaml',
    'score_evidence:',
    '  cv_match: "{supported | partial | unknown}"',
    'confidence_gaps: []',
    '```',
  ].join('\n'));
  assert.deepEqual(h.scoreEvidence, {});
});

test('routes/reports.mjs spreads parseReportHeader into the detail payload (wiring canary)', () => {
  assert.match(ROUTE, /\.\.\.parseReportHeader\(text/,
    'the new scoreEvidence/confidenceGaps keys reach the client through the existing spread');
});

// ───────────────────────── view layer (source canaries — browser-only file) ─────────────────────────

test('reports.js renders the green confirmed chip with a list title', () => {
  assert.match(SRC, /badge badge-ok/, 'green chip uses the established badge-ok class');
  assert.match(SRC, /evc\.confirmed/, 'chip label via evc.confirmed');
  assert.match(SRC, /evc\.confirmedTitle/, 'title (the list) via evc.confirmedTitle');
});

test('reports.js renders the amber gaps chip only when gaps exist', () => {
  assert.match(SRC, /badge badge-warn/, 'amber chip uses the established badge-warn class');
  assert.match(SRC, /evc\.gaps/, 'chip label via evc.gaps');
  assert.match(SRC, /evc\.gapsTitle/, 'title (the list) via evc.gapsTitle');
});

test('reports.js renders NO evidence block when the report carries neither field', () => {
  // The block exists only under the both-empty guard.
  assert.match(SRC, /evcSupported\.length \|\| evcGaps\.length/,
    'the both-empty guard gates the whole block');
});

test('reports.js evidence chips are CSP-safe (title attribute, no innerHTML)', () => {
  const block = SRC.match(/const evcDims[\s\S]*?const evcChips[\s\S]*?\.filter\(Boolean\)\)/);
  assert.ok(block, 'the evc block builder is present');
  assert.ok(!block[0].includes('innerHTML'), 'no innerHTML anywhere in the block builder');
  assert.match(block[0], /title:/, 'lists ride the title attribute');
});

test('evc.* keys exist in all 19 locale dicts, non-empty', () => {
  const dict = JSON.parse(JSON.stringify(loadAssembledDict()));
  for (const key of ['evc.confirmed', 'evc.gaps', 'evc.confirmedTitle', 'evc.gapsTitle']) {
    for (const lang of I18N_LANGS) {
      const v = dict[key] && dict[key][lang];
      assert.equal(typeof v, 'string', `${key} must exist in ${lang}`);
      assert.ok(v.length > 0, `${key} must be non-empty in ${lang}`);
    }
  }
});
