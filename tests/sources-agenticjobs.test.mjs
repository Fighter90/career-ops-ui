/**
 * Agentic Jobs source (parent career-ops providers/agentic-jobs.mjs parity).
 * Board-wide single-page HTML listing (data-impression-slug cards);
 * provider-selected. CI-isolated (fake fetchImpl, no network).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  flagToCountry,
  cardLines,
  normalizeAgenticCard,
  parseAgenticListing,
  fetchAgenticJobs,
  assertAgenticUrl,
  FEED_URL,
  meta,
} from '../server/lib/sources/agenticjobs.mjs';
import { agenticjobsAdapter } from '../server/lib/portals/adapters/agenticjobs.mjs';

const LISTING = `
<html><body><main>
  <div class="cards">
    <div data-impression-slug="senior-agent-engineer-acme" class="card">
      <img src="/acme.png">
      <h2>Senior Agent Engineer</h2>
      <p class="company">Acme AI</p>
      <p class="location">San Francisco</p>
      <span class="tag">LangGraph</span>
      <span class="flag">🇺🇸</span>
      <time>2026-07-01</time>
    </div>
    <div data-impression-slug="agent-platform-engineer-globex" class="card">
      <span class="badge">Featured</span>
      <h2>Agent Platform Engineer</h2>
      <p class="company">Globex &amp; Co</p>
      <p class="location">Remote</p>
      <span class="flag">🇩🇪</span>
      <time>2026-06-15</time>
    </div>
    <div data-impression-slug="senior-agent-engineer-acme" class="card">
      <h2>Senior Agent Engineer</h2>
      <p class="company">Acme AI</p>
    </div>
  </div>
</main></body></html>`;

test('meta: id/label/region + adapter.id', () => {
  assert.equal(meta.value, 'agenticjobs');
  assert.equal(meta.label, 'Agentic Jobs');
  assert.equal(meta.region, 'en');
  assert.equal(agenticjobsAdapter.id, 'agenticjobs');
});

test('flagToCountry: decodes flag emoji, "" for plain/non-flag input', () => {
  assert.equal(flagToCountry('🇺🇸'), 'United States');
  assert.equal(flagToCountry('🇩🇪'), 'Germany');
  assert.equal(flagToCountry('DE'), '');
  assert.equal(flagToCountry('🇺'), '');
  assert.equal(flagToCountry('LangGraph'), '');
});

test('cardLines: strips script/style/img, decodes entities, drops blank lines', () => {
  const lines = cardLines(
    '<script>var x = "<b>ignore</b>";</script><style>.a{}</style><img src="/logo.png">' +
      '<h2>Agent Engineer</h2> <p>Acme &amp; Co</p><span>  </span><span>Berlin</span>',
  );
  assert.deepEqual(lines, ['Agent Engineer', 'Acme & Co', 'Berlin']);
});

test('normalizeAgenticCard: maps title/company/url, appends flag country, parses date', () => {
  const card = normalizeAgenticCard('senior-agent-engineer-acme', [
    'senior-agent-engineer-acme" class="card">',
    'Featured',
    'Senior Agent Engineer',
    'Acme AI',
    'San Francisco',
    'LangGraph',
    '🇺🇸',
    '2026-07-01',
  ]);
  assert.equal(card.title, 'Senior Agent Engineer');
  assert.equal(card.company, 'Acme AI');
  assert.equal(card.url, 'https://agentic-engineering-jobs.com/jobs/senior-agent-engineer-acme');
  assert.equal(card.id, 'agenticjobs-https://agentic-engineering-jobs.com/jobs/senior-agent-engineer-acme');
  assert.equal(card.location, 'San Francisco, United States');
  assert.equal(card.date, '2026-07-01');
  assert.equal(card.source, 'agenticjobs');
});

test('normalizeAgenticCard: never reads a bare flag or date line as the location', () => {
  // Date-shaped third field → no location (flag country only).
  const noLoc = normalizeAgenticCard('agent-eng', ['Agent Engineer', 'Globex', '2026-06-15', '🇫🇷']);
  assert.equal(noLoc.location, 'France');
  assert.equal(noLoc.date, '2026-06-15');
  // Bare flag in the location slot → flag country only.
  const flagSlot = normalizeAgenticCard('agent-eng-2', ['Agent Engineer', 'Globex', '🇺🇸', '2026-06-15']);
  assert.equal(flagSlot.location, 'United States');
});

test('normalizeAgenticCard: derives isRemote/workplaceType from a Remote location', () => {
  const remote = normalizeAgenticCard('agent-eng-3', ['Agent Engineer', 'Globex', 'Remote', '🇩🇪']);
  assert.equal(remote.location, 'Remote, Germany');
  assert.equal(remote.isRemote, true);
  assert.equal(remote.workplaceType, 'Remote');
  const onsite = normalizeAgenticCard('agent-eng-4', ['Agent Engineer', 'Globex', 'Berlin', '🇩🇪']);
  assert.equal(onsite.isRemote, false);
  assert.equal(onsite.workplaceType, '');
});

test('normalizeAgenticCard: rejects path-unsafe/missing slug + incomplete cards', () => {
  assert.equal(normalizeAgenticCard('bad slug!', ['Title', 'Company']), null);
  assert.equal(normalizeAgenticCard('', ['Title', 'Company']), null);
  assert.equal(normalizeAgenticCard('ok-slug', ['Title only']), null);
});

test('parseAgenticListing: parses every card, dedupes repeated slugs, decodes + flags per card', () => {
  const jobs = parseAgenticListing(LISTING);
  assert.equal(jobs.length, 2); // third card repeats a slug → deduped
  const g = jobs[1];
  assert.equal(g.company, 'Globex & Co');
  assert.equal(g.location, 'Remote, Germany');
  assert.equal(g.url, 'https://agentic-engineering-jobs.com/jobs/agent-platform-engineer-globex');
  assert.equal(g.isRemote, true);
  assert.equal(g.source, 'agenticjobs');
});

test('parseAgenticListing: honors the result cap and tolerates non-string input', () => {
  assert.deepEqual(parseAgenticListing(12345), []);
  assert.equal(parseAgenticListing(LISTING, 1).length, 1);
});

test('fetchAgenticJobs: single page fetch with redirect:error via fake fetchImpl', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, text: async () => LISTING };
  };
  const jobs = await fetchAgenticJobs(FEED_URL, { fetchImpl });
  assert.equal(jobs.length, 2);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://agentic-engineering-jobs.com/');
  assert.equal(calls[0].opts.redirect, 'error');
  assert.ok(jobs.every((j) => j.source === 'agenticjobs'));
  assert.ok(jobs.every((j) => new URL(j.url).hostname === 'agentic-engineering-jobs.com'));
});

test('fetchAgenticJobs: throws when the page yields zero cards (markup-change canary)', async () => {
  const fetchImpl = async () => ({ ok: true, text: async () => '<html><body>no cards here</body></html>' });
  await assert.rejects(() => fetchAgenticJobs(FEED_URL, { fetchImpl }), /parsed 0 job cards/);
});

test('assertAgenticUrl: pins host to agentic-engineering-jobs.com over HTTPS', () => {
  assert.equal(assertAgenticUrl(FEED_URL), FEED_URL);
  assert.throws(() => assertAgenticUrl('https://evil.com/'), /untrusted hostname/);
  assert.throws(() => assertAgenticUrl('http://agentic-engineering-jobs.com/'), /must use HTTPS/);
  assert.throws(() => assertAgenticUrl('not a url'), /invalid URL/);
});

test('adapter: matches only on provider=agenticjobs; buildEndpoint default/override/off-host', () => {
  assert.ok(agenticjobsAdapter.matches({ provider: 'agenticjobs' }));
  assert.equal(agenticjobsAdapter.matches({ careers_url: 'https://agentic-engineering-jobs.com/' }), false);
  assert.equal(agenticjobsAdapter.matches({}), false);
  assert.equal(agenticjobsAdapter.buildEndpoint({ provider: 'agenticjobs' }), FEED_URL);
  const mirror = 'https://agentic-engineering-jobs.com/?mirror=1';
  assert.equal(agenticjobsAdapter.buildEndpoint({ agenticjobs: mirror }), mirror);
  assert.equal(agenticjobsAdapter.buildEndpoint({ api: 'https://evil.com/' }), FEED_URL);
  assert.equal(agenticjobsAdapter.buildEndpoint({ agenticjobs: 'http://agentic-engineering-jobs.com/' }), FEED_URL);
});
