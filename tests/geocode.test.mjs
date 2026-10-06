import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let mod;
const file = join(mkdtempSync(join(tmpdir(), 'geocode-')), 'geocode.json');
before(async () => {
  mod = await import('../server/lib/routes/geocode.mjs');
});

const LEEDS = { lat: '53.80', lon: '-1.55', place_rank: 16, category: 'boundary', type: 'administrative' };
// Fake Nominatim: answers by query text, counts calls.
function nominatim(table) {
  const f = async (url) => {
    f.calls++;
    const q = decodeURIComponent(new URL(url).searchParams.get('q'));
    return { ok: true, json: async () => table[q] || [] };
  };
  f.calls = 0;
  return f;
}

test('normalizeLocation: non-places and oversized input are not geocoded', () => {
  for (const s of ['Remote', 'anywhere', '', '  ', 'x'.repeat(201), null]) {
    assert.equal(mod.normalizeLocation(s), null, String(s).slice(0, 20));
  }
  assert.equal(mod.normalizeLocation('Berlin, Germany (Remote)'), 'berlin, germany');
  assert.equal(mod.normalizeLocation('Remote - Munich'), 'munich');
  assert.equal(mod.normalizeLocation('Berlin; London'), 'berlin');
  assert.equal(mod.normalizeLocation('Berlin, Remote'), 'berlin');
  assert.equal(mod.normalizeLocation('Remote, Remote'), null);
  assert.equal(mod.normalizeLocation('Greater Karlsruhe Area'), 'karlsruhe');
  assert.equal(mod.normalizeLocation('Posted: 2026-10-03'), null);
});

test('cleanCompany: strips legal forms, group/region suffixes and parentheticals', () => {
  assert.equal(mod.cleanCompany('NTT DATA Europe & Latam'), 'NTT DATA');
  assert.equal(mod.cleanCompany('ZEISS Group'), 'ZEISS');
  assert.equal(mod.cleanCompany('MARTIN & PARTNER (Mandant vertraulich)'), 'MARTIN & PARTNER');
  assert.equal(mod.cleanCompany('Intavis Peptide Services GmbH'), 'Intavis Peptide Services');
  assert.equal(mod.cleanCompany('Acme GmbH & Co. KG'), 'Acme');
  assert.equal(mod.cleanCompany('Société Générale S.A.'), 'Société Générale');
  assert.equal(mod.cleanCompany('Philips N.V.'), 'Philips');
  assert.equal(mod.cleanCompany('Comarch Sp. z o.o.'), 'Comarch');
  assert.equal(mod.cleanCompany('Atlassian Pty Ltd'), 'Atlassian');
  // A legal-form word that IS the name's first word stays.
  assert.equal(mod.cleanCompany('SAS Institute'), 'SAS Institute');
  assert.equal(mod.cleanCompany('AB InBev'), 'AB InBev');
  assert.equal(mod.cleanCompany('(confidential)'), null);
});

test('geocode: cache hit and non-place need no network', async () => {
  mod._resetGeocode({ hamburg: { lat: 53.55, lon: 10, rank: 16 } }, file);
  const noFetch = () => { throw new Error('network used'); };
  assert.deepEqual(await mod.geocode('Hamburg', { fetch: noFetch }), { lat: 53.55, lon: 10, exact: false });
  assert.deepEqual(await mod.geocode('Remote', { fetch: noFetch }), { lat: null, lon: null, exact: false });
});

test('geocode: miss is fetched once, then cached; failures are not cached', async () => {
  mod._resetGeocode({}, file);
  const f = nominatim({ leeds: [LEEDS] });
  assert.deepEqual(await mod.geocode('Leeds', { fetch: f }), { lat: 53.8, lon: -1.55, exact: false });
  assert.deepEqual(await mod.geocode('leeds', { fetch: f }), { lat: 53.8, lon: -1.55, exact: false });
  assert.equal(f.calls, 1);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).leeds.lat, 53.8);

  const down = async () => ({ ok: false, status: 500 });
  await assert.rejects(mod.geocode('Bordenau', { fetch: down }));
  assert.deepEqual(await mod.geocode('Bordenau', { fetch: nominatim({}) }), { lat: null, lon: null, exact: false });
});

test('geocode: a state/country centroid is not a place', async () => {
  mod._resetGeocode({}, file);
  const f = nominatim({ 'baden-württemberg, germany': [{ lat: '48.5', lon: '9.0', place_rank: 8, addresstype: 'state' }] });
  assert.deepEqual(await mod.geocode('Baden-Württemberg, Germany', { fetch: f }), { lat: null, lon: null, exact: false });
});

test('geocode: a city-state ranks like a state but is a place', async () => {
  mod._resetGeocode({ berlin: { lat: null, lon: null, rank: 8 } }, file);
  const f = nominatim({ berlin: [{ lat: '52.5', lon: '13.4', place_rank: 8, addresstype: 'city' }] });
  assert.deepEqual(await mod.geocode('Berlin', { fetch: f }), { lat: 52.5, lon: 13.4, exact: false });
  assert.equal(f.calls, 1, 'an early reject without address type is looked up again');
});

test('geocode: pre-rank cache entries are looked up again', async () => {
  mod._resetGeocode({ 'baden-württemberg': { lat: 48.5, lon: 9.0 } }, file);
  const f = nominatim({ 'baden-württemberg': [{ lat: '48.5', lon: '9.0', place_rank: 8 }] });
  assert.equal((await mod.geocode('Baden-Württemberg', { fetch: f })).lat, null);
  assert.equal(f.calls, 1);
});

test('geocode: company feature near the place wins; streets and far hits do not', async () => {
  mod._resetGeocode({}, file);
  const f = nominatim({
    leeds: [LEEDS],
    'Acme, leeds': [{ lat: '53.81', lon: '-1.54', category: 'office', type: 'company' }],
    'Zeiss, leeds': [{ lat: '53.79', lon: '-1.56', category: 'highway', type: 'residential' }],
    'Airbus, leeds': [{ lat: '37.4', lon: '-5.9', category: 'man_made', type: 'works' }],
  });
  assert.deepEqual(await mod.geocode('Leeds', { fetch: f }, 'Acme GmbH'), { lat: 53.81, lon: -1.54, exact: true });
  assert.deepEqual(await mod.geocode('Leeds', { fetch: f }, 'Zeiss Group'), { lat: 53.8, lon: -1.55, exact: false });
  assert.deepEqual(await mod.geocode('Leeds', { fetch: f }, 'Airbus'), { lat: 53.8, lon: -1.55, exact: false });
  const before = f.calls;
  await mod.geocode('Leeds', { fetch: f }, 'Acme GmbH');
  assert.equal(f.calls, before, 'company result is cached');
});

test('geocode: after a 429 no further requests go out during the backoff', async () => {
  mod._resetGeocode({}, file);
  let calls = 0;
  const limited = async () => { calls++; return { ok: false, status: 429 }; };
  await assert.rejects(mod.geocode('Pforzheim', { fetch: limited }));
  await assert.rejects(mod.geocode('Ulm', { fetch: limited }));
  assert.equal(calls, 1);
});

test('geocode: a stale entry survives when the refresh fails', async () => {
  mod._resetGeocode({ stuttgart: { lat: 48.78, lon: 9.18 } }, file);
  const limited = async () => ({ ok: false, status: 429 });
  assert.deepEqual(await mod.geocode('Stuttgart', { fetch: limited }), { lat: 48.78, lon: 9.18, exact: false });
  assert.deepEqual(await mod.geocode('Stuttgart', { fetch: limited }), { lat: 48.78, lon: 9.18, exact: false });
});
