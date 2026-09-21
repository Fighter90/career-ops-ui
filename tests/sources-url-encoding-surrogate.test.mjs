/**
 * Parent parity (career-ops #3513, HEAD after 1.32.0) — a lone UTF-16 surrogate
 * in ONE job id must drop that posting, not the whole page.
 *
 * `encodeURIComponent` throws URIError on a lone surrogate, and a JSON string
 * can carry one (`JSON.parse('"\\uD800x"')` keeps it). Every JSON-API source
 * that builds a job URL from a host-controlled id/slug inside a `.map()` /
 * `for` loop therefore had the same latent failure: one malformed posting
 * aborted the parse loop and lost every job on the page. The parent routed each
 * such call through `providers/_safe-url.mjs` and dropped the one posting on a
 * null return; this is the same change, mirrored into `server/lib/sources/`.
 *
 * Three parts, matching the parent's suite:
 *   1. the helper's own contract;
 *   2. per-source behaviour — one bad id, one clean id: no throw, clean kept,
 *      bad dropped — driven through each source's exported pure parser;
 *   3. a source-level guard so a NEW source cannot reintroduce a bare
 *      `encodeURIComponent` on a job-URL line, with a reviewed allowlist for
 *      the config-derived cases that are deliberately left strict.
 *
 * CI-isolated: no network, no parent checkout.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'server', 'lib', 'sources');
const load = (f) => import(resolve(SRC, f));

// A lone high surrogate — what encodeURIComponent rejects and what a JSON
// payload can legitimately deliver.
const LONE = '\uD800';

// ── 1. The helper ────────────────────────────────────────────────────────────

test('safeEncodeURIComponent: encodes normally, returns null on a lone surrogate, rethrows caller bugs', async () => {
  const { safeEncodeURIComponent: enc } = await load('_safe-url.mjs');
  assert.equal(enc('a b/c'), 'a%20b%2Fc');
  assert.equal(enc(42), '42', 'coerces like String()');
  assert.equal(enc(`${LONE}bad`), null, 'a lone high surrogate is a null, not a throw');
  assert.equal(enc(`x\uDC00`), null, 'a lone low surrogate too');
  assert.equal(enc('😀'), '%F0%9F%98%80', 'a PAIRED surrogate is fine — that is an ordinary emoji');
  // Only URIError from encodeURIComponent itself becomes null. A throw from the
  // value's own toString is the caller's bug and must propagate.
  const explosive = { toString() { throw new TypeError('caller bug'); } };
  assert.throws(() => enc(explosive), TypeError);
});

// ── 2. Per-source behaviour ──────────────────────────────────────────────────

/** Run `parse`, assert it does not throw, and hand the result to `ok`. */
async function survives(label, parse, ok) {
  let out;
  try { out = await parse(); }
  catch (e) { assert.fail(`${label}: threw on a lone-surrogate id (${e.constructor.name}: ${e.message})`); }
  assert.ok(ok(out), `${label}: expected the clean job kept and the bad one dropped, got ${JSON.stringify(out)}`);
}

test('alibaba.parseAlibabaResponse drops the bad id, keeps the page', async () => {
  const { parseAlibabaResponse } = await load('alibaba.mjs');
  await survives('alibaba',
    () => parseAlibabaResponse({ content: { datas: [{ name: 'Bad', id: `${LONE}bad` }, { name: 'Good', id: 'g-1' }], totalCount: 2 } }, 'Acme').jobs,
    (jobs) => jobs.length === 1 && jobs[0].url.includes('g-1'));
});

test('arbeitsagentur.normalizeJob yields null for a bad refnr, a job for a good one', async () => {
  const { normalizeJob } = await load('arbeitsagentur.mjs');
  await survives('arbeitsagentur',
    () => [normalizeJob({ referenznummer: `${LONE}-bad`, stellenangebotsTitel: 'Bad' }),
           normalizeJob({ referenznummer: 'ok-123', stellenangebotsTitel: 'Good' })],
    ([bad, good]) => bad === null && good !== null && good.url.includes('ok-123'));
});

test('bamboohr.parseBambooHRResponse drops the bad id, keeps the page', async () => {
  const { parseBambooHRResponse } = await load('bamboohr.mjs');
  await survives('bamboohr',
    () => parseBambooHRResponse({ result: [{ id: `${LONE}bad`, jobOpeningName: 'Bad' }, { id: 5, jobOpeningName: 'Good' }] }, 'X', 'https://x.bamboohr.com'),
    (jobs) => jobs.length === 1 && jobs[0].url === 'https://x.bamboohr.com/careers/5');
});

test('feishu-jobs.parseFeishuJobsResponse drops the bad id, keeps the page', async () => {
  const { parseFeishuJobsResponse } = await load('feishu-jobs.mjs');
  await survives('feishu-jobs',
    () => parseFeishuJobsResponse({ data: { count: 2, job_post_list: [{ id: `${LONE}bad`, title: 'Bad' }, { id: 'g-1', title: 'Good' }] } }, 'Acme', 'https://jobs.acme.com'),
    (r) => { const jobs = Array.isArray(r) ? r : r.jobs; return jobs.length === 1 && jobs[0].url.includes('g-1'); });
});

test('garena.parseGarenaResponse drops the bad id, keeps the page', async () => {
  const { parseGarenaResponse } = await load('garena.mjs');
  await survives('garena',
    () => parseGarenaResponse({ jobs: [{ id: `${LONE}bad`, title: 'Bad' }, { id: 'g-1', title: 'Good' }] }, { name: 'Garena' }),
    (jobs) => jobs.length === 1 && jobs[0].url.includes('g-1'));
});

test('jibeapply.parseJibeapplyResponse drops the bad slug, keeps the page', async () => {
  const { parseJibeapplyResponse } = await load('jibeapply.mjs');
  await survives('jibeapply',
    () => parseJibeapplyResponse({ jobs: [{ title: 'Bad', slug: `${LONE}bad` }, { title: 'Good', slug: 'good-1' }] }, { name: 'Acme', careers_url: 'https://acme.jibeapply.com/jobs' }),
    (jobs) => jobs.length === 1 && jobs[0].url.endsWith('/good-1'));
});

test('manfred.normalizeManfredOffer yields null for a bad slug, an offer for a good one', async () => {
  const { normalizeManfredOffer } = await load('manfred.mjs');
  await survives('manfred',
    () => [normalizeManfredOffer({ status: 'ACTIVE', position: 'Bad', id: 5, slug: `${LONE}bad` }),
           normalizeManfredOffer({ status: 'ACTIVE', position: 'Good', id: 6, slug: 'good-1' })],
    ([bad, good]) => bad === null && good !== null && good.url.includes('good-1'));
});

test('meituan.parseMeituanResponse drops the bad id, keeps the page', async () => {
  const { parseMeituanResponse } = await load('meituan.mjs');
  await survives('meituan',
    () => parseMeituanResponse({ data: { list: [{ name: 'Bad', jobUnionId: `${LONE}bad` }, { name: 'Good', jobUnionId: 'g-1' }], page: { totalCount: 2 } } }, 'Acme').jobs,
    (jobs) => jobs.length === 1 && jobs[0].url.includes('g-1'));
});

test('mokahr.parseMokaHrJobs drops the bad id, keeps the page', async () => {
  const { parseMokaHrJobs } = await load('mokahr.mjs');
  await survives('mokahr',
    () => parseMokaHrJobs({ data: { jobs: [{ id: `${LONE}bad`, title: 'Bad' }, { id: 'g-1', title: 'Good' }] } }, 'Acme', 'https://app.mokahr.com/social-recruitment/acme/123456'),
    (jobs) => jobs.length === 1 && jobs[0].url.includes('g-1'));
});

test('phenom.parseRefineSearch drops the bad jobId, keeps the page', async () => {
  const { parseRefineSearch } = await load('phenom.mjs');
  await survives('phenom',
    () => parseRefineSearch({ refineSearch: { totalHits: 2, data: { jobs: [{ jobId: `${LONE}bad`, title: 'Bad' }, { jobId: 'g-1', title: 'Good' }] } } }, { origin: 'https://x.phenom.com', urlPrefix: 'careers' }).jobs,
    (jobs) => jobs.length === 1 && jobs[0].url === 'https://x.phenom.com/careers/job/g-1/Good');
});

test('thehub keeps the clean job and drops the bad id', async () => {
  const mod = await load('thehub.mjs');
  // Whichever pure helper the port exposes; fall back to the fetcher with a
  // stubbed transport so the test stays offline either way.
  if (typeof mod.normalizeHubJob === 'function') {
    await survives('thehub.normalizeHubJob',
      () => [mod.normalizeHubJob({ id: `${LONE}bad`, title: 'Bad' }), mod.normalizeHubJob({ id: 'g-1', title: 'Good' })],
      ([bad, good]) => bad === null && good !== null && good.url.includes('g-1'));
  } else {
    const payload = { jobs: { docs: [{ id: `${LONE}bad`, title: 'Bad' }, { id: 'g-1', title: 'Good' }], total: 2, page: 1, pages: 1, limit: 15 } };
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => payload });
    await survives('thehub.fetchTheHub',
      () => mod.fetchTheHub(mod.FEED_BASE, { fetchImpl, maxPages: 1 }),
      (jobs) => Array.isArray(jobs) && jobs.length === 1 && jobs[0].url === 'https://thehub.io/jobs/g-1');
  }
});

test('tkms.parseQuery drops the bad id, keeps the page', async () => {
  const { parseQuery } = await load('tkms.mjs');
  await survives('tkms',
    () => parseQuery({ totalHits: 2, jobs: [{ data: { id: `${LONE}bad`, title: 'Bad' } }, { data: { id: 'g-1', title: 'Good' } }] }, { origin: 'https://x.tkms.com', locale: 'en' }).rows,
    (rows) => rows.length === 1 && rows[0].url === 'https://x.tkms.com/en/job/Good/g-1');
});

test('vdab.normalizeJob yields null for a bad id, a job for a good one', async () => {
  const { normalizeJob } = await load('vdab.mjs');
  await survives('vdab',
    () => [normalizeJob({ id: { id: `${LONE}bad` }, vacaturefunctie: { naam: 'Bad' } }),
           normalizeJob({ id: { id: 'g-1' }, vacaturefunctie: { naam: 'Good' } })],
    ([bad, good]) => bad === null && good !== null && good.url.includes('g-1'));
});

// web-ui-only sources (not in the parent) that the source-level guard below
// surfaced on the first run — same loop shape, same bug, same fix.

test('jobstreet.parseJobstreetItem drops a bad id without a jobUrl, keeps a good one', async () => {
  const { parseJobstreetItem } = await load('jobstreet.mjs');
  await survives('jobstreet',
    () => [parseJobstreetItem({ id: `${LONE}bad`, title: 'Bad' }, 'https://www.jobstreet.com', 'Acme'),
           parseJobstreetItem({ id: 'g-1', title: 'Good' }, 'https://www.jobstreet.com', 'Acme')],
    ([bad, good]) => bad === null && good !== null && good.url === 'https://www.jobstreet.com/job/g-1');
});

test('jobstreet.parseJobstreetItem falls back to jobUrl when the id is bad', async () => {
  const { parseJobstreetItem } = await load('jobstreet.mjs');
  await survives('jobstreet+jobUrl',
    () => parseJobstreetItem({ id: `${LONE}bad`, title: 'Has URL', jobUrl: 'https://www.jobstreet.com/job/77' }, 'https://www.jobstreet.com', 'Acme'),
    (job) => job !== null && job.url === 'https://www.jobstreet.com/job/77');
});

test('trudvsem.normalizeTrudvsem drops a bad id without a vac_url, keeps a good one', async () => {
  const { normalizeTrudvsem } = await load('trudvsem.mjs');
  await survives('trudvsem',
    () => [normalizeTrudvsem({ vacancy: { id: `${LONE}bad`, 'job-name': 'Bad' } }),
           normalizeTrudvsem({ vacancy: { id: 'g-1', 'job-name': 'Good' } }),
           normalizeTrudvsem({ vacancy: { id: `${LONE}bad`, 'job-name': 'Has URL', vac_url: 'https://trudvsem.ru/vacancy/card/9' } })],
    ([bad, good, withUrl]) => bad === null
      && good !== null && good.url === 'https://trudvsem.ru/vacancy/g-1'
      && withUrl !== null && withUrl.url === 'https://trudvsem.ru/vacancy/card/9');
});

// ── 3. Source-level guard ────────────────────────────────────────────────────

/**
 * Sources that route a job-URL segment through the helper. Each must import
 * `_safe-url.mjs` and call `safeEncodeURIComponent`; dropping either is the
 * regression this list exists to catch.
 */
const CONVERTED = [
  'alibaba.mjs', 'arbeitsagentur.mjs', 'bamboohr.mjs', 'feishu-jobs.mjs', 'garena.mjs',
  'jibeapply.mjs', 'manfred.mjs', 'meituan.mjs', 'mokahr.mjs', 'phenom.mjs',
  'thehub.mjs', 'tkms.mjs', 'vdab.mjs',
  // web-ui-only, surfaced by the guard below on its first run
  'jobstreet.mjs', 'trudvsem.mjs',
];

/**
 * A bare `encodeURIComponent` on a job-URL line that was reviewed and is safe:
 * the value is config-derived or already charset-checked, never a host-
 * controlled field that could abort a batch. Listed with the reason.
 */
const ALLOWLIST = {
  '4dayweek.mjs': 'slug is validated against SLUG_RE (ASCII letters/digits/hyphen) before encoding — a surrogate never reaches encodeURIComponent',
  'csod.mjs': 'corpName comes from portals.yml, not the API — a bad value is a config bug and should fail loud',
};

const SHARED_IMPORT = /\bfrom\s*['"]\.\/_safe-url\.mjs['"]/;
const HELPER_USE = /\bsafeEncodeURIComponent\b/;
// "job-URL line": assigns `url` and calls the bare builtin on the same line.
// The helper's name does not match — the token is the lower-case builtin with a
// word boundary before it.
const BARE_ON_URL_LINE = /\burl\s*[:=][^\n]*\bencodeURIComponent\s*\(/;

test('every converted source still imports and uses safeEncodeURIComponent', () => {
  const regressed = [];
  for (const f of CONVERTED) {
    const src = readFileSync(resolve(SRC, f), 'utf8');
    if (!SHARED_IMPORT.test(src)) regressed.push(`${f} (no longer imports _safe-url.mjs)`);
    else if (!HELPER_USE.test(src)) regressed.push(`${f} (imports the helper but no longer calls it)`);
  }
  assert.deepEqual(regressed, [], 'converted source regressed:\n  ' + regressed.join('\n  '));
});

test('no source references safeEncodeURIComponent without importing it', () => {
  const bad = readdirSync(SRC)
    .filter((f) => f.endsWith('.mjs') && !f.startsWith('_') && f !== 'registry.mjs')
    .filter((f) => { const s = readFileSync(resolve(SRC, f), 'utf8'); return HELPER_USE.test(s) && !SHARED_IMPORT.test(s); });
  assert.deepEqual(bad, [], 'uses the helper without importing it: ' + bad.join(', '));
});

test('no unreviewed source builds a job URL with a bare encodeURIComponent', () => {
  const offenders = [];
  for (const f of readdirSync(SRC).filter((x) => x.endsWith('.mjs') && !x.startsWith('_') && x !== 'registry.mjs')) {
    if (f in ALLOWLIST) continue;
    const hits = readFileSync(resolve(SRC, f), 'utf8').split('\n')
      .map((line, i) => (BARE_ON_URL_LINE.test(line) ? i + 1 : 0)).filter(Boolean);
    if (hits.length) offenders.push(`${f}:${hits.join(',')}`);
  }
  assert.deepEqual(offenders, [],
    'these job-URL lines pass a value straight through encodeURIComponent — route host-controlled ids through _safe-url.mjs, or add the file to ALLOWLIST with a reason:\n  ' + offenders.join('\n  '));
});
