/**
 * Pinpoint source (v1.80.0 parity). Per-tenant ATS, public /postings.json feed.
 * CI-isolated (fake fetchImpl).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePinpointResponse, fetchPinpoint, assertPinpointUrl, PINPOINT_HOST_RE } from '../server/lib/sources/pinpoint.mjs';
import { pinpointAdapter } from '../server/lib/portals/adapters/pinpoint.mjs';

const POSTINGS_JSON = {
  data: [
    {
      id: '101',
      title: 'Backend Engineer',
      url: 'https://acme.pinpointhq.com/jobs/101',
      location: { name: 'London, UK', city: 'London', province: 'England' },
      created_at: '2026-06-25T10:00:00Z',
    },
    {
      id: '102',
      title: 'Remote Product Designer',
      url: 'https://acme.pinpointhq.com/jobs/102',
      location: { name: '', city: 'San Francisco', province: 'CA' },
    },
    {
      // missing title — should be dropped
      id: '103',
      url: 'https://acme.pinpointhq.com/jobs/103',
      location: { name: 'Berlin' },
    },
    {
      // missing / bad url — should be dropped
      id: '104',
      title: 'No URL Job',
      url: '',
      location: { name: 'Remote' },
    },
  ],
};

test('parsePinpointResponse: basic shape — 12 fields, source, dropped rows', () => {
  const jobs = parsePinpointResponse(POSTINGS_JSON, 'Acme', 'acme.pinpointhq.com');
  assert.equal(jobs.length, 2); // title-less and no-url rows dropped

  const j0 = jobs[0];
  // All 12 required fields present
  assert.ok('id' in j0, 'id');
  assert.ok('title' in j0, 'title');
  assert.ok('company' in j0, 'company');
  assert.ok('url' in j0, 'url');
  assert.ok('salary' in j0, 'salary');
  assert.ok('location' in j0, 'location');
  assert.ok('isRemote' in j0, 'isRemote');
  assert.ok('workplaceType' in j0, 'workplaceType');
  assert.ok('relocates' in j0, 'relocates');
  assert.ok('date' in j0, 'date');
  assert.ok('snippet' in j0, 'snippet');
  assert.ok('source' in j0, 'source');

  assert.equal(j0.id, 'pinpoint-101');
  assert.equal(j0.title, 'Backend Engineer');
  assert.equal(j0.company, 'Acme');
  assert.equal(j0.url, 'https://acme.pinpointhq.com/jobs/101');
  assert.equal(j0.location, 'London, UK');
  assert.equal(j0.isRemote, false);
  assert.equal(j0.workplaceType, 'Onsite');
  assert.equal(j0.relocates, false);
  assert.equal(j0.date, '2026-06-25');
  assert.equal(j0.salary, '');
  assert.equal(j0.snippet, '');
  assert.equal(j0.source, 'pinpoint');
});

test('parsePinpointResponse: remote inference from title; city/province fallback location', () => {
  const jobs = parsePinpointResponse(POSTINGS_JSON, 'Acme', 'acme.pinpointhq.com');
  const j1 = jobs[1]; // "Remote Product Designer"
  assert.equal(j1.isRemote, true);
  assert.equal(j1.workplaceType, 'Remote');
  // location.name is empty → city/province assembled
  assert.equal(j1.location, 'San Francisco, CA');
});

test('parsePinpointResponse: derives company from tenant slug when companyName is empty', () => {
  const json = {
    data: [{ id: '1', title: 'Engineer', url: 'https://globex.pinpointhq.com/jobs/1', location: {} }],
  };
  const jobs = parsePinpointResponse(json, '', 'globex.pinpointhq.com');
  assert.equal(jobs[0].company, 'Globex');
});

test('parsePinpointResponse: non-array data → empty result', () => {
  assert.deepEqual(parsePinpointResponse({}, 'X', 'x.pinpointhq.com'), []);
  assert.deepEqual(parsePinpointResponse({ data: null }, 'X', 'x.pinpointhq.com'), []);
});

test('fetchPinpoint: normalizes via fake fetchImpl + stamps company', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => POSTINGS_JSON });
  const jobs = await fetchPinpoint('https://acme.pinpointhq.com/postings.json', {
    fetchImpl,
    company: { name: 'Acme' },
  });
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((j) => j.company === 'Acme' && j.source === 'pinpoint'));
});

test('fetchPinpoint: throws on non-ok response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) });
  await assert.rejects(
    () => fetchPinpoint('https://acme.pinpointhq.com/postings.json', { fetchImpl }),
    /HTTP 404/,
  );
});

test('assertPinpointUrl: pins host to <slug>.pinpointhq.com', () => {
  assert.equal(
    assertPinpointUrl('https://acme.pinpointhq.com/postings.json'),
    'https://acme.pinpointhq.com/postings.json',
  );
  assert.throws(() => assertPinpointUrl('https://evil.com/postings.json'), /untrusted hostname/);
  assert.throws(() => assertPinpointUrl('http://acme.pinpointhq.com/postings.json'), /must use HTTPS/);
  assert.throws(() => assertPinpointUrl('not-a-url'), /invalid URL/);
});

test('PINPOINT_HOST_RE: matches pinpointhq.com subdomains, rejects others', () => {
  assert.ok(PINPOINT_HOST_RE.test('acme.pinpointhq.com'));
  assert.ok(PINPOINT_HOST_RE.test('my-company.pinpointhq.com'));
  assert.equal(PINPOINT_HOST_RE.test('pinpointhq.com'), false);
  assert.equal(PINPOINT_HOST_RE.test('evil.com'), false);
  assert.equal(PINPOINT_HOST_RE.test('acme.pinpointhq.com.evil.com'), false);
});

test('adapter: matches on <slug>.pinpointhq.com host + provider flag; off-domain → no match', () => {
  assert.ok(pinpointAdapter.matches({ careers_url: 'https://acme.pinpointhq.com' }));
  assert.ok(pinpointAdapter.matches({ provider: 'pinpoint' }));
  assert.equal(pinpointAdapter.matches({ careers_url: 'https://acme.example.com' }), false);
  assert.equal(pinpointAdapter.matches({ careers_url: 'https://acme.com' }), false);
});

test('adapter: buildEndpoint returns /postings.json on the tenant origin', () => {
  assert.equal(
    pinpointAdapter.buildEndpoint({ careers_url: 'https://acme.pinpointhq.com' }),
    'https://acme.pinpointhq.com/postings.json',
  );
  assert.equal(pinpointAdapter.buildEndpoint({ careers_url: 'https://acme.com' }), null);
});

// ── Demo-tenant filtering (parent #4190) ──
const DEMO_DESCRIPTION = '<div><!--block-->We are seeking a passionate and strategic Head of DEI...'
  + '<figure data-trix-attachment="{&quot;content&quot;:&quot;<div data-plyr-provider=\\&quot;youtube\\&quot; '
  + 'data-plyr-embed-id=\\&quot;https://www.youtube.com/embed/https://www.youtube.com/embed/pFxm6fszrpw\\&quot;'
  + '><iframe src=\\&quot;https://www.youtube.com/embed/https://www.youtube.com/embed/pFxm6fszrpw\\&quot;>'
  + '</iframe></div>&quot;}"></figure></div>';

test('parsePinpointResponse: drops a posting carrying the shared demo-video fingerprint (#4190)', () => {
  const json = { data: [{
    title: 'Head of DEI - UK',
    url: 'https://exampleco.pinpointhq.com/postings/abc',
    description: DEMO_DESCRIPTION,
    location: { name: 'Remote' },
  }] };
  assert.equal(parsePinpointResponse(json, 'ExampleCo').length, 0);
});

test('parsePinpointResponse: keeps a real posting embedding an unrelated YouTube video', () => {
  const json = { data: [{
    title: 'Senior Backend Engineer',
    url: 'https://acme.pinpointhq.com/postings/xyz',
    description: '<div>Join our team! <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></div>',
    location: { name: 'Remote' },
  }] };
  assert.equal(parsePinpointResponse(json, 'Acme').length, 1);
});

test('parsePinpointResponse: a posting with no description field is kept (no false-positive drop)', () => {
  const json = { data: [{ title: 'Role With No Description', url: 'https://acme.pinpointhq.com/postings/1' }] };
  assert.equal(parsePinpointResponse(json, 'Acme').length, 1);
});
