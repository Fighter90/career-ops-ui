/**
 * Teamtailor source (v1.80.0). Per-tenant career site, public /jobs.rss feed.
 * CI-isolated (fake fetchImpl).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTeamtailorFeed, fetchTeamtailor, assertTeamtailorUrl } from '../server/lib/sources/teamtailor.mjs';
import { teamtailorAdapter } from '../server/lib/portals/adapters/teamtailor.mjs';

const RSS = `<?xml version="1.0"?><rss xmlns:teamtailor="https://teamtailor.com/ns"><channel>
  <item><title>Backend Engineer</title><link>https://acme.teamtailor.com/jobs/1</link><teamtailor:location>Berlin, Germany</teamtailor:location><teamtailor:department>Engineering</teamtailor:department><pubDate>Wed, 25 Jun 2026 00:00:00 +0000</pubDate></item>
  <item><title><![CDATA[Remote Designer]]></title><link>https://acme.teamtailor.com/jobs/2</link><category>Design</category></item>
  <item><title>No Link</title></item>
</channel></rss>`;

test('parseTeamtailorFeed: title/link, teamtailor:location + department, CDATA, remote inference', () => {
  const jobs = parseTeamtailorFeed(RSS, 'Acme');
  assert.equal(jobs.length, 2); // no-link dropped
  assert.equal(jobs[0].title, 'Backend Engineer');
  assert.equal(jobs[0].location, 'Berlin, Germany');
  assert.equal(jobs[0].snippet, 'Engineering'); // department → snippet
  assert.equal(jobs[0].isRemote, false);
  assert.equal(jobs[0].date, '2026-06-25');
  assert.equal(jobs[0].source, 'teamtailor');
  assert.equal(jobs[1].title, 'Remote Designer'); // CDATA
  assert.equal(jobs[1].isRemote, true);           // "Remote" in title
  assert.equal(jobs[1].location, 'Remote');
  assert.equal(jobs[1].snippet, 'Design');        // category fallback
});

test('fetchTeamtailor: normalizes via fake fetchImpl + stamps company', async () => {
  const fetchImpl = async () => ({ ok: true, text: async () => RSS });
  const jobs = await fetchTeamtailor('https://acme.teamtailor.com/jobs.rss', { fetchImpl, company: { name: 'Acme' } });
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((j) => j.company === 'Acme' && j.source === 'teamtailor'));
});

test('assertTeamtailorUrl: pins host to <slug>.teamtailor.com', () => {
  assert.equal(assertTeamtailorUrl('https://acme.teamtailor.com/jobs.rss'), 'https://acme.teamtailor.com/jobs.rss');
  assert.throws(() => assertTeamtailorUrl('https://evil.com/jobs.rss'), /untrusted hostname/);
  assert.throws(() => assertTeamtailorUrl('http://acme.teamtailor.com/jobs.rss'), /must use HTTPS/);
});

test('adapter: detects <slug>.teamtailor.com host + builds /jobs.rss; off-domain → no match', () => {
  assert.ok(teamtailorAdapter.matches({ careers_url: 'https://acme.teamtailor.com' }));
  assert.ok(teamtailorAdapter.matches({ provider: 'teamtailor' }));
  assert.equal(teamtailorAdapter.matches({ careers_url: 'https://acme.example.com' }), false);
  assert.equal(teamtailorAdapter.buildEndpoint({ careers_url: 'https://acme.teamtailor.com' }), 'https://acme.teamtailor.com/jobs.rss');
});
