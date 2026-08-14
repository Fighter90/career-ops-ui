/**
 * getManfred source + adapter — CI-isolated tests (fake fetchImpl, no network,
 * no parent-project dependency). Parent career-ops `providers/manfred.mjs`
 * parity: the fixtures mirror shapes measured on the live feed, including the
 * ones that decide the source's design — a catalogue dominated by CLOSED
 * entries, a symbol-not-ISO currency (with a narrow-no-break-space variant),
 * placeless offers whose only place signal is remotePercentage, and updatedAt
 * as the sole timestamp.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeManfredOffer,
  normalizeCurrency,
  parseCompensation,
  salaryToString,
  resolveLocation,
  resolveLang,
  assertManfredUrl,
  fetchManfred,
  FEED_BASE,
  meta,
} from '../server/lib/sources/manfred.mjs';
import { manfredAdapter } from '../server/lib/portals/adapters/manfred.mjs';

// Shape measured on the live feed: an ACTIVE offer with a listed location, a
// symbol currency, and updatedAt as the only timestamp.
const activeOffer = {
  id: 8417,
  position: '  Backend Engineer  ',
  slug: 'wuolah-backend-engineer-jul26',
  status: 'ACTIVE',
  company: { name: 'Wuolah' },
  locations: ['Madrid, Spain'],
  remotePercentage: 0,
  salaryFrom: 32000,
  salaryTo: 35000,
  currency: '€',
  updatedAt: '2026-07-31T10:53:31.241Z',
};

// ---------------------------------------------------------------------------
// meta + adapter surface: provider-selected, host-pinned
// ---------------------------------------------------------------------------

test('meta: id/label/region + FEED_BASE + adapter.id', () => {
  assert.equal(meta.value, 'manfred');
  assert.equal(meta.label, 'getManfred');
  assert.equal(meta.region, 'en');
  assert.equal(FEED_BASE, 'https://www.getmanfred.com/api/v2/public/offers');
  assert.equal(manfredAdapter.id, 'manfred');
  assert.equal(manfredAdapter.label, 'getManfred');
});

test('adapter: matches only provider=manfred; buildEndpoint default/override/off-host', () => {
  assert.ok(manfredAdapter.matches({ provider: 'manfred' }));
  assert.equal(manfredAdapter.matches({ careers_url: 'https://www.getmanfred.com/x' }), false);
  assert.equal(manfredAdapter.matches({}), false);
  assert.equal(manfredAdapter.matches(null), false);

  assert.equal(manfredAdapter.buildEndpoint({ provider: 'manfred' }), FEED_BASE);
  const mirror = 'https://www.getmanfred.com/api/v2/public/offers?mirror=1';
  assert.equal(manfredAdapter.buildEndpoint({ manfred: mirror }), mirror);
  assert.equal(manfredAdapter.buildEndpoint({ api: 'https://evil.com/x' }), FEED_BASE); // off-host ignored
  assert.equal(manfredAdapter.buildEndpoint({ manfred: 'http://www.getmanfred.com/x' }), FEED_BASE); // non-HTTPS ignored
});

// ---------------------------------------------------------------------------
// resolveLang — the API 400s without it, so it is always sent; only EN/ES exist
// ---------------------------------------------------------------------------

test('resolveLang: accepts EN/ES case-insensitively, falls back to EN', () => {
  assert.equal(resolveLang({ lang: 'es' }), 'ES');
  assert.equal(resolveLang({ lang: 'EN' }), 'EN');
  assert.equal(resolveLang({ lang: 'FR' }), 'EN'); // unknown → default
  assert.equal(resolveLang({}), 'EN');
  assert.equal(resolveLang(undefined), 'EN');
});

// ---------------------------------------------------------------------------
// normalizeManfredOffer — field mapping + the catalogue status filter
// ---------------------------------------------------------------------------

test('normalizeManfredOffer: maps title/company/url/location/salary into the web-ui shape', () => {
  const n = normalizeManfredOffer(activeOffer, 'Fallback');
  assert.ok(n);
  assert.equal(n.title, 'Backend Engineer'); // trimmed
  assert.equal(n.company, 'Wuolah');
  assert.equal(n.url, 'https://www.getmanfred.com/ofertas-empleo/8417/wuolah-backend-engineer-jul26');
  assert.equal(n.id, 'manfred-https://www.getmanfred.com/ofertas-empleo/8417/wuolah-backend-engineer-jul26');
  assert.equal(n.location, 'Madrid, Spain');
  assert.equal(n.salary, '32000–35000 EUR');
  assert.equal(n.source, 'manfred');
});

test('normalizeManfredOffer: a CLOSED / status-less offer is dropped (catalogue, not a live board)', () => {
  assert.equal(normalizeManfredOffer({ ...activeOffer, status: 'CLOSED' }), null);
  assert.equal(normalizeManfredOffer({ ...activeOffer, status: undefined }), null);
});

test('normalizeManfredOffer: no date — updatedAt is a modification time, not a publication date', () => {
  const n = normalizeManfredOffer(activeOffer);
  assert.equal(n.date, '');
});

test('normalizeManfredOffer: drops title-less / id-less / slug-less offers (url is the dedup key)', () => {
  assert.equal(normalizeManfredOffer({ ...activeOffer, position: '   ' }), null);
  assert.equal(normalizeManfredOffer({ ...activeOffer, id: undefined }), null);
  assert.equal(normalizeManfredOffer({ ...activeOffer, id: 0 }), null);
  assert.equal(normalizeManfredOffer({ ...activeOffer, slug: '' }), null);
  assert.equal(normalizeManfredOffer(null), null);
});

test('normalizeManfredOffer: company falls back to the entry name, then to getManfred', () => {
  assert.equal(normalizeManfredOffer({ ...activeOffer, company: null }, 'EntryName').company, 'EntryName');
  assert.equal(normalizeManfredOffer({ ...activeOffer, company: null }).company, 'getManfred');
});

test('normalizeManfredOffer: derives isRemote/workplaceType from remotePercentage', () => {
  const remote = normalizeManfredOffer({ ...activeOffer, locations: [], remotePercentage: 100 });
  assert.equal(remote.isRemote, true);
  assert.equal(remote.workplaceType, 'Remote');
  assert.equal(remote.location, 'Remote');

  const hybrid = normalizeManfredOffer({ ...activeOffer, locations: [], remotePercentage: 50 });
  assert.equal(hybrid.isRemote, false);
  assert.equal(hybrid.workplaceType, 'Hybrid');

  const onsite = normalizeManfredOffer({ ...activeOffer, remotePercentage: 0 });
  assert.equal(onsite.isRemote, false);
  assert.equal(onsite.workplaceType, 'Onsite');
});

// ---------------------------------------------------------------------------
// resolveLocation — remote/hybrid stay distinguishable; listed locations win
// ---------------------------------------------------------------------------

test('resolveLocation: placeless offers derive Remote/Hybrid from remotePercentage, on-site keeps ""', () => {
  const placeless = (remotePercentage) => resolveLocation({ locations: [], remotePercentage });
  assert.equal(placeless(100), 'Remote');
  assert.equal(placeless(60), 'Hybrid');
  assert.equal(placeless(40), 'Hybrid');
  assert.equal(placeless(0), '');
});

test('resolveLocation: listed locations win over the remote signal and are joined', () => {
  assert.equal(
    resolveLocation({ locations: ['Paris, France', 'Barcelona, Spain'], remotePercentage: 100 }),
    'Paris, France, Barcelona, Spain',
  );
});

test('resolveLocation: a missing or non-numeric remotePercentage yields "" (no guess)', () => {
  assert.equal(resolveLocation({ remotePercentage: 'oops' }), '');
  assert.equal(resolveLocation({}), '');
});

// ---------------------------------------------------------------------------
// normalizeCurrency — symbols (incl. spacing variants) → ISO; unknown → ""
// ---------------------------------------------------------------------------

test('normalizeCurrency: maps observed symbols (spacing variants included) to ISO codes', () => {
  assert.equal(normalizeCurrency('€'), 'EUR');
  assert.equal(normalizeCurrency(' €'), 'EUR'); // regular space
  assert.equal(normalizeCurrency(' €'), 'EUR'); // narrow no-break space (live feed)
  assert.equal(normalizeCurrency(' €'), 'EUR'); // no-break space
  assert.equal(normalizeCurrency('£'), 'GBP');
  assert.equal(normalizeCurrency('US$'), 'USD');
  assert.equal(normalizeCurrency('$'), 'USD');
  assert.equal(normalizeCurrency('MXN$'), 'MXN');
  assert.equal(normalizeCurrency('EUR'), 'EUR'); // already ISO
});

test('normalizeCurrency: an unknown symbol / non-string yields "" instead of a guess', () => {
  assert.equal(normalizeCurrency('₿'), '');
  assert.equal(normalizeCurrency(null), '');
  assert.equal(normalizeCurrency(42), '');
});

// ---------------------------------------------------------------------------
// parseCompensation + salaryToString — one-sided ranges mirrored; no data → null/""
// ---------------------------------------------------------------------------

test('parseCompensation: mirrors a one-sided range; zero/absent salary yields null', () => {
  assert.deepEqual(parseCompensation({ salaryFrom: 40000, currency: '€' }), {
    min: 40000, max: 40000, currency: 'EUR',
  });
  assert.deepEqual(parseCompensation({ salaryTo: 50000, currency: '$' }), {
    min: 50000, max: 50000, currency: 'USD',
  });
  assert.equal(parseCompensation({ salaryFrom: 0, salaryTo: 0 }), null);
  assert.equal(parseCompensation({}), null);
});

test('salaryToString: renders the STRING salary field, "" when no comp data', () => {
  assert.equal(salaryToString({ min: 32000, max: 35000, currency: 'EUR' }), '32000–35000 EUR');
  assert.equal(salaryToString({ min: 40000, currency: 'EUR' }), '≥ 40000 EUR');
  assert.equal(salaryToString({ max: 50000 }), '≤ 50000');
  assert.equal(salaryToString({ min: 40000, max: 60000 }), '40000–60000'); // no currency
  assert.equal(salaryToString(null), '');
});

// ---------------------------------------------------------------------------
// assertManfredUrl — SSRF guard
// ---------------------------------------------------------------------------

test('assertManfredUrl: https + host-pinned to www.getmanfred.com', () => {
  assert.equal(assertManfredUrl(FEED_BASE), FEED_BASE);
  assert.throws(() => assertManfredUrl('https://evil.com/x'), /untrusted hostname/);
  assert.throws(() => assertManfredUrl('http://www.getmanfred.com/x'), /HTTPS/);
  assert.throws(() => assertManfredUrl('nonsense'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// fetchManfred — single call, host-pinned, redirect:'error', lang, filters,
// dead-board contract
// ---------------------------------------------------------------------------

test('fetchManfred: one host-pinned request with the required lang; returns only ACTIVE offers', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      json: async () => [
        activeOffer,
        { ...activeOffer, id: 8418, slug: 'other-closed', status: 'CLOSED' },
      ],
    };
  };
  const jobs = await fetchManfred(FEED_BASE, { fetchImpl });
  assert.equal(calls.length, 1); // no pagination
  assert.equal(calls[0].url, 'https://www.getmanfred.com/api/v2/public/offers?lang=EN');
  assert.equal(calls[0].opts.redirect, 'error');
  assert.equal(jobs.length, 1); // CLOSED filtered out
  assert.ok(jobs[0].url.endsWith('/8417/wuolah-backend-engineer-jul26'));
  assert.ok(jobs.every((j) => j.source === 'manfred'));
});

test('fetchManfred: lang comes from company.lang', async () => {
  const calls = [];
  const fetchImpl = async (url) => { calls.push(url); return { ok: true, json: async () => [] }; };
  await fetchManfred(FEED_BASE, { fetchImpl, company: { lang: 'es' } });
  assert.equal(calls[0], 'https://www.getmanfred.com/api/v2/public/offers?lang=ES');
});

test('fetchManfred: dedupes offers repeated by url', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => [activeOffer, { ...activeOffer }] });
  const jobs = await fetchManfred(FEED_BASE, { fetchImpl });
  assert.equal(jobs.length, 1);
});

test('fetchManfred: throws on a non-array API response shape', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ offers: [] }) });
  await assert.rejects(() => fetchManfred(FEED_BASE, { fetchImpl }), /unexpected API response/);
});

test('fetchManfred: a failing sole request throws (dead-board contract, portal-health records it)', async () => {
  const failing = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => fetchManfred(FEED_BASE, { fetchImpl: failing }), /HTTP 503/);
});
