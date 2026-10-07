/**
 * Phase-2 wrong-shape contract (v1.242.0 sources-6) for the two sources that
 * had no dedicated wrong-shape coverage: recruitee (JSON API) and personio
 * (XML feed). A 200 with the wrong shape THROWS — never a silent [] (the
 * meituan/tencent contract; see server/lib/sources/_shape.mjs).
 *
 * CI-isolated: fake fetchImpl, no network, no fixtures outside this file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseRecruiteeResponse, fetchRecruitee } from '../server/lib/sources/recruitee.mjs';
import { parsePersonioXml, fetchPersonio } from '../server/lib/sources/personio.mjs';

// ── recruitee: { offers: [...] } is the documented envelope ────────────────

test('recruitee: a wrong-shape body THROWS (Phase-2, never silent [])', () => {
  for (const bad of [{}, { offers: null }, { offers: {} }, null, 'nope', 42]) {
    assert.throws(() => parseRecruiteeResponse(bad, 'X'), (err) => {
      assert.ok(err instanceof TypeError);
      assert.match(err.message, /Recruitee/);
      return true;
    }, `expected a throw for ${JSON.stringify(bad)}`);
  }
  // An empty offers array stays a legitimate empty board.
  assert.deepEqual(parseRecruiteeResponse({ offers: [] }, 'X'), []);
});

test('recruitee: a 200 with the wrong shape throws through the fetch', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ nope: true }) });
  await assert.rejects(
    () => fetchRecruitee('https://acme.recruitee.com/api/offers/', { fetchImpl }),
    /Recruitee/,
  );
});

// ── personio: <workzag-jobs> is the documented feed envelope ────────────────

test('personio: a wrong-shape feed THROWS (Phase-2, never silent [])', () => {
  for (const bad of [null, undefined, 42, {}, '<html>careers page served on /xml</html>', '<positions/>']) {
    assert.throws(() => parsePersonioXml(bad, 'X', 'acme.jobs.personio.de'), (err) => {
      assert.ok(err instanceof TypeError);
      assert.match(err.message, /personio/);
      return true;
    }, `expected a throw for ${JSON.stringify(bad)}`);
  }
  // The envelope with zero positions stays a legitimate empty feed.
  assert.deepEqual(parsePersonioXml('<workzag-jobs></workzag-jobs>', 'X', 'acme.jobs.personio.de'), []);
  // Non-position content INSIDE the envelope is junk rows, not a wrong shape.
  assert.deepEqual(parsePersonioXml('<workzag-jobs><junk/></workzag-jobs>', 'X', 'acme.jobs.personio.de'), []);
});

test('personio: a 200 non-XML body throws through the fetch (no silent HTML fallback)', async () => {
  // The HTML fallback is only for the 404-on-/xml case; a 200 that answers
  // with junk must surface as a failure.
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => '<html>not a feed</html>' });
  await assert.rejects(
    () => fetchPersonio('https://acme.jobs.personio.de/xml', { fetchImpl }),
    /personio/,
  );
});
