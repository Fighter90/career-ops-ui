/**
 * softgarden source — Phase-2 (v1.242.0) correctness.
 *
 * Covers what sources-parity-v1117.test.mjs does not: the shape contract at
 * fetch level — a 200 that is not the jobs widget (challenge page, wrong
 * template) THROWS instead of parsing as an empty board, while a genuine
 * widget page with zero postings still reads as a healthy empty board.
 * CI-isolated: fake fetchImpl, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchSoftgarden, parseWidget, resolveWidgetUrl } from '../server/lib/sources/softgarden.mjs';

const WIDGET_URL = 'https://renk-group.softgarden.io/de/widgets/jobs';

const jobBlock = (id, title) =>
  `<div class="matchElement" id="job_id_${id}"><div class="matchValue title">` +
  `<a href="../../job/${id}/${title.toLowerCase().replace(/\s+/g, '-')}">${title}</a></div></div>`;

/** A minimal but structurally real widget page (the markers a real page carries). */
const widgetPage = (blocks = '') =>
  `<html xmlns:wicket="http://wicket.sourceforge.net/"><head>` +
  `<style type="text/css" id="jobSearchCss">#jobsContainer .matchContainer .title { width: 38% }</style>` +
  `</head><body><div id="jobsContainer">${blocks}</div></body></html>`;

const textResponse = (body) => async () => ({ ok: true, status: 200, text: async () => body });

test('fetchSoftgarden: a non-widget 200 (challenge page, foreign template) THROWS', async () => {
  for (const body of [
    '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>cf-challenge</body></html>',
    '<html><body><div id="app">not a softgarden widget</div></body></html>',
    '',
  ]) {
    await assert.rejects(
      () => fetchSoftgarden(WIDGET_URL, { fetchImpl: textResponse(body), company: { name: 'RENK' } }),
      /widget/,
      JSON.stringify(body.slice(0, 60)),
    );
  }
});

test('fetchSoftgarden: an empty-but-real widget page is a healthy empty board', async () => {
  const jobs = await fetchSoftgarden(WIDGET_URL, {
    fetchImpl: textResponse(widgetPage('')),
    company: { name: 'RENK' },
  });
  assert.deepEqual(jobs, []);
});

test('fetchSoftgarden: a widget page with postings parses through the same guard', async () => {
  const jobs = await fetchSoftgarden(WIDGET_URL, {
    fetchImpl: textResponse(widgetPage(jobBlock(101, 'ML Engineer'))),
    company: { name: 'RENK' },
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'ML Engineer');
  assert.equal(jobs[0].source, 'softgarden');
});

test('parseWidget stays a pure parser: non-string input is [] (the fetch layer owns the throw)', () => {
  assert.deepEqual(parseWidget(null, WIDGET_URL, 'x'), []);
  assert.deepEqual(parseWidget(undefined, WIDGET_URL, 'x'), []);
});

test('resolveWidgetUrl keeps rejecting off-host and non-https targets (regression guard)', () => {
  assert.equal(resolveWidgetUrl({ careers_url: 'https://evil.example.com/de/widgets/jobs' }), null);
  assert.equal(resolveWidgetUrl({ careers_url: 'http://renk-group.softgarden.io/de/widgets/jobs' }), null);
  assert.equal(resolveWidgetUrl({ careers_url: 'https://softgarden.io.evil.test/de/widgets/jobs' }), null);
});
