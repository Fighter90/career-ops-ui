/**
 * VDAB source — CI-isolated tests.
 * Uses a fake fetchImpl (no network, no parent-project dependency).
 * Parent career-ops parity (providers/vdab.mjs), adapted to the web-ui
 * source contract + rich arbeitsagentur-style job shape.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchVdab,
  parseVdabConfig,
  normalizeJob,
  extractDescription,
  buildSearchBody,
  assertVdabUrl,
  API_URL,
  meta,
} from '../server/lib/sources/vdab.mjs';
import { vdabAdapter } from '../server/lib/portals/adapters/vdab.mjs';

const okJson = (data) => ({ ok: true, json: async () => data });
const err = (status) => ({ ok: false, status, json: async () => ({}) });

/** Raw VDAB resultaten[] record. */
const rawJob = (id, naam, extra = {}) => ({
  id: { id },
  vacaturefunctie: { naam },
  vacatureBedrijfsnaam: 'Co',
  tewerkstellingsLocatieRegioOfAdres: 'GENT',
  ...extra,
});

/**
 * fetchImpl that maps a trefwoord → array-of-pages of raw records, and answers
 * detail (/vacatures/<id>) calls from `details`. Records every call.
 */
function fakeSearch(byTrefwoord, details = {}) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, headers: opts?.headers, method: opts?.method });
    if (url.includes('/vacatures/') && /\/vacatures\/\d+/.test(url)) {
      const id = url.match(/\/vacatures\/(\d+)/)?.[1];
      const d = details[id];
      return d === undefined ? err(500) : okJson(d);
    }
    const body = JSON.parse(opts.body);
    const trefwoord = body.criteria.trefwoord;
    const pages = byTrefwoord[trefwoord] || [];
    return okJson({ resultaten: pages[body.pagina] || [] });
  };
  impl.calls = calls;
  return impl;
}

// ---------------------------------------------------------------------------
// meta + adapter
// ---------------------------------------------------------------------------

test('meta is { value: "vdab", label: "VDAB", region: "en" }', () => {
  assert.deepEqual(meta, { value: 'vdab', label: 'VDAB', region: 'en' });
});

test('adapter matches provider:vdab and host-pins the endpoint', () => {
  assert.equal(vdabAdapter.matches({ provider: 'vdab' }), true);
  assert.equal(vdabAdapter.matches({ provider: 'other' }), false);
  assert.equal(vdabAdapter.buildEndpoint({}), API_URL);
  assert.equal(vdabAdapter.buildEndpoint({ api: 'https://www.vdab.be/x' }), 'https://www.vdab.be/x');
});

// ---------------------------------------------------------------------------
// parseVdabConfig
// ---------------------------------------------------------------------------

test('parseVdabConfig applies defaults when the block is absent', () => {
  const def = parseVdabConfig({});
  assert.deepEqual(def, { keywords: [], days: 30, size: 100, fetchDetails: false, detailLimit: 25 });
});

test('parseVdabConfig trims/dedups keywords and clamps numbers', () => {
  const cfg = parseVdabConfig({ vdab: { keywords: ['  python  ', '', 7, 'data engineer', 'python'], size: 0, days: -3 } });
  assert.deepEqual(cfg.keywords, ['python', 'data engineer']);
  assert.equal(cfg.size, 1);
  assert.equal(cfg.days, 1);

  const high = parseVdabConfig({ vdab: { keywords: ['x'], size: 999, days: 999999 } });
  assert.equal(high.size, 100);
  assert.equal(high.days, 1000);

  const details = parseVdabConfig({ vdab: { keywords: ['x'], fetchDetails: true, detailLimit: 999 } });
  assert.equal(details.fetchDetails, true);
  assert.equal(details.detailLimit, 100);
  assert.equal(parseVdabConfig({ vdab: { keywords: ['x'], detailLimit: -5 } }).detailLimit, 1);
});

// ---------------------------------------------------------------------------
// buildSearchBody
// ---------------------------------------------------------------------------

test('buildSearchBody sets trefwoord, onlineSindsCode, paginaGrootte and pagina', () => {
  const body = buildSearchBody('Python Developer', { days: 14, size: 50, pagina: 2 });
  assert.equal(body.criteria.trefwoord, 'Python Developer');
  assert.equal(body.criteria.onlineSindsCode, '14');
  assert.equal(body.criteria.sorteerVeld, 'STANDAARD');
  assert.equal(body.paginaGrootte, 50);
  assert.equal(body.pagina, 2);
  assert.equal(body.zoekmodus, 'C2');
  assert.deepEqual(body.criteria.beroepCodes, []);
});

// ---------------------------------------------------------------------------
// normalizeJob + extractDescription
// ---------------------------------------------------------------------------

test('normalizeJob maps VDAB fields to the rich arbeitsagentur-style shape', () => {
  const norm = normalizeJob({
    id: { id: 74022311 },
    vacaturefunctie: { naam: '  Python Developer  ' },
    vacatureBedrijfsnaam: ' Acme ',
    tewerkstellingsLocatieRegioOfAdres: 'ANTWERPEN',
    eerstePublicatieDatum: '2026-07-19T02:30:37Z',
  });
  assert.equal(norm.id, 'vdab-74022311');
  assert.equal(norm.title, 'Python Developer');
  assert.equal(norm.company, 'Acme');
  assert.equal(norm.location, 'ANTWERPEN');
  assert.equal(norm.url, 'https://www.vdab.be/vindeenjob/vacatures/74022311');
  assert.equal(norm.date, '2026-07-19');
  assert.equal(norm.salary, '');
  assert.equal(norm.snippet, '');
  assert.equal(norm.source, 'vdab');
  assert.equal(norm.isRemote, false);
  assert.equal(norm.workplaceType, 'Onsite');
  assert.equal(norm.relocates, false);
  assert.equal(norm.vdabId, '74022311');
});

test('normalizeJob flags remote from title/location', () => {
  const remote = normalizeJob({ id: { id: 1 }, vacaturefunctie: { naam: 'Remote Data Engineer (thuiswerk)' } });
  assert.equal(remote.isRemote, true);
  assert.equal(remote.workplaceType, 'Remote');
});

test('normalizeJob returns null without an id or title', () => {
  assert.equal(normalizeJob({ vacaturefunctie: { naam: 'No id' } }), null);
  assert.equal(normalizeJob({ id: { id: 1 }, vacaturefunctie: { naam: '' } }), null);
});

test('extractDescription prefers markdown, falls back to plainText, trims', () => {
  assert.equal(extractDescription({ functie: { omschrijving: { markdown: ' **Build** things ', plainText: 'Fallback' } } }), '**Build** things');
  assert.equal(extractDescription({ functie: { omschrijving: { plainText: ' Plain text ' } } }), 'Plain text');
  assert.equal(extractDescription({}), '');
});

// ---------------------------------------------------------------------------
// assertVdabUrl (host guard)
// ---------------------------------------------------------------------------

test('assertVdabUrl accepts www.vdab.be HTTPS, rejects other hosts/schemes', () => {
  assert.equal(assertVdabUrl(API_URL), API_URL);
  assert.throws(() => assertVdabUrl('http://www.vdab.be/x'), /must use HTTPS/);
  assert.throws(() => assertVdabUrl('https://evil.example.com/x'), /untrusted hostname/);
  assert.throws(() => assertVdabUrl('https://vdab.be.evil.com/x'), /untrusted hostname/);
  assert.throws(() => assertVdabUrl('not a url'), /invalid URL/);
});

test('fetchVdab rejects an off-host endpoint override before any fetch', async () => {
  let called = false;
  await assert.rejects(
    () => fetchVdab('https://evil.example.com/api', {
      fetchImpl: async () => { called = true; return okJson({ resultaten: [] }); },
      company: { vdab: { keywords: ['python'] } },
    }),
    /untrusted hostname/,
  );
  assert.equal(called, false);
});

// ---------------------------------------------------------------------------
// fetch: keyword query building, dedup, header, over-fetch/recall
// ---------------------------------------------------------------------------

test('fetchVdab builds a trefwoord query per keyword, dedups by id, strips vdabId, sends the key', async () => {
  const impl = fakeSearch({
    python: [[rawJob(1, 'Python Dev')], []],
    data: [[rawJob(1, 'Python Dev')], []], // dup id across keywords
  });
  const jobs = await fetchVdab(API_URL, { fetchImpl: impl, company: { name: 'VDAB', vdab: { keywords: ['python', 'data'], size: 1 } } });
  assert.equal(jobs.length, 1);
  assert.equal('vdabId' in jobs[0], false);
  // key header sent on the search POST
  const searchCall = impl.calls.find((c) => c.method === 'POST');
  assert.equal(searchCall.headers['vej-key-monitor'], 'b277002f-e1fa-4fc5-868a-fdab633c3851');
  // trefwoord threaded from config keywords
  const trefwoorden = impl.calls.filter((c) => c.method === 'POST').map((c) => 'seen');
  assert.ok(trefwoorden.length >= 2);
});

test('fetchVdab throws when no keywords are configured (no profile fallback)', async () => {
  await assert.rejects(
    () => fetchVdab(API_URL, { fetchImpl: fakeSearch({}), company: { name: 'Empty', vdab: {} } }),
    /has no vdab\.keywords\[\]/,
  );
});

// ---------------------------------------------------------------------------
// pagination + over-fetch cap
// ---------------------------------------------------------------------------

test('fetchVdab paginates until a short page is returned', async () => {
  const impl = fakeSearch({ python: [[rawJob(1, 'A'), rawJob(2, 'B')], [rawJob(3, 'C')]] }); // page0 full(2), page1 short(1)
  const jobs = await fetchVdab(API_URL, { fetchImpl: impl, company: { vdab: { keywords: ['python'], size: 2 } } });
  assert.equal(jobs.length, 3);
});

test('fetchVdab caps real-scan pagination at MAX_PAGES_PER_KEYWORD (50) when every page is full', async () => {
  let requests = 0;
  const impl = async (url, opts) => {
    requests++;
    const n = requests;
    return okJson({ resultaten: [rawJob(n, `Job ${n}`)] }); // always a "full" page (length === size 1)
  };
  const jobs = await fetchVdab(API_URL, { fetchImpl: impl, company: { vdab: { keywords: ['python'], size: 1 } } });
  assert.equal(requests, 50);
  assert.equal(jobs.length, 50);
});

test('fetchVdab caps pagination at opts.maxPages during a bounded probe', async () => {
  let requests = 0;
  const impl = async () => { requests++; return okJson({ resultaten: [rawJob(requests, 'A')] }); };
  const jobs = await fetchVdab(API_URL, { fetchImpl: impl, maxPages: 1, company: { vdab: { keywords: ['python'], size: 1 } } });
  assert.equal(requests, 1);
  assert.equal(jobs.length, 1);
});

// ---------------------------------------------------------------------------
// malformed fail-soft
// ---------------------------------------------------------------------------

test('fetchVdab treats a missing/null/non-array resultaten as an empty page, not a throw', async () => {
  const missing = await fetchVdab(API_URL, { fetchImpl: async () => okJson({}), company: { vdab: { keywords: ['python'] } } });
  assert.deepEqual(missing, []);
  const nul = await fetchVdab(API_URL, { fetchImpl: async () => okJson({ resultaten: null }), company: { vdab: { keywords: ['python'] } } });
  assert.deepEqual(nul, []);
  const str = await fetchVdab(API_URL, { fetchImpl: async () => okJson({ resultaten: 'oops' }), company: { vdab: { keywords: ['python'] } } });
  assert.deepEqual(str, []);
});

// ---------------------------------------------------------------------------
// recall-first: partial success vs total outage
// ---------------------------------------------------------------------------

test('fetchVdab does not throw when one keyword succeeds empty and another fails', async () => {
  const impl = async (url, opts) => {
    const trefwoord = JSON.parse(opts.body).criteria.trefwoord;
    if (trefwoord === 'bad') return err(503);
    return okJson({ resultaten: [] });
  };
  const jobs = await fetchVdab(API_URL, { fetchImpl: impl, company: { vdab: { keywords: ['ok', 'bad'] } } });
  assert.deepEqual(jobs, []);
});

test('fetchVdab throws when every keyword request fails (total outage)', async () => {
  await assert.rejects(
    () => fetchVdab(API_URL, { fetchImpl: async () => err(500), company: { vdab: { keywords: ['a', 'b'] } } }),
    /all 2 keyword request\(s\) failed/,
  );
});

// ---------------------------------------------------------------------------
// detail enrichment (opt-in, bounded, batched, fail-open)
// ---------------------------------------------------------------------------

test('fetchVdab detail enrichment adds snippet, respects detailLimit, fails open per detail', async () => {
  const impl = fakeSearch(
    { python: [[rawJob(1, 'A'), rawJob(2, 'B'), rawJob(3, 'C')], []] },
    {
      1: { functie: { omschrijving: { markdown: 'Description 1' } } },
      // id 2 → undefined → 500 → stays without a snippet
      3: { functie: { omschrijving: { markdown: 'Description 3' } } },
    },
  );
  const jobs = await fetchVdab(API_URL, { fetchImpl: impl, company: { vdab: { keywords: ['python'], size: 100, fetchDetails: true, detailLimit: 2 } } });
  assert.equal(jobs.length, 3);
  assert.equal(jobs[0].snippet, 'Description 1');
  assert.equal(jobs[1].snippet, ''); // errored detail → untouched
  assert.equal(jobs[2].snippet, ''); // beyond detailLimit=2
  const detailCalls = impl.calls.filter((c) => /\/vacatures\/\d+/.test(c.url));
  assert.equal(detailCalls.length, 2);
});

test('fetchVdab caps concurrent detail lookups at DETAIL_BATCH (5)', async () => {
  let inFlight = 0;
  let peak = 0;
  const detailIds = [];
  const seven = [1, 2, 3, 4, 5, 6, 7].map((id) => rawJob(id, `Job ${id}`));
  const impl = async (url, opts) => {
    if (/\/vacatures\/\d+/.test(url)) {
      const id = url.match(/\/vacatures\/(\d+)/)?.[1];
      detailIds.push(id);
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return okJson({ functie: { omschrijving: { markdown: `Description ${id}` } } });
    }
    return okJson({ resultaten: seven });
  };
  const jobs = await fetchVdab(API_URL, { fetchImpl: impl, company: { vdab: { keywords: ['python'], size: 100, fetchDetails: true, detailLimit: 25 } } });
  assert.ok(peak > 0 && peak <= 5, `peak in-flight = ${peak}`);
  assert.equal(detailIds.length, 7);
  assert.equal(new Set(detailIds).size, 7);
  assert.ok(jobs.every((j) => j.snippet === `Description ${j.url.split('/').pop()}`));
});

// ---------------------------------------------------------------------------
// self-heal: 403 → re-derive key from live bundle → retry
// ---------------------------------------------------------------------------

test('fetchVdab self-heals a rotated key: re-derives once from the live bundle, then retries', async () => {
  const FRESH = '11111111-2222-3333-4444-555555555555';
  let fetchTextCalls = 0;
  const keysSent = [];
  const impl = async (url, opts) => {
    // fetchText targets (bundle page + bundle js) have no JSON body / are GET html
    if (url === 'https://www.vdab.be/vindeenjob/vacatures') {
      fetchTextCalls++;
      return { ok: true, text: async () => '<script src="https://www.vdab.be/webapps/vindeenjob/main-XYZ.js"></script>' };
    }
    if (url.includes('/webapps/vindeenjob/main-')) {
      fetchTextCalls++;
      return { ok: true, text: async () => `foo.set("vej-key-monitor","${FRESH}")` };
    }
    // search POST
    keysSent.push(opts.headers['vej-key-monitor']);
    if (opts.headers['vej-key-monitor'] !== FRESH) return err(403);
    return okJson({ resultaten: [] });
  };
  const jobs = await fetchVdab(API_URL, { fetchImpl: impl, company: { vdab: { keywords: ['python'] } } });
  assert.deepEqual(jobs, []);
  assert.equal(fetchTextCalls, 2);
  assert.equal(keysSent.length, 2);
  assert.equal(keysSent[1], FRESH);
});

test('fetchVdab surfaces the original 403 when the bundle yields no fresh key', async () => {
  const impl = async (url, opts) => {
    if (url === 'https://www.vdab.be/vindeenjob/vacatures') {
      return { ok: true, text: async () => '<html>no script here</html>' };
    }
    return err(403);
  };
  await assert.rejects(
    () => fetchVdab(API_URL, { fetchImpl: impl, company: { vdab: { keywords: ['python'] } } }),
    /HTTP 403/,
  );
});

test('fetchVdab does not attempt self-heal on a non-403 error', async () => {
  let fetchTextCalls = 0;
  const impl = async (url) => {
    if (url === 'https://www.vdab.be/vindeenjob/vacatures') { fetchTextCalls++; return { ok: true, text: async () => '' }; }
    return err(500);
  };
  await assert.rejects(() => fetchVdab(API_URL, { fetchImpl: impl, company: { vdab: { keywords: ['a'] } } }), /HTTP 500/);
  assert.equal(fetchTextCalls, 0);
});
