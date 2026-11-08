// parsePickOutput — the swarm orchestrator's Linear-pick parser and its identifier
// validator. Regression: the first live run had the clerk echo the FORMAT TEMPLATE
// (SWARM_PICK::<issueId>::<identifier>::<title> with literal angle-bracket
// placeholders); the old parser happily returned `<identifier>` as the issue, the
// branch checkout failed, and an executor started on `main`. The validator must
// refuse anything that is not a real Linear identifier (e.g. CAR-252).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePickOutput } from '../scripts/swarm/orchestrator.mjs';

test('parses a real pick line', () => {
  const issue = parsePickOutput('blah\nSWARM_PICK::uuid-1::CAR-252::#/health: FIX_TARGETS keys\ntrailer');
  assert.deepEqual(issue, { id: 'uuid-1', identifier: 'CAR-252', title: '#/health: FIX_TARGETS keys' });
});

test('NONE means an empty queue', () => {
  assert.equal(parsePickOutput('SWARM_PICK::NONE'), null);
});

test('REFUSES the literal placeholder echo (the first-run regression)', () => {
  // The <…> check runs first, so the template echo is reported as placeholders.
  assert.throws(
    () => parsePickOutput('SWARM_PICK::<issueId>::<identifier>::<title>'),
    /placeholder characters/,
  );
});

test('REFUSES placeholder characters anywhere in the payload', () => {
  assert.throws(() => parsePickOutput('SWARM_PICK::uuid::<CAR-1>::title'), /placeholder characters/);
  assert.throws(() => parsePickOutput('SWARM_PICK::uuid::CAR-1::<title>'), /placeholder characters/);
});

test('REFUSES garbage that does not name an issue', () => {
  assert.throws(() => parsePickOutput('SWARM_PICK::uuid::hello world::title'), /non-issue identifier/);
  assert.throws(() => parsePickOutput('no marker at all'), /cannot parse/);
});
