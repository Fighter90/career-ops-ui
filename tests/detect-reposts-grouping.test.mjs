/**
 * groupRowsByTitle (detect-reposts inverted-index) — differential test.
 *
 * The repost detector used to group a company's rows with an O(N²) nested loop
 * over roleFuzzyMatch. That was replaced by an inverted-index grouping that is
 * meant to produce the EXACT same groups, in the same order, with far fewer
 * fuzzy calls. This test pins that "identical output" claim: for many inputs it
 * compares groupRowsByTitle against a reference re-implementation of the exact
 * old nested loop and requires byte-for-byte-equal groups.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupRowsByTitle } from '../server/lib/detect-reposts.mjs';
import { roleFuzzyMatch } from '../server/lib/role-matcher.mjs';

// The exact grouping the inverted index replaced: seed = first not-yet-used
// row, inner loop appends every later row matching the SEED (exact or fuzzy),
// in array order. Groups emit in seed order.
function naiveGroup(rows) {
  const titleGroups = [];
  const used = new Set();
  for (const row of rows) {
    if (used.has(row)) continue;
    const group = [row];
    used.add(row);
    for (const other of rows) {
      if (used.has(other)) continue;
      if (row.title.toLowerCase() === other.title.toLowerCase() || roleFuzzyMatch(row.title, other.title)) {
        group.push(other);
        used.add(other);
      }
    }
    titleGroups.push(group);
  }
  return titleGroups;
}

const ids = (groups) => groups.map((g) => g.map((r) => r.id));
const mkRows = (titles) => titles.map((title, id) => ({ title, id }));

const CURATED = [
  [], ['Solo Engineer'],
  ['Software Engineer', 'Software Engineer'],                       // exact dup
  ['Software Engineer', 'software engineer', 'SOFTWARE ENGINEER'],  // case-only
  ['Senior Backend Engineer', 'Senior Backend Engineer, Payments'], // specialization split
  ['Data Scientist', 'Senior Data Scientist'],                      // seniority difference
  ['Senior Analytics Engineer', 'Senior Analytics Engineer, People Analytics'],
  ['Frontend Engineer', 'Backend Engineer', 'Platform Engineer'],   // no fuzzy (baseline-only overlap)
  ['Product Manager', 'Product Manager', 'Senior Product Manager', 'Associate Product Manager'],
  ['Machine Learning Engineer', 'ML Engineer', 'Machine Learning Scientist'],
  ['DevOps Engineer', 'Site Reliability Engineer', 'DevOps Engineer', 'SRE'],
  ['Инженер данных', 'Инженер данных', 'Старший инженер данных'],   // non-Latin exact + seniority
  ['Staff Security Engineer', 'Staff Security Engineer, Detection', 'Security Engineer'],
  // ordering sensitivity: same set, different input order
  ['B Engineer, Payments', 'B Engineer', 'B Engineer, Payments'],
  ['B Engineer', 'B Engineer, Payments', 'B Engineer, Payments'],
];

test('groupRowsByTitle matches the naive nested loop on curated cases', () => {
  for (const titles of CURATED) {
    const rows = mkRows(titles);
    assert.deepEqual(ids(groupRowsByTitle(rows)), ids(naiveGroup(rows)),
      `mismatch for: ${JSON.stringify(titles)}`);
  }
});

test('groupRowsByTitle matches the naive nested loop on seeded-random histories', () => {
  // A deterministic LCG (no Math.random — reproducible), building rows from a
  // vocabulary dense enough that exact + fuzzy + non-matches all occur.
  const VOCAB = [
    'Software Engineer', 'Senior Software Engineer', 'Software Engineer, Payments',
    'Data Scientist', 'Senior Data Scientist', 'Machine Learning Engineer',
    'ML Engineer', 'Platform Engineer', 'Backend Engineer', 'Frontend Engineer',
    'Product Manager', 'Senior Product Manager', 'Associate Product Manager',
    'Security Engineer', 'Staff Security Engineer', 'Site Reliability Engineer',
    'Инженер данных', 'Старший инженер данных', 'Analytics Engineer',
    'Analytics Engineer, People Analytics',
  ];
  let s = 123456789 >>> 0;
  const rand = () => { s = (1103515245 * s + 12345) >>> 0; return s / 0xffffffff; };
  for (let trial = 0; trial < 200; trial++) {
    const n = 2 + Math.floor(rand() * 40);
    const titles = Array.from({ length: n }, () => VOCAB[Math.floor(rand() * VOCAB.length)]);
    const rows = mkRows(titles);
    assert.deepEqual(ids(groupRowsByTitle(rows)), ids(naiveGroup(rows)),
      `mismatch (trial ${trial}) for: ${JSON.stringify(titles)}`);
  }
});
