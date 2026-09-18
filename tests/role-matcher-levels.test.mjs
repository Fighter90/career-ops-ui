/**
 * A stated level makes a requisition its own opening (parent parity,
 * career-ops @ 6a9c84c).
 *
 * "Insurance Specialist II" is the employer's own statement that this
 * requisition is not its sibling: a different pay band, scope and req number
 * under one base title. The tokenizer cannot see it — `w.length > 3` drops
 * every roman numeral up to VIII and every single digit — so "Insurance
 * Specialist" and "Insurance Specialist II" tokenized identically and scored a
 * perfect Jaccard ratio. web-ui's repost detector then flags the second
 * requisition as a re-listing of the first. Measured upstream on a 316-posting
 * corpus: 1 title in 20 carries a level.
 *
 * Roman and arabic forms fold onto one number, so "Nurse II" and "Nurse 2"
 * state the SAME level and must still match.
 *
 * CI-isolated: pure functions.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roleFuzzyMatch, extractLevels } from '../server/lib/role-matcher.mjs';

test('extractLevels folds roman and arabic onto one number', () => {
  assert.deepEqual([...extractLevels('Insurance Specialist II')], [2]);
  assert.deepEqual([...extractLevels('Insurance Specialist 2')], [2]);
  assert.deepEqual([...extractLevels('Data Engineer Level 3')], [3]);
  assert.deepEqual([...extractLevels('Nurse, Grade IV')], [4]);
  // A posting hiring at either of two levels states both.
  assert.deepEqual([...extractLevels('Engineer II/III')].sort(), [2, 3]);
  // A suffix after the level must not hide it.
  assert.deepEqual([...extractLevels('Nurse II (Remote)')], [2]);
  assert.deepEqual([...extractLevels('Nurse II, Days')], [2]);
});

test('a digit glued to a letter or a point is not a level', () => {
  for (const title of ['5G Network Engineer', 'Web3 Developer', 'Analyst 3.0 Platform', 'Engineer', 'iOS Developer']) {
    assert.deepEqual([...extractLevels(title)], [], `${JSON.stringify(title)} states no level`);
  }
});

test('a level on both sides must agree', () => {
  assert.equal(roleFuzzyMatch('Registered Nurse 2', 'Registered Nurse 3'), false);
  assert.equal(roleFuzzyMatch('Insurance Specialist I', 'Insurance Specialist II'), false);
  // Same level, different notation → still the same opening.
  assert.equal(roleFuzzyMatch('Registered Nurse II', 'Registered Nurse 2'), true);
  // A stated RANGE overlaps but still does not match, and that is the parent's
  // behaviour too (verified against its implementation, not assumed): "II/III"
  // survives tokenization as the junk token "iiiii" — the slash is stripped and
  // the letters join — which is 5 chars, so it outlives the `w.length > 3`
  // filter and reads as a discriminating word the other title lacks. The level
  // guard is not what rejects this pair; the tokenizer is. Pinned here so a
  // future tokenizer change surfaces as a deliberate decision rather than a
  // silent one.
  assert.equal(roleFuzzyMatch('Software Engineer II/III', 'Software Engineer III'), false);
  assert.deepEqual([...extractLevels('Software Engineer II/III')].sort(), [2, 3], 'the range itself is read correctly');
});

test('a level on ONE side alone is a loose rewrite — unless the vocabulary also differs', () => {
  // Decorating an otherwise identical title: still the same opening.
  assert.equal(roleFuzzyMatch('Insurance Specialist', 'Insurance Specialist II'), true);
  // Each side carries a word the other lacks AND the level is stated on one
  // side only — two disagreements, not a loose rewrite.
  assert.equal(
    roleFuzzyMatch('Front Desk Assistant (Summer Housing)', 'Administrative Assistant II (Housing Front Desk)'),
    false,
  );
});

test('the level rules never override an exact title match', () => {
  assert.equal(roleFuzzyMatch('Registered Nurse II', 'registered nurse ii'), true);
  assert.equal(roleFuzzyMatch('Data Engineer', 'Data Engineer'), true);
});
