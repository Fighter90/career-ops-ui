/**
 * deutschebahn parent parity (40c37397 and follow-ups): a posting db.jobs
 * cannot render blanks the page that holds it, so the walk sorts newest-first
 * with 1000-hit pages, and an empty page is only "no jobs" when the results
 * header says data-count="0". Stubbed transport, no network, no parent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchDeutschebahn,
  parseResultCount,
  countHitAnchors,
  countMissedPostingLinks,
} from '../server/lib/sources/deutschebahn.mjs';

const ENDPOINT = 'https://db.jobs/service/search/de-de/5441588';
const textResponse = (s) => ({ ok: true, status: 200, text: async () => s });
const hit = (id, title = `Job ${id}`) =>
  `<a href="/de-de/Suche/Job-1396${id}?jobId=${id}" class="m-search-hit" data-job-id="${id}"><h3 class="m-search-hit__title"><span class="m-search-hit__title-text"> ${title} </span></h3><ul><li><i aria-label="Arbeitsort"></i> Berlin </li></ul></a>`;
const full = (ids) => '<html>' + Array.from({ length: 1000 }, (_, i) => hit(ids[i % ids.length])).join('') + '</html>';
const countHtml = (n) => `<span class="result-count" data-count="${n}">${n} Stellen</span>`;
const drifted = (id) => `<a href="/de-de/Suche/Job-1396${id}?jobId=${id}" class="m-renamed-hit" data-job-id="${id}"><span>Job ${id}</span></a>`;

async function run(pagesOrFn, company = {}) {
  const urls = [];
  let n = 0;
  const fetchImpl = async (url) => {
    urls.push(url);
    const body = typeof pagesOrFn === 'function' ? pagesOrFn(++n) : (pagesOrFn[n++] ?? '<html></html>');
    return textResponse(body);
  };
  const warnings = [];
  const orig = console.warn;
  console.warn = (m) => warnings.push(String(m));
  try {
    const jobs = await fetchDeutschebahn(ENDPOINT, { fetchImpl, company: { name: 'Deutsche Bahn', ...company } });
    return { jobs, urls, warnings };
  } catch (error) {
    return { error, urls, warnings };
  } finally {
    console.warn = orig;
  }
}

test('requests 1000-hit pages sorted by pubExternalDate_tdt, never score', async () => {
  const { urls } = await run([full(['1']), '<html></html>']);
  assert.ok(urls.every((u) => u.includes('itemsPerPage=1000') && u.includes('sort=pubExternalDate_tdt') && !u.includes('sort=score')));
});

test('countHitAnchors / parseResultCount / countMissedPostingLinks', () => {
  assert.equal(countHitAnchors(full(['1', '2'])), 1000);
  assert.equal(countHitAnchors(undefined), 0);
  assert.equal(parseResultCount(countHtml('3.596')), 3596);
  assert.equal(parseResultCount(countHtml('0')), 0);
  assert.equal(parseResultCount('<html>shell</html>'), null);
  assert.equal(parseResultCount(undefined), null);
  assert.equal(countMissedPostingLinks('<html>' + hit('1') + drifted('2') + '</html>'), 1);
  assert.equal(countMissedPostingLinks('<html>' + hit('1') + '</html>'), 0);
});

test('a short page ends the walk; a full page of repeats does not', async () => {
  const short = await run([`<html>${hit('1')}${hit('2')}</html>`]);
  assert.equal(short.jobs.length, 2);
  assert.equal(short.urls.length, 1);
  const repeat = await run([full(['5']), full(['5']), full(['6']), '<html></html>']);
  assert.equal(repeat.jobs.length, 2);
  assert.equal(repeat.urls.length, 4);
});

test('MAX_JOBS: one full page of unique postings is the whole scan', async () => {
  const ids = Array.from({ length: 1000 }, (_, i) => String(600000 + i));
  const r = await run([full(ids)]);
  assert.equal(r.jobs.length, 1000);
  assert.equal(r.urls.length, 1);
});

test('first page: data-count="0" is an empty board; shell / positive count / posting links throw', async () => {
  const empty = await run([`<html>${countHtml('0')}</html>`]);
  assert.deepEqual(empty.jobs, []);
  const shell = await run(['<html><main><h1>Suche</h1></main></html>']);
  assert.match(shell.error.message, /results shell/);
  const drift = await run([`<html>${countHtml('3.596')}<div class="renamed-hit">x</div></html>`]);
  assert.match(drift.error.message, /3596 postings/);
  const zeroLinks = await run([`<html>${countHtml('0')}${drifted('900001')}</html>`]);
  assert.match(zeroLinks.error.message, /posting links/);
});

test('later page carrying posting links but no parsed hit throws', async () => {
  const r = await run([full(['1', '2']), `<html>${countHtml('3.596')}${drifted('900002')}</html>`]);
  assert.match(r.error.message, /posting links/);
  assert.equal(r.urls.length, 2);
});

test('parsed hit beside an unparsed posting link keeps the row and warns', async () => {
  const r = await run([`<html>${hit('1')}${drifted('900003')}</html>`]);
  assert.equal(r.jobs.length, 1);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /1 posting\(s\) no hit anchor carries/);
});

test('empty later page: inside the total warns and keeps partials; at the total or without count is silent', async () => {
  const truncated = await run([full(['1', '2']), `<html>${countHtml('3.596')}</html>`]);
  assert.equal(truncated.jobs.length, 2);
  assert.equal(truncated.warnings.length, 1);
  assert.match(truncated.warnings[0], /3596 postings reported/);
  const end = await run([full(['1', '2']), `<html>${countHtml('2')}</html>`]);
  const noCount = await run([full(['1', '2']), '<html><h1>Suche</h1></html>']);
  assert.equal(end.warnings.length, 0);
  assert.equal(noCount.warnings.length, 0);
  assert.equal(end.jobs.length, 2);
  assert.equal(noCount.jobs.length, 2);
});

test('max_pages cap warns after a full page unless the reported total is covered', async () => {
  const capped = await run((n) => full([String(700100 + n)]), { max_pages: 3 });
  assert.equal(capped.jobs.length, 3);
  assert.equal(capped.warnings.length, 1);
  assert.match(capped.warnings[0], /raise max_pages/);
  const covered = await run((n) => full([String(700150 + n)]).replace('</html>', `${countHtml('2.500')}</html>`), { max_pages: 3 });
  assert.equal(covered.jobs.length, 3);
  assert.equal(covered.warnings.length, 0);
  // non-positive max_pages falls back to the default of 5
  const fallback = await run((n) => full([String(700200 + n)]), { max_pages: 0 });
  assert.equal(fallback.urls.length, 5);
});

test('a later-page failure keeps collected pages and warns; a first-page failure throws', async () => {
  const later = await run((n) => {
    if (n === 1) return full(['630365', '631112']);
    throw new Error('boom');
  });
  assert.equal(later.error, undefined);
  assert.equal(later.jobs.length, 2);
  assert.equal(later.warnings.length, 1);
  assert.match(later.warnings[0], /page 1 failed/);
  assert.doesNotMatch(later.warnings[0], /raise max_pages/);
  const first = await run(() => { throw new Error('dead'); });
  assert.match(first.error.message, /dead/);
});
