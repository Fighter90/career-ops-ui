/**
 * MokaHR source — ported from parent career-ops v1.31.0.
 *
 * The response is AES-128-CBC ciphertext with the key shipped alongside it, so
 * these tests build a REAL envelope with node's own crypto rather than stubbing
 * the decryption — a stub would pass even if the cipher, key length or IV were
 * wrong, which is the only hard part of reading this board.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv } from 'node:crypto';
import {
  meta, parseTenantUrl, decryptMokaHrEnvelope, parseMokaHrJobs, buildMokaHrUrl, fetchMokaHr,
} from '../server/lib/sources/mokahr.mjs';
import { mokahrAdapter } from '../server/lib/portals/adapters/mokahr.mjs';

const KEY = '0123456789abcdef';                       // 16 bytes, as the server ships
const IV = Buffer.from('de7c21ed8d6f50fe', 'utf8');

/** Build the real `{ data, necromancer }` envelope the endpoint returns. */
function seal(payload, key = KEY) {
  const c = createCipheriv('aes-128-cbc', Buffer.from(key, 'utf8'), IV);
  const data = Buffer.concat([c.update(JSON.stringify(payload), 'utf8'), c.final()]).toString('base64');
  return { data, necromancer: key };
}

const JOB = {
  id: 9, title: '产品经理',
  locations: [{ provinceName: '北京', cityName: '朝阳' }],
  commitment: '全职', department: { name: '产品部' },
  jobDescription: '&lt;p&gt;做产品&lt;/p&gt;',
  createdAt: '2026-08-01T00:00:00Z',
};

test('meta is registry-shaped', () => {
  assert.deepEqual(meta, { value: 'mokahr', label: 'MokaHR', region: 'en' });
});

test('a tenant URL yields org, site id and the base for job links', () => {
  assert.deepEqual(parseTenantUrl('https://app.mokahr.com/social-recruitment/acme/12345'), {
    orgId: 'acme', siteId: 12345, baseUrl: 'https://app.mokahr.com/social-recruitment/acme/12345',
    apiUrl: 'https://app.mokahr.com/api/outer/ats-apply/website/jobs/v2',
  });
  assert.ok(parseTenantUrl('https://app.mokahr.com/campus-recruitment/acme/1'));
  assert.ok(parseTenantUrl('https://app.mokahr.com/apply/acme/1'));
});

test('the host is pinned and the site id must be a positive integer', () => {
  // siteId reaches a request BODY, so a loose check here is the SSRF hole.
  assert.equal(parseTenantUrl('https://app.mokahr.com.evil.test/social-recruitment/a/1'), null);
  assert.equal(parseTenantUrl('http://app.mokahr.com/social-recruitment/a/1'), null);
  assert.equal(parseTenantUrl('https://app.mokahr.com/social-recruitment/a/0'), null);
  assert.equal(parseTenantUrl('https://app.mokahr.com/other/a/1'), null);
  assert.equal(parseTenantUrl('not a url'), null);
});

test('tenants excluded by robots.txt are refused at config time', () => {
  // Refused before any request, rather than fetched and discarded.
  assert.equal(parseTenantUrl('https://app.mokahr.com/social-recruitment/shopee/74378'), null);
  assert.equal(parseTenantUrl('https://app.mokahr.com/social-recruitment/lingjuninvest/46355'), null);
});

test('a real AES envelope round-trips', () => {
  const out = decryptMokaHrEnvelope(seal({ data: { jobs: [JOB] } }));
  assert.equal(out.data.jobs[0].title, '产品经理');
});

test('a broken envelope throws rather than yielding an empty board', () => {
  assert.throws(() => decryptMokaHrEnvelope({ data: 'x' }), /missing data\/necromancer/);
  assert.throws(() => decryptMokaHrEnvelope({ necromancer: KEY }), /missing data\/necromancer/);
  assert.throws(() => decryptMokaHrEnvelope({ data: 'x', necromancer: 'short' }), /expected 16/);
});

test('a decrypted posting yields the web-ui job shape', () => {
  const [job] = parseMokaHrJobs({ data: { jobs: [JOB] } }, 'Acme', 'https://app.mokahr.com/social-recruitment/acme/12345');
  assert.equal(job.title, '产品经理');
  assert.equal(job.company, 'Acme');
  assert.equal(job.url, 'https://app.mokahr.com/social-recruitment/acme/12345#/job/9');
  assert.equal(job.location, '北京 朝阳');
  assert.equal(job.description, '类型: 全职\n部门: 产品部\n做产品');
  assert.equal(job.date.slice(0, 10), '2026-08-01');
  assert.equal(job.source, 'mokahr');
});

test('a timestamp without an offset is dropped, not guessed', () => {
  // A bare local string would be parsed in the SERVER's zone and silently shift
  // the posting date, so it is left empty instead.
  const [bare] = parseMokaHrJobs({ data: { jobs: [{ ...JOB, createdAt: '2026-08-01 10:00:00' }] } }, 'A', 'https://x');
  assert.equal(bare.date, '');
  const [offset] = parseMokaHrJobs({ data: { jobs: [{ ...JOB, createdAt: '2026-08-01T10:00:00+08:00' }] } }, 'A', 'https://x');
  assert.notEqual(offset.date, '');
});

test('rows without a title or an id are skipped', () => {
  const rows = parseMokaHrJobs({ data: { jobs: [{ id: 1 }, { title: 'no id' }, JOB] } }, 'A', 'https://x');
  assert.equal(rows.length, 1);
});

test('an unusable careers_url fails loudly at endpoint time', () => {
  assert.throws(() => buildMokaHrUrl({ careers_url: 'https://evil.test' }), /allowed HTTPS tenant URL on app\.mokahr\.com or hire-r1\.mokahr\.com/);
  assert.equal(buildMokaHrUrl({ careers_url: 'https://app.mokahr.com/apply/acme/7' }),
    'https://app.mokahr.com/api/outer/ats-apply/website/jobs/v2');
});

test('fetchMokaHr sends the tenant ids and refuses redirects', async () => {
  let seen = null;
  const fake = async (url, opts) => {
    seen = opts;
    return { ok: true, status: 200, headers: new Map([['content-type', 'application/json']]), json: async () => seal({ data: { jobs: [JOB] } }) };
  };
  const rows = await fetchMokaHr('', {
    fetchImpl: fake,
    company: { name: 'Acme', careers_url: 'https://app.mokahr.com/social-recruitment/acme/12345' },
  });
  assert.equal(rows.length, 1);
  const body = JSON.parse(seen.body);
  assert.equal(body.siteId, 12345);
  assert.equal(body.orgId, 'acme');
  assert.equal(body.limit, 50, 'the server ceiling');
  assert.equal(seen.redirect, 'error');
});

test('adapter matches the provider and a valid tenant URL only', () => {
  assert.equal(mokahrAdapter.matches({ provider: 'mokahr' }), true);
  assert.equal(mokahrAdapter.matches({ careers_url: 'https://app.mokahr.com/apply/acme/1' }), true);
  assert.equal(mokahrAdapter.matches({ careers_url: 'https://app.mokahr.com.evil.test/apply/a/1' }), false);
});

test('hire-r1 is allowed, but no other mokahr.com subdomain', () => {
  assert.ok(parseTenantUrl('https://hire-r1.mokahr.com/social-recruitment/example-pay/100008889'));
  assert.equal(parseTenantUrl('https://hire-r1-ats.mokahr.com/social-recruitment/example-pay/100008889'), null);
  assert.equal(parseTenantUrl('https://hire-r2.mokahr.com/social-recruitment/example-pay/100008889'), null);
});

test('the API call and job links use the careers_url host; plaintext data is accepted', async () => {
  const R1 = 'https://hire-r1.mokahr.com/social-recruitment/example-pay/100008889';
  assert.equal(buildMokaHrUrl({ careers_url: R1 }), 'https://hire-r1.mokahr.com/api/outer/ats-apply/website/jobs/v2');
  const urls = [];
  const plain = (body) => async (url) => {
    urls.push(url);
    return { ok: true, status: 200, headers: new Map([['content-type', 'application/json']]), json: async () => body };
  };
  const rows = await fetchMokaHr('', {
    fetchImpl: plain({ code: 0, success: true, data: { jobs: [JOB] } }),
    company: { name: 'Example Pay', careers_url: R1 },
  });
  assert.equal(urls[0], 'https://hire-r1.mokahr.com/api/outer/ats-apply/website/jobs/v2');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].url, `${R1}#/job/9`);
  await assert.rejects(
    fetchMokaHr('', { fetchImpl: plain({ code: 102, success: false, msg: 'bad', data: {} }), company: { careers_url: R1 } }),
    /API error: bad/,
  );
});

// ---------------------------------------------------------------------------
// v1.242.0 — pagination stops on the RAW page length; in-band errors are read
// BEFORE unwrapping and share the walk's try, so a mid-walk {code, success:
// false, msg} keeps the pages already collected and its error text survives.
// ---------------------------------------------------------------------------

test('pagination stops on the RAW page length, not the normalized count', async () => {
  // Page 1: 50 raw rows (a FULL page) of which 49 lack a title → 1 job. The
  // normalized count read that as a short page and cut the walk after it.
  const fullButDirty = [
    ...Array.from({ length: 49 }, (_, i) => ({ id: i })), // no title → dropped
    JOB,
  ];
  const pages = [
    seal({ data: { jobs: fullButDirty } }),
    seal({ data: { jobs: [{ ...JOB, id: 20, title: '第二页' }, { ...JOB, id: 21 }, { ...JOB, id: 22 }] } }),
  ];
  let call = 0;
  const fake = async () => ({ ok: true, status: 200, headers: new Map(), json: async () => pages[call++] ?? pages[1] });
  const rows = await fetchMokaHr('', {
    fetchImpl: fake,
    company: { name: 'Acme', careers_url: 'https://app.mokahr.com/social-recruitment/acme/12345' },
  });
  assert.equal(call, 2, 'a full-but-dirty page must be walked past');
  assert.equal(rows.length, 4); // 1 + 3
});

test('hire-r1 plaintext in-band errors keep their msg and share the walk catch', async () => {
  const R1 = 'https://hire-r1.mokahr.com/social-recruitment/example-pay/100008889';
  const errorBody = { code: 102, success: false, msg: 'tenant paused hiring' }; // no data/necromancer

  // First page: the error IS the result — throw with the real text, not the
  // generic missing-data/necromancer unwrap failure.
  await assert.rejects(
    fetchMokaHr('', { fetchImpl: async () => ({ ok: true, status: 200, headers: new Map(), json: async () => errorBody }), company: { careers_url: R1 } }),
    /API error: tenant paused hiring/,
  );

  // Mid-walk: a FULL page 1, then page 2 answers the error → page-1 jobs kept.
  let call = 0;
  const fullPage = [...Array.from({ length: 49 }, (_, i) => ({ id: `filler-${i}`, title: `F${i}` })), JOB];
  const pages = [seal({ data: { jobs: fullPage } }), errorBody];
  const kept = await fetchMokaHr('', {
    fetchImpl: async () => ({ ok: true, status: 200, headers: new Map(), json: async () => pages[call++] ?? errorBody }),
    company: { name: 'Example Pay', careers_url: R1 },
  });
  assert.equal(call, 2);
  assert.equal(kept.length, 50);
});
