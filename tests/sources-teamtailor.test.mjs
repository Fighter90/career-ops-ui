/**
 * Teamtailor source — Phase-2 (v1.242.0) correctness.
 *
 * Covers what teamtailor-source.test.mjs does not: the shape contract (a 200
 * that is not an RSS document THROWS), the tightened remote heuristic
 * ('distributed' is not a remote-work marker), and the no-fabrication rule
 * (a remote-sounding title never invents a location).
 * CI-isolated: pure parsing + fake fetchImpl, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTeamtailorFeed, fetchTeamtailor } from '../server/lib/sources/teamtailor.mjs';

const feed = (...items) =>
  `<?xml version="1.0"?><rss xmlns:teamtailor="https://teamtailor.com/ns"><channel>${items.join('')}</channel></rss>`;
const item = (title, link, extra = '') =>
  `<item><title>${title}</title><link>${link}</link>${extra}</item>`;

// ── Shape contract ────────────────────────────────────────────────────

test('parseTeamtailorFeed: a 200 body that is not an RSS document THROWS', () => {
  for (const garbage of [
    '<html><body>Just a moment...</body></html>',
    '',
    'plain text',
    '<?xml version="1.0"?><jobposts></jobposts>',
  ]) {
    assert.throws(() => parseTeamtailorFeed(garbage, 'Acme'), /RSS|<rss|<channel/i, JSON.stringify(garbage));
  }
  assert.throws(() => parseTeamtailorFeed(null, 'Acme'), /RSS/);
});

test('parseTeamtailorFeed: a feed container with zero items is a healthy empty board', () => {
  assert.deepEqual(parseTeamtailorFeed(feed(), 'Acme'), []);
});

// ── Remote heuristic: 'distributed' is not a remote marker ───────────

test('a Distributed Systems Engineer is NOT flagged remote by the word "Distributed"', () => {
  const jobs = parseTeamtailorFeed(
    feed(item('Distributed Systems Engineer', 'https://acme.teamtailor.com/jobs/1')),
    'Acme',
  );
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].isRemote, false);
  assert.equal(jobs[0].workplaceType, 'Onsite');
});

test('explicit remote markers still flag remote', () => {
  for (const title of ['Remote Backend Engineer', 'Engineer (anywhere)', 'Developer — Home Office']) {
    const jobs = parseTeamtailorFeed(feed(item(title, 'https://acme.teamtailor.com/jobs/x')), 'Acme');
    assert.equal(jobs[0].isRemote, true, title);
  }
});

// ── No-fabrication: a remote title never invents a location ──────────

test('a remote-sounding title does not fabricate a "Remote" location', () => {
  const jobs = parseTeamtailorFeed(
    feed(item('Remote Backend Engineer', 'https://acme.teamtailor.com/jobs/2')),
    'Acme',
  );
  assert.equal(jobs[0].isRemote, true, 'the remote signal itself is kept');
  assert.equal(jobs[0].location, '', 'location stays empty when the feed names none');
});

test('a feed-provided teamtailor:location still wins untouched', () => {
  const jobs = parseTeamtailorFeed(
    feed(item('Remote Designer', 'https://acme.teamtailor.com/jobs/3',
      '<teamtailor:location>Stockholm, Sweden</teamtailor:location>')),
    'Acme',
  );
  assert.equal(jobs[0].location, 'Stockholm, Sweden');
  assert.equal(jobs[0].isRemote, true);
});

// ── fetch propagates the shape throw ─────────────────────────────────

test('fetchTeamtailor: a challenge-page 200 throws instead of reading as an empty board', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => '<html>Just a moment...</html>' });
  await assert.rejects(
    () => fetchTeamtailor('https://acme.teamtailor.com/jobs.rss', { fetchImpl, company: { name: 'Acme' } }),
    /RSS/,
  );
});
