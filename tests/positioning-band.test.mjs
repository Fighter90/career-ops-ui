/**
 * CAR-262 (parent-sync #8, upstream #6789) — the optional positioning band
 * beside the 1–5 score.
 *
 * The parent added `positioning_band` to the evaluation contract: challenge,
 * target, safety_net, out_of_scope or unknown, with a one-sentence reason and
 * the four evidence inputs (role family, seniority, required experience,
 * scope). It sits BESIDE the score and never changes it.
 *
 * web-ui's two-step contract (CAR-229) is the analog surface: the scoring
 * JSON gains the fields, normalizeScoring allowlists the enum (unknown over
 * guessing), and the SERVER renders the report line + the machine fields in
 * the header/SCORE_SUMMARY/yaml it already owns.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { normalizeScoring, assembleReport, buildScoringPromptParts } = await import('../server/lib/eval-scoring.mjs');

const intBlocks = (n = 4) => Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((L) => [L, { score: n, summary: 'x' }]));
const SCORING = { company: 'Netwrk', role: 'Team Lead Go', archetype: 'backend', legitimacy: 'Proceed with Caution', score: 4.9, blocks: intBlocks(4) };

test('normalizeScoring: a valid band, reason and evidence are carried through', () => {
  const n = normalizeScoring({
    ...SCORING,
    positioning_band: 'challenge',
    positioning_band_reason: 'One level above the CV role with explicit stretch gaps.',
    positioning_band_evidence: { role_family: 'supported', seniority: 'partial', required_experience: 'supported', scope: 'unknown' },
  });
  assert.equal(n.positioningBand, 'challenge');
  assert.equal(n.positioningBandReason, 'One level above the CV role with explicit stretch gaps.');
  assert.deepEqual(n.positioningBandEvidence, { role_family: 'supported', seniority: 'partial', required_experience: 'supported', scope: 'unknown' });
});

test('normalizeScoring: the enum is closed — junk or case-mismatched values fall to unknown', () => {
  assert.equal(normalizeScoring({ ...SCORING, positioning_band: 'stretch' }).positioningBand, 'unknown');
  assert.equal(normalizeScoring({ ...SCORING, positioning_band: 42 }).positioningBand, 'unknown');
  assert.equal(normalizeScoring({ ...SCORING, positioning_band: 'Challenge' }).positioningBand, 'challenge', 'case is normalized');
  assert.equal(normalizeScoring(SCORING).positioningBand, 'unknown', 'absent → unknown (never a guess)');
});

test('normalizeScoring: evidence keys are closed to supported|partial|unknown; a non-object maps to all unknown', () => {
  const junk = normalizeScoring({ ...SCORING, positioning_band_evidence: { role_family: 'yes', scope: 7 } });
  assert.deepEqual(junk.positioningBandEvidence, { role_family: 'unknown', seniority: 'unknown', required_experience: 'unknown', scope: 'unknown' });
  const absent = normalizeScoring(SCORING).positioningBandEvidence;
  assert.deepEqual(absent, { role_family: 'unknown', seniority: 'unknown', required_experience: 'unknown', scope: 'unknown' });
  const arr = normalizeScoring({ ...SCORING, positioning_band_evidence: ['x'] }).positioningBandEvidence;
  assert.deepEqual(arr, { role_family: 'unknown', seniority: 'unknown', required_experience: 'unknown', scope: 'unknown' });
});

test('normalizeScoring: the reason is whitespace-flattened and capped, never forged', () => {
  const n = normalizeScoring({ ...SCORING, positioning_band_reason: '  a\n\nb\tc  ' });
  assert.equal(n.positioningBandReason, 'a b c');
});

test('assembleReport: the band line sits in the header beside the score — server-rendered', () => {
  const scoring = normalizeScoring({
    ...SCORING,
    positioning_band: 'target',
    positioning_band_reason: 'Well aligned with the current band.',
  });
  const md = assembleReport({ scoring, body: '## A) Role Summary\nprose', today: '2026-11-12', url: 'https://jobs.example/x' });
  const header = md.slice(0, md.indexOf('## A)'));
  assert.match(header, /\*\*Score:\*\* 4\/5\n\*\*Positioning band:\*\* target — Well aligned with the current band\./, 'the line follows the score line');
  assert.match(header, /\*\*Positioning band:[\s\S]*?\*\*URL:\*\*/, 'it stays above the URL line (header order kept)');
});

test('assembleReport: unknown band renders honestly, without a dangling dash', () => {
  const md = assembleReport({ scoring: normalizeScoring(SCORING), body: '## A) x', today: '2026-11-12' });
  assert.match(md, /\*\*Positioning band:\*\* unknown\n/);
  assert.ok(!md.includes('unknown —'), 'no em dash after a reason-less band');
});

test('assembleReport: the machine surfaces carry the band (SCORE_SUMMARY + yaml)', () => {
  const scoring = normalizeScoring({ ...SCORING, positioning_band: 'safety_net', positioning_band_reason: 'One band below, still aligned.' });
  const md = assembleReport({ scoring, body: '## A) x', today: '2026-11-12' });
  assert.match(md, /POSITIONING_BAND: safety_net/);
  assert.match(md, /POSITIONING_BAND_REASON: One band below, still aligned\./);
  assert.match(md, /positioning_band: safety_net/);
  assert.match(md, /positioning_band_reason: "/);
  assert.match(md, /positioning_band_evidence: \{role_family: unknown, seniority: unknown, required_experience: unknown, scope: unknown\}/);
});

test('assembleReport: a scoring object without the fields keeps its exact prior byte shape', () => {
  const md = assembleReport({ scoring: { company: 'C', role: 'R', archetype: 'a', legitimacy: 'High Confidence', score: 4, blocks: intBlocks(4) }, body: '## A) x', today: '2026-11-12' });
  assert.ok(!md.includes('Positioning band'), 'no band line without the field');
  assert.ok(!md.includes('POSITIONING_BAND'), 'no summary line without the field');
  assert.ok(!md.includes('positioning_band'), 'no yaml key without the field');
});

test('scoring prompt contract: the schema names the five values and the anti-guessing rules', () => {
  const { stable } = buildScoringPromptParts('JD');
  assert.match(stable, /positioning_band/);
  for (const v of ['challenge', 'target', 'safety_net', 'out_of_scope', 'unknown']) {
    assert.ok(stable.includes(v), `the enum value ${v} is in the schema`);
  }
  assert.match(stable, /never changes/i, 'beside the score, never changes it');
  assert.match(stable, /title alone/i, 'never classify from the title alone');
  assert.match(stable, /unknown/i);
  assert.match(stable, /positioning_band_evidence/);
});
