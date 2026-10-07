/**
 * Adapter pin-branch completion tests (v1.242.0 integration).
 *
 * The Phase-2 host pins added branches in four adapters that no suite reached
 * (coverage gate: adapters/arbeitsagentur + ibm line, adapters/greenhouse +
 * rippling branch). These tests drive every pin branch through the exported
 * adapter objects — no network, no parent project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { arbeitsagenturAdapter } = await import('../server/lib/portals/adapters/arbeitsagentur.mjs');
const { ibmAdapter } = await import('../server/lib/portals/adapters/ibm.mjs');
const { ripplingAdapter } = await import('../server/lib/portals/adapters/rippling.mjs');
const { greenhouseAdapter, greenhouseSlugFromUrl } = await import('../server/lib/portals/adapters/greenhouse.mjs');

// ── arbeitsagentur / ibm: the api: override accepts ONLY https on the exact host ──

for (const [name, adapter, host] of [
  ['arbeitsagentur', arbeitsagenturAdapter, 'rest.arbeitsagentur.de'],
  ['ibm', ibmAdapter, 'www-api.ibm.com'],
]) {
  test(`${name}: api override honored on https + exact host`, () => {
    const url = `https://${host}/x`;
    const ep = adapter.buildEndpoint({ provider: name, api: url });
    assert.ok(String(ep).startsWith(url), `override kept: ${ep}`);
  });

  test(`${name}: http / off-host / garbage / non-string api → canonical feed, never the override`, () => {
    for (const bad of [`http://${host}/x`, 'https://evil.com/x', 'not a url', 42, null, undefined]) {
      const ep = adapter.buildEndpoint({ provider: name, api: bad });
      assert.notEqual(ep, bad, `override refused for ${JSON.stringify(bad)}`);
      assert.ok(typeof ep === 'string' && ep.length > 0, `canonical endpoint for ${JSON.stringify(bad)}`);
    }
  });

  test(`${name}: matches() keys on provider only; non-object refused`, () => {
    assert.equal(adapter.matches({ provider: name }), true);
    assert.equal(adapter.matches({ provider: 'other' }), false);
    assert.equal(adapter.matches(null), false);
    assert.equal(adapter.matches('ibm'), false);
  });
}

// ── rippling: matches/buildEndpoint slug contract ──

test('rippling: provider pin without a URL matches (pure provider entry)', () => {
  assert.equal(ripplingAdapter.matches({ provider: 'rippling' }), true);
  assert.equal(ripplingAdapter.buildEndpoint({ provider: 'rippling' }), null); // no slug → null endpoint
});

test('rippling: provider + rippling URL (slug parses) → endpoint built', () => {
  const c = { provider: 'rippling', careers_url: 'https://ats.rippling.com/acme-jobs/jobs' };
  assert.equal(ripplingAdapter.matches(c), true);
  const ep = ripplingAdapter.buildEndpoint(c);
  assert.ok(typeof ep === 'string' && ep.includes('acme'), `endpoint: ${ep}`);
});

test('rippling: provider + unusable URL → refused (matches true + endpoint null would hang the scan)', () => {
  const c = { provider: 'rippling', careers_url: 'https://example.com/not-rippling' };
  assert.equal(ripplingAdapter.matches(c), false);
});

test('rippling: URL-carried slug claims without a provider tag; garbage does not', () => {
  assert.equal(ripplingAdapter.matches({ careers_url: 'https://ats.rippling.com/acme-jobs/jobs' }), true);
  assert.equal(ripplingAdapter.matches({ careers_url: 'https://example.com/' }), false);
  assert.equal(ripplingAdapter.matches({ api: 42 }), false);
  assert.equal(ripplingAdapter.matches(null), false);
});

test('rippling: buildEndpoint refuses non-objects and falls through empty-string api', () => {
  assert.equal(ripplingAdapter.buildEndpoint(null), null);
  assert.equal(ripplingAdapter.buildEndpoint('https://ats.rippling.com/acme-jobs/jobs'), null); // non-object
  const ep = ripplingAdapter.buildEndpoint({ provider: 'rippling', api: '', careers_url: 'https://ats.rippling.com/acme-jobs/jobs' });
  assert.ok(typeof ep === 'string' && ep.includes('acme-jobs'), `empty api → careers_url: ${ep}`);
});

test('rippling: non-string api falls through to careers_url in both matches and buildEndpoint', () => {
  const c = { provider: 'rippling', api: 42, careers_url: 'https://ats.rippling.com/acme-jobs/jobs' };
  assert.equal(ripplingAdapter.matches(c), true); // api unusable → !raw → provider-only entry
  const ep = ripplingAdapter.buildEndpoint(c);
  assert.ok(typeof ep === 'string' && ep.includes('acme-jobs'), `endpoint via careers_url: ${ep}`);
});

// ── greenhouse: the pinned-parser branches ──

test('greenhouse slug parser: scheme-less legacy host, embed ?for=, and every refusal branch', () => {
  assert.equal(greenhouseSlugFromUrl('boards.greenhouse.io/acme'), 'acme'); // scheme-less tolerated
  assert.equal(greenhouseSlugFromUrl('https://boards.greenhouse.io/embed/job_board?for=acme'), 'acme');
  assert.equal(greenhouseSlugFromUrl('https://job-boards.eu.greenhouse.io/acme/jobs/123'), 'acme');
  // refusals
  assert.equal(greenhouseSlugFromUrl(''), null);
  assert.equal(greenhouseSlugFromUrl(42), null);
  assert.equal(greenhouseSlugFromUrl('https://example.com/acme'), null); // off-host
  assert.equal(greenhouseSlugFromUrl('https://user:pass@boards.greenhouse.io/acme'), null); // credentials
  assert.equal(greenhouseSlugFromUrl('https://boards.greenhouse.io/embed/job_board'), null); // embed, no ?for
  assert.equal(greenhouseSlugFromUrl('https://boards.greenhouse.io/..'), null); // dot-only path → no segment
  assert.equal(greenhouseSlugFromUrl('https://boards.greenhouse.io/embed/job_board?for=..'), null); // traversal slug refused
  assert.equal(greenhouseSlugFromUrl('ftp://boards.greenhouse.io/acme'), null); // non-http(s) scheme
});

test('greenhouse adapter: api override rules and careers_url fallback', () => {
  assert.equal(greenhouseAdapter.buildEndpoint({ api: 'https://boards-api.greenhouse.io/v1/boards/acme/jobs' }),
    'https://boards-api.greenhouse.io/v1/boards/acme/jobs'); // exact override returned as-is
  for (const bad of ['http://boards-api.greenhouse.io/x', 'https://evil.com/?x=boards-api.greenhouse.io', 'garbage', 7]) {
    const ep = greenhouseAdapter.buildEndpoint({ api: bad, careers_url: 'https://boards.greenhouse.io/acme' });
    assert.equal(ep, 'https://boards-api.greenhouse.io/v1/boards/acme/jobs', `override ${JSON.stringify(bad)} refused → careers_url`);
  }
  assert.equal(greenhouseAdapter.buildEndpoint({ api: 'https://evil.com/?x=boards-api.greenhouse.io' }), null);
  assert.equal(greenhouseAdapter.matches(null), false);
  assert.equal(greenhouseAdapter.matches({ api: 'https://boards-api.greenhouse.io/v1/boards/acme/jobs' }), true);
  assert.equal(greenhouseAdapter.matches({ careers_url: 'https://example.com/?for=boards.greenhouse.io' }), false);
});
