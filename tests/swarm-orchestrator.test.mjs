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

// ── the executor's issue-identity pin (live-run regression: the CAR-258 executor
// fetched and implemented ANOTHER issue's body — ibm/oraclecloud scope instead of
// talentlink/google — because its prompt told it to "fetch the full issue BODY"
// without naming which issue). The develop-phase DESCRIPTION must repeat the
// identifier, and the executor role prompt must pin the identity. ──

test('develop prompt: the executor DESCRIPTION instruction names the exact identifier', async () => {
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../scripts/swarm/orchestrator.mjs', import.meta.url), 'utf8'),
  );
  // The DESCRIPTION literal handed to the executor worker must carry the
  // {{IDENTIFIER}} interpolation — the body to fetch is EXACTLY this issue's.
  assert.match(
    src,
    /DESCRIPTION: `[^`]*EXACTLY \$\{issue\.identifier\}[^`]*`/,
    'executor DESCRIPTION must interpolate the picked issue identifier (fetch EXACTLY <id>…)',
  );
});

test('executor role prompt: rule 7 pins the issue identity', async () => {
  const fs = await import('node:fs');
  const role = fs.readFileSync(new URL('../scripts/swarm/roles/executor.md', import.meta.url), 'utf8');
  assert.match(role, /\{\{IDENTIFIER\}\}/, 'the identity pin must be templated per run');
  assert.match(
    role,
    /never fetch or implement any other issue['’s ]* body/i,
    'rule 7 must forbid fetching/implementing another issue’s body',
  );
});
