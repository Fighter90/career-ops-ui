// Talentlink source (parent PR #6790 port — Lumesse TalentLink (Cornerstone)
// FO-widget career sites read through the FO REST API) — CI-isolated suite.
//
// Fixtures follow the live payload shape: a static career page carrying
// data-lumesse-fo-host / data-lumesse-site-tech-id, a /fo/rest/jobs/criteria
// answer naming each list, and /fo/rest/jobs pages of
// {globals: {jobsCount}, jobs: [{id, jobFields, customFields}]}. No network —
// fetchTalentlink runs on a fake fetchImpl with an injectable sleep and a
// fresh idCache per test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  resolveBoard,
  parseBoardPage,
  parseCriteria,
  parseJobsResponse,
  resolveDetailPage,
  resolveMaxPages,
  clearTalentlinkSiteCache,
  fetchTalentlink,
} from '../server/lib/sources/talentlink.mjs';
import { talentlinkAdapter } from '../server/lib/portals/adapters/talentlink.mjs';

const SITE_ID = 'ABCDE0123456789ABCDEFGHIJ';
const FO_HOST = 'emea9-foc.lumessetalentlink.com';
const BOARD = 'https://acme.recruitmentplatform.com/';

const page = (host = FO_HOST, id = SITE_ID) => `<!DOCTYPE html><html><body>
<div id="lumesseJobsListWidget" data-lumesse-fo-host="${host}" data-lumesse-site-tech-id="${id}" data-lumesse-job-list-view-type="list"></div>
<script src="https://${host}/apply-app/static/talentportal/release/1-LATEST/talentportal-widgets.js"></script>
</body></html>`;

const CRITERIA = {
  LOV19: { lovName: 'Acme Country', lovId: 1, items: [{ value: 11, label: 'Poland' }, { value: 12, label: 'Germany' }], bindWith: ['LOV20'] },
  LOV20: { lovName: 'Acme Location', lovId: 2, items: [{ value: 21, label: 'Ujazd', bindTo: [11] }, { value: 22, label: 'Berlin', bindTo: [12] }] },
  LOV23: { lovName: 'Functional Area', lovId: 3, items: [{ value: 31, label: 'Engineering' }] },
};

function row(id, over = {}, customFields) {
  return {
    id,
    customFields: customFields ?? [
      { title: 'About us', content: '<p>ExampleCo builds <b>things</b> &amp; more.</p>' },
      { title: ' ', content: '' },
    ],
    jobFields: {
      id,
      jobTitle: `Role ${id}`,
      SLOVLIST20: 'Berlin',
      SLOVLIST23: 'Engineering',
      DPOSTINGSTART: 1793746800000,
      language: 'DE',
      jobNumber: `DE${id}`,
      applicationUrl: `https://apply9.lumessetalentlink.com/apply-app/pages/application-form?jobId=${SITE_ID}-${id}&langCode=de_DE`,
      WorkMode: [],
      ...over,
    },
  };
}

const wcagPage = (host = `https://${FO_HOST}`, id = SITE_ID) => `<html><body>
<script type="text/javascript" src="${host}/apply-app/static/talentportal/release/3-LATEST/talentportal-widgets-wcag.js"
    data-talentlink-fo-site-tech-id="${id}" data-talentlink-fo-host="${host}" data-talentlink-fo-language-autodetect></script>
<div data-talentlink-fo-root-container></div></body></html>`;

const CONFIG = { generalInfo: { language: 'EN' }, navigationPages: { jobListURL: 'index.html', jobDescriptionURL: 'details.html' } };

const jobsPage = (rows, total = rows.length) => ({ globals: { jobsCount: total, typeDescriptor: {} }, jobs: rows });

const okJson = (body) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => body });
const okText = (body) => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => body });
const badStatus = (status, body = '') => ({ ok: false, status, headers: { get: () => null }, text: async () => body });

/**
 * A fake fetchImpl answering by URL from a route table. `pages` is the list of
 * /fo/rest/jobs answers (objects, or thrown Errors), consumed in order.
 */
function makeFetch({ html = page(), config = CONFIG, criteria = CRITERIA, pages = [jobsPage([row(1)])] } = {}) {
  const calls = [];
  let jobsCalls = 0;
  const impl = async (url, opts = {}) => {
    calls.push({ url, opts });
    if (url === 'https://acme.recruitmentplatform.com/index.html'
      || url === 'https://acme.recruitmentplatform.com/internal/details.html'
      || url === 'https://acme.recruitmentplatform.com/FO/ABC123/components/index.html'
      || url === 'https://careers.acme.example/jobs/index.html'
      || url === 'https://careers.acme.example/acme_jobsearch.html') return okText(html);
    if (url.endsWith('/fo/rest/config')) {
      if (config instanceof Error) throw config;
      return okJson(config);
    }
    if (url.endsWith('/fo/rest/jobs/criteria')) {
      if (criteria instanceof Error) throw criteria;
      return okJson(criteria);
    }
    if (url.includes('/fo/rest/jobs?')) {
      const p = pages[Math.min(jobsCalls++, pages.length - 1)];
      if (p instanceof Error) throw p;
      return okJson(p);
    }
    throw new Error(`unexpected request ${url}`);
  };
  return { calls, impl };
}

const listCalls = (calls) => calls.filter((c) => c.url.includes('/fo/rest/jobs?'));

const fetchEntry = async (entry, setup, opts = {}) => {
  const { impl, calls } = makeFetch(setup);
  const jobs = await fetchTalentlink(entry.careers_url || entry.api, {
    fetchImpl: impl,
    sleep: async () => {},
    company: entry,
    idCache: new Map(),
    ...opts,
  });
  return { jobs, calls };
};

test('talentlink: meta registers the source', () => {
  assert.deepEqual(meta, { value: 'talentlink', label: 'TalentLink', region: 'en' });
});

test('talentlink: resolveBoard rebuilds the origin and keeps only directory segments', () => {
  assert.deepEqual(resolveBoard('https://acme.recruitmentplatform.com:8443/internal/details.html?jobId=1#x'), {
    pageUrl: 'https://acme.recruitmentplatform.com/internal/details.html',
    boardDir: 'https://acme.recruitmentplatform.com/internal/',
  });
  assert.deepEqual(resolveBoard('https://acme.recruitmentplatform.com/internal/'), {
    pageUrl: 'https://acme.recruitmentplatform.com/internal/index.html',
    boardDir: 'https://acme.recruitmentplatform.com/internal/',
  });
  assert.equal(resolveBoard('https://acme.recruitmentplatform.com/feed.xml'), null);
  assert.equal(resolveBoard('https://acme.recruitmentplatform.com/a.b/index.html'), null);
  assert.equal(resolveBoard('https://careers.acme.example/jobs/'), null);
  assert.deepEqual(resolveBoard('https://careers.acme.example/jobs/', { vendorOnly: false }), {
    pageUrl: 'https://careers.acme.example/jobs/index.html',
    boardDir: 'https://careers.acme.example/jobs/',
  });
});

test('talentlink: parseBoardPage reads the FO host and site id, and names what is missing', () => {
  assert.deepEqual(parseBoardPage(page()), { foHost: FO_HOST, siteId: SITE_ID });
  assert.deepEqual(parseBoardPage(page('emea3.recruitmentplatform.com')).foHost, 'emea3.recruitmentplatform.com');
  assert.deepEqual(parseBoardPage(wcagPage()), { foHost: FO_HOST, siteId: SITE_ID });
  assert.throws(() => parseBoardPage(wcagPage('http://internal.acme.example')), /not a TalentLink host/);
  assert.throws(() => parseBoardPage('<html>nothing</html>'), /no FO widget/);
  assert.throws(
    () => parseBoardPage('<script src="https://emea3.recruitmentplatform.com/syndicated/lay/jsoutputinitrapido.cfm?ID=X"></script>'),
    /syndicated/);
  assert.throws(() => parseBoardPage(page('internal.acme.example')), /not a TalentLink host/);
  assert.throws(() => parseBoardPage(page(FO_HOST, 'x"><script>')), /unexpected format/);
});

test('talentlink: fetch normalizes the list payload to the scanner row shape', async () => {
  const rows = [
    row(7807, { SLOVLIST20: 'Ujazd', jobTitle: 'R&amp;D Engineer', applicationUrl: 'https://x.lumessetalentlink.com/a?jobId=X-7807&langCode=pl' }),
    row(7797, { WorkMode: ['Hybrid', 'Remote'], DPOSTINGSTART: undefined, jobNumber: null }),
    row(7790, { SLOVLIST20: 'Nowhere', WorkMode: ['On-site'], applicationUrl: null }),
  ];
  const { jobs } = await fetchEntry({ name: 'Acme', careers_url: BOARD }, { pages: [jobsPage(rows)] });
  assert.equal(jobs.length, 3);
  assert.deepEqual(jobs[0], {
    id: 'talentlink-7807',
    title: 'R&D Engineer',
    url: 'https://acme.recruitmentplatform.com/details.html?jobId=7807',
    company: 'Acme',
    location: 'Ujazd, Poland',
    salary: '',
    isRemote: false,
    workplaceType: '',
    relocates: false,
    date: new Date(1793746800000).toISOString().slice(0, 10),
    snippet: '',
    source: 'talentlink',
    description: 'About us: ExampleCo builds things & more.',
    externalId: '7807',
    requisitionId: 'DE7807',
    language: 'pl',
  });
  assert.equal(jobs[1].location, 'Berlin, Germany · Remote · Hybrid');
  assert.equal(jobs[1].isRemote, true, 'a Remote work mode carries into the row flag via the location string');
  assert.equal(jobs[1].workplaceType, 'Remote');
  assert.equal(jobs[1].date, '', 'no posting date when the tenant lists none');
  assert.equal(jobs[1].requisitionId, undefined);
  assert.equal(jobs[1].language, 'de-DE');
  assert.equal(jobs[2].location, 'Nowhere');
  assert.equal(jobs[2].isRemote, false);
  assert.equal(jobs[2].language, undefined);
});

test('talentlink: a country column in the row stays after the city', () => {
  const crit = {
    LOV5: { lovName: 'Acme Country', items: [{ value: 1, label: 'Mexico' }] },
    LOV6: { lovName: 'Acme Location', items: [{ value: 2, label: 'Monterrey', bindTo: [1] }] },
  };
  const out = parseJobsResponse(jobsPage([row(1, { SLOVLIST5: 'Mexico', SLOVLIST6: 'Monterrey', SLOVLIST20: undefined })]), {
    detailPage: `${BOARD}details.html`, company: 'Acme', locations: parseCriteria(crit),
  });
  assert.equal(out.jobs[0].location, 'Monterrey, Mexico');
});

test('talentlink: a list the criteria do not name as a location is not read as one', () => {
  const out = parseJobsResponse(jobsPage([row(1)]), { detailPage: `${BOARD}details.html`, company: 'Acme', locations: parseCriteria({}) });
  assert.equal(out.jobs[0].location, '');
});

test('talentlink: rows missing an id or title, or with a non-numeric id, are dropped', async () => {
  const rows = [
    row(1),
    row(2, { jobTitle: '   ' }),
    { ...row(3), id: undefined, jobFields: { ...row(3).jobFields, id: undefined } },
    { ...row(4), id: 'a/b', jobFields: { ...row(4).jobFields, id: 'a/b' } },
    null,
    'junk',
  ];
  const { jobs } = await fetchEntry({ name: 'Acme', careers_url: BOARD }, { pages: [jobsPage(rows, 6)] });
  assert.deepEqual(jobs.map((j) => j.externalId), ['1']);
});

test('talentlink: every request passes redirect "error", and the list call carries the guest login', async () => {
  const entry = { name: 'Acme', careers_url: 'https://acme.recruitmentplatform.com/internal/details.html?jobId=9' };
  const { impl, calls } = makeFetch();
  await fetchTalentlink(entry.careers_url, { fetchImpl: impl, sleep: async () => {}, company: entry, idCache: new Map() });
  assert.equal(calls.length, 4);
  for (const c of calls) assert.equal(c.opts.redirect, 'error', c.url);
  assert.equal(calls[0].url, 'https://acme.recruitmentplatform.com/internal/details.html');
  assert.equal(calls[1].url, `https://${FO_HOST}/fo/rest/config`);
  assert.equal(calls[1].opts.headers.username, `${SITE_ID}:guest:FO`);
  assert.equal(calls[2].url, `https://${FO_HOST}/fo/rest/jobs/criteria`);
  const list = calls[3];
  assert.equal(list.url, `https://${FO_HOST}/fo/rest/jobs?firstResult=0&maxResults=100&sortBy=DPOSTINGSTART&sortOrder=desc`);
  assert.equal(list.opts.method, 'POST');
  assert.equal(list.opts.body, '{"searchCriteria":{}}');
  assert.equal(list.opts.headers.username, `${SITE_ID}:guest:FO`);
  assert.equal(list.opts.headers.password, 'guest');
  assert.equal(list.opts.headers.accept, 'application/json');
});

test('talentlink: posting URLs keep the board directory', async () => {
  const { jobs } = await fetchEntry(
    { name: 'Acme', careers_url: 'https://acme.recruitmentplatform.com/FO/ABC123/components/index.html' },
    {},
  );
  assert.equal(jobs[0].url, 'https://acme.recruitmentplatform.com/FO/ABC123/components/details.html?jobId=1');
});

test('talentlink: a vendor URL the source refuses rejects before any request', async () => {
  for (const careers_url of ['https://careers.acme.example/', 'http://acme.recruitmentplatform.com/', 'nope']) {
    const { impl, calls } = makeFetch();
    await assert.rejects(
      () => fetchTalentlink(careers_url, { fetchImpl: impl, sleep: async () => {}, company: { name: 'Acme', careers_url }, idCache: new Map() }),
      /no https TalentLink career page URL/,
      careers_url);
    assert.equal(calls.length, 0, careers_url);
  }
});

test('talentlink: an explicit provider reads a branded host, but the FO host must still be TalentLink', async () => {
  const entry = { name: 'Acme', provider: 'talentlink', careers_url: 'https://careers.acme.example/jobs/' };
  const ok = await fetchEntry(entry, {});
  assert.equal(ok.jobs[0].url, 'https://careers.acme.example/jobs/details.html?jobId=1');
  assert.equal(ok.calls[0].url, 'https://careers.acme.example/jobs/index.html');

  // The accessible widget on an employer page, with its own posting page named in the config.
  const wcagEntry = { name: 'Acme', provider: 'talentlink', careers_url: 'https://careers.acme.example/acme_jobsearch.html' };
  const wcag = await fetchEntry(wcagEntry, {
    html: wcagPage(),
    config: { navigationPages: { jobDescriptionURL: 'https://careers.acme.example/acme_jobdescription.html' } },
  });
  assert.equal(wcag.calls[0].url, 'https://careers.acme.example/acme_jobsearch.html');
  assert.equal(wcag.jobs[0].url, 'https://careers.acme.example/acme_jobdescription.html?jobId=1');

  const bad = makeFetch({ html: page('metadata.internal.example') });
  await assert.rejects(
    () => fetchTalentlink(entry.careers_url, { fetchImpl: bad.impl, sleep: async () => {}, company: entry, idCache: new Map() }),
    /not a TalentLink host/);
  assert.equal(bad.calls.length, 1);
});

test('talentlink: an empty board is empty; a wrong envelope throws', async () => {
  // The live empty-board answer carries no jobs key at all.
  for (const body of [{ globals: { jobsCount: 0, selectedSearchCriteria: [] } }, { globals: { jobsCount: 0 }, jobs: [] }]) {
    const { jobs } = await fetchEntry({ name: 'Acme', careers_url: BOARD }, { pages: [body] });
    assert.deepEqual(jobs, [], JSON.stringify(body));
  }

  for (const body of [{}, { jobs: null }, { jobs: {} }, { results: [] }, { globals: { jobsCount: 5 } }, { globals: {} }, { globals: { jobsCount: 0 }, jobs: null }, '', 7, null]) {
    const { impl } = makeFetch({ pages: [body] });
    await assert.rejects(
      () => fetchTalentlink(BOARD, { fetchImpl: impl, sleep: async () => {}, company: { name: 'Acme', careers_url: BOARD }, idCache: new Map() }),
      /expected jobs\[\]/, JSON.stringify(body));
  }
});

test('talentlink: a page without the widget throws instead of reading as empty', async () => {
  const { impl, calls } = makeFetch({ html: '<html><body>maintenance</body></html>' });
  await assert.rejects(
    () => fetchTalentlink(BOARD, { fetchImpl: impl, sleep: async () => {}, company: { name: 'Acme', careers_url: BOARD }, idCache: new Map() }),
    /no FO widget/);
  assert.equal(calls.length, 1);
});

test('talentlink: a 403 from the career page or the FO API reads as a missing board (404)', async () => {
  const entry = { name: 'Acme', careers_url: BOARD };

  const pageRefused = makeFetch();
  pageRefused.impl = async () => { const e = new Error('HTTP 403'); e.status = 403; throw e; };
  await assert.rejects(
    () => fetchTalentlink(BOARD, { fetchImpl: pageRefused.impl, sleep: async () => {}, company: entry, idCache: new Map() }),
    (e) => e.status === 404 && /no career page/.test(e.message));

  const cfgRefused = makeFetch({ config: Object.assign(new Error('HTTP 403'), { status: 403 }) });
  await assert.rejects(
    () => fetchTalentlink(BOARD, { fetchImpl: cfgRefused.impl, sleep: async () => {}, company: entry, idCache: new Map() }),
    (e) => e.status === 404 && /site id not recognised/.test(e.message));

  const apiRefused = makeFetch({ pages: [Object.assign(new Error('HTTP 403'), { status: 403 })] });
  await assert.rejects(
    () => fetchTalentlink(BOARD, { fetchImpl: apiRefused.impl, sleep: async () => {}, company: entry, idCache: new Map() }),
    (e) => e.status === 404 && /site id not recognised/.test(e.message));

  // A plain 404 on the career page propagates as 404 too (isGone).
  const notFound = makeFetch();
  notFound.impl = async () => badStatus(404);
  await assert.rejects(
    () => fetchTalentlink(BOARD, { fetchImpl: notFound.impl, sleep: async () => {}, company: entry, idCache: new Map() }),
    (e) => e.status === 404);
});

test('talentlink: pagination walks full pages and stops on a short one', async () => {
  const full = (start) => Array.from({ length: 100 }, (_, i) => row(start + i));
  const { jobs, calls } = await fetchEntry({ name: 'Acme', careers_url: BOARD }, {
    pages: [jobsPage(full(1), 0), jobsPage(full(101), 0), jobsPage([row(201)], 0)],
  });
  // jobsCount 0 next to full pages is ignored; the short page ends the walk.
  const walked = await jobs;
  assert.equal(walked.length, 201);
  assert.deepEqual(listCalls(calls).map((c) => new URL(c.url).searchParams.get('firstResult')), ['0', '100', '200']);
  assert.equal(walked.truncated, undefined);
});

test('talentlink: pagination stops when jobsCount is reached on a full page', async () => {
  const full = Array.from({ length: 100 }, (_, i) => row(i + 1));
  const { jobs, calls } = await fetchEntry({ name: 'Acme', careers_url: BOARD }, { pages: [jobsPage(full, 100)] });
  assert.equal((await jobs).length, 100);
  assert.equal(listCalls(calls).length, 1);
});

test('talentlink: resolveMaxPages bounds the walk; a cap stop warns and marks page-cap', async () => {
  assert.equal(resolveMaxPages({}), 20);
  assert.equal(resolveMaxPages({ max_pages: 3 }), 3);
  assert.equal(resolveMaxPages({ max_pages: 5000 }), 200, 'clamped to the hard ceiling');

  const capture = [];
  const origError = console.error;
  console.error = (...a) => capture.push(a.join(' '));
  try {
    let n = 0;
    const { calls } = makeFetch();
    const jobs = await fetchTalentlink(BOARD, {
      fetchImpl(url, opts) {
        calls.push({ url, opts });
        if (url === BOARD + 'index.html') return okText(page());
        if (url.endsWith('/fo/rest/config')) return okJson(CONFIG);
        if (url.endsWith('/fo/rest/jobs/criteria')) return okJson(CRITERIA);
        const rows = Array.from({ length: 100 }, () => row(++n));
        return okJson(jobsPage(rows, 100000));
      },
      sleep: async () => {},
      company: { name: 'Acme', careers_url: BOARD },
      idCache: new Map(),
    });    assert.equal(listCalls(calls).length, 20);
    assert.equal(jobs.length, 2000);
    assert.ok(capture.some((w) => /raise max_pages/.test(w)));
    assert.deepEqual(jobs.truncated, { reason: 'page-cap', fetched: 2000, total: 100000 });

    const capped = await fetchEntry({ name: 'Acme', careers_url: BOARD, max_pages: 1 }, {
      pages: [jobsPage(Array.from({ length: 100 }, (_, i) => row(i + 1)), 500)],
    });
    await capped.jobs;
    assert.equal(listCalls(capped.calls).length, 1);
  } finally {
    console.error = origError;
  }
});

test('talentlink: a failed page 2 keeps page 1 and warns without the max_pages hint', async () => {
  const capture = [];
  const origWarn = console.warn;
  console.warn = (...a) => capture.push(a.join(' '));
  try {
    const full = Array.from({ length: 100 }, (_, i) => row(i + 1));
    const { jobs } = await fetchEntry({ name: 'Acme', careers_url: BOARD }, {
      pages: [jobsPage(full, 300), Object.assign(new Error('HTTP 400'), { status: 400 })],
    });
    const kept = await jobs;
    assert.equal(kept.length, 100);
    assert.ok(capture.some((w) => /page 2 failed/.test(w)));
    assert.ok(!capture.some((w) => /raise max_pages/.test(w)));
    assert.deepEqual(kept.truncated, { reason: 'fetch-error', fetched: 100, total: 300 });
  } finally {
    console.warn = origWarn;
  }
});

test('talentlink: a failed criteria call leaves locations empty and keeps the postings', async () => {
  const capture = [];
  const origWarn = console.warn;
  console.warn = (...a) => capture.push(a.join(' '));
  try {
    const { jobs } = await fetchEntry({ name: 'Acme', careers_url: BOARD }, { criteria: Object.assign(new Error('HTTP 500'), { status: 500 }) });
    const kept = await jobs;
    assert.equal(kept.length, 1);
    assert.equal(kept[0].location, '');
    assert.ok(capture.some((w) => /criteria unavailable/.test(w)));
  } finally {
    console.warn = origWarn;
  }
});

test('talentlink: the site pair is cached; a 403 on a cached pair drops it', async () => {
  clearTalentlinkSiteCache();
  const store = new Map();
  const idCache = { get: (k) => store.get(k), set: (k, v) => store.set(k, v), delete: (k) => store.delete(k) };
  const first = await fetchEntry({ name: 'Acme', careers_url: BOARD }, {}, { idCache });
  void first;
  assert.equal(store.get(`${BOARD}index.html`).id, `${FO_HOST} ${SITE_ID} ${BOARD}details.html`);

  const second = await fetchEntry({ name: 'Acme', careers_url: BOARD }, {}, { idCache });
  assert.equal(second.calls.filter((c) => c.url.endsWith('index.html') || c.url.endsWith('/config')).length, 0,
    'a fresh cached pair costs no page/config request');

  const refused = makeFetch({ pages: [Object.assign(new Error('HTTP 403'), { status: 403 })] });
  await assert.rejects(
    () => fetchTalentlink(BOARD, { fetchImpl: refused.impl, sleep: async () => {}, company: { name: 'Acme', careers_url: BOARD }, idCache }),
    (e) => e.status === 404);
  assert.equal(store.has(`${BOARD}index.html`), false, 'a refused cached pair is dropped so the next scan re-reads the page');
});

test('talentlink: resolveDetailPage keeps the configured posting page only on the career page host', () => {
  const board = resolveBoard('https://careers.acme.example/acme_jobsearch.html', { vendorOnly: false });
  assert.equal(resolveDetailPage('details.html', board), 'https://careers.acme.example/details.html');
  assert.equal(resolveDetailPage('https://careers.acme.example/acme_jobdescription.html', board), 'https://careers.acme.example/acme_jobdescription.html');
  for (const bad of ['https://evil.example/details.html', 'http://careers.acme.example/details.html', 'javascript:alert(1)', 'feed.xml', '', null, 42]) {
    assert.equal(resolveDetailPage(bad, board), 'https://careers.acme.example/details.html', String(bad));
  }
  const vendor = resolveBoard('https://acme.recruitmentplatform.com/FO/ABC/components/index.html');
  assert.equal(resolveDetailPage('details.html', vendor), 'https://acme.recruitmentplatform.com/FO/ABC/components/details.html');
  assert.equal(resolveDetailPage('https://acme.recruitmentplatform.com/details.html', resolveBoard(BOARD)), 'https://acme.recruitmentplatform.com/details.html');
});

test('talentlink adapter: matches vendor tenants and explicit provider entries, not junk', () => {
  assert.equal(talentlinkAdapter.matches({ name: 'Acme', careers_url: BOARD }), true);
  assert.equal(talentlinkAdapter.matches({ name: 'Acme', careers_url: 'https://acme.recruitmentplatform.com/internal/index.html' }), true);
  assert.equal(talentlinkAdapter.matches({ name: 'Acme', provider: 'talentlink', careers_url: 'https://careers.acme.example/jobs/' }), true);
  assert.equal(talentlinkAdapter.matches({ name: 'Acme', careers_url: 'http://acme.recruitmentplatform.com/' }), false, 'https only');
  assert.equal(talentlinkAdapter.matches({ name: 'Acme', careers_url: 'https://careers.acme.example/jobs/' }), false, 'branded domains need provider: talentlink');
  assert.equal(talentlinkAdapter.matches({}), false);
  assert.equal(talentlinkAdapter.matches(null), false);
  assert.equal(talentlinkAdapter.buildEndpoint({ name: 'Acme', careers_url: BOARD }), BOARD);
  assert.equal(talentlinkAdapter.buildEndpoint({}), null, 'no endpoint without a board URL');
  assert.equal(talentlinkAdapter.id, 'talentlink');
});
