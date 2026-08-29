/**
 * ru-scanner dedup + per-query filtering (v1.227.5).
 *
 * The scanner used to accumulate EVERY raw hit from every query and only
 * dedup/filter at the end. With 21 near-synonym queries ("Golang",
 * "Go разработчик", "Golang разработчик", "Senior Go"…) the same vacancy comes
 * back once per query, so the array held several times the unique count — it
 * peaked at ~742MB locally, while the server caps Node's heap at 490MB on its
 * 956MB of RAM. The scan OOM-killed the service four times in one day, and only
 * started failing when the query list grew from 14 to 21.
 *
 * Dedup and filtering now happen per query, which took the same run to ~177MB.
 * That is a memory change, NOT a behaviour change, and these tests pin the two
 * places where it could silently become one:
 *
 *   1. the reported "Total found" must still be the UNIQUE raw count — it is
 *      now carried by a Set of URL strings rather than by retaining the objects;
 *   2. last-wins per URL must survive, including the awkward direction: a later
 *      duplicate that FAILS the filters has to remove an earlier one that
 *      passed, because the old end-of-run pass would have kept only the last
 *      copy and then filtered it out.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// The per-query reduction, extracted so it can be exercised without a network
// or a config file. Mirrors the loop body in ru-scanner.mjs exactly.
function reduceHits(queryResults, passesAll) {
  const allUrls = new Set();
  const uniq = new Map();
  for (const results of queryResults) {
    for (const job of results) {
      allUrls.add(job.url);
      if (passesAll(job)) uniq.set(job.url, job);
      else uniq.delete(job.url);
    }
  }
  return { totalUnique: allUrls.size, kept: [...uniq.values()] };
}

/** The equivalent of the OLD code: accumulate everything, then dedup, then filter. */
function reduceHitsLegacy(queryResults, passesAll) {
  const all = [];
  for (const results of queryResults) all.push(...results);
  const uniq = new Map();
  for (const j of all) uniq.set(j.url, j);
  const flat = [...uniq.values()];
  return { totalUnique: flat.length, kept: flat.filter(passesAll) };
}

const ok = (j) => !/junior/i.test(j.title);

test('"Total found" counts unique URLs, not retained objects', () => {
  const queries = [
    [{ url: 'a', title: 'Go Dev' }, { url: 'b', title: 'Junior Go' }],
    [{ url: 'a', title: 'Go Dev' }, { url: 'c', title: 'Senior Go' }],
  ];
  const r = reduceHits(queries, ok);
  assert.equal(r.totalUnique, 3, 'a, b, c — the repeat of `a` must not inflate the total');
  assert.deepEqual(r.kept.map((j) => j.url), ['a', 'c'], 'the junior row is filtered out');
});

test('a later duplicate that FAILS removes an earlier one that passed', () => {
  // This is the direction that a naive "only ever set" implementation gets
  // wrong: the old code kept the LAST copy and then filtered it, so the row
  // must not survive here either.
  const queries = [
    [{ url: 'x', title: 'Senior Go' }],
    [{ url: 'x', title: 'Junior Go' }],
  ];
  const r = reduceHits(queries, ok);
  assert.deepEqual(r.kept, [], 'the failing later copy must evict the earlier survivor');
  assert.equal(r.totalUnique, 1);
});

test('a later duplicate that PASSES replaces an earlier one that failed', () => {
  const queries = [
    [{ url: 'x', title: 'Junior Go' }],
    [{ url: 'x', title: 'Senior Go' }],
  ];
  const r = reduceHits(queries, ok);
  assert.deepEqual(r.kept.map((j) => j.title), ['Senior Go']);
});

test('per-query reduction matches the legacy accumulate-then-filter result', () => {
  // Randomised equivalence: same URLs recurring across queries with varying
  // titles, which is exactly what near-synonym queries produce.
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let trial = 0; trial < 200; trial++) {
    const queries = [];
    for (let q = 0; q < 5; q++) {
      const results = [];
      for (let i = 0; i < 6; i++) {
        results.push({
          url: 'u' + Math.floor(rnd() * 5),
          title: (rnd() < 0.5 ? 'Junior ' : 'Senior ') + 'Go',
        });
      }
      queries.push(results);
    }
    const a = reduceHits(queries, ok);
    const b = reduceHitsLegacy(queries, ok);
    assert.equal(a.totalUnique, b.totalUnique, 'unique totals diverged');
    assert.deepEqual(
      a.kept.map((j) => j.url + '|' + j.title).sort(),
      b.kept.map((j) => j.url + '|' + j.title).sort(),
      'retained rows diverged',
    );
  }
});

test('an empty run reports nothing rather than throwing', () => {
  const r = reduceHits([], ok);
  assert.equal(r.totalUnique, 0);
  assert.deepEqual(r.kept, []);
});
