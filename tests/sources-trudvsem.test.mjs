/**
 * v1.29.0 — Trudvsem adapter (Russian government open-data API).
 *
 * Real network is forbidden (CI-isolation). We hand-craft a `fetchImpl`
 * that returns the documented Trudvsem v1 JSON shape; the test asserts
 * normalization + onlyRemote filtering + error propagation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchTrudvsem, normalizeTrudvsem } from '../server/lib/sources/trudvsem.mjs';

function mkFetch(payload, status = 200) {
  return async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
}

test('searchTrudvsem normalizes a vacancy record to the common shape', async () => {
  const fetchImpl = mkFetch({
    status: 200,
    results: {
      vacancies: [
        {
          vacancy: {
            id: '12345',
            'job-name': 'Senior PHP Developer',
            vac_url: 'https://trudvsem.ru/vacancy/12345',
            'creation-date': '2026-05-10',
            schedule: 'Полный день',
            'work-places': '1',
            salary_min: 200000,
            salary_max: 350000,
            currency: 'RUB',
            company: { name: 'ООО Рога и Копыта' },
            region: { name: 'Москва' },
            duty: 'PHP/Symfony, code review, mentoring',
          },
        },
      ],
    },
  });

  const out = await searchTrudvsem('Senior PHP', { fetchImpl });
  assert.equal(out.length, 1);
  const j = out[0];
  assert.equal(j.id, 'trudvsem-12345');
  assert.equal(j.title, 'Senior PHP Developer');
  assert.equal(j.company, 'ООО Рога и Копыта');
  assert.equal(j.url, 'https://trudvsem.ru/vacancy/12345');
  assert.equal(j.salary, 'от 200000 до 350000 RUB');
  assert.equal(j.location, 'Москва');
  assert.equal(j.isRemote, false);
  assert.equal(j.source, 'trudvsem');
});

test('searchTrudvsem treats "удалённо" in schedule as remote', async () => {
  const fetchImpl = mkFetch({
    status: 200,
    results: {
      vacancies: [{
        vacancy: {
          id: 'r1',
          'job-name': 'Backend Engineer',
          vac_url: 'https://trudvsem.ru/vacancy/r1',
          schedule: 'Удалённая работа',
          company: { name: 'Acme' },
          region: { name: 'Россия' },
        },
      }],
    },
  });
  const out = await searchTrudvsem('Backend', { fetchImpl });
  assert.equal(out.length, 1);
  assert.equal(out[0].isRemote, true);
  assert.equal(out[0].workplaceType, 'Remote');
});

test('searchTrudvsem onlyRemote filter drops non-remote entries', async () => {
  const fetchImpl = mkFetch({
    status: 200,
    results: {
      vacancies: [
        { vacancy: { id: '1', 'job-name': 'A', schedule: 'удалённо', company: { name: 'X' } } },
        { vacancy: { id: '2', 'job-name': 'B', schedule: 'офис', company: { name: 'Y' } } },
      ],
    },
  });
  const out = await searchTrudvsem('q', { fetchImpl, onlyRemote: true });
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'trudvsem-1');
});

test('searchTrudvsem throws on 5xx (caller decides to log + continue)', async () => {
  const fetchImpl = mkFetch({}, 503);
  await assert.rejects(
    () => searchTrudvsem('q', { fetchImpl }),
    /Trudvsem: HTTP 503/,
  );
});

test('searchTrudvsem returns [] on empty results object (no throw)', async () => {
  const fetchImpl = mkFetch({ status: 200, results: { vacancies: [] } });
  const out = await searchTrudvsem('q', { fetchImpl });
  assert.deepEqual(out, []);
});

test('normalizeTrudvsem skips records with no title', () => {
  assert.equal(normalizeTrudvsem({ vacancy: { id: 'x' } }), null);
  assert.equal(normalizeTrudvsem(null), null);
  assert.equal(normalizeTrudvsem({}), null);
});

test('searchTrudvsem paginates by offset and stops once meta.total is covered', async () => {
  const rec = (id) => ({ vacancy: { id: String(id), 'job-name': `Dev ${id}`, vac_url: `https://trudvsem.ru/vacancy/${id}` } });
  const byOffset = {
    '0': { status: 200, meta: { total: 3, limit: 2, offset: 0 }, results: { vacancies: [rec(1), rec(2)] } },
    '1': { status: 200, meta: { total: 3, limit: 2, offset: 1 }, results: { vacancies: [rec(3)] } },
  };
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    const off = new URL(url).searchParams.get('offset');
    const body = byOffset[off] ?? { status: 200, meta: { total: 3 }, results: { vacancies: [] } };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const out = await searchTrudvsem('q', { perPage: 2, fetchImpl });
  assert.equal(out.length, 3, 'collects across both offset pages');
  assert.ok(calls <= 2, 'stops once (page+1)*limit >= total');
});

// ---------------------------------------------------------------------------
// v1.242.0 Phase 2 — shape guard, partials, redirect:'error', id-less rows
// ---------------------------------------------------------------------------

test('searchTrudvsem throws on a malformed first page (shape guard)', async () => {
  for (const body of [{ status: 200 }, { status: 200, results: null }, { status: 200, results: { vacancies: 'nope' } }]) {
    const fetchImpl = mkFetch(body);
    await assert.rejects(
      () => searchTrudvsem('q', { fetchImpl }),
      (err) => {
        assert.match(err.message, /Trudvsem/);
        return true;
      },
      `expected a throw for ${JSON.stringify(body)}`,
    );
  }
});

test('searchTrudvsem keeps partials when a later page fails', async () => {
  let call = 0;
  const rec = (id) => ({ vacancy: { id, 'job-name': `Dev ${id}`, vac_url: `https://trudvsem.ru/vacancy/${id}` } });
  const fetchImpl = async () => {
    call++;
    if (call === 1) {
      return new Response(JSON.stringify({ status: 200, meta: { total: 99 }, results: { vacancies: [rec('1')] } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    // A 200 with a non-JSON body (WAF page) → res.json() rejects.
    return new Response('<html>nope</html>', { status: 200, headers: { 'content-type': 'text/html' } });
  };
  const errs = [];
  const orig = console.error;
  console.error = (...a) => errs.push(a.join(' '));
  let out;
  try {
    out = await searchTrudvsem('q', { fetchImpl });
  } finally {
    console.error = orig;
  }
  assert.equal(out.length, 1, 'page 1 survives a page-2 failure');
  assert.match(errs.join(' '), /trudvsem/);
});

test('searchTrudvsem sends redirect:error (SSRF guard)', async () => {
  let seen;
  const fetchImpl = async (url, opts) => {
    seen = opts;
    return new Response(JSON.stringify({ status: 200, results: { vacancies: [] } }), { status: 200 });
  };
  await searchTrudvsem('q', { fetchImpl });
  assert.equal(seen.redirect, 'error');
});

test('normalizeTrudvsem drops id-less rows instead of synthesizing colliding ids/urls', () => {
  // Two id-less rows with the same title used to share one URL and one dedup
  // key, silently swallowing the second row. Now both are skipped.
  assert.equal(normalizeTrudvsem({ vacancy: { 'job-name': 'No Id Here', company: { name: 'X' } } }), null);
  assert.equal(normalizeTrudvsem({ 'job-name': 'Top-level form, no id' }), null);
});

test('normalizeTrudvsem keeps a surrogate-id row that carries a usable https vac_url', () => {
  const LONE = '\uD800';
  // The surrogate id cannot be encoded → no built URL — but the row itself is
  // usable via its own https vac_url, so it survives with that URL.
  const kept = normalizeTrudvsem({ vacancy: { id: `${LONE}bad`, 'job-name': 'Has URL', vac_url: 'https://trudvsem.ru/vacancy/card/9' } });
  assert.ok(kept, 'a surrogate id with a real vac_url is not dropped');
  assert.equal(kept.url, 'https://trudvsem.ru/vacancy/card/9');
  // Without a vac_url there is no usable URL → the row is dropped.
  assert.equal(normalizeTrudvsem({ vacancy: { id: `${LONE}bad`, 'job-name': 'Bad' } }), null);
});

test('normalizeTrudvsem normalizes creation-date to YYYY-MM-DD UTC', () => {
  const bare = normalizeTrudvsem({ vacancy: { id: '9', 'job-name': 'Dev', 'creation-date': '2026-05-10' } });
  assert.equal(bare.date, '2026-05-10');
  const stamped = normalizeTrudvsem({ vacancy: { id: '10', 'job-name': 'Dev', 'creation-date': '2026-05-10T23:30:00' } });
  assert.equal(stamped.date, '2026-05-10', 'a naive stamp is treated as UTC');
  const junk = normalizeTrudvsem({ vacancy: { id: '11', 'job-name': 'Dev', 'creation-date': 'garbage' } });
  assert.equal(junk.date, '');
});

test('normalizeTrudvsem builds the canonical URL when vac_url is missing or non-https', () => {
  const built = normalizeTrudvsem({ vacancy: { id: '77', 'job-name': 'Dev' } });
  assert.equal(built.url, 'https://trudvsem.ru/vacancy/77');
  const insecure = normalizeTrudvsem({ vacancy: { id: '78', 'job-name': 'Dev', vac_url: 'http://trudvsem.ru/vacancy/78' } });
  assert.equal(insecure.url, 'https://trudvsem.ru/vacancy/78', 'an http: vac_url falls back to the built https URL');
  const kept = normalizeTrudvsem({ vacancy: { id: '79', 'job-name': 'Dev', vac_url: 'https://trudvsem.ru/vacancy/79' } });
  assert.equal(kept.url, 'https://trudvsem.ru/vacancy/79');
});
