/**
 * Phase-2 cross-cutting rule (docs/sdd/BACKLOG.md, v1.242.0 sources-2): a 200
 * with the wrong shape THROWS on page 1 instead of silently reading as an empty
 * board; a later-page failure keeps partials; pagination stops on the RAW page
 * length. Pinned here per source: breezy, comeet, consider, cryptocurrencyjobs,
 * csod, dassault, eightfold, feishu-jobs, builtin. Fake fetchImpl, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fetchBreezy, parseBreezyResponse } from '../server/lib/sources/breezy.mjs';
import { fetchComeet, parseComeetResponse, COMEET_API_HOST } from '../server/lib/sources/comeet.mjs';
import { fetchCryptocurrencyJobs, FEED_URL } from '../server/lib/sources/cryptocurrencyjobs.mjs';
import { fetchCsod } from '../server/lib/sources/csod.mjs';
import { fetchDassault, FEED_BASE, parseHits } from '../server/lib/sources/dassault.mjs';
import { fetchEightfold } from '../server/lib/sources/eightfold.mjs';
import { fetchFeishuJobs } from '../server/lib/sources/feishu-jobs.mjs';
import { fetchBuiltin, parseListPage } from '../server/lib/sources/builtin.mjs';

const okJson = (body) => async () => ({ ok: true, status: 200, json: async () => body });
const errStatus = (status) => async () => ({ ok: false, status, json: async () => '' });
const text = (body) => async () => ({ ok: true, status: 200, text: async () => body });

// ─────────────────────────── breezy ───────────────────────────
test('breezy: a 200 that is not a top-level array THROWS (was: silently [])', async () => {
  assert.throws(() => parseBreezyResponse({ wrong: true }, 'Foo'), /expected an array|positions/);
  await assert.rejects(
    () => fetchBreezy('https://foo.breezy.hr/json', { fetchImpl: okJson({ wrong: true }), company: { name: 'Foo' } }),
    /Breezy positions/,
  );
});

test('breezy: raw rows that ALL fail normalization throw (was: silently [])', async () => {
  await assert.rejects(
    () => fetchBreezy('https://foo.breezy.hr/json', {
      fetchImpl: okJson([{ nope: 1 }, { name: 'NoUrl' }, { url: 'ftp://x' }]),
      company: { name: 'Foo' },
    }),
    /none parsed/,
  );
});

// ─────────────────────────── comeet ───────────────────────────
test('comeet: a 200 that is not a top-level array THROWS (was: silently [])', async () => {
  assert.throws(() => parseComeetResponse({ wrong: true }, 'Acme'), /expected an array|positions/);
  const url = `https://${COMEET_API_HOST}/careers-api/2.0/company/AB/positions`;
  await assert.rejects(
    () => fetchComeet(url, { fetchImpl: okJson({ wrong: true }), company: { name: 'Acme' } }),
    /Comeet positions/,
  );
});

test('comeet: raw rows that ALL fail normalization throw (was: silently [])', async () => {
  const url = `https://${COMEET_API_HOST}/careers-api/2.0/company/AB/positions`;
  await assert.rejects(
    () => fetchComeet(url, {
      fetchImpl: okJson([{ name: 'NoUrl' }, { url_active_page: 'ftp://x' }]),
      company: { name: 'Acme' },
    }),
    /none parsed/,
  );
});

test('comeet: a fetch error never leaks the ?token= into the message; status survives', async () => {
  const url = `https://${COMEET_API_HOST}/careers-api/2.0/company/AB/positions?token=SECRET-TOK`;
  let err;
  try {
    await fetchComeet(url, { fetchImpl: errStatus(500), company: { name: 'Acme' } });
  } catch (e) { err = e; }
  assert.ok(err, 'throws');
  assert.equal(err.status, 500, '.status preserved for quarantine/permanent-failure logic');
  assert.match(err.message, /token=REDACTED/);
  assert.ok(!err.message.includes('SECRET-TOK'), `token leaked: ${err.message}`);
  // Same for the non-JSON 2xx path (that message embeds the URL too).
  let err2;
  try {
    await fetchComeet(url, { fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } }), company: {} });
  } catch (e) { err2 = e; }
  assert.ok(err2, 'throws on non-JSON 2xx');
  assert.ok(!String(err2.message).includes('SECRET-TOK'), `token leaked: ${err2.message}`);
});

// ───────────────────── cryptocurrencyjobs ─────────────────────
test('cryptocurrencyjobs: a 200 that is not an RSS document THROWS (was: silently [])', async () => {
  await assert.rejects(
    () => fetchCryptocurrencyJobs(FEED_URL, { fetchImpl: text('not xml at all') }),
    /not an RSS document/,
  );
  await assert.rejects(
    () => fetchCryptocurrencyJobs(FEED_URL, { fetchImpl: text('') }),
    /empty feed body/,
  );
});

test('cryptocurrencyjobs: items that ALL fail normalization throw (was: silently [])', async () => {
  const rss = '<rss><channel>'
    + '<item><title>Off-host at Bad</title><link>https://evil.example/x/</link></item>'
    + '<item><title>No link at all</title></item>'
    + '</channel></rss>';
  await assert.rejects(
    () => fetchCryptocurrencyJobs(FEED_URL, { fetchImpl: text(rss) }),
    /none parsed/,
  );
});

test('cryptocurrencyjobs: a valid RSS document with zero items stays [] (genuinely empty board)', async () => {
  const jobs = await fetchCryptocurrencyJobs(FEED_URL, { fetchImpl: text('<?xml version="1.0"?><rss><channel></channel></rss>') });
  assert.deepEqual(jobs, []);
});

// ─────────────────────────── csod ───────────────────────────
const CSOD_HOME = 'https://acme.csod.com/ux/ats/careersite/4/home?c=acme';
const csodRow = (id, title) => ({ requisitionId: id, displayJobTitle: title, locations: [] });

/** Bootstrap home page + paged search responses, keyed by pageNumber. */
function csodFetch(pagesByNumber) {
  return async (url, opts = {}) => {
    if (url.includes('/home?c=')) {
      return { ok: true, status: 200, headers: { getSetCookie: () => [] }, text: async () => '<script>"token":"tok.abc.def"</script>' };
    }
    const body = JSON.parse(opts.body);
    const rows = pagesByNumber[body.pageNumber] || [];
    return { ok: true, status: 200, json: async () => ({ data: { totalCount: pagesByNumber.total ?? 100, requisitions: rows } }) };
  };
}

test('csod: a 200 without data.requisitions THROWS on page 1 (was: silently [])', async () => {
  const fetchImpl = async (url, opts = {}) => {
    if (url.includes('/home?c=')) {
      return { ok: true, status: 200, headers: { getSetCookie: () => [] }, text: async () => '"token":"tok.abc.def"' };
    }
    return { ok: true, status: 200, json: async () => ({ data: {} }) };
  };
  await assert.rejects(() => fetchCsod(CSOD_HOME, { fetchImpl, company: { name: 'Acme' } }), /requisitions/);
});

test('csod: raw requisitions that ALL fail normalization throw on page 1 (was: silently [])', async () => {
  const fetchImpl = csodFetch({ 1: [{ nope: 1 }, { requisitionId: 'X' }], total: 2 });
  await assert.rejects(() => fetchCsod(CSOD_HOME, { fetchImpl, company: { name: 'Acme' } }), /none parsed/);
});

test('csod: a later page losing the shape keeps the earlier partials', async () => {
  const fetchImpl = async (url, opts = {}) => {
    if (url.includes('/home?c=')) {
      return { ok: true, status: 200, headers: { getSetCookie: () => [] }, text: async () => '"token":"tok.abc.def"' };
    }
    const n = JSON.parse(opts.body).pageNumber;
    if (n === 2) return { ok: true, status: 200, json: async () => ({ data: { totalCount: 100 } }) };
    const rows = n === 1 ? Array.from({ length: 25 }, (_, i) => csodRow(`A${i}`, `Role ${i}`)) : [];
    return { ok: true, status: 200, json: async () => ({ data: { totalCount: 100, requisitions: rows } }) };
  };
  const jobs = await fetchCsod(CSOD_HOME, { fetchImpl, company: { name: 'Acme' } });
  assert.equal(jobs.length, 25);
});

test('csod: the short-page stop is judged on the RAW page length, not the post-filter count', async () => {
  // Page 2 is FULL raw (25) but only 1 row survives normalization; page 3 is a
  // genuinely short raw page. The loop must read 3 pages (the old post-filter
  // check stopped after 2, losing page 3).
  const pagesByNumber = {
    total: 100,
    1: Array.from({ length: 25 }, (_, i) => csodRow(`A${i}`, `Role ${i}`)),
    2: [...Array.from({ length: 24 }, (_, i) => ({ requisitionId: `BAD${i}` })), csodRow('KEEP', 'Keeper')],
    3: [csodRow('LAST', 'Last')],
  };
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    if (url.includes('/home?c=')) {
      return { ok: true, status: 200, headers: { getSetCookie: () => [] }, text: async () => '"token":"tok.abc.def"' };
    }
    calls.push(JSON.parse(opts.body).pageNumber);
    const rows = pagesByNumber[JSON.parse(opts.body).pageNumber] || [];
    return { ok: true, status: 200, json: async () => ({ data: { totalCount: 100, requisitions: rows } }) };
  };
  const jobs = await fetchCsod(CSOD_HOME, { fetchImpl, company: { name: 'Acme' } });
  assert.deepEqual(calls, [1, 2, 3], `expected 3 pages, got ${calls.join(',')}`);
  assert.equal(jobs.length, 27); // 25 + 1 (keeper) + 1 (last)
});

// ─────────────────────────── dassault ───────────────────────────
const dHit = (meta) => '<Hit>' + Object.entries(meta)
  .map(([k, v]) => `<Meta name="${k}"><MetaString name="value">${v}</MetaString></Meta>`)
  .join('') + '</Hit>';
const dTitle = (t) => dHit({ content_title: t, content_cta_1_url: 'https://www.3ds.com/careers/jobs/x', card_id: 'X1' });
const dXml = (...hits) => `<?xml version="1.0"?><Response><Hits>${hits.join('')}</Hits></Response>`;

test('dassault: a 200 with no <Hit> entries THROWS on page 1 (was: silently [])', async () => {
  await assert.rejects(
    () => fetchDassault(FEED_BASE, { fetchImpl: text('no xml at all') }),
    /no <Hit> entries/,
  );
});

test('dassault: raw hits that ALL fail normalization throw on page 1 (was: silently [])', async () => {
  // Both hits have a title but no usable URL → parseHits yields [] while raw
  // hits exist. Must be a loud failure, not "board read as empty".
  const xml = dXml(
    dHit({ content_title: 'No URL' }),
    dHit({ content_title: 'Off host', content_cta_1_url: 'https://evil.example/x', card_id: 'X2' }),
  );
  await assert.rejects(() => fetchDassault(FEED_BASE, { fetchImpl: text(xml) }), /none parsed/);
});

test('dassault: a later page returning nothing keeps the earlier partials', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const start = Number(new URL(url).searchParams.get('start'));
    return { ok: true, status: 200, text: async () => (start === 0 ? dXml(dTitle('A')) : dXml()) };
  };
  const jobs = await fetchDassault(FEED_BASE, { fetchImpl });
  assert.equal(jobs.length, 1);
  assert.equal(calls.length, 2);
});

test('dassault: job URLs must be https on a 3ds host (http: dropped)', () => {
  const xml = dXml(
    dHit({ content_title: 'Https', content_cta_1_url: 'https://careers.3ds.com/x', card_id: 'H1' }),
    dHit({ content_title: 'Http', content_cta_1_url: 'http://careers.3ds.com/y', card_id: 'H2' }),
    dHit({ content_title: 'Script', content_cta_1_url: 'javascript:alert(1)', card_id: 'H3' }),
  );
  const jobs = parseHits(xml, '3DS');
  assert.deepEqual(jobs.map((j) => j.title), ['Https']);
});

// ─────────────────────────── eightfold ───────────────────────────
const EF = 'https://acme.eightfold.ai/api/apply/v2/jobs';
const efRow = (i) => ({ id: `p${i}`, name: `Role ${i}`, canonicalPositionUrl: `https://acme.eightfold.ai/careers?p=${i}` });

test('eightfold: a 200 without a positions/jobs array THROWS on page 1 (was: silently [])', async () => {
  await assert.rejects(
    () => fetchEightfold(EF, { fetchImpl: okJson({ hello: true }), company: { name: 'Acme' } }),
    /positions/,
  );
});

test('eightfold: raw positions that ALL fail normalization throw on page 1 (was: silently [])', async () => {
  await assert.rejects(
    () => fetchEightfold(EF, { fetchImpl: okJson({ positions: [{ nope: 1 }, { name: 'No url or id' }], count: 2 }), company: { name: 'Acme' } }),
    /none parsed/,
  );
});

test('eightfold: a later page losing the shape keeps the earlier partials', async () => {
  let page = 0;
  const fetchImpl = async () => {
    page += 1;
    return page === 1
      ? { ok: true, status: 200, json: async () => ({ positions: Array.from({ length: 10 }, (_, i) => efRow(i)), count: 20 }) }
      : { ok: true, status: 200, json: async () => ({ hello: true }) };
  };
  const jobs = await fetchEightfold(EF, { fetchImpl, company: { name: 'Acme' } });
  assert.equal(jobs.length, 10);
});

// ─────────────────────────── feishu-jobs ───────────────────────────
const FEISHU = 'https://jobs.bytedance.com/api/v1/search/job/posts';
const feishuPost = (i) => ({ id: String(i), title: `Role ${i}` });
const feishuJson = (body) => async () => ({ ok: true, status: 200, json: async () => body });

test('feishu-jobs: a 200 without data.job_post_list THROWS on page 1 (was: silently [])', async () => {
  await assert.rejects(
    () => fetchFeishuJobs(FEISHU, { fetchImpl: feishuJson({ code: 0, data: {} }), company: { careers_url: 'https://jobs.bytedance.com' } }),
    /job_post_list/,
  );
});

test('feishu-jobs: rows that ALL lack title/id throw on page 1 (was: silently [])', async () => {
  await assert.rejects(
    () => fetchFeishuJobs(FEISHU, {
      fetchImpl: feishuJson({ code: 0, data: { count: 2, job_post_list: [{ nope: 1 }, { title: 'no id' }] } }),
      company: { careers_url: 'jobs.bytedance.com' },
    }),
    /none parsed/,
  );
});

test('feishu-jobs: a missing data.count no longer stops pagination after page 1', async () => {
  const pages = [
    { code: 0, data: { job_post_list: Array.from({ length: 100 }, (_, i) => feishuPost(i)) } }, // NO count
    { code: 0, data: { job_post_list: Array.from({ length: 30 }, (_, i) => feishuPost(100 + i)) } },
    { code: 0, data: { job_post_list: [] } }, // end of the board
  ];
  let call = 0;
  const seenOffsets = [];
  const fetchImpl = async (_url, opts = {}) => {
    seenOffsets.push(JSON.parse(opts.body).offset);
    return { ok: true, status: 200, json: async () => pages[call++] ?? pages[pages.length - 1] };
  };
  const jobs = await fetchFeishuJobs(FEISHU, { fetchImpl, company: { careers_url: 'https://jobs.bytedance.com' } });
  assert.deepEqual(seenOffsets, [0, 100, 200], 'all pages must be requested when count is absent');
  assert.equal(jobs.length, 130);
});

// ─────────────────────────── builtin ───────────────────────────
test('builtin: a page-1 fetch failure THROWS when nothing has been collected (was: silently [])', async () => {
  await assert.rejects(
    () => fetchBuiltin(null, { fetchImpl: errStatus(500), company: { name: 'X', queries: ['go'] } }),
    /500/,
  );
});

test('builtin: a page-1 failure after rows are already collected keeps the partials', async () => {
  const item = (id, title) => `{"@type":"ListItem","position":1,"name":"${title}","url":"https://builtin.com/jobs/x/${id}","description":"d"}`;
  let call = 0;
  const fetchImpl = async (url) => {
    call += 1;
    if (/page=1/.test(url) && call === 1) return { ok: true, status: 200, text: async () => `<html>${item(11, 'One')}</html>` };
    return { ok: false, status: 500 };
  };
  const jobs = await fetchBuiltin(null, { fetchImpl, company: { name: 'X', queries: ['go'] } });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'One');
});

test('builtin: the loop-detection stop is per query, not the global cross-query seen set', async () => {
  // Query "a" surfaces J1+J3; query "b" page 1 returns the SAME J1+J3 (already
  // in the global seen set) but its page 2 has a NEW J4. The old global check
  // read page 1 of "b" as a pagination loop and stopped, losing J4.
  const item = (id) => `{"@type":"ListItem","position":1,"name":"Role","url":"https://builtin.com/jobs/x/${id}","description":"d"}`;
  const pagesFor = (base) => ({
    'search=a|1': [1, 3],
    'search=a|2': [1, 3],
    'search=b|1': [1, 3],
    'search=b|2': [4],
    'search=b|3': [4],
  })[base];
  const fetchImpl = async (url) => {
    const u = new URL(url);
    const key = `${u.searchParams.get('search') ? `search=${u.searchParams.get('search')}` : ''}|${u.searchParams.get('page')}`;
    const ids = pagesFor(key);
    if (!ids) return { ok: true, status: 200, text: async () => '<html></html>' };
    return { ok: true, status: 200, text: async () => `<html>${ids.map((i) => item(i)).join('')}</html>` };
  };
  const jobs = await fetchBuiltin(null, { fetchImpl, company: { name: 'X', queries: ['a', 'b'], builtin: { max_pages: 5 } } });
  assert.deepEqual(jobs.map((j) => j.url), [
    'https://builtin.com/jobs/x/1',
    'https://builtin.com/jobs/x/3',
    'https://builtin.com/jobs/x/4',
  ], 'J4 from query b page 2 must not be lost');
});

test('builtin: parseListPage drops non-https / scheme-less job urls', () => {
  const html = '<html>'
    + '{"@type":"ListItem","position":1,"name":"Ok","url":"https://builtin.com/jobs/x/1","description":"d"}'
    + '{"@type":"ListItem","position":2,"name":"Http","url":"http://builtin.com/jobs/x/2","description":"d"}'
    + '{"@type":"ListItem","position":3,"name":"Script","url":"javascript:alert(1)","description":"d"}'
    + '</html>';
  const jobs = parseListPage(html);
  assert.deepEqual(jobs.map((j) => j.title), ['Ok']);
});
