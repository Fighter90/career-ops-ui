/**
 * server/lib/states.mjs — canonical application-state reader (parent web/ port
 * #2, v1.128.0). Verifies the live `templates/states.yml` read, the CI-safe
 * hardcoded fallback, and alias/id/label canonicalization.
 *
 * CI-isolated. Because `paths.mjs` resolves PROJECT_ROOT once per process (and
 * only accepts a root that has cv.md/portals.yml), all tests share ONE bootstrap
 * root (with a portals.yml marker) set in before(); we toggle the presence of
 * templates/states.yml between tests and reset states.mjs's per-process cache —
 * never touching the real parent (see tests/test-root-isolation).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let ROOT;
let STATES_YML;
let states;

before(async () => {
  ROOT = mkdtempSync(join(tmpdir(), 'states-'));
  // Marker so resolveProjectRoot() accepts this temp dir as the project root.
  writeFileSync(join(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  mkdirSync(join(ROOT, 'templates'), { recursive: true });
  STATES_YML = join(ROOT, 'templates', 'states.yml');
  process.env.CAREER_OPS_ROOT = ROOT;
  states = await import('../server/lib/states.mjs'); // first paths.mjs import binds PROJECT_ROOT here
});

after(() => { if (ROOT) rmSync(ROOT, { recursive: true, force: true }); });

/** Ensure states.yml is absent, then drop the cache so the fallback is read. */
function useFallback() {
  rmSync(STATES_YML, { force: true });
  states._resetStatesCache();
}
/** Write a states.yml, then drop the cache so it is read live. */
function useFile(yml) {
  writeFileSync(STATES_YML, yml);
  states._resetStatesCache();
}

test('SANITY: PATHS.statesYml resolves under our temp root (isolation guard)', async () => {
  // node --test isolates each test FILE in its own process, so before() binds
  // PROJECT_ROOT to our temp ROOT. If that ever stops holding (shared process,
  // an earlier paths.mjs import), this fails LOUDLY instead of the fallback
  // assertions silently passing against the REAL parent's states.yml.
  const { PATHS } = await import('../server/lib/paths.mjs');
  assert.equal(PATHS.statesYml, STATES_YML, 'states.mjs must read OUR temp states.yml, not the real parent');
  assert.ok(PATHS.statesYml.startsWith(ROOT), 'statesYml must live under the temp CAREER_OPS_ROOT');
});

test('falls back to the built-in 10 states when states.yml is absent', () => {
  useFallback();
  assert.deepEqual(
    states.canonicalLabels(),
    ['Evaluated', 'Applied', 'Responded', 'Assessment', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP', 'Hired'],
  );
});

test('fallback canonicalizeStatus folds label/id/alias, tolerates ** / trim / junk', () => {
  useFallback();
  assert.equal(states.canonicalizeStatus('Applied'), 'Applied');       // label
  assert.equal(states.canonicalizeStatus('applied'), 'Applied');       // case-insensitive
  assert.equal(states.canonicalizeStatus('hired'), 'Hired');           // id
  assert.equal(states.canonicalizeStatus('contratado'), 'Hired');      // Spanish alias
  assert.equal(states.canonicalizeStatus('evaluada'), 'Evaluated');
  assert.equal(states.canonicalizeStatus('**Offer**'), 'Offer');       // stray markdown bold
  assert.equal(states.canonicalizeStatus('  responded '), 'Responded'); // trimmed
  assert.equal(states.canonicalizeStatus('nonsense'), null);
  assert.equal(states.canonicalizeStatus(''), null);
  assert.equal(states.canonicalizeStatus(null), null);
});

test('FALLBACK folds the parent Turkish aliases (v1.178.0 / parent #2615 parity)', () => {
  useFallback();
  assert.equal(states.canonicalizeStatus('değerlendirildi'), 'Evaluated');
  assert.equal(states.canonicalizeStatus('başvuruldu'), 'Applied');
  assert.equal(states.canonicalizeStatus('mülakat'), 'Interview');
  assert.equal(states.canonicalizeStatus('teklif'), 'Offer');
  assert.equal(states.canonicalizeStatus('reddedildi'), 'Rejected');
  assert.equal(states.canonicalizeStatus('işe alındı'), 'Hired');
});

test('reads templates/states.yml live (a label/alias only in the file)', () => {
  useFile(
    'states:\n' +
    '  - id: applied\n    label: Applied\n    aliases: [aplicado, enviada]\n    dashboard_group: applied\n' +
    '  - id: custom\n    label: CustomState\n    aliases: [foo]\n    dashboard_group: custom\n',
  );
  assert.ok(states.canonicalLabels().includes('CustomState'), 'label only present in the file is read live');
  assert.equal(states.canonicalizeStatus('foo'), 'CustomState', 'file-defined alias folds to its label');
  assert.equal(states.canonicalizeStatus('aplicado'), 'Applied');
  assert.ok(!states.canonicalLabels().includes('Hired'), 'the fallback is NOT merged in when the file is read');
});

test('malformed states.yml (no states array) falls back', () => {
  useFile('garbage: true\n');
  assert.ok(states.canonicalLabels().includes('Evaluated'), 'fallback used on malformed file');
  assert.equal(states.canonicalLabels().length, 10);
});

test('the FALLBACK is NOT cached — a file appearing later is picked up without a reset', () => {
  // Boot-race guard (v1.129.1): read with the file absent → fallback; then the
  // file appears. WITHOUT calling _resetStatesCache, the next read must pick it
  // up (proving the fallback was returned uncached, not pinned for the process).
  rmSync(STATES_YML, { force: true });
  states._resetStatesCache();
  assert.ok(!states.canonicalLabels().includes('LateState'), 'fallback while absent');
  writeFileSync(STATES_YML,
    'states:\n  - id: late\n    label: LateState\n    dashboard_group: late\n');
  // no _resetStatesCache() here — the fallback must not have been memoized
  assert.ok(states.canonicalLabels().includes('LateState'), 'file appearing later is read on the next call');
});

// ── branch hardening (CAR-269: the per-file branch baseline on states.mjs
// measured below the ratchet floor on CI's Node 20 — V8 branch accounting
// differs per version; these lock the remaining fallback paths so every Node
// version clears the ratchet with margin) ──

test('a read error other than ENOENT (states.yml is a directory) warns and falls back', () => {
  rmSync(STATES_YML, { force: true });
  mkdirSync(STATES_YML); // readFileSync on a directory → EISDIR, not ENOENT
  states._resetStatesCache();
  const warns = [];
  const orig = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  try {
    assert.equal(states.canonicalLabels().length, 10, 'the built-in fallback serves the read');
  } finally {
    console.warn = orig;
    rmSync(STATES_YML, { recursive: true, force: true });
  }
  assert.match(warns.join(' '), /failed to read/, 'a non-ENOENT read error is worth the drift warn');
});

test('states.yml with an EMPTY states array falls back (present but unusable)', () => {
  const warns = [];
  const orig = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  try {
    useFile('states: []\n');
    assert.equal(states.canonicalLabels().length, 10, 'an empty states list is not a usable read');
  } finally {
    console.warn = orig;
  }
  assert.match(warns.join(' '), /no usable states/);
});

test('every entry unusable (null or label-less) skips the rows and falls back', () => {
  const warns = [];
  const orig = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  try {
    useFile('states:\n  - null\n  - 42\n  - description: no label here\n');
    assert.equal(states.canonicalLabels().length, 10, 'a parse with zero usable rows is a fallback, not an empty board');
  } finally {
    console.warn = orig;
  }
  assert.match(warns.join(' '), /no usable states/);
});

test('a file entry without id derives the id from the label; non-string aliases are filtered; a missing dashboard_group falls back to the id', () => {
  useFile('states:\n  - label: FromLabel\n    aliases: [ok, 42, "also-ok"]\n');
  assert.ok(states.canonicalLabels().includes('FromLabel'));
  assert.equal(states.canonicalizeStatus('fromlabel'), 'FromLabel',
    'the id is derived from the label when the file omits it');
  assert.equal(states.canonicalizeStatus('ok'), 'FromLabel');
  assert.equal(states.canonicalizeStatus('also-ok'), 'FromLabel');
  assert.equal(states.canonicalizeStatus('42'), null, 'a non-string alias is filtered out of the fold');
});

test('invalid YAML (unterminated flow sequence) fails to parse and falls back', () => {
  const warns = [];
  const orig = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  try {
    useFile('states: [unclosed\n');
    assert.equal(states.canonicalLabels().length, 10, 'a parse error falls back instead of throwing');
  } finally {
    console.warn = orig;
  }
  assert.match(warns.join(' '), /failed to parse/);
});
