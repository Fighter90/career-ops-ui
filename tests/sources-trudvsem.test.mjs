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

test('searchTrudvsem paginates by RECORD offset and stops once meta.total is covered', async () => {
  // Verified live 2026-10-30: the API's `offset` is a record offset —
  // limit=1&offset=1 returns the SECOND record; limit=2&offset=0 returns the
  // same first two. Page p must therefore send offset = p * perPage.
  const rec = (id) => ({ vacancy: { id: String(id), 'job-name': `Dev ${id}`, vac_url: `https://trudvsem.ru/vacancy/${id}` } });
  const byOffset = {
    '0': { status: 200, meta: { total: 3, limit: 2, offset: 0 }, results: { vacancies: [rec(1), rec(2)] } },
    '2': { status: 200, meta: { total: 3, limit: 2, offset: 2 }, results: { vacancies: [rec(3)] } },
  };
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    const off = new URL(url).searchParams.get('offset');
    const body = byOffset[off] ?? { status: 200, meta: { total: 3 }, results: { vacancies: [] } };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const out = await searchTrudvsem('q', { perPage: 2, fetchImpl });
  assert.equal(out.length, 3, 'collects across both record-offset pages');
  assert.ok(calls <= 2, 'stops once (page+1)*limit >= total');
});

// ---------------------------------------------------------------------------
// 2026-10-30 — the opendata envelope moved under our feet (remote-QA run
// 41107813987). Verified live against https://opendata.trudvsem.ru:
//   ok:    {"status":"200","request":{"api":"v1"},"meta":{"total":N,"limit":L},
//           "results":{"vacancies":[{"vacancy":{...}}]}}
//   empty: {"status":"200",...,"meta":{"total":0,"limit":L},"results":{}}
//          (zero-match query AND any page past the end — no `vacancies` key)
//   error: {"status":"500","request":{"api":"v1"},"meta":{"error":"..."}}
//          (HTTP status is STILL 200 — the API's own `status` field decides)
// ---------------------------------------------------------------------------

test('searchTrudvsem reads the real 2026-10-30 envelope with a full vacancy record', async () => {
  // Trimmed live fixture: curl "https://opendata.trudvsem.ru/api/v1/vacancies?limit=1"
  const fetchImpl = mkFetch({
    status: '200',
    request: { api: 'v1' },
    meta: { total: 502711, limit: 1 },
    results: {
      vacancies: [
        {
          vacancy: {
            id: '05d39665-58df-11f1-a642-c92d05b1328c',
            source: 'Вакансия интернет ресурса',
            region: { region_code: '5000000000000', name: 'Московская область' },
            company: {
              companycode: '1027700404797',
              'hr-agency': false,
              inn: '7702319337',
              name: 'ИММА, медицинские клиники',
              url: 'https://trudvsem.ru/company/1027700404797',
            },
            'creation-date': '2026-05-26',
            date_modify: '2026-10-30T13:39:59+0300',
            salary: 'от 0',
            salary_min: 0,
            salary_max: 0,
            'job-name': 'Врач-эндокринолог (Мега ХИМКИ)',
            vac_url: 'https://trudvsem.ru/vacancy/card/1027700404797/05d39665-58df-11f1-a642-c92d05b1328c',
            schedule: 'Полный рабочий день',
            duty: 'Амбулаторный приём ( пациенты 0+ / 18+ )',
            category: { specialisation: 'Здравоохранение и социальное обеспечение' },
            requirement: { education: 'Не указано', experience: 1 },
            addresses: { address: [{ location: 'Московская область, г Химки', lng: '37.400681', lat: '55.910076' }] },
            contact_list: [{ contact_type: 'Телефон', contact_value: '+7 495 7485982' }],
            work_places: 1,
            skills: [],
            workPlaceType: { workPlaceForeign: false, workPlaceOrdinary: true },
            shift: [],
            trainingDays: 0,
            currency: '«руб.»',
          },
        },
      ],
    },
  });

  const out = await searchTrudvsem('эндокринолог', { fetchImpl, perPage: 1 });
  assert.equal(out.length, 1);
  const j = out[0];
  assert.equal(j.id, 'trudvsem-05d39665-58df-11f1-a642-c92d05b1328c');
  assert.equal(j.title, 'Врач-эндокринолог (Мега ХИМКИ)');
  assert.equal(j.company, 'ИММА, медицинские клиники');
  assert.equal(j.url, 'https://trudvsem.ru/vacancy/card/1027700404797/05d39665-58df-11f1-a642-c92d05b1328c');
  assert.equal(j.location, 'Московская область');
  assert.equal(j.date, '2026-05-26');
  assert.equal(j.salary, '', 'a 0/0 salary range reads as no salary');
  assert.equal(j.source, 'trudvsem');
});

test('searchTrudvsem reads the empty-page envelope (results: {}) as zero rows, not a shape break', async () => {
  // The zero-match shape, byte-for-byte from the live API:
  // curl ".../vacancies?text=zzzzqnotexist12345&limit=10&offset=0"
  const fetchImpl = mkFetch({
    status: '200',
    request: { api: 'v1' },
    meta: { total: 0, limit: 10 },
    results: {},
  });
  const errs = [];
  const orig = console.error;
  console.error = (...a) => errs.push(a.join(' '));
  let out;
  try {
    out = await searchTrudvsem('zzzzqnotexist12345', { fetchImpl });
  } finally {
    console.error = orig;
  }
  assert.deepEqual(out, []);
  assert.equal(errs.join(' '), '', 'an empty page is not an error to log');
});

test('searchTrudvsem stops cleanly on the empty-page envelope after a full page', async () => {
  const rec = (id) => ({ vacancy: { id: String(id), 'job-name': `Dev ${id}`, vac_url: `https://trudvsem.ru/vacancy/${id}` } });
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    if (call === 1) {
      return new Response(JSON.stringify({ status: '200', request: { api: 'v1' }, meta: { total: 60, limit: 50 }, results: { vacancies: [rec('1'), rec('2')] } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    // Past-the-end page: the API now answers results:{} (HTTP 200), not an empty array.
    return new Response(JSON.stringify({ status: '200', request: { api: 'v1' }, meta: { total: 60, limit: 50 }, results: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
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
  assert.equal(out.length, 2, 'page-1 rows survive the empty second page');
  assert.equal(errs.join(' '), '', 'walking into the empty page is a normal end, not a failure');
});

test('searchTrudvsem surfaces the API error envelope (HTTP 200 + status 500) as a labeled throw', async () => {
  // Verified live: ".../vacancies?text=python&limit=50&offset=200" →
  // HTTP 200 with {"status":"500","request":{"api":"v1"},"meta":{"error":"..."}}
  const fetchImpl = mkFetch({
    status: '500',
    request: { api: 'v1' },
    meta: { error: 'При выполнении запроса произошла ошибка. Проверьте синтаксис запроса' },
  });
  await assert.rejects(
    () => searchTrudvsem('q', { fetchImpl }),
    (err) => {
      assert.match(err.message, /Trudvsem: API returned status 500/);
      assert.match(err.message, /При выполнении запроса произошла ошибка/, 'carries the API’s own error text');
      return true;
    },
  );
});

test('searchTrudvsem keeps partials and names the API error when a later page errors', async () => {
  const rec = (id) => ({ vacancy: { id: String(id), 'job-name': `Dev ${id}`, vac_url: `https://trudvsem.ru/vacancy/${id}` } });
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    if (call === 1) {
      return new Response(JSON.stringify({ status: '200', request: { api: 'v1' }, meta: { total: 99, limit: 50 }, results: { vacancies: [rec('1')] } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ status: '500', request: { api: 'v1' }, meta: { error: 'Сильно превышено максимальное количество запрашиваемых записей' } }), { status: 200, headers: { 'content-type': 'application/json' } });
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
  assert.equal(out.length, 1, 'the collected page survives a later error page');
  assert.match(errs.join(' '), /Сильно превышено/, 'the log names the API’s error, not just a shape complaint');
});

test('searchTrudvsem never walks into the API deep-offset refusal (offset*limit >= 10000)', async () => {
  // limit=50&offset=200 → HTTP 200 {"status":"500",...} (verified live);
  // limit=100&offset=100 → the same. The walk must stop before that zone.
  const rec = (id) => ({ vacancy: { id: String(id), 'job-name': `Dev ${id}`, vac_url: `https://trudvsem.ru/vacancy/${id}` } });
  const sentOffsets = [];
  const fetchImpl = async (url) => {
    const off = Number(new URL(url).searchParams.get('offset'));
    sentOffsets.push(off);
    if (off * 50 >= 10000) {
      return new Response(JSON.stringify({ status: '500', request: { api: 'v1' }, meta: { error: 'deep offset refusal' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    const rows = Array.from({ length: 50 }, (_, i) => rec(`p${off}-${i}`));
    return new Response(JSON.stringify({ status: '200', request: { api: 'v1' }, meta: { total: 1000000, limit: 50 }, results: { vacancies: rows } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const errs = [];
  const orig = console.error;
  console.error = (...a) => errs.push(a.join(' '));
  let out;
  try {
    out = await searchTrudvsem('q', { perPage: 50, fetchImpl });
  } finally {
    console.error = orig;
  }
  assert.equal(sentOffsets.length, 4, 'pages 0..3 only — page 4 would send offset 200, which the API refuses');
  assert.ok(Math.max(...sentOffsets) < 200, `max sent offset ${Math.max(...sentOffsets)} stays under the refusal zone`);
  assert.equal(out.length, 200, 'four full pages collected');
  assert.equal(errs.join(' '), '', 'no error logged — the walk ended by the guard, not by an API refusal');
});

test('normalizeTrudvsem decodes HTML entities in employer-submitted strings', () => {
  const row = normalizeTrudvsem({
    vacancy: {
      id: '12',
      'job-name': 'C&amp;C&#43;&#43; Developer &#8212; удалённо',
      company: { name: 'ООО Рога &amp; Копыта' },
      duty: 'Опыт с D&lt;em&gt; не нужен',
    },
  });
  assert.equal(row.title, 'C&C++ Developer — удалённо');
  assert.equal(row.company, 'ООО Рога & Копыта');
  assert.equal(row.snippet, 'Опыт с D<em> не нужен');
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
