/**
 * CAR-175 — the prod-llm summary must NAME its failures, not count them.
 *
 * Two observability holes in the live-LLM regression report:
 *   1. the scan line printed only "stderr lines N" — which source failed and
 *      why was invisible, so every scan finding needed a manual browser pass;
 *   2. the evaluate cell showed no output-token counter, so a truncated or
 *      suspiciously short report could not be checked against the provider's
 *      own usage numbers.
 *
 * The script itself needs a deployed prod host and a real browser, so the
 * summary logic lives in pure helpers (scripts/remote-qa/summary-parts.mjs,
 * same pattern as redact.mjs / lang-check.mjs) and this suite drives them
 * directly — mock scan-console fixture, no network, no Playwright — plus a
 * source guard that prod-llm.mjs actually uses them (no drifted inline copy).
 *
 * Honesty rule: a sample list is capped (10 × 160 chars, redacted BEFORE the
 * cut — the makeRedactor contract) and a missing provider usage prints
 * nothing, never "tok ?".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRedactor } from '../scripts/remote-qa/redact.mjs';
import { collectErrTexts, scanSummaryBlock, summaryCell, evalOutTokens } from '../scripts/remote-qa/summary-parts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(resolve(ROOT, 'scripts/remote-qa/prod-llm.mjs'), 'utf8');
const redact = makeRedactor('https://prod.example.org/');

// ── mock scan console (the script's exact call shape) ────────────────────────
function mockScanConsolePage(errTexts) {
  return {
    locator(sel) {
      assert.equal(sel, '#scan-console span.err');
      return {
        count: async () => errTexts.length,
        allInnerTexts: async () => [...errTexts],
      };
    },
  };
}

test('collectErrTexts: both failing sources are named and the prod host is redacted', async () => {
  const page = mockScanConsolePage([
    '✗ greenhouse error: fetch failed — GET https://prod.example.org/api/scan (see server log)',
    '✗  lever error: timeout after 60s',
  ]);
  const errLines = await page.locator('#scan-console span.err').count();
  const errTexts = collectErrTexts(await page.locator('#scan-console span.err').allInnerTexts(), redact);
  assert.equal(errLines, 2);
  assert.equal(errTexts.length, 2);
  assert.match(errTexts[0], /greenhouse error/);
  assert.match(errTexts[1], /lever error/);
  // the makeRedactor contract, asserted exactly — substring inclusion proves nothing
  // about WHICH host was masked, so pin the whole masked output and forbid the raw
  // host as a standalone token (boundary-guarded, so a longer host sharing the
  // suffix still fails the check only when it is genuinely this one).
  assert.deepEqual(errTexts, [
    '✗ greenhouse error: fetch failed — GET <prod>/api/scan (see server log)',
    '✗ lever error: timeout after 60s',
  ]);
});

test('collectErrTexts: capped at 10 samples, whitespace flattened, empties dropped', () => {
  const many = Array.from({ length: 14 }, (_, i) => `✗ source-${i} error:\n  boom  ${i}`);
  const out = collectErrTexts(many, redact);
  assert.equal(out.length, 10);
  for (const t of out) assert.ok(!/\n/.test(t) && !/  /.test(t), 'single flattened line expected');
  assert.deepEqual(collectErrTexts(['  ', '', 'real one'], redact), ['real one']);
  assert.deepEqual(collectErrTexts(undefined, redact), []);
});

test('collectErrTexts: redacts BEFORE the 160-char cut (host never cut mid-name)', () => {
  const long = '✗ ru-scanner error: ' + 'x'.repeat(150) + ' at https://prod.example.org/js/app.js:1';
  const out = collectErrTexts([long], redact);
  assert.ok(out.length === 1 && out[0].length <= 160);
});

test('evalOutTokens: the provider shapes llm-usage.mjs normalizes are all read', () => {
  assert.equal(evalOutTokens({ output_tokens: 1234 }), 1234);              // Anthropic
  assert.equal(evalOutTokens({ completion_tokens: 55 }), 55);              // OpenAI-compatible
  assert.equal(evalOutTokens({ candidatesTokenCount: 100, thoughtsTokenCount: 20 }), 120); // Gemini (both billed)
  assert.equal(evalOutTokens({ prompt_tokens: 9000 }), null);              // input only → no honest number
  assert.equal(evalOutTokens({}), null);
  assert.equal(evalOutTokens(undefined), null);
  assert.equal(evalOutTokens({ output_tokens: 'many' }), null);            // malformed → nothing printed
});

// ── summary rendering ─────────────────────────────────────────────────────────
const scanBase = { secs: 87, phases: ['ATS NEW=3', 'Regional NEW=1'], failed: [], errLines: 2, before: 410, after: 414, busyWaits: 0 };

test('scanSummaryBlock: empty samples keep the legacy line byte-identical, no samples label', () => {
  const legacy = '**Scan (#/scan, all sources):** 87s · ATS NEW=3 · Regional NEW=1 · stderr lines 0 · result rows 410 → 414';
  assert.equal(scanSummaryBlock({ ...scanBase, errLines: 0, errTexts: [] }), legacy);
  assert.equal(scanSummaryBlock({ ...scanBase, errLines: 0 }), legacy); // pre-fix scan objects still render
  assert.ok(!scanSummaryBlock({ ...scanBase, errLines: 0, errTexts: [] }).includes('stderr samples'));
});

test('scanSummaryBlock: samples become a "stderr samples" sub-list, host redacted, pipes escaped', () => {
  const block = scanSummaryBlock({ ...scanBase, errTexts: collectErrTexts([
    '✗ greenhouse error: fetch failed https://prod.example.org/x | y',
    '✗ lever error: timeout',
  ], redact) });
  assert.match(block, /stderr lines 2/);
  assert.match(block, /stderr samples:\n- ✗ greenhouse error[^\n]*<prod>[^\n]*\| y\n- ✗ lever error: timeout/);
  // exact masked block from the makeRedactor contract — not a host-substring check
  assert.equal(block, [
    '**Scan (#/scan, all sources):** 87s · ATS NEW=3 · Regional NEW=1 · stderr lines 2 · result rows 410 → 414',
    '',
    'stderr samples:',
    '- ✗ greenhouse error: fetch failed <prod>/x \\| y',
    '- ✗ lever error: timeout',
  ].join('\n'));
});

test('summaryCell: an eval with usage gains "tok ~N"; without it the legacy cell is byte-identical', () => {
  const legacyDocs = '200 · gemini · 3s · 812 ch · lang ✓';
  assert.equal(summaryCell({ status: 200, mode: 'gemini', ms: 3000, len: 812, lang: true }), legacyDocs);
  const legacyEval = '200 · claude · 45s · 5234 ch · lang ✓ · A–G ✓';
  assert.equal(summaryCell({ status: 200, mode: 'claude', ms: 45_000, len: 5234, lang: true, shape: true }), legacyEval);
  // usage present → provider counter appended
  assert.equal(
    summaryCell({ status: 200, mode: 'claude', ms: 45_000, len: 5234, outTok: evalOutTokens({ output_tokens: 1234 }), lang: true, shape: true }),
    '200 · claude · 45s · 5234 ch · tok ~1234 · lang ✓ · A–G ✓',
  );
  // usage missing → no "tok ?" ever
  const noTok = summaryCell({ status: 200, mode: 'openai', ms: 45_000, len: 5234, outTok: evalOutTokens(undefined), lang: false, shape: false });
  assert.equal(noTok, '200 · openai · 45s · 5234 ch · lang ✗ · A–G ✗');
  assert.ok(!noTok.includes('tok'));
});

// ── prod-llm.mjs wiring (drift guards) ────────────────────────────────────────
test('prod-llm collects span.err texts through the helper, redacted at the call site', () => {
  assert.match(SRC, /from '\.\/summary-parts\.mjs'/, 'summary-parts import missing');
  assert.match(SRC, /collectErrTexts\(\s*await page\.locator\('#scan-console span\.err'\)\.allInnerTexts\(\),\s*redact\s*\)/,
    'span.err innerText must be collected through collectErrTexts with the script redactor');
  assert.match(SRC, /span\.err'\)\.count\(\)/, 'the total stderr counter must stay');
  assert.match(SRC, /errTexts/, 'scan object must carry errTexts');
});

test('prod-llm forwards the evaluate usage into the cell and renders through the helpers', () => {
  assert.match(SRC, /outTok:\s*evalOutTokens\(e\.body\.usage\)/, 'evaluate usage must be captured');
  assert.match(SRC, /scanSummaryBlock\(scan\)/);
  assert.match(SRC, /summaryCell\(r\.eval\)/);
  assert.match(SRC, /summaryCell\(r\.docs\)/);
  assert.ok(!/^const cell = /m.test(SRC), 'an inline cell copy would drift from the tested helper');
  assert.match(SRC, /^const md = mdEscape;/m, 'cell escaping must be the tested mdEscape helper');
});
