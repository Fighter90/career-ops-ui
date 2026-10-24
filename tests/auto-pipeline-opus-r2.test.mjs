/**
 * Opus 5-5 review SECOND pass on CAR-91/92 — the gemini subprocess summary
 * synthesis (M3).
 *
 *   M3. synthesizeGeminiSummary's clean() kept the bold marker: the parent's
 *       saved form `**Legitimacy:** High Confidence` captured `** High
 *       Confidence`, the written `LEGITIMACY: ** High Confidence` then failed
 *       extractLegitimacy's startsWith('high') — legitimacy was always '' on
 *       the subprocess path. The archetype capture had the same problem.
 *       clean() now strips leading/trailing [*_ \t] before slicing.
 *
 * CI-isolated: pure module + routes module, dynamic import inside before(),
 * CAREER_OPS_ROOT is a throwaway dir with cv.md. No network, no server.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let ROOT;
let synthesizeGeminiSummary, extractLegitimacy;

// The parent's oferta report shape — bold field lines, no SCORE_SUMMARY block.
const BODY = [
  '# Evaluation: Acme — Engineer',
  '**Date:** 2026-10-24',
  '**Score:** 4.2/5',
  '**Legitimacy:** High Confidence',
  '**Archetype:** Platform Generalist',
  'body text',
].join('\n');

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'auto-pipeline-opus-r2-'));
  mkdirSync(resolve(ROOT, 'config'), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  process.env.CAREER_OPS_ROOT = ROOT;
  ({ synthesizeGeminiSummary, extractLegitimacy } =
    await import('../server/lib/routes/auto-pipeline.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  try { rmSync(ROOT, { recursive: true, force: true }); } catch { /* temp dir */ }
});

test('M3: a bold «**Legitimacy:** …» body line synthesizes a clean summary value', () => {
  const md = synthesizeGeminiSummary(BODY, { company: 'Acme', role: 'Engineer' });
  assert.match(md, /^LEGITIMACY: High Confidence$/m, `no bold marker in the written value — got: ${(md.match(/^LEGITIMACY:.*$/m) || [])[0]}`);
});

test('M3: the synthesized legitimacy round-trips through extractLegitimacy', () => {
  const md = synthesizeGeminiSummary(BODY, { company: 'Acme', role: 'Engineer' });
  assert.equal(extractLegitimacy(md), 'High Confidence',
    `the subprocess path must not lose legitimacy — got: ${JSON.stringify(extractLegitimacy(md))}`);
});

test('M3: all three tiers round-trip through the bold body form', () => {
  for (const tier of ['High Confidence', 'Proceed with Caution', 'Suspicious']) {
    const body = BODY.replace('**Legitimacy:** High Confidence', `**Legitimacy:** ${tier}`);
    const md = synthesizeGeminiSummary(body, { company: 'Acme', role: 'Engineer' });
    assert.equal(extractLegitimacy(md), tier, tier);
  }
});

test('M3: the archetype capture loses its bold marker too', () => {
  const md = synthesizeGeminiSummary(BODY, { company: 'Acme', role: 'Engineer' });
  assert.match(md, /^ARCHETYPE: Platform Generalist$/m, `no bold marker — got: ${(md.match(/^ARCHETYPE:.*$/m) || [])[0]}`);
});

test('M3: an already-clean body is unchanged (the plain form still works)', () => {
  const plain = BODY.replace('**Legitimacy:** High Confidence', 'Legitimacy: High Confidence')
    .replace('**Archetype:** Platform Generalist', 'Archetype: Platform');
  const md = synthesizeGeminiSummary(plain, { company: 'Acme', role: 'Engineer' });
  assert.match(md, /^LEGITIMACY: High Confidence$/m);
  assert.match(md, /^ARCHETYPE: Platform$/m);
  assert.equal(extractLegitimacy(md), 'High Confidence');
});
