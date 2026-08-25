/**
 * Recruitee source — #3175: the list payload embeds each offer's HTML body for
 * free, stripped to plain text as `description` so the content_filter can match.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecruiteeResponse } from '../server/lib/sources/recruitee.mjs';

test('recruitee: description is stripped from the offer HTML body', () => {
  const json = { offers: [{
    title: 'Backend Engineer',
    careers_url: 'https://careers.acme.com/o/backend-engineer',
    city: 'Berlin',
    country: 'Germany',
    description: '<p>Work with <b>Go</b> &amp; Postgres.</p>',
  }] };
  const jobs = parseRecruiteeResponse(json, 'Acme');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].description, 'Work with Go & Postgres.');
});

test('recruitee: no body → empty description, not a crash', () => {
  const json = { offers: [{ title: 'X', url: 'https://acme.recruitee.com/o/x' }] };
  const jobs = parseRecruiteeResponse(json, 'Acme');
  assert.equal(jobs[0].description, '');
});
