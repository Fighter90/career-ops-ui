/**
 * server/lib/sources/_shape.mjs — shared response-shape guards (v1.242.0).
 *
 * Cross-cutting Phase-2 rule (docs/sdd/BACKLOG.md): a 200 with the wrong shape
 * THROWS on page 1 instead of silently reading as an empty board. The helpers
 * are pure shape checks — no fetch, no network — so the tests are plain unit
 * tests over the exported functions.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { requireArray, requireContainer, requireObject } = await import(
  '../server/lib/sources/_shape.mjs'
);

// ---------------------------------------------------------------------------
// requireArray
// ---------------------------------------------------------------------------

test('requireArray: returns the array unchanged', () => {
  const arr = [{ id: 1 }, { id: 2 }];
  assert.equal(requireArray(arr, 'Ashby jobs'), arr);
  assert.deepEqual(requireArray([], 'X'), []);
});

test('requireArray: throws a labelled TypeError on wrong shapes', () => {
  for (const bad of [undefined, null, {}, { jobs: [] }, '[]', 5, true]) {
    assert.throws(() => requireArray(bad, 'Ashby jobs'), (err) => {
      assert.ok(err instanceof TypeError);
      assert.match(err.message, /Ashby jobs/);
      return true;
    }, `expected a throw for ${JSON.stringify(bad)}`);
  }
});

test('requireArray: message describes the actual shape', () => {
  assert.throws(() => requireArray(null, 'Alibaba datas'), /got null/);
  assert.throws(() => requireArray({ a: 1 }, 'Alibaba datas'), /an object with keys \[a\]/);
  assert.throws(() => requireArray('x', 'Alibaba datas'), /a string/);
});

// ---------------------------------------------------------------------------
// requireObject
// ---------------------------------------------------------------------------

test('requireObject: returns objects, rejects arrays, null and primitives', () => {
  const body = { jobs: [] };
  assert.equal(requireObject(body, 'Gem'), body);
  assert.throws(() => requireObject([], 'Gem'), /expected a JSON object.*got an array/);
  assert.throws(() => requireObject(null, 'Gem'), /Gem/);
  assert.throws(() => requireObject('ok', 'Gem'), /Gem/);
});

// ---------------------------------------------------------------------------
// requireContainer
// ---------------------------------------------------------------------------

test('requireContainer: passes when a dotted path resolves', () => {
  const body = { data: { jobs: [1, 2] }, meta: { next: null } };
  assert.equal(requireContainer(body, 'Justjoin', 'data.jobs'), body);
});

test('requireContainer: passes when ANY of the alternative paths resolves', () => {
  const body = { resultaten: [{ id: 1 }] };
  assert.equal(requireContainer(body, 'VDAB', 'vacancies', 'resultaten'), body);
});

test('requireContainer: a present-but-null path is NOT a container', () => {
  // {jobs: null} must not satisfy the container check — the caller wants to
  // know the board stopped speaking its documented shape, not an empty board.
  assert.throws(() => requireContainer({ jobs: null }, 'Ashby', 'jobs'), /Ashby/);
});

test('requireContainer: throws when no path resolves; message names the paths and the keys seen', () => {
  assert.throws(
    () => requireContainer({ error: 'cloudflare' }, 'Greenhouse', 'jobs', 'data.jobs'),
    (err) => {
      assert.match(err.message, /Greenhouse/);
      assert.match(err.message, /jobs, data\.jobs/);
      assert.match(err.message, /error/);
      return true;
    }
  );
});

test('requireContainer: rejects non-objects before path checks', () => {
  assert.throws(() => requireContainer('{"jobs":[]}', 'Workable', 'jobs'), /Workable/);
  assert.throws(() => requireContainer([{ id: 1 }], 'Workable', 'jobs'), /an array/);
});

test('requireContainer: array-index segments resolve', () => {
  const body = { pages: [{ jobs: [1] }] };
  assert.equal(requireContainer(body, 'Taleo', 'pages.0.jobs'), body);
});
